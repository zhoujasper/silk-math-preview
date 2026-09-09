# 更新日志 / Changelog

## 0.2.8 - 2026-09-09

### 中文

- 修复首次点击公式外的正文或预览覆盖的空白行时，旧预览仍然停留的问题。移除按浮层占用行保留预览的旧逻辑；现在光标和选区都离开公式后，同一选择事件立即清除图片和锚点，无需再次点击、移动或编辑。
- 清理时取消排队的刷新、延迟错误提示和定义刷新，旧渲染结果不能重新显示。切换到另一条公式时先移除旧帧；重新进入公式仍可正常预览，选区仍覆盖公式时保留预览，后台分屏的选区事件不会误清当前预览。
- 增加鼠标、键盘、命令和未标注来源的选区事件、同一行正文、下方空白、完整选区、重新进入、公式切换、后台编辑器、Math/TikZ 延迟结果及排队刷新回归。

### English

- Fix previews remaining visible after the first click on text outside a formula or a blank line beneath the overlay. Remove the old rule that retained previews based on covered source lines. Once both the caret and selection leave the formula, the same selection event clears the image and anchors immediately, without another click, movement or edit.
- Cancel queued refreshes, delayed errors and definition refreshes during cleanup so stale rendering cannot restore the preview. Clear the old frame when switching formulas; re-entry still works, selections covering the formula keep the preview, and selection events from inactive split editors do not clear the current preview.
- Add regressions for mouse, keyboard, command and unspecified selection events, same-line text, blank lines, full selections, re-entry, formula switching, inactive editors, delayed Math/TikZ results and queued refreshes.

## 0.2.7 - 2026-09-09

### 中文

- 公式预览默认增加上下 4px、左右 8px 的内边距，圆角从 8px 调整为 6px。内边距和边框计入外框尺寸，空间足够时不挤小公式；保留编辑器边界限位和等比例缩放。CSS 的 `padding`、`border-radius` 可覆盖默认值。
- CSS 编辑页为全部参数提供逐项中英文说明、默认值、单位、取值范围及常用定位示例；模板、补全与悬停共用同一份说明。旧 CSS 可点击“参数说明与示例”补充帮助，保留原有声明，新增示例均为注释；超出文件长度限制时提示且不改动内容。
- 增加默认和自定义内边距、四边写法、边框、高对比主题、双语模板及旧设置兼容回归；通过本机无头布局测试确认字号、圆角、边界和正式/测试通道配置生效。未打开浏览器窗口或 Extension Host，实机视觉仍由用户验收。

### English

- Give formula previews 4px vertical and 8px horizontal padding by default, and reduce the corner radius from 8px to 6px. Padding and borders add to the outer box instead of shrinking the formula when space permits; editor bounds and proportional fitting still apply. CSS `padding` and `border-radius` override the defaults.
- Add Chinese/English explanations, defaults, units, value ranges and positioning recipes for every CSS option. The template, completion and hover share the same help. For existing CSS, “Guide & examples” inserts help while preserving declarations and keeping new examples commented out; exceeding the file length limit shows a message without changing the content.
- Add regressions for default/custom padding, shorthand forms, borders, high contrast, bilingual templates and existing settings. Local headless layout checks verify font size, corners, bounds and release/test channel configuration. No browser window or Extension Host is opened; final visual acceptance remains with the user.

## 0.2.6 - 2026-09-09

### 中文

- 预览 CSS 增加光标行、选区或整块公式定位，上方/下方/右侧方向、按行或像素设置间隔、字号与防覆盖选项。偏移仍受编辑器边界约束；禁止覆盖时保持在整块源码公式之外，可用空间不足时缩小。软换行下的右侧防覆盖采用下方回退。
- 原生 CSS 编辑页增加参数和值补全、悬停说明及「高级参数示例」入口；已保存的 CSS 不会自动改写，示例由用户点选插入，保存生效，清空恢复默认。字号直接缩放矢量图片，CSS 和光标定位更新复用渲染结果。
- 将图片浮层移到编辑器覆盖层，使浏览器能同时引用真实视口和跨行源码边界，修复行内定位下部分锚点失效的问题。正式/测试通道使用独立覆盖层和源码锚点，保持分屏、滚动、缩放和资源回收。
- 增加全部参数的解析、保存、补全及控制器回归，并用本机 Chrome 无头模式验证实际布局、字号、偏移、外观、防覆盖和边界。不打开浏览器窗口或 Extension Host，不宣称已在 Windows/Linux 或所有 VS Code 版本实测。

### English

- Add CSS anchors for the caret line, selection or whole formula, above/below/right placement, line or pixel gaps, font sizing and overlap control. Offsets remain bounded by the editor; disabling overlap keeps the preview outside the entire source formula and shrinks it when space is limited. Right-side placement without overlap falls back below when word wrapping is enabled.
- Add property/value completion, hover help and an “Advanced options” example action to the native CSS editor. Saved CSS is not rewritten automatically; examples are inserted on request, saving applies changes and clearing resets defaults. Font size scales the vector image, while CSS and caret positioning updates reuse rendered results.
- Move the image overlay to the editor overlay layer so the browser can reference both the real viewport and source bounds across lines, fixing unavailable anchors in inline positioning. Release/test channels use separate overlays and source anchors, with split, scroll, zoom and cleanup handling.
- Add parser, save, completion and controller regressions for all options, plus local headless Chrome checks of actual geometry, font scaling, offsets, appearance, overlap prevention and bounds. No browser window or Extension Host is opened; this does not claim testing on Windows/Linux or every VS Code version.

## 0.2.5 - 2026-09-09

### 中文

- 优化本地公式 OCR：在原分辨率定位全部笔画、去除截图留白、统一纸色/深色背景并按需增强低对比度，再等比例送入模型；保留右侧条件、细笔画、标点和上下标，减少空表格及字符误识别。
- 增加公式花括号/环境、孤立横线、表格列数与可见格线校验；异常结构或低置信度最多调整输入再识别一次。正常结果只推理一次，空白图不加载模型，未正常结束的输出不再标为成功。
- 单行图片中的多余空数组仅在严格条件下提取有效公式；矩阵、分段、对齐、带框表格和复杂列声明保留。重试后仍不可信的结果提示复核，智能模式保留真实表格的整表结果。
- 整理数学 token 多余空白，保留控制词边界、显式间距和文字参数。继续使用现有离线模型包，无需重新下载；模型识别仍可能遗漏或误读字符，复杂表格、字体样式和手写内容仍需人工核对。

### English

- Improve local formula OCR by locating all strokes at the original resolution, trimming screenshot margins, normalizing paper and dark backgrounds, and enhancing low contrast when needed before proportional model input. Preserve right-hand conditions, thin strokes, punctuation and scripts while reducing empty-table hallucinations and character errors.
- Validate braces/environments, stray table rules, column counts and visible grid lines. Retry suspicious or low-confidence results once with adjusted input. Normal results use one inference, blank images skip model loading, and unfinished output is no longer marked successful.
- Extract meaningful formulas from redundant empty arrays only under strict single-line image checks. Preserve matrices, cases, aligned equations, ruled tables and complex column declarations. Flag unresolved results for review, and retain whole real tables in automatic mode.
- Remove redundant mathematical token whitespace while preserving command boundaries, explicit spacing and text arguments. Reuse the existing offline model pack without another download. Recognition can still omit or misread characters; complex tables, font styles and handwriting require manual review.

## 0.2.4 - 2026-09-09

### 中文

- 修复预览视口锚点不可用时，按短结束行的文字宽度缩小图片、导致公式几乎不可见的问题。现在按已知图片尺寸和上方/下方落点回退，覆盖开启「其他文件类型」后在未保存纯文本文件中预览 `\[...\]` 数组的场景。

### English

- Fix formulas becoming almost invisible when an unavailable preview viewport anchor caused the image to shrink to the text width of a short closing line. Fall back to the known image dimensions and above/below placement, including `\[...\]` arrays in unsaved plain-text files with “Other file types” enabled.

## 0.2.3 - 2026-09-09

### 中文

- 状态栏菜单在点击外部、焦点移走时自动关闭；菜单内的缩放和开关操作仍保持打开并即时刷新。正式版与测试版行为一致。

### English

- Close the status menu when clicking outside moves focus away. Zoom and toggle actions inside the menu keep it open and refresh immediately. The release and test channels behave consistently.

## 0.2.2 - 2026-09-09

### 中文

- 状态栏菜单新增「编辑预览 CSS…」，用原生 CSS 标签编辑偏移、最大尺寸和外观，保存到用户设置后生效；清空保存恢复默认。正式/测试通道隔离，不向项目创建文件。
- 修复分屏时浮层按固定 120 列估宽导致的右侧裁切：按当前 Monaco 内容视口的真实边缘限位，宽图等比例适应；分屏拖动、水平滚动由 CSS 布局更新。CSS 偏移同样遵守边界。
- 修复仅改变可见高度时旧 decoration 签名漏判；只改 CSS 复用当前 SVG，不重复请求 Worker。
- CSS 只作用于预览框，禁止外部选择器、资源加载及绕过限位的属性；原生编辑页保存失败时保留原设置。CSS 编辑模块按需加载。
- 最低 VS Code 版本调整为 1.95（Chromium 128），以支持 CSS 锚点定位。保持原有上方/下方偏好，本次未增加固定在左上方的定位模式。

### English

- Add “Edit Preview CSS…” to the status menu. Edit offsets, size limits and appearance in a native CSS tab; saving applies the changes to user settings, and saving an empty file restores defaults. Release and test channels remain isolated, with no files created in the project.
- Fix right-side clipping in split editors caused by estimating overlay width from a fixed 120 columns. Constrain the preview to the actual edges of the current Monaco content viewport and scale wide images proportionally. CSS layout responds to split resizing and horizontal scrolling, and custom offsets respect the same boundaries.
- Fix decoration signatures missing changes that affect only visible height. CSS-only changes reuse the current SVG without requesting another worker render.
- Scope CSS to the preview box, disallowing external selectors, resource loading and properties that bypass size/position limits. Preserve the previous settings if saving the native editor fails. Load the CSS editor module on demand.
- Raise the minimum VS Code version to 1.95 (Chromium 128) for CSS anchor positioning. Preserve the existing above/below preference; this release does not add a mode fixed at the upper left.

