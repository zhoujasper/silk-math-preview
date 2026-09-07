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
  readonly installFailed: string;
  readonly enableFirst: string;
  readonly copied: string;
  readonly errorPrefix: string;
  readonly noEditor: string;
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
  readonly textDone: string;
}

export interface UiCopy {
  readonly htmlLang: string;
  readonly previewSize: string;
  readonly reset: string;
  readonly shrink: string;
  readonly grow: string;
  readonly where: string;
  readonly latex: string;
  readonly markdown: string;
  readonly otherFiles: string;
  readonly previewDefinitions: string;
  readonly tikzPreview: string;
  readonly tikzPreviewHint: string;
  readonly snooze: string;
  readonly snooze5: string;
  readonly snooze30: string;
  readonly resume: string;
  readonly pausedUntil: string;
  readonly excludeFile: string;
  readonly unexcludeFile: string;
  readonly openSettings: string;
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
  installFailed: 'OCR pack install failed: {message}',
  enableFirst: 'Enable {key} first.',
  copied: 'Result copied.',
  errorPrefix: 'OCR: {message}',
  noEditor: 'No active editor to insert into; use Copy.',
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
  textDone: 'Text recognized, average confidence {percent}%.',
};

const EN: UiCopy = {
  htmlLang: 'en',
  previewSize: 'Preview size',
  reset: 'Reset',
  shrink: 'Shrink 5%',
  grow: 'Grow 5%',
  where: 'Enable in',
  latex: 'LaTeX / TeX',
  markdown: 'Markdown / MDX',
  otherFiles: 'Other file types',
  previewDefinitions: 'Preview definitions',
  tikzPreview: 'TikZ / pgfplots live preview',
  tikzPreviewHint: 'Off by default; first use downloads the local renderer once',
  snooze: 'Snooze',
  snooze5: 'Pause 5 minutes',
  snooze30: 'Pause 30 minutes',
  resume: 'Resume',
  pausedUntil: 'Paused until',
  excludeFile: 'Exclude this file',
  unexcludeFile: 'Undo exclude',
  openSettings: 'Open settings',
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
  statusExcluded: '{product} · this file is excluded',
  statusClick: 'Click to open the {product} menu (checks update immediately)',
  captureTooltip: 'Capture math or text (runs locally, nothing is uploaded)',
  captureName: '{product} screenshot OCR',
  reloadWindow: 'Reload Window',
  cannotWriteSetting:
    '{product}: could not write {key}. Reload the window after an in-place upgrade so the new settings take effect.',
  ocr: EN_OCR,
};

const ZH_HANS: UiCopy = {
  htmlLang: 'zh-CN',
  previewSize: '预览大小',
  reset: '重置',
  shrink: '缩小 5%',
  grow: '放大 5%',
  where: '启用范围',
  latex: 'LaTeX / TeX',
  markdown: 'Markdown / MDX',
  otherFiles: '其他文件类型',
  previewDefinitions: '定义也预览',
  tikzPreview: 'TikZ / pgfplots 实时预览',
  tikzPreviewHint: '默认关闭；首次使用下载本地渲染组件，之后可离线使用',
  snooze: '推迟',
  snooze5: '暂停 5 分钟',
  snooze30: '暂停 30 分钟',
  resume: '恢复',
  pausedUntil: '暂停到',
  excludeFile: '排除当前文件',
  unexcludeFile: '取消排除当前文件',
  openSettings: '打开设置',
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
  statusExcluded: '{product} · 已排除当前文件',
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
    installFailed: '截图识别组件安装失败：{message}',
    enableFirst: '请先启用 {key}。',
    copied: '识别结果已复制。',
    errorPrefix: '截图识别：{message}',
    noEditor: '没有可插入的活动编辑器；请使用“复制”。',
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
    textDone: '文字识别完成，平均置信度 {percent}%。',
  },
};

