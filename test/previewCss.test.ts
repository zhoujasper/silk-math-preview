import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';

import { parsePreviewCss, PREVIEW_CSS_TEMPLATE, PREVIEW_CSS_OPTIONS } from '../src/core/previewCss';
import { floatingPreviewLayout, previewFontScale, previewViewportAnchorCss, previewPanelInsets } from '../src/core/previewLayout';

describe('preview CSS', () => {
  it('documents all options in Chinese and English and ships a usable, inactive template', () => {
    expect(PREVIEW_CSS_TEMPLATE.length).toBeLessThan(8192);
    expect(parsePreviewCss(PREVIEW_CSS_TEMPLATE)).toEqual(parsePreviewCss(''));
    for (const [name, values, help] of PREVIEW_CSS_OPTIONS) {
      const [chinese, english] = help.split('\n');
      expect(chinese).toMatch(/[\u4e00-\u9fff]/);
      expect(english).toMatch(/[A-Za-z]/);
      expect(PREVIEW_CSS_TEMPLATE).toContain(help.replaceAll('\n', '\n   * '));
      const enabled = PREVIEW_CSS_TEMPLATE.replace(`/* ${name}: ${values[0]}; */`, `${name}: ${values[0]};`);
      expect(parsePreviewCss(enabled)).toEqual(parsePreviewCss(`${name}: ${values[0]};`));
    }
  });

  it.each([
    ['', 16, 8], ['padding: 0px;', 0, 0], ['padding: 6px;', 12, 12],
    ['padding: 4px 8px;', 16, 8], ['padding: 2px 4px 6px;', 8, 8],
    ['padding: 2px 4px 6px 8px;', 12, 8], ['padding: 24px; border: 8px solid #888;', 64, 64],
    ['padding: 6px; padding: 0px; border: 4px solid #888; border: none;', 0, 0],
  ])('reserves padding/border outside the image: %s', (source, horizontal, vertical) => {
    expect(previewPanelInsets(parsePreviewCss(source))).toEqual({ horizontal, vertical });
  });

  it('accounts for high-contrast borders and allows CSS to disable them', () => {
    expect(previewPanelInsets(undefined, 'high-contrast')).toEqual({ horizontal: 20, vertical: 12 });
    expect(previewPanelInsets(parsePreviewCss('border: none;'), 'high-contrast')).toEqual({ horizontal: 16, vertical: 8 });
  });

  it('accepts the editable template, declarations, comments and a blank reset', () => {
    expect(parsePreviewCss(PREVIEW_CSS_TEMPLATE)).toEqual(parsePreviewCss(''));
    expect(parsePreviewCss('/* reset */')).toEqual(parsePreviewCss(''));
    expect(parsePreviewCss('border-radius: 12px; opacity: 0.8;').declarations)
      .toBe('border-radius: 12px !important; opacity: 0.8 !important');
    expect(parsePreviewCss('.silk-math-preview { --silk-offset-x: -80px; --silk-offset-y: 20px; max-width: 80%; max-height: 320px; }'))
      .toEqual({ declarations: '', offsetX: -80, offsetY: 20, maxWidth: '80%', maxHeight: 320 });
    expect(parsePreviewCss('max-width: 450px; --silk-offset-x: 10px; --silk-offset-x: 0px;').offsetX).toBe(0);
  });

  it('keeps theme variables and common color functions, padding and borders', () => {
    const css = parsePreviewCss('background-color: var(--vscode-editorHoverWidget-background); border: 1px solid #888; padding: 2px 4px; box-shadow: 0 2px 8px rgba(0, 0, 0, .2);');
    expect(css.declarations).toContain('background-color: var(--vscode-editorHoverWidget-background) !important');
    expect(css.declarations).toContain('padding: 2px 4px !important');
    expect(parsePreviewCss('border: none; border: 0;').declarations).toContain('border: 0 !important');
  });

  it.each(['formula', 'cursor', 'selection'])('parses %s anchoring with every side, overlap and length unit', (anchor) => {
    for (const placement of ['above', 'below', 'right']) for (const allowOverlap of [false, true]) for (const unit of ['px', 'lh']) {
      expect(parsePreviewCss(`--silk-anchor: ${anchor}; --silk-placement: ${placement}; --silk-allow-overlap: ${allowOverlap}; --silk-gap: 2${unit};`))
        .toMatchObject({ anchor, placement, allowOverlap, gap: { value: 2, unit } });
    }
  });

  it('scales the actual vector image independently from the editor line height', () => {
    expect(previewFontScale(parsePreviewCss('font-size: 24px;'), 16)).toBe(1.5);
    expect(previewFontScale(parsePreviewCss('font-size: 150%;'), 20)).toBe(1.5);
    expect(previewFontScale(parsePreviewCss(''), 16)).toBe(1);
    expect(parsePreviewCss('--silk-gap: 0;').gap).toEqual({ value: 0, unit: 'px' });
  });

  it.each([
    '.silk-math-preview { opacity: .8; } body { display: none; }',
    '@import "https://example.com/style.css";', 'background-color: url(https://example.com);',
    'background-color: u\\72l(x);', 'background-color: "red";', 'color: red;',
    'position: fixed;', 'left: 200px;', 'transform: translateX(100px);',
    'opacity .8', '--silk-offset-x: 2001px;', '--silk-offset-y: 10vh;',
    'max-width: 0px;', 'max-width: 12000px;', 'max-height: 10%;', 'max-height: -20px;',
    'padding: 100px;', 'padding: 1em;', 'border: 200px solid red;',
    'box-shadow: rgb(0,0,0;', 'box-shadow: rgb)0,0,0(;',
    '.silk-math-preview { /*', 'x'.repeat(8193),
    '--silk-anchor: line;', '--silk-placement: left;', '--silk-allow-overlap: 1;',
    '--silk-gap: -1px;', '--silk-gap: 21lh;', '--silk-gap: 1001px;', '--silk-gap: 1em;',
    'font-size: 5px;', 'font-size: 97px;', 'font-size: 24%;', 'font-size: 401%;', 'font-size: 2em;',
  ])('rejects CSS that escapes the preview or bypasses positioning: %s', (source) => {
    expect(() => parsePreviewCss(source)).toThrow();
  });
});

