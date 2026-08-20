import { describe, expect, it } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';

import { MathJaxSvgRenderer, sanitizeStandaloneSvg } from '../src/render/mathjaxRenderer';
import { scanMathRegions } from '../src/core/mathScanner';
import { buildPreviewExpression } from '../src/core/previewExpression';

const options = {
  displayMode: true,
  definitionFingerprint: 'test-definitions',
  definitionPrelude: String.raw`\newcommand{\vect}[1]{\mathbf{#1}}`,
  foreground: '#d4d4d4',
  caretColor: '#ffb454',
  scale: 1,
  exPx: 7,
  // 默认按严格模式测：未定义命令抛错。红色标记另有专门用例。
  markUnknownCommands: false,
} as const;

function expectValidSvg(svg: string): void {
  const messages: string[] = [];
  const parsed = new DOMParser({
    onError: (level, message) => messages.push(`${level}:${message}`),
  }).parseFromString(svg, 'image/svg+xml');
  expect(messages).toEqual([]);
  const root = parsed.documentElement;
  expect(root).not.toBeNull();
  if (!root) throw new Error('SVG 缺少根元素');
  expect(root.localName).toBe('svg');
  const names = Array.from({ length: root.attributes.length }, (_, index) =>
    root.attributes.item(index)?.name,
  ).filter((name): name is string => name !== undefined);
  expect(new Set(names).size).toBe(names.length);
}