const ZH_HANT: UiCopy = {
  htmlLang: 'zh-TW',
  previewSize: '預覽大小',
  reset: '重設',
  shrink: '縮小 5%',
  grow: '放大 5%',
  where: '啟用範圍',
  latex: 'LaTeX / TeX',
  markdown: 'Markdown / MDX',
  otherFiles: '其他檔案類型',
  previewDefinitions: '定義也預覽',
  tikzPreview: 'TikZ / pgfplots 即時預覽',
  tikzPreviewHint: '預設關閉；首次使用下載本機渲染元件，之後可離線使用',
  snooze: '延後',
  snooze5: '暫停 5 分鐘',
  snooze30: '暫停 30 分鐘',
  resume: '恢復',
  pausedUntil: '暫停到',
  excludeFile: '排除目前檔案',
  unexcludeFile: '取消排除目前檔案',
  openSettings: '開啟設定',
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
  statusExcluded: '{product} · 已排除目前檔案',
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
    installFailed: '截圖辨識元件安裝失敗：{message}',
    enableFirst: '請先啟用 {key}。',
    copied: '辨識結果已複製。',
    errorPrefix: '截圖辨識：{message}',
    noEditor: '沒有可插入的作用中編輯器；請使用「複製」。',
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
    textDone: '文字辨識完成，平均信心 {percent}%。',
  },
};

const JA: UiCopy = {
  htmlLang: 'ja',
  previewSize: 'プレビューサイズ',
  reset: 'リセット',
  shrink: '5% 縮小',
  grow: '5% 拡大',
  where: '有効にする場所',
  latex: 'LaTeX / TeX',
  markdown: 'Markdown / MDX',
  otherFiles: 'その他のファイル',
  previewDefinitions: '定義もプレビュー',
  tikzPreview: 'TikZ / pgfplots ライブプレビュー',
  tikzPreviewHint: '初期設定はオフ。初回のみローカル描画エンジンをダウンロード',
  snooze: '一時停止',
  snooze5: '5 分停止',
  snooze30: '30 分停止',
  resume: '再開',
  pausedUntil: '停止中',
  excludeFile: 'このファイルを除外',
  unexcludeFile: '除外を解除',
  openSettings: '設定を開く',
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
  statusExcluded: '{product} · このファイルは除外中',
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
    installFailed: 'OCR パックのインストールに失敗しました: {message}',
    enableFirst: '先に {key} を有効にしてください。',
    copied: '結果をコピーしました。',
    errorPrefix: 'OCR: {message}',
    noEditor: '挿入できるエディターがありません。「コピー」を使ってください。',
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
    textDone: '文字認識が完了しました。平均信頼度 {percent}%。',
  },
};

const KO: UiCopy = {
  htmlLang: 'ko',
  previewSize: '미리보기 크기',
  reset: '재설정',
  shrink: '5% 축소',
  grow: '5% 확대',
  where: '사용할 위치',
  latex: 'LaTeX / TeX',
  markdown: 'Markdown / MDX',
  otherFiles: '다른 파일 형식',
  previewDefinitions: '정의도 미리보기',
  tikzPreview: 'TikZ / pgfplots 실시간 미리보기',
  tikzPreviewHint: '기본값은 꺼짐. 최초 사용 시 로컬 렌더러 다운로드',
  snooze: '일시 중지',
  snooze5: '5분 중지',
  snooze30: '30분 중지',
  resume: '다시 시작',
  pausedUntil: '중지 시각',
  excludeFile: '이 파일 제외',
  unexcludeFile: '제외 취소',
  openSettings: '설정 열기',
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
  statusExcluded: '{product} · 이 파일은 제외됨',
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
    installFailed: 'OCR 팩 설치 실패: {message}',
    enableFirst: '먼저 {key}을(를) 켜세요.',
    copied: '결과를 복사했습니다.',
    errorPrefix: 'OCR: {message}',
    noEditor: '넣을 활성 편집기가 없습니다. 복사를 사용하세요.',
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
    textDone: '글자 인식 완료, 평균 신뢰도 {percent}%.',
  },
};

