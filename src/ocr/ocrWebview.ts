/// <reference lib="dom" />

import * as ort from 'onnxruntime-web';
import { FormulaEngine, type FormulaAssetUrls, type FormulaProgress } from './formulaEngine.js';
import {
  clientPointToImage,
  expandRect,
  normalizeImageSelection,
  selectionHasArea,
  shouldInvertMeanLuma,
  unionRects,
  type ImagePoint,
  type ImageRect,
} from './imageMath.js';
import {
  cleanRecognizedLatex,
  composeMixedLines,
  lineShouldTryFormula,
  prefersWholeFormula,
  wrapLatex,
  type MixedOcrLine,
} from './ocrCompose.js';
import type { OcrUiCopy } from '../core/uiLocale';

type OcrMode = 'auto' | 'formula' | 'text';
type PaddleOcrServiceInstance = import(
  'ppu-paddle-ocr/web',
  { with: { 'resolution-mode': 'import' } }
).PaddleOcrService;

export interface OcrWebviewConfig {
  readonly imageUri: string;
  readonly ortWasmBase: string;
  readonly htmlLang: string;
  readonly copy: OcrUiCopy;
  readonly formula: FormulaAssetUrls;
  readonly text: {
    readonly detector: string;
    readonly recognizer: string;
    readonly dictionary: string;
  };
}

export type OcrWebviewToHostMessage =
  | { readonly type: 'ready' }
  | {
      readonly type: 'progress';
      readonly stage: string;
      readonly message: string;
      readonly completed?: number;
      readonly total?: number;
    }
  | {
      readonly type: 'recognize-result';
      readonly mode: OcrMode;
      readonly text: string;
      readonly ok: boolean;
      readonly confidence?: number;
      readonly usedWasmFallback?: boolean;
    }
  | { readonly type: 'preview-request'; readonly latex: string }
  | { readonly type: 'action'; readonly action: 'copy' | 'insert'; readonly mode: OcrMode; readonly text: string }
  | { readonly type: 'error'; readonly message: string };

export type OcrHostToWebviewMessage =
  | { readonly type: 'formula-preview'; readonly svg?: string; readonly error?: string };

interface VsCodeWebviewApi {
  postMessage(message: OcrWebviewToHostMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeWebviewApi;

declare global {
  var __SILK_MATH_OCR__: OcrWebviewConfig | undefined;
}

const vscode = acquireVsCodeApi();
const injectedConfig = globalThis.__SILK_MATH_OCR__;
if (!injectedConfig?.copy) throw new Error('OCR panel is missing local resource config.');
const config: OcrWebviewConfig = injectedConfig;
const t = config.copy;

function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    if (character === '&') return '&amp;';
    if (character === '<') return '&lt;';
    if (character === '>') return '&gt;';
    if (character === '"') return '&quot;';
    return '&#39;';
  });
}

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (match, key: string) => {
    const value = vars[key];
    return value === undefined ? match : String(value);
  });
}

document.documentElement.lang = config.htmlLang;

ort.env.wasm.wasmPaths = config.ortWasmBase;
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;

