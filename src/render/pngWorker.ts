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
  const preserveWhite = root.getAttribute('data-silk-tikz') === 'true';
  // 表格里合成的 TikZ 图形同样带有 100 倍的等比缩放，描边必须一起缩放。
  const scaleStrokes = preserveWhite || root.getElementsByTagName('g').length > 0
    && Array.from(root.getElementsByTagName('g')).some((node) => node.hasAttribute('data-silk-embed'));
  // 白色背景与节点遮挡必须保持白色，否则会盖住整张图或节点文字。
  const monochrome = (value: string, background = false): string => {
    const color = value.replace(/\s*!important\s*$/i, '').trim().toLowerCase().replace(/\s+/g, '');
    if (/^(?:none|transparent)$/.test(color)) return value;
    return background || (preserveWhite && /^(?:white|#(?:fff|ffff|ffffff|ffffffff)|rgb\(255,255,255\)|rgba\(255,255,255,1\))$/.test(color)) ? '#fff' : '#000';
  };
  const blackStyle = (style: string, background = false) => style.replace(/((?:^|[;{])\s*(fill|stroke|color|stop-color|background-color)\s*:)\s*([^;}]+)/gi,
    (_all, property: string, name: string, value: string) => `${property}${monochrome(value, name.toLowerCase() === 'background-color' || (background && name.toLowerCase() === 'fill'))}`);
  for (const node of [root, ...Array.from(root.getElementsByTagName('*'))]) {
    if ((node.getAttribute('class') ?? '').split(/\s+/).includes('silk-math-caret')
      || ['script', 'foreignObject', 'image'].includes(node.localName ?? '')
      || (node.localName === 'path' && !node.getAttribute('d')?.trim())) {
      node.parentNode?.removeChild(node); continue;
    }
    for (const name of ['fill', 'stroke', 'color', 'stop-color']) {
      const value = node.getAttribute(name);
      if (value) node.setAttribute(name, monochrome(value, node.hasAttribute('data-bgcolor') && name === 'fill'));
    }
    if (node.hasAttribute('style')) node.setAttribute('style', blackStyle(node.getAttribute('style')!, node.hasAttribute('data-bgcolor')));
    if (node.localName === 'style') node.textContent = blackStyle(node.textContent ?? '');
  }
  root.setAttribute('width', String(width - 8));
  root.setAttribute('height', String(height - 8));
  root.setAttribute('color', '#000');
  const text = Array.from(root.getElementsByTagName('text')).map(node => node.textContent ?? '').join('');
  if (text.trim()) registerPngFont(text, registerFont);
  const bitmap = make(width, height);
  const context = bitmap.getContext('2d');
  // PureImage 只认“字号 字体名”；canvg 给斜体/粗体文字的 "italic normal 12px serif"
  // 会被解析成 NaN 字号而整段消失（例如表格里 \textit 的中文）。去掉样式前缀后按常规字形绘制。
  const fontAccessor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(context), 'font');
  if (fontAccessor?.set) {
    Object.defineProperty(context, 'font', {
      configurable: true,
      get: () => fontAccessor.get?.call(context),
      set: (value: string) => fontAccessor.set!.call(context, String(value)
        .replace(/^\s*(?:(?:normal|italic|oblique|small-caps|bold|bolder|lighter|[1-9]00)\s+)+/i, '')),
    });
  }
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  // Canvg 用极小值表达 SVG 的零描边；PureImage 不应把它投影成有宽度的线。
  const stroke = context.stroke.bind(context);
  context.stroke = () => {
    if (context.lineWidth <= 0.000001) return;
    // PureImage transforms path coordinates but leaves stroke widths in local
    // units. Apply uniform SVG scaling (including reflections) for TikZ strokes.
    const width = context.lineWidth;
    if (scaleStrokes) {
      const { a, b, c, d } = context.getTransform();
      const x = Math.hypot(a, b), y = Math.hypot(c, d);
      if (Math.abs(x - y) < 1e-6 && Math.abs(a * c + b * d) < 1e-6) context.lineWidth = width * x;
    }
    try { stroke(); }
    finally { context.lineWidth = width; }
  };
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
