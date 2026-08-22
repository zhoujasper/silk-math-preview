import { mathjax } from '@mathjax/src/js/mathjax.js';
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import { TeX } from '@mathjax/src/js/input/tex.js';
import { SVG } from '@mathjax/src/js/output/svg.js';
import { MathJaxTexFont } from '@mathjax/mathjax-tex-font/js/svg.js';

import '@mathjax/src/js/input/tex/base/BaseConfiguration.js';
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js';
import '@mathjax/src/js/input/tex/begingroup/BegingroupConfiguration.js';
import '@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js';
import '@mathjax/src/js/input/tex/color/ColorConfiguration.js';
import '@mathjax/src/js/input/tex/html/HtmlConfiguration.js';
import '@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js';
import '@mathjax/src/js/input/tex/cancel/CancelConfiguration.js';
import '@mathjax/src/js/input/tex/noundefined/NoUndefinedConfiguration.js';

import { recoverIncompleteTex } from '../core/incompleteTex';
import { parseArrayHlineBoundaries, parseSpanClass } from '../core/tablePreview';

const EM = 16;
const EX = 8;
const WIDTH = 120 * EM;
const MAX_CONTEXTS = 2;
const MAX_SVG_BYTES = 2 * 1024 * 1024;
const MAX_TEX_BUFFER = 256 * 1024;
/** 超过这个宽度的公式整体等比缩小；宁可变小，也不让浮层背景盖不住内容。 */
const MAX_PANEL_EX = 130;

export interface SvgRenderOptions {
  readonly expression: string;
  readonly displayMode: boolean;
  readonly definitionFingerprint: string;
  readonly definitionPrelude: string;
  readonly foreground: string;
  readonly caretColor: string;
  /** 输出尺寸的整体缩放；表格等宽内容用它显示得小一档。`exPx` 为 0 时不生效。 */
  readonly scale: number;
  /**
   * MathJax 的 1ex 折算成的 CSS 像素。大于 0 时把根节点尺寸改写为像素，
   * 使宿主可以用同一组数值画背景；0 表示保留 ex 尺寸，供 Webview 内联使用。
   */
  readonly exPx: number;
  /** 未定义命令渲染成红色原文而不是抛错，方便一眼看出真正写错的地方。 */
  readonly markUnknownCommands: boolean;
}

export interface SvgRenderResult {
  readonly svg: string;
  /** 与 SVG 根节点完全一致的像素尺寸；`exPx` 为 0 时按默认 1ex = 8px 估算。 */
  readonly widthPx: number;
  readonly heightPx: number;
}

interface RenderContext {
  readonly document: ReturnType<typeof mathjax.document>;
  readonly adaptor: ReturnType<typeof liteAdaptor>;
  readonly tex: TeX<unknown, unknown, unknown>;
}

const SHARED_ADAPTOR = liteAdaptor({ fontSize: EM });
RegisterHTMLHandler(SHARED_ADAPTOR);
const SHARED_OUTPUT = new SVG({
  fontCache: 'none',
  exFactor: EX / EM,
  fontData: MathJaxTexFont,
});

type CssLengthUnit = 'ex' | 'em' | 'px' | '%';
interface ParsedLength {
  readonly amount: number;
  readonly unit: CssLengthUnit;
}

function parseCssLength(source: string | undefined): ParsedLength | undefined {
  if (!source) return undefined;
  const trimmed = source.trim();
  const match = /^(-?\d+(?:\.\d+)?)(ex|em|px|%)$/i.exec(trimmed);
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return undefined;
  const unit = match[2];
  if (!unit) return undefined;
  return { amount, unit: unit.toLowerCase() as CssLengthUnit };
}

const numericEx = (source: string | undefined, fallback: number): number => {
  const parsed = parseCssLength(source);
  if (!parsed) return fallback;
  if (parsed.unit === 'ex') return parsed.amount;
  if (parsed.unit === 'em') return parsed.amount * (EM / EX);
  if (parsed.unit === 'px') return parsed.amount / EX;
  return fallback;
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

const escapeCssColor = (value: string, fallback: string): string =>
  /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : fallback;

const ATTRIBUTE = (name: string): RegExp => new RegExp(
  `\\s${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`,
  'gi',
);

function safeInlineStyle(value: string): string {
  const declarations: string[] = [];
  for (const raw of value.split(';')) {
    const separator = raw.indexOf(':');
    if (separator < 1) continue;
    const property = raw.slice(0, separator).trim().toLowerCase();
    const candidate = raw.slice(separator + 1).trim();
    if (property === 'vertical-align' && /^-?\d+(?:\.\d+)?(?:ex|em|px|%)$/i.test(candidate)) {
      declarations.push(`vertical-align:${candidate}`);
    } else if (
      (property === 'color' || property === 'background-color')
      && /^(?:#[0-9a-f]{3,8}|[a-z]{1,32}|(?:rgb|hsl)a?\([\d\s.,%/+-]+\))$/i.test(candidate)
    ) {
      declarations.push(`${property}:${candidate}`);
    }
  }
  return declarations.join(';');
}

function sanitizeStyleAttributes(svg: string): string {
  return svg.replace(/\sstyle\s*=\s*(["'])([\s\S]*?)\1/gi, (_whole, _quote: string, value: string) => {
    const safe = safeInlineStyle(value);
    return safe ? ` style="${safe}"` : '';
  });
}

function styleValue(attributes: string): string {
  const match = /\sstyle\s*=\s*(["'])([\s\S]*?)\1/i.exec(attributes);
  return match?.[2] ?? '';
}

function stylePropertyValue(style: string, name: string): string | undefined {
  const regex = new RegExp(`\\b${name}\\s*:\\s*([^;]+)`, 'i');
  return regex.exec(style)?.[1]?.trim();
}

function extractLength(attributes: string, name: 'width' | 'height'): string | undefined {
  const attribute = new RegExp(`\\b${name}\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))`, 'i')
    .exec(attributes);
  const value = attribute?.[1] ?? attribute?.[2] ?? attribute?.[3];
  if (value) return value;
  const style = stylePropertyValue(styleValue(attributes), name);
  return style;
}

function extractViewBoxDimension(attributes: string, axis: 0 | 1): number | undefined {
  const values = /\bviewBox\s*=\s*"([^"]+)"/i.exec(attributes)?.[1]?.trim().split(/\s+/).map((entry) => Number(entry));
  if (!values || values.length < 4) return undefined;
  // SVG viewBox 是 min-x min-y width height，不是 min/max 对角点。
  const dimension = axis === 0 ? values[2] : values[3];
  return dimension !== undefined && Number.isFinite(dimension) && dimension > 0 ? dimension : undefined;
}

/**
 * `\underbrace` / `\sqrt` / `\overline` 会在公式里再嵌一层 `<svg>`。
 * 用非贪婪的第一个 `</svg>` 会把根节点截断，VS Code 画不出图，只剩空白底。
 */
export function extractRootSvg(raw: string): string {
  const start = raw.search(/<svg\b/i);
  if (start < 0) throw new Error('MathJax 未返回 SVG');
  let depth = 0;
  const tag = /<svg\b[^>]*>|<\/svg>/gi;
  tag.lastIndex = start;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(raw))) {
    const closing = match[0].startsWith('</');
    depth += closing ? -1 : 1;
    if (closing && depth === 0) {
      return raw.slice(start, match.index + match[0].length);
    }
  }
  throw new Error('MathJax 返回的 SVG 未闭合');
}

interface Affine {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

const IDENTITY: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
/** 只有定位点落在原 viewBox 之外时才外扩，避免给每条公式四周垫空白。 */
const VIEWBOX_GLYPH_EXTENT = 900;

function multiplyAffine(left: Affine, right: Affine): Affine {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
}

function parseNumbers(source: string): number[] {
  return source.trim().split(/[\s,]+/).map(Number).filter((value) => Number.isFinite(value));
}

function parseTransform(value: string | undefined): Affine {
  if (!value) return IDENTITY;
  let matrix = IDENTITY;
  const token = /(translate|scale|matrix)\s*\(([^)]*)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = token.exec(value))) {
    const kind = match[1]!.toLowerCase();
    const nums = parseNumbers(match[2] ?? '');
    if (kind === 'translate') {
      matrix = multiplyAffine(matrix, {
        a: 1, b: 0, c: 0, d: 1, e: nums[0] ?? 0, f: nums[1] ?? 0,
      });
    } else if (kind === 'scale') {
      const sx = nums[0] ?? 1;
      matrix = multiplyAffine(matrix, {
        a: sx, b: 0, c: 0, d: nums[1] ?? sx, e: 0, f: 0,
      });
    } else if (kind === 'matrix' && nums.length >= 6) {
      matrix = multiplyAffine(matrix, {
        a: nums[0]!, b: nums[1]!, c: nums[2]!, d: nums[3]!, e: nums[4]!, f: nums[5]!,
      });
    }
  }
  return matrix;
}

