import { createHash } from 'node:crypto';

import * as vscode from 'vscode';

import { DefinitionIndex, type DefinitionSourceInput } from '../core/definitionIndex.js';
import type { ParsedDefinition } from '../core/definitionParser.js';
import { environmentEntersMathMode, parseDefinitions } from '../core/definitionParser.js';
import { sanitizeEnvironmentBodyForMathJax } from '../core/previewExpression.js';
import type { ParsedDependency } from '../core/dependencyParser.js';
import { parseDependencies } from '../core/dependencyParser.js';
import { parseMarkdownDefinitionSource, parseNotebookDefinitionSources } from '../core/markdownDefinitions.js';

export interface DefinitionSnapshot {
  readonly fingerprint: string;
  /** 可直接放在待渲染公式之前的安全声明。 */
  readonly prelude: string;
  /** `prelude` 的语义化别名，方便渲染层阅读。 */
  readonly definitionPrelude: string;
  /** 命令名保留前导反斜杠。 */
  readonly commands: readonly string[];
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

interface ParsedSource {
  readonly definitions: readonly ParsedDefinition[];
  readonly dependencies: readonly ParsedDependency[];
}

interface CachedDocumentSource {
  readonly version: number;
  readonly parsed: ParsedSource;
}

interface CachedSnapshot {
  readonly key: string;
  readonly value: Promise<DefinitionSnapshot>;
}

interface TraversalState {
  readonly folder: vscode.WorkspaceFolder | undefined;
  readonly sourceBatches: DefinitionSourceInput[];
  readonly loaded: Set<string>;
  readonly visiting: Set<string>;
  readonly limitations: string[];
  loadOrder: number;
  fileCount: number;
}

const DEFAULT_MAX_FILES = 128;
const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024;
const EMPTY_FINGERPRINT = createHash('sha256').update('').digest('hex').slice(0, 16);

/**
 * 按活动文档的真实依赖顺序构建定义快照。文件变化只做失效标记，真正读取延迟到下一次预览。
 */
export class DefinitionWorkspace implements vscode.Disposable {
  private readonly maxFiles: number;
  private readonly maxFileBytes: number;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly documentSources = new Map<string, CachedDocumentSource>();
  private readonly fileSources = new Map<string, Promise<ParsedSource | undefined>>();
  private readonly resolutions = new Map<string, Promise<vscode.Uri | undefined>>();
  private readonly snapshots = new Map<string, CachedSnapshot>();
  /** 已经解析完成的快照，供预览热路径同步取用。 */
  private readonly resolvedSnapshots = new Map<string, DefinitionSnapshot>();
  private readonly invalidationEmitter = new vscode.EventEmitter<vscode.Uri | undefined>();
  private invalidationGeneration = 0;
  private disposed = false;

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
      watcher.onDidChange((uri) => this.invalidate(uri)),
      watcher.onDidCreate((uri) => this.invalidate(uri)),
      watcher.onDidDelete((uri) => this.invalidate(uri)),
      vscode.workspace.onDidSaveTextDocument((document) => {
        if (isSupportedDocument(document)) {
          this.invalidate(document.uri);
        }
      }),
      vscode.workspace.onDidChangeNotebookDocument((event) => {
        this.invalidate(event.notebook.uri);
      }),
    );
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
      document.version,
      effectiveOffset,
    ].join(':');
    const cached = this.snapshots.get(documentKey);
    if (cached?.key === key) {
      return cached.value;
    }

    const value = this.buildSnapshot(document, parsed, effectiveOffset);
    this.snapshots.set(documentKey, { key, value });
    value
      .then((resolved) => this.resolvedSnapshots.set(documentKey, resolved))
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
    if (this.disposed || (uri && isIgnoredUri(uri))) {
      return;
    }
    this.invalidationGeneration += 1;
    this.snapshots.clear();
    this.resolvedSnapshots.clear();
    this.fileSources.clear();
    this.resolutions.clear();
    if (uri) {
      this.documentSources.delete(uriKey(uri));
    } else {
      this.documentSources.clear();
    }
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
      folder: vscode.workspace.getWorkspaceFolder(document.uri),
      sourceBatches: [],
      loaded: new Set<string>(),
      visiting: new Set<string>(),
      limitations: [],
      loadOrder: 0,
      fileCount: 0,
    };
    const notebook = notebookContaining(document);
    // notebook 单元格已经在 parse 时按“当前格及之前”裁过，这里不再用单元格内 offset 二次裁剪。
    await this.visitSource(document.uri, parsed, state, notebook ? Number.POSITIVE_INFINITY : offset, true);
    index.replaceSources(state.sourceBatches);
    return makeSnapshot(index, state.limitations);
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
    this.documentSources.set(key, { version: document.version, parsed });
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

      for (const entry of timeline) {
        if (entry.kind === 'definition') {
          const sourceKey = `${key}#definition:${entry.value.source.startOffset}:${state.loadOrder}`;
          state.sourceBatches.push({
            sourceId: sourceKey,
            definitions: [entry.value],
            loadOrder: state.loadOrder,
          });
          state.loadOrder += 1;
          continue;
        }
        const dependency = entry.value;
        if (dependency.resolution !== 'literal') {
          state.limitations.push(
            `动态依赖无法安全解析：${dependency.name}（${displayUri(uri)}）`,
          );
          continue;
        }
        const target = await this.resolveDependency(uri, dependency, state.folder);
        if (!target) {
          continue;
        }
        if (state.visiting.has(uriKey(target))) {
          state.limitations.push(`检测到循环依赖，已跳过：${displayUri(target)}`);
          continue;
        }
        const targetParsed = await this.loadFileSource(target);
        if (targetParsed) {
          await this.visitSource(target, targetParsed, state, Number.POSITIVE_INFINITY);
        }
      }
    } finally {
      state.visiting.delete(key);
    }
  }

  private loadFileSource(uri: vscode.Uri): Promise<ParsedSource | undefined> {
    const key = uriKey(uri);
    const cached = this.fileSources.get(key);
    if (cached) {
      return cached;
    }
    const value = this.readAndParseFile(uri);
    this.fileSources.set(key, value);
    return value;
  }

  private async readAndParseFile(uri: vscode.Uri): Promise<ParsedSource | undefined> {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      if (bytes.byteLength > this.maxFileBytes) {
        return undefined;
      }
      return parseTeXSource(new TextDecoder().decode(bytes), uriKey(uri));
    } catch {
      return undefined;
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
    this.resolutions.set(cacheKey, value);
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
      if (reachable && !isIgnoredUri(candidate) && await isFile(candidate)) {
        return candidate;
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
      .filter((uri) => isInsideFolder(uri, folder) && !isIgnoredUri(uri))
      .sort((left, right) => left.path.localeCompare(right.path))[0];
  }
}

