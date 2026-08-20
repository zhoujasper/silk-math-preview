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
/** 实际渲染倍率 1.4（相对编辑器字号 140%），界面把这个大小显示成 100%。 */
export const DEFAULT_SCALE = 1.4;
const SCALE_STEP = DEFAULT_SCALE * 0.05;

export function scaleToDisplayPercent(scale: number): number {
  return Math.round((scale / DEFAULT_SCALE) * 100);
}

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

/**
 * 状态栏入口：左边截图识别，右边 Silk Math 点击打开右侧设置卡片。
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
    this.item.tooltip = this.hoverHint(document, active);
    this.item.show();
    this.captureItem.show();
    if (!vscode.workspace.getConfiguration('silkMath').get('ocr.enabled', true)) this.captureItem.hide();
    this.changeEmitter.fire();
  }

  /** 悬停只给一句提示；完整设置在点击弹出的卡片里。 */
  private hoverHint(document: vscode.TextDocument | undefined, active: boolean): vscode.MarkdownString {
    const excluded = document !== undefined && this.isExcluded(document.uri);
    let text = '点击打开 Silk Math 设置卡片 / Click to open settings';
    if (this.isSnoozed()) text = `已暂停到 ${formatClock(this.snoozeUntil)} · 点击打开设置`;
    else if (excluded) text = '当前文件已排除 · 点击打开设置';
    else if (!active) text = '当前文件类型未启用 · 点击打开设置';
    const markdown = new vscode.MarkdownString(text, true);
    markdown.isTrusted = true;
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
        label: `$(add) 放大到 ${scaleToDisplayPercent(Math.min(MAX_SCALE, scale + SCALE_STEP))}%`,
        run: () => this.adjustPreviewScale(SCALE_STEP),
      },
      {
        label: `$(remove) 缩小到 ${scaleToDisplayPercent(Math.max(MIN_SCALE, scale - SCALE_STEP))}%`,
        run: () => this.adjustPreviewScale(-SCALE_STEP),
      },
      {
        label: '$(discard) 恢复默认 100%',
        description: `当前 ${scaleToDisplayPercent(scale)}%`,
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
