import { describe, expect, it } from 'vitest';

import {
  buildPreviewExpression,
  PREVIEW_CARET_TEX,
  sanitizeEnvironmentBodyForMathJax,
} from '../src/core/previewExpression';
import { scanMathRegions } from '../src/core/mathScanner';

describe('buildPreviewExpression', () => {
  it('光标竖线跨在基线两侧，不比正文更靠上', () => {
    const lift = /\\rule\[(-?[\d.]+)em\]\{[\d.]+em\}\{([\d.]+)em\}/.exec(PREVIEW_CARET_TEX);
    expect(lift).not.toBeNull();
    const depth = Number(lift?.[1]);
    const height = Number(lift?.[2]);
    // 顶端不高于大写字母（0.705em），底端要够到字母的下缘（-0.205em）。
    expect(depth).toBeLessThan(0);
    expect(depth).toBeGreaterThanOrEqual(-0.25);
    expect(height + depth).toBeLessThanOrEqual(0.78);
  });

  it('文本模式里的光标先切回数学，不会被原样打印成 \\rule 文字', () => {
    // 回归：`\text{for |}` 里直接插入 `\class{...}{\rule...}`，MathJax 会把整段命令
    // 当成文字排版，预览里出现一串源码。
    const source = String.raw`\[a \quad \text{for } x\]`;
    const region = scanMathRegions(source).regions[0]!;
    const inText = buildPreviewExpression(source, region, source.indexOf('for') + 2).expression;
    expect(inText).toContain(`$${PREVIEW_CARET_TEX}$`);

    const inMath = buildPreviewExpression(source, region, source.indexOf('a ') + 1).expression;
    expect(inMath).toContain(PREVIEW_CARET_TEX);
    expect(inMath).not.toContain(`$${PREVIEW_CARET_TEX}$`);

    // `\text{...}` 里嵌套的 `$...$` 又回到数学模式，不需要再包一层。
    const nested = String.raw`\[\text{when $x+y$ holds}\]`;
    const nestedRegion = scanMathRegions(nested).regions[0]!;
    const nestedExpression = buildPreviewExpression(nested, nestedRegion, nested.indexOf('+')).expression;
    expect(nestedExpression).not.toContain(`$${PREVIEW_CARET_TEX}$`);
  });

  it('$$ 里再包一层顶层环境时按可嵌套形式归一化', () => {
    // 回归：Jupyter / Markdown 里常见的 `$$ \begin{equation} ... \end{equation} $$`，
    // 环境落进沙箱分组会报 “Erroneous nesting of equation structures”，整条公式不显示。
    const source = '$$\n\\begin{equation}\n  x+1\n\\end{equation}\n$$';
    const region = scanMathRegions(source, { language: 'markdown' }).regions[0]!;
    const plain = buildPreviewExpression(source, region, source.indexOf('x+1'), false).expression;
    expect(plain).not.toContain('\\begin{equation}');
    expect(plain.trim()).toBe('x+1');

    const withCaret = buildPreviewExpression(source, region, source.indexOf('x+1') + 1).expression;
    expect(withCaret).toBe(`\n  x${PREVIEW_CARET_TEX}+1\n`);

    const align = '$$\n\\begin{align}\n  a&=b\n\\end{align}\n$$';
    const alignRegion = scanMathRegions(align, { language: 'markdown' }).regions[0]!;
    const aligned = buildPreviewExpression(align, alignRegion, align.indexOf('a&=b'), false).expression;
    expect(aligned).toContain('\\begin{aligned}');
    expect(aligned).not.toContain('\\begin{align}\n');

    // 本来就可嵌套的环境保持原样。
    const cases = '$$\\begin{cases}a\\\\b\\end{cases}$$';
    const casesRegion = scanMathRegions(cases, { language: 'markdown' }).regions[0]!;
    expect(buildPreviewExpression(cases, casesRegion, cases.indexOf('a'), false).expression)
      .toContain('\\begin{cases}');
  });

  it('把渲染光标插入公式内的精确源码位置', () => {
    const source = '$a+b$';
    const region = scanMathRegions(source).regions[0]!;
    const result = buildPreviewExpression(source, region, 3);
    expect(result.expression).toBe(`a+${PREVIEW_CARET_TEX}b`);
    expect(result.caret.exact).toBe(true);
  });

  it('不会把光标插进控制序列或 left delimiter 头', () => {
    const source = String.raw`$\left(x\right)$`;
    const region = scanMathRegions(source).regions[0]!;
    const result = buildPreviewExpression(source, region, 4);
    expect(result.caret.exact).toBe(false);
    expect(result.caret.reason).toBe('left-right-head');
    expect(result.expression).not.toContain(String.raw`\le${PREVIEW_CARET_TEX}ft`);
  });

  it('自定义环境 prelude 里的 equation/align 折成可嵌套形式', () => {
    expect(sanitizeEnvironmentBodyForMathJax(String.raw`\begin{equation}`)).toBe('');
    expect(sanitizeEnvironmentBodyForMathJax(String.raw`\end{equation}`)).toBe('');
    expect(sanitizeEnvironmentBodyForMathJax(String.raw`\begin{align}`)).toBe(String.raw`\begin{aligned}`);
    expect(sanitizeEnvironmentBodyForMathJax(String.raw`\end{align}`)).toBe(String.raw`\end{aligned}`);
    expect(sanitizeEnvironmentBodyForMathJax(String.raw`\begin{aligned}`)).toBe(String.raw`\begin{aligned}`);
    expect(sanitizeEnvironmentBodyForMathJax(String.raw`\begin{alignat}`)).toBe(String.raw`\begin{alignedat}`);
  });

  it('为自定义数学环境补回环境头尾，也可关闭光标', () => {
    const source = String.raw`\begin{proofmath}x+y\end{proofmath}`;
    const region = scanMathRegions(source, { customMathEnvironments: ['proofmath'] }).regions[0]!;
    const result = buildPreviewExpression(source, region, region.contentStart + 1, false);
    expect(result.expression).toBe(String.raw`\begin{proofmath}x+y\end{proofmath}`);
  });

  it('把外层显示环境转成 MathJax 可嵌入预览并覆盖 begin/end 光标', () => {
    const equation = String.raw`\begin{equation}x+1\label{eq:x}\end{equation}`;
    const equationRegion = scanMathRegions(equation).regions[0]!;
    const atBegin = buildPreviewExpression(equation, equationRegion, equationRegion.start);
    const atEnd = buildPreviewExpression(equation, equationRegion, equationRegion.end - 1);
    expect(atBegin.expression).toBe(`${PREVIEW_CARET_TEX}x+1`);
    expect(atEnd.expression).toBe(`x+1${PREVIEW_CARET_TEX}`);

    const insideLabel = buildPreviewExpression(equation, equationRegion, equation.indexOf('eq:x') + 2);
    expect(insideLabel.expression).toBe(`x+1${PREVIEW_CARET_TEX}`);

    const align = String.raw`\begin{align}x&=1\\y&=2\end{align}`;
    const alignRegion = scanMathRegions(align).regions[0]!;
    expect(buildPreviewExpression(align, alignRegion, alignRegion.contentStart, false).expression)
      .toBe(String.raw`\begin{aligned}x&=1\\y&=2\end{aligned}`);

    const alignat = String.raw`\begin{alignat}{1}x&=1\end{alignat}`;
    const alignatRegion = scanMathRegions(alignat).regions[0]!;
    expect(buildPreviewExpression(alignat, alignatRegion, alignatRegion.contentStart).expression)
      .toBe(String.raw`\begin{alignedat}{1}` + PREVIEW_CARET_TEX + String.raw`x&=1\end{alignedat}`);
  });
});
