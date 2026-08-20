# Silk Math Preview 协作规范

## 2026-08-20 默认预览 140% 显示为 100%（0.1.24）

- `silkMath.previewScale` 默认 `1.4`。界面百分比 = 实际倍率 / 1.4。

## 2026-08-20 Jupyter 跨单元格宏（0.1.23）

- `.ipynb` 每个 markdown 单元格是独立 TextDocument。作业里第一格
  `$\def\A{\mathbf{A}}$`，后面格子用 `\A` 会被标成未知命令。
- 预览当前格时，收集该格及之前所有 markup 格的定义。代码格不参与。

## 2026-08-20 underbrace 空白预览（0.1.22）

- `\underbrace{...}_{...}` 的拉伸横杠是**内层 `<svg>`**。`/<svg>[\s\S]*?<\/svg>/` 吃到
  内层结束就把根 SVG 截断，装饰仍有宽高（空面板）但图加载失败。
- 同类：`\overbrace`、`\overline`、`\underline`、可拉伸 `\sqrt`。提取必须按嵌套深度配对。

## 2026-08-20 OCR 智能混排与预处理（0.1.21）

- MFR 输入禁止拉伸：按比例 letterbox + 10% 留白。VS Code 深色截图先按内容区平均亮度反相。
- 默认智能模式：整段更像公式就走 MFR；否则按 OCR 行拆，像公式的行再裁出来跑 MFR，其余保留文字。
- 面板 UI 与设置卡片同一套 chip/ghost；模型仍按需下载。

## 2026-08-20 长公式上半段选中预览消失（0.1.20）

- decoration 的 `before` 挂在公式首行。长 `aligned` 把首行滚出视口后，VS Code 虚拟化
  掉那一行，绝对定位的浮层整块不画。锚点改为视口与公式重叠的最后一行（above 则第一行），
  `onDidChangeTextEditorVisibleRanges` 只 reposition，不跑 MathJax。
- 选区用 overlap 判断，不能只看 `selection.active`：往上拖时 active 可能暂时越界。

## 2026-08-20 状态栏点击设置卡片（0.1.19）

- 用户不要下方面板那种整条占位，要点击 Silk Math 出现 Copilot 那种小卡片。
  扩展无法把 webview 锚在状态栏上方（`statusBar.entry.showTooltip` 只给核心用），
  最接近且能自定义 UI/动画的是 **右侧辅助栏** 里一张紧凑卡片。
- 关掉即 `retainContextWhenHidden: false`，浮层不重复渲染 SVG。Esc 在
  `silkMath.flyoutVisible` 时收起卡片。

## 2026-08-20 详情页图片与开源仓库（0.1.18）

- 详情页图片空白的真正原因不是 CSP（CSP 写着 `img-src https: data:`），而是
  `renderMarkdownDocument` 的 sanitizer 默认只放行 `http`/`https` 的 `src`，
  `data:` 和相对路径都会被剥掉，留下没 src 的空白 `<img>`。
- 正确做法：README 写 `media/*.png` 相对路径，`package.json` 填 GitHub `repository`，
  vsce **不要** `--no-rewrite-relative-links`，打包时改写成
  `https://github.com/<owner>/<repo>/raw/HEAD/media/...`。PNG 仍不进 VSIX。
- 不要再试 data URI / file: / vscode-file:。公开仓库
  https://github.com/zhoujasper/silk-math-preview

## 2026-08-20 详情页介绍重写（0.1.17）

- 用户指出扩展详情页介绍写得很差：重复的大标题、VSIX 安装命令、逐步操作清单、配置键表格，
  读起来像开发文档。详情页已经有 displayName，README 不再写一级标题。
- 改成中英两段对照的介绍：做什么、支持什么、三个入口（快捷键 / 控制面板 / 截图）。
  不写 debounce、trace、诊断命令、包体限制、示意图 CSP。
- `package.json` description 与标语对齐，去掉「源码光标同步 / source-synced caret」。

## 2026-08-20 自绘控制面板（0.1.16）

- 用户要「点击打开、像 Copilot 那样自己渲染、编辑时实时反应」的面板。状态栏悬浮框做不到，
  于是改用 **webview view + panel 视图容器**：`ControlPanelProvider` 自绘 HTML，
  状态栏点击执行 `silkMath.togglePanel`（可见就关掉下方面板，否则 focus 这个 view）。
- 实时刷新链路：`PreviewController` 新增 `onDidRender` 事件，每次渲染成功/失败/清空都推一帧
  （含 SVG 原文、耗时、文件名、行号）。面板不可见时只存最后一帧，不做任何序列化工作。
  SVG 直接 `innerHTML` 进 webview——内容已经过 `sanitizeStandaloneSvg`，且 webview CSP 有 nonce，
  SVG 里的脚本不可能执行。
- 注意：`viewsContainers` 的 `icon` 必须是文件路径，不能写 `$(codicon)`；已加 `resources/panel-icon.svg`。

## 2026-08-20 诊断命令、状态栏点击与详情页图片结论（0.1.15）

