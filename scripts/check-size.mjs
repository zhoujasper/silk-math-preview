import { stat, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const MAX_MAIN = 200 * 1024;
const MAX_STARTUP = 220 * 1024;
// 后台 Worker 包含纯 JS PNG/JPEG 解码；不进入主扩展热路径。
const MAX_OCR_WORKER = 250 * 1024;
const MAX_TIKZ_WORKER = 350 * 1024;
const MAX_VSIX = 2.5 * 1024 * 1024;
const mainPath = resolve('dist/extension.js');
const ocrPath = resolve('dist/ocr-worker.js');
const main = await stat(mainPath);
const startupModules = ['ui-locale.js', 'math-scanner.js', 'preview-style.js'];
const startupBytes = main.size + (await Promise.all(startupModules.map(name => stat(resolve('dist', name)))))
  .reduce((total, info) => total + info.size, 0);
if (startupBytes > MAX_STARTUP) throw new Error(`启动模块合计 ${startupBytes} B 超过 ${MAX_STARTUP} B 硬门`);
const ocr = await stat(ocrPath);
const content = await readFile(mainPath, 'utf8');
const tikz = await stat(resolve('dist/tikz-worker.js'));
if (tikz.size > MAX_TIKZ_WORKER) throw new Error(`TikZ Worker ${tikz.size} B 超出 350 KiB`);
if (/WebAssembly\.instantiate|opentype|TikzEngine/.test(content)) throw new Error('TikZ renderer leaked into main bundle');

if (main.size > MAX_MAIN) {
  throw new Error(`主扩展 bundle ${main.size} B 超过 ${MAX_MAIN} B 硬门`);
}
if (/mjx-container|mathjax-newcm|MJX-SVG|MathJaxTexFont/.test(content)) {
  throw new Error('主扩展 bundle 意外包含 MathJax；渲染器必须只存在于懒加载 Worker');
}
if (ocr.size > MAX_OCR_WORKER) {
  throw new Error(`OCR Worker bundle ${ocr.size} B 超过 ${MAX_OCR_WORKER} B 硬门`);
}

const vsix = (await readdir('.')).filter((name) => name.endsWith('.vsix'));
for (const name of vsix) {
  const info = await stat(resolve(name));
  if (info.size > MAX_VSIX) throw new Error(`${name} 超过 2.5 MB 硬门：${info.size} B`);
}

console.log(JSON.stringify({ mainBundleBytes: main.size, startupModuleBytes: startupBytes, ocrWorkerBytes: ocr.size, tikzWorkerBytes: tikz.size, checkedVsix: vsix }, null, 2));
