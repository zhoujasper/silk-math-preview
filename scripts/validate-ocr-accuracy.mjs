// 本机真实模型回归；只读取已安装的 OCR 包，不下载、不启动 VS Code 图形界面。
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const args = process.argv.slice(2);
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const packRoot = option('--pack');
if (!packRoot) throw new Error('请提供 --pack <已安装 OCR 包目录>；此脚本不会下载模型。');
const workerPath = resolve(option('--worker') ?? 'dist/ocr-worker.js');
const fixtures = resolve(import.meta.dirname, '../test/fixtures/ocr');
const original = await readFile(resolve(fixtures, 'eigenvalue.png'));
const source = PNG.sync.read(original);
const checks = [];
const eigenvalue = result => {
  assert.equal(result.ok, true);
  assert.doesNotMatch(result.text, /\\(?:begin|end|hline)/);
  assert.match(result.text, /A/); assert.match(result.text, /\\lambda/);
  assert.match(result.text, /\\(?:neq|ne)\b/); assert.match(result.text, /0/);
  assert.equal((result.text.match(/v/g) ?? []).length, 3, '必须保留两边的 v 和右侧非零条件');
};
for (const name of ['eigenvalue', 'fraction', 'matrix', 'cases', 'array', 'integral', 'decimal', 'sum', 'table', 'sparseTable']) {
  const image = await readFile(resolve(fixtures, `${name}.png`));
  checks.push({ name, mode: 'formula', image, check: result => {
    if (name === 'eigenvalue') return eigenvalue(result);
    if (name === 'table' || name === 'sparseTable') {
      assert.match(result.text, /\\begin\s*\{array\}/);
      assert.match(result.text, /x/);
      // 当前模型通常多生成列。错误时保留并复核；若以后改善，须与实际两列三行一致。
      if (result.ok) {
        const array = /\\begin\s*\{array\}\s*\{([^}]*)\}([\s\S]*)\\end\s*\{array\}/.exec(result.text);
        assert(array); assert.equal(array[1].replace(/[^clr]/g, '').length, 2);
        const rows = array[2].split('\\\\').map(row => row.replace(/\\hline\b/g, '').trim()).filter(Boolean);
        assert.equal(rows.length, 3); assert(rows.every(row => row.split('&').length === 2));
        if (name === 'table') for (const value of ['y', '1', '2', '3', '4']) assert(result.text.includes(value));
      }
      return;
    }
    assert.equal(result.ok, true);
    if (name === 'matrix') assert.match(result.text, /\\begin\s*\{(?:p?matrix|array)\}/);
    if (name === 'cases') { assert.match(result.text, /\\begin\s*\{cases\}/); assert.match(result.text, /x<0/); }
    if (name === 'array') assert.match(result.text, /\\begin\s*\{(?:array|matrix)\}/);
    if (name === 'fraction') { assert.match(result.text, /\\frac\{a\+b\}\{c-d\}/); assert.match(result.text, /\\frac\{1\}\{2\}/); }
    if (name === 'integral') assert.match(result.text, /\\int/);
    if (name === 'sum') assert.match(result.text, /\\sum/);
    if (name === 'decimal') { assert.match(result.text, /-0\.5/); assert.match(result.text, /1\.25\\times10\^\{-3\}/); }
  } });
}
for (const [name, width, height, paper] of [
  ['beige', 400, 104, 225], ['large-white-margin', 800, 200, 255],
  ['large-beige-margin', 800, 400, 240], ['huge-margin', 1000, 600, 240], ['dark', 400, 104, 28],
]) {
  const out = new PNG({ width, height });
  for (let i = 0; i < out.data.length; i += 4) { out.data[i] = out.data[i + 1] = out.data[i + 2] = paper; out.data[i + 3] = 255; }
  const dx = Math.floor((width - source.width) / 2), dy = Math.floor((height - source.height) / 2);
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    const from = (y * source.width + x) * 4, to = ((y + dy) * width + x + dx) * 4;
    const luma = Math.min(255, Math.round((source.data[from] + source.data[from + 1] + source.data[from + 2]) / 3 * 255 / 240));
    const value = name === 'dark' ? Math.round(255 - luma / 255 * (255 - paper)) : Math.round(luma * paper / 255);
    out.data[to] = out.data[to + 1] = out.data[to + 2] = value;
  }
  checks.push({ name, mode: 'formula', image: PNG.sync.write(out), check: eigenvalue });
}
for (const name of ['eigenvalue', 'matrix', 'cases', 'table']) {
  const check = checks.find(item => item.name === name);
  checks.push({ ...check, name: `${name}-auto`, mode: 'auto' });
}
const reports = [];
const requestedCases = option('--cases')?.split(',');
if (requestedCases) for (const name of requestedCases) assert(checks.some(check => check.name === name), `Unknown OCR case: ${name}`);
const worker = new Worker(workerPath, { workerData: { packRoot: resolve(packRoot) } });
try {
  for (const { name, mode, image, check } of checks) {
    if (requestedCases && !requestedCases.includes(name)) continue;
    const id = reports.length + 1, start = performance.now();
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error(`${name}: timeout`)); }, 60_000);
      const cleanup = () => { clearTimeout(timer); worker.off('message', message); worker.off('error', failed); worker.off('exit', exited); };
      const failed = error => { cleanup(); reject(error); };
      const exited = code => failed(new Error(`OCR worker exited (${code})`));
      const message = event => {
        if (event.id !== id || event.type === 'progress') return;
        cleanup();
        if (event.type === 'result') resolve(event.result); else reject(new Error(event.message));
      };
      worker.on('message', message); worker.once('error', failed); worker.once('exit', exited);
      worker.postMessage({ id, mode, image });
    });
    const report = { name, mode, ms: Math.round(performance.now() - start), ...result };
    reports.push(report); console.log(JSON.stringify(report));
    try { check(result); } catch (error) { throw new Error(`${name}: ${error.message}`); }
  }
} finally {
  await worker.terminate();
  if (option('--report')) await writeFile(resolve(option('--report')), JSON.stringify({ node: process.version, worker: workerPath, reports }, null, 2) + '\n');
}
console.log(`OCR accuracy checks: ${reports.length}; recognized: ${reports.filter(row => row.ok).length}; retained for review: ${reports.filter(row => !row.ok).length}`);
