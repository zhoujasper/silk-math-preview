import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import { build } from 'esbuild';
import { tikzStressCases } from '../test/fixtures/tikzStress.mjs';

const output = resolve('.tmp-tikz-smoke');
await mkdir(output, { recursive: true });
await build({ entryPoints: ['src/render/renderClient.ts'], outfile: `${output}/stress-client.mjs`, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
const { RenderClient } = await import(pathToFileURL(`${output}/stress-client.mjs`).href);
const worker = resolve(process.argv[2] ?? 'dist/tikz-worker.js');
const reportPath = resolve(process.argv[3] ?? `${output}/stress.json`);
const client = new RenderClient(worker, 60_000, { workerData: { packRoot: `${output}/runtime` }, timeoutMs: 15_000 });
const input = (expression, definitionPrelude = '') => ({ expression, definitionPrelude, definitionFingerprint: '', displayMode: true, foreground: '#000', caretColor: '', scale: 1, exPx: 0, markUnknownCommands: false });
const hostDelay = monitorEventLoopDelay({ resolution: 10 });
const reports = [];
let peakRss = process.memoryUsage().rss;
const memorySampler = setInterval(() => { peakRss = Math.max(peakRss, process.memoryUsage().rss); }, 20);
hostDelay.enable();
try {
  for (const scenario of tikzStressCases) {
    const samples = [], cpu = process.cpuUsage(), startRss = process.memoryUsage().rss;
    let previousSvg, error;
    try {
      for (let i = 0; i < 6; i++) {
        const start = performance.now();
        const result = await client.render(input(scenario.expression(i), typeof scenario.prelude === 'function' ? scenario.prelude(i) : scenario.prelude));
        assert.equal(result.ok, true, result.error);
        assert(result.widthPx > 0 && result.heightPx > 0 && result.svg.includes('<path'));
        assert.notEqual(result.svg, previousSvg, 'each real source edit must change the SVG');
        previousSvg = result.svg;
        samples.push({ ms: performance.now() - start, renderMs: result.renderMs, bytes: result.svg.length, rss: process.memoryUsage().rss });
      }
      await writeFile(`${output}/stress-${scenario.name}.svg`, previousSvg);
    } catch (failure) { error = String(failure); }
    const warm = samples.slice(1).map((sample) => sample.ms).sort((a, b) => a - b);
    const report = { name: scenario.name, ok: !error, error, firstMs: samples[0]?.ms, warmP50Ms: warm[Math.floor(warm.length / 2)], warmMaxMs: warm.at(-1),
      cpuMs: Object.values(process.cpuUsage(cpu)).reduce((a, b) => a + b, 0) / 1000, startRss, endRss: process.memoryUsage().rss, samples };
    reports.push(report);
    console.log(JSON.stringify({ ...report, samples: undefined }));
  }
  // A burst must not build a queue of expensive full renders; only current + latest run.
  const scenario = tikzStressCases.find((item) => item.name === 'group-6x60');
  const burstCpu = process.cpuUsage(), burstStart = performance.now();
  const burst = await Promise.all(Array.from({ length: 30 }, (_, i) => client.render(input(scenario.expression(i)))));
  assert.equal(burst.at(-1).ok, true, burst.at(-1).error);
  assert.equal(burst.filter((result) => result.error === 'superseded').length, 28);
  const burstReport = { requests: burst.length, skipped: 28, ms: performance.now() - burstStart, cpuMs: Object.values(process.cpuUsage(burstCpu)).reduce((a, b) => a + b, 0) / 1000 };
  const soak = [];
  if (process.argv.includes('--soak')) {
    const labels = tikzStressCases.find((item) => item.name === 'math-labels-80');
    for (let i = 0; i < 30; i++) {
      const result = await client.render(input(labels.expression(i + 10)));
      assert.equal(result.ok, true, result.error);
      soak.push({ rss: process.memoryUsage().rss, ms: result.renderMs, bytes: result.svg.length });
    }
  }
  const hostEventLoopP95Ms = hostDelay.percentile(95) / 1e6, hostEventLoopMaxMs = hostDelay.max / 1e6;
  clearInterval(memorySampler); hostDelay.disable();
  const idleCpu = process.cpuUsage();
  await new Promise((resolve) => setTimeout(resolve, 500));
  const idleCpuMs = Object.values(process.cpuUsage(idleCpu)).reduce((a, b) => a + b, 0) / 1000;
  client.setIdleMs(50);
  await new Promise((resolve) => setTimeout(resolve, 160));
  const afterIdleRss = process.memoryUsage().rss, starts = client.stats().workerStarts;
  assert.equal((await client.render(input(tikzStressCases[0].expression(0)))).ok, true);
  assert.equal(client.stats().workerStarts, starts + 1);
  const report = { node: process.version, worker, reports, burst: burstReport, peakRss, afterIdleRss, idleCpuMs, idleWindowMs: 500,
    hostEventLoopP95Ms, hostEventLoopMaxMs, soak, idleRestart: true, stats: client.stats() };
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, reports: undefined, soak: soak.length ? { requests: soak.length,
    firstTenMinRss: Math.min(...soak.slice(0, 10).map(s => s.rss)), lastTenMinRss: Math.min(...soak.slice(-10).map(s => s.rss)),
    maxMs: Math.max(...soak.map(s => s.ms)) } : undefined }, null, 2));
  if (reports.some((report) => !report.ok)) process.exitCode = 1;
} finally { clearInterval(memorySampler); hostDelay.disable(); await client.dispose(); }
