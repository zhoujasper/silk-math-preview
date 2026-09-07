import { describe, expect, it } from 'vitest';
import { MathJaxSvgRenderer } from '../src/render/mathjaxRenderer';
import { formatSiNumber, parseSiOptions } from '../src/render/siunitx';
import { renderPackages } from '../src/render/packageSupport';
import { scanMathRegions } from '../src/core/mathScanner';
import { buildPreviewExpression } from '../src/core/previewExpression';
import { anchorCaret } from '../src/core/caretAnchor';
import { buildTableExpression } from '../src/core/tablePreview';
import { DOMParser } from '@xmldom/xmldom';

const options = { displayMode: true, definitionFingerprint: 'packages', definitionPrelude: '',
  foreground: '#ddd', caretColor: '#f90', scale: 1, exPx: 7, markUnknownCommands: false };
const glyphs = (svg: string) => [...svg.matchAll(/data-c="([A-F0-9]+)"/g)].map((m) => m[1]);

describe('数字与宏包预览', () => {
  it.each([
    ['1.23456', 'round-mode=places,round-precision=3', '1{.}235'],
    ['14.23', 'round-mode=places,round-precision=3', '14{.}230'],
    ['-0.004', 'round-mode=places,round-precision=2', '0{.}00'],
    ['12345', 'round-mode=places,round-precision=-2', String.raw`12\,300`],
    ['9.995', 'round-mode=places,round-precision=2', '10{.}00'],
    ['9.999', 'round-mode=figures,round-precision=3', '10{.}0'],
    ['0.00456', 'round-mode=figures,round-precision=2', '0{.}0046'],
    ['12.3', 'round-mode=figures,round-precision=4,round-pad=false', '12{.}3'],
    ['0.045', 'round-mode=places,round-precision=2,round-half=even', '0{.}04'],
    ['0.055', 'round-mode=places,round-precision=2,round-half=even', '0{.}06'],
    ['-1.231', 'round-mode=places,round-precision=2,round-direction=up', '-1{.}24'],
    ['999999999999999999.995', 'round-mode=places,round-precision=2,group-digits=false', '1000000000000000000{.}00'],
    ['1.23(4)', 'separate-uncertainty', String.raw`1{.}23\pm 0{.}04`],
    ['1.23(4)e-5', 'uncertainty-mode=separate', String.raw`(1{.}23\pm 0{.}04)\times10^{-5}`],
    ['0.12345(234)', 'round-mode=uncertainty,round-precision=1', '0{.}123(2)'],
    ['1.23456', 'round-mode=places,round-precision=100000000', String.raw`1{.}234\,56`],
  ])('格式化选项 %s / %s', (number, settings, expected) => {
    expect(formatSiNumber(number, parseSiOptions(settings))).toBe(expected);
  });

  it('单位分式、负指数、sticky-per 与自定义单位都保留含义', () => {
    const renderer = new MathJaxSvgRenderer();
    const fraction = renderer.render({ ...options,
      definitionPrelude: String.raw`\def\speed{\kilo\metre\per\second\squared}`,
      expression: String.raw`\text{\qty[per-mode=fraction]{1.23(4)}{\speed}}` });
    expect(fraction.svg).toContain('data-mml-node="mfrac"');
    const reciprocal = renderer.render({ ...options, expression: String.raw`\unit{\metre\per\second\squared}` });
    expect(glyphs(reciprocal.svg)).toContain('2212');
    const mixed = renderer.render({ ...options, expression: String.raw`\unit[per-mode=fraction]{\joule\per\mole\kelvin}` });
    const sticky = renderer.render({ ...options, expression: String.raw`\unit[per-mode=fraction,sticky-per]{\joule\per\mole\kelvin}` });
    expect(sticky.svg).not.toBe(mixed.svg);
    expect(glyphs(mixed.svg)).toEqual(['4A', '4B', '6D', '6F', '6C']);
    expect(glyphs(sticky.svg)).toEqual(['4A', '6D', '6F', '6C', '4B']);
    // Same unit name after a local redefinition must bypass the earlier expanded-unit cache entry.
    const local = renderer.render({ ...options, expression: String.raw`\def\metre{z}\unit{\metre}` });
    expect(glyphs(local.svg)).toContain('7A');
    const restored = renderer.render({ ...options, expression: String.raw`\unit{\metre}` });
    expect(glyphs(restored.svg)).toContain('6D');
    renderer.clear();
  });

  it('S 列在真实 SVG 中按小数点对齐，包括不同位数、指数和宏', () => {
    const renderer = new MathJaxSvgRenderer();
    const expression = buildTableExpression(String.raw`{lS[round-mode=places,round-precision=2]S}
      \toprule {Item}&{Value}&{Other}\\\midrule A&1.2&12.3\\B&123.456&0.001\\C&\num{\value}&1.2e3\\D&42&-123.45678\\\bottomrule`);
    const result = renderer.render({ ...options, definitionPrelude: String.raw`\def\value{0.04}`, expression });
    expect(result.svg).not.toContain('\\silkSCell');
    const doc = new DOMParser().parseFromString(result.svg, 'image/svg+xml');
    const positions: number[] = [];
    function visit(node: Node, x = 0, scale = 1): void {
      const element = node as Element;
      const transform = element.getAttribute?.('transform') ?? '';
      for (const match of transform.matchAll(/(translate|scale)\(([-\d.e+]+)(?:[, ]+[-\d.e+]+)?\)/g)) {
        if (match[1] === 'translate') x += Number(match[2]) * scale;
        else scale *= Number(match[2]);
      }
      if (element.getAttribute?.('class') === 'silk-si-decimal') positions.push(x);
      for (let i = 0; i < node.childNodes.length; i++) visit(node.childNodes[i]!, x, scale);
    }
    visit(doc as unknown as Node);
    expect(positions).toHaveLength(8);
    for (let i = 2; i < positions.length; i++) expect(positions[i]).toBeCloseTo(positions[i % 2]!, 2);
    renderer.clear();
  });

  it('S 列数字内每个光标位置都能渲染，错误帧后不保留旧布局', () => {
    const source = String.raw`\begin{tabular}{l*{2}{S}}A&123.45&0.04\\B&1.2&3\end{tabular}`;
    const region = scanMathRegions(source).regions[0]!;
    const renderer = new MathJaxSvgRenderer();
    for (let at = source.indexOf('123.45'); at <= source.indexOf('123.45') + 6; at++) {
      const expression = buildPreviewExpression(source, region, at).expression;
      const result = renderer.render({ ...options, expression });
      expect(result.svg).toContain('silk-math-caret');
      expect(result.svg).toContain('silk-si-decimal');
    }
    const valid = buildTableExpression(String.raw`{S}1.2\\3.45`);
    expect(() => renderer.render({ ...options, expression: valid + String.raw`\unknownBroken` })).toThrow();
    const restored = renderer.render({ ...options, expression: valid });
    expect(restored.svg).toContain('silk-si-decimal');
    renderer.clear();
    expect(renderer.render({ ...options, expression: valid }).svg).toBe(restored.svg);
    renderer.clear();
  });
  it.each([
    ['1234.56', '1234{.}56'], ['42', '42'], ['12345.600', String.raw`12\,345{.}600`],
    ['-1.20e-03', String.raw`-1{.}20\times10^{-3}`], ['.5', '0{.}5'],
    ['1.234(5)', '1{.}234(5)'], ['12345678901234567890', String.raw`12\,345\,678\,901\,234\,567\,890`],
  ])('数值 %s 保留有效位数与语义', (input, expected) => {
    expect(formatSiNumber(input)).toBe(expected);
    const renderer = new MathJaxSvgRenderer();
    const result = renderer.render({ ...options, expression: `\\num{${input}}` });
    expect(glyphs(result.svg)).toEqual(glyphs(renderer.render({ ...options, expression: expected }).svg));
    renderer.clear();
  });

  it('识别分组和小数选项，不破坏花括号内的逗号', () => {
    const settings = parseSiOptions('group-separator={,}, output-decimal-marker={,},group-minimum-digits=4');
    expect(settings['group-separator']).toBe(',');
    expect(formatSiNumber('1234.50', settings)).toBe('1,234{,}50');
    expect(formatSiNumber('12345.67', parseSiOptions('group-digits=false,locale=DE'))).toBe('12345{,}67');
    expect(formatSiNumber('1e5', parseSiOptions('parse-numbers=false'))).toBe('1e5');
    expect(formatSiNumber(String.raw`\myNumber`)).toBe(String.raw`\myNumber`);
  });

  it('截图中的 booktabs 表格真正显示数字和中文，不显示 num 源码', () => {
    const source = String.raw`\begin{tabular}{lr}
\toprule 项目 & 数值 \\
\midrule Alpha & \num{1234.56} \\
Beta & \num{42} \\
\bottomrule\end{tabular}`;
    const region = scanMathRegions(source).regions[0]!;
    const renderer = new MathJaxSvgRenderer();
    // 同时覆盖命令名、花括号、数字和行末处的预览光标。
    for (let offset = source.indexOf('\\num'); offset <= source.indexOf('1234.56') + 8; offset += 1) {
      const expression = buildPreviewExpression(source, region, offset).expression;
      const result = renderer.render({ ...options, expression });
      expect(result.svg).not.toContain('\\num');
      expect(result.svg).toContain('silk-math-caret');
      for (const digit of ['31', '32', '33', '34', '35', '36']) expect(glyphs(result.svg)).toContain(digit);
    }
    renderer.clear();
  });

  it.each([
    String.raw`\num[locale=DE]{1.234e-5}`,
    String.raw`\SI{3e8}{\metre\per\second}`,
    String.raw`\qty{9.81}{\metre\per\second\squared}`,
    String.raw`\si{\kilo\gram\metre\per\second\squared}`,
    String.raw`\unit{kg.m/s^2}`,
    String.raw`\qty{25}{\degreeCelsius}`,
    String.raw`\numrange{1e3}{2e3}`,
    String.raw`\numlist{1;2.0;3e4}`,
    String.raw`\numproduct{2 x 3e4}`,
    String.raw`\qtyrange{1}{5}{\kilo\metre}`,
    String.raw`\SIlist{1;2;3}{\second}`,
    String.raw`\qtyproduct{2 x 3}{\metre}`,
    String.raw`\ang{30;15;20}`,
    String.raw`\SI{10}[\approx]{\kilo\hertz}`,
  ])('公式和文本单元格均支持 %s', (expression) => {
    const renderer = new MathJaxSvgRenderer();
    for (const input of [expression, `\\text{值：${expression}}`]) {
      const result = renderer.render({ ...options, expression: input });
      expect(result.svg).toContain('<path');
      expect(result.svg).not.toContain('merror');
      expect(result.svg).not.toContain('fill="red"');
    }
    renderer.clear();
  });

  it('文本里的自定义宏、默认参数、嵌套宏与 ensuremath 都能展开', () => {
    const renderer = new MathJaxSvgRenderer();
    const result = renderer.render({ ...options, definitionPrelude: String.raw`
\newcommand{\name}[1][Alpha]{\textbf{#1}}
\def\value#1{\num{#1}}
\def\speed{\kilo\metre\per\second}
\def\RR{\ensuremath{\mathbb{R}}}
\def\combined{\name\ \RR\ \value{1234.56}\ \qty{2}{\speed}}`,
    expression: String.raw`\text{\combined}` });
    expect(result.svg).not.toMatch(/\\(?:name|value|speed|RR|combined|num|qty)/);
    expect(glyphs(result.svg)).toContain('211D');
    expect(glyphs(result.svg)).toContain('31');
    renderer.clear();
  });

  it('用户重定义优先，单位别名不污染外部宏', () => {
    const renderer = new MathJaxSvgRenderer();
    const result = renderer.render({ ...options,
      definitionPrelude: String.raw`\def\num#1{\textbf{custom}}\def\m{z}`,
      expression: String.raw`\text{\num{42}}+\SI{2}{\m}+\m+\bar{x}` });
    expect(result.svg).not.toContain('\\num');
    expect(glyphs(result.svg)).toContain('1D467');
    expect(glyphs(result.svg)).not.toContain('34');
    renderer.clear();
  });

  it('数字参数中的自定义常量和默认参数宏仍按科学计数法格式化', () => {
    const renderer = new MathJaxSvgRenderer();
    const result = renderer.render({ ...options,
      definitionPrelude: String.raw`\def\constant{1.20e-3}\newcommand{\power}[2][2]{#2e#1}`,
      expression: String.raw`\text{\num{\constant}, \num{\power{3}}}` });
    expect(glyphs(result.svg).filter((glyph) => glyph === 'D7')).toHaveLength(2);
    expect(glyphs(result.svg)).not.toContain('1D452');
    expect(() => renderer.render({ ...options, definitionFingerprint: 'recursive-number',
      definitionPrelude: String.raw`\def\recurse{\recurse}`, expression: String.raw`\num{\recurse}` })).toThrow();
    renderer.clear();
  });

  it('全局 sisetup 应用到数字，公式中的设置不污染下次渲染', () => {
    const renderer = new MathJaxSvgRenderer();
    const before = renderer.render({ ...options, expression: String.raw`\num{1234.56}` });
    const changed = renderer.render({ ...options,
      expression: String.raw`\sisetup{output-decimal-marker={,}}\num{1234.56}` });
    expect(glyphs(changed.svg)).toContain('2C');
    expect(renderer.render({ ...options, expression: String.raw`\num{1234.56}` }).svg).toBe(before.svg);
    const scoped = renderer.render({ ...options,
      expression: String.raw`{\sisetup{output-decimal-marker={,}}\num{1.2}}+\num{3.4}` });
    expect(glyphs(scoped.svg)).toContain('2C');
    expect(glyphs(scoped.svg)).toContain('2E');
    renderer.clear();
  });

  it('自动加载常见宏包，并区分 physics 的同名 qty', () => {
    const renderer = new MathJaxSvgRenderer();
    for (const expression of [String.raw`a\coloneqq b+\mathclap{x}`, String.raw`\Braket{a|b}`,
      String.raw`\upalpha+\upmu`, String.raw`\ce{H2O}`, String.raw`\text{\textdegree}`]) {
      expect(renderer.render({ ...options, expression }).svg).toContain('<path');
    }
    const physics = renderer.render({ ...options, packages: ['physics'], expression: String.raw`\qty(\frac{a}{b})` });
    expect(physics.svg).toContain('data-mml-node="mfrac"');
    expect(renderPackages(['physics'], '', '')).not.toContain('silk-qty');
    expect(renderPackages(['mathtools'], '', '')).toContain('mathtools');
    renderer.clear();
  });

  it.each([String.raw`\num[round-mode=places]{1e-3}`, String.raw`\SI{3}[\approx]{m/s}`,
    String.raw`\qtyrange{1}{2}{\metre}`, String.raw`\unit{kg.m/s^2}`])('数据参数的所有光标落点均不拆坏 %s', (source) => {
    for (let at = 1; at < source.length; at += 1) expect(anchorCaret(source, at).offset).toBe(source.length);
  });
});
