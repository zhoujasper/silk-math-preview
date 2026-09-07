import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  files: new Map<string, string>(),
  openDocuments: [] as Array<{ uri: { path: string; toString(): string }; languageId: string; version: number; getText(): string }>,
  readCount: 0,
  activeDocument: undefined as vscode.TextDocument | undefined,
  changeListeners: [] as Array<(event: vscode.TextDocumentChangeEvent) => void>,
}));

vi.mock('vscode', () => {
  class MockUri {
    public static file(value: string): MockUri {
      return new MockUri('file', '', normalize(value));
    }
    public static joinPath(base: MockUri, ...parts: string[]): MockUri {
      return new MockUri(base.scheme, base.authority, normalize([base.path, ...parts].join('/')));
    }
    public constructor(
      public readonly scheme: string,
      public readonly authority: string,
      public readonly path: string,
    ) {}
    public with(change: { readonly path?: string }): MockUri {
      return new MockUri(this.scheme, this.authority, change.path ?? this.path);
    }
    public toString(_skipEncoding?: boolean): string {
      return this.scheme + '://' + this.authority + this.path;
    }
  }

  class MockEventEmitter<T> {
    private readonly listeners: Array<(value: T) => void> = [];
    public readonly event = (listener: (value: T) => void): { dispose(): void } => {
      this.listeners.push(listener);
      return { dispose: () => undefined };
    };
    public fire(value: T): void {
      for (const listener of this.listeners) {
        listener(value);
      }
    }
    public dispose(): void {
      this.listeners.length = 0;
    }
  }

  const noEvent = (): { dispose(): void } => ({ dispose: () => undefined });
  const watcher = {
    onDidChange: noEvent,
    onDidCreate: noEvent,
    onDidDelete: noEvent,
    dispose: () => undefined,
  };
  const folder = { uri: MockUri.file('/ws'), name: 'ws', index: 0 };
  function lookupFile(path: string): string | undefined {
    if (state.files.has(path)) return state.files.get(path);
    if (process.platform === 'win32') {
      const found = [...state.files.keys()].find((key) => key.toLowerCase() === path.toLowerCase());
      if (found) return state.files.get(found);
    }
    return undefined;
  }
  return {
    Uri: MockUri,
    EventEmitter: MockEventEmitter,
    FileType: { File: 1 },
    NotebookCellKind: { Markup: 1, Code: 2 },
    window: {
      get activeTextEditor() { return state.activeDocument ? { document: state.activeDocument } : undefined; },
    },
    Range: class {
      constructor(public start: vscode.Position, public end: vscode.Position) {}
    },
    workspace: {
      createFileSystemWatcher: () => watcher,
      onDidSaveTextDocument: noEvent,
      onDidChangeNotebookDocument: noEvent,
      onDidChangeTextDocument: (listener: (event: vscode.TextDocumentChangeEvent) => void) => {
        state.changeListeners.push(listener);
        return { dispose: () => { state.changeListeners = state.changeListeners.filter((item) => item !== listener); } };
      },
      onDidCloseTextDocument: noEvent,
      notebookDocuments: [],
      get textDocuments() {
        return state.openDocuments;
      },
      getWorkspaceFolder: (uri: MockUri) => uri.path.startsWith('/ws/') ? folder : undefined,
      asRelativePath: (uri: MockUri) => uri.path.replace(/^\/ws\//, ''),
      fs: {
        readFile: async (uri: MockUri) => {
          const value = lookupFile(uri.path);
          if (value === undefined) {
            throw new Error('ENOENT');
          }
          state.readCount += 1;
          return new TextEncoder().encode(value);
        },
        stat: async (uri: MockUri) => {
          const value = lookupFile(uri.path);
          if (value === undefined) {
            throw new Error('ENOENT');
          }
          return { type: 1, ctime: 0, mtime: 0, size: value.length };
        },
      },
      findFiles: async (_include: unknown, _exclude: unknown, maxResults: number) =>
        [...state.files.keys()].map((path) => MockUri.file(path)).slice(0, maxResults),
    },
    RelativePattern: class {
      public constructor(
        public readonly base: unknown,
        public readonly pattern: string,
      ) {}
    },
  };

  function normalize(value: string): string {
    const parts: string[] = [];
    for (const part of value.replace(/\\/g, '/').split('/')) {
      if (!part || part === '.') {
        continue;
      }
      if (part === '..') {
        parts.pop();
      } else {
        parts.push(part);
      }
    }
    return '/' + parts.join('/');
  }
});

import * as vscode from 'vscode';

import { DefinitionWorkspace } from '../src/vscode/definitionWorkspace.js';
import { MathJaxSvgRenderer } from '../src/render/mathjaxRenderer.js';

describe('DefinitionWorkspace', () => {
  beforeEach(() => {
    state.files.clear();
    state.openDocuments = [];
    state.readCount = 0;
    state.activeDocument = undefined;
    state.changeListeners = [];
  });

  it('TikZ 保留原生定义的顺序、作用域、定界参数，且不包含图形后面的重定义', async () => {
    const prefix = String.raw`\def\radius{1}\edef\saved{\radius}\def\radius{2}
{\def\radius{9}}\def\pair#1,#2;{(#1,#2)}`;
    const source = prefix + String.raw`\begin{tikzpicture}\draw(0,0)--(\radius,1);\end{tikzpicture}\def\radius{7}`;
    const document = makeDocument('/ws/main.tex', 'latex', source);
    const workspace = new DefinitionWorkspace();
    try {
      const context = await workspace.getTikzContext(document, prefix.length);
      expect(context).toContain(String.raw`\edef\saved{\radius}`);
      expect(context).toContain(String.raw`\def\pair#1,#2;{(#1,#2)}`);
      expect(context.indexOf('\\edef')).toBeLessThan(context.indexOf(String.raw`\def\radius{2}`));
      expect(context).toContain('\\begingroup');
      expect(context).not.toContain(String.raw`\def\radius{7}`);
    } finally { workspace.dispose(); }
  });

  it('TikZ 从未保存 sty 递归读取声明，并保留晚于 128k 的绘图设置', async () => {
    state.files.set('/ws/macros.sty', String.raw`\def\radius{1}`);
    state.files.set('/ws/extra.tex', String.raw`\def\pair#1,#2;{(#1,#2)}`);
    state.openDocuments = [makeDocument('/ws/macros.sty', 'latex', String.raw`\def\radius{3}\input{extra}`)];
    const prefix = String.raw`\usepackage{macros}` + '\n' + 'body '.repeat(28_000) + String.raw`\tikzset{thickline/.style={blue,thick}}`;
    const document = makeDocument('/ws/main.tex', 'latex', prefix + String.raw`\begin{tikzpicture}\end{tikzpicture}`);
    const workspace = new DefinitionWorkspace();
    try {
      const context = await workspace.getTikzContext(document, prefix.length);
      expect(context).toContain(String.raw`\def\radius{3}`);
      expect(context).toContain(String.raw`\def\pair#1,#2;{(#1,#2)}`);
      expect(context).toContain('thickline/.style={blue,thick}');
      expect(context).not.toContain('body');
      expect(context).not.toContain('\\input');
      expect(state.readCount).toBe(1);
    } finally { workspace.dispose(); }
  });

  it('TikZ 图形内编辑复用上下文；图形前编辑立即失效', async () => {
    const prefix = String.raw`\def\radius{2}` + '\n';
    const body = String.raw`\begin{tikzpicture}\draw(0,0)--(2,1);\end{tikzpicture}`;
    const first = makeDocument('/ws/main.tex', 'latex', prefix + body);
    state.activeDocument = first;
    const workspace = new DefinitionWorkspace();
    try {
      const ready = workspace.getTikzContext(first, prefix.length);
      await ready;
      const second = makeDocument('/ws/main.tex', 'latex', prefix + body.replace('(2,1)', '(3,1)'), 2);
      state.activeDocument = second;
      const point = first.positionAt(prefix.length + body.indexOf('2,1'));
      for (const listener of state.changeListeners) listener({ document: second, contentChanges: [{ range: new vscode.Range(point, point), rangeLength: 1, text: '3' }] } as never);
      expect(workspace.getTikzContext(second, prefix.length)).toBe(ready);
      const third = makeDocument('/ws/main.tex', 'latex', prefix.replace('{2}', '{4}') + body, 3);
      state.activeDocument = third;
      const definition = first.positionAt(prefix.indexOf('2'));
      for (const listener of state.changeListeners) listener({ document: third, contentChanges: [{ range: new vscode.Range(definition, definition), rangeLength: 1, text: '4' }] } as never);
      expect(await workspace.getTikzContext(third, prefix.length)).toContain(String.raw`\def\radius{4}`);
    } finally { workspace.dispose(); }
  });

  it('自动识别 cls/sty 的递归宏包、sisetup 与自定义单位，并实际渲染', async () => {
    state.files.set('/ws/local.cls', String.raw`\RequirePackage{local}`);
    state.files.set('/ws/local.sty', String.raw`
\RequirePackage[locale=DE]{siunitx}
\RequirePackage{mathtools}
\sisetup{group-digits=false}
\DeclareSIUnit{\speed}{\kilo\metre\per\second}
\DeclarePairedDelimiter{\norm}{\lVert}{\rVert}
\DeclareRobustCommand{\measurement}[1]{\qty{#1}{\speed}}
\gdef\RR{\ensuremath{\mathbb{R}}}`);
    const document = makeDocument('/ws/main.tex', 'latex', String.raw`\documentclass{local}
\sisetup{output-decimal-marker={,}}
$\measurement{1234.56}+\RR$`);
    const workspace = new DefinitionWorkspace();
    const snapshot = await workspace.getSnapshot(document);
    expect(snapshot.packages).toEqual(['local', 'siunitx', 'mathtools']);
    expect(snapshot.commands).toEqual(['\\speed', '\\norm', '\\measurement', '\\RR']);
    expect(snapshot.prelude).toContain('\\sisetup{locale=DE}');
    expect(snapshot.prelude).toContain('\\sisetup{group-digits=false}');
    expect(snapshot.limitations).toEqual([]);
    const renderer = new MathJaxSvgRenderer();
    const result = renderer.render({ expression: String.raw`\text{\measurement{1234.56} \RR}+\norm*{\frac{x}{y}}`,
      definitionFingerprint: snapshot.fingerprint, definitionPrelude: snapshot.prelude,
      packages: snapshot.packages, displayMode: true, foreground: '#ddd', caretColor: '#f90',
      scale: 1, exPx: 7, markUnknownCommands: false });
    expect(result.svg).toContain('data-c="2C"');
    expect(result.svg).toContain('data-c="211D"');
    expect(result.svg).not.toContain('\\measurement');
    renderer.clear(); workspace.dispose();
  });

  it('大文档末尾输入复用同一语义快照，编辑点只读取 128 字符窗口', async () => {
    const original = String.raw`\def\value{3}` + '\n' + 'text '.repeat(100_000) + '$x$';
    const document = makeDocument('/ws/main.tex', 'latex', original);
    state.activeDocument = document;
    const workspace = new DefinitionWorkspace();
    const snapshot = await workspace.getSnapshot(document);
    const at = original.length - 1;
    const updated = makeDocument('/ws/main.tex', 'latex', original.slice(0, at) + '+1' + original.slice(at), 2);
    const read = vi.spyOn(updated, 'getText');
    state.activeDocument = updated;
    for (const listener of state.changeListeners) listener({ document: updated, reason: undefined, contentChanges: [
      { range: new vscode.Range(document.positionAt(at), document.positionAt(at)), rangeOffset: at, rangeLength: 0, text: '+1' },
    ] } as vscode.TextDocumentChangeEvent);
    expect(await workspace.getSnapshot(updated)).toBe(snapshot);
    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.results[0]?.value.length).toBe(128);
    workspace.dispose();
  });

  it('插入新宏仍刷新，淘汰旧文档缓存后能按需恢复', async () => {
    const document = makeDocument('/ws/main.tex', 'latex', String.raw`\def\value{3} $x$`);
    const read = vi.spyOn(document, 'getText');
    const workspace = new DefinitionWorkspace();
    await workspace.getSnapshot(document);
    const initialReads = read.mock.calls.length;
    for (let i = 0; i < 20; i++) await workspace.getSnapshot(makeDocument(`/ws/file${i}.tex`, 'latex', '$x$'));
    expect((await workspace.getSnapshot(document)).commands).toContain('\\value');
    expect(read.mock.calls.length).toBeGreaterThan(initialReads);
    const addition = String.raw`\def\extra{E}`;
    const updated = makeDocument('/ws/main.tex', 'latex', document.getText() + addition, 2);
    state.activeDocument = updated;
    const end = document.positionAt(document.getText().length);
    for (const listener of state.changeListeners) listener({ document: updated, reason: undefined, contentChanges: [
      { range: new vscode.Range(end, end), rangeOffset: document.getText().length, rangeLength: 0, text: addition },
    ] } as vscode.TextDocumentChangeEvent);
    expect((await workspace.getSnapshot(updated)).commands).toContain('\\extra');
    workspace.dispose();
  });

  it('章节 root 指令继承主文件导言区，不加载其他章节的正文宏', async () => {
    state.files.set('/ws/main.tex', String.raw`\usepackage{units}\newcommand{\global}{G}
\begin{document}\input{chapter}\def\later{bad}\end{document}`);
    state.files.set('/ws/units.sty', String.raw`\RequirePackage{siunitx}\sisetup{round-mode=places,round-precision=2}`);
    const document = makeDocument('/ws/chapters/chapter.tex', 'latex', String.raw`% !TeX root = ../main.tex
\def\local{L} $\qty{1.234}{\metre}+\global+\local$`);
    const workspace = new DefinitionWorkspace();
    const snapshot = await workspace.getSnapshot(document);
    expect(snapshot.commands).toContain('\\global');
    expect(snapshot.commands).toContain('\\local');
    expect(snapshot.commands).not.toContain('\\later');
    expect(snapshot.packages).toContain('siunitx');
    expect(snapshot.prelude).toContain('round-precision=2');
    workspace.dispose();
  });

  it('自动匹配唯一已打开主文件；多个候选时不猜测', async () => {
    const parent = makeDocument('/ws/main.tex', 'latex', String.raw`\def\rootmacro{R}\begin{document}\input{chapter}`);
    const document = makeDocument('/ws/chapter.tex', 'latex', '$x$');
    state.openDocuments.push(parent);
    const workspace = new DefinitionWorkspace();
    expect((await workspace.getSnapshot(document)).commands).toContain('\\rootmacro');
    state.openDocuments.push(makeDocument('/ws/other.tex', 'latex', String.raw`\begin{document}\include{chapter}`));
    workspace.invalidate();
    const ambiguous = await workspace.getSnapshot(document);
    expect(ambiguous.commands).not.toContain('\\rootmacro');
    expect(ambiguous.limitations.join()).toContain('多个已打开主文件');
    workspace.dispose();
  });

  it('编辑主文件 input 的导言文件时，宏只收集到当前光标', async () => {
    state.files.set('/ws/main.tex', String.raw`\def\before{B}\input{preamble}\def\after{A}\begin{document}`);
    const text = String.raw`% !TeX root = main.tex
\def\local{L} $x$ \def\later{Y}`;
    const document = makeDocument('/ws/preamble.tex', 'latex', text);
    state.openDocuments.push(document);
    const workspace = new DefinitionWorkspace();
    const snapshot = await workspace.getSnapshot(document, text.indexOf('$x$'));
    expect(snapshot.commands).toEqual(['\\before', '\\local']);
    workspace.dispose();
  });

  it('依赖先命中同目录准确路径，不被已打开的同名其他 sty 抢走', async () => {
    state.files.set('/ws/chapter/local.sty', String.raw`\newcommand{\right}{R}`);
    state.openDocuments = [makeDocument('/ws/other/local.sty', 'latex', String.raw`\newcommand{\wrong}{W}`)];
    const workspace = new DefinitionWorkspace();
    const snapshot = await workspace.getSnapshot(makeDocument('/ws/chapter/main.tex', 'latex', String.raw`\usepackage{local}`));
    expect(snapshot.commands).toEqual(['\\right']);
    workspace.dispose();
  });

  it('新增宏包参与缓存键；光标之后的宏包不提前生效', async () => {
    const workspace = new DefinitionWorkspace();
    const text = String.raw`\usepackage{siunitx}
$\num{1}$
\usepackage{physics}`;
    const first = await workspace.getSnapshot(makeDocument('/ws/main.tex', 'latex', text), text.indexOf('$'));
    const second = await workspace.getSnapshot(makeDocument('/ws/main.tex', 'latex', text), text.length);
    expect(first.packages).toEqual(['siunitx']);
    expect(second.packages).toEqual(['siunitx', 'physics']);
    expect(first.fingerprint).not.toBe(second.fingerprint);
    workspace.dispose();
  });

  it('按光标前声明和递归依赖顺序生成安全 prelude', async () => {
    state.files.set('/ws/local.sty', '\\newcommand{\\pkg}{P}\\input{nested}');
    state.files.set('/ws/nested.tex', '\\newenvironment{proofmath}{\\begin{aligned}}{\\end{aligned}}');
    const text = [
      '\\newcommand{\\before}{B}',
      '\\usepackage{local}',
      '\\renewcommand{\\before}{R}',
      '\\newcommand{\\unsafe}{\\input{x}}',
      '$\\before+\\pkg$',
      '\\newcommand{\\after}{A}',
    ].join('\n');
    const document = makeDocument('/ws/main.tex', 'latex', text);
    const workspace = new DefinitionWorkspace(undefined, { maxFiles: 16 });

    const snapshot = await workspace.getSnapshot(document, text.indexOf('$\\before'));

    expect(snapshot.commands).toEqual(['\\pkg', '\\before', '\\unsafe']);
    expect(snapshot.environments).toEqual(['proofmath']);
    expect(snapshot.prelude).toContain('\\def\\pkg{P}');
    expect(snapshot.prelude).toContain('\\def\\before{R}');
    expect(snapshot.prelude).not.toContain('unsafe');
    expect(snapshot.commands).not.toContain('\\after');
    expect(snapshot.limitations.join('\n')).toContain('external-input-in-expansion');
    expect(snapshot.fingerprint).toHaveLength(16);
    expect(await workspace.getSnapshot(document, text.indexOf('$\\before') + 2)).toBe(snapshot);
    workspace.dispose();
  });

  it('读取 Markdown frontmatter 并在 invalidate 后延迟重载文件', async () => {
    state.files.set('/ws/shared.tex', '\\newcommand{\\shared}{one}');
    const text = [
      '---',
      'math:',
      '  macros:',
      "    RR: '\\mathbb{R}'",
      '---',
      '\\input{shared}',
      '$\\RR+\\shared$',
    ].join('\n');
    const document = makeDocument('/ws/note.md', 'markdown', text);
    const workspace = new DefinitionWorkspace();

    const first = await workspace.getSnapshot(document);
    expect(first.commands).toEqual(['\\RR', '\\shared']);
    expect(first.prelude).toContain('\\mathbb{R}');

    state.files.set('/ws/shared.tex', '\\newcommand{\\changed}{two}');
    expect((await workspace.getSnapshot(document)).commands).toContain('\\shared');
    workspace.invalidate(vscode.Uri.file('/ws/shared.tex'));
    const refreshed = await workspace.getSnapshot(document);
    expect(refreshed.commands).toContain('\\changed');
    expect(refreshed.commands).not.toContain('\\shared');
    workspace.dispose();
  });

  it('将 MDX language id 按 Markdown 定义语法处理', async () => {
    const text = [
      '---',
      'macros:',
      "  CC: '\\mathbb{C}'",
      '---',
      '$\\CC$',
    ].join('\n');
    const document = makeDocument('/ws/note.mdx', 'mdx', text);
    const workspace = new DefinitionWorkspace();

    const snapshot = await workspace.getSnapshot(document);

    expect(snapshot.commands).toContain('\\CC');
    expect(snapshot.prelude).toContain('\\mathbb{C}');
    workspace.dispose();
  });

  it('文档与 sty 里的 definecolor 折算成 MathJax 认识的 rgb', async () => {
    state.files.set('/ws/theme.sty', '\\definecolor{PkgBlue}{RGB}{0,128,255}\\definecolor{Bad}{wave}{500nm}');
    const text = [
      '\\usepackage{theme}',
      '\\definecolor{CancelU}{HTML}{C45A5A}',
      '\\definecolor{Half}{gray}{0.5}',
      '\\colorlet{Alias}{CancelU}',
      '$\\textcolor{CancelU}{x}$',
    ].join('\n');
    const document = makeDocument('/ws/main.tex', 'latex', text);
    const workspace = new DefinitionWorkspace(undefined, { maxFiles: 16 });

    const snapshot = await workspace.getSnapshot(document, text.indexOf('$\\textcolor'));

    expect(snapshot.prelude).toContain('\\definecolor{CancelU}{rgb}{0.7686,0.3529,0.3529}');
    expect(snapshot.prelude).toContain('\\definecolor{PkgBlue}{rgb}{0,0.502,1}');
    expect(snapshot.prelude).toContain('\\definecolor{Half}{rgb}{0.5,0.5,0.5}');
    expect(snapshot.prelude).toContain('\\definecolor{Alias}{named}{CancelU}');
    // 无法安全折算的模型不进 prelude，否则整份定义会在 MathJax 里抛错。
    expect(snapshot.prelude).not.toContain('wave');
    expect(snapshot.limitations.join('\n')).toContain('unsupported-color-model');
    // 颜色不能混进命令补全。
    expect(snapshot.commands).not.toContain('CancelU');
    workspace.dispose();
  });

  it('cls 里的文本环境不会被当成公式环境', async () => {
    // 回归：elegantnote.cls 的 question/solution 曾被当作数学环境，
    // 整段解答被识别成一条公式，里面的 \[...\] 全部失去预览。
    state.files.set('/ws/elegantnote.cls', [
      '\\newenvironment{question}[1][]{\\par\\noindent\\textbf{#1}}{\\par}',
      '\\newenvironment{solution}[1][\\solutionname]{\\begin{proof}[#1]}{\\end{proof}}',
      '\\newenvironment{keyeq}{\\begin{aligned}}{\\end{aligned}}',
    ].join('\n'));
    const text = '\\documentclass{elegantnote}\n\\begin{solution}\n\\[x+1\\]\n\\end{solution}';
    const document = makeDocument('/ws/main.tex', 'latex', text);
    const workspace = new DefinitionWorkspace(undefined, { maxFiles: 8 });

    const snapshot = await workspace.getSnapshot(document, text.length);

    expect(snapshot.environments).toEqual(['keyeq']);
    expect(snapshot.environments).not.toContain('question');
    expect(snapshot.environments).not.toContain('solution');
    // 定义本身仍然被识别，只是不参与公式区域判定。
    expect(snapshot.environmentDefinitions.map((definition) => definition.name))
      .toEqual(expect.arrayContaining(['question', 'solution', 'keyeq']));
    workspace.dispose();
  });

  it('prelude 把 eqmath 里的 equation/align 折成可嵌套形式', async () => {
    state.files.set('/ws/notes.cls', [
      '\\newenvironment{eqmath}{\\begin{equation}}{\\end{equation}}',
      '\\newenvironment{almath}{\\begin{align}}{\\end{align}}',
    ].join('\n'));
    const text = '\\documentclass{notes}\n\\begin{eqmath}x\\end{eqmath}';
    const document = makeDocument('/ws/main.tex', 'latex', text);
    const workspace = new DefinitionWorkspace(undefined, { maxFiles: 8 });
    const snapshot = await workspace.getSnapshot(document, text.length);

    expect(snapshot.environments).toEqual(expect.arrayContaining(['eqmath', 'almath']));
    expect(snapshot.prelude).toContain('\\newenvironment{eqmath}{}{}');
    expect(snapshot.prelude).toContain('\\newenvironment{almath}{\\begin{aligned}}{\\end{aligned}}');
    expect(snapshot.prelude).not.toContain('\\begin{equation}');
    expect(snapshot.prelude).not.toContain('\\begin{align}');
    workspace.dispose();
  });

  it('peekSnapshot 只返回已算好的快照，不触发解析', async () => {
    const text = '\\newcommand{\\aa}{A}\n$\\aa$';
    const document = makeDocument('/ws/peek.tex', 'latex', text);
    const workspace = new DefinitionWorkspace(undefined, { maxFiles: 4 });

    expect(workspace.peekSnapshot(document)).toBeUndefined();
    const snapshot = await workspace.getSnapshot(document, text.length);
    expect(workspace.peekSnapshot(document)).toBe(snapshot);
    workspace.invalidate();
    expect(workspace.peekSnapshot(document)).toBeUndefined();
    workspace.dispose();
  });

  it('写完 newcommand 再写后面的公式，prelude 立刻带上新宏', async () => {
    const first = '\\newcommand{\\keep}{K}\n$\\keep$';
    const second = '\\newcommand{\\keep}{K}\n\\newcommand{\\later}{\\alpha}\n$\\later$';
    const workspace = new DefinitionWorkspace(undefined, { maxFiles: 4 });
    const before = await workspace.getSnapshot(makeDocument('/ws/live.tex', 'latex', first, 1), first.length);
    expect(before.commands).toEqual(['\\keep']);
    expect(before.prelude).toContain('\\def\\keep{K}');

    const after = await workspace.getSnapshot(makeDocument('/ws/live.tex', 'latex', second, 2), second.length);
    expect(after.commands).toEqual(['\\keep', '\\later']);
    expect(after.prelude).toContain('\\def\\later{\\alpha}');

    const withDef = '\\newcommand{\\keep}{K}\n\\def\\fresh{\\beta}\n$\\fresh$';
    const defined = await workspace.getSnapshot(makeDocument('/ws/live.tex', 'latex', withDef, 3), withDef.length);
    expect(defined.prelude).toContain('\\def\\fresh{\\beta}');
    workspace.dispose();
  });

  it('快照 prelude 交给 MathJax 后，后加的宏能画出来', async () => {
    const { MathJaxSvgRenderer } = await import('../src/render/mathjaxRenderer.js');
    const workspace = new DefinitionWorkspace(undefined, { maxFiles: 4 });
    const renderer = new MathJaxSvgRenderer();
    const baseOptions = {
      displayMode: true,
      foreground: '#d4d4d4',
      caretColor: '#ffb454',
      scale: 1,
      exPx: 7,
      markUnknownCommands: false,
      expression: String.raw`\later`,
    } as const;

    const missingText = '\\newcommand{\\early}{\\alpha}\n$\\later$';
    const missingSnap = await workspace.getSnapshot(
      makeDocument('/ws/live-render.tex', 'latex', missingText, 1),
      missingText.length,
    );
    expect(missingSnap.prelude).not.toContain('later');
    expect(() => renderer.render({
      ...baseOptions,
      definitionFingerprint: missingSnap.fingerprint,
      definitionPrelude: missingSnap.prelude,
    })).toThrow();

    const presentText = '\\newcommand{\\early}{\\alpha}\n\\newcommand{\\later}{\\omega}\n$\\later$';
    const presentSnap = await workspace.getSnapshot(
      makeDocument('/ws/live-render.tex', 'latex', presentText, 2),
      presentText.length,
    );
    expect(presentSnap.prelude).toContain('\\def\\later{\\omega}');
    const drawn = renderer.render({
      ...baseOptions,
      definitionFingerprint: presentSnap.fingerprint,
      definitionPrelude: presentSnap.prelude,
    });
    expect(drawn.svg.includes('<path') || drawn.svg.includes('<text') || drawn.svg.includes('<rect')).toBe(true);
    expect(drawn.widthPx).toBeGreaterThan(0);
    renderer.clear();
    workspace.dispose();
  });

  it('大 sty 的快照 prelude 能让 MathJax 画出最后一个宏', async () => {
    const { MathJaxSvgRenderer } = await import('../src/render/mathjaxRenderer.js');
    const last = clsLetters(119);
    const macros = Array.from(
      { length: 120 },
      (_, index) => `% c${index}\n\\newcommand{\\${clsLetters(index)}}{\\alpha}`,
    ).join('\n');
    state.files.set('/ws/notes.sty', macros);
    const text = `\\usepackage{notes}\n$\\${last}$`;
    const workspace = new DefinitionWorkspace(undefined, { maxFiles: 8 });
    const snapshot = await workspace.getSnapshot(makeDocument('/ws/main.tex', 'latex', text), text.length);
    expect(snapshot.commands).toHaveLength(120);
    expect(snapshot.prelude).toContain(`\\def\\${last}{\\alpha}`);

    const renderer = new MathJaxSvgRenderer();
    const drawn = renderer.render({
      displayMode: true,
      definitionFingerprint: snapshot.fingerprint,
      definitionPrelude: snapshot.prelude,
      foreground: '#d4d4d4',
      caretColor: '#ffb454',
      scale: 1,
      exPx: 7,
      markUnknownCommands: false,
      expression: `\\${last}`,
    });
    expect(drawn.svg.includes('<path') || drawn.svg.includes('<text') || drawn.svg.includes('<rect')).toBe(true);
    renderer.clear();
    workspace.dispose();
  });

  it('未保存 sty 的缓冲区宏能渲染', async () => {
    const { MathJaxSvgRenderer } = await import('../src/render/mathjaxRenderer.js');
    state.openDocuments.push(makeDocument(
      '/ws/draft.sty',
      'latex',
      '\\newcommand{\\draftCmd}{\\beta}',
    ) as never);
    const text = '\\usepackage{draft}\n$\\draftCmd$';
    const workspace = new DefinitionWorkspace(undefined, { maxFiles: 8 });
    const snapshot = await workspace.getSnapshot(makeDocument('/ws/main.tex', 'latex', text), text.length);
    expect(snapshot.prelude).toContain('\\def\\draftCmd{\\beta}');
    const renderer = new MathJaxSvgRenderer();
    const drawn = renderer.render({
      displayMode: true,
      definitionFingerprint: snapshot.fingerprint,
      definitionPrelude: snapshot.prelude,
      foreground: '#d4d4d4',
      caretColor: '#ffb454',
      scale: 1,
      exPx: 7,
      markUnknownCommands: false,
      expression: String.raw`\draftCmd`,
    });
    expect(drawn.svg.includes('<path') || drawn.svg.includes('<text') || drawn.svg.includes('<rect')).toBe(true);
    renderer.clear();
    workspace.dispose();
  });

  it('未保存的 sty 也能被 usepackage 加载', async () => {
    state.openDocuments.push(makeDocument(
      '/ws/draft.sty',
      'latex',
      '\\newcommand{\\draftCmd}{\\beta}',
    ) as never);
    const text = '\\usepackage{draft}\n$\\draftCmd$';
    const document = makeDocument('/ws/main.tex', 'latex', text);
    const workspace = new DefinitionWorkspace(undefined, { maxFiles: 8 });

    const snapshot = await workspace.getSnapshot(document, text.length);

    expect(snapshot.commands).toContain('\\draftCmd');
    expect(snapshot.prelude).toContain('\\def\\draftCmd{\\beta}');
    workspace.dispose();
  });

  it('未保存缓冲区优先于磁盘上的旧 sty', async () => {
    state.files.set('/ws/local.sty', '\\newcommand{\\pkg}{disk}');
    state.openDocuments.push(makeDocument(
      '/ws/local.sty',
      'latex',
      '\\newcommand{\\pkg}{buffer}',
    ) as never);
    const text = '\\usepackage{local}\n$\\pkg$';
    const document = makeDocument('/ws/main.tex', 'latex', text);
    const workspace = new DefinitionWorkspace(undefined, { maxFiles: 8 });

    const snapshot = await workspace.getSnapshot(document, text.length);

    expect(snapshot.prelude).toContain('\\def\\pkg{buffer}');
    expect(snapshot.prelude).not.toContain('disk');
    workspace.dispose();
  });

  it('只失效变化的依赖，其它 sty 不重新读盘', async () => {
    state.files.set('/ws/one.sty', '\\newcommand{\\one}{1}');
    state.files.set('/ws/two.sty', '\\newcommand{\\two}{2}');
    const text = '\\usepackage{one}\\usepackage{two}\n$\\one+\\two$';
    const document = makeDocument('/ws/main.tex', 'latex', text);
    const workspace = new DefinitionWorkspace(undefined, { maxFiles: 8 });

    await workspace.getSnapshot(document, text.length);
    expect(state.readCount).toBe(2);

    state.files.set('/ws/one.sty', '\\newcommand{\\one}{one}');
    workspace.invalidate(vscode.Uri.file('/ws/one.sty'));
    const snapshot = await workspace.getSnapshot(document, text.length);

    expect(snapshot.prelude).toContain('\\def\\one{one}');
    expect(snapshot.commands).toEqual(expect.arrayContaining(['\\one', '\\two']));
    expect(state.readCount).toBe(3);
    workspace.dispose();
  });

  it('失效后 peek 仍给出上一份快照，直到新快照算完', async () => {
    state.files.set('/ws/local.sty', '\\newcommand{\\pkg}{P}');
    const text = '\\usepackage{local}\n$\\pkg$';
    const document = makeDocument('/ws/main.tex', 'latex', text);
    const workspace = new DefinitionWorkspace(undefined, { maxFiles: 8 });

    const first = await workspace.getSnapshot(document, text.length);
    expect(workspace.peekSnapshot(document)).toBe(first);

    state.files.set('/ws/local.sty', '\\newcommand{\\pkg}{Q}');
    workspace.invalidate(vscode.Uri.file('/ws/local.sty'));
    expect(workspace.peekSnapshot(document)).toBe(first);

    const second = await workspace.getSnapshot(document, text.length);
    expect(second.prelude).toContain('\\def\\pkg{Q}');
    expect(workspace.peekSnapshot(document)).toBe(second);
    workspace.dispose();
  });

  it('过大的 sty 留下 limitation，不把整份定义图弄丢', async () => {
    state.files.set('/ws/huge.sty', `${'\\newcommand{\\hugeCmd}{H}'.repeat(80)}\n`);
    const text = '\\usepackage{huge}\\newcommand{\\ok}{1}\n$\\ok$';
    const document = makeDocument('/ws/main.tex', 'latex', text);
    const workspace = new DefinitionWorkspace(undefined, { maxFiles: 8, maxFileBytes: 1024 });

    const snapshot = await workspace.getSnapshot(document, text.length);

    expect(snapshot.commands).toContain('\\ok');
    expect(snapshot.commands).not.toContain('\\hugeCmd');
    expect(snapshot.limitations.join('\n')).toContain('过大');
    workspace.dispose();
  });

  it('光标前才生效：后面的宏不会泄漏进当前公式', async () => {
    const text = '\\newcommand{\\before}{B}\n$\\before$\n\\newcommand{\\after}{A}';
    const document = makeDocument('/ws/order.tex', 'latex', text);
    const workspace = new DefinitionWorkspace(undefined, { maxFiles: 4 });
    const snapshot = await workspace.getSnapshot(document, text.indexOf('$\\before'));
    expect(snapshot.commands).toEqual(['\\before']);
    expect(snapshot.commands).not.toContain('\\after');
    workspace.dispose();
  });

  it('数千宏的 cls 全部进入 prelude，并且 peek 紧急度可区分', async () => {
    const last = clsLetters(799);
    const macros = Array.from({ length: 800 }, (_, index) => `\\newcommand{\\${clsLetters(index)}}{c}`).join('\n');
    state.files.set('/ws/notes.cls', macros);
    const text = `\\documentclass{notes}\n$\\${last}$`;
    const document = makeDocument('/ws/main.tex', 'latex', text);
    const workspace = new DefinitionWorkspace(undefined, { maxFiles: 8 });

    const started = performance.now();
    const snapshot = await workspace.getSnapshot(document, text.length);
    const elapsed = performance.now() - started;

    expect(snapshot.commands).toHaveLength(800);
    expect(snapshot.prelude).toContain(`\\def\\${last}{c}`);
    expect(elapsed).toBeLessThan(200);
    expect(workspace.peekSnapshot(document)).toBe(snapshot);
    workspace.dispose();
  });

  it('Windows 上宏包文件名大小写不敏感', async () => {
    if (process.platform !== 'win32') return;
    state.files.set('/ws/Local.sty', '\\newcommand{\\Mixed}{M}');
    const text = '\\usepackage{local}\n$\\Mixed$';
    const document = makeDocument('/ws/main.tex', 'latex', text);
    const workspace = new DefinitionWorkspace(undefined, { maxFiles: 8 });
    const snapshot = await workspace.getSnapshot(document, text.length);
    expect(snapshot.commands).toContain('\\Mixed');
    workspace.dispose();
  });

  it('循环依赖 fail-closed', async () => {
    state.files.set('/ws/a.tex', '\\input{b}\\newcommand{\\a}{a}');
    state.files.set('/ws/b.tex', '\\input{a}\\newcommand{\\b}{b}');
    const document = makeDocument('/ws/main.tex', 'latex', '\\input{a}');
    const workspace = new DefinitionWorkspace(undefined, { maxFiles: 3 });

    const snapshot = await workspace.getSnapshot(document);

    expect(snapshot.commands).toEqual(['\\b', '\\a']);
    expect(snapshot.limitations.join('\n')).toContain('循环依赖');
    workspace.reload();
    workspace.dispose();
    workspace.dispose();
  });
});

