/** VS Code `env.language` 能对上的常见界面语言。其余回退英文。 */
export const UI_LOCALE_IDS = [
  'en',
  'zh-hans',
  'zh-hant',
  'ja',
  'ko',
  'de',
  'fr',
  'es',
  'pt',
  'ru',
  'it',
] as const;

export type UiLocaleId = (typeof UI_LOCALE_IDS)[number];

/** README 页内锚点，英文在前。商店只渲染这一份 Markdown。 */
export const README_LOCALE_ANCHORS = [
  { id: 'english', label: 'English' },
  { id: 'chinese', label: '中文' },
  { id: 'chinese-traditional', label: '繁體中文' },
  { id: 'japanese', label: '日本語' },
  { id: 'korean', label: '한국어' },
  { id: 'german', label: 'Deutsch' },
  { id: 'french', label: 'Français' },
  { id: 'spanish', label: 'Español' },
  { id: 'portuguese', label: 'Português' },
  { id: 'russian', label: 'Русский' },
  { id: 'italian', label: 'Italiano' },
] as const;

export interface OcrUiCopy {
  readonly downloadPrompt: string;
  readonly downloadAction: string;
  readonly installing: string;
  readonly installed: string;
  readonly enableFirst: string;
  readonly copied: string;
  readonly errorPrefix: string;
  readonly insertFailed: string;
  readonly title: string;
  readonly auto: string;
  readonly formula: string;
  readonly text: string;
  readonly copy: string;
  readonly insert: string;
  readonly loadFormulaModel: string;
  readonly parseFormula: string;
  readonly formulaIncomplete: string;
  readonly recognizingText: string;
}

export interface UiCopy {
  readonly previewSize: string;
  readonly editPreviewCss: string;
  readonly configureCompletionShortcut: string;
  readonly configureShortcuts: string;
  readonly completionMode: string;
  readonly where: string;
  readonly otherFiles: string;
  readonly previewDefinitions: string;
  readonly tikzPreview: string;
  readonly tikzPreviewHint: string;
  readonly excludeFile: string;
  readonly unexcludeFile: string;
  readonly fileFeatures: readonly [string, string, string];
  readonly fileTypeExcluded: string;
  readonly editFileExclusions: string;
  readonly menuPlaceholder: string;
  readonly growTo: string;
  readonly shrinkTo: string;
  readonly resetDefault: string;
  readonly currentPercent: string;
  readonly latexFiles: string;
  readonly markdownFiles: string;
  readonly otherFilesHint: string;
  readonly previewDefinitionsHint: string;
  readonly thisFile: string;
  readonly snoozeSection: string;
  readonly resumeNow: string;
  readonly pausedUntilTime: string;
  readonly snoozeMinutes: string;
  readonly more: string;
  readonly ocrCapture: string;
  readonly ocrCaptureHint: string;
  readonly openSettingsProduct: string;
  readonly statusSnoozed: string;
  readonly statusExcluded: string;
  readonly statusClick: string;
  readonly captureTooltip: string;
  readonly captureName: string;
  readonly reloadWindow: string;
  readonly cannotWriteSetting: string;
  readonly ocr: OcrUiCopy;
}

export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (match, key: string) => {
    const value = vars[key];
    return value === undefined ? match : String(value);
  });
}

export function resolveUiLocale(language: string | undefined): UiLocaleId {
  const raw = (language ?? '').trim().toLowerCase().replace(/_/g, '-');
  if (!raw) return 'en';
  const primary = raw.split('-')[0] ?? 'en';
  if (primary === 'zh') {
    return /\b(hant|tw|hk|mo)\b/.test(raw) ? 'zh-hant' : 'zh-hans';
  }
  if (
    primary === 'ja'
    || primary === 'ko'
    || primary === 'de'
    || primary === 'fr'
    || primary === 'es'
    || primary === 'pt'
    || primary === 'ru'
    || primary === 'it'
  ) {
    return primary;
  }
  return 'en';
}

export function isChineseLocale(language: string | undefined): boolean {
  const locale = resolveUiLocale(language);
  return locale === 'zh-hans' || locale === 'zh-hant';
}

export function isCancelledMessage(message: string): boolean {
  return /取消|cancel/i.test(message);
}

export function uiCopy(language: string | undefined): UiCopy {
  return CATALOGS[resolveUiLocale(language)];
}

const EN_OCR: OcrUiCopy = {
  downloadPrompt:
    'First use downloads about {mb} of local models (formulas and text). Everything runs on this machine; screenshots are never uploaded. Download once, then work offline.',
  downloadAction: 'Download and enable',
  installing: '{product}: installing local OCR pack',
  installed: '{product} OCR pack installed and verified.',
  enableFirst: 'Enable {key} first.',
  copied: 'Result copied.',
  errorPrefix: 'OCR: {message}',
  insertFailed: 'Could not insert the result into the target document.',
  title: 'Screenshot OCR',
  auto: 'Smart',
  formula: 'Formula',
  text: 'Text',
  copy: 'Copy',
  insert: 'Insert at caret',
  loadFormulaModel: 'Loading formula model',
  parseFormula: 'Parsing formula',
  formulaIncomplete: 'The result may be incomplete. Tighten the selection or switch to Smart mode.',
  recognizingText: 'Recognizing text…',
};