## 0.2.1 - 2026-09-07

### 中文

- 修复 TikZ 预览拒绝 `compat=1.18`：附带 pgfplots 1.18.3 完整宏源码，升级后自动覆盖旧运行时宏包；保留显式兼容设置和现有 WASM 缓存。
- 补全分组图、填充、统计图、日期等绘图库，并修复库加载位置、宏包选项冲突、旧式样式、自定义函数和内存数据表声明。
- 修复 SVG 渐变变黑及纹理丢失；保留绘图样式、定义和符号，检测缺字、缺失图形引用及未支持的驱动功能，避免错误图片被当作成功预览。
- 修复曲线交点递归参数栈溢出、密集曲面 SVG 嵌套过深；保留交点精度、绘图顺序、颜色与组透明度。
- 宏包与定义分开建立检查点并共享内存页，外部宏编辑复用宏包；重复文字复用精确轮廓，减少 SVG 大小与传输占用。
- 增加常见绘图库、复杂连续编辑、请求合并、内存与空闲测试。默认开关仍关闭，保持超时回收和空闲释放。

### English

- Fix TikZ previews rejecting `compat=1.18`: bundle the complete pgfplots 1.18.3 macro sources and automatically override the older runtime package after upgrading, while preserving explicit compatibility settings and the existing WASM cache.
- Add grouped plots, fills, statistics, dates and other plotting libraries; fix library loading order, package option conflicts, legacy styles, custom functions and in-memory data table declarations.
- Fix black SVG gradients and missing patterns. Preserve drawing styles, definitions and symbols, and detect missing glyphs, unresolved graphic references and unsupported driver features instead of treating incorrect images as successful previews.
- Fix recursive parameter stack overflows in curve intersections and excessive SVG nesting in dense surfaces, preserving intersection precision, drawing order, colors and group opacity.
- Create separate package and definition checkpoints with shared memory pages, allowing external macro edits to reuse loaded packages. Reuse exact outlines for repeated text to reduce SVG size and transfer overhead.
- Add tests for common drawing libraries, sustained editing of complex diagrams, request coalescing, memory and idle behavior. TikZ remains disabled by default, with timeout cleanup and idle release.

## 0.2.0 - 2026-09-07

### 中文

- 版本统一为 0.2.0，包含此前完成的 TikZ / pgfplots 实时渲染、原生宏定义支持及底层性能优化；TikZ 开关仍默认关闭。
- 正式版与测试版同步使用 0.2.0，继续使用独立的扩展 ID、命令和设置。

### English

- Unify the version at 0.2.0, including the previously completed TikZ / pgfplots live rendering, native macro definitions and underlying performance improvements. TikZ remains disabled by default.
- Both release and test channels now use 0.2.0, retaining separate extension IDs, commands and settings.

## 0.1.81 - 2026-09-07

### 中文

- TikZ 继承原生 `def/gdef/edef/xdef/let`、定界参数、重定义和作用域；本地及未保存依赖按顺序展开，不再使用普通公式转换后的定义。修复数学分隔符中图形前的定义丢失。
- 新增完整 TeX 检查点：复用宏包和定义，恢复 WASM 全局/稀疏内存/文件状态；使用同步内存 I/O 和单份 WASM 内存。图形内的全局定义不会污染下一帧。
- 输入合并降为 80 ms；语法错误保留干净检查点，Esc/关闭/空闲/超时释放 Worker。原生上下文按需加载、图形内编辑不重新提取文档前缀，字体缓存有界。
- 图形、文本标签及尺寸与优化前进行 SVG 一致性对比；补充真实 TeX 定义、错误恢复、超时恢复、内存和 CPU 验证。默认开关继续关闭。

### English

- TikZ inherits native `def/gdef/edef/xdef/let`, delimited parameters, redefinitions and scope. Local and unsaved dependencies expand in source order, without using definitions transformed for ordinary math. Fix lost definitions preceding a picture inside math delimiters.
- Add complete TeX checkpoints: reuse packages and definitions, restore WASM globals, sparse memory and file state, and use synchronous in-memory I/O with a single WASM memory allocation. Global definitions inside a picture do not leak into the next frame.
- Reduce input coalescing to 80 ms. Preserve clean checkpoints after syntax errors and release workers on Esc, close, idle or timeout. Load native context on demand, skip document-prefix extraction when editing within a picture, and bound the font cache.
- Compare SVG output for diagrams, text labels and dimensions against the previous implementation. Add real TeX definition, error recovery, timeout recovery, memory and CPU checks. TikZ remains disabled by default.

## 0.1.80 - 2026-09-07

### 中文

- 数字支持按小数位/有效数字/不确定度舍入、补零、进位和半偶舍入；支持分离不确定度及符号单位的分式、负指数排版。S 列按实际字形宽度对齐小数点。
- 章节通过 `% !TeX root = ../main.tex` 继承主文件导言区；没有指令时可匹配唯一已打开主文件，不扫描整个工作区。
- 普通公式输入只读取编辑点前 128 字符，声明之后的输入复用语义快照。依赖过滤由双重遍历改为线性扫描，连续宏成批索引，定义只序列化一次。
- 单位按需解析并使用有界缓存，移除每个单位重复注入上百条定义。每帧释放 MathJax 解析树/表格布局引用，文件解析、快照和路径缓存增加数量/估算大小上限；超大文件先检查大小，失效的异步遍历及时停止。

### English

- Support rounding by decimal places, significant figures or uncertainty, zero padding, carry propagation and half-even rounding. Add separate uncertainties and fractional or negative-exponent unit notation. Align decimal points in S columns using actual glyph widths.
- Chapters inherit the main-file preamble through `% !TeX root = ../main.tex`. Without a directive, use a unique matching open main file without scanning the whole workspace.
- Ordinary formula edits read only the 128 characters before the edit point; edits after declarations reuse the semantic snapshot. Replace nested dependency filtering with a linear scan, index consecutive macros in batches, and serialize definitions once.
- Parse units on demand with bounded caching, removing repeated injection of hundreds of definitions per unit. Release MathJax parse-tree and table-layout references after each frame. Limit file parsing, snapshots and path caches by count and estimated size, check oversized files before reading, and stop invalidated asynchronous traversals promptly.

## 0.1.79 — TikZ / pgfplots live images

### 中文

- 在现有状态栏菜单和设置中新增默认关闭的 TikZ / pgfplots 开关；编辑 LaTeX、Markdown 和 notebook 单元格时，可预览整幅图形。
- 通过可选的本地 WASM Worker 运行真实 TeX，遇到 `axis` / `addplot` 自动加载 pgfplots。固定版本的运行时组件经过完整性校验，首次下载后即可离线渲染。
- 未完成的编辑保留上一张成功图形；合并连续输入、丢弃过期帧、将标签转换为字形轮廓，并释放空闲或超时的 Worker。普通公式继续使用现有的快速渲染器。

### English

- Add an off-by-default TikZ / pgfplots toggle to the existing status menu and settings. Preview entire pictures while editing LaTeX, Markdown and notebook cells.
- Render real TeX in an optional local WASM worker; load pgfplots automatically for `axis` / `addplot`. Download pinned, integrity-checked runtime packages once, then render offline.
- Keep the last successful picture during incomplete edits; coalesce typing, discard stale frames, outline labels, and release idle or timed-out workers. Ordinary math keeps its existing fast renderer.

## 0.1.78 - 2026-09-07

### 中文

- 修复表格文本单元格原样显示 `\num` 和自定义宏的问题；文本样式、嵌套宏及 `\ensuremath` 可正常展开。
- 增加常见 siunitx 数字、单位、列表、范围、角度及 `\sisetup`、`\DeclareSIUnit` 的轻量预览；保留长整数、尾零和科学计数法。
- 自动分析依赖的宏包并启用内置兼容模块；补充 `\gdef`、`\DeclareRobustCommand` 和 `\DeclarePairedDelimiter`；修复已打开同名文件误选与数字参数光标破坏格式。

### English

- Fix table text cells displaying `\num` and custom macros literally; text styling, nested macros and `\ensuremath` now expand correctly.
- Add lightweight previews for common siunitx numbers, units, lists, ranges and angles, plus `\sisetup` and `\DeclareSIUnit`, preserving long integers, trailing zeros and scientific notation.
- Detect package dependencies automatically and enable built-in compatibility modules. Add `\gdef`, `\DeclareRobustCommand` and `\DeclarePairedDelimiter`; fix selection of the wrong open file with the same name and caret markers disrupting numeric arguments.

## 0.1.77 - 2026-09-07

### 中文

- 截图入口改为系统直接框选，松开后后台自动识别；移除整屏二次裁切的大 Webview。
- 用原生小菜单复制、插入、编辑和切换识别类型；增加图片粘贴、PNG/JPEG 文件选择及图片 Ctrl+V / ⌘V。
- OCR 独立 Worker 固定单线程 WASM，所有模型会话串行创建，避免 WebGPU/WASM 交叉初始化报错。取消、错误、超时后重建上下文，空闲释放模型。
- PNG/JPEG 解码使用纯 JavaScript，平滑缩放保留细笔画；截图临时文件随流程清理。

### English

- Capture a region directly with the operating system and start background recognition on release. Remove the large webview that required cropping a full-screen capture again.
- Use a compact native menu to copy, insert, edit and switch recognition modes. Add image pasting, PNG/JPEG file selection and image Ctrl+V / ⌘V support.
- Run OCR in a separate worker using single-threaded WASM and create all model sessions serially to avoid conflicting WebGPU/WASM initialization. Recreate the context after cancellation, errors or timeouts, and release models when idle.
- Decode PNG/JPEG in pure JavaScript, preserve thin strokes with smooth resizing, and clean up temporary screenshots as the workflow completes.

