import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  files: new Map<string, string>(),
  openDocuments: [] as Array<{ uri: { path: string; toString(): string }; languageId: string; version: number; getText(): string }>,
  readCount: 0,
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
      activeTextEditor: undefined,
    },
    workspace: {
      createFileSystemWatcher: () => watcher,
      onDidSaveTextDocument: noEvent,
      onDidChangeNotebookDocument: noEvent,
      onDidChangeTextDocument: noEvent,
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

describe('DefinitionWorkspace', () => {
  beforeEach(() => {
    state.files.clear();
    state.openDocuments = [];
    state.readCount = 0;
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
    getText: () => text,
    lineCount: lines.length,
    lineAt: (line: number) => ({
      range: { end: { line, character: lines[line]?.length ?? 0 } },
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
