import * as vscode from 'vscode';
import { COMMAND_NS, IS_TEST_CHANNEL } from '../core/channel';
import type { PreviewCss } from '../core/previewCss';
import { previewPanelInsets, type PreviewGeometry, type PreviewPlacement } from '../core/previewLayout';
import { previewCopyLabels } from './preview-copy-labels';

export interface ScrollPreviewFrame {
  readonly uri: vscode.Uri;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly focusX: number;
  readonly focusY: number;
  readonly lineHeightPx: number;
  readonly viewportAnchor: string;
  readonly css: PreviewCss;
  readonly geometry: PreviewGeometry;
  readonly placement: PreviewPlacement;
  readonly followCaret: boolean;
  readonly key: string;
}

const IMAGE = `${COMMAND_NS}-scroll-image`;
const TARGET = `${COMMAND_NS}-scroll-focus`;
const COPY_COMMAND = `${COMMAND_NS}._copyPreviewPng`;
const DOT = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz4=';
const number = (value: number) => Math.round(Math.max(0, value) * 100) / 100;

/** 原生 hover 提供鼠标事件、滚动模型和拖动条；CSS 只作用于本通道的图片。 */
export function scrollPreviewCss(frame: ScrollPreviewFrame): string {
  const image = `img[alt="${IMAGE}"]`;
  const target = `img[alt="${TARGET}"]`;
  // 显式 & 避免嵌套规则被当作源码 span 的后代；图片标记只匹配本通道。
  // 不要求空行上的零长度 inline decoration 生成 DOM。
  const owner = `.monaco-editor:where(:not(&)):has(${image})`;
  const hover = `${owner} .monaco-hover:has(${image})`;
  const content = `${hover} .monaco-hover-content`;
  const scroller = `${hover} > .monaco-scrollable-element`;
  const copy = `${hover} a[data-href^="command:${COPY_COMMAND}?"]`;
  const copyAnchor = `--${COMMAND_NS}-copy-hover`;
  const insets = previewPanelInsets(frame.css);
  const viewportWidth = `anchor-size(${frame.viewportAnchor} width, 100vw)`;
  const viewportHeight = `anchor-size(${frame.viewportAnchor} height, 100vh)`;
  const customWidth = frame.css.maxWidth?.endsWith('%')
    ? `calc(${viewportWidth} * ${parseFloat(frame.css.maxWidth) / 100})` : frame.css.maxWidth ?? '960px';
  const maxWidth = `max(1px, min(${number(frame.widthPx + insets.horizontal)}px, ${customWidth}, calc(${viewportWidth} - 24px)))`;
  // 上下至少有一侧容得下半个视口减去编辑行；不依赖 EOF 的可见源码行数。
  const maxHeight = `max(1px, min(${number(frame.heightPx + insets.vertical)}px, ${frame.css.maxHeight ?? 500}px, calc((${viewportHeight} - ${number(frame.lineHeightPx * 2 + 32)}px) / 2)))`;
  const padding = frame.css.padding?.map(value => `${value}px`).join(' ') ?? '4px 8px';
  const appearance = frame.css.declarations.split(';').filter(part => !part.trim().startsWith('padding:')).join(';');
  const anchor = (name: string, edge: string) => `anchor(${name} ${edge}, 0px)`;
  const viewport = (edge: string) => anchor(frame.viewportAnchor, edge);
  const editing = frame.geometry.editing ?? frame.geometry.start;
  const gap = Math.max(frame.lineHeightPx * 0.5, (frame.css.gap?.value ?? 2) * (frame.css.gap?.unit === 'lh' ? frame.lineHeightPx : 1));
  const guard = number(gap + insets.vertical);
  const above = frame.placement === 'above';
  const right = frame.placement === 'right' && !frame.followCaret;
  const nativePlacement = frame.followCaret || (frame.placement === 'below' && frame.css.anchor === undefined && frame.css.placement === undefined
    && frame.css.gap === undefined && frame.css.allowOverlap === undefined && frame.css.offsetX === 0 && frame.css.offsetY === 0);
  const reference = frame.followCaret ? editing : above ? frame.geometry.start : frame.geometry.end;
  const source = above ? frame.geometry.sourceStart : frame.geometry.sourceEnd;
  const edge = above ? 'top' : 'bottom';
  const near = `max(calc(${anchor(editing, edge)} + ${guard}px), calc(${anchor(reference, edge)} + ${number(gap + Math.max(0, frame.css.offsetY * (above ? -1 : 1)))}px)${frame.css.allowOverlap === false && !frame.followCaret ? `, calc(${anchor(source, edge)} + ${guard}px)` : ''})`;
  const far = `calc(${viewport(edge)} + 4px)`;
  const rightEdges = [...frame.geometry.right, ...(frame.css.allowOverlap === false ? frame.geometry.sourceRight : [])];
  const left = right
    ? `max(calc(${viewport('left')} + 4px), calc(${anchor(editing, 'right')} + ${guard}px), calc(${anchor(frame.geometry.end, 'right')} + ${gap + frame.css.offsetX}px)${rightEdges.map(name => `, calc(${anchor(name, 'right')} + ${gap + Math.max(0, frame.css.offsetX)}px)`).join('')})`
    : `clamp(calc(${viewport('left')} + 4px), calc(${anchor(frame.geometry.start, 'left')} + ${frame.css.offsetX}px), calc(${viewport('right')} - var(--silk-hover-width) - 4px))`;
  return `none;
    ${owner} > .overflow-guard > .monaco-scrollable-element {
      anchor-name: --silkMath-preview-viewport, --silkMathTest-preview-viewport;
    }
    ${owner} .monaco-resizable-hover:has(${image}) {
      border: 0 !important; border-radius: 6px; background: transparent !important; box-shadow: none !important;
      position-anchor: ${frame.viewportAnchor};
      --silk-hover-width: ${maxWidth};
      ${nativePlacement ? `width: var(--silk-hover-width) !important; height: ${maxHeight} !important;` : `position: fixed !important;
      left: ${left} !important; right: calc(${viewport('right')} + 4px) !important;
      top: ${right ? `clamp(calc(${viewport('top')} + 4px), ${anchor(editing, 'top')}, calc(${viewport('bottom')} - ${maxHeight} - 4px))` : above ? `calc(${viewport('top')} + 4px)` : near} !important;
      bottom: ${right ? `calc(${viewport('bottom')} + 4px)` : above ? near : far} !important;
      width: ${right ? 'auto' : 'var(--silk-hover-width)'} !important; height: auto !important;
      margin: 0; ${above ? 'margin-top' : 'margin-bottom'}: auto;`}
      min-width: 0 !important; min-height: 0 !important;
      max-width: ${maxWidth} !important; max-height: ${maxHeight} !important;
    }
    /* 普通按键会让宿主同时设置 root display:none / visibility:hidden 和 hover.hidden。
       保留当前图片直到下一帧；失焦或移除本帧样式后仍遵从宿主隐藏，不影响其他 hover。 */
    ${owner}:focus-within .monaco-resizable-hover:has(${image}),
    ${owner}:focus-within .monaco-hover:has(${image}) {
      display: block !important; visibility: visible !important;
    }
    ${hover}, ${scroller}, ${content} { min-width: 0 !important; min-height: 0 !important;
      width: 100% !important; height: 100% !important; max-width: 100% !important; max-height: 100% !important; box-sizing: border-box; }
    ${hover} { anchor-name: ${copyAnchor}; border: 0; border-radius: 6px; padding: 0 !important;
      background: var(--vscode-editorHoverWidget-background); color: var(--vscode-editorHoverWidget-foreground);
      box-shadow: 0 4px 18px rgba(0,0,0,.22); outline: 1px solid var(--vscode-contrastBorder, transparent);
      outline-offset: -1px; opacity: .98; animation: none !important; ${appearance}; }
    ${content} { box-sizing: border-box; padding: ${padding} !important;
      scroll-snap-type: var(--silk-scroll-snap, none); scroll-behavior: auto; overflow-anchor: none;
      overscroll-behavior: contain; transition: scroll-snap-type 1ms allow-discrete 80ms;
      @starting-style { scroll-snap-type: both mandatory; }
    }
    ${hover} .hover-row:has(${image}), ${hover} .markdown-hover:has(${image}),
    ${hover} .hover-contents:has(${image}), ${hover} p:has(${image}) {
      margin: 0 !important; padding: 0 !important; border: 0 !important; overflow: visible !important;
    }
    ${hover} p:has(${image}) { font-size: 0 !important; line-height: 0 !important; }
    ${hover} .hover-row:not(:has(${image})) { display: none !important; }
    ${hover} .hover-copy-button { display: none !important; }
    ${copy} { position: fixed !important; position-anchor: ${copyAnchor};
      top: calc(anchor(${copyAnchor} top) + 4px); left: calc(anchor(${copyAnchor} right) - 34px);
      width: 26px; height: 26px; display: flex !important; align-items: center; justify-content: center;
      z-index: 5; border-radius: 4px; color: var(--vscode-editorHoverWidget-foreground) !important;
      background: var(--vscode-editorHoverWidget-background); opacity: .75; text-decoration: none !important;
      cursor: pointer; font-size: 16px !important; line-height: 1 !important; --silk-copy-done: 0;
      transition: opacity 160ms ease, background-color 160ms ease; }
    ${copy}:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground); }
    ${copy}:focus-visible { opacity: 1; outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
    ${copy} .codicon { font-size: 16px !important; opacity: calc(1 - var(--silk-copy-done));
      transform: scale(calc(1 - var(--silk-copy-done) * .35)) rotate(calc(var(--silk-copy-done) * -20deg));
      transition: opacity 160ms ease, transform 220ms cubic-bezier(.2,.8,.2,1); }
    ${copy}::after { content: ''; position: absolute; left: 9px; top: 5px; width: 6px; height: 11px;
      border: solid var(--vscode-testing-iconPassed, #73c991); border-width: 0 2px 2px 0;
      opacity: var(--silk-copy-done); transform: rotate(45deg) scale(calc(.65 + var(--silk-copy-done) * .35));
      transition: opacity 180ms ease, transform 240ms cubic-bezier(.16,1,.3,1); pointer-events: none; }
    @media (prefers-reduced-motion: reduce) { ${copy}, ${copy} .codicon, ${copy}::after { transition: none !important; } }
    ${hover} .rendered-markdown:has(${image}) {
      position: relative; width: ${number(frame.widthPx)}px; height: ${number(frame.heightPx)}px;
      margin: 0 !important; padding: 0 !important; overflow: visible !important;
    }
    ${owner} ${image} { display: block !important; width: ${number(frame.widthPx)}px !important;
      height: ${number(frame.heightPx)}px !important; max-width: none !important; max-height: none !important;
      background-image: url('${frame.uri.toString(true)}'); background-size: 100% 100%; background-repeat: no-repeat;
      margin: 0 !important; padding: 0 !important; pointer-events: none; user-select: none; }
    ${owner} ${target} { position: absolute !important; display: block !important;
      left: ${number(Math.min(frame.widthPx - 1, frame.widthPx * frame.focusX))}px;
      top: ${number(Math.min(frame.heightPx - 1, frame.heightPx * frame.focusY))}px;
      width: 1px !important; height: 1px !important; margin: 0 !important; padding: 0 !important;
      opacity: 0; pointer-events: none; scroll-snap-align: center; }
    ${scroller} > .scrollbar.vertical { width: 8px !important; }
    ${scroller} > .scrollbar.horizontal { height: 8px !important; }
    ${scroller} > .scrollbar > .slider { border-radius: 4px; background: var(--vscode-scrollbarSlider-background) !important; }
    ${scroller} > .scrollbar.vertical > .slider { width: 5px !important; left: 1px !important; }
    ${scroller} > .scrollbar.horizontal > .slider { height: 5px !important; top: 1px !important; }
    ${scroller} > .scrollbar:hover > .slider { background: var(--vscode-scrollbarSlider-hoverBackground) !important; }
    ${scroller} > .scrollbar > .slider:active { background: var(--vscode-scrollbarSlider-activeBackground) !important; }
  `;
}