## 0.1.76 - 2026-08-23

### 中文

- 当前文件里新写的 `\newcommand` / `\renewcommand` / `\def`，以及工作区里的
  `.sty/.cls`（包括还没保存的缓冲区），后面的公式预览能用上这些宏。
- 大 `.sty/.cls` 只失效改过的那一份，不再每次打字清空全部解析缓存。公式正文
  打字不会因为上方已经写完的 `\newcommand` 而整篇重解析。

### English

- Formulas can use newly written `\newcommand` / `\renewcommand` / `\def` definitions from the current file and workspace `.sty/.cls` files, including unsaved buffers.
- Invalidate only the changed large `.sty/.cls` file instead of clearing every parse cache on each keystroke. Typing in a formula no longer reparses the entire document because of an already completed `\newcommand` above it.

## 0.1.75 - 2026-08-22

### 中文

- 商店介绍和关键词按真实搜索习惯补全：LaTeX / MathJax / Jupyter / Markdown /
  equation / OCR 等，分类改成 Visualization · Notebooks · Education。名字仍是
  Silk Math Preview。README 各语言段写明 Marketplace 安装入口。

### English

- Expand the Marketplace description and keywords to match common searches, including LaTeX, MathJax, Jupyter, Markdown, equation and OCR. Change categories to Visualization · Notebooks · Education while retaining the name Silk Math Preview. Add the Marketplace installation link to each README language section.

## 0.1.74 - 2026-08-22

### 中文

- 介绍页和界面跟上常见语言：英文、简体中文、繁體中文、日本語、한국어、Deutsch、
  Français、Español、Português、Русский、Italiano。商店仍只有一份 README.md，
  页内锚点切换。状态栏菜单、卡片和 OCR 按 VS Code 显示语言选文案，对不上的用英文。

### English

- Localize the product page and interface in English, Simplified Chinese, Traditional Chinese, Japanese, Korean, German, French, Spanish, Portuguese, Russian and Italian. Keep a single README.md with language anchors for the Marketplace. Status menus, cards and OCR follow the VS Code display language, falling back to English.

## 0.1.73 - 2026-08-22

### 中文

- 表格 `\multicolumn` / `\multirow`（以及 multirowcell/multirowhead）按跨度把内容
  移到合并区域中心，不再只占第一格。嵌套的「先跨列再跨行」会合成一次 span。

### English

- Center `\multicolumn` / `\multirow` content, including multirowcell/multirowhead, across the merged table area instead of leaving it in the first cell. Combine nested column-then-row merges into one span.

## 0.1.72 - 2026-08-22

### 中文

- 打包分成正式版和测试版：`silk-math-preview-<ver>.vsix` 发 Marketplace；
  `silk-math-preview-test-<ver>.vsix` 本机试装，扩展 ID / 命令 / 设置都和正式版分开，
  不会覆盖商店里已装的那份。测试包状态栏是 Silk Math Test，快捷键 Ctrl+Alt+Shift+M。

### English

- Split packaging into release and test channels: `silk-math-preview-<ver>.vsix` for the Marketplace and `silk-math-preview-test-<ver>.vsix` for local testing. Separate extension IDs, commands and settings prevent the test package from overwriting the Marketplace installation. The test status label is Silk Math Test, with shortcut Ctrl+Alt+Shift+M.

## 0.1.71 - 2026-08-22

### 中文

- 表格双横线按 MathJax inner y 向上配对：表首是 max y（`scale(1,-1)` 之后才是
  视口上方 / A 行一侧），表尾是 min y。测试在根坐标里量，不再用属性 y 的 Math.min。

### English

- Match double table rules using MathJax's upward inner y-axis: the table top is max y, becoming the top of the viewport beside row A after `scale(1,-1)`; the bottom is min y. Measure tests in root coordinates instead of applying Math.min to raw y attributes.

## 0.1.70 - 2026-08-22

### 中文

- 表首只有 `\hline\hline`、下面行没有横线时，预览画出两根填充的 `data-line=h`
  横线（框线不算）。TeX 表首对应 MathJax inner 的 max y，翻成 SVG 后是 min-y。

### English

- When only the table top has `\hline\hline` and the rows below have no horizontal rules, draw two filled `data-line=h` rules, excluding the frame. The TeX table top is MathJax's inner max y and becomes SVG min-y after flipping.

## 0.1.69 - 2026-08-22

### 中文

- 只有一侧 `\hline\hline`、其余行没有横线时，双线画在那条边界上。不再把含 0
  的计数和 SVG 槽位 1:1 对齐（对不上会整表跳过，或把线画到错误的边）。

### English

- Draw double rules on the correct boundary when only one side has `\hline\hline` and other rows have no rules. Stop matching counts containing zeros to SVG slots one-to-one, which could skip the table or place rules on the wrong edge.

## 0.1.68 - 2026-08-22

### 中文

- 表格连续 `\hline\hline` 和列格式 `||` 预览成两根不重合的紧致线，间隙大约一根线宽，
  不再合成一条，也不再空出一整行。
- 鼠标点选以文档 offset 所在公式为准：点进当前公式立刻更新光标，点进另一条公式
  立刻切换；只有点在浮层盖住、且那里没有公式的行上（滚动条）才保持当前预览。
- 公式还没写完时只补渲染副本（补括号/环境、丢掉末尾半截命令），已经写出的部分
  继续显示；同区域渲染失败保留上一帧。源码绝不改写。

### English

- Render consecutive `\hline\hline` and `||` column rules as two compact, distinct lines with a gap of roughly one line width, without merging them or leaving a whole blank row.
- Resolve mouse clicks by the formula at the document offset: immediately update the caret in the current formula or switch to another formula. Keep the current preview only when clicking a covered line with no formula, such as its scrollbar.
- Repair only the rendering copy of unfinished formulas by completing brackets/environments or dropping an incomplete trailing command. Continue showing completed content and keep the previous frame if rendering fails in the same region. Never rewrite the source.

## 0.1.67 - 2026-08-21

### 中文

- 点 Silk Math 改回顶部 QuickPick 菜单。勾选留在菜单里立刻变，不再走
  状态栏 Markdown hover（内核 locked hover 没法当场改勾选）。Esc 关掉菜单。
- 作者 Jasper Zhou，主页 https://zhoujasper.github.io。`private: false`，
  便于发布到 VS Code Marketplace。
- GitHub Actions：推到 `main` 会测试、打包 VSIX；配置 `VSCE_PAT` 后自动发布
  到 Marketplace，并更新 GitHub Release。

### English

- Restore the top QuickPick menu when clicking Silk Math. Checkbox changes appear immediately while the menu stays open, avoiding status-bar Markdown hover cards whose locked state prevents in-place updates. Esc closes the menu.
- Set the author to Jasper Zhou, the homepage to https://zhoujasper.github.io, and `private: false` for VS Code Marketplace publication.
- GitHub Actions tests and packages VSIX files on pushes to `main`; configuring `VSCE_PAT` enables automatic Marketplace publishing and GitHub Release updates.

## 0.1.66 - 2026-08-21

### 中文

- Copilot 卡片能当场勾选：内核 tooltip 是活的 HTMLElement，command 是
  `statusBar.entry.showTooltip` 对象，点选改同一个 Toggle。扩展没有这个 API。
  Markdown hover 带 sticky/isLocked，改 tooltip 会拆掉旧浮层却画不出新的。
  现在先写入新 markdown 拆掉锁住的卡片，再写一次 revision 让 hover 真正重开。
  勾选用 ☑/☐，开/关在正文里就不一样。

### English

- Copilot cards can update checkboxes in place because their core tooltip is a live HTMLElement and their command is a `statusBar.entry.showTooltip` object that modifies the same Toggle. Extensions lack this API. Markdown hovers use sticky/isLocked state, so changing the tooltip can remove the old card without drawing a replacement. Write new Markdown to clear the locked card, then write another revision to reopen the hover. Use ☑/☐ so the body clearly shows each setting's state.

## 0.1.65 - 2026-08-21

### 中文

- 点选后会闪但勾选不变：`configuration.update()` 结束后 `get()` 经常还是旧值，
  重开的 hover 按旧快照画。现在先把开关写进内存乐观状态再画卡片，配置稍后
  落盘。关掉再开才看到变化的问题按这个修。

### English

- Fix checkbox clicks flashing the card without changing its state: `get()` can still return an old value after `configuration.update()` completes, causing reopened hovers to use a stale snapshot. Apply the new toggle value optimistically in memory before redrawing, then persist the configuration.

## 0.1.64 - 2026-08-21

### 中文

- 点了没闪：`isTrusted: { enabledCommands }` 让内核 opener 用
  `allowCommands.includes(uri.path)`，path 对不上就静默吞掉。改回布尔
  `isTrusted: true`。卡片用 markdown command 链接 + 前景色/次级按钮色，
  不要 HTML 表格，也不要 markdown 列表子弹。

### English

- Fix clicks being silently ignored when `isTrusted: { enabledCommands }` reaches the core opener's `allowCommands.includes(uri.path)` check with a mismatched path. Restore boolean `isTrusted: true`. Use Markdown command links with foreground and secondary-button colors instead of HTML tables or Markdown list bullets.

## 0.1.63 - 2026-08-21

### 中文

- 点悬浮窗没闪也没反应：HTML 表格里的 `command:` 不是 markdown link token，
  内核会拆掉 `<a>`。改成 Copilot Chat 同款 `[text](command:id)`，命令写进
  package.json，`isTrusted.enabledCommands` 明确放行。点选后状态栏会闪一下
  再弹回新卡片。

### English

- Fix unresponsive hover-card clicks: `command:` links in HTML tables are not Markdown link tokens, so the core removes their `<a>` elements. Use Copilot Chat-style `[text](command:id)` links, declare commands in package.json and allow them explicitly with `isTrusted.enabledCommands`. Clicking briefly flashes the status item before reopening the updated card.

