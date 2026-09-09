import { afterEach, describe, expect, it, vi } from 'vitest';
import { installCanvasGlobals, OcrCanvas } from '../src/ocr/nodeCanvas';
import { prepareFormulaImage } from '../src/ocr/formulaImage';
import { inspectFormula, tidyFormula, validFormulaStructure } from '../src/ocr/formulaStructure';

afterEach(() => vi.unstubAllGlobals());

function canvas(width: number, height: number, background = '#f0eeea'): HTMLCanvasElement {
  vi.stubGlobal('HTMLCanvasElement', OcrCanvas);
  vi.stubGlobal('OffscreenCanvas', OcrCanvas);
  vi.stubGlobal('document', { createElement: () => new OcrCanvas() });
  installCanvasGlobals();
  const image = new OcrCanvas(width, height);
  image.getContext().fillStyle = background;
  image.getContext().fillRect(0, 0, width, height);
  return image as unknown as HTMLCanvasElement;
}

describe('公式内容与背景预处理', () => {
  it.each(['#f0eeea', '#e1e1e1', '#ffffff', '#202020'])('裁掉 %s 背景的大留白，保留分开的右侧条件与单像素标点', background => {
    const image = canvas(800, 400, background), ctx = image.getContext('2d')!;
    ctx.fillStyle = background === '#202020' ? '#eeeeee' : '#222222';
    ctx.fillRect(210, 180, 30, 24); ctx.fillRect(460, 180, 40, 24); ctx.fillRect(507, 207, 1, 1);
    const prepared = prepareFormulaImage(image);
    expect(prepared.bounds).toEqual({ x: 210, y: 180, width: 298, height: 28 });
    expect(prepared.blank).toBe(false);
    expect(prepared.singleLine).toBe(true);
    const pixels = prepared.canvas.getContext('2d')!.getImageData(0, 0, prepared.canvas.width, prepared.canvas.height).data;
    expect([...pixels.slice(0, 4)]).toEqual([255, 255, 255, 255]);
    expect(image.width).toBe(800); // 不改写来源图片。
  });
  it('空白、低对比度、边缘字形和透明底都安全处理', () => {
    expect(prepareFormulaImage(canvas(30, 20)).blank).toBe(true);
    const low = canvas(40, 20, '#dddddd'), ctx = low.getContext('2d')!;
    ctx.fillStyle = '#b0b0b0'; ctx.fillRect(0, 6, 30, 8);
    const prepared = prepareFormulaImage(low);
    expect(prepared.bounds).toEqual({ x: 0, y: 6, width: 30, height: 8 });
    expect(prepared.canvas.getContext('2d')!.getImageData(4, 4, 1, 1).data[0]).toBe(0);
    const transparent = canvas(40, 20);
    transparent.getContext('2d')!.clearRect(0, 0, 40, 20);
    transparent.getContext('2d')!.fillStyle = 'black'; transparent.getContext('2d')!.fillRect(10, 5, 3, 7);
    expect(prepareFormulaImage(transparent).bounds).toEqual({ x: 10, y: 5, width: 3, height: 7 });
  });
  it('分数、多行与真实横线表格不被判定为普通单行公式', () => {
    const fraction = canvas(160, 100), ctx = fraction.getContext('2d')!;
    ctx.fillStyle = 'black'; ctx.fillRect(65, 20, 20, 14); ctx.fillRect(40, 44, 70, 1); ctx.fillRect(65, 54, 20, 14);
    expect(prepareFormulaImage(fraction).singleLine).toBe(false);
    expect(prepareFormulaImage(fraction).hasRules).toBe(false);
    ctx.fillRect(40, 12, 70, 1); ctx.fillRect(40, 74, 70, 1);
    const table = prepareFormulaImage(fraction);
    expect(table.hasRules).toBe(true); expect(table.singleLine).toBe(false);
    expect(table.gridColumns).toBeUndefined();
    ctx.fillRect(40, 12, 1, 63); ctx.fillRect(75, 12, 1, 63); ctx.fillRect(109, 12, 1, 63);
    expect(prepareFormulaImage(fraction).gridColumns).toBe(2);
  });
});

