/// <reference lib="dom" />

/**
 * 浏览器 bundle 会把 `onnxruntime-web` 重定向到本文件。真正的 ORT 脚本由
 * Webview 先从按需安装包加载，并暴露为 `globalThis.ort`；这样不会把约 22 MB
 * runtime 重复塞进 VSIX。
 */
import type * as OrtModule from 'onnxruntime-web';

type OrtNamespace = typeof OrtModule;

function installedOrt(): OrtNamespace {
  const candidate = (globalThis as typeof globalThis & { ort?: OrtNamespace }).ort;
  if (!candidate) {
    throw new Error('本地 OCR Runtime 尚未加载。请重新打开截图识别面板。');
  }
  return candidate;
}

const runtime = installedOrt();

// ppu-paddle-ocr/web 和公式识别器目前只使用这三个公开导出。
export const env = runtime.env;
export const InferenceSession = runtime.InferenceSession;
export const Tensor = runtime.Tensor;