function attributeValue(attributes: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))`, 'i')
    .exec(attributes);
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function numericAttribute(attributes: string, name: string): number | undefined {
  const value = Number(attributeValue(attributes, name));
  return Number.isFinite(value) ? value : undefined;
}

function parseViewBox(attributes: string): { minX: number; minY: number; width: number; height: number } | undefined {
  const values = attributeValue(attributes, 'viewBox')?.trim().split(/\s+/).map(Number);
  if (!values || values.length < 4) return undefined;
  const minX = values[0]!;
  const minY = values[1]!;
  const width = values[2]!;
  const height = values[3]!;
  if (![minX, minY, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return undefined;
  return { minX, minY, width, height };
}

function matchingSvgClose(source: string, openIndex: number): { index: number; length: number } | undefined {
  let depth = 0;
  const tag = /<svg\b[^>]*>|<\/svg>/gi;
  tag.lastIndex = openIndex;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(source))) {
    const closing = match[0].startsWith('</');
    depth += closing ? -1 : 1;
    if (closing && depth === 0) return { index: match.index, length: match[0].length };
  }
  return undefined;
}

function findInnermostSvg(source: string, from: number): { start: number; openEnd: number; close: number; closeLength: number } | undefined {
  let search = from;
  while (search < source.length) {
    const rest = source.slice(search);
    const local = rest.search(/<svg\b/i);
    if (local < 0) return undefined;
    const start = search + local;
    const openEnd = source.indexOf('>', start);
    if (openEnd < 0) return undefined;
    const close = matchingSvgClose(source, start);
    if (!close) return undefined;
    const inner = source.slice(openEnd + 1, close.index);
    if (!/<svg\b/i.test(inner)) {
      return { start, openEnd, close: close.index, closeLength: close.length };
    }
    search = openEnd + 1;
  }
  return undefined;
}

/**
 * VS Code 装饰的 `content: url(data:image/svg+xml)` 遇到内层 `<svg>` 会整张图画不出来，
 * 只剩浮层底。拉伸 `\underbrace` / `\sqrt` 正好用内层 svg 当视口。展平成等价的 `<g>`。
 */
export function flattenInnerSvgs(svg: string): string {
  const rootOpenEnd = svg.indexOf('>');
  if (rootOpenEnd < 0) return svg;
  const lastClose = svg.lastIndexOf('</svg>');
  if (lastClose < rootOpenEnd) return svg;
  const prefix = svg.slice(0, rootOpenEnd + 1);
  let body = svg.slice(rootOpenEnd + 1, lastClose);
  const suffix = svg.slice(lastClose);
  let clipSeq = 0;
  for (let guard = 0; guard < 32; guard += 1) {
    const inner = findInnermostSvg(body, 0);
    if (!inner) break;
    const attrs = body.slice(inner.start, inner.openEnd + 1);
    const children = body.slice(inner.openEnd + 1, inner.close);
    body = `${body.slice(0, inner.start)}${innerSvgToGroup(attrs, children, clipSeq)}${body.slice(inner.close + inner.closeLength)}`;
    clipSeq += 1;
  }
  return `${prefix}${body}${suffix}`;
}

interface BBox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

function intersectBBox(a: BBox, b: BBox): BBox | undefined {
  const minX = Math.max(a.minX, b.minX);
  const minY = Math.max(a.minY, b.minY);
  const maxX = Math.min(a.maxX, b.maxX);
  const maxY = Math.min(a.maxY, b.maxY);
  if (!(maxX > minX) || !(maxY > minY)) return undefined;
  return { minX, minY, maxX, maxY };
}

function applyAffineToPoint(matrix: Affine, x: number, y: number): { x: number; y: number } {
  return {
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  };
}

function transformBBox(box: BBox, matrix: Affine): BBox {
  const corners = [
    applyAffineToPoint(matrix, box.minX, box.minY),
    applyAffineToPoint(matrix, box.maxX, box.minY),
    applyAffineToPoint(matrix, box.maxX, box.maxY),
    applyAffineToPoint(matrix, box.minX, box.maxY),
  ];
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

/** MathJax 拉伸段几乎都是 `M x y L x y L x y L x y Z` 轴对齐矩形。 */
function parseAxisAlignedRectPath(d: string): BBox | undefined {
  const points: Array<{ x: number; y: number }> = [];
  let x = 0;
  let y = 0;
  const token = /([MLHVZmlhvz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/g;
  let command = '';
  let match: RegExpExecArray | null;
  const nums: number[] = [];
  const flush = (): boolean => {
    if (command === 'Z' || command === 'z') {
      nums.length = 0;
      return true;
    }
    if (command === 'M' || command === 'L') {
      while (nums.length >= 2) {
        x = nums.shift()!;
        y = nums.shift()!;
        points.push({ x, y });
      }
      return nums.length === 0;
    }
    if (command === 'H') {
      while (nums.length >= 1) {
        x = nums.shift()!;
        points.push({ x, y });
      }
      return true;
    }
    if (command === 'V') {
      while (nums.length >= 1) {
        y = nums.shift()!;
        points.push({ x, y });
      }
      return true;
    }
    return false;
  };
  while ((match = token.exec(d))) {
    if (match[1]) {
      if (command && !flush()) return undefined;
      command = match[1];
      continue;
    }
    const value = Number(match[2]);
    if (!Number.isFinite(value) || !command) return undefined;
    nums.push(value);
  }
  if (command && !flush()) return undefined;
  if (points.length < 4) return undefined;
  const xs = [...new Set(points.map((point) => point.x))];
  const ys = [...new Set(points.map((point) => point.y))];
  if (xs.length !== 2 || ys.length !== 2) return undefined;
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function rectPath(box: BBox, dataC?: string): string {
  const data = dataC ? ` data-c="${dataC}"` : '';
  return `<path${data} d="M${round2(box.minX)} ${round2(box.minY)}H${round2(box.maxX)}V${round2(box.maxY)}H${round2(box.minX)}Z"/>`;
}

/**
 * VS Code 把 SVG 当 `content: url(data:image/svg+xml)` 画时，`clip-path="url(#id)"`
 * 不会生效，拉伸矩形就会铺成一根多余的横线。这里按 viewBox 直接裁出矩形路径。
 */
function clipInnerSvgChildren(
  children: string,
  viewBox: { minX: number; minY: number; width: number; height: number },
  x: number,
  y: number,
  width: number,
  height: number,
): string | undefined {
  const paths = [...children.matchAll(/<path\b([^>]*)>/gi)];
  if (paths.length === 0) return undefined;
  const leftover = children
    .replace(/<path\b[^>]*>\s*(?:<\/path>)?/gi, '')
    .replace(/\s+/g, '');
  if (leftover.length > 0) return undefined;
  const viewRect: BBox = {
    minX: viewBox.minX,
    minY: viewBox.minY,
    maxX: viewBox.minX + viewBox.width,
    maxY: viewBox.minY + viewBox.height,
  };
  const sx = width / viewBox.width;
  const sy = height / viewBox.height;
  const pieces: string[] = [];
  for (const path of paths) {
    const attrs = path[1] ?? '';
    const d = attributeValue(attrs, 'd');
    if (!d) return undefined;
    const local = parseAxisAlignedRectPath(d);
    if (!local) return undefined;
    const inViewBox = transformBBox(local, parseTransform(attributeValue(attrs, 'transform')));
    const clipped = intersectBBox(inViewBox, viewRect);
    if (!clipped) continue;
    const mapped: BBox = {
      minX: x + (clipped.minX - viewBox.minX) * sx,
      minY: y + (clipped.minY - viewBox.minY) * sy,
      maxX: x + (clipped.maxX - viewBox.minX) * sx,
      maxY: y + (clipped.maxY - viewBox.minY) * sy,
    };
    pieces.push(rectPath(mapped, attributeValue(attrs, 'data-c')));
  }
  return pieces.length > 0 ? pieces.join('') : undefined;
}

function innerSvgToGroup(openTag: string, children: string, clipSeq: number): string {
  const attrs = openTag.replace(/^<svg\b/i, '').replace(/>$/, '');
  const x = numericAttribute(attrs, 'x') ?? 0;
  const y = numericAttribute(attrs, 'y') ?? 0;
  const width = numericAttribute(attrs, 'width');
  const height = numericAttribute(attrs, 'height');
  const viewBox = parseViewBox(attrs);
  const existing = attributeValue(attrs, 'transform');
  const className = attributeValue(attrs, 'class');
  const classAttr = className ? ` class="${className}"` : '';
  const extra = existing ? ` ${existing}` : '';
  if (viewBox && width !== undefined && height !== undefined && viewBox.width > 0 && viewBox.height > 0) {
    const clipped = clipInnerSvgChildren(children, viewBox, x, y, width, height);
    if (clipped) {
      return extra || classAttr
        ? `<g${classAttr} transform="translate(0,0)${extra}">${clipped}</g>`
        : clipped;
    }
    const clipId = `silk-clip-${clipSeq}`;
    const sx = width / viewBox.width;
    const sy = height / viewBox.height;
    return `<g${classAttr} transform="translate(${x},${y})${extra}"><clipPath id="${clipId}"><rect x="0" y="0" width="${width}" height="${height}"/></clipPath><g clip-path="url(#${clipId})" transform="scale(${sx},${sy}) translate(${-viewBox.minX},${-viewBox.minY})">${children}</g></g>`;
  }
  return `<g${classAttr} transform="translate(${x},${y})${extra}">${children}</g>`;
}

/**
 * MathJax 给 `\underbrace{...}_{...}` 算的 viewBox 常常裁掉下标。
 * 用变换后的定位点向外扩，独立 SVG 图片才会把整条公式画全。
 */
export function expandViewBoxToContent(svg: string): string {
  const open = svg.match(/^<svg\b[^>]*>/i)?.[0];
  if (!open) return svg;
  const viewBox = parseViewBox(open);
  if (!viewBox) return svg;
  let minX = viewBox.minX;
  let minY = viewBox.minY;
  let maxX = viewBox.minX + viewBox.width;
  let maxY = viewBox.minY + viewBox.height;
  const stack: Affine[] = [parseTransform(attributeValue(open, 'transform'))];
  const tag = /<g\b([^>]*)>|<\/g>|<path\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(svg))) {
    const token = match[0];
    if (token.startsWith('</')) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const attrs = match[1] ?? match[2] ?? '';
    const local = parseTransform(attributeValue(attrs, 'transform'));
    const composed = multiplyAffine(stack[stack.length - 1] ?? IDENTITY, local);
    const x = composed.e;
    const y = composed.f;
    const outside = x < minX || x > maxX || y < minY || y > maxY;
    if (outside) {
      minX = Math.min(minX, x - VIEWBOX_GLYPH_EXTENT);
      minY = Math.min(minY, y - VIEWBOX_GLYPH_EXTENT);
      maxX = Math.max(maxX, x + VIEWBOX_GLYPH_EXTENT);
      maxY = Math.max(maxY, y + VIEWBOX_GLYPH_EXTENT);
    }
    if (token.startsWith('<g')) stack.push(composed);
  }
  const width = maxX - minX;
  const height = maxY - minY;
  if (!(width > 0) || !(height > 0)) return svg;
  if (
    Math.abs(minX - viewBox.minX) < 0.5
    && Math.abs(minY - viewBox.minY) < 0.5
    && Math.abs(width - viewBox.width) < 0.5
    && Math.abs(height - viewBox.height) < 0.5
  ) {
    return svg;
  }
  const nextBox = `${round2(minX)} ${round2(minY)} ${round2(width)} ${round2(height)}`;
  const heightScale = height / viewBox.height;
  const widthScale = width / viewBox.width;
  return svg.replace(/^<svg\b[^>]*>/i, (root) => {
    let updated = root.replace(/\bviewBox\s*=\s*(["'])[\s\S]*?\1/i, `viewBox="${nextBox}"`);
    updated = scaleLengthAttribute(updated, 'width', widthScale);
    updated = scaleLengthAttribute(updated, 'height', heightScale);
    return updated;
  });
}

function scaleLengthAttribute(openTag: string, name: 'width' | 'height', factor: number): string {
  if (!(factor > 0) || Math.abs(factor - 1) < 1e-6) return openTag;
  return openTag.replace(
    new RegExp(`\\b${name}\\s*=\\s*(["'])([^"']*)\\1`, 'i'),
    (_whole, quote: string, value: string) => {
      const parsed = parseCssLength(value);
      if (!parsed) return _whole;
      return `${name}=${quote}${round2(parsed.amount * factor)}${parsed.unit}${quote}`;
    },
  );
}

