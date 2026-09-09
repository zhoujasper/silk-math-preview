<p align="center">
  <img src="media/icon.png" width="96" alt="Silk Math Preview">
</p>

<p align="center" id="languages">
  <a href="#english">English</a> ·
  <a href="#chinese">中文</a> ·
  <a href="#chinese-traditional">繁體中文</a> ·
  <a href="#japanese">日本語</a> ·
  <a href="#korean">한국어</a> ·
  <a href="#german">Deutsch</a> ·
  <a href="#french">Français</a> ·
  <a href="#spanish">Español</a> ·
  <a href="#portuguese">Português</a> ·
  <a href="#russian">Русский</a> ·
  <a href="#italian">Italiano</a>
</p>

<p align="center">
  <strong>Live math preview that follows your caret.</strong>
</p>

<p align="center">LaTeX · TeX · Markdown · MDX · Jupyter · MathJax · Windows / macOS / Linux</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">Visual Studio Marketplace</a>
  ·
  <a href="https://github.com/zhoujasper/silk-math-preview">GitHub</a>
</p>

<p align="center">
  <img src="media/preview-live-caret.png" width="480" alt="Put the caret in a formula and a live preview appears beside it.">
</p>

<p align="center">
  <img src="media/preview-definitions.png" width="480" alt="Custom macros, environments, and colors render in the preview.">
</p>

<p align="center">
  <img src="media/preview-table.png" width="480" alt="Tables render in the live preview too.">
</p>

<h2 id="english">English</h2>

A Visual Studio Code extension that previews LaTeX formulas as you type. Open a `.tex`, Markdown, MDX, or Quarto file, or a Jupyter notebook (`.ipynb`), and place the caret inside a formula. A floating MathJax preview appears beside it, with a thin orange line marking your typing position. There is no need to run latexmk, generate a PDF, or compile the document.

Supports inline math with `$...$` and `\(...\)`, display math with `\[...\]`, environments such as `equation`, `align`, and `tabular`, and GitHub Flavored Markdown tables. Undefined commands appear in red while the rest of the formula continues to render.

Package declarations and local dependencies are detected automatically, including common custom macros from `.sty` / `.cls` files and unsaved changes in open dependency files. Number and unit commands such as `\num`, `\SI`, and `\qty`, along with custom macros usable in text mode, also work in table cells. [Macro support and limits (Chinese)](docs/MACRO_SUPPORT.md).

Install by searching for <strong>Silk Math Preview</strong> in the Extensions view, or visit the <a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">Visual Studio Marketplace page</a>. Requires VS Code 1.95 or later on Windows, macOS, or Linux.

- **Toggle preview:** `Ctrl+Alt+M` (Mac: `⌘⌥M`). Press `Esc` to dismiss the current preview.
- **Settings:** Click <strong>Silk Math</strong> in the status bar to adjust the preview size and enabled file types. **Other file types** is off by default; enable it to recognize LaTeX in plain text, including untitled files.
- **Preview CSS:** Choose **Silk Math → Edit preview CSS…**. Edit the CSS in a regular editor tab and save to apply; clear it and save to restore the defaults. Use the caret, selection, or whole formula as the reference point, with placement above, below, or to the right. Adjust gaps in lines or pixels, font size, offsets, maximum size, background, border, and shadow, and control overlap with the source formula. Completion, hover help, and advanced examples are available. Images scale proportionally to fit the editor pane when its viewport can be identified; precise boundaries may be unavailable in some layouts. Default padding is `4px 8px`, with `6px` corners; every option has Chinese/English usage help in the CSS editor. [CSS examples and positioning limits (Chinese)](docs/PREVIEW_CSS.md).
- **TikZ / pgfplots:** Enable **TikZ / pgfplots live preview** (`silkMath.tikz.enabled`, off by default), then place the caret in a `tikzpicture`. Unsaved edits update the SVG. First use downloads a verified WebAssembly renderer; subsequent use works offline without a LaTeX installation. Includes pgfplots 1.18.3, `compat=1.18`, grouped plots, plot libraries, and native macro definitions. Complex pictures may take longer; this is not a full TeX distribution. [TikZ guide and examples (Chinese / English)](docs/TIKZ.md).
- **Screenshot and image recognition (OCR):** Click the capture icon in the status bar, then drag to select a screen region. Recognition starts when you release the mouse; copy, insert, or edit the result in a compact menu. Choose **Silk Math → Recognize image…** to paste an image or select a PNG / JPEG file. Models download on first use and run locally; images are not uploaded.
- **OCR shortcuts:** `Ctrl+Alt+O` (Mac: `⌘⌥O`) opens the recognition menu, where `Ctrl+V` (Mac: `⌘V`) pastes an image. In the editor, `Ctrl+Alt+V` (Mac: `⌘⌥V`) recognizes the clipboard image directly. Standard image pasting in LaTeX and Markdown editors also triggers OCR when `silkMath.ocr.pasteImages` is enabled (the default). If your editor lacks the image-paste API, use the recognition menu or the direct clipboard shortcut.
- **OCR accuracy:** Outer whitespace is trimmed and backgrounds are normalized; questionable results get one retry. Table structure is retained, but results may be flagged for review. Complex tables, handwriting, and blurry images still need checking. [Recognition behavior and limits (Chinese)](docs/OCR_ACCURACY.md).
- **Test build:** Add `Shift` to the `Ctrl+Alt+M/O/V` shortcuts (Mac: `⌘⌥M/O/V`). The test build uses separate `silkMathTest.*` settings; automatic image recognition on paste is off by default and can be enabled with `silkMathTest.ocr.pasteImages`.

<p align="center"><a href="#languages">Languages</a></p>

<h2 id="chinese">中文</h2>

在 Visual Studio Code 中边写边看 LaTeX 公式。打开 `.tex`、Markdown、MDX、Quarto 文件或 Jupyter 笔记本（`.ipynb`），把光标放进公式，旁边就会出现 MathJax 浮动预览，橙色细线标出当前输入位置。无需运行 latexmk、生成 PDF 或编译整份文档。

支持行内公式 `$...$`、`\(...\)`，独立公式 `\[...\]`，`equation`、`align`、`tabular` 等环境，以及 GitHub 风格的 Markdown 表格。未定义的命令以红色显示，其余部分继续渲染。

自动分析宏包声明和本地依赖，识别 `.sty` / `.cls` 中的常见自定义宏，也会读取已打开依赖文件中尚未保存的修改。`\num`、`\SI`、`\qty` 等数字和单位命令，以及可用于文本模式的自定义宏，同样支持在表格单元格内展开。详见[宏支持范围与限制](docs/MACRO_SUPPORT.md)。

在扩展视图中搜索 <strong>Silk Math Preview</strong> 即可安装，或打开 <a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">Visual Studio Marketplace 页面</a>。支持 Windows、macOS 和 Linux，需要 VS Code 1.95 或更高版本。