describe('editor viewport bounds', () => {
  const name = '--silkMath-preview-viewport';
  const base = { widthPx: 900, heightPx: 300, lineHeightPx: 20, lineSpan: 1, leftPx: 850, viewportAnchor: name };

  it('names only the Monaco content viewport containing the extension decoration', () => {
    const result = transformSync(`.monaco-editor .silk-test { text-decoration: ${previewViewportAnchorCss()}; }`, { loader: 'css', target: 'chrome110' });
    expect(result.warnings).toEqual([]);
    expect(result.code).toContain('.monaco-editor > .overflow-guard > .monaco-scrollable-element:has(:is(.monaco-editor .silk-test))');
    expect(result.code).not.toContain('position: relative');
    expect(result.code).not.toContain('container-type');
    expect(result.code).toContain('anchor-name: --silkMath-preview-viewport, --silkMathTest-preview-viewport;');
  });

  it('uses actual viewport edges for a right-edge formula, width and proportional height', () => {
    const layout = floatingPreviewLayout(base);
    expect(layout.width).toBe('var(--silk-panel-width)');
    expect(layout.height).toBe('var(--silk-panel-height)');
    expect(layout.textDecoration).toContain(`calc(anchor-size(${name} width, 924px) - 8px)`);
    expect(layout.textDecoration).toContain(`calc(anchor(${name} right, 1770px) - var(--silk-panel-width) - 4px)`);
    expect(layout.textDecoration).toContain('--silk-panel-height: calc((var(--silk-panel-width) - 16px) / 3 + 8px)');
    expect(layout.textDecoration).toContain('object-fit: contain');
    expect(layout.textDecoration).toContain('box-sizing: border-box');
    const css = `.monaco-editor .silk-test::before { text-decoration: ${layout.textDecoration}; width:${layout.width};height:${layout.height}; }`;
    expect(transformSync(css, { loader: 'css', target: 'chrome128' }).warnings).toEqual([]);
  });

  it('clamps user offsets and percentages inside the same editor while preserving above/below', () => {
    const customCss = parsePreviewCss('--silk-offset-x: 2000px; --silk-offset-y: -30px; max-width: 80%; max-height: 100px; opacity: .8;');
    const below = floatingPreviewLayout({ ...base, customCss });
    expect(below.textDecoration).toContain(`calc(anchor-size(${name} width, 924px) * 0.8)`);
    expect(below.textDecoration).toContain(', 2850px, calc(anchor(');
    expect(below.textDecoration).toContain(', -8px, calc(anchor(');
    expect(below.textDecoration).toContain(', 292px, calc((anchor-size(');
    const above = floatingPreviewLayout({ ...base, placement: 'above', customCss });
    expect(above.textDecoration).toContain(`bottom: clamp(calc(anchor(${name} bottom, 0px) + 4px), 52px`);
    expect(above.textDecoration).toContain('opacity: .8 !important');
    const fixedWidth = floatingPreviewLayout({ ...base, customCss: parsePreviewCss('max-width: 200px;') });
    expect(fixedWidth.textDecoration).toContain('min(916px, 200px,');
  });

  it('also bounds render-error notices without imposing an image aspect ratio', () => {
    const notice = floatingPreviewLayout({ ...base, heightPx: 20, image: false });
    expect(notice.textDecoration).toContain('--silk-panel-height: 28px');
    expect(notice.textDecoration).toContain('text-overflow: ellipsis');
  });

  it.each(['below', 'above'])('keeps an image visible at a short closing delimiter without a usable viewport anchor (%s)', (placement) => {
    const layout = floatingPreviewLayout({
      widthPx: 126, heightPx: 88, lineHeightPx: 20, lineSpan: 1,
      leftPx: 0, viewportAnchor: name, placement,
    });
    const declarations = Object.fromEntries(layout.textDecoration.split(';').map((part) => {
      const colon = part.indexOf(':');
      return [part.slice(0, colon).trim(), part.slice(colon + 1).trim()];
    }));
    // Model a 16px-wide "\\]" span, 20px line height, and a 600px window.
    // Evaluate the generated CSS's anchor fallbacks; no browser/GUI is started.
    const evaluate = (value: string, percentBase: number): number => {
      let expression = value;
      for (let depth = 0; depth < 4 && expression.includes('var('); depth++) {
        expression = expression.replace(/var\((--silk-panel-[\w-]+)\)/g, (_, key: string) => `(${declarations[key]})`);
      }
      expression = expression.replace(/anchor(?:-size)?\([^,]+,\s*([^()]+)\)/g, '$1')
        .replace(/([\d.]+)vh\b/g, (_, number: string) => String(Number(number) * 6))
        .replace(/([\d.]+)%/g, (_, number: string) => String(Number(number) * percentBase / 100))
        .replace(/px\b/g, '')
        .replace(/\bcalc\(/g, '(').replace(/\b(min|max)\(/g, 'Math.$1(');
      // Only expressions emitted by this module enter the evaluator.
      return Function('clamp', `return (${expression});`)((low: number, preferred: number, high: number) => Math.max(low, Math.min(preferred, high))) as number;
    };
    expect(evaluate(layout.width, 16) - 16).toBeCloseTo(126);
    expect(evaluate(layout.height, 20) - 8).toBeCloseTo(88);
    expect(evaluate(declarations.left!, 16)).toBeCloseTo(4);
    expect(evaluate(declarations[placement === 'below' ? 'top' : 'bottom']!, 20)).toBeCloseTo(22);
  });
});
