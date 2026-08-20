import { describe, expect, it } from 'vitest';
import { decodeFormulaTokenIds, prepareFormulaTokenizer } from '../src/ocr/formulaEngine.js';
import {
  clientPointToImage,
  computeLetterbox,
  expandRect,
  normalizeImageSelection,
  selectionHasArea,
  shouldInvertMeanLuma,
  unionRects,
} from '../src/ocr/imageMath.js';
import {
  cleanRecognizedLatex,
  composeMixedLines,
  formulaLikeness,
  lineShouldTryFormula,
  prefersWholeFormula,
  wrapLatex,
} from '../src/ocr/ocrCompose.js';

describe('公式 ByteLevel-BPE 解码', () => {
  it('恢复 ASCII、空格和 UTF-8 字符并忽略 special token', () => {
    // GPT-2 ByteLevel 映射中空格字节 32 -> Ġ，UTF-8 的两个字节可逐一映射。
    const tokenizer = prepareFormulaTokenizer({
      model: { vocab: { x: 0, 'Ġ': 1, '+': 2, 'Ã': 3, '©': 4, ignored: 9 } },
      added_tokens: [{ id: 9, special: true }],
    });
    expect(decodeFormulaTokenIds(tokenizer, [0, 1, 2, 1, 3, 4, 9])).toBe('x + é');
  });

  it('未知 token 不污染输出', () => {
    const tokenizer = prepareFormulaTokenizer({ model: { vocab: { '\\': 1, alpha: 2 } } });
    expect(decodeFormulaTokenIds(tokenizer, [1, 2, 999])).toBe('\\alpha');
  });
});

describe('截图坐标与选区', () => {
  it('把缩放后的 CSS 坐标映射到原图像素并限制越界', () => {
    expect(clientPointToImage(
      { x: 150, y: 100 },
      { x: 50, y: 50, width: 200, height: 100 },
      { width: 1000, height: 500 },
    )).toEqual({ x: 500, y: 250 });
    expect(clientPointToImage(
      { x: -20, y: 999 },
      { x: 50, y: 50, width: 200, height: 100 },
      { width: 1000, height: 500 },
    )).toEqual({ x: 0, y: 500 });
  });

  it('规范化反向拖拽并裁剪到图片边界', () => {
    expect(normalizeImageSelection(
      { x: 90, y: 70 },
      { x: -10, y: 20 },
      { width: 80, height: 60 },
    )).toEqual({ x: 0, y: 20, width: 80, height: 40 });
  });

  it('拒绝过小选区', () => {
    expect(selectionHasArea({ x: 0, y: 0, width: 3.9, height: 10 })).toBe(false);
    expect(selectionHasArea({ x: 0, y: 0, width: 4, height: 4 })).toBe(true);
  });
});

describe('公式图预处理几何', () => {
  it('宽图按比例放进正方形并留白，不拉伸', () => {
    const box = computeLetterbox(400, 80, 384, 0.1);
    expect(box.width).toBeCloseTo(384 * 0.8, 5);
    expect(box.height).toBeCloseTo(61.44, 5);
    expect(box.x).toBeCloseTo((384 - box.width) / 2, 5);
    expect(box.y).toBeCloseTo((384 - box.height) / 2, 5);
  });

  it('深色截图需要反相，浅色不反相', () => {
    expect(shouldInvertMeanLuma(40)).toBe(true);
    expect(shouldInvertMeanLuma(200)).toBe(false);
  });

  it('行框向外扩一圈并限制在图内', () => {
    expect(expandRect({ x: 10, y: 10, width: 20, height: 10 }, 0.5, { width: 100, height: 40 })).toEqual({
      x: 0, y: 5, width: 40, height: 20,
    });
    expect(unionRects([
      { x: 0, y: 0, width: 10, height: 4 },
      { x: 8, y: 1, width: 6, height: 4 },
    ])).toEqual({ x: 0, y: 0, width: 14, height: 5 });
  });
});

describe('识别结果整理', () => {
  it('去掉模型输出的美元符号外壳并给长公式加上 display 包裹', () => {
    expect(cleanRecognizedLatex('$$\\frac{a}{b}$$')).toBe('\\frac{a}{b}');
    expect(wrapLatex('\\frac{1}{2} + \\int x\\,dx')).toContain('\\[');
    expect(wrapLatex('x+1', false)).toBe('$x+1$');
  });

  it('中文叙述不像公式，LaTeX 命令则像公式', () => {
    expect(formulaLikeness('Therefore we have for all integers')).toBeLessThan(0.35);
    expect(formulaLikeness('\\frac{a}{b} + u_m^{n+1}')).toBeGreaterThan(0.5);
    expect(lineShouldTryFormula('\\sum_{i=1}^n x_i = 0')).toBe(true);
    expect(prefersWholeFormula('u = v', '\\alpha + \\beta', true)).toBe(true);
    expect(prefersWholeFormula('因此我们得到下面的结论并且对所有整数都成立所以这是一段说明', '\\alpha', true)).toBe(false);
  });

  it('混排时公式行输出 LaTeX、文字行保持原文', () => {
    expect(composeMixedLines([
      { text: 'Therefore, we have', useFormula: false },
      { text: 'tau = ...', latex: 'x+y', useFormula: true },
      { text: 'as required.', useFormula: false },
    ])).toBe('Therefore, we have\n$x+y$\nas required.');
  });
});
