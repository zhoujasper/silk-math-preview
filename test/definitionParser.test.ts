import { describe, expect, it } from 'vitest';

import { parseDependencies } from '../src/core/dependencyParser.js';
import {
  environmentEntersMathMode,
  maskTeXComments,
  normalizeColorSpecification,
  parseDefinitions,
  readTeXGroup,
  skipTeXWhitespace,
} from '../src/core/definitionParser.js';

describe('自定义环境是否进入数学模式', () => {
  it('只有 begin 部分停在数学模式的环境才算公式环境', () => {
    expect(environmentEntersMathMode(String.raw`\begin{aligned}`)).toBe(true);
    expect(environmentEntersMathMode(String.raw`\[`)).toBe(true);
    expect(environmentEntersMathMode('$')).toBe(true);
    expect(environmentEntersMathMode('$$')).toBe(true);
    expect(environmentEntersMathMode(String.raw`\(`)).toBe(true);
    // 回归：elegantnote 的 question/solution 是文本环境，一旦被当成公式，
    // 整段解答会变成一条“公式”，里面真正的 \[...\] 全部没有预览。
    expect(environmentEntersMathMode(String.raw`\begin{proof}[#1]`)).toBe(false);
    expect(environmentEntersMathMode(String.raw`\par\noindent\textbf{#1}`)).toBe(false);
    // begin 里成对出现的数学不改变结束时的模式。
    expect(environmentEntersMathMode(String.raw`\textbf{第 $n$ 题}`)).toBe(false);
    expect(environmentEntersMathMode(String.raw`\begin{aligned}\end{aligned}`)).toBe(false);
    expect(environmentEntersMathMode(String.raw`\text{100\$}`)).toBe(false);
    expect(environmentEntersMathMode(undefined)).toBe(false);
  });
});

describe('颜色模型折算', () => {
  it('把 xcolor 的模型统一折算成 MathJax 可用的 rgb', () => {
    expect(normalizeColorSpecification('HTML', 'C45A5A')).toBe('0.7686,0.3529,0.3529');
    expect(normalizeColorSpecification('RGB', '0, 128, 255')).toBe('0,0.502,1');
    expect(normalizeColorSpecification('rgb', '0.1,0.2,0.3')).toBe('0.1,0.2,0.3');
    expect(normalizeColorSpecification('gray', '0.25')).toBe('0.25,0.25,0.25');
    expect(normalizeColorSpecification('cmyk', '0,0.5,0.5,0.2')).toBe('0.8,0.4,0.4');
    // 无法安全折算的一律不进 prelude。
    expect(normalizeColorSpecification('wave', '500nm')).toBeUndefined();
    expect(normalizeColorSpecification('HTML', 'ZZZ')).toBeUndefined();
    expect(normalizeColorSpecification('rgb', '0.1,0.2')).toBeUndefined();
  });
});

