/// <reference lib="dom" />
import { parentPort, workerData } from 'node:worker_threads';
import { PassThrough } from 'node:stream';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { registerPngFont } from './pngFonts';
// 两包都提供 CJS 运行入口，发布的类型导出仅覆盖 ESM；在 Worker 中按需导入。
const { Canvg } = require('canvg') as { Canvg: { fromString(context: unknown, svg: string, options: Record<string, unknown>): { render(): Promise<void> } } };

/** 一次复制一个短命 Worker；不在扩展主线程栅格化，也不创建任何页面。 */
async function renderPng(): Promise<void> {
  const { make, encodePNGToStream, registerFont } = await import('pureimage');
  const { svg, widthPx, heightPx } = workerData as { svg: string; widthPx: number; heightPx: number };
  if (typeof svg !== 'string' || Buffer.byteLength(svg) > 2 * 1024 * 1024
    || ![widthPx, heightPx].every(value => Number.isFinite(value) && value > 0)) throw new Error('invalid-preview-image');
  const scale = Math.min(2, 8184 / widthPx, 8184 / heightPx, Math.sqrt((16_000_000 - 131_072) / widthPx / heightPx));
  const width = Math.max(1, Math.floor(widthPx * scale)) + 8;
  const height = Math.max(1, Math.floor(heightPx * scale)) + 8;
  const xml = new DOMParser({ onError: () => { throw new Error('invalid-preview-image'); } }).parseFromString(svg, 'image/svg+xml');
  const root = xml.documentElement;
  if (root?.localName !== 'svg') throw new Error('invalid-preview-image');
  const blackStyle = (style: string) => style.replace(/((?:^|[;{])\s*(?:fill|stroke|color|stop-color|background-color)\s*:)\s*([^;}]+)/gi,
    (_all, property: string, value: string) => `${property}${/^(?:none|transparent)\b/i.test(value.trim()) ? value : /background-color/i.test(property) ? '#fff' : '#000'}`);
  for (const node of [root, ...Array.from(root.getElementsByTagName('*'))]) {
    if ((node.getAttribute('class') ?? '').split(/\s+/).includes('silk-math-caret')
      || ['script', 'foreignObject', 'image'].includes(node.localName ?? '')
      || (node.localName === 'path' && !node.getAttribute('d')?.trim())) {
      node.parentNode?.removeChild(node); continue;
    }
    for (const name of ['fill', 'stroke', 'color', 'stop-color']) {
      const value = node.getAttribute(name);
      if (value && !/^(?:none|transparent)$/i.test(value)) node.setAttribute(name, node.hasAttribute('data-bgcolor') && name === 'fill' ? '#fff' : '#000');
    }
    if (node.hasAttribute('style')) node.setAttribute('style', blackStyle(node.getAttribute('style')!));
    if (node.localName === 'style') node.textContent = blackStyle(node.textContent ?? '');
  }
  root.setAttribute('width', String(width - 8));
  root.setAttribute('height', String(height - 8));
  root.setAttribute('color', '#000');
  const text = Array.from(root.getElementsByTagName('text')).map(node => node.textContent ?? '').join('');
  if (text.trim()) registerPngFont(text, registerFont);
  const bitmap = make(width, height);
  const context = bitmap.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  // Canvg 用极小值表达 SVG 的零描边；PureImage 不应把它投影成有宽度的线。
  const stroke = context.stroke.bind(context);
  context.stroke = () => { if (context.lineWidth > 0.000001) stroke(); };
  const renderer = Canvg.fromString(context as unknown as CanvasRenderingContext2D, new XMLSerializer().serializeToString(root), {
    DOMParser: DOMParser as unknown as typeof globalThis.DOMParser,
    ignoreAnimation: true, ignoreMouse: true, ignoreDimensions: true, ignoreClear: true,
    offsetX: 4, offsetY: 4,
    createCanvas: ((w: number, h: number) => make(w, h)) as never,
    fetch: (() => { throw new Error('external-image-disabled'); }) as never,
  });
  await renderer.render();
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  let bytes = 0;
  stream.on('data', (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes > 20 * 1024 * 1024) stream.destroy(new Error('image-too-large'));
    else chunks.push(chunk);
  });
  await encodePNGToStream(bitmap, stream);
  const png = Uint8Array.from(Buffer.concat(chunks));
  parentPort!.postMessage({ png }, [png.buffer]);
}

void renderPng().catch(error => parentPort?.postMessage({ error: error instanceof Error ? error.message : String(error) }));