- **详情页图片：结论是做不到**。逐一验证过：相对路径 PNG 不行；内联 `data:` URI 也不行
  （已确认打包后的 base64 能字节还原成原 PNG，问题不在我们这边）。VS Code 扩展详情页只放行
  https 图片，本地 VSIX 没有可托管的地址。README 因此去掉示意图，图留在 `media/`。
  不要再在这上面反复尝试。
- **状态栏浮层**：扩展只能用 MarkdownString tooltip，且没有任何 API 能用点击打开它；
  Copilot 那个面板是 VS Code 核心自己渲染的。结论：悬停出面板，点击退回列表菜单。
- 新增 `silkMath.diagnoseFormula`：光标所在公式的语言判定、区域、表达式、渲染结果一次性打印。
  用户报“这条不显示”而本地扫掠全绿时，先让他跑这个命令，别再靠猜。
- 用户反馈 `\underbrace{...}_{=0 \text{ by the PDE}}` 仍不显示。已再次确认：带真实 cls prelude、
  `markUnknownCommands` 开和关两种模式下，该公式 229 个光标位置全部渲染成功、无空白。
  0.1.14 打包产物里的兜底判据也确认是修好的版本（bundle 里无控制字符）。
  因此问题只可能在 VS Code 侧（未重载、旧扩展宿主、或光标落在区域边界之外），等诊断输出。

## 2026-08-20 0.1.13 回归修复、悬浮面板与详情页图片（0.1.14）

- **0.1.13 把基础功能弄坏了**：空白兜底的正则是用 shell heredoc 写进源码的，`\b` 被 shell
  吃成了字面退格符（0x08），判据永远不匹配，于是每条公式都提示“渲染结果为空”。
  两条教训：① 含反斜杠的代码不要用 shell heredoc / `node -e` 写，用 Write 工具或脚本文件；
  ② 新增“兜底判据”这类会否定正常路径的逻辑，必须同时补一个正例测试。
  已加 `正常公式的 SVG 一定含可见图元` 用例，并全量扫过源码确认没有别的控制字符。
- 状态栏 `Silk Math` 去掉 command：挂了 command 点击就会弹顶部命令面板，
  而需求是鼠标悬停出现的浮层面板（MarkdownString tooltip）。键盘入口保留在命令面板。
- **详情页图片一直空白的真正原因**：VS Code 扩展详情页 webview 的 CSP 是
  `img-src https: data:`，相对路径 / `file:` / `vscode-file:` 图片全部被拦，和 PNG、SVG 无关。
  唯一可行的是内联 `data:` URI。`scripts/make-media.mjs` 现在把 PNG 转成 base64 写进 README 末尾的
  引用式定义块（`<!-- images:start -->`），正文用 `![alt][hero]` 引用；PNG 本身不再进 VSIX。
  代价：README 220 KB。示意图缩到 1.5x 以控制体积。
- 本轮流水线：15 files / 139 tests 全通过；main bundle 103,963 B；
  cold p95 `139.6 ms`，warm p95 `20.5 ms`。产物 `silk-math-preview-0.1.14.vsix`，
  `1,341,390` bytes，SHA-256 `6A69A9638F5CEB31BAB30FADE7480CD96FA3995C0677E71BD65D439A434B2DF7`，14 个条目。

## 2026-08-20 嵌套环境、红色未知命令与状态栏悬浮面板（0.1.13）

- **`$$ \begin{equation} ... \end{equation} $$` 一直完全不显示**：分隔符区域的内容还套着一个
  顶层环境，渲染时表达式被放进 `\begingroupSandbox{...}` 分组，MathJax 报
  “Erroneous nesting of equation structures”。环境区域早就有 `INNER_PREVIEW_ENVIRONMENTS`
  归一化（equation 去壳、align→aligned），但分隔符区域从来没走这条路。
  实测用户的 `Lab 1.ipynb`：59 处公式、1362 个光标位置由 **全部失败** 变为 0 失败。
  Jupyter/Markdown 里这种写法极常见，notebook 支持基本卡在这一条上。
- 未定义命令改为红色原文（MathJax `noundefined` 扩展，`silkMath.markUnknownCommands` 默认开）。
  注意它会让「未定义命令」不再抛错，因此 ContextPool 的 key 必须带上这个开关，
  `evict` 也要用同一个 key——否则出错的上下文驱逐不掉，下一次渲染会报
  “Missing \begingroup or extra \endgroup”。
- 错误信息一直显示 `[object Object]`：MathJax 抛的是 `TexError` 这类普通对象，
  `error instanceof Error` 为假。统一用 `describeError()` 取 `.message`/`.id`。
- 渲染成功但没有任何 `<path>/<text>` 时也当失败处理，避免留一个空白面板。
- 新增 `silkMath.trace`：把表达式、尺寸、错误写进输出面板。用户报「空白面板」这类
  无法在 harness 复现的问题时，先让他们开这个再看日志，别硬猜。
- 状态栏拆成两个 item：`$(screen-full)` 直接进 OCR，`Silk Math` 文字承载
  **可信 MarkdownString 悬浮面板**（command 链接 + `$(check)` 图标 + `−/+` 调预览大小 +
  刻度条），风格对齐 Copilot；点击文字仍打开等价的 QuickPick，保证键盘可达。
