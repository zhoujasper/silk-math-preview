import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import * as vscode from 'vscode';

import {
  definitionPreviewSample,
  isDefinitionOnlySource,
  withDefinitionPreviewSample,
} from '../core/definitionPreview';
import { COMMAND_NS, PRODUCT_NAME } from '../core/channel';
import { recoverIncompleteTex } from '../core/incompleteTex';
import { advanceMarkdownFenceState, findMathRegionAt, mathRegionContent, regionContainsOffset, scanMathRegions, selectionOverlapsRegion } from '../core/mathScanner';
import { buildPreviewExpression } from '../core/previewExpression';
import { decidePreviewSelection, shouldRetainLastPreviewFrame } from '../core/previewSelection';
import {
  floatingPreviewLayout,
  notebookPreviewSpacerCss,
  notebookPreviewSpacerPx,
  previewPanelInsets,
  resolveEditorMetrics,
  previewViewportAnchorCss,
  parsePreviewCss,
  hasAdvancedPreviewCss,
  previewFontScale,
  PreviewSourceAnchors,
  resolvePreviewAnchor,
  resolvePreviewHorizontalLayout,
  resolvePreviewPlacement,
  resolvePreviewRangeStart,
  visibleColumnOf,
  type EditorMetrics,
  type PreviewPlacement,
  type PreviewThemeVariant,
} from './preview-style';
import type { PreviewCss } from '../core/previewCss';
import { isTablePreviewRegion, TABLE_PREVIEW_SCALE } from '../core/tablePreview';
import type { MarkdownFenceState, MathRegion, MathScanOptions } from '../core/types';
import { WeightedLru } from '../core/weightedLru';
import { RenderClient, type RenderClientStats } from '../render/renderClient';
import { containsTikz, TIKZ_ENVIRONMENTS } from '../tikz/source';
import type { TikzService } from './tikzService';

export interface PreviewDefinitionSnapshot {
  readonly fingerprint: string;
  readonly prelude: string;
  readonly packages?: readonly string[];
  readonly commands: readonly string[];
  readonly environments: readonly string[];
  readonly limitations: readonly string[];
}

export interface PreviewDefinitionProvider {
  getSnapshot(document: vscode.TextDocument, offset?: number): Promise<PreviewDefinitionSnapshot>;
  getTikzContext?(document: vscode.TextDocument, offset: number): Promise<string>;
  /**
   * 已经算好的快照，不做任何解析。编辑热路径用它跳过整份文档的定义解析
   * （实测 18k 字符的 .tex 每次按键要 2.5~3.9 ms），随后再后台核对一次。
   */
  peekSnapshot?(document: vscode.TextDocument): PreviewDefinitionSnapshot | undefined;
  readonly onDidInvalidate?: vscode.Event<vscode.Uri | undefined>;
}

interface CachedSvg {
  readonly uri: vscode.Uri;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly renderMs: number;
}

interface MarkdownFenceCache {
  version: number;
  /** 第 i 项是第 i 行起点的状态；null 表示不在 fenced code 内。 */
  readonly states: Array<MarkdownFenceState | null>;
}

interface ActivePreview {
  readonly editor: vscode.TextEditor;
  readonly region: MathRegion;
}

/** 控制面板需要的一帧状态。 */
export interface PreviewFrame {
  readonly status: 'ok' | 'error' | 'unsupported' | 'idle';
  readonly fileName?: string;
  readonly line?: number;
  readonly regionKind?: string;
  readonly message?: string;
  readonly svg?: string;
  readonly renderMs?: number;
}

export interface PreviewPerformanceSnapshot extends RenderClientStats {
  readonly scans: number;
  readonly scanP50Ms: number;
  readonly scanP95Ms: number;
  readonly cacheEntries: number;
  readonly cacheBytes: number;
}

const SVG_CACHE_BYTES = 8 * 1024 * 1024;
const SVG_CACHE_ENTRIES = 64;
/** 走过快照快路径后，多久回头核对一次真实定义。 */
const DEFINITION_REFRESH_MS = 180;
/** 渲染失败多久之后才把原因显示出来；打字途中的瞬时失败不会走到这里。 */
const FAILURE_NOTICE_MS = 400;
const VIEWPORT_ANCHOR = `--${COMMAND_NS}-preview-viewport`;

interface PreviewSettings {
  readonly enabled: boolean;
  readonly debounceMs: number;
  readonly previewPosition: string;
  readonly showCaret: boolean;
  readonly maxFormulaChars: number;
  readonly rendererIdleMs: number;
  readonly previewScale: number;
  readonly showRenderErrors: boolean;
  readonly markUnknownCommands: boolean;
  readonly previewDefinitions: boolean;
  readonly trace: boolean;
  readonly previewCss: PreviewCss;
}

/** 配置在每次按键的热路径上要读五六次，缓存下来，只在配置变更时重读。 */
function readSettings(): PreviewSettings {
  const config = vscode.workspace.getConfiguration(COMMAND_NS);
  let previewCss = parsePreviewCss('');
  try { previewCss = parsePreviewCss(config.get<string>('previewCss', '')); }
  catch (error) { void vscode.window.showWarningMessage(`${PRODUCT_NAME} CSS: ${String(error)}`); }
  return {
    enabled: config.get('enabled', true),
    debounceMs: config.get('debounceMs', 8),
    previewPosition: config.get('previewPosition', 'below'),
    showCaret: config.get('showCaret', true),
    maxFormulaChars: config.get('maxFormulaChars', 20_000),
    rendererIdleMs: config.get('rendererIdleMs', 60_000),
    previewScale: config.get('previewScale', 1.35),
    showRenderErrors: config.get('showRenderErrors', true),
    markUnknownCommands: config.get('markUnknownCommands', true),
    previewDefinitions: config.get('previewDefinitions', false),
    trace: config.get('trace', false),
    previewCss,
  };
}

/** 语言与启用范围由状态栏策略决定；默认策略保持原来的 latex/markdown 行为。 */
export interface PreviewPolicy {
  previewLanguage(document: vscode.TextDocument): 'latex' | 'markdown' | undefined;
  readonly onDidChange?: vscode.Event<void>;
  tikzEnabled?(document?: vscode.TextDocument): boolean;
}

const DEFAULT_POLICY: PreviewPolicy = {
  previewLanguage(document) {
    if (document.languageId === 'latex' || document.languageId === 'tex') return 'latex';
    if (document.languageId === 'markdown' || document.languageId === 'mdx') return 'markdown';
    return undefined;
  },
};

function isNotebookCellDocument(document: vscode.TextDocument): boolean {
  if (document.uri.scheme === 'vscode-notebook-cell') return true;
  return vscode.workspace.notebookDocuments.some((notebook) =>
    notebook.getCells().some((cell) => cell.document.uri.toString() === document.uri.toString()),
  );
}

function visibleLineSpan(editor: vscode.TextEditor): { start: number; end: number } {
  const ranges = editor.visibleRanges;
  const first = ranges[0];
  const last = ranges[ranges.length - 1];
  if (!first || !last) {
    return { start: 0, end: Math.max(0, editor.document.lineCount - 1) };
  }
  return {
    start: first.start.line,
    end: last.end.line,
  };
}

