import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import type * as vscode from 'vscode';
import { writeImageClipboard } from './image-clipboard';

export interface CopyPreviewSource {
  readonly uri: vscode.Uri;
  readonly widthPx: number;
  readonly heightPx: number;
}

export async function copyPreviewPng(source: CopyPreviewSource, signal: AbortSignal): Promise<void> {
  const uri = source.uri.toString(true);
  const prefix = 'data:image/svg+xml;base64,';
  if (!uri.startsWith(prefix) || uri.length > 3_000_000) throw new Error('invalid-preview-image');
  if (signal.aborted) throw new Error('cancelled');
  const png = await new Promise<Buffer>((resolve, reject) => {
    const worker = new Worker(join(__dirname, 'png-worker.js'), { workerData: {
      svg: Buffer.from(uri.slice(prefix.length), 'base64').toString('utf8'), widthPx: source.widthPx, heightPx: source.heightPx,
    } });
    let settled = false;
    const abort = () => finish(new Error('cancelled'));
    const timer = setTimeout(() => finish(new Error('png-render-timeout')), 20_000);
    const finish = (error?: Error, bytes?: Buffer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      void worker.terminate();
      if (error) reject(error); else resolve(bytes!);
    };
    signal.addEventListener('abort', abort, { once: true });
    worker.once('error', finish);
    worker.once('exit', () => { if (!settled) finish(new Error('png-worker-exited')); });
    worker.once('message', (message: { png?: Uint8Array; error?: string }) => {
      const bytes = message.png instanceof Uint8Array ? Buffer.from(message.png) : undefined;
      if (bytes && bytes.length <= 20 * 1024 * 1024 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) finish(undefined, bytes);
      else finish(new Error(message.error ?? 'invalid-png'));
    });
  });
  if (signal.aborted) throw new Error('cancelled');
  await writeImageClipboard(png, signal);
}
