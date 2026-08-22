import { cmd, PRODUCT_NAME } from './channel';
import { uiCopy } from './uiLocale';

export { isChineseLocale } from './uiLocale';

/** 预览缩放：与 package.json 的取值范围保持一致。 */
export const MIN_SCALE = 0.5;
export const MAX_SCALE = 3;
/** 实际渲染倍率 1.35（相对编辑器字号 135%），界面把这个大小显示成 100%。 */
export const DEFAULT_SCALE = 1.35;
export const SCALE_STEP = DEFAULT_SCALE * 0.05;
const SCALE_GAUGE_CELLS = 10;

export function scaleToDisplayPercent(scale: number): number {
  return Math.round((scale / DEFAULT_SCALE) * 100);
}

export function scaleGauge(scale: number): string {
  const filled = Math.max(
    0,
    Math.min(SCALE_GAUGE_CELLS, Math.round(((scale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE)) * SCALE_GAUGE_CELLS)),
  );
  return '█'.repeat(filled) + '░'.repeat(SCALE_GAUGE_CELLS - filled);
}

/** 悬浮框里的命令链接；参数按 command URI 规范编码。 */
export function commandLink(label: string, command: string, args?: readonly unknown[], tooltip?: string): string {
  const query = args ? `?${encodeURIComponent(JSON.stringify(args))}` : '';
  const title = tooltip ? ` "${tooltip.replace(/"/g, '')}"` : '';
  return `[${label}](command:${command}${query}${title})`;
}

export interface StatusFlyoutState {
  readonly active: boolean;
  readonly snoozed: boolean;
  readonly snoozeUntilLabel?: string;
  readonly excluded: boolean;
  readonly hasDocument: boolean;
  readonly scale: number;
  readonly enableInLatex: boolean;
  readonly enableInMarkdown: boolean;
  readonly enableInOtherFiles: boolean;
  readonly previewDefinitions: boolean;
  readonly ocrEnabled: boolean;
  /** 深色主题用深色控件；浅色反过来。默认按深色。 */
  readonly dark?: boolean;
  /** vscode.env.language；按常见 UI 语言选文案，对不上的用英文。 */
  readonly language?: string;
  /** 每次刷新递增，逼着工作台 hover 用新内容重绘。 */
  readonly revision?: number;
}

/** 点选后立刻盖到卡片上的字段。配置写入完成前 `getConfiguration()` 经常还是旧值。 */
export type FlyoutPending = Partial<
  Pick<
    StatusFlyoutState,
    | 'enableInLatex'
    | 'enableInMarkdown'
    | 'enableInOtherFiles'
    | 'previewDefinitions'
    | 'scale'
    | 'excluded'
    | 'snoozed'
    | 'snoozeUntilLabel'
    | 'revision'
  >
>;

export function overlayFlyoutState(state: StatusFlyoutState, pending: FlyoutPending): StatusFlyoutState {
  return { ...state, ...pending };
}

export interface FlyoutCopy {
  readonly previewSize: string;
  readonly reset: string;
  readonly shrink: string;
  readonly grow: string;
  readonly where: string;
  readonly latex: string;
  readonly markdown: string;
  readonly otherFiles: string;
  readonly previewDefinitions: string;
  readonly snooze: string;
  readonly snooze5: string;
  readonly snooze30: string;
  readonly resume: string;
  readonly pausedUntil: string;
  readonly excludeFile: string;
  readonly unexcludeFile: string;
  readonly openSettings: string;
}

export function flyoutCopy(language: string | undefined): FlyoutCopy {
  const copy = uiCopy(language);
  return {
    previewSize: copy.previewSize,
    reset: copy.reset,
    shrink: copy.shrink,
    grow: copy.grow,
    where: copy.where,
    latex: copy.latex,
    markdown: copy.markdown,
    otherFiles: copy.otherFiles,
    previewDefinitions: copy.previewDefinitions,
    snooze: copy.snooze,
    snooze5: copy.snooze5,
    snooze30: copy.snooze30,
    resume: copy.resume,
    pausedUntil: copy.pausedUntil,
    excludeFile: copy.excludeFile,
    unexcludeFile: copy.unexcludeFile,
    openSettings: copy.openSettings,
  };
}

/** 卡片宽度。比 Copilot 状态栏卡片略窄一点。 */
export const FLYOUT_CARD_WIDTH = 280;

