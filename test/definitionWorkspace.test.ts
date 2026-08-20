import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ files: new Map<string, string>() }));

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
    public toString(): string {
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
  return {
    Uri: MockUri,
    EventEmitter: MockEventEmitter,
    FileType: { File: 1 },
    NotebookCellKind: { Markup: 1, Code: 2 },
    workspace: {
      createFileSystemWatcher: () => watcher,
      onDidSaveTextDocument: noEvent,
      onDidChangeNotebookDocument: noEvent,
      notebookDocuments: [],
      getWorkspaceFolder: (uri: MockUri) => uri.path.startsWith('/ws/') ? folder : undefined,
      asRelativePath: (uri: MockUri) => uri.path.replace(/^\/ws\//, ''),
      fs: {
        readFile: async (uri: MockUri) => {
          const value = state.files.get(uri.path);
          if (value === undefined) {
            throw new Error('ENOENT');
          }
          return new TextEncoder().encode(value);
        },
        stat: async (uri: MockUri) => {
          if (!state.files.has(uri.path)) {
            throw new Error('ENOENT');
          }
          return { type: 1, ctime: 0, mtime: 0, size: state.files.get(uri.path)?.length ?? 0 };
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
  beforeEach(() => state.files.clear());

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
    version: 1,
    getText: () => text,
    lineCount: lines.length,
    lineAt: (line: number) => ({
      range: { end: { line, character: lines[line]?.length ?? 0 } },
    }),
    offsetAt: (position: { readonly line: number; readonly character: number }) =>
      (starts[position.line] ?? text.length) + position.character,
  } as unknown as vscode.TextDocument;
}
