export interface PreviewCss {
  readonly declarations: string;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly maxWidth?: string;
  readonly maxHeight?: number;
  readonly anchor?: 'formula' | 'cursor' | 'selection';
  readonly placement?: 'above' | 'below' | 'right';
  readonly gap?: { readonly value: number; readonly unit: 'px' | 'lh' };
  readonly allowOverlap?: boolean;
  readonly fontSize?: { readonly value: number; readonly unit: 'px' | '%' };
  readonly padding?: readonly number[];
  readonly borderWidth?: number;
}

const EMPTY: PreviewCss = { declarations: '', offsetX: 0, offsetY: 0 };
const APPEARANCE = new Set(['background-color', 'border', 'border-color', 'border-radius', 'box-shadow', 'opacity', 'padding']);

/** 只接受预览框自己的声明；不能通过设置注入其他编辑器选择器或远程资源。 */
export function parsePreviewCss(source: string): PreviewCss {
  if (source.length > 8192) throw new Error('CSS 最多 8192 字符 / CSS is limited to 8192 characters');
  let body = source.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  if (!body) return EMPTY;
  if (body.startsWith('.silk-math-preview')) {
    const match = /^\.silk-math-preview\s*\{([^{}]*)\}\s*$/.exec(body);
    if (!match) throw new Error('只支持 .silk-math-preview { … } / Only .silk-math-preview is supported');
    body = match[1]!;
  }
  const result: { -readonly [K in keyof PreviewCss]: PreviewCss[K] } = { ...EMPTY };
  const declarations: string[] = [];
  for (const part of body.split(';')) {
    if (!part.trim()) continue;
    const match = /^\s*([a-z-]+)\s*:\s*([^{};]+?)\s*$/i.exec(part);
    if (!match) throw new Error(`无效 CSS 声明 / Invalid CSS declaration: ${part.slice(0, 60)}`);
    const property = match[1]!.toLowerCase();
    const value = match[2]!.trim();
    if (property === '--silk-anchor') {
      if (value !== 'formula' && value !== 'cursor' && value !== 'selection') throw new Error('--silk-anchor: formula | cursor | selection');
      result.anchor = value;
    } else if (property === '--silk-placement') {
      if (value !== 'above' && value !== 'below' && value !== 'right') throw new Error('--silk-placement: above | below | right');
      result.placement = value;
    } else if (property === '--silk-allow-overlap') {
      if (value !== 'true' && value !== 'false') throw new Error('--silk-allow-overlap: true | false');
      result.allowOverlap = value === 'true';
    } else if (property === '--silk-gap') {
      const length = /^(\d+(?:\.\d+)?)(px|lh)$/.exec(value === '0' ? '0px' : value);
      if (!length || Number(length[1]) > (length[2] === 'lh' ? 20 : 1000)) throw new Error('--silk-gap: 0–20lh / 0–1000px');
      result.gap = { value: Number(length[1]), unit: length[2] as 'px' | 'lh' };
    } else if (property === 'font-size') {
      const length = /^(\d+(?:\.\d+)?)(px|%)$/.exec(value);
      const size = Number(length?.[1]);
      if (!length || size < (length[2] === 'px' ? 6 : 25) || size > (length[2] === 'px' ? 96 : 400)) throw new Error('font-size: 6–96px / 25–400%');
      result.fontSize = { value: size, unit: length[2] as 'px' | '%' };
    } else if (property === '--silk-offset-x' || property === '--silk-offset-y') {
      if (!/^-?\d+(?:\.\d+)?px$/.test(value) || Math.abs(parseFloat(value)) > 2000) {
        throw new Error(`${property}: 使用 -2000px 到 2000px / Use -2000px to 2000px`);
      }
      result[property.endsWith('-x') ? 'offsetX' : 'offsetY'] = parseFloat(value);
    } else if (property === 'max-width') {
      if (!/^\d+(?:\.\d+)?(px|%)$/.test(value) || parseFloat(value) <= 0 || parseFloat(value) > 10000) {
        throw new Error('max-width: 使用正数 px 或 % / Use a positive px or % value');
      }
      result.maxWidth = value;
    } else if (property === 'max-height') {
      if (!/^\d+(?:\.\d+)?px$/.test(value) || parseFloat(value) <= 0 || parseFloat(value) > 10000) {
        throw new Error('max-height: 使用 0 到 10000px 之间的正数 / Use a positive value up to 10000px');
      }
      result.maxHeight = parseFloat(value);
    } else {
      if (!APPEARANCE.has(property)) throw new Error(`不支持的预览 CSS 属性 / Unsupported preview CSS property: ${property}`);
      // 颜色、主题变量和长度函数足够定制外观；不允许转义、字符串或资源函数。
      const functions = [...value.matchAll(/([a-z-]+)\s*\(/gi)].map((item) => item[1]!.toLowerCase());
      if (!/^[\w\s#.,()%+\/-]+$/.test(value)
        || functions.some((name) => !['var', 'rgb', 'rgba', 'hsl', 'hsla', 'oklch', 'calc', 'min', 'max', 'clamp'].includes(name))) {
        throw new Error(`无效 CSS 值 / Invalid CSS value: ${property}`);
      }
      let depth = 0;
      for (const character of value) {
        if (character === '(') depth += 1;
        if (character === ')' && --depth < 0) break;
      }
      if (depth !== 0) throw new Error(`CSS 括号未配对 / Unbalanced CSS parentheses: ${property}`);
      // 外边距/变换会绕过限位；内边距限制在合理范围内。
      if (property === 'padding' && (!/^(\d+(?:\.\d+)?px)(\s+\d+(?:\.\d+)?px){0,3}$/.test(value)
        || value.split(/\s+/).some((item) => parseFloat(item) > 24))) {
        throw new Error('padding: 每边使用 0px 到 24px / Use 0px to 24px per side');
      }
      if (property === 'border' && value !== 'none' && value !== '0'
        && (!/^\d+(?:\.\d+)?px\s+(solid|dashed|dotted|double)\s+.+$/.test(value) || parseFloat(value) > 8)) {
        throw new Error('border: 使用 0px 到 8px 的边框 / Use a border up to 8px, e.g. 1px solid #888');
      }
      if (property === 'padding') result.padding = value.split(/\s+/).map(parseFloat);
      if (property === 'border') result.borderWidth = parseFloat(value) || 0;
      declarations.push(`${property}: ${value} !important`);
    }
  }
  result.declarations = declarations.join('; ');
  return result;
}

/** 模板、补全与悬停共享同一份双语说明，避免默认值和使用方法不一致。 */
export const PREVIEW_CSS_OPTIONS = [
  ['--silk-anchor', ['formula', 'cursor', 'selection'], '定位基准，默认 formula：整块公式；cursor：光标所在行；selection：选区，空选区使用光标。\nAnchor, default formula: whole formula; cursor: caret line; selection: selected range, or caret if empty.'],
  ['--silk-placement', ['below', 'above', 'right'], '显示方向：below 下方 / above 上方 / right 右侧；未设置时跟随 Silk Math 菜单。软换行且禁止覆盖时，右侧退回下方。\nSide: below / above / right; follows the Silk Math menu when unset. With word wrap and no overlap, right falls back below.'],
  ['--silk-gap', ['1lh', '2lh', '8px', '0px'], '与基准边缘的间隔，默认 2px；可用 0–20lh 或 0–1000px。1lh 是编辑器一行的高度，不随预览字号改变。\nGap from the anchor edge, default 2px; use 0–20lh or 0–1000px. 1lh is one editor line, independent of preview font size.'],
  ['--silk-allow-overlap', ['false', 'true'], 'false 让开整块源码公式，即使基准是光标或选区、偏移朝向公式；true 允许覆盖。设置 anchor、placement、gap 或 allow-overlap 后默认 false；这四项均未设置时保留原来的允许覆盖行为。\nfalse protects the entire source formula even with caret/selection anchors or inward offsets; true allows overlap. Defaults to false when anchor, placement, gap or allow-overlap is set; otherwise keeps legacy overlap.'],
  ['font-size', ['24px', '120%', '100%'], '公式字号：6–96px，或原预览的 25–400%；默认跟随菜单缩放，100% 保持原大小。缩放矢量图片，TikZ 缩放整图，不改源码。\nMath size: 6–96px or 25–400% of the original preview; follows menu zoom by default, 100% keeps its size. Scales the vector image (the whole TikZ image), never source text.'],
  ['--silk-offset-x', ['0px', '-40px', '40px'], '左右偏移，默认 0px；-2000px 到 2000px，负值向左，正值向右。仍限制在编辑器内。\nHorizontal offset, default 0px; -2000px to 2000px, negative left, positive right. Stays inside the editor.'],
  ['--silk-offset-y', ['0px', '-20px', '20px'], '上下偏移，默认 0px；-2000px 到 2000px，负值向上，正值向下；与 above/below 方向无关。\nVertical offset, default 0px; -2000px to 2000px, negative up, positive down, regardless of above/below placement.'],
  ['max-width', ['640px', '80%'], '外框最大宽度（含内边距和边框）：正数 px 或 %，数值不超过 10000；百分比相对当前编辑器内容视口。默认按图片和可用空间，不强制放大。\nMaximum outer width including padding/border: positive px or %, numeric value up to 10000; % of the editor content viewport. Defaults to image/available space; never forces enlargement.'],
  ['max-height', ['320px', '160px'], '外框最大高度（含内边距和边框）：正数，最多 10000px。默认跟随预览高度限制，空间不足时整图等比例缩小。\nMaximum outer height including padding/border: positive px, up to 10000px. Uses the preview height limit by default; scales the full image to fit.'],
  ['background-color', ['var(--vscode-editorHoverWidget-background)', '#202124'], '背景颜色，默认跟随编辑器悬浮框主题。支持十六进制、rgb/rgba 等颜色和 VS Code 主题变量，不修改公式字色。\nBackground, defaults to the editor hover theme. Supports hex, rgb/rgba and VS Code theme variables; does not change math ink.'],
  ['border', ['1px solid #888', 'none'], '边框，默认无（高对比主题为 2px）；宽度 0–8px，样式 solid/dashed/dotted/double，后接颜色；none 或 0 关闭。\nBorder, none by default (2px in high contrast); width 0–8px, solid/dashed/dotted/double, then color. none or 0 disables it.'],
  ['border-color', ['var(--vscode-editorHoverWidget-border)', '#888'], '只改变已有边框的颜色；先用 border 设置宽度和样式。默认跟随边框颜色。\nChanges an existing border color; set its width and style with border first. Defaults to the border color.'],
  ['border-radius', ['6px', '0px', '4px'], '圆角半径，默认 6px；0px 为直角，数值越大越圆。例如 4px 比默认更小。\nCorner radius, default 6px; 0px makes square corners, larger values are rounder. Try 4px for smaller corners.'],
  ['padding', ['4px 8px', '0px', '2px 4px 6px 8px'], '内边距，默认 4px 8px（上下 / 左右）。每边 0–24px；1 值：四边；2 值：上下、左右；3 值：上、左右、下；4 值：上、右、下、左。空间足够时加在公式外侧，不压缩字号。\nPadding, default 4px 8px (vertical / horizontal). Each side 0–24px; 1 value: all; 2: vertical, horizontal; 3: top, horizontal, bottom; 4: top, right, bottom, left. Adds space outside math without shrinking it when room permits.'],
  ['box-shadow', ['none', '0px 2px 8px #000'], '阴影，默认跟随明暗主题，高对比主题关闭；none 关闭。示例依次为横向偏移、纵向偏移、模糊半径、颜色。\nShadow, theme dependent and off in high contrast; none disables it. Example values: horizontal offset, vertical offset, blur radius, color.'],
  ['opacity', ['0.98', '1', '0.8'], '整体不透明度，默认 0.98；0–1，1 完全不透明，0 完全透明（看不见）。\nOverall opacity, default 0.98; 0–1, where 1 is opaque and 0 is fully transparent (invisible).'],
] as const;

export const PREVIEW_CSS_GUIDE = `/* Silk Math 使用说明 / Usage guide
 * 1. 右下角 Silk Math → 编辑预览 CSS；去掉参数行两端的注释符号后修改。
 *    Bottom-right Silk Math → Edit Preview CSS; uncomment an option line to edit it.
 * 2. Ctrl+S（Mac: Cmd+S）保存生效；清空后保存恢复默认。已有自定义值优先于默认值。
 *    Save with Ctrl+S (Mac: Cmd+S) to apply; clear and save to reset. Custom values override defaults.
 * 3. 下方每个参数都有中英文说明。输入参数可补全，悬停可查看说明。
 *    Each option below has Chinese/English help. Use completion and hover for assistance.
 *    旧 CSS 可点击页顶“参数说明与示例”补充帮助，不改变已有生效值；只保留需要的注释即可。
 *    For older CSS, click “Guide & examples” above to insert help without changing values; keep only needed comments.
 * 4. 只影响预览，不改源码；保存到当前通道的用户设置。正式版与测试版分别保存。
 *    Affects only the preview, never source; saved in user settings, separately for release/test channels.
 *
 * 常用搭配 / Recipes（把对应声明写进下方规则中 / put declarations inside the rule below）:
 * 整块公式上方隔两行 / Two lines above the entire formula:
 *   --silk-anchor: formula; --silk-placement: above; --silk-gap: 2lh;
 *   --silk-allow-overlap: false;
 * 跟随光标行下方，允许覆盖源码 / Below the caret line, allowing source overlap:
 *   --silk-anchor: cursor; --silk-placement: below; --silk-gap: 8px;
 *   --silk-allow-overlap: true;
 * 选区右侧并放大 / To the right of the selection, enlarged:
 *   --silk-anchor: selection; --silk-placement: right; font-size: 120%;
 *
 * 所有方向和偏移仍受编辑器边界限制；禁止覆盖时保护整块公式。
 * Placement/offsets remain within the editor; no-overlap protects the whole formula.
 * 空间不足会缩小，完全没有空间时不显示；间隔过大时请减小 gap 或更换方向。
 * Shrinks when space is limited, hides when none remains; reduce gap or change side if necessary.
 * 仅支持下列参数和这一个选择器，不支持 position/left/top/transform/外链；无效声明会拒绝保存。
 * Only the listed options and this selector are supported; no position/left/top/transform/external URLs. Invalid declarations reject saving.
 * 文件最多 8192 字符（含注释）；可删去不需要的说明。注释内的示例不会自动生效。
 * Limit: 8192 characters including comments; remove unused help if needed. Commented examples are inactive.
 */`;

export const PREVIEW_CSS_TEMPLATE = /* @__PURE__ */ makePreviewCssTemplate();

function makePreviewCssTemplate(): string {
  return `${PREVIEW_CSS_GUIDE}
.silk-math-preview {
${PREVIEW_CSS_OPTIONS.map(([name, values, description]) => `  /* ${description.replaceAll('\n', '\n   * ')} */\n  /* ${name}: ${values[0]}; */`).join('\n\n')}
}
`;
}
