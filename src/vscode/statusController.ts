import * as vscode from 'vscode';

import {
  DEFAULT_SCALE,
  MAX_SCALE,
  MIN_SCALE,
  SCALE_STEP,
  scaleToDisplayPercent,
} from '../core/statusFlyout';

type FlyoutBoolKey = 'enableInLatex' | 'enableInMarkdown' | 'enableInOtherFiles' | 'previewDefinitions';

export type PreviewLanguage = 'latex' | 'markdown';
export { DEFAULT_SCALE, MAX_SCALE, MIN_SCALE, SCALE_STEP, scaleToDisplayPercent };

const EXCLUDED_FILES_KEY = 'silkMath.excludedFiles';
const SNOOZE_CHOICES: ReadonlyArray<{ readonly minutes: number; readonly label: string }> = [
  { minutes: 5, label: '5 分钟' },
  { minutes: 30, label: '30 分钟' },
];

interface MenuItem extends vscode.QuickPickItem {
  readonly run?: () => unknown;
  /** 打开其他界面时关掉菜单；开关类操作保持打开并刷新。 */
  readonly closeMenu?: boolean;
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
 * 状态栏入口：左边截图识别，右边 Silk Math。点击打开顶部 QuickPick。
 * 开关留在菜单里立刻刷新勾选；不要用 Markdown hover——内核 locked hover
 * 不能当场改内容。
 */
export class StatusController implements vscode.Disposable {
  private readonly captureItem: vscode.StatusBarItem;
  private readonly item: vscode.StatusBarItem;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  private snoozeUntil = 0;
  private snoozeTimer: NodeJS.Timeout | undefined;
  private menuPicker: vscode.QuickPick<MenuItem> | undefined;
  /**
   * 点选后立刻画菜单用的乐观状态。`configuration.update()` 结束时
   * `get()` 经常还没刷新。
   */
  private readonly pending: Partial<Record<FlyoutBoolKey | 'previewScale', boolean | number>> = {};
  private pendingExclude: { readonly key: string; readonly value: boolean } | undefined;

  /** 策略变化（文件类型开关、暂停、排除、缩放）时触发，预览据此重画。 */
  public readonly onDidChange = this.changeEmitter.event;

  public constructor(private readonly context: vscode.ExtensionContext) {
    this.captureItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 30);
    this.captureItem.name = 'Silk Math 截图识别';
    this.captureItem.text = '$(screen-full)';
    this.captureItem.tooltip = '截图识别公式或文字（本地运行，不上传）';
    this.captureItem.command = 'silkMath.ocr.capture';

    this.item = vscode.window.createStatusBarItem('silkMath.status', vscode.StatusBarAlignment.Right, 24);
    this.item.name = 'Silk Math';
    this.item.text = 'Silk Math';
    this.item.accessibilityInformation = { label: 'Silk Math', role: 'button' };
    this.item.command = 'silkMath.showMenu';

