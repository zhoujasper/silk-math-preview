# 更新日志 / Changelog

## 0.3.5 - 2026-09-12

### 中文

- 按最新要求将图片复制改为白底黑字 PNG，保留完整公式，去掉编辑光标，不裁切滚动窗口外的内容；屏幕预览主题不变。复制在短命 Worker 与系统剪贴板接口中完成，彻底移除临时转换页，无额外窗口或编辑器焦点切换。
- 仅在图片写入剪贴板成功后，右上角复制按钮以淡出和轻微缩放过渡为绿色勾，约 1.6 秒后恢复；失败、取消、离开或修改公式时不显示错误成功状态。支持系统减少动态效果，反馈只更新按钮样式，不重建浮层或重新渲染公式。
- Windows/macOS 使用系统自带图片剪贴板接口；Linux 支持 Wayland 的 wl-copy 和 X11 的 xclip，缺少工具明确报错。PNG 以 2 倍像素导出、白边 4px，超大图保持既有 8192px/1600 万像素及 2 MiB SVG 限额；后台栅格化完成即释放，不常驻 Webview，不访问网络。
- 修复输入或删除字符时仍间歇闪烁的控制器竞态：公式身份改由起始标记、类型和环境判断，不再把随编辑变化的结束位置当作切换公式。光标事件先于新图返回时保留当前浮层，不清空图片、锚点和渲染状态。
- 文档修改时同步公式源码位置，支持公式前方编辑、多处同时修改及 UTF-16 偏移；按文档版本避免重复平移。继续编辑时更新已识别的范围，包括未闭合定界符；慢渲染或暂时无效的输入保留最后成功帧，过期结果仍丢弃。移除起始标记、真正离开或切换公式，以及删到空内容或单个反斜杠时仍清除旧预览。
- 保留双向细滚动条、光标避让、行间字号和 PNG 复制。本机通过实际控制器与扫描器的输入/删除时序回归，包括长公式、换行、多处编辑、慢响应和错误恢复；使用受控 VS Code API 与渲染响应，不把这些检查等同于真实编辑器逐帧验收。

### English

- Change copied images to PNGs with black formula ink on a solid white background, preserving the complete formula while omitting the editing caret and avoiding scroll-viewport cropping. The preview theme stays unchanged. A short-lived Worker and system clipboard interfaces replace the temporary conversion page, with no extra windows or editor focus changes.
- Only after the image clipboard write succeeds, smoothly fade and scale the upper-right copy icon into a green checkmark, returning after about 1.6 seconds. Failure, cancellation, leaving, or editing the formula never shows a false success state. Respect reduced-motion preferences; feedback updates only button styles without rebuilding the hover or re-rendering math.
- Use built-in image clipboard interfaces on Windows/macOS and support wl-copy on Linux Wayland and xclip on X11, reporting missing tools explicitly. PNG export retains 2× pixel density, 4px white margins, the 8192px/16-million-pixel limits, and the 2 MiB SVG limit. Release the rasterization Worker after each operation, without persistent Webviews or network access.
- Fix the controller race behind intermittent flashing during insertion and deletion. Identify a formula by its opening token, kind, and environment instead of its changing end offset. When a selection event precedes the next rendered image, retain the current hover without clearing its image, anchors, or render state.
- Rebase formula source positions after document changes, including edits before the formula, simultaneous changes, and UTF-16 offsets; use document versions to prevent double translation. Refresh recognized bounds while editing, including unfinished delimiters. Keep the last successful frame during slow renders and temporarily invalid input, while rejecting stale results. Removing the opener, leaving or switching formulas, and deleting down to empty content or a single backslash still clear the old preview.
- Preserve thin bidirectional scrollbars, caret avoidance, display-math sizing, and PNG copying. Local checks exercise the actual controller and scanner across input/deletion event timing, long formulas, line breaks, simultaneous edits, slow responses, and error recovery, with controlled VS Code APIs and render responses; these checks are not frame-by-frame acceptance in a live editor.

## 0.3.4 - 2026-09-12

### 中文

