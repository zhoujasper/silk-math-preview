import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mathRender: vi.fn(), prepare: vi.fn(), activeEditor: undefined as unknown,
  config: {} as Record<string, unknown>,
  configListeners: new Set<(event: { affectsConfiguration(key: string): boolean }) => void>(),
  visibleListeners: new Set<(event: { textEditor: unknown }) => void>(),
  selectionListeners: new Set<(event: { textEditor: unknown; kind: number }) => void>(),
  disposedTypes: new WeakSet<object>(),
}));
vi.mock('../src/render/renderClient', () => ({ RenderClient: class {
  render = mocks.mathRender;
  prepare = mocks.prepare;
  dispose = vi.fn().mockResolvedValue(undefined);
  setIdleMs() {}
} }));
vi.mock('vscode', () => {
  const event = () => ({ dispose() {} });
  class Position {
    constructor(public line: number, public character: number) {}
    isBeforeOrEqual(other: Position) { return this.line < other.line || this.line === other.line && this.character <= other.character; }
  }
  class Range { constructor(public start: Position, public end: Position) {} }
  class EventEmitter {
    private listeners = new Set<(value: unknown) => void>();
    event = (listener: (value: unknown) => void) => {
      this.listeners.add(listener); return { dispose: () => this.listeners.delete(listener) };
    };
    fire(value?: unknown) { for (const listener of this.listeners) listener(value); }
    dispose() { this.listeners.clear(); }
  }
  return {
    Position, Range, EventEmitter,
    env: { language: 'zh-cn' },
    MarkdownString: class { appendText() {} appendMarkdown() {} },
    StatusBarAlignment: { Right: 2 },
    ThemeColor: class { constructor(public id: string) {} },
    Uri: { from: (value: { scheme: string; path: string }) => ({ ...value, toString: (skipEncoding = false) => `${value.scheme}:${skipEncoding ? value.path : encodeURIComponent(value.path)}` }) },
    DecorationRangeBehavior: { ClosedClosed: 1 },
    TextEditorSelectionChangeKind: { Mouse: 1, Keyboard: 2, Command: 3 },
    ColorThemeKind: { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 },
    window: {
      get activeTextEditor() { return mocks.activeEditor; },
      get visibleTextEditors() { return mocks.activeEditor ? [mocks.activeEditor] : []; },
      activeColorTheme: { kind: 2 },
      createStatusBarItem: () => ({ show() {}, hide() {}, dispose() {} }),
      createTextEditorDecorationType: () => ({ dispose() { mocks.disposedTypes.add(this); } }),
      onDidChangeActiveTextEditor: event,
      onDidChangeTextEditorSelection: (listener: (event: { textEditor: unknown; kind: number }) => void) => {
        mocks.selectionListeners.add(listener); return { dispose() { mocks.selectionListeners.delete(listener); } };
      },
      onDidChangeTextEditorVisibleRanges: (listener: (event: { textEditor: unknown }) => void) => {
        mocks.visibleListeners.add(listener); return { dispose() { mocks.visibleListeners.delete(listener); } };
      },
      onDidChangeActiveColorTheme: event,
    },
    workspace: {
      notebookDocuments: [],
      getConfiguration: () => ({ get: (key: string, fallback: unknown) => mocks.config[key] ?? fallback }),
      onDidChangeTextDocument: event, onDidCloseTextDocument: event,
      onDidChangeConfiguration: (listener: (event: { affectsConfiguration(key: string): boolean }) => void) => {
        mocks.configListeners.add(listener); return { dispose() { mocks.configListeners.delete(listener); } };
      },
    },
    commands: { executeCommand: vi.fn(), registerCommand: event },
  };
});

import * as vscode from 'vscode';
import { PreviewController } from '../src/vscode/previewController';
import { StatusController } from '../src/vscode/statusController';

const source = String.raw`\begin{tikzpicture}
\begin{axis}[xlabel={$x$},ylabel={$x^2$}]
\addplot[domain=0:2]{x^2};
\end{axis}
\end{tikzpicture}`;
const result = { ok: true, type: 'result', id: 1, svg: '<svg><path d="M0 0L1 1"/></svg>', widthPx: 280, heightPx: 126, renderMs: 200 };
const definitions = { getSnapshot: vi.fn().mockResolvedValue({ fingerprint: '', prelude: '', commands: [], environments: [], limitations: [] }) };
let controller: PreviewController | undefined;
let status: StatusController | undefined;

