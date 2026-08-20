import { describe, expect, it } from 'vitest';

import {
  floatingPreviewLayout,
  normalizePreviewPlacement,
  resolveEditorMetrics,
  resolvePreviewAnchor,
} from '../src/core/previewLayout';

describe('resolveEditorMetrics', () => {
  it('复刻 VS Code 的行高推导并给出 MathJax 的 ex 像素', () => {
    expect(resolveEditorMetrics(14, 0)).toEqual({ fontSizePx: 14, lineHeightPx: 19, exPx: 7 });
    expect(resolveEditorMetrics(12, 0, true)).toEqual({ fontSizePx: 12, lineHeightPx: 18, exPx: 6 });
    // 小于 8 的行高按字号倍数处理，其余按像素。
    expect(resolveEditorMetrics(16, 1.5).lineHeightPx).toBe(24);
    expect(resolveEditorMetrics(16, 30).lineHeightPx).toBe(30);
  });

  it('缺失或越界的配置回退到可用值', () => {
    expect(resolveEditorMetrics(undefined, undefined)).toEqual({
      fontSizePx: 14,
      lineHeightPx: 19,
      exPx: 7,
    });
    expect(resolveEditorMetrics(Number.NaN, -5).fontSizePx).toBe(14);
    expect(resolveEditorMetrics(500, 4000)).toEqual({ fontSizePx: 100, lineHeightPx: 150, exPx: 50 });
  });
});

describe('resolvePreviewAnchor', () => {
  it('锚在视口与公式重叠的最后一行，避免首行滚出屏幕后浮层被虚拟化', () => {
    expect(resolvePreviewAnchor({
      formulaStartLine: 105,
      formulaEndLine: 115,
      visibleStartLine: 109,
      visibleEndLine: 138,
    })).toEqual({ anchorLine: 115, lineSpan: 1 });
  });

  it('视口只看得到公式上半段时锚在可见的最后一行', () => {
    expect(resolvePreviewAnchor({
      formulaStartLine: 105,
      formulaEndLine: 115,
      visibleStartLine: 100,
      visibleEndLine: 110,
    })).toEqual({ anchorLine: 110, lineSpan: 1 });
  });

  it('above 锚在可见重叠的第一行', () => {
    expect(resolvePreviewAnchor({
      formulaStartLine: 105,
      formulaEndLine: 115,
      visibleStartLine: 109,
      visibleEndLine: 138,
      placement: 'above',
    })).toEqual({ anchorLine: 109, lineSpan: 1 });
  });
});

describe('floatingPreviewLayout', () => {
  const base = { widthPx: 383.34, heightPx: 40.75, lineHeightPx: 19, lineSpan: 1 } as const;

  it('默认与旧 after 设置均迁移到公式下方浮层', () => {
    expect(normalizePreviewPlacement(undefined)).toBe('below');
    expect(normalizePreviewPlacement('after')).toBe('below');
    const layout = floatingPreviewLayout({ ...base, placement: 'below', theme: 'light' });
    expect(layout).toMatchObject({
      placement: 'below',
      // 面板尺寸与 SVG 的像素尺寸完全一致，右侧与下沿都不会露出内容。
      width: '383.34px',
      height: '40.75px',
    });
    expect(layout.textDecoration).toContain('position: absolute');
    expect(layout.textDecoration).toContain('top: 21px');
    expect(layout.textDecoration).toContain('padding: 0.3em 0.45em');
    expect(layout.textDecoration).toContain('border-radius: 8px');
    expect(layout.textDecoration).toContain('rgba(15, 23, 42, 0.22)');
    expect(layout.textDecoration).toContain('overflow: visible');
    expect(layout.textDecoration).toContain('pointer-events: none');
    expect(layout.textDecoration).not.toContain('vertical-align');
    // 不再依赖 CSS 的 lh：伪元素自身的 line-height 会把它算成一个字号。
    expect(layout.textDecoration).not.toContain('lh');
  });

  it('下方浮层跨过公式占用的全部行', () => {
    const single = floatingPreviewLayout({ ...base, placement: 'below' });
    const environment = floatingPreviewLayout({ ...base, placement: 'below', lineSpan: 5 });
    expect(single.textDecoration).toContain('top: 21px');
    expect(environment.textDecoration).toContain('top: 97px');
  });

  it('above 与旧 before 设置使用上方浮层且只跨过首行', () => {
    expect(normalizePreviewPlacement('before')).toBe('above');
    const layout = floatingPreviewLayout({ ...base, lineSpan: 5, placement: 'above', theme: 'dark' });
    expect(layout.placement).toBe('above');
    expect(layout.textDecoration).toContain('bottom: 21px');
    expect(layout.textDecoration).not.toContain('top:');
    expect(layout.textDecoration).toContain('rgba(0, 0, 0, 0.55)');
  });

  it('异常尺寸回退到可见的最小面板且不引入文本流占位', () => {
    expect(floatingPreviewLayout({
      widthPx: Number.NaN,
      heightPx: -2,
      lineHeightPx: Number.NaN,
      lineSpan: Number.NaN,
      placement: 'invalid',
    })).toMatchObject({
      placement: 'below',
      width: '1px',
      height: '1px',
    });
    expect(floatingPreviewLayout({ ...base, placement: 'below', theme: 'high-contrast' }).textDecoration)
      .toContain('box-shadow: none');
  });
});
