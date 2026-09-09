import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  value: undefined as string | undefined,
  update: vi.fn(),
  editor: undefined as unknown,
  listeners: new Set<(event: { affectsConfiguration(key: string): boolean }) => void>(),
}));
vi.mock('vscode', () => {
  class Disposable { constructor(private action: () => void) {} dispose() { this.action(); } }
  class EventEmitter { event = () => new Disposable(() => {}); fire() {} dispose() {} }
  return {
    Disposable, EventEmitter,
    Position: class { constructor(public line: number, public character: number) {} },
    Range: class { constructor(public start: unknown, public end: unknown) {} },
    CompletionItem: class { constructor(public label: string, public kind: number) {} },
    SnippetString: class { constructor(public value: string) {} },
    Hover: class { constructor(public contents: string, public range: unknown) {} },
    CodeLens: class { constructor(public range: unknown, public command: unknown) {} },
    CompletionItemKind: { Property: 1, Value: 2 },
    languages: {
      registerCompletionItemProvider: vi.fn(() => new Disposable(() => {})),
      registerHoverProvider: vi.fn(() => new Disposable(() => {})),
      registerCodeLensProvider: vi.fn(() => new Disposable(() => {})),
    },
    commands: { registerCommand: vi.fn(() => new Disposable(() => {})) },
    Uri: { from: (data: { scheme: string; path: string }) => ({ ...data, toString: () => `${data.scheme}:${data.path}` }) },
    FileType: { File: 1, Directory: 2 }, FileChangeType: { Changed: 1 }, ConfigurationTarget: { Global: 1 },
    FileSystemError: { Unavailable: (message: string) => new Error(message), NoPermissions: () => new Error('NoPermissions'), FileNotFound: () => new Error('FileNotFound') },
    workspace: {
      getConfiguration: () => ({ get: () => state.value, inspect: () => ({ globalValue: state.value }), update: state.update }),
      onDidChangeConfiguration: (listener: (event: { affectsConfiguration(key: string): boolean }) => void) => {
        state.listeners.add(listener);
        return new Disposable(() => state.listeners.delete(listener));
      },
      registerFileSystemProvider: vi.fn(() => new Disposable(() => {})),
      openTextDocument: vi.fn(async (uri: unknown) => ({ uri })),
    },
    window: { showTextDocument: vi.fn(), showErrorMessage: vi.fn(), get activeTextEditor() { return state.editor; } },
  };
});

import * as vscode from 'vscode';
import { parsePreviewCss, PREVIEW_CSS_TEMPLATE } from '../src/core/previewCss';
import { openPreviewCss, PreviewCssFileSystem, PREVIEW_CSS_OPTIONS, previewCssCompletions, previewCssHover, withAdvancedPreviewCssExamples } from '../src/vscode/preview-css';

let provider: PreviewCssFileSystem;
const changed = () => { for (const listener of state.listeners) listener({ affectsConfiguration: (key) => key === 'silkMath.previewCss' }); };
beforeEach(() => { vi.clearAllMocks(); state.value = undefined; state.editor = undefined; state.update.mockReset(); provider = new PreviewCssFileSystem(); });
afterEach(() => provider.dispose());

