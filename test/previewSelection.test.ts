import { describe, expect, it } from 'vitest';

import { decidePreviewSelection, shouldRetainLastPreviewFrame } from '../src/core/previewSelection';
import { buildPreviewExpression, PREVIEW_CARET_TEX } from '../src/core/previewExpression';
import { findMathRegionAt, scanMathRegions } from '../src/core/mathScanner';

const source = String.raw`before $a+b$ mid $c+d$ after
overlay only`;

function regionAt(offset: number) {
  const region = findMathRegionAt(scanMathRegions(source).regions, offset);
  if (!region) throw new Error(`offset ${offset} 不在公式内`);
  return region;
}

describe('decidePreviewSelection', () => {
  const first = regionAt(source.indexOf('a+b'));
  const second = regionAt(source.indexOf('c+d'));
  const overlay = { startLine: 0, endLine: 1 };

  it('鼠标点在当前公式内立刻按新 offset 更新，即使落在浮层盖住的行上', () => {
    const offset = source.indexOf('a+b') + 2;
    expect(decidePreviewSelection({
      kind: 'mouse',
      offset,
      offsetLine: 0,
      currentRegion: first,
      hitRegion: first,
      overlay,
    })).toBe('update-at-offset');
    const expression = buildPreviewExpression(source, first, offset).expression;
    expect(expression).toBe(`a+${PREVIEW_CARET_TEX}b`);
  });

  it('鼠标点在浮层盖住的另一条公式上切换区域', () => {
    const offset = source.indexOf('c');
    expect(decidePreviewSelection({
      kind: 'mouse',
      offset,
      offsetLine: 0,
      currentRegion: first,
      hitRegion: second,
      overlay,
    })).toBe('switch-region');
    const expression = buildPreviewExpression(source, second, offset).expression;
    expect(expression).toBe(`${PREVIEW_CARET_TEX}c+d`);
  });

  it('鼠标点在浮层盖住、且没有公式的行上保持预览', () => {
    expect(decidePreviewSelection({
      kind: 'mouse',
      offset: source.indexOf('overlay'),
      offsetLine: 1,
      currentRegion: first,
      overlay,
    })).toBe('keep-without-clear');
  });

  it('离开公式且不在浮层上则清空', () => {
    expect(decidePreviewSelection({
      kind: 'keyboard',
      offset: source.indexOf('before'),
      offsetLine: 0,
      currentRegion: first,
      overlay,
    })).toBe('clear');
  });
});

describe('shouldRetainLastPreviewFrame', () => {
  it('同一区域已有成功帧时后续失败保留，换公式则不保留', () => {
    expect(shouldRetainLastPreviewFrame({ hasVisibleFrame: true, sameRegion: true })).toBe(true);
    expect(shouldRetainLastPreviewFrame({ hasVisibleFrame: true, sameRegion: false })).toBe(false);
    expect(shouldRetainLastPreviewFrame({ hasVisibleFrame: false, sameRegion: true })).toBe(false);
  });
});
