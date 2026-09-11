import * as vscode from 'vscode';
import { WeightedLru } from '../core/weightedLru';
import { parseBibKeys, parseProjectSource, type ProjectKey, type ProjectSource } from '../completion/projectData';

interface CachedSource { readonly version: number; readonly bytes: number; readonly data: ProjectSource | readonly ProjectKey[] }
export interface ProjectCompletionData { readonly labels: readonly ProjectKey[]; readonly citations: readonly ProjectKey[]; readonly limited: boolean }

/** Created only for label/reference/citation completion, never for ordinary \alpha. */
export class ProjectCompletionIndex implements vscode.Disposable {
  private readonly cache = new WeightedLru<CachedSource>(128, 8 * 1024 * 1024);
  private readonly disposables: vscode.Disposable[];
  private generation = 0;
  private disposed = false;
  private completed: { key: string; data: ProjectCompletionData; sources: ReadonlySet<string> } | undefined;
  private readonly pendingSources = new Set<Set<string>>();
  constructor() {
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{tex,sty,cls,bib,md,mdx}');
    const invalidate = (uri: vscode.Uri) => {
      const key = uri.toString();
      this.cache.delete(key);
      if (this.completed?.sources.has(key) || [...this.pendingSources].some(sources => sources.has(key))) {
        this.generation++;
        this.completed = undefined;
      }
    };
    this.disposables = [watcher, watcher.onDidChange(invalidate), watcher.onDidCreate(invalidate), watcher.onDidDelete(invalidate),
      vscode.workspace.onDidOpenTextDocument(document => invalidate(document.uri)),
      vscode.workspace.onDidChangeNotebookDocument(event => {
        for (const cell of event.notebook.getCells()) invalidate(cell.document.uri);
      }),
      vscode.workspace.onDidChangeTextDocument(event => invalidate(event.document.uri)),
      vscode.workspace.onDidCloseTextDocument(document => invalidate(document.uri))];
  }
  dispose(): void { this.disposed = true; this.generation++; this.cache.clear(); this.completed = undefined; this.pendingSources.clear(); for (const item of this.disposables) item.dispose(); }

