import { describe, expect, it } from 'vitest';

import { findMathRegionAt, scanMathRegions } from '../src/core/mathScanner';
import { buildPreviewExpression, PREVIEW_CARET_TEX } from '../src/core/previewExpression';
import {
  buildTableExpression,
  isTableEnvironment,
  normalizeColumnSpec,
  parseArrayHlineBoundaries,
  parseArrayHlineCounts,
  readTablePreamble,
  TABLE_PREVIEW_SCALE,
} from '../src/core/tablePreview';
import { MathJaxSvgRenderer, tableRulesInRootSpace } from '../src/render/mathjaxRenderer';

const booktabs = String.raw`\begin{center}
\begin{tabular}{ccc}
\toprule
真实距离$/\eps$ & $|\cos(\nabla\varphi,\ n)|$ & $|\varphi|$ 的相对误差 \\
\midrule
$0.5\sim4$ & $0.95\sim0.995$ & $0.03\sim0.09$ \\
6 & $0.767$ & $0.30$ \\
\bottomrule
\end{tabular}
\end{center}`;

function regionAt(source: string, offset: number) {
  const region = findMathRegionAt(scanMathRegions(source).regions, offset);
  if (!region) throw new Error('未扫描到表格区域');
  return region;
}

interface RuleRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly dataLine: string | undefined;
  readonly dataFrame: string | undefined;
  readonly fill: string | undefined;
}

function parseRuleRects(svg: string): RuleRect[] {
  return [...svg.matchAll(/<rect\b([^>]*)>/gi)].map((match) => {
    const attrs = match[1] ?? '';
    const num = (name: string): number => Number(new RegExp(`\\b${name}="([^"]*)"`, 'i').exec(attrs)?.[1] ?? 'NaN');
    const attr = (name: string): string | undefined => new RegExp(`\\b${name}="([^"]*)"`, 'i').exec(attrs)?.[1];
    return {
      x: num('x'),
      y: num('y'),
      width: num('width'),
      height: num('height'),
      dataLine: attr('data-line'),
      dataFrame: attr('data-frame'),
      fill: attr('fill'),
    };
  }).filter((rect) => [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite));
}

function filledHorizontalRules(svg: string): RuleRect[] {
  return parseRuleRects(svg).filter((rect) => {
    if (rect.dataFrame || rect.fill === 'none' || rect.dataLine === 'v') return false;
    return rect.dataLine === 'h' || rect.width > rect.height * 2;
  }).sort((left, right) => left.y - right.y || left.x - right.x);
}

function filledHlineMarks(svg: string): RuleRect[] {
  return parseRuleRects(svg)
    .filter((rect) => rect.dataLine === 'h' && rect.fill !== 'none')
    .sort((left, right) => left.y - right.y || left.x - right.x);
}

function filledVerticalRules(svg: string): RuleRect[] {
  return parseRuleRects(svg).filter((rect) => {
    if (rect.dataFrame || rect.fill === 'none' || rect.dataLine === 'h') return false;
    return rect.dataLine === 'v' || rect.height > rect.width * 2;
  }).sort((left, right) => left.x - right.x || left.y - right.y);
}

function closestPairGap(rects: readonly RuleRect[], axis: 'x' | 'y'): { readonly gap: number; readonly stroke: number } | undefined {
  let best: { gap: number; stroke: number } | undefined;
  for (let index = 0; index < rects.length - 1; index += 1) {
    const first = rects[index]!;
    const second = rects[index + 1]!;
    const gap = axis === 'y'
      ? second.y - (first.y + first.height)
      : second.x - (first.x + first.width);
    if (!(gap > 0)) continue;
    if (!best || gap < best.gap) {
      best = { gap, stroke: axis === 'y' ? Math.min(first.height, second.height) : Math.min(first.width, second.width) };
    }
  }
  return best;
}

function renderTable(source: string, at: string) {
  const region = regionAt(source, source.indexOf(at));
  const expression = buildPreviewExpression(source, region, source.indexOf(at), false).expression;
  const renderer = new MathJaxSvgRenderer();
  const result = renderer.render({
    displayMode: true,
    definitionFingerprint: 'table-rules',
    definitionPrelude: '',
    foreground: '#d4d4d4',
    caretColor: '#ffb454',
    scale: TABLE_PREVIEW_SCALE,
    exPx: 7,
    markUnknownCommands: false,
    expression,
  });
  renderer.clear();
  return { expression, result };
}

