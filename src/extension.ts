import * as vscode from 'vscode';

import { cmd, PRODUCT_NAME } from './core/channel';
import { DefinitionWorkspace } from './vscode/definitionWorkspace';
import { registerLanguageFeatures } from './vscode/languageFeatures';
import { OcrController } from './vscode/ocrController';
import { PreviewController } from './vscode/previewController';
import { StatusController } from './vscode/statusController';

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel(PRODUCT_NAME);
  const definitions = new DefinitionWorkspace(context);
  const status = new StatusController(context);
  const preview = new PreviewController(
    definitions,
    context.asAbsolutePath('dist/render-worker.js'),
    status,
    output,
  );
  const ocr = new OcrController(context, preview);

  context.subscriptions.push(
    output,
    definitions,
    status,
    preview,
    ocr,
    vscode.commands.registerCommand(cmd('togglePreview'), () => {
      const enabled = preview.toggle();
      void vscode.window.showInformationMessage(`${PRODUCT_NAME} 实时预览已${enabled ? '开启' : '暂停'}。`);
    }),
    vscode.commands.registerCommand(cmd('dismissPreview'), () => {
      preview.dismiss();
    }),
    vscode.commands.registerCommand(cmd('reloadDefinitions'), () => {
      definitions.reload();
      preview.refresh();
      void vscode.window.showInformationMessage(`${PRODUCT_NAME} 已重新索引当前文档可达的宏和环境。`);
    }),
    vscode.commands.registerCommand(cmd('diagnoseFormula'), async () => {
      output.appendLine(await preview.diagnose());
      output.show(true);
    }),
    vscode.commands.registerCommand(cmd('showPerformance'), () => {
      const stats = preview.stats();
      output.appendLine(JSON.stringify({
        time: new Date().toISOString(),
        ...stats,
      }, null, 2));
      output.show(true);
    }),
  );

  registerLanguageFeatures(context, definitions);
}