  async get(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<ProjectCompletionData | undefined> {
    if (this.disposed || token.isCancellationRequested) return undefined;
    const base = vscode.workspace.getWorkspaceFolder(document.uri)?.uri ?? dirname(document.uri);
    const openDocuments = new Map(vscode.workspace.textDocuments.map(open => [open.uri.toString(), open]));
    const parentCandidates = [...openDocuments.values()].filter(candidate => candidate !== document && within(candidate.uri, base) && /^(tex|latex)$/.test(candidate.languageId)).slice(0, 16);
    const notebookCells = vscode.workspace.notebookDocuments.map(notebook => notebook.getCells())
      .find(cells => cells.some(cell => cell.document.uri.toString() === document.uri.toString())) ?? [];
    const key = [base.toString(), document.uri.toString(), document.version,
      ...parentCandidates.map(parent => parent.uri.toString() + ':' + parent.version),
      ...notebookCells.map(cell => cell.kind + ':' + cell.document.uri.toString() + ':' + cell.document.version)].join('\0');
    if (this.completed?.key === key) return this.completed.data;
    const sources = new Set<string>();
    this.pendingSources.add(sources);
    try {
      const generation = this.generation;
      const labels = new Map<string, ProjectKey>(), citations = new Map<string, ProjectKey>(), visited = new Set<string>();
      let bytes = 0, limited = false;
      const alive = (): boolean => !this.disposed && !token.isCancellationRequested && this.generation === generation;
      const read = async (uri: vscode.Uri, supplied?: vscode.TextDocument): Promise<CachedSource | undefined> => {
        const key = uri.toString();
        sources.add(key);
        const open = supplied ?? openDocuments.get(key);
        const version = open?.version ?? -1;
        const cached = this.cache.get(key);
        if (cached?.version === version) return cached;
        try {
          if (!open && (await vscode.workspace.fs.stat(uri)).size > 2 * 1024 * 1024) { limited = true; return; }
          const text = open?.getText() ?? new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
          if (Buffer.byteLength(text, 'utf8') > 2 * 1024 * 1024) { limited = true; return; }
          const data = /\.bib$/i.test(uri.path) ? parseBibKeys(text, key)
            : parseProjectSource(text, key, /^(markdown|mdx)$/.test(open?.languageId ?? '') || /\.(md|mdx)$/i.test(uri.path));
          const entry = { version, bytes: text.length * 2, data };
          if (alive()) this.cache.set(key, entry, text.length * 2 + 1024);
          return entry;
        } catch { return undefined; }
      };
      const resolve = (parent: vscode.Uri, name: string, extension: string): vscode.Uri | undefined => {
        if (!name || /[\\{}%#\x00-\x1f]/.test(name) || /^(?:[A-Za-z]+:|\/)/.test(name)) return;
        const path = /\.[A-Za-z0-9]+$/.test(name) ? name : name + extension;
        const uri = vscode.Uri.joinPath(dirname(parent), path);
        return within(uri, base) ? uri : undefined;
      };
      const visit = async (uri: vscode.Uri, supplied?: vscode.TextDocument): Promise<void> => {
        const key = uri.toString();
        if (!alive() || visited.has(key)) return;
        if (visited.size >= 128 || bytes >= 8 * 1024 * 1024) { limited = true; return; }
        visited.add(key);
        const loaded = await read(uri, supplied);
        if (!loaded || !alive()) return;
        if (bytes + loaded.bytes > 8 * 1024 * 1024) { limited = true; return; }
        bytes += loaded.bytes;
        if (Array.isArray(loaded.data)) {
          for (const entry of loaded.data as readonly ProjectKey[]) if (!citations.has(entry.key)) citations.set(entry.key, entry);
          return;
        }
        const data = loaded.data as ProjectSource;
        for (const entry of data.labels) if (!labels.has(entry.key)) labels.set(entry.key, entry);
        for (const entry of data.citations) if (!citations.has(entry.key)) citations.set(entry.key, entry);
        if (data.root) { const root = resolve(uri, data.root, '.tex'); if (root) await visit(root); }
        for (const name of data.dependencies) { const target = resolve(uri, name, '.tex'); if (target) await visit(target); }
        for (const name of data.bibliographies) { const target = resolve(uri, name, '.bib'); if (target) await visit(target); }
      };
      await visit(document.uri, document);
      // Match preview's unambiguous open-root convenience, without scanning the workspace.
      const parents: vscode.TextDocument[] = [];
      for (const candidate of parentCandidates) {
        if (!alive()) return undefined;
        const data = (await read(candidate.uri, candidate))?.data as ProjectSource | undefined;
        if (data?.dependencies.some(name => resolve(candidate.uri, name, '.tex')?.toString() === document.uri.toString())) parents.push(candidate);
      }
      if (parents.length === 1) await visit(parents[0]!.uri, parents[0]);
      // Markdown notebook labels can live in another markup cell; code cells stay excluded.
      for (const cell of notebookCells) if (cell.kind === vscode.NotebookCellKind.Markup) await visit(cell.document.uri, cell.document);
      if (!alive()) return undefined;
      const data = { labels: [...labels.values()], citations: [...citations.values()], limited };
      this.completed = { key, data, sources };
      return data;
    } finally { this.pendingSources.delete(sources); }
  }
}

function dirname(uri: vscode.Uri): vscode.Uri { return uri.with({ path: uri.path.slice(0, uri.path.lastIndexOf('/')) || '/' }); }
function within(uri: vscode.Uri, base: vscode.Uri): boolean {
  return uri.scheme === base.scheme && uri.authority === base.authority
    && (uri.path === base.path || uri.path.startsWith(base.path.replace(/\/$/, '') + '/'))
    && !/\/(?:node_modules|\.git)(?:\/|$)/.test(uri.path);
}
