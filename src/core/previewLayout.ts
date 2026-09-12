import type { PreviewCss } from './previewCss';

export type PreviewPlacement = 'below' | 'above' | 'right';
export type PreviewThemeVariant = 'light' | 'dark' | 'high-contrast';

export interface FloatingPreviewLayout {
  readonly placement: PreviewPlacement;
  readonly width: string;
  readonly height: string;
  readonly textDecoration: string;
}

export interface EditorMetrics {
  readonly fontSizePx: number;
  readonly lineHeightPx: number;
  /** MathJax 的 1ex 折算成的 CSS 像素。 */
  readonly exPx: number;
}

export interface PreviewAnchorInput {
  readonly formulaStartLine: number;
  readonly formulaEndLine: number;
  readonly visibleStartLine: number;
  readonly visibleEndLine: number;
  readonly placement?: unknown;
}

export interface PreviewAnchor {
  /** decoration 的 `before` 挂在这一行；必须在视口内，否则浮层会被虚拟化掉。 */
  readonly anchorLine: number;
  readonly lineSpan: number;
}

/**
 * 浮层必须锚在当前视口里的公式行上。VS Code 不会给滚出屏幕的行创建
 * decoration DOM，绝对定位再准也会整块消失。
 * 锚在可见重叠的最后一行（above 则第一行），只需跨过这一行本身。
 */
export function resolvePreviewAnchor(input: PreviewAnchorInput): PreviewAnchor {
  const formulaStart = Math.max(0, Math.round(finite(input.formulaStartLine, 0)));
  const formulaEnd = Math.max(formulaStart, Math.round(finite(input.formulaEndLine, formulaStart)));
  const visibleStart = Math.round(finite(input.visibleStartLine, formulaStart));
  const visibleEnd = Math.max(visibleStart, Math.round(finite(input.visibleEndLine, visibleStart)));
  const placement = normalizePreviewPlacement(input.placement);
  const overlapStart = Math.max(formulaStart, visibleStart);
  const overlapEnd = Math.min(formulaEnd, visibleEnd);
  if (overlapStart <= overlapEnd) {
    return {
      anchorLine: placement === 'above' ? overlapStart : overlapEnd,
      lineSpan: 1,
    };
  }
  return {
    anchorLine: placement === 'above' ? formulaStart : formulaEnd,
    lineSpan: 1,
  };
}

/** decoration 的 `before` 必须挂在公式起点，不能挂在行首，否则预览会从行左边开始。 */
export function resolvePreviewRangeStart(input: PreviewRangeStartInput): { readonly line: number; readonly character: number } {
  const line = Math.max(0, Math.round(finite(input.anchorLine, 0)));
  const formulaLine = Math.max(0, Math.round(finite(input.formulaStartLine, 0)));
  const character = formulaLine === line
    ? Math.max(0, Math.round(finite(input.formulaStartCharacter, 0)))
    : 0;
  return { line, character };
}

export function visibleColumnOf(text: string, character: number, tabSize: number): number {
  const size = Math.min(8, Math.max(1, Math.round(finite(tabSize, 4))));
  const limit = Math.min(Math.max(0, Math.round(character)), text.length);
  let column = 0;
  for (let index = 0; index < limit; index += 1) {
    if (text[index] === '\t') column += size - (column % size);
    else column += 1;
  }
  return column;
}

/**
 * 预览画在公式正下方、以公式水平中心为准向两侧变宽。
 * `left` 相对行首：Monaco 里 decoration 的 `position:absolute` 包含块是整行，
 * 不是公式 span，所以不能再写 left:0 指望从公式起点起排。
 * 超出视口宽/高时缩小盒子并允许滚动。
 */