## 0.1.62 - 2026-08-21

### 中文

- 点悬浮窗勾选后立刻清掉 locked hover（tooltip 置空），等内核把焦点交回
  Silk Math 条目，再写入新内容并两次 `showHover`。不再等关了再开才看到勾选变化。

### English

- Clear the locked hover immediately after a checkbox click by emptying its tooltip. Once focus returns to the Silk Math item, write the updated content and call `showHover` twice so checkbox changes appear without manually closing and reopening the card.

## 0.1.61 - 2026-08-21

### 中文

- 点 Silk Math 重新弹出状态栏正上方的 hover 卡片，不再打开右侧辅助栏。
  Copilot Chat 的悬浮窗是 VS Code 内核 hover；插件只往里面塞 Index/Sync。
  扩展公开做法：`workbench.action.showHover` + MarkdownString。

### English

- Clicking Silk Math again opens a hover card directly above the status item instead of the right auxiliary bar. Copilot Chat uses the core VS Code hover and only supplies Index/Sync content; extensions use the public `workbench.action.showHover` command with MarkdownString.

## 0.1.60 - 2026-08-21

### 中文

- Copilot 状态栏卡片是 VS Code 内核的 HTMLElement + `ShowTooltipCommand`，扩展没有
  这个 API。Markdown hover 点了不会原地刷新。现在点 Silk Math 打开自己画的设置
  卡片（右侧辅助栏 webview），勾选立刻变，也不会新开编辑器标签。Esc 关掉。

### English

- Copilot's status card uses a core HTMLElement with `ShowTooltipCommand`, an API unavailable to extensions; Markdown hover content does not refresh in place after clicks. Clicking Silk Math now opens a custom settings card in the right auxiliary-bar webview, with immediate checkbox updates and no new editor tab. Esc closes it.

## 0.1.59 - 2026-08-21

### 中文

- 推迟做成 Copilot 那种文字小按钮（次级按钮色、圆角），不再用 SVG 画字。
  加减号和重置只有文字，没有底和边。
- 点勾选后先拆掉锁住的 hover 再弹回新内容。卡片仍是状态栏浮层，不开新标签。

### English

- Style snooze controls as Copilot-like text buttons with secondary-button colors and rounded corners instead of drawing text in SVG. Plus, minus and reset controls use plain text without backgrounds or borders.
- Remove the locked hover after a checkbox click, then reopen it with updated content. The card remains a status-bar overlay without opening a new tab.

## 0.1.58 - 2026-08-21

### 中文

- 点 Silk Math 不再打开「Silk Math」编辑器标签。改回 Copilot 同款状态栏 hover
  小卡片，钉在右下角条目上方。
- 推迟按钮带细边框、浅底、小圆角。界面按 VS Code 语言：zh* 用中文，其余英文。

### English

- Clicking Silk Math no longer opens a Silk Math editor tab. Restore a Copilot-style status-bar hover card anchored above the bottom-right item.
- Give snooze buttons a thin border, subtle background and small corner radius. Use Chinese for VS Code languages matching zh* and English otherwise.

## 0.1.57 - 2026-08-21

### 中文

- Jupyter 里多行公式预览不再被格子裁掉下半截。单元格会裁溢出 decoration，
  下一格还会盖住。现在在公式行用隐形 after 把行盒撑高，预览仍在下方，
  整块留在当前格里。

### English

- Prevent multiline Jupyter formula previews from being clipped by their cells or covered by the next cell. An invisible after decoration increases the formula line box height, keeping the preview below the formula and entirely within the current cell.

## 0.1.56 - 2026-08-21

### 中文

- 点 Silk Math 打开我们自己画的设置卡片（webview），勾选立刻变，不用关了再开。
  Copilot 能实时刷新是因为它改内核 HTMLElement；Markdown hover 做不到。
- 勾选改成 Copilot 那种空心方框 + 前景色对勾，和文字垂直对齐，不再用蓝底。
- 右上角齿轮进设置；去掉「预览已启用」和底部设置。推迟是按钮 + 说明。
  底部按钮切换排除/取消排除当前文件。卡片 280px。

### English

- Clicking Silk Math opens a custom settings webview card with immediate checkbox updates. Copilot can update core HTMLElements directly; Markdown hovers cannot provide the same behavior.
- Use Copilot-like outline checkboxes with foreground-colored ticks, aligned vertically with the text and without a blue background.
- Put settings behind the top-right gear and remove the preview-enabled label and bottom settings entry. Show snooze as a button with an explanation. The bottom button toggles exclusion of the current file. Set the card width to 280px.

## 0.1.55 - 2026-08-21

### 中文

- 点勾选或缩放后卡片会关掉再立刻弹回来，显示新状态。上一版清空 tooltip
  会被随后的设置刷新合并掉，锁住的 hover 一直显示旧内容。
- 卡片略收窄到 360px。两个推迟并排。去掉顶部空段，底部多留一点。

### English

- Close and immediately reopen the card after checkbox or zoom changes to display the new state. Previously, clearing the tooltip was merged with the following settings refresh, leaving the locked hover showing old content.
- Narrow the card to 360px and place the two snooze options side by side. Remove the blank top section and add a little more bottom spacing.

## 0.1.54 - 2026-08-21

### 中文

- 状态栏卡片加宽到 400px。勾选改成自绘方框，推迟/缩放/设置改成主题次级按钮，
  文字不再被链成蓝色。点勾选后会关掉并立刻重开卡片，不用自己关了再开。

### English

- Widen the status card to 400px. Use custom outline checkboxes and themed secondary buttons for snooze, zoom and settings so their text is no longer blue link text. Close and immediately reopen the card after checkbox clicks to show the new state automatically.

## 0.1.53 - 2026-08-21

### 中文

- 状态栏卡片按 Copilot 布局：左侧勾选框可点，标签不再是蓝色链接。
  勾选、缩放、暂停后卡片内容立刻刷新，不用关掉再打开。

### English

- Follow Copilot's status-card layout: clickable checkboxes on the left and labels without blue link styling. Refresh card content immediately after checkbox, zoom or pause changes, without requiring it to be closed and reopened.

## 0.1.52 - 2026-08-21

### 中文

- Markdown 表格文本单元格里的光标不再渲染成 `\class{silk-math-caret}{\rule...}` 源码。
  上一格里的字面 `$` 不再让后面单元格误判成数学模式。

### English

- Stop rendering the caret in Markdown table text cells as literal `\class{silk-math-caret}{\rule...}` source. A literal `$` in an earlier cell no longer causes later cells to be misclassified as math mode.

## 0.1.51 - 2026-08-21

### 中文

- 预览出现滚动条时，拖动或滚轮不再把浮层关掉。滚动条改成细条、轨道透明。

### English

- Keep the preview open when dragging or scrolling its scrollbars. Use thin scrollbars with transparent tracks.

## 0.1.50 - 2026-08-21

### 中文

- 行内公式预览对准公式正下方居中，随渲染结果向两侧变宽。不再贴在行最左边。
  超出编辑器宽度或高度时出现滚动条。

### English

- Center inline formula previews directly below the formula and expand them in both directions as rendered content grows, instead of anchoring them at the start of the line. Show scrollbars when the preview exceeds the editor's width or height.

## 0.1.49 - 2026-08-21

### 中文

- 点击右下角 **Silk Math** 弹出和 Copilot 同一套工作台悬浮卡片（钉在状态栏正上方）。
  上一版用编辑器 decoration 画卡片，点状态栏时常没有编辑器焦点，看起来像没反应。

### English

- Clicking **Silk Math** at the bottom right opens the same workbench hover card used by Copilot, anchored directly above the status bar. The previous editor-decoration card often appeared unresponsive because the editor lacked focus after a status-bar click.

## 0.1.48 - 2026-08-21

### 中文

- 列格式里的竖线（如 `{cc|c}`）现在会画出来。上一版把零宽度 `<line>` 交给
  VS Code 当图片画，竖线会被丢掉。

### English

- Draw vertical rules from column specifications such as `{cc|c}`. The previous zero-width `<line>` elements were discarded when VS Code rendered the SVG as an image.

## 0.1.47 - 2026-08-21

### 中文

- 带竖线和 `\hline` 的表格不再渲染成一块浅色色块。框线改回空心描边。

### English

- Stop tables with vertical rules and `\hline` from rendering as a solid pale block. Restore unfilled strokes for table frames.

## 0.1.46 - 2026-08-21

### 中文

- 自定义环境（如 `eqmath`）在 `.cls` 里包 `\begin{equation}` / `\begin{align}` 时也能预览，
  不再报 “Erroneous nesting of equation structures”。

### English

- Preview custom environments such as `eqmath` that wrap `\begin{equation}` / `\begin{align}` in a `.cls` file without reporting “Erroneous nesting of equation structures”.

## 0.1.45 - 2026-08-21

### 中文

- Markdown / Jupyter 行内代码 `` `$...$` `` 把光标放在两侧反引号上也会实时预览，
  不再必须点进美元符里面。

### English

- Show live previews for Markdown / Jupyter inline code such as `` `$...$` `` when the caret is on either surrounding backtick, without requiring it to be inside the dollar signs.

## 0.1.44 - 2026-08-21

### 中文

- Markdown 行内代码 `` `$...$` `` 和 ` ```tex ` 代码块里的公式也可以实时预览。
  宏定义仍然不会从代码里读取。

### English

- Add live formula previews inside Markdown inline code such as `` `$...$` `` and ` ```tex ` fenced code blocks. Macro definitions are still not read from code.

## 0.1.43 - 2026-08-21

### 中文

- Markdown 表格预览画出框线（列间竖线和行间横线），不再只是一排对齐文字。

### English

- Draw vertical column rules and horizontal row rules in Markdown table previews instead of showing only aligned text.

## 0.1.42 - 2026-08-21

### 中文

- Markdown 表格单元格里 `$ |\nabla u|^2 $` 这类竖线不再被当成列分隔，避免
  “Math mode is not properly terminated”。

### English