describe('native CSS editor', () => {
  it('opens one editable CSS document without writing a project file or a setting', async () => {
    const context = { subscriptions: [] as vscode.Disposable[] } as unknown as vscode.ExtensionContext;
    await openPreviewCss(context);
    await openPreviewCss(context);
    expect(vscode.workspace.registerFileSystemProvider).toHaveBeenCalledTimes(1);
    expect(vscode.languages.registerCompletionItemProvider).toHaveBeenCalledWith({ scheme: 'silkmath-css', language: 'css' }, previewCssCompletions, '-', ':');
    expect(vscode.languages.registerHoverProvider).toHaveBeenCalledWith({ scheme: 'silkmath-css', language: 'css' }, previewCssHover);
    expect(vscode.window.showTextDocument).toHaveBeenCalledWith(expect.objectContaining({ uri: expect.objectContaining({ scheme: 'silkmath-css', path: '/preview.css' }) }), { preview: false });
    expect(state.update).not.toHaveBeenCalled();
    for (const disposable of context.subscriptions) disposable.dispose();
    expect(Buffer.from(provider.readFile()).toString()).toBe(PREVIEW_CSS_TEMPLATE);
  });

  it.each(PREVIEW_CSS_OPTIONS)('every documented %s option saves, reads back and parses', async (property, values) => {
    for (const value of values) {
      const source = `.silk-math-preview { ${property}: ${value}; }`;
      await provider.writeFile(provider.uri, Buffer.from(source));
      expect(state.update).toHaveBeenLastCalledWith('previewCss', source, vscode.ConfigurationTarget.Global);
      expect(Buffer.from(provider.readFile()).toString()).toBe(source);
      expect(() => parsePreviewCss(source)).not.toThrow();
    }
  });

  it.each(['.silk-math-preview { --silk-offset-x: -60px; opacity:.8; }', '/* .silk-math-preview { } */ opacity:.8;', '', PREVIEW_CSS_TEMPLATE])('inserts advanced examples without changing active settings or duplicating them', (source) => {
    const result = withAdvancedPreviewCssExamples(source);
    expect(parsePreviewCss(result)).toEqual(parsePreviewCss(source));
    expect(result).toContain('--silk-anchor');
    expect(result).toContain('font-size');
    expect(result).toContain('padding:');
    for (const [, , help] of PREVIEW_CSS_OPTIONS) expect(result).toContain(help.replaceAll('\n', '\n   * '));
    expect(result.length).toBeLessThanOrEqual(8192);
    expect(withAdvancedPreviewCssExamples(result)).toBe(result);
  });

  it('adds help for existing appearance settings without replacing their values', () => {
    const source = '.silk-math-preview { padding: 1px 3px; border-radius: 12px; --silk-gap: 2lh; }';
    const result = withAdvancedPreviewCssExamples(source);
    expect(parsePreviewCss(result)).toEqual(parsePreviewCss(source));
    expect(result).toContain('padding: 1px 3px; border-radius: 12px;');
    expect(result).toContain('默认 4px 8px');
    expect(result).toContain('default 6px');
    expect(withAdvancedPreviewCssExamples(result)).toBe(result);
    expect(() => withAdvancedPreviewCssExamples(`/* ${'x'.repeat(7000)} */ opacity:.8;`)).toThrow('8192');
  });

  it('the advanced-options action edits only the virtual CSS document and leaves saving to the user', async () => {
    const context = { subscriptions: [] as vscode.Disposable[] } as unknown as vscode.ExtensionContext;
    await openPreviewCss(context);
    const action = vi.mocked(vscode.commands.registerCommand).mock.calls.find(([name]) => name === 'silkMath.previewCssOptions')![1];
    const replace = vi.fn();
    const edit = vi.fn(async (callback: (builder: { replace: typeof replace }) => void) => { callback({ replace }); return true; });
    const document = { uri: provider.uri, getText: () => '.silk-math-preview { opacity:.8; }', positionAt: (character: number) => new vscode.Position(0, character) };
    state.editor = { document: { ...document, uri: { toString: () => 'file:/source.tex' } }, edit };
    await action(); expect(edit).not.toHaveBeenCalled();
    state.editor = { document, edit };
    await action(); expect(edit).toHaveBeenCalledTimes(1);
    expect(replace.mock.lastCall?.[1]).toContain('--silk-anchor');
    expect(parsePreviewCss(replace.mock.lastCall![1] as string)).toEqual(parsePreviewCss(document.getText()));
    expect(state.update).not.toHaveBeenCalled();
    document.getText = () => `/* ${'x'.repeat(7000)} */ opacity:.8;`;
    await action();
    expect(edit).toHaveBeenCalledTimes(1);
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('8192'));
    for (const disposable of context.subscriptions) disposable.dispose();
  });

  it.each(PREVIEW_CSS_OPTIONS)('completes and explains %s in the editor', async (property, values, description) => {
    const position = new vscode.Position(0, property.length);
    const range = new vscode.Range(new vscode.Position(0, 0), position);
    const document = { lineAt: () => ({ text: property }), getWordRangeAtPosition: () => range, getText: () => property } as unknown as vscode.TextDocument;
    const token = {} as vscode.CancellationToken;
    const context = {} as vscode.CompletionContext;
    const properties = await previewCssCompletions.provideCompletionItems(document, position, token, context) as vscode.CompletionItem[];
    const option = properties.find((item) => item.label === property)!;
    expect((option.insertText as vscode.SnippetString).value).toContain(`${property}:`);
    expect(option.documentation).toBe(description);
    expect(await previewCssHover.provideHover(document, position, token)).toMatchObject({ contents: description, range });
    const valueDocument = { ...document, lineAt: () => ({ text: `${property}: ` }) } as unknown as vscode.TextDocument;
    const completed = await previewCssCompletions.provideCompletionItems(valueDocument, new vscode.Position(0, property.length + 2), token, context) as vscode.CompletionItem[];
    expect(completed.map((item) => item.label)).toEqual(values);
  });

  it('persists valid CSS globally and reads the saved bytes even before the configuration event', async () => {
    const source = '.silk-math-preview { --silk-offset-x: -60px; }';
    await provider.writeFile(provider.uri, Buffer.from(source));
    expect(state.update).toHaveBeenCalledWith('previewCss', source, vscode.ConfigurationTarget.Global);
    expect(Buffer.from(provider.readFile()).toString()).toBe(source);
    changed(); // stale get() must not replace the newly saved buffer
    expect(Buffer.from(provider.readFile()).toString()).toBe(source);
    state.value = source; changed();
    state.value = 'opacity: 0.8;'; changed();
    expect(Buffer.from(provider.readFile()).toString()).toBe(state.value);
  });

  it('clear-and-save resets CSS and stays empty when reopened', async () => {
    await provider.writeFile(provider.uri, Buffer.from(''));
    expect(Buffer.from(provider.readFile()).toString()).toBe('');
    state.value = ''; changed();
    expect(provider.readFile().byteLength).toBe(0);
  });

  it('rejects invalid CSS and failed saves without losing the previous style', async () => {
    state.value = 'border-radius: 4px;';
    await expect(provider.writeFile(provider.uri, Buffer.from('position: fixed;'))).rejects.toThrow();
    expect(state.update).not.toHaveBeenCalled();
    state.update.mockRejectedValueOnce(new Error('write failed'));
    await expect(provider.writeFile(provider.uri, Buffer.from('opacity: .8;'))).rejects.toThrow('write failed');
    expect(Buffer.from(provider.readFile()).toString()).toBe(state.value);
  });

  it('does not write arbitrary paths and reports a usable virtual file', async () => {
    expect(provider.stat().size).toBe(provider.readFile().byteLength);
    expect(provider.stat(vscode.Uri.from({ scheme: provider.uri.scheme, path: '/' })).type).toBe(vscode.FileType.Directory);
    expect(provider.readDirectory()).toEqual([['preview.css', vscode.FileType.File]]);
    provider.watch().dispose();
    const other = vscode.Uri.from({ scheme: provider.uri.scheme, path: '/other.css' });
    expect(() => provider.readFile(other)).toThrow();
    await expect(provider.writeFile(other, Buffer.from(''))).rejects.toThrow();
    expect(() => provider.createDirectory()).toThrow();
    expect(() => provider.rename()).toThrow();
    expect(() => provider.delete()).toThrow();
  });
});
