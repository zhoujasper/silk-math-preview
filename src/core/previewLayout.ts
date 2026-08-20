export type PreviewPlacement = 'below' | 'above';
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

export interface FloatingPreviewInput {
  /** SVG 的真实像素宽度；必须与写进 SVG 根节点的宽度完全一致。 */
  readonly widthPx: number;
  readonly heightPx: number;
  readonly lineHeightPx: number;
  /** 公式在源码里占用的行数；浮层锚在首行，向下时要跨过全部行。 */
  readonly lineSpan: number;
  readonly placement?: unknown;
  readonly theme?: PreviewThemeVariant;
}

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
/** 面板内边距；数学内容本身已按像素精确对齐，四周只需等量留白。 */
const PANEL_PADDING = '0.3em 0.45em';

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
  return {
    placement,
    width: `${roundPx(width)}px`,
    height: `${roundPx(height)}px`,
    textDecoration: [
      'none',
      'position: absolute',
      `${edge}: ${offsetPx}px`,
      'display: inline-flex',
      'align-items: center',
      'justify-content: center',
      'box-sizing: content-box',
      `padding: ${PANEL_PADDING}`,
      'line-height: 1',
      'border-radius: 8px',
      `box-shadow: ${panelShadow(theme)}`,
      'overflow: visible',
      'isolation: isolate',
      'z-index: 40',
      'pointer-events: none',
      'user-select: none',
      'opacity: 0.98',
    ].join('; '),
  };
}
