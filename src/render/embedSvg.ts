/**
 * 表格单元格里的 TikZ 图形由独立 TeX 引擎画成 SVG；这里把它们放进 MathJax 表格中
 * `\class{silk-embed-N}{\rule…}` 留出的透明框。只做几何变换和主题配色，不重新排版。
 */

const BLACK = /^(?:#000(?:000)?|black|rgb\(\s*0%?\s*,\s*0%?\s*,\s*0%?\s*\))$/i;
const WHITE = /^(?:#fff(?:fff)?|white|rgb\(\s*(?:255|100%)\s*,\s*(?:255|100%)\s*,\s*(?:255|100%)\s*\))$/i;
const PAINT_ATTRIBUTE = /\s(fill|stroke|color|stop-color)="([^"]*)"/g;

function isLightColor(color: string): boolean {
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color.trim())?.[1];
  if (!hex) return false;
  const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex;
  const [r, g, b] = [0, 2, 4].map((at) => Number.parseInt(full.slice(at, at + 2), 16) / 255);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.5;
}

function numberAttribute(tag: string, name: string): number | undefined {
  const value = new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
  const parsed = value === undefined ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

interface EmbedBody {
  readonly content: string;
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
}

/** 取出 TikZ SVG 的内容：去掉白色背景、黑色跟随主题前景、id 加前缀避免多个图形互相引用。 */
function embedBody(svg: string, index: number, darkTheme: boolean): EmbedBody | undefined {
  const open = /^<svg\b[^>]*>/i.exec(svg.trim());
  const close = svg.lastIndexOf('</svg>');
  if (!open || close < 0) return undefined;
  const viewBox = /\sviewBox="([^"]*)"/.exec(open[0])?.[1]?.trim().split(/[\s,]+/).map(Number);
  if (!viewBox || viewBox.length !== 4 || viewBox.some((n) => !Number.isFinite(n)) || !(viewBox[2]! > 0) || !(viewBox[3]! > 0)) {
    return undefined;
  }
  const prefix = `silk-e${index}-`;
  let content = svg.trim().slice(open[0].length, svg.trim().lastIndexOf('</svg>'))
    .replace(/<rect\b[^>]*\bdata-bgcolor="#fff"[^>]*\/>/i, '')
    .replace(/\sid="([^"]+)"/g, (_m, id: string) => ` id="${prefix}${id}"`)
    .replace(/(\s(?:xlink:)?href=")#([^"]+)"/g, (_m, head: string, id: string) => `${head}#${prefix}${id}"`)
    .replace(/url\(#([\w:.-]+)\)/g, (_m, id: string) => `url(#${prefix}${id})`)
    .replace(PAINT_ATTRIBUTE, (whole, name: string, value: string) => {
      if (BLACK.test(value.trim())) return ` ${name}="currentColor"`;
      // 深色主题里白色遮挡/底色会变成刺眼的色块；交叉线的留白退化为直接相交。
      if (darkTheme && WHITE.test(value.trim()) && name !== 'stop-color') return ` ${name}="none"`;
      return whole;
    });
  // 根节点上的描边默认值也要保留（例如 stroke-miterlimit）。
  const rootPaint = [...open[0].matchAll(/\s((?:fill|stroke)(?:-[a-z]+)?)="([^"]*)"/g)]
    .map((match) => ` ${match[1]}="${BLACK.test(match[2]!.trim()) ? 'currentColor' : match[2]}"`).join('');
  if (rootPaint) content = `<g${rootPaint}>${content}</g>`;
  return { content, minX: viewBox[0]!, minY: viewBox[1]!, width: viewBox[2]!, height: viewBox[3]! };
}

export function composeTableEmbeds(svg: string, embeds: readonly string[], foreground: string): string {
  if (embeds.length === 0 || !svg.includes('silk-embed-')) return svg;
  const darkTheme = isLightColor(foreground);
  let usesXlink = false;
  const composed = svg.replace(
    /(<g\b[^>]*\bclass="(?:[^"]*\s)?silk-embed-(\d+)(?:\s[^"]*)?"[^>]*>(?:\s*<g\b[^>]*>)*\s*)<rect\b([^>]*)\/>/g,
    (whole, head: string, digits: string, attrs: string) => {
      const source = embeds[Number(digits)];
      if (!source) return whole;
      const body = embedBody(source, Number(digits), darkTheme);
      const width = numberAttribute(` ${attrs}`, 'width');
      const height = numberAttribute(` ${attrs}`, 'height');
      if (!body || !width || !height) return whole;
      const x = numberAttribute(` ${attrs}`, 'x') ?? 0;
      const y = numberAttribute(` ${attrs}`, 'y') ?? 0;
      if (body.content.includes('xlink:href')) usesXlink = true;
      // MathJax 内部是 y 轴向上的坐标（根节点 scale(1,-1)），TikZ SVG 是 y 向下。
      // 占位框按 pt 四舍五入；比例只差舍入误差时取同一缩放，保证描边等比（PNG 复制依赖这一点）。
      let sx = width / body.width;
      let sy = height / body.height;
      if (Math.abs(sx - sy) <= 1e-3 * Math.max(sx, sy)) sx = sy = (sx + sy) / 2;
      const transform = `translate(${x},${y + height}) scale(${sx},${-sy}) translate(${-body.minX},${-body.minY})`;
      return `${head}<g data-silk-embed="${digits}" transform="${transform}">${body.content}</g>`;
    },
  );
  if (!usesXlink || /^<svg\b[^>]*\sxmlns:xlink=/i.test(composed)) return composed;
  return composed.replace(/^<svg\b/i, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
}