    this.disposables.push(
      this.captureItem,
      this.item,
      this.changeEmitter,
      vscode.commands.registerCommand('silkMath.showMenu', () => this.showMenu()),
      vscode.commands.registerCommand('silkMath.revealFlyout', () => this.showMenu()),
      vscode.commands.registerCommand('silkMath.dismissFlyout', () => this.hideMenu()),
      vscode.commands.registerCommand('silkMath.increasePreviewScale', () => this.adjustPreviewScale(SCALE_STEP)),
      vscode.commands.registerCommand('silkMath.decreasePreviewScale', () => this.adjustPreviewScale(-SCALE_STEP)),
      vscode.commands.registerCommand('silkMath.resetPreviewScale', () => this.resetPreviewScale()),
      vscode.commands.registerCommand('silkMath.toggleLanguage', (key: unknown) => this.toggleLanguage(key)),
      vscode.commands.registerCommand('silkMath.togglePreviewDefinitions', () => this.togglePreviewDefinitions()),
      vscode.commands.registerCommand('silkMath.toggleExcludeFile', () => this.toggleExcludeFile()),
      vscode.commands.registerCommand('silkMath.snooze', (minutes: unknown) => {
        if (typeof minutes === 'number' && minutes > 0) this.snooze(minutes);
        else this.resume();
      }),
      vscode.commands.registerCommand('silkMath.openSettings', () => (
        vscode.commands.executeCommand('workbench.action.openSettings', 'silkMath')
      )),
      vscode.window.onDidChangeActiveTextEditor(() => this.refresh()),
      vscode.window.onDidChangeActiveColorTheme(() => this.refresh()),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration('silkMath')) return;
        this.reconcilePending();
        this.refresh();
      }),
    );
    this.refresh();
  }

  public dispose(): void {
    if (this.snoozeTimer) clearTimeout(this.snoozeTimer);
    this.hideMenu();
    for (const disposable of this.disposables) disposable.dispose();
  }

  /** 该文档按什么语法扫描；返回 undefined 表示这里不做预览。 */
  public previewLanguage(document: vscode.TextDocument): PreviewLanguage | undefined {
    if (this.isSnoozed() || this.isExcluded(document.uri)) return undefined;
    if (isLatex(document)) return this.settingBool('enableInLatex', true, document.uri) ? 'latex' : undefined;
    if (isMarkdown(document)) return this.settingBool('enableInMarkdown', true, document.uri) ? 'markdown' : undefined;
    return this.settingBool('enableInOtherFiles', false, document.uri) ? 'latex' : undefined;
  }

  public isExcluded(uri: vscode.Uri): boolean {
    const key = documentKey(uri);
    if (this.pendingExclude?.key === key) return this.pendingExclude.value;
    return this.excludedFiles().includes(key);
  }

  public isSnoozed(): boolean {
    return this.snoozeUntil > Date.now();
  }

  public async adjustPreviewScale(delta: number): Promise<number> {
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round((this.previewScale() + delta) * 100) / 100));
    this.pending.previewScale = next;
    this.refresh();
    void this.updateSetting('previewScale', next);
    return next;
  }

  public async resetPreviewScale(): Promise<number> {
    this.pending.previewScale = DEFAULT_SCALE;
    this.refresh();
    void this.updateSetting('previewScale', DEFAULT_SCALE);
    return DEFAULT_SCALE;
  }

  public async setPreviewScale(scale: number): Promise<number> {
    const next = Number.isFinite(scale)
      ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(scale * 100) / 100))
      : DEFAULT_SCALE;
    this.pending.previewScale = next;
    this.refresh();
    void this.updateSetting('previewScale', next);
    return next;
  }

  public previewScaleValue(uri?: vscode.Uri): number {
    return this.previewScale(uri);
  }

  private previewScale(uri?: vscode.Uri): number {
    const pending = this.pending.previewScale;
    if (typeof pending === 'number' && Number.isFinite(pending)) {
      return Math.min(MAX_SCALE, Math.max(MIN_SCALE, pending));
    }
    const raw = vscode.workspace.getConfiguration('silkMath', uri).get('previewScale', DEFAULT_SCALE);
    if (!Number.isFinite(raw)) return DEFAULT_SCALE;
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(raw)));
  }

  private settingBool(key: FlyoutBoolKey, fallback: boolean, uri?: vscode.Uri): boolean {
    const pending = this.pending[key];
    if (typeof pending === 'boolean') return pending;
    return vscode.workspace.getConfiguration('silkMath', uri).get(key, fallback) === true;
  }

  private reconcilePending(): void {
    const uri = vscode.window.activeTextEditor?.document.uri;
    const config = vscode.workspace.getConfiguration('silkMath', uri);
    for (const key of ['enableInLatex', 'enableInMarkdown', 'enableInOtherFiles', 'previewDefinitions'] as const) {
      if (this.pending[key] !== undefined && config.get(key) === this.pending[key]) delete this.pending[key];
    }
    if (typeof this.pending.previewScale === 'number') {
      const raw = config.get('previewScale', DEFAULT_SCALE);
      if (raw === this.pending.previewScale) delete this.pending.previewScale;
    }
    if (this.pendingExclude && this.excludedFiles().includes(this.pendingExclude.key) === this.pendingExclude.value) {
      this.pendingExclude = undefined;
    }
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
    const key = documentKey(document.uri);
    const next = !this.isExcluded(document.uri);
    this.pendingExclude = { key, value: next };
    this.refresh();
    await this.setExcluded(document.uri, next);
  }

  private toggleLanguage(key: unknown): void {
    if (key !== 'enableInLatex' && key !== 'enableInMarkdown' && key !== 'enableInOtherFiles') return;
    const uri = vscode.window.activeTextEditor?.document.uri;
    const fallback = key !== 'enableInOtherFiles';
    const next = !this.settingBool(key, fallback, uri);
    this.pending[key] = next;
    this.refresh();
    void this.updateSetting(key, next);
  }

  private togglePreviewDefinitions(): void {
    const uri = vscode.window.activeTextEditor?.document.uri;
    const next = !this.settingBool('previewDefinitions', false, uri);
    this.pending.previewDefinitions = next;
    this.refresh();
    void this.updateSetting('previewDefinitions', next);
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
    const snoozed = this.isSnoozed();
    const excluded = document !== undefined && this.isExcluded(document.uri);
    this.item.text = 'Silk Math';
    this.item.command = 'silkMath.showMenu';
    this.item.tooltip = snoozed
      ? `Silk Math · 暂停到 ${formatClock(this.snoozeUntil)}`
      : excluded
        ? 'Silk Math · 已排除当前文件'
        : '点击打开 Silk Math 菜单（勾选会立刻更新）';
    this.item.show();
    this.captureItem.show();
    if (!vscode.workspace.getConfiguration('silkMath').get('ocr.enabled', true)) this.captureItem.hide();
    this.changeEmitter.fire();
  }

  /**
   * 点击状态栏或命令面板打开顶部菜单。开关类操作后保持打开并刷新。
   */
  private showMenu(): void {
    if (this.menuPicker) {
      this.menuPicker.items = this.menuItems(vscode.window.activeTextEditor?.document);
      this.menuPicker.show();
      return;
    }
    const picker = vscode.window.createQuickPick<MenuItem>();
    this.menuPicker = picker;
    picker.title = 'Silk Math';
    picker.placeholder = '选择要执行的操作 / Pick an action';
    picker.ignoreFocusOut = true;
    picker.matchOnDescription = true;
    picker.keepScrollPosition = true;
    picker.items = this.menuItems(vscode.window.activeTextEditor?.document);
    void vscode.commands.executeCommand('setContext', 'silkMath.flyoutVisible', true);
    const refresh = (): void => {
      if (this.menuPicker === picker) {
        picker.items = this.menuItems(vscode.window.activeTextEditor?.document);
      }
    };
    const subscriptions = [
      this.onDidChange(refresh),
      picker.onDidAccept(() => {
        const item = picker.selectedItems[0];
        if (!item?.run) {
          picker.hide();
          return;
        }
        void Promise.resolve(item.run()).then(() => {
          if (item.closeMenu) picker.hide();
          else refresh();
        });
      }),
      picker.onDidHide(() => {
        for (const subscription of subscriptions) subscription.dispose();
        picker.dispose();
        if (this.menuPicker === picker) this.menuPicker = undefined;
        void vscode.commands.executeCommand('setContext', 'silkMath.flyoutVisible', false);
      }),
    ];
    picker.show();
  }

  private hideMenu(): void {
    this.menuPicker?.hide();
    this.menuPicker = undefined;
    void vscode.commands.executeCommand('setContext', 'silkMath.flyoutVisible', false);
  }

  private menuItems(document: vscode.TextDocument | undefined): MenuItem[] {
    const config = vscode.workspace.getConfiguration('silkMath', document?.uri);
    const uri = document?.uri;
    const check = (value: boolean): string => (value ? '$(check)' : '$(blank)');
    const scale = this.previewScale(uri);
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
        label: `${check(this.settingBool('enableInLatex', true, uri))} LaTeX / TeX 文件`,
        run: () => this.toggleLanguage('enableInLatex'),
      },
      {
        label: `${check(this.settingBool('enableInMarkdown', true, uri))} Markdown / MDX 文件`,
        run: () => this.toggleLanguage('enableInMarkdown'),
      },
      {
        label: `${check(this.settingBool('enableInOtherFiles', false, uri))} 其他所有文件类型`,
        description: '按 LaTeX 语法识别 $...$、\\[...\\]',
        run: () => this.toggleLanguage('enableInOtherFiles'),
      },
      {
        label: `${check(this.settingBool('previewDefinitions', false, uri))} 定义也预览`,
        description: '只有 \\def / \\newcommand 的公式也画出展开结果',
        run: () => this.togglePreviewDefinitions(),
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
          closeMenu: true,
          run: () => vscode.commands.executeCommand('silkMath.ocr.capture'),
        }]
        : []),
      {
        label: '$(gear) 打开 Silk Math 设置',
        closeMenu: true,
        run: () => vscode.commands.executeCommand('workbench.action.openSettings', 'silkMath'),
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
        this.reconcilePending();
        this.refresh();
        return;
      } catch {
        // 换下一个作用域退让。
      }
    }
    if (key === 'previewScale' || key === 'enableInLatex' || key === 'enableInMarkdown'
      || key === 'enableInOtherFiles' || key === 'previewDefinitions') {
      delete this.pending[key];
    }
    this.refresh();
    const reload = '重载窗口';
    const choice = await vscode.window.showWarningMessage(
      `Silk Math：无法写入设置 silkMath.${key}。刚升级过插件时需要重载窗口让新设置生效。`,
      reload,
    );
    if (choice === reload) await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
}
