import { describe, expect, it } from 'vitest';

import {
  advanceMarkdownFenceState,
  findMathRegionAt,
  mathRegionContent,
  regionContainsOffset,
  scanMathRegions,
  selectionOverlapsRegion,
} from '../src/core/mathScanner';

describe('scanMathRegions', () => {
  it('识别 LaTeX 与 Markdown 常用分隔符', () => {
    const text = 'A $x+1$ B $$y$$ C \\(z\\) D \\[w\\]';
    const result = scanMathRegions(text);

    expect(result.regions.map((region) => region.kind)).toEqual([
      'dollar-inline',
      'dollar-display',
      'paren-inline',
      'bracket-display',
    ]);
    expect(result.regions.map((region) => mathRegionContent(text, region))).toEqual([
      'x+1',
      'y',
      'z',
      'w',
    ]);
    expect(result.regions.every((region) => region.closed)).toBe(true);
  });

  it('识别内置与自定义数学环境并匹配同名嵌套', () => {
    const standard = '\\begin{align}a&=b\\end{align}';
    const custom =
      '\\begin{proofmath}a\\begin{proofmath}b\\end{proofmath}c\\end{proofmath}';
    const text = `${standard}\n${custom}`;

    expect(scanMathRegions(text).regions).toHaveLength(1);
    const result = scanMathRegions(text, {
      customMathEnvironments: ['proofmath', 'not a valid env'],
    });
    expect(result.regions).toHaveLength(2);
    expect(result.regions[0]).toMatchObject({
      kind: 'environment',
      environment: 'align',
      closed: true,
    });
    expect(result.regions[1]).toMatchObject({
      environment: 'proofmath',
      closed: true,
    });
  });

  it('环境的 begin/end 标记与内部文字均属于可点击公式区域', () => {
    const text = String.raw`\begin{equation}x+1\label{eq:x}\end{equation}`;
    const region = scanMathRegions(text).regions[0]!;
    for (let offset = region.start; offset < region.end; offset += 1) {
      expect(findMathRegionAt([region], offset), `offset ${offset}`).toBe(region);
    }
    expect(findMathRegionAt([region], region.end)).toBeUndefined();
  });

  it('跳过 LaTeX 注释和转义美元符号', () => {
    const text = 'price \\$5\n% $ignored$\n$x\\%y$';
    const result = scanMathRegions(text, { language: 'latex' });

    expect(result.regions).toHaveLength(1);
    expect(mathRegionContent(text, result.regions[0]!)).toBe('x\\%y');
    expect(result.ignoredRanges).toHaveLength(1);
    expect(text.slice(
      result.ignoredRanges[0]!.start,
      result.ignoredRanges[0]!.end,
    )).toBe('% $ignored$');
  });

  it('跳过 Markdown inline code、反引号 fence 和波浪线 fence', () => {
    const text = [
      '`$inline-code$` and $math$',
      '```tex',
      '$fenced$',
      '```',
      '~~~',
      '\\[also-fenced\\]',
      '~~~',
      '\\(live\\)',
    ].join('\n');
    const result = scanMathRegions(text, { language: 'markdown' });

    expect(result.regions.map((region) => mathRegionContent(text, region))).toEqual([
      'math',
      'live',
    ]);
    // 相邻的两个 fenced block 会合并为一个连续忽略区间。
    expect(result.ignoredRanges).toHaveLength(2);
  });

  it('支持跨行 Markdown code span 和未闭合 fence', () => {
    const text = '`code\n$still-code$` $math$\n```\n$never-math$';
    const result = scanMathRegions(text, { language: 'markdown' });

    expect(result.regions).toHaveLength(1);
    expect(mathRegionContent(text, result.regions[0]!)).toBe('math');
    expect(result.ignoredRanges.at(-1)?.end).toBe(text.length);
  });

  it('处理 CRLF fence、不同长度 code span 和无匹配 inline code', () => {
    const fencedText = [
      '``value ` inside`` $first$',
      '```ts\r',
      '$fenced$\r',
      '````\r',
      '$third$',
    ].join('\n');
    const fenced = scanMathRegions(fencedText, { language: 'markdown' });

    expect(fenced.regions.map(
      (region) => mathRegionContent(fencedText, region),
    )).toEqual(['first', 'third']);

    const unmatchedText = '$first$ `unclosed $second$';
    const unmatched = scanMathRegions(unmatchedText, { language: 'markdown' });
    expect(unmatched.regions.map(
      (region) => mathRegionContent(unmatchedText, region),
    )).toEqual(['first', 'second']);

    const invalidFenceText = '```bad`info\n$math$';
    const invalidFence = scanMathRegions(invalidFenceText, { language: 'markdown' });
    expect(mathRegionContent(invalidFenceText, invalidFence.regions[0]!)).toBe('math');
  });

  it('有界 Markdown 片段继承窗口起点之前的 fenced-code 状态', () => {
    const fragment = [
      '$not_math$',
      '```',
      'after $math$',
    ].join('\n');
    const result = scanMathRegions(fragment, {
      language: 'markdown',
      markdownInitialFence: { marker: '`', length: 3 },
    });

    expect(result.regions.map(
      (region) => mathRegionContent(fragment, region),
    )).toEqual(['math']);
  });

  it('逐行推进 Markdown fence 状态并遵守 marker 与长度', () => {
    const opened = advanceMarkdownFenceState(undefined, '```ts');
    expect(opened).toEqual({ marker: '`', length: 3 });
    expect(advanceMarkdownFenceState(opened, '~~')).toEqual(opened);
    expect(advanceMarkdownFenceState(opened, '``')).toEqual(opened);
    expect(advanceMarkdownFenceState(opened, '```')).toBeUndefined();
    expect(advanceMarkdownFenceState(undefined, '```bad`info')).toBeUndefined();
  });

  it('在 Markdown 公式内部跳过 TeX 注释中的伪关闭符', () => {
    const text = '$a % $ ignored\n+b$';
    const result = scanMathRegions(text, { language: 'markdown' });

    expect(result.regions).toHaveLength(1);
    expect(result.regions[0]?.closed).toBe(true);
    expect(mathRegionContent(text, result.regions[0]!)).toContain('+b');
  });

  it('行内公式可以跨行闭合，遇到空行才恢复', () => {
    // 回归：真实笔记里写成 `\scalebox{0.9}{\tiny $` 换行、`$}` 收尾。若一遇换行就放弃，
    // 后面每个 `$` 都会和错误的伙伴配对，整篇文档的行内公式从此全部错位。
    const multiline = 'a \\scalebox{0.9}{$\nx+1\n$} b $y$';
    const regions = scanMathRegions(multiline).regions;
    expect(regions).toHaveLength(2);
    expect(regions[0]?.closed).toBe(true);
    expect(mathRegionContent(multiline, regions[0]!)).toBe('\nx+1\n');
    expect(mathRegionContent(multiline, regions[1]!)).toBe('y');

    const broken = '$broken\nstill\n\nprose $ok$';
    const brokenRegions = scanMathRegions(broken).regions;
    expect(brokenRegions[0]).toMatchObject({
      closed: false,
      recovery: { reason: 'unclosed-inline-delimiter' },
    });
    expect(brokenRegions[0]?.end).toBe(broken.indexOf('\n\n'));
    expect(mathRegionContent(broken, brokenRegions[1]!)).toBe('ok');
  });

  it('未闭合块公式在空行或窗口上限恢复', () => {
    const blankLineText = '$$broken\nstill\n\nprose $ok$';
    const blankLineResult = scanMathRegions(blankLineText);
    expect(blankLineResult.regions[0]).toMatchObject({
      closed: false,
      recovery: { reason: 'unclosed-display-delimiter' },
    });
    expect(mathRegionContent(blankLineText, blankLineResult.regions[1]!)).toBe('ok');

    const cappedText = `\\[${'x'.repeat(100)} $later$`;
    const cappedResult = scanMathRegions(cappedText, { recoveryWindowChars: 64 });
    expect(cappedResult.regions[0]?.end).toBe(64);
    expect(cappedResult.regions.some(
      (region) => mathRegionContent(cappedText, region) === 'later',
    )).toBe(true);
  });

  it('未闭合环境提供恢复标记', () => {
    const text = '\\begin{equation}x+1';
    const [region] = scanMathRegions(text).regions;

    expect(region).toMatchObject({
      closed: false,
      environment: 'equation',
      recovery: { reason: 'unclosed-environment' },
    });
  });

  it('环境匹配忽略注释里的伪 end 并容忍非环境 begin 文本', () => {
    const text = [
      '\\begin{equation}',
      'x % \\end{equation}',
      '+y',
      '\\end{equation}',
      '\\begin broken',
    ].join('\n');
    const result = scanMathRegions(text);

    expect(result.regions).toHaveLength(1);
    expect(result.regions[0]?.closed).toBe(true);
    expect(mathRegionContent(text, result.regions[0]!)).toContain('+y');
  });

  it('二分查找遵守闭合尾端与未闭合文末语义', () => {
    const closedText = 'a $x$ b';
    const closed = scanMathRegions(closedText).regions[0]!;
    expect(findMathRegionAt([closed], closed.start)).toBe(closed);
    expect(findMathRegionAt([closed], closed.contentStart)).toBe(closed);
    expect(findMathRegionAt([closed], closed.end)).toBeUndefined();
    expect(findMathRegionAt([closed], -1)).toBeUndefined();

    const openText = '$x';
    const open = scanMathRegions(openText).regions[0]!;
    expect(findMathRegionAt([open], openText.length)).toBe(open);
  });

  it('选区与公式有交集时不算离开，空选区仍按闭合尾端判断', () => {
    const closed = scanMathRegions('a $x+y$ b').regions[0]!;
    expect(regionContainsOffset(closed, closed.contentStart)).toBe(true);
    expect(regionContainsOffset(closed, closed.end)).toBe(false);
    expect(selectionOverlapsRegion(closed.start, closed.end + 4, closed)).toBe(true);
    expect(selectionOverlapsRegion(closed.contentStart, closed.contentStart + 1, closed)).toBe(true);
    expect(selectionOverlapsRegion(0, 1, closed)).toBe(false);
    expect(selectionOverlapsRegion(closed.end, closed.end, closed)).toBe(false);
  });
});
