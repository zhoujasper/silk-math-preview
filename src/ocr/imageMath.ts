export interface ImagePoint {
  readonly x: number;
  readonly y: number;
}

export interface ImageRect extends ImagePoint {
  readonly width: number;
  readonly height: number;
}

export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

function clamp(value: number, lower: number, upper: number): number {
  return Math.min(upper, Math.max(lower, value));
}

/** 将 CSS 像素中的指针坐标映射到图片的原始像素坐标。 */
export function clientPointToImage(
  client: ImagePoint,
  canvasBounds: ImageRect,
  intrinsic: ImageSize,
): ImagePoint {
  if (canvasBounds.width <= 0 || canvasBounds.height <= 0 || intrinsic.width <= 0 || intrinsic.height <= 0) {
    return { x: 0, y: 0 };
  }

  const relativeX = clamp(client.x - canvasBounds.x, 0, canvasBounds.width);
  const relativeY = clamp(client.y - canvasBounds.y, 0, canvasBounds.height);
  return {
    x: relativeX * intrinsic.width / canvasBounds.width,
    y: relativeY * intrinsic.height / canvasBounds.height,
  };
}

/** 规范化任意拖拽方向，并将框限制在图片范围内。 */
export function normalizeImageSelection(
  start: ImagePoint,
  end: ImagePoint,
  intrinsic: ImageSize,
): ImageRect {
  const startX = clamp(start.x, 0, intrinsic.width);
  const startY = clamp(start.y, 0, intrinsic.height);
  const endX = clamp(end.x, 0, intrinsic.width);
  const endY = clamp(end.y, 0, intrinsic.height);
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);

  return {
    x: left,
    y: top,
    width: Math.max(0, Math.max(startX, endX) - left),
    height: Math.max(0, Math.max(startY, endY) - top),
  };
}

export function selectionHasArea(selection: ImageRect, minimumSide = 4): boolean {
  return selection.width >= minimumSide && selection.height >= minimumSide;
}

/** 把源图按比例放进正方形，四周留白；禁止拉伸，否则宽公式会变形。 */
export function computeLetterbox(
  sourceWidth: number,
  sourceHeight: number,
  destinationSize: number,
  paddingRatio = 0.1,
): ImageRect {
  const size = Math.max(1, destinationSize);
  const inner = size * Math.max(0, 1 - 2 * Math.min(0.4, Math.max(0, paddingRatio)));
  const scale = Math.min(inner / Math.max(1, sourceWidth), inner / Math.max(1, sourceHeight));
  const width = Math.max(1, sourceWidth * scale);
  const height = Math.max(1, sourceHeight * scale);
  return {
    x: (size - width) / 2,
    y: (size - height) / 2,
    width,
    height,
  };
}

export function expandRect(rect: ImageRect, padRatio: number, bounds: ImageSize): ImageRect {
  const padX = rect.width * Math.max(0, padRatio);
  const padY = rect.height * Math.max(0, padRatio);
  const x = clamp(rect.x - padX, 0, bounds.width);
  const y = clamp(rect.y - padY, 0, bounds.height);
  const right = clamp(rect.x + rect.width + padX, 0, bounds.width);
  const bottom = clamp(rect.y + rect.height + padY, 0, bounds.height);
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}

export function unionRects(rects: readonly ImageRect[]): ImageRect | undefined {
  if (rects.length === 0) return undefined;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const rect of rects) {
    left = Math.min(left, rect.x);
    top = Math.min(top, rect.y);
    right = Math.max(right, rect.x + rect.width);
    bottom = Math.max(bottom, rect.y + rect.height);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** 截图平均亮度低于此值视为深色主题，识别前反相成黑字白底。 */
export const DARK_LUMA_THRESHOLD = 140;

export function shouldInvertMeanLuma(mean0to255: number): boolean {
  return Number.isFinite(mean0to255) && mean0to255 < DARK_LUMA_THRESHOLD;
}