export function resolvePreviewHorizontalLayout(input: PreviewHorizontalInput): PreviewHorizontalLayout {
  const previewW = Math.max(1, finite(input.previewWidthPx, 1));
  const previewH = Math.max(1, finite(input.previewHeightPx, 1));
  const font = clamp(finite(input.fontSizePx, DEFAULT_FONT_SIZE), MINIMUM_FONT_SIZE, MAXIMUM_FONT_SIZE);
  const charPx = font * MONO_CHAR_WIDTH_RATIO;
  const startPx = Math.max(0, finite(input.startColumn, 0) * charPx);
  const endPx = Math.max(startPx, finite(input.endColumn, input.startColumn) * charPx);
  const centerPx = (startPx + endPx) / 2;
  const viewportW = finite(input.viewportWidthPx, 0);
  const maxH = finite(input.maxHeightPx, 0);

  let boxW = previewW;
  let overflowX: 'visible' | 'auto' = 'visible';
  let left = centerPx - previewW / 2;
  if (viewportW > 0) {
    if (previewW >= viewportW) {
      boxW = viewportW;
      left = 0;
      overflowX = 'auto';
    } else {
      if (left < 0) left = 0;
      if (left + previewW > viewportW) left = viewportW - previewW;
    }
  } else if (left < 0) {
    left = 0;
  }

  let boxH = previewH;
  let overflowY: 'hidden' | 'auto' = 'hidden';
  if (maxH > 0 && previewH > maxH) {
    boxH = maxH;
    overflowY = 'auto';
  }

  return {
    leftPx: roundPx(left),
    boxWidthPx: roundPx(boxW),
    boxHeightPx: roundPx(boxH),
    overflowX,
    overflowY,
  };
}

export interface PreviewPlacementFitInput {
  readonly preferred?: unknown;
  readonly formulaStartLine: number;
  readonly formulaEndLine: number;
  readonly documentLineCount: number;
  readonly previewHeightPx: number;
  readonly lineHeightPx: number;
  /**
   * Jupyter 等单元格会裁掉溢出的 decoration。普通编辑器一般不会，
   * 这时尊重用户的 above/below 设置。
   */
  readonly clipOverflow?: boolean;
}

export interface FloatingPreviewInput {
  /** SVG 的真实像素宽度；必须与写进 SVG 根节点的宽度完全一致。 */
  readonly widthPx: number;
  readonly heightPx: number;
  readonly lineHeightPx: number;
  /** 公式在源码里占用的行数；浮层锚在首行，向下时要跨过全部行。 */
  readonly lineSpan: number;
  readonly placement?: unknown;
  readonly theme?: PreviewThemeVariant;
  /** 相对行首的水平偏移。预览以公式中心居中。 */
  readonly leftPx?: number;
  /** 可视盒子宽度。比 SVG 窄时加横向滚动。 */
  readonly boxWidthPx?: number;
  /** 可视盒子高度。比 SVG 矮时加纵向滚动。 */
  readonly boxHeightPx?: number;
  readonly overflowX?: 'visible' | 'auto';
  readonly overflowY?: 'hidden' | 'auto';
  /** 当前 Monaco 内容视口的 CSS anchor；像素估计不能代表分屏宽度。 */
  readonly viewportAnchor?: string;
  readonly customCss?: PreviewCss;
  readonly image?: boolean;
  readonly geometry?: PreviewGeometry;
  readonly imageUri?: string;
}

/** 所有位置均来自当前编辑器的源码字形 anchor；回退只用于尚未生成字形的瞬间。 */
export interface PreviewGeometry {
  readonly start: string;
  readonly end: string;
  readonly right: readonly string[];
  readonly sourceStart: string;
  readonly sourceEnd: string;
  readonly sourceRight: readonly string[];
  readonly editing?: string;
  readonly caretAtEnd?: boolean;
}

export function hasAdvancedPreviewCss(css: PreviewCss): boolean {
  return css.anchor !== undefined || css.placement !== undefined || css.gap !== undefined || css.allowOverlap !== undefined;
}

