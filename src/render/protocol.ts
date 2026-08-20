export interface RenderRequest {
  readonly type: 'render';
  readonly id: number;
  readonly expression: string;
  readonly displayMode: boolean;
  readonly definitionFingerprint: string;
  readonly definitionPrelude: string;
  readonly foreground: string;
  readonly caretColor: string;
  readonly scale: number;
  /** 1ex 对应的 CSS 像素；0 表示保留 MathJax 的 ex 尺寸。 */
  readonly exPx: number;
  /** 未定义命令渲染成红色原文而不是抛错。 */
  readonly markUnknownCommands: boolean;
}

export interface DisposeContextRequest {
  readonly type: 'dispose-contexts';
}

export type WorkerRequest = RenderRequest | DisposeContextRequest;

export interface RenderSuccess {
  readonly type: 'result';
  readonly id: number;
  readonly ok: true;
  readonly svg: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly renderMs: number;
}

export interface RenderFailure {
  readonly type: 'result';
  readonly id: number;
  readonly ok: false;
  readonly error: string;
  readonly renderMs: number;
}

export type RenderResponse = RenderSuccess | RenderFailure;

