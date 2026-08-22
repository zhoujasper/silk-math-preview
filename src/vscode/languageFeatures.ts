import * as vscode from 'vscode';

import { COMMAND_NS, PRODUCT_NAME } from '../core/channel';
import { createCompletionCatalog } from '../core/completionCatalog.js';
import { diagnoseMath } from '../core/diagnostics.js';
import { findMathRegionAt, mathRegionContent, scanMathRegions } from '../core/mathScanner.js';
import type {
  CompletionEntry,
  DiagnosticFix,
  MathDiagnostic,
} from '../core/types.js';
import type {
  DefinitionSnapshot,
  DefinitionWorkspace,
} from './definitionWorkspace.js';

interface DocumentFixes {
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
): vscode.Disposable {
  const controller = new LanguageFeatureController(definitions);
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

  public constructor(private readonly definitions: DefinitionWorkspace) {
    this.disposables.push(
      this.diagnosticCollection,
      vscode.languages.registerCompletionItemProvider(
        SELECTOR,
        { provideCompletionItems: (document, position) => this.provideCompletions(document, position) },
        '\\',
        '{',
      ),
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

  private async provideCompletions(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.CompletionList | undefined> {
    if (!isSupportedDocument(document)) {
      return undefined;
    }
    const text = document.getText();
    const offset = document.offsetAt(position);
    const snapshot = await this.definitions.getSnapshot(document, offset);
    const customEnvironments = mergedEnvironments(snapshot);
    const regions = scanMathRegions(text, {
      language: document.languageId === 'markdown' || document.languageId === 'mdx' ? 'markdown' : 'latex',
      customMathEnvironments: customEnvironments,
    }).regions;
    const environmentContext = readEnvironmentCompletionContext(text, offset);
    const insideMath = findMathRegionAt(regions, offset) !== undefined;
    if (!environmentContext && !insideMath) {
      return undefined;
    }

    const catalog = createCompletionCatalog({
      customCommands: snapshot.commands,
      customEnvironments,
    });
    const items: vscode.CompletionItem[] = [];
    if (environmentContext) {
      const replacement = new vscode.Range(
        document.positionAt(environmentContext.start),
        position,
      );
      for (const entry of catalog) {
        if (entry.kind !== 'environment') {
          continue;
        }
        const item = new vscode.CompletionItem(entry.label, vscode.CompletionItemKind.Struct);
        item.insertText = entry.label;
        item.range = replacement;
        item.detail = completionDetail(entry, snapshot);
        item.filterText = entry.label;
        items.push(item);
      }
      return new vscode.CompletionList(items, false);
    }

    const commandContext = readCommandCompletionContext(text, offset);
    const replacement = commandContext
      ? new vscode.Range(document.positionAt(commandContext.start), position)
      : undefined;
    for (const entry of catalog) {
      if (entry.kind !== 'command') {
        continue;
      }
      const item = new vscode.CompletionItem(entry.label, vscode.CompletionItemKind.Function);
      item.insertText = commandSnippet(entry, snapshot);
      if (replacement) {
        item.range = replacement;
      }
      item.detail = completionDetail(entry, snapshot);
      item.filterText = entry.label;
      items.push(item);
    }
    return new vscode.CompletionList(items, false);
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
    const snapshot = await this.definitions.getSnapshot(document, text.length);
    if (
      this.disposed ||
      document.isClosed ||
      document.version !== version ||
      this.scanGeneration.get(key) !== generation
    ) {
      return;
    }

    const regions = scanMathRegions(text, {
      language: document.languageId === 'markdown' || document.languageId === 'mdx' ? 'markdown' : 'latex',
      customMathEnvironments: mergedEnvironments(snapshot),
    }).regions;
    const knownCommands = new Set(snapshot.commands);
    const typoFixesEnabled = vscode.workspace.getConfiguration(COMMAND_NS).get('quickFixOnType', true);
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
    this.fixes.set(key, { version, diagnostics: coreDiagnostics });
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

function commandSnippet(
  entry: CompletionEntry,
  snapshot: DefinitionSnapshot,
): vscode.SnippetString {
  const snippet = new vscode.SnippetString();
  snippet.appendText(entry.insertText);
  const definition = snapshot.commandDefinitions.find((candidate) => candidate.name === entry.label);
  if (!definition) {
    return snippet;
  }
  for (const argument of definition.arguments) {
    if (argument.kind === 'optional') {
      snippet.appendText('[');
      snippet.appendPlaceholder(argument.defaultValue ?? 'value');
      snippet.appendText(']');
    } else {
      snippet.appendText('{');
      snippet.appendPlaceholder(`arg${argument.index}`);
      snippet.appendText('}');
    }
  }
  return snippet;
}

function completionDetail(entry: CompletionEntry, snapshot: DefinitionSnapshot): string {
  if (entry.kind === 'command') {
    const definition = snapshot.commandDefinitions.find((candidate) => candidate.name === entry.label);
    if (definition?.expandability === 'recognized-limited' || snapshot.recognizedLimited.includes(definition!)) {
      return '工作区自定义命令（仅识别，复杂定义不进入预览）';
    }
  } else {
    const definition = snapshot.environmentDefinitions.find((candidate) => candidate.name === entry.label);
    if (definition?.expandability === 'recognized-limited' || snapshot.recognizedLimited.includes(definition!)) {
      return '工作区自定义环境（仅识别，复杂定义不进入预览）';
    }
  }
  return entry.detail;
}

function mergedEnvironments(snapshot: DefinitionSnapshot): readonly string[] {
  const configured = vscode.workspace
    .getConfiguration(COMMAND_NS)
    .get<readonly string[]>('customMathEnvironments', []);
  return [...new Set([...snapshot.environments, ...configured])];
}

function readCommandCompletionContext(
  text: string,
  offset: number,
): { readonly start: number } | undefined {
  const windowStart = Math.max(0, offset - 128);
  const before = text.slice(windowStart, offset);
  const match = /\\[A-Za-z@]*$/.exec(before);
  return match ? { start: windowStart + (match.index ?? 0) } : undefined;
}

function readEnvironmentCompletionContext(
  text: string,
  offset: number,
): { readonly start: number } | undefined {
  const windowStart = Math.max(0, offset - 256);
  const before = text.slice(windowStart, offset);
  const match = /\\(?:begin|end)\{([A-Za-z0-9@:_-]*\*?)$/.exec(before);
  if (!match) {
    return undefined;
  }
  const partial = match[1] ?? '';
  return { start: offset - partial.length };
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