- **开关预览：** `Ctrl+Alt+M`（Mac：`⌘⌥M`）。按 `Esc` 关闭当前预览。
- **设置：** 点击状态栏的 <strong>Silk Math</strong>，调整预览大小和启用的文件类型。**其他文件类型**默认关闭；开启后，纯文本和未命名文件也能按 LaTeX 语法识别公式。
- **预览 CSS：** 选择 **Silk Math → 编辑预览 CSS…**，在普通编辑器标签中修改 CSS，保存即生效，清空并保存可恢复默认。可相对光标、选区或整块公式定位，放在上方、下方或右侧；支持按行或像素设置间隔，调整字号、偏移、最大尺寸、背景、边框和阴影，并控制是否覆盖源码公式。提供参数补全、悬停说明和高级示例。能识别编辑器可视区域时，图片会等比例适应当前分屏；部分布局下可能无法精确限制边界。 默认内边距 `4px 8px`、圆角 `6px`；CSS 编辑页为全部参数提供中英文说明和用法。 详见 [CSS 示例与定位限制](docs/PREVIEW_CSS.md)。
- **TikZ / pgfplots：** 勾选 **TikZ / pgfplots 实时预览**（`silkMath.tikz.enabled`，默认关闭），把光标放进 `tikzpicture`，无需保存即可随编辑更新 SVG。首次使用下载并校验 WebAssembly 渲染组件，之后可离线运行，无需安装 LaTeX。附带 pgfplots 1.18.3，支持 `compat=1.18`、分组图、绘图库和原生宏定义。复杂图形可能需要更长时间，支持范围不等同于完整 TeX 发行版。详见[使用说明和示例（中英双语）](docs/TIKZ.md)。
- **截图与图片识别（OCR）：** 点击状态栏截图图标，拖动框选屏幕区域，松开鼠标后自动识别；在小菜单中复制、插入或编辑结果。**Silk Math → 识别图片…** 可粘贴图片或选择 PNG / JPEG 文件。模型首次使用时下载，识别在本机完成，图片不会上传。
- **OCR 快捷键：** `Ctrl+Alt+O`（Mac：`⌘⌥O`）打开识别菜单，在菜单内按 `Ctrl+V`（Mac：`⌘V`）粘贴图片。在编辑器中按 `Ctrl+Alt+V`（Mac：`⌘⌥V`）可直接识别剪贴板图片。`silkMath.ocr.pasteImages` 默认开启，支持在 LaTeX、Markdown 编辑器中直接粘贴图片识别。编辑器不支持图片粘贴 API 时，可使用识别菜单或直接读取剪贴板的快捷键。
- **OCR 精度：** 自动裁去外侧留白、统一背景，对可疑结果额外识别一次。表格结构会保留，但可能提示复核；复杂表格、手写和模糊图片仍需检查。详见[识别流程与限制](docs/OCR_ACCURACY.md)。
- **测试版：** `Ctrl+Alt+M/O/V`（Mac：`⌘⌥M/O/V`）这三组快捷键需要额外按 `Shift`。测试版使用独立的 `silkMathTest.*` 设置，自动粘贴图片识别默认关闭，可通过 `silkMathTest.ocr.pasteImages` 开启。

<p align="center"><a href="#languages">语言</a></p>

<h2 id="chinese-traditional">繁體中文</h2>

在 Visual Studio Code 中一邊輸入，一邊預覽 LaTeX 公式。開啟 `.tex`、Markdown、MDX、Quarto 檔案或 Jupyter 筆記本（`.ipynb`），將游標放入公式，旁邊就會出現 MathJax 浮動預覽，橘色細線標示目前的輸入位置。無須執行 latexmk、產生 PDF 或編譯整份文件。

支援行內公式 `$...$`、`\(...\)`，獨立公式 `\[...\]`，`equation`、`align`、`tabular` 等環境，以及 GitHub 風格的 Markdown 表格。未定義的命令會以紅色顯示，其餘部分仍可正常呈現。

自動分析套件宣告與本機相依檔案，辨識 `.sty` / `.cls` 中常見的自訂巨集，也會讀取已開啟相依檔案中尚未儲存的修改。`\num`、`\SI`、`\qty` 等數字與單位命令，以及可用於文字模式的自訂巨集，也能在表格儲存格中展開。詳見[巨集支援範圍與限制（簡體中文）](docs/MACRO_SUPPORT.md)。

在擴充功能檢視中搜尋 <strong>Silk Math Preview</strong> 即可安裝，或開啟 <a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">Visual Studio Marketplace 頁面</a>。支援 Windows、macOS 和 Linux，需要 VS Code 1.95 或更新版本。

- **開關預覽：** `Ctrl+Alt+M`（Mac：`⌘⌥M`）。按 `Esc` 關閉目前的預覽。
- **設定：** 點選狀態列的 <strong>Silk Math</strong>，調整預覽大小與啟用的檔案類型。**其他檔案類型**預設關閉；啟用後，純文字與未命名檔案也能依 LaTeX 語法辨識公式。
- **預覽 CSS：** 選擇 **Silk Math → 編輯預覽 CSS…**，在一般編輯器分頁中修改 CSS，儲存後即套用；清空並儲存可還原預設值。可依游標、選取範圍或整塊公式定位，放在上方、下方或右側；支援以行數或像素設定間距，調整字型大小、位移、最大尺寸、背景、邊框與陰影，並控制是否覆蓋原始碼中的公式。提供參數自動完成、滑鼠停留說明與進階範例。能辨識編輯器可視區域時，圖片會等比例縮放以配合目前的分割檢視；部分配置可能無法精確限制邊界。 預設內距為 `4px 8px`、圓角為 `6px`；CSS 編輯頁提供所有參數的中英文說明與用法。 詳見 [CSS 範例與定位限制（簡體中文）](docs/PREVIEW_CSS.md)。
- **TikZ / pgfplots：** 勾選 **TikZ / pgfplots 即時預覽**（`silkMath.tikz.enabled`，預設關閉），將游標放入 `tikzpicture`，尚未儲存的修改也會即時更新 SVG。首次使用會下載並驗證 WebAssembly 繪圖元件，之後可離線執行，無須安裝 LaTeX。內含 pgfplots 1.18.3，支援 `compat=1.18`、群組圖表、繪圖函式庫與原生巨集定義。複雜圖形可能需要較長時間，支援範圍不等同於完整的 TeX 發行版。詳見[使用說明與範例（簡體中文／英文）](docs/TIKZ.md)。
- **螢幕截圖與圖片辨識（OCR）：** 點選狀態列的截圖圖示，拖曳框選螢幕區域，放開滑鼠後即開始辨識；在精簡選單中複製、插入或編輯結果。**Silk Math → 辨識圖片…** 可貼上圖片或選擇 PNG / JPEG 檔案。模型於首次使用時下載，辨識作業在本機完成，不會上傳圖片。
- **OCR 快速鍵：** `Ctrl+Alt+O`（Mac：`⌘⌥O`）開啟辨識選單，在選單內按 `Ctrl+V`（Mac：`⌘V`）貼上圖片。在編輯器中按 `Ctrl+Alt+V`（Mac：`⌘⌥V`）可直接辨識剪貼簿圖片。`silkMath.ocr.pasteImages` 預設開啟，支援在 LaTeX、Markdown 編輯器中直接貼上圖片辨識。若編輯器不支援圖片貼上 API，可使用辨識選單或直接讀取剪貼簿的快速鍵。
- **OCR 準確度：** 自動裁去外圍留白、統一背景，並針對可疑結果額外辨識一次。表格結構會保留，但可能提示檢查；複雜表格、手寫與模糊圖片仍須核對。詳見[辨識流程與限制（簡體中文）](docs/OCR_ACCURACY.md)。
- **測試版：** `Ctrl+Alt+M/O/V`（Mac：`⌘⌥M/O/V`）這三組快速鍵需額外按 `Shift`。測試版採用獨立的 `silkMathTest.*` 設定，貼上圖片自動辨識功能預設關閉，可透過 `silkMathTest.ocr.pasteImages` 啟用。


<p align="center"><a href="#languages">語言</a></p>

<h2 id="japanese">日本語</h2>

Visual Studio Code で、入力しながら LaTeX の数式を確認できる拡張機能です。`.tex`、Markdown、MDX、Quarto のファイル、または Jupyter ノートブック（`.ipynb`）を開き、数式の中にカーソルを置くと、すぐそばに MathJax のプレビューが表示されます。オレンジ色の細い線が入力位置を示します。latexmk の実行や PDF の生成、文書全体のコンパイルは不要です。

インライン数式の `$...$` と `\(...\)`、別行立て数式の `\[...\]`、`equation`、`align`、`tabular` などの環境、GitHub Flavored Markdown の表に対応しています。未定義のコマンドは赤字で表示され、数式のほかの部分は引き続き描画されます。

