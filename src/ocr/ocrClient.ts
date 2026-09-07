import { Worker } from 'node:worker_threads';
import type { OcrMode, OcrRequest, OcrResponse, OcrResult } from './protocol';

/** 按需启动，取消/错误销毁整个 WASM 上下文；空闲释放模型内存。 */
export class OcrClient {
  private worker: Worker | undefined;
  private idle: ReturnType<typeof setTimeout> | undefined;
  private sequence = 0;
  private rejectPending: ((error: Error) => void) | undefined;
  constructor(private readonly workerPath: string, private readonly packRoot: string, private readonly idleMs = 60_000) {}

  recognize(image: Uint8Array, mode: OcrMode, signal: AbortSignal, progress: (message: Extract<OcrResponse, { type: 'progress' }>) => void): Promise<OcrResult> {
    if (this.rejectPending) return Promise.reject(new Error('OCR busy'));
    if (signal.aborted) return Promise.reject(new Error('cancelled'));
    clearTimeout(this.idle);
    if (!this.worker) {
      const created = this.worker = new Worker(this.workerPath, { workerData: { packRoot: this.packRoot } });
      // 成功后也要接住空闲 Worker 的异常，下次请求从干净上下文启动。
      created.on('error', () => { if (this.worker === created && !this.rejectPending) this.dispose(); });
      created.on('exit', () => { if (this.worker === created && !this.rejectPending) this.worker = undefined; });
    }
    const worker = this.worker;
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const cleanup = (): void => {
        clearTimeout(timeout);
        worker.off('message', onMessage); worker.off('error', onError); worker.off('exit', onExit);
        signal.removeEventListener('abort', onAbort); this.rejectPending = undefined;
      };
      const fail = (error: Error): void => { cleanup(); this.dispose(); reject(error); };
      const onError = (error: Error): void => fail(error);
      const onExit = (code: number): void => fail(new Error(`OCR Worker exited (${code})`));
      const onAbort = (): void => fail(new Error('cancelled'));
      const onMessage = (message: OcrResponse): void => {
        if (message.id !== id) return;
        if (message.type === 'progress') { progress(message); return; }
        if (message.type === 'error') { fail(new Error(message.message)); return; }
        cleanup();
        this.idle = setTimeout(() => this.dispose(), this.idleMs);
        this.idle.unref();
        resolve(message.result);
      };
      const timeout = setTimeout(() => fail(new Error('ocr-timeout')), 180_000);
      this.rejectPending = fail;
      worker.on('message', onMessage); worker.once('error', onError); worker.once('exit', onExit);
      signal.addEventListener('abort', onAbort, { once: true });
      const request: OcrRequest = { id, image, mode };
      try { worker.postMessage(request); } catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
    });
  }

  dispose(): void {
    clearTimeout(this.idle);
    if (this.rejectPending) { this.rejectPending(new Error('cancelled')); return; }
    const worker = this.worker; this.worker = undefined;
    if (worker) { worker.on('error', () => undefined); void worker.terminate(); }
  }
}
