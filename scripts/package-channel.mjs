import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { transformManifest, vsixFileName } from './channelManifest.mjs';

const channel = process.argv[2] === 'test' ? 'test' : 'release';
const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(root, 'package.json');
const original = readFileSync(manifestPath, 'utf8');
const pkg = JSON.parse(original);
const out = vsixFileName(pkg, channel);

const env = {
  ...process.env,
  SILK_CHANNEL: channel,
  SILK_PACKAGING: '1',
};

const build = spawnSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit', env, cwd: root });
if (build.status !== 0) process.exit(build.status ?? 1);

try {
  if (channel === 'test') {
    writeFileSync(manifestPath, `${JSON.stringify(transformManifest(pkg, 'test'), null, 2)}\n`);
  }
  const packed = spawnSync(
    process.execPath,
    ['node_modules/@vscode/vsce/vsce', 'package', '--no-dependencies', '--out', out],
    { stdio: 'inherit', env, cwd: root },
  );
  if (packed.status !== 0) process.exitCode = packed.status ?? 1;
  else console.log(`packed ${out} (${channel})`);
} finally {
  writeFileSync(manifestPath, original);
}