パッケージ宣言とローカルの依存ファイルを自動で読み取り、`.sty` / `.cls` に記述された一般的な独自マクロや、開いている依存ファイルの未保存の変更も反映します。`\num`、`\SI`、`\qty` などの数値・単位コマンドや、テキストモードで使える独自マクロは、表のセル内でも利用できます。[マクロの対応範囲と制限（中国語）](docs/MACRO_SUPPORT.md)。

拡張機能ビューで <strong>Silk Math Preview</strong> を検索するか、<a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">Visual Studio Marketplace のページ</a>からインストールしてください。Windows、macOS、Linux に対応し、VS Code 1.95 以降が必要です。

- **プレビューの切り替え：** `Ctrl+Alt+M`（Mac：`⌘⌥M`）でオン／オフを切り替えます。現在のプレビューを閉じるには `Esc` を押します。
- **設定：** ステータスバーの <strong>Silk Math</strong> をクリックすると、プレビューの大きさや対象のファイル形式を変更できます。**その他のファイル**は初期設定ではオフです。有効にすると、名前を付けていないファイルを含むプレーンテキストでも LaTeX 数式を認識します。
- **プレビュー CSS：** **Silk Math → プレビュー CSS を編集…** を選び、通常のエディタータブで CSS を編集して保存すると反映されます。内容を空にして保存すると初期設定に戻ります。カーソル、選択範囲、数式全体を基準に、上・下・右のいずれかに配置できます。行数またはピクセル単位の間隔、文字サイズ、オフセット、最大サイズ、背景、枠線、影を調整し、ソースの数式との重なりを制御できます。入力補完、マウスを重ねたときの説明、詳細設定の例も利用できます。エディターの表示領域を取得できる場合は、縦横比を保って分割画面内に収めます。一部のレイアウトでは境界を正確に判定できない場合があります。 既定の内側余白は `4px 8px`、角丸は `6px` です。CSS エディターには全項目の中国語・英語の説明と使い方があります。 [CSS の例と配置の制限（中国語）](docs/PREVIEW_CSS.md)。
- **TikZ / pgfplots：** **TikZ / pgfplots ライブプレビュー**（`silkMath.tikz.enabled`、初期設定はオフ）を有効にし、`tikzpicture` 内にカーソルを置きます。保存前の編集内容も SVG に反映されます。初回に整合性を検証済みの WebAssembly 描画エンジンをダウンロードし、その後は LaTeX をインストールせずにオフラインで利用できます。pgfplots 1.18.3 を同梱し、`compat=1.18`、グループ化したグラフ、描画ライブラリ、ネイティブなマクロ定義に対応しています。複雑な図は時間がかかることがあり、完全な TeX ディストリビューションと同じ機能を備えているわけではありません。[TikZ の使い方と例（中国語・英語）](docs/TIKZ.md)。
- **スクリーンショット・画像認識（OCR）：** ステータスバーのキャプチャアイコンをクリックし、画面上の範囲をドラッグで選択します。マウスを離すと認識が始まり、小さなメニューから結果のコピー、挿入、編集ができます。**Silk Math → Recognize image…**（画像認識）では、画像の貼り付けや PNG / JPEG ファイルの選択もできます。モデルは初回にダウンロードされ、認識処理はローカルで行われます。画像はアップロードされません。
- **OCR のショートカット：** `Ctrl+Alt+O`（Mac：`⌘⌥O`）で認識メニューを開き、メニュー内で `Ctrl+V`（Mac：`⌘V`）を押すと画像を貼り付けられます。エディター内では `Ctrl+Alt+V`（Mac：`⌘⌥V`）でクリップボードの画像を直接認識します。`silkMath.ocr.pasteImages` は初期設定で有効になっており、LaTeX・Markdown エディターへの通常の画像貼り付けでも OCR が起動します。エディターが画像貼り付け API に対応していない場合は、認識メニューかクリップボード認識のショートカットを使ってください。
- **OCR の精度：** 外側の余白を切り取り、背景を整えたうえで認識します。不確かな結果は一度だけ再認識します。表の構造は保持しますが、確認を求める場合があります。複雑な表、手書き文字、不鮮明な画像の結果は引き続き確認が必要です。[認識処理と制限（中国語）](docs/OCR_ACCURACY.md)。
- **テスト版：** `Ctrl+Alt+M/O/V`（Mac：`⌘⌥M/O/V`）の各ショートカットには `Shift` を追加します。設定は独立した `silkMathTest.*` を使用します。画像の貼り付けによる自動認識は初期設定ではオフで、`silkMathTest.ocr.pasteImages` から有効にできます。


<p align="center"><a href="#languages">言語</a></p>

<h2 id="korean">한국어</h2>

Visual Studio Code에서 LaTeX 수식을 입력하는 동시에 미리 볼 수 있는 확장 기능입니다. `.tex`, Markdown, MDX, Quarto 파일이나 Jupyter 노트북(`.ipynb`)을 열고 수식 안에 커서를 놓으면 옆에 MathJax 미리 보기가 나타납니다. 가느다란 주황색 선으로 현재 입력 위치를 표시합니다. latexmk를 실행하거나 PDF를 만들거나 문서 전체를 컴파일할 필요가 없습니다.

인라인 수식 `$...$`와 `\(...\)`, 별도 줄에 표시하는 수식 `\[...\]`, `equation`, `align`, `tabular` 등의 환경, GitHub Flavored Markdown 표를 지원합니다. 정의되지 않은 명령은 빨간색으로 표시하고 나머지 수식은 계속 렌더링합니다.

패키지 선언과 로컬 종속 파일을 자동으로 분석합니다. `.sty` / `.cls` 파일의 일반적인 사용자 정의 매크로와 열려 있는 종속 파일의 저장하지 않은 변경 사항도 반영합니다. `\num`, `\SI`, `\qty` 같은 숫자·단위 명령과 텍스트 모드에서 사용할 수 있는 사용자 정의 매크로는 표 셀 안에서도 작동합니다. [매크로 지원 범위와 제한 사항(중국어)](docs/MACRO_SUPPORT.md).

확장 보기에서 <strong>Silk Math Preview</strong>를 검색하거나 <a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">Visual Studio Marketplace 페이지</a>에서 설치하세요. Windows, macOS, Linux를 지원하며 VS Code 1.95 이상이 필요합니다.