describe('parseArrayHlineCounts', () => {
  it('只数外层 array 的连续 hline，嵌套表里的线不算', () => {
    expect(parseArrayHlineCounts('x+y')).toEqual([]);
    expect(parseArrayHlineCounts(String.raw`\begin{array}{c}\begin{array}{c}\hline x\end{array}\\ \hline y\end{array}`)).toEqual([0, 1]);
  });
});

describe('表格环境识别', () => {
  it('tabular 与 longtable 被当作可预览区域，math 环境判定不变', () => {
    expect(isTableEnvironment('tabular')).toBe(true);
    expect(isTableEnvironment('longtable')).toBe(true);
    expect(isTableEnvironment('equation')).toBe(false);
    expect(isTableEnvironment(undefined)).toBe(false);

    const region = regionAt(booktabs, booktabs.indexOf('0.767'));
    expect(region.environment).toBe('tabular');
    // 单元格里的 $...$ 不再单独成区域，光标落在数字上预览的是整张表。
    expect(region.start).toBe(booktabs.indexOf('\\begin{tabular}'));
  });
});

describe('列格式归一化', () => {
  it('只保留 array 认识的 l/c/r 与竖线', () => {
    expect(normalizeColumnSpec('|l|c|r|')).toBe('|l|c|r|');
    expect(normalizeColumnSpec('p{3cm}m{2em}b{1in}')).toBe('lll');
    expect(normalizeColumnSpec('>{\\centering\\arraybackslash}X|Y')).toBe('l|c');
    expect(normalizeColumnSpec('*{3}{c}|*{2}{l}')).toBe('ccc|ll');
    expect(normalizeColumnSpec('@{}c@{\\hspace{1em}}c@{}')).toBe('cc');
    // 未知列类型宁可按居中，也不能少一列让后面串位。
    expect(normalizeColumnSpec('cZc')).toBe('ccc');
  });

  it('跳过 tabular*/tabularx 的宽度参数后才取列格式', () => {
    expect(readTablePreamble('{\\textwidth}{cc}a&b').spec).toBe('cc');
    expect(readTablePreamble('{0.9\\linewidth}[t]{|l|}x').spec).toBe('|l|');
    expect(readTablePreamble('[t]{ccc}\n\\hline').spec).toBe('ccc');
    expect(readTablePreamble('{ccc} rest').bodyStart).toBe(6);
  });
});

describe('buildTableExpression', () => {
  it('booktabs 规则变成 hline，单元格按文本模式包裹', () => {
    const region = regionAt(booktabs, booktabs.indexOf('0.767'));
    const expression = buildPreviewExpression(booktabs, region, booktabs.indexOf('0.767'), false).expression;
    expect(expression).toBe(
      String.raw`\begin{array}{ccc}\hline \text{真实距离$/\eps$}&\text{$|\cos(\nabla\varphi,\ n)|$}&\text{$|\varphi|$ 的相对误差}\\\hline \text{$0.5\sim4$}&\text{$0.95\sim0.995$}&\text{$0.03\sim0.09$}\\\text{6}&\text{$0.767$}&\text{$0.30$}\\\hline \end{array}`,
    );
  });

  it('multicolumn 补回被吃掉的列，并用 class 标出跨度', () => {
    const expression = buildTableExpression(
      String.raw`{ccc}\hline \multicolumn{2}{c}{合计} & $9$ \\ \multirow{2}{*}{左} & a & b \\`,
    );
    expect(expression).toContain(String.raw`\class{silk-span-c2-r1-c}{\text{合计}}&&\text{$9$}`);
    expect(expression).toContain(String.raw`\class{silk-span-c1-r2-c}{\text{左}}&\text{a}&\text{b}`);
    expect(expression.startsWith(String.raw`\begin{array}{ccc}`)).toBe(true);
  });

  it('嵌套的 multicolumn+multirow 合成一个 span class', () => {
    const expression = buildTableExpression(
      String.raw`{cc}\multicolumn{2}{c}{\multirow{2}{*}{总}} \\ & \\`,
    );
    expect(expression).toContain('\\class{silk-span-c2-r2-c}');
    expect(expression).toContain('\\text{总}');
  });

  it('makecell/thead 展开成单元格内的纵向 array', () => {
    const expression = buildTableExpression(String.raw`{cc}\thead{方法} & \makecell[t]{相对\\误差} \\`);
    expect(expression).toContain(String.raw`\begin{array}{c}\text{方法}\end{array}`);
    expect(expression).toContain(String.raw`\begin{array}{c}\text{相对}\\\text{误差}\end{array}`);
  });

  it('longtable 的标题、跨页标记与颜色命令都不进入预览', () => {
    const expression = buildTableExpression(String.raw`{|l|c|}
\caption{示例}\label{tab:x}\\
\hline
\rowcolor{gray!20} \textbf{方法} & 误差 \\
\endfirsthead
\endhead
PINN & $0.12$ \\
\hline
\endlastfoot`);
    expect(expression).not.toMatch(/caption|label|endhead|endfirsthead|endlastfoot|rowcolor/);
    expect(expression).toContain(String.raw`\text{\textbf{方法}}&\text{误差}`);
    expect(expression).toContain(String.raw`\text{PINN}&\text{$0.12$}`);
    // 只剩标题命令的空行被丢掉，不会留下一整行空格。
    expect(expression).not.toContain(String.raw`\\\\`);
  });

  it('注释先被去掉，`%` 不会吃掉补出来的括号与换行', () => {
    const source = String.raw`\begin{tabular}{cc}
% 这一行是说明 \\ 也在注释里
a & b \\ % 行尾注释
c & d \\
\end{tabular}`;
    const caret = source.indexOf('a &');
    const expression = buildPreviewExpression(source, regionAt(source, caret), caret, false).expression;
    expect(expression).toBe(String.raw`\begin{array}{cc}\text{a}&\text{b}\\\text{c}&\text{d}\end{array}`);
  });

  it('列数不足时补齐列格式，避免多出来的单元格报错', () => {
    const expression = buildTableExpression(String.raw`{c}a & b & c \\`);
    expect(expression.startsWith(String.raw`\begin{array}{ccc}`)).toBe(true);
  });

  it('行末的 \\\\[2pt] 与 \\tabularnewline 都能断行', () => {
    const expression = buildTableExpression(String.raw`{cc}a & b \\[2pt] c & d \tabularnewline e & f \\`);
    expect(expression).toContain(String.raw`\text{a}&\text{b}\\\text{c}&\text{d}\\\text{e}&\text{f}`);
  });
});