/**
 * MathJax 的输出只作为本地图片使用。这里移除可导航/可执行节点和属性，
 * 并把主题色与私有 caret 样式写进独立 SVG。
 */
export function sanitizeStandaloneSvg(
  raw: string,
  foreground: string,
  caretColor: string,
  expression = '',
): string {
  const fg = escapeCssColor(foreground, '#d4d4d4');
  const caret = escapeCssColor(caretColor, '#ffb454');
  let svg = extractRootSvg(raw)
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<image\b[^>]*\/?\s*>/gi, '')
    .replace(/<\/?a\b[^>]*>/gi, '')
    .replace(/\s(?:on\w+|href|xlink:href)=(['"])[\s\S]*?\1/gi, '')
    .replace(/\sdata-(?:latex|semantic[^=\s]*)=(['"])[\s\S]*?\1/gi, '');

  svg = sanitizeStyleAttributes(svg);
  svg = flattenInnerSvgs(svg);
  svg = expandViewBoxToContent(svg);
  svg = restyleTableRules(svg, expression);

  svg = svg.replace(/<svg\b([^>]*)>/i, (_whole, attrs: string) => {
    const verticalAlign = safeInlineStyle(styleValue(attrs))
      .split(';')
      .find((declaration) => declaration.startsWith('vertical-align:'));
    let controlled = attrs
      .replace(ATTRIBUTE('role'), '')
      .replace(ATTRIBUTE('preserveAspectRatio'), '')
      .replace(ATTRIBUTE('style'), '');
    const xmlns = /\sxmlns\s*=/.test(controlled) ? '' : ' xmlns="http://www.w3.org/2000/svg"';
    controlled = controlled.trimEnd();
    const rootStyle = [verticalAlign, `color:${fg}`, 'overflow:visible'].filter(Boolean).join(';');
    return `<svg${controlled}${xmlns} role="img" preserveAspectRatio="xMinYMid meet" style="${rootStyle}">`;
  });
  const style = [
    '<style>',
    'svg{fill:currentColor}',
    // 外框仍是铺满表格的 rect，必须空心描边，否则会涂成一坨浅色。
    '[data-frame]{fill:none;stroke:currentColor;stroke-width:70px}',
    `.silk-math-caret,.silk-math-caret *{fill:${caret}!important;stroke:${caret}!important}`,
    '</style>',
  ].join('');
  return svg.replace(/(<svg\b[^>]*>)/i, `$1${style}`);
}

/** MathJax mtable 框线在 1000-unit em 下的线宽，对应官方 `stroke-width: 70px`。 */
const TABLE_RULE_STROKE_WIDTH = 70;

/**
 * VS Code 把 SVG 当图片画时：
 * 1. 外部 stylesheet 进不来，`rect[data-frame]` 会被 `fill:currentColor` 涂满；
 * 2. 列竖线是几何宽度为 0 的 `<line>`，光栅化时整根丢掉，`{cc|c}` 的 `|` 看不见。
 * 3. MathJax 把同一行边界上的 `\hline\hline` 覆盖成一根线，这里按 TeX 计数拆成紧致双线；
 *    已经画出来的 `||` 近距竖线收到大约一根线宽的间隙。
 * 外框改空心描边，`<line>` 改成有宽度的细矩形。
 */
function restyleTableRules(svg: string, expression: string): string {
  const withLines = svg.replace(
    /<line\b([^>]*)>\s*(?:<\/line>)?/gi,
    (_whole, attrs: string) => lineToRuleRect(attrs),
  );
  const withFrames = withLines.replace(
    /<rect\b([^>]*\bdata-frame\b[^>]*?)(\/?)>/gi,
    (_whole, attrs: string, slash: string) => {
      const cleaned = attrs.replace(/\s(?:fill|stroke|stroke-width)="[^"]*"/gi, '');
      return `<rect${cleaned} fill="none" stroke="currentColor" stroke-width="${TABLE_RULE_STROKE_WIDTH}"${slash}>`;
    },
  );
  const split = splitDoubleHlines(withFrames, expression);
  return applyTableCellSpans(compactPairedRules(split));
}

interface SvgRect {
  readonly start: number;
  readonly end: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly dataLine: string | undefined;
  readonly dataFrame: string | undefined;
  readonly fill: string | undefined;
}

export interface RootSpaceRule {
  readonly visualY: number;
  readonly visualHeight: number;
  readonly dataLine: string | undefined;
  readonly filled: boolean;
}

/**
 * 把表格线变到根 SVG 坐标。MathJax 的 `scale(1,-1)` 会翻 inner y，
 * 测试必须用这里的 visualY（更小的值更靠视口上方），不能用属性 y 的 Math.min。
 */
export function tableRulesInRootSpace(svg: string): RootSpaceRule[] {
  const rules: RootSpaceRule[] = [];
  const stack: Affine[] = [IDENTITY];
  const tag = /<g\b([^>]*)>|<\/g>|<rect\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(svg))) {
    const token = match[0];
    if (token.startsWith('</')) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const attrs = match[1] ?? match[2] ?? '';
    const local = parseTransform(attributeValue(attrs, 'transform'));
    const composed = multiplyAffine(stack[stack.length - 1] ?? IDENTITY, local);
    if (token.startsWith('<g')) {
      stack.push(composed);
      continue;
    }
    const x = numericAttribute(attrs, 'x') ?? 0;
    const y = numericAttribute(attrs, 'y') ?? 0;
    const width = numericAttribute(attrs, 'width') ?? 0;
    const height = numericAttribute(attrs, 'height') ?? 0;
    if (!(width > 0) || !(height > 0)) continue;
    const top = applyAffineToPoint(composed, x, y);
    const bottom = applyAffineToPoint(composed, x, y + height);
    const visualY = Math.min(top.y, bottom.y);
    const visualHeight = Math.abs(bottom.y - top.y);
    rules.push({
      visualY,
      visualHeight,
      dataLine: attributeValue(attrs, 'data-line'),
      filled: attributeValue(attrs, 'fill') !== 'none' && !attributeValue(attrs, 'data-frame'),
    });
  }
  return rules;
}

function parseSvgRects(svg: string): SvgRect[] {
  const rects: SvgRect[] = [];
  const tag = /<rect\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(svg))) {
    const attrs = match[1] ?? '';
    const x = numericAttribute(attrs, 'x') ?? 0;
    const y = numericAttribute(attrs, 'y') ?? 0;
    const width = numericAttribute(attrs, 'width') ?? 0;
    const height = numericAttribute(attrs, 'height') ?? 0;
    if (!(width > 0) || !(height > 0)) continue;
    rects.push({
      start: match.index,
      end: match.index + match[0].length,
      x,
      y,
      width,
      height,
      dataLine: attributeValue(attrs, 'data-line'),
      dataFrame: attributeValue(attrs, 'data-frame'),
      fill: attributeValue(attrs, 'fill'),
    });
  }
  return rects;
}

function isFilledHorizontalRule(rect: SvgRect): boolean {
  if (rect.dataFrame) return false;
  if (rect.dataLine === 'v') return false;
  if (rect.fill === 'none') return false;
  return rect.dataLine === 'h' || rect.width > rect.height * 2;
}

function isFilledVerticalRule(rect: SvgRect): boolean {
  if (rect.dataFrame) return false;
  if (rect.dataLine === 'h') return false;
  if (rect.fill === 'none') return false;
  return rect.dataLine === 'v' || rect.height > rect.width * 2;
}

function hlineRect(x: number, y: number, width: number, height: number): string {
  return `<rect data-line="h" x="${round2(x)}" y="${round2(y)}" width="${round2(width)}" height="${round2(height)}" fill="currentColor" stroke="none"/>`;
}

interface HorizontalSlot {
  readonly y: number;
  readonly height: number;
  readonly x: number;
  readonly width: number;
  readonly insertAt: number;
  readonly fromTop: boolean;
  readonly fromBottom: boolean;
  /** 已有填充的 `data-line=h`。框线/虚槽不算，双线必须再画满 count 根填充横线。 */
  readonly filled: boolean;
}

function collectHorizontalSlots(svg: string): HorizontalSlot[] {
  const rects = parseSvgRects(svg);
  const slots: HorizontalSlot[] = [];
  const seenY: number[] = [];
  const remember = (y: number): boolean => {
    if (seenY.some((existing) => Math.abs(existing - y) < TABLE_RULE_STROKE_WIDTH / 2)) return false;
    seenY.push(y);
    return true;
  };
  for (const rect of rects) {
    if (rect.dataFrame) {
      const stroke = TABLE_RULE_STROKE_WIDTH;
      // inner y 向上：rect.y 是表尾（min y），rect.y+height 是表首（max y）。
      const texBottomY = rect.y;
      const texTopY = rect.y + rect.height - stroke;
      if (remember(texTopY)) {
        slots.push({
          y: texTopY,
          height: stroke,
          x: rect.x,
          width: rect.width,
          insertAt: rect.end,
          fromTop: true,
          fromBottom: false,
          filled: false,
        });
      }
      if (remember(texBottomY)) {
        slots.push({
          y: texBottomY,
          height: stroke,
          x: rect.x,
          width: rect.width,
          insertAt: rect.end,
          fromTop: false,
          fromBottom: true,
          filled: false,
        });
      }
      continue;
    }
    if (!isFilledHorizontalRule(rect)) continue;
    if (!remember(rect.y)) continue;
    slots.push({
      y: rect.y,
      height: rect.height,
      x: rect.x,
      width: rect.width,
      insertAt: rect.end,
      fromTop: false,
      fromBottom: false,
      filled: true,
    });
  }
  // inner y 向上：max y 是 TeX 表首，排在最前。
  slots.sort((left, right) => right.y - left.y);
  if (slots.length > 0) {
    slots[0] = { ...slots[0]!, fromTop: true, fromBottom: slots.length === 1 };
    slots[slots.length - 1] = { ...slots[slots.length - 1]!, fromBottom: true, fromTop: slots.length === 1 };
  }
  return ensureEdgeSlots(svg, slots);
}

function tableRuleExtent(svg: string): { minX: number; minY: number; maxX: number; maxY: number } | undefined {
  const rects = parseSvgRects(svg);
  if (rects.length === 0) return undefined;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const rect of rects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return undefined;
  return { minX, minY, maxX, maxY };
}

/**
 * MathJax 表格规则画在 `scale(1,-1)` 里，inner y 向上。表首是 max inner y，
 * 表尾是 min inner y。虚槽插在已有 rect 后面，留在同一层翻转组里。
 */
function ensureEdgeSlots(svg: string, slots: HorizontalSlot[]): HorizontalSlot[] {
  const extent = tableRuleExtent(svg);
  if (!extent) return slots;
  const stroke = TABLE_RULE_STROKE_WIDTH;
  const rects = parseSvgRects(svg);
  const insertAt = rects.reduce((end, rect) => Math.max(end, rect.end), 0) || svg.length;
  const width = Math.max(stroke, extent.maxX - extent.minX);
  const near = (y: number): boolean => slots.some((slot) => Math.abs(slot.y - y) < stroke);
  const next = [...slots];
  const texTopY = extent.maxY - stroke;
  if (!near(texTopY) && Math.abs(texTopY - extent.minY) > stroke) {
    next.push({
      y: texTopY,
      height: stroke,
      x: extent.minX,
      width,
      insertAt,
      fromTop: true,
      fromBottom: false,
      filled: false,
    });
  }
  if (!near(extent.minY)) {
    next.push({
      y: extent.minY,
      height: stroke,
      x: extent.minX,
      width,
      insertAt,
      fromTop: false,
      fromBottom: true,
      filled: false,
    });
  }
  next.sort((left, right) => right.y - left.y);
  if (next.length > 0) {
    next[0] = { ...next[0]!, fromTop: true, fromBottom: next.length === 1 };
    next[next.length - 1] = { ...next[next.length - 1]!, fromBottom: true, fromTop: next.length === 1 };
  }
  return next;
}

function slotForHlinePlace(
  slots: readonly HorizontalSlot[],
  place: 'top' | 'inner' | 'bottom',
  innerIndex: number,
): HorizontalSlot | undefined {
  if (slots.length === 0) return undefined;
  // slots 已按 inner y 从大到小排：表首（max y）在前。
  if (place === 'top') return slots[0];
  if (place === 'bottom') return slots[slots.length - 1];
  const inners = slots.filter((slot) => !slot.fromTop && !slot.fromBottom);
  if (inners.length > 0) return inners[Math.min(innerIndex, inners.length - 1)];
  if (slots.length >= 3) return slots[Math.min(1 + innerIndex, slots.length - 2)];
  return slots[Math.min(innerIndex + 1, slots.length - 1)] ?? slots[0];
}

/**
 * MathJax 的 `\hline` 写进 `rowlines[i]`，第二条会覆盖第一条。
 * 只把 count≥2 的边界配对到对应可见线：inner y 向上，TeX 表首是 max y，
 * `scale(1,-1)` 之后才是视口上方。框线不是填充横线，表首双线必须再画出
 * 两根 `data-line=h`。不要按含 0 的计数 1:1 对齐槽位。
 */
function splitDoubleHlines(svg: string, expression: string): string {
  const doubles = parseArrayHlineBoundaries(expression).filter((boundary) => boundary.count >= 2);
  if (doubles.length === 0) return svg;
  const slots = collectHorizontalSlots(svg);
  if (slots.length === 0) return svg;
  const insertions: Array<{ readonly at: number; readonly html: string }> = [];
  let innerIndex = 0;
  for (const boundary of doubles) {
    const slot = slotForHlinePlace(slots, boundary.place, innerIndex);
    if (boundary.place === 'inner') innerIndex += 1;
    if (!slot) continue;
    const stroke = slot.height > 0 ? slot.height : TABLE_RULE_STROKE_WIDTH;
    const gap = stroke;
    // 表首在 max inner y，朝表内是 y 减小；表尾在 min y，朝表内是 y 增大。
    const inward = slot.fromTop && !slot.fromBottom ? -1 : 1;
    const existing = slot.filled ? 1 : 0;
    const extras = Math.min(MAX_DOUBLE_RULE_EXTRAS, Math.max(0, boundary.count - existing));
    let html = '';
    const start = slot.filled ? 1 : 0;
    for (let extra = start; extra < start + extras; extra += 1) {
      html += hlineRect(slot.x, slot.y + inward * extra * (stroke + gap), slot.width, stroke);
    }
    if (html) insertions.push({ at: slot.insertAt, html });
  }
  insertions.sort((left, right) => right.at - left.at);
  let next = svg;
  for (const insertion of insertions) {
    next = `${next.slice(0, insertion.at)}${insertion.html}${next.slice(insertion.at)}`;
  }
  return next;
}

const MAX_DOUBLE_RULE_EXTRAS = 3;
/** 近距平行线的配对上限：小于半个 em，避免把相邻列/行的线拉到一起。 */
const PAIR_GAP_LIMIT = 500;

function verticalsOverlap(left: SvgRect, right: SvgRect): boolean {
  const top = Math.max(left.y, right.y);
  const bottom = Math.min(left.y + left.height, right.y + right.height);
  return bottom - top > Math.min(left.height, right.height) * 0.5;
}

function horizontalsOverlap(left: SvgRect, right: SvgRect): boolean {
  const start = Math.max(left.x, right.x);
  const end = Math.min(left.x + left.width, right.x + right.width);
  return end - start > Math.min(left.width, right.width) * 0.5;
}

/**
 * 已经画成两根的 `||` / 拆开后的双横线，把间隙收到大约一根线宽。
 * 只配对同向、共轴、间隙小于半个 em 的连续线，复杂表里不相邻的线不动。
 */
function compactPairedRules(svg: string): string {
  const rects = parseSvgRects(svg);
  const replacements: Array<{ readonly start: number; readonly end: number; readonly html: string }> = [];
  const verticals = rects.filter(isFilledVerticalRule).sort((left, right) => left.x - right.x || left.y - right.y);
  for (let index = 0; index < verticals.length - 1; index += 1) {
    const first = verticals[index]!;
    const second = verticals[index + 1]!;
    if (!verticalsOverlap(first, second)) continue;
    const gap = second.x - (first.x + first.width);
    if (!(gap > 0) || gap > PAIR_GAP_LIMIT) continue;
    const desired = Math.min(first.width, second.width, TABLE_RULE_STROKE_WIDTH);
    if (gap <= desired + 1) continue;
    const x = first.x + first.width + desired;
    replacements.push({
      start: second.start,
      end: second.end,
      html: `<rect data-line="v" x="${round2(x)}" y="${round2(second.y)}" width="${round2(second.width)}" height="${round2(second.height)}" fill="currentColor" stroke="none"/>`,
    });
  }
  const horizontals = rects.filter(isFilledHorizontalRule).sort((left, right) => left.y - right.y || left.x - right.x);
  for (let index = 0; index < horizontals.length - 1; index += 1) {
    const first = horizontals[index]!;
    const second = horizontals[index + 1]!;
    if (!horizontalsOverlap(first, second)) continue;
    const gap = second.y - (first.y + first.height);
    if (!(gap > 0) || gap > PAIR_GAP_LIMIT) continue;
    const desired = Math.min(first.height, second.height, TABLE_RULE_STROKE_WIDTH);
    if (gap <= desired + 1) continue;
    const y = first.y + first.height + desired;
    replacements.push({
      start: second.start,
      end: second.end,
      html: `<rect data-line="h" x="${round2(second.x)}" y="${round2(y)}" width="${round2(second.width)}" height="${round2(second.height)}" fill="currentColor" stroke="none"/>`,
    });
  }
  replacements.sort((left, right) => right.start - left.start);
  let next = svg;
  for (const replacement of replacements) {
    next = `${next.slice(0, replacement.start)}${replacement.html}${next.slice(replacement.end)}`;
  }
  return next;
}

function matchingGroupClose(svg: string, openStart: number): number | undefined {
  const openEnd = svg.indexOf('>', openStart);
  if (openEnd < 0) return undefined;
  let depth = 1;
  const tag = /<g\b[^>]*>|<\/g>/gi;
  tag.lastIndex = openEnd + 1;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(svg))) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return match.index + match[0].length;
  }
  return undefined;
}

