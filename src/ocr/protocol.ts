export type OcrMode = 'formula' | 'auto' | 'text';

export interface OcrResult {
  readonly text: string;
  readonly ok: boolean;
  readonly mode: OcrMode;
}

export interface OcrRequest {
  readonly id: number;
  readonly image: Uint8Array;
  readonly mode: OcrMode;
}

export type OcrResponse =
  | { readonly id: number; readonly type: 'result'; readonly result: OcrResult }
  | { readonly id: number; readonly type: 'progress'; readonly stage: 'models' | 'decoding' | 'text'; readonly ratio: number }
  | { readonly id: number; readonly type: 'error'; readonly message: string };

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 16_000_000;