function editorFor(text: string, languageId = 'latex', scheme = 'file', caret = text.indexOf('addplot')): vscode.TextEditor {
  const lines = text.split('\n');
  const offsetAt = (position: vscode.Position) => lines.slice(0, position.line).reduce((sum, line) => sum + line.length + 1, 0) + position.character;
  const positionAt = (offset: number) => {
    const before = text.slice(0, offset).split('\n');
    return new vscode.Position(before.length - 1, before.at(-1)!.length);
  };
  const position = positionAt(caret);
  const path = scheme === 'untitled' ? '/Untitled-1' : '/example.tex';
  const document = {
    uri: { toString: () => `${scheme}://${path}`, path, scheme },
    languageId, version: 1, lineCount: lines.length, positionAt, offsetAt,
    getText: (range?: vscode.Range) => range ? text.slice(offsetAt(range.start), offsetAt(range.end)) : text,
    lineAt: (line: number) => ({ text: lines[line], range: new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, lines[line]!.length)), rangeIncludingLineBreak: new vscode.Range(new vscode.Position(line, 0), line + 1 < lines.length ? new vscode.Position(line + 1, 0) : new vscode.Position(line, lines[line]!.length)) }),
  };
  return { document, selection: { active: position, anchor: position, start: position, end: position }, setDecorations: vi.fn(), options: {}, visibleRanges: [new vscode.Range(new vscode.Position(0, 0), new vscode.Position(lines.length - 1, 0))] } as unknown as vscode.TextEditor;
}

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); mocks.config = {}; mocks.disposedTypes = new WeakSet(); mocks.activeEditor = editorFor(source); });
afterEach(() => { controller?.dispose(); controller = undefined; status?.dispose(); status = undefined; vi.useRealTimers(); });

