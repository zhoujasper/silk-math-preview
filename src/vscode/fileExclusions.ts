import * as vscode from 'vscode';
import { COMMAND_NS } from '../core/channel';

export type FileFeature = 'preview' | 'completion';
export type FileExclusionTarget = FileFeature | 'both';
const MASK = { preview: 1, completion: 2, both: 3 } as const;
const STATE_KEY = `${COMMAND_NS}.fileExclusions`;

interface DocumentPolicy {
  readonly source: string;
  readonly language: string;
  readonly key: string;
  readonly keys: readonly string[];
  readonly types: number;
  readonly rules: Partial<Record<FileFeature, string>>;
  files?: Readonly<Record<string, number>>;
  mask?: number;
}

/** Independent, workspace-local exclusions; configuration rules always apply. */
export class FileExclusions implements vscode.Disposable {
  private files: Readonly<Record<string, number>>;
  private saved: Readonly<Record<string, number>>;
  private stored: Readonly<Record<string, number>> | undefined;
  private pendingWrites = 0;
  private writes: Promise<void> = Promise.resolve();
  private policies = new WeakMap<vscode.TextDocument, DocumentPolicy>();
  private readonly changes = new vscode.EventEmitter<number>();
  private readonly disposables: vscode.Disposable[];
  readonly onDidChange = this.changes.event;

  constructor(private readonly state: vscode.Memento) {
    // Old exclusions affected preview only. An empty new record is intentional.
    this.stored = state.get<Record<string, number>>(STATE_KEY);
    this.files = this.saved = this.stored
      ?? Object.fromEntries(state.get<string[]>(`${COMMAND_NS}.excludedFiles`, []).map(key => [key, 1]));
    const reset = (mask: number): void => {
      this.policies = new WeakMap();
      this.changes.fire(mask);
    };
    this.disposables = [this.changes,
      vscode.workspace.onDidChangeConfiguration(event => {
        const changed = (feature: FileFeature): boolean => ['excludeFiles', 'excludeFileTypes']
          .some(key => event.affectsConfiguration(`${COMMAND_NS}.${feature}.${key}`));
        const mask = (changed('preview') ? 1 : 0) | (changed('completion') ? 2 : 0);
        if (mask) reset(mask);
      }),
      vscode.workspace.onDidOpenNotebookDocument(() => reset(3)),
      vscode.workspace.onDidCloseNotebookDocument(() => reset(3)),
      vscode.workspace.onDidChangeWorkspaceFolders(() => reset(3)),
      vscode.workspace.onDidChangeNotebookDocument(event => {
        if (event.contentChanges.length) reset(3);
      }),
      vscode.window.onDidChangeWindowState(event => {
        if (event.focused && this.syncFiles()) this.changes.fire(3);
      }),
    ];
  }

  dispose(): void {
    for (const item of this.disposables) item.dispose();
  }

  isFileExcluded(document: vscode.TextDocument, target: FileExclusionTarget): boolean {
    return (this.fileMask(this.policy(document)) & MASK[target]) === MASK[target];
  }

  isTypeExcluded(document: vscode.TextDocument, target: FileExclusionTarget): boolean {
    return (this.policy(document).types & MASK[target]) !== 0;
  }

  isExcluded(document: vscode.TextDocument, feature: FileFeature): boolean {
    return this.isFileExcluded(document, feature) || this.isTypeExcluded(document, feature);
  }

  matchingRule(document: vscode.TextDocument, target: FileExclusionTarget): string | undefined {
    const rules = this.policy(document).rules;
    return target === 'both' ? rules.preview ?? rules.completion : rules[target];
  }

  toggle(document: vscode.TextDocument, target: FileExclusionTarget): Promise<void> {
    const policy = this.policy(document);
    const previous = this.fileMask(policy);
    const mask = MASK[target];
    const next = (previous & mask) === mask ? previous & ~mask : previous | mask;
    const files = { ...this.files };
    for (const key of policy.keys) delete files[key];
    if (next) files[policy.key] = next;
    this.files = files;
    this.pendingWrites++;
    this.changes.fire(previous ^ next);
    // Serialize rapid clicks; rollback only the latest failed write, never a newer choice.
    const write = this.writes.then(() => {
      const result = this.state.update(STATE_KEY, files);
      this.stored = this.state.get(STATE_KEY);
      return result;
    }).then(() => {
      this.saved = files;
    });
    this.writes = write.catch(() => {
      if (this.files === files) {
        this.files = this.saved;
        this.changes.fire(3);
      }
    }).finally(() => { this.pendingWrites--; });
    return write;
  }

  /** VS Code can replace a Memento after another window restores a file. */
  private syncFiles(): boolean {
    if (this.pendingWrites) return false;
    const stored = this.state.get<Readonly<Record<string, number>>>(STATE_KEY);
    if (stored === this.stored) return false;
    this.stored = stored;
    this.files = this.saved = stored ?? {};
    return true;
  }

  private fileMask(policy: DocumentPolicy): number {
    this.syncFiles();
    if (policy.files !== this.files) {
      policy.files = this.files;
      // Older notebook exclusions used individual cell URIs. Keep them until
      // the next explicit file action persists a single parent-file entry.
      policy.mask = policy.keys.reduce((mask, key) => {
        const value = this.files[key];
        return mask | (value === 1 || value === 2 || value === 3 ? value : 0);
      }, 0);
    }
    return policy.mask ?? 0;
  }

  private policy(document: vscode.TextDocument): DocumentPolicy {
    const source = document.uri.toString();
    const cached = this.policies.get(document);
    if (cached?.source === source && cached.language === document.languageId) return cached;
    const notebook = document.uri.scheme === 'vscode-notebook-cell'
      ? vscode.workspace.notebookDocuments.find(book => book.getCells().some(cell => cell.document === document))
      : undefined;
    const uri = notebook?.uri ?? document.uri;
    const language = document.languageId.toLowerCase();
    const config = vscode.workspace.getConfiguration(COMMAND_NS, document);
    const rules: Partial<Record<FileFeature, string>> = {};
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    const relative = folder ? uri.path.slice(folder.uri.path.replace(/\/$/, '').length + 1) : undefined;
    const matches = (feature: FileFeature): boolean => {
      const patterns = config.get<unknown[]>(`${feature}.excludeFiles`, []);
      const types = config.get<unknown[]>(`${feature}.excludeFileTypes`, []);
      if (!patterns?.length && !types?.length) return false;
      const { findExclusionRule } = require('./file-patterns') as typeof import('../core/filePatterns');
      const rule = findExclusionRule(patterns, types, language, uri.fsPath, relative);
      if (rule === undefined) return false;
      rules[feature] = rule;
      return true;
    };
    const policy = { source, language: document.languageId, key: uri.toString(),
      keys: [uri.toString(), ...notebook?.getCells().map(cell => cell.document.uri.toString()) ?? []],
      types: (matches('preview') ? 1 : 0) | (matches('completion') ? 2 : 0), rules };
    this.policies.set(document, policy);
    return policy;
  }
}