- 修复每输入一个字符预览就闪烁：同一浮层更新不再先隐藏后重开，新图片样式生效后才撤掉旧样式；编辑器保持焦点时，上一帧在原生悬浮组件的按键隐藏及异步渲染期间继续显示。更新光标位置无需重建滚动容器，定位后解除吸附；离开公式、失焦及 Esc 仍能关闭。保留浮层期间的复制按钮读取当前有效图片，关闭后旧按钮失效。
- 公式浮层右上角的复制按钮改为复制完整公式的透明 PNG，包含横向和纵向滚动范围外的内容。保留当前预览字色，去掉编辑光标、浮层背景、边框、阴影与滚动条；默认以 2 倍像素导出，四周留 4px 透明边距，超大图片等比限制到最长边 8192px、总计 1600 万像素以内。
- Windows、macOS 和 Linux 共用 VS Code Webview 的 Canvas 和图片剪贴板 API，无需额外工具、原生模块、网络或平台脚本。仅点击复制时打开临时转换页，成功后自动关闭并返回编辑器；若剪贴板拒绝写入，可直接点击页内按钮重试。切换页面或关闭即取消，不把失败降级为复制源码或图片地址。
- 复制按钮固定在浮层右上角，支持鼠标与键盘操作；只替换本扩展预览的文本复制。命令仅信任当前通道的图片复制入口，并校验帧编号、文档版本与当前编辑器，防止旧按钮复制其他公式。复制模块按点击加载，普通预览不额外渲染或创建 Webview。

### English

- Fix the preview flashing on every typed character. Refresh the current hover without hiding it first, and apply the new image style before retiring the previous one. While the editor retains focus, keep the last frame visible through native keyboard dismissal and asynchronous rendering. Reposition the preview caret without rebuilding the scroll container, then release snapping; leaving the formula, losing focus, and Esc still dismiss it. Copy buttons retained with the hover read the current valid image and become invalid after dismissal.
- Make the upper-right preview button copy the complete formula as a transparent PNG, including content outside both scroll axes. Preserve the current preview ink color and omit the editing caret, floating background, border, shadow, and scrollbars. Export at 2× pixel density by default with 4px transparent margins; scale oversized images proportionally within 8192px per edge and 16 million total pixels.
- Use the same VS Code Webview Canvas and image clipboard APIs on Windows, macOS, and Linux, without extra tools, native modules, network access, or platform scripts. Open a temporary conversion page only when copying, then close it and return to the editor after success. If clipboard access is denied, retry with the page’s copy button. Switching away or closing cancels; failures never copy source text or an image URL instead.
- Keep the mouse- and keyboard-accessible copy button at the upper right, replacing text copy only in this extension’s preview. Trust only the current channel’s copy command and validate the frame ID, document version, and active editor so stale buttons cannot copy another formula. Load the copy module only on click, without extra rendering or Webviews during ordinary preview.

## 0.3.3 - 2026-09-12

### 中文

- 公式浮层改为可交互的双向滚动窗口：过宽或过高时保留实际字号，通过横向/纵向滚动查看其余部分；滑块宽 5px、操作轨道 8px，颜色跟随主题，保留圆角和悬停反馈。默认上限为 960×500px，并进一步限制在当前编辑器可用空间内，不再缩小整张长图。完整 SVG 由浮层样式绘制，避免原生悬浮 Markdown 的 10 万字符截断让大公式变空白，不增加磁盘读写。
- 打开预览或继续编辑时，从已有 SVG 光标提取横纵坐标，优先显示其周围内容；首次定位完成后解除吸附，手动滚动位置保持到下一次编辑或移动源码光标。没有可用渲染光标时使用源码位置近似定位，不增加 TeX 标记或额外渲染请求。
- 长宽公式自动选择编辑行上方或下方的空间，始终优先避开编辑位置；高度上限不依赖文件末尾空行。行间数学公式使用原字号的 85%，行内公式保持原字号，表格/TikZ 保留各自的比例。CSS 宽高上限约束滚动窗口；长公式的光标避让优先于自定义定位。
- 使用 VS Code 原生悬浮组件接收滚轮和拖动操作，通过公开 API 按需显示；不改工作台文件或用户设置。离开公式、切换编辑器、关闭预览及失败时立即隐藏旧图并阻止迟到更新。正式/测试通道同时提供预览时，测试通道优先使用同一个原生浮层，避免重复图片和相互关闭。浮层获得焦点时 Esc 仍可关闭，并拦住另一通道在同一光标位置的迟到图片。
- 更新全部 11 种 README 语言和中英 CSS 说明。本机核验包括真实 Worker 渲染、光标坐标、缩放、API 生命周期、原生悬浮 DOM/CSS 组件的滚动与窄视口检查；未启动新的 Extension Host，也不将组件验证当作所有 VS Code 衍生编辑器的实机验收。

