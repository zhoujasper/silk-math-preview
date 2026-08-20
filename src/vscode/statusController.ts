import * as vscode from 'vscode';

export type PreviewLanguage = 'latex' | 'markdown';

const EXCLUDED_FILES_KEY = 'silkMath.excludedFiles';
const SNOOZE_CHOICES: ReadonlyArray<{ readonly minutes: number; readonly label: string }> = [
  { minutes: 5, label: '5 分钟' },
  { minutes: 30, label: '30 分钟' },
];

/** 预览缩放：与 package.json 的取值范围保持一致。 */
export const MIN_SCALE = 0.5;
export const MAX_SCALE = 3;
export const DEFAULT_SCALE = 1.1;
const SCALE_STEP = 0.05;
const SCALE_GAUGE_CELLS = 10;

interface MenuItem extends vscode.QuickPickItem {
  readonly run?: () => unknown;
}

function isLatex(document: vscode.TextDocument): boolean {
  return document.languageId === 'latex' || document.languageId === 'tex';
}

function isMarkdown(document: vscode.TextDocument): boolean {
  return document.languageId === 'markdown' || document.languageId === 'mdx';
}

function documentKey(uri: vscode.Uri): string {
  return uri.toString();
}

function formatClock(time: number): string {
  return new Date(time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** 悬浮框里的命令链接；参数按 command URI 规范编码。 */
function link(label: string, command: string, args?: unknown[], tooltip?: string): string {
  const query = args ? `?${encodeURIComponent(JSON.stringify(args))}` : '';
  const title = tooltip ? ` "${tooltip}"` : '';
  return `[${label}](command:${command}${query}${title})`;
}

/**
 * 状态栏入口：左边一个截图图标直接进 OCR，右边的插件名承载悬浮设置面板。
 * 面板用可信 MarkdownString + command 链接实现，风格与 Copilot 的状态栏面板一致，
 * 不用把用户拽到顶部的命令面板。
 */
export class StatusController implements vscode.Disposable {
  private readonly captureItem: vscode.StatusBarItem;
  private readonly item: vscode.StatusBarItem;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  private snoozeUntil = 0;
  private snoozeTimer: NodeJS.Timeout | undefined;

  /** 策略变化（文件类型开关、暂停、排除、缩放）时触发，预览据此重画。 */
  public readonly onDidChange = this.changeEmitter.event;

  public constructor(private readonly context: vscode.ExtensionContext) {
    this.captureItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 25);
    this.captureItem.name = 'Silk Math 截图识别';
    this.captureItem.text = '$(screen-full)';
    this.captureItem.tooltip = '截图识别公式或文字（本地运行，不上传）';
    this.captureItem.command = 'silkMath.ocr.capture';

    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 24);
    this.item.name = 'Silk Math';
    // VS Code 只给扩展开放了 MarkdownString tooltip 这一种状态栏浮层，没有 API 能用点击打开它，
    // 所以浮层靠悬停出现；点击退回等价的列表菜单，至少不是一个点不动的死条目。
    // 点击打开自绘的控制面板（webview view）：可常驻、可交互、编辑时实时刷新。
    this.item.command = 'silkMath.togglePanel';

    this.disposables.push(
      this.captureItem,
      this.item,
      this.changeEmitter,
      vscode.commands.registerCommand('silkMath.showMenu', () => this.showMenu()),
      vscode.commands.registerCommand('silkMath.increasePreviewScale', () => this.adjustPreviewScale(SCALE_STEP)),
      vscode.commands.registerCommand('silkMath.decreasePreviewScale', () => this.adjustPreviewScale(-SCALE_STEP)),
      vscode.commands.registerCommand('silkMath.resetPreviewScale', () => this.resetPreviewScale()),
      vscode.commands.registerCommand('silkMath.toggleLanguage', (key: unknown) => this.toggleLanguage(key)),
      vscode.commands.registerCommand('silkMath.toggleExcludeFile', () => this.toggleExcludeFile()),
      vscode.commands.registerCommand('silkMath.snooze', (minutes: unknown) => {
        if (typeof minutes === 'number' && minutes > 0) this.snooze(minutes);
        else this.resume();
      }),
      vscode.commands.registerCommand('silkMath.openSettings', () =>
        vscode.commands.executeCommand('workbench.action.openSettings', 'silkMath')),
      vscode.window.onDidChangeActiveTextEditor(() => this.refresh()),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('silkMath')) this.refresh();
      }),
    );
    this.refresh();
  }

  public dispose(): void {
    if (this.snoozeTimer) clearTimeout(this.snoozeTimer);
    for (const disposable of this.disposables) disposable.dispose();
  }

  /** 该文档按什么语法扫描；返回 undefined 表示这里不做预览。 */
  public previewLanguage(document: vscode.TextDocument): PreviewLanguage | undefined {
    if (this.isSnoozed() || this.isExcluded(document.uri)) return undefined;
    const config = vscode.workspace.getConfiguration('silkMath', document.uri);
    if (isLatex(document)) return config.get('enableInLatex', true) ? 'latex' : undefined;
    if (isMarkdown(document)) return config.get('enableInMarkdown', true) ? 'markdown' : undefined;
    // 其他类型按 LaTeX 语法扫描：纯文本笔记里写 `$...$` 的用法很常见。
    return config.get('enableInOtherFiles', false) ? 'latex' : undefined;
  }

  public isExcluded(uri: vscode.Uri): boolean {
    return this.excludedFiles().includes(documentKey(uri));
  }

  public isSnoozed(): boolean {
    return this.snoozeUntil > Date.now();
  }

  public async adjustPreviewScale(delta: number): Promise<number> {
    const uri = vscode.window.activeTextEditor?.document.uri;
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round((this.previewScale(uri) + delta) * 100) / 100));
    await this.updateSetting('previewScale', next);
    return next;
  }

  public async resetPreviewScale(): Promise<number> {
    await this.updateSetting('previewScale', DEFAULT_SCALE);
    return DEFAULT_SCALE;
  }

  /** 控制面板的滑块直接给绝对值。 */
  public async setPreviewScale(scale: number): Promise<number> {
    const next = Number.isFinite(scale)
      ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(scale * 100) / 100))
      : DEFAULT_SCALE;
    await this.updateSetting('previewScale', next);
    return next;
  }

  public previewScaleValue(uri?: vscode.Uri): number {
    return this.previewScale(uri);
  }

  private previewScale(uri?: vscode.Uri): number {
    const raw = vscode.workspace.getConfiguration('silkMath', uri).get('previewScale', DEFAULT_SCALE);
    if (!Number.isFinite(raw)) return DEFAULT_SCALE;
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(raw)));
  }

  /** 刻度条比单独一个百分数更容易看出当前档位。 */
  private scaleGauge(scale: number): string {
    const filled = Math.round(((scale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE)) * SCALE_GAUGE_CELLS);
    return '▰'.repeat(filled) + '▱'.repeat(Math.max(0, SCALE_GAUGE_CELLS - filled));
  }

  private excludedFiles(): string[] {
    return this.context.workspaceState.get<string[]>(EXCLUDED_FILES_KEY, []);
  }

  private async setExcluded(uri: vscode.Uri, excluded: boolean): Promise<void> {
    const key = documentKey(uri);
    const current = this.excludedFiles().filter((entry) => entry !== key);
    if (excluded) current.push(key);
    await this.context.workspaceState.update(EXCLUDED_FILES_KEY, current);
    this.refresh();
  }

  private async toggleExcludeFile(): Promise<void> {
    const document = vscode.window.activeTextEditor?.document;
    if (!document) return;
    await this.setExcluded(document.uri, !this.isExcluded(document.uri));
  }

  private async toggleLanguage(key: unknown): Promise<void> {
    if (key !== 'enableInLatex' && key !== 'enableInMarkdown' && key !== 'enableInOtherFiles') return;
    const uri = vscode.window.activeTextEditor?.document.uri;
    const fallback = key !== 'enableInOtherFiles';
    const current = vscode.workspace.getConfiguration('silkMath', uri).get(key, fallback);
    await this.updateSetting(key, !current);
  }

  private snooze(minutes: number): void {
    this.snoozeUntil = Date.now() + minutes * 60_000;
    if (this.snoozeTimer) clearTimeout(this.snoozeTimer);
    this.snoozeTimer = setTimeout(() => {
      this.snoozeTimer = undefined;
      this.snoozeUntil = 0;
      this.refresh();
    }, minutes * 60_000);
    this.snoozeTimer.unref?.();
    this.refresh();
  }

  private resume(): void {
    if (this.snoozeTimer) clearTimeout(this.snoozeTimer);
    this.snoozeTimer = undefined;
    this.snoozeUntil = 0;
    this.refresh();
  }

  private refresh(): void {
    const document = vscode.window.activeTextEditor?.document;
    const active = document !== undefined && this.previewLanguage(document) !== undefined;
    if (this.isSnoozed()) this.item.text = '$(debug-pause) Silk Math';
    else if (!active) this.item.text = '$(circle-slash) Silk Math';
    else this.item.text = 'Silk Math';
    this.item.tooltip = this.hoverPanel(document, active);
    this.item.show();
    this.captureItem.show();
    if (!vscode.workspace.getConfiguration('silkMath').get('ocr.enabled', true)) this.captureItem.hide();
    this.changeEmitter.fire();
  }

  /** Copilot 式悬浮面板：状态一眼可见，常用开关就地可点。 */
  private hoverPanel(document: vscode.TextDocument | undefined, active: boolean): vscode.MarkdownString {
    const config = vscode.workspace.getConfiguration('silkMath', document?.uri);
    const scale = this.previewScale(document?.uri);
    const percent = Math.round(scale * 100);
    const mark = (value: boolean): string => (value ? '$(check)' : '$(blank)');
    const excluded = document !== undefined && this.isExcluded(document.uri);

    const lines: string[] = [];
    lines.push('**Silk Math** · 实时公式预览 / Live math preview');
    lines.push('');
    lines.push('<sub>悬停出现本面板，点击是等价的列表菜单。 / Hover shows this panel; click opens the list menu.</sub>');
    lines.push('');
    if (this.isSnoozed()) {
      lines.push(`$(debug-pause) 已暂停到 **${formatClock(this.snoozeUntil)}** — ${link('立即恢复 / Resume', 'silkMath.snooze', [0])}`);
    } else if (excluded) {
      lines.push('$(circle-slash) 当前文件已排除 / Excluded for this file');
    } else if (!active) {
      lines.push('$(circle-slash) 当前文件类型未启用 / Not enabled for this file type');
    } else {
      lines.push('$(check) 预览已启用 / Preview is on');
    }

    lines.push('', '---', '', '**预览大小 / Preview size**', '');
    lines.push([
      link('$(remove)', 'silkMath.decreasePreviewScale', undefined, '缩小 5% / Smaller'),
      `&nbsp; **${percent}%** &nbsp;`,
      link('$(add)', 'silkMath.increasePreviewScale', undefined, '放大 5% / Larger'),
      '&nbsp;',
      link('$(discard)', 'silkMath.resetPreviewScale', undefined, `恢复默认 ${Math.round(DEFAULT_SCALE * 100)}% / Reset`),
    ].join(' '));
    lines.push('', `\`${this.scaleGauge(scale)}\` &nbsp; <sub>${Math.round(MIN_SCALE * 100)}% – ${Math.round(MAX_SCALE * 100)}%</sub>`);

    lines.push('', '---', '', '**启用范围 / Where it runs**', '');
    lines.push(`${mark(config.get('enableInLatex', true))} ${link('LaTeX / TeX', 'silkMath.toggleLanguage', ['enableInLatex'])}`);
    lines.push('');
    lines.push(`${mark(config.get('enableInMarkdown', true))} ${link('Markdown / MDX', 'silkMath.toggleLanguage', ['enableInMarkdown'])}`);
    lines.push('');
    lines.push(`${mark(config.get('enableInOtherFiles', false))} ${link('其他文件类型 / Other files', 'silkMath.toggleLanguage', ['enableInOtherFiles'])}`);

    lines.push('', '---', '');
    const actions: string[] = [];
    if (document) {
      actions.push(link(
        excluded ? '$(check) 取消排除本文件' : '$(circle-slash) 排除本文件',
        'silkMath.toggleExcludeFile',
      ));
    }
    if (!this.isSnoozed()) {
      for (const choice of SNOOZE_CHOICES) {
        actions.push(link(`$(clock) 暂停 ${choice.label}`, 'silkMath.snooze', [choice.minutes]));
      }
    }
    lines.push(actions.join(' &nbsp;·&nbsp; '));
    lines.push('');
    lines.push([
      link('$(screen-full) 截图识别 / OCR', 'silkMath.ocr.capture'),
      link('$(gear) 设置 / Settings', 'silkMath.openSettings'),
      link('$(list-flat) 全部选项 / All options', 'silkMath.showMenu'),
    ].join(' &nbsp;·&nbsp; '));

    const markdown = new vscode.MarkdownString(lines.join('\n'), true);
    markdown.isTrusted = true;
    markdown.supportHtml = true;
    return markdown;
  }

  /** 键盘可达的等价入口：悬浮面板只能用鼠标，命令面板/点击走这里。 */
  private async showMenu(): Promise<void> {
    const document = vscode.window.activeTextEditor?.document;
    const picked = await vscode.window.showQuickPick(this.menuItems(document), {
      title: 'Silk Math',
      placeHolder: '选择要执行的操作 / Pick an action',
    });
    await picked?.run?.();
  }

  private menuItems(document: vscode.TextDocument | undefined): MenuItem[] {
    const config = vscode.workspace.getConfiguration('silkMath', document?.uri);
    const check = (value: boolean): string => (value ? '$(check)' : '$(blank)');
    const scale = this.previewScale(document?.uri);
    const excluded = document !== undefined && this.isExcluded(document.uri);
    const separator = (label: string): MenuItem => ({ label, kind: vscode.QuickPickItemKind.Separator });
    return [
      separator('预览大小 / Preview size'),
      {
        label: `$(add) 放大到 ${Math.round(Math.min(MAX_SCALE, scale + SCALE_STEP) * 100)}%`,
        run: () => this.adjustPreviewScale(SCALE_STEP),
      },
      {
        label: `$(remove) 缩小到 ${Math.round(Math.max(MIN_SCALE, scale - SCALE_STEP) * 100)}%`,
        run: () => this.adjustPreviewScale(-SCALE_STEP),
      },
      {
        label: `$(discard) 恢复默认 ${Math.round(DEFAULT_SCALE * 100)}%`,
        description: `当前 ${Math.round(scale * 100)}%`,
        run: () => this.resetPreviewScale(),
      },
      separator('启用范围 / Where it runs'),
      {
        label: `${check(config.get('enableInLatex', true))} LaTeX / TeX 文件`,
        run: () => this.toggleLanguage('enableInLatex'),
      },
      {
        label: `${check(config.get('enableInMarkdown', true))} Markdown / MDX 文件`,
        run: () => this.toggleLanguage('enableInMarkdown'),
      },
      {
        label: `${check(config.get('enableInOtherFiles', false))} 其他所有文件类型`,
        description: '按 LaTeX 语法识别 $...$、\\[...\\]',
        run: () => this.toggleLanguage('enableInOtherFiles'),
      },
      separator('当前文件 / This file'),
      ...(document
        ? [{
          label: excluded ? '$(check) 取消排除当前文件' : '$(circle-slash) 排除当前文件',
          run: () => this.toggleExcludeFile(),
        }]
        : []),
      separator('暂停 / Snooze'),
      ...(this.isSnoozed()
        ? [{
          label: '$(debug-start) 立即恢复预览',
          description: `当前暂停到 ${formatClock(this.snoozeUntil)}`,
          run: () => this.resume(),
        }]
        : SNOOZE_CHOICES.map((choice) => ({
          label: `$(clock) 暂停 ${choice.label}`,
          run: () => this.snooze(choice.minutes),
        }))),
      separator('更多 / More'),
      ...(config.get('ocr.enabled', true)
        ? [{
          label: '$(screen-full) 截图识别公式或文字',
          description: '首次使用按需下载本地模型',
          run: () => vscode.commands.executeCommand('silkMath.ocr.capture'),
        }]
        : []),
      {
        label: '$(gear) 打开 Silk Math 设置',
        run: () => vscode.commands.executeCommand('silkMath.openSettings'),
      },
    ];
  }

  /**
   * 有工作区就写工作区设置，单文件场景写全局。
   * 就地升级插件后旧的配置 schema 还没重新注册，写工作区会直接抛
   * “没有注册配置”，因此这里逐个目标退让，最后才提示用户重载窗口。
   */
  private async updateSetting(key: string, value: unknown): Promise<void> {
    const targets = vscode.workspace.workspaceFolders?.length
      ? [vscode.ConfigurationTarget.Workspace, vscode.ConfigurationTarget.Global]
      : [vscode.ConfigurationTarget.Global];
    for (const target of targets) {
      try {
        await vscode.workspace.getConfiguration('silkMath').update(key, value, target);
        this.refresh();
        return;
      } catch {
        // 换下一个作用域重试。
      }
    }
    const reload = '重载窗口';
    const choice = await vscode.window.showWarningMessage(
      `Silk Math：无法写入设置 silkMath.${key}。刚升级过插件时需要重载窗口让新设置生效。`,
      reload,
    );
    if (choice === reload) await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
}