- Keep vertical bars in Markdown table-cell formulas such as `$ |\nabla u|^2 $` from being treated as column separators, preventing “Math mode is not properly terminated” errors.

## 0.1.41 - 2026-08-21

### 中文

- 行内公式预览从当前公式下方往右排，不再从行首开始。碰到右缘再往左让，整行仍放不下时
  钉在左边并可以横向滚动。

### English

- Position inline previews below the current formula and extend them to the right instead of starting at the beginning of the line. Shift left near the right edge; if the full line is still too narrow, anchor to the left and allow horizontal scrolling.

## 0.1.40 - 2026-08-21

### 中文

- 公式预览一律显示在公式下方（默认设置）。Jupyter 里不再因为格子高度不够就翻到上方挡住源码。

### English

- Always show formula previews below the formula by default. In Jupyter, insufficient cell height no longer moves the preview above the formula and covers its source.

## 0.1.39 - 2026-08-21

### 中文

- 状态栏只显示 **Silk Math**，点击后左边不再出现 `^`、`−`、`+`、齿轮。缩放和开关仍在卡片与悬停里。

### English

- Show only **Silk Math** in the status bar, without expanding `^`, `−`, `+` or a gear to its left after clicking. Zoom and toggles remain available in the card and hover.

## 0.1.38 - 2026-08-21

### 中文

- Jupyter 里点击 Silk Math 的卡片不再跑到当前格子左上角。改为钉在视口最下面
  那一格的右下角，也就是状态栏 Silk Math 正上方。

### English

- Stop the Silk Math card from jumping to the upper-left corner of the current Jupyter cell. Anchor it to the bottom-right corner of the lowest visible cell, directly above the Silk Math status item.

## 0.1.37 - 2026-08-21

### 中文

- 只有 `\def` / `\newcommand` / `\renewcommand` 的公式默认不再弹出“渲染结果为空”。
  需要看见展开结果时，打开设置 **定义也预览**（状态栏卡片里的 Defs）。

### English

- Stop showing an empty-render error by default for formulas containing only `\def` / `\newcommand` / `\renewcommand`. Enable **Preview definitions** (Defs in the status card) to inspect their expanded output.

## 0.1.36 - 2026-08-21

### 中文

- 扩展详情页和 GitHub README 顶部显示 Silk Math 图标。

### English

- Show the Silk Math icon at the top of the extension details page and GitHub README.

## 0.1.35 - 2026-08-21

### 中文

- 扩展详情页默认英文，顶部可点 **English / 中文** 切换；示意图缩小到约 480px 宽，
  不再铺满整页。商店短描述改为英文在前。

### English

- Default the extension details page to English, with **English / 中文** links at the top. Reduce illustration width to about 480px instead of filling the page. Put English first in the short Marketplace description.

## 0.1.34 - 2026-08-21

### 中文

- 点击后的设置卡片改到右下角 **Silk Math** 正上方：上一版相对短行定位，`right: 0`
  落在行末，宽编辑器/Jupyter 里整张卡会跑到左边。状态栏文字不再出现 `^`。

### English

- Position the settings card directly above **Silk Math** at the bottom right. Previously, `right: 0` was relative to a short line's end, placing the card on the left in wide editors and Jupyter. Remove `^` from the status-bar text.

## 0.1.33 - 2026-08-21

### 中文

- 点击状态栏 **Silk Math** 现在会真正弹出设置卡片：上一版用 `position: fixed` 钉在
  整篇文档底部（Monaco 有 transform，视口里看不见），并且点状态栏时选区/失焦事件
  会立刻把卡片关掉。改为绝对定位在当前视口最后一行上方，并在状态栏展开
  `−` / 百分比 / `+` / 齿轮，点了就有反应。再点一次或 `Esc` 收起。

### English

- Make clicking **Silk Math** actually display the settings card. Previously, `position: fixed` anchored it at the document bottom, outside the visible area because of Monaco transforms, while selection or focus changes immediately closed it. Position the card absolutely above the last visible line and expand `−` / percentage / `+` / gear controls in the status bar for immediate feedback. Click again or press `Esc` to close.

## 0.1.32 - 2026-08-21

### 中文

- 点击状态栏 **Silk Math** 不再打开顶部命令列表。改为在状态栏右上角弹出 Copilot
  那种悬浮卡片（固定定位），Esc 关闭。命令面板里仍可打开完整菜单。

### English

- Clicking **Silk Math** opens a Copilot-style hover card with fixed positioning above the right side of the status bar instead of the top command list. Esc closes it; the full menu remains available from the command palette.

## 0.1.31 - 2026-08-21

### 中文

- Markdown / Jupyter 里的 GFM 管道表格（`| ... |`）也可以预览，单元格里的 `$...$` 仍按数学渲染。
- 实时预览更跟手：渲染 Worker 只保留最新一帧，打字时不再排队多趟 MathJax；同一文档版本里
  光标还在当前公式内时跳过重复扫描。

### English

- Add previews for GFM pipe tables (`| ... |`) in Markdown / Jupyter, with `$...$` inside cells still rendered as math.
- Make live previews more responsive: the rendering worker keeps only the latest frame, avoiding queued MathJax runs while typing. Skip repeat scans when the caret stays within the same formula in the same document version.

## 0.1.30 - 2026-08-21

### 中文

- Jupyter markdown 单元格会裁掉溢出。公式贴在格子底部时，预览改到公式上方，
  画在当前格里，不再被下一格挡住。

### English

- Keep previews inside Jupyter Markdown cells, which clip overflow. When a formula is near the cell bottom, place the preview above it so the next cell does not cover it.

## 0.1.29 - 2026-08-21

### 中文

- 修复 `\underbrace` 多出一根横线、右侧断开：VS Code 把 SVG 当图片画时
  `clip-path="url(#id)"` 不生效，拉伸矩形会铺开。现在按 viewBox 直接裁成矩形路径。

### English

- Fix an extra horizontal line and a broken right edge in `\underbrace`. VS Code ignores `clip-path="url(#id)"` when rendering SVG as an image, allowing stretched rectangles to spill out. Clip them directly into rectangular paths using the viewBox.

## 0.1.28 - 2026-08-21

### 中文

- 点击状态栏 **Silk Math** 会打开设置菜单（放大缩小、语言开关、排除、暂停）。
  上一版把点击绑到核心私有命令的空实现上，所以点了没有任何反应。悬停仍显示
  状态栏上方的 Markdown 卡片。

### English

- Clicking **Silk Math** opens the settings menu for zoom, language toggles, exclusion and pause. Previously, clicks invoked an empty implementation of a private core command and did nothing. Hovering still shows the Markdown card above the status bar.

## 0.1.27 - 2026-08-21

### 中文

- 修复 `\underbrace` 横杠被拉成一条直线：展平内层 svg 时补上原来 viewBox 的裁剪，
  拉伸段只出现在左右端盖之间。
- 收紧浮层背景与公式之间的空白：不再给每条公式的 viewBox 四周垫 2em，内边距改为
  `0.06em 0.12em`。
- 默认预览大小改为相对编辑器字号的 135%，界面把这个大小显示为 100%。

### English

- Fix `\underbrace` turning into a straight line: preserve the original viewBox clipping when flattening nested SVGs so the stretched segment appears only between the end caps.
- Tighten spacing between the overlay background and formula by removing the 2em padding around every viewBox and using `0.06em 0.12em` inner padding.
- Set the default preview size to 135% of the editor font size, displayed as 100% in the interface.

## 0.1.26 - 2026-08-21

### 中文

- 修复 `\underbrace{...}_{=0 \text{ by the PDE}}` 这类公式：编辑器里只剩一块空浮层。
  拉伸横杠是内层 `<svg>`，VS Code 把它当图片画时整张图是空的；同时 MathJax 的
  viewBox 会裁掉 brace 下面的说明文字。内层 svg 展平成 `<g>`，并按实际定位点扩大 viewBox。

### English

- Fix formulas such as `\underbrace{...}_{=0 \text{ by the PDE}}` appearing as an empty overlay. Their stretched bars use nested `<svg>` elements that VS Code renders as blank images, and MathJax's viewBox clips the text below the brace. Flatten nested SVGs into `<g>` groups and expand the viewBox using actual positioned points.

## 0.1.25 - 2026-08-21

### 中文

- 点击状态栏 **Silk Math** 不再打开下方面板或右侧辅助栏。设置改回 Copilot 同款的
  状态栏上方悬浮框：调大小、开关语言、排除本文件、暂停、截图识别。请卸载旧版本后
  重装并重载窗口，VS Code 会记住以前的「Silk Math」面板标签。

### English

- Clicking **Silk Math** opens a Copilot-style hover above the status bar instead of a bottom panel or right auxiliary bar. It provides preview sizing, language toggles, file exclusion, pause and screenshot recognition. Uninstall the previous version, reinstall and reload the window because VS Code remembers the old Silk Math panel tab.

## 0.1.24 - 2026-08-20

### 中文

- 默认预览大小改为相对编辑器字号的 140%，界面把这个大小显示为 100%。

### English

- Set the default preview size to 140% of the editor font size, displayed as 100% in the interface.

## 0.1.23 - 2026-08-20

### 中文

- 修复 Jupyter：前面 markdown 单元格里的 `$\def\A{\mathbf{A}}$` 现在会被后面的单元格使用。
  以前每个单元格是独立文档，自定义宏出了当前格就失效。

### English

- Fix Jupyter macro sharing: definitions such as `$\def\A{\mathbf{A}}$` in earlier Markdown cells now apply to later cells. Previously, each cell was treated as an independent document, limiting custom macros to that cell.

## 0.1.22 - 2026-08-20

### 中文

- 修复 `\underbrace` / `\sqrt` / `\overline` 等预览空白：MathJax 会在公式里再嵌一层
  `<svg>`，以前取到第一个 `</svg>` 就把根节点截断，VS Code 只画出空底。
- 修正 viewBox 宽高解析（min-x min-y **width height**）。

### English