const EN: UiCopy = {
  previewSize: 'Preview size',
  editPreviewCss: "Edit preview CSS…",
  configureCompletionShortcut: "Math completion shortcut…",
  configureShortcuts: "All keyboard shortcuts…",
  completionMode: "Math completion mode…",
  where: 'Enable in',
  otherFiles: 'Other file types',
  previewDefinitions: 'Preview definitions',
  tikzPreview: 'TikZ / pgfplots live preview',
  tikzPreviewHint: 'Off by default; first use downloads the local renderer once',
  excludeFile: "Exclude {feature} for this file",
  unexcludeFile: "Restore {feature} for this file",
  fileFeatures: ["preview", "completion", "preview and completion"],
  fileTypeExcluded: "Rule still excludes this file: {rule}",
  editFileExclusions: "Edit file exclusion rules…",
  menuPlaceholder: 'Pick an action',
  growTo: 'Enlarge to {percent}%',
  shrinkTo: 'Shrink to {percent}%',
  resetDefault: 'Reset to 100%',
  currentPercent: 'Now {percent}%',
  latexFiles: 'LaTeX / TeX files',
  markdownFiles: 'Markdown / MDX files',
  otherFilesHint: 'Recognize $...$, \\[...\\] with LaTeX syntax',
  previewDefinitionsHint: 'Also render formulas that only define commands',
  thisFile: 'This file',
  snoozeSection: 'Snooze',
  resumeNow: 'Resume now',
  pausedUntilTime: 'Paused until {time}',
  snoozeMinutes: 'Pause {minutes} minutes',
  more: 'More',
  ocrCapture: 'Capture math or text',
  ocrCaptureHint: 'Downloads local models on first use',
  openSettingsProduct: 'Open {product} settings',
  statusSnoozed: '{product} · paused until {time}',
  statusExcluded: "{product} · preview excluded for this file",
  statusClick: 'Click to open the {product} menu (checks update immediately)',
  captureTooltip: 'Capture math or text (runs locally, nothing is uploaded)',
  captureName: '{product} screenshot OCR',
  reloadWindow: 'Reload Window',
  cannotWriteSetting:
    '{product}: could not write {key}. Reload the window after an in-place upgrade so the new settings take effect.',
  ocr: EN_OCR,
};

const ZH_HANS: UiCopy = {
  previewSize: '预览大小',
  editPreviewCss: "编辑预览 CSS…",
  configureCompletionShortcut: "数学补全快捷键…",
  configureShortcuts: "修改各项快捷键…",
  completionMode: "数学补全模式…",
  where: '启用范围',
  otherFiles: '其他文件类型',
  previewDefinitions: '定义也预览',
  tikzPreview: 'TikZ / pgfplots 实时预览',
  tikzPreviewHint: '默认关闭；首次使用下载本地渲染组件，之后可离线使用',
  excludeFile: "排除当前文件的{feature}",
  unexcludeFile: "恢复当前文件的{feature}",
  fileFeatures: ["预览", "补全", "预览和补全"],
  fileTypeExcluded: "规则仍排除此文件：{rule}",
  editFileExclusions: "编辑文件排除规则…",
  menuPlaceholder: '选择要执行的操作',
  growTo: '放大到 {percent}%',
  shrinkTo: '缩小到 {percent}%',
  resetDefault: '恢复默认 100%',
  currentPercent: '当前 {percent}%',
  latexFiles: 'LaTeX / TeX 文件',
  markdownFiles: 'Markdown / MDX 文件',
  otherFilesHint: '按 LaTeX 语法识别 $...$、\\[...\\]',
  previewDefinitionsHint: '只有 \\def / \\newcommand 的公式也画出展开结果',
  thisFile: '当前文件',
  snoozeSection: '暂停',
  resumeNow: '立即恢复预览',
  pausedUntilTime: '当前暂停到 {time}',
  snoozeMinutes: '暂停 {minutes} 分钟',
  more: '更多',
  ocrCapture: '截图识别公式或文字',
  ocrCaptureHint: '首次使用按需下载本地模型',
  openSettingsProduct: '打开 {product} 设置',
  statusSnoozed: '{product} · 暂停到 {time}',
  statusExcluded: "{product} · 当前文件已排除预览",
  statusClick: '点击打开 {product} 菜单（勾选会立刻更新）',
  captureTooltip: '截图识别公式或文字（本地运行，不上传）',
  captureName: '{product} 截图识别',
  reloadWindow: '重载窗口',
  cannotWriteSetting:
    '{product}：无法写入设置 {key}。刚升级过插件时需要重载窗口让新设置生效。',
  ocr: {
    downloadPrompt:
      '截图识别首次使用需下载约 {mb} 本地模型（公式 + 中英文）。只在本机运行，截图不会上传；下载一次即可离线使用。',
    downloadAction: '下载并启用',
    installing: '{product}：安装本地截图识别组件',
    installed: '{product} 截图识别组件已安装并校验。',
    enableFirst: '请先启用 {key}。',
    copied: '识别结果已复制。',
    errorPrefix: '截图识别：{message}',
    insertFailed: '无法把识别结果插入目标文档。',
    title: '截图识别',
    auto: '智能',
    formula: '公式',
    text: '文字',
    copy: '复制',
    insert: '插入光标处',
    loadFormulaModel: '加载公式模型',
    parseFormula: '解析公式',
    formulaIncomplete: '结果可能不完整，请缩小选区或改用智能模式。',
    recognizingText: '正在识别文字…',
  },
};

