import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';

import { build } from 'esbuild';

const workerPath = resolve(process.env.SILK_MATH_WORKER ?? 'dist/render-worker.js');
const rssBaseline = process.memoryUsage().rss;
const term = String.raw`\frac{a_i^2+b_i^2}{1+\sqrt{x_i}}+\alpha_i\,`;
const formula = String.raw`\class{silk-math-caret}{\rule{0.08em}{1.25em}}\sum_{i=1}^{12}` + term.repeat(10);

function createRenderClient() {
  const worker = new Worker(workerPath);
  const pending = new Map();
  let nextId = 1;
  worker.on('message', (message) => {
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  });
  worker.on('error', (error) => {
    for (const settle of pending.values()) settle({ ok: false, error: error.message });
    pending.clear();
  });

  const render = (expression) => new Promise((resolvePromise, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => reject(new Error('渲染基准超时')), 10_000);
    pending.set(id, (message) => {
      clearTimeout(timer);
      if (!message.ok) reject(new Error(message.error));
      else resolvePromise(message);
    });
    worker.postMessage({
      type: 'render', id, expression, displayMode: true,
      definitionFingerprint: 'bench-v1', definitionPrelude: '',
      foreground: '#d4d4d4', caretColor: '#ffb454', scale: 1, exPx: 7,
    });
  });
  return { worker, render };
}

function orderedPercentile(values, ratio) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * ratio))];
}

const coldRoundTrips = [];
const coldRenders = [];
const rssSamples = [];
for (let trial = 0; trial < 7; trial += 1) {
  const client = createRenderClient();
  const started = performance.now();
  const result = await client.render(formula);
  coldRoundTrips.push(performance.now() - started);
  coldRenders.push(result.renderMs);
  rssSamples.push(process.memoryUsage().rss);
  await client.worker.terminate();
}

const warmClient = createRenderClient();
await warmClient.render(formula);
const warm = [];
for (let index = 0; index < 30; index += 1) {
  const started = performance.now();
  await warmClient.render(`${formula}+${index}`);
  warm.push(performance.now() - started);
}
rssSamples.push(process.memoryUsage().rss);
await warmClient.worker.terminate();

const temporary = await mkdtemp(join(tmpdir(), 'silk-math-bench-'));
const scannerBundle = join(temporary, 'scanner.mjs');
const clientBundle = join(temporary, 'render-client.mjs');
await build({
  entryPoints: ['src/core/mathScanner.ts'],
  outfile: scannerBundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  logLevel: 'silent',
});
await build({
  entryPoints: ['src/render/renderClient.ts'],
  outfile: clientBundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  logLevel: 'silent',
});
const { scanMathRegions } = await import(`${pathToFileURL(scannerBundle).href}?v=${Date.now()}`);
const activeWindow = `${'正文 text '.repeat(1900)}$$${term.repeat(18)}$$${' tail '.repeat(1900)}`;
const scanTimes = [];
for (let index = 0; index < 160; index += 1) {
  const started = performance.now();
  scanMathRegions(activeWindow, { language: 'markdown' });
  scanTimes.push(performance.now() - started);
}
const { RenderClient } = await import(`${pathToFileURL(clientBundle).href}?v=${Date.now()}`);
const lifecycleClient = new RenderClient(workerPath, 50);
await lifecycleClient.render({
  expression: 'x+1', displayMode: false, definitionFingerprint: 'lifecycle', definitionPrelude: '',
  foreground: '#d4d4d4', caretColor: '#ffb454', scale: 1, exPx: 7,
});
await new Promise((resolvePromise) => setTimeout(resolvePromise, 120));
await lifecycleClient.render({
  expression: 'x+2', displayMode: false, definitionFingerprint: 'lifecycle', definitionPrelude: '',
  foreground: '#d4d4d4', caretColor: '#ffb454', scale: 1, exPx: 7,
});
const lifecycleStats = lifecycleClient.stats();
await lifecycleClient.dispose();
if (lifecycleStats.workerStarts !== 2) throw new Error('Worker 未在空闲后释放并按需重启');
await rm(temporary, { recursive: true, force: true });

console.log(JSON.stringify({
  formulaChars: formula.length,
  coldSamples: coldRoundTrips.length,
  coldRoundTripSamplesMs: coldRoundTrips,
  coldRoundTripP50Ms: orderedPercentile(coldRoundTrips, 0.5),
  coldRoundTripP95Ms: orderedPercentile(coldRoundTrips, 0.95),
  coldRenderP50Ms: orderedPercentile(coldRenders, 0.5),
  coldRenderP95Ms: orderedPercentile(coldRenders, 0.95),
  warmP50Ms: orderedPercentile(warm, 0.5),
  warmP95Ms: orderedPercentile(warm, 0.95),
  warmSamples: warm.length,
  boundedScanChars: activeWindow.length,
  boundedScanP50Ms: orderedPercentile(scanTimes, 0.5),
  boundedScanP95Ms: orderedPercentile(scanTimes, 0.95),
  peakProcessRssDeltaMiB: (Math.max(...rssSamples) - rssBaseline) / 1_048_576,
  workerRestartAfterIdle: lifecycleStats.workerStarts === 2,
}, null, 2));
