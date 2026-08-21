import { describe, expect, it } from 'vitest';

import {
  floatingPreviewLayout,
  notebookPreviewSpacerCss,
  notebookPreviewSpacerPx,
  normalizePreviewPlacement,
  previewOverlayOccupiedLines,
  resolveEditorMetrics,
  resolvePreviewAnchor,
  resolvePreviewHorizontalLayout,
  resolvePreviewPlacement,
  resolvePreviewRangeStart,
  visibleColumnOf,
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

describe('resolvePreviewPlacement', () => {
  const nearBottom = {
    preferred: 'below',
    formulaStartLine: 10,
    formulaEndLine: 12,
    documentLineCount: 13,
    previewHeightPx: 48,
    lineHeightPx: 19,
  } as const;

  it('始终尊重用户的 below，单元格也不再自动翻到上方', () => {
    expect(resolvePreviewPlacement({ ...nearBottom, clipOverflow: false })).toBe('below');
    expect(resolvePreviewPlacement({ ...nearBottom, clipOverflow: true })).toBe('below');
  });

  it('用户显式选 above 时才在上方', () => {
    expect(resolvePreviewPlacement({
      preferred: 'above',
      formulaStartLine: 0,
      formulaEndLine: 1,
      documentLineCount: 40,
      previewHeightPx: 40,
      lineHeightPx: 19,
      clipOverflow: true,
    })).toBe('above');
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
    expect(layout.textDecoration).toContain('padding: 0.06em 0.12em');
    expect(layout.textDecoration).toContain('border-radius: 8px');
    expect(layout.textDecoration).toContain('rgba(15, 23, 42, 0.22)');
    expect(layout.textDecoration).toContain('overflow-x: visible');
    expect(layout.textDecoration).toContain('left: 0px');
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

describe('preview horizontal layout', () => {
  it('decoration 从公式起点开始，不从行首', () => {
    expect(resolvePreviewRangeStart({
      formulaStartLine: 4,
      formulaStartCharacter: 18,
      anchorLine: 4,
    })).toEqual({ line: 4, character: 18 });
    expect(resolvePreviewRangeStart({
      formulaStartLine: 2,
      formulaStartCharacter: 8,
      anchorLine: 5,
    })).toEqual({ line: 5, character: 0 });
  });

  it('tab 按 tabSize 展开成可见列', () => {
    expect(visibleColumnOf('\t$x$', 1, 4)).toBe(4);
    expect(visibleColumnOf('  $x$', 2, 4)).toBe(2);
  });

  it('预览以公式水平中心为准向两侧变宽', () => {
    // 列 10–20，字号 14，列宽 8.4px → 中心 126px。预览 40px 时 left = 106。
    expect(resolvePreviewHorizontalLayout({
      previewWidthPx: 40,
      previewHeightPx: 20,
      startColumn: 10,
      endColumn: 20,
      fontSizePx: 14,
      viewportWidthPx: 800,
    })).toEqual({
      leftPx: 106,
      boxWidthPx: 40,
      boxHeightPx: 20,
      overflowX: 'visible',
      overflowY: 'hidden',
    });
  });

  it('贴到左缘或右缘，但不超出视口', () => {
    const leftEdge = resolvePreviewHorizontalLayout({
      previewWidthPx: 80,
      previewHeightPx: 20,
      startColumn: 0,
      endColumn: 2,
      fontSizePx: 14,
      viewportWidthPx: 400,
    });
    expect(leftEdge.leftPx).toBe(0);
    expect(leftEdge.overflowX).toBe('visible');

    const rightEdge = resolvePreviewHorizontalLayout({
      previewWidthPx: 120,
      previewHeightPx: 20,
      startColumn: 70,
      endColumn: 80,
      fontSizePx: 10,
      viewportWidthPx: 500,
    });
    expect(rightEdge.leftPx + 120).toBeLessThanOrEqual(500);
    expect(rightEdge.leftPx).toBeGreaterThan(0);
    expect(rightEdge.overflowX).toBe('visible');
  });

  it('比视口更宽时横向滚动，比最大高度更高时纵向滚动', () => {
    const wide = resolvePreviewHorizontalLayout({
      previewWidthPx: 900,
      previewHeightPx: 40,
      startColumn: 20,
      endColumn: 30,
      fontSizePx: 14,
      viewportWidthPx: 400,
    });
    expect(wide.leftPx).toBe(0);
    expect(wide.overflowX).toBe('auto');
    expect(wide.boxWidthPx).toBe(400);

    const tall = resolvePreviewHorizontalLayout({
      previewWidthPx: 80,
      previewHeightPx: 400,
      startColumn: 10,
      endColumn: 20,
      fontSizePx: 14,
      viewportWidthPx: 800,
      maxHeightPx: 120,
    });
    expect(tall.overflowY).toBe('auto');
    expect(tall.boxHeightPx).toBe(120);
    expect(tall.overflowX).toBe('visible');
  });

  it('可滚动时用细滚动条、轨道透明', () => {
    const layout = floatingPreviewLayout({
      widthPx: 900,
      heightPx: 40,
      lineHeightPx: 19,
      lineSpan: 1,
      overflowX: 'auto',
      boxWidthPx: 400,
      theme: 'dark',
    });
    expect(layout.textDecoration).toContain('scrollbar-width: thin');
    expect(layout.textDecoration).toContain('scrollbar-color: rgba(255, 255, 255, 0.32) transparent');
    expect(layout.textDecoration).toContain('overscroll-behavior: contain');
    expect(layout.textDecoration).toContain('pointer-events: auto');
  });

  it('Jupyter 撑高锚点行，预览高度全部算进行盒，避免被下一格裁掉', () => {
    const height = notebookPreviewSpacerPx(48, 19);
    expect(height).toBeGreaterThanOrEqual(19 + 2 + 48);
    expect(height).toBe(19 + 2 + 48 + 8);
    const css = notebookPreviewSpacerCss(height);
    expect(css).toContain(`height: ${height}px`);
    expect(css).toContain('display: inline-block');
    expect(css).toContain('vertical-align: top');
    expect(css).toContain('visibility: hidden');
    expect(notebookPreviewSpacerPx(Number.NaN, 0)).toBeGreaterThan(0);
  });

  it('notebook 不传最大高度时不截断预览高度', () => {
    const full = resolvePreviewHorizontalLayout({
      previewWidthPx: 80,
      previewHeightPx: 400,
      startColumn: 10,
      endColumn: 20,
      fontSizePx: 14,
      viewportWidthPx: 800,
      maxHeightPx: 0,
    });
    expect(full.boxHeightPx).toBe(400);
    expect(full.overflowY).toBe('hidden');
  });

  it('浮层盖住的源码行包含公式下方滚动条所在的行', () => {
    expect(previewOverlayOccupiedLines({
      formulaStartLine: 5,
      formulaEndLine: 12,
      anchorLine: 12,
      placement: 'below',
      previewHeightPx: 95,
      lineHeightPx: 19,
    })).toEqual({ start: 5, end: 18 });
    expect(previewOverlayOccupiedLines({
      formulaStartLine: 10,
      formulaEndLine: 10,
      anchorLine: 10,
      placement: 'above',
      previewHeightPx: 40,
      lineHeightPx: 20,
    }).start).toBeLessThan(10);
  });
});
