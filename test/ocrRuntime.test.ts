import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSessionQueue } from '../src/ocr/sessionQueue';
import { OcrCanvas, decodeImage, imageDimensions } from '../src/ocr/nodeCanvas';
import { MAX_IMAGE_BYTES } from '../src/ocr/protocol';

afterEach(() => vi.unstubAllGlobals());

describe('共享 OCR 初始化', () => {
  it('文字和公式同时请求时不重入 initWasm，单次失败不锁死队列', async () => {
    const enqueue = createSessionQueue();
    let initializing = false;
    const create = async (name: string, fail = false): Promise<string> => {
      if (initializing) throw new Error("multiple calls to 'initWasm()' detected.");
      initializing = true;
      await new Promise((resolve) => setTimeout(resolve, 1));
      initializing = false;
      if (fail) throw new Error('bad model');
      return name;
    };
    const results = await Promise.allSettled([
      enqueue(() => create('encoder')), enqueue(() => create('decoder', true)),
      enqueue(() => create('detector')), enqueue(() => create('recognizer')),
    ]);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected', 'fulfilled', 'fulfilled']);
    expect(results[1]).toEqual({ status: 'rejected', reason: new Error('bad model') });
    await expect(enqueue(() => create('retry'))).resolves.toBe('retry');
  });
});

describe('后台图片预处理', () => {
  it('缩放保留单像素细笔画和透明度，不用最近邻直接丢掉线条', () => {
    const source = new OcrCanvas(4, 4);
    const context = source.getContext();
    context.fillStyle = 'white'; context.fillRect(0, 0, 4, 4);
    context.fillStyle = 'black'; context.fillRect(1, 0, 1, 4);
    const target = new OcrCanvas(2, 2);
    Reflect.apply(target.getContext().drawImage, target.getContext(), [source, 0, 0, 2, 2]);
    const pixels = target.getContext().getImageData(0, 0, 2, 2).data;
    expect(pixels[0]).toBeGreaterThan(100); expect(pixels[0]).toBeLessThan(160);
    expect(pixels[4]).toBe(255); expect(pixels[3]).toBe(255);
  });
  it('在解码前拒绝超大像素尺寸、空图片和不支持格式', async () => {
    const header = Buffer.alloc(24);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(header);
    header.writeUInt32BE(100_000, 16); header.writeUInt32BE(100_000, 20);
    expect(() => imageDimensions(header)).toThrow('image-too-large');
    await expect(decodeImage(header)).rejects.toThrow('image-too-large');
    expect(() => imageDimensions(new Uint8Array(MAX_IMAGE_BYTES + 1))).toThrow('image-too-large');
    expect(() => imageDimensions(new Uint8Array())).toThrow('unsupported-image');
    header.writeUInt32BE(0, 16); expect(() => imageDimensions(header)).toThrow('invalid-image');
  });
  it('JPEG 变长标记安全读取，截断数据不会越界', () => {
    const jpeg = Buffer.from([255,216,255,224,0,4,1,2,255,192,0,8,8,0,20,0,40,1]);
    expect(imageDimensions(jpeg)).toEqual({ width: 40, height: 20, format: 'jpeg' });
    expect(() => imageDimensions(jpeg.subarray(0, 12))).toThrow('invalid-image');
  });
});
