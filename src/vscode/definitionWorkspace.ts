import { WeightedLru } from '../core/weightedLru';
import { createHash } from 'node:crypto';

import * as vscode from 'vscode';

import { DefinitionIndex, type DefinitionSourceInput } from '../core/definitionIndex.js';
import type { ParsedDefinition } from '../core/definitionParser.js';
import { environmentEntersMathMode } from '../core/definitionParser.js';
import { sanitizeEnvironmentBodyForMathJax } from '../core/previewExpression.js';
import type { ParsedDependency } from '../core/dependencyParser.js';
import { parseMarkdownDefinitionSource, parseNotebookDefinitionSources } from '../core/markdownDefinitions.js';
import {
  parseTeXSource,
  texDocumentEditsAffectDefinitions,
  type ParsedTexSource,
} from '../core/texSource.js';

export interface DefinitionSnapshot {
  readonly fingerprint: string;
  /** 可直接放在待渲染公式之前的安全声明。 */
  readonly prelude: string;
  /** `prelude` 的语义化别名，方便渲染层阅读。 */
  readonly definitionPrelude: string;
  /** 命令名保留前导反斜杠。 */
  readonly commands: readonly string[];
  readonly packages: readonly string[];
  readonly environments: readonly string[];
  readonly limitations: readonly string[];
  readonly commandDefinitions: readonly ParsedDefinition[];
  readonly environmentDefinitions: readonly ParsedDefinition[];
  readonly recognizedLimited: readonly ParsedDefinition[];
}

export interface DefinitionWorkspaceOptions {
  readonly maxFiles?: number;
  readonly maxFileBytes?: number;
}

type ParsedSource = ParsedTexSource;

interface CachedDocumentSource {
  readonly version: number;
  readonly semanticVersion: number;
  readonly weight: number;
  readonly parsed: ParsedSource;
}

interface CachedSnapshot {
  readonly key: string;
  readonly value: Promise<DefinitionSnapshot>;
}

interface LoadedFile {
  readonly text?: string;
  readonly weight?: number;
  readonly parsed?: ParsedSource;
  readonly limitation?: string;
}



interface TraversalState {
  readonly generation: number;
  readonly folder: vscode.WorkspaceFolder | undefined;
  readonly sourceBatches: DefinitionSourceInput[];
  readonly loaded: Set<string>;
  readonly visiting: Set<string>;
  readonly limitations: string[];
  readonly packages: Set<string>;
  readonly packageOptions: string[];
  loadOrder: number;
  fileCount: number;
  target?: { key: string; offset: number };
  reached?: boolean;
}

const DEFAULT_MAX_FILES = 128;
const DEFAULT_MAX_FILE_BYTES = 8 * 1024 * 1024;
const EMPTY_FINGERPRINT = createHash('sha256').update('').digest('hex').slice(0, 16);

/**
 * 按活动文档的真实依赖顺序构建定义快照。文件变化只做失效标记，真正读取延迟到下一次预览。
 */
export class DefinitionWorkspace implements vscode.Disposable {
  private readonly maxFiles: number;
  private readonly maxFileBytes: number;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly documentSources = new WeightedLru<CachedDocumentSource>(12, 16 * 1024 * 1024);
  private readonly fileSources = new WeightedLru<Promise<LoadedFile>>(128, 16 * 1024 * 1024);
  private readonly resolutions = new WeightedLru<Promise<vscode.Uri | undefined>>(512, 128 * 1024);
  private readonly snapshots = new WeightedLru<CachedSnapshot>(16, 8 * 1024 * 1024);
  /** 已经解析完成的快照，供预览热路径同步取用。 */
  private readonly resolvedSnapshots = new WeightedLru<DefinitionSnapshot>(16, 8 * 1024 * 1024);
  private readonly invalidationEmitter = new vscode.EventEmitter<vscode.Uri | undefined>();
  private invalidationGeneration = 0;
  private disposed = false;
  private tikzContext: { document: string; offset: number; version: number; generation: number; value: Promise<string> } | undefined;

  public readonly onDidInvalidate = this.invalidationEmitter.event;

