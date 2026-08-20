import { describe, expect, it } from 'vitest';

import { DefinitionIndex } from '../src/core/definitionIndex.js';
import { parseDefinitions } from '../src/core/definitionParser.js';

describe('DefinitionIndex', () => {
  it('按声明顺序应用 new、renew、provide、def 和重复 new', () => {
    const definitions = parseDefinitions(String.raw`
\newcommand{\value}{base}
\renewcommand{\value}{renewed}
\providecommand{\value}{provided}
\newcommand{\value}{duplicate}
\def\value{forced}
`, 'one.sty');
    const index = new DefinitionIndex();

    const events = index.replaceSource('one.sty', definitions, 10);

    expect(events.map((event) => event.outcome)).toEqual([
      'added',
      'replaced',
      'ignored-provide',
      'ignored-duplicate-new',
      'replaced',
    ]);
    expect(index.getCommand('value')?.replacement).toBe('forced');
    expect(index.getCommand('\\value')?.declaration).toBe('def');
    expect(index.hasCommand('value')).toBe(true);
    expect(events[1]?.previous?.replacement).toBe('base');
  });

  it('使用 source loadOrder 重建，来源更新后不遗留旧定义', () => {
    const index = new DefinitionIndex();
    index.replaceSource(
      'user.sty',
      parseDefinitions(String.raw`\renewcommand{\tone}{user}`, 'user.sty'),
      20,
    );
    index.replaceSource(
      'base.cls',
      parseDefinitions(String.raw`
\newcommand{\tone}{base}
\newcommand{\removed}{old}
`, 'base.cls'),
      10,
    );

    expect(index.getSourceIds()).toEqual(['base.cls', 'user.sty']);
    expect(index.getCommand('tone')?.replacement).toBe('user');
    expect(index.getCommand('removed')?.replacement).toBe('old');

    const generation = index.generation;
    index.replaceSource(
      'base.cls',
      parseDefinitions(String.raw`\newcommand{\tone}{base-v2}`, 'base.cls'),
    );

    expect(index.generation).toBe(generation + 1);
    expect(index.getCommand('tone')?.replacement).toBe('user');
    expect(index.getCommand('removed')).toBeUndefined();
    expect(index.listCommands()).toHaveLength(1);
  });

  it('provide 在已有定义时忽略，在上游来源移除后生效', () => {
    const index = new DefinitionIndex();
    index.replaceSource(
      'base.sty',
      parseDefinitions(String.raw`\newcommand{\name}{base}`, 'base.sty'),
      0,
    );
    index.replaceSource(
      'fallback.sty',
      parseDefinitions(String.raw`\providecommand{\name}{fallback}`, 'fallback.sty'),
      1,
    );

    expect(index.getCommand('name')?.replacement).toBe('base');
    expect(index.getEvents().at(-1)?.outcome).toBe('ignored-provide');
    expect(index.removeSource('base.sty')).toBe(true);
    expect(index.getCommand('name')?.replacement).toBe('fallback');
    expect(index.removeSource('missing.sty')).toBe(false);
  });

  it('保留 command/environment 独立命名空间并记录缺少基定义的 renew', () => {
    const definitions = parseDefinitions(String.raw`
\renewcommand{\shared}{command}
\newenvironment{shared}{\begin{aligned}}{\end{aligned}}
`, 'shared.sty');
    const index = new DefinitionIndex();
    index.replaceSource('shared.sty', definitions);

    expect(index.getEvents()[0]?.outcome).toBe('added-unresolved-renew');
    expect(index.getCommand('shared')?.replacement).toBe('command');
    expect(index.getEnvironment('shared')?.beginReplacement).toBe(String.raw`\begin{aligned}`);
    expect(index.hasEnvironment('shared')).toBe(true);
    expect(index.listCommands()[0]?.appliedOrder).toBe(0);
    expect(index.listEnvironments()[0]?.appliedOrder).toBe(1);
  });

  it('clear 清空有效定义且空索引重复 clear 不增加 generation', () => {
    const index = new DefinitionIndex();
    index.replaceSource(
      'commands.sty',
      parseDefinitions(String.raw`\DeclareDocumentCommand{\x}{m}{#1}`, 'commands.sty'),
      3,
    );
    const beforeClear = index.generation;

    index.clear();
    expect(index.generation).toBe(beforeClear + 1);
    expect(index.hasCommand('x')).toBe(false);
    expect(index.getSourceIds()).toEqual([]);
    expect(index.getEvents()).toEqual([]);

    const afterClear = index.generation;
    index.clear();
    expect(index.generation).toBe(afterClear);
  });

  it('批量来源只重建一代且保持 loadOrder', () => {
    const index = new DefinitionIndex();
    index.replaceSources([
      {
        sourceId: 'base.sty',
        definitions: parseDefinitions(String.raw`\newcommand{\batch}{base}`, 'base.sty'),
        loadOrder: 0,
      },
      {
        sourceId: 'override.sty',
        definitions: parseDefinitions(String.raw`\renewcommand{\batch}{override}`, 'override.sty'),
        loadOrder: 1,
      },
    ]);

    expect(index.generation).toBe(1);
    expect(index.getCommand('batch')?.replacement).toBe('override');
    expect(index.getSourceIds()).toEqual(['base.sty', 'override.sty']);
  });
});
