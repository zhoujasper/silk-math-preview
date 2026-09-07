import { join } from 'node:path';
import * as vscode from 'vscode';
import { PRODUCT_NAME } from '../core/channel';
import { RenderClient } from '../render/renderClient';
import type { RenderRequest, RenderResponse } from '../render/protocol';
import { ensureTikzPack, TIKZ_PACK_VERSION } from '../tikz/pack';

type Input = Omit<RenderRequest, 'id' | 'type'>;

/** 关闭时不下载、不启动 Worker；首次进入图形才准备可离线复用的组件。 */
export class TikzService implements vscode.Disposable {
  private client: RenderClient | undefined;
  private ready: PromiseLike<string> | undefined;
  private installedRoot: string | undefined;
  private abort = new AbortController();
  private previous: { key: string; promise: Promise<RenderResponse> } | undefined;
  private idleMs = 60_000;

  constructor(private readonly context: vscode.ExtensionContext) {}

  setIdleMs(ms: number): void { this.idleMs = ms; this.client?.setIdleMs(ms); }

  render(input: Input): Promise<RenderResponse> {
    const key = JSON.stringify([input.expression, input.definitionPrelude, input.scale]);
    if (this.previous?.key === key) return this.previous.promise;
    const controller = this.abort;
    const signal = controller.signal;
    const promise = (async (): Promise<RenderResponse> => {
      try {
        const root = this.installedRoot ?? await (this.ready ??= vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: `${PRODUCT_NAME}: 准备 TikZ 本地渲染组件 / Preparing local TikZ runtime`,
          cancellable: true,
        }, async (progress, token) => {
          const cancel = token.onCancellationRequested(() => this.cancel());
          const timeout = setTimeout(() => controller.abort(), 120_000);
          try {
            return await ensureTikzPack(join(this.context.globalStorageUri.fsPath, TIKZ_PACK_VERSION), signal, (message) => progress.report({ message }));
          } finally { cancel.dispose(); clearTimeout(timeout); }
        }));
        signal.throwIfAborted();
        this.installedRoot = root;
        const client = this.client ??= new RenderClient(this.context.asAbsolutePath('dist/tikz-worker.js'), this.idleMs, { workerData: { packRoot: root }, timeoutMs: 15_000 });
        return await client.render(input);
      } catch (error) {
        if (signal === this.abort.signal) {
          this.ready = undefined;
          if (signal.aborted) this.abort = new AbortController();
        }
        return { type: 'result', id: 0, ok: false, error: signal.aborted ? 'cancelled' : `TikZ: ${error instanceof Error ? error.message : String(error)}`, renderMs: 0 };
      }
    })();
    this.previous = { key, promise };
    void promise.then((result) => { if (!result.ok && this.previous?.promise === promise) this.previous = undefined; });
    return promise;
  }

  cancel(): void {
    this.abort.abort();
    this.abort = new AbortController();
    this.ready = undefined;
    this.previous = undefined;
    const client = this.client;
    this.client = undefined;
    void client?.dispose();
  }

  dispose(): void { this.cancel(); }
}
