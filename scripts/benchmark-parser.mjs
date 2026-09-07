import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

const source = resolve(process.env.SILK_BENCH_SOURCE ?? '.');
const temporary = await mkdtemp(join(tmpdir(), 'silk-parser-bench-'));
try {
  const output = join(temporary, 'source.cjs');
  await build({ stdin: { contents: `export { parseTeXSource } from './src/core/texSource';
    export { formatSiNumber } from './src/render/siunitx';`, resolveDir: source },
    outfile: output, bundle: true, platform: 'node', format: 'cjs', target: 'node18', logLevel: 'silent' });
  const { parseTeXSource, formatSiNumber } = createRequire(import.meta.url)(output);
  const text = Array.from({ length: 4000 }, (_, i) => {
    const name = 'macro' + i.toString(26).replace(/[0-9a-p]/g, (digit) => String.fromCharCode(97 + parseInt(digit, 26)));
    return `\\newcommand{\\${name}}{x}\\usepackage{package${i}}`;
  }).join('\n');
  function sample(fn) {
    for (let i = 0; i < 3; i++) fn();
    const times = [];
    for (let i = 0; i < 15; i++) { const start = performance.now(); fn(); times.push(performance.now() - start); }
    times.sort((a, b) => a - b);
    return { p50Ms: times[7], p95Ms: times[14] };
  }
  const mixed = sample(() => {
    const parsed = parseTeXSource(text);
    if (parsed.definitions.length !== 4000 || parsed.dependencies.length !== 4000) throw Error('Lost declarations');
  });
  const digits = sample(() => {
    if (formatSiNumber('1234567890'.repeat(500)).replace(/\\,/g, '').length !== 5000) throw Error('Lost digits');
  });
  console.log(JSON.stringify({ source, mixed4000DeclarationsAndDependencies: mixed, digits5000: digits }, null, 2));
} finally { await rm(temporary, { recursive: true, force: true }); }