- 配置写入要逐个作用域退让：插件就地升级后配置 schema 还没重新注册，
  写工作区会抛「没有注册配置」，此时退回全局，最后提示重载窗口。
- 本轮流水线：15 files / 138 tests 全通过；覆盖率 stmts/branch/lines
  `94.09%/88.99%/96.25%`。main bundle 103,957 B。基准 cold p50/p95 `133.5/148.0 ms`，
  warm p50/p95 `12.0/20.3 ms`。四份文档 + 一个 notebook 全量扫掠共 44,369 个光标位置，
  除 TikZ（已明确提示）外 0 失败。
- 产物：`silk-math-preview-0.1.13.vsix`，`1,414,156` bytes，SHA-256
  `E9E5C0A9406C50BD540C94B7B1A89EDC2AF2F8093C790AB64D235FF1C217ED62`。
- 未做：`\underbrace{aersd}` 报「空白面板」在 harness 里复现不出来（同一表达式所有光标位置
  均正常渲染），已加 trace 与空图元兜底，等用户日志。

## 2026-08-20 依赖解析、环境误判、跨行公式与状态栏菜单（0.1.12）

- **只打开单个文件时，`.cls`/`.sty` 的宏全部失效**：`resolveDependency` 以前要求
  `getWorkspaceFolder()` 存在，否则直接返回 undefined。改成与 LaTeX 一致，先查主文件所在目录，
  工作区存在时再查工作区与 `findFiles`。用户的 `\eps`、`\Ocal` 就是这样丢的。
- **类文件的文本环境被当成公式区域**：`snapshot.environments` 原本把所有自定义环境交给 scanner
  当数学环境。`elegantnote.cls` 的 `question`/`solution` 因此把整段解答变成一条“公式”，
  区域数从 58 掉到 18，里面的 `\[...\]` 全部没有预览。现在只有 begin 部分真正停在数学模式的
  环境才进这个列表（`environmentEntersMathMode`）。
- `\DeclareMathAlphabet{\CMcal}{OMS}{cmsy}{m}{n}` 按字体族折算成 `\mathcal` 等，
  否则 `\newcommand{\Ocal}{\CMcal{O}}` 会因 `\CMcal` 未定义而整条公式失败。
- **行内公式跨行**：`$...$` 原本一遇换行就放弃。真实笔记里 `\scalebox{0.9}{\tiny $` 换行再 `$}`
  很常见，一旦放弃，后面每个 `$` 都和错误的伙伴配对，整篇文档从那里开始全错。现在按 TeX 规则
  跨行，遇空行或 `\par` 才终止。NPDE.tex 上这一改把 1575 次失败降到只剩 TikZ。
- caret 又修了三处：`\text{for |}` 里的 marker 会被当文字打印（文本模式要用 `$...$` 包住）、
  `\frac1|2` 这种无花括号参数缝隙、`\textcolor{名字}|{内容}` 的参数之间。
  另外 `commandArgumentSeam` 的“跳一个 token”分支必须删掉——它会把光标推进
  `\left` 和定界符之间，反而制造新失败。
- 验收方法固化为**真实文档全量扫掠**：遍历每条公式的每个光标位置渲染。
  A1/A2/框架问题梳理三份文档共 19,443 个位置 0 失败；NPDE.tex 23,564 个位置只剩 TikZ
  （已改为直接提示“TikZ/PGF 需要完整 TeX 引擎”，不再静默空白）。
- 渲染失败且当前公式从未成功过时，延迟 400 ms 显示原因（`silkMath.showRenderErrors`）；
  已有可见帧时仍然保留上一帧，不闪烁。
- 状态栏合并为单一 `Silk Math` 入口（`StatusController`）：菜单里控制 LaTeX/Markdown/其他文件
  类型的启用、暂停 5/30 分钟、排除或恢复当前文件、截图识别、打开设置。预览的语言判定改由
  `PreviewPolicy` 提供，OCR 不再单独占状态栏。
- 新增 `silkMath.previewScale`（默认 1.1）与三个 `enableIn*` 开关。
- README 重写为简洁版；示意图由 `scripts/make-media.mjs` 用**真实渲染输出**合成，再用
  headless Chrome/Edge 光栅化为 PNG（Marketplace 不渲染 SVG）。SVG 源不进 VSIX。
- 本轮流水线：15 files / 136 tests 全通过；typecheck 干净；覆盖率 stmts/branch/lines
  `94.18%/89.04%/96.21%`。main bundle 97,645 B。基准 cold p50/p95 `129.52/138.71 ms`，
  warm p50/p95 `13.06/22.74 ms`，scanner p95 `0.59 ms`。
- 产物：`silk-math-preview-0.1.12.vsix`，`1,409,759` bytes，SHA-256
  `3CD8D606C4CD51D12F4EB98C2DE5F20701597FFB43EEE033FFAEE3A23E0B899A`，18 个条目
  （新增 4 张 PNG 示意图，共约 324 KB）。
- 未做：仍未启动 Extension Host 视觉验收；状态栏菜单、暂停与排除逻辑没有自动化测试，
  依赖用户实机确认。

## 2026-08-20 渲染失败根因、颜色定义、输入延迟与 caret 基线（0.1.11）