describe('表格内的源码同步光标', () => {
  it('文本单元格里的光标自带 $...$，数学单元格里保持裸标记', () => {
    const textCaret = booktabs.indexOf('真实距离') + 2;
    const inText = buildPreviewExpression(booktabs, regionAt(booktabs, textCaret), textCaret).expression;
    expect(inText).toContain(`$${PREVIEW_CARET_TEX}$`);

    const mathCaret = booktabs.indexOf('0.767') + 2;
    const inMath = buildPreviewExpression(booktabs, regionAt(booktabs, mathCaret), mathCaret).expression;
    expect(inMath).toContain(`0.${PREVIEW_CARET_TEX}767`);
    expect(inMath).not.toContain(`$${PREVIEW_CARET_TEX}$`);
  });

  it('光标停在列格式参数里时被推到正文，列定义不被破坏', () => {
    const specCaret = booktabs.indexOf('{ccc}') + 2;
    const expression = buildPreviewExpression(booktabs, regionAt(booktabs, specCaret), specCaret).expression;
    expect(expression.startsWith(String.raw`\begin{array}{ccc}`)).toBe(true);
    expect(expression).toContain(PREVIEW_CARET_TEX);
  });
});

describe('表格预览渲染', () => {
  it('真实表格能渲染成 SVG，并按表格档位整体缩小', () => {
    const caret = booktabs.indexOf('0.767') + 2;
    const expression = buildPreviewExpression(booktabs, regionAt(booktabs, caret), caret).expression;
    const renderer = new MathJaxSvgRenderer();
    const options = {
      displayMode: true,
      definitionFingerprint: 'table-test',
      definitionPrelude: String.raw`\newcommand{\eps}{\varepsilon}`,
      foreground: '#d4d4d4',
      caretColor: '#ffb454',
      exPx: 7,
      markUnknownCommands: false,
      expression,
    };
    const table = renderer.render({ ...options, scale: TABLE_PREVIEW_SCALE });
    const full = renderer.render({ ...options, scale: 1 });
    expect(table.svg).toContain('silk-math-caret');
    // 中文按 <text> 输出，由系统字体绘制。
    expect(table.svg).toContain('真实距离');
    expect(table.widthPx).toBeGreaterThan(0);
    expect(table.widthPx).toBeCloseTo(full.widthPx * TABLE_PREVIEW_SCALE, 1);
    expect(table.svg).toContain(`width="${table.widthPx}px"`);
    renderer.clear();
  });

  it('竖线和 hline 的外框是描边，不是实心色块', () => {
    const source = String.raw`\begin{tabular}{|c|c|c|}
\hline
A & B & C \\
\hline
1 & 2 & 3 \\
\hline
\end{tabular}`;
    const region = regionAt(source, source.indexOf('A'));
    const expression = buildPreviewExpression(source, region, source.indexOf('A'), false).expression;
    const renderer = new MathJaxSvgRenderer();
    const result = renderer.render({
      displayMode: true,
      definitionFingerprint: 'framed-tabular',
      definitionPrelude: '',
      foreground: '#d4d4d4',
      caretColor: '#ffb454',
      scale: TABLE_PREVIEW_SCALE,
      exPx: 7,
      markUnknownCommands: false,
      expression,
    });
    const frame = /<rect\b[^>]*data-frame="true"[^>]*>/i.exec(result.svg)?.[0];
    expect(frame).toMatch(/fill="none"/i);
    expect(result.svg).toMatch(/<rect\b[^>]*data-line="v"[^>]*width="70"/i);
    expect(result.svg).toContain('data-c="41');
    renderer.clear();
  });

  it('连续 \\hline\\hline 画成两根紧致横线，间隙大约一根线宽而不是空行', () => {
    const double = String.raw`\begin{tabular}{|c|c|}
\hline\hline
A & B \\
\hline\hline
1 & 2 \\
\hline\hline
\end{tabular}`;
    const single = String.raw`\begin{tabular}{|c|c|}
\hline
A & B \\
\hline
1 & 2 \\
\hline
\end{tabular}`;
    const { expression, result } = renderTable(double, 'A');
    expect(expression).toMatch(/\\hline\s*\\hline/);
    expect(parseArrayHlineCounts(expression)).toEqual([2, 2, 2]);
    const horizontals = filledHorizontalRules(result.svg);
    expect(horizontals.length).toBeGreaterThanOrEqual(4);
    const pair = closestPairGap(horizontals, 'y');
    expect(pair).toBeDefined();
    expect(pair!.gap).toBeGreaterThan(0);
    expect(pair!.gap).toBeLessThanOrEqual(pair!.stroke * 3);
    const tableHeight = Math.max(...horizontals.map((rect) => rect.y + rect.height))
      - Math.min(...horizontals.map((rect) => rect.y));
    expect(pair!.gap).toBeLessThan(tableHeight / 4);

    const control = renderTable(single, 'A');
    expect(parseArrayHlineCounts(control.expression).every((count) => count <= 1)).toBe(true);
    const singlePair = closestPairGap(filledHorizontalRules(control.result.svg), 'y');
    if (singlePair) expect(singlePair.gap).toBeGreaterThan(singlePair.stroke * 3);
  });

  it('列格式 || 画成两根不重合的紧致竖线', () => {
    const double = String.raw`\begin{tabular}{||c||c||}
\hline
A & B \\
\hline
1 & 2 \\
\hline
\end{tabular}`;
    const single = String.raw`\begin{tabular}{|c|c|}
\hline
A & B \\
\hline
1 & 2 \\
\hline
\end{tabular}`;
    const { expression, result } = renderTable(double, 'A');
    expect(expression).toContain('{||c||c||}');
    const verticals = filledVerticalRules(result.svg);
    expect(verticals.length).toBeGreaterThanOrEqual(2);
    const xs = [...new Set(verticals.map((rect) => rect.x))];
    expect(xs.length).toBeGreaterThanOrEqual(2);
    const pair = closestPairGap(verticals, 'x');
    expect(pair).toBeDefined();
    expect(pair!.gap).toBeGreaterThan(0);
    expect(pair!.gap).toBeLessThanOrEqual(pair!.stroke * 4);
    const tableWidth = Math.max(...verticals.map((rect) => rect.x + rect.width))
      - Math.min(...verticals.map((rect) => rect.x));
    expect(pair!.gap).toBeLessThan(tableWidth / 4);

    const control = renderTable(single, 'A');
    const singlePair = closestPairGap(filledVerticalRules(control.result.svg), 'x');
    if (singlePair) expect(singlePair.gap).toBeGreaterThan(singlePair.stroke * 4);
  });

  it('只有一条边界是 \\hline\\hline、其余行没有横线时，双线画在那条边界上', () => {
    const topOnly = String.raw`\begin{tabular}{|c|c|}
\hline\hline
A & B \\
C & D \\
\end{tabular}`;
    const midOnly = String.raw`\begin{tabular}{|c|c|}
A & B \\
\hline\hline
C & D \\
\end{tabular}`;
    const bottomOnly = String.raw`\begin{tabular}{|c|c|}
A & B \\
C & D \\
\hline\hline
\end{tabular}`;

    expect(parseArrayHlineBoundaries(renderTable(topOnly, 'A').expression)
      .filter((boundary) => boundary.count >= 2)
      .map((boundary) => boundary.place)).toEqual(['top']);
    expect(parseArrayHlineBoundaries(renderTable(midOnly, 'A').expression)
      .filter((boundary) => boundary.count >= 2)
      .map((boundary) => boundary.place)).toEqual(['inner']);
    expect(parseArrayHlineBoundaries(renderTable(bottomOnly, 'A').expression)
      .filter((boundary) => boundary.count >= 2)
      .map((boundary) => boundary.place)).toEqual(['bottom']);

    const locate = (source: string) => {
      const { result } = renderTable(source, 'A');
      expect(result.svg).toMatch(/scale\(1,-1\)/);
      const marks = filledHlineMarks(result.svg);
      expect(marks.length).toBeGreaterThanOrEqual(2);
      const root = tableRulesInRootSpace(result.svg);
      const horizontals = root
        .filter((rule) => rule.dataLine === 'h' && rule.filled)
        .sort((left, right) => left.visualY - right.visualY);
      expect(horizontals.length).toBeGreaterThanOrEqual(2);
      let bestI = 0;
      let bestGap = Number.POSITIVE_INFINITY;
      for (let index = 0; index < horizontals.length - 1; index += 1) {
        const gap = horizontals[index + 1]!.visualY - (horizontals[index]!.visualY + horizontals[index]!.visualHeight);
        if (gap > 0 && gap < bestGap) {
          bestGap = gap;
          bestI = index;
        }
      }
      expect(bestGap).toBeGreaterThan(0);
      expect(bestGap).toBeLessThanOrEqual(horizontals[bestI]!.visualHeight * 3);
      const pairMid = (
        horizontals[bestI]!.visualY + horizontals[bestI + 1]!.visualY + horizontals[bestI + 1]!.visualHeight
      ) / 2;
      const ys = root.flatMap((rule) => [rule.visualY, rule.visualY + rule.visualHeight]);
      const tableTop = Math.min(...ys);
      const tableBottom = Math.max(...ys);
      return { pairMid, tableTop, tableBottom, span: tableBottom - tableTop, svg: result.svg };
    };

    const top = locate(topOnly);
    // 根坐标 y 向下：更小的 visualY 是视口上方，也是 A 行所在的表首。
    expect(top.pairMid - top.tableTop).toBeLessThan(top.span / 3);
    const mid = locate(midOnly);
    expect(Math.abs(mid.pairMid - (mid.tableTop + mid.tableBottom) / 2)).toBeLessThan(mid.span / 3);
    const bottom = locate(bottomOnly);
    expect(bottom.tableBottom - bottom.pairMid).toBeLessThan(bottom.span / 3);
  });

  it('multicolumn 把内容移到跨列中心，multirow 移到跨行中心', () => {
    const spanned = String.raw`\begin{tabular}{ccc}
\multicolumn{2}{c}{合计} & 9 \\
\multirow{2}{*}{左} & a & b \\
 & c & d \\
\end{tabular}`;
    const plain = String.raw`\begin{tabular}{ccc}
合计 & 空 & 9 \\
左 & a & b \\
下 & c & d \\
\end{tabular}`;
    const spannedRender = renderTable(spanned, '合计');
    const plainRender = renderTable(plain, '合计');
    expect(spannedRender.expression).toContain('silk-span-c2-r1-c');
    expect(spannedRender.expression).toContain('silk-span-c1-r2-c');
    expect(spannedRender.result.svg).toContain('silk-span-c2-r1-c');
    expect(spannedRender.result.svg).toContain('silk-span-c1-r2-c');

    const spanX = /<g\b[^>]*silk-span-c2-r1-c[^>]*transform="translate\(([-\d.]+)/.exec(spannedRender.result.svg);
    expect(spanX).toBeTruthy();
    expect(Number(spanX?.[1])).toBeGreaterThan(100);

    const spanY = /<g\b[^>]*silk-span-c1-r2-c[^>]*transform="translate\(([-\d.]+),\s*([-\d.]+)/.exec(spannedRender.result.svg);
    expect(spanY).toBeTruthy();
    expect(Math.abs(Number(spanY?.[2]))).toBeGreaterThan(50);

    expect(plainRender.result.svg).not.toContain('silk-span-c2');
    expect(spannedRender.result.svg).toContain('合计');
    expect(spannedRender.result.svg).toContain('data-c="61');
  });
});