  public constructor(
    _context?: vscode.ExtensionContext,
    options: DefinitionWorkspaceOptions = {},
  ) {
    this.maxFiles = Math.max(1, Math.floor(options.maxFiles ?? DEFAULT_MAX_FILES));
    this.maxFileBytes = Math.max(1024, Math.floor(options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES));

    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{tex,sty,cls,md,markdown,mdx,ipynb}');
    this.disposables.push(
      watcher,
      vscode.workspace.onDidChangeTextDocument((event) => {
        const cached = this.tikzContext;
        if (!cached) return;
        if (cached.document !== uriKey(event.document.uri) || event.contentChanges.some((change) => event.document.offsetAt(change.range.start) < cached.offset)) this.tikzContext = undefined;
        else cached.version = event.document.version;
      }),
      vscode.workspace.onDidCloseTextDocument((document) => {
        const key = uriKey(document.uri);
        this.documentSources.delete(key);
        this.snapshots.delete(key);
        this.resolvedSnapshots.delete(key);
        this.invalidateSource(document.uri);
      }),
      watcher.onDidChange((uri) => this.invalidateSource(uri)),
      watcher.onDidCreate((uri) => this.invalidateSource(uri, true)),
      watcher.onDidDelete((uri) => this.invalidateSource(uri, true)),
      vscode.workspace.onDidSaveTextDocument((document) => {
        if (isSupportedDocument(document)) {
          this.invalidateSource(document.uri);
        }
      }),
      vscode.workspace.onDidChangeNotebookDocument((event) => {
        this.invalidateSource(event.notebook.uri);
      }),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (this.disposed || !isSupportedDocument(event.document) || isIgnoredUri(event.document.uri)) return;
        this.fileSources.delete(uriKey(event.document.uri));
        const active = vscode.window.activeTextEditor?.document.uri;
        const changes = event.contentChanges.map((change) => ({
          start: event.document.offsetAt(change.range.start), inserted: change.text, deleted: change.rangeLength ?? 0,
        }));
        const affects = changes.some((change) => {
          const prefix = event.document.getText(new vscode.Range(
            event.document.positionAt(Math.max(0, change.start - 128)), event.document.positionAt(change.start),
          ));
          return /!\s*TeX\s+root|\\(?:begin|end)\s*\{document\}/i.test(prefix + change.inserted)
            || texDocumentEditsAffectDefinitions(prefix, [{ ...change, start: prefix.length }]);
        });
        if (active && uriKey(active) === uriKey(event.document.uri) && !affects) {
          const key = uriKey(event.document.uri);
          const cached = this.documentSources.get(key);
          // Only reuse offsets if every edit is beyond the last declaration/dependency.
          const boundary = cached ? Math.max(snapshotBoundary(cached.parsed, Number.POSITIVE_INFINITY),
            cached.parsed.preambleEnd === undefined ? 0 : cached.parsed.preambleEnd + 16) : Infinity;
          if (cached && event.document.version === cached.version + 1
            && changes.every((change) => change.start > boundary && (!cached.parsed.rootHint || change.start >= 8192))) {
            this.documentSources.set(key, { ...cached, version: event.document.version }, cached.weight);
          }
          return;
        }
        this.invalidateSource(event.document.uri);
      }),
    );
  }

  /** Native TikZ context never flattens or serializes declarations through MathJax. */
  public getTikzContext(document: vscode.TextDocument, offset: number): Promise<string> {
    const key = uriKey(document.uri), cached = this.tikzContext;
    if (cached?.document === key && cached.offset === offset && cached.version === document.version && cached.generation === this.invalidationGeneration) return cached.value;
    if (offset > this.maxFileBytes) return Promise.reject(new Error('TikZ context exceeds the document size limit'));
    const notebook = notebookContaining(document);
    const earlier = notebook?.getCells().slice(0, notebook.getCells().findIndex((cell) => uriKey(cell.document.uri) === key))
      .filter((cell) => cell.kind === vscode.NotebookCellKind.Markup).map((cell) => cell.document.getText()).join('\n') ?? '';
    const prefix = earlier + '\n' + document.getText(new vscode.Range(document.positionAt(0), document.positionAt(offset)));
    const value = (async () => {
      const { extractTikzPreamble } = await import('./tikz-context.js');
      const visiting = new Set<string>(), packages = new Set<string>();
      let count = 0;
      const walk = async (uri: vscode.Uri, raw: string): Promise<string> => {
        const name = uriKey(uri);
        if (visiting.has(name) || ++count > this.maxFiles) throw new Error('TikZ dependency cycle or file limit');
        visiting.add(name);
        try {
          const text = extractTikzPreamble(raw, true);
          const parsed = parseTeXSource(text, name);
          const groups = new Map<number, ParsedDependency[]>();
          for (const dependency of parsed.dependencies) {
            const start = dependency.source.startOffset;
            groups.set(start, [...(groups.get(start) ?? []), dependency]);
          }
          let result = '', cursor = 0;
          for (const [start, dependencies] of groups) {
            result += text.slice(cursor, start);
            for (const dependency of dependencies) {
              const target = dependency.resolution === 'literal' ? await this.resolveDependency(uri, dependency, vscode.workspace.getWorkspaceFolder(document.uri)) : undefined;
              const loaded = target ? await this.loadFileSource(target) : undefined;
              if (loaded?.text !== undefined && target) {
                const fileKey = uriKey(target);
                if (dependency.kind !== 'package' || !packages.has(fileKey)) {
                  if (dependency.kind === 'package') packages.add(fileKey);
                  const context = await walk(target, fileKey === key ? prefix : loaded.text);
                  result += /\.(?:sty|cls)$/i.test(target.path) ? '\\makeatletter\n' + context + '\n\\makeatother\n' : context + '\n';
                }
              } else result += text.slice(start, dependency.source.endOffset) + '\n';
            }
            cursor = dependencies[0]!.source.endOffset;
            if (result.length > 200_000) throw new Error('TikZ context is too large');
          }
          result += text.slice(cursor);
          if (result.length > 200_000) throw new Error('TikZ context is too large');
          return result;
        } finally { visiting.delete(name); }
      };
      const root = notebook ? undefined : await this.findRootPreamble(document, this.parseDocument(document), { folder: vscode.workspace.getWorkspaceFolder(document.uri), limitations: [] });
      let preamble = '';
      if (root) {
        const loaded = await this.loadFileSource(root.uri);
        if (loaded.text !== undefined) preamble = await walk(root.uri, loaded.text.slice(0, root.parsed.preambleEnd));
      }
      return extractTikzPreamble(preamble + '\n' + await walk(document.uri, prefix));
    })();
    this.tikzContext = { document: key, offset, version: document.version, generation: this.invalidationGeneration, value };
    void value.catch(() => { if (this.tikzContext?.value === value) this.tikzContext = undefined; });
    return value;
  }

  public async getSnapshot(
    document: vscode.TextDocument,
    offset?: number,
  ): Promise<DefinitionSnapshot> {
    if (this.disposed || !isSupportedDocument(document)) {
      return emptySnapshot();
    }

    const boundedOffset = Math.max(0, Math.min(documentLength(document), Math.floor(offset ?? documentLength(document))));
    const notebookContext = notebookContextFor(document);
    const parsed = notebookContext
      ? parseNotebookCells(notebookContext.notebook, document, boundedOffset)
      : this.parseDocument(document);
    const effectiveOffset = notebookContext ? boundedOffset : snapshotBoundary(parsed, boundedOffset);
    const documentKey = uriKey(document.uri);
    const key = [
      this.invalidationGeneration,
      notebookContext?.notebook.version ?? 0,
      this.documentSources.get(uriKey(document.uri))?.semanticVersion ?? document.version,
      effectiveOffset,
    ].join(':');
    const cached = this.snapshots.get(documentKey);
    if (cached?.key === key) {
      return cached.value;
    }

    const value = this.buildSnapshot(document, parsed, effectiveOffset);
    this.snapshots.set(documentKey, { key, value }, 512);
    value
      .then((resolved) => {
        // An older async traversal must not replace a newer snapshot after an edit.
        if (this.snapshots.get(documentKey)?.value !== value || this.disposed) return;
        const weight = snapshotWeight(resolved);
        this.snapshots.set(documentKey, { key, value }, weight);
        this.resolvedSnapshots.set(documentKey, resolved, weight);
      })
      .catch(() => {
        // 失败由调用方处理，这里只是不缓存。
      });
    return value;
  }

  /**
   * 只返回已经算好的快照，绝不触发解析。预览的按键热路径用它代替 `getSnapshot`，
   * 避免每次输入都重新解析整份文档；定义真的变了由后台核对补上。
   */
  public peekSnapshot(document: vscode.TextDocument): DefinitionSnapshot | undefined {
    if (this.disposed || !isSupportedDocument(document)) return undefined;
    return this.resolvedSnapshots.get(uriKey(document.uri));
  }

  public invalidate(uri?: vscode.Uri): void {
    if (uri) {
      this.invalidateSource(uri, true);
      return;
    }
    this.resetAll();
  }

  private resetAll(): void {
    if (this.disposed) {
      return;
    }
    this.invalidationGeneration += 1;
    this.snapshots.clear();
    this.resolvedSnapshots.clear();
    this.fileSources.clear();
    this.resolutions.clear();
    this.documentSources.clear();
    this.invalidationEmitter.fire(undefined);
  }

  private invalidateSource(uri: vscode.Uri, dropResolutions = false): void {
    if (this.disposed || isIgnoredUri(uri)) {
      return;
    }
    this.invalidationGeneration += 1;
    this.snapshots.clear();
    this.documentSources.delete(uriKey(uri));
    this.fileSources.delete(uriKey(uri));
    if (dropResolutions) this.resolutions.clear();
    this.invalidationEmitter.fire(uri);
  }

  public reload(): void {
    this.invalidate();
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.tikzContext = undefined;
    for (const disposable of this.disposables.splice(0)) {
      disposable.dispose();
    }
    this.invalidationEmitter.dispose();
    this.documentSources.clear();
    this.fileSources.clear();
    this.resolutions.clear();
    this.snapshots.clear();
    this.resolvedSnapshots.clear();
  }

  private async buildSnapshot(
    document: vscode.TextDocument,
    parsed: ParsedSource,
    offset: number,
  ): Promise<DefinitionSnapshot> {
    const index = new DefinitionIndex();
    const state: TraversalState = {
      generation: this.invalidationGeneration,
      folder: vscode.workspace.getWorkspaceFolder(document.uri),
      sourceBatches: [],
      loaded: new Set<string>(),
      visiting: new Set<string>(),
      limitations: [],
      packages: new Set(),
      packageOptions: [],
      loadOrder: 0,
      fileCount: 0,
    };
    const notebook = notebookContaining(document);
    if (!notebook && /^(latex|tex)$/.test(document.languageId)) {
      const root = await this.findRootPreamble(document, parsed, state);
      if (root) {
        state.target = { key: uriKey(document.uri), offset };
        await this.visitSource(root.uri, root.parsed, state, root.parsed.preambleEnd ?? Number.POSITIVE_INFINITY, true);
      }
    }
    // notebook 单元格已经在 parse 时按“当前格及之前”裁过，这里不再用单元格内 offset 二次裁剪。
    if (!state.reached) await this.visitSource(document.uri, parsed, state, notebook ? Number.POSITIVE_INFINITY : offset, true);
    if (state.generation !== this.invalidationGeneration || this.disposed) throw new Error('定义已变化，等待下一帧更新');
    index.replaceSources(state.sourceBatches);
    return makeSnapshot(index, state.limitations, [...state.packages], state.packageOptions);
  }

  /** Explicit root hints, or one unambiguous already-open parent; never scan all workspace TeX files. */
  private async findRootPreamble(document: vscode.TextDocument, parsed: ParsedSource, state: Pick<TraversalState, 'folder' | 'limitations'>)
    : Promise<{ uri: vscode.Uri; parsed: ParsedSource } | undefined> {
    const hint = parsed.rootHint;
    if (hint) {
      // Literal .tex paths only. Relative parent segments are resolved before the workspace boundary check.
      if (!/^[^\\{}%\r\n]+\.tex$/i.test(hint)) {
        state.limitations.push('主文件指令需要字面量 .tex 路径');
        return undefined;
      }
      const uri = hint.startsWith('/') ? document.uri.with({ path: hint }) : vscode.Uri.joinPath(dirnameUri(document.uri), hint);
      if (uriKey(uri) === uriKey(document.uri) || isIgnoredUri(uri)
        || (state.folder && !isInsideFolder(uri, state.folder))) return undefined;
      const loaded = await this.loadFileSource(uri);
      if (loaded.parsed) return { uri, parsed: loaded.parsed };
      state.limitations.push(loaded.limitation ?? `主文件未找到：${hint}`);
      return undefined;
    }
    const matches: Array<{ uri: vscode.Uri; parsed: ParsedSource }> = [];
    for (const candidate of vscode.workspace.textDocuments.slice(0, 16)) {
      if (!/^(latex|tex)$/.test(candidate.languageId) || uriKey(candidate.uri) === uriKey(document.uri)
        || isIgnoredUri(candidate.uri)) continue;
      const parent = this.parseDocument(candidate);
      if (parent.preambleEnd === undefined) continue;
      if (parent.dependencies.some((dependency) => (dependency.kind === 'input' || dependency.kind === 'include')
        && dependency.resolution === 'literal'
        && uriKey(vscode.Uri.joinPath(dirnameUri(candidate.uri), dependencyFileName(dependency))) === uriKey(document.uri))) {
        matches.push({ uri: candidate.uri, parsed: parent });
      }
    }
    if (matches.length > 1) state.limitations.push('多个已打开主文件引用当前章节；可用 % !TeX root = main.tex 指定');
    return matches.length === 1 ? matches[0] : undefined;
  }

  private parseDocument(document: vscode.TextDocument): ParsedSource {
    const key = uriKey(document.uri);
    const cached = this.documentSources.get(key);
    if (cached?.version === document.version) {
      return cached.parsed;
    }
    const text = document.getText();
    const parsed = document.languageId === 'markdown' || document.languageId === 'mdx'
      ? parseMarkdownDefinitionSource(text, key)
      : parseTeXSource(text, key);
    const weight = text.length * 2 + parsed.definitions.length * 512 + parsed.dependencies.length * 256;
    this.documentSources.set(key, { version: document.version, semanticVersion: document.version, parsed, weight }, weight);
    return parsed;
  }

  private async visitSource(
    uri: vscode.Uri,
    parsed: ParsedSource,
    state: TraversalState,
    endOffset: number,
    root = false,
  ): Promise<void> {
    const key = uriKey(uri);
    if (state.target?.key === key) endOffset = state.target.offset;
    if (state.visiting.has(key)) {
      state.limitations.push(`检测到循环依赖，已停止重复加载：${displayUri(uri)}`);
      return;
    }
    if (!root && state.loaded.has(key)) {
      return;
    }
    if (state.fileCount >= this.maxFiles) {
      state.limitations.push(`依赖文件超过上限 ${this.maxFiles}，后续定义未加载。`);
      return;
    }

    state.fileCount += 1;
    state.loaded.add(key);
    state.visiting.add(key);
    try {
      const timeline: Array<
        | { readonly kind: 'definition'; readonly value: ParsedDefinition }
        | { readonly kind: 'dependency'; readonly value: ParsedDependency }
      > = [];
      for (const definition of parsed.definitions) {
        if (definition.source.endOffset <= endOffset) {
          timeline.push({ kind: 'definition', value: definition });
        }
      }
      for (const dependency of parsed.dependencies) {
        if (dependency.source.endOffset <= endOffset) {
          timeline.push({ kind: 'dependency', value: dependency });
        }
      }
      timeline.sort((left, right) => {
        const offsetDifference = left.value.source.startOffset - right.value.source.startOffset;
        if (offsetDifference !== 0 || left.kind === right.kind) {
          return offsetDifference;
        }
        return left.kind === 'dependency' ? -1 : 1;
      });

      let batch: ParsedDefinition[] = [];
      const flush = (): void => {
        if (!batch.length) return;
        state.sourceBatches.push({ sourceId: `${key}#defs:${state.loadOrder}`, definitions: batch, loadOrder: state.loadOrder++ });
        batch = [];
      };
      for (const entry of timeline) {
        if (state.generation !== this.invalidationGeneration || this.disposed) throw new Error('定义已变化，等待下一帧更新');
        if (state.reached) break;
        if (entry.kind === 'definition') {
          batch.push(entry.value);
          continue;
        }
        flush();
        const dependency = entry.value;
        if (dependency.resolution !== 'literal') {
          state.limitations.push(
            `动态依赖无法安全解析：${dependency.name}（${displayUri(uri)}）`,
          );
          continue;
        }
        if (dependency.kind === 'package') {
          const packageName = dependency.name.replace(/\.sty$/i, '').split('/').pop() ?? dependency.name;
          state.packages.add(packageName);
          if (packageName === 'siunitx' && dependency.options.length > 0) {
            state.packageOptions.push(`\\sisetup{${dependency.options.join(',')}}`);
          }
        }
        const target = await this.resolveDependency(uri, dependency, state.folder);
        if (!target) {
          continue;
        }
        if (state.visiting.has(uriKey(target))) {
          state.limitations.push(`检测到循环依赖，已跳过：${displayUri(target)}`);
          continue;
        }
        const loaded = await this.loadFileSource(target);
        if (loaded.limitation) {
          state.limitations.push(loaded.limitation);
        }
        if (loaded.parsed) {
          await this.visitSource(target, loaded.parsed, state, Number.POSITIVE_INFINITY);
        }
      }
      flush();
    } finally {
      state.visiting.delete(key);
      if (state.target?.key === key) state.reached = true;
    }
  }

  private loadFileSource(uri: vscode.Uri): Promise<LoadedFile> {
    const key = uriKey(uri);
    const cached = this.fileSources.get(key);
    if (cached) return cached;
    const value = this.readAndParseFile(uri);
    this.fileSources.set(key, value, 512);
    void value.then((loaded) => {
      if (this.fileSources.get(key) === value && !this.disposed) this.fileSources.set(key, value, loaded.weight ?? 512);
    });
    return value;
  }

  private async readAndParseFile(uri: vscode.Uri): Promise<LoadedFile> {
    try {
      const open = findOpenDocument(uri);
      if (!open && (await vscode.workspace.fs.stat(uri)).size > this.maxFileBytes) {
        return { limitation: `过大未加载：${displayUri(uri)}` };
      }
      const text = open?.getText() ?? new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
      if (Buffer.byteLength(text, 'utf8') > this.maxFileBytes) {
        return { limitation: `过大未加载：${displayUri(uri)}` };
      }
      const parsed = parseTeXSource(text, uriKey(uri));
      return { parsed, text, weight: text.length * 2 + parsed.definitions.length * 512 + parsed.dependencies.length * 256 };
    } catch {
      return {};
    }
  }

  private resolveDependency(
    source: vscode.Uri,
    dependency: ParsedDependency,
    folder: vscode.WorkspaceFolder | undefined,
  ): Promise<vscode.Uri | undefined> {
    if (!isSafeLiteralName(dependency.name)) {
      return Promise.resolve(undefined);
    }
    const cacheKey = `${uriKey(source)}|${dependency.kind}|${dependency.name}|${folder ? uriKey(folder.uri) : ''}`;
    const cached = this.resolutions.get(cacheKey);
    if (cached) {
      return cached;
    }
    const value = this.findDependency(source, dependency, folder);
    this.resolutions.set(cacheKey, value, cacheKey.length * 2 + 256);
    return value;
  }

  /**
   * 解析顺序与 LaTeX 一致：先看主文件所在目录，再看工作区。单独打开一个
   * `.tex`（没有工作区文件夹）时也必须能找到同目录的 `.cls/.sty`，否则
   * 自定义宏全部失效，用到它们的公式会直接渲染不出来。
   */
  private async findDependency(
    source: vscode.Uri,
    dependency: ParsedDependency,
    folder: vscode.WorkspaceFolder | undefined,
  ): Promise<vscode.Uri | undefined> {
    const relativeName = dependencyFileName(dependency);
    const documentFolder = dirnameUri(source);
    const candidates = uniqueUris([
      vscode.Uri.joinPath(documentFolder, relativeName),
      ...(folder ? [vscode.Uri.joinPath(folder.uri, relativeName)] : []),
    ]);
    for (const candidate of candidates) {
      const reachable = isInsideUri(candidate, documentFolder)
        || (folder !== undefined && isInsideFolder(candidate, folder));
      if (reachable && !isIgnoredUri(candidate) && (findOpenDocument(candidate) || await isFile(candidate))) {
        return candidate;
      }
    }

    for (const document of vscode.workspace.textDocuments) {
      if (isIgnoredUri(document.uri) || !uriPathMatchesDependency(document.uri.path, relativeName)) continue;
      if (isInsideUri(document.uri, documentFolder) || (folder !== undefined && isInsideFolder(document.uri, folder))) {
        return document.uri;
      }
    }

    if (!relativeName || !folder) {
      return undefined;
    }
    const matches = await vscode.workspace.findFiles(
      new vscode.RelativePattern(folder, `**/${relativeName}`),
      '**/{node_modules,.git}/**',
      2,
    );
    return matches
      .filter((uri) => isInsideFolder(uri, folder) && !isIgnoredUri(uri) && uriPathMatchesDependency(uri.path, relativeName))
      .sort((left, right) => left.path.localeCompare(right.path))[0];
  }
}