const ZH_HANT: UiCopy = {
  previewSize: '預覽大小',
  editPreviewCss: "編輯預覽 CSS…",
  configureCompletionShortcut: "數學自動完成快速鍵…",
  configureShortcuts: "修改各項快速鍵…",
  completionMode: "數學自動完成模式…",
  where: '啟用範圍',
  otherFiles: '其他檔案類型',
  previewDefinitions: '定義也預覽',
  tikzPreview: 'TikZ / pgfplots 即時預覽',
  tikzPreviewHint: '預設關閉；首次使用下載本機渲染元件，之後可離線使用',
  excludeFile: "排除目前檔案的{feature}",
  unexcludeFile: "恢復目前檔案的{feature}",
  fileFeatures: ["預覽", "自動完成", "預覽和自動完成"],
  fileTypeExcluded: "規則仍排除此檔案：{rule}",
  editFileExclusions: "編輯檔案排除規則…",
  menuPlaceholder: '選擇要執行的動作',
  growTo: '放大到 {percent}%',
  shrinkTo: '縮小到 {percent}%',
  resetDefault: '恢復預設 100%',
  currentPercent: '目前 {percent}%',
  latexFiles: 'LaTeX / TeX 檔案',
  markdownFiles: 'Markdown / MDX 檔案',
  otherFilesHint: '依 LaTeX 語法辨識 $...$、\\[...\\]',
  previewDefinitionsHint: '只有 \\def / \\newcommand 的公式也畫出展開結果',
  thisFile: '目前檔案',
  snoozeSection: '暫停',
  resumeNow: '立即恢復預覽',
  pausedUntilTime: '目前暫停到 {time}',
  snoozeMinutes: '暫停 {minutes} 分鐘',
  more: '更多',
  ocrCapture: '截圖辨識公式或文字',
  ocrCaptureHint: '首次使用才下載本機模型',
  openSettingsProduct: '開啟 {product} 設定',
  statusSnoozed: '{product} · 暫停到 {time}',
  statusExcluded: "{product} · 目前檔案已排除預覽",
  statusClick: '點一下開啟 {product} 選單（勾選會立刻更新）',
  captureTooltip: '截圖辨識公式或文字（本機執行，不上傳）',
  captureName: '{product} 截圖辨識',
  reloadWindow: '重新載入視窗',
  cannotWriteSetting:
    '{product}：無法寫入設定 {key}。剛升級過擴充功能時需要重新載入視窗讓新設定生效。',
  ocr: {
    downloadPrompt:
      '截圖辨識首次使用需下載約 {mb} 本機模型（公式 + 中英文）。只在本機執行，截圖不會上傳；下載一次即可離線使用。',
    downloadAction: '下載並啟用',
    installing: '{product}：安裝本機截圖辨識元件',
    installed: '{product} 截圖辨識元件已安裝並驗證。',
    enableFirst: '請先啟用 {key}。',
    copied: '辨識結果已複製。',
    errorPrefix: '截圖辨識：{message}',
    insertFailed: '無法把辨識結果插入目標文件。',
    title: '截圖辨識',
    auto: '智慧',
    formula: '公式',
    text: '文字',
    copy: '複製',
    insert: '插入游標處',
    loadFormulaModel: '載入公式模型',
    parseFormula: '解析公式',
    formulaIncomplete: '結果可能不完整，請縮小選取範圍或改用智慧模式。',
    recognizingText: '正在辨識文字…',
  },
};

const JA: UiCopy = {
  previewSize: 'プレビューサイズ',
  editPreviewCss: "プレビュー CSS を編集…",
  configureCompletionShortcut: "数式補完のショートカット…",
  configureShortcuts: "すべてのキーボードショートカット…",
  completionMode: "数式補完モード…",
  where: '有効にする場所',
  otherFiles: 'その他のファイル',
  previewDefinitions: '定義もプレビュー',
  tikzPreview: 'TikZ / pgfplots ライブプレビュー',
  tikzPreviewHint: '初期設定はオフ。初回のみローカル描画エンジンをダウンロード',
  excludeFile: "このファイルの{feature}を除外",
  unexcludeFile: "このファイルの{feature}を復元",
  fileFeatures: ["プレビュー", "補完", "プレビューと補完"],
  fileTypeExcluded: "除外ルールが適用中：{rule}",
  editFileExclusions: "ファイルの除外ルールを編集…",
  menuPlaceholder: '操作を選んでください',
  growTo: '{percent}% に拡大',
  shrinkTo: '{percent}% に縮小',
  resetDefault: '100% に戻す',
  currentPercent: '現在 {percent}%',
  latexFiles: 'LaTeX / TeX ファイル',
  markdownFiles: 'Markdown / MDX ファイル',
  otherFilesHint: 'LaTeX 記法で $...$ や \\[...\\] を認識',
  previewDefinitionsHint: '\\def / \\newcommand だけの式も展開して描画',
  thisFile: 'このファイル',
  snoozeSection: '一時停止',
  resumeNow: 'すぐに再開',
  pausedUntilTime: '{time} まで停止中',
  snoozeMinutes: '{minutes} 分停止',
  more: 'その他',
  ocrCapture: '数式や文字をスクリーンショット認識',
  ocrCaptureHint: '初回のみローカルモデルをダウンロード',
  openSettingsProduct: '{product} の設定を開く',
  statusSnoozed: '{product} · {time} まで停止',
  statusExcluded: "{product} · このファイルのプレビューは除外中",
  statusClick: '{product} メニューを開く（チェックはすぐ反映）',
  captureTooltip: '数式や文字を認識（このマシンだけで実行、アップロードなし）',
  captureName: '{product} スクリーンショット OCR',
  reloadWindow: 'ウィンドウを再読み込み',
  cannotWriteSetting:
    '{product}: {key} を書き込めませんでした。その場アップグレード後はウィンドウを再読み込みしてください。',
  ocr: {
    downloadPrompt:
      '初回は約 {mb} のローカルモデル（数式と文字）をダウンロードします。このマシンだけで動き、スクリーンショットは送信しません。一度入れればオフラインで使えます。',
    downloadAction: 'ダウンロードして有効化',
    installing: '{product}: ローカル OCR をインストール中',
    installed: '{product} の OCR パックをインストールし、検証しました。',
    enableFirst: '先に {key} を有効にしてください。',
    copied: '結果をコピーしました。',
    errorPrefix: 'OCR: {message}',
    insertFailed: '結果を対象ドキュメントに挿入できませんでした。',
    title: 'スクリーンショット OCR',
    auto: 'スマート',
    formula: '数式',
    text: '文字',
    copy: 'コピー',
    insert: 'キャレット位置に挿入',
    loadFormulaModel: '数式モデルを読み込み中',
    parseFormula: '数式を解析中',
    formulaIncomplete: '結果が不完全な可能性があります。範囲を狭めるかスマートモードに切り替えてください。',
    recognizingText: '文字を認識中…',
  },
};

