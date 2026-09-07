import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parentPort, workerData } from 'node:worker_threads';
import type * as OrtModule from 'onnxruntime-web';
import { decodeImage, installCanvasGlobals } from './nodeCanvas';
import type { OcrRequest, OcrResponse } from './protocol';

const port = parentPort!;
const root = (workerData as { packRoot: string }).packRoot;
// require 的路径由安装器控制；仅使用已校验的本地 runtime。
const runtime = require(join(root, 'ort', 'ort.webgpu.min.js')) as typeof OrtModule;
Object.assign(globalThis, { ort: runtime });
runtime.env.wasm.wasmPaths = {
  mjs: pathToFileURL(join(root, 'ort', 'ort-wasm-simd-threaded.asyncify.mjs')).href,
  wasm: pathToFileURL(join(root, 'ort', 'ort-wasm-simd-threaded.asyncify.wasm')).href,
};
runtime.env.wasm.numThreads = 1;
runtime.env.wasm.proxy = false;
installCanvasGlobals();

const paths = new Map<string, string>();
const local = (name: string): string => {
  const path = join(root, 'models', name);
  const url = pathToFileURL(path).href;
  paths.set(url, path); return url;
};
const assets = {
  formula: { encoder: local('mfr_encoder.onnx'), decoder: local('mfr_decoder.onnx'), tokenizer: local('mfr_tokenizer.json') },
  text: { detector: local('PP-OCRv5_mobile_det_infer.onnx'), recognizer: local('PP-OCRv5_mobile_rec_infer.onnx'), dictionary: local('ppocrv5_dict.txt') },
};
// 浏览器模型读取接口在此被限定为六个本地文件，不发送截图、不从 CDN 临时取依赖。
globalThis.fetch = async (input): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = paths.get(url);
  if (!path) throw new Error('OCR 只允许读取本地模型');
  return new Response(new Uint8Array(await readFile(path)));
};

let active: number | undefined;
const post = (message: OcrResponse): void => port.postMessage(message);
const recognizer = import('./ocrRecognizer.js').then(({ OcrRecognizer }) => new OcrRecognizer(assets, (stage, ratio) => {
  if (active !== undefined) post({ id: active, type: 'progress', stage, ratio });
}));
void recognizer.catch(() => undefined);
port.on('message', (request: OcrRequest) => {
  if (active !== undefined) { post({ id: request.id, type: 'error', message: 'OCR busy' }); return; }
  active = request.id;
  void (async () => {
    try {
      const image = await decodeImage(request.image);
      const result = await (await recognizer).recognize(image, request.mode);
      post({ id: request.id, type: 'result', result });
    } catch (error) {
      post({ id: request.id, type: 'error', message: error instanceof Error ? error.message : String(error) });
    } finally { active = undefined; }
  })();
});
