// SPDX-License-Identifier: GPL-3.0-or-later
import { parentPort, workerData } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import type { RenderRequest, RenderResponse } from '../render/protocol';
import { TikzEngine } from './engine';

const { packRoot, libraryPath } = workerData as { packRoot: string; libraryPath?: string };
const engine = new TikzEngine(packRoot, libraryPath);
parentPort!.on('message', async (request: RenderRequest) => {
  const started = performance.now();
  let result: RenderResponse;
  try {
    const image = await engine.render(request.expression, request.definitionPrelude, request.scale);
    result = { type: 'result', id: request.id, ok: true, ...image, renderMs: performance.now() - started };
  } catch (error) {
    result = { type: 'result', id: request.id, ok: false, error: error instanceof Error ? error.message : String(error), renderMs: performance.now() - started };
  }
  parentPort!.postMessage(result);
});