describe('other file types', () => {
  const array = String.raw`\[
\begin{array} { c c } { } & { } \\ { } & { } \\ \hline { } & { A \mathbf { v } = \lambda \mathbf { v } } \end{array}
\]`;
  function setup(scheme: string, enabled: boolean) {
    mocks.activeEditor = editorFor(array, 'plaintext', scheme, array.indexOf('&') + 3);
    mocks.config = { enableInOtherFiles: enabled, enableInLatex: false, enableInMarkdown: false };
    mocks.mathRender.mockResolvedValue({ ...result, widthPx: 126, heightPx: 88 });
    status = new StatusController({ workspaceState: { get: (_key: string, fallback: unknown) => fallback } } as vscode.ExtensionContext);
    controller = new PreviewController(definitions, '/unused-math-worker', status);
    return mocks.activeEditor as vscode.TextEditor;
  }

  it.each(['untitled', 'file'])('renders the three-line array with the real file-type policy (%s)', async (scheme) => {
    const editor = setup(scheme, true);
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.mathRender).toHaveBeenCalledWith(expect.objectContaining({
      expression: expect.stringContaining('A \\mathbf { v } = \\lambda'), displayMode: true,
    }));
    const painted = vi.mocked(editor.setDecorations).mock.lastCall![1][0] as vscode.DecorationOptions;
    expect(painted.range.start.line).toBe(2);
    expect(painted.renderOptions?.before?.contentIconPath).toBeDefined();
    expect(painted.renderOptions?.before?.textDecoration).not.toContain('width, 100%)');
  });

  it('starts an existing untitled preview when enabled, then clears it when disabled', async () => {
    const editor = setup('untitled', false);
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.mathRender).not.toHaveBeenCalled();
    const toggle = async (enabled: boolean) => {
      mocks.config.enableInOtherFiles = enabled;
      for (const listener of mocks.configListeners) listener({ affectsConfiguration: (key) => key === 'silkMath' || key === 'silkMath.enableInOtherFiles' });
      await vi.advanceTimersByTimeAsync(0);
    };
    await toggle(true);
    expect(mocks.mathRender).toHaveBeenCalledTimes(1);
    expect(vi.mocked(editor.setDecorations).mock.lastCall![1]).toHaveLength(1);
    await toggle(false);
    expect(vi.mocked(editor.setDecorations).mock.lastCall![1]).toEqual([]);
    expect(mocks.mathRender).toHaveBeenCalledTimes(1);
  });
});

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

  it('saving CSS restyles the cached SVG without another render request', async () => {
    const { service, paint } = setup(true);
    paint.mockRestore();
    await vi.advanceTimersByTimeAsync(0);
    const editor = mocks.activeEditor as vscode.TextEditor;
    const decorated = vi.mocked(editor.setDecorations);
    const first = decorated.mock.lastCall![1][0] as vscode.DecorationOptions;
    const image = first.renderOptions?.before?.contentIconPath;
    expect(image).toBeDefined();
    mocks.config.previewCss = 'border-radius: 20px; --silk-offset-x: -80px;';
    for (const listener of mocks.configListeners) listener({ affectsConfiguration: (key) => key === 'silkMath' || key === 'silkMath.previewCss' });
    await vi.advanceTimersByTimeAsync(0);
    const last = decorated.mock.lastCall![1][0] as vscode.DecorationOptions;
    expect(last.renderOptions?.before?.textDecoration).toContain('border-radius: 20px !important');
    expect(last.renderOptions?.before?.contentIconPath).toBe(image);
    expect(service.render).toHaveBeenCalledTimes(1);
    expect(mocks.mathRender).not.toHaveBeenCalled();
  });

  it('a height-only viewport change updates the cached image size without rerendering', async () => {
    mocks.activeEditor = editorFor(source + '\n'.repeat(60));
    const { service, paint } = setup(true, vi.fn().mockResolvedValue({ ...result, widthPx: 900, heightPx: 1200 }));
    paint.mockRestore();
    await vi.advanceTimersByTimeAsync(0);
    const editor = mocks.activeEditor as vscode.TextEditor;
    const decorated = vi.mocked(editor.setDecorations);
    const before = decorated.mock.calls.length;
    const first = (decorated.mock.lastCall![1][0] as vscode.DecorationOptions).renderOptions?.before?.textDecoration;
    Object.defineProperty(editor, 'visibleRanges', { value: [new vscode.Range(new vscode.Position(0, 0), new vscode.Position(5, 0))] });
    for (const listener of mocks.visibleListeners) listener({ textEditor: editor });
    expect(decorated.mock.calls.slice(before).filter(([, items]) => (items[0] as vscode.DecorationOptions | undefined)?.renderOptions)).toHaveLength(1);
    expect((decorated.mock.lastCall![1][0] as vscode.DecorationOptions).renderOptions?.before?.textDecoration).not.toBe(first);
    expect(service.render).toHaveBeenCalledTimes(1);
  });

  it('applies each placement and font change to a cached image, tracks the caret and restores defaults', async () => {
    const { service, paint } = setup(true);
    paint.mockRestore();
    await vi.advanceTimersByTimeAsync(0);
    const editor = mocks.activeEditor as vscode.TextEditor;
    const decorated = vi.mocked(editor.setDecorations);
    const current = () => (decorated.mock.lastCall![1][0] as vscode.DecorationOptions).renderOptions!.before!;
    const image = current().contentIconPath;
    const baseline = current().textDecoration;
    expect(baseline).toContain("background-image: url('data:image/svg+xml;base64,");
    for (const anchor of ['cursor', 'selection', 'formula']) for (const placement of ['above', 'below', 'right']) {
      mocks.config.previewCss = `--silk-anchor:${anchor};--silk-placement:${placement};--silk-gap:2lh;--silk-allow-overlap:false;font-size:150%;`;
      for (const listener of mocks.configListeners) listener({ affectsConfiguration: (key) => key === 'silkMath' || key === 'silkMath.previewCss' });
      expect(current().textDecoration).toContain('436px'); // 16px padding + 280px image × 150%
      expect(current().textDecoration).toContain('source-formula-');
      expect(current().contentIconPath).toBe(image);
    }
    mocks.config.previewCss = '--silk-anchor:cursor;--silk-allow-overlap:true;';
    for (const listener of mocks.configListeners) listener({ affectsConfiguration: (key) => key === 'silkMath' || key === 'silkMath.previewCss' });
    const count = decorated.mock.calls.length;
    const caret = editor.document.positionAt(source.indexOf('domain') + 2);
    Object.defineProperty(editor, 'selection', { value: { active: caret, anchor: caret, start: caret, end: caret } });
    for (const listener of mocks.selectionListeners) listener({ textEditor: editor, kind: 2 });
    await vi.advanceTimersByTimeAsync(80);
    expect(decorated.mock.calls.length).toBeGreaterThan(count);
    expect((decorated.mock.lastCall![1][0] as vscode.DecorationOptions).range.start.character).toBe(caret.character);
    mocks.config.previewCss = '';
    for (const listener of mocks.configListeners) listener({ affectsConfiguration: (key) => key === 'silkMath' || key === 'silkMath.previewCss' });
    expect(current().textDecoration).toBe(baseline);
    expect(service.render).toHaveBeenCalledTimes(1);
  });

  it('hides a formula scrolled entirely out of view and restores it without rendering again', async () => {
    mocks.activeEditor = editorFor(source + '\n'.repeat(60));
    const { service, paint } = setup(true); paint.mockRestore();
    await vi.advanceTimersByTimeAsync(0);
    const editor = mocks.activeEditor as vscode.TextEditor;
    const decorated = vi.mocked(editor.setDecorations);
    const visible = editor.visibleRanges;
    Object.defineProperty(editor, 'visibleRanges', { configurable: true, value: [new vscode.Range(new vscode.Position(10, 0), new vscode.Position(20, 0))] });
    for (const listener of mocks.visibleListeners) listener({ textEditor: editor });
    expect(decorated.mock.lastCall![1]).toEqual([]);
    Object.defineProperty(editor, 'visibleRanges', { value: visible });
    for (const listener of mocks.visibleListeners) listener({ textEditor: editor });
    expect((decorated.mock.lastCall![1][0] as vscode.DecorationOptions).renderOptions?.before?.contentIconPath).toBeDefined();
    expect(service.render).toHaveBeenCalledTimes(1);
  });
});