function percentile(values: readonly number[], ratio: number): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * ratio))] ?? 0;
}

function themePalette(): { readonly foreground: string; readonly caret: string } {
  const light = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light
    || vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrastLight;
  return light
    ? { foreground: '#202124', caret: '#b3261e' }
    : { foreground: '#d7dae0', caret: '#ffb454' };
}

function previewThemeVariant(): PreviewThemeVariant {
  const kind = vscode.window.activeColorTheme.kind;
  if (kind === vscode.ColorThemeKind.HighContrast || kind === vscode.ColorThemeKind.HighContrastLight) {
    return 'high-contrast';
  }
  return kind === vscode.ColorThemeKind.Light ? 'light' : 'dark';
}

/** 明确不可能在 MathJax 里渲染的内容；给出人话原因比抛一个 TeX 报错有用。 */
function unsupportedContent(source: string): string | undefined {
  if (/\\tikz\b/.test(source)) {
    return '请使用 tikzpicture 环境并开启 TikZ 预览 / Use a tikzpicture environment and enable TikZ preview';
  }
  return undefined;
}

function dataUri(svg: string): vscode.Uri {
  return vscode.Uri.from({
    scheme: 'data',
    path: `image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`,
  });
}

/** 浮层落点与 SVG 尺寸都要跟随编辑器字体，读取的是文档作用域下的生效值。 */
function readEditorMetrics(document: vscode.TextDocument): EditorMetrics {
  const config = vscode.workspace.getConfiguration('editor', document.uri);
  return resolveEditorMetrics(
    config.get<number>('fontSize'),
    config.get<number>('lineHeight'),
    process.platform === 'darwin',
  );
}

/** SVG 里现在写死了像素尺寸与缩放，因此 `exPx` 与 `scale` 必须参与缓存键。 */
function cacheKey(
  expression: string,
  displayMode: boolean,
  fingerprint: string,
  foreground: string,
  caret: string,
  exPx: number,
  scale: number,
  markUnknownCommands: boolean,
): string {
  return createHash('sha256')
    .update(expression)
    .update(displayMode ? '\u0001' : '\u0000')
    .update(fingerprint)
    .update(foreground)
    .update(caret)
    .update(exPx.toFixed(3))
    .update(scale.toFixed(3))
    .update(markUnknownCommands ? 'nu' : 'strict')
    .digest('hex');
}

/**
 * 编辑和选区热路径始终只扫描光标附近的有界窗口；全文诊断由语言功能层在停输后单独完成。
 */
export class PreviewController implements vscode.Disposable {
  private readonly decoration = vscode.window.createTextEditorDecorationType({
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    // 只命名当前 decoration 所在的内容视口；不把整个源码 token 变成定位容器。
    textDecoration: previewViewportAnchorCss(),
  });
  private readonly renderClient: RenderClient;
  private readonly sourceAnchors = new PreviewSourceAnchors();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly svgCache = new WeightedLru<CachedSvg>(SVG_CACHE_ENTRIES, SVG_CACHE_BYTES);
  private readonly markdownFenceCaches = new Map<string, MarkdownFenceCache>();
  private readonly scanSamples: number[] = [];
  private readonly frameEmitter = new vscode.EventEmitter<PreviewFrame>();
  /** 每次渲染结果（成功、失败、清空）都会推一帧，供控制面板实时显示。 */
  public readonly onDidRender = this.frameEmitter.event;
  private scheduleTimer: NodeJS.Timeout | undefined;
  private pendingEditor: vscode.TextEditor | undefined;
  private pendingWait = 0;
  private definitionRefreshTimer: NodeJS.Timeout | undefined;
  private failureTimer: NodeJS.Timeout | undefined;
  private metricsCache: { readonly key: string; readonly metrics: EditorMetrics } | undefined;
  private lastDecorationSignature: string | undefined;
  private appearanceVersion = 0;
  private lastPaint: {
    readonly editor: vscode.TextEditor;
    readonly region: MathRegion;
    readonly rendered: CachedSvg;
    readonly metrics: EditorMetrics;
    readonly renderKey: string;
  } | undefined;
  /** 同一文档版本里光标还在上次公式内就不必再扫一遍。 */
  private lastRegionHit: {
    readonly uri: string;
    readonly version: number;
    readonly region: MathRegion;
  } | undefined;
  private settings = readSettings();
  private activePreview: ActivePreview | undefined;
  private previewVisible = false;
  private epoch = 0;
  private enabled = true;
  private scans = 0;
  private lastTikzDocument: string | undefined;

