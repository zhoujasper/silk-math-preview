/// <reference lib="dom" />

import * as ort from 'onnxruntime-web';
import { FormulaEngine, type FormulaAssetUrls, type FormulaProgress } from './formulaEngine.js';
import {
  clientPointToImage,
  normalizeImageSelection,
  selectionHasArea,
  type ImagePoint,
  type ImageRect,
} from './imageMath.js';

type OcrMode = 'formula' | 'text';
type PaddleOcrServiceInstance = import(
  'ppu-paddle-ocr/web',
  { with: { 'resolution-mode': 'import' } }
).PaddleOcrService;

export interface OcrWebviewConfig {
  readonly imageUri: string;
  /** 指向本地按需包 `ort/` 的 Webview URI，必须以 `/` 结尾。 */
  readonly ortWasmBase: string;
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
  // 由扩展生成的内联 bootstrap 在本脚本执行前注入；只包含本地 webview URI。
  var __SILK_MATH_OCR__: OcrWebviewConfig | undefined;
}

const vscode = acquireVsCodeApi();
const injectedConfig = globalThis.__SILK_MATH_OCR__;
if (!injectedConfig) throw new Error('截图识别面板缺少本地资源配置。');
const config: OcrWebviewConfig = injectedConfig;

// 不允许 ORT 回退到默认 CDN。所有模型和 runtime 文件都来自已校验的本地按需包。
ort.env.wasm.wasmPaths = config.ortWasmBase;
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;