- Fix blank previews for `\underbrace`, `\sqrt`, `\overline` and similar formulas. MathJax nests `<svg>` elements inside formulas; stopping at the first `</svg>` truncated the root element and left VS Code drawing only the background.
- Correct viewBox dimension parsing to min-x min-y **width height**.

## 0.1.21 - 2026-08-20

### 中文

- 截图识别改为默认**智能模式**：公式转成 LaTeX，旁边的文字一并保留；仍可只认公式或只认文字。
- 公式识别前按比例放入 384 画布并给深色截图反相，避免宽公式被拉变形、暗色主题识别成乱码。
- 识别面板改成紧凑卡片式布局；模型仍是首次使用才下载、只在本机运行。

### English

- Make **Smart mode** the default for screenshot recognition, converting formulas to LaTeX while preserving nearby text. Formula-only and text-only modes remain available.
- Fit formula images proportionally onto a 384-pixel canvas and invert dark screenshots before recognition, preventing stretched wide formulas and unreadable results from dark themes.
- Use a compact card layout for the recognition panel. Models still download only on first use and run locally.

## 0.1.20 - 2026-08-20

### 中文

- 修复长公式往上拖选或滚到公式上半段时预览消失：VS Code 不给视口外的行画 decoration，
  浮层改为锚在当前可见的公式行上，滚动只挪锚点、不重新渲染。
- 选区只要还碰到当前公式就不清浮层，避免从下往上拖选时闪没。

### English

- Fix long-formula previews disappearing when selecting upward or scrolling to the upper part of a formula. Since VS Code does not draw decorations on offscreen lines, anchor the overlay to a visible formula line. Scrolling moves only the anchor without rendering again.
- Keep the overlay while the selection still intersects the current formula, avoiding flashes when dragging upward from below.

## 0.1.19 - 2026-08-20

### 中文

- 点击状态栏 **Silk Math** 改为打开右侧紧凑设置卡片（辅助栏），不再占用整条下方面板。
  卡片有进入动画、开关与滑块的按压反馈；再点一次或 `Esc` 收起。
- 关闭后释放 webview 文档；卡片里不再重复渲染公式 SVG，降低占用。

### English

- Clicking **Silk Math** opens a compact settings card in the right auxiliary bar instead of occupying the entire bottom panel. Add an entrance animation and press feedback for toggles and sliders. Click again or press `Esc` to close.
- Release the webview document on close and stop rendering duplicate formula SVGs inside the card to reduce resource use.

## 0.1.18 - 2026-08-20

### 中文

- 示意图改用仓库内相对路径，打包时由 vsce 改写成 GitHub https 地址。详情页 sanitizer
  只放行 `http`/`https`，相对路径和 data URI 的 `src` 会被剥掉，所以本地 VSIX 也必须指向公开网址。
- 补全开源元数据：`LICENSE` 版权人、`author`、`repository`、`bugs`、`homepage`。
- 公开仓库：https://github.com/zhoujasper/silk-math-preview

### English

- Use repository-relative illustration paths, which vsce rewrites to GitHub HTTPS URLs during packaging. The details-page sanitizer permits only `http`/`https`, removing `src` values using relative paths or data URIs, so local VSIX packages also need public image URLs.
- Complete open-source metadata: `LICENSE` copyright holder, `author`, `repository`, `bugs` and `homepage`.
- Public repository: https://github.com/zhoujasper/silk-math-preview

## 0.1.17 - 2026-08-20

### 中文

- 重写扩展详情页介绍：去掉重复标题、VSIX 安装命令和设置表，改成中英对照的产品介绍。
- 简介改为「光标走到哪，公式就在哪渲染。Live math preview that follows your caret.」

### English

- Rewrite the extension details page as a Chinese/English product introduction, removing the repeated title, VSIX installation commands and settings table.
- Change the description to “光标走到哪，公式就在哪渲染。Live math preview that follows your caret.”

## 0.1.16 - 2026-08-20

### 中文

- 新增**控制面板**（下方面板区，点击状态栏的 **Silk Math** 打开 / 再点收起）：自绘 webview，
  里面是当前公式的**实时预览**（编辑时同步刷新，含渲染耗时）、预览大小滑块与 `−`/`+`、
  LaTeX / Markdown / 其他文件类型开关、排除本文件、暂停、截图识别、重载定义、诊断与设置。
  渲染失败时面板直接显示原因，不用再去翻输出面板。
- 状态栏 **Silk Math** 的点击行为改为开关这个面板；悬停仍然给出简版信息面板。

### English

- Add a **control panel** in the bottom panel area, toggled by clicking **Silk Math** in the status bar. The custom webview shows a **live preview** of the current formula, updated while editing with render timing, plus a preview-size slider and `−`/`+`, LaTeX / Markdown / other-file toggles, file exclusion, pause, screenshot recognition, definition reload, diagnostics and settings. Show rendering errors directly in the panel.
- Change the **Silk Math** status click to toggle this panel; hovering still shows a compact information panel.

## 0.1.15 - 2026-08-20

### 中文

- 新增命令 **Silk Math: 诊断当前公式**：把光标所在公式在预览链路上的每一步（语言判定、
  识别到的区域、生成的表达式、渲染结果与尺寸、浮层状态）打印到“Silk Math”输出面板。
  某条公式不显示时，跑一次就能定位到具体环节。
- 状态栏 **Silk Math** 恢复可点击（点击打开等价的列表菜单）。VS Code 只给扩展开放了
  MarkdownString 悬浮面板，没有 API 能用点击打开它，因此设置面板仍然是悬停出现。
- README 去掉示意图与开发、隐私章节：VS Code 扩展详情页只渲染 https 图片，本地安装的 VSIX
  无论用相对路径还是内联 data URI 都显示不出来（已逐一验证）。示意图保留在仓库 `media/` 目录。

### English

- Add **Silk Math: Diagnose Current Formula**, which prints each preview stage to the Silk Math output channel: language detection, matched region, generated expression, rendering result and dimensions, and overlay state. Use it to locate where a missing preview fails.
- Make **Silk Math** clickable again to open an equivalent list menu. VS Code exposes only MarkdownString hover panels to extensions, with no API for opening them by click, so the settings panel still appears on hover.
- Remove illustrations and development/privacy sections from README. The extension details page renders only HTTPS images; local VSIX installations could not display relative paths or inline data URIs in the checks performed. Keep illustrations in the repository's `media/` directory.

## 0.1.14 - 2026-08-20

### 中文

- **修复 0.1.13 的严重回归**：空白兜底判据里的正则写错，导致每一条公式都被判成
  “公式渲染结果为空”，基础预览彻底不可用。判据改为直接检查 `<path`/`<text`/`<rect`，
  并补上单元测试，保证正常公式一定含可见图元。
- 状态栏的 **Silk Math** 不再挂点击命令：点击会弹出顶部命令面板，而这里要的是
  鼠标悬停出现的浮层设置面板。键盘用户仍可用命令面板里的 “Silk Math: 打开状态栏菜单”。
- 修复扩展详情页里示意图空白：VS Code 详情页 webview 的 CSP 是 `img-src https: data:`，
  相对路径与 `file:` 图片会被直接拦掉。示意图改为内联 `data:` URI（引用式定义放在 README 末尾），
  同时不再把这几张 PNG 打进 VSIX。

### English

- **Fix a severe regression in 0.1.13**: an incorrect regular expression in the empty-output fallback classified every formula as empty, completely breaking basic previews. Check directly for `<path`, `<text` and `<rect`, with unit tests ensuring normal formulas contain visible elements.
- Remove the click command from **Silk Math** because it opened the top command palette instead of the intended hover settings panel. Keyboard users can still run “Silk Math: Open Status Menu” from the command palette.
- Fix blank illustrations on the extension details page. Its webview CSP uses `img-src https: data:`, blocking relative and `file:` images. Inline illustrations as `data:` URIs with reference definitions at the end of README, and stop packaging those PNGs in the VSIX.

## 0.1.13 - 2026-08-20

### 中文

- 修复 Jupyter / Markdown 里 `$$ \begin{equation} ... \end{equation} $$` 完全不显示：
  这类分隔符区域内部还套着一个顶层环境，渲染时会因嵌套报错。现在与环境区域走同一套归一化，
  `equation` 去壳、`align` 换成 `aligned`。实测某个 `.ipynb` 的 59 处公式、1362 个光标位置从全部失败变为 0 失败。
- 真正写错的命令现在按红色原文标出来（`silkMath.markUnknownCommands`，默认开），
  而不是让整条公式渲染失败；关掉则回到严格模式，保留上一帧。
- 修复错误提示显示成 `[object Object]`：MathJax 抛的是普通对象，不是 `Error` 实例。
- 渲染成功但没有任何可见图元时不再留一个空白面板，会说明原因。
- 新增 `silkMath.trace`：把每次渲染的表达式、尺寸与错误写进“Silk Math”输出面板，便于反馈问题。
- 状态栏改为两个入口：左边的相机图标点一下直接截图识别，右边的 **Silk Math** 悬停即弹出设置面板，
  不再把人拽到顶部的命令面板；面板样式与 Copilot 的状态栏面板一致。
- 悬浮面板里可以直接调预览大小：`−` / `+` 每档 5%，带百分比与刻度条，一键恢复默认 110%；
  同时提供 `Silk Math: 放大预览 / 缩小预览 / 恢复默认预览大小` 三个命令，可自行绑定快捷键。
- 面板里还能就地切换 LaTeX / Markdown / 其他文件类型的启用、暂停 5 或 30 分钟、
  排除或恢复当前文件，点击 **Silk Math** 文字仍可打开等价的键盘可用菜单。
- 修复扩展详情页里示意图不显示：VS Code 不渲染 README 中的 SVG，示意图改为 PNG。
- README 补回中英双语，并保持简洁结构。

### English

