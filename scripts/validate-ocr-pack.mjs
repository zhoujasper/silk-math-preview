import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { build } from 'esbuild';

const temporary = await mkdtemp(join(tmpdir(), 'silk-math-ocr-validation-'));
const bundle = join(temporary, 'pack-manager.mjs');
const packRoot = join(temporary, 'pack');

try {
  await build({
    entryPoints: ['src/ocr/packManager.ts'],
    outfile: bundle,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    logLevel: 'silent',
  });
  const { OcrPackManager } = await import(`${pathToFileURL(bundle).href}?v=${Date.now()}`);
  const manager = new OcrPackManager(packRoot);
  let lastPercent = 0;
  const progress = {
    report(update) {
      if (typeof update.increment === 'number') {
        lastPercent = Math.min(100, lastPercent + update.increment);
      }
      if (update.message) process.stderr.write(`\r${update.message.padEnd(54)}`);
    },
  };
  const token = {
    isCancellationRequested: false,
    onCancellationRequested() { return { dispose() {} }; },
  };
  await manager.install(progress, token);
  if (!await manager.isInstalled()) throw new Error('下载完成后安装标记无效');
  process.stderr.write('\n');
  console.log(JSON.stringify({ installed: true, validatedPercent: lastPercent }, null, 2));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