describe('definitionParser', () => {
  it('解析多行 new/renew/providecommand，并保留嵌套分组和来源', () => {
    const source = String.raw`
% \newcommand{\ignored}{x}
\newcommand{\foo}[2][a{b}]{
  \frac{#1}{#2}
}
\renewcommand \bar [1] {{#1}_{n}}
\providecommand*{\percent}{100\%}
`;
    const definitions = parseDefinitions(source, 'local.sty');

    expect(definitions).toHaveLength(3);
    expect(definitions[0]).toMatchObject({
      name: '\\foo',
      declaration: 'newcommand',
      operation: 'new',
      expandability: 'expandable',
      source: { id: 'local.sty', line: 2, column: 0 },
    });
    expect(definitions[0]?.arguments).toEqual([
      { index: 1, kind: 'optional', defaultValue: 'a{b}' },
      { index: 2, kind: 'mandatory' },
    ]);
    expect(definitions[0]?.replacement).toContain('\\frac{#1}{#2}');
    expect(definitions[1]?.replacement).toBe('{#1}_{n}');
    expect(definitions[2]).toMatchObject({ name: '\\percent', starred: true, replacement: '100\\%' });
    expect(definitions[0]?.source.endOffset).toBeGreaterThan(definitions[0]?.source.startOffset ?? 0);
  });

  it('解析简单 def 和数学算子，并把分隔参数 def 标为受限', () => {
    const source = String.raw`
\def\pair#1#2{{#1},{#2}}
\def\csv#1,#2\stop{#1+#2}
\DeclareMathOperator*{\argmax}{arg\,max}
`;
    const definitions = parseDefinitions(source, 'operators.sty');

    expect(definitions[0]).toMatchObject({
      name: '\\pair',
      declaration: 'def',
      operation: 'replace',
      expandability: 'expandable',
    });
    expect(definitions[0]?.arguments).toHaveLength(2);
    expect(definitions[1]?.expandability).toBe('recognized-limited');
    expect(definitions[1]?.limitations).toContain('delimited-or-nonsequential-def-parameters');
    expect(definitions[2]).toMatchObject({
      name: '\\argmax',
      declaration: 'declare-math-operator',
      starred: true,
      replacement: String.raw`\operatorname*{arg\,max}`,
    });
  });

  it('解析 LaTeX 环境和基础 xparse m/o/O 参数', () => {
    const source = String.raw`
\newenvironment{boxedalign}[2][c]
  {\begin{aligned}[#1] #2}
  {\end{aligned}}
\renewenvironment{angles}{\left\langle}{\right\rangle}
\NewDocumentCommand{\vect}{m O{2} o}{\mathbf{#1}_{#2}}
\NewDocumentEnvironment{proofbox}{m O{{blue}}}
  {\begin{array}{#2}#1}
  {\end{array}}
`;
    const definitions = parseDefinitions(source, 'custom.cls');

    expect(definitions).toHaveLength(4);
    expect(definitions[0]).toMatchObject({
      kind: 'environment',
      name: 'boxedalign',
      declaration: 'newenvironment',
      beginReplacement: String.raw`\begin{aligned}[#1] #2`,
      endReplacement: String.raw`\end{aligned}`,
    });
    expect(definitions[0]?.arguments).toEqual([
      { index: 1, kind: 'optional', defaultValue: 'c' },
      { index: 2, kind: 'mandatory' },
    ]);
    expect(definitions[2]?.arguments).toEqual([
      { index: 1, kind: 'mandatory' },
      { index: 2, kind: 'optional', defaultValue: '2' },
      { index: 3, kind: 'optional' },
    ]);
    expect(definitions[3]?.arguments[1]).toEqual({
      index: 2,
      kind: 'optional',
      defaultValue: '{blue}',
    });
  });

  it('识别不支持的 xparse 参数、动态控制流和不完整声明，但不假执行', () => {
    const source = String.raw`
\RenewDocumentCommand{\starred}{s m}{\ifx#1\empty #2\fi}
\newcommand{\external}{\input{generated}}
\newcommand{\badref}[1]{#2}
\newcommand{\broken}[1]{still open
`;
    const definitions = parseDefinitions(source, 'limited.sty');

    expect(definitions).toHaveLength(4);
    expect(definitions[0]?.limitations).toEqual(expect.arrayContaining([
      'unsupported-xparse-argument:s',
      'dynamic-tex-control-flow',
      'invalid-parameter-reference',
    ]));
    expect(definitions[1]?.limitations).toContain('external-input-in-expansion');
    expect(definitions[2]?.limitations).toContain('invalid-parameter-reference');
    expect(definitions[3]).toMatchObject({
      name: '\\broken',
      expandability: 'recognized-limited',
    });
    expect(definitions[3]?.limitations).toContain('missing-or-unbalanced-replacement');
  });

  it('正确遮蔽注释、保留转义百分号及 UTF-16 offset', () => {
    const source = '😀 % ignored\n\\newcommand{\\rate}{50\\%}';
    const masked = maskTeXComments(source);
    const definitions = parseDefinitions(source, 'unicode.sty');

    expect(masked).toHaveLength(source.length);
    expect(masked).toContain('50\\%');
    expect(definitions).toHaveLength(1);
    expect(definitions[0]?.source.startOffset).toBe(source.indexOf('\\newcommand'));
  });

  it('公开的分组读取工具处理嵌套、转义和空白', () => {
    const text = String.raw`  {a{b}\}c} tail`;
    const start = skipTeXWhitespace(text, 0);
    expect(readTeXGroup(text, start)).toEqual({
      content: String.raw`a{b}\}c`,
      start: 2,
      end: 11,
    });
    expect(readTeXGroup('[a{]}b]', 0, '[', ']')?.content).toBe('a{]}b');
    expect(readTeXGroup('[a[b]c]', 0, '[', ']')?.content).toBe('a[b]c');
    expect(readTeXGroup('plain', 0)).toBeUndefined();
    expect(readTeXGroup('{open', 0)).toBeUndefined();
  });

  it('对各类缺失、非法或不平衡声明做有界恢复', () => {
    const cases = [
      String.raw`\newcommand noName`,
      String.raw`\def notACommand`,
      "\\def\\noBody abc\n",
      String.raw`\def\unbalanced{abc`,
      String.raw`\DeclareMathOperator nope`,
      String.raw`\DeclareMathOperator{\missing}`,
      String.raw`\newenvironment noName`,
      String.raw`\newenvironment{bad name}{x}{y}`,
      String.raw`\newenvironment{noBodies}`,
      String.raw`\newenvironment{noEnd}{begin}`,
      String.raw`\NewDocumentCommand noName`,
      String.raw`\NewDocumentEnvironment noName`,
      String.raw`\NewDocumentEnvironment{bad name}{m}{x}{y}`,
    ];

    expect(cases.map((source) => parseDefinitions(source))).toEqual([
      [],
      [],
      [expect.objectContaining({ name: '\\noBody', expandability: 'recognized-limited' })],
      [expect.objectContaining({ name: '\\unbalanced', expandability: 'recognized-limited' })],
      [],
      [expect.objectContaining({ name: '\\missing', expandability: 'recognized-limited' })],
      [],
      [],
      [expect.objectContaining({ name: 'noBodies', expandability: 'recognized-limited' })],
      [expect.objectContaining({ name: 'noEnd', expandability: 'recognized-limited' })],
      [],
      [],
      [],
    ]);
    expect(parseDefinitions('unknown \\alpha \\')).toEqual([]);
  });

  it('覆盖非法参数计数、缺失 xparse spec/body 和处理器参数', () => {
    const source = String.raw`
\newcommand{\badcount}[x][default]{x}
\newenvironment{badcount}[x][default]{x}{y}
\NewDocumentCommand{\nospec}
\NewDocumentCommand{\nobody}{m}
\NewDocumentCommand{\badO}{O}{x}
\NewDocumentCommand{\processed}{>{trim}m <{tail}}{#1}
\NewDocumentEnvironment{envNoSpec}
\NewDocumentEnvironment{envNoEnd}{m}{#1}
`;
    const definitions = parseDefinitions(source, 'malformed.sty');

    expect(definitions).toHaveLength(8);
    expect(definitions[0]?.limitations).toEqual(expect.arrayContaining([
      'invalid-argument-count',
      'default-without-argument',
    ]));
    expect(definitions[1]?.limitations).toEqual(expect.arrayContaining([
      'invalid-argument-count',
      'default-without-argument',
    ]));
    expect(definitions[2]?.limitations).toEqual(expect.arrayContaining([
      'missing-xparse-spec',
      'missing-or-unbalanced-replacement',
    ]));
    expect(definitions[3]?.limitations).toContain('missing-or-unbalanced-replacement');
    expect(definitions[4]?.limitations).toContain('malformed-xparse-O-argument');
    expect(definitions[5]?.limitations).toEqual(expect.arrayContaining([
      'unsupported-xparse-argument:>',
      'unsupported-xparse-argument:<',
    ]));
    expect(definitions[6]?.limitations).toEqual(expect.arrayContaining([
      'missing-xparse-spec',
      'missing-or-unbalanced-environment-body',
    ]));
    expect(definitions[7]?.limitations).toContain('missing-or-unbalanced-environment-body');
  });

  it('识别全部基础 xparse 声明操作及单字符命令名', () => {
    const source = String.raw`
\ProvideDocumentCommand{\provided}{m}{#1}
\DeclareDocumentCommand{\declared}{o}{x}
\RenewDocumentEnvironment{renewed}{m}{#1}{x}
\ProvideDocumentEnvironment{provided}{o}{x}{y}
\DeclareDocumentEnvironment{declared}{O{z}}{#1}{y}
\newcommand{\!}{bang}
`;
    const definitions = parseDefinitions(source);

    expect(definitions.map((definition) => definition.operation)).toEqual([
      'provide',
      'replace',
      'renew',
      'provide',
      'replace',
      'new',
    ]);
    expect(definitions.at(-1)?.name).toBe('\\!');
  });
});