- 「公式根本渲染不出来」有两类根因，都出在 caret marker 的落点：
  1. `anchorCaret` 把光标吸附到控制词末尾后，marker 停在命令与它的 `{` 之间，命令把 marker
     当参数 → `Missing argument for \class`（`\underbrace`、`\mathcal` 等）。现在任何控制词
     后面紧跟 `{` 的位置都推进组内；已知需要参数的命令即使参数没有花括号也跳过该 token。
  2. `\bigl`/`\Bigr`/`\biggm`/`\middle` 的定界符只保护了 `\left`/`\right`
     → `Missing or unrecognized delimiter`。`DELIMITER_COMMANDS` 现覆盖整个 big 家族。
  实测：用户两份真实文档 282 条公式、2,653 个光标位置，修复前 14 失败，修复后 0 失败。
- 名字类参数（`\textcolor{颜色名}`、`\label`、`\begin` 等）内部不再插 marker：这类破坏不报错，
  只是颜色/引用静默失效，比崩掉更难发现。`PROTECTED_ARGUMENTS` 列出前若干个不可写入的参数。
- 颜色定义：`\definecolor`/`\providecolor`/`\colorlet` 进入定义索引（新 `kind: 'color'`，
  `DefinitionIndex` 增加独立的 colors map 与 `listColors()`），随 `.sty/.cls` 遍历一起生效。
  **MathJax 的 color 扩展只认 `rgb`/`RGB`/`gray`/`named`，`HTML` 和 `cmyk` 会在 prelude 转换时
  直接抛错并污染整个上下文**，所以在解析阶段就折算成 `rgb`，无法折算的只标 limitation。
- prelude 容错：整份 prelude 转换失败时换干净上下文逐行重试，只丢掉无法转换的那一条；
  另加 `COMPATIBILITY_PRELUDE` 补齐 MathJax 没有的 `\emph`、`\ensuremath`、`\textsuperscript`、
  `\bm`、`\cref`、`\footnote`、`\intertext`、`\allowdisplaybreaks` 等，并加载 `boldsymbol`、
  `cancel` 扩展。已实测 MathJax **支持** `\footnotesize`/`\small`/`\mathscr`/`\substack`/`\tag`，
  不必再猜。
- 输入延迟：实测 18k 字符 `.tex` 每次按键光是 `parseDefinitions + parseDependencies` 就要
  p50/p95 `2.5/3.9 ms`，而且它挂在 `await` 上、渲染要等它。现在编辑热路径改用
  `DefinitionWorkspace.peekSnapshot()`（只读已解析结果）+ 180 ms 后台核对指纹；预览已可见时
  跳过预扫描；配置与字体度量缓存；`schedule()` 合并同一次按键的文本/选区两个事件
  （此前每次按键会发两次渲染，第一次必被作废）。按键主线程实测 `2.66/4.36 ms → 0.37/0.64 ms`。
- 去掉 decoration 的 `hoverMessage`：鼠标扫过公式不再弹出带关闭按钮的 hover 面板。
- caret 竖线改为 `\rule[-0.18em]{0.03em}{0.92em}`：原来 0.88em 全在基线以上，顶端比大写字母
  还高 0.175em，视觉整体偏上；现在覆盖 -0.18~0.74em，与字母的 -0.205~0.705em 对齐。
  MathJax 接受 `\rule` 的可选下沉参数（math/text/array/上标内均已验证）。
- 本轮流水线：15 files / 132 tests 全通过；typecheck 干净；覆盖率 stmts/branch/lines
  `95.30%/89.13%/96.67%`，改动模块行覆盖率均 ≥ 91%。main bundle 88,656 B，OCR bundle 53,042 B。
- 基准（连续三轮，稳定）：cold p50/p95 `123~126 / 130~136 ms`，首次落在 180 ms 硬门内；
  warm p50/p95 `12.0~12.4 / 18.1~19.3 ms`；scanner p95 `0.47~0.65 ms`；idle restart 通过。
  同一台机器在本轮早些时候测到过 cold p95 `227~260 ms`，冷启动数字仍受环境影响，不能只凭
  这三轮就宣称硬门已稳定达标。
- 产物：`silk-math-preview-0.1.11.vsix`，`1,182,305` bytes，SHA-256
  `E118F69651933019CD2EAEE641489402BEBE5425158F21FC7D57D12861789C59`，17 个归档条目。
- 未做：仍未启动 Extension Host 视觉验收；`\SI`/`\si`/`\num` 等 siunitx 命令没有补，
  需要整套单位宏，属于下一步可选项。

## 2026-08-20 浮层落点、像素对齐、上下标光标与表格预览（0.1.10）

- 浮层落点：`floatingPreviewLayout` 改为接收 `lineSpan`（公式占用的源码行数）与 `lineHeightPx`，
  向下浮层偏移 `lineSpan × 行高`，多行 `equation` 不再被自己的预览覆盖；向上浮层仍只跨过首行。
  行高不再用 CSS 的 `1lh`——伪元素自带 `line-height: 1`，`lh` 会退化成一个字号（14px 而非 19px）。
  新增 `resolveEditorMetrics` 复刻 VS Code `BareFontInfo` 的推导（0 → 1.35/1.5×字号，<8 视为倍数）。