const KO: UiCopy = {
  previewSize: '미리보기 크기',
  editPreviewCss: "미리 보기 CSS 편집…",
  configureCompletionShortcut: "수식 자동 완성 단축키…",
  configureShortcuts: "모든 바로 가기 키…",
  completionMode: "수식 자동 완성 모드…",
  where: '사용할 위치',
  otherFiles: '다른 파일 형식',
  previewDefinitions: '정의도 미리보기',
  tikzPreview: 'TikZ / pgfplots 실시간 미리보기',
  tikzPreviewHint: '기본값은 꺼짐. 최초 사용 시 로컬 렌더러 다운로드',
  excludeFile: "현재 파일의 {feature} 제외",
  unexcludeFile: "현재 파일의 {feature} 복원",
  fileFeatures: ["미리보기", "자동 완성", "미리보기와 자동 완성"],
  fileTypeExcluded: "파일 제외 규칙 적용 중: {rule}",
  editFileExclusions: "파일 제외 규칙 편집…",
  menuPlaceholder: '실행할 작업을 고르세요',
  growTo: '{percent}%로 확대',
  shrinkTo: '{percent}%로 축소',
  resetDefault: '100%로 되돌리기',
  currentPercent: '현재 {percent}%',
  latexFiles: 'LaTeX / TeX 파일',
  markdownFiles: 'Markdown / MDX 파일',
  otherFilesHint: 'LaTeX 문법으로 $...$, \\[...\\] 인식',
  previewDefinitionsHint: '\\def / \\newcommand만 있는 식도 펼쳐 그립니다',
  thisFile: '이 파일',
  snoozeSection: '일시 중지',
  resumeNow: '지금 다시 시작',
  pausedUntilTime: '{time}까지 중지됨',
  snoozeMinutes: '{minutes}분 중지',
  more: '더 보기',
  ocrCapture: '수식이나 글자 스크린샷 인식',
  ocrCaptureHint: '처음 사용할 때만 로컬 모델을 받습니다',
  openSettingsProduct: '{product} 설정 열기',
  statusSnoozed: '{product} · {time}까지 중지',
  statusExcluded: "{product} · 현재 파일의 미리보기 제외됨",
  statusClick: '{product} 메뉴 열기(체크는 바로 반영)',
  captureTooltip: '수식이나 글자 인식(이 기기에서만 실행, 업로드 없음)',
  captureName: '{product} 스크린샷 OCR',
  reloadWindow: '창 다시 로드',
  cannotWriteSetting:
    '{product}: {key}을(를) 쓸 수 없습니다. 제자리 업그레이드 뒤에는 창을 다시 로드하세요.',
  ocr: {
    downloadPrompt:
      '처음 사용 시 약 {mb} 로컬 모델(수식 + 글자)을 받습니다. 이 기기에서만 실행되며 스크린샷은 올리지 않습니다. 한 번 받으면 오프라인으로 쓸 수 있습니다.',
    downloadAction: '받아 사용',
    installing: '{product}: 로컬 OCR 설치 중',
    installed: '{product} OCR 팩을 설치하고 확인했습니다.',
    enableFirst: '먼저 {key}을(를) 켜세요.',
    copied: '결과를 복사했습니다.',
    errorPrefix: 'OCR: {message}',
    insertFailed: '결과를 대상 문서에 넣을 수 없습니다.',
    title: '스크린샷 OCR',
    auto: '스마트',
    formula: '수식',
    text: '글자',
    copy: '복사',
    insert: '캐럿 위치에 넣기',
    loadFormulaModel: '수식 모델 불러오는 중',
    parseFormula: '수식 분석 중',
    formulaIncomplete: '결과가 불완전할 수 있습니다. 영역을 줄이거나 스마트 모드로 바꾸세요.',
    recognizingText: '글자 인식 중…',
  },
};