- **미리 보기 켜기/끄기:** `Ctrl+Alt+M`(Mac: `⌘⌥M`)을 누르세요. `Esc`를 누르면 현재 미리 보기가 닫힙니다.
- **설정:** 상태 표시줄의 <strong>Silk Math</strong>을 클릭해 미리 보기 크기와 사용할 파일 형식을 조정하세요. **다른 파일 형식**은 기본적으로 꺼져 있습니다. 켜면 이름을 지정하지 않은 파일을 포함한 일반 텍스트에서도 LaTeX 수식을 인식합니다.
- **미리 보기 CSS:** **Silk Math → 미리 보기 CSS 편집…** 메뉴를 선택하세요. 일반 편집기 탭에서 CSS를 수정하고 저장하면 적용되며, 내용을 비우고 저장하면 기본값으로 돌아갑니다. 커서, 선택 영역 또는 수식 전체를 기준으로 위·아래·오른쪽에 배치할 수 있습니다. 행 또는 픽셀 단위의 간격, 글자 크기, 오프셋, 최대 크기, 배경, 테두리, 그림자를 조정하고 원본 수식을 가릴지 여부도 설정할 수 있습니다. 매개변수 자동 완성, 마우스를 올렸을 때의 설명, 고급 설정 예시를 제공합니다. 편집기의 표시 영역을 확인할 수 있으면 가로세로 비율을 유지하며 분할 창 안에 맞춥니다. 일부 레이아웃에서는 경계를 정확히 확인하지 못할 수 있습니다. 기본 안쪽 여백은 `4px 8px`, 모서리 반경은 `6px`이며, CSS 편집기에서 모든 옵션의 중국어·영어 설명과 사용법을 볼 수 있습니다. [CSS 예시와 위치 지정 제한 사항(중국어)](docs/PREVIEW_CSS.md).
- **TikZ / pgfplots:** **TikZ / pgfplots 실시간 미리보기**(`silkMath.tikz.enabled`, 기본값은 꺼짐)를 켠 뒤 `tikzpicture` 안에 커서를 놓으세요. 저장하지 않은 수정 사항도 SVG에 반영됩니다. 처음 사용할 때 검증된 WebAssembly 렌더러를 다운로드하며, 이후에는 LaTeX 설치 없이 오프라인으로 사용할 수 있습니다. pgfplots 1.18.3이 포함되어 있으며 `compat=1.18`, 그룹 플롯, 플롯 라이브러리, TeX 고유의 매크로 정의를 지원합니다. 복잡한 그림은 시간이 더 걸릴 수 있으며, 완전한 TeX 배포판의 모든 기능을 제공하지는 않습니다. [TikZ 사용법과 예시(중국어/영어)](docs/TIKZ.md).
- **스크린샷·이미지 인식(OCR):** 상태 표시줄의 캡처 아이콘을 클릭하고 화면 영역을 드래그해 선택하세요. 마우스를 놓으면 인식이 시작되며, 간단한 메뉴에서 결과를 복사하거나 삽입하거나 편집할 수 있습니다. **Silk Math → Recognize image…**(이미지 인식)에서는 이미지를 붙여 넣거나 PNG / JPEG 파일을 선택할 수 있습니다. 모델은 처음 사용할 때 다운로드하며, 인식은 로컬에서 처리하고 이미지는 업로드하지 않습니다.
- **OCR 단축키:** `Ctrl+Alt+O`(Mac: `⌘⌥O`)로 인식 메뉴를 열고, 메뉴 안에서 `Ctrl+V`(Mac: `⌘V`)로 이미지를 붙여 넣으세요. 편집기에서 `Ctrl+Alt+V`(Mac: `⌘⌥V`)를 누르면 클립보드 이미지를 바로 인식합니다. `silkMath.ocr.pasteImages`는 기본적으로 켜져 있어 LaTeX·Markdown 편집기에서 일반적인 이미지 붙여넣기로도 OCR을 실행할 수 있습니다. 편집기가 이미지 붙여넣기 API를 지원하지 않으면 인식 메뉴나 클립보드 인식 단축키를 사용하세요.
- **OCR 정확도:** 이미지 바깥쪽 여백을 잘라 내고 배경을 정리합니다. 결과가 불확실하면 한 번 더 인식합니다. 표 구조는 유지하지만 결과를 검토하라는 안내가 나올 수 있습니다. 복잡한 표, 손글씨, 흐릿한 이미지의 결과는 여전히 확인이 필요합니다. [인식 과정과 제한 사항(중국어)](docs/OCR_ACCURACY.md).
- **테스트 버전:** `Ctrl+Alt+M/O/V`(Mac: `⌘⌥M/O/V`) 단축키에 `Shift`를 추가하세요. 테스트 버전은 별도의 `silkMathTest.*` 설정을 사용합니다. 이미지 붙여넣기 자동 인식은 기본적으로 꺼져 있으며 `silkMathTest.ocr.pasteImages`로 켤 수 있습니다.


<p align="center"><a href="#languages">언어</a></p>

<h2 id="german">Deutsch</h2>

Eine Erweiterung für Visual Studio Code, die LaTeX-Formeln während der Eingabe anzeigt. Öffnen Sie eine `.tex`-, Markdown-, MDX- oder Quarto-Datei oder ein Jupyter-Notebook (`.ipynb`) und setzen Sie den Cursor in eine Formel. Daneben erscheint eine schwebende MathJax-Vorschau; eine dünne orangefarbene Linie zeigt die aktuelle Eingabeposition. Sie müssen weder latexmk ausführen noch ein PDF erzeugen oder das Dokument kompilieren.

Unterstützt werden Formeln im Fließtext mit `$...$` und `\(...\)`, abgesetzte Formeln mit `\[...\]`, Umgebungen wie `equation`, `align` und `tabular` sowie Tabellen in GitHub Flavored Markdown. Nicht definierte Befehle erscheinen rot; der übrige Teil der Formel wird weiterhin dargestellt.

Paketdeklarationen und lokale Abhängigkeiten werden automatisch erkannt, einschließlich gängiger eigener Makros aus `.sty` / `.cls` und ungespeicherter Änderungen in geöffneten Abhängigkeitsdateien. Zahlen- und Einheitenbefehle wie `\num`, `\SI` und `\qty` sowie eigene, im Textmodus verwendbare Makros funktionieren auch in Tabellenzellen. [Unterstützte Makros und Einschränkungen (Chinesisch)](docs/MACRO_SUPPORT.md).

Suchen Sie in der Erweiterungsansicht nach <strong>Silk Math Preview</strong> oder öffnen Sie die <a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">Seite im Visual Studio Marketplace</a>. Benötigt VS Code ab Version 1.95 unter Windows, macOS oder Linux.

- **Vorschau ein-/ausschalten:** `Strg+Alt+M` (Mac: `⌘⌥M`). Mit `Esc` schließen Sie die aktuelle Vorschau.
- **Einstellungen:** Klicken Sie in der Statusleiste auf <strong>Silk Math</strong>, um die Vorschaugröße und die aktivierten Dateitypen anzupassen. **Andere Dateitypen** ist standardmäßig deaktiviert. Nach dem Einschalten werden LaTeX-Formeln auch in reinen Textdateien erkannt, einschließlich unbenannter Dateien.
- **Vorschau-CSS:** Wählen Sie **Silk Math → Vorschau-CSS bearbeiten…**. Bearbeiten Sie das CSS in einem normalen Editor-Tab und speichern Sie es, um die Änderungen anzuwenden. Leeren und speichern Sie die Datei, um die Standardwerte wiederherzustellen. Wählen Sie den Cursor, die Auswahl oder die gesamte Formel als Bezugspunkt und platzieren Sie die Vorschau darüber, darunter oder rechts davon. Einstellbar sind Abstände in Zeilen oder Pixeln, Schriftgröße, Versatz, maximale Größe, Hintergrund, Rahmen, Schatten und die Überlappung mit der Formel im Quelltext. Autovervollständigung, Hinweise beim Überfahren mit der Maus und erweiterte Beispiele helfen bei der Anpassung. Wenn sich der sichtbare Editorbereich bestimmen lässt, werden Bilder unter Beibehaltung des Seitenverhältnisses eingepasst. Bei manchen Layouts lassen sich die Grenzen nicht genau ermitteln. Der Standard-Innenabstand beträgt `4px 8px`, der Eckenradius `6px`; der CSS-Editor enthält chinesische und englische Anwendungshinweise zu allen Optionen. [CSS-Beispiele und Grenzen der Positionierung (Chinesisch)](docs/PREVIEW_CSS.md).
- **TikZ / pgfplots:** Aktivieren Sie **TikZ / pgfplots Live-Vorschau** (`silkMath.tikz.enabled`, standardmäßig aus) und setzen Sie den Cursor in eine `tikzpicture`-Umgebung. Auch ungespeicherte Änderungen aktualisieren das SVG. Beim ersten Einsatz wird ein auf Integrität geprüfter WebAssembly-Renderer heruntergeladen; danach funktioniert die Vorschau offline ohne LaTeX-Installation. Enthalten sind pgfplots 1.18.3, `compat=1.18`, gruppierte Diagramme, Diagrammbibliotheken und native Makrodefinitionen. Komplexe Grafiken können länger dauern; der Funktionsumfang entspricht keiner vollständigen TeX-Distribution. [TikZ-Anleitung und Beispiele (Chinesisch / Englisch)](docs/TIKZ.md).
- **Bildschirm- und Bilderkennung (OCR):** Klicken Sie auf das Aufnahmesymbol in der Statusleiste und ziehen Sie einen Auswahlrahmen auf dem Bildschirm. Sobald Sie die Maustaste loslassen, beginnt die Erkennung. In einem kompakten Menü können Sie das Ergebnis kopieren, einfügen oder bearbeiten. Unter **Silk Math → Recognize image…** (Bild erkennen) können Sie ein Bild aus der Zwischenablage einfügen oder eine PNG-/JPEG-Datei auswählen. Die Modelle werden beim ersten Einsatz heruntergeladen und lokal ausgeführt; Bilder werden nicht hochgeladen.
- **OCR-Tastenkürzel:** `Strg+Alt+O` (Mac: `⌘⌥O`) öffnet das Erkennungsmenü. Dort fügen Sie mit `Strg+V` (Mac: `⌘V`) ein Bild ein. Im Editor erkennt `Strg+Alt+V` (Mac: `⌘⌥V`) direkt das Bild in der Zwischenablage. Mit `silkMath.ocr.pasteImages` (standardmäßig aktiviert) löst auch das normale Einfügen eines Bildes in LaTeX- und Markdown-Editoren die Erkennung aus. Fehlt Ihrem Editor die API zum Einfügen von Bildern, verwenden Sie das Erkennungsmenü oder das Tastenkürzel für die Zwischenablage.
- **OCR-Genauigkeit:** Äußere Leerflächen werden zugeschnitten und der Hintergrund vereinheitlicht. Bei fragwürdigen Ergebnissen erfolgt ein weiterer Erkennungsversuch. Tabellenstrukturen bleiben erhalten; Ergebnisse können jedoch zur Überprüfung markiert werden. Komplexe Tabellen, Handschrift und unscharfe Bilder sollten Sie weiterhin prüfen. [Erkennungsverfahren und Einschränkungen (Chinesisch)](docs/OCR_ACCURACY.md).
- **Testversion:** Ergänzen Sie die Tastenkürzel `Strg+Alt+M/O/V` (Mac: `⌘⌥M/O/V`) um `Shift` (Umschalt). Die Testversion verwendet separate Einstellungen unter `silkMathTest.*`. Die automatische Bilderkennung beim Einfügen ist standardmäßig deaktiviert und lässt sich mit `silkMathTest.ocr.pasteImages` aktivieren.