document.body.innerHTML = `
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      font: 12px/1.45 var(--vscode-font-family);
    }
    main { min-height: 100%; display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, 380px); }
    .stage {
      min-width: 0; padding: 16px; display: grid; place-items: center;
      background: color-mix(in srgb, var(--vscode-editor-background) 88%, #000);
      overflow: auto;
    }
    .canvas-wrap { position: relative; max-width: 100%; }
    canvas {
      display: block; max-width: 100%; max-height: calc(100vh - 32px);
      width: auto; height: auto; cursor: crosshair; touch-action: none;
      border-radius: 8px; box-shadow: 0 12px 40px rgb(0 0 0 / 35%);
    }
    aside {
      padding: 16px 16px 14px;
      border-left: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
      display: flex; flex-direction: column; gap: 12px;
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    }
    .hdr { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    .title { font-size: 14px; font-weight: 600; margin: 0; }
    .sub { margin: 3px 0 0; color: var(--vscode-descriptionForeground); font-size: 11px; }
    .badge {
      flex: none; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 999px;
      background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);
    }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip, .ghost, .primary {
      font: inherit; cursor: pointer; border: 1px solid transparent; border-radius: 6px;
      transition: background 120ms ease, transform 80ms ease, opacity 120ms ease;
    }
    .chip, .ghost {
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
    }
    .chip { height: 26px; padding: 0 10px; border-radius: 999px; font-size: 11px; }
    .chip.on, .primary {
      background: var(--vscode-button-background); color: var(--vscode-button-foreground);
    }
    .chip:hover, .ghost:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .chip.on:hover, .primary:hover { background: var(--vscode-button-hoverBackground); }
    .chip:active, .ghost:active, .primary:active { transform: scale(.97); }
    .primary { width: 100%; height: 32px; font-weight: 600; }
    .ghost { height: 28px; padding: 0 10px; font-size: 11px; flex: 1; }
    button:disabled { opacity: .45; cursor: default; transform: none; }
    .status { margin: 0; color: var(--vscode-descriptionForeground); min-height: 2.6em; }
    .bar { height: 3px; border-radius: 99px; background: var(--vscode-widget-border, transparent); overflow: hidden; }
    .bar > span {
      display: block; height: 100%; width: 0;
      background: var(--vscode-progressBar-background, var(--vscode-button-background));
      transition: width 160ms ease;
    }
    textarea {
      width: 100%; min-height: 140px; resize: vertical; flex: 1;
      border: 1px solid var(--vscode-input-border, var(--vscode-widget-border, transparent));
      border-radius: 8px; padding: 10px;
      color: var(--vscode-input-foreground); background: var(--vscode-input-background);
      font: 12px/1.5 var(--vscode-editor-font-family);
    }
    .preview {
      min-height: 56px; max-height: 160px; overflow: auto; padding: 10px;
      border-radius: 8px;
      background: var(--vscode-editorHoverWidget-background, transparent);
      border: 1px solid var(--vscode-editorHoverWidget-border, transparent);
    }
    .preview svg { max-width: 100%; height: auto; }
    .actions { display: flex; gap: 6px; }
    @media (max-width: 760px) {
      main { grid-template-columns: 1fr; }
      .stage { min-height: 42vh; }
      aside { border-left: 0; border-top: 1px solid var(--vscode-widget-border, transparent); }
    }
    @media (prefers-reduced-motion: reduce) {
      .chip, .ghost, .primary, .bar > span { transition: none; }
    }
  </style>
  <main>
    <section class="stage" aria-label="${htmlEscape(t.stageAria)}">
      <div class="canvas-wrap"><canvas id="source" aria-label="${htmlEscape(t.canvasAria)}"></canvas></div>
    </section>
    <aside>
      <div class="hdr">
        <div>
          <h1 class="title">${htmlEscape(t.title)}</h1>
          <p class="sub">${htmlEscape(t.subtitle)}</p>
        </div>
        <span class="badge">${htmlEscape(t.localBadge)}</span>
      </div>
      <div class="chips" role="tablist" aria-label="${htmlEscape(t.modeAria)}">
        <button class="chip on" id="auto-mode" role="tab" aria-selected="true">${htmlEscape(t.auto)}</button>
        <button class="chip" id="formula-mode" role="tab" aria-selected="false">${htmlEscape(t.formula)}</button>
        <button class="chip" id="text-mode" role="tab" aria-selected="false">${htmlEscape(t.text)}</button>
      </div>
      <button class="primary" id="recognize" disabled>${htmlEscape(t.recognize)}</button>
      <div class="bar" aria-hidden="true"><span id="progress"></span></div>
      <p class="status" id="status" role="status" aria-live="polite">${htmlEscape(t.readingScreenshot)}</p>
      <textarea id="result" aria-label="${htmlEscape(t.resultAria)}" spellcheck="false" placeholder="${htmlEscape(t.resultPlaceholder)}"></textarea>
      <div class="preview" id="preview" aria-label="${htmlEscape(t.previewAria)}"></div>
      <div class="actions">
        <button class="ghost" id="copy" disabled>${htmlEscape(t.copy)}</button>
        <button class="ghost" id="insert" disabled>${htmlEscape(t.insert)}</button>
      </div>
    </aside>
  </main>`;

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`OCR Webview 缺少元素 #${id}`);
  return value as T;
}