function translateAttribute(openTag: string, name: 'x' | 'y'): number {
  const transform = /\btransform="([^"]*)"/i.exec(openTag)?.[1] ?? '';
  const match = name === 'x'
    ? /translate\(\s*([-\d.]+)/i.exec(transform)
    : /translate\(\s*[-\d.]+\s*,\s*([-\d.]+)/i.exec(transform);
  return Number(match?.[1] ?? 0);
}

function withLeadingTranslate(openTag: string, dx: number, dy: number): string {
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return openTag;
  const extra = `translate(${round2(dx)},${round2(dy)})`;
  if (/\btransform="/i.test(openTag)) {
    return openTag.replace(/\btransform="([^"]*)"/i, (_whole, value: string) => `transform="${extra} ${value}"`);
  }
  return openTag.replace(/\/?>$/, (end) => ` transform="${extra}"${end}`);
}

interface TableSvgCell {
  readonly x: number;
  readonly start: number;
  readonly end: number;
  readonly openEnd: number;
}

interface TableSvgRow {
  readonly y: number;
  readonly cells: readonly TableSvgCell[];
}

function parseTableRows(svg: string): TableSvgRow[] {
  const rows: TableSvgRow[] = [];
  const mtr = /<g\b([^>]*\bdata-mml-node="mtr"[^>]*)>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = mtr.exec(svg))) {
    const rowOpen = rowMatch.index;
    const rowEnd = matchingGroupClose(svg, rowOpen);
    if (rowEnd === undefined) continue;
    const slice = svg.slice(rowOpen, rowEnd);
    const cells: TableSvgCell[] = [];
    const mtd = /<g\b([^>]*\bdata-mml-node="mtd"[^>]*)>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = mtd.exec(slice))) {
      const local = cellMatch.index;
      const abs = rowOpen + local;
      const cellEnd = matchingGroupClose(svg, abs);
      if (cellEnd === undefined) continue;
      const openEnd = svg.indexOf('>', abs) + 1;
      cells.push({
        x: translateAttribute(cellMatch[0], 'x'),
        start: abs,
        end: cellEnd,
        openEnd,
      });
    }
    rows.push({ y: translateAttribute(rowMatch[0], 'y'), cells });
    mtr.lastIndex = rowEnd;
  }
  return rows;
}

