import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import * as vscode from 'vscode';

import { cmd, COMMAND_NS, PRODUCT_NAME } from '../core/channel';
import { fillTemplate, isCancelledMessage, uiCopy } from '../core/uiLocale';
import { captureFullScreen } from '../ocr/captureService';
import { OCR_PACK_BYTES, OCR_PACK_VERSION } from '../ocr/packManifest';
import { OcrPackManager } from '../ocr/packManager';
import type { OcrWebviewConfig, OcrWebviewToHostMessage } from '../ocr/ocrWebview';

export interface FormulaPreviewRenderer {
  renderStandalone(expression: string): Promise<string>;
}

interface InsertTarget {
  readonly uri: vscode.Uri;
  readonly position: vscode.Position;
}

const megabytes = (bytes: number): string => `${Math.round(bytes / 1_048_576)} MB`;

function nonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let index = 0; index < 32; index += 1) value += alphabet[Math.floor(Math.random() * alphabet.length)] ?? 'x';
  return value;
}

function escapeInlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => {
    const code = character.charCodeAt(0).toString(16).padStart(4, '0');
    return `\\u${code}`;
  });
}

function validImageFilter(label: string): Record<string, string[]> {
  return { [label]: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] };
}

/** 状态栏、首次按需安装、系统截图和 Webview/编辑器之间的唯一桥接层。 */
export class OcrController implements vscode.Disposable {
  private readonly pack: OcrPackManager;
  private readonly disposables: vscode.Disposable[] = [];
  private panel: vscode.WebviewPanel | undefined;
  private temporaryCapture: string | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly renderer: FormulaPreviewRenderer,
  ) {
    const packPath = join(context.globalStorageUri.fsPath, 'ocr', OCR_PACK_VERSION);
    this.pack = new OcrPackManager(packPath);
    // 状态栏只保留一个 Silk Math 入口；截图识别作为菜单里的一项。
    this.disposables.push(
      vscode.commands.registerCommand(cmd('ocr.capture'), () => this.capture()),
    );
  }

  dispose(): void {
    this.panel?.dispose();
    this.panel = undefined;
    for (const disposable of this.disposables) disposable.dispose();
    void this.removeTemporaryCapture();
  }

  private async ensurePack(): Promise<boolean> {
    if (await this.pack.isInstalled()) return true;
    const ocr = uiCopy(vscode.env.language).ocr;
    const download = ocr.downloadAction;
    const choice = await vscode.window.showInformationMessage(
      fillTemplate(ocr.downloadPrompt, { mb: megabytes(OCR_PACK_BYTES) }),
      { modal: true },
      download,
    );
    if (choice !== download) return false;
    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: fillTemplate(ocr.installing, { product: PRODUCT_NAME }),
        cancellable: true,
      }, (progress, token) => this.pack.install(progress, token));
      void vscode.window.showInformationMessage(fillTemplate(ocr.installed, { product: PRODUCT_NAME }));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!isCancelledMessage(message)) {
        void vscode.window.showErrorMessage(fillTemplate(ocr.installFailed, { message }));
      }
      return false;
    }
  }

  private async capture(): Promise<void> {
    if (!vscode.workspace.getConfiguration(COMMAND_NS).get('ocr.enabled', true)) {
      void vscode.window.showInformationMessage(
        fillTemplate(uiCopy(vscode.env.language).ocr.enableFirst, { key: `${COMMAND_NS}.ocr.enabled` }),
      );
      return;
    }
    if (!await this.ensurePack()) return;
    const active = vscode.window.activeTextEditor;
    const target: InsertTarget | undefined = active
      ? { uri: active.document.uri, position: active.selection.active }
      : undefined;

    const captureDir = join(this.context.globalStorageUri.fsPath, 'captures');
    const capturePath = join(captureDir, `screen-${Date.now()}.png`);
    let imageUri: vscode.Uri;
    let temporary = false;
    try {
      await mkdir(captureDir, { recursive: true });
      await captureFullScreen(capturePath, this.context.asAbsolutePath(join('resources', 'capture-windows.ps1')));
      imageUri = vscode.Uri.file(capturePath);
      temporary = true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const ocr = uiCopy(vscode.env.language).ocr;
      const pick = ocr.pickImage;
      const action = await vscode.window.showWarningMessage(
        fillTemplate(ocr.screenshotUnavailable, { reason }),
        pick,
      );
      if (action !== pick) return;
      const picked = await vscode.window.showOpenDialog({
        canSelectMany: false,
        openLabel: ocr.openLabel,
        filters: validImageFilter(ocr.imageFilter),
      });
      const first = picked?.[0];
      if (!first) return;
      imageUri = first;
    }
    await this.openPanel(imageUri, target, temporary ? capturePath : undefined);
  }

  private async openPanel(image: vscode.Uri, target: InsertTarget | undefined, temporaryPath?: string): Promise<void> {
    this.panel?.dispose();
    await this.removeTemporaryCapture();
    this.temporaryCapture = temporaryPath;

    const copy = uiCopy(vscode.env.language);
    const packRoot = vscode.Uri.file(this.pack.rootPath);
    const distRoot = vscode.Uri.joinPath(this.context.extensionUri, 'dist');
    const imageRoot = vscode.Uri.joinPath(image, '..');
    const panel = vscode.window.createWebviewPanel(
      `${COMMAND_NS}.ocr`,
      fillTemplate(copy.ocr.panelTitle, { product: PRODUCT_NAME }),
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: [packRoot, distRoot, imageRoot],
      },
    );
    this.panel = panel;
    panel.webview.html = this.webviewHtml(panel.webview, image);
    panel.onDidDispose(() => {
      if (this.panel === panel) this.panel = undefined;
      void this.removeTemporaryCapture();
    }, undefined, this.disposables);
    panel.webview.onDidReceiveMessage((message: OcrWebviewToHostMessage) => {
      void this.handleMessage(panel, message, target);
    }, undefined, this.disposables);
  }

  private webviewHtml(webview: vscode.Webview, image: vscode.Uri): string {
    const local = (relative: string): string => webview.asWebviewUri(vscode.Uri.file(join(this.pack.rootPath, relative))).toString();
    const runtime = local(join('ort', 'ort.webgpu.min.js'));
    const ortBase = `${webview.asWebviewUri(vscode.Uri.file(join(this.pack.rootPath, 'ort'))).toString()}/`;
    const script = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'ocr-webview.js'));
    const token = nonce();
    const copy = uiCopy(vscode.env.language);
    const config: OcrWebviewConfig = {
      imageUri: webview.asWebviewUri(image).toString(),
      ortWasmBase: ortBase,
      htmlLang: copy.htmlLang,
      copy: copy.ocr,
      formula: {
        encoder: local(join('models', 'mfr_encoder.onnx')),
        decoder: local(join('models', 'mfr_decoder.onnx')),
        tokenizer: local(join('models', 'mfr_tokenizer.json')),
      },
      text: {
        detector: local(join('models', 'PP-OCRv5_mobile_det_infer.onnx')),
        recognizer: local(join('models', 'PP-OCRv5_mobile_rec_infer.onnx')),
        dictionary: local(join('models', 'ppocrv5_dict.txt')),
      },
    };
    return `<!doctype html>
<html lang="${copy.htmlLang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data: blob:; connect-src ${webview.cspSource} blob:; worker-src ${webview.cspSource} blob:; style-src 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${token}' 'wasm-unsafe-eval';">
<title>${fillTemplate(copy.ocr.panelTitle, { product: PRODUCT_NAME })}</title></head><body>
<script nonce="${token}">globalThis.__SILK_MATH_OCR__=${escapeInlineJson(config)};</script>
<script nonce="${token}" src="${runtime}"></script>
<script nonce="${token}" src="${script}"></script>
</body></html>`;
  }

  private async handleMessage(
    panel: vscode.WebviewPanel,
    message: OcrWebviewToHostMessage,
    target: InsertTarget | undefined,
  ): Promise<void> {
    if (message.type === 'preview-request') {
      try {
        const svg = await this.renderer.renderStandalone(message.latex);
        await panel.webview.postMessage({ type: 'formula-preview', svg });
      } catch (error) {
        await panel.webview.postMessage({
          type: 'formula-preview',
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }
    if (message.type === 'action') {
      if (message.action === 'copy') {
        await vscode.env.clipboard.writeText(message.text);
        void vscode.window.showInformationMessage(uiCopy(vscode.env.language).ocr.copied);
      } else {
        await this.insertAtTarget(message.text, target);
      }
      return;
    }
    if (message.type === 'error') {
      void vscode.window.showErrorMessage(
        fillTemplate(uiCopy(vscode.env.language).ocr.errorPrefix, { message: message.message }),
      );
    }
  }

  private async insertAtTarget(text: string, target: InsertTarget | undefined): Promise<void> {
    const fallback = vscode.window.activeTextEditor;
    const resolved = target ?? (fallback ? { uri: fallback.document.uri, position: fallback.selection.active } : undefined);
    if (!resolved) {
      void vscode.window.showWarningMessage(uiCopy(vscode.env.language).ocr.noEditor);
      return;
    }
    const document = await vscode.workspace.openTextDocument(resolved.uri);
    const line = Math.min(resolved.position.line, Math.max(0, document.lineCount - 1));
    const character = Math.min(resolved.position.character, document.lineAt(line).text.length);
    const position = new vscode.Position(line, character);
    const edit = new vscode.WorkspaceEdit();
    edit.insert(resolved.uri, position, text);
    if (!await vscode.workspace.applyEdit(edit)) {
      void vscode.window.showErrorMessage(uiCopy(vscode.env.language).ocr.insertFailed);
      return;
    }
    const editor = await vscode.window.showTextDocument(document, { preview: false });
    const end = document.positionAt(document.offsetAt(position) + text.length);
    editor.selection = new vscode.Selection(end, end);
  }

  private async removeTemporaryCapture(): Promise<void> {
    const path = this.temporaryCapture;
    this.temporaryCapture = undefined;
    if (path) await rm(path, { force: true }).catch(() => undefined);
  }
}
