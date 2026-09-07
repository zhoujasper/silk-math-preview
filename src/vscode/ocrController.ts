import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { cmd, COMMAND_NS, IS_TEST_CHANNEL, PRODUCT_NAME } from '../core/channel';
import { fillTemplate, isCancelledMessage, uiCopy } from '../core/uiLocale';
import { captureRegion, readClipboardImage } from '../ocr/captureService';
import { OcrClient } from '../ocr/ocrClient';
import { ocrCopy } from '../ocr/ocrCopy';
import { OCR_PACK_BYTES, OCR_PACK_VERSION } from '../ocr/packManifest';
import { OcrPackManager } from '../ocr/packManager';
import { MAX_IMAGE_BYTES, type OcrMode, type OcrResult } from '../ocr/protocol';

interface InsertTarget { readonly document: vscode.TextDocument; readonly position: vscode.Position; readonly version: number; }
type Source = 'capture' | 'paste' | 'file';
type SourceItem = vscode.QuickPickItem & { readonly source: Source };

/** 原生选区 + 后台 OCR + 小型原生菜单，全流程不创建 Webview/编辑器面板。 */
export class OcrController implements vscode.Disposable {
  private readonly pack: OcrPackManager;
  private readonly client: OcrClient;
  private readonly disposables: vscode.Disposable[] = [];
  private abort: AbortController | undefined;
  private input: vscode.QuickPick<SourceItem> | undefined;
  private resultPicker: vscode.QuickPick<vscode.QuickPickItem & { action: string }> | undefined;
  private disposed = false;
  private mode: OcrMode = 'formula';

