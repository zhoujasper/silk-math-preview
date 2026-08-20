import { describe, expect, it } from 'vitest';

import {
  createCompletionCatalog,
  getHighConfidenceCommandCorrection,
} from '../src/core/completionCatalog';
import { diagnoseMath } from '../src/core/diagnostics';

describe('diagnoseMath', () => {
  it('合法公式不产生诊断', () => {
    const text =
      '\\frac{a_1}{b^2}+\\left(x\\right)+\\begin{aligned}u&=v\\end{aligned}';
    expect(diagnoseMath(text)).toEqual([]);
  });

  it('诊断多余和未闭合花括号并提供显式修复', () => {
    const diagnostics = diagnoseMath('} x {', { offset: 10 });
    expect(diagnostics.map((item) => item.code)).toEqual([
      'unexpected-closing-brace',
      'unclosed-group',
    ]);
    expect(diagnostics[0]?.range).toEqual({ start: 10, end: 11 });
    expect(diagnostics[0]?.fixes[0]?.edits[0]).toEqual({
      range: { start: 10, end: 11 },
      newText: '',
    });
    expect(diagnostics[1]?.fixes[0]?.edits[0]).toEqual({
      range: { start: 15, end: 15 },
      newText: '}',
    });
  });

  it('为缺失的 left/right 生成可编译的配对修复', () => {
    const missingRight = diagnoseMath('\\left( x');
    expect(missingRight).toHaveLength(1);
    expect(missingRight[0]).toMatchObject({ code: 'unmatched-left' });
    expect(missingRight[0]?.fixes[0]?.edits[0]?.newText).toBe('\\right)');

    const missingLeft = diagnoseMath('x \\right]');
    expect(missingLeft).toHaveLength(1);
    expect(missingLeft[0]).toMatchObject({ code: 'unmatched-right' });
    expect(missingLeft[0]?.fixes[0]?.edits[0]?.newText).toBe('\\left.');
  });

  it('支持控制序列 delimiter 和同层嵌套 left/right', () => {
    expect(diagnoseMath('\\left\\langle x')).toMatchObject([
      { code: 'unmatched-left' },
    ]);
    expect(
      diagnoseMath('\\left(\\left[x\\right]\\right)'),
    ).toEqual([]);
    expect(
      diagnoseMath('\\left\\langle x')[0]?.fixes[0]?.edits[0]?.newText,
    ).toBe('\\right\\rangle');
    expect(diagnoseMath('\\left   [x')[0]?.fixes[0]?.edits[0]?.newText)
      .toBe('\\right]');
    expect(diagnoseMath('\\left x')[0]?.fixes[0]?.edits[0]?.newText)
      .toBe('\\right.');
  });

  it('诊断环境名不匹配、孤立 end 和缺失 end', () => {
    const mismatch = diagnoseMath('\\begin{align}x\\end{gather}');
    expect(mismatch).toHaveLength(1);
    expect(mismatch[0]).toMatchObject({ code: 'mismatched-environment' });
    expect(mismatch[0]?.fixes[0]?.edits[0]?.newText).toBe('align');

    const unexpected = diagnoseMath('x\\end{equation}');
    expect(unexpected).toHaveLength(1);
    expect(unexpected[0]).toMatchObject({ code: 'unexpected-end-environment' });
    expect(unexpected[0]?.fixes[0]?.edits[0]?.newText).toContain('\\begin{equation}');

    const unclosed = diagnoseMath('\\begin{align}x');
    expect(unclosed).toHaveLength(1);
    expect(unclosed[0]).toMatchObject({ code: 'unclosed-environment' });
    expect(unclosed[0]?.fixes[0]?.edits[0]?.newText).toContain('\\end{align}');

    expect(diagnoseMath('\\begin x')).toEqual([]);
    expect(diagnoseMath('\\begin{}')).toEqual([]);
    expect(diagnoseMath('\\begin{align\nx')).toMatchObject([
      { code: 'unclosed-group' },
    ]);
  });

  it('诊断悬空上下标但接受合法参数', () => {
    const diagnostics = diagnoseMath('x^ \\right) + y_');
    expect(diagnostics.filter((item) => item.code === 'dangling-script')).toHaveLength(2);
    expect(
      diagnostics
        .filter((item) => item.code === 'dangling-script')
        .map((item) => item.fixes[0]?.edits[0]?.newText),
    ).toEqual(['{}', '{}']);
    expect(diagnoseMath('x^{2}+y_i+z^\\alpha')).toEqual([]);
    expect(diagnoseMath('x^ % comment only')).toMatchObject([
      { code: 'dangling-script' },
    ]);
  });

  it('只修复高置信命令 typo，未知命令保持安静', () => {
    const diagnostics = diagnoseMath('\\frca{a}{b}+\\alhpa+\\unknown');
    expect(diagnostics.map((item) => item.code)).toEqual([
      'command-typo',
      'command-typo',
    ]);
    expect(diagnostics.map(
      (item) => item.fixes[0]?.edits[0]?.newText,
    )).toEqual(['\\frac', '\\alpha']);

    expect(diagnoseMath('\\fooo', { commandTypos: { fooo: 'foo' } })[0])
      .toMatchObject({ code: 'command-typo' });
    expect(diagnoseMath('\\fooo', { commandTypos: { fooo: 'not-valid!' } }))
      .toEqual([]);
  });

  it('忽略 TeX 注释里的括号、脚本和命令', () => {
    expect(diagnoseMath('x % } ^ \\frca\n+y')).toEqual([]);
    expect(diagnoseMath('x\\%y')).toEqual([]);
    expect(diagnoseMath('\\')).toEqual([]);
  });
});

describe('completionCatalog', () => {
  it('合并内置与有效自定义项、去重并过滤危险名称', () => {
    const entries = createCompletionCatalog({
      customCommands: ['\\foo', 'frac', 'bad-name'],
      customEnvironments: ['proofmath', 'align', 'bad env'],
    });
    const foo = entries.find((entry) => entry.label === '\\foo');
    const proofmath = entries.find((entry) => entry.label === 'proofmath');
    expect(foo).toMatchObject({ kind: 'command', detail: '工作区自定义命令' });
    expect(proofmath).toMatchObject({
      kind: 'environment',
      detail: '工作区自定义数学环境',
    });
    expect(entries.filter((entry) => entry.label === '\\frac')).toHaveLength(1);
    expect(entries.filter((entry) => entry.label === 'align')).toHaveLength(1);
    expect(entries.some((entry) => entry.label.includes('bad'))).toBe(false);
    expect(entries.map((entry) => entry.label)).toEqual(
      [...entries.map((entry) => entry.label)].sort((a, b) => a.localeCompare(b)),
    );
    expect(createCompletionCatalog()).not.toHaveLength(0);
  });

  it('只返回合法的高置信修正', () => {
    expect(getHighConfidenceCommandCorrection('\\rigth')).toBe('right');
    expect(getHighConfidenceCommandCorrection('unknown')).toBeUndefined();
    expect(getHighConfidenceCommandCorrection('bad-name')).toBeUndefined();
    expect(getHighConfidenceCommandCorrection('foo', { foo: 'bar' })).toBe('bar');
    expect(getHighConfidenceCommandCorrection('foo', { foo: 'bad-name' })).toBeUndefined();
  });
});
