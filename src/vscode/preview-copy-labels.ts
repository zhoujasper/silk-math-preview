import { resolveUiLocale, type UiLocaleId } from '../core/uiLocale';

type CopyLabels = readonly [title: string, busy: string, done: string, retry: string, error: string];
const LABELS: Record<UiLocaleId, CopyLabels> = {
  en: ['Copy PNG (black on white)', 'Copying formula…', 'Formula copied as a PNG (black on white).', 'Click to copy the PNG.', 'Could not copy the image. Click to retry.'],
  'zh-hans': ['复制白底黑字 PNG', '正在复制公式…', '公式已复制为白底黑字 PNG。', '点击复制 PNG 图片。', '图片复制失败，请点击重试。'],
  'zh-hant': ['複製白底黑字 PNG', '正在複製公式…', '公式已複製為白底黑字 PNG。', '點擊複製 PNG 圖片。', '圖片複製失敗，請點擊重試。'],
  ja: ['白地に黒の PNG をコピー', '数式をコピー中…', '数式を白地に黒の PNG としてコピーしました。', 'クリックして PNG をコピー。', '画像をコピーできませんでした。クリックして再試行してください。'],
  ko: ['흰 배경·검은 글자 PNG 복사', '수식 복사 중…', '수식을 흰 배경·검은 글자 PNG로 복사했습니다.', '클릭하여 PNG를 복사하세요.', '이미지를 복사하지 못했습니다. 클릭하여 다시 시도하세요.'],
  de: ['PNG kopieren (Schwarz auf Weiß)', 'Formel wird kopiert…', 'Formel als PNG kopiert (Schwarz auf Weiß).', 'Klicken, um das PNG zu kopieren.', 'Bild konnte nicht kopiert werden. Zum Wiederholen klicken.'],
  fr: ['Copier le PNG en noir sur blanc', 'Copie de la formule…', 'Formule copiée en PNG en noir sur blanc.', 'Cliquez pour copier le PNG.', 'Impossible de copier l’image. Cliquez pour réessayer.'],
  es: ['Copiar PNG en negro sobre blanco', 'Copiando fórmula…', 'Fórmula copiada como PNG en negro sobre blanco.', 'Haz clic para copiar el PNG.', 'No se pudo copiar la imagen. Haz clic para reintentar.'],
  pt: ['Copiar PNG em preto no branco', 'Copiando fórmula…', 'Fórmula copiada como PNG em preto no branco.', 'Clique para copiar o PNG.', 'Não foi possível copiar a imagem. Clique para tentar novamente.'],
  ru: ['Копировать PNG: чёрное на белом', 'Копирование формулы…', 'Формула скопирована как PNG: чёрное на белом.', 'Нажмите, чтобы скопировать PNG.', 'Не удалось скопировать изображение. Нажмите, чтобы повторить.'],
  it: ['Copia PNG in nero su bianco', 'Copia della formula…', 'Formula copiata come PNG in nero su bianco.', 'Fai clic per copiare il PNG.', 'Impossibile copiare l’immagine. Fai clic per riprovare.'],
};

export function previewCopyLabels(language: string): CopyLabels { return LABELS[resolveUiLocale(language)]; }