const DE: UiCopy = {
  htmlLang: 'de',
  previewSize: 'Vorschaugröße',
  reset: 'Zurücksetzen',
  shrink: '5 % verkleinern',
  grow: '5 % vergrößern',
  where: 'Aktivieren in',
  latex: 'LaTeX / TeX',
  markdown: 'Markdown / MDX',
  otherFiles: 'Andere Dateitypen',
  previewDefinitions: 'Definitionen auch',
  tikzPreview: 'TikZ / pgfplots Live-Vorschau',
  tikzPreviewHint: 'Standardmäßig aus; lädt den lokalen Renderer einmal herunter',
  snooze: 'Pausieren',
  snooze5: '5 Minuten pausieren',
  snooze30: '30 Minuten pausieren',
  resume: 'Fortsetzen',
  pausedUntil: 'Pausiert bis',
  excludeFile: 'Diese Datei ausschließen',
  unexcludeFile: 'Ausschluss aufheben',
  openSettings: 'Einstellungen öffnen',
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
  statusExcluded: '{product} · diese Datei ist ausgeschlossen',
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
    installFailed: 'OCR-Paketinstallation fehlgeschlagen: {message}',
    enableFirst: 'Aktivieren Sie zuerst {key}.',
    copied: 'Ergebnis kopiert.',
    errorPrefix: 'OCR: {message}',
    noEditor: 'Kein aktiver Editor zum Einfügen; nutzen Sie Kopieren.',
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
    textDone: 'Texterkennung fertig, mittlere Sicherheit {percent} %.',
  },
};

const FR: UiCopy = {
  htmlLang: 'fr',
  previewSize: 'Taille de l’aperçu',
  reset: 'Réinitialiser',
  shrink: 'Réduire de 5 %',
  grow: 'Agrandir de 5 %',
  where: 'Activer dans',
  latex: 'LaTeX / TeX',
  markdown: 'Markdown / MDX',
  otherFiles: 'Autres types de fichiers',
  previewDefinitions: 'Aperçu des définitions',
  tikzPreview: 'Aperçu TikZ / pgfplots en direct',
  tikzPreviewHint: 'Désactivé par défaut ; moteur local téléchargé une seule fois',
  snooze: 'Reporter',
  snooze5: 'Pause 5 minutes',
  snooze30: 'Pause 30 minutes',
  resume: 'Reprendre',
  pausedUntil: 'En pause jusqu’à',
  excludeFile: 'Exclure ce fichier',
  unexcludeFile: 'Annuler l’exclusion',
  openSettings: 'Ouvrir les paramètres',
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
  statusExcluded: '{product} · ce fichier est exclu',
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
    installFailed: 'Échec de l’installation du pack OCR : {message}',
    enableFirst: 'Activez d’abord {key}.',
    copied: 'Résultat copié.',
    errorPrefix: 'OCR : {message}',
    noEditor: 'Aucun éditeur actif pour l’insertion ; utilisez Copier.',
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
    textDone: 'Texte reconnu, confiance moyenne {percent} %.',
  },
};

const ES: UiCopy = {
  htmlLang: 'es',
  previewSize: 'Tamaño de la vista previa',
  reset: 'Restablecer',
  shrink: 'Reducir 5 %',
  grow: 'Aumentar 5 %',
  where: 'Activar en',
  latex: 'LaTeX / TeX',
  markdown: 'Markdown / MDX',
  otherFiles: 'Otros tipos de archivo',
  previewDefinitions: 'Vista previa de definiciones',
  tikzPreview: 'Vista previa de TikZ / pgfplots',
  tikzPreviewHint: 'Desactivada por defecto; descarga única del motor local',
  snooze: 'Posponer',
  snooze5: 'Pausa 5 minutos',
  snooze30: 'Pausa 30 minutos',
  resume: 'Reanudar',
  pausedUntil: 'En pausa hasta',
  excludeFile: 'Excluir este archivo',
  unexcludeFile: 'Deshacer exclusión',
  openSettings: 'Abrir configuración',
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
  statusExcluded: '{product} · este archivo está excluido',
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
    installFailed: 'Falló la instalación del paquete OCR: {message}',
    enableFirst: 'Activa {key} primero.',
    copied: 'Resultado copiado.',
    errorPrefix: 'OCR: {message}',
    noEditor: 'No hay un editor activo para insertar; usa Copiar.',
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
    textDone: 'Texto reconocido, confianza media {percent} %.',
  },
};