<p align="center"><a href="#languages">Sprachen</a></p>

<h2 id="french">Français</h2>

Une extension pour Visual Studio Code qui affiche vos formules LaTeX au fil de la saisie. Ouvrez un fichier `.tex`, Markdown, MDX ou Quarto, ou un notebook Jupyter (`.ipynb`), puis placez le curseur dans une formule. Un aperçu flottant MathJax apparaît à côté ; un fin trait orange indique la position de saisie. Inutile de lancer latexmk, de générer un PDF ou de compiler le document.

L’extension prend en charge les formules dans le texte avec `$...$` et `\(...\)`, les formules sur une ligne séparée avec `\[...\]`, les environnements comme `equation`, `align` et `tabular`, ainsi que les tableaux GitHub Flavored Markdown. Les commandes non définies apparaissent en rouge ; le reste de la formule continue de s’afficher.

Les déclarations de packages et les dépendances locales sont détectées automatiquement, y compris les macros personnalisées courantes des fichiers `.sty` / `.cls` et les modifications non enregistrées dans les fichiers de dépendances ouverts. Les commandes de nombres et d’unités telles que `\num`, `\SI` et `\qty`, ainsi que les macros personnalisées utilisables en mode texte, fonctionnent aussi dans les cellules des tableaux. [Macros prises en charge et limites (en chinois)](docs/MACRO_SUPPORT.md).

Recherchez <strong>Silk Math Preview</strong> dans la vue Extensions, ou consultez la <a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">fiche Visual Studio Marketplace</a>. Nécessite VS Code 1.95 ou une version ultérieure, sous Windows, macOS ou Linux.

- **Activer ou désactiver l’aperçu :** `Ctrl+Alt+M` (Mac : `⌘⌥M`). Appuyez sur `Esc` pour fermer l’aperçu actuel.
- **Paramètres :** Cliquez sur <strong>Silk Math</strong> dans la barre d’état pour régler la taille de l’aperçu et les types de fichiers concernés. L’option **Autres types de fichiers** est désactivée par défaut ; activez-la pour reconnaître les formules LaTeX dans les fichiers texte brut, y compris ceux sans titre.
- **CSS de l’aperçu :** Choisissez **Silk Math → Modifier le CSS de l’aperçu…**. Modifiez le CSS dans un onglet normal de l’éditeur, puis enregistrez pour appliquer les changements. Effacez le contenu et enregistrez pour rétablir les valeurs par défaut. Prenez le curseur, la sélection ou la formule entière comme repère, puis placez l’aperçu au-dessus, en dessous ou à droite. Réglez l’écart en lignes ou en pixels, la taille de police, le décalage, la taille maximale, le fond, la bordure, l’ombre et le chevauchement avec la formule source. La saisie semi-automatique, l’aide au survol et des exemples avancés sont disponibles. Les images s’adaptent au volet de l’éditeur en conservant leurs proportions lorsque sa zone visible peut être déterminée. Certaines dispositions ne permettent pas de délimiter cette zone avec précision. Par défaut, la marge intérieure est de `4px 8px` et le rayon des coins de `6px` ; l’éditeur CSS fournit une aide en chinois et en anglais pour chaque option. [Exemples CSS et limites de positionnement (en chinois)](docs/PREVIEW_CSS.md).
- **TikZ / pgfplots :** Activez **Aperçu TikZ / pgfplots en direct** (`silkMath.tikz.enabled`, désactivé par défaut), puis placez le curseur dans un environnement `tikzpicture`. Les modifications actualisent le SVG sans avoir à enregistrer. La première utilisation télécharge un moteur de rendu WebAssembly dont l’intégrité est vérifiée ; les suivantes fonctionnent hors ligne, sans installation de LaTeX. L’extension inclut pgfplots 1.18.3, `compat=1.18`, les graphiques groupés, les bibliothèques de tracé et les définitions de macros natives. Les figures complexes peuvent prendre plus de temps ; il ne s’agit pas d’une distribution TeX complète. [Guide TikZ et exemples (en chinois et en anglais)](docs/TIKZ.md).
- **Reconnaissance de captures et d’images (OCR) :** Cliquez sur l’icône de capture dans la barre d’état, puis sélectionnez une zone de l’écran en faisant glisser la souris. La reconnaissance démarre au relâchement du bouton. Un menu compact permet de copier, d’insérer ou de modifier le résultat. Choisissez **Silk Math → Recognize image…** (reconnaître une image) pour coller une image ou sélectionner un fichier PNG / JPEG. Les modèles sont téléchargés à la première utilisation et s’exécutent localement ; les images ne sont pas envoyées en ligne.
- **Raccourcis OCR :** `Ctrl+Alt+O` (Mac : `⌘⌥O`) ouvre le menu de reconnaissance, où `Ctrl+V` (Mac : `⌘V`) colle une image. Dans l’éditeur, `Ctrl+Alt+V` (Mac : `⌘⌥V`) reconnaît directement l’image du presse-papiers. L’option `silkMath.ocr.pasteImages`, activée par défaut, déclenche aussi l’OCR lors d’un collage d’image classique dans les éditeurs LaTeX et Markdown. Si votre éditeur ne dispose pas de l’API de collage d’images, utilisez le menu de reconnaissance ou le raccourci du presse-papiers.
- **Précision de l’OCR :** Les marges vides sont rognées et le fond est uniformisé. Les résultats douteux font l’objet d’une seconde tentative de reconnaissance. La structure des tableaux est conservée, mais une vérification peut être demandée. Les tableaux complexes, l’écriture manuscrite et les images floues nécessitent toujours une relecture. [Fonctionnement et limites de la reconnaissance (en chinois)](docs/OCR_ACCURACY.md).
- **Version de test :** Ajoutez `Shift` (Maj) aux raccourcis `Ctrl+Alt+M/O/V` (Mac : `⌘⌥M/O/V`). Cette version utilise des paramètres distincts sous `silkMathTest.*`. La reconnaissance automatique au collage d’une image est désactivée par défaut ; vous pouvez l’activer avec `silkMathTest.ocr.pasteImages`.