const DE: UiCopy = {
  previewSize: 'Vorschaugröße',
  editPreviewCss: "Vorschau-CSS bearbeiten…",
  configureCompletionShortcut: "Tastenkürzel für Mathe…",
  configureShortcuts: "Alle Tastenkombinationen…",
  completionMode: "Mathematik-Vervollständigung…",
  where: 'Aktivieren in',
  otherFiles: 'Andere Dateitypen',
  previewDefinitions: 'Definitionen auch',
  tikzPreview: 'TikZ / pgfplots Live-Vorschau',
  tikzPreviewHint: 'Standardmäßig aus; lädt den lokalen Renderer einmal herunter',
  excludeFile: "{feature} für diese Datei ausschließen",
  unexcludeFile: "{feature} für diese Datei wiederherstellen",
  fileFeatures: ["Vorschau", "Vervollständigung", "Vorschau und Vervollständigung"],
  fileTypeExcluded: "Weiterhin durch Regel ausgeschlossen: {rule}",
  editFileExclusions: "Dateiausschlüsse bearbeiten…",
  menuPlaceholder: 'Aktion wählen',
  growTo: 'Auf {percent} % vergrößern',
  shrinkTo: 'Auf {percent} % verkleinern',
  resetDefault: 'Auf 100 % zurücksetzen',
  currentPercent: 'Jetzt {percent} %',
  latexFiles: 'LaTeX- / TeX-Dateien',
  markdownFiles: 'Markdown- / MDX-Dateien',
  otherFilesHint: '$...$ und \\[...\\] mit LaTeX-Syntax erkennen',
  previewDefinitionsHint: 'Auch Formeln zeichnen, die nur Befehle definieren',
  thisFile: 'Diese Datei',
  snoozeSection: 'Pause',
  resumeNow: 'Jetzt fortsetzen',
  pausedUntilTime: 'Pausiert bis {time}',
  snoozeMinutes: '{minutes} Minuten pausieren',
  more: 'Mehr',
  ocrCapture: 'Mathe oder Text per Screenshot erkennen',
  ocrCaptureHint: 'Lädt lokale Modelle beim ersten Gebrauch',
  openSettingsProduct: '{product}-Einstellungen öffnen',
  statusSnoozed: '{product} · pausiert bis {time}',
  statusExcluded: "{product} · Vorschau für diese Datei ausgeschlossen",
  statusClick: '{product}-Menü öffnen (Häkchen aktualisieren sofort)',
  captureTooltip: 'Mathe oder Text erkennen (läuft lokal, nichts wird hochgeladen)',
  captureName: '{product}-Screenshot-OCR',
  reloadWindow: 'Fenster neu laden',
  cannotWriteSetting:
    '{product}: {key} konnte nicht geschrieben werden. Nach einem In-Place-Upgrade das Fenster neu laden.',
  ocr: {
    downloadPrompt:
      'Beim ersten Gebrauch werden etwa {mb} lokale Modelle (Formeln und Text) geladen. Alles läuft auf diesem Rechner; Screenshots werden nicht hochgeladen. Einmal laden, danach offline.',
    downloadAction: 'Herunterladen und aktivieren',
    installing: '{product}: lokales OCR-Paket wird installiert',
    installed: '{product}-OCR-Paket installiert und geprüft.',
    enableFirst: 'Aktivieren Sie zuerst {key}.',
    copied: 'Ergebnis kopiert.',
    errorPrefix: 'OCR: {message}',
    insertFailed: 'Das Ergebnis konnte nicht in das Zieldokument eingefügt werden.',
    title: 'Screenshot-OCR',
    auto: 'Intelligent',
    formula: 'Formel',
    text: 'Text',
    copy: 'Kopieren',
    insert: 'An der Einfügemarke einfügen',
    loadFormulaModel: 'Formelmodell wird geladen',
    parseFormula: 'Formel wird analysiert',
    formulaIncomplete: 'Das Ergebnis kann unvollständig sein. Auswahl verkleinern oder auf Intelligent wechseln.',
    recognizingText: 'Text wird erkannt…',
  },
};

const FR: UiCopy = {
  previewSize: 'Taille de l’aperçu',
  editPreviewCss: "Modifier le CSS de l’aperçu…",
  configureCompletionShortcut: "Raccourci de complétion mathématique…",
  configureShortcuts: "Tous les raccourcis clavier…",
  completionMode: "Mode de complétion mathématique…",
  where: 'Activer dans',
  otherFiles: 'Autres types de fichiers',
  previewDefinitions: 'Aperçu des définitions',
  tikzPreview: 'Aperçu TikZ / pgfplots en direct',
  tikzPreviewHint: 'Désactivé par défaut ; moteur local téléchargé une seule fois',
  excludeFile: "Exclure {feature} pour ce fichier",
  unexcludeFile: "Rétablir {feature} pour ce fichier",
  fileFeatures: ["l’aperçu", "la complétion", "l’aperçu et la complétion"],
  fileTypeExcluded: "Fichier toujours exclu par la règle : {rule}",
  editFileExclusions: "Modifier les règles d’exclusion…",
  menuPlaceholder: 'Choisir une action',
  growTo: 'Agrandir à {percent} %',
  shrinkTo: 'Réduire à {percent} %',
  resetDefault: 'Revenir à 100 %',
  currentPercent: 'Actuellement {percent} %',
  latexFiles: 'Fichiers LaTeX / TeX',
  markdownFiles: 'Fichiers Markdown / MDX',
  otherFilesHint: 'Reconnaître $...$, \\[...\\] avec la syntaxe LaTeX',
  previewDefinitionsHint: 'Afficher aussi les formules qui ne font que définir des commandes',
  thisFile: 'Ce fichier',
  snoozeSection: 'Pause',
  resumeNow: 'Reprendre maintenant',
  pausedUntilTime: 'En pause jusqu’à {time}',
  snoozeMinutes: 'Pause de {minutes} minutes',
  more: 'Plus',
  ocrCapture: 'Reconnaître maths ou texte par capture',
  ocrCaptureHint: 'Télécharge les modèles locaux à la première utilisation',
  openSettingsProduct: 'Ouvrir les paramètres {product}',
  statusSnoozed: '{product} · en pause jusqu’à {time}',
  statusExcluded: "{product} · aperçu exclu pour ce fichier",
  statusClick: 'Ouvrir le menu {product} (les cases se mettent à jour tout de suite)',
  captureTooltip: 'Reconnaître maths ou texte (en local, rien n’est envoyé)',
  captureName: 'OCR par capture {product}',
  reloadWindow: 'Recharger la fenêtre',
  cannotWriteSetting:
    '{product} : impossible d’écrire {key}. Rechargez la fenêtre après une mise à jour sur place.',
  ocr: {
    downloadPrompt:
      'La première utilisation télécharge environ {mb} de modèles locaux (formules et texte). Tout s’exécute sur cette machine ; les captures ne sont jamais envoyées. Un téléchargement suffit ensuite hors ligne.',
    downloadAction: 'Télécharger et activer',
    installing: '{product} : installation du pack OCR local',
    installed: 'Pack OCR {product} installé et vérifié.',
    enableFirst: 'Activez d’abord {key}.',
    copied: 'Résultat copié.',
    errorPrefix: 'OCR : {message}',
    insertFailed: 'Impossible d’insérer le résultat dans le document cible.',
    title: 'OCR par capture',
    auto: 'Intelligent',
    formula: 'Formule',
    text: 'Texte',
    copy: 'Copier',
    insert: 'Insérer au curseur',
    loadFormulaModel: 'Chargement du modèle de formules',
    parseFormula: 'Analyse de la formule',
    formulaIncomplete: 'Le résultat peut être incomplet. Resserez la sélection ou passez en mode intelligent.',
    recognizingText: 'Reconnaissance du texte…',
  },
};

