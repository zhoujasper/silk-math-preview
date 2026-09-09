import { afterEach, describe, expect, it, vi } from 'vitest';
import { OcrCanvas } from '../src/ocr/nodeCanvas';

const state = vi.hoisted(() => ({ sequences: [] as string[], creates: 0, encodes: 0, tensors: 0, disposed: 0, noEos: false, lowConfidence: false }));
vi.mock('onnxruntime-web', () => {
  class Tensor {
    constructor(public type: string, public data: Float32Array | BigInt64Array, public dims: number[]) { state.tensors++; }
    dispose(): void { state.disposed++; }
  }
  return {
    Tensor,
    InferenceSession: { create: vi.fn(async () => {
      const encoder = state.creates++ % 2 === 0;
      return {
        outputNames: [encoder ? 'hidden' : 'logits'], release: vi.fn(async () => undefined),
        run: vi.fn(async (input: Record<string, Tensor>) => {
          if (encoder) { state.encodes++; return { hidden: new Tensor('float32', new Float32Array([1]), [1, 1, 1]) }; }
          const length = input.input_ids!.dims[1]!;
          const vocab = 20, logits = new Float32Array(length * vocab).fill(-20);
          const token = length === 1 || state.noEos ? Math.min(9 + state.encodes, 10 + state.sequences.length - 1) : 2;
          logits[(length - 1) * vocab + token] = 10;
          if (state.lowConfidence) logits[(length - 1) * vocab + 3] = 9.99;
          return { logits: new Tensor('float32', logits, [1, length, vocab]) };
        }),
      };
    }) },
  };
});
import { FormulaEngine } from '../src/ocr/formulaEngine';

afterEach(() => { vi.unstubAllGlobals(); });

function setup(sequences: string[], blank = false): { engine: FormulaEngine; image: HTMLCanvasElement } {
  Object.assign(state, { sequences, creates: 0, encodes: 0, tensors: 0, disposed: 0, noEos: false, lowConfidence: false });
  vi.stubGlobal('HTMLCanvasElement', OcrCanvas);
  vi.stubGlobal('OffscreenCanvas', OcrCanvas);
  vi.stubGlobal('document', { createElement: () => new OcrCanvas() });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    model: { vocab: Object.fromEntries(sequences.map((text, index) => [text.replaceAll(' ', 'Ġ'), 10 + index])) },
    added_tokens: [{ id: 2, special: true }],
  }))));
  const image = new OcrCanvas(100, 50);
  const ctx = image.getContext(); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 100, 50);
  if (!blank) { ctx.fillStyle = 'black'; ctx.fillRect(20, 15, 20, 15); }
  return { image: image as unknown as HTMLCanvasElement, engine: new FormulaEngine({ encoder: 'encoder', decoder: 'decoder', tokenizer: 'tokenizer' }) };
}

describe('公式推理候选与结果状态', () => {
  it('正常识别只跑一次，重复使用会话，每次及时释放输入/输出张量', async () => {
    const { engine, image } = setup(['x=1']);
    try {
      expect(await engine.recognize(image)).toMatchObject({ latex: 'x=1', ok: true });
      expect(state.encodes).toBe(1); expect(state.creates).toBe(2);
      await engine.recognize(image);
      expect(state.encodes).toBe(2); expect(state.creates).toBe(2);
      expect(state.disposed).toBe(state.tensors);
    } finally { await engine.dispose(); }
  });
  it('空白图在加载模型之前返回空结果', async () => {
    const { engine, image } = setup([], true);
    expect(await engine.recognize(image)).toMatchObject({ latex: '', ok: false });
    expect(state.creates).toBe(0); expect(fetch).not.toHaveBeenCalled();
  });
  it('孤立横线触发一次重识别，采用完整公式而非错误包装', async () => {
    const { engine, image } = setup([String.raw`\hline x=1`, String.raw`x=1,\quad x\neq0`]);
    try {
      expect(await engine.recognize(image)).toMatchObject({ latex: String.raw`x=1,\quad x\neq0`, ok: true });
      expect(state.encodes).toBe(2); expect(state.disposed).toBe(state.tensors);
    } finally { await engine.dispose(); }
  });
  it('可疑空表格优先重新识别补全条件，双次失败才返回提取内容并标复核', async () => {
    const shell = String.raw`\begin{array}{cc}{}&{}\\{}&{}\\{Av=\lambda v,}&{}\\\end{array}`;
    const { engine, image } = setup([shell, String.raw`Av=\lambda v,\quad v\ne0`]);
    try {
      expect(await engine.recognize(image)).toMatchObject({ latex: String.raw`Av=\lambda v,\quad v\ne0`, ok: true });
      expect(state.encodes).toBe(2);
    } finally { await engine.dispose(); }
    const failed = setup([shell]);
    try {
      expect(await failed.engine.recognize(failed.image)).toMatchObject({ latex: String.raw`Av=\lambda v,`, ok: false });
      expect(state.encodes).toBe(2);
    } finally { await failed.engine.dispose(); }
  });
  it('真实数组与矩阵不会触发重识别或丢掉行列', async () => {
    const latex = String.raw`\begin{array}{cc}a&b\\c&d\end{array}`;
    const { engine, image } = setup([latex]);
    try {
      expect(await engine.recognize(image)).toMatchObject({ latex, ok: true });
      expect(state.encodes).toBe(1);
    } finally { await engine.dispose(); }
  });
  it('低置信度只多试一次；重复输出/无 EOS 不能标成功，所有张量释放', async () => {
    const { engine, image } = setup(['x=1']); state.lowConfidence = true;
    try {
      expect((await engine.recognize(image)).ok).toBe(false);
      expect(state.encodes).toBe(2);
      state.noEos = true;
      expect((await engine.recognize(image)).ok).toBe(false);
      expect(state.encodes).toBe(4); expect(state.disposed).toBe(state.tensors);
    } finally { await engine.dispose(); }
  });
});