<p align="center"><a href="#languages">Langues</a></p>

<h2 id="spanish">Español</h2>

Una extensión para Visual Studio Code que muestra tus fórmulas LaTeX mientras escribes. Abre un archivo `.tex`, Markdown, MDX o Quarto, o un cuaderno de Jupyter (`.ipynb`), y coloca el cursor dentro de una fórmula. A su lado aparece una vista previa flotante de MathJax; una fina línea naranja indica dónde estás escribiendo. No hace falta ejecutar latexmk, generar un PDF ni compilar el documento.

Admite fórmulas en línea con `$...$` y `\(...\)`, fórmulas en una línea independiente con `\[...\]`, entornos como `equation`, `align` y `tabular`, y tablas de GitHub Flavored Markdown. Los comandos no definidos aparecen en rojo y el resto de la fórmula sigue mostrándose.

Detecta automáticamente las declaraciones de paquetes y las dependencias locales, incluidas las macros personalizadas habituales de archivos `.sty` / `.cls` y los cambios sin guardar en archivos de dependencias abiertos. Los comandos de números y unidades como `\num`, `\SI` y `\qty`, así como las macros personalizadas que pueden usarse en modo texto, también funcionan en las celdas de las tablas. [Macros compatibles y limitaciones (en chino)](docs/MACRO_SUPPORT.md).

Busca <strong>Silk Math Preview</strong> en la vista Extensiones o visita la <a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">página de Visual Studio Marketplace</a>. Requiere VS Code 1.95 o posterior en Windows, macOS o Linux.

- **Activar o desactivar la vista previa:** `Ctrl+Alt+M` (Mac: `⌘⌥M`). Pulsa `Esc` para cerrar la vista previa actual.
- **Configuración:** Haz clic en <strong>Silk Math</strong> en la barra de estado para ajustar el tamaño de la vista previa y los tipos de archivo habilitados. **Otros tipos de archivo** está desactivado de forma predeterminada; actívalo para reconocer fórmulas LaTeX en texto sin formato, incluidos los archivos sin título.
- **CSS de la vista previa:** Selecciona **Silk Math → Editar CSS de la vista previa…**. Edita el CSS en una pestaña normal del editor y guarda para aplicar los cambios. Borra el contenido y guarda para restaurar los valores predeterminados. Usa el cursor, la selección o la fórmula completa como referencia y coloca la vista previa encima, debajo o a la derecha. Ajusta la separación en líneas o píxeles, el tamaño de letra, el desplazamiento, el tamaño máximo, el fondo, el borde y la sombra, y decide si puede superponerse a la fórmula del código fuente. Incluye autocompletado, ayuda al pasar el cursor y ejemplos avanzados. Las imágenes se adaptan proporcionalmente al panel del editor cuando se puede identificar su área visible; en algunas disposiciones no es posible determinar los límites con precisión. El relleno predeterminado es de `4px 8px` y el radio de las esquinas de `6px`; el editor CSS incluye instrucciones en chino e inglés para todas las opciones. [Ejemplos de CSS y límites de posicionamiento (en chino)](docs/PREVIEW_CSS.md).
- **TikZ / pgfplots:** Activa **Vista previa de TikZ / pgfplots** (`silkMath.tikz.enabled`, desactivada de forma predeterminada) y coloca el cursor en un entorno `tikzpicture`. Los cambios actualizan el SVG sin necesidad de guardar. En el primer uso se descarga un motor de renderizado WebAssembly cuya integridad se verifica; después funciona sin conexión y sin instalar LaTeX. Incluye pgfplots 1.18.3, `compat=1.18`, gráficos agrupados, bibliotecas de gráficos y definiciones de macros nativas. Las figuras complejas pueden tardar más; no equivale a una distribución completa de TeX. [Guía de TikZ y ejemplos (en chino e inglés)](docs/TIKZ.md).
- **Reconocimiento de capturas e imágenes (OCR):** Haz clic en el icono de captura de la barra de estado y arrastra para seleccionar una zona de la pantalla. El reconocimiento comienza al soltar el botón del ratón. Un menú compacto permite copiar, insertar o editar el resultado. Selecciona **Silk Math → Recognize image…** (reconocer imagen) para pegar una imagen o elegir un archivo PNG / JPEG. Los modelos se descargan en el primer uso y se ejecutan localmente; las imágenes no se suben a ningún servidor.
- **Atajos de OCR:** `Ctrl+Alt+O` (Mac: `⌘⌥O`) abre el menú de reconocimiento, donde puedes pegar una imagen con `Ctrl+V` (Mac: `⌘V`). En el editor, `Ctrl+Alt+V` (Mac: `⌘⌥V`) reconoce directamente la imagen del portapapeles. Con `silkMath.ocr.pasteImages`, activado de forma predeterminada, pegar una imagen normalmente en los editores LaTeX y Markdown también inicia el OCR. Si tu editor no dispone de la API para pegar imágenes, usa el menú de reconocimiento o el atajo del portapapeles.
- **Precisión del OCR:** Se recortan los márgenes vacíos y se uniformiza el fondo; los resultados dudosos se vuelven a reconocer una vez. Se conserva la estructura de las tablas, aunque puede solicitarse una revisión. Las tablas complejas, la escritura a mano y las imágenes borrosas siguen necesitando comprobación. [Proceso de reconocimiento y limitaciones (en chino)](docs/OCR_ACCURACY.md).
- **Versión de prueba:** Añade `Shift` (Mayús) a los atajos `Ctrl+Alt+M/O/V` (Mac: `⌘⌥M/O/V`). Esta versión usa una configuración independiente bajo `silkMathTest.*`. El reconocimiento automático al pegar imágenes está desactivado de forma predeterminada y se puede activar con `silkMathTest.ocr.pasteImages`.


<p align="center"><a href="#languages">Idiomas</a></p>

<h2 id="portuguese">Português</h2>

Uma extensão para Visual Studio Code que mostra suas fórmulas LaTeX enquanto você digita. Abra um arquivo `.tex`, Markdown, MDX ou Quarto, ou um notebook Jupyter (`.ipynb`), e posicione o cursor dentro de uma fórmula. Uma prévia flutuante do MathJax aparece ao lado, com uma linha fina laranja indicando a posição de digitação. Não é preciso executar latexmk, gerar um PDF nem compilar o documento.

Oferece suporte a fórmulas no texto com `$...$` e `\(...\)`, fórmulas em uma linha separada com `\[...\]`, ambientes como `equation`, `align` e `tabular`, além de tabelas do GitHub Flavored Markdown. Comandos não definidos aparecem em vermelho, enquanto o restante da fórmula continua sendo exibido.

As declarações de pacotes e as dependências locais são detectadas automaticamente, incluindo macros personalizadas comuns em arquivos `.sty` / `.cls` e alterações não salvas em arquivos de dependências abertos. Comandos de números e unidades como `\num`, `\SI` e `\qty`, assim como macros personalizadas que funcionam no modo de texto, também podem ser usados nas células das tabelas. [Macros compatíveis e limitações (em chinês)](docs/MACRO_SUPPORT.md).

Pesquise <strong>Silk Math Preview</strong> na visualização Extensões ou acesse a <a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">página do Visual Studio Marketplace</a>. Requer VS Code 1.95 ou mais recente no Windows, macOS ou Linux.