- 背景盖不住公式的真正原因：MathJax 输出 `width="53.463ex"`，`ex` 在独立 SVG 图片里按 16px 默认
  字体解析（≈7.17px），而浮层的 `ex` 按编辑器字体解析（Consolas 14px ≈ 6.26px），实测右侧溢出
  ≈42px。现在 `mathjaxRenderer` 用请求里的 `exPx` 把根节点尺寸改写成像素并返回同一组数值，
  浮层直接用它画背景；`exPx = 0` 保留 ex 尺寸供 OCR Webview 内联使用。宽度上限从“截断背景”改成
  等比缩小 SVG。`editor.fontSize`/`editor.lineHeight` 变更会清空 SVG 缓存并重绘。
- MathJax `convert({ scale })` 对独立 SVG 的尺寸无效，实测 scale 0.82 与 1 输出完全相同；
  缩放统一落在根节点像素上。
- 上下标光标：`unsafeSpanAt` 把光标吸附到 `\star` 起点后，正好落在 `^` 之后，caret 会顶替 `\star`
  成为上标。`anchorCaret` 在吸附之后再跑一次 `scriptArgumentSeam`，上下标内容不再掉回基线。
- 表格预览：新增 `src/core/tablePreview.ts`，把 `tabular` 系列翻译成 `array`。列格式归一化到
  l/c/r/|（p/m/b→l、X→l、未知列类型→c、`*{n}{...}` 展开、`@{}/>{}` 丢弃），booktabs 与 `\cline`
  →`\hline`，`\multicolumn` 补回 `&`，`\makecell`/`\thead` 展开为纵向 array，caption/label/
  endhead 等不进入预览。单元格默认包进 `\text{}`，内部 `$...$` 由 MathJax 切回数学；中文以
  `<text font-family="serif">` 输出，宽度按 1.131em/字估算（偏宽而不是重叠）。表格按
  `TABLE_PREVIEW_SCALE = 0.82` 缩小，并参与缓存键。
- 本轮流水线：15 files / 124 tests 全通过；typecheck 干净；覆盖率 stmts/branch/lines
  `96.02%/91.31%/96.93%`，`tablePreview.ts` lines `91.36%`。main bundle 83,502 B，
  OCR bundle 53,042 B。基准 cold p50/p95 `207.08/259.71 ms`（仍未达 180 ms 目标，且轮间波动 227~260 ms），
  warm p50/p95 `21.37/28.50 ms`，scanner p95 `1.39 ms`，idle restart 通过。
- 产物：`silk-math-preview-0.1.10.vsix`，`1,178,625` bytes，SHA-256
  `D662BC26ED2FCD433370AAE13F6C65AB6F912520C01A584F05D7502C448D6219`，17 个归档条目。
- 未做：未启动 Extension Host 视觉验收；表格的最终渲染效果（中文字体回退、列宽观感）由用户确认。

## 2026-08-20 实时编辑链路优化与版本更新（0.1.8）

## 2026-08-20 光标 TeX 片段回退修复（0.1.9）

- 排查 `PREVIEW_CARET_TEX` 渲染回退为原始文本的现象，复现与定位在当前 caret token
  含 `\raise` 与 `\hbox` 组合，导致部分上下文解析退化为 `\rule...` 字符串直接透出。
- 回退为更稳妥 token：`String.raw\`\class{silk-math-caret}{\rule{0.03em}{0.88em}}\``，
  保留 `\class` 与 class 上色逻辑，移除高兼容风险结构，以优先保证“必定渲染”。
- 同步版本到 `0.1.9`，并同步 `package-lock.json` 的版本元信息。

- 待办：按用户侧验收确认 `\rule` 是否恢复渲染；若仍有个别上下文失败，可考虑提供
  第二 token 回退策略（例如 `\rule` 退化替代）。

- 在 `src/vscode/previewController.ts` 的 `onDidChangeTextDocument` 中加入即时路径：当当前公式预览已
  可见且仍在同一编辑器编辑时，改为 `delay=0` 调度，并调用 `renderClient.prepare()` 预热 Worker，
  减少输入后首帧延迟。
- 将配置默认 `silkMath.debounceMs` 调整为 `8`（仍保留可配置下限 0）。
- 版本号更新为 `0.1.8`，并同步 `package.json` / `package-lock.json` / `README.md` 安装示例。
- 已完成打包：`silk-math-preview-0.1.8.vsix`，`1,175,265` bytes，SHA-256
  `6BAF7AD724C6BBF271788C177121ECD2FE925C7A543BB5E0A7BE06B9E01DADF1B`。  
  基准热/冷启动与扫描如下：冷 p50/p95 `137.78/150.36 ms`，热 p50/p95 `13.50/20.83 ms`，
  扫描 p95 `0.67 ms`。

## 2026-08-20 公式显示最终优化与边框清理（0.1.7）

- 修复 `floatingPreviewLayout` 关键参数顺序错位：`previewPosition/theme/displayMode/verticalAlign` 现在按
  正确顺序传入，消除方向与样式错配。
- 调整预览样式：去除 Light/Dark 的固定边框线（保留 High Contrast `contrastBorder`），下移 `equation`
  等显示环境的起始偏移用于避免覆盖上方，减小顶部内边距并增加底部内边距，右侧横向留白增加 1.05ex。