/**
 * `\multicolumn` / `\multirow` 在 TeX 里用 class 标出跨度。MathJax array 没有真正的
 * 合并单元格，这里按相邻 mtd/mtr 的 translate 把内容移到合并区域中心。
 */
function applyTableCellSpans(svg: string): string {
  const marked = [...svg.matchAll(/<g\b([^>]*\bsilk-span-c\d+-r\d+-[lcr][^>]*)>/gi)];
  if (marked.length === 0) return svg;
  const rows = parseTableRows(svg);
  if (rows.length === 0) return svg;
  const edits: Array<{ readonly start: number; readonly end: number; readonly html: string }> = [];
  for (const mark of marked) {
    const className = attributeValue(mark[1] ?? '', 'class') ?? '';
    const span = parseSpanClass(className);
    if (!span || mark.index === undefined) continue;
    const markStart = mark.index;
    let rowIndex = -1;
    let cellIndex = -1;
    for (let r = 0; r < rows.length; r += 1) {
      const row = rows[r]!;
      for (let c = 0; c < row.cells.length; c += 1) {
        const cell = row.cells[c]!;
        if (markStart >= cell.start && markStart < cell.end) {
          rowIndex = r;
          cellIndex = c;
          break;
        }
      }
      if (rowIndex >= 0) break;
    }
    if (rowIndex < 0 || cellIndex < 0) continue;
    const row = rows[rowIndex]!;
    const origin = row.cells[cellIndex]!;
    const lastCol = Math.min(row.cells.length - 1, cellIndex + span.colspan - 1);
    const lastRow = Math.min(rows.length - 1, rowIndex + span.rowspan - 1);
    const startX = origin.x;
    const endX = row.cells[lastCol]?.x ?? origin.x;
    const startY = row.y;
    const endY = rows[lastRow]?.y ?? row.y;
    const dx = span.align === 'l'
      ? 0
      : span.align === 'r'
        ? endX - startX
        : (endX - startX) / 2;
    const dy = (endY - startY) / 2;
    const openEnd = svg.indexOf('>', markStart) + 1;
    edits.push({
      start: markStart,
      end: openEnd,
      html: withLeadingTranslate(svg.slice(markStart, openEnd), dx, dy),
    });
  }
  edits.sort((left, right) => right.start - left.start);
  let next = svg;
  for (const edit of edits) {
    next = `${next.slice(0, edit.start)}${edit.html}${next.slice(edit.end)}`;
  }
  return next;
}

