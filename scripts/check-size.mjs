import { stat, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const MAX_MAIN = 200 * 1024;
const MAX_OCR_WEBVIEW = 180 * 1024;
const MAX_VSIX = 2.5 * 1024 * 1024;
const mainPath = resolve('dist/extension.js');
const ocrPath = resolve('dist/ocr-webview.js');
const main = await stat(mainPath);
const ocr = await stat(ocrPath);
const content = await readFile(mainPath, 'utf8');

if (main.size > MAX_MAIN) {
  throw new Error(`主扩展 bundle ${main.size} B 超过 ${MAX_MAIN} B 硬门`);
}
if (/mjx-container|mathjax-newcm|MJX-SVG|MathJaxTexFont/.test(content)) {
  throw new Error('主扩展 bundle 意外包含 MathJax；渲染器必须只存在于懒加载 Worker');
}
if (ocr.size > MAX_OCR_WEBVIEW) {
  throw new Error(`OCR Webview bundle ${ocr.size} B 超过 ${MAX_OCR_WEBVIEW} B 硬门`);
}

const vsix = (await readdir('.')).filter((name) => name.endsWith('.vsix'));
for (const name of vsix) {
  const info = await stat(resolve(name));
  if (info.size > MAX_VSIX) throw new Error(`${name} 超过 2.5 MB 硬门：${info.size} B`);
}

console.log(JSON.stringify({ mainBundleBytes: main.size, ocrWebviewBytes: ocr.size, checkedVsix: vsix }, null, 2));