### English

- Make the floating formula preview scrollable in both directions. Wide or tall formulas retain their actual font size; scroll horizontally or vertically to see the rest. Use 5px themed thumbs with 8px interaction tracks, rounded corners, and hover feedback. The default limit is 960×500px, further constrained by available editor space, without shrinking the full image. Draw the complete SVG through preview styles to avoid the native hover’s 100,000-character Markdown truncation blanking large formulas, without disk I/O.
- When opening or editing, extract both coordinates from the existing SVG caret and initially show its surroundings. Release scroll snapping after initial placement so manual scrolling persists until the next edit or source-caret move. Fall back to an approximate source position when no rendered caret is available, without additional TeX markers or render requests.
- Place oversized formulas above or below the editing line, prioritizing an unobstructed editing position. Height limits do not depend on trailing blank lines. Display math uses 85% of its previous font size; inline math stays unchanged, and tables/TikZ retain their own scales. CSS size limits constrain the scroll viewport; oversized formulas prioritize caret avoidance over custom positioning.
- Use VS Code's native hover for wheel and scrollbar interactions, shown on demand through public APIs without modifying workbench files or user settings. Hide stale images immediately on leaving a formula, switching editors, dismissing, or failing, and reject late updates. When release and test channels both provide a preview, the test channel takes priority in the shared native hover to avoid duplicate images and conflicting dismissal. Esc also works while the hover has focus and suppresses late frames from the other channel at the same caret position.
- Update all 11 README languages and the Chinese/English CSS guide. Local checks cover real Worker rendering, caret coordinates, scaling, API lifecycle, and scrolling/narrow viewports in a native-hover DOM/CSS component. No new Extension Host was launched; component checks do not imply acceptance on every VS Code derivative.

## 0.3.2 - 2026-09-12

### 中文

- 修复公式靠近文件末尾、后面没有空行时预览随滚动异常缩小的问题：不再用可见源码行数估算窗口高度，改由现有 CSS 内容视口边界限制图片尺寸。同一公式无需添加空行即可保持正常大小，软换行和折叠源码也不会再压低高度估算。
- 保留图片比例、自定义最大宽高、分屏边界、源码避让及 Notebook 占位；可用空间足够时保留预览原尺寸，空间不足时按真实边界缩小。不修改用户文档、不增加轮询或渲染请求。

### English

- Fix previews shrinking while scrolling near the end of a file without trailing blank lines. Stop estimating viewport height from visible source-line counts and let the existing CSS content-viewport bounds constrain the image. Formulas no longer need extra blank lines to retain their size; wrapped or folded source lines no longer reduce an estimated height.
- Preserve image aspect ratio, custom maximum dimensions, split-editor bounds, source avoidance, and Notebook spacing. Keep the natural preview size when space permits and scale to the actual bounds otherwise, without editing documents or adding polling or render requests.

## 0.3.1 - 2026-09-12

### 中文

- 修复复杂公式单独显示等号左右两边正常、完整组合却只剩空白背景的问题：表格线后处理仅操作带有明确标记的表格线，不再把分数线、根号横线、光标或裁剪矩形误当成表格线；替换矩形时保留完整的 SVG 标签结构，不跨坐标组配对。
- 拉伸图形的 SVG 展平改为按标签顺序处理全部内层视口，取消原来只处理前 32 项的限制，覆盖包含大量根式、长箭头、上下括弧的长公式；保留现有尺寸和资源上限。
- 预览光标插入长度、定界符或宏定义参数导致渲染失败时，只重试一次不带预览光标的原公式。正常公式不增加渲染请求；取消、过期响应和切换编辑器仍立即停止，真正无效的公式保留错误处理。
- 修复刚输入 `$` 和单个反斜杠时把内部光标命令显示成公式的问题：空公式不发起渲染并清除旧预览；未完成反斜杠不再转义光标标记。保留合法的反斜杠、斜线、转义字符和已有数学内容，不改写源码。
- 本机核验覆盖原始公式及拆分对照、长高与嵌套组合、SVG 结构/几何、光标位置及控制器取消行为；未运行新的 Extension Host 图形界面验收。另按用户要求提供只保存在本地的全面手动测试手册与可编辑公式样本，明确区分正常用例、输入边界和未支持写法。