function lineToRuleRect(attrs: string): string {
  const x1 = numericAttribute(attrs, 'x1') ?? 0;
  const y1 = numericAttribute(attrs, 'y1') ?? 0;
  const x2 = numericAttribute(attrs, 'x2') ?? 0;
  const y2 = numericAttribute(attrs, 'y2') ?? 0;
  const strokeWidth = numericAttribute(attrs, 'stroke-width') ?? TABLE_RULE_STROKE_WIDTH;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (!(strokeWidth > 0) || (dx === 0 && dy === 0)) return '';
  const className = attributeValue(attrs, 'class');
  const vertical = Math.abs(dx) < Math.abs(dy);
  const dataLine = attributeValue(attrs, 'data-line') ?? (vertical ? 'v' : 'h');
  const classAttr = className ? ` class="${className}"` : '';
  const dataAttr = ` data-line="${dataLine}"`;
  const x = vertical ? x1 - strokeWidth / 2 : Math.min(x1, x2);
  const y = vertical ? Math.min(y1, y2) : y1 - strokeWidth / 2;
  const width = vertical ? strokeWidth : Math.abs(dx);
  const height = vertical ? Math.abs(dy) : strokeWidth;
  return `<rect${dataAttr}${classAttr} x="${round2(x)}" y="${round2(y)}" width="${round2(width)}" height="${round2(height)}" fill="currentColor" stroke="none"/>`;
}