describe('preview dismissal', () => {
  const formula = String.raw`prefix $A{\bf v}=\lambda{\bf v},\quad{\bf v}\neq{\bf0}$ suffix`;
  const documentText = `${formula}\n\noutside\n$x+y$\nmore`;
  function start(text = documentText, caret = text.indexOf('lambda')) {
    mocks.activeEditor = editorFor(text, 'latex', 'untitled', caret);
    mocks.mathRender.mockResolvedValue({ ...result, widthPx: 180, heightPx: 36 });
    controller = new PreviewController(definitions, '/unused-math-worker');
    return mocks.activeEditor as vscode.TextEditor;
  }
  function select(editor: vscode.TextEditor, active: number, anchor = active, kind = 1) {
    const at = editor.document.positionAt;
    Object.defineProperty(editor, 'selection', { configurable: true, value: {
      active: at(active), anchor: at(anchor), start: at(Math.min(active, anchor)), end: at(Math.max(active, anchor)),
    } });
    for (const listener of mocks.selectionListeners) listener({ textEditor: editor, kind });
  }
  function hasDecorations(editor: vscode.TextEditor) {
    const latest = new Map(vi.mocked(editor.setDecorations).mock.calls.map(([type, ranges]) => [type, ranges]));
    return [...latest].some(([type, ranges]) => !mocks.disposedTypes.has(type) && ranges.length > 0);
  }

  it.each([1, 2, 3, 0].flatMap((kind) => [
    { kind, name: 'same-line text after the formula', offset: documentText.indexOf('suffix') + 2 },
    { kind, name: 'blank line underneath the overlay', offset: formula.length + 1 },
    { kind, name: 'nearby non-formula text', offset: documentText.indexOf('outside') + 2 },
  ]))('clears immediately on the first selection event: $name, kind=$kind', async ({ kind, offset }) => {
    const editor = start(); await vi.advanceTimersByTimeAsync(0);
    expect(hasDecorations(editor)).toBe(true);
    const reads = definitions.getSnapshot.mock.calls.length;
    select(editor, offset, offset, kind);
    // No timer, further click, keyboard movement or edit is needed to remove any overlay/anchor.
    expect(hasDecorations(editor)).toBe(false);
    expect(vscode.commands.executeCommand).toHaveBeenLastCalledWith('setContext', 'silkMath.previewVisible', false);
    await vi.advanceTimersByTimeAsync(500);
    expect(hasDecorations(editor)).toBe(false);
    expect(definitions.getSnapshot).toHaveBeenCalledTimes(reads);
    expect(mocks.mathRender).toHaveBeenCalledTimes(1);
  });

  it('keeps a selection covering the formula, then clears when the whole selection moves outside', async () => {
    const editor = start(); await vi.advanceTimersByTimeAsync(0);
    select(editor, documentText.indexOf('suffix') + 1, 0);
    expect(hasDecorations(editor)).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(hasDecorations(editor)).toBe(true);
    select(editor, documentText.indexOf('outside') + 4, formula.length + 1);
    expect(hasDecorations(editor)).toBe(false);
    await vi.advanceTimersByTimeAsync(500);
    expect(hasDecorations(editor)).toBe(false);
  });

  it('shows the preview again on re-entry and switches to another formula without leaving the old frame', async () => {
    const editor = start(); await vi.advanceTimersByTimeAsync(0);
    select(editor, documentText.indexOf('outside'));
    expect(hasDecorations(editor)).toBe(false);
    select(editor, documentText.indexOf('lambda'));
    await vi.advanceTimersByTimeAsync(0);
    expect(hasDecorations(editor)).toBe(true);
    select(editor, documentText.indexOf('x+y') + 1);
    expect(hasDecorations(editor)).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(hasDecorations(editor)).toBe(true);
    expect(mocks.mathRender.mock.lastCall?.[0].expression).toContain('x');
    expect(mocks.mathRender.mock.lastCall?.[0].expression).not.toContain('lambda');
  });

  it('ignores selection events from an inactive split editor', async () => {
    const editor = start(); await vi.advanceTimersByTimeAsync(0);
    select(editorFor('other text', 'latex', 'file', 0), 1);
    expect(hasDecorations(editor)).toBe(true);
    await vi.advanceTimersByTimeAsync(500);
    expect(hasDecorations(editor)).toBe(true);
  });

  it.each(['math', 'tikz'])('does not revive a delayed %s frame after leaving the formula', async (engine) => {
    const text = engine === 'math' ? documentText : `${source}\n\noutside`;
    const editor = start(text, engine === 'math' ? text.indexOf('lambda') : text.indexOf('addplot'));
    controller!.dispose();
    let finish!: (value: typeof result) => void;
    const render = vi.fn(() => new Promise<typeof result>((resolve) => { finish = resolve; }));
    const service = { render, cancel: vi.fn(), dispose: vi.fn(), setIdleMs: vi.fn() };
    if (engine === 'math') mocks.mathRender.mockImplementation(render);
    controller = new PreviewController(definitions, '/unused-math-worker', { previewLanguage: () => 'latex', tikzEnabled: () => true }, undefined, engine === 'tikz' ? service as never : undefined);
    await vi.advanceTimersByTimeAsync(0);
    expect(render).toHaveBeenCalledTimes(1);
    select(editor, text.indexOf('outside'));
    finish(result);
    await vi.advanceTimersByTimeAsync(500);
    expect(hasDecorations(editor)).toBe(false);
    if (engine === 'tikz') expect(service.cancel).toHaveBeenCalled();
  });

  it('cancels a pending TikZ refresh as soon as the caret leaves', async () => {
    const text = `${source}\n\noutside`;
    mocks.activeEditor = editorFor(text);
    const editor = mocks.activeEditor as vscode.TextEditor;
    const service = { render: vi.fn().mockResolvedValue(result), cancel: vi.fn(), dispose: vi.fn(), setIdleMs: vi.fn() };
    controller = new PreviewController(definitions, '/unused-math-worker', { previewLanguage: () => 'latex', tikzEnabled: () => true }, undefined, service as never);
    await vi.advanceTimersByTimeAsync(0);
    expect(hasDecorations(editor)).toBe(true);
    select(editor, text.indexOf('addplot') + 2);
    select(editor, text.indexOf('outside'));
    expect(hasDecorations(editor)).toBe(false);
    await vi.advanceTimersByTimeAsync(500);
    expect(hasDecorations(editor)).toBe(false);
    expect(service.render).toHaveBeenCalledTimes(1);
  });

  it('cancels an error notice before it can appear outside the formula', async () => {
    const editor = start();
    mocks.mathRender.mockResolvedValue({ ok: false, error: 'invalid formula' });
    await vi.advanceTimersByTimeAsync(0);
    select(editor, documentText.indexOf('outside'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(hasDecorations(editor)).toBe(false);
  });

  it('discards delayed definitions without starting a renderer after leaving', async () => {
    const editor = start(); controller!.dispose();
    let finish!: (value: { fingerprint: string; prelude: string; commands: []; environments: []; limitations: [] }) => void;
    const delayedDefinitions = { getSnapshot: vi.fn(() => new Promise<Parameters<typeof finish>[0]>((resolve) => { finish = resolve; })) };
    controller = new PreviewController(delayedDefinitions, '/unused-math-worker');
    await vi.advanceTimersByTimeAsync(0);
    expect(delayedDefinitions.getSnapshot).toHaveBeenCalledTimes(1);
    select(editor, documentText.indexOf('outside'));
    finish({ fingerprint: '', prelude: '', commands: [], environments: [], limitations: [] });
    await vi.advanceTimersByTimeAsync(500);
    expect(hasDecorations(editor)).toBe(false);
    expect(mocks.mathRender).not.toHaveBeenCalled();
    expect(delayedDefinitions.getSnapshot).toHaveBeenCalledTimes(1);
  });
});
