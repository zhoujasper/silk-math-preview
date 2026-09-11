import * as vscode from 'vscode';
import { cmd, COMMAND_NS, IS_TEST_CHANNEL } from '../core/channel';
import type { OcrController } from './ocrController';

/** Register cheap command/paste routes; load capture, downloads and OCR only on demand. */
export function registerOcr(context: vscode.ExtensionContext): vscode.Disposable {
  let controller: OcrController | undefined;
  let disposed = false;
  const load = (): OcrController => controller ??= new (
    require('./ocr-controller') as typeof import('./ocrController')).OcrController(context);
  const subscriptions = (['capture', 'paste', 'openImage', 'open'] as const).map(action =>
    vscode.commands.registerCommand(cmd(`ocr.${action}`), () => {
      if (disposed) return;
      const ocr = load();
      return action === 'open' ? ocr.showInput() : ocr.launch(action === 'openImage' ? 'file' : action);
    }));
  if (vscode.languages.registerDocumentPasteEditProvider && vscode.DocumentDropOrPasteEditKind) {
    const kind = vscode.DocumentDropOrPasteEditKind.Text.append(COMMAND_NS, 'latex');
    subscriptions.push(vscode.languages.registerDocumentPasteEditProvider(
      ['latex', 'tex', 'markdown', 'mdx'].map(language => ({ language })), {
        provideDocumentPasteEdits: (_document, _ranges, data, _context, token) => {
          const config = vscode.workspace.getConfiguration(COMMAND_NS);
          if (disposed || token.isCancellationRequested || !config.get('ocr.enabled', true)
            || !config.get('ocr.pasteImages', !IS_TEST_CHANNEL)
            || !(data.get('image/png') ?? data.get('image/jpeg'))?.asFile()) return;
          return load().provideImagePaste(data, token, kind);
        },
      }, { providedPasteEditKinds: [kind], pasteMimeTypes: ['image/png', 'image/jpeg'] },
    ));
  }
  return new vscode.Disposable(() => {
    disposed = true;
    controller?.dispose();
    for (const item of subscriptions) item.dispose();
  });
}