/** 字号缩放的是矢量图片，编辑器行高保持不变；百分比相对菜单缩放后的原预览。 */
export function previewFontScale(css: PreviewCss, nominalFontPx: number): number {
  return !css.fontSize ? 1 : css.fontSize.unit === '%' ? css.fontSize.value / 100 : css.fontSize.value / Math.max(1, nominalFontPx);
}

/** 嵌套选择器只为含有本扩展 decoration 的内容视口命名，不改变工作台布局。 */
export function previewViewportAnchorCss(): string {
  // anchor-name 是列表型覆盖属性。两通道并存时都声明相同的完整列表，避免互相抹掉名字。
  return 'none; .monaco-editor > .overflow-guard > .monaco-scrollable-element:has(:is(&)) { anchor-name: --silkMath-preview-viewport, --silkMathTest-preview-viewport; }';
}

/**
 * 浮层必须在源码之后：正式版使用 overflow-guard::after，测试版使用
 * 外层 monaco-editor::after。两处独立，且正文和视口均先完成布局。
 * overflow-guard::before 排在绝对定位的视口之前，无法引用其中的 anchor。
 * 源码行内的伪元素不能引用祖先包含块或后续绝对定位行。
 */
export function previewOverlayCss(layout: FloatingPreviewLayout, testChannel = false): string {
  const host = testChannel
    ? '.monaco-editor:has(> .overflow-guard :is(&))'
    : '.monaco-editor > .overflow-guard:has(:is(&))';
  return `${previewViewportAnchorCss()}; ${host}::after { text-decoration: ${layout.textDecoration}; width: ${layout.width}; height: ${layout.height}; margin: 0; color: var(--vscode-editorHoverWidget-foreground); background-color: var(--vscode-editorHoverWidget-background); }`;
}

export interface PreviewHorizontalInput {
  readonly previewWidthPx: number;
  readonly previewHeightPx?: number;
  /** 公式起点的可见列（已展开 tab）。 */
  readonly startColumn: number;
  /** 公式终点的可见列；与起点一起决定水平中心。 */
  readonly endColumn?: number;
  readonly fontSizePx: number;
  /** 编辑器内容区大约宽度；未知时传 0，只按公式中心排、不裁切。 */
  readonly viewportWidthPx: number;
  /** 浮层最大高度；超出则纵向滚动。 */
  readonly maxHeightPx?: number;
}

export interface PreviewHorizontalLayout {
  readonly leftPx: number;
  readonly boxWidthPx: number;
  readonly boxHeightPx: number;
  readonly overflowX: 'visible' | 'auto';
  readonly overflowY: 'hidden' | 'auto';
}

export interface PreviewRangeStartInput {
  readonly formulaStartLine: number;
  readonly formulaStartCharacter: number;
  readonly anchorLine: number;
}

/** 等宽字体大约 0.6×字号，用来把列号换成像素。 */
export const MONO_CHAR_WIDTH_RATIO = 0.6;

/** MathJax 输出按 em=16 / ex=8 计算，因此 1ex 恒为半个字号。 */
export const EX_PER_FONT_SIZE = 0.5;

/**
 * 与 VS Code `BareFontInfo` 的行高推导保持一致：0 表示按字号比例自动计算，
 * 小于 8 的值是字号倍数，其余按像素处理。浮层落点依赖真实行网格，不能猜。
 */
const GOLDEN_LINE_HEIGHT_RATIO_MAC = 1.5;
const GOLDEN_LINE_HEIGHT_RATIO = 1.35;
const MINIMUM_LINE_HEIGHT = 8;
const MAXIMUM_LINE_HEIGHT = 150;
const MINIMUM_FONT_SIZE = 6;
const MAXIMUM_FONT_SIZE = 100;
const DEFAULT_FONT_SIZE = 14;