- 光标缩小为 `\raise` 微下沉的窄竖线，减少视觉占位与偏上感；`previewExpression` 与渲染测试链同步更新。
- 更新版本与文档标识至 `0.1.7`，变更记录补充到 `CHANGELOG.md` 并同步 `README` 安装示例。
- 待更新：`0.1.7` 打包文件 `silk-math-preview-0.1.7.vsix` 的体积/哈希待产物确认后写入。

## 2026-08-20 公式显示修复（0.1.6）

- 进一步优化浮层显示链路（修复“右侧/下沿仍然截断、上方间隔偏大、caret 过大、边框包裹不够”）：
  - `src/core/previewLayout.ts`：增加宽高冗余容差、缩小垂直/水平内边距、提升边框可见性（outline），并降低上方定位偏移；
  - `src/render/mathjaxRenderer.ts`：增强 `width/height/vertical-align` 长度解析鲁棒性；
  - `src/core/previewExpression.ts`：缩小 caret `\rule` 标记到 `0.05em × 0.96em`。
- 同步更新 `test/previewLayout.test.ts` 与文档版本信息（`0.1.6`）。
- 已完成产物更新：`silk-math-preview-0.1.6.vsix`，`1,174,405` bytes，SHA-256
  `53FFFA27107436372A2E640825C9FAD50872C32737DAF4360508E1DF05236DDE`。

## 2026-08-20 版本号与打包（0.1.5）

- 已将版本号提升至 `0.1.5`，同步更新 `package.json`、`package-lock.json`、`CHANGELOG.md` 与安装示例命令。
- 预期产物：`silk-math-preview-0.1.5.vsix`，用于标识本次修复后可识别的新安装包。
- 产物结果：`silk-math-preview-0.1.5.vsix`，`1,174,053` bytes，SHA-256 `F4679B256AEA7C5D4C82C6BA73291C90CCE0DEADF9111CA011270FD89530C80C`。

## 2026-08-20 公式右侧/底部显示不完整 + 间隔偏大 + 鼠标光标过大 深度排查

- 根因分解为三点：
  1. `MathJax` 尺寸解析仅支持 `ex`，某些输出返回 `px/em` 时宽高回退到 `1ex`，导致右侧与下沿被截断。
  2. 悬浮偏移与内边距偏大（`1lh + 0.08em` + `0.5em 0.65em`），使源码与预览间距明显偏宽。
  3. `PREVIEW_CARET_TEX` 在显示端偏高偏宽。
- 处理：
  - `src/render/mathjaxRenderer.ts` 扩展尺寸解析到 `ex/em/px`，并在必要时回退到 `viewBox` 尺寸换算，避免错误回退截断。
  - `src/core/previewLayout.ts` 下调悬浮位移和内边距：`0.08em -> 0.02em`、`0.5em 0.65em -> 0.33em 0.5em`。
  - `src/core/previewExpression.ts` 缩小 caret 标记 `\rule` 到 `0.06em × 1.06em`。
- 回归断言同步更新：`test/previewLayout.test.ts`（偏移值与可见策略）。

## 2026-08-20 插件打包（临时产物）

- 已完成基于当前修订的打包：`silk-math-preview-0.1.4.vsix`（`1,173,976` bytes，
  SHA-256 `6EB626A46091AB68ACAF15F3E2BBF0167CE858EBA8F5D001EA15F62646F10A56`）。
- 打包命令为本地构建产物后调用 `vsce package`，未执行完整 `npm run verify` 与扩展主机视觉验收。

## 项目目标

本项目是一个独立、跨 Windows/macOS/Linux 的 VS Code 扩展。核心体验是：光标进入
LaTeX 或 Markdown 数学公式后，在编辑器内就地显示实时 SVG 预览，并在预览中同步显示
源码光标位置。

## 冻结原则

- 使用纯 TypeScript/JavaScript，不引入 native module，不调用外部 LaTeX 进程，不访问网络。
- 默认路径不得使用常驻 Webview；预览通过 VS Code editor decoration 呈现。
- MathJax 只在首次进入公式时于独立 Worker 中懒加载；扩展激活不得加载渲染器。
- 文档编辑不得每次全量扫描工作区；`.sty/.cls/.tex` 定义只按依赖和文件变化增量更新。
- 渲染采用 latest-wins，过期结果不得覆盖新版本；错误输入保留最后一帧，不闪烁清空。
- 任何自动修正不得静默改写源码。默认只提供补全、诊断和显式 Quick Fix。
- `.cls/.sty` 支持指常见声明式宏和环境。复杂 catcode、expl3、条件执行或 LuaTeX 代码只能
  标记为“已识别但无法安全展开”，不得声称等价执行完整 TeX。
- 不复制 Ultra Math Preview 的名称、图标、README、截图或源码；仅参考公开行为和官方 API。

## 性能硬门

- VSIX 目标小于 2 MB，硬上限 2.5 MB；不得打包演示 GIF、测试、源码图或 source map。
- 主扩展 bundle 目标小于 200 KB，且不得包含 MathJax 字节。
- 500 字符以内公式：首次 Worker 启动并渲染 p95 目标小于 180 ms；热渲染 p50 小于 35 ms、
  p95 小于 80 ms。