interface CurrentFrame {
  readonly editor: vscode.TextEditor;
  readonly position: vscode.Position;
  readonly range: vscode.Range;
  readonly version: number;
  readonly key: string;
  readonly copyId: number;
  readonly markdown: vscode.MarkdownString;
  readonly frame: ScrollPreviewFrame;
  readonly failed: (error: unknown) => void;
}

/** VS Code 每个编辑器只有一个原生 hover；两个通道共享调度，避免互相关闭和重复图片。 */
class HoverCoordinator {
  readonly owners = new Set<ScrollablePreview>();
  selected: ScrollablePreview | undefined;
  private shownKey: string | undefined;
  private shownEditor: vscode.TextEditor | undefined;
  private revision = 0;
  private queue = Promise.resolve();
  private ownedEditor: vscode.TextEditor | undefined;
  private dismissed: { editor: vscode.TextEditor; version: number; position: vscode.Position } | undefined;

  dismiss(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor) this.dismissed = { editor, version: editor.document.version, position: editor.selection.active };
    this.update();
  }

  resume(): void { this.dismissed = undefined; }

  update(): void {
    const active = vscode.window.activeTextEditor;
    if (this.dismissed && (active !== this.dismissed.editor || active.document.version !== this.dismissed.version
      || !active.selection.active.isEqual(this.dismissed.position))) this.dismissed = undefined;
    const eligible = [...this.owners].filter(owner => owner.current && owner.current.editor === active
      && this.dismissed?.editor !== active);
    const selected = eligible.find(owner => owner.testChannel) ?? eligible[0];
    const current = selected?.current;
    if (selected === this.selected && current?.key === this.shownKey && current?.editor === this.shownEditor) return;
    const continuing = selected !== undefined && selected === this.selected && current?.editor === this.shownEditor;
    const hidden = continuing ? undefined : this.selected?.hideNow();
    this.selected = selected;
    this.shownKey = current?.key;
    this.shownEditor = current?.editor;
    const revision = ++this.revision;
    selected?.paint();
    this.queue = this.queue.then(async () => {
      if (revision !== this.revision) return;
      if (!continuing && this.ownedEditor && this.ownedEditor === vscode.window.activeTextEditor) {
        await vscode.commands.executeCommand('editor.action.hideHover');
        this.ownedEditor = undefined;
      }
      if (!current && revision === this.revision) this.ownedEditor = undefined;
      if (!current || revision !== this.revision || current.editor !== vscode.window.activeTextEditor) return;
      this.ownedEditor = current.editor;
      await vscode.commands.executeCommand('editor.action.showHover', { focus: 'noAutoFocus' });
    }).catch(error => { if (revision === this.revision) current?.failed(error); })
      .finally(() => hidden?.dispose());
  }
}