### English

- Fix complex formulas that display either side of an equation separately but leave only an empty background when combined. Restrict table-rule processing to explicitly marked table rules, excluding fraction bars, radical bars, carets, and clip rectangles. Replace complete SVG rectangle elements and keep rule pairing within the same coordinate group.
- Flatten every nested SVG viewport in tag order instead of stopping after 32 items. Cover long formulas with many radicals, extended arrows, and over/underbraces while preserving existing size and resource limits.
- If inserting the preview caret into a length, delimiter, or macro-definition argument causes a render failure, retry the unmarked formula once. Normal formulas need no extra render request; cancellation, stale responses, and editor switches still stop updates, and genuinely invalid formulas retain error handling.
- Fix internal caret commands appearing as formula content after typing `$` followed by a single backslash. Empty formulas skip rendering and clear the previous preview; an unfinished backslash no longer escapes the caret marker. Preserve valid backslashes, slashes, escaped characters, and existing math without editing the source.
- Local checks cover the reported formula and its separate sides, long/tall nested combinations, SVG structure and geometry, caret positions, and controller cancellation. No new Extension Host GUI acceptance was performed. Provide a comprehensive local-only manual and editable formula samples as requested, distinguishing normal cases, input boundaries, and unsupported syntax.

## 0.3.0 - 2026-09-11

### 中文

- 汇总 0.2.9–0.2.16 的本地改进并统一发布为 0.3.0，提供正式与测试两个独立通道安装包；保留现有设置与用户快捷键，README 继续提供全部 11 种语言。
- 数学补全支持按语言选择 `on`、`off`、严格 `manual`，与预览独立。命令升级为参数 snippet，支持文档宏、宏包候选、环境、公式内标签/引用/文献键及自定义模板；已有参数与未保存修改得到保留。补全限定公式范围，不扩展到正文或图片路径。
- 状态栏提供数学补全模式设置，以及覆盖全部 31 个公开操作的快捷键管理入口；截图、识图、缩放、暂停等操作均可自行改键。严格手动补全使用 Silk 的触发命令，专用按键仅在 `manual` 下生效；普通输入不会意外启动 Silk 补全。
- 预览与补全分别支持 `*.tex`、文件名和相对/绝对路径排除规则，也可单独排除或恢复当前文件的预览、补全或两者。规则通过直接编辑菜单增删改，空列表始终可添加；支持用户、工作区、文件夹与语言范围，保留旧类型规则和 Notebook 行为。
- 修复测试版多行公式预览偏入行号区，以及光标停留于表尾 `\\` 后或 `\hline` 前后时多出一行的问题。修复排除设置入口空白、外部恢复文件后排除状态未同步，以及无参数暂停命令行为错误。
- OCR 与设置编辑按需加载，预览/补全共享扫描模块，界面共用翻译；复用有界补全文本、配置和模板缓存，减少重复读取与序列化。采用 UTF-8 构建，修改 OCR/补全设置不再清空预览图片。保留安装包与启动代码的体积检查。
- 按维护要求移除测试源码和内部材料的 Git 跟踪，保留公开使用指南；提交、推送和 CI 检查发布文件边界，VSIX 使用明确允许列表。GitHub 自动发布保留中英双语说明和两份安装包；关闭 Marketplace 自动发布，由维护者手动上传。
- 严格手动模式需要绑定 Silk 命令，其他扩展仍可能贡献重复候选；动态引用和部分复杂 TeX 定义仍有边界，不宣称完整替代 LaTeX Workshop。验证范围为本机逻辑、构建、渲染与包内容，未新增实机快捷键或 Extension Host 图形界面验收。

### English

