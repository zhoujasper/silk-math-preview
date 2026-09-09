/// <reference lib="dom" />
import type { ImageRect } from './imageMath';

export interface FormulaImage {
  readonly canvas: HTMLCanvasElement;
  readonly bounds: ImageRect;
  readonly blank: boolean;
  readonly singleLine: boolean;
  readonly hasRules: boolean;
  readonly gridColumns: number | undefined;
}

/** 先找纸张/屏幕背景，再找笔画；不用整图平均亮度，避免大块黑字改变极性。 */
export function prepareFormulaImage(source: HTMLCanvasElement): FormulaImage {
  const { width, height } = source;
  const data = source.getContext('2d')!.getImageData(0, 0, width, height);
  const gray = new Uint8Array(width * height);
  const border = new Uint32Array(256);
  const histogram = new Uint32Array(256);
  let borderCount = 0;
  const edge = Math.max(1, Math.floor(Math.min(width, height) * 0.03));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const pixel = y * width + x, offset = pixel * 4;
    const alpha = (data.data[offset + 3] ?? 255) / 255;
    const value = Math.round((0.299 * data.data[offset]! + 0.587 * data.data[offset + 1]! + 0.114 * data.data[offset + 2]!) * alpha + 255 * (1 - alpha));
    gray[pixel] = value;
    histogram[value] = histogram[value]! + 1;
    if (x < edge || x >= width - edge || y < edge || y >= height - edge) {
      border[value] = border[value]! + 1; borderCount++;
    }
  }
  let background = 0, accumulated = 0;
  for (; background < 255; background++) {
    accumulated += border[background]!;
    if (accumulated >= borderCount / 2) break;
  }
  const invert = background < 140;
  const paper = invert ? 255 - background : background;
  let ink = paper;
  // 小图片上的单个标点也保留；不按连通域面积删除点、负号或上标。
  for (let value = 0; value < paper - 12; value++) {
    if (histogram[invert ? 255 - value : value]! > 0) { ink = value; break; }
  }
  const contrast = paper - ink;
  // 正常对比度只抬白纸色，不把抗锯齿强行压成浓黑；浅灰扫描件才拉伸对比度。
  const black = contrast < 80 ? ink : 0;
  const threshold = paper - Math.max(12, contrast * 0.16);
  let left = width, top = height, right = -1, bottom = -1;
  const rows = new Uint32Array(height);
  const columns = new Uint32Array(width);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const pixel = y * width + x;
    const value = invert ? 255 - gray[pixel]! : gray[pixel]!;
    gray[pixel] = paper > black ? Math.max(0, Math.min(255, Math.round((value - black) * 255 / (paper - black)))) : 255;
    if (value < threshold) {
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
      rows[y] = rows[y]! + 1;
      columns[x] = columns[x]! + 1;
    }
  }
  const blank = right < left || bottom < top;
  const bounds = blank ? { x: 0, y: 0, width, height }
    : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
  // 在原分辨率扫描后才裁切，避免大留白让小公式先被缩成几个像素。
  const margin = Math.max(4, Math.min(16, Math.round(bounds.height * 0.25)));
  const canvas = document.createElement('canvas');
  canvas.width = blank ? 1 : bounds.width + margin * 2;
  canvas.height = blank ? 1 : bounds.height + margin * 2;
  const context = canvas.getContext('2d')!;
  const output = context.createImageData(canvas.width, canvas.height);
  output.data.fill(255);
  if (!blank) for (let y = 0; y < bounds.height; y++) for (let x = 0; x < bounds.width; x++) {
    const value = gray[(y + top) * width + x + left]!;
    const offset = ((y + margin) * canvas.width + x + margin) * 4;
    output.data[offset] = output.data[offset + 1] = output.data[offset + 2] = value;
  }
  context.putImageData(output, 0, 0);
  const bands: { ink: number; height: number }[] = [];
  let lastInkRow = -Infinity, horizontalRules = 0;
  const gap = Math.max(2, Math.floor(bounds.height * 0.07));
  let inRule = false;
  if (!blank) for (let y = top; y <= bottom; y++) {
    if (rows[y]! > 0) {
      if (y - lastInkRow > gap + 1) bands.push({ ink: 0, height: 0 });
      const band = bands[bands.length - 1]!;
      band.ink += rows[y]!; band.height++;
      lastInkRow = y;
    }
    const rule = rows[y]! >= Math.max(24, bounds.width * 0.8);
    if (rule && !inRule) horizontalRules++;
    inRule = rule;
  }
  // 单根分数线不是表格。两条贯穿内容区的横线足以阻止空表格折叠。
  const hasRules = horizontalRules >= 2;
  const verticalRules: number[] = [];
  let inVerticalRule = false;
  if (hasRules && !blank) for (let x = left; x <= right; x++) {
    const rule = columns[x]! >= Math.max(24, bounds.height * 0.85);
    if (rule && !inVerticalRule) verticalRules.push(x);
    inVerticalRule = rule;
  }
  // 只有同时看见横线和贯穿高度的左右边框时，才用图中格线核对列数。
  const gridColumns = verticalRules.length >= 2 && verticalRules[0]! - left <= 4 && right - verticalRules.at(-1)! <= 4
    ? verticalRules.length - 1 : undefined;
  let largestInk = 0, largestHeight = 0;
  for (const band of bands) { largestInk = Math.max(largestInk, band.ink); largestHeight = Math.max(largestHeight, band.height); }
  // 逗号/句点的独立像素带不算第二行，但这些像素仍完整保留在送入模型的图中。
  const contentBands = bands.filter(band => band.ink >= largestInk * 0.05 || band.height > largestHeight * 0.25);
  return { canvas, bounds, blank, singleLine: !blank && contentBands.length === 1 && !hasRules, hasRules, gridColumns };
}
