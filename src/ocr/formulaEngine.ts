/// <reference lib="dom" />

// 公式推理流程适配自 OCR Buddy 的 MIT 实现（Copyright 2026 OCR Buddy
// contributors）：pix2text-mfr TrOCR encoder/decoder、ByteLevel-BPE 解码和重复
// token 退避。这里改为 VS Code Webview 的本地资源 URI、可释放会话和进度协议。
import * as ort from 'onnxruntime-web';

const INPUT_SIZE = 384;
const DECODER_START_TOKEN = 2;
const EOS_TOKEN = 2;
const MAX_TOKENS = 256;
const REPEAT_LIMIT = 12;

export interface FormulaAssetUrls {
  readonly encoder: string;
  readonly decoder: string;
  readonly tokenizer: string;
}

export interface FormulaRecognitionResult {
  readonly latex: string;
  /** false 表示重复 token、达到长度上限或空结果，调用方应让用户复核。 */
  readonly ok: boolean;
  readonly usedWasmFallback: boolean;
}

export interface FormulaProgress {
  readonly stage: 'tokenizer' | 'models' | 'decoding';
  readonly completed: number;
  readonly total: number;
}

interface AddedToken {
  readonly id: number;
  readonly special?: boolean;
}

export interface FormulaTokenizerJson {
  readonly model: {
    readonly vocab: Readonly<Record<string, number>>;
  };
  readonly added_tokens?: readonly AddedToken[];
}

interface PreparedTokenizer {
  readonly idToPiece: readonly string[];
  readonly specialIds: ReadonlySet<number>;
  readonly byteInverse: ReadonlyMap<string, number>;
}

function buildByteInverse(): ReadonlyMap<string, number> {
  const bytes: number[] = [];
  for (let index = 33; index <= 126; index += 1) bytes.push(index);
  for (let index = 161; index <= 172; index += 1) bytes.push(index);
  for (let index = 174; index <= 255; index += 1) bytes.push(index);

  const codePoints = bytes.slice();
  let extra = 0;
  for (let byte = 0; byte < 256; byte += 1) {
    if (!bytes.includes(byte)) {
      bytes.push(byte);
      codePoints.push(256 + extra);
      extra += 1;
    }
  }

  const inverse = new Map<string, number>();
  bytes.forEach((byte, index) => {
    const codePoint = codePoints[index];
    if (codePoint !== undefined) inverse.set(String.fromCharCode(codePoint), byte);
  });
  return inverse;
}

export function prepareFormulaTokenizer(json: FormulaTokenizerJson): PreparedTokenizer {
  const pieces: string[] = [];
  for (const [piece, id] of Object.entries(json.model.vocab)) pieces[id] = piece;
  const specialIds = new Set(
    (json.added_tokens ?? []).filter((token) => token.special === true).map((token) => token.id),
  );
  return { idToPiece: pieces, specialIds, byteInverse: buildByteInverse() };
}

export function decodeFormulaTokenIds(tokenizer: PreparedTokenizer, ids: readonly number[]): string {
  const encoded = ids
    .filter((id) => !tokenizer.specialIds.has(id))
    .map((id) => tokenizer.idToPiece[id] ?? '')
    .join('');
  const bytes: number[] = [];
  for (const character of encoded) {
    const byte = tokenizer.byteInverse.get(character);
    if (byte !== undefined) bytes.push(byte);
  }
  return new TextDecoder('utf-8').decode(Uint8Array.from(bytes)).trim();
}

async function fetchArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`无法读取本地 OCR 模型 (${response.status})`);
  return response.arrayBuffer();
}

async function fetchTokenizer(uri: string): Promise<PreparedTokenizer> {
  const response = await fetch(uri, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`无法读取本地公式词表 (${response.status})`);
  return prepareFormulaTokenizer(await response.json() as FormulaTokenizerJson);
}

function preprocessFormula(source: CanvasImageSource): InstanceType<typeof ort.Tensor> {
  const canvas = document.createElement('canvas');
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('当前 Webview 无法创建 2D Canvas。');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  context.drawImage(source, 0, 0, INPUT_SIZE, INPUT_SIZE);

  const pixels = context.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
  const plane = INPUT_SIZE * INPUT_SIZE;
  const tensor = new Float32Array(3 * plane);
  for (let pixel = 0; pixel < plane; pixel += 1) {
    const rgbaOffset = pixel * 4;
    for (let channel = 0; channel < 3; channel += 1) {
      const component = pixels[rgbaOffset + channel] ?? 255;
      tensor[channel * plane + pixel] = (component / 255 - 0.5) / 0.5;
    }
  }
  return new ort.Tensor('float32', tensor, [1, 3, INPUT_SIZE, INPUT_SIZE]);
}

function disposeTensorMap(tensors: Readonly<Record<string, ort.Tensor>>): void {
  const disposed = new Set<ort.Tensor>();
  for (const tensor of Object.values(tensors)) {
    if (!disposed.has(tensor)) {
      disposed.add(tensor);
      tensor.dispose();
    }
  }
}

export class FormulaEngine {
  private sessionsPromise: Promise<readonly [ort.InferenceSession, ort.InferenceSession]> | undefined;
  private tokenizerPromise: Promise<PreparedTokenizer> | undefined;
  private wasmFallback = false;