- Consolidate the local improvements from 0.2.9–0.2.16 into 0.3.0, with separate release and test installers. Preserve existing settings and user keybindings, and retain all 11 README languages.
- Add per-language `on`, `off`, and strict `manual` math completion independently of preview. Provide argument snippets, document macros, package candidates, environments, formula-local labels/references/citation keys, and custom templates. Preserve existing arguments and unsaved edits. Keep completion inside formulas rather than prose or image paths.
- Expose completion mode settings and shortcut management for all 31 public actions, including capture, image recognition, scaling, and pauses. Strict manual completion uses Silk’s trigger command, with dedicated keys active only in `manual`; ordinary typing does not unexpectedly start Silk completion.
- Configure preview and completion exclusions independently with `*.tex`, filenames, and relative/absolute paths, or exclude/restore preview, completion, or both for the current file. A direct rule menu supports adding, editing, and deleting even from an empty list, with User/Workspace/Folder and language scopes, legacy type rules, and notebook support.
- Fix test-build multiline previews drifting into the gutter and an extra table row when the caret follows the final `\\` or surrounds a trailing `\hline`. Fix empty exclusion settings navigation, stale exclusions after external file restoration, and incorrect parameterless pause behavior.
- Load OCR and settings editing on demand, share scanning between preview/completion, and share UI translations. Reuse bounded completion text, configuration, and template caches to reduce repeated reads and serialization. Emit UTF-8 bundles and retain preview images when OCR/completion preferences change. Keep installer and startup-code size checks.
- Remove tests and internal materials from Git tracking as requested, while retaining public usage guides. Check publication boundaries before commits, pushes, and in CI; package VSIX files with an explicit allowlist. Keep bilingual GitHub releases with both installers, and disable automatic Marketplace publishing in favor of manual maintainer uploads.
- Strict manual mode requires the Silk command; other extensions may still contribute duplicate candidates. Dynamic references and some complex TeX definitions remain limited, without claiming to replace all of LaTeX Workshop. Verification covers local logic, builds, rendering, and package contents, without new physical-keyboard or Extension Host GUI acceptance checks.

## 0.2.16 - 2026-09-11

### 中文

- 修复文件排除入口打开空白设置搜索页的问题：改用直接编辑菜单，空列表也显示预览/补全的添加入口；支持编辑、清空删除、用户/工作区/文件夹和语言范围，保留旧类型规则、保存失败提示及设置更新延迟保护。
- 新增“修改各项快捷键…”入口，列出全部公开操作并准确定位 VS Code 的对应命令；截图等没有默认按键的操作也能绑定。补齐关闭预览的命令名称，修复无参数暂停命令，提供独立的暂停 30 分钟/结束暂停命令；文件类型开关自动使用当前文件。保留默认与用户键位，数学补全专用触发仍仅限 `manual`。
- 截图/OCR 控制器与设置编辑模块按需加载；主扩展与可选模块共享界面翻译，预览与补全共享公式扫描。构建使用 UTF-8 文本减少冗长的 Unicode 转义。补全复用有界的文档文本与配置缓存，避免同次请求多次读取全文，以及每次请求序列化整套自定义模板。修改 OCR/补全设置不再清空预览图片缓存。
- 打包脚本直接调用本地 Node 工具，减少子进程；失败后也恢复正式通道清单。补充启动模块合计体积检查，保留主模块与安装包的原有上限；同步 11 种 README 语言及双语使用说明。

### English

- Fix the file exclusion entry opening an empty Settings search. Use a direct rule menu with preview/completion Add actions even when empty. Support editing, clearing to delete, User/Workspace/Folder and language scopes, legacy type rules, save errors, and delayed configuration updates.
- Add “All keyboard shortcuts…” to list every public action and open its exact VS Code command. Actions without default keys, including capture, can also be bound. Name Dismiss Preview, fix parameterless pause, add separate 30-minute pause/resume commands, and make the file-type toggle use the active file. Preserve defaults and user bindings; Silk’s dedicated completion trigger remains limited to `manual`.
- Load capture/OCR controls and settings editing on demand. Share translations across UI modules and math scanning between preview and completion. Emit UTF-8 text to reduce verbose Unicode escapes. Reuse bounded document text and configuration caches, avoid repeated full-document reads within a request, and stop serializing all custom templates on every request. OCR/completion preference changes no longer clear preview images.
- Run local Node tools directly when packaging, reducing child processes and restoring the release manifest even on failure. Check the combined startup module size while retaining existing main-module and installer limits. Update all 11 README languages and the bilingual usage guide.