function snapshotBoundary(parsed: ParsedSource, offset: number): number {
  let boundary = 0;
  for (const definition of parsed.definitions) {
    if (definition.source.endOffset <= offset) boundary = Math.max(boundary, definition.source.endOffset);
  }
  for (const dependency of parsed.dependencies) {
    if (dependency.source.endOffset <= offset) boundary = Math.max(boundary, dependency.source.endOffset);
  }
  return boundary;
}

function documentLength(document: vscode.TextDocument): number {
  return document.offsetAt(document.lineAt(document.lineCount - 1).range.end);
}

function makeSnapshot(
  index: DefinitionIndex,
  traversalLimitations: readonly string[],
  packages: readonly string[],
  packageOptions: readonly string[],
): DefinitionSnapshot {
  const commandDefinitions = index.listCommands().map((entry) => entry.definition);
  const environmentDefinitions = index.listEnvironments().map((entry) => entry.definition);
  // 颜色排在最前：`\colorlet` 和后面的宏都可能引用它们。
  const colorDefinitions = index.listColors().map((entry) => entry.definition);
  const configurations = index.listConfigurations().map((entry) => entry.definition);
  const allDefinitions = [...colorDefinitions, ...commandDefinitions, ...environmentDefinitions, ...configurations];
  const serialized = allDefinitions.map(serializeDefinition);
  const recognizedLimited = allDefinitions.filter((definition, index) =>
    definition.expandability === 'recognized-limited' || serialized[index] === undefined,
  );
  const prelude = [...packageOptions, ...serialized
    .filter((value): value is string => value !== undefined)]
    .join('\n');
  const commands = commandDefinitions.map((definition) => definition.name);
  // 只有真正进入数学模式的自定义环境才能当公式区域：把 `question`/`solution`
  // 这类文本环境算进去，会让整段解答被当成一条公式，里面的 \[...\] 全部失去预览。
  const environments = environmentDefinitions
    .filter((definition) => environmentEntersMathMode(definition.beginReplacement))
    .map((definition) => definition.name);
  const limitations = uniqueStrings([
    ...traversalLimitations,
    ...recognizedLimited.map((definition) => {
      const detail = definition.limitations.length > 0
        ? definition.limitations.join(', ')
        : '声明形式不能安全转换为 MathJax prelude';
      return `${definition.kind === 'command' ? definition.name : definition.name}: ${detail}`;
    }),
  ]);
  const fingerprintPayload = JSON.stringify({ prelude, commands, environments, limitations, packages });
  const fingerprint = createHash('sha256').update(fingerprintPayload).digest('hex').slice(0, 16);
  return {
    fingerprint,
    prelude,
    definitionPrelude: prelude,
    packages,
    commands,
    environments,
    limitations,
    commandDefinitions,
    environmentDefinitions,
    recognizedLimited,
  };
}

