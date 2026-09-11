import { resolveUiLocale } from '../core/uiLocale';

const EN = {
  input: 'Recognize image', capture: 'Select screen region', paste: 'Paste image', upload: 'Choose image…',
  inputHint: 'Select a region, paste an image, or choose a PNG / JPEG', pasteHint: 'Configurable in keyboard shortcuts',
  working: 'Recognizing image…', busy: 'Recognition is running. Use Cancel in the progress notification to stop it.',
  result: 'LaTeX ready', edit: 'Edit result…', again: 'Recognize as…', editHint: 'Review the result; Enter to continue',
  emptyClipboard: 'No image in the clipboard. Copy an image or choose a PNG / JPEG.',
  noResult: 'No result recognized. Select the formula more closely and try again.',
  imageTooLarge: 'Image too large. Use an image under 20 MB and 16 million pixels.',
  invalidImage: 'Could not decode this image. Choose a valid PNG or JPEG.',
  unsupportedImage: 'Choose a PNG or JPEG image.',
  timeout: 'Recognition timed out. Select a smaller region and try again.',
  targetChanged: 'The target document changed during recognition. Copy the result and paste it at the desired position.',
  captureUnavailable: 'Screen selection is unavailable. Paste an image or choose a PNG / JPEG.',
  editMultiline: 'Edit result',
};
type Copy = typeof EN;
const ZH: Copy = {
  input: '识别图片', capture: '框选屏幕区域', paste: '粘贴图片', upload: '选择图片…',
  inputHint: '框选截图、粘贴图片，或选择 PNG / JPEG', pasteHint: '可在快捷键设置中修改',
  working: '正在识别图片…', busy: '正在识别，可在进度提示中点击取消。',
  result: 'LaTeX 识别完成', edit: '编辑结果…', again: '切换识别类型…', editHint: '检查识别结果，按 Enter 继续',
  emptyClipboard: '剪贴板里没有图片，请先复制图片或选择 PNG / JPEG 文件。',
  noResult: '没有识别出内容，请贴近公式重新框选。',
  imageTooLarge: '图片过大，请使用小于 20 MB、1600 万像素的图片。',
  invalidImage: '无法解码图片，请选择有效的 PNG 或 JPEG。',
  unsupportedImage: '请选择 PNG 或 JPEG 图片。',
  timeout: '识别超时，请缩小选区后重试。',
  targetChanged: '识别期间原文档已改变，请复制结果后粘贴到需要的位置。',
  captureUnavailable: '暂时无法框选屏幕，可以粘贴图片或选择 PNG / JPEG 文件。',
  editMultiline: '编辑识别结果',
};
const ZHT: Copy = {
  input: '辨識圖片', capture: '框選螢幕區域', paste: '貼上圖片', upload: '選擇圖片…',
  inputHint: '框選截圖、貼上圖片，或選擇 PNG / JPEG', pasteHint: '可在快速鍵設定中修改',
  working: '正在辨識圖片…', busy: '正在辨識，可在進度提示中按取消。',
  result: 'LaTeX 辨識完成', edit: '編輯結果…', again: '切換辨識類型…', editHint: '檢查辨識結果，按 Enter 繼續',
  emptyClipboard: '剪貼簿裡沒有圖片，請先複製圖片或選擇 PNG / JPEG 檔案。',
  noResult: '沒有辨識出內容，請貼近公式重新框選。',
  imageTooLarge: '圖片過大，請使用小於 20 MB、1600 萬像素的圖片。',
  invalidImage: '無法解碼圖片，請選擇有效的 PNG 或 JPEG。',
  unsupportedImage: '請選擇 PNG 或 JPEG 圖片。',
  timeout: '辨識逾時，請縮小選區後重試。',
  targetChanged: '辨識期間原文件已改變，請複製結果後貼至需要的位置。',
  captureUnavailable: '暫時無法框選螢幕，可以貼上圖片或選擇 PNG / JPEG 檔案。',
  editMultiline: '編輯辨識結果',
};
export function ocrCopy(language: string): Copy {
  const locale = resolveUiLocale(language);
  return locale === 'zh-hans' ? ZH : locale === 'zh-hant' ? ZHT : EN;
}