## 0.2.15 - 2026-09-11

### 中文

- 新增“编辑文件排除规则…”菜单及命令，直接打开预览和补全的独立文件规则列表；支持 `*.tex`、指定文件名、工作区相对路径、绝对路径及 `*` / `?` / 整段 `**`，默认空列表。旧文件类型设置继续生效，存在非空配置时也会显示在编辑入口中。
- 文件恢复操作改用恢复图标，菜单显示仍生效的具体排除规则。同步 VS Code 更新后的工作区排除记录，避免外部恢复后仍使用旧缓存；保留快速操作的串行保存和失败回滚，不主动添加或清空用户的排除记录。
- 文件匹配模块仅在配置了规则时加载，按文档缓存结果；配置、语言、路径或 Notebook 归属变化后更新，不扫描目录。更新 11 种界面/README 语言与双语补全指南。

### English

- Add “Edit file exclusion rules…” to the menu and Command Palette, opening independent preview/completion file-rule lists. Support `*.tex`, specific filenames, workspace-relative and absolute paths, and `*` / `?` / whole-segment `**`; lists default to empty. Existing file-type settings still apply and also appear in the editing entry when configured.
- Use a restore icon for file restoration and show a specific rule that still excludes the file. Observe updated VS Code workspace exclusion records instead of retaining stale state after an external restore. Keep serialized saves and failure rollback for rapid actions, without automatically adding or clearing user exclusions.
- Load file matching only when rules are configured and cache results by document. Refresh after configuration, language, path, or notebook-association changes, without scanning directories. Update all 11 UI/README languages and the bilingual completion guide.

## 0.2.14 - 2026-09-11

### 中文

- 新增独立的 `preview.excludeFileTypes` 与 `completion.excludeFileTypes` 设置，按扩展名或 VS Code 语言 ID 排除预览、数学补全，默认空列表；支持用户、工作区、文件夹与语言覆盖，Notebook 按所属文件判断。
- 当前文件菜单拆分为预览、补全、两者三个排除/恢复操作，各自立即生效并保存在本地工作区状态中。旧排除记录继续只影响预览；恢复文件不会覆盖文件类型规则、预览开关或补全模式，菜单会提示仍生效的类型排除。
- 排除补全时同时禁止自动与手动候选，撤销待处理请求并释放补全工程索引；单独排除预览不会关闭补全，单独排除文件补全不会清除预览。缓存文件类型判断，配置变化时失效。
- 清除未使用的旧悬浮菜单渲染代码和说明文字，更新 11 种界面/README 语言及双语指南；正式与测试版的配置、命令和文件排除记录相互独立。

### English

- Add independent `preview.excludeFileTypes` and `completion.excludeFileTypes` settings to exclude preview or math completion by extension or VS Code language ID. Both default to empty lists and support user, workspace, folder, and language overrides. Notebook cells use their parent file.
- Split current-file actions into preview, completion, and combined exclusion/restore controls. Changes apply immediately and persist in local workspace state. Existing exclusions retain their preview-only meaning. Restoring a file does not override type rules, preview switches, or completion mode; the menu indicates remaining type exclusions.
- Completion exclusions block automatic and manual candidates, invalidate pending requests, and release the completion project index. Excluding preview leaves completion available; excluding a file's completion leaves its preview intact. Cache file-type decisions and invalidate them when configuration changes.
- Remove unused legacy hover-menu rendering and copy. Update all 11 UI/README languages and the bilingual guide, keeping release/test settings, commands, and file exclusion records separate.

## 0.2.13 - 2026-09-11

### 中文

- 修复表格预览在光标停留于最后一个 `\\` 之后、末尾 `\hline` 前后或附近空白处时多出一行的问题：仅由预览光标构成的末行不再被当作表格内容，保留末尾横线及双横线。
- 单元格内的光标继续显示；已输入的文字、公式及用 `&` 开始的单元格保持不变。边界判断复用表格行解析，只处理末行，不修改文档源码。

### English

- Fix an extra preview row when the caret rests after the final `\\`, before or after a trailing `\hline`, or in nearby whitespace. A trailing row containing only the preview caret no longer counts as table content; keep bottom rules and double rules intact.
- Keep the caret visible inside cells and preserve entered text, formulas, and cells started with `&`. Reuse table row parsing and check only the final row, without changing the source document.

