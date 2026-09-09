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

  it('鼠标点在当前公式内立刻按新 offset 更新，即使落在浮层盖住的行上', () => {
    const offset = source.indexOf('a+b') + 2;
    expect(decidePreviewSelection({
      currentRegion: first,
      hitRegion: first,
    })).toBe('update-at-offset');
    const expression = buildPreviewExpression(source, first, offset).expression;
    expect(expression).toBe(`a+${PREVIEW_CARET_TEX}b`);
  });

  it('鼠标点在浮层盖住的另一条公式上切换区域', () => {
    const offset = source.indexOf('c');
    expect(decidePreviewSelection({
      currentRegion: first,
      hitRegion: second,
    })).toBe('switch-region');
    const expression = buildPreviewExpression(source, second, offset).expression;
    expect(expression).toBe(`${PREVIEW_CARET_TEX}c+d`);
  });

  it('没有命中源码公式时清空，不再按浮层位置保留', () => {
    expect(decidePreviewSelection({
      currentRegion: first,
    })).toBe('clear');
  });

  it('未显示过公式时也保持清空', () => {
    expect(decidePreviewSelection({})).toBe('clear');
  });
});

describe('shouldRetainLastPreviewFrame', () => {
  it('同一区域已有成功帧时后续失败保留，换公式则不保留', () => {
    expect(shouldRetainLastPreviewFrame({ hasVisibleFrame: true, sameRegion: true })).toBe(true);
    expect(shouldRetainLastPreviewFrame({ hasVisibleFrame: true, sameRegion: false })).toBe(false);
    expect(shouldRetainLastPreviewFrame({ hasVisibleFrame: false, sameRegion: true })).toBe(false);
  });
});