function parseTeXSource(text: string, sourceId: string): ParsedSource {
  const definitions = parseDefinitions(text, sourceId);
  const dependencies = parseDependencies(text, sourceId).filter((dependency) =>
    !definitions.some((definition) =>
      dependency.source.startOffset >= definition.source.startOffset &&
      dependency.source.startOffset < definition.source.endOffset,
    ),
  );
  return { definitions, dependencies };
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
): DefinitionSnapshot {
  const commandDefinitions = index.listCommands().map((entry) => entry.definition);
  const environmentDefinitions = index.listEnvironments().map((entry) => entry.definition);
  // 颜色排在最前：`\colorlet` 和后面的宏都可能引用它们。
  const colorDefinitions = index.listColors().map((entry) => entry.definition);
  const allDefinitions = [...colorDefinitions, ...commandDefinitions, ...environmentDefinitions];
  const recognizedLimited = allDefinitions.filter((definition) =>
    definition.expandability === 'recognized-limited' || serializeDefinition(definition) === undefined,
  );
  const prelude = allDefinitions
    .map(serializeDefinition)
    .filter((value): value is string => value !== undefined)
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
  const fingerprintPayload = JSON.stringify({ prelude, commands, environments, limitations });
  const fingerprint = createHash('sha256').update(fingerprintPayload).digest('hex').slice(0, 16);
  return {
    fingerprint,
    prelude,
    definitionPrelude: prelude,
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
    || document.languageId === 'mdx';
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
