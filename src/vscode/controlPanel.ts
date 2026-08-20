import * as vscode from 'vscode';

import { DEFAULT_SCALE, MAX_SCALE, MIN_SCALE, type StatusController } from './statusController';

/** 面板要展示的一帧状态；由预览控制器在每次渲染后推过来。 */
export interface PreviewSnapshotEvent {
  readonly status: 'ok' | 'error' | 'unsupported' | 'idle';
  readonly fileName?: string;
  readonly line?: number;
  readonly regionKind?: string;
  readonly message?: string;
  readonly svg?: string;
  readonly renderMs?: number;
}

interface PanelMessage {
  readonly type: string;
  readonly value?: unknown;
}

function nonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let index = 0; index < 32; index += 1) {
    text += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return text;
}

/**
 * 自己渲染的控制面板：点击状态栏打开/关闭，编辑时实时刷新当前公式。
 * VS Code 不允许扩展用点击打开状态栏悬浮框，所以这里用 webview view 做一个真正
 * 可交互、可常驻、能实时更新的面板。
 */
export class ControlPanelProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = 'silkMath.controlPanel';

  private view: vscode.WebviewView | undefined;
  private latest: PreviewSnapshotEvent = { status: 'idle' };
  private readonly disposables: vscode.Disposable[] = [];

  public constructor(
    private readonly status: StatusController,
    private readonly actions: {
      reloadDefinitions(): void;
      diagnose(): Promise<string>;
    },
  ) {
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('silkMath')) this.post();
      }),
      this.status.onDidChange(() => this.post()),
    );
  }

  public dispose(): void {
    for (const disposable of this.disposables) disposable.dispose();
  }

  public get visible(): boolean {
    return this.view?.visible === true;
  }

  /** 每次预览渲染后调用；面板没打开时只记录，不做任何工作。 */
  public update(snapshot: PreviewSnapshotEvent): void {
    this.latest = snapshot;
    if (this.view?.visible) this.post();
  }

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [] };
    webviewView.webview.html = this.html(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message: PanelMessage) => {
      void this.handle(message);
    }, undefined, this.disposables);
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) this.post();
    }, undefined, this.disposables);
    this.post();
  }

  private async handle(message: PanelMessage): Promise<void> {
    switch (message.type) {
      case 'scale':
        await this.status.adjustPreviewScale(Number(message.value) || 0);
        break;
      case 'scaleTo':
        await this.status.setPreviewScale(Number(message.value));
        break;
      case 'resetScale':
        await this.status.resetPreviewScale();
        break;
      case 'toggle':
        await vscode.commands.executeCommand('silkMath.toggleLanguage', message.value);
        break;
      case 'exclude':
        await vscode.commands.executeCommand('silkMath.toggleExcludeFile');
        break;
      case 'snooze':
        await vscode.commands.executeCommand('silkMath.snooze', Number(message.value) || 0);
        break;
      case 'ocr':
        await vscode.commands.executeCommand('silkMath.ocr.capture');
        break;
      case 'settings':
        await vscode.commands.executeCommand('silkMath.openSettings');
        break;
      case 'reload':
        this.actions.reloadDefinitions();
        break;
      case 'diagnose':
        await vscode.commands.executeCommand('silkMath.diagnoseFormula');
        break;
      default:
        break;
    }
    this.post();
  }

  private post(): void {
    const view = this.view;
    if (!view?.visible) return;
    const document = vscode.window.activeTextEditor?.document;
    const config = vscode.workspace.getConfiguration('silkMath', document?.uri);
    void view.webview.postMessage({
      type: 'state',
      snapshot: this.latest,
      scale: this.status.previewScaleValue(document?.uri),
      minScale: MIN_SCALE,
      maxScale: MAX_SCALE,
      defaultScale: DEFAULT_SCALE,
      enableInLatex: config.get('enableInLatex', true),
      enableInMarkdown: config.get('enableInMarkdown', true),
      enableInOtherFiles: config.get('enableInOtherFiles', false),
      excluded: document !== undefined && this.status.isExcluded(document.uri),
      snoozed: this.status.isSnoozed(),
      hasDocument: document !== undefined,
      ocrEnabled: config.get('ocr.enabled', true),
    });
  }

  private html(webview: vscode.Webview): string {
    const csp = nonce();
    return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src 'nonce-${csp}'; script-src 'nonce-${csp}';">
<style nonce="${csp}">
  :root { color-scheme: light dark; }
  body {
    margin: 0; padding: 10px 12px 14px;
    font-family: var(--vscode-font-family); font-size: var(--vscode-font-size);
    color: var(--vscode-foreground); background: transparent;
  }
  .row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .row + .row { margin-top: 10px; }
  .label { min-width: 5.2em; color: var(--vscode-descriptionForeground); }
  .stage {
    display: flex; align-items: center; justify-content: center;
    min-height: 76px; padding: 12px 14px; border-radius: 8px; overflow: auto;
    background: var(--vscode-editorHoverWidget-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-editorHoverWidget-border, transparent);
  }
  .stage svg { max-width: 100%; height: auto; }
  .muted { color: var(--vscode-descriptionForeground); font-style: italic; }
  .warn { color: var(--vscode-editorWarning-foreground); }
  .meta { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 8px;
          color: var(--vscode-descriptionForeground); font-size: 0.92em; }
  button {
    font-family: inherit; font-size: 0.94em; color: var(--vscode-button-secondaryForeground);
    background: var(--vscode-button-secondaryBackground); border: none; border-radius: 4px;
    padding: 3px 10px; cursor: pointer;
  }
  button:hover { background: var(--vscode-button-secondaryHoverBackground); }
  button.on { color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
  button.on:hover { background: var(--vscode-button-hoverBackground); }
  button.icon { min-width: 26px; padding: 3px 8px; font-weight: 600; }
  input[type=range] { flex: 1; min-width: 90px; accent-color: var(--vscode-button-background); }
  .value { min-width: 3.4em; text-align: right; font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
  <div class="meta"><span id="where">—</span><span id="timing"></span></div>
  <div class="stage" id="stage"><span class="muted">把光标移进公式即可预览 / Put the caret inside a formula</span></div>

  <div class="row">
    <span class="label">预览大小</span>
    <button class="icon" id="minus" title="缩小 5%">−</button>
    <input type="range" id="slider" min="50" max="300" step="5">
    <button class="icon" id="plus" title="放大 5%">+</button>
    <span class="value" id="percent">110%</span>
    <button id="reset" title="恢复默认">↺</button>
  </div>

  <div class="row">
    <span class="label">启用范围</span>
    <button id="latex">LaTeX / TeX</button>
    <button id="markdown">Markdown</button>
    <button id="others">其他类型</button>
  </div>

  <div class="row">
    <span class="label">当前文件</span>
    <button id="exclude">排除本文件</button>
    <button id="snooze5">暂停 5 分钟</button>
    <button id="snooze30">暂停 30 分钟</button>
    <button id="resume">恢复</button>
  </div>

  <div class="row">
    <span class="label">更多</span>
    <button id="ocr">截图识别</button>
    <button id="reload">重载定义</button>
    <button id="diagnose">诊断当前公式</button>
    <button id="settings">设置</button>
  </div>

<script nonce="${csp}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  const send = (type, value) => vscode.postMessage({ type, value });

  $('minus').onclick = () => send('scale', -0.05);
  $('plus').onclick = () => send('scale', 0.05);
  $('reset').onclick = () => send('resetScale');
  $('slider').oninput = (event) => { $('percent').textContent = event.target.value + '%'; };
  $('slider').onchange = (event) => send('scaleTo', Number(event.target.value) / 100);
  $('latex').onclick = () => send('toggle', 'enableInLatex');
  $('markdown').onclick = () => send('toggle', 'enableInMarkdown');
  $('others').onclick = () => send('toggle', 'enableInOtherFiles');
  $('exclude').onclick = () => send('exclude');
  $('snooze5').onclick = () => send('snooze', 5);
  $('snooze30').onclick = () => send('snooze', 30);
  $('resume').onclick = () => send('snooze', 0);
  $('ocr').onclick = () => send('ocr');
  $('reload').onclick = () => send('reload');
  $('diagnose').onclick = () => send('diagnose');
  $('settings').onclick = () => send('settings');

  window.addEventListener('message', (event) => {
    const state = event.data;
    if (!state || state.type !== 'state') return;
    const percent = Math.round(state.scale * 100);
    $('slider').min = Math.round(state.minScale * 100);
    $('slider').max = Math.round(state.maxScale * 100);
    $('slider').value = percent;
    $('percent').textContent = percent + '%';
    $('reset').title = '恢复默认 ' + Math.round(state.defaultScale * 100) + '%';
    $('latex').className = state.enableInLatex ? 'on' : '';
    $('markdown').className = state.enableInMarkdown ? 'on' : '';
    $('others').className = state.enableInOtherFiles ? 'on' : '';
    $('exclude').className = state.excluded ? 'on' : '';
    $('exclude').textContent = state.excluded ? '取消排除' : '排除本文件';
    $('exclude').disabled = !state.hasDocument;
    $('resume').style.display = state.snoozed ? '' : 'none';
    $('snooze5').style.display = state.snoozed ? 'none' : '';
    $('snooze30').style.display = state.snoozed ? 'none' : '';
    $('ocr').style.display = state.ocrEnabled ? '' : 'none';

    const snapshot = state.snapshot || { status: 'idle' };
    const where = snapshot.fileName
      ? snapshot.fileName + (snapshot.line ? ' · 行 ' + snapshot.line : '')
      : '—';
    $('where').textContent = state.snoozed ? '已暂停 · ' + where : where;
    $('timing').textContent = snapshot.status === 'ok' && snapshot.renderMs !== undefined
      ? snapshot.renderMs.toFixed(1) + ' ms'
      : '';
    const stage = $('stage');
    if (snapshot.status === 'ok' && snapshot.svg) {
      stage.innerHTML = snapshot.svg;
    } else if (snapshot.status === 'error' || snapshot.status === 'unsupported') {
      stage.innerHTML = '';
      const span = document.createElement('span');
      span.className = 'warn';
      span.textContent = '⚠ ' + (snapshot.message || '无法渲染');
      stage.appendChild(span);
    } else {
      stage.innerHTML = '';
      const span = document.createElement('span');
      span.className = 'muted';
      span.textContent = '把光标移进公式即可预览 / Put the caret inside a formula';
      stage.appendChild(span);
    }
  });
</script>
</body>
</html>`;
  }
}