export function flyoutGaugePercent(scale: number): number {
  return Math.max(0, Math.min(100, ((scale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE)) * 100));
}

export const FLYOUT_COMMANDS = [
  cmd('toggleLanguage'),
  cmd('togglePreviewDefinitions'),
  cmd('toggleExcludeFile'),
  cmd('snooze'),
  cmd('increasePreviewScale'),
  cmd('decreasePreviewScale'),
  cmd('resetPreviewScale'),
  cmd('openSettings'),
] as const;

function fgSpan(inner: string): string {
  return `<span style="color:var(--vscode-foreground);">${inner}</span>`;
}

function mutedSpan(text: string): string {
  return `<span style="color:var(--vscode-descriptionForeground);">${xmlEscape(text)}</span>`;
}

function chipSpan(text: string): string {
  return `<span style="color:var(--vscode-button-secondaryForeground);background-color:var(--vscode-button-secondaryBackground);border-radius:2px;">&nbsp;&nbsp;${xmlEscape(text)}&nbsp;&nbsp;</span>`;
}

function settingRow(on: boolean, label: string, command: string, args?: readonly unknown[]): string {
  // 用 ☑/☐ 写进 markdown 正文。Codicon `$(square)` 在部分主题里几乎看不见，
  // 工作台 hover 又按 markdown.value 当 id，正文必须开/关长得不一样。
  const mark = on ? '☑' : '☐';
  return `${commandLink(fgSpan(`${mark}&nbsp;&nbsp;${xmlEscape(label)}`), command, args, label)}\\`;
}

function textBtn(label: string, command: string, title: string): string {
  return commandLink(fgSpan(xmlEscape(label)), command, undefined, title);
}

function chipBtn(label: string, command: string, args: readonly unknown[] | undefined, title: string): string {
  return commandLink(chipSpan(label), command, args, title);
}

