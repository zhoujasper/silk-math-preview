import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';

import {
  buildStatusFlyoutDecorationCss,
  buildStatusFlyoutMarkdown,
  buildStatusFlyoutSvg,
  commandLink,
  DEFAULT_SCALE,
  FLYOUT_CARD_WIDTH,
  FLYOUT_DISMISS_GRACE_MS,
  flyoutAnchorLine,
  flyoutCopy,
  flyoutGaugePercent,
  isChineseLocale,
  overlayFlyoutState,
  MAX_SCALE,
  MIN_SCALE,
  scaleGauge,
  scaleToDisplayPercent,
} from '../src/core/statusFlyout';

const sample = {
  active: true,
  snoozed: false,
  excluded: false,
  hasDocument: true,
  scale: DEFAULT_SCALE,
  enableInLatex: true,
  enableInMarkdown: true,
  enableInOtherFiles: false,
  previewDefinitions: false,
  ocrEnabled: true,
  language: 'zh-cn',
  dark: true,
} as const;

describe('status flyout', () => {
  it('默认倍率在界面上显示为 100%', () => {
    expect(scaleToDisplayPercent(DEFAULT_SCALE)).toBe(100);
    expect(scaleToDisplayPercent(MIN_SCALE)).toBe(37);
    expect(scaleToDisplayPercent(MAX_SCALE)).toBe(222);
  });

  it('刻度条长度固定，随倍率填充', () => {
    expect(scaleGauge(MIN_SCALE)).toBe('░░░░░░░░░░');
    expect(scaleGauge(MAX_SCALE)).toBe('██████████');
    expect(scaleGauge(DEFAULT_SCALE).length).toBe(10);
    expect(flyoutGaugePercent(MIN_SCALE)).toBe(0);
    expect(flyoutGaugePercent(MAX_SCALE)).toBe(100);
  });

  it('命令链接按 command URI 编码参数', () => {
    expect(commandLink('LaTeX', 'silkMath.toggleLanguage', ['enableInLatex']))
      .toBe('[LaTeX](command:silkMath.toggleLanguage?%5B%22enableInLatex%22%5D)');
  });

  it('vscode 语言不是中文时卡片用英文', () => {
    expect(isChineseLocale('zh-cn')).toBe(true);
    expect(isChineseLocale('zh-tw')).toBe(true);
    expect(isChineseLocale('en')).toBe(false);
    expect(isChineseLocale('en-us')).toBe(false);
    expect(flyoutCopy('zh-cn').snooze).toBe('推迟');
    expect(flyoutCopy('en').snooze).toBe('Snooze');
    const english = buildStatusFlyoutMarkdown({ ...sample, language: 'en' });
    expect(english).toContain('Preview size');
    expect(english).toContain('Enable in');
    expect(english).toContain('Snooze');
    expect(english).toContain('Pause 5 minutes');
    expect(english).toContain('Exclude this file');
    expect(english).not.toContain('预览大小');
  });

  it('卡片是状态栏 hover：markdown command 链接，不是 HTML 表格里的 command href', () => {
    const markdown = buildStatusFlyoutMarkdown(sample);
    expect(markdown).toContain('Silk Math');
    expect(FLYOUT_CARD_WIDTH).toBe(280);
    expect(markdown).toContain('$(gear)');
    expect(markdown).toContain('(command:silkMath.openSettings');
    expect(markdown).not.toContain('href="command:');
    expect(markdown).not.toContain('<table');
    expect(markdown).not.toContain('预览已启用');
    expect(markdown).toContain('预览大小');
    expect(markdown).toContain('启用范围');
    expect(markdown).toContain('LaTeX / TeX');
    expect(markdown).toContain('command:silkMath.toggleLanguage?%5B%22enableInLatex%22%5D');
    expect(markdown).toContain('☑');
    expect(markdown).toContain('☐');
    expect(markdown).toContain('LaTeX / TeX');
    expect(markdown).toContain('定义也预览');
    expect(markdown).toContain('command:silkMath.togglePreviewDefinitions');
    expect(markdown).toContain('推迟');
    expect(markdown).toContain('暂停 5 分钟');
    expect(markdown).toContain('排除当前文件');
    expect(markdown).toContain('command:silkMath.toggleExcludeFile');
    expect(markdown).not.toContain('$(pass-filled)');
    expect(markdown).not.toContain('togglePanel');
    expect(markdown).not.toContain('createWebviewPanel');
    expect(markdown).not.toContain('silkMath.flyout');
    expect(buildStatusFlyoutMarkdown({ ...sample, revision: 7 })).toContain('<!-- r7 -->');
  });

  it('勾选开/关画出不同方框，用 markdown command 链接', () => {
    const on = buildStatusFlyoutMarkdown({
      ...sample,
      enableInLatex: true,
      enableInMarkdown: false,
    });
    expect(on).toContain('command:silkMath.toggleLanguage?%5B%22enableInLatex%22%5D');
    expect(on).toContain('☑');
    expect(on).toContain('☐');
    expect(on).toContain('command:silkMath.toggleLanguage?%5B%22enableInMarkdown%22%5D');
  });

  it('乐观覆盖立刻改勾选，不依赖 getConfiguration 刷新', () => {
    const before = buildStatusFlyoutMarkdown({ ...sample, revision: 1 });
    const after = buildStatusFlyoutMarkdown(overlayFlyoutState(sample, {
      enableInLatex: false,
      previewDefinitions: true,
      scale: DEFAULT_SCALE * 1.1,
      revision: 2,
    }));
    expect(before).toContain('☑&nbsp;&nbsp;LaTeX / TeX');
    expect(after).toContain('☐&nbsp;&nbsp;LaTeX / TeX');
    expect(before).toContain('☐&nbsp;&nbsp;定义也预览');
    expect(after).toContain('☑&nbsp;&nbsp;定义也预览');
    expect(before).toContain('<strong>100%</strong>');
    expect(after).toContain('<strong>110%</strong>');
    expect(before).toContain('<!-- r1 -->');
    expect(after).toContain('<!-- r2 -->');
    expect(after).not.toBe(before);
  });

  it('排除或未启用时给出对应状态', () => {
    const excluded = buildStatusFlyoutMarkdown({
      ...sample,
      active: false,
      excluded: true,
    });
    expect(excluded).toContain('取消排除当前文件');
    const idle = buildStatusFlyoutMarkdown({
      ...sample,
      active: false,
      hasDocument: false,
    });
    expect(idle).not.toContain('排除当前文件');
    expect(idle).not.toContain('取消排除当前文件');
  });

  it('卡片锚在视口最后一行，没有可见范围时用文档末行', () => {
    expect(flyoutAnchorLine([{ start: { line: 10 }, end: { line: 40 } }], 80)).toBe(40);
    expect(flyoutAnchorLine([], 12)).toBe(11);
    expect(flyoutAnchorLine([], 0)).toBe(0);
  });

  it('普通文件锚在最后可见行上方；Jupyter 钉在格子右下角', () => {
    const fileCss = buildStatusFlyoutDecorationCss('file');
    expect(fileCss).toContain('position: absolute');
    expect(fileCss).toContain('right: 16px');
    expect(fileCss).toContain('translateY(calc(-100% - 8px))');
    expect(fileCss).not.toContain('position: fixed');
    const cellCss = buildStatusFlyoutDecorationCss('notebook-cell');
    expect(cellCss).toContain('bottom: 8px');
    expect(cellCss).toContain('right: 16px');
    expect(cellCss).not.toContain('translateY');
    expect(FLYOUT_DISMISS_GRACE_MS).toBeGreaterThanOrEqual(200);
  });

  it('点击卡片是钉在状态栏上方的 SVG，带 command 链接', () => {
    const card = buildStatusFlyoutSvg(sample, true);
    expect(card.width).toBe(FLYOUT_CARD_WIDTH);
    expect(card.svg).toContain('Silk Math');
    expect(card.svg).toContain('command:silkMath.increasePreviewScale');
    expect(card.svg).toContain('command:silkMath.toggleLanguage?%5B%22enableInLatex%22%5D');
    const messages: string[] = [];
    const parsed = new DOMParser({
      onError: (level, message) => messages.push(`${level}:${message}`),
    }).parseFromString(card.svg, 'image/svg+xml');
    expect(messages).toEqual([]);
    expect(parsed.documentElement?.localName).toBe('svg');
  });

  it('暂停时显示恢复入口、隐藏暂停选项', () => {
    const markdown = buildStatusFlyoutMarkdown({
      ...sample,
      active: false,
      snoozed: true,
      snoozeUntilLabel: '12:00',
      ocrEnabled: false,
    });
    expect(markdown).toContain('暂停到 12:00');
    expect(markdown).toContain('恢复');
    expect(markdown).not.toContain('暂停 5 分钟');
  });
});
