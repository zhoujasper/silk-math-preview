import * as vscode from 'vscode';

import { COMMAND_NS, PRODUCT_NAME } from '../core/channel';
import { CompletionController } from './completionController';
import type { FileExclusions } from './fileExclusions';
import { diagnoseMath } from '../core/diagnostics.js';
import { mathRegionContent, scanMathRegions } from '../core/mathScanner.js';
import type {
  DiagnosticFix,
  MathDiagnostic,
} from '../core/types.js';
import type {
  DefinitionWorkspace,
} from './definitionWorkspace.js';

interface DocumentFixes {
  readonly context: string;
  readonly version: number;
  readonly diagnostics: readonly MathDiagnostic[];
}

const SELECTOR: vscode.DocumentSelector = [
  { language: 'latex' },
  { language: 'tex' },
  { language: 'markdown' },
  { language: 'mdx' },
];

/** 注册补全、诊断与显式 Quick Fix；不会主动编辑用户源码。 */
export function registerLanguageFeatures(
  context: vscode.ExtensionContext,
  definitions: DefinitionWorkspace,
  exclusions: FileExclusions,
): vscode.Disposable {
  const controller = new LanguageFeatureController(definitions, exclusions);
  context.subscriptions.push(controller);
  return controller;
}

class LanguageFeatureController implements vscode.Disposable {
  private readonly diagnosticCollection = vscode.languages.createDiagnosticCollection(COMMAND_NS);
  private readonly disposables: vscode.Disposable[] = [];
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly scanGeneration = new Map<string, number>();
  private readonly fixes = new Map<string, DocumentFixes>();
  private disposed = false;

  public constructor(private readonly definitions: DefinitionWorkspace, exclusions: FileExclusions) {
    this.disposables.push(
      this.diagnosticCollection,
      new CompletionController(definitions, exclusions),
      vscode.languages.registerCodeActionsProvider(
        SELECTOR,
        {
          provideCodeActions: (document, _range, context) =>
            this.provideCodeActions(document, context),
        },
        { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
      ),
      vscode.workspace.onDidOpenTextDocument((document) => this.schedule(document, 0)),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.contentChanges.length > 0) {
          this.schedule(event.document, 220);
        }
      }),
      vscode.workspace.onDidCloseTextDocument((document) => this.forget(document)),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (
          event.affectsConfiguration(`${COMMAND_NS}.customMathEnvironments`) ||
          event.affectsConfiguration(`${COMMAND_NS}.quickFixOnType`)
        ) {
          this.scheduleOpenDocuments();
        }
      }),
      this.definitions.onDidInvalidate(() => this.scheduleOpenDocuments()),
    );

    this.scheduleOpenDocuments();
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    for (const disposable of this.disposables.splice(0)) {
      disposable.dispose();
    }
    this.scanGeneration.clear();
    this.fixes.clear();
  }

  private provideCodeActions(
    document: vscode.TextDocument,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const stored = this.fixes.get(uriKey(document.uri));
    if (!stored || stored.version !== document.version) {
      return [];
    }
    const actions: vscode.CodeAction[] = [];
    for (const vscodeDiagnostic of context.diagnostics) {
      if (vscodeDiagnostic.source !== PRODUCT_NAME) {
        continue;
      }
      const code = typeof vscodeDiagnostic.code === 'object'
        ? String(vscodeDiagnostic.code.value)
        : String(vscodeDiagnostic.code ?? '');
      const diagnostic = stored.diagnostics.find((candidate) =>
        candidate.code === code &&
        rangesEqual(vscodeDiagnostic.range, candidate.range, document),
      );
      if (!diagnostic) {
        continue;
      }
      for (const fix of diagnostic.fixes) {
        actions.push(makeCodeAction(document, vscodeDiagnostic, fix));
      }
    }
    return actions;
  }

  private scheduleOpenDocuments(): void {
    for (const document of vscode.workspace.textDocuments) {
      this.schedule(document, 0);
    }
  }

  private schedule(document: vscode.TextDocument, delay: number): void {
    if (this.disposed || !isSupportedDocument(document) || document.isClosed) {
      return;
    }
    const key = uriKey(document.uri);
    const existing = this.timers.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this.timers.delete(key);
      void this.updateDiagnostics(document);
    }, delay);
    this.timers.set(key, timer);
  }

  private async updateDiagnostics(document: vscode.TextDocument): Promise<void> {
    if (this.disposed || document.isClosed || !isSupportedDocument(document)) {
      return;
    }
    const key = uriKey(document.uri);
    const generation = (this.scanGeneration.get(key) ?? 0) + 1;
    this.scanGeneration.set(key, generation);
    const version = document.version;
    const text = document.getText();
    if (!/[$\\]/.test(text)) {
      this.fixes.delete(key);
      this.diagnosticCollection.delete(document.uri);
      return;
    }
    const snapshot = await this.definitions.getSnapshot(document, text.length);
    if (
      this.disposed ||
      document.isClosed ||
      document.version !== version ||
      this.scanGeneration.get(key) !== generation
    ) {
      return;
    }

    const config = vscode.workspace.getConfiguration(COMMAND_NS, document);
    const environments = [...new Set([...snapshot.environments, ...config.get<readonly string[]>('customMathEnvironments', [])])];
    const typoFixesEnabled = config.get('quickFixOnType', true);
    const context = JSON.stringify([snapshot.fingerprint, environments, typoFixesEnabled]);
    const previous = this.fixes.get(key);
    if (previous?.version === version && previous.context === context) return;
    const regions = scanMathRegions(text, {
      language: document.languageId === 'markdown' || document.languageId === 'mdx' ? 'markdown' : 'latex',
      customMathEnvironments: environments,
    }).regions;
    const knownCommands = new Set(snapshot.commands);
    const coreDiagnostics = regions.flatMap((region) =>
      diagnoseMath(mathRegionContent(text, region), { offset: region.contentStart }),
    ).filter((diagnostic) =>
      diagnostic.code !== 'command-typo' || (
        typoFixesEnabled && !knownCommands.has(text.slice(diagnostic.range.start, diagnostic.range.end))
      ),
    );
    const vscodeDiagnostics = coreDiagnostics.map((diagnostic) => {
      const item = new vscode.Diagnostic(
        toRange(document, diagnostic.range),
        diagnostic.message,
        toSeverity(diagnostic.severity),
      );
      item.code = diagnostic.code;
      item.source = PRODUCT_NAME;
      return item;
    });
    this.fixes.set(key, { version, context, diagnostics: coreDiagnostics });
    this.diagnosticCollection.set(document.uri, vscodeDiagnostics);
  }

  private forget(document: vscode.TextDocument): void {
    const key = uriKey(document.uri);
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
    this.scanGeneration.delete(key);
    this.fixes.delete(key);
    this.diagnosticCollection.delete(document.uri);
  }
}

