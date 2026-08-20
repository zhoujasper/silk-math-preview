import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import * as https from 'node:https';
import type { IncomingMessage } from 'node:http';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

import type { CancellationToken, Progress } from 'vscode';

import { OCR_PACK_ASSETS, OCR_PACK_BYTES, OCR_PACK_VERSION, type OcrPackAsset } from './packManifest';

interface InstalledMarker {
  readonly version: string;
  readonly installedAt: string;
  readonly bytes: number;
}

export interface OcrInstallProgress {
  readonly message?: string;
  readonly increment?: number;
}

const markerPath = (root: string): string => join(root, 'installed.json');

async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

async function assetIsValid(root: string, asset: OcrPackAsset): Promise<boolean> {
  const path = join(root, asset.target);
  try {
    const info = await stat(path);
    return info.size === asset.size && await hashFile(path) === asset.sha256;
  } catch {
    return false;
  }
}

function request(url: URL, redirects = 0): Promise<IncomingMessage> {
  if (redirects > 8) return Promise.reject(new Error('OCR 下载重定向次数过多'));
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Silk-Math-Preview/0.1' } }, (response) => {
      const location = response.headers.location;
      if (location && response.statusCode && response.statusCode >= 300 && response.statusCode < 400) {
        response.resume();
        void request(new URL(location, url), redirects + 1).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`OCR 资源下载失败：HTTP ${response.statusCode ?? 'unknown'}`));
        return;
      }
      resolve(response);
    });
    req.setTimeout(60_000, () => req.destroy(new Error('OCR 资源下载连接超时')));
    req.once('error', reject);
  });
}

async function downloadAsset(
  root: string,
  asset: OcrPackAsset,
  token: CancellationToken,
  onBytes: (count: number) => void,
): Promise<void> {
  if (await assetIsValid(root, asset)) {
    onBytes(asset.size);
    return;
  }

  const destination = join(root, asset.target);
  const partial = `${destination}.part`;
  await mkdir(dirname(destination), { recursive: true });
  await rm(partial, { force: true });
  const response = await request(new URL(asset.url));
  const hash = createHash('sha256');
  let received = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      if (token.isCancellationRequested) {
        callback(new Error('OCR 组件下载已取消'));
        return;
      }
      received += chunk.length;
      hash.update(chunk);
      onBytes(chunk.length);
      callback(null, chunk);
    },
  });

  const cancel = token.onCancellationRequested(() => response.destroy(new Error('OCR 组件下载已取消')));
  try {
    await pipeline(response, meter, createWriteStream(partial, { flags: 'wx' }));
    const digest = hash.digest('hex');
    if (received !== asset.size || digest !== asset.sha256) {
      throw new Error(`OCR 资源校验失败：${asset.id}`);
    }
    await rm(destination, { force: true });
    await rename(partial, destination);
  } catch (error) {
    await rm(partial, { force: true });
    throw error;
  } finally {
    cancel.dispose();
  }
}

export class OcrPackManager {
  constructor(private readonly root: string) {}

  get rootPath(): string {
    return this.root;
  }

  async isInstalled(): Promise<boolean> {
    try {
      const marker = JSON.parse(await readFile(markerPath(this.root), 'utf8')) as InstalledMarker;
      if (marker.version !== OCR_PACK_VERSION || marker.bytes !== OCR_PACK_BYTES) return false;
      for (const asset of OCR_PACK_ASSETS) {
        const info = await stat(join(this.root, asset.target));
        if (info.size !== asset.size) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  async install(progress: Progress<OcrInstallProgress>, token: CancellationToken): Promise<void> {
    await mkdir(this.root, { recursive: true });
    let reported = 0;
    const onBytes = (bytes: number): void => {
      const before = reported;
      reported = Math.min(OCR_PACK_BYTES, reported + bytes);
      const increment = ((reported - before) / OCR_PACK_BYTES) * 100;
      progress.report({ increment, message: `${Math.round(reported / 1_048_576)} / ${Math.round(OCR_PACK_BYTES / 1_048_576)} MB` });
    };

    // 三路并发可显著缩短首次安装时间，同时避免九个大模型连接一起争抢带宽。
    for (let offset = 0; offset < OCR_PACK_ASSETS.length; offset += 3) {
      if (token.isCancellationRequested) throw new Error('OCR 组件下载已取消');
      const batch = OCR_PACK_ASSETS.slice(offset, offset + 3);
      progress.report({ message: `正在获取 ${batch.map((asset) => asset.id).join(' / ')}` });
      const results = await Promise.allSettled(
        batch.map((asset) => downloadAsset(this.root, asset, token, onBytes)),
      );
      const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
      if (failure) throw failure.reason;
    }

    const marker: InstalledMarker = {
      version: OCR_PACK_VERSION,
      installedAt: new Date().toISOString(),
      bytes: OCR_PACK_BYTES,
    };
    const partial = `${markerPath(this.root)}.part`;
    await writeFile(partial, JSON.stringify(marker, null, 2), 'utf8');
    await rm(markerPath(this.root), { force: true });
    await rename(partial, markerPath(this.root));
  }
}
