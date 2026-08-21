import { Worker } from 'node:worker_threads';

import type { RenderRequest, RenderResponse } from './protocol';

interface PendingRequest {
  readonly id: number;
  readonly payload: Omit<RenderRequest, 'type' | 'id'>;
  readonly resolve: (value: RenderResponse) => void;
  readonly reject: (reason: Error) => void;
  timer?: NodeJS.Timeout;
}

export interface RenderClientStats {
  readonly requests: number;
  readonly workerStarts: number;
  readonly staleResponses: number;
  readonly lastRenderMs: number;
}

function superseded(id: number): RenderResponse {
  return { type: 'result', id, ok: false, error: 'superseded', renderMs: 0 };
}

export class RenderClient {
  private worker: Worker | undefined;
  private idleTimer: NodeJS.Timeout | undefined;
  private inflight: PendingRequest | undefined;
  private queued: PendingRequest | undefined;
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
    return new Promise<RenderResponse>((resolve, reject) => {
      const request: PendingRequest = { id, payload: input, resolve, reject };
      if (this.inflight === undefined) {
        this.send(request);
        return;
      }
      if (this.queued) {
        this.staleResponses++;
        this.queued.resolve(superseded(this.queued.id));
      }
      this.queued = request;
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
    this.failPending(error);
    if (worker) await worker.terminate();
  }

  private send(request: PendingRequest): void {
    const worker = this.ensureWorker();
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
    this.inflight = request;
    const timer = setTimeout(() => {
      if (this.inflight?.id !== request.id) return;
      const error = new Error('公式渲染超过 10 秒，Worker 已回收');
      const active = this.worker;
      this.worker = undefined;
      this.failPending(error);
      void active?.terminate();
    }, 10_000);
    timer.unref();
    request.timer = timer;
    worker.postMessage({ type: 'render', id: request.id, ...request.payload } satisfies RenderRequest);
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(this.workerPath);
    this.worker = worker;
    this.workerStarts++;
    worker.on('message', (response: RenderResponse) => {
      const request = this.inflight;
      if (!request || request.id !== response.id) return;
      this.inflight = undefined;
      if (request.timer) clearTimeout(request.timer);
      this.lastRenderMs = response.renderMs;
      if (response.id !== this.latestId) this.staleResponses++;
      request.resolve(response);
      if (this.queued) {
        const next = this.queued;
        this.queued = undefined;
        this.send(next);
        return;
      }
      this.armIdleTimer();
    });
    worker.on('error', (error) => {
      if (this.worker === worker) this.failPending(error);
    });
    worker.on('exit', (code) => {
      if (this.worker !== worker) return;
      this.worker = undefined;
      if (code !== 0 || this.inflight !== undefined || this.queued !== undefined) {
        this.failPending(new Error(`渲染 Worker 异常退出：${code}`));
      }
    });
    return worker;
  }

  private failPending(error: Error): void {
    this.worker = undefined;
    const inflight = this.inflight;
    const queued = this.queued;
    this.inflight = undefined;
    this.queued = undefined;
    if (inflight?.timer) clearTimeout(inflight.timer);
    inflight?.reject(error);
    queued?.reject(error);
  }

  private armIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (!this.worker || this.inflight !== undefined || this.queued !== undefined) return;
    this.idleTimer = setTimeout(() => {
      if (this.inflight !== undefined || this.queued !== undefined) return;
      const worker = this.worker;
      this.worker = undefined;
      this.idleTimer = undefined;
      void worker?.terminate();
    }, this.idleMs);
    this.idleTimer.unref();
  }
}
