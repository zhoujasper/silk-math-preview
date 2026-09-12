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
  charset: 'utf8',
  minify: !watch,
  sourcemap: watch,
  logLevel: 'info',
  target: 'node18',
  plugins: [channelPlugin, {
    name: 'shared-ui-locale',
    setup(build) {
      build.onResolve({ filter: /\/uiLocale(?:\.js)?$/ }, () => ({ path: './ui-locale', external: true }));
    },
  }],
};
// Preview and completion use the same scanner. Workers keep their own isolated bundles.
const sharedScanner = {
  name: 'shared-math-scanner',
  setup(build) {
    build.onResolve({ filter: /\/mathScanner(?:\.js)?$/ }, () => ({ path: './math-scanner', external: true }));
  },
};

const builds = [
  {
    ...shared,
    entryPoints: ['src/core/mathScanner.ts'],
    outfile: 'dist/math-scanner.js',
    platform: 'node',
    format: 'cjs',
  },
  {
    ...shared,
    entryPoints: ['src/vscode/ui-locale.ts'],
    plugins: [channelPlugin],
    outfile: 'dist/ui-locale.js',
    platform: 'node',
    format: 'cjs',
  },
  {
    ...shared,
    entryPoints: ['src/vscode/settings-ui.ts'],
    outfile: 'dist/settings-ui.js',
    platform: 'node',
    format: 'cjs',
    external: ['vscode'],
  },
  {
    ...shared,
    entryPoints: ['src/vscode/ocrController.ts'],
    outfile: 'dist/ocr-controller.js',
    platform: 'node',
    format: 'cjs',
    external: ['vscode'],
  },
  {
    ...shared,
    entryPoints: ['src/core/filePatterns.ts'],
    outfile: 'dist/file-patterns.js',
    platform: 'node',
    format: 'cjs',
  },
  {
    ...shared,
    entryPoints: ['src/vscode/math-completion.ts'],
    plugins: [...shared.plugins, sharedScanner],
    outfile: 'dist/math-completion.js',
    platform: 'node',
    format: 'cjs',
    external: ['vscode'],
  },
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
    entryPoints: ['src/vscode/preview-scroll.ts'],
    outfile: 'dist/preview-scroll.js',
    platform: 'node',
    format: 'cjs',
    external: ['vscode', './preview-copy'],
  },
  {
    ...shared,
    entryPoints: ['src/vscode/preview-copy.ts'],
    outfile: 'dist/preview-copy.js',
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
    plugins: [...shared.plugins, sharedScanner],
    outfile: 'dist/extension.js',
    platform: 'node',
    format: 'cjs',
    external: ['vscode', './tikz-context.js', './preview-style', './preview-scroll', './preview-css', './math-completion.js', './file-patterns', './settings-ui', './ocr-controller'],
  },
  {
    ...shared,
    entryPoints: ['src/render/pngWorker.ts'],
    outfile: 'dist/png-worker.js',
    platform: 'node',
    format: 'cjs',
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
    charset: 'utf8',
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
