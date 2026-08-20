import { describe, expect, it } from 'vitest';
import { decodeFormulaTokenIds, prepareFormulaTokenizer } from '../src/ocr/formulaEngine.js';
import { clientPointToImage, normalizeImageSelection, selectionHasArea } from '../src/ocr/imageMath.js';

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