function serializeDefinition(definition: ParsedDefinition): string | undefined {
  if (definition.expandability !== 'expandable') {
    return undefined;
  }
  if (definition.declaration === 'declare-paired-delimiter') {
    return `\\DeclarePairedDelimiter{${definition.name}}{${definition.beginReplacement}}{${definition.endReplacement}}`;
  }
  if (definition.kind === 'configuration') return `\\sisetup{${definition.replacement ?? ''}}`;
  if (definition.kind === 'color') {
    // 解析阶段已折算成 MathJax 认识的模型；这里只做拼装。
    const [model, value] = splitOnce(definition.replacement ?? '', ':');
    if (!model || !value) return undefined;
    return `\\definecolor{${definition.name}}{${model}}{${value}}`;
  }
  const optional = definition.arguments.filter((argument) => argument.kind === 'optional');
  if (optional.length > 1 || optional.some((argument) => argument.index !== 1 || argument.defaultValue === undefined)) {
    return undefined;
  }
  if (definition.kind === 'command') {
    if (definition.replacement === undefined) {
      return undefined;
    }
    if (optional.length === 0) {
      const parameters = definition.arguments.map((argument) => `#${argument.index}`).join('');
      return `\\def${definition.name}${parameters}{${definition.replacement}}`;
    }
    const first = optional[0];
    return `\\newcommand{${definition.name}}[${definition.arguments.length}][${first?.defaultValue ?? ''}]{${definition.replacement}}`;
  }
  if (definition.beginReplacement === undefined || definition.endReplacement === undefined) {
    return undefined;
  }
  const operation = definition.operation === 'renew' ? 'renewenvironment' : 'newenvironment';
  const count = definition.arguments.length > 0 ? `[${definition.arguments.length}]` : '';
  const defaultValue = optional[0]?.defaultValue;
  const optionalDefault = defaultValue === undefined ? '' : `[${defaultValue}]`;
  return `\\${operation}{${definition.name}}${count}${optionalDefault}{${sanitizeEnvironmentBodyForMathJax(definition.beginReplacement)}}{${sanitizeEnvironmentBodyForMathJax(definition.endReplacement)}}`;
}