  public constructor(
    private readonly assets: FormulaAssetUrls,
    private readonly onProgress?: (progress: FormulaProgress) => void,
  ) {}

  private getTokenizer(): Promise<PreparedTokenizer> {
    this.tokenizerPromise ??= (async () => {
      this.onProgress?.({ stage: 'tokenizer', completed: 0, total: 1 });
      const tokenizer = await fetchTokenizer(this.assets.tokenizer);
      this.onProgress?.({ stage: 'tokenizer', completed: 1, total: 1 });
      return tokenizer;
    })().catch((error: unknown) => {
      this.tokenizerPromise = undefined;
      throw error;
    });
    return this.tokenizerPromise;
  }

  private getSessions(): Promise<readonly [ort.InferenceSession, ort.InferenceSession]> {
    this.sessionsPromise ??= this.buildSessions().catch((error: unknown) => {
      this.sessionsPromise = undefined;
      throw error;
    });
    return this.sessionsPromise;
  }

  private async buildSessions(): Promise<readonly [ort.InferenceSession, ort.InferenceSession]> {
    this.onProgress?.({ stage: 'models', completed: 0, total: 2 });
    const [encoderBytes, decoderBytes] = await Promise.all([
      fetchArrayBuffer(this.assets.encoder),
      fetchArrayBuffer(this.assets.decoder),
    ]);
    this.onProgress?.({ stage: 'models', completed: 1, total: 2 });

    const createSession = async (bytes: ArrayBuffer): Promise<ort.InferenceSession> => {
      try {
        return await ort.InferenceSession.create(bytes, {
          executionProviders: ['webgpu', 'wasm'],
          graphOptimizationLevel: 'all',
          logSeverityLevel: 3,
        });
      } catch {
        this.wasmFallback = true;
        return ort.InferenceSession.create(bytes, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
          logSeverityLevel: 3,
        });
      }
    };

    const sessions = await Promise.all([createSession(encoderBytes), createSession(decoderBytes)]);
    this.onProgress?.({ stage: 'models', completed: 2, total: 2 });
    return sessions;
  }

  public async recognize(source: CanvasImageSource): Promise<FormulaRecognitionResult> {
    const [tokenizer, sessions] = await Promise.all([this.getTokenizer(), this.getSessions()]);
    const [encoder, decoder] = sessions;
    const pixelValues = preprocessFormula(source);
    let encoderOutput: ort.InferenceSession.OnnxValueMapType;
    try {
      encoderOutput = await encoder.run({ pixel_values: pixelValues });
    } finally {
      pixelValues.dispose();
    }
    const hiddenStateName = encoder.outputNames[0];
    if (!hiddenStateName) {
      disposeTensorMap(encoderOutput);
      throw new Error('公式 encoder 没有输出张量。');
    }
    const hiddenState = encoderOutput[hiddenStateName];
    if (!hiddenState) {
      disposeTensorMap(encoderOutput);
      throw new Error('公式 encoder 输出缺失。');
    }

    try {
      const ids: number[] = [DECODER_START_TOKEN];
      let repeated = 1;
      let degenerate = false;
      for (let step = 0; step < MAX_TOKENS; step += 1) {
        this.onProgress?.({ stage: 'decoding', completed: step, total: MAX_TOKENS });
        const inputIds = new ort.Tensor(
          'int64',
          BigInt64Array.from(ids, (id) => BigInt(id)),
          [1, ids.length],
        );
        let output: ort.InferenceSession.OnnxValueMapType | undefined;
        let next = 0;
        try {
          output = await decoder.run({ input_ids: inputIds, encoder_hidden_states: hiddenState });
          const logitsName = decoder.outputNames[0];
          if (!logitsName) throw new Error('公式 decoder 没有输出张量。');
          const logits = output[logitsName];
          const vocabularySize = logits?.dims[2];
          if (!logits || typeof vocabularySize !== 'number' || vocabularySize <= 0) {
            throw new Error('公式 decoder 输出维度无效。');
          }

          const values = logits.data as Float32Array;
          const offset = (ids.length - 1) * vocabularySize;
          let best = Number.NEGATIVE_INFINITY;
          for (let token = 0; token < vocabularySize; token += 1) {
            const score = values[offset + token];
            if (score !== undefined && score > best) {
              best = score;
              next = token;
            }
          }
        } finally {
          inputIds.dispose();
          if (output) disposeTensorMap(output);
        }

        if (next === EOS_TOKEN) break;
        repeated = next === ids[ids.length - 1] ? repeated + 1 : 1;
        if (repeated >= REPEAT_LIMIT) {
          degenerate = true;
          break;
        }
        ids.push(next);
      }

      if (ids.length >= MAX_TOKENS) degenerate = true;
      const latex = decodeFormulaTokenIds(tokenizer, ids.slice(1));
      this.onProgress?.({ stage: 'decoding', completed: MAX_TOKENS, total: MAX_TOKENS });
      return { latex, ok: !degenerate && latex.length > 0, usedWasmFallback: this.wasmFallback };
    } finally {
      disposeTensorMap(encoderOutput);
    }
  }

  public async dispose(): Promise<void> {
    const sessions = await this.sessionsPromise?.catch(() => undefined);
    if (sessions) await Promise.all(sessions.map(async (session) => session.release()));
    this.sessionsPromise = undefined;
    this.tokenizerPromise = undefined;
  }
}