/**
 * 把根节点尺寸改写为像素。`ex` 在独立 SVG 图片里按默认 16px 字体解析，
 * 与编辑器字体的 `ex` 不是同一个长度；两侧都换成像素后，浮层背景才能
 * 与公式逐像素对齐，右侧和下沿都不会再溢出。
 */
function withPixelSize(svg: string, widthPx: number, heightPx: number): string {
  return svg.replace(/<svg\b([^>]*)>/i, (_whole, attrs: string) => {
    const rest = attrs
      .replace(ATTRIBUTE('width'), '')
      .replace(ATTRIBUTE('height'), '')
      .trimEnd();
    return `<svg${rest} width="${widthPx}px" height="${heightPx}px">`;
  });
}

/**
 * MathJax 没有的纯排版/引用命令：真实文档里很常见，缺一个就整条公式渲染不出来。
 * 这里给出语义最接近的近似，宁可样式略有出入也要让公式显示出来。
 */
const COMPATIBILITY_PRELUDE = [
  String.raw`\def\ensuremath#1{#1}`,
  String.raw`\def\emph#1{\textit{#1}}`,
  String.raw`\def\textsuperscript#1{^{\text{#1}}}`,
  String.raw`\def\textsubscript#1{_{\text{#1}}}`,
  String.raw`\def\bm#1{\boldsymbol{#1}}`,
  String.raw`\def\cref#1{\ref{#1}}`,
  String.raw`\def\Cref#1{\ref{#1}}`,
  String.raw`\def\autoref#1{\ref{#1}}`,
  String.raw`\def\footnote#1{}`,
  String.raw`\def\footnotemark{}`,
  String.raw`\def\intertext#1{}`,
  String.raw`\def\shortintertext#1{}`,
  String.raw`\def\allowdisplaybreaks{}`,
  String.raw`\def\displaybreak{}`,
  String.raw`\def\centering{}`,
  String.raw`\def\raggedright{}`,
  String.raw`\def\raggedleft{}`,
  String.raw`\def\noindent{}`,
  String.raw`\def\refstepcounter#1{}`,
  String.raw`\def\setlength#1#2{}`,
  String.raw`\def\vspace#1{}`,
  String.raw`\def\arraybackslash{}`,
].join('\n');