const canvas = element<HTMLCanvasElement>('source');
const maybeContext = canvas.getContext('2d', { willReadFrequently: true });
if (!maybeContext) throw new Error('当前 Webview 无法创建截图 Canvas。');
const context: CanvasRenderingContext2D = maybeContext;
const recognizeButton = element<HTMLButtonElement>('recognize');
const autoModeButton = element<HTMLButtonElement>('auto-mode');
const formulaModeButton = element<HTMLButtonElement>('formula-mode');
const textModeButton = element<HTMLButtonElement>('text-mode');
const status = element<HTMLParagraphElement>('status');
const progressBar = element<HTMLSpanElement>('progress');
const result = element<HTMLTextAreaElement>('result');
const preview = element<HTMLDivElement>('preview');
const copyButton = element<HTMLButtonElement>('copy');
const insertButton = element<HTMLButtonElement>('insert');

const sourceImage = new Image();
let selection: ImageRect | undefined;
let dragStart: ImagePoint | undefined;
let mode: OcrMode = 'auto';
let busy = false;
let formulaEngine: FormulaEngine | undefined;
let textService: PaddleOcrServiceInstance | undefined;
let editPreviewTimer: number | undefined;

function post(message: OcrWebviewToHostMessage): void {
  vscode.postMessage(message);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function setStatus(message: string): void {
  status.textContent = message;
}

function setProgress(ratio: number): void {
  progressBar.style.width = `${Math.max(0, Math.min(100, ratio * 100))}%`;
}

function setMode(next: OcrMode): void {
  mode = next;
  autoModeButton.classList.toggle('on', next === 'auto');
  formulaModeButton.classList.toggle('on', next === 'formula');
  textModeButton.classList.toggle('on', next === 'text');
  autoModeButton.setAttribute('aria-selected', String(next === 'auto'));
  formulaModeButton.setAttribute('aria-selected', String(next === 'formula'));
  textModeButton.setAttribute('aria-selected', String(next === 'text'));
  preview.hidden = next === 'text';
  setStatus(next === 'formula' ? t.modeFormula : next === 'text' ? t.modeText : t.modeAuto);
}

function redraw(): void {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
  if (!selection || !selectionHasArea(selection)) return;
  context.save();
  context.fillStyle = 'rgba(0, 0, 0, 0.42)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.clearRect(selection.x, selection.y, selection.width, selection.height);
  context.drawImage(
    sourceImage,
    selection.x, selection.y, selection.width, selection.height,
    selection.x, selection.y, selection.width, selection.height,
  );
  context.strokeStyle = '#8ab4f8';
  context.lineWidth = Math.max(2, canvas.width / Math.max(canvas.clientWidth, 1));
  context.strokeRect(selection.x, selection.y, selection.width, selection.height);
  context.restore();
}

function pointFromPointer(event: PointerEvent): ImagePoint {
  const bounds = canvas.getBoundingClientRect();
  return clientPointToImage(
    { x: event.clientX, y: event.clientY },
    { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height },
    { width: canvas.width, height: canvas.height },
  );
}

function invertIfDark(target: HTMLCanvasElement): void {
  const targetContext = target.getContext('2d', { willReadFrequently: true });
  if (!targetContext) return;
  const data = targetContext.getImageData(0, 0, target.width, target.height);
  let sum = 0;
  const pixels = data.data;
  const count = Math.max(1, pixels.length / 4);
  for (let index = 0; index < pixels.length; index += 4) {
    sum += ((pixels[index] ?? 0) + (pixels[index + 1] ?? 0) + (pixels[index + 2] ?? 0)) / 3;
  }
  if (!shouldInvertMeanLuma(sum / count)) return;
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = 255 - (pixels[index] ?? 0);
    pixels[index + 1] = 255 - (pixels[index + 1] ?? 0);
    pixels[index + 2] = 255 - (pixels[index + 2] ?? 0);
  }
  targetContext.putImageData(data, 0, 0);
}