## 0.2.12 - 2026-09-11

### 中文

- 状态栏菜单新增“数学补全模式…”并显示当前语言和生效模式；点击直接打开该语言的 VS Code 补全模式设置，下拉选择 `on`、`off` 或 `manual`。命令面板也可打开此设置，补全与预览继续独立。
- 修正 0.2.11 的快捷键范围：Silk 专用触发按键、命令及改键入口仅在 `manual` 下启用；`on` 保持自动补全与 VS Code 原有按键行为，`off` 不提供 Silk 候选。兼容 0.2.11 复制的自定义按键条件，同样限制为手动模式。
- README 与菜单的 11 种语言、双语补全指南同步说明设置位置、自动触发方式及手动按键范围；改键菜单文字缩短，正式与测试通道保持隔离。
- 修复测试版的多行公式预览偏到左上角、压住行号区的问题：预览层移到正文布局之后，使视口和源码坐标可被正确引用；覆盖独立 `align` 环境及数学分隔符内的环境，正式与测试版仍独立显示。

### English

- Add “Math completion mode…” to the status menu, showing the current language and effective mode. Open that language's VS Code setting directly and select `on`, `off`, or `manual` from the dropdown. The Command Palette can open the setting too; preview remains independent.
- Correct the shortcut scope introduced in 0.2.11: enable Silk's dedicated trigger keys, command, and shortcut settings entry only in `manual`. Preserve automatic completion and native VS Code key behavior in `on`; provide no Silk items in `off`. Custom key conditions copied from 0.2.11 remain compatible, now restricted to manual mode as well.
- Update all 11 README and menu languages and the bilingual completion guide with the setting location, automatic triggers, and manual shortcut scope. Shorten the shortcut menu labels and keep release and test channels separate.
- Fix multiline formula previews drifting into the top-left gutter in the test build. Move its overlay after the source layout so viewport and source coordinates can be resolved, covering standalone `align` environments and environments inside math delimiters while preserving separate release/test overlays.

## 0.2.11 - 2026-09-11

### 中文

- 状态栏菜单新增“修改数学补全快捷键…”入口，直接打开并定位 VS Code 的数学补全按键设置；命令面板也可打开此设置。菜单和 README 的 11 种语言同步更新。
- 默认 `Ctrl+Space`、自定义快捷键和 Silk 数学补全命令在 `on` 与 `manual` 模式下均可使用；`off` 不提供 Silk 候选。列表打开时保留 VS Code 的原有按键操作，正式版与测试版保持独立命令和按键。
- 避免后台打开文件或后台编辑器选区变化打断当前手动补全；调用失败时清除此次请求，保留文档、位置、版本及过期检查，普通输入仍不会启动严格手动补全。

### English

- Add “Change math completion shortcut…” to the status menu, opening VS Code's keybinding settings filtered to the math completion command. The settings entry is also available in the Command Palette. Update all 11 menu and README languages.
- Make default `Ctrl+Space`, custom shortcuts, and the Silk math completion command available in both `on` and `manual`; `off` provides no Silk items. Preserve VS Code's existing key behavior while the list is open, with separate commands and shortcuts for release and test builds.
- Keep background document opens and inactive editor selection changes from interrupting manual completion. Clear a request when invocation fails while retaining document, position, version, and expiry checks; ordinary typing still does not start strict manual completion.

## 0.2.10 - 2026-09-10

### 中文

- 补全候选复用排序和匹配信息，只为当前选中的候选生成详细说明；一次请求共用替换范围，减少输入时的对象创建和重复计算。
- 公式扫描直接跳到分隔符、注释和代码标记；普通正文提前跳过补全与诊断的定义读取，相同版本与定义下的诊断复用结果。
- 公式引用索引复用完整查询结果，无关文件编辑不会取消当前索引；保留未保存内容、依赖变更和缺失文件创建时的更新，闲置 60 秒释放索引与监听器。
- 清除自动测试、一次性验证脚本、过期报告及旧文字补全代码，移除测试依赖。内部工作记录只留本地；增加 Git 提交、推送和 CI 的文件范围检查，VSIX 改用明确的文件允许列表。公开使用说明和运行所需资源保留。