const COORDINATOR = Symbol.for('silkmath.preview.hover-coordinator.v1');
function coordinator(): HoverCoordinator {
  const shared = globalThis as typeof globalThis & { [COORDINATOR]?: HoverCoordinator };
  return shared[COORDINATOR] ??= new HoverCoordinator();
}

/** 不使用 Webview 或工作台脚本；只通过公开 Hover API 显示可交互浮层。 */
export class ScrollablePreview implements vscode.Disposable {
  readonly testChannel = IS_TEST_CHANNEL;
  current: CurrentFrame | undefined;
  private style: vscode.TextEditorDecorationType | undefined;
  private focusStyle: vscode.TextEditorDecorationType | undefined;
  private focusTimer: ReturnType<typeof setTimeout> | undefined;
  private painted: CurrentFrame | undefined;
  private copyId = 0;
  private copyTask: Promise<void> | undefined;
  private copyFeedbackStyle: vscode.TextEditorDecorationType | undefined;
  private copyFeedbackTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly copyAbort = new AbortController();
  private readonly copyCommand = vscode.commands.registerCommand(COPY_COMMAND, (id: unknown) => {
    const current = this.current;
    if (!current || id !== current.copyId || this.copyTask || this.copyAbort.signal.aborted
      || this.broker.selected !== this || current.editor !== vscode.window.activeTextEditor
      || current.editor.document.version !== current.version || !current.position.isEqual(current.editor.selection.active)) return;
    // 点击时固定这帧；后台生成并写入剪贴板，成功后才在当前按钮显示勾。
    this.clearCopyFeedback();
    const { copyPreviewPng } = require('./preview-copy') as typeof import('./preview-copy');
    this.copyTask = copyPreviewPng(current.frame, this.copyAbort.signal)
      .then(() => {
        if (this.copyAbort.signal.aborted || this.current?.key !== current.key || this.broker.selected !== this
          || current.editor !== vscode.window.activeTextEditor || current.editor.document.version !== current.version
          || !current.position.isEqual(current.editor.selection.active)) return;
        const selector = `.monaco-editor:where(:not(&)) .monaco-hover:has(img[alt="${IMAGE}"]) a[data-href^="command:${COPY_COMMAND}?"]`;
        this.copyFeedbackStyle = vscode.window.createTextEditorDecorationType({ textDecoration: `none; ${selector} { --silk-copy-done: 1 !important; opacity: 1 !important; }` });
        current.editor.setDecorations(this.copyFeedbackStyle, [current.range]);
        this.copyFeedbackTimer = setTimeout(() => this.clearCopyFeedback(), 1600);
        vscode.window.setStatusBarMessage(previewCopyLabels(vscode.env.language)[2], 1600);
      })
      .catch((error: unknown) => {
        if (!this.copyAbort.signal.aborted) void vscode.window.showErrorMessage(error instanceof Error && error.message === 'clipboard-unavailable'
          ? `${previewCopyLabels(vscode.env.language)[4]} (Linux: wl-copy / xclip)` : previewCopyLabels(vscode.env.language)[4]);
      })
      .finally(() => { this.copyTask = undefined; });
    return this.copyTask;
  });
  private readonly broker = coordinator();
  private readonly provider = vscode.languages.registerHoverProvider('*', {
    provideHover: (document, position, token) => {
      const current = this.current;
      if (!current || this.broker.selected !== this || token.isCancellationRequested
        || current.editor !== vscode.window.activeTextEditor || document !== current.editor.document
        || document.version !== current.version || !position.isEqual(current.position)) return undefined;
      return new vscode.Hover(current.markdown, new vscode.Range(position, position));
    },
  });