const ES: UiCopy = {
  previewSize: 'Tamaño de la vista previa',
  editPreviewCss: "Editar CSS de la vista previa…",
  configureCompletionShortcut: "Atajo de completado matemático…",
  configureShortcuts: "Todos los atajos de teclado…",
  completionMode: "Modo de completado matemático…",
  where: 'Activar en',
  otherFiles: 'Otros tipos de archivo',
  previewDefinitions: 'Vista previa de definiciones',
  tikzPreview: 'Vista previa de TikZ / pgfplots',
  tikzPreviewHint: 'Desactivada por defecto; descarga única del motor local',
  excludeFile: "Excluir {feature} en este archivo",
  unexcludeFile: "Restaurar {feature} en este archivo",
  fileFeatures: ["la vista previa", "el autocompletado", "ambos"],
  fileTypeExcluded: "La regla sigue excluyendo el archivo: {rule}",
  editFileExclusions: "Editar reglas de exclusión…",
  menuPlaceholder: 'Elige una acción',
  growTo: 'Aumentar a {percent} %',
  shrinkTo: 'Reducir a {percent} %',
  resetDefault: 'Volver a 100 %',
  currentPercent: 'Ahora {percent} %',
  latexFiles: 'Archivos LaTeX / TeX',
  markdownFiles: 'Archivos Markdown / MDX',
  otherFilesHint: 'Reconocer $...$, \\[...\\] con sintaxis LaTeX',
  previewDefinitionsHint: 'También dibujar fórmulas que solo definen comandos',
  thisFile: 'Este archivo',
  snoozeSection: 'Pausa',
  resumeNow: 'Reanudar ahora',
  pausedUntilTime: 'En pausa hasta {time}',
  snoozeMinutes: 'Pausa de {minutes} minutos',
  more: 'Más',
  ocrCapture: 'Reconocer mates o texto por captura',
  ocrCaptureHint: 'Descarga modelos locales en el primer uso',
  openSettingsProduct: 'Abrir configuración de {product}',
  statusSnoozed: '{product} · en pausa hasta {time}',
  statusExcluded: "{product} · vista previa excluida en este archivo",
  statusClick: 'Abrir el menú de {product} (las marcas se actualizan al instante)',
  captureTooltip: 'Reconocer mates o texto (se ejecuta en local, no se sube nada)',
  captureName: 'OCR por captura de {product}',
  reloadWindow: 'Recargar ventana',
  cannotWriteSetting:
    '{product}: no se pudo escribir {key}. Recarga la ventana tras una actualización in situ.',
  ocr: {
    downloadPrompt:
      'El primer uso descarga unos {mb} de modelos locales (fórmulas y texto). Todo corre en este equipo; las capturas no se suben. Descarga una vez y luego trabaja sin red.',
    downloadAction: 'Descargar y activar',
    installing: '{product}: instalando el paquete OCR local',
    installed: 'Paquete OCR de {product} instalado y comprobado.',
    enableFirst: 'Activa {key} primero.',
    copied: 'Resultado copiado.',
    errorPrefix: 'OCR: {message}',
    insertFailed: 'No se pudo insertar el resultado en el documento de destino.',
    title: 'OCR por captura',
    auto: 'Inteligente',
    formula: 'Fórmula',
    text: 'Texto',
    copy: 'Copiar',
    insert: 'Insertar en el cursor',
    loadFormulaModel: 'Cargando modelo de fórmulas',
    parseFormula: 'Analizando la fórmula',
    formulaIncomplete: 'El resultado puede estar incompleto. Ajusta la selección o usa el modo inteligente.',
    recognizingText: 'Reconociendo texto…',
  },
};

