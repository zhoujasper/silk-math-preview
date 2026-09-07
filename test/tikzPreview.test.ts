import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ mathRender: vi.fn(), prepare: vi.fn(), activeEditor: undefined as unknown }));
vi.mock('../src/render/renderClient', () => ({ RenderClient: class {
  render = mocks.mathRender;
  prepare = mocks.prepare;
  dispose = vi.fn().mockResolvedValue(undefined);
  setIdleMs() {}
} }));
vi.mock('vscode', () => {
  const event = () => ({ dispose() {} });
  class Position { constructor(public line: number, public character: number) {} }
  class Range { constructor(public start: Position, public end: Position) {} }
  class EventEmitter { event = event; fire() {} dispose() {} }
  return {
    Position, Range, EventEmitter,
    Uri: { from: (value: unknown) => value },
    DecorationRangeBehavior: { ClosedClosed: 1 },
    ColorThemeKind: { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 },
    window: {
      get activeTextEditor() { return mocks.activeEditor; },
      get visibleTextEditors() { return mocks.activeEditor ? [mocks.activeEditor] : []; },
      activeColorTheme: { kind: 2 },
      createTextEditorDecorationType: () => ({ dispose() {} }),
      onDidChangeActiveTextEditor: event, onDidChangeTextEditorSelection: event,
      onDidChangeTextEditorVisibleRanges: event, onDidChangeActiveColorTheme: event,
    },
    workspace: {
      notebookDocuments: [],
      getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }),
      onDidChangeTextDocument: event, onDidCloseTextDocument: event, onDidChangeConfiguration: event,
    },
    commands: { executeCommand: vi.fn() },
  };
});

import * as vscode from 'vscode';
import { PreviewController } from '../src/vscode/previewController';

const source = String.raw`\begin{tikzpicture}
\begin{axis}[xlabel={$x$},ylabel={$x^2$}]
\addplot[domain=0:2]{x^2};
\end{axis}
\end{tikzpicture}`;
const result = { ok: true, type: 'result', id: 1, svg: '<svg><path d="M0 0L1 1"/></svg>', widthPx: 280, heightPx: 126, renderMs: 200 };
const definitions = { getSnapshot: vi.fn().mockResolvedValue({ fingerprint: '', prelude: '', commands: [], environments: [], limitations: [] }) };
let controller: PreviewController | undefined;

function editorFor(text: string): vscode.TextEditor {
  const lines = text.split('\n');
  const offsetAt = (position: vscode.Position) => lines.slice(0, position.line).reduce((sum, line) => sum + line.length + 1, 0) + position.character;
  const positionAt = (offset: number) => {
    const before = text.slice(0, offset).split('\n');
    return new vscode.Position(before.length - 1, before.at(-1)!.length);
  };
  const position = positionAt(text.indexOf('addplot'));
  const document = {
    uri: { toString: () => 'file:///example.tex', path: '/example.tex', scheme: 'file' },
    languageId: 'latex', version: 1, lineCount: lines.length, positionAt, offsetAt,
    getText: (range?: vscode.Range) => range ? text.slice(offsetAt(range.start), offsetAt(range.end)) : text,
    lineAt: (line: number) => ({ text: lines[line], range: new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, lines[line]!.length)), rangeIncludingLineBreak: new vscode.Range(new vscode.Position(line, 0), line + 1 < lines.length ? new vscode.Position(line + 1, 0) : new vscode.Position(line, lines[line]!.length)) }),
  };
  return { document, selection: { active: position, anchor: position, start: position, end: position }, setDecorations: vi.fn(), options: {} } as unknown as vscode.TextEditor;
}

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); mocks.activeEditor = editorFor(source); });
afterEach(() => { controller?.dispose(); controller = undefined; vi.useRealTimers(); });

describe('TikZ editor routing', () => {
  function setup(enabled: boolean, render = vi.fn().mockResolvedValue(result)) {
    const service = { render, cancel: vi.fn(), dispose: vi.fn(), setIdleMs: vi.fn() };
    controller = new PreviewController(definitions, '/unused-math-worker', { previewLanguage: () => 'latex', tikzEnabled: () => enabled }, undefined, service as never);
    const paint = vi.spyOn(controller as unknown as { applyDecoration(...args: unknown[]): void }, 'applyDecoration').mockImplementation(() => undefined);
    return { service, paint };
  }

  it('does not start either renderer or preview inner axis labels when switched off', async () => {
    const { service, paint } = setup(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(service.render).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.mathRender).not.toHaveBeenCalled();
    expect(paint).not.toHaveBeenCalled();
  });

  it('sends the entire picture to the optional renderer and displays its SVG when enabled', async () => {
    const { service, paint } = setup(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(service.render).toHaveBeenCalledWith(expect.objectContaining({ expression: source, scale: 1 }));
    expect(mocks.mathRender).not.toHaveBeenCalled();
    expect(paint).toHaveBeenCalledTimes(1);
  });

  it('Esc dismisses a pending picture and rejects its late frame', async () => {
    let finish!: (value: typeof result) => void;
    const render = vi.fn(() => new Promise<typeof result>((resolve) => { finish = resolve; }));
    const { service, paint } = setup(true, render);
    await vi.advanceTimersByTimeAsync(0);
    controller!.dismiss();
    finish(result);
    await vi.advanceTimersByTimeAsync(0);
    expect(service.cancel).toHaveBeenCalled();
    expect(paint).not.toHaveBeenCalled();
  });
});