- Fix formulas such as `$$ \begin{equation} ... \end{equation} $$` not appearing in Jupyter / Markdown. These delimited regions contain another top-level environment and fail with nesting errors. Apply the same normalization as environment regions: unwrap `equation` and convert `align` to `aligned`. Checks on 59 formulas and 1,362 caret positions in one `.ipynb` went from all failing to zero failures.
- Show genuinely invalid commands as red source text (`silkMath.markUnknownCommands`, enabled by default) instead of failing the whole formula. Disable it to restore strict mode and retain the previous frame.
- Fix error messages displaying `[object Object]`: MathJax throws plain objects rather than `Error` instances.
- Explain why a successful render has no visible elements instead of leaving an empty panel.
- Add `silkMath.trace` to log each rendered expression, dimensions and errors to the Silk Math output channel for troubleshooting.
- Split the status bar into two entries: a camera icon that starts screenshot recognition directly and **Silk Math**, which opens a Copilot-style settings panel on hover instead of sending users to the top command palette.
- Adjust preview size directly in the hover panel with `−` / `+` in 5% steps, a percentage and scale indicator, and one-click reset to the default 110%. Add commands to zoom in, zoom out and reset preview size for custom keybindings.
- Toggle LaTeX / Markdown / other-file support, pause for 5 or 30 minutes, and exclude or restore the current file directly in the panel. Clicking **Silk Math** still opens an equivalent keyboard-accessible menu.
- Fix illustrations missing from the extension details page by replacing SVGs with PNGs, since VS Code does not render README SVGs.
- Restore Chinese/English README content while keeping the structure concise.

## 0.1.12 - 2026-08-20

### 中文

- 修复 `.cls`/`.sty` 里的宏在“只打开单个文件”时完全失效：依赖解析原本要求文档必须落在
  工作区文件夹内，现在与 LaTeX 一致，先在主文件所在目录查找 `\documentclass`、`\usepackage`、
  `\input`、`\include` 的目标。`\eps`、`\Ocal` 这类宏因此不再让整条公式渲染不出来。
- 修复类文件里的文本环境被当成公式区域：只有 begin 部分真正进入数学模式的自定义环境才参与
  公式识别。`elegantnote` 的 `question`/`solution` 曾把整段解答识别成一条公式，里面所有
  `\[...\]` 都没有预览。
- 支持 `\DeclareMathAlphabet`（如 `\CMcal`）：按字体族折算成 `\mathcal`/`\mathfrak`/`\mathbb` 等，
  依赖它的 `\newcommand{\Ocal}{\CMcal{O}}` 也能正常显示。
- 修复行内公式跨行时后续 `$` 全部错位：`$...$` 现在按 TeX 的真实规则跨行，遇到空行或 `\par` 才结束。
- 修复 `\text{for |}` 里的光标被当成文字原样打印；文本模式下的光标会自动切回数学模式。
- 修复 `\frac1|2`、`\textcolor{名字}|{内容}` 等参数缝隙上的光标导致整条公式渲染失败。
- TikZ/PGF 图形直接说明无法预览，不再什么都不显示。
- 状态栏改为单一 **Silk Math** 入口：一个菜单里控制 LaTeX/Markdown/其他文件类型的启用、
  暂停 5/30 分钟、排除或恢复当前文件、截图识别与设置。
- 新增 `silkMath.previewScale`（默认 `1.1`，预览略大一点）与 `silkMath.showRenderErrors`。
- README 重写为简洁版，示意图改为真实渲染输出生成的 PNG（`node scripts/make-media.mjs`）。

### English

- Fix `.cls`/`.sty` macros not working when opening a single file without a workspace folder. Resolve `\documentclass`, `\usepackage`, `\input` and `\include` targets from the main file's directory first, matching LaTeX behavior. Macros such as `\eps` and `\Ocal` no longer prevent entire formulas from rendering.
- Stop treating text environments in class files as formula regions. Only custom environments whose begin part actually enters math mode participate in formula detection. Previously, `elegantnote`'s `question`/`solution` could turn a whole answer into one formula and suppress previews for all enclosed `\[...\]` expressions.
- Support `\DeclareMathAlphabet`, such as `\CMcal`, by mapping font families to `\mathcal`, `\mathfrak`, `\mathbb` and similar commands. Dependent definitions such as `\newcommand{\Ocal}{\CMcal{O}}` now render correctly.
- Fix later `$` delimiters becoming misaligned after multiline inline formulas. `$...$` now follows TeX rules across lines, ending at a blank line or `\par`.
- Fix the caret inside `\text{for |}` appearing as literal text by switching it back to math mode automatically.
- Fix caret markers between arguments, such as `\frac1|2` and `\textcolor{名字}|{内容}`, causing the entire formula to fail.
- Explicitly explain that TikZ/PGF diagrams cannot be previewed instead of showing nothing.
- Consolidate controls under one **Silk Math** status entry: LaTeX / Markdown / other-file toggles, 5/30-minute pause, file exclusion/restoration, screenshot recognition and settings.
- Add `silkMath.previewScale`, defaulting to `1.1` for a slightly larger preview, and `silkMath.showRenderErrors`.
- Simplify README and generate PNG illustrations from real rendered output with `node scripts/make-media.mjs`.

## 0.1.11 - 2026-08-20

### 中文

- 修复公式整条渲染不出来：光标吸附到 `\underbrace`、`\mathcal` 这类命令末尾时会停在命令和它的
  花括号之间，marker 被当成参数（`Missing argument for \class`）；`\bigl`、`\Bigr`、`\middle`
  的定界符同样会被拆开（`Missing or unrecognized delimiter`）。现在任何命令与其参数、
  定界符之间都不再放置 marker。在两份真实文档的 282 条公式、2,653 个光标位置上实测 0 失败。
- 修复 `\textcolor{颜色名}{...}` 的颜色名被 marker 破坏：颜色名、环境名、`\label` 等名字类参数
  内部不再插入 marker，光标改落到后面真正显示的内容里。
- 新增颜色定义支持：文档、`.sty`、`.cls` 里的 `\definecolor`/`\providecolor`/`\colorlet` 会进入
  定义索引，`rgb`/`RGB`/`HTML`/`gray`/`cmyk` 统一折算成 MathJax 可用的 `rgb`，无法折算的模型
  只标记为受限而不会让整份定义失效。
- 补齐 MathJax 缺少的常用命令（`\emph`、`\ensuremath`、`\textsuperscript`、`\bm`、`\cref`、
  `\footnote`、`\intertext`、`\allowdisplaybreaks` 等），并加载 `boldsymbol`、`cancel` 扩展；
  自定义定义中若有单条无法转换，其余定义仍然生效，不再整份作废。
- 输入更跟手：编辑热路径不再每次按键重新解析整份文档定义（改为复用快照 + 后台核对），
  跳过重复的预扫描，缓存配置与字体度量，并把一次按键触发的两次调度合并成一次渲染。
  18k 字符文档的按键主线程耗时实测从 p50/p95 `2.66/4.36 ms` 降到 `0.37/0.64 ms`。
- 鼠标悬停在公式上不再弹出 `Silk Math · x ms` 的 hover 面板。
- 光标竖线下沉 0.18em、总高 0.92em，跨在基线两侧，不再整体偏上。

### English

- Fix complete formula rendering failures caused by caret markers between commands and their arguments. Snapping to the end of commands such as `\underbrace` or `\mathcal` placed the marker before the opening brace, making it an argument (`Missing argument for \class`); delimiters for `\bigl`, `\Bigr` and `\middle` could also be split (`Missing or unrecognized delimiter`). Never insert markers at these seams. Checks across 282 formulas and 2,653 caret positions in two real documents produced zero failures.
- Protect name arguments such as colors in `\textcolor{颜色名}{...}`, environment names and `\label` from caret markers. Place the caret in the following visible content instead.
- Index `\definecolor`, `\providecolor` and `\colorlet` from documents, `.sty` and `.cls` files. Convert `rgb`, `RGB`, `HTML`, `gray` and `cmyk` to MathJax-compatible `rgb`; mark unsupported models as limited without invalidating all definitions.
- Add common commands missing from MathJax, including `\emph`, `\ensuremath`, `\textsuperscript`, `\bm`, `\cref`, `\footnote`, `\intertext` and `\allowdisplaybreaks`, and load `boldsymbol` and `cancel`. A custom definition that cannot be converted no longer invalidates the remaining definitions.
- Make typing more responsive by reusing definition snapshots with background checks instead of parsing all definitions on every keystroke. Skip duplicate prescans, cache configuration and font metrics, and combine two schedules from one keystroke into one render. Main-thread keystroke time for an 18k-character document fell from p50/p95 `2.66/4.36 ms` to `0.37/0.64 ms` in local measurements.
- Stop showing a `Silk Math · x ms` hover panel when hovering over a formula.
- Lower the caret by 0.18em and set its total height to 0.92em so it spans both sides of the baseline instead of sitting too high.

## 0.1.10 - 2026-08-20

### 中文

- 多行公式环境的浮层改为落在最后一行之下：浮层仍锚在公式起点保持左对齐，但按公式实际占用的
  行数偏移，`equation` 之类的环境不会再被自己的预览盖住。行偏移改用 `editor.fontSize` /
  `editor.lineHeight` 推导的真实像素，不再依赖伪元素里会退化成一个字号的 `1lh`。
- 修复浮层背景盖不住公式、右侧与下沿溢出：MathJax 输出的 `ex` 在独立 SVG 图片里按 16px 默认字体
  解析，与编辑器字体的 `ex` 不是同一个长度。现在 SVG 根节点尺寸与浮层尺寸都写成同一组像素值，
  超宽公式等比缩小到上限，而不是把背景截断在上限处。
- 修复光标插入把上下标内容顶回基线：`T^\star` 中光标落在 `\star` 内部时会先吸附到 `^` 之后，
  caret 变成上标本体。吸附后现在会再检查一次上下标位置，`\star` 仍留在上标。
