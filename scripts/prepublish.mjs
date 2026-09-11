import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

/** vsce package 会跑 vscode:prepublish。打包脚本已经按通道编过 bundle 时跳过。 */
if (process.env.SILK_PACKAGING === '1') {
  process.exit(0);
}

const result = spawnSync(process.execPath, [resolve(import.meta.dirname, 'build.mjs')], {
  stdio: 'inherit', cwd: resolve(import.meta.dirname, '..'),
});
process.exit(result.status ?? 1);
