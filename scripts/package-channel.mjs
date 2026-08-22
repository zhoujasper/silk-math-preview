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

const build = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', shell: true, env, cwd: root });
if (build.status !== 0) process.exit(build.status ?? 1);

try {
  if (channel === 'test') {
    writeFileSync(manifestPath, `${JSON.stringify(transformManifest(pkg, 'test'), null, 2)}\n`);
  }
  const packed = spawnSync(
    'npx',
    ['vsce', 'package', '--no-dependencies', '--out', out],
    { stdio: 'inherit', shell: true, env, cwd: root },
  );
  if (packed.status !== 0) process.exit(packed.status ?? 1);
  console.log(`packed ${out} (${channel})`);
} finally {
  writeFileSync(manifestPath, original);
}