function splitOnce(value: string, separator: string): readonly [string, string] {
  const index = value.indexOf(separator);
  return index < 0 ? [value, ''] : [value.slice(0, index), value.slice(index + separator.length)];
}

function emptySnapshot(): DefinitionSnapshot {
  return {
    fingerprint: EMPTY_FINGERPRINT,
    prelude: '',
    definitionPrelude: '',
    packages: [],
    commands: [],
    environments: [],
    limitations: [],
    commandDefinitions: [],
    environmentDefinitions: [],
    recognizedLimited: [],
  };
}

function dependencyFileName(dependency: ParsedDependency): string {
  const normalized = dependency.name.replace(/\\/g, '/');
  if (/\.[A-Za-z0-9]+$/.test(normalized)) {
    return normalized;
  }
  if (dependency.kind === 'package') {
    return `${normalized}.sty`;
  }
  if (dependency.kind === 'documentclass') {
    return `${normalized}.cls`;
  }
  return `${normalized}.tex`;
}

function dirnameUri(uri: vscode.Uri): vscode.Uri {
  const slash = uri.path.lastIndexOf('/');
  return uri.with({ path: slash <= 0 ? '/' : uri.path.slice(0, slash) });
}

function isInsideUri(uri: vscode.Uri, base: vscode.Uri): boolean {
  return isInsideFolder(uri, { uri: base } as vscode.WorkspaceFolder);
}