/** 浮层与公式之间的空隙，只留一点视觉分隔。 */
const PANEL_GAP_PX = 2;
/** 留出少量呼吸空间；计入外框尺寸，不挤占公式本身。 */
const PANEL_PADDING = '4px 8px';
const PANEL_RADIUS = '6px';

export function previewPanelInsets(css?: PreviewCss, theme: PreviewThemeVariant = 'dark'): { horizontal: number; vertical: number } {
  const [top = 4, right = top, bottom = top, left = right] = css?.padding ?? [4, 8];
  const border = css?.borderWidth ?? (theme === 'high-contrast' ? 2 : 0);
  return { horizontal: left + right + 2 * border, vertical: top + bottom + 2 * border };
}
/**
 * Jupyter 格子会裁掉溢出的绝对定位 decoration，下一格还会盖住。
 * 在锚点行用 `after` 把行盒撑高，预览仍在公式下方，但整块留在当前格里。
 * after 的高度是行盒高度（max(原文, after)），所以必须把原文行高也算进去。
 */
const NOTEBOOK_SPACER_PAD_PX = 8;

export function notebookPreviewSpacerPx(previewHeightPx: number, lineHeightPx: number): number {
  const preview = Math.max(1, finite(previewHeightPx, 1));
  const lineHeight = clamp(finite(lineHeightPx, MINIMUM_LINE_HEIGHT), MINIMUM_LINE_HEIGHT, MAXIMUM_LINE_HEIGHT);
  return Math.round(lineHeight + PANEL_GAP_PX + preview + NOTEBOOK_SPACER_PAD_PX);
}