function cropSelection(): HTMLCanvasElement {
  if (!selection || !selectionHasArea(selection)) throw new Error(t.needSelection);
  const left = Math.max(0, Math.floor(selection.x));
  const top = Math.max(0, Math.floor(selection.y));
  const width = Math.min(canvas.width - left, Math.max(1, Math.ceil(selection.width)));
  const height = Math.min(canvas.height - top, Math.max(1, Math.ceil(selection.height)));
  const crop = document.createElement('canvas');
  crop.width = width;
  crop.height = height;
  const cropContext = crop.getContext('2d', { willReadFrequently: true });
  if (!cropContext) throw new Error('无法创建选区 Canvas。');
  cropContext.fillStyle = '#fff';
  cropContext.fillRect(0, 0, width, height);
  cropContext.drawImage(sourceImage, left, top, width, height, 0, 0, width, height);
  invertIfDark(crop);
  return crop;
}

function cropRect(source: HTMLCanvasElement, rect: ImageRect): HTMLCanvasElement {
  const padded = expandRect(rect, 0.16, { width: source.width, height: source.height });
  const crop = document.createElement('canvas');
  crop.width = Math.max(1, Math.ceil(padded.width));
  crop.height = Math.max(1, Math.ceil(padded.height));
  const cropContext = crop.getContext('2d', { willReadFrequently: true });
  if (!cropContext) throw new Error('无法创建行选区。');
  cropContext.fillStyle = '#fff';
  cropContext.fillRect(0, 0, crop.width, crop.height);
  cropContext.drawImage(source, padded.x, padded.y, padded.width, padded.height, 0, 0, crop.width, crop.height);
  return crop;
}

function formulaProgress(progress: FormulaProgress): void {
  const stageName = progress.stage === 'models'
    ? t.loadFormulaModel
    : progress.stage === 'tokenizer'
      ? t.loadTokenizer
      : t.parseFormula;
  setStatus(`${stageName} ${progress.completed}/${progress.total}`);
  setProgress(progress.total > 0 ? progress.completed / progress.total : 0);
  post({ type: 'progress', stage: progress.stage, message: stageName, completed: progress.completed, total: progress.total });
}

function getFormulaEngine(): FormulaEngine {
  formulaEngine ??= new FormulaEngine(config.formula, formulaProgress);
  return formulaEngine;
}

async function getTextService(): Promise<PaddleOcrServiceInstance> {
  if (textService) return textService;
  setStatus(t.loadTextModel);
  setProgress(0.12);
  post({ type: 'progress', stage: 'text-models', message: t.loadTextModel, completed: 0, total: 1 });
  const { PaddleOcrService } = await import('ppu-paddle-ocr/web');
  const candidate = new PaddleOcrService({
    model: {
      detection: config.text.detector,
      recognition: config.text.recognizer,
      charactersDictionary: config.text.dictionary,
    },
    processing: { engine: 'canvas-native' },
    debugging: { verbose: false, debug: false },
    detection: { maxSideLength: 1600, paddingHorizontal: 0.5, paddingVertical: 0.35 },
    session: { graphOptimizationLevel: 'all' },
  });
  try {
    await candidate.initialize();
    textService = candidate;
    setProgress(1);
    post({ type: 'progress', stage: 'text-models', message: t.textModelReady, completed: 1, total: 1 });
    return candidate;
  } catch (error) {
    await candidate.destroy().catch(() => undefined);
    throw error;
  }
}

function updateActionState(): void {
  const hasText = result.value.trim().length > 0;
  copyButton.disabled = busy || !hasText;
  insertButton.disabled = busy || !hasText;
}

function requestPreview(latex: string): void {
  const body = cleanRecognizedLatex(latex);
  if (!body || mode === 'text') {
    preview.replaceChildren();
    return;
  }
  post({ type: 'preview-request', latex: body });
}

