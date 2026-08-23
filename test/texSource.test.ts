import { describe, expect, it } from 'vitest';

import { maskTeXComments, parseDefinitions } from '../src/core/definitionParser.js';
import {
  definitionRefreshUrgency,
  isDefinitionSourcePath,
  parseTeXSource,
  texChangesAffectDefinitions,
  texDocumentEditsAffectDefinitions,
  texEditAffectsDefinitions,
} from '../src/core/texSource.js';

describe('texSource', () => {
  it('没有注释的大文件不复制原字符串', () => {
    const text = '\\newcommand{\\foo}{x}\n'.repeat(2000);
    expect(maskTeXComments(text)).toBe(text);
  });

  it('遮蔽注释时保持 UTF-16 长度，emoji 和 \\% 不受影响', () => {
    const text = String.raw`\% keep
% hidden comment
\newcommand{\face}{😀}`;
    const masked = maskTeXComments(text);
    expect(masked.length).toBe(text.length);
    expect(masked).toContain('\\% keep');
    expect(masked).toContain('😀');
    expect(masked).not.toContain('hidden');
    const parsed = parseDefinitions(text, 'emoji.sty');
    expect(parsed[0]?.name).toBe('\\face');
    expect(parsed[0]?.replacement).toBe('😀');
  });

  it('定义体内的 usepackage 不会当成真实依赖', () => {
    const source = [
      '\\newcommand{\\before}{B}',
      '\\usepackage{local}',
      '\\newcommand{\\unsafe}{\\usepackage{ignored}}',
    ].join('\n');
    const parsed = parseTeXSource(source, 'main.tex');
    expect(parsed.definitions.map((item) => item.name)).toEqual(['\\before', '\\unsafe']);
    expect(parsed.dependencies.map((item) => item.name)).toEqual(['local']);
  });

  it('一次 mask 就能扫出声明和依赖', () => {
    const source = [
      '% \\usepackage{ignored}',
      '\\documentclass{notes}',
      '\\usepackage{local}',
      '\\newcommand{\\R}{\\mathbb{R}}',
    ].join('\n');
    const parsed = parseTeXSource(source, 'main.tex');
    expect(parsed.dependencies.map((item) => item.kind)).toEqual(['documentclass', 'package']);
    expect(parsed.definitions.map((item) => item.name)).toEqual(['\\R']);
  });

  it('数千条宏的 sty 解析保持有界且一条不丢', () => {
    const lines = Array.from({ length: 4000 }, (_, index) => {
      const name = texLetters(index);
      return `\\newcommand{\\${name}}{x}`;
    });
    const text = `${lines.join('\n')}\n`;
    const started = performance.now();
    const parsed = parseTeXSource(text, 'huge.sty');
    const elapsed = performance.now() - started;
    expect(parsed.definitions).toHaveLength(4000);
    expect(parsed.definitions[0]?.name).toBe(`\\${texLetters(0)}`);
    expect(parsed.definitions[3999]?.name).toBe(`\\${texLetters(3999)}`);
    expect(elapsed).toBeLessThan(150);
  });

  it('带注释的大 sty 仍然一条宏不丢，且不改 offset', () => {
    const lines = Array.from({ length: 2000 }, (_, index) => {
      const name = texLetters(index);
      return `% note ${index}\n\\newcommand{\\${name}}{x}`;
    });
    const text = `${lines.join('\n')}\n`;
    const parsed = parseTeXSource(text, 'commented.sty');
    expect(parsed.definitions).toHaveLength(2000);
    expect(maskTeXComments(text).length).toBe(text.length);
    expect(parsed.definitions[1999]?.name).toBe(`\\${texLetters(1999)}`);
  });

  it('插入 newcommand / usepackage 算定义变化，公式正文不算', () => {
    expect(texEditAffectsDefinitions('\\newcommand{\\foo}{x}')).toBe(true);
    expect(texEditAffectsDefinitions('\\usepackage{local}')).toBe(true);
    expect(texEditAffectsDefinitions('\\def\\A{\\mathbf{A}}')).toBe(true);
    expect(texEditAffectsDefinitions('x+y', 'a + b')).toBe(false);
    expect(texEditAffectsDefinitions('', '\\newcommand{\\foo}{x}')).toBe(true);
    expect(texEditAffectsDefinitions('ault', '\\default')).toBe(false);
    expect(texChangesAffectDefinitions([
      { inserted: 'x', nearby: 'a+b', deleted: 0 },
    ])).toBe(false);
    expect(texChangesAffectDefinitions([
      { inserted: '', nearby: '', deleted: 11 },
    ])).toBe(true);
    expect(texDocumentEditsAffectDefinitions('x+y', [{ start: 0, inserted: 'x', deleted: 0 }])).toBe(false);
    expect(texDocumentEditsAffectDefinitions('\\newcommand{\\foo}{x}', [
      { start: 0, inserted: '\\newcommand{\\foo}{x}', deleted: 0 },
    ])).toBe(true);
    const typing = '\\newcomman';
    expect(texDocumentEditsAffectDefinitions(`${typing}d`, [
      { start: typing.length, inserted: 'd', deleted: 0 },
    ])).toBe(true);
  });

  it('公式里把 b 改成 c 不会因为上方已写完的 newcommand 而全量失效', () => {
    const source = '\\newcommand{\\foo}{x}\n$ a+b $';
    const start = source.indexOf('b');
    const after = `${source.slice(0, start)}c${source.slice(start)}`;
    expect(texDocumentEditsAffectDefinitions(after, [
      { start, inserted: 'c', deleted: 0 },
    ])).toBe(false);
  });

  it('刷新紧急度：没有 peek 或宏包变了要立刻重算', () => {
    expect(definitionRefreshUrgency({
      hasPeek: false,
      generationChanged: false,
      offsetBoundaryChanged: false,
      definitionAffectingEdit: false,
      documentVersionChanged: false,
      notebookVersionChanged: false,
    })).toBe('now');
    expect(definitionRefreshUrgency({
      hasPeek: true,
      generationChanged: true,
      offsetBoundaryChanged: false,
      definitionAffectingEdit: false,
      documentVersionChanged: false,
      notebookVersionChanged: false,
    })).toBe('now');
    expect(definitionRefreshUrgency({
      hasPeek: true,
      generationChanged: false,
      offsetBoundaryChanged: false,
      definitionAffectingEdit: true,
      documentVersionChanged: true,
      notebookVersionChanged: false,
    })).toBe('now');
    expect(definitionRefreshUrgency({
      hasPeek: true,
      generationChanged: false,
      offsetBoundaryChanged: false,
      definitionAffectingEdit: false,
      documentVersionChanged: true,
      notebookVersionChanged: false,
    })).toBe('soon');
    expect(definitionRefreshUrgency({
      hasPeek: true,
      generationChanged: false,
      offsetBoundaryChanged: false,
      definitionAffectingEdit: false,
      documentVersionChanged: false,
      notebookVersionChanged: false,
    })).toBe('idle');
  });

  it('按扩展名识别定义来源，Windows 反斜杠也能认', () => {
    expect(isDefinitionSourcePath('main.tex')).toBe(true);
    expect(isDefinitionSourcePath('C:\\ws\\local.sty')).toBe(true);
    expect(isDefinitionSourcePath('/ws/notes.cls')).toBe(true);
    expect(isDefinitionSourcePath('readme.txt')).toBe(false);
  });
});

/** TeX 控制序列只能是字母，测试用的大批量宏名不能带数字。 */
function texLetters(index: number): string {
  let value = index;
  let name = '';
  do {
    name = String.fromCharCode(97 + (value % 26)) + name;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return `mac${name}`;
}
