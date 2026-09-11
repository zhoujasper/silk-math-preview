import * as vscode from 'vscode';

import { cmd, PRODUCT_NAME } from './core/channel';
import { DefinitionWorkspace } from './vscode/definitionWorkspace';
import { FileExclusions } from './vscode/fileExclusions';
import { registerLanguageFeatures } from './vscode/languageFeatures';
import { registerOcr } from './vscode/ocrActivation';
import { PreviewController } from './vscode/previewController';
import { StatusController } from './vscode/statusController';
import { TikzService } from './vscode/tikzService';

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel(PRODUCT_NAME);
  const definitions = new DefinitionWorkspace(context);
  const exclusions = new FileExclusions(context.workspaceState);
  const status = new StatusController(context, exclusions);
  const preview = new PreviewController(
    definitions,
    context.asAbsolutePath('dist/render-worker.js'),
    status,
    output,
    new TikzService(context),
  );
  const ocr = registerOcr(context);

  context.subscriptions.push(
    output,
    definitions,
    exclusions,
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

  registerLanguageFeatures(context, definitions, exclusions);
}