function createRenderContext(markUnknownCommands: boolean): RenderContext {
  const tex = new TeX({
    // noundefined 把未定义命令渲染成红色原文，一个笔误不再让整条公式消失。
    packages: [
      'base', 'ams', 'begingroup', 'newcommand', 'color', 'html', 'boldsymbol', 'cancel',
      ...(markUnknownCommands ? ['noundefined'] : []),
    ],
    begingroup: { allowGlobal: [] },
    maxBuffer: MAX_TEX_BUFFER,
    maxMacros: 2000,
    formatError(_jax: unknown, error: Error): never {
      throw error;
    },
  });
  return {
    document: mathjax.document('', { InputJax: tex, OutputJax: SHARED_OUTPUT }),
    adaptor: SHARED_ADAPTOR,
    tex,
  };
}

function applyPrelude(context: RenderContext, prelude: string): void {
  context.document.convert(prelude, {
    display: false,
    em: EM,
    ex: EX,
    containerWidth: WIDTH,
  });
  context.tex.reset();
}

class ContextPool {
  private readonly contexts = new Map<string, RenderContext>();

  private static key(fingerprint: string, markUnknownCommands: boolean): string {
    return `${markUnknownCommands ? 'nu' : 'strict'}|${fingerprint}`;
  }

  get(fingerprint: string, prelude: string, markUnknownCommands: boolean): RenderContext {
    const key = ContextPool.key(fingerprint, markUnknownCommands);
    const existing = this.contexts.get(key);
    if (existing) {
      this.contexts.delete(key);
      this.contexts.set(key, existing);
      return existing;
    }
    const context = this.create(prelude, markUnknownCommands);
    this.contexts.set(key, context);
    while (this.contexts.size > MAX_CONTEXTS) {
      const oldest = this.contexts.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.contexts.delete(oldest);
    }
    return context;
  }

  /**
   * 单条定义写法 MathJax 不接受时，不能让整份自定义定义作废：整体转换失败后
   * 换一个干净上下文逐条重试，只丢掉真正无法转换的那几行。
   */
  private create(prelude: string, markUnknownCommands: boolean): RenderContext {
    const context = createRenderContext(markUnknownCommands);
    applyPrelude(context, COMPATIBILITY_PRELUDE);
    const user = prelude.trim();
    if (!user) return context;
    try {
      applyPrelude(context, user);
      return context;
    } catch {
      const recovered = createRenderContext(markUnknownCommands);
      applyPrelude(recovered, COMPATIBILITY_PRELUDE);
      for (const line of user.split('\n')) {
        const statement = line.trim();
        if (!statement) continue;
        try {
          applyPrelude(recovered, statement);
        } catch {
          // 跳过这一条定义，其余定义继续可用。
        }
      }
      return recovered;
    }
  }

  /** 仅驱逐调用方实际使用的实例，避免未来异步化后误删同 fingerprint 的替换项。 */
  evict(fingerprint: string, markUnknownCommands: boolean, expected: RenderContext): void {
    const key = ContextPool.key(fingerprint, markUnknownCommands);
    if (this.contexts.get(key) === expected) {
      this.contexts.delete(key);
    }
  }

  clear(): void {
    this.contexts.clear();
  }
}

export class MathJaxSvgRenderer {
  private readonly pool = new ContextPool();

  render(options: SvgRenderOptions): SvgRenderResult {
    if (/\\begingroup(?:Sandbox|Reset)\b/.test(options.expression)) {
      throw new Error('公式使用了 Silk Math 保留的 TeX 隔离命令');
    }
    const context = this.pool.get(
      options.definitionFingerprint,
      options.definitionPrelude,
      options.markUnknownCommands,
    );
    try {
      // `\\begingroupSandbox` isolates definitions by treating the next TeX atom as
      // the complete sandbox.  Passing the expression without braces therefore
      // rendered only its first atom (for example, `u\\equiv-1` became just `u`).
      // Keep the whole live expression inside that single isolated atom.
      // 未写完的括号/命令只补渲染副本，避免 MathJax 失败把上下文整份驱逐。
      const recovered = recoverIncompleteTex(options.expression);
      const expression = `\\begingroupSandbox {${recovered}}`;
      const node = context.document.convert(expression, {
        display: options.displayMode,
        em: EM,
        ex: EX,
        containerWidth: WIDTH,
      });
      const raw = context.adaptor.outerHTML(node);
      const svg = sanitizeStandaloneSvg(raw, options.foreground, options.caretColor, recovered);
      if (Buffer.byteLength(svg, 'utf8') > MAX_SVG_BYTES) {
        throw new Error('公式生成的 SVG 超过 2 MiB，已停止显示以保护编辑器性能');
      }
      const openTag = svg.match(/^<svg\b[^>]*>/i)?.[0] ?? '';
      const widthLength = extractLength(openTag, 'width');
      const heightLength = extractLength(openTag, 'height');
      const viewBoxWidth = extractViewBoxDimension(openTag, 0);
      const viewBoxHeight = extractViewBoxDimension(openTag, 1);
      const width = widthLength ?? (viewBoxWidth !== undefined ? `${viewBoxWidth}px` : undefined);
      const height = heightLength ?? (viewBoxHeight !== undefined ? `${viewBoxHeight}px` : undefined);
      const widthEx = numericEx(width, 1);
      const heightEx = numericEx(height, 1);
      if (!(options.exPx > 0)) {
        return { svg, widthPx: round2(widthEx * EX), heightPx: round2(heightEx * EX) };
      }
      // MathJax 的 scale 转换选项不影响独立 SVG 的尺寸，缩放统一落在根节点像素上。
      const scale = Number.isFinite(options.scale) && options.scale > 0 ? options.scale : 1;
      const naturalWidth = widthEx * options.exPx * scale;
      const limit = MAX_PANEL_EX * options.exPx;
      // 过宽的公式等比缩小到上限，而不是把背景截断在上限处。
      const shrink = naturalWidth > limit ? limit / naturalWidth : 1;
      const widthPx = round2(naturalWidth * shrink);
      const heightPx = round2(heightEx * options.exPx * scale * shrink);
      return { svg: withPixelSize(svg, widthPx, heightPx), widthPx, heightPx };
    } catch (error) {
      // MathJax 的失败转换可能留下未闭合 parser/group 状态；下一帧必须从干净上下文恢复。
      this.pool.evict(options.definitionFingerprint, options.markUnknownCommands, context);
      throw error;
    }
  }

  clear(): void {
    this.pool.clear();
  }
}
