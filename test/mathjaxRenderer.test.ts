import { describe, expect, it } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';

import {
  extractRootSvg,
  flattenInnerSvgs,
  MathJaxSvgRenderer,
  sanitizeStandaloneSvg,
} from '../src/render/mathjaxRenderer';
import { scanMathRegions } from '../src/core/mathScanner';
import { buildPreviewExpression, sanitizeEnvironmentBodyForMathJax } from '../src/core/previewExpression';

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

  it('cls 里用 equation 包一层的自定义环境也能预览', () => {
    // 回归：`eqmath` 定义为 `\begin{equation}...\end{equation}` 时，预览已在数学模式，
    // 再展开会报 “Erroneous nesting of equation structures”。
    const source = '\\begin{eqmath}\n  \\clsOnly{X} = \\Ocal(h^2)\n\\end{eqmath}';
    const region = scanMathRegions(source, { customMathEnvironments: ['eqmath'] }).regions[0]!;
    const expression = buildPreviewExpression(source, region, source.indexOf('clsOnly') + 2, false).expression;
    const begin = sanitizeEnvironmentBodyForMathJax(String.raw`\begin{equation}`);
    const end = sanitizeEnvironmentBodyForMathJax(String.raw`\end{equation}`);
    const renderer = new MathJaxSvgRenderer();
    const result = renderer.render({
      ...options,
      definitionPrelude: [
        `\\newenvironment{eqmath}{${begin}}{${end}}`,
        String.raw`\def\clsOnly#1{\mathsf{#1}}`,
        String.raw`\def\Ocal{\mathcal{O}}`,
      ].join('\n'),
      expression,
    });
    expect(result.svg).toContain('<svg');
    expect(result.widthPx).toBeGreaterThan(5);
    expectValidSvg(result.svg);
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

  it('underbrace / sqrt 的嵌套 svg 不会把根节点截断', () => {
    const nested = '<mjx-container><svg id="root" width="10ex"><g><svg class="inner" width="2"><path d="M0 0"/></svg><path data-c="after"/></g></svg></mjx-container>';
    const extracted = extractRootSvg(nested);
    expect(extracted).toContain('id="root"');
    expect(extracted).toContain('class="inner"');
    expect(extracted).toContain('data-c="after"');
    expect(extracted.startsWith('<svg')).toBe(true);
    expect(extracted.endsWith('</svg>')).toBe(true);
    expect((extracted.match(/<\/svg>/g) ?? []).length).toBe(2);

    const flattened = flattenInnerSvgs(extracted);
    expect((flattened.match(/<svg\b/g) ?? []).length).toBe(1);
    expect(flattened).toContain('<g class="inner"');
    expect(flattened).toContain('data-c="after"');

    const extender = flattenInnerSvgs(
      '<svg><g><svg x="380" y="-70" width="5792.4" height="260" viewBox="1448.1 -70 5792.4 260"><path data-c="E154" d="M-10 0L410 0L410 120L-10 120Z" transform="scale(21.722,1)"></path></svg></g></svg>',
    );
    expect(extender).not.toContain('clip-path');
    expect(extender).not.toContain('scale(21.722');
    expect(extender).toContain('data-c="E154"');
    expect(extender).toMatch(/M380 0H6172\.4V120H380Z/);

    const renderer = new MathJaxSvgRenderer();
    const underbrace = renderer.render({
      ...options,
      definitionPrelude: '',
      expression: String.raw`\tau^n_m=\underbrace{(u_t)^{n+1}_m}_{=0 \text{ by the PDE}}+\mathcal{O}(\Delta t)`,
    });
    expect((underbrace.svg.match(/<svg\b/g) ?? []).length).toBe(1);
    expect(underbrace.svg).not.toContain('clip-path="url(#');
    expect(underbrace.svg).toContain('data-c="1D70F"');
    expect(underbrace.svg).toMatch(/data-c="1D4[A-F0-9]{2}"/);
    expect(underbrace.svg).toContain('data-c="E154"');
    expect(underbrace.widthPx).toBeGreaterThan(40);
    expect(underbrace.heightPx).toBeGreaterThan(10);
    expectValidSvg(underbrace.svg);

    const simple = renderer.render({
      ...options,
      definitionPrelude: '',
      expression: 'x+1',
    });
    const simpleBox = /viewBox="([^"]+)"/.exec(simple.svg)?.[1]?.split(/\s+/).map(Number) ?? [];
    expect(simpleBox[0]!).toBeGreaterThan(-100);

    const longUnderbrace = renderer.render({
      ...options,
      definitionPrelude: '',
      scale: 1.35,
      expression: String.raw`\tau^n_m = \underbrace{(u_t)^{n+1}_m + \gamma (u_{xxxx})^{n+1}_m + \beta u^{n+1}_m}_{=0 \text{ by the PDE}} + \mathcal{O}(\Delta t) + \mathcal{O}((\Delta x)^2) = \mathcal{O}(\Delta t) + \mathcal{O}((\Delta x)^2)`,
    });
    expect((longUnderbrace.svg.match(/<svg\b/g) ?? []).length).toBe(1);
    expect(longUnderbrace.svg).not.toContain('clip-path="url(#');
    expect(longUnderbrace.svg).not.toMatch(/scale\(21\./);
    expect((longUnderbrace.svg.match(/data-c="E154"/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(longUnderbrace.svg).toContain('data-c="3D"');
    expect(longUnderbrace.svg).toContain('data-c="62"');
    expect(longUnderbrace.heightPx).toBeGreaterThan(simple.heightPx);
    expectValidSvg(longUnderbrace.svg);

    const sqrt = renderer.render({
      ...options,
      definitionPrelude: '',
      expression: String.raw`\sqrt{\frac{a+b}{c+d}}`,
    });
    expect(sqrt.svg).toContain('<path');
    expectValidSvg(sqrt.svg);
    renderer.clear();
  });

  it('带框线的表格不会把整张表涂成实心色块', () => {
    // 回归：`tabular{|c|c|c|}` 的 frame 是一张铺满表格的 rect。
    // MathJax 靠 stylesheet 设 fill:none；我们剥掉外部 CSS 后，
    // `svg{fill:currentColor}` 会把它涂成一坨浅色，深色主题里就像白板。
    const source = String.raw`\begin{tabular}{|c|c|c|}
\hline
A & B & C \\
\hline
1 & 2 & 3 \\
\hline
\end{tabular}`;
    const region = scanMathRegions(source).regions[0]!;
    const expression = buildPreviewExpression(source, region, source.indexOf('A'), false).expression;
    const renderer = new MathJaxSvgRenderer();
    const result = renderer.render({ ...options, definitionPrelude: '', expression });
    const frame = /<rect\b[^>]*data-frame="true"[^>]*>/i.exec(result.svg)?.[0];
    expect(frame).toBeDefined();
    expect(frame).toMatch(/fill="none"/i);
    expect(frame).toMatch(/stroke="currentColor"/i);
    expect(frame).toMatch(/stroke-width="70"/);
    expect(result.svg).toMatch(/<rect\b[^>]*data-line="v"[^>]*width="70"/i);
    expect(result.svg).not.toMatch(/<line\b/i);
    expect(result.svg).toContain('data-c="41');
    expectValidSvg(result.svg);
    renderer.clear();
  });

  it('列格式里的竖线会画成有宽度的矩形，不会在图片里丢线', () => {
    // 回归：`{cc|c}` 只有列间竖线。MathJax 输出零宽度 `<line>`，
    // VS Code 把 SVG 当 decoration 图片画时整根竖线光栅化丢掉。
    const source = String.raw`\begin{tabular}{cc|c}
\hline
方法 & $L^2$ 误差 & 阶 \\
\hline
A & $1$ & $2$ \\
\hline
\end{tabular}`;
    const region = scanMathRegions(source).regions[0]!;
    const expression = buildPreviewExpression(source, region, source.indexOf('方法'), false).expression;
    expect(expression).toContain('{cc|c}');
    const renderer = new MathJaxSvgRenderer();
    const result = renderer.render({ ...options, definitionPrelude: '', expression });
    const vertical = /<rect\b[^>]*data-line="v"[^>]*>/i.exec(result.svg)?.[0];
    expect(vertical).toBeDefined();
    const width = Number(/width="([^"]+)"/i.exec(vertical ?? '')?.[1]);
    const x = Number(/\bx="([^"]+)"/i.exec(vertical ?? '')?.[1]);
    const viewBox = /viewBox="([^"]+)"/.exec(result.svg)?.[1]?.split(/\s+/).map(Number) ?? [];
    expect(width).toBeGreaterThan(1);
    expect(x).toBeGreaterThan((viewBox[2] ?? 0) * 0.4);
    expectValidSvg(result.svg);
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
