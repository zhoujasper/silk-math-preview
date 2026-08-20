import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { captureCommands } from '../src/ocr/captureService';
import { OCR_PACK_ASSETS, OCR_PACK_BYTES } from '../src/ocr/packManifest';

describe('OCR 可选包合同', () => {
  it('所有资源固定版本、大小、哈希和唯一目标路径', () => {
    expect(OCR_PACK_BYTES).toBe(98_412_470);
    expect(new Set(OCR_PACK_ASSETS.map((asset) => asset.target)).size).toBe(OCR_PACK_ASSETS.length);
    for (const asset of OCR_PACK_ASSETS) {
      expect(asset.url).toMatch(/^https:\/\//);
      expect(asset.url).not.toContain('/latest/');
      expect(asset.size).toBeGreaterThan(1_000);
      expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('按需包包含当前 ORT WebGPU bundle 实际请求的 WASM loader', () => {
    const packageRoot = resolve('node_modules/onnxruntime-web');
    const metadata = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')) as {
      readonly version?: string;
    };
    expect(metadata.version).toBe('1.26.0');
    const runtime = readFileSync(resolve(packageRoot, 'dist/ort.webgpu.min.js'), 'utf8');
    const loaders = [...runtime.matchAll(/ort-wasm-[A-Za-z0-9._-]+\.mjs/g)]
      .map((match) => match[0]);
    expect([...new Set(loaders)]).toEqual(['ort-wasm-simd-threaded.asyncify.mjs']);
    const targets = new Set(OCR_PACK_ASSETS.map((asset) => asset.target));
    for (const loader of loaders) {
      expect(targets.has(`ort/${loader}`)).toBe(true);
      expect(targets.has(`ort/${loader.replace(/\.mjs$/, '.wasm')}`)).toBe(true);
    }
  });

  it('跨平台截图始终使用参数数组而非拼接 shell 文本', () => {
    const windows = captureCommands('win32', 'C:\\A B\\shot.png', 'C:\\ext\\capture.ps1')[0]!;
    expect(windows.command).toBe('powershell.exe');
    expect(windows.args).toContain('C:\\A B\\shot.png');
    expect(captureCommands('darwin', '/tmp/a b.png', '')[0]).toEqual({
      command: '/usr/sbin/screencapture', args: ['-x', '/tmp/a b.png'],
    });
    expect(captureCommands('linux', '/tmp/a.png', '')).toHaveLength(5);
  });
});
