import { describe, expect, it } from 'vitest';

import { findMathRegionAt, scanMathRegions } from '../src/core/mathScanner';
import { buildPreviewExpression, PREVIEW_CARET_TEX } from '../src/core/previewExpression';
import {
  buildTableExpression,
  isTableEnvironment,
  normalizeColumnSpec,
  readTablePreamble,
  TABLE_PREVIEW_SCALE,
} from '../src/core/tablePreview';
import { MathJaxSvgRenderer } from '../src/render/mathjaxRenderer';

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

  it('multicolumn 补回被吃掉的列，multirow 只留内容', () => {
    const expression = buildTableExpression(
      String.raw`{ccc}\hline \multicolumn{2}{c}{合计} & $9$ \\ \multirow{2}{*}{左} & a & b \\`,
    );
    expect(expression).toContain(String.raw`\text{合计}&&\text{$9$}`);
    expect(expression).toContain(String.raw`\text{左}&\text{a}&\text{b}`);
    expect(expression.startsWith(String.raw`\begin{array}{ccc}`)).toBe(true);
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
});