const PT: UiCopy = {
  htmlLang: 'pt-BR',
  previewSize: 'Tamanho da pré-visualização',
  reset: 'Redefinir',
  shrink: 'Reduzir 5%',
  grow: 'Aumentar 5%',
  where: 'Ativar em',
  latex: 'LaTeX / TeX',
  markdown: 'Markdown / MDX',
  otherFiles: 'Outros tipos de arquivo',
  previewDefinitions: 'Pré-visualizar definições',
  tikzPreview: 'Prévia ao vivo de TikZ / pgfplots',
  tikzPreviewHint: 'Desativada por padrão; baixa o renderizador local uma vez',
  snooze: 'Adiar',
  snooze5: 'Pausar 5 minutos',
  snooze30: 'Pausar 30 minutos',
  resume: 'Retomar',
  pausedUntil: 'Pausado até',
  excludeFile: 'Excluir este arquivo',
  unexcludeFile: 'Desfazer exclusão',
  openSettings: 'Abrir configurações',
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
  statusExcluded: '{product} · este arquivo está excluído',
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
    installFailed: 'Falha ao instalar o pacote OCR: {message}',
    enableFirst: 'Ative {key} primeiro.',
    copied: 'Resultado copiado.',
    errorPrefix: 'OCR: {message}',
    noEditor: 'Não há editor ativo para inserir; use Copiar.',
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
    textDone: 'Texto reconhecido, confiança média {percent}%.',
  },
};

const RU: UiCopy = {
  htmlLang: 'ru',
  previewSize: 'Размер предпросмотра',
  reset: 'Сбросить',
  shrink: 'Уменьшить на 5%',
  grow: 'Увеличить на 5%',
  where: 'Включать в',
  latex: 'LaTeX / TeX',
  markdown: 'Markdown / MDX',
  otherFiles: 'Другие типы файлов',
  previewDefinitions: 'Показывать определения',
  tikzPreview: 'Предпросмотр TikZ / pgfplots',
  tikzPreviewHint: 'По умолчанию выключен; движок загружается один раз',
  snooze: 'Отложить',
  snooze5: 'Пауза на 5 минут',
  snooze30: 'Пауза на 30 минут',
  resume: 'Возобновить',
  pausedUntil: 'Пауза до',
  excludeFile: 'Исключить этот файл',
  unexcludeFile: 'Вернуть файл',
  openSettings: 'Открыть настройки',
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
  statusExcluded: '{product} · этот файл исключён',
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
    installFailed: 'Не удалось установить пакет OCR: {message}',
    enableFirst: 'Сначала включите {key}.',
    copied: 'Результат скопирован.',
    errorPrefix: 'OCR: {message}',
    noEditor: 'Нет активного редактора для вставки; используйте «Копировать».',
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
    textDone: 'Текст распознан, средняя уверенность {percent}%.',
  },
};

const IT: UiCopy = {
  htmlLang: 'it',
  previewSize: 'Dimensione anteprima',
  reset: 'Reimposta',
  shrink: 'Riduci del 5%',
  grow: 'Ingrandisci del 5%',
  where: 'Attiva in',
  latex: 'LaTeX / TeX',
  markdown: 'Markdown / MDX',
  otherFiles: 'Altri tipi di file',
  previewDefinitions: 'Anteprima definizioni',
  tikzPreview: 'Anteprima TikZ / pgfplots',
  tikzPreviewHint: 'Disattivata per default; scarica il motore locale una volta',
  snooze: 'Posticipa',
  snooze5: 'Pausa 5 minuti',
  snooze30: 'Pausa 30 minuti',
  resume: 'Riprendi',
  pausedUntil: 'In pausa fino a',
  excludeFile: 'Escludi questo file',
  unexcludeFile: 'Annulla esclusione',
  openSettings: 'Apri impostazioni',
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
  statusExcluded: '{product} · questo file è escluso',
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
    installFailed: 'Installazione del pacchetto OCR non riuscita: {message}',
    enableFirst: 'Attiva prima {key}.',
    copied: 'Risultato copiato.',
    errorPrefix: 'OCR: {message}',
    noEditor: 'Nessun editor attivo in cui inserire; usa Copia.',
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
    textDone: 'Testo riconosciuto, confidenza media {percent}%.',
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
