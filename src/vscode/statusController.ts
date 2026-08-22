import * as vscode from 'vscode';

import { cmd, COMMAND_NS, IS_TEST_CHANNEL, PRODUCT_NAME } from '../core/channel';
import {
  DEFAULT_SCALE,
  MAX_SCALE,
  MIN_SCALE,
  SCALE_STEP,
  scaleToDisplayPercent,
} from '../core/statusFlyout';
import { fillTemplate, uiCopy } from '../core/uiLocale';

type FlyoutBoolKey = 'enableInLatex' | 'enableInMarkdown' | 'enableInOtherFiles' | 'previewDefinitions';

export type PreviewLanguage = 'latex' | 'markdown';
export { DEFAULT_SCALE, MAX_SCALE, MIN_SCALE, SCALE_STEP, scaleToDisplayPercent };

const EXCLUDED_FILES_KEY = `${COMMAND_NS}.excludedFiles`;
const SNOOZE_MINUTES = [5, 30] as const;

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
  return new Date(time).toLocaleTimeString(vscode.env.language || undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
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
    this.captureItem.text = '$(screen-full)';
    this.captureItem.command = cmd('ocr.capture');

    this.item = vscode.window.createStatusBarItem(`${COMMAND_NS}.status`, vscode.StatusBarAlignment.Right, 24);
    this.item.name = PRODUCT_NAME;
    this.item.text = PRODUCT_NAME;
    this.item.accessibilityInformation = { label: PRODUCT_NAME, role: 'button' };
    this.item.command = cmd('showMenu');

    this.disposables.push(
      this.captureItem,
      this.item,
      this.changeEmitter,
      vscode.commands.registerCommand(cmd('showMenu'), () => this.showMenu()),
      vscode.commands.registerCommand(cmd('revealFlyout'), () => this.showMenu()),
      vscode.commands.registerCommand(cmd('dismissFlyout'), () => this.hideMenu()),
      vscode.commands.registerCommand(cmd('increasePreviewScale'), () => this.adjustPreviewScale(SCALE_STEP)),
      vscode.commands.registerCommand(cmd('decreasePreviewScale'), () => this.adjustPreviewScale(-SCALE_STEP)),
      vscode.commands.registerCommand(cmd('resetPreviewScale'), () => this.resetPreviewScale()),
      vscode.commands.registerCommand(cmd('toggleLanguage'), (key: unknown) => this.toggleLanguage(key)),
      vscode.commands.registerCommand(cmd('togglePreviewDefinitions'), () => this.togglePreviewDefinitions()),
      vscode.commands.registerCommand(cmd('toggleExcludeFile'), () => this.toggleExcludeFile()),
      vscode.commands.registerCommand(cmd('snooze'), (minutes: unknown) => {
        if (typeof minutes === 'number' && minutes > 0) this.snooze(minutes);
        else this.resume();
      }),
      vscode.commands.registerCommand(cmd('openSettings'), () => (
        vscode.commands.executeCommand('workbench.action.openSettings', COMMAND_NS)
      )),
      vscode.window.onDidChangeActiveTextEditor(() => this.refresh()),
      vscode.window.onDidChangeActiveColorTheme(() => this.refresh()),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration(COMMAND_NS)) return;
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
    const raw = vscode.workspace.getConfiguration(COMMAND_NS, uri).get('previewScale', DEFAULT_SCALE);
    if (!Number.isFinite(raw)) return DEFAULT_SCALE;
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(raw)));
  }

  private settingBool(key: FlyoutBoolKey, fallback: boolean, uri?: vscode.Uri): boolean {
    const pending = this.pending[key];
    if (typeof pending === 'boolean') return pending;
    return vscode.workspace.getConfiguration(COMMAND_NS, uri).get(key, fallback) === true;
  }

  private reconcilePending(): void {
    const uri = vscode.window.activeTextEditor?.document.uri;
    const config = vscode.workspace.getConfiguration(COMMAND_NS, uri);
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
    const copy = uiCopy(vscode.env.language);
    const vars = { product: PRODUCT_NAME, time: formatClock(this.snoozeUntil) };
    this.item.text = PRODUCT_NAME;
    this.item.command = cmd('showMenu');
    this.item.tooltip = snoozed
      ? fillTemplate(copy.statusSnoozed, vars)
      : excluded
        ? fillTemplate(copy.statusExcluded, vars)
        : fillTemplate(copy.statusClick, vars);
    this.captureItem.name = fillTemplate(copy.captureName, vars);
    this.captureItem.tooltip = copy.captureTooltip;
    this.item.show();
    if (IS_TEST_CHANNEL) {
      this.captureItem.hide();
    } else {
      this.captureItem.show();
      if (!vscode.workspace.getConfiguration(COMMAND_NS).get('ocr.enabled', true)) this.captureItem.hide();
    }
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
    picker.title = PRODUCT_NAME;
    picker.placeholder = uiCopy(vscode.env.language).menuPlaceholder;
    picker.ignoreFocusOut = true;
    picker.matchOnDescription = true;
    picker.keepScrollPosition = true;
    picker.items = this.menuItems(vscode.window.activeTextEditor?.document);
    void vscode.commands.executeCommand('setContext', `${COMMAND_NS}.flyoutVisible`, true);
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
        void vscode.commands.executeCommand('setContext', `${COMMAND_NS}.flyoutVisible`, false);
      }),
    ];
    picker.show();
  }

  private hideMenu(): void {
    this.menuPicker?.hide();
    this.menuPicker = undefined;
    void vscode.commands.executeCommand('setContext', `${COMMAND_NS}.flyoutVisible`, false);
  }

  private menuItems(document: vscode.TextDocument | undefined): MenuItem[] {
    const config = vscode.workspace.getConfiguration(COMMAND_NS, document?.uri);
    const uri = document?.uri;
    const copy = uiCopy(vscode.env.language);
    const check = (value: boolean): string => (value ? '$(check)' : '$(blank)');
    const scale = this.previewScale(uri);
    const excluded = document !== undefined && this.isExcluded(document.uri);
    const separator = (label: string): MenuItem => ({ label, kind: vscode.QuickPickItemKind.Separator });
    const growPercent = scaleToDisplayPercent(Math.min(MAX_SCALE, scale + SCALE_STEP));
    const shrinkPercent = scaleToDisplayPercent(Math.max(MIN_SCALE, scale - SCALE_STEP));
    const nowPercent = scaleToDisplayPercent(scale);
    return [
      separator(copy.previewSize),
      {
        label: `$(add) ${fillTemplate(copy.growTo, { percent: growPercent })}`,
        run: () => this.adjustPreviewScale(SCALE_STEP),
      },
      {
        label: `$(remove) ${fillTemplate(copy.shrinkTo, { percent: shrinkPercent })}`,
        run: () => this.adjustPreviewScale(-SCALE_STEP),
      },
      {
        label: `$(discard) ${copy.resetDefault}`,
        description: fillTemplate(copy.currentPercent, { percent: nowPercent }),
        run: () => this.resetPreviewScale(),
      },
      separator(copy.where),
      {
        label: `${check(this.settingBool('enableInLatex', true, uri))} ${copy.latexFiles}`,
        run: () => this.toggleLanguage('enableInLatex'),
      },
      {
        label: `${check(this.settingBool('enableInMarkdown', true, uri))} ${copy.markdownFiles}`,
        run: () => this.toggleLanguage('enableInMarkdown'),
      },
      {
        label: `${check(this.settingBool('enableInOtherFiles', false, uri))} ${copy.otherFiles}`,
        description: copy.otherFilesHint,
        run: () => this.toggleLanguage('enableInOtherFiles'),
      },
      {
        label: `${check(this.settingBool('previewDefinitions', false, uri))} ${copy.previewDefinitions}`,
        description: copy.previewDefinitionsHint,
        run: () => this.togglePreviewDefinitions(),
      },
      separator(copy.thisFile),
      ...(document
        ? [{
          label: excluded ? `$(check) ${copy.unexcludeFile}` : `$(circle-slash) ${copy.excludeFile}`,
          run: () => this.toggleExcludeFile(),
        }]
        : []),
      separator(copy.snoozeSection),
      ...(this.isSnoozed()
        ? [{
          label: `$(debug-start) ${copy.resumeNow}`,
          description: fillTemplate(copy.pausedUntilTime, { time: formatClock(this.snoozeUntil) }),
          run: () => this.resume(),
        }]
        : SNOOZE_MINUTES.map((minutes) => ({
          label: `$(clock) ${fillTemplate(copy.snoozeMinutes, { minutes })}`,
          run: () => this.snooze(minutes),
        }))),
      separator(copy.more),
      ...(config.get('ocr.enabled', true)
        ? [{
          label: `$(screen-full) ${copy.ocrCapture}`,
          description: copy.ocrCaptureHint,
          closeMenu: true,
          run: () => vscode.commands.executeCommand(cmd('ocr.capture')),
        }]
        : []),
      {
        label: `$(gear) ${fillTemplate(copy.openSettingsProduct, { product: PRODUCT_NAME })}`,
        closeMenu: true,
        run: () => vscode.commands.executeCommand('workbench.action.openSettings', COMMAND_NS),
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
        await vscode.workspace.getConfiguration(COMMAND_NS).update(key, value, target);
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
    const copy = uiCopy(vscode.env.language);
    const reload = copy.reloadWindow;
    const choice = await vscode.window.showWarningMessage(
      fillTemplate(copy.cannotWriteSetting, { product: PRODUCT_NAME, key: `${COMMAND_NS}.${key}` }),
      reload,
    );
    if (choice === reload) await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
}
