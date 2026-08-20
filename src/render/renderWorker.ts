import { parentPort } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';

import { MathJaxSvgRenderer } from './mathjaxRenderer';
import type { RenderResponse, WorkerRequest } from './protocol';

if (!parentPort) throw new Error('renderWorker 必须在 worker_threads 中运行');
const port = parentPort;

const renderer = new MathJaxSvgRenderer();
let queued: Extract<WorkerRequest, { readonly type: 'render' }> | undefined;
let scheduled = false;

port.on('message', (request: WorkerRequest) => {
  if (request.type === 'dispose-contexts') {
    renderer.clear();
    return;
  }

  if (queued) {
    const superseded: RenderResponse = {
      type: 'result', id: queued.id, ok: false, error: 'superseded', renderMs: 0,
    };
    port.postMessage(superseded);
  }
  queued = request;
  if (scheduled) return;
  scheduled = true;
  setImmediate(flushLatest);
});

/**
 * MathJax 抛的是 `TexError` 这类普通对象，不是 `Error` 实例；
 * 直接 `String(error)` 只会得到 `[object Object]`，用户看不到任何有用信息。
 */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message === 'string' && message.trim()) return message;
  const id = (error as { id?: unknown } | null)?.id;
  if (typeof id === 'string' && id.trim()) return id;
  return String(error);
}

function flushLatest(): void {
  scheduled = false;
  const request = queued;
  queued = undefined;
  if (!request) return;
  const started = performance.now();
  let response: RenderResponse;
  try {
    const result = renderer.render(request);
    response = {
      type: 'result',
      id: request.id,
      ok: true,
      ...result,
      renderMs: performance.now() - started,
    };
  } catch (error) {
    response = {
      type: 'result',
      id: request.id,
      ok: false,
      error: describeError(error),
      renderMs: performance.now() - started,
    };
  }
  port.postMessage(response);
}