  constructor() { this.broker.owners.add(this); }

  private clearCopyFeedback(): void {
    if (this.copyFeedbackTimer) clearTimeout(this.copyFeedbackTimer);
    this.copyFeedbackTimer = undefined;
    this.copyFeedbackStyle?.dispose();
    this.copyFeedbackStyle = undefined;
  }

  show(editor: vscode.TextEditor, range: vscode.Range, frame: ScrollPreviewFrame, failed: (error: unknown) => void): void {
    const position = editor.selection.active;
    const key = `${frame.key}|${editor.document.version}|${position.line}:${position.character}`;
    if (this.current?.editor === editor && this.current.key === key) {
      this.broker.update();
      return;
    }
    this.clearCopyFeedback();
    // 宿主会把 Markdown 截到 100000 字符，大 SVG 的 data URI 会丢失闭合部分。
    // 用透明图片承载滚动尺寸，完整 SVG 放进样式；无需临时文件或额外 I/O。
    // 连续刷新保留原生 DOM，按钮也可能仍是上一帧的节点；同一浮层沿用票据，
    // 点击读取已显示的最新帧。关闭或切换公式后重新编号，旧浮层的按钮仍失效。
    const copyId = this.current?.editor === editor ? this.current.copyId : ++this.copyId;
    const link = `command:${COPY_COMMAND}?${encodeURIComponent(JSON.stringify([copyId]))}`;
    const markdown = new vscode.MarkdownString(`![${IMAGE}](${DOT}) ![${TARGET}](${DOT}) [$(copy)](${link} "${previewCopyLabels(vscode.env.language)[0]}")`, true);
    markdown.isTrusted = { enabledCommands: [COPY_COMMAND] };
    this.current = { editor, position, range, version: editor.document.version, key, copyId, markdown, frame, failed };
    this.broker.update();
  }