function gaugeSvg(scale: number, dark: boolean): string {
  const width = FLYOUT_CARD_WIDTH - 16;
  const filled = Math.round((flyoutGaugePercent(scale) / 100) * width);
  const track = dark ? '#3c3c3c' : '#e4e4e4';
  const bar = dark ? '#0e639c' : '#0078d4';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="4" viewBox="0 0 ${width} 4"><rect width="${width}" height="4" rx="2" fill="${track}"/><rect width="${filled}" height="4" rx="2" fill="${bar}"/></svg>`;
}

/**
 * 必须用 markdown `[text](command:id)`，不能用 HTML `<a href="command:">`。
 * isTrusted 必须是布尔 true：内核 opener 用 `allowCommands.includes(uri.path)`，
 * `{ enabledCommands }` 在 path 带 `/` 时会默默吞掉点击、连闪都没有。
 */
export function buildStatusFlyoutMarkdown(state: StatusFlyoutState): string {
  const dark = state.dark !== false;
  const copy = flyoutCopy(state.language);
  const percent = scaleToDisplayPercent(state.scale);
  const gauge = `data:image/svg+xml;utf8,${encodeURIComponent(gaugeSvg(state.scale, dark))}`;
  const settings = [
    settingRow(state.enableInLatex, copy.latex, cmd('toggleLanguage'), ['enableInLatex']),
    settingRow(state.enableInMarkdown, copy.markdown, cmd('toggleLanguage'), ['enableInMarkdown']),
    settingRow(state.enableInOtherFiles, copy.otherFiles, cmd('toggleLanguage'), ['enableInOtherFiles']),
    settingRow(state.previewDefinitions, copy.previewDefinitions, cmd('togglePreviewDefinitions')),
  ].join('\n');

  const snooze = state.snoozed
    ? `${chipBtn(copy.resume, cmd('snooze'), [0], copy.resume)}&nbsp;&nbsp;${mutedSpan(`${copy.pausedUntil} ${state.snoozeUntilLabel ?? ''}`)}\\`
    : `${chipBtn(copy.snooze, cmd('snooze'), [5], copy.snooze5)}&nbsp;&nbsp;${mutedSpan(copy.snooze5)}\\\n${chipBtn(copy.snooze, cmd('snooze'), [30], copy.snooze30)}&nbsp;&nbsp;${mutedSpan(copy.snooze30)}\\`;

  const exclude = state.hasDocument
    ? `\n\n${chipBtn(state.excluded ? copy.unexcludeFile : copy.excludeFile, cmd('toggleExcludeFile'), undefined, state.excluded ? copy.unexcludeFile : copy.excludeFile)}\\`
    : '';

  const revision = state.revision !== undefined
    ? `\n\n<!-- r${state.revision} -->${'\u200b'.repeat((state.revision % 7) + 1)}`
    : '';
  return `${fgSpan(`<strong>${PRODUCT_NAME}</strong>`)}&nbsp;&nbsp;&nbsp;&nbsp;${commandLink(fgSpan('$(gear)'), cmd('openSettings'), undefined, copy.openSettings)}\\

${mutedSpan(copy.previewSize)}\\
${textBtn('−', cmd('decreasePreviewScale'), copy.shrink)}&nbsp;&nbsp;${fgSpan(`<strong>${percent}%</strong>`)}&nbsp;&nbsp;${textBtn('+', cmd('increasePreviewScale'), copy.grow)}&nbsp;&nbsp;${textBtn(copy.reset, cmd('resetPreviewScale'), copy.reset)}\\

![${percent}%](${gauge})

${mutedSpan(copy.where)}\\
${settings}

${snooze}${exclude}${revision}`;
}

export function buildStatusFlyoutCardHtml(state: StatusFlyoutState): string {
  return buildStatusFlyoutMarkdown(state);
}

export interface StatusFlyoutPalette {
  readonly background: string;
  readonly foreground: string;
  readonly muted: string;
  readonly border: string;
  readonly button: string;
  readonly buttonFg: string;
  readonly accent: string;
}

const DARK_PALETTE: StatusFlyoutPalette = {
  background: '#252526',
  foreground: '#cccccc',
  muted: '#9d9d9d',
  border: '#454545',
  button: '#3a3d41',
  buttonFg: '#cccccc',
  accent: '#0e639c',
};

const LIGHT_PALETTE: StatusFlyoutPalette = {
  background: '#f3f3f3',
  foreground: '#333333',
  muted: '#6c6c6c',
  border: '#c8c8c8',
  button: '#e4e6e8',
  buttonFg: '#333333',
  accent: '#0078d4',
};

export function statusFlyoutPalette(dark: boolean): StatusFlyoutPalette {
  return dark ? DARK_PALETTE : LIGHT_PALETTE;
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function svgLink(href: string, body: string): string {
  return `<a href="command:${href}">${body}</a>`;
}

function svgButton(x: number, y: number, width: number, height: number, label: string, href: string, palette: StatusFlyoutPalette): string {
  return svgLink(href, `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="4" fill="${palette.button}"/><text x="${x + width / 2}" y="${y + 15}" text-anchor="middle" font-size="12" fill="${palette.buttonFg}">${xmlEscape(label)}</text>`);
}

function svgChip(x: number, y: number, width: number, label: string, on: boolean, href: string, palette: StatusFlyoutPalette): string {
  const bg = on ? palette.accent : palette.button;
  const fg = on ? '#ffffff' : palette.buttonFg;
  return svgLink(href, `<rect x="${x}" y="${y}" width="${width}" height="22" rx="11" fill="${bg}"/><text x="${x + width / 2}" y="${y + 15}" text-anchor="middle" font-size="11" fill="${fg}">${xmlEscape(label)}</text>`);
}

/** 点状态栏后忽略立刻到来的失焦/选区事件，避免卡片刚画出来就被关掉。 */
export const FLYOUT_DISMISS_GRACE_MS = 400;

export interface FlyoutVisibleRange {
  readonly start: { readonly line: number };
  readonly end: { readonly line: number };
}

/** 卡片锚在当前视口最后一行：VS Code 不会给视口外的行创建 decoration DOM。 */
export function flyoutAnchorLine(
  visibleRanges: readonly FlyoutVisibleRange[],
  lineCount: number,
): number {
  const last = visibleRanges[visibleRanges.length - 1];
  if (last) return Math.max(0, last.end.line);
  return Math.max(0, lineCount - 1);
}

export type FlyoutLayoutMode = 'notebook-cell' | 'file';

/**
 * Jupyter 单元格文档很短：`bottom` 相对这一格，能钉在格子右下角（状态栏 Silk Math 上头）。
 * 普通长文件不能用 bottom，否则会跑到文档末尾视口外；改锚在最后可见行上方。
 */
export function buildStatusFlyoutDecorationCss(mode: FlyoutLayoutMode = 'file'): string {
  const common = [
    'none',
    'position: absolute',
    'left: auto',
    'right: 16px',
    'display: inline-block',
    'z-index: 20',
    'pointer-events: none',
    'line-height: 1',
    'border-radius: 8px',
    'box-shadow: 0 8px 24px rgba(0, 0, 0, 0.36)',
  ];
  if (mode === 'notebook-cell') {
    return [...common, 'top: auto', 'bottom: 8px', 'transform: none'].join('; ');
  }
  return [...common, 'top: auto', 'bottom: auto', 'transform: translateY(calc(-100% - 8px))'].join('; ');
}

/**
 * 编辑器 decoration 卡片已不再用于点击。点状态栏走工作台 hover。
 * 这份 SVG 只留给单测核对内容和 command 链接。
 */
export function buildStatusFlyoutSvg(state: StatusFlyoutState, dark: boolean): { readonly svg: string; readonly width: number; readonly height: number } {
  const palette = statusFlyoutPalette(dark);
  const width = FLYOUT_CARD_WIDTH;
  const height = 286;
  const percent = scaleToDisplayPercent(state.scale);
  const gauge = scaleGauge(state.scale);
  let status = 'Preview is on';
  if (state.snoozed) status = `Paused until ${state.snoozeUntilLabel ?? ''}`;
  else if (state.excluded) status = 'Excluded for this file';
  else if (!state.active) status = 'Not enabled for this file type';

  const yExclude = state.hasDocument ? 198 : 0;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" rx="8" fill="${palette.background}" stroke="${palette.border}"/>
<text x="14" y="26" font-size="13" font-weight="600" fill="${palette.foreground}">${PRODUCT_NAME}</text>
${svgLink(cmd('openSettings'), `<text x="${width - 20}" y="26" text-anchor="end" font-size="14" fill="${palette.muted}">⚙</text>`)}
<text x="14" y="46" font-size="11" fill="${palette.muted}">${xmlEscape(status)}</text>
<text x="14" y="72" font-size="11" fill="${palette.muted}">Preview size</text>
<text x="200" y="72" font-size="12" font-weight="600" fill="${palette.foreground}">${percent}%</text>
${svgButton(14, 82, 28, 22, '−', cmd('decreasePreviewScale'), palette)}
${svgButton(48, 82, 28, 22, '+', cmd('increasePreviewScale'), palette)}
${svgButton(82, 82, 52, 22, 'Reset', cmd('resetPreviewScale'), palette)}
<text x="14" y="124" font-size="12" font-family="monospace" fill="${palette.foreground}">${xmlEscape(gauge)}</text>
<text x="14" y="148" font-size="11" fill="${palette.muted}">Where it runs</text>
${svgChip(14, 156, 72, 'LaTeX', state.enableInLatex, `${cmd('toggleLanguage')}?%5B%22enableInLatex%22%5D`, palette)}
${svgChip(92, 156, 88, 'Markdown', state.enableInMarkdown, `${cmd('toggleLanguage')}?%5B%22enableInMarkdown%22%5D`, palette)}
${svgChip(186, 156, 68, 'Other', state.enableInOtherFiles, `${cmd('toggleLanguage')}?%5B%22enableInOtherFiles%22%5D`, palette)}
${svgChip(state.hasDocument ? 142 : 14, 198, state.hasDocument ? 110 : 120, 'Defs', state.previewDefinitions, cmd('togglePreviewDefinitions'), palette)}
${state.hasDocument ? `${svgChip(14, yExclude, 120, state.excluded ? 'Un-exclude' : 'Exclude file', state.excluded, cmd('toggleExcludeFile'), palette)}` : ''}
${state.snoozed
    ? svgChip(14, 226, 100, 'Resume', false, `${cmd('snooze')}?%5B0%5D`, palette)
    : `${svgChip(14, 226, 88, 'Snooze 5m', false, `${cmd('snooze')}?%5B5%5D`, palette)}${svgChip(108, 226, 96, 'Snooze 30m', false, `${cmd('snooze')}?%5B30%5D`, palette)}`}
${state.ocrEnabled ? svgChip(14, 254, 88, 'OCR', false, cmd('ocr.capture'), palette) : ''}
${svgChip(state.ocrEnabled ? 108 : 14, 254, 72, 'Settings', false, cmd('openSettings'), palette)}
</svg>`;
  return { svg, width, height };
}
