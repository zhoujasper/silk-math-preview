import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Vscode from 'vscode';

const state = vi.hoisted(() => ({
  commands: new Map<string, () => unknown>(),
  capture: vi.fn(), clipboard: vi.fn(), recognize: vi.fn(), copied: vi.fn(), errors: vi.fn(), warnings: vi.fn(),
  panels: vi.fn(), edit: vi.fn(), pickers: [] as string[],
  action: 'copy', picked: undefined as string | undefined,
  paste: undefined as Vscode.DocumentPasteEditProvider | undefined,
  editor: undefined as Vscode.TextEditor | undefined,
}));
vi.mock('../src/ocr/captureService', () => ({ captureRegion: state.capture, readClipboardImage: state.clipboard }));
vi.mock('../src/ocr/ocrClient', () => ({ OcrClient: class { recognize = state.recognize; dispose() {} } }));
vi.mock('../src/ocr/packManager', () => ({ OcrPackManager: class {
  constructor(readonly rootPath: string) {} async isInstalled() { return true; }
} }));
vi.mock('vscode', () => {
  const disposable = () => ({ dispose() {} });
  const uri = (path: string) => ({ fsPath: path, path });
  const token = { isCancellationRequested: false, onCancellationRequested: disposable };
  return {
    Uri: { file: uri }, ProgressLocation: { Notification: 15 },
    env: { language: 'zh-cn', clipboard: { writeText: state.copied } },
    commands: {
      registerCommand: (name: string, run: () => unknown) => { state.commands.set(name, run); return disposable(); },
      executeCommand: vi.fn(),
    },
    workspace: {
      getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }),
      fs: { stat: (value: { fsPath: string }) => stat(value.fsPath), readFile: (value: { fsPath: string }) => readFile(value.fsPath) },
      applyEdit: state.edit,
    },
    window: {
      get activeTextEditor() { return state.editor; },
      showInformationMessage: vi.fn(), showErrorMessage: state.errors, showWarningMessage: state.warnings,
      createWebviewPanel: state.panels,
      showOpenDialog: async () => state.picked ? [uri(state.picked)] : undefined,
      withProgress: (_options: unknown, run: Function) => run({ report: vi.fn() }, token),
      createQuickPick: () => {
        let accept = () => {}, hide = () => {};
        const picker = { title: '', placeholder: '', items: [] as Array<{ action: string }>, selectedItems: [] as Array<{ action: string }>,
          onDidAccept: (fn: () => void) => { accept = fn; return disposable(); },
          onDidHide: (fn: () => void) => { hide = fn; return disposable(); },
          show: () => { state.pickers.push(picker.title); queueMicrotask(() => { picker.selectedItems = picker.items.filter((item) => item.action === state.action); accept(); }); },
          hide: () => hide(), dispose() {},
        }; return picker;
      },
    },
    languages: { registerDocumentPasteEditProvider: (_selector: unknown, provider: Vscode.DocumentPasteEditProvider) => { state.paste = provider; return disposable(); } },
    DocumentDropOrPasteEditKind: { Text: { append: () => ({ value: 'text.silkMath.latex' }) } },
    DocumentPasteEdit: class { constructor(readonly insertText: string, readonly title: string, readonly kind: unknown) {} },
  };
});
import { OcrController } from '../src/vscode/ocrController';

let directory: string;
let controller: OcrController;
const token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose() {} }) } as Vscode.CancellationToken;
beforeEach(async () => {
  vi.clearAllMocks(); state.commands.clear(); state.pickers = []; state.action = 'copy'; state.picked = undefined; state.editor = undefined;
  directory = await mkdtemp(join(tmpdir(), 'silk-ocr-controller-test-'));
  state.capture.mockImplementation(async (path: string) => { await writeFile(path, Uint8Array.of(1, 2, 3)); return true; });
  state.clipboard.mockImplementation(async (path: string) => { await writeFile(path, Uint8Array.of(4, 5, 6)); return true; });
  state.recognize.mockResolvedValue({ text: '$x=1$', ok: true, mode: 'formula' });
  controller = new OcrController({ globalStorageUri: { fsPath: directory }, asAbsolutePath: (path: string) => join(directory, path) } as Vscode.ExtensionContext);
});
afterEach(async () => { controller.dispose(); await rm(directory, { recursive: true, force: true }); });
const command = (name: string) => state.commands.get(`silkMath.${name}`)!();

describe('无面板图片识别入口', () => {
  it('截图后自动识别、在原生菜单复制，临时图片已清理', async () => {
    await command('ocr.capture');
    expect(state.capture).toHaveBeenCalledTimes(1);
    expect(state.recognize.mock.calls[0]?.[1]).toBe('formula');
    expect(state.copied).toHaveBeenCalledWith('$x=1$');
    expect(state.panels).not.toHaveBeenCalled();
    expect(state.pickers).toHaveLength(1);
    await expect(stat(dirname(state.capture.mock.calls[0]![0] as string))).rejects.toThrow();
  });
  it('取消框选不识别、不弹失败、不打开替代截图工具或面板', async () => {
    state.capture.mockResolvedValue(false);
    await command('ocr.capture');
    expect(state.recognize).not.toHaveBeenCalled(); expect(state.errors).not.toHaveBeenCalled(); expect(state.panels).not.toHaveBeenCalled();
  });
  it('读取剪贴板与选择图片共用后台识别，不需要截图', async () => {
    await command('ocr.paste');
    expect(state.clipboard).toHaveBeenCalledTimes(1); expect(state.capture).not.toHaveBeenCalled();
    const path = join(directory, 'chosen.png'); await writeFile(path, Uint8Array.of(7, 8, 9)); state.picked = path;
    await command('ocr.openImage');
    expect(Array.from(state.recognize.mock.calls[1]![0] as Uint8Array)).toEqual([7, 8, 9]);
    expect(state.recognize).toHaveBeenCalledTimes(2); expect(state.panels).not.toHaveBeenCalled();
  });
  it('图片 Ctrl+V 返回 LaTeX 粘贴编辑，普通文本粘贴保持原行为', async () => {
    const provider = state.paste!;
    const context = { triggerKind: 0, only: undefined } as Vscode.DocumentPasteEditContext;
    const data = new Map([['image/png', { asFile: () => ({ data: async () => Uint8Array.of(1, 2, 3) }) }]]) as unknown as Vscode.DataTransfer;
    const edits = await provider.provideDocumentPasteEdits!({} as Vscode.TextDocument, [], data, context, token);
    expect(edits?.[0]?.insertText).toBe('$x=1$'); expect(state.pickers).toHaveLength(0);
    const textData = new Map([['text/plain', { value: 'hello' }]]) as unknown as Vscode.DataTransfer;
    expect(await provider.provideDocumentPasteEdits!({} as Vscode.TextDocument, [], textData, context, token)).toBeUndefined();
    expect(state.recognize).toHaveBeenCalledTimes(1);
  });
  it('识别期间文档发生变化时，不把结果插到过期位置', async () => {
    const doc = { version: 1, isClosed: false, uri: { path: '/note.tex' } };
    state.editor = { document: doc, selection: { active: { line: 0, character: 0 } } } as unknown as Vscode.TextEditor;
    state.action = 'insert';
    state.recognize.mockImplementation(async () => { doc.version = 2; return { text: '$x=1$', ok: true, mode: 'formula' }; });
    await command('ocr.capture');
    expect(state.edit).not.toHaveBeenCalled(); expect(state.warnings).toHaveBeenCalledWith(expect.stringContaining('原文档已改变'), expect.any(String));
  });
});