describe('dependencyParser', () => {
  it('解析 class、包列表、RequirePackage、input/include 和选项', () => {
    const source = String.raw`
% \usepackage{ignored}
\documentclass[11pt, a4paper]{myclass}
\usepackage[
  colorlinks,
  mode={draft,fast}
]{amsmath, local/math}
\RequirePackage{mathtools}
\input{sections/intro}
\include{chapters/results}
\input chapters/bare
`;
    const dependencies = parseDependencies(source, 'main.tex');

    expect(dependencies.map((dependency) => [dependency.kind, dependency.name])).toEqual([
      ['documentclass', 'myclass'],
      ['package', 'amsmath'],
      ['package', 'local/math'],
      ['package', 'mathtools'],
      ['input', 'sections/intro'],
      ['include', 'chapters/results'],
      ['input', 'chapters/bare'],
    ]);
    expect(dependencies[0]?.options).toEqual(['11pt', 'a4paper']);
    expect(dependencies[1]?.options).toEqual(['colorlinks', 'mode={draft,fast}']);
    expect(dependencies[3]?.command).toBe('RequirePackage');
    expect(dependencies[4]?.source).toMatchObject({ id: 'main.tex' });
  });

  it('将宏生成的依赖名标为 dynamic，并忽略缺失参数的声明', () => {
    const source = String.raw`
\input{\generatedFile}
\usepackage{plain, \packageName}
\include
\documentclass
`;
    const dependencies = parseDependencies(source, 'dynamic.tex');

    expect(dependencies).toHaveLength(3);
    expect(dependencies[0]).toMatchObject({
      name: '\\generatedFile',
      resolution: 'dynamic',
      limitations: ['dynamic-dependency-name'],
    });
    expect(dependencies[1]?.resolution).toBe('literal');
    expect(dependencies[2]?.resolution).toBe('dynamic');
  });

  it('跳过未知控制序列、空包项及缺少参数的 EOF 声明', () => {
    const source = String.raw`\unknown{x}
\\
\usepackage{ first, , second }
\include
\input`;
    const dependencies = parseDependencies(source);

    expect(dependencies.map((dependency) => dependency.name)).toEqual(['first', 'second']);
    expect(parseDependencies('text \\')).toEqual([]);
  });

  it('在嵌套方括号、花括号和转义逗号中只按顶层切分选项', () => {
    const dependencies = parseDependencies(
      String.raw`\usepackage[key=[a,b], map={x,y}, escaped=a\,b]{pkg}`,
    );

    expect(dependencies[0]?.options).toEqual([
      'key=[a,b]',
      'map={x,y}',
      String.raw`escaped=a\,b`,
    ]);
  });
});