document.body.innerHTML = `
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--vscode-foreground); background: var(--vscode-editor-background); font: 13px/1.45 var(--vscode-font-family); }
    main { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 360px); }
    .stage { min-width: 0; padding: 18px; display: grid; place-items: center; background: color-mix(in srgb, var(--vscode-editor-background) 93%, var(--vscode-foreground)); overflow: auto; }
    .canvas-wrap { position: relative; width: 100%; display: grid; place-items: center; }
    canvas { display: block; max-width: 100%; max-height: calc(100vh - 36px); width: auto; height: auto; cursor: crosshair; touch-action: none; box-shadow: 0 8px 30px rgb(0 0 0 / 20%); }
    aside { padding: 20px 18px; border-left: 1px solid var(--vscode-panel-border); display: flex; flex-direction: column; gap: 16px; min-height: 100vh; }
    h1 { font-size: 15px; line-height: 1.3; margin: 0; font-weight: 600; }
    .hint, .status { color: var(--vscode-descriptionForeground); margin: 0; }
    .mode { display: flex; gap: 4px; border-bottom: 1px solid var(--vscode-panel-border); }
    button { border: 0; border-radius: 3px; padding: 7px 10px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); cursor: pointer; font: inherit; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button:disabled { opacity: .55; cursor: default; }
    .tab { color: var(--vscode-foreground); background: transparent; border-radius: 0; border-bottom: 2px solid transparent; }
    .tab[aria-selected="true"] { border-bottom-color: var(--vscode-focusBorder); }
    .tab:hover { background: var(--vscode-toolbar-hoverBackground); }
    .primary { width: 100%; padding-block: 8px; }
    textarea { width: 100%; min-height: 128px; resize: vertical; border: 1px solid var(--vscode-input-border, transparent); border-radius: 3px; padding: 9px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); font: 12px/1.5 var(--vscode-editor-font-family); }
    textarea:focus, button:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 1px; }
    .preview { min-height: 48px; padding: 10px 0; overflow: auto; color: var(--vscode-editor-foreground); }
    .preview svg { max-width: 100%; height: auto; }
    .actions { display: flex; gap: 8px; }
    .actions button { flex: 1; }
    .spacer { flex: 1; }
    @media (max-width: 720px) {
      main { grid-template-columns: 1fr; }
      .stage { min-height: 48vh; }
      aside { min-height: auto; border-left: 0; border-top: 1px solid var(--vscode-panel-border); }
      canvas { max-height: 60vh; }
    }
    @media (prefers-reduced-motion: no-preference) {
      button { transition: background-color 100ms ease, opacity 100ms ease; }
    }
  </style>
  <main>
    <section class="stage" aria-label="截图框选区域">
      <div class="canvas-wrap"><canvas id="source" aria-label="拖动鼠标框选要识别的区域"></canvas></div>
    </section>
    <aside>
      <div><h1>截图识别</h1><p class="hint">拖动框选精确区域；图片只在本机 Webview 内处理。</p></div>
      <div class="mode" role="tablist" aria-label="识别类型">
        <button class="tab" id="formula-mode" role="tab" aria-selected="true">公式</button>
        <button class="tab" id="text-mode" role="tab" aria-selected="false">文字</button>
      </div>
      <button class="primary" id="recognize" disabled>识别选区</button>
      <p class="status" id="status" role="status" aria-live="polite">正在读取截图…</p>
      <textarea id="result" aria-label="可编辑识别结果" spellcheck="false" placeholder="识别结果会显示在这里"></textarea>
      <div class="preview" id="preview" aria-label="公式预览"></div>
      <div class="spacer"></div>
      <div class="actions"><button id="copy" disabled>复制</button><button id="insert" disabled>插入光标处</button></div>
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
const formulaModeButton = element<HTMLButtonElement>('formula-mode');
const textModeButton = element<HTMLButtonElement>('text-mode');
const status = element<HTMLParagraphElement>('status');
const result = element<HTMLTextAreaElement>('result');
const preview = element<HTMLDivElement>('preview');
const copyButton = element<HTMLButtonElement>('copy');
const insertButton = element<HTMLButtonElement>('insert');

const sourceImage = new Image();
let selection: ImageRect | undefined;
let dragStart: ImagePoint | undefined;
let mode: OcrMode = 'formula';
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

function setMode(next: OcrMode): void {
  mode = next;
  formulaModeButton.setAttribute('aria-selected', String(next === 'formula'));
  textModeButton.setAttribute('aria-selected', String(next === 'text'));
  preview.hidden = next !== 'formula';
  setStatus(next === 'formula' ? '公式模式：输出 LaTeX。' : '文字模式：保留检测到的换行。');
}

function redraw(): void {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
  if (!selection || !selectionHasArea(selection)) return;
  context.save();
  context.fillStyle = 'rgba(0, 122, 204, 0.12)';
  context.strokeStyle = '#38a8ff';
  context.lineWidth = Math.max(2, canvas.width / Math.max(canvas.clientWidth, 1));
  context.setLineDash([8, 5]);
  context.fillRect(selection.x, selection.y, selection.width, selection.height);
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

function cropSelection(): HTMLCanvasElement {
  if (!selection || !selectionHasArea(selection)) throw new Error('请先拖动框选至少 4×4 像素的区域。');
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
  return crop;
}

function formulaProgress(progress: FormulaProgress): void {
  const stageName = progress.stage === 'models' ? '加载公式模型' : progress.stage === 'tokenizer' ? '加载词表' : '解析公式';
  setStatus(`${stageName} ${progress.completed}/${progress.total}`);
  post({
    type: 'progress',
    stage: progress.stage,
    message: stageName,
    completed: progress.completed,
    total: progress.total,
  });
}

function getFormulaEngine(): FormulaEngine {
  formulaEngine ??= new FormulaEngine(config.formula, formulaProgress);
  return formulaEngine;
}

async function getTextService(): Promise<PaddleOcrServiceInstance> {
  if (textService) return textService;
  setStatus('正在加载本地文字模型…');
  post({ type: 'progress', stage: 'text-models', message: '加载本地文字模型', completed: 0, total: 1 });
  // Node16 项目下该包是纯 ESM；动态 import 同时让文字引擎保持真正的首次使用才初始化。
  const { PaddleOcrService } = await import('ppu-paddle-ocr/web');
  const candidate = new PaddleOcrService({
    model: {
      detection: config.text.detector,
      recognition: config.text.recognizer,
      charactersDictionary: config.text.dictionary,
    },
    processing: { engine: 'canvas-native' },
    debugging: { verbose: false, debug: false },
    detection: { maxSideLength: 1280 },
    session: { graphOptimizationLevel: 'all' },
  });
  try {
    await candidate.initialize();
    textService = candidate;
    post({ type: 'progress', stage: 'text-models', message: '文字模型已就绪', completed: 1, total: 1 });
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

async function recognizeSelection(): Promise<void> {
  if (busy) return;
  busy = true;
  recognizeButton.disabled = true;
  updateActionState();
  preview.replaceChildren();
  try {
    const crop = cropSelection();
    if (mode === 'formula') {
      const recognized = await getFormulaEngine().recognize(crop);
      result.value = recognized.latex;
      setStatus(recognized.ok ? '公式识别完成，请对照截图复核。' : '结果可能退化，请修改或缩小选区后重试。');
      post({
        type: 'recognize-result',
        mode,
        text: recognized.latex,
        ok: recognized.ok,
        usedWasmFallback: recognized.usedWasmFallback,
      });
      if (recognized.latex) post({ type: 'preview-request', latex: recognized.latex });
    } else {
      const service = await getTextService();
      setStatus('正在识别文字…');
      post({ type: 'progress', stage: 'text-inference', message: '识别文字' });
      const recognized = await service.recognize(crop, { flatten: false, noCache: true, strategy: 'per-line' });
      result.value = recognized.text;
      setStatus(`文字识别完成，平均置信度 ${Math.round(recognized.confidence * 100)}%。`);
      post({
        type: 'recognize-result',
        mode,
        text: recognized.text,
        ok: recognized.text.trim().length > 0,
        confidence: recognized.confidence,
      });
    }
  } catch (error) {
    const message = errorMessage(error);
    setStatus(message);
    post({ type: 'error', message });
  } finally {
    busy = false;
    recognizeButton.disabled = !selection || !selectionHasArea(selection);
    updateActionState();
  }
}

function sanitizeAndShowSvg(svgText: string): void {
  const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const svg = parsed.documentElement;
  if (svg.localName !== 'svg' || parsed.querySelector('parsererror')) throw new Error('公式预览不是有效 SVG。');
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
  setStatus(selectionHasArea(selection) ? '选区已就绪。' : '选区太小，请重新框选。');
  redraw();
}

canvas.addEventListener('pointerup', finishSelection);
canvas.addEventListener('pointercancel', finishSelection);
formulaModeButton.addEventListener('click', () => setMode('formula'));
textModeButton.addEventListener('click', () => setMode('text'));
recognizeButton.addEventListener('click', () => void recognizeSelection());

result.addEventListener('input', () => {
  updateActionState();
  if (editPreviewTimer !== undefined) window.clearTimeout(editPreviewTimer);
  if (mode === 'formula' && result.value.trim()) {
    editPreviewTimer = window.setTimeout(() => post({ type: 'preview-request', latex: result.value }), 160);
  }
});

copyButton.addEventListener('click', () => post({ type: 'action', action: 'copy', mode, text: result.value }));
insertButton.addEventListener('click', () => post({ type: 'action', action: 'insert', mode, text: result.value }));

window.addEventListener('message', (event: MessageEvent<OcrHostToWebviewMessage>) => {
  const message = event.data;
  if (message.type !== 'formula-preview') return;
  try {
    if (message.error) {
      preview.textContent = `预览失败：${message.error}`;
    } else if (message.svg) {
      sanitizeAndShowSvg(message.svg);
    } else {
      preview.replaceChildren();
    }
  } catch (error) {
    preview.textContent = `预览失败：${errorMessage(error)}`;
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
  setStatus('已默认选择整张截图；拖动可精确缩小范围。');
  post({ type: 'ready' });
});
sourceImage.addEventListener('error', () => {
  const message = '无法读取截图，请重新截图或选择图片文件。';
  setStatus(message);
  post({ type: 'error', message });
});
sourceImage.src = config.imageUri;