async function recognizeFormula(crop: HTMLCanvasElement): Promise<string> {
  const recognized = await getFormulaEngine().recognize(crop);
  const latex = wrapLatex(recognized.latex);
  post({
    type: 'recognize-result',
    mode: 'formula',
    text: latex,
    ok: recognized.ok,
    usedWasmFallback: recognized.usedWasmFallback,
  });
  setStatus(recognized.ok ? t.formulaDone : t.formulaIncomplete);
  if (latex) requestPreview(latex);
  return latex;
}

async function recognizeText(crop: HTMLCanvasElement): Promise<string> {
  const service = await getTextService();
  setStatus(t.recognizingText);
  setProgress(0.55);
  post({ type: 'progress', stage: 'text-inference', message: t.recognizingText });
  const recognized = await service.recognize(crop, { flatten: false, noCache: true, strategy: 'per-line' });
  setProgress(1);
  setStatus(fill(t.textDone, { percent: Math.round(recognized.confidence * 100) }));
  post({
    type: 'recognize-result',
    mode: 'text',
    text: recognized.text,
    ok: recognized.text.trim().length > 0,
    confidence: recognized.confidence,
  });
  return recognized.text;
}

async function recognizeAuto(crop: HTMLCanvasElement): Promise<string> {
  setStatus(t.autoWorking);
  const [textResult, formulaResult] = await Promise.all([
    getTextService().then((service) => service.recognize(crop, { flatten: false, noCache: true, strategy: 'per-box' })),
    getFormulaEngine().recognize(crop),
  ]);
  const wholeLatex = cleanRecognizedLatex(formulaResult.latex);
  if (prefersWholeFormula(textResult.text, wholeLatex, formulaResult.ok)) {
    const wrapped = wrapLatex(wholeLatex);
    setStatus(t.autoWholeFormula);
    requestPreview(wrapped);
    post({ type: 'recognize-result', mode: 'auto', text: wrapped, ok: formulaResult.ok, usedWasmFallback: formulaResult.usedWasmFallback });
    return wrapped;
  }

  const lines: MixedOcrLine[] = [];
  let formulaLines = 0;
  for (const [index, boxes] of textResult.lines.entries()) {
    const text = boxes.map((box) => box.text).join(' ').trim();
    if (!text) continue;
    if (lineShouldTryFormula(text) && formulaLines < 8) {
      const union = unionRects(boxes.map((box) => box.box));
      if (union && selectionHasArea(union, 8)) {
        setStatus(fill(t.autoLine, { n: index + 1 }));
        const lineCrop = cropRect(crop, union);
        const recognized = await getFormulaEngine().recognize(lineCrop);
        if (recognized.ok && cleanRecognizedLatex(recognized.latex)) {
          formulaLines += 1;
          lines.push({ text, latex: recognized.latex, useFormula: true });
          continue;
        }
      }
    }
    lines.push({ text, useFormula: false });
  }

  const mixed = composeMixedLines(lines) || textResult.text || wrapLatex(wholeLatex);
  const mathChunks = mixed.match(/\$[^$]+\$|\\\[[\s\S]*?\\\]/g);
  if (mathChunks?.[0]) requestPreview(mathChunks[0]);
  setStatus(formulaLines > 0 ? t.autoDoneMath : t.autoDoneText);
  post({
    type: 'recognize-result',
    mode: 'auto',
    text: mixed,
    ok: mixed.trim().length > 0,
    confidence: textResult.confidence,
    usedWasmFallback: formulaResult.usedWasmFallback,
  });
  return mixed;
}

async function recognizeSelection(): Promise<void> {
  if (busy) return;
  busy = true;
  recognizeButton.disabled = true;
  updateActionState();
  preview.replaceChildren();
  setProgress(0.05);
  try {
    const crop = cropSelection();
    const text = mode === 'formula'
      ? await recognizeFormula(crop)
      : mode === 'text'
        ? await recognizeText(crop)
        : await recognizeAuto(crop);
    result.value = text;
  } catch (error) {
    const message = errorMessage(error);
    setStatus(message);
    post({ type: 'error', message });
  } finally {
    busy = false;
    setProgress(0);
    recognizeButton.disabled = !selection || !selectionHasArea(selection);
    updateActionState();
  }
}

