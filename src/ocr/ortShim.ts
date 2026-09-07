/// <reference lib="dom" />

/**
 * OCR Worker bundle 把 `onnxruntime-web` 重定向到本文件。真正的 ORT 脚本由
 * Worker 先从按需安装包加载，并暴露为 `globalThis.ort`；这样不会把约 22 MB
 * runtime 重复塞进 VSIX。
 */
import type * as OrtModule from 'onnxruntime-web';
import { createSessionQueue } from './sessionQueue';

type OrtNamespace = typeof OrtModule;

function installedOrt(): OrtNamespace {
  const candidate = (globalThis as typeof globalThis & { ort?: OrtNamespace }).ort;
  if (!candidate) {
    throw new Error('本地 OCR Runtime 尚未加载。请重试识别。');
  }
  return candidate;
}

const runtime = installedOrt();

// ppu-paddle-ocr/web 和公式识别器目前只使用这三个公开导出。
export const env = runtime.env;
const enqueue = createSessionQueue();
// Paddle 内部也并行创建会话，必须在公共入口串行，不能只修公式引擎。
export const InferenceSession = new Proxy(runtime.InferenceSession, {
  get(target, key, receiver) {
    if (key !== 'create') return Reflect.get(target, key, receiver);
    return (...args: unknown[]) => enqueue(() => Reflect.apply(target.create, target, args));
  },
});
export const Tensor = runtime.Tensor;