const PT: UiCopy = {
  previewSize: 'Tamanho da pré-visualização',
  editPreviewCss: "Editar CSS da prévia…",
  configureCompletionShortcut: "Atalho de preenchimento matemático…",
  configureShortcuts: "Todos os atalhos de teclado…",
  completionMode: "Modo de preenchimento matemático…",
  where: 'Ativar em',
  otherFiles: 'Outros tipos de arquivo',
  previewDefinitions: 'Pré-visualizar definições',
  tikzPreview: 'Prévia ao vivo de TikZ / pgfplots',
  tikzPreviewHint: 'Desativada por padrão; baixa o renderizador local uma vez',
  excludeFile: "Excluir {feature} neste arquivo",
  unexcludeFile: "Restaurar {feature} neste arquivo",
  fileFeatures: ["a prévia", "o preenchimento automático", "ambos"],
  fileTypeExcluded: "O arquivo continua excluído pela regra: {rule}",
  editFileExclusions: "Editar regras de exclusão…",
  menuPlaceholder: 'Escolha uma ação',
  growTo: 'Aumentar para {percent}%',
  shrinkTo: 'Reduzir para {percent}%',
  resetDefault: 'Voltar a 100%',
  currentPercent: 'Agora {percent}%',
  latexFiles: 'Arquivos LaTeX / TeX',
  markdownFiles: 'Arquivos Markdown / MDX',
  otherFilesHint: 'Reconhecer $...$, \\[...\\] com sintaxe LaTeX',
  previewDefinitionsHint: 'Também desenhar fórmulas que só definem comandos',
  thisFile: 'Este arquivo',
  snoozeSection: 'Pausa',
  resumeNow: 'Retomar agora',
  pausedUntilTime: 'Pausado até {time}',
  snoozeMinutes: 'Pausar {minutes} minutos',
  more: 'Mais',
  ocrCapture: 'Reconhecer matemática ou texto por captura',
  ocrCaptureHint: 'Baixa modelos locais no primeiro uso',
  openSettingsProduct: 'Abrir configurações do {product}',
  statusSnoozed: '{product} · pausado até {time}',
  statusExcluded: "{product} · prévia excluída neste arquivo",
  statusClick: 'Abrir o menu do {product} (as marcas atualizam na hora)',
  captureTooltip: 'Reconhecer matemática ou texto (roda localmente, nada é enviado)',
  captureName: 'OCR por captura do {product}',
  reloadWindow: 'Recarregar janela',
  cannotWriteSetting:
    '{product}: não foi possível gravar {key}. Recarregue a janela após uma atualização no lugar.',
  ocr: {
    downloadPrompt:
      'O primeiro uso baixa cerca de {mb} de modelos locais (fórmulas e texto). Tudo roda neste computador; as capturas nunca são enviadas. Baixe uma vez e use offline.',
    downloadAction: 'Baixar e ativar',
    installing: '{product}: instalando o pacote OCR local',
    installed: 'Pacote OCR do {product} instalado e verificado.',
    enableFirst: 'Ative {key} primeiro.',
    copied: 'Resultado copiado.',
    errorPrefix: 'OCR: {message}',
    insertFailed: 'Não foi possível inserir o resultado no documento de destino.',
    title: 'OCR por captura',
    auto: 'Inteligente',
    formula: 'Fórmula',
    text: 'Texto',
    copy: 'Copiar',
    insert: 'Inserir no cursor',
    loadFormulaModel: 'Carregando modelo de fórmulas',
    parseFormula: 'Analisando a fórmula',
    formulaIncomplete: 'O resultado pode estar incompleto. Aperte a seleção ou use o modo inteligente.',
    recognizingText: 'Reconhecendo texto…',
  },
};

const RU: UiCopy = {
  previewSize: 'Размер предпросмотра',
  editPreviewCss: "Изменить CSS предпросмотра…",
  configureCompletionShortcut: "Клавиши автодополнения формул…",
  configureShortcuts: "Все сочетания клавиш…",
  completionMode: "Режим автодополнения формул…",
  where: 'Включать в',
  otherFiles: 'Другие типы файлов',
  previewDefinitions: 'Показывать определения',
  tikzPreview: 'Предпросмотр TikZ / pgfplots',
  tikzPreviewHint: 'По умолчанию выключен; движок загружается один раз',
  excludeFile: "Отключить {feature} в этом файле",
  unexcludeFile: "Восстановить {feature} в этом файле",
  fileFeatures: ["предпросмотр", "автодополнение", "предпросмотр и автодополнение"],
  fileTypeExcluded: "Файл всё ещё исключён правилом: {rule}",
  editFileExclusions: "Изменить правила исключения…",
  menuPlaceholder: 'Выберите действие',
  growTo: 'Увеличить до {percent}%',
  shrinkTo: 'Уменьшить до {percent}%',
  resetDefault: 'Вернуть 100%',
  currentPercent: 'Сейчас {percent}%',
  latexFiles: 'Файлы LaTeX / TeX',
  markdownFiles: 'Файлы Markdown / MDX',
  otherFilesHint: 'Распознавать $...$, \\[...\\] синтаксисом LaTeX',
  previewDefinitionsHint: 'Также рисовать формулы, которые только задают команды',
  thisFile: 'Этот файл',
  snoozeSection: 'Пауза',
  resumeNow: 'Возобновить сейчас',
  pausedUntilTime: 'Пауза до {time}',
  snoozeMinutes: 'Пауза на {minutes} мин',
  more: 'Ещё',
  ocrCapture: 'Распознать формулу или текст по снимку',
  ocrCaptureHint: 'Локальные модели скачиваются при первом использовании',
  openSettingsProduct: 'Открыть настройки {product}',
  statusSnoozed: '{product} · пауза до {time}',
  statusExcluded: "{product} · предпросмотр отключён в этом файле",
  statusClick: 'Открыть меню {product} (галочки меняются сразу)',
  captureTooltip: 'Распознать формулу или текст (только на этом компьютере, ничего не отправляется)',
  captureName: 'OCR по снимку {product}',
  reloadWindow: 'Перезагрузить окно',
  cannotWriteSetting:
    '{product}: не удалось записать {key}. После обновления на месте перезагрузите окно.',
  ocr: {
    downloadPrompt:
      'При первом использовании скачивается около {mb} локальных моделей (формулы и текст). Всё работает на этом компьютере; снимки не отправляются. Скачайте один раз — дальше можно офлайн.',
    downloadAction: 'Скачать и включить',
    installing: '{product}: установка локального OCR',
    installed: 'Пакет OCR {product} установлен и проверен.',
    enableFirst: 'Сначала включите {key}.',
    copied: 'Результат скопирован.',
    errorPrefix: 'OCR: {message}',
    insertFailed: 'Не удалось вставить результат в целевой документ.',
    title: 'OCR по снимку',
    auto: 'Умный',
    formula: 'Формула',
    text: 'Текст',
    copy: 'Копировать',
    insert: 'Вставить у курсора',
    loadFormulaModel: 'Загрузка модели формул',
    parseFormula: 'Разбор формулы',
    formulaIncomplete: 'Результат может быть неполным. Сузьте выделение или включите умный режим.',
    recognizingText: 'Распознавание текста…',
  },
};