export function notebookPreviewSpacerCss(heightPx: number): string {
  const height = Math.max(1, Math.round(finite(heightPx, 1)));
  return [
    'display: inline-block',
    'width: 0',
    `height: ${height}px`,
    'overflow: hidden',
    'pointer-events: none',
    'vertical-align: top',
    'visibility: hidden',
    'line-height: 1',
    'font-size: 1px',
  ].join('; ');
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundPx(value: number): number {
  return Math.round(value * 100) / 100;
}

function panelShadow(theme: PreviewThemeVariant): string {
  if (theme === 'light') {
    return '0 6px 18px rgba(15, 23, 42, 0.22), 0 2px 6px rgba(15, 23, 42, 0.14)';
  }
  if (theme === 'high-contrast') return 'none';
  return '0 10px 28px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.36)';
}

/** 旧版 after/before 设置自动迁移为不参与行内排版的 below/above 浮层。 */
export function normalizePreviewPlacement(value: unknown): PreviewPlacement {
  return value === 'above' || value === 'before' ? 'above' : 'below';
}

/**
 * 预览方向只看用户设置。默认 below。
 * Jupyter 单元格会裁溢出，但自动翻到上方会盖住公式，用户要求一律在下面。
 */
export function resolvePreviewPlacement(input: PreviewPlacementFitInput): PreviewPlacement {
  return normalizePreviewPlacement(input.preferred);
}

/**
 * 把 `editor.fontSize` / `editor.lineHeight` 解析成浮层需要的像素度量。
 * 浮层不能再依赖 CSS 的 `ex`/`lh`：伪元素自身的 `line-height: 1` 会让 `1lh`
 * 退化成一个字号，而 `ex` 在编辑器字体和 SVG 图片里解析出的像素并不相同。
 */
export function resolveEditorMetrics(
  fontSize: unknown,
  lineHeight: unknown,
  isMacintosh = false,
): EditorMetrics {
  const fontSizePx = clamp(finite(fontSize, DEFAULT_FONT_SIZE), MINIMUM_FONT_SIZE, MAXIMUM_FONT_SIZE);
  const configured = finite(lineHeight, 0);
  let resolved: number;
  if (configured <= 0) {
    resolved = (isMacintosh ? GOLDEN_LINE_HEIGHT_RATIO_MAC : GOLDEN_LINE_HEIGHT_RATIO) * fontSizePx;
  } else if (configured < MINIMUM_LINE_HEIGHT) {
    resolved = configured * fontSizePx;
  } else {
    resolved = configured;
  }
  return {
    fontSizePx,
    lineHeightPx: clamp(Math.round(resolved), MINIMUM_LINE_HEIGHT, MAXIMUM_LINE_HEIGHT),
    exPx: fontSizePx * EX_PER_FONT_SIZE,
  };
}

/**
 * 生成 decoration 伪元素的浮层布局。绝对定位会把预览移出文本流，
 * 因而 SVG 的宽高不会再撑大源代码行或改变编辑光标基线。
 */
export function floatingPreviewLayout(input: FloatingPreviewInput): FloatingPreviewLayout {
  const placement = normalizePreviewPlacement(input.placement);
  const theme = input.theme ?? 'dark';
  const width = Math.max(1, finite(input.widthPx, 1));
  const height = Math.max(1, finite(input.heightPx, 1));
  const lineHeight = clamp(finite(input.lineHeightPx, MINIMUM_LINE_HEIGHT), MINIMUM_LINE_HEIGHT, MAXIMUM_LINE_HEIGHT);
  const lineSpan = Math.max(1, Math.round(finite(input.lineSpan, 1)));
  // 伪元素锚在公式首行：向下要跨过公式占用的全部行才落在 \end{...} 之下，
  // 向上只需跨过首行本身。
  const clearedLines = placement === 'below' ? lineSpan : 1;
  const edge = placement === 'below' ? 'top' : 'bottom';
  const offsetPx = Math.round(clearedLines * lineHeight) + PANEL_GAP_PX;
  const leftPx = roundPx(finite(input.leftPx, 0));
  const overflowX = input.overflowX === 'auto' ? 'auto' : 'visible';
  const overflowY = input.overflowY === 'auto' ? 'auto' : 'hidden';
  const boxWidth = Math.max(1, finite(input.boxWidthPx, width));
  const boxHeight = Math.max(1, finite(input.boxHeightPx, height));
  const scrollable = overflowX === 'auto' || overflowY === 'auto';
  if (input.viewportAnchor && input.geometry && input.imageUri) {
    return advancedPreviewLayout(input, theme, width, height, lineHeight, boxHeight);
  }
  if (input.viewportAnchor) {
    return anchoredPreviewLayout(input, placement, theme, width, height, offsetPx, leftPx, boxHeight);
  }
  return {
    placement,
    width: `${roundPx(overflowX === 'auto' ? boxWidth : width)}px`,
    height: `${roundPx(overflowY === 'auto' ? boxHeight : height)}px`,
    textDecoration: [
      'none',
      'position: absolute',
      `${edge}: ${offsetPx}px`,
      `left: ${leftPx}px`,
      'display: inline-flex',
      'align-items: center',
      'justify-content: center',
      'box-sizing: content-box',
      `padding: ${PANEL_PADDING}`,
      'line-height: 1',
      `border-radius: ${PANEL_RADIUS}`,
      `box-shadow: ${panelShadow(theme)}`,
      `overflow-x: ${overflowX}`,
      `overflow-y: ${overflowY}`,
      `max-width: ${roundPx(boxWidth)}px`,
      `max-height: ${roundPx(boxHeight)}px`,
      'isolation: isolate',
      'z-index: 1000',
      scrollable ? 'pointer-events: auto' : 'pointer-events: none',
      'overscroll-behavior: contain',
      ...(scrollable ? overlayScrollbarCss(theme) : []),
      'user-select: none',
      'opacity: 0.98',
      input.customCss?.declarations ?? '',
    ].join('; '),
  };
}

/**
 * Monaco 的 view-line 是 scrollWidth（可以远宽于分屏），不能以 100% 当作视口。
 * anchor() 把真实视口边缘换算到当前行的坐标；拖动分隔条、缩放、水平滚动由 CSS 重排，
 * 不用扩展轮询尺寸，也不重启 Worker。宽图按原比例收进视口，避免 content:url 的裁切。
 */
function anchoredPreviewLayout(
  input: FloatingPreviewInput,
  placement: PreviewPlacement,
  theme: PreviewThemeVariant,
  width: number,
  height: number,
  offsetPx: number,
  leftPx: number,
  boxHeight: number,
): FloatingPreviewLayout {
  const name = input.viewportAnchor!;
  const custom = input.customCss;
  const ratio = width / height;
  const insets = previewPanelInsets(custom, theme);
  const outerWidth = roundPx(width + insets.horizontal);
  const outerHeight = roundPx(height + insets.vertical);
  // Monaco 的定位包含块可能只是结束行的文字 span（如两个字符的 \]）。
  // 视口 anchor 不可用时，100% 会把图片连同 padding 缩到几乎 0；
  // 回退必须使用图片的已知尺寸，不能使用源码行宽。
  const viewportWidth = `anchor-size(${name} width, ${roundPx(outerWidth + 8)}px)`;
  const viewportHeight = `anchor-size(${name} height, 100vh)`;
  const maxWidth = custom?.maxWidth?.endsWith('%')
    ? `calc(${viewportWidth} * ${parseFloat(custom.maxWidth) / 100})`
    : custom?.maxWidth ?? `${outerWidth}px`;
  const maxHeight = Math.min(boxHeight + insets.vertical, custom?.maxHeight ?? Infinity);
  const image = input.image !== false;
  const panelWidth = `max(1px, min(${outerWidth}px, ${maxWidth}, calc(${viewportWidth} - 8px)${image ? `, ${roundPx(Math.max(0, maxHeight - insets.vertical) * ratio + insets.horizontal)}px, calc((${viewportHeight} - ${8 + insets.vertical}px) * ${ratio} + ${insets.horizontal}px)` : ''}))`;
  const panelHeight = image ? `calc((var(--silk-panel-width) - ${insets.horizontal}px) / ${ratio} + ${insets.vertical}px)` : `${outerHeight}px`;
  const edge = placement === 'below' ? 'top' : 'bottom';
  const startEdge = placement === 'below' ? 'top' : 'bottom';
  const endEdge = placement === 'below' ? 'bottom' : 'top';
  const y = offsetPx + (custom?.offsetY ?? 0) * (placement === 'below' ? 1 : -1);
  const x = roundPx(leftPx + (custom?.offsetX ?? 0));
  // 同理，anchor() 的 100% 回退是文字 span 的宽/高，并非编辑器视口。
  // 缺少 anchor 时保留正常的行边落点；真实 anchor 可用时仍按分屏边界限位。
  const fallbackRight = roundPx(Math.max(4, x) + outerWidth + 4);
  const fallbackEnd = roundPx(Math.max(4, y) + outerHeight + 4);
  return {
    placement,
    width: 'var(--silk-panel-width)',
    height: 'var(--silk-panel-height)',
    textDecoration: [
      'none', 'position: absolute', `position-anchor: ${name}`,
      `--silk-panel-width: ${panelWidth}`, `--silk-panel-height: ${panelHeight}`,
      `left: clamp(calc(anchor(${name} left, 0px) + 4px), ${x}px, calc(anchor(${name} right, ${fallbackRight}px) - var(--silk-panel-width) - 4px))`,
      `${edge}: clamp(calc(anchor(${name} ${startEdge}, 0px) + 4px), ${y}px, calc(anchor(${name} ${endEdge}, ${fallbackEnd}px) - var(--silk-panel-height) - 4px))`,
      'box-sizing: border-box', 'object-fit: contain', 'object-position: center',
      `padding: ${PANEL_PADDING}`, 'line-height: 1', `border-radius: ${PANEL_RADIUS}`,
      ...(theme === 'high-contrast' ? ['border: 2px solid var(--vscode-contrastBorder)'] : []),
      `box-shadow: ${panelShadow(theme)}`, 'overflow: hidden', 'isolation: isolate',
      'z-index: 1000', 'pointer-events: none', 'user-select: none', 'opacity: 0.98',
      ...(!image ? ['white-space: nowrap', 'text-overflow: ellipsis'] : []),
      custom?.declarations ?? '',
    ].join('; '),
  };
}

/**
 * 用四个 inset 划出可用空间。anchor() 只能用在 inset，不能放入 width/height。
 * 非替换伪元素按可用空间收缩；SVG 背景使用 contain 保留完整图像和宽高比。
 * 这样剩余空间小于图片时也不会为了容纳图片把它推回源码上。
 */
function advancedPreviewLayout(
  input: FloatingPreviewInput, theme: PreviewThemeVariant, width: number, height: number,
  lineHeight: number, boxHeight: number,
): FloatingPreviewLayout {
  const viewport = input.viewportAnchor!;
  const geometry = input.geometry!;
  const css = input.customCss!;
  const placement: PreviewPlacement = input.placement === 'right' ? 'right' : normalizePreviewPlacement(input.placement);
  const overlap = css.allowOverlap ?? false;
  const gap = css.gap ? css.gap.value * (css.gap.unit === 'lh' ? lineHeight : 1) : PANEL_GAP_PX;
  const base = anchoredPreviewLayout(input, placement, theme, width, height, lineHeight + gap, input.leftPx ?? 0, boxHeight);
  const variables = base.textDecoration.split('; ').filter((declaration) => declaration.startsWith('--silk-panel-'));
  const insets = previewPanelInsets(css, theme);
  const a = (name: string, edge: string, fallback: number) => `anchor(${name} ${edge}, ${roundPx(fallback)}px)`;
  const vp = (edge: string) => a(viewport, edge, edge === 'right' ? width + insets.horizontal + 8 : edge === 'bottom' ? height + insets.vertical + lineHeight + gap + 8 : 0);
  const x = css.offsetX;
  const y = css.offsetY;
  const farRight = (names: readonly string[]) => `max(${names.map((name) => a(name, 'right', input.leftPx ?? 0)).join(', ')})`;
  const horizontal = `clamp(calc(${vp('left')} + 4px), calc(${a(geometry.start, geometry.caretAtEnd ? 'right' : 'left', input.leftPx ?? 0)} + ${x}px), calc(${vp('right')} - var(--silk-panel-width) - 4px))`;
  let left = horizontal;
  const right = `calc(${vp('right')} + 4px)`;
  let top = `calc(${vp('top')} + 4px)`;
  let bottom = `calc(${vp('bottom')} + 4px)`;
  if (placement === 'above') {
    const desired = `calc(${a(geometry.start, 'top', lineHeight)} + ${gap - y}px)`;
    const protectedEdge = `calc(${a(geometry.sourceStart, 'top', lineHeight)} + ${gap}px)`;
    bottom = overlap
      ? `clamp(${bottom}, ${desired}, calc(${vp('top')} - var(--silk-panel-height) - 4px))`
      : `max(${bottom}, min(${desired}, calc(${vp('top')} - var(--silk-panel-height) - 4px)), ${protectedEdge})`;
    // 靠近来源一侧摆放；max-height 约束后，auto 顶边吸收剩余空间。
    top = overlap ? 'auto' : top;
  } else if (placement === 'right') {
    const referenceRight = geometry.caretAtEnd === undefined
      ? farRight(geometry.right) : a(geometry.start, geometry.caretAtEnd ? 'right' : 'left', input.leftPx ?? 0);
    const desired = `calc(${referenceRight} + ${gap + x}px)`;
    left = overlap
      ? `clamp(calc(${vp('left')} + 4px), ${desired}, calc(${vp('right')} - var(--silk-panel-width) - 4px))`
      : `max(calc(${vp('left')} + 4px), min(${desired}, calc(${vp('right')} - var(--silk-panel-width) - 4px)), calc(${farRight(geometry.sourceRight)} + ${gap}px))`;
    top = `clamp(${top}, calc(${a(geometry.start, 'top', 0)} + ${y}px), calc(${vp('bottom')} - var(--silk-panel-height) - 4px))`;
  } else {
    const desired = `calc(${a(geometry.end, 'bottom', lineHeight)} + ${gap + y}px)`;
    const protectedEdge = `calc(${a(geometry.sourceEnd, 'bottom', lineHeight)} + ${gap}px)`;
    top = overlap
      ? `clamp(${top}, ${desired}, calc(${vp('bottom')} - var(--silk-panel-height) - 4px))`
      : `max(${top}, min(${desired}, calc(${vp('bottom')} - var(--silk-panel-height) - 4px)), ${protectedEdge})`;
  }
  // 即使允许覆盖公式的其他行，也不能把图片夹回当前输入位置。
  // 同时约束相对的两个边，让空间不足时收缩盒子，而不是跨过保护边。
  if (geometry.editing) {
    const guard = Math.max(gap, lineHeight * 0.5) + insets.vertical;
    if (placement === 'above') {
      top = `calc(${vp('top')} + 4px)`;
      bottom = `max(${bottom}, calc(${a(geometry.editing, 'top', lineHeight)} + ${guard}px))`;
    } else if (placement === 'below') {
      top = `max(${top}, calc(${a(geometry.editing, 'bottom', lineHeight)} + ${guard}px))`;
    } else {
      left = `max(${left}, calc(${a(geometry.editing, 'right', 0)} + ${Math.max(gap, lineHeight * 0.5)}px))`;
    }
  }
  // Above 的 max-height 生效后用 auto 上边距吸收空白，让盒子贴着 bottom。
  return {
    placement,
    width: overlap && !(geometry.editing && placement === 'right') ? 'var(--silk-panel-width)' : 'auto',
    height: overlap && !(geometry.editing && placement !== 'right') ? 'var(--silk-panel-height)' : 'auto',
    textDecoration: [
      'none', 'position: absolute', `position-anchor: ${viewport}`,
      ...variables,
      `left: ${left}`, `right: ${right}`, `top: ${top}`, `bottom: ${bottom}`,
      'min-width: 0', 'min-height: 0', 'box-sizing: border-box',
      'max-width: var(--silk-panel-width)', 'max-height: var(--silk-panel-height)',
      ...(placement === 'above' && (!overlap || geometry.editing) ? ['margin-top: auto !important'] : []),
      // 覆盖 contentIconPath 的替换内容，保留零字符宽度的真实图片盒子。
      "content: '' !important", `background-image: url('${input.imageUri}')`,
      'background-size: contain', 'background-repeat: no-repeat', 'background-position: center',
      'background-origin: content-box', 'background-clip: padding-box',
      `padding: ${PANEL_PADDING}`, 'line-height: 1', `border-radius: ${PANEL_RADIUS}`,
      ...(theme === 'high-contrast' ? ['border: 2px solid var(--vscode-contrastBorder)'] : []),
      `box-shadow: ${panelShadow(theme)}`, 'overflow: hidden', 'isolation: isolate',
      'z-index: 1000', 'pointer-events: none', 'user-select: none', 'opacity: 0.98',
      css.declarations,
    ].join('; '),
  };
}

/** 细滚动条、轨道透明，避免系统那种宽条带底色。 */
function overlayScrollbarCss(theme: PreviewThemeVariant): readonly string[] {
  const thumb = theme === 'light' ? 'rgba(15, 23, 42, 0.28)' : 'rgba(255, 255, 255, 0.32)';
  return [
    'scrollbar-width: thin',
    `scrollbar-color: ${thumb} transparent`,
  ];
}
