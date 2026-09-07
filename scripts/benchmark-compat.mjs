import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

// Run with node --expose-gc. Unique frames deliberately bypass SVG result caches.
const temporary = await mkdtemp(join(tmpdir(), 'silk-compat-bench-'));
try {
  const output = join(temporary, 'renderer.cjs');
  await build({ entryPoints: ['src/render/mathjaxRenderer.ts'], outfile: output,
    bundle: true, platform: 'node', format: 'cjs', target: 'node18', logLevel: 'silent' });
  const { MathJaxSvgRenderer } = createRequire(import.meta.url)(output);
  const renderer = new MathJaxSvgRenderer();
  const base = { displayMode: true, definitionFingerprint: 'compat', definitionPrelude: '',
    foreground: '#d4d4d4', caretColor: '#ffb454', scale: 1, exPx: 7, markUnknownCommands: false };
  const samples = {};
  const scenarios = {
    units24: Array.from({ length: 24 }, (_, i) => String.raw`\qty{${i}.234}{\kilo\metre\per\second\squared}`).join('+'),
    numbers40: String.raw`\begin{array}{rr}` + Array.from({ length: 20 }, (_, i) =>
      String.raw`\num{${i}.12345}&\num{123456789.01234}`).join(String.raw`\\`) + String.raw`\end{array}`,
  };
  for (const [name, expression] of Object.entries(scenarios)) {
    for (let i = 0; i < 8; i++) renderer.render({ ...base, expression: `${expression}+${i}` });
    const times = [];
    for (let i = 0; i < 40; i++) {
      const started = performance.now();
      renderer.render({ ...base, expression: `${expression}+${i + 8}` });
      times.push(performance.now() - started);
    }
    times.sort((a, b) => a - b);
    samples[name] = { p50Ms: times[20], p95Ms: times[38] };
  }
  global.gc?.();
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < 120; i++) renderer.render({ ...base,
    definitionFingerprint: `changing-${i}`, definitionPrelude: `\\def\\value{${i}}`,
    expression: scenarios.units24 + String.raw`+\value` });
  global.gc?.();
  const retainedHeapGrowthMiB = (process.memoryUsage().heapUsed - before) / 1_048_576;
  renderer.clear();
  global.gc?.();
  console.log(JSON.stringify({ samples, retainedHeapGrowthMiB,
    heapAfterClearMiB: process.memoryUsage().heapUsed / 1_048_576, gcAvailable: !!global.gc }, null, 2));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
