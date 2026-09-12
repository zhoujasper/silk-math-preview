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
  ['--silk-anchor', ['formula', 'cursor', 'selection'], '短公式的定位基准，默认 formula：整块公式；cursor：光标行；selection：选区，空选区按光标。长宽公式优先跟随编辑行。\nShort-formula anchor: formula (default), cursor, or selection; empty selections use the caret. Oversized formulas follow the editing line.'],
  ['--silk-placement', ['below', 'above', 'right'], '短公式方向：below 下方 / above 上方 / right 右侧，未设置时沿用菜单。长宽公式自动选择光标上下空间；软换行且禁止覆盖时 right 退回 below。\nShort-formula side: below / above / right; menu preference when unset. Oversized formulas choose space above/below the caret. Wrapped source with no overlap falls back from right to below.'],
  ['--silk-gap', ['1lh', '2lh', '8px', '0px'], '短公式与基准边缘的间隔，默认 2px；0–20lh 或 0–1000px。1lh 为编辑器一行，不随预览字号变化。光标有保护间隔；长宽公式自动安排。\nShort-formula gap: default 2px, 0–20lh or 0–1000px. 1lh is one editor line, independent of math size. A protective caret gap remains; oversized formulas use automatic placement.'],
  ['--silk-allow-overlap', ['false', 'true'], '短公式 false 保护整块源码，true 可覆盖其他源码但仍避开编辑光标。设置 anchor、placement、gap 或 allow-overlap 后默认 false。长宽公式始终优先光标避让。\nFor short formulas, false protects the full source; true may overlap other source but still avoids the editing caret. Defaults to false with advanced positioning. Oversized formulas always prioritize caret avoidance.'],
  ['font-size', ['24px', '120%', '100%'], '公式字号：6–96px 或默认尺寸的 25–400%；默认跟随菜单缩放，100% 保持当前默认。行间已缩小 15%，行内不变；TikZ 缩放整图，不改源码。\nMath size: 6–96px or 25–400% of the default; follows menu zoom, with 100% preserving it. Display math is already 15% smaller; inline math is unchanged. Scales the whole TikZ image, never source.'],
  ['--silk-offset-x', ['0px', '-40px', '40px'], '短公式左右偏移，默认 0px；-2000px 到 2000px，负值向左。受编辑器边界及光标避让限制；长宽公式自动安排。\nShort-formula horizontal offset: default 0px, -2000px to 2000px, negative left. Editor bounds/caret protection still apply; oversized formulas use automatic placement.'],
  ['--silk-offset-y', ['0px', '-20px', '20px'], '短公式上下偏移，默认 0px；-2000px 到 2000px，负值向上。受编辑器边界及光标避让限制；长宽公式自动安排。\nShort-formula vertical offset: default 0px, -2000px to 2000px, negative up. Editor bounds/caret protection still apply; oversized formulas use automatic placement.'],
  ['max-width', ['640px', '80%'], '滚动窗口最大宽度（含内边距/边框）：正数 px 或 %，数值最多 10000；% 相对编辑器内容视口。默认上限 960px，仍受真实视口限制；不缩小公式。\nScroll-window maximum width including padding/border: positive px or %, numeric value up to 10000; % of editor content viewport. Default cap 960px plus viewport bounds; does not shrink math.'],
  ['max-height', ['320px', '160px'], '滚动窗口最大高度（含内边距/边框）：正数，最多 10000px。默认上限 500px，并为编辑光标保留空间；超出部分滚动查看，不缩小公式。\nScroll-window maximum height including padding/border: positive px up to 10000. Default cap 500px with space reserved for editing; excess content scrolls without shrinking math.'],
  ['background-color', ['var(--vscode-editorHoverWidget-background)', '#202124'], '背景颜色，默认跟随编辑器悬浮框主题。支持十六进制、rgb/rgba 等颜色和 VS Code 主题变量，不修改公式字色。\nBackground, defaults to the editor hover theme. Supports hex, rgb/rgba and VS Code theme variables; does not change math ink.'],
  ['border', ['1px solid #888', 'none'], '边框默认无，高对比主题另有主题轮廓；宽度 0–8px，solid/dashed/dotted/double 后接颜色；none 或 0 关闭。\nBorder: none by default, with a separate themed outline in high contrast. Width 0–8px, solid/dashed/dotted/double, then color. none or 0 disables it.'],
  ['border-color', ['var(--vscode-editorHoverWidget-border)', '#888'], '只改变已有边框的颜色；先用 border 设置宽度和样式。默认跟随边框颜色。\nChanges an existing border color; set its width and style with border first. Defaults to the border color.'],
  ['border-radius', ['6px', '0px', '4px'], '圆角半径，默认 6px；0px 为直角，数值越大越圆。例如 4px 比默认更小。\nCorner radius, default 6px; 0px makes square corners, larger values are rounder. Try 4px for smaller corners.'],
  ['padding', ['4px 8px', '0px', '2px 4px 6px 8px'], '内边距，默认 4px 8px（上下 / 左右）。每边 0–24px；1 值：四边；2 值：上下、左右；3 值：上、左右、下；4 值：上、右、下、左。空间足够时加在公式外侧，不压缩字号。\nPadding, default 4px 8px (vertical / horizontal). Each side 0–24px; 1 value: all; 2: vertical, horizontal; 3: top, horizontal, bottom; 4: top, right, bottom, left. Adds space outside math without shrinking it when room permits.'],
  ['box-shadow', ['none', '0px 2px 8px #000'], '阴影默认柔和；none 关闭。示例依次为横向偏移、纵向偏移、模糊半径、颜色。\nSoft shadow by default; none disables it. Example values: horizontal offset, vertical offset, blur radius, color.'],
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
 * 短公式跟随光标行下方，可覆盖其他源码 / Short formula below the caret, allowing overlap with other source:
 *   --silk-anchor: cursor; --silk-placement: below; --silk-gap: 8px;
 *   --silk-allow-overlap: true;
 * 选区右侧并放大 / To the right of the selection, enlarged:
 *   --silk-anchor: selection; --silk-placement: right; font-size: 120%;
 *
 * 短公式的方向和偏移受编辑器边界及光标保护限制；长宽公式自动放在编辑行上方或下方。
 * Short-formula placement respects editor bounds and caret protection; oversized formulas choose space above/below the editing line.
 * 超出窗口的部分可上下、左右滚动，字号不缩小；短公式强制方向无空间时请减小 gap 或清空定位设置。
 * Overflow scrolls in both axes without shrinking math; if a forced short-formula side has no space, reduce gap or reset positioning.
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