  paint(): void {
    const current = this.current;
    if (!current) return;
    // 先挂新样式再撤旧样式，跨 Extension Host 消息也没有无图/默认尺寸的间隙。
    const next = vscode.window.createTextEditorDecorationType({ textDecoration: scrollPreviewCss(current.frame) });
    try { current.editor.setDecorations(next, [current.range]); }
    catch (error) { next.dispose(); throw error; }
    const previous = this.style;
    this.style = next;
    previous?.dispose();
    this.painted = current;
    // 已显示的滚动容器不必重建来触发 @starting-style；只短暂定位新光标，
    // 随后解除吸附，用户手动滚动不会被拉回。图片样式不会随定时器重建。
    this.clearFocus();
    this.focusStyle = vscode.window.createTextEditorDecorationType({
      textDecoration: `none; .monaco-editor:where(:not(&)) .monaco-hover:has(img[alt="${IMAGE}"]) .monaco-hover-content { --silk-scroll-snap: both mandatory; transition: none !important; }`,
    });
    current.editor.setDecorations(this.focusStyle, [current.range]);
    this.focusTimer = setTimeout(() => this.clearFocus(), 80);
  }

  private clearFocus(): void {
    if (this.focusTimer) clearTimeout(this.focusTimer);
    this.focusTimer = undefined;
    this.focusStyle?.dispose();
    this.focusStyle = undefined;
  }