- 主线程单次输入处理 p95 目标小于 3 ms；滚动不得触发重新渲染。
- Worker 空闲 60 秒后释放；SVG LRU 最多 64 项且总量最多 8 MB。
- 每次交付都运行包体、渲染延迟和核心扫描性能检查，并按实测结果报告，不以目标代替结果。

## 工程规范

- 面向用户的说明、诊断和注释优先使用中文；API 标识、TeX 命令和协议字段保留英文。
- 核心解析、定义索引、光标锚定和诊断逻辑保持无 `vscode` 依赖，便于快速单元测试。
- 核心模块行覆盖率不低于 90%。跨平台只使用 `vscode.workspace.fs`、URI 和 Node 标准库。
- 每次任务完成后同步更新本文件和 `project_memory.md`，记录真实测试、性能和未覆盖边界。
- 用户负责最终渲染视觉验收；默认只做类型、单元、Worker smoke、性能和 VSIX 打包验证。

## 代理角色

- 主代理：整合架构、实现、验证和最终交付。
- 公式与定义审查：检查分隔符、宏/环境解析、错误恢复和源码 offset 映射。
- 性能与扩展审查：检查事件合并、Worker 生命周期、缓存、包体和跨平台 API。

## 2026-08-18 v0.1.0 交付状态

- 最终 `silk-math-preview-0.1.0.vsix` 为 1,087,528 bytes，SHA-256
  `D6961DF73D359A014037ED8251F54C3784D7D698CBF401CE8202953EBFE97249`；归档 13 个文件，
  不含源码、测试、source map、模型、WASM 或 `node_modules`。
- 12 个测试文件共 79 项全部通过；核心 lines/branches/functions 为
  `97.79%/92.79%/100%`。`npm audit --omit=optional` 为 0 个已知漏洞。
- 491 字符基准：热渲染 p50/p95 `18.92/52.12 ms`，27,378 字符有界 scanner p95
  `0.745 ms`，Worker idle 后确实重启；冷 round-trip p95 `261.54 ms`，未达到 180 ms 目标，
  不得写成已达标。scanner 数字不是完整扩展主线程输入延迟。
- OCR 按需包代码路径、CSP、哈希清单和 Webview 交互已完成；约 94 MiB 当前包 9/9 资源已完成
  size/SHA 实下校验，合成中英文字与公式图已跑真实 ONNX smoke。复杂/手写精度与 Webview
  视觉流程仍未覆盖，v0.1.0 必须标为实验性并人工复核。
- `ppu-paddle-ocr@5.8.3` 的 ORT peer 下限为 1.23.2；按需 runtime 已对齐其 Web 实现默认的
  `onnxruntime-web@1.26.0`，不可为了缩小下载退回不受供应方支持的 1.20.1。
- 已静态核对 Windows/macOS/Linux 接线；未运行 macOS/Linux 实机截图、VS Code Extension Host
  视觉验收或真实 OCR 推理。最终渲染视觉验收由用户完成。

## 2026-08-19 v0.1.1 核心预览修复与双语展示

- 用户实机截图中的 closing `$` 后已有孤立斜体 `u`，证明 scanner、selection 事件、data URI 与
  editor decoration 正常；根因是 `\begingroupSandbox` 只消费下一个 TeX atom，旧 Worker 把
  `u\equiv-1` 错误截成 `u`，因而也丢失后续源码同步光标。当前把完整表达式放入一个花括号 atom，
  并新增 `≡`、负号、数字和 caret 同时存在的回归。
- 新增 256×256 独立 PNG 图标、深色 gallery banner，以及实时光标、自定义定义、按需 OCR 三张
  包内 SVG 功能示意；README、扩展简介、命令与设置说明均为中英双语。示意图没有冒充真实
  Extension Host 截图，SVG 已做 XML 合法性校验，本轮未做渲染视觉验收。
- v0.1.1 流水线为 12 files / 80 tests，核心 lines/branches/functions
  `97.79%/92.79%/100%`；最终成功打包轮的 cold round-trip p50/p95 为
  `140.31/146.68 ms`，warm p50/p95 为 `13.74/22.10 ms`，scanner p95 `0.594 ms`，RSS delta
  `82.88 MiB`，idle restart 通过。同轮另两次 cold p95 为 `179.54/191.54 ms`，说明冷启动仍有
  环境波动，不能声称稳定满足 180 ms 硬门。
- 最终 `silk-math-preview-0.1.1.vsix` 为 1,171,461 bytes，SHA-256
  `02355295F294522A1A559F66407296E2BCC8F867C16E08E167B94F79D85CBC24`，17 个归档条目；模型、WASM、
  源码、测试和 source map 仍不进入 VSIX。

## 2026-08-19 v0.1.2 浮层布局修复

- v0.1.1 的 `after/before` attachment 仍参与行内排版；SVG 的显式宽高和负 vertical-align 会撑高
  源码行，产生用户截图中的虚空行与编辑基线偏移。v0.1.2 改为单个 `before` 伪元素锚定公式起点，
  公式 range 仅提供 `position: relative`，预览自身 `position: absolute`，默认悬浮于公式下方。