- **Ativar ou desativar a prévia:** `Ctrl+Alt+M` (Mac: `⌘⌥M`). Pressione `Esc` para fechar a prévia atual.
- **Configurações:** Clique em <strong>Silk Math</strong> na barra de status para ajustar o tamanho da prévia e os tipos de arquivo habilitados. **Outros tipos de arquivo** vem desativado; ative essa opção para reconhecer fórmulas LaTeX em texto simples, incluindo arquivos sem título.
- **CSS da prévia:** Escolha **Silk Math → Editar CSS da prévia…**. Edite o CSS em uma aba comum do editor e salve para aplicar as alterações. Apague o conteúdo e salve para restaurar os valores padrão. Use o cursor, a seleção ou a fórmula inteira como referência e posicione a prévia acima, abaixo ou à direita. Ajuste o espaço em linhas ou pixels, o tamanho da fonte, o deslocamento, o tamanho máximo, o fundo, a borda e a sombra, e controle a sobreposição à fórmula no código-fonte. Há preenchimento automático, ajuda ao passar o mouse e exemplos avançados. As imagens se ajustam proporcionalmente ao painel do editor quando sua área visível pode ser identificada; em alguns layouts, os limites podem não ser determinados com precisão. O espaçamento interno padrão é `4px 8px`, com raio de `6px` nos cantos; o editor CSS inclui instruções em chinês e inglês para todas as opções. [Exemplos de CSS e limites de posicionamento (em chinês)](docs/PREVIEW_CSS.md).
- **TikZ / pgfplots:** Ative **Prévia ao vivo de TikZ / pgfplots** (`silkMath.tikz.enabled`, desativada por padrão) e posicione o cursor em um ambiente `tikzpicture`. As alterações atualizam o SVG mesmo antes de salvar. No primeiro uso, é baixado um renderizador WebAssembly com verificação de integridade; depois, ele funciona offline, sem instalar LaTeX. Inclui pgfplots 1.18.3, `compat=1.18`, gráficos agrupados, bibliotecas de gráficos e definições de macros nativas. Figuras complexas podem levar mais tempo; os recursos não equivalem aos de uma distribuição TeX completa. [Guia de TikZ e exemplos (em chinês e inglês)](docs/TIKZ.md).
- **Reconhecimento de capturas e imagens (OCR):** Clique no ícone de captura da barra de status e arraste para selecionar uma área da tela. O reconhecimento começa ao soltar o botão do mouse. Um menu compacto permite copiar, inserir ou editar o resultado. Escolha **Silk Math → Recognize image…** (reconhecer imagem) para colar uma imagem ou selecionar um arquivo PNG / JPEG. Os modelos são baixados no primeiro uso e executados localmente; as imagens não são enviadas a servidores.
- **Atalhos de OCR:** `Ctrl+Alt+O` (Mac: `⌘⌥O`) abre o menu de reconhecimento, onde você pode colar uma imagem com `Ctrl+V` (Mac: `⌘V`). No editor, `Ctrl+Alt+V` (Mac: `⌘⌥V`) reconhece diretamente a imagem da área de transferência. Com `silkMath.ocr.pasteImages`, ativado por padrão, colar uma imagem normalmente nos editores LaTeX e Markdown também inicia o OCR. Se o editor não oferecer a API para colar imagens, use o menu de reconhecimento ou o atalho da área de transferência.
- **Precisão do OCR:** As margens vazias são recortadas e o fundo é uniformizado; resultados duvidosos passam por mais uma tentativa de reconhecimento. A estrutura das tabelas é preservada, mas o resultado pode ser sinalizado para revisão. Tabelas complexas, escrita à mão e imagens desfocadas ainda precisam ser conferidas. [Processo de reconhecimento e limitações (em chinês)](docs/OCR_ACCURACY.md).
- **Versão de teste:** Acrescente `Shift` aos atalhos `Ctrl+Alt+M/O/V` (Mac: `⌘⌥M/O/V`). Essa versão usa configurações independentes em `silkMathTest.*`. O reconhecimento automático ao colar imagens vem desativado e pode ser ativado com `silkMathTest.ocr.pasteImages`.


<p align="center"><a href="#languages">Idiomas</a></p>

<h2 id="russian">Русский</h2>

Расширение для Visual Studio Code, которое показывает формулы LaTeX по мере ввода. Откройте файл `.tex`, Markdown, MDX или Quarto либо блокнот Jupyter (`.ipynb`) и установите курсор внутри формулы. Рядом появится всплывающий предпросмотр MathJax, а тонкая оранжевая линия укажет текущую позицию ввода. Запускать latexmk, создавать PDF или компилировать документ не нужно.

Поддерживаются формулы внутри строки с `$...$` и `\(...\)`, формулы на отдельной строке с `\[...\]`, окружения `equation`, `align` и `tabular`, а также таблицы GitHub Flavored Markdown. Неопределённые команды выделяются красным; остальная часть формулы продолжает отображаться.

Объявления пакетов и локальные зависимости определяются автоматически, включая распространённые пользовательские макросы из `.sty` / `.cls` и несохранённые изменения в открытых файлах зависимостей. Команды для чисел и единиц измерения, например `\num`, `\SI` и `\qty`, а также пользовательские макросы, доступные в текстовом режиме, работают и в ячейках таблиц. [Поддержка макросов и ограничения (на китайском)](docs/MACRO_SUPPORT.md).

Найдите <strong>Silk Math Preview</strong> в разделе расширений или откройте <a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">страницу Visual Studio Marketplace</a>. Требуется VS Code 1.95 или новее под Windows, macOS или Linux.

- **Включение и выключение предпросмотра:** `Ctrl+Alt+M` (Mac: `⌘⌥M`). Клавиша `Esc` закрывает текущий предпросмотр.
- **Настройки:** Нажмите <strong>Silk Math</strong> в строке состояния, чтобы изменить размер предпросмотра и выбрать типы файлов. Параметр **Другие типы файлов** по умолчанию выключен; включите его для распознавания формул LaTeX в обычном тексте, в том числе в файлах без имени.
- **CSS предпросмотра:** Выберите **Silk Math → Изменить CSS предпросмотра…**. Отредактируйте CSS в обычной вкладке редактора и сохраните, чтобы применить изменения. Очистите содержимое и сохраните, чтобы вернуть настройки по умолчанию. Выберите курсор, выделение или всю формулу в качестве точки привязки и разместите предпросмотр сверху, снизу или справа. Можно задать отступ в строках или пикселях, размер шрифта, смещение, максимальный размер, фон, рамку, тень и допустимость перекрытия формулы в исходном тексте. Доступны автодополнение, подсказки при наведении и расширенные примеры. Если видимую область редактора удаётся определить, изображение вписывается в неё с сохранением пропорций. При некоторых вариантах расположения редакторов точное определение границ недоступно. По умолчанию внутренние отступы составляют `4px 8px`, радиус углов — `6px`; в редакторе CSS есть пояснения и примеры на китайском и английском для всех параметров. [Примеры CSS и ограничения позиционирования (на китайском)](docs/PREVIEW_CSS.md).
- **TikZ / pgfplots:** Включите **Предпросмотр TikZ / pgfplots** (`silkMath.tikz.enabled`, по умолчанию выключен) и установите курсор в окружении `tikzpicture`. SVG обновляется при редактировании, даже до сохранения файла. При первом использовании загружается движок WebAssembly с проверкой целостности; затем он работает без сети и без установки LaTeX. В комплект входят pgfplots 1.18.3 и поддержка `compat=1.18`, групповых графиков, библиотек построения графиков и определений макросов TeX. Сложные рисунки могут обрабатываться дольше; возможности не равнозначны полному дистрибутиву TeX. [Руководство по TikZ и примеры (на китайском и английском)](docs/TIKZ.md).
- **Распознавание снимков экрана и изображений (OCR):** Нажмите значок захвата в строке состояния и выделите область экрана мышью. Распознавание начнётся, когда вы отпустите кнопку. В компактном меню можно скопировать, вставить или отредактировать результат. Через **Silk Math → Recognize image…** (распознать изображение) можно вставить изображение или выбрать файл PNG / JPEG. Модели загружаются при первом использовании и работают локально; изображения не отправляются на сервер.
- **Сочетания клавиш OCR:** `Ctrl+Alt+O` (Mac: `⌘⌥O`) открывает меню распознавания, где `Ctrl+V` (Mac: `⌘V`) вставляет изображение. В редакторе `Ctrl+Alt+V` (Mac: `⌘⌥V`) сразу запускает распознавание изображения из буфера обмена. Параметр `silkMath.ocr.pasteImages` включён по умолчанию: обычная вставка изображения в редакторах LaTeX и Markdown тоже запускает OCR. Если редактор не поддерживает API вставки изображений, используйте меню распознавания или сочетание клавиш для буфера обмена.
- **Точность OCR:** Пустые поля по краям обрезаются, фон приводится к единому виду. При сомнительном результате выполняется одна повторная попытка распознавания. Структура таблиц сохраняется, но результат может быть помечен для проверки. Сложные таблицы, рукописный текст и размытые изображения по-прежнему нужно проверять. [Процесс распознавания и ограничения (на китайском)](docs/OCR_ACCURACY.md).
- **Тестовая версия:** Добавьте `Shift` к сочетаниям `Ctrl+Alt+M/O/V` (Mac: `⌘⌥M/O/V`). Тестовая версия использует отдельные настройки `silkMathTest.*`. Автоматическое распознавание при вставке изображений по умолчанию выключено; его можно включить через `silkMathTest.ocr.pasteImages`.


