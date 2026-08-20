export interface TextRange {
  /** UTF-16 offset，包含。 */
  readonly start: number;
  /** UTF-16 offset，不包含。 */
  readonly end: number;
}

export type MathLanguage = 'latex' | 'markdown';

export type MathRegionKind =
  | 'dollar-inline'
  | 'dollar-display'
  | 'paren-inline'
  | 'bracket-display'
  | 'environment';

export type MathRecoveryReason =
  | 'unclosed-inline-delimiter'
  | 'unclosed-display-delimiter'
  | 'unclosed-environment';

export interface MathRecovery {
  readonly reason: MathRecoveryReason;
  /** 扫描器为避免吞掉后续文档而选择的恢复边界。 */
  readonly boundary: number;
}

export interface MathRegion extends TextRange {
  readonly kind: MathRegionKind;
  readonly contentStart: number;
  readonly contentEnd: number;
  readonly opener: string;
  readonly closer: string;
  readonly closed: boolean;
  readonly environment?: string;
  readonly recovery?: MathRecovery;
}

export interface MathScanOptions {
  readonly language?: MathLanguage;
  readonly customMathEnvironments?: readonly string[];
  /** 有界 Markdown 片段起点已经位于 fenced code 内时的继承状态。 */
  readonly markdownInitialFence?: MarkdownFenceState;
  /** 未闭合块公式最多占用的 UTF-16 字符数。 */
  readonly recoveryWindowChars?: number;
}

export interface MarkdownFenceState {
  readonly marker: '`' | '~';
  readonly length: number;
}

export interface MathScanResult {
  readonly regions: readonly MathRegion[];
  /** Markdown 代码和 LaTeX 注释等不会参与公式识别的区间。 */
  readonly ignoredRanges: readonly TextRange[];
}

export type CaretAnchorReason =
  | 'exact'
  | 'out-of-range'
  | 'control-sequence'
  | 'left-right-head'
  | 'environment-head'
  | 'command-argument-seam'
  | 'script-argument-seam';

export interface CaretAnchor {
  readonly requestedOffset: number;
  readonly offset: number;
  readonly exact: boolean;
  readonly reason: CaretAnchorReason;
  readonly unsafeRange?: TextRange;
}

export interface TextEdit {
  readonly range: TextRange;
  readonly newText: string;
}

export interface DiagnosticFix {
  readonly title: string;
  readonly edits: readonly TextEdit[];
  readonly preferred?: boolean;
}

export type DiagnosticSeverity = 'error' | 'warning' | 'information';

export type MathDiagnosticCode =
  | 'unexpected-closing-brace'
  | 'unclosed-group'
  | 'unmatched-left'
  | 'unmatched-right'
  | 'unexpected-end-environment'
  | 'mismatched-environment'
  | 'unclosed-environment'
  | 'dangling-script'
  | 'command-typo';

export interface MathDiagnostic {
  readonly code: MathDiagnosticCode;
  readonly message: string;
  readonly severity: DiagnosticSeverity;
  readonly range: TextRange;
  readonly fixes: readonly DiagnosticFix[];
}

export interface DiagnosticOptions {
  /** 将返回的诊断和修复区间整体平移，便于映射回文档。 */
  readonly offset?: number;
  /** 在内置高置信表之外追加 typo -> command 映射，不包含反斜杠。 */
  readonly commandTypos?: Readonly<Record<string, string>>;
}

export type CompletionKind = 'command' | 'environment';

export interface CompletionEntry {
  readonly label: string;
  readonly insertText: string;
  readonly kind: CompletionKind;
  readonly detail: string;
}

export interface CompletionCatalogOptions {
  readonly customCommands?: readonly string[];
  readonly customEnvironments?: readonly string[];
}
