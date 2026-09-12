import type { MathRegion } from './types';

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
  readonly kind: MathRegion['kind'];
  readonly opener: string;
  readonly environment?: string;
}

export interface PreviewSelectionInput {
  readonly currentRegion?: RegionSpan;
  readonly hitRegion?: RegionSpan;
}

export function samePreviewRegion(left: RegionSpan, right: RegionSpan): boolean {
  // The closing boundary changes on every edit, including an unfinished closer.
  // Identity follows the opening token; offsets are rebased by the document event.
  return left.start === right.start && left.kind === right.kind
    && left.opener === right.opener && left.environment === right.environment;
}

/** 非公式源码选区立即关闭；公式内部编辑不清空上一帧。 */
export function decidePreviewSelection(input: PreviewSelectionInput): PreviewSelectionAction {
  if (input.hitRegion) {
    if (input.currentRegion && samePreviewRegion(input.hitRegion, input.currentRegion)) {
      return 'update-at-offset';
    }
    return 'switch-region';
  }
  return 'clear';
}

/** Changes use offsets in the document before the whole edit transaction. */
export function rebasePreviewRegion(region: MathRegion, changes: readonly {
  readonly rangeOffset: number;
  readonly rangeLength: number;
  readonly text: string;
}[]): MathRegion | undefined {
  for (const change of changes) {
    const start = change.rangeOffset;
    const end = start + change.rangeLength;
    // Replacing/removing an opener starts a new preview session, even if the
    // replacement happens to contain an identical token at the same offset.
    if ((change.rangeLength > 0 && start < region.contentStart && end > region.start)
      || (change.rangeLength === 0 && start > region.start && start < region.contentStart)) return undefined;
  }
  const move = (offset: number, right: boolean): number => {
    let delta = 0;
    for (const change of changes) {
      const start = change.rangeOffset;
      const end = start + change.rangeLength;
      if (end < offset || (end === offset && (change.rangeLength > 0 || right))) {
        delta += change.text.length - change.rangeLength;
      } else if (start < offset) {
        delta += start - offset + (right ? change.text.length : 0);
      }
    }
    return offset + delta;
  };
  return {
    ...region,
    start: move(region.start, true),
    end: move(region.end, !region.closed),
    contentStart: move(region.contentStart, false),
    contentEnd: move(region.contentEnd, true),
    ...(region.recovery ? { recovery: { ...region.recovery, boundary: move(region.recovery.boundary, true) } } : {}),
  };
}

/** 当前公式已经有成功帧时，后续失败不得清掉它。 */
export function shouldRetainLastPreviewFrame(input: {
  readonly hasVisibleFrame: boolean;
  readonly sameRegion: boolean;
}): boolean {
  return input.hasVisibleFrame && input.sameRegion;
}
