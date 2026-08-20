import { Worker } from 'node:worker_threads';

import type { RenderRequest, RenderResponse } from './protocol';

interface PendingRequest {
  readonly resolve: (value: RenderResponse) => void;
  readonly reject: (reason: Error) => void;
  readonly timer: NodeJS.Timeout;
}

export interface RenderClientStats {
  readonly requests: number;
  readonly workerStarts: number;
  readonly staleResponses: number;
  readonly lastRenderMs: number;
}

export class RenderClient {
  private worker: Worker | undefined;
  private idleTimer: NodeJS.Timeout | undefined;
  private readonly pending = new Map<number, PendingRequest>();
  private nextId = 1;
  private latestId = 0;
  private requests = 0;
  private workerStarts = 0;
  private staleResponses = 0;
  private lastRenderMs = 0;

  constructor(
    private readonly workerPath: string,
    private idleMs: number,
  ) {}

  setIdleMs(idleMs: number): void {
    this.idleMs = idleMs;
    this.armIdleTimer();
  }

  /** 只创建隔离 Worker，不把 MathJax 字节带入扩展主线程。 */
  prepare(): void {
    this.ensureWorker();
    this.armIdleTimer();
  }

  render(input: Omit<RenderRequest, 'type' | 'id'>): Promise<RenderResponse> {
    const id = this.nextId++;
    this.latestId = id;
    this.requests++;
    const worker = this.ensureWorker();
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = undefined;

    return new Promise<RenderResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.pending.has(id)) return;
        const error = new Error('公式渲染超过 10 秒，Worker 已回收');
        const active = this.worker;
        this.worker = undefined;
        this.failWorker(error);
        void active?.terminate();
      }, 10_000);
      timer.unref();
      this.pending.set(id, { resolve, reject, timer });
      worker.postMessage({ type: 'render', id, ...input } satisfies RenderRequest);
    });
  }

  isLatest(response: RenderResponse): boolean {
    return response.id === this.latestId;
  }

  stats(): RenderClientStats {
    return {
      requests: this.requests,
      workerStarts: this.workerStarts,
      staleResponses: this.staleResponses,
      lastRenderMs: this.lastRenderMs,
    };
  }

  async dispose(): Promise<void> {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
    const worker = this.worker;
    this.worker = undefined;
    const error = new Error('渲染 Worker 已关闭');
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
    if (worker) await worker.terminate();
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(this.workerPath);
    this.worker = worker;
    this.workerStarts++;
    worker.on('message', (response: RenderResponse) => {
      const request = this.pending.get(response.id);
      if (!request) return;
      this.pending.delete(response.id);
      clearTimeout(request.timer);
      this.lastRenderMs = response.renderMs;
      if (response.id !== this.latestId) this.staleResponses++;
      request.resolve(response);
      if (this.pending.size === 0) this.armIdleTimer();
    });
    worker.on('error', (error) => {
      if (this.worker === worker) this.failWorker(error);
    });
    worker.on('exit', (code) => {
      if (this.worker !== worker) return;
      this.worker = undefined;
      if (code !== 0 || this.pending.size > 0) {
        this.failWorker(new Error(`渲染 Worker 异常退出：${code}`));
      }
    });
    return worker;
  }

  private failWorker(error: Error): void {
    this.worker = undefined;
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
  }

  private armIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (!this.worker) return;
    this.idleTimer = setTimeout(() => {
      if (this.pending.size > 0) return;
      const worker = this.worker;
      this.worker = undefined;
      this.idleTimer = undefined;
      void worker?.terminate();
    }, this.idleMs);
    this.idleTimer.unref();
  }
}
