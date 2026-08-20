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
 * 状态栏点击弹出的紧凑设置卡片，放在右侧辅助栏。
 * 关闭后释放 webview 文档，不在浮层里重复渲染公式 SVG。
 */
export class ControlPanelProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = 'silkMath.controlPanel';

  private view: vscode.WebviewView | undefined;
  private latest: PreviewSnapshotEvent = { status: 'idle' };
  private lastPosted = '';
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

  public async toggle(): Promise<void> {
    if (this.visible) {
      await vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');
      return;
    }
    await vscode.commands.executeCommand(`${ControlPanelProvider.viewType}.focus`);
  }

  /** 每次预览渲染后调用；面板没打开时只记录，不做任何工作。 */
  public update(snapshot: PreviewSnapshotEvent): void {
    this.latest = snapshot;
    if (this.view?.visible) this.post();
  }

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.title = 'Silk Math';
    webviewView.description = '实时预览';
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [] };
    webviewView.webview.html = this.html();
    webviewView.webview.onDidReceiveMessage((message: PanelMessage) => {
      void this.handle(message);
    }, undefined, this.disposables);
    webviewView.onDidChangeVisibility(() => {
      void vscode.commands.executeCommand('setContext', 'silkMath.flyoutVisible', webviewView.visible);
      if (webviewView.visible) {
        this.lastPosted = '';
        this.post();
      }
    }, undefined, this.disposables);
    webviewView.onDidDispose(() => {
      if (this.view === webviewView) this.view = undefined;
      void vscode.commands.executeCommand('setContext', 'silkMath.flyoutVisible', false);
    }, undefined, this.disposables);
    void vscode.commands.executeCommand('setContext', 'silkMath.flyoutVisible', webviewView.visible);
    this.lastPosted = '';
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
      case 'close':
        await vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');
        return;
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
    const payload = {
      type: 'state',
      status: this.latest.status,
      fileName: this.latest.fileName,
      line: this.latest.line,
      message: this.latest.message,
      renderMs: this.latest.renderMs,
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
    };
    const encoded = JSON.stringify(payload);
    if (encoded === this.lastPosted) return;
    this.lastPosted = encoded;
    void view.webview.postMessage(payload);
  }

  private html(): string {
    const csp = nonce();
    return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${csp}'; script-src 'nonce-${csp}';">
<style nonce="${csp}">
  :root { color-scheme: light dark; }
  html, body { height: 100%; }
  body {
    margin: 0; padding: 10px;
    font-family: var(--vscode-font-family);
    font-size: 12px;
    color: var(--vscode-foreground);
    background: transparent;
  }
  .card {
    display: flex; flex-direction: column; gap: 12px;
    padding: 12px 12px 10px;
    border-radius: 10px;
    background: var(--vscode-editorHoverWidget-background, var(--vscode-sideBar-background));
    border: 1px solid var(--vscode-editorHoverWidget-border, var(--vscode-widget-border, transparent));
    box-shadow: 0 8px 24px rgba(0,0,0,.18);
    animation: silk-in 160ms cubic-bezier(.2,.8,.2,1) both;
    contain: layout paint;
  }
  @keyframes silk-in {
    from { opacity: 0; transform: translateY(8px) scale(.98); }
    to { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .card { animation: none; }
    .chip, .icon, .ghost, .slider { transition: none !important; }
  }
  .hdr { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .brand { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .mark {
    width: 22px; height: 22px; border-radius: 6px; flex: none;
    display: grid; place-items: center;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    font-weight: 700; font-size: 13px;
  }
  .title { font-size: 13px; font-weight: 600; line-height: 1.2; }
  .sub { color: var(--vscode-descriptionForeground); font-size: 11px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .badge {
    flex: none; font-size: 11px; font-weight: 600;
    padding: 3px 8px; border-radius: 999px;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    transition: background 140ms ease, color 140ms ease;
  }
  .badge.on { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  .badge.warn { background: var(--vscode-inputValidation-warningBackground, transparent); }
  .sec { display: flex; flex-direction: column; gap: 8px; }
  .label {
    display: flex; align-items: center; justify-content: space-between;
    color: var(--vscode-descriptionForeground); font-size: 11px; letter-spacing: .02em;
  }
  .value { font-variant-numeric: tabular-nums; color: var(--vscode-foreground); font-weight: 600; }
  .slider-row { display: flex; align-items: center; gap: 6px; }
  .icon, .ghost, .chip {
    font-family: inherit; cursor: pointer;
    border: 1px solid transparent; border-radius: 6px;
    transition: background 120ms ease, transform 80ms ease, border-color 120ms ease, opacity 120ms ease;
  }
  .icon, .ghost, .chip { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
  .icon:hover, .ghost:hover, .chip:hover { background: var(--vscode-button-secondaryHoverBackground); }
  .icon:active, .ghost:active, .chip:active { transform: scale(.96); }
  .icon { min-width: 26px; height: 24px; padding: 0 7px; font-weight: 600; }
  .ghost { height: 26px; padding: 0 9px; font-size: 11px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    height: 26px; padding: 0 10px; border-radius: 999px; font-size: 11px;
    border-color: var(--vscode-widget-border, transparent);
  }
  .chip.on, .ghost.on {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-color: transparent;
  }
  .chip.on:hover, .ghost.on:hover { background: var(--vscode-button-hoverBackground); }
  input[type=range] {
    flex: 1; height: 4px; margin: 0; accent-color: var(--vscode-button-background);
  }
  .actions { display: flex; flex-wrap: wrap; gap: 6px; }
  .foot {
    display: flex; flex-wrap: wrap; gap: 6px;
    padding-top: 2px;
    border-top: 1px solid var(--vscode-widget-border, transparent);
  }
  .warn { color: var(--vscode-errorForeground); }
  button:disabled { opacity: .45; cursor: default; transform: none; }
</style>
</head>
<body>
  <div class="card">
    <div class="hdr">
      <div class="brand">
        <div class="mark">∫</div>
        <div>
          <div class="title">Silk Math</div>
          <div class="sub" id="sub">把光标放进公式即可预览</div>
        </div>
      </div>
      <span class="badge" id="badge">—</span>
    </div>

    <div class="sec">
      <div class="label"><span>预览大小</span><span class="value" id="percent">100%</span></div>
      <div class="slider-row">
        <button class="icon" id="minus" title="缩小 5%">−</button>
        <input type="range" id="slider" min="50" max="300" step="5">
        <button class="icon" id="plus" title="放大 5%">+</button>
        <button class="icon" id="reset" title="恢复默认">↺</button>
      </div>
    </div>

    <div class="sec">
      <div class="label"><span>启用范围</span></div>
      <div class="chips">
        <button class="chip" id="latex">LaTeX / TeX</button>
        <button class="chip" id="markdown">Markdown</button>
        <button class="chip" id="others">其他类型</button>
      </div>
    </div>

    <div class="sec">
      <div class="label"><span>当前文件</span></div>
      <div class="actions">
        <button class="ghost" id="exclude">排除本文件</button>
        <button class="ghost" id="snooze5">暂停 5 分钟</button>
        <button class="ghost" id="snooze30">暂停 30 分钟</button>
        <button class="ghost" id="resume">恢复预览</button>
      </div>
    </div>

    <div class="foot">
      <button class="ghost" id="ocr">截图识别</button>
      <button class="ghost" id="reload">重载定义</button>
      <button class="ghost" id="diagnose">诊断</button>
      <button class="ghost" id="settings">设置</button>
    </div>
  </div>

<script nonce="${csp}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  const send = (type, value) => vscode.postMessage({ type, value });
  let defaultScale = 1.4;
  $('minus').onclick = () => send('scale', -0.05 * defaultScale);
  $('plus').onclick = () => send('scale', 0.05 * defaultScale);
  $('reset').onclick = () => send('resetScale');
  $('slider').oninput = (event) => { $('percent').textContent = event.target.value + '%'; };
  $('slider').onchange = (event) => send('scaleTo', Number(event.target.value) / 100 * defaultScale);
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
    defaultScale = Number(state.defaultScale) || 1.4;
    const percent = Math.round(state.scale / defaultScale * 100);
    $('slider').min = String(Math.round(state.minScale / defaultScale * 100));
    $('slider').max = String(Math.round(state.maxScale / defaultScale * 100));
    $('slider').value = String(percent);
    $('percent').textContent = percent + '%';
    $('reset').title = '恢复默认 100%';
    $('latex').classList.toggle('on', !!state.enableInLatex);
    $('markdown').classList.toggle('on', !!state.enableInMarkdown);
    $('others').classList.toggle('on', !!state.enableInOtherFiles);
    $('exclude').classList.toggle('on', !!state.excluded);
    $('exclude').textContent = state.excluded ? '取消排除' : '排除本文件';
    $('exclude').disabled = !state.hasDocument;
    $('resume').style.display = state.snoozed ? '' : 'none';
    $('snooze5').style.display = state.snoozed ? 'none' : '';
    $('snooze30').style.display = state.snoozed ? 'none' : '';
    $('ocr').style.display = state.ocrEnabled ? '' : 'none';

    const badge = $('badge');
    const sub = $('sub');
    const where = state.fileName
      ? state.fileName + (state.line ? ' · ' + state.line : '')
      : '';
    if (state.snoozed) {
      badge.textContent = '已暂停';
      badge.className = 'badge warn';
      sub.textContent = where ? '暂停中 · ' + where : '预览已暂停';
    } else if (state.excluded) {
      badge.textContent = '已排除';
      badge.className = 'badge warn';
      sub.textContent = where || '当前文件已排除';
    } else if (state.status === 'error' || state.status === 'unsupported') {
      badge.textContent = '失败';
      badge.className = 'badge warn';
      sub.textContent = state.message || '当前公式无法渲染';
      sub.className = 'sub warn';
      return;
    } else {
      badge.textContent = '已启用';
      badge.className = 'badge on';
      const timing = state.status === 'ok' && state.renderMs !== undefined
        ? ' · ' + Number(state.renderMs).toFixed(1) + ' ms'
        : '';
      sub.textContent = (where || '把光标放进公式即可预览') + timing;
    }
    sub.className = 'sub';
  });
</script>
</body>
</html>`;
  }
}
