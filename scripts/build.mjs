import { build, context } from 'esbuild';
import { resolve } from 'node:path';

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
    entryPoints: ['src/extension.ts'],
    outfile: 'dist/extension.js',
    platform: 'node',
    format: 'cjs',
    external: ['vscode'],
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
    entryPoints: ['src/ocr/ocrWebview.ts'],
    outfile: 'dist/ocr-webview.js',
    platform: 'browser',
    format: 'iife',
    target: 'chrome114',
    alias: {
      'onnxruntime-web': resolve('src/ocr/ortShim.ts'),
    },
  },
];

if (watch) {
  const contexts = await Promise.all(builds.map((options) => context(options)));
  await Promise.all(contexts.map((item) => item.watch()));
  console.log('Silk Math Preview 正在监听构建变化。');
} else {
  await Promise.all(builds.map((options) => build(options)));
}
