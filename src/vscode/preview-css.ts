import * as vscode from 'vscode';

import { COMMAND_NS } from '../core/channel';
import { parsePreviewCss, PREVIEW_CSS_TEMPLATE, PREVIEW_CSS_GUIDE, PREVIEW_CSS_OPTIONS } from '../core/previewCss';
export { PREVIEW_CSS_OPTIONS } from '../core/previewCss';

export const previewCssCompletions: vscode.CompletionItemProvider = {
  provideCompletionItems(document, position) {
    const before = document.lineAt(position.line).text.slice(0, position.character);
    if (before.includes('/*') && !before.includes('*/')) return [];
    const property = /([\w-]+)\s*:\s*[^;{}]*$/.exec(before)?.[1];
    if (property) {
      const option = PREVIEW_CSS_OPTIONS.find(([name]) => name === property);
      return option?.[1].map((value) => {
        const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.Value);
        item.documentation = option[2];
        item.range = document.getWordRangeAtPosition(position, /[\w.%()-]+/) ?? new vscode.Range(position, position);
        return item;
      }) ?? [];
    }
    return PREVIEW_CSS_OPTIONS.map(([name, values, description]) => {
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Property);
      item.insertText = new vscode.SnippetString(`${name}: \${1:${values[0]}};`);
      item.documentation = description;
      item.range = document.getWordRangeAtPosition(position, /[\w-]+/) ?? new vscode.Range(position, position);
      return item;
    });
  },
};

export const previewCssHover: vscode.HoverProvider = {
  provideHover(document, position) {
    const range = document.getWordRangeAtPosition(position, /[\w-]+/);
    const name = range && document.getText(range);
    const option = PREVIEW_CSS_OPTIONS.find(([property]) => property === name);
    return option ? new vscode.Hover(option[2], range) : undefined;
  },
};

/** 只在点击入口后补齐帮助；已有声明与注释保持原样，所有新示例都是注释。 */
export function withAdvancedPreviewCssExamples(source: string): string {
  const examples = PREVIEW_CSS_OPTIONS.map(([name, values, description]) => {
    const help = `  /* ${description.replaceAll('\n', '\n   * ')} */`;
    if (source.includes(help.trim())) return '';
    return source.includes(name) ? help : `${help}\n  /* ${name}: ${values[0]}; */`;
  }).filter(Boolean).join('\n\n');
  const guide = source.includes(PREVIEW_CSS_GUIDE) ? '' : `${PREVIEW_CSS_GUIDE}\n`;
  if (!examples && !guide) return source;
  const selector = [...source.matchAll(/\/\*[\s\S]*?\*\/|\.silk-math-preview\s*\{/g)].find(([match]) => match.startsWith('.silk-math-preview'));
  const offset = selector ? selector.index! + selector[0].length : 0;
  const result = `${guide}${source.slice(0, offset)}\n${examples}\n${source.slice(offset)}`;
  if (result.length > 8192) throw new Error('说明加入后超过 8192 字符，请先删除不需要的注释。 / Guide exceeds 8192 characters; remove unused comments first.');
  return result;
}

/** 原生 CSS 编辑标签，Ctrl/Cmd+S 写回用户设置；不创建项目文件或常驻 Webview。 */
export class PreviewCssFileSystem implements vscode.FileSystemProvider, vscode.Disposable {
  public readonly uri = vscode.Uri.from({ scheme: `${COMMAND_NS.toLowerCase()}-css`, path: '/preview.css' });
  private readonly changes = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  public readonly onDidChangeFile = this.changes.event;
  private modified = Date.now();
  private pending: string | undefined;
  private readonly subscription = vscode.workspace.onDidChangeConfiguration((event) => {
    if (!event.affectsConfiguration(`${COMMAND_NS}.previewCss`)) return;
    if (this.pending !== undefined) {
      if (vscode.workspace.getConfiguration(COMMAND_NS).get('previewCss') !== this.pending) return;
      this.pending = undefined;
    }
    this.modified = Date.now();
    this.changes.fire([{ type: vscode.FileChangeType.Changed, uri: this.uri }]);
  });

  public dispose(): void { this.subscription.dispose(); this.changes.dispose(); }
  public watch(): vscode.Disposable { return new vscode.Disposable(() => {}); }
  public stat(uri = this.uri): vscode.FileStat {
    if (uri.path === '/') return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
    return { type: vscode.FileType.File, ctime: 0, mtime: this.modified, size: this.readFile(uri).byteLength };
  }
  public readFile(uri = this.uri): Uint8Array {
    if (uri.toString() !== this.uri.toString()) throw vscode.FileSystemError.FileNotFound(uri);
    const value = this.pending ?? vscode.workspace.getConfiguration(COMMAND_NS).inspect<string>('previewCss')?.globalValue;
    return Buffer.from(typeof value === 'string' ? value : PREVIEW_CSS_TEMPLATE, 'utf8');
  }
  public async writeFile(uri: vscode.Uri, content: Uint8Array): Promise<void> {
    if (uri.toString() !== this.uri.toString()) throw vscode.FileSystemError.NoPermissions(uri);
    const value = Buffer.from(content).toString('utf8');
    try { parsePreviewCss(value); }
    catch (error) { throw vscode.FileSystemError.Unavailable(error instanceof Error ? error.message : String(error)); }
    this.pending = value;
    try { await vscode.workspace.getConfiguration(COMMAND_NS).update('previewCss', value, vscode.ConfigurationTarget.Global); }
    catch (error) { this.pending = undefined; throw error; }
    this.modified = Math.max(Date.now(), this.modified + 1);
    this.changes.fire([{ type: vscode.FileChangeType.Changed, uri: this.uri }]);
  }
  public readDirectory(): [string, vscode.FileType][] { return [['preview.css', vscode.FileType.File]]; }
  public createDirectory(): never { throw vscode.FileSystemError.NoPermissions(); }
  public delete(): never { throw vscode.FileSystemError.NoPermissions(); }
  public rename(): never { throw vscode.FileSystemError.NoPermissions(); }
}

let provider: PreviewCssFileSystem | undefined;
export async function openPreviewCss(context: vscode.ExtensionContext): Promise<void> {
  if (!provider) {
    provider = new PreviewCssFileSystem();
    context.subscriptions.push(provider, vscode.workspace.registerFileSystemProvider(provider.uri.scheme, provider, { isCaseSensitive: true }),
      vscode.languages.registerCompletionItemProvider({ scheme: provider.uri.scheme, language: 'css' }, previewCssCompletions, '-', ':'),
      vscode.languages.registerHoverProvider({ scheme: provider.uri.scheme, language: 'css' }, previewCssHover),
      vscode.languages.registerCodeLensProvider({ scheme: provider.uri.scheme, language: 'css' }, {
        provideCodeLenses: () => [new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), { title: '参数说明与示例 / Guide & examples', command: `${COMMAND_NS}.previewCssOptions` })],
      }),
      vscode.commands.registerCommand(`${COMMAND_NS}.previewCssOptions`, async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.toString() !== provider?.uri.toString()) return;
        const source = editor.document.getText();
        let updated: string;
        try { updated = withAdvancedPreviewCssExamples(source); }
        catch (error) { await vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error)); return; }
        if (source === updated) return;
        await editor.edit((edit) => edit.replace(new vscode.Range(editor.document.positionAt(0), editor.document.positionAt(source.length)), updated));
      }),
      new vscode.Disposable(() => { provider = undefined; }));
  }
  const document = await vscode.workspace.openTextDocument(provider.uri);
  await vscode.window.showTextDocument(document, { preview: false });
}
