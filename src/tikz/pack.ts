import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { get } from 'node:https';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';
import { readTar } from './tar';

export const TIKZ_PACK_VERSION = 'node-tikzjax-1.0.5-dvi2html-0.0.1';
export const TIKZ_PACK_ASSETS = [
  {
    name: 'node-tikzjax',
    url: 'https://registry.npmjs.org/node-tikzjax/-/node-tikzjax-1.0.5.tgz',
    integrity: 'ULp5DwgGLm1TKaELPmiT8qRhD3tkvwamnYi1ZfMd75v5G87XhpU0z8XwyDVQ+mVY9YsKjCZjvMBnL5V7juPWYA==',
  },
  {
    name: '@prinsss/dvi2html',
    url: 'https://registry.npmjs.org/@prinsss/dvi2html/-/dvi2html-0.0.1.tgz',
    integrity: 'AdlM+1uAXH278q50vfpwIU7ykA5FKuxi6mx5haGZCmVTeNw6nxcbfyTIBRmlviesu4W+YJeFFfdv+gJ68O47aw==',
  },
] as const;

const unzip = promisify(gunzip);
interface Marker { version: string; files: Array<{ path: string; sha256: string }> }
const digest = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

async function installed(root: string): Promise<boolean> {
  try {
    const marker = JSON.parse(await readFile(join(root, 'installed.json'), 'utf8')) as Marker;
    if (marker.version !== TIKZ_PACK_VERSION || !marker.files?.length) return false;
    for (const file of marker.files) {
      if (!file.path.startsWith('node_modules/') || file.path.includes('..') || file.path.includes('\\')) return false;
      if (digest(await readFile(join(root, file.path))) !== file.sha256) return false;
    }
    return true;
  } catch { return false; }
}

function download(url: string, signal: AbortSignal): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const request = get(url, { signal, headers: { 'User-Agent': 'Silk-Math-Preview' } }, (response) => {
      if (response.statusCode !== 200) { response.resume(); reject(new Error(`TikZ download: HTTP ${response.statusCode}`)); return; }
      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 16 * 1024 * 1024) { response.destroy(new Error('TikZ download too large')); return; }
        chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve(Buffer.concat(chunks)));
    });
    request.setTimeout(30_000, () => request.destroy(new Error('TikZ download timeout')));
    request.on('error', reject);
  });
}

/** 固定版本 + 整包 SHA-512；安装完成才原子换入缓存，不执行 npm 或安装脚本。 */
export async function ensureTikzPack(root: string, signal: AbortSignal, progress: (message: string) => void = () => undefined): Promise<string> {
  if (await installed(root)) { signal.throwIfAborted(); return root; }
  signal.throwIfAborted();
  await mkdir(dirname(root), { recursive: true });
  const staging = await mkdtemp(`${root}.partial-`);
  const marker: Marker = { version: TIKZ_PACK_VERSION, files: [] };
  try {
    for (const asset of TIKZ_PACK_ASSETS) {
      progress(asset.name);
      const archive = await download(asset.url, signal);
      if (createHash('sha512').update(archive).digest('base64') !== asset.integrity) throw new Error(`TikZ integrity mismatch: ${asset.name}`);
      const files = readTar(await unzip(archive, { maxOutputLength: 32 * 1024 * 1024 }));
      for (const [path, bytes] of files) {
        signal.throwIfAborted();
        if (!path.startsWith('package/')) throw new Error('Invalid npm package');
        const relative = `node_modules/${asset.name}/${path.slice(8)}`;
        const destination = join(staging, relative);
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination, bytes, { flag: 'wx' });
        marker.files.push({ path: relative, sha256: digest(bytes) });
      }
    }
    await writeFile(join(staging, 'installed.json'), JSON.stringify(marker));
    signal.throwIfAborted();
    // 只删除此版本自身的无效组件缓存；用户文档从不写入这里。
    await rm(root, { recursive: true, force: true });
    await rename(staging, root);
    return root;
  } finally { await rm(staging, { recursive: true, force: true }); }
}