function sanitizeAndShowSvg(svgText: string): void {
  const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const svg = parsed.documentElement;
  if (svg.localName !== 'svg' || parsed.querySelector('parsererror')) throw new Error(t.invalidPreviewSvg);
  for (const forbidden of Array.from(svg.querySelectorAll('script, foreignObject, iframe, object, embed'))) forbidden.remove();
  for (const node of [svg, ...Array.from(svg.querySelectorAll('*'))]) {
    for (const attribute of Array.from(node.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith('on') || (name.endsWith('href') && value !== '' && !value.startsWith('#')) || value.includes('url(http')) {
        node.removeAttribute(attribute.name);
      }
    }
  }
  preview.replaceChildren(document.importNode(svg, true));
}

canvas.addEventListener('pointerdown', (event) => {
  dragStart = pointFromPointer(event);
  selection = normalizeImageSelection(dragStart, dragStart, { width: canvas.width, height: canvas.height });
  canvas.setPointerCapture(event.pointerId);
  redraw();
});

canvas.addEventListener('pointermove', (event) => {
  if (!dragStart || !canvas.hasPointerCapture(event.pointerId)) return;
  selection = normalizeImageSelection(dragStart, pointFromPointer(event), { width: canvas.width, height: canvas.height });
  recognizeButton.disabled = !selectionHasArea(selection);
  redraw();
});

function finishSelection(event: PointerEvent): void {
  if (!dragStart) return;
  selection = normalizeImageSelection(dragStart, pointFromPointer(event), { width: canvas.width, height: canvas.height });
  dragStart = undefined;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  recognizeButton.disabled = !selectionHasArea(selection);
  setStatus(selectionHasArea(selection) ? t.selectionReady : t.selectionTooSmall);
  redraw();
}

canvas.addEventListener('pointerup', finishSelection);
canvas.addEventListener('pointercancel', finishSelection);
autoModeButton.addEventListener('click', () => setMode('auto'));
formulaModeButton.addEventListener('click', () => setMode('formula'));
textModeButton.addEventListener('click', () => setMode('text'));
recognizeButton.addEventListener('click', () => void recognizeSelection());

result.addEventListener('input', () => {
  updateActionState();
  if (editPreviewTimer !== undefined) window.clearTimeout(editPreviewTimer);
  if (mode !== 'text' && result.value.trim()) {
    editPreviewTimer = window.setTimeout(() => requestPreview(result.value), 160);
  }
});

copyButton.addEventListener('click', () => post({ type: 'action', action: 'copy', mode, text: result.value }));
insertButton.addEventListener('click', () => post({ type: 'action', action: 'insert', mode, text: result.value }));

window.addEventListener('message', (event: MessageEvent<OcrHostToWebviewMessage>) => {
  const message = event.data;
  if (message.type !== 'formula-preview') return;
  try {
    if (message.error) preview.textContent = fill(t.previewFailed, { message: message.error });
    else if (message.svg) sanitizeAndShowSvg(message.svg);
    else preview.replaceChildren();
  } catch (error) {
    preview.textContent = fill(t.previewFailed, { message: errorMessage(error) });
  }
});

window.addEventListener('beforeunload', () => {
  if (editPreviewTimer !== undefined) window.clearTimeout(editPreviewTimer);
  void formulaEngine?.dispose();
  void textService?.destroy();
});

sourceImage.addEventListener('load', () => {
  canvas.width = sourceImage.naturalWidth;
  canvas.height = sourceImage.naturalHeight;
  selection = { x: 0, y: 0, width: canvas.width, height: canvas.height };
  recognizeButton.disabled = !selectionHasArea(selection);
  redraw();
  setStatus(t.wholeImageSelected);
  post({ type: 'ready' });
});
sourceImage.addEventListener('error', () => {
  const message = t.cannotReadImage;
  setStatus(message);
  post({ type: 'error', message });
});
sourceImage.src = config.imageUri;
