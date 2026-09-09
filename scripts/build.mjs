import { build, context } from 'esbuild';
import { resolve } from 'node:path';
import { archiveTikzSource } from './tikz-source-archive.mjs';

const watch = process.argv.includes('--watch');
const testChannel = process.env.SILK_CHANNEL === 'test';
const channelPlugin = {
  name: 'silk-channel',
  setup(build) {
    if (!testChannel) return;
    build.onResolve({ filter: /(^|\/)channel$/ }, (args) => {
      if (args.path.includes('channelTest')) return undefined;
      return { path: resolve('src/core/channelTest.ts') };
    });
  },
};
const shared = {
  bundle: true,
  minify: !watch,
  sourcemap: watch,
  logLevel: 'info',
  target: 'node18',
  plugins: [channelPlugin],
};

const builds = [
  {
    ...shared,
    entryPoints: ['src/vscode/preview-style.ts'],
    outfile: 'dist/preview-style.js',
    platform: 'node',
    format: 'cjs',
    external: ['vscode'],
  },
  {
    ...shared,
    entryPoints: ['src/vscode/preview-css.ts'],
    outfile: 'dist/preview-css.js',
    platform: 'node',
    format: 'cjs',
    external: ['vscode'],
  },
  {
    ...shared,
    entryPoints: ['src/vscode/tikz-context.ts'],
    outfile: 'dist/tikz-context.js',
    platform: 'node',
    format: 'cjs',
  },
  {
    ...shared,
    entryPoints: ['src/tikz/worker.ts'],
    outfile: 'dist/tikz-worker.js',
    platform: 'node',
    format: 'cjs',
    // TeX/DVI dependencies are fetched as unmodified, pinned optional packages.
    external: ['node-tikzjax', '@prinsss/dvi2html'],
  },
  {
    ...shared,
    entryPoints: ['src/extension.ts'],
    outfile: 'dist/extension.js',
    platform: 'node',
    format: 'cjs',
    external: ['vscode', './tikz-context.js', './preview-style', './preview-css'],
  },
  {
    ...shared,
    entryPoints: ['src/render/renderWorker.ts'],
    outfile: 'dist/render-worker.js',
    platform: 'node',
    format: 'cjs',
  },
  {
    bundle: true,
    minify: !watch,
    sourcemap: watch,
    logLevel: 'info',
    entryPoints: ['src/ocr/ocrWorker.ts'],
    outfile: 'dist/ocr-worker.js',
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    alias: {
      'onnxruntime-web': resolve('src/ocr/ortShim.ts'),
    },
  },
];

await archiveTikzSource();

if (watch) {
  const contexts = await Promise.all(builds.map((options) => context(options)));
  await Promise.all(contexts.map((item) => item.watch()));
  console.log('Silk Math Preview 正在监听构建变化。');
} else {
  await Promise.all(builds.map((options) => build(options)));
}