function makeCodeAction(
  document: vscode.TextDocument,
  diagnostic: vscode.Diagnostic,
  fix: DiagnosticFix,
): vscode.CodeAction {
  const action = new vscode.CodeAction(fix.title, vscode.CodeActionKind.QuickFix);
  const edit = new vscode.WorkspaceEdit();
  for (const replacement of fix.edits) {
    edit.replace(document.uri, toRange(document, replacement.range), replacement.newText);
  }
  action.edit = edit;
  action.diagnostics = [diagnostic];
  action.isPreferred = fix.preferred ?? false;
  return action;
}

function toRange(
  document: vscode.TextDocument,
  range: { readonly start: number; readonly end: number },
): vscode.Range {
  return new vscode.Range(document.positionAt(range.start), document.positionAt(range.end));
}

function rangesEqual(
  range: vscode.Range,
  candidate: { readonly start: number; readonly end: number },
  document: vscode.TextDocument,
): boolean {
  return document.offsetAt(range.start) === candidate.start &&
    document.offsetAt(range.end) === candidate.end;
}

function toSeverity(severity: MathDiagnostic['severity']): vscode.DiagnosticSeverity {
  switch (severity) {
    case 'error':
      return vscode.DiagnosticSeverity.Error;
    case 'warning':
      return vscode.DiagnosticSeverity.Warning;
    case 'information':
      return vscode.DiagnosticSeverity.Information;
  }
}

function isSupportedDocument(document: vscode.TextDocument): boolean {
  return document.languageId === 'latex'
    || document.languageId === 'tex'
    || document.languageId === 'markdown'
    || document.languageId === 'mdx';
}

function uriKey(uri: vscode.Uri): string {
  return uri.toString(true);
}