### English

- Reuse completion sorting and matching metadata, generate detailed documentation only for the focused item, and share the replacement range within a request to reduce allocations and repeated work while typing.
- Scan directly to delimiters, comments and code markers. Skip definition reads for ordinary prose and reuse diagnostics when the document version and definition context are unchanged.
- Reuse complete formula-reference index results without cancelling them for unrelated edits. Preserve updates for unsaved content, dependency changes and newly created missing files; release the index and watchers after 60 seconds of inactivity.
- Remove automated tests, one-off validation scripts, obsolete reports, legacy text completion code and test dependencies. Keep internal work notes local; add commit, push and CI file checks and an explicit VSIX allowlist. Retain public usage guides and required runtime resources.

## 0.2.9 - 2026-09-10

### 中文

- 新增按语言覆盖的 `silkMath.completion.mode`：`on`（默认）、`off`、严格 `manual`，关闭补全不影响预览。手动模式通过 `Ctrl+Space` 或 `silkMath.triggerCompletion` 提供候选；自定义快捷键需绑定 Silk 命令，避免 VS Code 将普通输入也标记为 Invoke 导致意外自动补全。
- 数学命令升级为参数 snippet，补充分式、根式、字体、重音、积分/求和上下限、配对定界符和数学环境。已有参数与命令后缀得到保留；可选参数变体可关闭，自定义 snippet 可覆盖或隐藏命令。
- 词库在构建时从固定 MathJax 4.1.3 提取，补全模块按需加载，不引入渲染器。宏包候选遵循声明或显式配置；文档重新定义的命令优先，保留未保存的依赖宏、参数默认值和复杂定义限制。
- 公式内增加标签、引用和文献键补全：读取当前文档、可达章节、文本 notebook 单元格、已声明的本地 `.bib` 和 `bibitem`，支持前向引用、未保存修改、标题/作者/年份、逗号列表及不重名的新标签。索引按需创建并有文件和内存上限。
- 补全请求取消、文档变化、配置关闭或定义失效后拒绝迟到结果；不在普通正文、图片路径、注释和 Markdown 代码中扩展补全。README 全部 11 种语言同步说明，增加中英使用文档与 issue 源码对照记录。
- 本轮仅做本机类型、单元回归、构建、性能和双通道 VSIX 检查；未启动浏览器或 Extension Host。原生 Trigger Suggest 的所有入口无法由公开 API 区分，严格 manual 需要 Silk 命令；其他扩展的候选仍可能重复，动态引用及部分 TeX 命令仍有限制，不宣称完整替代 LaTeX Workshop。

### English

- Add language-overridable `silkMath.completion.mode`: `on` (default), `off`, and strict `manual`, independently of preview. Manual completion uses `Ctrl+Space` or `silkMath.triggerCompletion`; custom bindings must call the Silk command because VS Code also marks ordinary typing as Invoke.
- Upgrade math commands to argument snippets for fractions, roots, fonts, accents, integral/sum limits, paired delimiters, and math environments. Preserve existing arguments and command suffixes; optional-argument variants can be disabled, and custom snippets can override or hide commands.
- Extract the symbol catalog at build time from pinned MathJax 4.1.3, and load completion code on demand without importing a renderer. Package candidates follow declarations or explicit configuration. Document redefinitions take precedence, with unsaved dependency macros, optional defaults, and complex-definition limitations preserved.
- Add formula-local label, reference, and citation key completion from the current document, reachable chapters, notebook markup cells, declared local `.bib` files, and `bibitem` entries. Support forward references, unsaved changes, title/author/year details, comma lists, and new unique labels. Create the index on demand with file and memory limits.
- Reject stale completion results after cancellation, document changes, configuration changes, or definition invalidation. Do not expand completion into prose, image paths, comments, or Markdown code. Update all 11 README languages and add a Chinese/English guide and source comparison record.
- Verification is limited to local types, unit regressions, builds, performance, and both VSIX channels; no browser or Extension Host was launched. The public API cannot distinguish all native Trigger Suggest entry points, so strict manual requires the Silk command. Other extensions may still offer duplicate items; dynamic references and some TeX commands remain limited. This is not a claim of fully replacing LaTeX Workshop.

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