<p align="center"><a href="#languages">Языки</a></p>

<h2 id="italian">Italiano</h2>

Un’estensione per Visual Studio Code che mostra le formule LaTeX mentre scrivi. Apri un file `.tex`, Markdown, MDX o Quarto, oppure un notebook Jupyter (`.ipynb`), e posiziona il cursore all’interno di una formula. Accanto compare un’anteprima fluttuante di MathJax, con una sottile linea arancione che indica il punto di inserimento. Non serve eseguire latexmk, generare un PDF o compilare il documento.

Supporta le formule nel testo con `$...$` e `\(...\)`, le formule su una riga separata con `\[...\]`, ambienti come `equation`, `align` e `tabular`, e le tabelle GitHub Flavored Markdown. I comandi non definiti appaiono in rosso, mentre il resto della formula continua a essere visualizzato.

Le dichiarazioni dei pacchetti e le dipendenze locali vengono rilevate automaticamente, comprese le macro personalizzate più comuni nei file `.sty` / `.cls` e le modifiche non salvate nei file di dipendenze aperti. I comandi per numeri e unità, come `\num`, `\SI` e `\qty`, e le macro personalizzate utilizzabili in modalità testo funzionano anche nelle celle delle tabelle. [Macro supportate e limitazioni (in cinese)](docs/MACRO_SUPPORT.md).

Cerca <strong>Silk Math Preview</strong> nella vista Estensioni o visita la <a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">pagina di Visual Studio Marketplace</a>. Richiede VS Code 1.95 o successivo su Windows, macOS o Linux.

- **Attivare o disattivare l’anteprima:** `Ctrl+Alt+M` (Mac: `⌘⌥M`). Premi `Esc` per chiudere l’anteprima attuale.
- **Impostazioni:** Fai clic su <strong>Silk Math</strong> nella barra di stato per regolare la dimensione dell’anteprima e scegliere i tipi di file abilitati. **Altri tipi di file** è disattivato per impostazione predefinita; attivalo per riconoscere le formule LaTeX anche nel testo semplice, inclusi i file senza nome.
- **CSS dell’anteprima:** Scegli **Silk Math → Modifica CSS anteprima…**. Modifica il CSS in una normale scheda dell’editor e salva per applicare le modifiche. Svuota il contenuto e salva per ripristinare i valori predefiniti. Usa il cursore, la selezione o l’intera formula come riferimento e posiziona l’anteprima sopra, sotto o a destra. Regola la distanza in righe o pixel, la dimensione del carattere, lo spostamento, le dimensioni massime, lo sfondo, il bordo e l’ombra, e controlla la sovrapposizione alla formula nel sorgente. Sono disponibili completamento automatico, suggerimenti al passaggio del mouse ed esempi avanzati. Quando è possibile determinare l’area visibile dell’editor, le immagini si adattano al riquadro mantenendo le proporzioni. In alcune disposizioni non è possibile individuare i limiti con precisione. La spaziatura interna predefinita è `4px 8px`, con angoli di raggio `6px`; l’editor CSS include istruzioni in cinese e inglese per tutte le opzioni. [Esempi CSS e limiti di posizionamento (in cinese)](docs/PREVIEW_CSS.md).
- **TikZ / pgfplots:** Attiva **Anteprima TikZ / pgfplots** (`silkMath.tikz.enabled`, disattivata per impostazione predefinita), poi posiziona il cursore in un ambiente `tikzpicture`. Le modifiche aggiornano l’SVG anche prima di salvare. Al primo utilizzo viene scaricato un motore di rendering WebAssembly di cui viene verificata l’integrità; in seguito funziona offline, senza installare LaTeX. Include pgfplots 1.18.3, `compat=1.18`, grafici raggruppati, librerie grafiche e definizioni di macro native. Le figure complesse possono richiedere più tempo; le funzionalità non equivalgono a quelle di una distribuzione TeX completa. [Guida a TikZ ed esempi (in cinese e inglese)](docs/TIKZ.md).
- **Riconoscimento di schermate e immagini (OCR):** Fai clic sull’icona di cattura nella barra di stato e trascina per selezionare un’area dello schermo. Il riconoscimento inizia quando rilasci il pulsante del mouse. Un menu compatto permette di copiare, inserire o modificare il risultato. Scegli **Silk Math → Recognize image…** (riconosci immagine) per incollare un’immagine o selezionare un file PNG / JPEG. I modelli vengono scaricati al primo utilizzo ed eseguiti localmente; le immagini non vengono caricate su server.
- **Scorciatoie OCR:** `Ctrl+Alt+O` (Mac: `⌘⌥O`) apre il menu di riconoscimento, dove puoi incollare un’immagine con `Ctrl+V` (Mac: `⌘V`). Nell’editor, `Ctrl+Alt+V` (Mac: `⌘⌥V`) riconosce direttamente l’immagine negli appunti. Con `silkMath.ocr.pasteImages`, attivo per impostazione predefinita, anche il normale incollaggio di un’immagine negli editor LaTeX e Markdown avvia l’OCR. Se l’editor non dispone dell’API per incollare immagini, usa il menu di riconoscimento o la scorciatoia per gli appunti.
- **Accuratezza dell’OCR:** I margini vuoti vengono ritagliati e lo sfondo uniformato; in caso di risultati dubbi viene eseguito un secondo tentativo di riconoscimento. La struttura delle tabelle viene preservata, ma il risultato può essere segnalato per una verifica. Tabelle complesse, scrittura a mano e immagini sfocate richiedono comunque un controllo. [Processo di riconoscimento e limitazioni (in cinese)](docs/OCR_ACCURACY.md).
- **Versione di test:** Aggiungi `Shift` (Maiusc) alle scorciatoie `Ctrl+Alt+M/O/V` (Mac: `⌘⌥M/O/V`). Questa versione usa impostazioni separate sotto `silkMathTest.*`. Il riconoscimento automatico quando incolli un’immagine è disattivato per impostazione predefinita e può essere attivato con `silkMathTest.ocr.pasteImages`.


<p align="center"><a href="#languages">Lingue</a></p>

MIT License · [Jasper Zhou](https://zhoujasper.github.io) · [GitHub](https://github.com/zhoujasper/silk-math-preview) · [LICENSE](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md)