- 新增表格预览：`tabular`/`tabular*`/`tabularx`/`tabulary`/`longtable`/`xltabular`/`supertabular`
  会被翻译成 MathJax 的 `array`。booktabs 规则映射为 `\hline`，`\multicolumn` 补回列、
  `\makecell`/`\thead` 展开成纵向 array，标题与跨页标记不进入预览；单元格按文本模式渲染，
  其中的 `$...$` 仍是数学。表格整体按 `0.82` 缩小一档显示。

### English

- Place multiline formula overlays below the last source line. Keep the anchor at the formula start for left alignment, but offset by the actual number of occupied lines so environments such as `equation` are not covered by their own previews. Derive pixel offsets from `editor.fontSize` / `editor.lineHeight` instead of `1lh`, which can fall back to a single font size in pseudo-elements.
- Fix formulas overflowing their backgrounds on the right and bottom. MathJax's `ex` units use a default 16px font in standalone SVG images, differing from the editor's `ex`. Set the SVG root and overlay to the same pixel dimensions and scale overly wide formulas proportionally to the limit instead of truncating the background.
- Fix caret insertion pushing superscript/subscript content back to the baseline. In `T^\star`, snapping a caret inside `\star` to just after `^` made the caret itself the superscript. Recheck script positions after snapping so `\star` remains superscripted.
- Add table previews by translating `tabular`, `tabular*`, `tabularx`, `tabulary`, `longtable`, `xltabular` and `supertabular` into MathJax `array`. Map booktabs rules to `\hline`, restore columns for `\multicolumn`, and expand `\makecell` / `\thead` into vertical arrays. Omit captions and page-break markers; render cells as text while preserving `$...$` math. Scale tables by `0.82`.

## 0.1.9 - 2026-08-20

### 中文

- 修复 `PREVIEW_CARET_TEX` 中使用 `\\raise + \\hbox` 的光标片段在部分上下文中的兼容性退化，
  导致预览里出现明文 `\\rule{...}`。
- 将光标 token 简化为 `\\class{silk-math-caret}{\\rule{0.03em}{0.88em}}`，降低解析失败概率并保持
  颜色钩子不变。
- 版本号升至 `0.1.9`，用于标识本次可安装包。

### English

- Fix compatibility regressions from the `\\raise + \\hbox` caret fragment in `PREVIEW_CARET_TEX`, which caused literal `\\rule{...}` text in some previews.
- Simplify the caret token to `\\class{silk-math-caret}{\\rule{0.03em}{0.88em}}`, reducing parse failures while preserving the color hook.
- Bump the version to `0.1.9` to identify this installable package.

## 0.1.8 - 2026-08-20

### 中文

- 进一步优化实时预览输入链路：当当前公式已显示时，文本变更触发更新改为立即调度（0ms），并预热
  Worker，减少“改一个字母也不动”感知延迟。
- 将 `silkMath.debounceMs` 默认值从 `24` 下调到 `8`，并保留配置可控，兼顾实时反馈与轻量负载。
- 继续保留本地输入下即时生效特征：继续保持边框精简、光标更小、右侧留白与上下间距优化后的布局。
- 版本号更新为 `0.1.8`，打包产物为 `silk-math-preview-0.1.8.vsix`（`1,175,265` bytes，
  SHA-256 `6BAF7AD724C6BBF271788C177121ECD2FE925C7A543BB5E0A7BE06B9E01DADF1`）。

### English

- Improve the live-preview input path: schedule text-change updates immediately (0ms) when the current formula is already visible and prewarm the worker to reduce perceived delays after small edits.
- Lower the default `silkMath.debounceMs` from `24` to `8`, retaining user configuration to balance responsiveness and resource use.
- Keep local input changes immediately reflected, preserving the simplified borders, smaller caret, extra right-side spacing and adjusted vertical spacing.
- Update the version to `0.1.8`. Package: `silk-math-preview-0.1.8.vsix`, `1,175,265` bytes, SHA-256 `6BAF7AD724C6BBF271788C177121ECD2FE925C7A543BB5E0A7BE06B9E01DADF1`.

## 0.1.7 - 2026-08-20

### 中文

- 修复参数错位导致的布局失配，确保 `previewPosition`/主题/显示模式参数按正确顺序传入。
- 去掉 Light/Dark 下面板边框（保留 High Contrast 边框），减少视觉“傻逼框感”；调整顶部/底部内边距，
  上间距更小、下间距更大，并扩大文字右侧横向留白。
- 缩小同步光标：缩窄宽度并下移，同时降低占位高度，避免看起来“偏上且过大”。
- 继续处理 `equation`/显示环境的下方浮层定位，避免预览覆盖在公式自身上方。
- 更新版本号与安装标记为 `0.1.7`。

### English

- Fix layout mismatches caused by shifted arguments, passing `previewPosition`, theme and display-mode values in the correct order.
- Remove borders from below-formula overlays in Light/Dark themes while keeping High Contrast borders. Reduce top padding, increase bottom padding and add more horizontal space to the right of the text for a cleaner appearance.
- Make the synchronized caret narrower, lower and shorter so it no longer looks oversized or too high.
- Continue correcting below-formula positioning for `equation` and display environments to prevent previews from covering their own formulas.
- Update the version and installation identifier to `0.1.7`.

## 0.1.6 - 2026-08-20

### 中文

- 深度修复公式浮层显示问题：增加布局安全冗余，降低预览上方空隙，强化预览框轮廓，缩小源码同步光标宽高。
- 优化 MathJax 长度解析，减少部分公式右侧/底部与单位兼容导致的裁切风险。

### English

- Improve formula overlays with additional layout safety margins, less space above the preview, a clearer outline and a smaller synchronized source caret.
- Improve MathJax length parsing to reduce right/bottom clipping and unit-compatibility issues in some formulas.

## 0.1.5 - 2026-08-20

### 中文

- 配合用户反馈继续做完整公式显示与交互体验修正后的版本号更新与重新打包。

### English

- Update the version and repackage after further fixes to complete formula display and interactions based on user feedback.

## 0.1.4 - 2026-08-19

### 中文

- 点击当前公式外会同步关闭浮层，不再等待定义索引或 Worker；浮层可见时按 `Esc` 也可关闭。
- `equation/align/alignat/gather/multline/flalign/displaymath/math` 环境转为 MathJax 可嵌入的安全预览，点击 `\begin`/`\end`、正文或 `\label` 都可显示。
- 下方浮层上移约 `0.17em`，减小与上方源码的距离并增大与下方内容的留白。

### English

- Close the overlay immediately when clicking outside the current formula, without waiting for the definition index or worker. Pressing `Esc` also closes a visible overlay.
- Convert `equation/align/alignat/gather/multline/flalign/displaymath/math` environments into safely embeddable MathJax previews, shown when clicking `\begin`, `\end`, the body or `\label`.
- Move below-formula overlays up by about `0.17em`, reducing the gap from the source above and adding space before the content below.

## 0.1.3 - 2026-08-19

### 中文

- 为下方/上方公式浮层增加更清晰的主题背景、8px 圆角、细边框和轻量阴影。
- 背景、前景和边框使用 VS Code 原生颜色令牌，并为 Light、Dark 及高对比主题分别调整阴影/边框。
- 浮层依然绝对定位、不占行高、不拦截鼠标与文本选择。

### English

- Give above/below formula overlays a clearer themed background, 8px rounded corners, a thin border and a subtle shadow.
- Use native VS Code color tokens for the background, foreground and border, with separate shadow/border adjustments for Light, Dark and High Contrast themes.
- Keep overlays absolutely positioned without affecting line height or intercepting mouse input and text selection.

## 0.1.2 - 2026-08-19

### 中文

- 把实时 SVG 从参与行内排版的 after/before 内容改为锚定公式起点的绝对定位浮层。
- 默认在当前公式下方显示，不再撑高源码行、生成虚空行或改变编辑光标基线。
- 新增 `below/above` 设置；旧 `after/before` 值自动迁移到对应浮层位置。
- 新增浮层方向、尺寸限制和“不使用 vertical-align 占位”的回归测试。

### English

- Replace inline after/before SVG content with an absolutely positioned overlay anchored at the formula start.
- Show previews below the current formula by default without increasing source-line height, creating empty lines or shifting the editor caret baseline.
- Add `below/above` settings and migrate old `after/before` values to the corresponding overlay positions.
- Add regression tests for overlay direction, size limits and avoiding `vertical-align` placeholders.

## 0.1.1 - 2026-08-19

### 中文

- 修复 MathJax sandbox 只渲染公式第一个 TeX atom、导致行内预览缺失或不完整的问题。
- 新增覆盖 `$u\equiv-1$` 完整字形与源码同步光标的回归测试。
- 加入独立扩展图标、深色 Marketplace banner 和三张轻量功能示意图。
- README、扩展描述、命令及设置说明改为中英双语。

### English

- Fix the MathJax sandbox rendering only the first TeX atom, which caused missing or incomplete inline previews.
- Add regression tests for the complete glyph output of `$u\equiv-1$` and the synchronized source caret.
- Add a dedicated extension icon, a dark Marketplace banner and three lightweight feature illustrations.
- Make README, the extension description, commands and setting descriptions bilingual in Chinese and English.

## 0.1.0 - 2026-08-18

### 中文

- 首个可安装版本。
- LaTeX / Markdown 就地实时 SVG 预览与源码同步光标。
- `.tex/.sty/.cls` 依赖定义、Markdown frontmatter 宏、补全、诊断和显式 Quick Fix。
- Windows/macOS/Linux 状态栏截图入口与按需本地公式/文字 OCR。
- 懒 Worker、有界扫描、latest-wins、最后有效帧、LRU 和包体/性能门。

### English

- First installable release.
- Live inline SVG previews for LaTeX / Markdown with a synchronized source caret.
- Definitions from `.tex/.sty/.cls` dependencies, Markdown frontmatter macros, completion, diagnostics and explicit Quick Fixes.
- A Windows/macOS/Linux status-bar capture entry with on-demand local formula/text OCR.
- Lazy workers, bounded scanning, latest-wins rendering, retention of the last valid frame, an LRU cache and package-size/performance gates.
