export type OcrAssetGroup = 'runtime' | 'formula' | 'text-general';

export interface OcrPackAsset {
  readonly id: string;
  readonly group: OcrAssetGroup;
  readonly target: string;
  readonly url: string;
  readonly size: number;
  readonly sha256: string;
  readonly license: 'MIT' | 'Apache-2.0';
}

export const OCR_PACK_VERSION = '2026-08-18.1';

const ORT_BASE = 'https://unpkg.com/onnxruntime-web@1.26.0/dist';
const MFR_BASE = 'https://huggingface.co/Brian314/pix2text-mfr-quantized/resolve/4b1c45ae364c5e97c644281b89c25987ee1bce8c';
const PADDLE_COMMIT = '3a180da5b1a3bab3371d970f4da42cb9b354a9a7';
const PADDLE_MEDIA = `https://media.githubusercontent.com/media/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/${PADDLE_COMMIT}`;
const PADDLE_RAW = `https://raw.githubusercontent.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/${PADDLE_COMMIT}`;

/** 固定版本、固定大小和 SHA-256；安装器逐文件校验后才发布完成标记。 */
export const OCR_PACK_ASSETS: readonly OcrPackAsset[] = [
  {
    id: 'ort-js', group: 'runtime', target: 'ort/ort.webgpu.min.js',
    url: `${ORT_BASE}/ort.webgpu.min.js`, size: 67_259,
    sha256: '29ed309c294dd3ee3dc3952e3621315a8e604ff8ef1d980931c71514407e10ea', license: 'MIT',
  },
  {
    id: 'ort-asyncify-loader', group: 'runtime', target: 'ort/ort-wasm-simd-threaded.asyncify.mjs',
    url: `${ORT_BASE}/ort-wasm-simd-threaded.asyncify.mjs`, size: 47_389,
    sha256: '8c66e9204e20b27147694b86d303764e085838218d6ecb45004b87f2b8b5d474', license: 'MIT',
  },
  {
    id: 'ort-asyncify-wasm', group: 'runtime', target: 'ort/ort-wasm-simd-threaded.asyncify.wasm',
    url: `${ORT_BASE}/ort-wasm-simd-threaded.asyncify.wasm`, size: 23_678_474,
    sha256: '66fe6d69b8835a9af0cde19533bafb09c71418bccf7c095d8c3c78f5800b01e8', license: 'MIT',
  },
  {
    id: 'mfr-encoder', group: 'formula', target: 'models/mfr_encoder.onnx',
    url: `${MFR_BASE}/encoder_model.onnx?download=true`, size: 23_083_189,
    sha256: '5e5141ed5f6e05851b1a38b6df85fe17c1dcb779358729fa707f9ee36b7b9dd9', license: 'MIT',
  },
  {
    id: 'mfr-decoder', group: 'formula', target: 'models/mfr_decoder.onnx',
    url: `${MFR_BASE}/decoder_model.onnx?download=true`, size: 30_114_937,
    sha256: 'fd0f92d7a012f3dae41e1ac79421aea0ea888b5a66cb3f9a004e424f82f3daed', license: 'MIT',
  },
  {
    id: 'mfr-tokenizer', group: 'formula', target: 'models/mfr_tokenizer.json',
    url: `${MFR_BASE}/tokenizer.json?download=true`, size: 39_161,
    sha256: '3e2ab757277d22639bec28c9d7972e352d3d1dba223051fa674002dc5ab64df3', license: 'MIT',
  },
  {
    id: 'ppocr-detector', group: 'text-general', target: 'models/PP-OCRv5_mobile_det_infer.onnx',
    url: `${PADDLE_MEDIA}/detection/PP-OCRv5_mobile_det_infer.onnx`, size: 4_748_769,
    sha256: 'd7fe3ea74652890722c0f4d02458b7261d9f5ae6c92904d05707c9eb155c7924', license: 'Apache-2.0',
  },
  {
    id: 'ppocr-general', group: 'text-general', target: 'models/PP-OCRv5_mobile_rec_infer.onnx',
    url: `${PADDLE_MEDIA}/recognition/PP-OCRv5_mobile_rec_infer.onnx`, size: 16_559_278,
    sha256: 'd253c3cbee6e507828a5271a30ab0ec8ae7c2a99d0cc8e6f844fe380809d22b3', license: 'Apache-2.0',
  },
  {
    id: 'ppocr-general-dict', group: 'text-general', target: 'models/ppocrv5_dict.txt',
    url: `${PADDLE_RAW}/recognition/ppocrv5_dict.txt`, size: 74_014,
    sha256: '9dfc80c50b6cb07399a47a7cf25d11db475fb4ad0e1fc96b2eff6467c8166ff3', license: 'Apache-2.0',
  },
] as const;

export const OCR_PACK_BYTES = OCR_PACK_ASSETS.reduce((sum, asset) => sum + asset.size, 0);
