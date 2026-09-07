/// <reference lib="dom" />
import { FormulaEngine, type FormulaAssetUrls } from './formulaEngine';
import { cleanRecognizedLatex, composeMixedLines, lineShouldTryFormula, prefersWholeFormula, wrapLatex, type MixedOcrLine } from './ocrCompose';
import { expandRect, selectionHasArea, shouldInvertMeanLuma, unionRects, type ImageRect } from './imageMath';
import type { OcrMode, OcrResponse, OcrResult } from './protocol';

type PaddleService = import('ppu-paddle-ocr/web', { with: { 'resolution-mode': 'import' } }).PaddleOcrService;
type Progress = Extract<OcrResponse, { type: 'progress' }>;

export interface OcrAssets {
  readonly formula: FormulaAssetUrls;
  readonly text: { readonly detector: string; readonly recognizer: string; readonly dictionary: string };
}

function cropRect(source: HTMLCanvasElement, rect: ImageRect): HTMLCanvasElement {
  const padded = expandRect(rect, 0.16, source);
  const crop = document.createElement('canvas');
  crop.width = Math.max(1, Math.ceil(padded.width));
  crop.height = Math.max(1, Math.ceil(padded.height));
  const context = crop.getContext('2d')!;
  context.fillStyle = '#fff'; context.fillRect(0, 0, crop.width, crop.height);
  context.drawImage(source, padded.x, padded.y, padded.width, padded.height, 0, 0, crop.width, crop.height);
  return crop;
}

export function normalizeBackground(source: HTMLCanvasElement): void {
  const context = source.getContext('2d')!;
  const data = context.getImageData(0, 0, source.width, source.height);
  const pixels = data.data;
  let sum = 0;
  for (let i = 0; i < pixels.length; i += 4) sum += ((pixels[i] ?? 0) + (pixels[i + 1] ?? 0) + (pixels[i + 2] ?? 0)) / 3;
  if (!shouldInvertMeanLuma(sum / Math.max(1, pixels.length / 4))) return;
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 255 - (pixels[i] ?? 0); pixels[i + 1] = 255 - (pixels[i + 1] ?? 0); pixels[i + 2] = 255 - (pixels[i + 2] ?? 0);
  }
  context.putImageData(data, 0, 0);
}

export class OcrRecognizer {
  private readonly formula: FormulaEngine;
  private text: Promise<PaddleService> | undefined;
  constructor(private readonly assets: OcrAssets, private readonly report: (stage: Progress['stage'], ratio: number) => void) {
    this.formula = new FormulaEngine(assets.formula, (p) => report(p.stage === 'decoding' ? 'decoding' : 'models', p.completed / p.total));
  }
  private getText(): Promise<PaddleService> {
    this.text ??= (async () => {
      this.report('models', 0);
      const { PaddleOcrService } = await import('ppu-paddle-ocr/web');
      const service = new PaddleOcrService({
        model: { detection: this.assets.text.detector, recognition: this.assets.text.recognizer, charactersDictionary: this.assets.text.dictionary },
        processing: { engine: 'canvas-native' },
        debugging: { verbose: false, debug: false },
        detection: { maxSideLength: 1600, paddingHorizontal: 0.5, paddingVertical: 0.35 },
        session: { executionProviders: ['wasm'], graphOptimizationLevel: 'all', logSeverityLevel: 3 },
      });
      try { await service.initialize(); return service; }
      catch (error) { await service.destroy().catch(() => undefined); throw error; }
    })();
    return this.text;
  }
  async recognize(source: HTMLCanvasElement, mode: OcrMode): Promise<OcrResult> {
    normalizeBackground(source);
    if (mode === 'formula') {
      const result = await this.formula.recognize(source);
      return { text: wrapLatex(result.latex), ok: result.ok, mode };
    }
    const service = await this.getText();
    this.report('text', 0.5);
    const text = await service.recognize(source, { flatten: false, noCache: true, strategy: mode === 'auto' ? 'per-box' : 'per-line' });
    if (mode === 'text') return { text: text.text, ok: text.text.trim().length > 0, mode };
    // 统一顺序：文字完成后才进入公式，避免共享 WASM 会话的竞争和过高峰值内存。
    const whole = await this.formula.recognize(source);
    if (prefersWholeFormula(text.text, cleanRecognizedLatex(whole.latex), whole.ok)) {
      return { text: wrapLatex(whole.latex), ok: whole.ok, mode };
    }
    const lines: MixedOcrLine[] = [];
    let formulaLines = 0;
    for (const boxes of text.lines) {
      const line = boxes.map((box) => box.text).join(' ').trim();
      if (!line) continue;
      const rect = unionRects(boxes.map((box) => box.box));
      if (lineShouldTryFormula(line) && formulaLines < 8 && rect && selectionHasArea(rect, 8)) {
        formulaLines++;
        const result = await this.formula.recognize(cropRect(source, rect));
        if (result.ok && cleanRecognizedLatex(result.latex)) {
          lines.push({ text: line, latex: result.latex, useFormula: true }); continue;
        }
      }
      lines.push({ text: line, useFormula: false });
    }
    const mixed = composeMixedLines(lines) || text.text || (whole.ok ? wrapLatex(whole.latex) : '');
    return { text: mixed, ok: mixed.trim().length > 0, mode };
  }
}