const IT: UiCopy = {
  previewSize: 'Dimensione anteprima',
  editPreviewCss: "Modifica CSS anteprima…",
  configureCompletionShortcut: "Scorciatoia del completamento matematico…",
  configureShortcuts: "Tutte le scorciatoie da tastiera…",
  completionMode: "Modalità di completamento matematico…",
  where: 'Attiva in',
  otherFiles: 'Altri tipi di file',
  previewDefinitions: 'Anteprima definizioni',
  tikzPreview: 'Anteprima TikZ / pgfplots',
  tikzPreviewHint: 'Disattivata per default; scarica il motore locale una volta',
  excludeFile: "Escludi {feature} per questo file",
  unexcludeFile: "Ripristina {feature} per questo file",
  fileFeatures: ["l’anteprima", "il completamento", "entrambi"],
  fileTypeExcluded: "File ancora escluso dalla regola: {rule}",
  editFileExclusions: "Modifica regole di esclusione…",
  menuPlaceholder: 'Scegli un’azione',
  growTo: 'Ingrandisci al {percent}%',
  shrinkTo: 'Riduci al {percent}%',
  resetDefault: 'Torna al 100%',
  currentPercent: 'Ora {percent}%',
  latexFiles: 'File LaTeX / TeX',
  markdownFiles: 'File Markdown / MDX',
  otherFilesHint: 'Riconosci $...$, \\[...\\] con sintassi LaTeX',
  previewDefinitionsHint: 'Disegna anche le formule che definiscono solo comandi',
  thisFile: 'Questo file',
  snoozeSection: 'Pausa',
  resumeNow: 'Riprendi ora',
  pausedUntilTime: 'In pausa fino a {time}',
  snoozeMinutes: 'Pausa di {minutes} minuti',
  more: 'Altro',
  ocrCapture: 'Riconosci formule o testo da cattura',
  ocrCaptureHint: 'Scarica i modelli locali al primo utilizzo',
  openSettingsProduct: 'Apri le impostazioni di {product}',
  statusSnoozed: '{product} · in pausa fino a {time}',
  statusExcluded: "{product} · anteprima esclusa per questo file",
  statusClick: 'Apri il menu {product} (le spunte si aggiornano subito)',
  captureTooltip: 'Riconosci formule o testo (solo su questo computer, niente viene caricato)',
  captureName: 'OCR da cattura {product}',
  reloadWindow: 'Ricarica finestra',
  cannotWriteSetting:
    '{product}: impossibile scrivere {key}. Ricarica la finestra dopo un aggiornamento sul posto.',
  ocr: {
    downloadPrompt:
      'Al primo utilizzo scarica circa {mb} di modelli locali (formule e testo). Tutto resta su questo computer; le catture non vengono inviate. Scarica una volta, poi lavora offline.',
    downloadAction: 'Scarica e attiva',
    installing: '{product}: installazione del pacchetto OCR locale',
    installed: 'Pacchetto OCR di {product} installato e verificato.',
    enableFirst: 'Attiva prima {key}.',
    copied: 'Risultato copiato.',
    errorPrefix: 'OCR: {message}',
    insertFailed: 'Impossibile inserire il risultato nel documento di destinazione.',
    title: 'OCR da cattura',
    auto: 'Smart',
    formula: 'Formula',
    text: 'Testo',
    copy: 'Copia',
    insert: 'Inserisci al cursore',
    loadFormulaModel: 'Caricamento modello formule',
    parseFormula: 'Analisi della formula',
    formulaIncomplete: 'Il risultato potrebbe essere incompleto. Restringi la selezione o passa alla modalità smart.',
    recognizingText: 'Riconoscimento del testo…',
  },
};

const CATALOGS: Record<UiLocaleId, UiCopy> = {
  en: EN,
  'zh-hans': ZH_HANS,
  'zh-hant': ZH_HANT,
  ja: JA,
  ko: KO,
  de: DE,
  fr: FR,
  es: ES,
  pt: PT,
  ru: RU,
  it: IT,
};