function makeDocument(
  path: string,
  languageId: 'latex' | 'tex' | 'markdown' | 'mdx',
  text: string,
  version = 1,
): vscode.TextDocument {
  const lines = text.split('\n');
  const starts: number[] = [];
  let cursor = 0;
  for (const line of lines) {
    starts.push(cursor);
    cursor += line.length + 1;
  }
  return {
    uri: vscode.Uri.file(path),
    languageId,
    version,
    getText: (range?: vscode.Range) => range ? text.slice(
      (starts[range.start.line] ?? 0) + range.start.character, (starts[range.end.line] ?? 0) + range.end.character,
    ) : text,
    positionAt: (offset: number) => {
      let line = 0;
      while (line + 1 < starts.length && starts[line + 1]! <= offset) line++;
      return { line, character: offset - starts[line]! };
    },
    lineCount: lines.length,
    lineAt: (line: number) => ({
      range: { start: { line, character: 0 }, end: { line, character: lines[line]?.length ?? 0 } },
    }),
    offsetAt: (position: { readonly line: number; readonly character: number }) =>
      (starts[position.line] ?? text.length) + position.character,
  } as unknown as vscode.TextDocument;
}

function clsLetters(index: number): string {
  let value = index;
  let name = '';
  do {
    name = String.fromCharCode(97 + (value % 26)) + name;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return `cls${name}`;
}