  constructor(private readonly context: vscode.ExtensionContext) {
    this.pack = new OcrPackManager(join(context.globalStorageUri.fsPath, 'ocr', OCR_PACK_VERSION));
    this.client = new OcrClient(context.asAbsolutePath('dist/ocr-worker.js'), this.pack.rootPath);
    this.disposables.push(
      vscode.commands.registerCommand(cmd('ocr.capture'), () => this.launch('capture')),
      vscode.commands.registerCommand(cmd('ocr.paste'), () => this.launch('paste')),
      vscode.commands.registerCommand(cmd('ocr.openImage'), () => this.launch('file')),
      vscode.commands.registerCommand(cmd('ocr.open'), () => this.showInput()),
    );
    this.registerImagePaste();
  }
  dispose(): void {
    this.disposed = true; this.abort?.abort(); this.client.dispose();
    this.input?.dispose(); this.resultPicker?.dispose();
    void vscode.commands.executeCommand('setContext', `${COMMAND_NS}.ocrInputVisible`, false);
    for (const item of this.disposables) item.dispose();
  }
  private target(): InsertTarget | undefined {
    const active = vscode.window.activeTextEditor;
    return active ? { document: active.document, position: active.selection.active, version: active.document.version } : undefined;
  }
  private enabled(): boolean {
    return vscode.workspace.getConfiguration(COMMAND_NS).get('ocr.enabled', true);
  }
  private showInput(): void {
    this.input?.dispose();
    const copy = ocrCopy(vscode.env.language);
    const picker = vscode.window.createQuickPick<SourceItem>();
    this.input = picker;
    picker.title = `${PRODUCT_NAME} · ${copy.input}`;
    picker.placeholder = copy.inputHint;
    picker.items = [
      { label: `$(screen-full) ${copy.capture}`, source: 'capture' },
      { label: `$(clippy) ${copy.paste}`, description: copy.pasteHint, source: 'paste' },
      { label: `$(folder-opened) ${copy.upload}`, source: 'file' },
    ];
    const accept = picker.onDidAccept(() => {
      const source = picker.selectedItems[0]?.source;
      if (source) { picker.hide(); void this.launch(source); }
    });
    const hide = picker.onDidHide(() => {
      if (this.input === picker) { this.input = undefined; void vscode.commands.executeCommand('setContext', `${COMMAND_NS}.ocrInputVisible`, false); }
      accept.dispose(); hide.dispose(); picker.dispose();
    });
    void vscode.commands.executeCommand('setContext', `${COMMAND_NS}.ocrInputVisible`, true);
    picker.show();
  }
  private async ensurePack(): Promise<boolean> {
    if (await this.pack.isInstalled()) return true;
    const copy = uiCopy(vscode.env.language).ocr;
    const action = await vscode.window.showInformationMessage(
      fillTemplate(copy.downloadPrompt, { mb: `${Math.round(OCR_PACK_BYTES / 1_048_576)} MB` }), { modal: true }, copy.downloadAction,
    );
    if (action !== copy.downloadAction || this.disposed) return false;
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification,
      title: fillTemplate(copy.installing, { product: PRODUCT_NAME }), cancellable: true,
    }, (progress, token) => this.pack.install(progress, token));
    return true;
  }
  private async readSource(source: Source, signal: AbortSignal): Promise<Uint8Array | undefined> {
    const copy = ocrCopy(vscode.env.language);
    if (source === 'file') {
      const chosen = await vscode.window.showOpenDialog({ canSelectMany: false, openLabel: copy.input, filters: { 'PNG / JPEG': ['png', 'jpg', 'jpeg'] } });
      const uri = chosen?.[0];
      if (!uri || signal.aborted) return undefined;
      const info = await vscode.workspace.fs.stat(uri);
      if (info.size > MAX_IMAGE_BYTES) throw new Error('image-too-large');
      return vscode.workspace.fs.readFile(uri);
    }
    const directory = await mkdtemp(join(tmpdir(), 'silk-ocr-'));
    const path = join(directory, 'image.png');
    try {
      const exists = source === 'capture'
        ? await captureRegion(path, this.context.asAbsolutePath('resources/capture-windows.ps1'), signal)
        : await readClipboardImage(path, this.context.asAbsolutePath('resources'), signal);
      if (!exists) {
        if (source === 'paste') void vscode.window.showInformationMessage(copy.emptyClipboard);
        return undefined;
      }
      const info = await vscode.workspace.fs.stat(vscode.Uri.file(path));
      if (info.size > MAX_IMAGE_BYTES) throw new Error('image-too-large');
      return readFile(path);
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
  private async infer(image: Uint8Array, mode: OcrMode, abort: AbortController): Promise<OcrResult> {
    if (image.byteLength > MAX_IMAGE_BYTES) throw new Error('image-too-large');
    if (!await this.ensurePack() || abort.signal.aborted) throw new Error('cancelled');
    const copy = uiCopy(vscode.env.language).ocr;
    return vscode.window.withProgress({ location: vscode.ProgressLocation.Notification,
      title: `${PRODUCT_NAME} · ${ocrCopy(vscode.env.language).working}`, cancellable: true,
    }, async (progress, token) => {
      const cancel = token.onCancellationRequested(() => abort.abort());
      try {
        return await this.client.recognize(image, mode, abort.signal, (p) => {
          progress.report({ message: p.stage === 'models' ? copy.loadFormulaModel : p.stage === 'text' ? copy.recognizingText : copy.parseFormula });
        });
      } finally { cancel.dispose(); }
    });
  }
  private async launch(source: Source): Promise<void> {
    if (this.disposed) return;
    this.input?.hide();
    if (!this.enabled()) {
      void vscode.window.showInformationMessage(fillTemplate(uiCopy(vscode.env.language).ocr.enableFirst, { key: `${COMMAND_NS}.ocr.enabled` })); return;
    }
    if (this.abort) { void vscode.window.showInformationMessage(ocrCopy(vscode.env.language).busy); return; }
    this.resultPicker?.hide();
    const target = this.target();
    const abort = this.abort = new AbortController();
    let image: Uint8Array | undefined;
    let result: OcrResult | undefined;
    try {
      image = await this.readSource(source, abort.signal);
      if (image) result = await this.infer(image, this.mode, abort);
    } catch (error) { this.showError(error, source === 'capture' && !image); }
    finally { if (this.abort === abort) this.abort = undefined; }
    if (image && result && !this.disposed && !abort.signal.aborted) await this.showResult(image, result, target);
  }
  private showError(error: unknown, capture = false): void {
    const message = error instanceof Error ? error.message : String(error);
    if (this.disposed || isCancelledMessage(message) || /AbortError|operation was aborted/.test(message)) return;
    const copy = ocrCopy(vscode.env.language);
    const localized = message === 'image-too-large' ? copy.imageTooLarge
      : message === 'unsupported-image' ? copy.unsupportedImage : message === 'invalid-image' ? copy.invalidImage
        : message === 'ocr-timeout' ? copy.timeout : capture ? `${copy.captureUnavailable} ${message}` : message;
    void vscode.window.showErrorMessage(fillTemplate(uiCopy(vscode.env.language).ocr.errorPrefix, { message: localized }));
  }
  private async showResult(image: Uint8Array, result: OcrResult, target: InsertTarget | undefined): Promise<void> {
    const copy = ocrCopy(vscode.env.language);
    const t = uiCopy(vscode.env.language).ocr;
    if (!result.text.trim()) { void vscode.window.showWarningMessage(copy.noResult); return; }
    const picker = vscode.window.createQuickPick<vscode.QuickPickItem & { action: string }>();
    this.resultPicker = picker;
    picker.title = `${PRODUCT_NAME} · ${result.mode === 'formula' ? copy.result : t.title}`;
    picker.placeholder = result.ok ? result.text.replace(/\s+/g, ' ') : t.formulaIncomplete;
    const action = await new Promise<string | undefined>((resolve) => {
      picker.items = [
        ...(target ? [{ label: `$(insert) ${t.insert}`, description: target.document.uri.path.split('/').pop() ?? '', detail: result.text, action: 'insert' }] : []),
        { label: `$(copy) ${t.copy}`, ...(!target ? { detail: result.text } : {}), action: 'copy' },
        ...(!result.text.includes('\n') || result.mode === 'formula' ? [{ label: `$(edit) ${copy.edit}`, action: 'edit' }] : []),
        { label: `$(settings) ${copy.again}`, description: result.mode === 'formula' ? t.formula : result.mode === 'text' ? t.text : t.auto, action: 'mode' },
      ];
      const accept = picker.onDidAccept(() => { const action = picker.selectedItems[0]?.action; resolve(action); picker.hide(); });
      const hide = picker.onDidHide(() => { resolve(undefined); accept.dispose(); hide.dispose(); picker.dispose(); if (this.resultPicker === picker) this.resultPicker = undefined; });
      picker.show();
    });
    if (action === 'copy') {
      await vscode.env.clipboard.writeText(result.text);
      void vscode.window.showInformationMessage(t.copied);
    } else if (action === 'insert' && target) await this.insertAtTarget(result.text, target);
    else if (action === 'edit') {
      // 原生 InputBox 是单行输入。数学空白可合并，未改动则保留原有换行。
      const value = result.text.replace(/\r?\n/g, ' ');
      const edited = await vscode.window.showInputBox({ title: copy.editMultiline, prompt: copy.editHint, value, ignoreFocusOut: true });
      if (edited !== undefined) await this.showResult(image, { ...result, text: edited === value ? result.text : edited }, target);
    } else if (action === 'mode') {
      const modes: (vscode.QuickPickItem & { mode: OcrMode })[] = [
        { label: t.formula, mode: 'formula' }, { label: t.auto, mode: 'auto' }, { label: t.text, mode: 'text' },
      ];
      const picked = await vscode.window.showQuickPick(modes, { title: copy.again });
      if (!picked || this.abort || this.disposed) return;
      this.mode = picked.mode;
      const abort = this.abort = new AbortController();
      let recognized: OcrResult | undefined;
      try { recognized = await this.infer(image, picked.mode, abort); } catch (error) { this.showError(error); }
      finally { if (this.abort === abort) this.abort = undefined; }
      if (recognized && !this.disposed && !abort.signal.aborted) await this.showResult(image, recognized, target);
    }
  }
  private async insertAtTarget(text: string, target: InsertTarget): Promise<void> {
    const t = uiCopy(vscode.env.language).ocr;
    if (target.document.isClosed || target.document.version !== target.version) {
      const action = await vscode.window.showWarningMessage(ocrCopy(vscode.env.language).targetChanged, t.copy);
      if (action === t.copy) await vscode.env.clipboard.writeText(text);
      return;
    }
    const offset = target.document.offsetAt(target.position);
    const edit = new vscode.WorkspaceEdit(); edit.insert(target.document.uri, target.position, text);
    if (!await vscode.workspace.applyEdit(edit)) { void vscode.window.showErrorMessage(t.insertFailed); return; }
    const editor = await vscode.window.showTextDocument(target.document, { preview: false });
    const end = target.document.positionAt(offset + text.length); editor.selection = new vscode.Selection(end, end);
  }
  private registerImagePaste(): void {
    // 较旧 VS Code 没有图片粘贴 Provider，仍可在识别菜单 Ctrl+V 或使用粘贴命令。
    if (!vscode.languages.registerDocumentPasteEditProvider || !vscode.DocumentDropOrPasteEditKind) return;
    const kind = vscode.DocumentDropOrPasteEditKind.Text.append(COMMAND_NS, 'latex');
    this.disposables.push(vscode.languages.registerDocumentPasteEditProvider(
      ['latex', 'tex', 'markdown', 'mdx'].map((language) => ({ language })),
      { provideDocumentPasteEdits: async (_document, _ranges, data, _context, token) => {
        if (!this.enabled() || !vscode.workspace.getConfiguration(COMMAND_NS).get('ocr.pasteImages', !IS_TEST_CHANNEL)
          || this.abort || this.disposed || token.isCancellationRequested) return undefined;
        const file = (data.get('image/png') ?? data.get('image/jpeg'))?.asFile();
        if (!file) return undefined;
        const abort = this.abort = new AbortController();
        const cancel = token.onCancellationRequested(() => abort.abort());
        try {
          const result = await this.infer(await file.data(), 'formula', abort);
          if (abort.signal.aborted || !result.text.trim()) return undefined;
          if (!result.ok) void vscode.window.showWarningMessage(uiCopy(vscode.env.language).ocr.formulaIncomplete);
          return [new vscode.DocumentPasteEdit(result.text, `${PRODUCT_NAME} · LaTeX`, kind)];
        } catch (error) { this.showError(error); return undefined; }
        finally { cancel.dispose(); if (this.abort === abort) this.abort = undefined; }
      } },
      { providedPasteEditKinds: [kind], pasteMimeTypes: ['image/png', 'image/jpeg'] },
    ));
  }
}
