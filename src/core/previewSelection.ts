/**
 * 选区与失败帧策略：只以源码公式命中为准，所有输入方式行为一致。
 */

export type PreviewSelectionAction =
  | 'update-at-offset'
  | 'switch-region'
  | 'clear';

export interface RegionSpan {
  readonly start: number;
  readonly end: number;
}

export interface PreviewSelectionInput {
  readonly currentRegion?: RegionSpan;
  readonly hitRegion?: RegionSpan;
}

function sameRegion(left: RegionSpan, right: RegionSpan): boolean {
  return left.start === right.start && left.end === right.end;
}

/** 预览不接收鼠标事件；落到它下面的非公式源码也是离开公式。 */
export function decidePreviewSelection(input: PreviewSelectionInput): PreviewSelectionAction {
  if (input.hitRegion) {
    if (input.currentRegion && sameRegion(input.hitRegion, input.currentRegion)) {
      return 'update-at-offset';
    }
    return 'switch-region';
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
