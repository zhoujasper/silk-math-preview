import * as vscode from 'vscode';
import { COMMAND_NS, cmd } from '../core/channel';
import type { DefinitionWorkspace } from './definitionWorkspace';
import type { CompletionSettings } from './math-completion';
import type { FileExclusions } from './fileExclusions';

type Mode = 'on' | 'off' | 'manual';
const SELECTOR = ['latex', 'tex', 'markdown', 'mdx'].map(language => ({ language }));
interface DocumentConfiguration { readonly uri: string; readonly language: string; readonly mode: Mode; readonly settings: CompletionSettings; }

export class CompletionController implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[];
  private disposed = false;
  private generation = 0;
  private project: import('./projectCompletion').ProjectCompletionIndex | undefined;
  private projectIdle: ReturnType<typeof setTimeout> | undefined;
  private manualRequest: { document: vscode.TextDocument; version: number; offset: number; expires: number } | undefined;
  private configurations = new WeakMap<vscode.TextDocument, DocumentConfiguration>();
  private source: { document: vscode.TextDocument; version: number; text: string } | undefined;
  private manualContext: boolean | undefined;

  constructor(private readonly definitions: DefinitionWorkspace, private readonly exclusions: FileExclusions) {
    this.disposables = [
      vscode.languages.registerCompletionItemProvider(SELECTOR, {
        resolveCompletionItem: async (item, token) => {
          if (this.disposed || token.isCancellationRequested) return item;
          const completion = await import('./math-completion.js');
          return this.disposed || token.isCancellationRequested ? item : completion.resolveMathCompletion(item);
        },
        provideCompletionItems: (document, position, token, context) => this.provide(document, position, token, context),
      }, '\\', '{', '[', '('),
      vscode.commands.registerCommand(cmd('triggerCompletion'), async () => {
        const editor = vscode.window.activeTextEditor;
        if (this.disposed || !editor) return;
        if (this.modeFor(editor.document) !== 'manual') return;
        const request = { document: editor.document, version: editor.document.version,
          offset: editor.document.offsetAt(editor.selection.active), expires: Date.now() + 1000 };
        this.manualRequest = request;
        try {
          return await vscode.commands.executeCommand('editor.action.triggerSuggest');
        } catch (error) {
          if (this.manualRequest === request) this.manualRequest = undefined;
          throw error;
        }
      }),
      vscode.commands.registerCommand(cmd('configureCompletionShortcut'), () => {
        const document = vscode.window.activeTextEditor?.document;
        if (document && this.modeFor(document) === 'manual') return vscode.commands.executeCommand(
          'workbench.action.openGlobalKeybindings', `@command:${cmd('triggerCompletion')}`);
      }),
      vscode.commands.registerCommand(cmd('configureCompletionMode'), () => {
        const document = vscode.window.activeTextEditor?.document;
        const language = document && SELECTOR.some(selector => selector.language === document.languageId)
          ? ` @lang:${document.languageId}` : '';
        return vscode.commands.executeCommand('workbench.action.openSettings', `@id:${COMMAND_NS}.completion.mode${language}`);
      }),
      vscode.window.onDidChangeActiveTextEditor(() => this.refreshMode()),
      vscode.window.onDidChangeTextEditorSelection(event => {
        if (event.textEditor !== vscode.window.activeTextEditor) return;
        const request = this.manualRequest;
        if (request && (event.textEditor.document !== request.document
          || event.textEditor.document.offsetAt(event.selections[0]?.active ?? event.textEditor.selection.active) !== request.offset)) this.manualRequest = undefined;
      }),
      vscode.workspace.onDidOpenTextDocument(document => {
        if (document === vscode.window.activeTextEditor?.document) this.refreshMode();
      }),
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration(`${COMMAND_NS}.completion`) || event.affectsConfiguration(`${COMMAND_NS}.customMathEnvironments`)) {
          this.configurations = new WeakMap(); this.generation++; this.refreshMode();
        }
      }),
      this.definitions.onDidInvalidate(() => { this.generation++; }),
      this.exclusions.onDidChange(mask => {
        if (mask & 2) { this.generation++; this.refreshMode(); }
      }),
    ];
    this.refreshMode();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.manualRequest = undefined;
    this.source = undefined;
    this.releaseProject();
    for (const disposable of this.disposables) disposable.dispose();
    this.setManualContext(false);
  }

  private releaseProject(): void {
    if (this.projectIdle) clearTimeout(this.projectIdle);
    this.projectIdle = undefined;
    this.project?.dispose();
    this.project = undefined;
  }

  private refreshMode(): void {
    this.manualRequest = undefined;
    this.source = undefined;
    const document = vscode.window.activeTextEditor?.document;
    const mode = document ? this.modeFor(document) : 'off';
    if (mode === 'off') this.releaseProject();
    this.setManualContext(mode === 'manual');
  }

  private setManualContext(enabled: boolean): void {
    if (enabled === this.manualContext) return;
    this.manualContext = enabled;
    // Keep custom bindings copied from 0.2.11, restricted to manual mode as well.
    for (const name of ['manualCompletion', 'completionEnabled']) {
      void vscode.commands.executeCommand('setContext', cmd(name), enabled);
    }
  }

  private async provide(document: vscode.TextDocument, position: vscode.Position,
    token: vscode.CancellationToken, context: vscode.CompletionContext): Promise<vscode.CompletionList | undefined> {
    const mode = this.modeFor(document);
    if (this.disposed || document.isClosed || token.isCancellationRequested || mode === 'off') return;
    const offset = document.offsetAt(position);
    if (mode === 'manual') {
      const request = this.manualRequest;
      if (context.triggerKind !== vscode.CompletionTriggerKind.Invoke || !request
        || request.document !== document || request.version !== document.version || request.offset !== offset || Date.now() > request.expires) return;
      this.manualRequest = undefined;
    }
    const cached = this.source;
    const text = cached?.document === document && cached.version === document.version ? cached.text : document.getText();
    if (cached?.document !== document || cached.version !== document.version) {
      this.source = text.length <= 256 * 1024 ? { document, version: document.version, text } : undefined;
    }
    if (!/[$\\]/.test(text)) return;
    const version = document.version;
    const generation = this.generation;
    const settings = this.configuration(document).settings;
    try {
      const completion = await import('./math-completion.js');
      const previous = this.definitions.peekSnapshot?.(document);
      const initial = completion.readMathCompletionContext(text, offset,
        /^(markdown|mdx)$/.test(document.languageId) ? 'markdown' : 'latex',
        [...previous?.environments ?? [], ...settings.environments], true);
      // Unknown custom environments may need a fresh definition snapshot; ordinary prose does not.
      if (!initial && !/\\begin\s*\{/.test(text.slice(0, offset))) return;
      if (this.disposed || token.isCancellationRequested || document.isClosed || document.version !== version
        || generation !== this.generation || this.modeFor(document) !== mode) return;
      const snapshot = await this.definitions.getSnapshot(document, offset);
      if (this.disposed || token.isCancellationRequested || document.isClosed || document.version !== version
        || generation !== this.generation || this.modeFor(document) !== mode) return;
      const result = await completion.provideContextCompletions(document, position, snapshot, settings,
        true,
        () => {
          if (this.projectIdle) clearTimeout(this.projectIdle);
          this.projectIdle = setTimeout(() => this.releaseProject(), 60_000);
          this.projectIdle.unref();
          return this.project ??= new completion.ProjectCompletionIndex();
        }, token, text);
      if (this.disposed || token.isCancellationRequested || document.isClosed || document.version !== version
        || generation !== this.generation || this.modeFor(document) !== mode) return;
      return result;
    } catch {
      // Definition invalidation/cancellation can race dependency reads. The next invocation retries.
      return undefined;
    }
  }

  private modeFor(document: vscode.TextDocument): Mode {
    if (!SELECTOR.some(selector => selector.language === document.languageId)
      || this.exclusions.isExcluded(document, 'completion')) return 'off';
    return this.configuration(document).mode;
  }

  private configuration(document: vscode.TextDocument): DocumentConfiguration {
    const uri = document.uri.toString();
    const cached = this.configurations.get(document);
    if (cached?.uri === uri && cached.language === document.languageId) return cached;
    const config = vscode.workspace.getConfiguration(COMMAND_NS, document);
    const mode = config.get<string>('completion.mode', 'on');
    const value: DocumentConfiguration = { uri, language: document.languageId,
      mode: mode === 'off' || mode === 'manual' ? mode : 'on', settings: {
        packages: config.get<readonly string[]>('completion.packages', []),
        environments: config.get<readonly string[]>('customMathEnvironments', []),
        snippets: config.get<Readonly<Record<string, string>>>('completion.snippets', {}),
        optionalArguments: config.get<boolean>('completion.optionalArguments', true),
      } };
    this.configurations.set(document, value);
    return value;
  }
}