function isInsideFolder(uri: vscode.Uri, folder: vscode.WorkspaceFolder): boolean {
  if (uri.scheme !== folder.uri.scheme || uri.authority !== folder.uri.authority) {
    return false;
  }
  const root = folder.uri.path.endsWith('/') ? folder.uri.path : `${folder.uri.path}/`;
  const candidate = process.platform === 'win32' ? uri.path.toLowerCase() : uri.path;
  const normalizedRoot = process.platform === 'win32' ? root.toLowerCase() : root;
  return candidate === normalizedRoot.slice(0, -1) || candidate.startsWith(normalizedRoot);
}

function isSafeLiteralName(name: string): boolean {
  return /^[A-Za-z0-9@._+/-]+$/.test(name) && !name.split('/').includes('..');
}

function isIgnoredUri(uri: vscode.Uri): boolean {
  return /\/(?:node_modules|\.git)(?:\/|$)/i.test(uri.path);
}

async function isFile(uri: vscode.Uri): Promise<boolean> {
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    return (stat.type & vscode.FileType.File) !== 0;
  } catch {
    return false;
  }
}

function uniqueUris(uris: readonly vscode.Uri[]): readonly vscode.Uri[] {
  const unique = new Map<string, vscode.Uri>();
  for (const uri of uris) {
    unique.set(uriKey(uri), uri);
  }
  return [...unique.values()];
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function uriKey(uri: vscode.Uri): string {
  return uri.toString(true);
}

function displayUri(uri: vscode.Uri): string {
  return vscode.workspace.asRelativePath(uri, false);
}

function isSupportedDocument(document: vscode.TextDocument): boolean {
  return document.languageId === 'latex'
    || document.languageId === 'tex'
    || document.languageId === 'markdown'
    || document.languageId === 'mdx'
    || /\.(?:tex|sty|cls|md|markdown|mdx|ipynb)$/i.test(document.uri.path);
}

function findOpenDocument(uri: vscode.Uri): vscode.TextDocument | undefined {
  const key = uriKey(uri);
  return vscode.workspace.textDocuments.find((document) => uriKey(document.uri) === key);
}

function uriPathMatchesDependency(path: string, name: string): boolean {
  if (process.platform === 'win32') {
    path = path.toLowerCase();
    name = name.toLowerCase();
  }
  return path === name || path.endsWith(`/${name}`);
}



function notebookContaining(document: vscode.TextDocument): vscode.NotebookDocument | undefined {
  for (const notebook of vscode.workspace.notebookDocuments) {
    if (notebook.getCells().some((cell) => uriKey(cell.document.uri) === uriKey(document.uri))) {
      return notebook;
    }
  }
  return undefined;
}

function notebookContextFor(document: vscode.TextDocument): {
  readonly notebook: vscode.NotebookDocument;
} | undefined {
  const notebook = notebookContaining(document);
  return notebook ? { notebook } : undefined;
}

function parseNotebookCells(
  notebook: vscode.NotebookDocument,
  document: vscode.TextDocument,
  currentEndOffset: number,
): ParsedSource {
  const cells = notebook.getCells();
  const currentIndex = cells.findIndex((cell) => uriKey(cell.document.uri) === uriKey(document.uri));
  const sources = cells.map((cell, index) => ({
    id: uriKey(cell.document.uri),
    index: cell.index ?? index,
    kind: cell.kind === vscode.NotebookCellKind.Markup ? 'markup' as const : 'code' as const,
    text: cell.document.getText(),
  }));
  return parseNotebookDefinitionSources(sources, currentIndex < 0 ? 0 : currentIndex, currentEndOffset);
}

function snapshotWeight(snapshot: DefinitionSnapshot): number {
  return snapshot.prelude.length * 4 + (snapshot.commandDefinitions.length + snapshot.environmentDefinitions.length) * 512
    + snapshot.limitations.join('').length * 2 + 1024;
}
