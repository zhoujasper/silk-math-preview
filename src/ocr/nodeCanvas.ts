/// <reference lib="dom" />
import { Readable } from 'node:stream';
import type { Bitmap, Context } from 'pureimage' with { 'resolution-mode': 'import' };
const { make, decodePNGFromStream, decodeJPEGFromStream } = require('pureimage') as typeof import('pureimage', { with: { 'resolution-mode': 'import' } });
import { MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS } from './protocol';

/** 只用于 OCR Worker 的纯 JS Canvas，VSIX 不包含平台原生模块。 */
export class OcrCanvas {
  private bitmap: Bitmap;
  constructor(width = 1, height = 1) { this.bitmap = make(Math.max(1, Math.ceil(width)), Math.max(1, Math.ceil(height))); }
  get width(): number { return this.bitmap.width; }
  set width(value: number) { this.bitmap = make(Math.max(1, Math.ceil(value)), this.height); }
  get height(): number { return this.bitmap.height; }
  set height(value: number) { this.bitmap = make(this.width, Math.max(1, Math.ceil(value))); }
  getContext(): Context {
    const context = this.bitmap.getContext('2d');
    if (!Object.hasOwn(context, 'drawImage')) {
      const draw = context.drawImage.bind(context);
      context.drawImage = ((source: Bitmap | OcrCanvas, ...args: number[]) => {
        const bitmap = source instanceof OcrCanvas ? source.bitmap : source;
        // PureImage 0.4.20 的 getTransform() 固定 isIdentity=false 且漏掉 f；
        // 使用该固定版本实际的矩阵判定，旋转路径仍交回库处理。
        const transform = (context as unknown as { _transform: { isIdentity(): boolean } })._transform;
        if (transform.isIdentity()) drawResampled(bitmap, this.bitmap, args);
        else Reflect.apply(draw, undefined, [bitmap, ...args]);
      }) as Context['drawImage'];
      // PureImage 提供 get/putImageData，但没有 Canvas2D 的分配方法。
      Object.assign(context, { createImageData: (width: number, height: number) => make(width, height) });
    }
    return context;
  }
  static fromBitmap(bitmap: Bitmap): OcrCanvas {
    const canvas = new OcrCanvas();
    canvas.bitmap = bitmap;
    return canvas;
  }
}

/** Canvas 默认的平滑缩放：保住细笔画，避免最近邻把 l、分数线等像素丢掉。 */
function drawResampled(source: Bitmap, target: Bitmap, args: number[]): void {
  let [sx, sy, sw, sh, dx, dy, dw, dh] = [0, 0, source.width, source.height, 0, 0, source.width, source.height];
  if (args.length === 2 || args.length === 4) {
    [dx, dy] = [args[0]!, args[1]!];
    if (args.length === 4) [dw, dh] = [args[2]!, args[3]!];
  } else if (args.length === 8) [sx, sy, sw, sh, dx, dy, dw, dh] = args as [number, number, number, number, number, number, number, number];
  else throw new Error('Invalid drawImage arguments');
  if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
  const input = source.data, output = target.data;
  for (let y = Math.max(0, Math.ceil(dy)); y < Math.min(target.height, dy + dh); y++) {
    const fy = Math.max(0, Math.min(source.height - 1, sy + (y + 0.5 - dy) * sh / dh - 0.5));
    const y0 = Math.floor(fy), y1 = Math.min(source.height - 1, y0 + 1), wy = fy - y0;
    for (let x = Math.max(0, Math.ceil(dx)); x < Math.min(target.width, dx + dw); x++) {
      const fx = Math.max(0, Math.min(source.width - 1, sx + (x + 0.5 - dx) * sw / dw - 0.5));
      const x0 = Math.floor(fx), x1 = Math.min(source.width - 1, x0 + 1), wx = fx - x0;
      const indices = [(y0 * source.width + x0) * 4, (y0 * source.width + x1) * 4, (y1 * source.width + x0) * 4, (y1 * source.width + x1) * 4];
      const weights = [(1 - wx) * (1 - wy), wx * (1 - wy), (1 - wx) * wy, wx * wy];
      let alpha = 0;
      const rgb = [0, 0, 0];
      for (let sample = 0; sample < 4; sample++) {
        const index = indices[sample]!;
        const a = (input[index + 3] ?? 0) / 255 * weights[sample]!;
        alpha += a;
        for (let c = 0; c < 3; c++) rgb[c] = rgb[c]! + (input[index + c] ?? 0) * a;
      }
      const index = (y * target.width + x) * 4;
      const background = (output[index + 3] ?? 0) / 255 * (1 - alpha);
      const combined = alpha + background;
      for (let c = 0; c < 3; c++) output[index + c] = combined ? Math.round((rgb[c]! + (output[index + c] ?? 0) * background) / combined) : 0;
      output[index + 3] = Math.round(combined * 255);
    }
  }
}

/** 在解码前限制像素，避免一个很小的压缩文件分配巨量内存。 */
export function imageDimensions(bytes: Uint8Array): { width: number; height: number; format: 'png' | 'jpeg' } {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (b.length > MAX_IMAGE_BYTES) throw new Error('image-too-large');
  let width = 0;
  let height = 0;
  let format: 'png' | 'jpeg';
  if (b.length >= 24 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    width = b.readUInt32BE(16); height = b.readUInt32BE(20); format = 'png';
  } else if (b[0] === 255 && b[1] === 216) {
    format = 'jpeg';
    let pos = 2;
    while (pos + 4 <= b.length) {
      if (b[pos++] !== 255) break;
      while (b[pos] === 255) pos++;
      const marker = b[pos++];
      if (marker === undefined || marker === 218 || marker === 217) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (pos + 2 > b.length) break;
      const length = b.readUInt16BE(pos);
      if (length < 2 || pos + length > b.length) break;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && length >= 8) {
        height = b.readUInt16BE(pos + 3); width = b.readUInt16BE(pos + 5); break;
      }
      pos += length;
    }
  } else throw new Error('unsupported-image');
  if (width < 4 || height < 4) throw new Error('invalid-image');
  if (width * height > MAX_IMAGE_PIXELS) throw new Error('image-too-large');
  return { width, height, format };
}

export async function decodeImage(bytes: Uint8Array): Promise<HTMLCanvasElement> {
  const { format } = imageDimensions(bytes);
  const stream = Readable.from([bytes]);
  const bitmap = await (format === 'png' ? decodePNGFromStream(stream) : decodeJPEGFromStream(stream));
  const source = OcrCanvas.fromBitmap(bitmap);
  // 将透明背景合成到白底，避免透明像素被当作黑底并错误反相。
  const canvas = new OcrCanvas(source.width, source.height);
  const context = canvas.getContext();
  context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height);
  Reflect.apply(context.drawImage, context, [source, 0, 0]);
  return canvas as unknown as HTMLCanvasElement;
}

export function installCanvasGlobals(): void {
  Object.assign(globalThis, {
    HTMLCanvasElement: OcrCanvas,
    OffscreenCanvas: OcrCanvas,
    document: { createElement: (tag: string) => {
      if (tag !== 'canvas') throw new Error(`OCR 不支持元素 ${tag}`);
      return new OcrCanvas();
    } },
  });
}
