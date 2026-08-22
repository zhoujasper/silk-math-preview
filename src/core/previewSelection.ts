/**
 * 鼠标点选与失败帧策略。预览控制器和测试走同一份判断：
 * 光标落在公式里就更新；浮层盖住的非公式行（滚动条）才保持。
 */

export type SelectionChangeKind = 'mouse' | 'keyboard' | 'command' | 'unknown';

export type PreviewSelectionAction =
  | 'update-at-offset'
  | 'switch-region'
  | 'keep-without-clear'
  | 'clear';

export interface RegionSpan {
  readonly start: number;
  readonly end: number;
}

export interface OverlayLines {
  readonly startLine: number;
  readonly endLine: number;
}

export interface PreviewSelectionInput {
  readonly kind: SelectionChangeKind;
  readonly offset: number;
  readonly offsetLine: number;
  readonly currentRegion?: RegionSpan;
  readonly hitRegion?: RegionSpan;
  readonly overlay?: OverlayLines;
}

function sameRegion(left: RegionSpan, right: RegionSpan): boolean {
  return left.start === right.start && left.end === right.end;
}

function overlayContains(overlay: OverlayLines | undefined, line: number): boolean {
  return overlay !== undefined && line >= overlay.startLine && line <= overlay.endLine;
}

/**
 * 文档 offset 落在哪条公式优先于浮层占用行。
 * 只有鼠标点在浮层盖住、且那里没有公式的行上，才保持当前预览。
 */
export function decidePreviewSelection(input: PreviewSelectionInput): PreviewSelectionAction {
  if (input.hitRegion) {
    if (input.currentRegion && sameRegion(input.hitRegion, input.currentRegion)) {
      return 'update-at-offset';
    }
    return 'switch-region';
  }
  if (input.kind === 'mouse' && overlayContains(input.overlay, input.offsetLine)) {
    return 'keep-without-clear';
  }
  return 'clear';
}

/** 当前公式已经有成功帧时，后续失败不得清掉它。 */
export function shouldRetainLastPreviewFrame(input: {
  readonly hasVisibleFrame: boolean;
  readonly sameRegion: boolean;
}): boolean {
  return input.hasVisibleFrame && input.sameRegion;
}
