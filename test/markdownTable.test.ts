import { describe, expect, it } from 'vitest';

import {
  buildMarkdownTableExpression,
  collectMarkdownTableRegions,
  isMarkdownTableDelimiter,
  markdownTableCellStart,
  parseMarkdownTable,
  splitMarkdownTableRow,
} from '../src/core/markdownTable';
import { findMathRegionAt, scanMathRegions } from '../src/core/mathScanner';
import { buildPreviewExpression, PREVIEW_CARET_TEX } from '../src/core/previewExpression';
import { isTablePreviewRegion } from '../src/core/tablePreview';
import { MathJaxSvgRenderer } from '../src/render/mathjaxRenderer';

const gfm = [
  '| 名称 | 值 |',
  '| :--- | ---: |',
  '| 能量 $E$ | $mc^2$ |',
  '| 备注 | foo_bar |',
].join('\n');

describe('Markdown 表格切分', () => {
  it('识别左右管道和转义竖线', () => {
    expect(splitMarkdownTableRow('| a | b |')).toEqual(['a', 'b']);
    expect(splitMarkdownTableRow('a | b')).toEqual(['a', 'b']);
    expect(splitMarkdownTableRow('| a \\| b | c |')).toEqual(['a | b', 'c']);
    expect(splitMarkdownTableRow('plain text')).toBeUndefined();
  });

  it('公式里的竖线不是列分隔', () => {
    expect(splitMarkdownTableRow('| 能量 | $E(u)$ | $\\int |\\nabla u|^2$ |'))
      .toEqual(['能量', '$E(u)$', '$\\int |\\nabla u|^2$']);
    expect(splitMarkdownTableRow('| 范数 | $\\lVert x \\rVert$ | $|x|$ |'))
      .toEqual(['范数', '$\\lVert x \\rVert$', '$|x|$']);
    expect(splitMarkdownTableRow('| a | \\( |x| \\) | b |'))
      .toEqual(['a', '\\( |x| \\)', 'b']);
    expect(splitMarkdownTableRow('| a | $$|x|$$ | b |'))
      .toEqual(['a', '$$|x|$$', 'b']);
    expect(splitMarkdownTableRow('| a | \\[ |x| \\] | b |'))
      .toEqual(['a', '\\[ |x| \\]', 'b']);
  });

  it('分隔行决定对齐', () => {
    expect(isMarkdownTableDelimiter(['---', ':---:', '---:'])).toBe(true);
    expect(isMarkdownTableDelimiter(['foo', '---'])).toBe(false);
    const parsed = parseMarkdownTable(gfm);
    expect(parsed?.alignments).toEqual(['l', 'r']);
    expect(parsed?.rows).toHaveLength(3);
    expect(parsed?.rows[0]).toEqual(['名称', '值']);
  });
});

describe('Markdown 表格扫描', () => {
  it('光标在表内任意位置都得到整张表，单元格里的 $ 不再单独成区域', () => {
    const text = `前文 $x+1$\n\n${gfm}\n\n后文`;
    const result = scanMathRegions(text, { language: 'markdown' });
    const kinds = result.regions.map((region) => region.kind);
    expect(kinds).toEqual(['dollar-inline', 'markdown-table']);
    const table = result.regions[1]!;
    expect(isTablePreviewRegion(table)).toBe(true);
    expect(table.start).toBe(text.indexOf('| 名称'));
    expect(findMathRegionAt(result.regions, text.indexOf('mc^2'))).toBe(table);
    expect(findMathRegionAt(result.regions, text.indexOf('foo_bar'))).toBe(table);
    expect(findMathRegionAt(result.regions, text.indexOf('x+1'))?.kind).toBe('dollar-inline');
  });

  it('跳过 fenced code 里的伪表格', () => {
    const text = ['```', '| a | b |', '| --- | --- |', '| 1 | 2 |', '```', '', '| 真 | 表 |', '| --- | --- |', '| 3 | 4 |'].join('\n');
    const result = scanMathRegions(text, { language: 'markdown' });
    expect(result.regions).toHaveLength(1);
    expect(result.regions[0]?.kind).toBe('markdown-table');
    expect(text.slice(result.regions[0]!.start, result.regions[0]!.end)).toContain('真');
  });

  it('没有分隔行的管道文字不是表格', () => {
    const text = '价格 a | b 不是表\n下一行普通文字';
    expect(collectMarkdownTableRegions(text, [])).toEqual([]);
    expect(scanMathRegions(text, { language: 'markdown' }).regions).toEqual([]);
  });
});

