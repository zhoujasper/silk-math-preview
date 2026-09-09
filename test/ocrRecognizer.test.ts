import { afterEach, describe, expect, it, vi } from 'vitest';
import { OcrCanvas } from '../src/ocr/nodeCanvas';
const fake = vi.hoisted(() => ({ formula: { latex: '', ok: false, hasTableGrid: false }, text: 'x y\n1 2', calls: 0 }));
vi.mock('../src/ocr/formulaEngine', () => ({ FormulaEngine: class { async recognize() { fake.calls++; return fake.formula; } } }));
vi.mock('ppu-paddle-ocr/web', () => ({ PaddleOcrService: class {
  async initialize() {} async destroy() {}
  async recognize() { return { text: fake.text, lines: [] }; }
} }));
import { OcrRecognizer } from '../src/ocr/ocrRecognizer';
afterEach(() => vi.unstubAllGlobals());
function recognizer() {
  fake.calls = 0;
  const image = new OcrCanvas(40, 30);
  image.getContext().fillStyle = 'white'; image.getContext().fillRect(0, 0, 40, 30);
  const engine = new OcrRecognizer({ formula: { encoder: '', decoder: '', tokenizer: '' }, text: { detector: '', recognizer: '', dictionary: '' } }, () => undefined);
  return { engine, image: image as unknown as HTMLCanvasElement };
}
describe('智能模式与真实表格', () => {
  it('表格需要复核时不退化成打散的纯文字，状态一直传到界面', async () => {
    fake.formula = { latex: String.raw`\begin{array}{ccc}x&y\\1&2\end{array}`, ok: false, hasTableGrid: true };
    const { engine, image } = recognizer();
    const result = await engine.recognize(image, 'auto');
    expect(result.ok).toBe(false); expect(result.text).toContain(fake.formula.latex); expect(fake.calls).toBe(1);
  });
  it('普通公式模式使用完整的新公式结果，文字模式不运行公式模型', async () => {
    fake.formula = { latex: String.raw`Av=\lambda v,\quad v\ne0`, ok: true, hasTableGrid: false };
    const { engine, image } = recognizer();
    expect((await engine.recognize(image, 'formula')).text).toContain(fake.formula.latex);
    fake.text = 'Hello world 123';
    expect(await engine.recognize(image, 'text')).toEqual({ text: fake.text, mode: 'text', ok: true });
    expect(fake.calls).toBe(1);
  });
});