describe('OCR 结构校验与保守整理', () => {
  const reported = String.raw`\begin{array} { c c } { } & { } \\ { } & { } \\ \hline { } & { A \mathbf { v } = \lambda \mathbf { v } , } & { } \\ \hline { } & { } \\ \end{array}`;
  it('只在图像确认为单行时，提取用户报告的空表格中的公式；不凭空补写漏掉的条件', () => {
    const result = inspectFormula(reported, true);
    expect(result).toMatchObject({ valid: true, suspicious: true, simplified: true });
    expect(result.latex).toBe(String.raw`A\mathbf{v}=\lambda\mathbf{v},`);
    expect(result.latex).not.toContain('neq');
    expect(inspectFormula(reported, false).simplified).toBe(false);
  });
  it.each([
    String.raw`\begin{array}{cc}a&b\\c&d\end{array}`,
    String.raw`\begin{array}{|cc|}\hline {}&{}\\x&{}\\{}&{}\\\hline\end{array}`,
    String.raw`\begin{pmatrix}1&0\\0&1\end{pmatrix}`,
    String.raw`\left[\begin{array}{cc}{}&{}\\x&y\\{}&{}\\\end{array}\right]`,
    String.raw`\begin{cases}x^2&x>0\\0&x\le0\end{cases}`,
    String.raw`\begin{aligned}a&=b+c\\d&=e\end{aligned}`,
    String.raw`\begin{array}{cc}\multicolumn{2}{c}{title}\\x&y\end{array}`,
    String.raw`\begin{array}{cc}\frac{a}{b}&\begin{matrix}1&2\\3&4\end{matrix}\\x&y\end{array}`,
  ])('保留真实表格/矩阵/分段与对齐结构：%s', text => {
    const result = inspectFormula(text, true);
    expect(result).toMatchObject({ valid: true, suspicious: false, simplified: false });
    expect(result.latex).toBe(tidyFormula(text));
  });
  it.each([
    String.raw`\hline x=1`, String.raw`\begin{array}{c}x\end{matrix}`,
    String.raw`\frac{1}{2`, String.raw`x}y`, String.raw`\end{matrix}`, String.raw`a&b`,
  ])('异常输出不标成功：%s', text => expect(validFormulaStructure(text)).toBe(false));
  it('文字里的空格与转义符保持原义，整理可重复执行', () => {
    const text = String.raw`x _ { 1 } = \frac { a } { b } , \quad \text { for all x } + \{ x \} + \mathrm { kg }`;
    const cleaned = tidyFormula(text);
    expect(cleaned).toContain(String.raw`\text{ for all x }`);
    expect(cleaned.replaceAll(' ', '')).toContain(String.raw`\{x\}`);
    expect(cleaned).toContain(String.raw`x_{1}`);
    expect(tidyFormula(cleaned)).toBe(cleaned);
    expect(validFormulaStructure(cleaned)).toBe(true);
  });
  it('保留控制词与字母的边界及显式空格，压缩数字和运算符的 token 空白', () => {
    expect(tidyFormula(String.raw`x = - 0 . 5 , \quad y = 1 . 2 5 \times 1 0 ^ { - 3 }`)).toBe(String.raw`x=-0.5,\quad y=1.25\times10^{-3}`);
    expect(tidyFormula(String.raw`\alpha b + \sin x + a\ b`)).toBe(String.raw`\alpha b+\sin x+a\ b`);
  });
  it('表格列声明与实际行宽不一致时保留数据并标为可疑', () => {
    const text = String.raw`\begin{array}{|c|c|c|}\hline x&y\\1&2\\\end{array}`;
    expect(inspectFormula(text)).toMatchObject({ latex: text, valid: true, suspicious: true, simplified: false });
    const extraColumn = String.raw`\begin{array}{|c|c|c|}x&{}&{}\\{}&{}&{}\\\end{array}`;
    expect(inspectFormula(extraColumn, false, 2)).toMatchObject({ latex: extraColumn, suspicious: true, simplified: false });
  });
});
