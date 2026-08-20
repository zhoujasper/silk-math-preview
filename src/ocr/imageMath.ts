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