- 浮层使用 hover-widget 主题背景/边框、阴影、`pointer-events: none`，不占文本流也不抢编辑交互；
  `silkMath.previewPosition` 改为 `below/above`，运行时把旧 `after/before` 自动映射到对应方向。
- 新增无 vscode 依赖的 `previewLayout` 和 3 项布局回归：方向兼容、尺寸硬限、绝对定位且无
  `vertical-align`。完整流水线 13 files / 83 tests，核心 lines/branches/functions
  `97.80%/92.85%/100%`；main bundle 73,820 B，OCR bundle 53,042 B。
- 本轮基准 cold round-trip p50/p95 `177.79/192.39 ms`（冷门未达），warm p50/p95
  `16.61/29.20 ms`，scanner p95 `0.768 ms`，RSS delta `82.75 MiB`，idle restart 通过。
- 最终 `silk-math-preview-0.1.2.vsix` 为 1,172,227 bytes，SHA-256
  `968F70F88CD28DDBB820579106CD3CDC160EBC3D6B986C5CC05F3B413B0FDB3B`；17 entries，源码、测试、
  模型和 WASM 均未打包。未启动 Extension Host 做视觉验收，等待用户安装后确认实际浮层位置。

## 2026-08-19 v0.1.3 主题自适应浮层面板

- 浮层面板使用 VS Code `editorHoverWidget.background/foreground/border` 原生主题令牌，
  加入 8px 圆角、细边框、内边距与裁切；Light/Dark 分别使用克制的浅色/深色阴影。
- High Contrast/High Contrast Light 不使用阴影，改为 2px `contrastBorder`；主题切换时原有
  SVG 缓存清空和重绘机制继续保证数学前景色同步。绝对定位、零行高占位和
  `pointer-events:none` 合同不变。
- 最终流水线 13 files / 83 tests；核心 lines/branches/functions `97.81%/92.88%/100%`；
  main bundle 74,352 B，OCR bundle 53,042 B。热渲染 p50/p95 `31.57/74.26 ms`，scanner p95
  `1.986 ms`，idle restart 通过；cold round-trip p95 `197.76 ms` 仍未稳定达到 180 ms 目标。
- `silk-math-preview-0.1.3.vsix` 为 1,172,709 bytes，SHA-256
  `C31686E8023C30A639F9EABC06909784E4A84220CA8365574A8F1411DF534DA0`；17 entries，不含源码、测试、
  模型或 WASM。本轮仍不启动 Extension Host，最终 Light/Dark 视觉由用户安装后验收。

## 2026-08-19 v0.1.4 交互关闭、数学环境与浮层间距修复

- selection 移出当前公式区域时立即清理旧 decoration，不等待 debounce、定义快照或
  Worker；浮层可见时设置 `silkMath.previewVisible` context，`Esc` 只在该 context 下调用
  `dismiss()`，同时递增 epoch 防止在途结果重新显示。
- scanner 原本已覆盖环境完整 `\begin/\end`，真正失败点是 MathJax 已处于数学模式时不能
  再嵌套 `equation/align/...` 外层 display 环境。现将 17 种内置环境转成安全内层结构或直接
  内容，同时保留未知自定义环境的原定义包装。
- `\label` 在同一 MathJax context 的二次渲染会重复注册并报错；预览现仅从渲染副本移除
  `\label/\notag/\nonumber`，并把其内点击位置映射到相邻可见公式 seam，不改写源文档。
  `alignat/alignedat` 的列数参数也被保护，光标不再把 `{1}` 插断。
- 下方浮层从 `calc(1lh + 0.25em)` 上移为 `calc(1lh + 0.08em)`，减小与上方源码的空隙、
  同时增加与下方内容的空间；绝对定位和零行高占位合同不变。
- 最终 14 files / 104 tests，核心 lines/branches/functions `97.78%/92.75%/100%`；main bundle
  76,153 B，OCR bundle 53,042 B。warm p50/p95 `25.52/43.13 ms`，scanner p95 `1.315 ms`，
  RSS delta `82.97 MiB`，idle restart 通过；cold p95 `196.90 ms` 仍未达 180 ms 目标。
- `silk-math-preview-0.1.4.vsix` 为 1,173,704 bytes，SHA-256
  `049B220B9A5670A064B3F01E03975A02E32A91FF1BE141D9CCD1D5E799C31D51`；17 entries，不含源码、测试、
  模型或 WASM。未启动 Extension Host 视觉验收，等待用户确认点击/Esc/环境与间距效果。

## 2026-08-20 公式浮层底部截断修复（未发布）

- 发现的截断根因是悬浮层样式对高度和溢出设置了过强约束：`height` 被钉死 `24ex`
  上限且 `overflow: hidden`。当公式实际高度大于上限时底部会被裁掉。
- 在 `src/core/previewLayout.ts` 去除高度硬上限，改为按高度值直接设置 `height`（但保留
  最小 1ex），并将溢出行为从 `hidden` 改为 `visible`；保留 `width` 96ex 上限与间距参数不变。
- 同步更新 `test/previewLayout.test.ts` 断言，反映取消底部裁切后的布局行为。
