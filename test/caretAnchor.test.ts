import { describe, expect, it } from 'vitest';

import { anchorCaret } from '../src/core/caretAnchor';

describe('anchorCaret', () => {
  it('普通字符 seam 保持精确', () => {
    expect(anchorCaret('x + y', 2)).toEqual({
      requestedOffset: 2,
      offset: 2,
      exact: true,
      reason: 'exact',
    });
    expect(anchorCaret('\\alpha', 0).exact).toBe(true);
    expect(anchorCaret('\\alpha', 6).exact).toBe(true);
  });

  it('控制词内部吸附到最近 token 边界', () => {
    const nearStart = anchorCaret('\\alpha + x', 1);
    expect(nearStart).toMatchObject({
      offset: 0,
      exact: false,
      reason: 'control-sequence',
      unsafeRange: { start: 0, end: 6 },
    });

    const tieMovesForward = anchorCaret('\\alpha + x', 3);
    expect(tieMovesForward.offset).toBe(6);
    expect(anchorCaret('\\,x', 1)).toMatchObject({
      offset: 2,
      reason: 'control-sequence',
    });
    expect(anchorCaret('\\', 1)).toMatchObject({
      offset: 1,
      reason: 'exact',
    });
  });

  it('把 left/right 与其 delimiter 视作一个安全单元', () => {
    const text = '\\left \\langle x \\right )';
    const delimiterStart = text.indexOf('\\langle');
    const left = anchorCaret(text, delimiterStart);
    expect(left).toMatchObject({
      offset: 0,
      reason: 'left-right-head',
      exact: false,
    });
    expect(left.unsafeRange?.end).toBe(text.indexOf(' x'));

    const rightStart = text.indexOf('\\right');
    const right = anchorCaret(text, rightStart + '\\right'.length);
    expect(right.reason).toBe('left-right-head');
    expect(right.offset).toBe(text.length);

    expect(anchorCaret('\\left', 3)).toMatchObject({
      offset: 5,
      reason: 'left-right-head',
    });
  });

  it('begin/end 环境头内部吸附到整个头的边界', () => {
    const text = '\\begin {align*}x+1\\end{align*}';
    const contentStart = text.indexOf('x');
    const begin = anchorCaret(text, text.indexOf('align'));
    expect(begin).toMatchObject({
      offset: contentStart,
      reason: 'environment-head',
      exact: false,
    });

    const endStart = text.indexOf('\\end');
    const end = anchorCaret(text, text.indexOf('align', endStart));
    expect(end.reason).toBe('environment-head');
    expect(end.offset).toBe(endStart);

    const incomplete = '\\begin{ali';
    expect(anchorCaret(incomplete, 8)).toMatchObject({
      offset: incomplete.length,
      reason: 'environment-head',
    });
  });

  it('避免 marker 被命令或上下标吞作参数', () => {
    const fraction = String.raw`\frac{a}{b}`;
    expect(anchorCaret(fraction, '\\frac'.length)).toMatchObject({
      offset: fraction.indexOf('{') + 1,
      exact: false,
      reason: 'command-argument-seam',
    });
    const between = fraction.indexOf('}{') + 1;
    expect(anchorCaret(fraction, between)).toMatchObject({
      offset: between + 1,
      reason: 'command-argument-seam',
    });
    expect(anchorCaret('x^2', 2)).toMatchObject({
      offset: 3,
      exact: false,
      reason: 'script-argument-seam',
    });
    expect(anchorCaret('x_{ij}', 2)).toMatchObject({
      offset: 3,
      reason: 'script-argument-seam',
    });
  });

  it('控制词吸附后不落回上下标位置，上标内容仍留在上标', () => {
    // 回归：`T^\st|ar` 先吸附到 `\star` 起点，正好是 `^` 之后；若不再检查一次，
    // caret 会顶替 `\star` 成为上标，`\star` 掉回基线。
    const text = String.raw`T^\star`;
    for (const offset of [2, 3, 4]) {
      expect(anchorCaret(text, offset)).toMatchObject({
        offset: text.length,
        exact: false,
        reason: 'script-argument-seam',
      });
    }
    // 向后吸附的一侧本来就落在 `\star` 之后，保持原有 reason。
    for (const offset of [5, 6]) expect(anchorCaret(text, offset).offset).toBe(text.length);
    const subscript = String.raw`x_\alpha+1`;
    expect(anchorCaret(subscript, 4)).toMatchObject({
      offset: subscript.indexOf('+'),
      reason: 'script-argument-seam',
    });
  });

  it('big 系列与 middle 的定界符同样不能被拆开', () => {
    // 回归：`\bigl|(` 之间插入 marker 会报 "Missing or unrecognized delimiter"。
    for (const command of ['\\bigl', '\\Bigr', '\\biggl', '\\Biggm', '\\middle']) {
      const text = `a${command}(b`;
      const inside = 1 + command.length - 1;
      const anchored = anchorCaret(text, inside);
      expect(anchored.exact).toBe(false);
      expect([1, 1 + command.length + 1]).toContain(anchored.offset);
    }
  });

  it('光标不停在命令与它的花括号之间，否则命令会把 marker 当参数', () => {
    // 回归：`\under|brace{...}` 会吸附到命令末尾，marker 顶掉真正的参数，
    // 整条公式报 "Missing argument" 直接渲染不出来。
    const text = String.raw`\tau=\underbrace{a+b}_{=0}+c`;
    const command = text.indexOf('\\underbrace');
    for (const offset of [command + 6, command + 8, command + 11]) {
      expect(anchorCaret(text, offset)).toMatchObject({
        offset: text.indexOf('{a+b}') + 1,
        exact: false,
        reason: 'command-argument-seam',
      });
    }
    // 向前吸附到命令起点本来就是安全位置，不需要再推进。
    expect(anchorCaret(text, command + 3).offset).toBe(command);
    const known = String.raw`\mathcal O`;
    // 已知需要参数的命令即使参数没写花括号也要跳过整个 token。
    expect(anchorCaret(known, 5).offset).toBe(known.length);
    // 无参数命令后面是普通字符时保持精确。
    expect(anchorCaret(String.raw`\alpha x`, 6)).toMatchObject({ offset: 6, exact: true });
  });

  it('颜色名、环境名等名字类参数内部不放 marker', () => {
    const text = String.raw`\textcolor{CancelU}{x+y}`;
    const inside = text.indexOf('CancelU') + 3;
    expect(anchorCaret(text, inside)).toMatchObject({
      offset: text.indexOf('{x+y}') + 1,
      exact: false,
      reason: 'command-argument-seam',
    });
    // 内容参数内部仍然精确。
    const content = text.indexOf('x+y') + 1;
    expect(anchorCaret(text, content)).toMatchObject({ offset: content, exact: true });
    const labelled = String.raw`\label{eq:a}`;
    expect(anchorCaret(labelled, 9).exact).toBe(false);
  });

  it('越界、非整数与非有限输入被安全规范化', () => {
    expect(anchorCaret('abc', -2)).toMatchObject({
      offset: 0,
      exact: false,
      reason: 'out-of-range',
    });
    expect(anchorCaret('abc', 9)).toMatchObject({ offset: 3, reason: 'out-of-range' });
    expect(anchorCaret('abc', 1.8)).toMatchObject({ offset: 1, reason: 'out-of-range' });
    expect(anchorCaret('abc', Number.NaN)).toMatchObject({
      offset: 0,
      reason: 'out-of-range',
    });
  });
});