describe('Markdown 表格预览表达式', () => {
  it('对齐进 array，单元格文本转义，行内公式保留', () => {
    const expression = buildMarkdownTableExpression(gfm);
    expect(expression.startsWith('\\begin{array}{|l|r|}')).toBe(true);
    expect(expression).toContain('\\hline');
    expect(expression).toContain('\\text{能量 $E$}');
    expect(expression).toContain('\\text{$mc^2$}');
    expect(expression).toContain('\\text{foo\\_bar}');
    expect(expression).not.toContain('---');
  });

  it('单元格里带 | 的行内公式能渲染', () => {
    const source = [
      '| 项 | 记号 | 值 |',
      '| --- | :---: | ---: |',
      '| 矩阵 | $\\A$ | $n\\times n$ |',
      '| 能量 | $E(u)$ | $\\int |\\nabla u|^2$ |',
    ].join('\n');
    const expression = buildMarkdownTableExpression(source);
    expect(expression).toContain('\\begin{array}{|l|c|r|}');
    expect(expression).toContain('\\hline');
    expect(expression).toContain('\\text{$\\int |\\nabla u|^2$}');
    const renderer = new MathJaxSvgRenderer();
    const result = renderer.render({
      displayMode: true,
      definitionFingerprint: 'md-table-bar',
      definitionPrelude: '\\newcommand{\\A}{\\mathbf{A}}',
      foreground: '#d4d4d4',
      caretColor: '#ffb454',
      scale: 0.82,
      exPx: 7,
      markUnknownCommands: true,
      expression,
    });
    expect(result.svg.includes('<path') || result.svg.includes('<text')).toBe(true);
    const frame = /<rect\b[^>]*data-frame="true"[^>]*>/i.exec(result.svg)?.[0];
    if (frame) expect(frame).toMatch(/fill="none"/i);
    renderer.clear();
  });

  it('能被 MathJax 画出可见图元', () => {
    const renderer = new MathJaxSvgRenderer();
    const result = renderer.render({
      displayMode: true,
      definitionFingerprint: 'md-table',
      definitionPrelude: '',
      foreground: '#d4d4d4',
      caretColor: '#ffb454',
      scale: 0.82,
      exPx: 7,
      markUnknownCommands: true,
      expression: buildMarkdownTableExpression(gfm),
    });
    expect(result.svg.includes('<path') || result.svg.includes('<text')).toBe(true);
    expect(result.widthPx).toBeGreaterThan(20);
    renderer.clear();
  });

  it('预览链路给整张表而不是单元格公式', () => {
    const text = gfm;
    const region = scanMathRegions(text, { language: 'markdown' }).regions[0]!;
    const expression = buildPreviewExpression(text, region, text.indexOf('E'), false).expression;
    expect(expression).toContain('\\begin{array}{|l|r|}');
    expect(expression).toContain('能量');
  });

  it('上一格有字面 $ 时，文本单元格里的光标仍画成竖线而不是源码', () => {
    const source = [
      '| 文件 | 测什么 |',
      '| --- | --- |',
      '| `all-math.md` | 含 `$|\\nabla u|$` 和 `$` |',
      '| `all-math.txt` | 纯文本 |',
    ].join('\n');
    const region = scanMathRegions(source, { language: 'markdown' }).regions.find(
      (item) => item.kind === 'markdown-table',
    );
    expect(region).toBeDefined();
    const caretAt = source.indexOf('all-math.txt') + 'all-math.'.length;
    expect(markdownTableCellStart(source, caretAt)).toBeLessThanOrEqual(source.indexOf('`all-math.txt`') + 1);
    const expression = buildPreviewExpression(source, region!, caretAt).expression;
    expect(expression).toContain(`$${PREVIEW_CARET_TEX}$`);
    expect(expression).not.toContain('\\textbackslash');
    const renderer = new MathJaxSvgRenderer();
    const result = renderer.render({
      displayMode: true,
      definitionFingerprint: 'md-table-caret',
      definitionPrelude: '',
      foreground: '#d4d4d4',
      caretColor: '#ffb454',
      scale: 0.82,
      exPx: 7,
      markUnknownCommands: true,
      expression,
    });
    expect(result.svg).toContain('silk-math-caret');
    expect(result.svg).not.toContain('textbackslash');
    renderer.clear();
  });
});