  hideNow(): vscode.Disposable | undefined {
    this.clearCopyFeedback();
    this.clearFocus();
    this.style?.dispose();
    this.style = undefined;
    const painted = this.painted;
    this.painted = undefined;
    if (!painted) return undefined;
    const hidden = vscode.window.createTextEditorDecorationType({
      textDecoration: `none; .monaco-editor:where(:not(&)) .monaco-hover:has(img[alt="${IMAGE}"]) { visibility: hidden !important; }`,
    });
    painted.editor.setDecorations(hidden, [painted.range]);
    return hidden;
  }

  clear(editor?: vscode.TextEditor): void {
    if (!this.current || (editor && editor !== this.current.editor)) return;
    this.current = undefined;
    this.broker.update();
  }

  /** Esc 关闭共享浮层，并挡住另一通道同一编辑位置的迟到结果。 */
  dismiss(): void { this.broker.dismiss(); }
  resume(): void { this.broker.resume(); }

  dispose(): void {
    this.clearCopyFeedback();
    this.copyAbort.abort();
    this.copyCommand.dispose();
    this.clear();
    this.provider.dispose();
    this.broker.owners.delete(this);
    if (this.broker.owners.size === 0) this.broker.resume();
    this.clearFocus();
    this.style?.dispose();
  }
}