  constructor(
    private readonly definitions: PreviewDefinitionProvider,
    workerPath: string,
    private readonly policy: PreviewPolicy = DEFAULT_POLICY,
    private readonly output?: vscode.OutputChannel,
    private readonly tikz?: TikzService,
  ) {
    this.disposables.push(this.frameEmitter);
    this.renderClient = new RenderClient(workerPath, this.settings.rendererIdleMs);
    this.enabled = this.settings.enabled;
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        this.clearAllVisible();
        this.schedule(editor, 0);
      }),
      vscode.window.onDidChangeTextEditorSelection((event) => {
        this.handleSelectionChange(event);
      }),
      vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
        this.repositionPaint(event.textEditor);
      }),
      vscode.workspace.onDidChangeTextDocument((event) => {
        this.invalidateMarkdownFenceCache(event);
        const editor = vscode.window.activeTextEditor;
        if (editor?.document === event.document) {
          const immediate = this.previewVisible
            && this.activePreview?.editor === editor;
          if (immediate && !this.lastTikzDocument) this.renderClient.prepare();
          this.schedule(editor, immediate ? 0 : undefined);
        }
      }),
      vscode.workspace.onDidCloseTextDocument((document) => {
        this.markdownFenceCaches.delete(document.uri.toString());
      }),
      ...(policy.onDidChange
        ? [policy.onDidChange(() => {
          this.clearAllVisible();
          this.schedule(vscode.window.activeTextEditor, 0);
        })]
        : []),
      ...(this.definitions.onDidInvalidate
        ? [this.definitions.onDidInvalidate(() => {
          const editor = vscode.window.activeTextEditor;
          if (!editor) return;
          this.scheduleDefinitionRefresh(
            editor,
            this.definitions.peekSnapshot?.(editor.document)?.fingerprint ?? '',
            48,
          );
        })]
        : []),
      vscode.window.onDidChangeActiveColorTheme(() => {
        this.svgCache.clear();
        this.schedule(vscode.window.activeTextEditor, 0);
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        // 字号和行高决定 SVG 像素尺寸与浮层落点，改动后缓存的 SVG 必须重画。
        if (event.affectsConfiguration('editor.fontSize') || event.affectsConfiguration('editor.lineHeight')) {
          this.metricsCache = undefined;
          this.svgCache.clear();
          this.schedule(vscode.window.activeTextEditor, 0);
        }
        if (!event.affectsConfiguration(COMMAND_NS)
          || (!Object.keys(this.settings).some(key => event.affectsConfiguration(`${COMMAND_NS}.${key}`))
            && !event.affectsConfiguration(`${COMMAND_NS}.tikz.enabled`)
            && !event.affectsConfiguration(`${COMMAND_NS}.customMathEnvironments`))) return;
        const cssOnly = event.affectsConfiguration(`${COMMAND_NS}.previewCss`)
          && !event.affectsConfiguration(`${COMMAND_NS}.tikz.enabled`)
          && !event.affectsConfiguration(`${COMMAND_NS}.customMathEnvironments`)
          && Object.keys(this.settings).every((key) => key === 'previewCss' || !event.affectsConfiguration(`${COMMAND_NS}.${key}`));
        this.settings = readSettings();
        this.appearanceVersion += 1;
        if (cssOnly) {
          if (this.lastPaint) this.repositionPaint(this.lastPaint.editor);
          return;
        }
        this.metricsCache = undefined;
        this.svgCache.clear();
        this.enabled = this.settings.enabled;
        this.renderClient.setIdleMs(this.settings.rendererIdleMs);
        this.tikz?.setIdleMs(this.settings.rendererIdleMs);
        this.lastRegionHit = undefined;
        if (!this.tikzEnabled(vscode.window.activeTextEditor?.document)) this.tikz?.cancel();
        this.schedule(vscode.window.activeTextEditor, 0);
      }),
    );
    this.schedule(vscode.window.activeTextEditor, 0);
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    if (!this.enabled) this.clearAllVisible();
    else this.schedule(vscode.window.activeTextEditor, 0);
    return this.enabled;
  }

  refresh(): void {
    this.svgCache.clear();
    this.schedule(vscode.window.activeTextEditor, 0);
  }

  /** 只关闭当前浮层；下一次移动光标或继续编辑时仍可正常重新显示。 */
  dismiss(): void {
    this.clearAllVisible();
  }

  stats(): PreviewPerformanceSnapshot {
    return {
      ...this.renderClient.stats(),
      scans: this.scans,
      scanP50Ms: percentile(this.scanSamples, 0.5),
      scanP95Ms: percentile(this.scanSamples, 0.95),
      cacheEntries: this.svgCache.size,
      cacheBytes: this.svgCache.totalWeight,
    };
  }

  /**
   * 把光标所在公式在预览链路上的每一步都打印出来：语言判定、区域、表达式、渲染结果。
   * 用户报“某条公式就是不显示”而本地复现不出来时，这一条命令就能定位到具体环节。
   */
  async diagnose(): Promise<string> {
    const editor = vscode.window.activeTextEditor;
    const lines: string[] = [`# ${PRODUCT_NAME} 诊断 · ${new Date().toISOString()}`];
    if (!editor) return [...lines, '没有活动编辑器。'].join('\n');
    const document = editor.document;
    const offset = document.offsetAt(editor.selection.active);
    const language = this.policy.previewLanguage(document);
    lines.push(
      `文件: ${document.uri.toString()}`,
      `languageId: ${document.languageId} → 预览语言: ${language ?? '（未启用）'}`,
      `扩展开关: enabled=${this.enabled} previewScale=${this.settings.previewScale} markUnknown=${this.settings.markUnknownCommands}`,
      `光标: 行 ${editor.selection.active.line + 1} 列 ${editor.selection.active.character + 1}（offset ${offset}）`,
    );
    if (!language) return lines.join('\n');

    let snapshot: PreviewDefinitionSnapshot;
    try {
      snapshot = await this.definitions.getSnapshot(document, offset);
    } catch (error) {
      snapshot = { fingerprint: 'unavailable', prelude: '', commands: [], environments: [], limitations: [] };
      lines.push(`定义快照失败: ${error instanceof Error ? error.message : String(error)}`);
    }
    lines.push(
      `宏包: ${(snapshot.packages ?? []).join(', ') || '无显式宏包'}`,
      `定义: 命令 ${snapshot.commands.length} 个，数学环境 ${JSON.stringify(snapshot.environments)}，prelude ${snapshot.prelude.length} 字符`,
    );

    const region = this.findCurrentRegion(document, offset, snapshot);
    if (!region) {
      lines.push('区域: 光标不在任何已识别的公式里（若光标正好落在结束分隔符之后，请移进公式内部再试）。');
      return lines.join('\n');
    }
    const regionSource = document.getText(new vscode.Range(
      document.positionAt(region.start),
      document.positionAt(region.end),
    ));
    lines.push(
      `区域: ${region.kind}${region.environment ? `{${region.environment}}` : ''} closed=${region.closed}`,
      `      行 ${document.positionAt(region.start).line + 1}–${document.positionAt(region.end).line + 1}，${regionSource.length} 字符`,
      `      ${JSON.stringify(regionSource.slice(0, 120))}`,
    );
    const isTikz = containsTikz(regionSource);
    if (isTikz && !this.tikzEnabled(document)) return [...lines, 'TikZ 实时预览默认关闭；在 Silk Math 菜单中勾选 TikZ / pgfplots 实时预览。'].join('\n');
    const unsupported = unsupportedContent(regionSource);
    if (unsupported) {
      lines.push(`不支持: ${unsupported}`);
      return lines.join('\n');
    }

    const localRegion: MathRegion = {
      ...region,
      start: 0,
      end: region.end - region.start,
      contentStart: region.contentStart - region.start,
      contentEnd: region.contentEnd - region.start,
      ...(region.recovery
        ? { recovery: { ...region.recovery, boundary: region.recovery.boundary - region.start } }
        : {}),
    };
    const expression = isTikz ? regionSource : recoverIncompleteTex(buildPreviewExpression(
      regionSource,
      localRegion,
      offset - region.start,
      this.settings.showCaret,
    ).expression);
    lines.push(`表达式: ${JSON.stringify(expression.slice(0, 400))}`);

    const metrics = this.editorMetrics(document);
    const palette = themePalette();
    const response = await (isTikz ? this.tikz! : this.renderClient).render({
      expression,
      displayMode: region.kind !== 'dollar-inline' && region.kind !== 'paren-inline',
      definitionFingerprint: snapshot.fingerprint,
      definitionPrelude: isTikz ? await this.tikzPrelude(document, region, snapshot) : snapshot.prelude,
      packages: snapshot.packages ?? [],
      foreground: palette.foreground,
      caretColor: palette.caret,
      scale: isTikz ? this.settings.previewScale / 1.35 : isTablePreviewRegion(region) ? TABLE_PREVIEW_SCALE : 1,
      exPx: metrics.exPx,
      markUnknownCommands: this.settings.markUnknownCommands,
    });
    if (!response.ok) {
      lines.push(`渲染失败: ${response.error}`);
      return lines.join('\n');
    }
    lines.push(
      `渲染成功: ${response.widthPx}×${response.heightPx}px，SVG ${response.svg.length} 字节，${response.renderMs.toFixed(1)} ms`,
      `可见图元: path=${response.svg.includes('<path')} text=${response.svg.includes('<text')} rect=${response.svg.includes('<rect')}`,
      `浮层状态: previewVisible=${this.previewVisible} 已应用签名=${this.lastDecorationSignature !== undefined}`,
      `字体度量: fontSize=${metrics.fontSizePx} lineHeight=${metrics.lineHeightPx} exPx=${metrics.exPx.toFixed(2)}`,
    );
    return lines.join('\n');
  }

  async renderStandalone(expression: string): Promise<string> {
    const palette = themePalette();
    const response = await this.renderClient.render({
      expression,
      displayMode: true,
      definitionFingerprint: 'ocr-standalone',
      definitionPrelude: '',
      foreground: palette.foreground,
      caretColor: palette.caret,
      scale: 1,
      // OCR 面板把 SVG 内联进 Webview，由那里的字体决定 ex，不需要固定像素。
      exPx: 0,
      markUnknownCommands: this.settings.markUnknownCommands,
    });
    if (!response.ok) throw new Error(response.error);
    return response.svg;
  }

  dispose(): void {
    if (this.scheduleTimer) clearTimeout(this.scheduleTimer);
    if (this.definitionRefreshTimer) clearTimeout(this.definitionRefreshTimer);
    if (this.failureTimer) clearTimeout(this.failureTimer);
    this.clearAllVisible();
    this.decoration.dispose();
    for (const disposable of this.disposables) disposable.dispose();
    void this.renderClient.dispose();
    this.tikz?.dispose();
  }

  /**
   * 一次按键会同时触发文本变更和选区变更两个事件。已经排到更早时间点的调度
   * 读到的状态完全相同，重排只会白白作废一次在途渲染，所以直接复用。
   */
  private schedule(editor: vscode.TextEditor | undefined, delay?: number): void {
    const tikz = editor && this.tikzEnabled(editor.document) && (this.lastTikzDocument === editor.document.uri.toString()
      || TIKZ_ENVIRONMENTS.some((name) => name === this.lastRegionHit?.region.environment));
    const wait = tikz ? Math.max(80, delay ?? this.settings.debounceMs) : delay ?? this.settings.debounceMs;
    if (!tikz && this.scheduleTimer !== undefined && this.pendingEditor === editor && this.pendingWait <= wait) {
      return;
    }
    if (this.scheduleTimer) clearTimeout(this.scheduleTimer);
    this.pendingEditor = editor;
    this.pendingWait = wait;
    const epoch = ++this.epoch;
    this.scheduleTimer = setTimeout(() => {
      this.scheduleTimer = undefined;
      this.pendingEditor = undefined;
      void this.update(editor, epoch);
    }, wait);
  }

  private editorMetrics(document: vscode.TextDocument): EditorMetrics {
    const key = `${document.uri.toString()}|${this.settings.previewScale}`;
    if (this.metricsCache?.key === key) return this.metricsCache.metrics;
    const base = readEditorMetrics(document);
    // previewScale 只放大公式本身，行高与落点仍按编辑器真实行网格。
    const scale = Number.isFinite(this.settings.previewScale)
      ? Math.min(3, Math.max(0.5, this.settings.previewScale))
      : 1;
    const metrics: EditorMetrics = { ...base, exPx: base.exPx * scale };
    this.metricsCache = { key, metrics };
    return metrics;
  }

  private handleSelectionChange(event: vscode.TextEditorSelectionChangeEvent): void {
    const editor = event.textEditor;
    // 后台分屏中的程序化选区变化不能清掉当前编辑器的预览。
    if (editor !== vscode.window.activeTextEditor) return;
    if (this.activePreview !== undefined && this.activePreview.editor !== editor) this.clearAllVisible();
    const current = this.activePreview?.editor === editor ? this.activePreview.region : undefined;
    const hit = this.locateFormula(editor, this.definitions.peekSnapshot?.(editor.document) ?? {
      fingerprint: '', prelude: '', commands: [], environments: [], limitations: [],
    }, false)?.region;
    const action = decidePreviewSelection({ ...(current ? { currentRegion: current } : {}), ...(hit ? { hitRegion: hit } : {}) });
    if (action === 'clear') {
      // 同一事件中移除图片和锚点，并取消排队任务；不再等第二次点击或编辑。
      this.dismiss();
      return;
    }
    if (action === 'switch-region' && current) this.clearAllVisible();
    this.schedule(editor, 0);
  }

  /** 只挪 decoration 锚点，不重新渲染。滚动时公式首行出视口，浮层必须跟到仍可见的那一行。 */
  private repositionPaint(editor: vscode.TextEditor): void {
    const paint = this.lastPaint;
    if (!paint || paint.editor !== editor || !this.previewVisible) return;
    this.applyDecoration(paint.editor, paint.region, paint.rendered, paint.metrics, paint.renderKey);
  }

  private async update(editor: vscode.TextEditor | undefined, epoch: number): Promise<void> {
    if (!editor || !this.enabled || this.policy.previewLanguage(editor.document) === undefined) {
      this.clearAllVisible();
      return;
    }
    const document = editor.document;
    const documentOffset = this.preferredFormulaOffset(editor);
    // 浮层已经在显示时 Worker 必然是热的，这一趟预扫描只是重复开销。
    const editing = this.previewVisible && this.activePreview?.editor === editor;
    if (!editing) {
      const documentLength = document.offsetAt(document.lineAt(document.lineCount - 1).range.end);
      const preliminaryRoughStart = Math.max(0, documentOffset - 4_096);
      const preliminaryStartLine = document.positionAt(preliminaryRoughStart).line;
      const preliminaryStart = document.offsetAt(document.lineAt(preliminaryStartLine).range.start);
      const preliminaryEnd = Math.min(documentLength, documentOffset + 4_096);
      const preliminary = document.getText(new vscode.Range(
        document.positionAt(preliminaryStart),
        document.positionAt(preliminaryEnd),
      ));
      const preliminaryRegions = scanMathRegions(
        preliminary,
        this.mathScanOptions(document, [], preliminaryStartLine),
      ).regions;
      const preliminaryRegion = findMathRegionAt(preliminaryRegions, documentOffset - preliminaryStart);
      if (preliminaryRegion && !containsTikz(preliminary.slice(preliminaryRegion.start, preliminaryRegion.end))) {
        // 与首次依赖解析并行，隐藏大部分 Worker 启动延迟。
        this.renderClient.prepare();
      }
    }
    // 编辑途中直接复用上一次算好的定义快照，避免每次按键重新解析整份文档；
    // 真正的定义变化由后台核对补上。
    let snapshot = editing ? this.definitions.peekSnapshot?.(document) : undefined;
    if (snapshot) {
      this.scheduleDefinitionRefresh(editor, snapshot.fingerprint);
    } else {
      try {
        snapshot = await this.definitions.getSnapshot(document, documentOffset);
      } catch {
        snapshot = { fingerprint: 'definitions-unavailable', prelude: '', commands: [], environments: [], limitations: [] };
      }
      if (epoch !== this.epoch || editor !== vscode.window.activeTextEditor) return;
    }

    const located = this.locateFormula(editor, snapshot);
    if (!located) {
      this.clearEditor(editor);
      return;
    }
    const { region } = located;
    const caretOffset = regionContainsOffset(region, document.offsetAt(editor.selection.active))
      ? document.offsetAt(editor.selection.active)
      : Math.min(Math.max(located.offset, region.contentStart), Math.max(region.contentStart, region.contentEnd));
    if (region.contentEnd - region.contentStart > this.settings.maxFormulaChars) {
      this.clearEditor(editor);
      return;
    }

    const showCaret = this.settings.showCaret;
    const regionSource = document.getText(new vscode.Range(
      document.positionAt(region.start),
      document.positionAt(region.end),
    ));
    const localRegion: MathRegion = {
      ...region,
      start: 0,
      end: region.end - region.start,
      contentStart: region.contentStart - region.start,
      contentEnd: region.contentEnd - region.start,
      ...(region.recovery
        ? { recovery: { ...region.recovery, boundary: region.recovery.boundary - region.start } }
        : {}),
    };
    const isTikz = containsTikz(regionSource);
    this.lastTikzDocument = isTikz ? document.uri.toString() : undefined;
    if (isTikz && !this.tikzEnabled(document)) {
      this.tikz?.cancel();
      this.clearEditor(editor);
      return;
    }
    const content = mathRegionContent(regionSource, localRegion);
    const definitionOnly = !isTikz && isDefinitionOnlySource(content);
    if (definitionOnly && !this.settings.previewDefinitions) {
      this.clearFailureNotice();
      this.clearEditor(editor);
      this.emitFrame(editor, region, { status: 'idle' });
      return;
    }
    if (definitionOnly && !definitionPreviewSample(content)) {
      this.clearFailureNotice();
      this.clearEditor(editor);
      this.emitFrame(editor, region, { status: 'idle' });
      return;
    }
    const built = isTikz ? regionSource : buildPreviewExpression(
      regionSource,
      localRegion,
      caretOffset - region.start,
      showCaret && !definitionOnly,
    ).expression;
    const expression = isTikz ? built : recoverIncompleteTex(
      definitionOnly ? withDefinitionPreviewSample(built, content) : built,
    );
    let prelude: string;
    try { prelude = isTikz ? await this.tikzPrelude(document, region, snapshot) : snapshot.prelude; }
    catch (error) {
      if (epoch === this.epoch) this.scheduleFailureNotice(editor, region, this.editorMetrics(document), String(error));
      return;
    }
    if (epoch !== this.epoch || editor !== vscode.window.activeTextEditor) return;
    const displayMode = region.kind !== 'dollar-inline' && region.kind !== 'paren-inline';
    const palette = themePalette();
    const metrics = this.editorMetrics(document);
    // 行内 TikZ 简写仍提示改用完整图形环境。
    const unsupported = unsupportedContent(regionSource);
    if (unsupported) {
      this.emitFrame(editor, region, { status: 'unsupported', message: unsupported });
      this.clearFailureNotice();
      if (this.settings.showRenderErrors) this.applyFailureNotice(editor, region, metrics, unsupported);
      else this.clearEditor(editor);
      return;
    }
    // 表格常常比正文公式宽得多，整体缩小一档才放得下。
    const scale = isTikz ? this.settings.previewScale / 1.35 : isTablePreviewRegion(region) ? TABLE_PREVIEW_SCALE : 1;
    const key = cacheKey(
      expression,
      displayMode,
      isTikz ? `tikz:${prelude}` : snapshot.fingerprint,
      isTikz ? '' : palette.foreground,
      isTikz ? '' : palette.caret,
      isTikz ? 0 : metrics.exPx,
      scale,
      this.settings.markUnknownCommands,
    );
    let rendered = this.svgCache.get(key);
    if (!rendered) {
      const response = await (isTikz ? this.tikz! : this.renderClient).render({
        expression,
        displayMode,
        definitionFingerprint: snapshot.fingerprint,
        definitionPrelude: prelude,
        packages: snapshot.packages ?? [],
        foreground: palette.foreground,
        caretColor: palette.caret,
        scale,
        exPx: metrics.exPx,
        markUnknownCommands: this.settings.markUnknownCommands,
      });
      if (epoch !== this.epoch || editor !== vscode.window.activeTextEditor) return;
      this.trace(response.ok
        ? `render ok ${response.widthPx}x${response.heightPx}px svg=${response.svg.length}B ${response.renderMs.toFixed(1)}ms :: ${expression.slice(0, 160)}`
        : `render fail ${response.error} :: ${expression.slice(0, 160)}`);
      const drawable = response.ok
        && (response.svg.includes('<path') || response.svg.includes('<text') || response.svg.includes('<rect'));
      if (response.ok && !drawable) {
        if (definitionOnly) {
          this.clearFailureNotice();
          this.clearEditor(editor);
          this.emitFrame(editor, region, { status: 'idle' });
          return;
        }
        // 渲染成功却没有任何可见图元：宁可说明原因，也不要留一个空白面板。
        this.emitFrame(editor, region, { status: 'error', message: '公式渲染结果为空，请检查这段内容' });
        this.scheduleFailureNotice(editor, region, metrics, '公式渲染结果为空，请检查这段内容');
        return;
      }
      if (!response.ok) {
        if (response.error === 'cancelled' || response.error === 'superseded') return;
        // 输入未完成时保留上一帧，避免闪烁；但当前公式从来没成功过就什么都看不到，
        // 用户无从判断是插件坏了还是公式里有不支持的写法，因此延迟给出可见原因。
        this.emitFrame(editor, region, { status: 'error', message: response.error });
        this.scheduleFailureNotice(editor, region, metrics, response.error);
        return;
      }
      this.clearFailureNotice();
      this.emitFrame(editor, region, {
        status: 'ok',
        svg: response.svg,
        renderMs: response.renderMs,
      });
      rendered = {
        uri: dataUri(response.svg),
        widthPx: response.widthPx,
        heightPx: response.heightPx,
        renderMs: response.renderMs,
      };
      this.svgCache.set(key, rendered, Buffer.byteLength(response.svg, 'utf8'));
    }
    if (epoch !== this.epoch || editor !== vscode.window.activeTextEditor) return;
    this.applyDecoration(editor, region, rendered, metrics, key);
  }

  private tikzEnabled(document?: vscode.TextDocument): boolean {
    return this.tikz !== undefined && (this.policy.tikzEnabled?.(document)
      ?? vscode.workspace.getConfiguration(COMMAND_NS, document?.uri).get('tikz.enabled', false));
  }

  private async tikzPrelude(document: vscode.TextDocument, region: MathRegion, snapshot: PreviewDefinitionSnapshot): Promise<string> {
    return this.definitions.getTikzContext?.(document, region.start) ?? snapshot.prelude;
  }

  /**
   * 渲染失败且当前公式还没有任何一帧时，延迟一小会儿再显示原因：
   * 边打字边渲染时失败是常态，成功帧到达就取消，因此不会闪烁。
   */
  private scheduleFailureNotice(
    editor: vscode.TextEditor,
    region: MathRegion,
    metrics: EditorMetrics,
    message: string,
  ): void {
    if (!this.settings.showRenderErrors) return;
    if (shouldRetainLastPreviewFrame({
      hasVisibleFrame: this.lastDecorationSignature !== undefined && this.lastPaint?.editor === editor,
      sameRegion: this.activePreview?.editor === editor && this.activePreview.region.start === region.start,
    })) {
      // 这条公式已经有可见的上一帧，保留它。
      return;
    }
    if (this.failureTimer) clearTimeout(this.failureTimer);
    const noticeEpoch = this.epoch;
    const noticeVersion = editor.document.version;
    this.failureTimer = setTimeout(() => {
      this.failureTimer = undefined;
      if (editor !== vscode.window.activeTextEditor || noticeEpoch !== this.epoch || noticeVersion !== editor.document.version) return;
      this.applyFailureNotice(editor, region, metrics, message);
    }, FAILURE_NOTICE_MS);
    this.failureTimer.unref?.();
  }

  private trace(message: string): void {
    if (!this.settings.trace) return;
    this.output?.appendLine(`[${new Date().toISOString()}] ${message}`);
  }

  private clearFailureNotice(): void {
    if (!this.failureTimer) return;
    clearTimeout(this.failureTimer);
    this.failureTimer = undefined;
  }

  private applyFailureNotice(
    editor: vscode.TextEditor,
    region: MathRegion,
    metrics: EditorMetrics,
    message: string,
  ): void {
    this.sourceAnchors.clear();
    this.lastPaint = undefined;
    const startLine = editor.document.positionAt(region.start).line;
    const endLine = editor.document.positionAt(region.end).line;
    const visible = visibleLineSpan(editor);
    const placement = this.previewPlacement(editor, startLine, endLine, metrics.lineHeightPx, metrics);
    const anchor = resolvePreviewAnchor({
      formulaStartLine: startLine,
      formulaEndLine: endLine,
      visibleStartLine: visible.start,
      visibleEndLine: visible.end,
      placement,
    });
    const text = message.length > 120 ? `${message.slice(0, 119)}…` : message;
    const formulaStart = editor.document.positionAt(region.start);
    const formulaEnd = editor.document.positionAt(region.end);
    const columns = this.previewColumns(editor, formulaStart, formulaEnd, anchor.anchorLine);
    const noticeWidth = Math.min(720, Math.max(160, text.length * metrics.fontSizePx * 0.55));
    const horizontal = resolvePreviewHorizontalLayout({
      previewWidthPx: noticeWidth,
      previewHeightPx: metrics.lineHeightPx,
      startColumn: columns.start,
      endColumn: columns.end,
      fontSizePx: metrics.fontSizePx,
      viewportWidthPx: 0,
    });
    const notebook = isNotebookCellDocument(editor.document);
    const spacerPx = notebook && placement === 'below'
      ? notebookPreviewSpacerPx(horizontal.boxHeightPx, metrics.lineHeightPx)
      : 0;
    const layout = floatingPreviewLayout({
      widthPx: noticeWidth,
      heightPx: metrics.lineHeightPx,
      lineHeightPx: metrics.lineHeightPx,
      lineSpan: anchor.lineSpan,
      placement,
      theme: previewThemeVariant(),
      leftPx: horizontal.leftPx,
      boxWidthPx: horizontal.boxWidthPx,
      boxHeightPx: horizontal.boxHeightPx,
      overflowX: horizontal.overflowX,
      overflowY: horizontal.overflowY,
      viewportAnchor: VIEWPORT_ANCHOR,
      customCss: this.settings.previewCss,
      image: false,
    });
    const range = this.previewDecorationRange(editor, region, anchor.anchorLine);
    editor.setDecorations(this.decoration, [{
      range,
      renderOptions: {
        before: {
          contentText: `⚠ ${text}`,
          color: new vscode.ThemeColor('editorWarning.foreground'),
          backgroundColor: new vscode.ThemeColor('editorHoverWidget.background'),
          textDecoration: layout.textDecoration,
          width: layout.width,
          height: layout.height,
        },
        ...(spacerPx > 0
          ? {
            after: {
              contentText: '\u00a0',
              width: '0px',
              height: `${spacerPx}px`,
              margin: '0',
              textDecoration: notebookPreviewSpacerCss(spacerPx),
            },
          }
          : {}),
      },
    }]);
    // 这一帧不是正常预览，不写入 signature，成功渲染时必须能覆盖它。
    this.lastDecorationSignature = undefined;
    this.activePreview = { editor, region };
    this.setPreviewVisible(true);
  }

  /**
   * 快路径用的是上一份定义快照。稍后回头真正解析一次，指纹变了才重画，
   * 因此新写的宏、颜色和环境仍会自动出现，而按键路径始终不做全文解析。
   */
  private scheduleDefinitionRefresh(
    editor: vscode.TextEditor,
    usedFingerprint: string,
    delay = DEFINITION_REFRESH_MS,
  ): void {
    if (this.definitionRefreshTimer) clearTimeout(this.definitionRefreshTimer);
    const refreshEpoch = this.epoch;
    this.definitionRefreshTimer = setTimeout(() => {
      this.definitionRefreshTimer = undefined;
      if (editor !== vscode.window.activeTextEditor || refreshEpoch !== this.epoch) return;
      void this.definitions
        .getSnapshot(editor.document, editor.document.offsetAt(editor.selection.active))
        .then((fresh) => {
          if (fresh.fingerprint !== usedFingerprint && editor === vscode.window.activeTextEditor && refreshEpoch === this.epoch) {
            this.schedule(editor, 0);
          }
        })
        .catch(() => {
          // 定义暂时不可用时保持当前帧，不清屏。
        });
    }, delay);
    this.definitionRefreshTimer.unref?.();
  }

  private preferredFormulaOffset(editor: vscode.TextEditor): number {
    const document = editor.document;
    const active = document.offsetAt(editor.selection.active);
    const current = this.activePreview?.editor === editor ? this.activePreview.region : undefined;
    if (!current) return active;
    if (regionContainsOffset(current, active)) return active;
    const anchor = document.offsetAt(editor.selection.anchor);
    if (regionContainsOffset(current, anchor)) return anchor;
    const start = document.offsetAt(editor.selection.start);
    const end = document.offsetAt(editor.selection.end);
    if (selectionOverlapsRegion(start, end, current)) {
      return Math.min(Math.max(active, current.contentStart), Math.max(current.contentStart, current.contentEnd));
    }
    return active;
  }

  private locateFormula(
    editor: vscode.TextEditor,
    snapshot: PreviewDefinitionSnapshot,
    rememberMiss = true,
  ): { readonly offset: number; readonly region: MathRegion } | undefined {
    const document = editor.document;
    const seen = new Set<number>();
    const candidates = [
      document.offsetAt(editor.selection.active),
      this.preferredFormulaOffset(editor),
      document.offsetAt(editor.selection.anchor),
      document.offsetAt(editor.selection.start),
      document.offsetAt(editor.selection.end),
    ];
    for (const offset of candidates) {
      if (seen.has(offset)) continue;
      seen.add(offset);
      const region = this.findCurrentRegion(document, offset, snapshot, rememberMiss);
      if (region) return { offset, region };
    }
    return undefined;
  }

  private findCurrentRegion(
    document: vscode.TextDocument,
    offset: number,
    snapshot: PreviewDefinitionSnapshot,
    rememberMiss = true,
  ): MathRegion | undefined {
    const hit = this.lastRegionHit;
    if (
      hit
      && hit.uri === document.uri.toString()
      && hit.version === document.version
      && regionContainsOffset(hit.region, offset)
    ) {
      return hit.region;
    }
    const started = performance.now();
    const maxChars = this.settings.maxFormulaChars;
    let base = Math.max(0, offset - maxChars - 512);
    const baseLine = document.positionAt(base).line;
    base = document.offsetAt(document.lineAt(baseLine).range.start);
    const documentEnd = document.offsetAt(document.lineAt(document.lineCount - 1).range.end);
    const roughEnd = Math.min(documentEnd, offset + maxChars + 512);
    const endLine = document.lineAt(document.positionAt(roughEnd).line);
    const end = document.offsetAt(endLine.rangeIncludingLineBreak.end);
    const fragment = document.getText(new vscode.Range(document.positionAt(base), document.positionAt(end)));
    const result = scanMathRegions(
      fragment,
      this.mathScanOptions(document, snapshot.environments, baseLine),
    );
    const elapsed = performance.now() - started;
    this.scans += 1;
    this.scanSamples.push(elapsed);
    if (this.scanSamples.length > 128) this.scanSamples.shift();
    const local = findMathRegionAt(result.regions, offset - base);
    if (!local) {
      if (rememberMiss) this.lastRegionHit = undefined;
      return undefined;
    }
    const region: MathRegion = {
      ...local,
      start: local.start + base,
      end: local.end + base,
      contentStart: local.contentStart + base,
      contentEnd: local.contentEnd + base,
      ...(local.recovery ? { recovery: { ...local.recovery, boundary: local.recovery.boundary + base } } : {}),
    };
    this.lastRegionHit = { uri: document.uri.toString(), version: document.version, region };
    return region;
  }

  private mathScanOptions(
    document: vscode.TextDocument,
    customMathEnvironments: readonly string[],
    startLine: number,
  ): MathScanOptions {
    const documentLanguage = this.policy.previewLanguage(document) ?? 'latex';
    const initialFence = documentLanguage === 'markdown'
      ? this.markdownFenceStateAt(document, startLine)
      : undefined;
    return {
      language: documentLanguage,
      customMathEnvironments,
      ...(initialFence ? { markdownInitialFence: initialFence } : {}),
    };
  }

  private markdownFenceStateAt(
    document: vscode.TextDocument,
    line: number,
  ): MarkdownFenceState | undefined {
    const key = document.uri.toString();
    let cache = this.markdownFenceCaches.get(key);
    if (!cache || cache.version !== document.version) {
      cache = { version: document.version, states: [null] };
      this.markdownFenceCaches.set(key, cache);
    }
    while (cache.states.length <= line) {
      const sourceLine = cache.states.length - 1;
      const previous = cache.states[sourceLine] ?? undefined;
      const next = advanceMarkdownFenceState(previous, document.lineAt(sourceLine).text);
      cache.states.push(next ?? null);
    }
    return cache.states[line] ?? undefined;
  }

  private invalidateMarkdownFenceCache(event: vscode.TextDocumentChangeEvent): void {
    if (this.policy.previewLanguage(event.document) !== 'markdown') return;
    const key = event.document.uri.toString();
    const cache = this.markdownFenceCaches.get(key);
    if (!cache) return;
    const firstChangedLine = event.contentChanges.reduce(
      (minimum, change) => Math.min(minimum, change.range.start.line),
      Number.POSITIVE_INFINITY,
    );
    if (!Number.isFinite(firstChangedLine)) {
      this.markdownFenceCaches.delete(key);
      return;
    }
    cache.states.length = Math.min(cache.states.length, firstChangedLine + 1);
    cache.version = event.document.version;
  }

  /** 方向只看 previewPosition，默认 below。 */
  private previewPlacement(
    editor: vscode.TextEditor,
    startLine: number,
    endLine: number,
    previewHeightPx: number,
    metrics: EditorMetrics,
  ): PreviewPlacement {
    return resolvePreviewPlacement({
      preferred: this.settings.previewPosition,
      formulaStartLine: startLine,
      formulaEndLine: endLine,
      documentLineCount: editor.document.lineCount,
      previewHeightPx,
      lineHeightPx: metrics.lineHeightPx,
      clipOverflow: isNotebookCellDocument(editor.document),
    });
  }

  private applyDecoration(
    editor: vscode.TextEditor,
    region: MathRegion,
    rendered: CachedSvg,
    metrics: EditorMetrics,
    renderKey: string,
  ): void {
    const themeVariant = previewThemeVariant();
    const css = hasAdvancedPreviewCss(this.settings.previewCss)
      ? this.settings.previewCss : { ...this.settings.previewCss, allowOverlap: true };
    const nominalFont = this.lastTikzDocument === editor.document.uri.toString()
      ? 16 * this.settings.previewScale / 1.35
      : metrics.exPx * 2 * (isTablePreviewRegion(region) ? TABLE_PREVIEW_SCALE : 1);
    const fontScale = previewFontScale(css, nominalFont);
    const widthPx = rendered.widthPx * fontScale;
    const heightPx = rendered.heightPx * fontScale;
    const startLine = editor.document.positionAt(region.start).line;
    const endLine = editor.document.positionAt(region.end).line;
    const visible = visibleLineSpan(editor);
    if (endLine < visible.start || startLine > visible.end) {
      // 全部公式滚出视口时不能把锚点夹到无关源码行。保留上一帧供滚回时复用。
      this.sourceAnchors.clear(editor);
      editor.setDecorations(this.decoration, []);
      this.lastDecorationSignature = undefined;
      return;
    }
    const preferred = this.previewPlacement(editor, startLine, endLine, heightPx, metrics);
    const geometry = this.sourceAnchors.plan(editor, region, css, preferred);
    const placement = geometry?.placement ?? preferred;
    const anchor = resolvePreviewAnchor({
      formulaStartLine: startLine,
      formulaEndLine: endLine,
      visibleStartLine: visible.start,
      visibleEndLine: visible.end,
      placement,
    });
    const formulaStart = editor.document.positionAt(region.start);
    const formulaEnd = editor.document.positionAt(region.end);
    const columns = this.previewColumns(editor, formulaStart, formulaEnd, anchor.anchorLine);
    const visibleHeightPx = Math.max(1, visible.end - visible.start + 1) * metrics.lineHeightPx;
    const notebook = isNotebookCellDocument(editor.document);
    // notebook 格子会裁溢出。撑高当前行后预览整块留在格内，不要再按半格高度截断。
    const maxHeightPx = notebook
      ? 0
      : Math.max(metrics.lineHeightPx * 6, Math.round(visibleHeightPx * 0.5));
    const horizontal = resolvePreviewHorizontalLayout({
      previewWidthPx: widthPx,
      previewHeightPx: heightPx,
      startColumn: columns.start,
      endColumn: columns.end,
      fontSizePx: metrics.fontSizePx,
      // VS Code API 不暴露水平像素视口；限位交给 CSS anchor，不用 120 列假装窗口宽度。
      viewportWidthPx: 0,
      maxHeightPx,
    });
    const gapPx = (css.gap?.value ?? 0) * (css.gap?.unit === 'lh' ? metrics.lineHeightPx : 1);
    const outerHeight = horizontal.boxHeightPx + previewPanelInsets(css, themeVariant).vertical;
    const spacerPx = notebook && placement === 'below'
      ? notebookPreviewSpacerPx(outerHeight + gapPx + Math.max(0, css.offsetY), metrics.lineHeightPx)
      : 0;
    const signature = `${renderKey}|${region.start}|${region.end}|${anchor.anchorLine}|${formulaStart.character}|${horizontal.leftPx}|${horizontal.boxWidthPx}|${horizontal.boxHeightPx}|${themeVariant}|${placement}|s${spacerPx}|css${this.appearanceVersion}|${geometry?.signature ?? ''}`;
    if (signature === this.lastDecorationSignature && this.activePreview?.editor === editor) {
      // 内容和位置都没变，重设 decoration 只会让 VS Code 重新解码一次 SVG。
      return;
    }
    const layout = floatingPreviewLayout({
      widthPx,
      heightPx,
      lineHeightPx: metrics.lineHeightPx,
      lineSpan: anchor.lineSpan,
      placement,
      theme: themeVariant,
      leftPx: horizontal.leftPx,
      boxWidthPx: horizontal.boxWidthPx,
      boxHeightPx: horizontal.boxHeightPx,
      overflowX: horizontal.overflowX,
      overflowY: horizontal.overflowY,
      viewportAnchor: VIEWPORT_ANCHOR,
      customCss: css,
      ...(geometry ? { geometry: geometry.geometry, imageUri: rendered.uri.toString(true) } : {}),
    });
    this.sourceAnchors.show(editor, geometry, layout);
    const attachment: vscode.ThemableDecorationAttachmentRenderOptions = {
      contentIconPath: rendered.uri,
      width: layout.width,
      height: layout.height,
      margin: '0',
      color: new vscode.ThemeColor('editorHoverWidget.foreground'),
      backgroundColor: new vscode.ThemeColor('editorHoverWidget.background'),
      ...(themeVariant === 'high-contrast'
        ? {
          border: '2px solid',
          borderColor: new vscode.ThemeColor('contrastBorder'),
        }
        : {}),
      // 实际图片由 overflow-guard 覆盖层绘制，此附件只保留原生行占位兼容性。
      textDecoration: `${layout.textDecoration}; display: none !important`,
    };
    const range = geometry
      ? new vscode.Range(geometry.range.start, formulaEnd.isBeforeOrEqual(geometry.range.start) ? geometry.range.end : formulaEnd)
      : this.previewDecorationRange(editor, region, anchor.anchorLine);
    const spacer = spacerPx > 0
      ? {
        after: {
          contentText: '\u00a0',
          width: '0px',
          height: `${spacerPx}px`,
          margin: '0',
          textDecoration: notebookPreviewSpacerCss(spacerPx),
        },
      }
      : {};
    // 不挂 hoverMessage：鼠标扫过公式时不该弹出带关闭按钮的 hover 面板。
    editor.setDecorations(this.decoration, [{
      range,
      // 锚在视口内的公式行：首行滚出屏幕后 VS Code 不会再画那一行的 decoration。
      renderOptions: { before: attachment, ...spacer },
    }]);
    this.lastDecorationSignature = signature;
    this.lastPaint = {
      editor,
      region,
      rendered,
      metrics,
      renderKey,
    };
    this.activePreview = { editor, region };
    this.setPreviewVisible(true);
  }

  private previewDecorationRange(
    editor: vscode.TextEditor,
    region: MathRegion,
    anchorLine: number,
  ): vscode.Range {
    const formulaStart = editor.document.positionAt(region.start);
    const formulaEnd = editor.document.positionAt(region.end);
    const start = resolvePreviewRangeStart({
      formulaStartLine: formulaStart.line,
      formulaStartCharacter: formulaStart.character,
      anchorLine,
    });
    const rangeStart = new vscode.Position(start.line, start.character);
    if (formulaEnd.isBeforeOrEqual(rangeStart)) {
      return editor.document.lineAt(anchorLine).range;
    }
    return new vscode.Range(rangeStart, formulaEnd);
  }

  private previewColumns(
    editor: vscode.TextEditor,
    formulaStart: vscode.Position,
    formulaEnd: vscode.Position,
    anchorLine: number,
  ): { readonly start: number; readonly end: number } {
    const lineText = editor.document.lineAt(anchorLine).text;
    const tabSize = Number(editor.options.tabSize);
    if (formulaStart.line !== anchorLine) {
      return { start: 0, end: visibleColumnOf(lineText, lineText.length, tabSize) };
    }
    const start = visibleColumnOf(lineText, formulaStart.character, tabSize);
    const endCharacter = formulaEnd.line === anchorLine ? formulaEnd.character : lineText.length;
    const end = visibleColumnOf(lineText, endCharacter, tabSize);
    return { start, end: Math.max(start, end) };
  }

  private emitFrame(
    editor: vscode.TextEditor,
    region: MathRegion | undefined,
    frame: Omit<PreviewFrame, 'fileName' | 'line' | 'regionKind'>,
  ): void {
    const path = editor.document.uri.path;
    this.frameEmitter.fire({
      ...frame,
      fileName: path.slice(path.lastIndexOf('/') + 1),
      line: editor.selection.active.line + 1,
      ...(region ? { regionKind: region.environment ?? region.kind } : {}),
    });
  }

  private clearEditor(editor: vscode.TextEditor): void {
    if (this.lastTikzDocument === editor.document.uri.toString()) this.lastTikzDocument = undefined;
    this.frameEmitter.fire({ status: 'idle' });
    this.clearFailureNotice();
    editor.setDecorations(this.decoration, []);
    this.sourceAnchors.clear(editor);
    this.lastDecorationSignature = undefined;
    if (this.lastPaint?.editor === editor) this.lastPaint = undefined;
    if (this.lastRegionHit?.uri === editor.document.uri.toString()) this.lastRegionHit = undefined;
    if (this.activePreview?.editor === editor) {
      this.activePreview = undefined;
      this.setPreviewVisible(false);
    }
  }

  private setPreviewVisible(visible: boolean): void {
    if (this.previewVisible === visible) return;
    this.previewVisible = visible;
    void vscode.commands.executeCommand('setContext', `${COMMAND_NS}.previewVisible`, visible);
  }

  private clearAllVisible(): void {
    if (this.scheduleTimer) clearTimeout(this.scheduleTimer);
    this.scheduleTimer = undefined;
    this.pendingEditor = undefined;
    if (this.definitionRefreshTimer) clearTimeout(this.definitionRefreshTimer);
    this.definitionRefreshTimer = undefined;
    this.epoch += 1;
    this.tikz?.cancel();
    this.lastTikzDocument = undefined;
    this.clearFailureNotice();
    this.sourceAnchors.clear();
    for (const editor of vscode.window.visibleTextEditors) editor.setDecorations(this.decoration, []);
    this.lastDecorationSignature = undefined;
    this.lastPaint = undefined;
    this.lastRegionHit = undefined;
    this.activePreview = undefined;
    this.setPreviewVisible(false);
    this.frameEmitter.fire({ status: 'idle' });
  }
}
