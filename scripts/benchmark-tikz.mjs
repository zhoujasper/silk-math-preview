import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// One process / one worker; accepts an older packed worker for an apples-to-apples comparison.
const output = resolve('.tmp-tikz-smoke');
await mkdir(output, { recursive: true });
await build({ entryPoints: ['src/render/renderClient.ts'], outfile: `${output}/benchmark-client.mjs`, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
const { RenderClient } = await import(pathToFileURL(`${output}/benchmark-client.mjs`).href);
const worker = resolve(process.argv[2] ?? 'dist/tikz-worker.js');
const destination = resolve(process.argv[3] ?? `${output}/benchmark.json`);
const client = new RenderClient(worker, 600, { workerData: { packRoot: `${output}/runtime` }, timeoutMs: 5000 });
const fixture = await readFile('test/fixtures/manual/tikz.tex', 'utf8');
const axis = /\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/.exec(fixture)[0];
const definitions = process.argv.includes('--definitions');
const input = (expression, definitionPrelude = '') => ({ expression, definitionPrelude, definitionFingerprint: '', displayMode: true, foreground: '#000', caretColor: '', scale: 1, exPx: 0, markUnknownCommands: false });
const samples = [], initialRss = process.memoryUsage().rss, cpu = process.cpuUsage();
try {
  for (let i = 0; i < 21; i++) {
    const started = performance.now();
    const response = await client.render(definitions
      ? input(axis.replace('{x^2};', '{x^2+\\offset};'), `\\def\\offset{${i}/100}`)
      : input(axis.replace('{x^2};', `{x^2+${i}/100};`)));
    assert.equal(response.ok, true, response.error);
    samples.push({ ms: performance.now() - started, renderMs: response.renderMs, rss: process.memoryUsage().rss });
  }
  const activeCpu = process.cpuUsage(cpu);
  const idleCpu = process.cpuUsage();
  await new Promise((resolve) => setTimeout(resolve, 250));
  const idleCpuMs = Object.values(process.cpuUsage(idleCpu)).reduce((a, b) => a + b, 0) / 1000;
  await new Promise((resolve) => setTimeout(resolve, 550));
  const afterIdleRss = process.memoryUsage().rss, starts = client.stats().workerStarts;
  assert.equal((await client.render(input(axis))).ok, true);
  assert.equal(client.stats().workerStarts, starts + 1);
  const times = samples.slice(1).map((sample) => sample.ms).sort((a, b) => a - b);
  const report = { node: process.version, worker, editKind: definitions ? 'external-definitions' : 'picture', iterations: samples.length, coldMs: samples[0].ms, warmP50Ms: times[9], warmP95Ms: times[18],
    initialRss, peakRss: Math.max(...samples.map((sample) => sample.rss)), lastRss: samples.at(-1).rss, afterIdleRss,
    activeCpuMs: Object.values(activeCpu).reduce((a, b) => a + b, 0) / 1000, idleCpuMs, idleWindowMs: 250, idleRestart: true, samples };
  await writeFile(destination, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, samples: undefined }, null, 2));
} finally { await client.dispose(); }