describe('MathJaxSvgRenderer', () => {
  it('渲染自定义宏与公式内光标为独立 SVG', () => {
    const renderer = new MathJaxSvgRenderer();
    const result = renderer.render({
      ...options,
      expression: String.raw`\vect{x}+\class{silk-math-caret}{\rule{0.07em}{1.28em}}y`,
    });
    expect(result.svg).toContain('<svg');
    expect(result.svg).toContain('silk-math-caret');
    // 回归：sandbox 必须包住完整表达式，不能只渲染第一个 TeX atom。
    expect(result.svg).toContain('data-c="2B"');
    expect(result.svg).toContain('data-c="1D466"');
    expect(result.widthPx).toBeGreaterThan(0);
    expectValidSvg(result.svg);
    renderer.clear();
  });

  it('完整渲染 Markdown 行内公式及源码同步光标', () => {
    const renderer = new MathJaxSvgRenderer();
    const result = renderer.render({
      ...options,
      displayMode: false,
      definitionPrelude: '',
      expression: String.raw`u\equiv\class{silk-math-caret}{\rule{0.07em}{1.28em}}-1`,
    });
    expect(result.svg).toContain('silk-math-caret');
    expect(result.svg).toContain('data-c="2261"');
    expect(result.svg).toContain('data-c="2212"');
    expect(result.svg).toContain('data-c="31"');
    expect(result.widthPx).toBeGreaterThan(5);
    expectValidSvg(result.svg);
    renderer.clear();
  });

  it('点击 equation 的 begin、正文或 label 都能渲染完整环境预览', () => {
    const source = String.raw`\begin{equation}
\bigl(e^{hL}u\bigr)(x)=\int_{\R^d}u(y)\,\dd y .
\label{eq:heat}
\end{equation}`;
    const region = scanMathRegions(source).regions[0]!;
    const renderer = new MathJaxSvgRenderer();
    for (const offset of [region.start, region.contentStart + 10, source.indexOf('label') + 2]) {
      const expression = buildPreviewExpression(source, region, offset).expression;
      const result = renderer.render({
        ...options,
        definitionPrelude: String.raw`\newcommand{\R}{\mathbb{R}}\newcommand{\dd}{\mathrm{d}}`,
        expression,
      });
      expect(result.svg).toContain('silk-math-caret');
      expect(result.widthPx).toBeGreaterThan(5);
      expectValidSvg(result.svg);
    }
    renderer.clear();
  });

  it.each([
    ['equation*', 'x+1'],
    ['align', String.raw`x&=1\\y&=2`],
    ['align*', String.raw`x&=1\\y&=2`],
    ['alignat', String.raw`{1}x&=1`],
    ['alignat*', String.raw`{1}x&=1`],
    ['aligned', String.raw`x&=1`],
    ['alignedat', String.raw`{1}x&=1`],
    ['gather', String.raw`x=1\\y=2`],
    ['gather*', String.raw`x=1\\y=2`],
    ['gathered', String.raw`x=1\\y=2`],
    ['multline', String.raw`x+1\\+y`],
    ['multline*', String.raw`x+1\\+y`],
    ['split', String.raw`x&=1\\y&=2`],
    ['flalign', String.raw`x&=1&&`],
    ['flalign*', String.raw`x&=1&&`],
    ['displaymath', 'x+1'],
    ['math', 'x+1'],
  ])('内置 %s 环境在点击内部文字时可渲染', (environment, content) => {
    const source = `\\begin{${environment}}${content}\\end{${environment}}`;
    const region = scanMathRegions(source).regions[0]!;
    const expression = buildPreviewExpression(source, region, region.contentStart + 1).expression;
    const renderer = new MathJaxSvgRenderer();
    const result = renderer.render({ ...options, definitionPrelude: '', expression });
    expect(result.svg).toContain('silk-math-caret');
    expect(result.widthPx).toBeGreaterThan(0);
    expectValidSvg(result.svg);
    renderer.clear();
  });

  it('根节点尺寸改写为像素，且与返回值逐位一致', () => {
    const renderer = new MathJaxSvgRenderer();
    const result = renderer.render({ ...options, definitionPrelude: '', expression: 'x+1' });
    const root = result.svg.match(/^<svg\b[^>]*>/i)?.[0] ?? '';
    // 浮层背景按同一组数值绘制；ex 在图片与编辑器字体下不是同一个长度，必须换掉。
    expect(root).toContain(`width="${result.widthPx}px"`);
    expect(root).toContain(`height="${result.heightPx}px"`);
    expect(root).not.toMatch(/\s(?:width|height)="[\d.]+ex"/);
    expect(result.widthPx).toBeGreaterThan(0);
    expectValidSvg(result.svg);
    renderer.clear();
  });

  it('exPx 为 0 时保留 ex 尺寸，供 Webview 内联预览按自身字体缩放', () => {
    const renderer = new MathJaxSvgRenderer();
    const result = renderer.render({
      ...options,
      exPx: 0,
      definitionPrelude: '',
      expression: 'x+1',
    });
    expect(result.svg).toMatch(/\swidth="[\d.]+ex"/);
    expectValidSvg(result.svg);
    renderer.clear();
  });

  it('超宽公式等比缩小到上限而不是让背景盖不住', () => {
    const renderer = new MathJaxSvgRenderer();
    const expression = Array.from({ length: 90 }, (_, index) => `x_{${index}}+`).join('');
    const natural = renderer.render({ ...options, exPx: 0, definitionPrelude: '', expression });
    const capped = renderer.render({ ...options, definitionPrelude: '', expression });
    expect(natural.widthPx / 8).toBeGreaterThan(130);
    expect(capped.widthPx).toBeLessThanOrEqual(130 * options.exPx);
    // 等比缩放：宽高比保持不变，不会被压扁。
    expect(capped.widthPx / capped.heightPx).toBeCloseTo(natural.widthPx / natural.heightPx, 1);
    expect(capped.svg).toContain(`width="${capped.widthPx}px"`);
    renderer.clear();
  });

  it('补齐 MathJax 缺少的常用排版命令，公式不再整条渲染失败', () => {
    const renderer = new MathJaxSvgRenderer();
    for (const expression of [
      String.raw`\emph{x}+\ensuremath{y}`,
      String.raw`\bm{v}\cdot\boldsymbol{w}`,
      String.raw`\cancel{a}+b`,
      String.raw`\allowdisplaybreaks x^{\textsuperscript{2}}`,
      String.raw`\footnote{ignored}z`,
    ]) {
      const result = renderer.render({ ...options, definitionPrelude: '', expression });
      expect(result.widthPx).toBeGreaterThan(0);
      expectValidSvg(result.svg);
    }
    renderer.clear();
  });

  it('自定义定义里有一条转换失败时，其余定义仍然生效', () => {
    const renderer = new MathJaxSvgRenderer();
    const result = renderer.render({
      ...options,
      definitionFingerprint: 'partial-prelude',
      definitionPrelude: [
        String.raw`\def\good{G}`,
        String.raw`\def\broken{\thiscommanddoesnotexist}\broken`,
        String.raw`\def\alsogood{A}`,
      ].join('\n'),
      expression: String.raw`\good+\alsogood`,
    });
    expect(result.svg).toContain('data-c="1D43A"'); // 数学斜体 G
    expect(result.svg).toContain('data-c="1D434"'); // 数学斜体 A
    expectValidSvg(result.svg);
    renderer.clear();
  });

  it('未定义命令按红色原文标出，公式其余部分照常渲染', () => {
    const renderer = new MathJaxSvgRenderer();
    const result = renderer.render({
      ...options,
      markUnknownCommands: true,
      definitionFingerprint: 'mark-unknown',
      definitionPrelude: '',
      expression: String.raw`a+\Osdfcal(x)+b`,
    });
    // 红色 mtext 把命令原文画出来（字形路径：\ + O + s...），其余符号照常渲染。
    expect(result.svg).toContain('fill="red"');
    expect(result.svg).toContain('data-c="5C"');
    expect(result.svg).toContain('data-c="4F"');
    expect(result.svg).toContain('data-c="2B"');
    expectValidSvg(result.svg);

    // 关掉开关时保持严格模式：未定义命令抛错，由上层保留上一帧。
    expect(() => renderer.render({
      ...options,
      markUnknownCommands: false,
      definitionFingerprint: 'mark-unknown-strict',
      definitionPrelude: '',
      expression: String.raw`a+\Osdfcal(x)+b`,
    })).toThrow();
    renderer.clear();
  });

  it('正常公式的 SVG 一定含可见图元，空白兜底才不会误伤', () => {
    // 回归：预览层用 `<path`/`<text`/`<rect` 判断“渲染结果为空”。这个判据一旦写错，
    // 每条公式都会被误判成空白，基础功能直接不可用。
    const renderer = new MathJaxSvgRenderer();
    for (const expression of [
      'x+1',
      String.raw`\frac{a}{b}`,
      String.raw`\begin{aligned}a&=b\\c&=d\end{aligned}`,
      String.raw`\text{中文}`,
    ]) {
      const result = renderer.render({ ...options, definitionPrelude: '', expression });
      const drawable = result.svg.includes('<path')
        || result.svg.includes('<text')
        || result.svg.includes('<rect');
      expect(drawable).toBe(true);
    }
    renderer.clear();
  });

  it('清理外部链接、脚本、事件和 foreignObject', () => {
    const raw = '<mjx-container><svg width="1ex"><script>x</script><a href="https://x"><path onclick="x"/></a><foreignObject>x</foreignObject></svg></mjx-container>';
    const clean = sanitizeStandaloneSvg(raw, 'bad', '#fff');
    expect(clean).not.toMatch(/script|foreignObject|onclick|https:\/\//i);
    expect(clean).toContain('#d4d4d4');
    expectValidSvg(clean);
  });

  it('移除 style 外链能力并只保留安全颜色', () => {
    const renderer = new MathJaxSvgRenderer();
    const result = renderer.render({
      ...options,
      expression: String.raw`\style{color:red;background-image:url(https://example.com/x)}{x}`,
    });
    const withoutNamespace = result.svg.replace('http://www.w3.org/2000/svg', '');
    expect(withoutNamespace).not.toMatch(/https?:|url\s*\(|background-image/i);
    expect(result.svg).toMatch(/color:red/i);
    expectValidSvg(result.svg);
    renderer.clear();
  });

  it('不把公式内临时宏泄漏到下一次渲染', () => {
    const renderer = new MathJaxSvgRenderer();
    const first = renderer.render({
      ...options,
      definitionPrelude: '',
      expression: String.raw`\newcommand{\historymacro}{H}\historymacro`,
    });
    expect(first.svg).toContain('<svg');
    expect(() => renderer.render({
      ...options,
      definitionPrelude: '',
      expression: String.raw`\historymacro`,
    })).toThrow();
    expect(() => renderer.render({
      ...options,
      definitionPrelude: '',
      expression: String.raw`\gdef\escaped{bad}`,
    })).toThrow();
    expect(() => renderer.render({
      ...options,
      definitionPrelude: '',
      expression: String.raw`\begingroupReset`,
    })).toThrow(/保留/);
    renderer.clear();
  });

  it('未知宏或不完整输入失败后同 fingerprint 可恢复渲染', () => {
    const renderer = new MathJaxSvgRenderer();
    expect(() => renderer.render({
      ...options,
      definitionPrelude: '',
      expression: String.raw`\unknownmacro`,
    })).toThrow();
    expect(renderer.render({
      ...options,
      definitionPrelude: '',
      expression: 'x+1',
    }).svg).toContain('<svg');

    expect(() => renderer.render({
      ...options,
      definitionPrelude: '',
      expression: String.raw`\frac{a`,
    })).toThrow();
    expect(renderer.render({
      ...options,
      definitionPrelude: '',
      expression: 'x+2',
    }).svg).toContain('<svg');
    renderer.clear();
  });
});
