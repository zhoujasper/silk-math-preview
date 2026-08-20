import { describe, expect, it } from 'vitest';

import {
  maskMarkdownCode,
  parseMarkdownDefinitionSource,
  parseMarkdownDefinitions,
  parseNotebookDefinitionSources,
} from '../src/core/markdownDefinitions.js';

describe('Markdown 数学定义', () => {
  it('读取 math.macros、根 macros 和参数数组', () => {
    const text = String.raw`---
math:
  macros:
    RR: '\mathbb{R}'
    norm: ['\lVert #1 \rVert', 1]
macros:
  ZZ: "\\mathbb{Z}"
---

$x \in \RR$
`;
    const result = parseMarkdownDefinitionSource(text, 'notes.md');

    expect(result.definitions.map((definition) => definition.name)).toEqual([
      '\\RR',
      '\\norm',
      '\\ZZ',
    ]);
    expect(result.definitions[0]?.replacement).toBe(String.raw`\mathbb{R}`);
    expect(result.definitions[1]?.arguments).toEqual([
      { index: 1, kind: 'mandatory' },
    ]);
    expect(result.definitions[2]?.replacement).toBe(String.raw`\mathbb{Z}`);
    expect(result.frontMatterRange?.end).toBe(text.indexOf('\n\n') + 1);
  });

  it('支持 flow 映射、math.macros 点路径和默认参数', () => {
    const flow = String.raw`---
math.macros: { C: '\mathbb{C}', pair: ['(#1,#2)', 2], opt: ['#1', 1, 'x'] }
---
`;
    const definitions = parseMarkdownDefinitions(flow);

    expect(definitions.map((definition) => definition.name)).toEqual([
      '\\C',
      '\\pair',
      '\\opt',
    ]);
    expect(definitions[1]?.arguments).toHaveLength(2);
    expect(definitions[2]?.arguments[0]).toEqual({
      index: 1,
      kind: 'optional',
      defaultValue: 'x',
    });
  });

  it('合并正文 TeX 声明和可达依赖，并忽略代码区', () => {
    const text = String.raw`---
macros:
  local: '\ell'
---
\usepackage{physics}
\newcommand{\body}[1]{\mathbf{#1}}

\`\newcommand{\inline}{bad}\`
\`\`\`tex
\newcommand{\fenced}{bad}
\usepackage{ignored}
\`\`\`
`;
    const result = parseMarkdownDefinitionSource(text, 'readme.md');

    expect(result.definitions.map((definition) => definition.name)).toEqual([
      '\\local',
      '\\body',
    ]);
    expect(result.dependencies.map((dependency) => dependency.name)).toEqual(['physics']);
  });

  it('动态 replacement 仅标记为 recognized-limited', () => {
    const text = String.raw`---
macros:
  remote: '\input{other.tex}'
---
`;
    const [definition] = parseMarkdownDefinitions(text);

    expect(definition).toMatchObject({
      name: '\\remote',
      expandability: 'recognized-limited',
      limitations: ['external-input-in-expansion'],
    });
  });

  it('endOffset 和未闭合 frontmatter 都 fail-closed', () => {
    const text = String.raw`---
macros:
  before: '\alpha'
---
\newcommand{\after}{\beta}
`;
    const boundary = text.indexOf(String.raw`\newcommand`);
    expect(parseMarkdownDefinitions(text, 'notes.md', boundary)
      .map((definition) => definition.name)).toEqual(['\\before']);
    expect(parseMarkdownDefinitions('---\nmacros:\n  x: y'))
      .toEqual([]);
  });

  it('遮蔽代码时保留 UTF-16 offset 和换行', () => {
    const text = '`😀 $code$`\n$math$';
    const masked = maskMarkdownCode(text);

    expect(masked).toHaveLength(text.length);
    expect(masked.indexOf('\n')).toBe(text.indexOf('\n'));
    expect(masked.slice(text.indexOf('\n') + 1)).toBe('$math$');
  });

  it('兼容 BOM/CRLF、YAML 注释，并跳过超出简单映射边界的值', () => {
    const text = [
      '\ufeff---',
      '# metadata comment',
      'macros:',
      '  ok: alpha # trailing comment',
      '  bad-name: beta',
      '  block: |',
      '  empty: [\'\']',
      '  fallback: "\\q"',
      '...',
      '',
    ].join('\r\n');
    const definitions = parseMarkdownDefinitions(text);

    expect(definitions.map((definition) => definition.name)).toEqual([
      '\\ok',
      '\\fallback',
    ]);
    expect(definitions[0]?.replacement).toBe('alpha');
    expect(definitions[1]?.replacement).toBe('\\q');
    expect(parseMarkdownDefinitions('ordinary Markdown')).toEqual([]);
    expect(parseMarkdownDefinitions('---\nmacros: { invalid-entry }\n---')).toEqual([]);
  });

  it('markdown 公式里的 \\def 也会进入定义索引', () => {
    const definitions = parseMarkdownDefinitions(
      String.raw`$\def\A{\mathbf{A}} \def\C{\mathbb{C}} \def\I{\mathbf{I}}$`,
    );
    expect(definitions.map((definition) => definition.name)).toEqual([
      '\\A',
      '\\C',
      '\\I',
    ]);
    expect(definitions[0]?.replacement).toBe(String.raw`\mathbf{A}`);
  });

  it('Jupyter 后面的 markdown 单元格能用到前面单元格里的 \\def', () => {
    const result = parseNotebookDefinitionSources([
      {
        id: 'cell-0',
        index: 0,
        kind: 'markup',
        text: String.raw`$\def\A{\mathbf{A}} \def\I{\mathbf{I}}$`,
      },
      {
        id: 'cell-1',
        index: 1,
        kind: 'code',
        text: String.raw`\def\ignored{\mathbf{X}}`,
      },
      {
        id: 'cell-2',
        index: 2,
        kind: 'markup',
        text: String.raw`$z$ is an eigenvalue of $\A + \Delta \A$`,
      },
    ], 2);
    expect(result.definitions.map((definition) => definition.name)).toEqual([
      '\\A',
      '\\I',
    ]);
  });

  it('当前单元格只收集光标之前的定义', () => {
    const current = String.raw`$\def\A{\mathbf{A}}$ later $\def\Z{\mathbf{Z}}$`;
    const cut = current.indexOf('later');
    const result = parseNotebookDefinitionSources([
      {
        id: 'cell-0',
        index: 0,
        kind: 'markup',
        text: String.raw`$\def\I{\mathbf{I}}$`,
      },
      {
        id: 'cell-1',
        index: 1,
        kind: 'markup',
        text: current,
      },
    ], 1, cut);
    expect(result.definitions.map((definition) => definition.name)).toEqual([
      '\\I',
      '\\A',
    ]);
  });
});
