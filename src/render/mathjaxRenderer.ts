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
  const [xMin, yMin, xMax, yMax] = values;
  if (xMin === undefined || yMin === undefined || xMax === undefined || yMax === undefined) return undefined;
  const width = xMax - xMin;
  const height = yMax - yMin;
  const dimension = axis === 0 ? width : height;
  return Number.isFinite(dimension) ? dimension : undefined;
}

/**
 * MathJax 的输出只作为本地图片使用。这里移除可导航/可执行节点和属性，
 * 并把主题色与私有 caret 样式写进独立 SVG。
 */
export function sanitizeStandaloneSvg(raw: string, foreground: string, caretColor: string): string {
  const svgMatch = raw.match(/<svg\b[\s\S]*?<\/svg>/i);
  if (!svgMatch) throw new Error('MathJax 未返回 SVG');

  const fg = escapeCssColor(foreground, '#d4d4d4');
  const caret = escapeCssColor(caretColor, '#ffb454');
  let svg = svgMatch[0]
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<image\b[^>]*\/?\s*>/gi, '')
    .replace(/<\/?a\b[^>]*>/gi, '')
    .replace(/\s(?:on\w+|href|xlink:href)=(['"])[\s\S]*?\1/gi, '')
    .replace(/\sdata-(?:latex|semantic[^=\s]*)=(['"])[\s\S]*?\1/gi, '');

  svg = sanitizeStyleAttributes(svg);

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
  const style = `<style>svg{fill:currentColor}.silk-math-caret,.silk-math-caret *{fill:${caret}!important;stroke:${caret}!important}</style>`;
  return svg.replace(/(<svg\b[^>]*>)/i, `$1${style}`);
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
      const expression = `\\begingroupSandbox {${options.expression}}`;
      const node = context.document.convert(expression, {
        display: options.displayMode,
        em: EM,
        ex: EX,
        containerWidth: WIDTH,
      });
      const raw = context.adaptor.outerHTML(node);
      const svg = sanitizeStandaloneSvg(raw, options.foreground, options.caretColor);
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
