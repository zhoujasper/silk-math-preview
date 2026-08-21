# Silk Math Preview 项目记忆

## 2026-08-21 GitHub Actions 自动发 Marketplace

- `main` 推送：测试 + 打包；有 `VSCE_PAT` 就 `vsce publish --skip-duplicate`，
  并更新 GitHub Release。密钥配在仓库 Settings → Secrets。
- 没密钥时跳过发布，CI 仍绿。

## 2026-08-21 GitHub 与 Marketplace（0.1.67）

- 作者 Jasper Zhou，https://zhoujasper.github.io ；仓库
  https://github.com/zhoujasper/silk-math-preview 。Marketplace 发布者 ID
  必须是 `silkmath`。步骤在 `docs/PUBLISH.md`。

## 2026-08-21 改回顶部 QuickPick（0.1.67）

- 点 Silk Math 打开顶部 QuickPick，勾选留在菜单里立刻变。不再用
  状态栏 Markdown hover 当点击入口。
- 0.1.67：`silk-math-preview-0.1.67.vsix` 1,196,438 bytes，
  SHA-256 `4E67069AD157F2EB90DD178BC4A32B03D148124C3E8A5E7CC70ACC30F30B294E`。

## 2026-08-21 Copilot 活 DOM vs locked hover（0.1.66）

- Copilot 状态栏卡片是内核 HTMLElement + ShowTooltipCommand 对象，勾选改
  同一个 Toggle。扩展 Markdown hover 在 isLocked 时改 tooltip 会拆掉旧浮层
  却画不出新的。0.1.66 两次写入不同 revision 的 markdown 再补 showHover。
- 0.1.66：`silk-math-preview-0.1.66.vsix` 1,198,013 bytes，
  SHA-256 `FFEE6434B9ADEA9019A927201A617B3D20B285B07EF040FDD474AB1DD5777E47`。

## 2026-08-21 闪了但勾选不变（0.1.65）

- `configuration.update()` 返回后 `get()` 仍可能是旧值，重开 hover 画出旧勾选。
  点选先写入 pending，卡片按 pending 画，配置异步落盘。
- 0.1.65：`silk-math-preview-0.1.65.vsix` 1,197,788 bytes，
  SHA-256 `9BA32A92047211545E830A5468F5F7DD024D1F3CAB215532325E97B422D9F4C0`。

## 2026-08-21 isTrusted 白名单静默吞点击（0.1.64）

- `{ enabledCommands }` 让 opener 用 includes(uri.path)，对不上就 return true
  不执行。必须 `isTrusted: true`。UI 用 markdown command 链接 + 主题色 span。
- 0.1.64：`silk-math-preview-0.1.64.vsix` 1,197,326 bytes，
  SHA-256 `05B57CA38CD5C7F6FA735ECF4D07E1E58C0F167C0345B5897CD7EEB121DDD135`。

## 2026-08-21 command 链接被内核拆掉（0.1.63）

- HTML 表格里的 command href 不是 markdown link，点了没闪。改成
  `[text](command:id)`，命令写入 package.json，isTrusted.enabledCommands 放行。
- 0.1.63：`silk-math-preview-0.1.63.vsix` 1,197,033 bytes，
  SHA-256 `2C02446A235917F343251DF70137000ED658C0DB4E0EA76C4DC8D4ADA1349CF0`。

## 2026-08-21 点选后立刻重开 hover（0.1.62）

- locked hover 改 tooltip 不会原地重绘。清掉 tooltip 让内核把焦点交回条目，
  再写新内容并 showHover 两次。不要 focusStatusBar。
- 0.1.62：`silk-math-preview-0.1.62.vsix` 1,196,986 bytes，
  SHA-256 `0CD901EC67F171FBD96DE7BC392B85E551B4D7A28EF085D02677D5F9AF7F06FE`。

## 2026-08-21 Copilot Chat VSIX：悬浮窗是内核 hover（0.1.61）

- 拆开 github.copilot-chat-0.48.1.vsix：大卡片是内核 ShowTooltipCommand +
  HTMLElement。插件只 createChatStatusItem 塞 Index/Sync。扩展公开做法是
  showHover + MarkdownString。撤掉右侧栏。点选后空 tooltip 再 showHover，
  不要 focusStatusBar。
- 0.1.61：`silk-math-preview-0.1.61.vsix` 1,196,864 bytes，
  SHA-256 `4639865AB7AFAE5AE364171A347CC7B87CC7B905FD98EBFA7E1400C4A7462895`。

## 2026-08-21 Copilot 源码对照：点选立刻刷新（0.1.60）

- Copilot 卡片是内核 HTMLElement + ShowTooltipCommand，扩展做不到。Markdown
  sticky hover 一点就锁死、改 tooltip 等于拆掉浮层。改成右侧辅助栏 webview，
  勾选立刻变，不开编辑器标签、不下方面板。
- 0.1.60：`silk-math-preview-0.1.60.vsix` 1,198,712 bytes，
  SHA-256 `0F0E3DED1AAEB384F558E84D0B4E662C595C71DAC0B4E35B98C29ECCC09E0C3A`。

## 2026-08-21 推迟按钮和点选刷新（0.1.59）

- 推迟：次级按钮色文字芯片。加减重置无底无边。点选后冲空 tooltip 再 showHover。
- 0.1.59：`silk-math-preview-0.1.59.vsix` 1,196,303 bytes，
  SHA-256 `9F47551C6F62A0C22ABDF2D69E0D11E903D7752DF04BFB0075CBA151E2890304`。

## 2026-08-21 点 Silk Math 不再开编辑器标签（0.1.58）

- Webview panel 会变成新标签。Copilot 是状态栏 hover。改回 showHover + Markdown。
  推迟按钮 SVG 带边框/浅底/圆角。zh* 中文，其余英文。
- 0.1.58：`silk-math-preview-0.1.58.vsix` 1,196,393 bytes，
  SHA-256 `62D506B35CFB8BA7CDB1D475E6A56E426688212D2BCF1B8519090600A35A3447`。

## 2026-08-21 Jupyter 多行公式下半截被裁（0.1.57）

- 格子裁溢出 + 下一格盖住。预览仍在下方：用 after 撑高锚点行，不要翻到 above。
- 0.1.57：`silk-math-preview-0.1.57.vsix` 1,197,511 bytes，
  SHA-256 `BCC493454A8FB67358534BB5AFAA68B3C6613E61A3079DD885D4D9DF78A91B64`。

## 2026-08-21 自绘 webview 卡片，勾选立刻变（0.1.56）

- Markdown hover 做不到 Copilot 那种原地改 DOM。点 Silk Math 改为打开 webview
  卡片，postMessage 立刻重绘。勾选无蓝底，齿轮在右上角，底部是排除按钮。
- 0.1.56：`silk-math-preview-0.1.56.vsix` 1,197,170 bytes，
  SHA-256 `BE09C8782E895C711E9C36194EAAD00EC598BB477C40750C7E88A607E774B340`。

## 2026-08-21 勾选立刻刷新、推迟并排、上下留白（0.1.55）

- 点勾选后必须先单独冲空 tooltip（暂停其它 refresh，等 IPC），否则 ExtHost
  会把清空合并掉，sticky hover 一直显示旧内容。
- 卡片 360px，推迟左右并排，顶少底多。
- 0.1.55：`silk-math-preview-0.1.55.vsix` 1,195,617 bytes，
  SHA-256 `12D70E0C6BA13E38CB65E68F6A6CF0CBFA12E088A2C8272DB559185DC4A84CCB`。

## 2026-08-21 状态栏卡片加宽、次级按钮、点了立刻刷新（0.1.54）

- 点开的 hover 是 sticky/locked，改 tooltip 不会重绘。先清空再写回，然后
  `focusStatusBar` + `showHover`。卡片 400px，勾选自绘方框，按钮用次级按钮色。
- 0.1.54：`silk-math-preview-0.1.54.vsix` 1,195,440 bytes，
  SHA-256 `421AF6F66543099BA8A3C13EEDE965AF54DAF7DE484C6D6867F989C8DEB88E86`。

## 2026-08-21 状态栏卡片 Copilot 勾选布局（0.1.53）

- 标签不要做成 markdown 链接（会变蓝）。勾选框在左，点了用 revision 刷新 hover。
- 0.1.53：`silk-math-preview-0.1.53.vsix` 1,194,549 bytes，
  SHA-256 `581F765198473009A3F6F71D348C786845009C85484F664E28087C76C63E7353`。

## 2026-08-21 表格文本格光标渲染成源码（0.1.52）

- 表内 caret 是否文本模式必须按当前单元格数 `$`，不能整表累计。
- 0.1.52：`silk-math-preview-0.1.52.vsix` 1,194,416 bytes，
  SHA-256 `B1187A35E7D9D6DD7F1B509BFE744176DB641071750A809892C287639EB1BA18`。

## 2026-08-21 滚动条拖动不再关掉预览（0.1.51）

- 拖滚动条会改选区到浮层下面的源码行，不能当成离开公式。细滚动条、轨道透明。
- 0.1.51：`silk-math-preview-0.1.51.vsix` 1,193,950 bytes，
  SHA-256 `3A84A46BC879B104324A94AC41111DB13DE27ADC9026D247940628143B18F4F0`。

## 2026-08-21 预览对准公式正下方居中（0.1.50）

- 同一行多个 `$...$` 时，预览必须对准当前公式中心，不能贴行首。
- 0.1.50：`silk-math-preview-0.1.50.vsix` 1,193,611 bytes，
  SHA-256 `D35B694956A69B26EE6EE752F6CD61246852F910EB20ED63FBA1557D2FA121C4`。

## 2026-08-21 Copilot 同款状态栏点击卡片（0.1.49）

- Copilot 用内核 `ShowTooltipCommand`（对象身份）+ HTMLElement tooltip。
  扩展做不到。公开替代：`command = workbench.action.showHover` + MarkdownString tooltip。
- 不要再用 editor decoration 冒充状态栏浮层：点状态栏时常没有编辑器。
- 0.1.49：`silk-math-preview-0.1.49.vsix` 1,193,251 bytes，
  SHA-256 `4D7D378BC7DCB6F88575502DBFF5A006D1297F1970568EDE23BACE5A2267436D`。

## 2026-08-21 列竖线画不出来（0.1.48）

- `{cc|c}` 的列间竖线是零宽度 `<line>`，独立 SVG 图片会丢掉。改成细矩形。
- 0.1.48：`silk-math-preview-0.1.48.vsix` 1,195,020 bytes，
  SHA-256 `8F9460B48065F9D85A313B7FCC85E28D5D02BD489B1848D25A8861876CC75A9B`。

## 2026-08-21 带框表格白色色块（0.1.47）

- `{|c|c|c|}` + `\hline` 的 frame rect 必须 `fill="none"`，否则独立 SVG 会涂满前景色。
- 0.1.47：`silk-math-preview-0.1.47.vsix` 1,194,787 bytes，
  SHA-256 `C9CAAFAED650A8D2D5EAC8D448D85B64EF1B1B4CE6B5C594BC7EF889D7BD501E`。

## 2026-08-21 自定义环境套 equation（0.1.46）

- `eqmath` 这类环境在类文件里包 `\begin{equation}` 时，prelude 必须去壳/改 aligned。
- 0.1.46：`silk-math-preview-0.1.46.vsix` 1,194,570 bytes，
  SHA-256 `003A71D2988091C6E2CA0B28B7FE71AE7D0A13EB7F0C5EF6C175AC03712ABF8F`。

## 2026-08-21 Markdown 行内代码点反引号也预览（0.1.45）

- `` `$not math$` `` 命中范围扩到包裹的反引号；代码里夹着别的字则不扩。
- 0.1.45：`silk-math-preview-0.1.45.vsix` 1,194,588 bytes，
  SHA-256 `E4EBC9A9F18CF4CAB0FC80A52F1C6F3D15FBD085E7B8D81DDCB071ED48DEE2F2`。

## 2026-08-21 Markdown 代码里的公式（0.1.44）

- 行内代码和 fence 里的 `$` 要预览；定义解析继续跳过代码。
- 0.1.44：`silk-math-preview-0.1.44.vsix` 1,194,383 bytes，
  SHA-256 `3BF3B0729708C47E43834B04A85126970B870F2AD3B11D1B796F6D95C4680167`。

## 2026-08-21 Markdown 表格框线（0.1.43）

- array 列格式必须带 `|`，行间要 `\hline`，否则预览只有对齐文字没有表框。
- 0.1.43：`silk-math-preview-0.1.43.vsix` 1,194,035 bytes，
  SHA-256 `362C6C7C05B2B1E9A93F1C00FE4E29E10ED27AC1B8D0F12869A92E1A1F36D7AD`。

## 2026-08-21 更新全部样例测试

- fixtures 说明与扫掠对齐现行为。`eqmath` 用 aligned 才能在预览数学模式里嵌套。

## 2026-08-21 Markdown 表公式竖线（0.1.42）

- GFM 单元格里的 `|x|`、`|\nabla u|` 必须当数学绝对值，不能当列分隔。
- 0.1.42：`silk-math-preview-0.1.42.vsix` 1,193,957 bytes，
  SHA-256 `C1677153BFD1070168413285FB6708A76F457E4A66309B708F65BD1DFC52AE06`。

## 2026-08-21 预览从公式往右排（0.1.41）

- 锚在行首会让行内公式预览错位到左边。range 从公式起点开始。
- 0.1.41：`silk-math-preview-0.1.41.vsix` 1,193,720 bytes，
  SHA-256 `0095D8947AFFD0F57A6FD15FF64FD62E3A88F0A955C764A90C8718AD3B2CE38C`。

## 2026-08-21 预览在下方（0.1.40）

- Jupyter 自动翻到上方会盖住源码。默认始终 below。
- 0.1.40：`silk-math-preview-0.1.40.vsix` 1,193,070 bytes，
  SHA-256 `9EE14EEE9D8E9337951E5338E0A31283B0F26FCAA2563F1C96C5AA6756C8F124`。

## 2026-08-21 去掉 Silk Math 左边图标（0.1.39）

- 用户不要状态栏 `^ Silk Math`。点开后也不要额外的 − / + / 齿轮条目。
- 0.1.39：`silk-math-preview-0.1.39.vsix` 1,193,106 bytes，
  SHA-256 `1F49EBA059E5EE62D873179BC88EE11F4088A0110ED486F1D56B44DA4A124444`。

## 2026-08-21 Jupyter 卡片错位（0.1.38）

- 卡片在左上角且只露出下半截：锚在第一格最后一行，286px 往上溢出被裁。
  改钉视口最下一格的右下角。
- 0.1.38：`silk-math-preview-0.1.38.vsix` 1,193,307 bytes，
  SHA-256 `7D402EFC4F56591B5197275146E09C50280CD2968BA943F03B9E0A389D32097E`。

## 2026-08-21 纯定义公式（0.1.37）

- 只有声明、没有排版内容：默认静默跳过。选项 `previewDefinitions` 才展开样例。
- 0.1.37：`silk-math-preview-0.1.37.vsix` 1,193,008 bytes，
  SHA-256 `629EA94BB17D15ED1F83F433972778CC3E5D19AB3DE41749912E584838E3370A`。

## 2026-08-21 人工系统预览样例

- `test/fixtures/all-math.{tex,md,txt,ipynb}` + `silkmath-fixture.{sty,cls}`。
  打开后把光标放进每条公式。`.txt` 要先打开「其他文件类型」。

## 2026-08-21 详情页与 GitHub 图标（0.1.36）

- 商店卡片图标 ≠ README 正文。要在介绍里看见 logo，必须在 README 里写 `<img src="media/icon.png">`。
- `media/icon.png` 早已进 Git，缺的是 README 引用。
- 0.1.36：`silk-math-preview-0.1.36.vsix` 1,192,175 bytes，
  SHA-256 `86DC6778733995E0336FB2F6667320F34F9D6ECE6EE8FFCD59F96551A95C2E60`。

## 2026-08-21 详情页默认英文（0.1.35）

- 商店详情只渲染 README.md。中英切换用页内锚点，不要指望 JS 或第二份 README。
- 图太大是显示宽度问题：给 `<img width="480">`，不要堆四张全宽图。
- 0.1.35：`silk-math-preview-0.1.35.vsix` 1,192,129 bytes，
  SHA-256 `37712EA9B9820DF747CFBEBC472A891DE8CA15FC3A0334C8ABAFFF3460EBA1F0`。
  本地 VSIX 详情页图片仍依赖 GitHub `repository` 改写；公开仓库未更新前图可能空白。

## 2026-08-21 卡片跑到左边（0.1.34）

- 短行 + `position: relative` + `right: 0` = 卡片在编辑器左边。要钉在 Silk Math
  上头，包含块必须是整列编辑器，不能是行盒。
- 点击后不要给 Silk Math 加 `^`。
- 0.1.34：`silk-math-preview-0.1.34.vsix` 1,192,094 bytes，
  SHA-256 `321C96800ED0F488A4211DAEEB9A96964E55ECD2AF52C66DEE5B3909B3CDDF6F`。

## 2026-08-21 点击没反应（0.1.33）

- 用户能悬停出卡片、点击无效果：先查 hide 监听和 `position:fixed`，不要再加 QuickPick
  或 views。
- 点状态栏可能把 `activeTextEditor` 变成 `undefined`，不能据此关卡片。
- SVG `contentIconPath` 是图片，里面的 `<a href="command:">` 不会执行。可点的开关要
  用真正的 StatusBarItem / MarkdownString / QuickPick / webview。
- 0.1.33：`silk-math-preview-0.1.33.vsix` 1,191,985 bytes，
  SHA-256 `1F726698618F590CB1B9F3B5A629BD9D2E3C11BE7F21CC72F344B91DAFE3B343`。

## 2026-08-21 点击飞出卡片（0.1.32）

- 顶部 QuickPick ≠ Copilot 悬浮框。钉在状态栏上方要用 `position: fixed` decoration，不要 `showQuickPick`。
- 0.1.32：`silk-math-preview-0.1.32.vsix` 1,191,461 bytes，
  SHA-256 `17C2FFB4397786E17BF215062E3FF5DF43EF7797A5A93C2B5DAC560D7DB0561A`。

## 2026-08-21 Markdown 表格与渲染合并（0.1.31）

- 管道表格按块识别，不要把单元格里的 `$x$` 当成独立公式。
- 热路径卡顿多半是 Worker 队列而不是扫描。latest-wins 必须在 **postMessage 之前**丢掉旧任务。
- 0.1.31：`silk-math-preview-0.1.31.vsix` 1,189,847 bytes，
  SHA-256 `791D44B7B7CD2B47B3BEBCF75D96C609CEDB96779A24D1DA947E1BD821CF07B8`。

## 2026-08-21 Jupyter 单元格裁切（0.1.30）

- 浮层出了 markdown 格就被下一格盖住。检测 `vscode-notebook-cell`，下方空间不够就 above。
- 0.1.30：`silk-math-preview-0.1.30.vsix` 1,188,662 bytes，
  SHA-256 `54E5137FDF136CA0F3CD1749A37F253CBFC9EE9469DA70DC2685B3A5BFF69A8C`。

## 2026-08-21 underbrace url(#) 裁剪无效（0.1.29）

- 浮层是图片不是 inline SVG。`url(#clip)` 对装饰无效。把矩形拉伸段直接裁进路径。
- 0.1.29：`silk-math-preview-0.1.29.vsix` 1,188,340 bytes，
  SHA-256 `E3D3925D6EC06F9E0C6B0C01B3074E3D5809B6B49F9F4BB4C3B62FC94F919BF5`。

## 2026-08-21 状态栏点击空实现（0.1.28）

- 用户报「点击右下角没反应」：command 绑了 `statusBar.entry.showTooltip` 的空实现。
  点击必须落到我们自己的 `showMenu`。
- 0.1.28：`silk-math-preview-0.1.28.vsix` 1,187,454 bytes，
  SHA-256 `244147F421CD20BC5A496628C24A65242AB42A7CB3B761DFC4B0D73FE6B44BF6`。

## 2026-08-21 underbrace 裁剪与默认 135%（0.1.27）

- 空浮层修好之后横杠仍错：缺的是 clip，不是再截断。MathJax 用内层 svg 当视口。
- 浮层“空白太多”先查 viewBox 是否被启发式外扩，再查 CSS padding。
- 0.1.27：`silk-math-preview-0.1.27.vsix` 1,187,260 bytes，
  SHA-256 `12690FB4CBE2508121A6DF5DACFB8672DE4F76F87857372A1F5E37EB0AD272F2`。

## 2026-08-21 underbrace 空浮层（0.1.26）

- 面板里能看见半截、编辑器浮层是空底：两条路不是同一套渲染。浮层是 data URI 图片，
  嵌套 `<svg>` 会被 Chromium/VS Code 丢掉整张图；面板是 innerHTML，只受 viewBox 裁剪。
- 0.1.22 只修了“截断根节点”，没有展平内层 svg，所以这类公式仍会空白。
- 0.1.26：`silk-math-preview-0.1.26.vsix` 1,187,027 bytes，
  SHA-256 `4F6C8E455B78E674D362B9C323B910B1D4D5D5882135288DD876F931E1864249`。

## 2026-08-21 状态栏只要原生悬浮框（0.1.25）

- 底栏整条 Silk Math 标签 = 贡献了 `views`。用户截图里的 Copilot 卡片 = 核心 hover。
  两者不是同一套 API。要 Copilot 那种位置和 chrome，只能走 MarkdownString tooltip。
- 下次再想「点击打开自定义 HTML」，先问：能不能接受工作区面板？不能就不要贡献 view。
- 0.1.25：16 files / 162 tests，main bundle 111,880 B；
  `silk-math-preview-0.1.25.vsix` 1,185,627 bytes，
  SHA-256 `94FF6F39CC5E4B06727B8A4CF01DC5EAAE792F39203EF6A02D9DE3C2614D315D`。

## 2026-08-20 默认预览 140% 显示为 100%（0.1.24）

- 存储值仍是相对编辑器字号的倍率；默认 1.4。UI 100% = 1.4。

## 2026-08-20 Jupyter 跨单元格宏（0.1.23）

- notebook 宏作用域是“当前格及之前的 markdown 格”，不是整个 ipynb 文件当一份 tex。

## 2026-08-20 underbrace 空白预览（0.1.22）

- 空白大面板 + 有宽高 = SVG 被截断，不是 MathJax 没画出 path。先数 `<svg` 和 `</svg>`。

## 2026-08-20 OCR 智能混排与预处理（0.1.21）

- 公式图拉伸是准确度的第一杀手；深色主题截图不反相是第二杀手。
- 智能模式先并行跑文字 OCR 和整图 MFR，再决定整段公式还是按行混排。

## 2026-08-20 长公式上半段选中预览消失（0.1.20）

- 浮层必须锚在视口内的行。首行滚出去等于 decoration DOM 被回收。

## 2026-08-20 状态栏点击设置卡片（0.1.19）

- 底部 webview view 会铺满面板，不像 Copilot 浮层。改到 secondarySidebar 紧凑卡片。
- 核心 API 没有“点击打开状态栏 hover”给扩展用。

## 2026-08-20 详情页图片与开源仓库（0.1.18）

- 详情页 sanitizer 剥掉非 http/https 的 img src。相对路径在 GitHub README 能看，
  进 VSIX 详情页必须被 vsce 改写成 GitHub raw https。
- 开源仓库 https://github.com/zhoujasper/silk-math-preview ，MIT 版权人为 Jasper。

## 2026-08-20 详情页介绍重写（0.1.17）

- 详情页介绍按产品介绍来写，不要安装命令、配置表或开发备注。中英分成两个完整小节，
  不要同一段里中英夹杂。VS Code 已经显示扩展名，README 不要再放一遍 H1。

## 2026-08-20 面板落地方式（0.1.16）

- 「点击打开的浮层面板」在扩展 API 里的正解是 **webview view**，不是状态栏 tooltip：
  可常驻、可交互、能实时推数据，还能直接把渲染好的 SVG 放进去。
- 顺带解决了长期的验收痛点：面板里能看到当前公式的实时渲染结果与失败原因，
  用户不用再截图描述“显示不出来”。

## 2026-08-20 两条“到此为止”的结论（0.1.15）

- 扩展详情页里显示图片：本地 VSIX 做不到（只放行 https）。已验证相对路径与 data URI 都被拦，
  且我们生成的 base64 是完好的。以后不要再试第三种写法。
- 状态栏点击打开浮层面板：没有 API。Copilot 的面板是核心渲染的，扩展只有 tooltip。
- 反复出现的模式：我在 harness 里全绿、用户那边仍失败。与其继续猜，不如把诊断能力做进插件
  （`silkMath.diagnoseFormula` + `silkMath.trace`），一次拿到真实环境的事实。

## 2026-08-20 回归、CSP 与工具链教训（0.1.14）

- 这一轮唯一重要的教训是我自己造的回归：用 shell heredoc 往 TS 里写正则，`\b` 被吃掉变成
  退格符，判据永远为假，用户那边“基础功能都有问题了”。**含反斜杠的代码一律用 Write 工具写。**
- 只要新增的是“否定路径”（兜底、拦截、判空），就必须同时写一个正例测试锁住它，
  否则错了不会有任何测试报警——这次 138 个测试全绿，功能却是坏的。
- VS Code 扩展详情页的图片限制是 **CSP `img-src https: data:`**，不是 SVG/PNG 的问题。
  没有仓库 URL 的本地 VSIX 想显示图，只能内联 data URI。
- 状态栏 item 一旦挂 command，点击就会走命令面板；要 Copilot 那种悬浮面板就别挂 command，
  把交互放进 MarkdownString tooltip。

## 2026-08-20 嵌套环境 / 红色未知命令 / 悬浮面板（0.1.13）

- notebook「不显示」的真正原因不是 notebook：是 `$$ \begin{equation} ... \end{equation} $$`
  这种写法。分隔符区域里再套顶层环境，进沙箱分组后 MathJax 直接报嵌套错误。
  环境区域早有归一化，分隔符区域漏了。用户 `Lab 1.ipynb` 1362 个光标位置从全错变 0 错。
- 用户报的现象和真正的技术原因经常错位（「ipynb 不支持」其实是「`$$`+environment 不支持」，
  「宏不生效」其实是「没有工作区就不解析依赖」）。**先复现到具体表达式，再谈支持与否。**
- 加 `noundefined` 扩展时踩到一个连带问题：ContextPool 的 key 变了，`evict` 还用旧 key，
  出错上下文驱逐不掉，下一条公式莫名报 `Missing \begingroup`。改 key 一定要同步改 evict。
- `[object Object]`：MathJax 抛的不是 `Error`。凡是 `String(error)` 的地方都要先取 `.message`。
- 复现不了的现象（`\underbrace{aersd}` 空白面板）不要硬猜：加 `silkMath.trace` 输出日志，
  让用户把日志贴回来。同时给「渲染成功但无图元」加兜底，至少不留空白。
- 状态栏悬浮面板用可信 MarkdownString + command 链接就能做出 Copilot 那种交互，
  不需要 Webview；`$(icon)` 与 `−/+` 链接都能点。
- 流水线：15 files / 138 tests，覆盖率 `94.09%/88.99%/96.25%`；扫掠 44,369 个光标位置
  只剩 TikZ。产物 `silk-math-preview-0.1.13.vsix`，`1,414,156` bytes，SHA-256
  `E9E5C0A9406C50BD540C94B7B1A89EDC2AF2F8093C790AB64D235FF1C217ED62`。

## 2026-08-20 依赖解析 / 环境误判 / 跨行公式 / 状态栏菜单（0.1.12）

- 用户报「这条公式还是不显示」，而我在测试里怎么都复现不了。差别在**上下文**：真实场景是
  单开一个 `.tex`（没有工作区文件夹）+ 同目录 `.cls`。教训：复现要连 `.cls/.sty`、
  工作区状态一起复现，不能只喂公式字符串。
- 三个根因都不在渲染器里：
  1. 没有工作区文件夹时依赖解析直接放弃 → 自定义宏一个都进不来；
  2. `question`/`solution` 这类文本环境被当数学环境 → 整段解答变成一条公式；
  3. `$...$` 不许跨行 → 后续所有 `$` 配对错位。
  只看 MathJax 报错永远查不到这三条。
- 「全量扫掠真实文档」这个方法第二次立功：NPDE.tex 一跑就暴露跨行 `$` 和 TikZ 两类问题。
  以后碰 scanner / caret / 定义索引，先跑扫掠再改。
- 无法支持的东西要明说：TikZ/PGF 需要完整 TeX 引擎，与其静默空白，不如显示原因；
  渲染失败但当前公式没有任何一帧时也一样（延迟 400 ms 出提示，避免打字途中闪烁）。
- 状态栏从「Math OCR」改成单一 `Silk Math` 菜单入口（启用范围 / 暂停 / 排除当前文件 /
  OCR / 设置），预览语言判定改由 `PreviewPolicy` 注入，便于后续加更多策略。
- README 示意图现在由 `scripts/make-media.mjs` 生成：公式是真实渲染输出，外框是示意，
  再用 headless Chrome/Edge 转 PNG（Marketplace 不渲染 SVG，这点以前一直不对）。
- 流水线：15 files / 136 tests，覆盖率 `94.18%/89.04%/96.21%`；cold p50/p95
  `129.52/138.71 ms`，warm `13.06/22.74 ms`。
- 产物：`silk-math-preview-0.1.12.vsix`，`1,409,759` bytes，SHA-256
  `3CD8D606C4CD51D12F4EB98C2DE5F20701597FFB43EEE033FFAEE3A23E0B899A`。

## 2026-08-20 渲染失败根因 / 颜色 / 输入延迟 / caret 基线（0.1.11）

- 用户四项反馈：不够丝滑、鼠标悬停弹出 hover 面板、caret 偏上、以及「这条公式根本没渲染出来」，
  外加要求文档与 `.cls/.sty` 里自定义的宏、环境、颜色都要能实时显示且省资源。
- 方法上真正有用的一招：**拿用户真实文档做全量扫掠**——遍历每条公式的每个光标位置去渲染，
  统计失败。第一轮就打出 14 个失败、2 类根因（命令参数 seam、big 家族定界符），
  这些都是靠读代码想不到的。修复后 282 条公式 / 2,653 个位置 0 失败。以后改 caret 逻辑
  必须重跑这个扫掠。
- 「渲染不出来」永远先看 caret marker 落点，而不是公式本身：marker 是唯一被注入源码的东西。
- 有一类破坏不报错更阴险：marker 落进 `\textcolor{颜色名}` 的名字里，MathJax 照样渲染，
  只是颜色变成黑色。名字类参数必须整体保护。
- MathJax 能力已实测清单（别再猜）：支持 `\footnotesize`/`\small`/`\mathscr`/`\substack`/
  `\tag`/`\underbrace`/`\parbox`；不支持 `\bm`/`\boldsymbol`/`\cancel`（要加扩展）、
  `\emph`/`\ensuremath`/`\cref`/`\footnote`/`\intertext`/`\centering`（要 shim）、
  siunitx 全家（没补）。颜色模型只有 `rgb`/`RGB`/`gray`/`named`，`HTML`/`cmyk` 会抛错，
  而且**错在 prelude 转换时会污染整个渲染上下文**，所以必须在解析阶段折算。
- 延迟根因是每次按键都全量解析定义（18k 字符实测 p50/p95 `2.5/3.9 ms`）且挂在 await 上；
  还有一次按键触发两次调度、发两次渲染。改成快照复用 + 后台核对 + 调度合并后，
  按键主线程 `2.66/4.36 ms → 0.37/0.64 ms`。
- caret 偏上是因为 `\rule` 从基线往上长：0.88em 顶端比大写字母还高。要跨基线就得用
  `\rule[-0.18em]{...}{0.92em}`，MathJax 支持这个可选下沉参数。
- 流水线：15 files / 132 tests，覆盖率 `95.30%/89.13%/96.67%`；连续三轮基准 cold p50/p95
  `123~126/130~136 ms`（首次进入 180 ms 硬门），warm `12.0~12.4/18.1~19.3 ms`；
  但同机早些时候测到过 cold p95 227~260 ms，冷启动仍受环境影响。
- 产物：`silk-math-preview-0.1.11.vsix`，`1,182,305` bytes，SHA-256
  `E118F69651933019CD2EAEE641489402BEBE5425158F21FC7D57D12861789C59`。

## 2026-08-20 浮层落点 / 像素对齐 / 上下标光标 / 表格预览（0.1.10）

- 用户反馈四项：多行 `equation` 的浮层压在公式自己身上、背景右侧盖不住公式、
  光标插入把上标内容顶回基线、希望 `tabular`/`longtable`/`makecell` 也能预览且显示得小一些。
- 落点根因：浮层锚在公式首行且只偏移 `1lh`；而伪元素声明了 `line-height: 1`，`lh` 按 CSS 规范
  取元素自身行高，于是 `1lh` = 一个字号（14px），比真实行高（19px）还小。0.1.4–0.1.7 反复
  微调 `0.25em → 0.08em → 0.02em` 都是在这个错误基准上打转。现按 `lineSpan × 真实行高` 偏移。
- 溢出根因（已量化）：MathJax 根节点是 `width="53.463ex"`。SVG 作为图片时 `ex` 按 16px 默认
  字体解析 ≈7.17px → 383px；浮层的 `ex` 按编辑器 Consolas 14px 解析 ≈6.26px → 341px；
  右侧固定溢出 ≈42px，正好是截图里露在背景外的 `u(y)\,\mathrm{d}y.`。而且 `content: url()`
  的图片不会被 CSS 宽高压缩（0.1.5 那次“底部截断”靠 `overflow: visible` 缓解也是同一个原因）。
  结论：尺寸必须两边都用像素表达，不能靠加 padding 冗余去猜。
- 上下标根因：`anchorCaret` 先由 `unsafeSpanAt` 把光标吸附到 `\star` 的起点，而那正是 `^` 之后，
  `safeArgumentSeam` 的上下标保护在这条路径上根本没跑到。修复是吸附之后再检查一次。
- 表格路线：MathJax 没有 `tabular`，但 `array` + `\hline` + `\text{}` 足够。已实测可行的点：
  `\text{}` 内的 `$...$` 会切回数学；中文走 `<text font-family="serif">`，按 1.131em/字估宽
  （偏宽，不会重叠）；`\multicolumn`/`\cline`/`\scalebox` 在 MathJax 里都不存在，必须翻译掉。
- 另一处实测坑：`document.convert({ scale })` 对独立 SVG 尺寸完全没有影响（0.82 与 1 输出一致），
  “显示小一档”只能改根节点像素。
- 流水线：15 files / 124 tests 通过，覆盖率 `96.02%/91.31%/96.93%`；cold p50/p95
  `207.08/259.71 ms`（仍未达 180 ms），warm `21.37/28.50 ms`，scanner p95 `1.39 ms`。
- 产物：`silk-math-preview-0.1.10.vsix`，`1,178,625` bytes，SHA-256
  `D662BC26ED2FCD433370AAE13F6C65AB6F912520C01A584F05D7502C448D6219`。
- 待用户验收：多行环境浮层位置、背景是否完全覆盖、表格实际观感（中文字体回退与列宽）。

## 2026-08-20 实时编辑反馈修复（0.1.8）

## 2026-08-20 光标 TeX 标记兼容性修复（0.1.9）

- 现象：实时预览里光标标记出现未渲染明文 `\rule{0.03em}{0.88em}`。
- 根因：`PREVIEW_CARET_TEX` 使用 `\raise0.08ex\hbox{...}` 的嵌套在部分公式上下文下未被
  MathJax 兼容处理，触发文本回退。
- 修复：将光标 token 简化为 `\class{silk-math-caret}{\rule{0.03em}{0.88em}}`，去掉 `\raise` 与 `\hbox`，
  并保持 class 样式链路不变，优先保证渲染稳定。
- 版本同步：`package.json` 与 `package-lock.json` 升级到 `0.1.9`。

- 目标：解决用户反馈“编辑公式时改一个字母要延迟显示”的严重延迟问题。
- 处理：
  - `previewController` 文本变更监听改为“预览可见且活动编辑器一致”时立即调度 `schedule(..., 0)`，并调用
    `renderClient.prepare()`。
  - 默认配置 `silkMath.debounceMs` 从 `24` 调整到 `8`，用于默认更快响应。
  - 版本与安装路径更新到 `0.1.8`。
- 本轮完成打包：
  - `silk-math-preview-0.1.8.vsix`：`1,175,265` bytes  
  - SHA-256：`6BAF7AD724C6BBF271788C177121ECD2FE925C7A543BB5E0A7BE06B9E01DADF1`。

## 2026-08-20 公式显示修复与裁切问题二次优化（0.1.6）

- 处理目标：解决右侧和下沿仍被截断、预览上方间距过大、光标粗、边框包裹对比不足。
- 变更：
  - `previewLayout` 增加尺寸冗余并下调悬浮偏移：宽度上限改为 `130ex`，宽高加 `0.55ex` 裁剪冗余，`top/bottom` 偏移改 `0.01em`，内边距降为 `0.24em 0.42em`，加入 `outline: 1px solid currentColor`。
  - `mathjaxRenderer` 的 `width/height/vertical-align` 解析更健壮，兼容单/双引号属性并扩展 `ex/em/px/percent` 读取。
  - `PREVIEW_CARET_TEX` 调小为 `0.05em × 0.96em`。
- 已更新测试：
  - `test/previewLayout.test.ts` 断言同步 `0.1.6` 的布局参数。
- 版本/产物链路同步更新为 `0.1.6`，新产物：`silk-math-preview-0.1.6.vsix`，
  `1,174,405` bytes，SHA-256 `53FFFA27107436372A2E640825C9FAD50872C32737DAF4360508E1DF05236DDE`。
## 2026-08-20 版本更新并重新打包

- 已将扩展版本更新为 `0.1.5`：同步更新 `package.json` 与 `package-lock.json`（`0.1.5`）。
- 更新记录同步到 `CHANGELOG.md`（新增 `0.1.5 - 2026-08-20`）与 `README.md` 安装示例。
- 已完成新产物打包：`silk-math-preview-0.1.5.vsix`，`1,174,053` bytes，SHA-256
  `F4679B256AEA7C5D4C82C6BA73291C90CCE0DEADF9111CA011270FD89530C80C`。
- `AGENTS.md` 与 `project_memory.md` 均已记录本次任务与验收路径，未改动业务代码逻辑。

## 2026-08-20 公式右侧/底部显示不完整 + 间隔偏大 + 光标过大 深度修复

- 根因分解为三点：
  1. 部分公式 `MathJax` 输出尺寸未必是 `ex`，导致当前尺寸提取回退到 `1ex`，出现右侧/下沿被截断。
  2. 预览悬浮偏移与内边距仍偏保守，视觉上公式和上方源码之间距离偏大。
  3. 光标 `\rule` 标记（`0.07em × 1.28em`）对用户视觉偏大。
- 处理：
  - `src/render/mathjaxRenderer.ts` 扩展宽高解析：优先读取 `width/height`，支持 `ex/em/px`，并在缺失时回退到 `viewBox` 计量转 `ex`，避免无效回退导致裁切。
  - `src/core/previewLayout.ts` 下调悬浮偏移与内边距：`0.08em → 0.02em`、`0.5em 0.65em → 0.33em 0.5em`。
  - `src/core/previewExpression.ts` 缩小 cursor token 到 `0.06em × 1.06em`。
- 回归检查更新：`test/previewLayout.test.ts` 的偏移与 `overflow` 断言。

## 2026-08-20 插件打包产出

- 已基于当前修复版本生成新的可安装包：
  - `silk-math-preview-0.1.4.vsix`
  - 文件大小：`1,173,976` bytes
  - SHA-256：`6EB626A46091AB68ACAF15F3E2BBF0167CE858EBA8F5D001EA15F62646F10A56`
- 本次仅执行构建与 `vsce package`，未执行完整 `verify` 流程与扩展主机视觉验收。

## 2026-08-20 公式浮层底部截断修复（待发布）

- 用户反馈底部公式显示被截断，排查到是 `previewLayout` 上将高度硬限制为 24ex 并设置
  `overflow: hidden`，导致高公式下沿被遮挡。
- 本次修复改为 `height` 使用原始高度并保留最小 1ex，`overflow` 改为 `visible`，`width`
  仍保持 96ex 上限，避免影响文本流又恢复完整显示。
- 同步更新 `test/previewLayout.test.ts` 回归断言（由 24ex 裁切改为真实高度，验收 `overflow: visible`）。

## 2026-08-18 立项

- 新项目路径：`D:\windows\Downloads\SilkMathPreview`。
- 用户要求功能对标 Ultra Math Preview，并重点强化公式内实时光标、`.cls/.sty` 自定义定义、
  简单纠错/补全、跨平台和显著更低资源占用。
- 公开基线：Ultra Math Preview 0.2.7 Marketplace VSIX 约 4.36 MB；本机安装的 0.2.5 目录约
  4.61 MB，含约 2.35 MB 演示 GIF，并依赖 HyperScopes Booster。其公开实现存在逐次 scope
  查询、双渲染测高、持续创建 decoration，以及直接插入光标符号使 `\left/\right` 失败等问题。
- 决定 clean-room 独立实现：自研公式扫描和定义索引、单次 MathJax TeX→SVG Worker、单个可复用
  decoration、latest-wins 调度、最后有效帧保留和安全 token seam 光标。
- 不承诺执行任意 TeX 程序。常见 `\newcommand`、`\def`、`\DeclareMathOperator`、
  `\newenvironment` 和基础 xparse 定义进入索引；复杂定义仍识别名称、来源并给出受限提示。
- 性能门写入 `AGENTS.md`；最终必须报告实测 VSIX 大小、冷/热渲染延迟、缓存/Worker 生命周期。

## 2026-08-18 v0.1.0 完成

- 核心预览已实现 LaTeX/TeX/Markdown/MDX 公式识别、源码安全 seam 光标、单 decoration、
  latest-wins、错误输入保留末帧、SVG LRU 与 60 秒空闲 Worker 回收。
- 定义层递归读取工作区内可达的 `.tex/.sty/.cls`，支持常见 command/operator/environment、
  受限 xparse 和 Markdown YAML/body 宏；定义批量重建，快照只在声明边界变化。
- 语言层提供公式内补全、诊断和显式 Quick Fix，不静默改写。Markdown 有界扫描继承此前的
  fenced-code 状态，避免长代码块中的 `$...$` 被误报。
- MathJax 每个公式使用 `begingroupSandbox` 隔离；异常会精确驱逐污染上下文，下一帧可恢复。
  SVG 清理移除脚本、外链、危险 style 和重复根属性，且回归验证为合法 XML。
- 右下 `Math OCR` 首次点击才确认下载；系统截图、原像素框选、公式/文字 tab、编辑、复制和
  插入原光标均已接线。模型不进 VSIX；ORT 已从不满足 ppu peer 范围的 1.20.1 升到 1.26.0，
  当前包使用 ORT 1.26 对应的 asyncify MJS/WASM；9/9 资源完成实下 size/SHA 校验。合成图真实
  smoke：中英文字 `数学 OCR Test 123` 完全匹配、confidence `0.9623`；公式图输出语义等价
  `\mathbf{x}^2+\mathbf{y}^2=\mathbf{z}^2`。复杂/手写精度仍未覆盖，OCR 继续标为实验性。
- 最终流水线：typecheck 通过；12 files / 79 tests；核心 lines `97.79%`、branches `92.79%`；
  VSIX 1,087,528 bytes，SHA-256
  `D6961DF73D359A014037ED8251F54C3784D7D698CBF401CE8202953EBFE97249`。
- 最终基准：warm p50/p95 `18.92/52.12 ms`；bounded scanner p95 `0.745 ms`；cold round-trip
  p95 `261.54 ms`（未达 180 ms 目标）；峰值进程 RSS 相对基线 `82.41 MiB`，idle restart 通过。
  这些数据不能替代与 Ultra 在同一机器上的 CPU/RSS/输入延迟对照。

## 2026-08-19 v0.1.1 预览根因修复与产品页更新

- 用户截图不是“decoration 完全未出现”：第一条公式 closing `$` 后的孤立斜体 `u` 正是旧预览。
  `\begingroupSandbox expression` 只将首个 TeX atom 纳入 sandbox，导致 `u\equiv±1` 只输出 `u`，
  后续运算符、数字和 caret marker 全部消失。修复为 `\begingroupSandbox {whole expression}`；实际
  Worker smoke 宽度从约 `1.452ex` 恢复为 `7.361ex`，并检测到 `2261/2212/31` glyph 与 caret class。
- 独立只读 controller 审计确认：中文前缀不影响 UTF-16 offset；opening delimiter、公式正文和
  closing delimiter 前均命中；data URI、after range、active-editor identity、definition Promise
  复用和 latest epoch 均不是本案根因。首次多依赖 workspace 查找仍是非阻塞性能优化点。
- 图标通过内置 ImageGen 生成“丝带数学轨迹 + 白色源码光标”的无文字标识，再确定性缩放到
  `media/icon.png` 256×256 / 74,693 B。三张预览用轻量 SVG 精确绘制真实交互结构；README、简介、
  commands/config descriptions 改为中英双语，VSCE 使用 `--no-rewrite-relative-links` 保留包内媒体。
- v0.1.1 最终验证：12 files / 80 tests，核心 lines `97.79%`、branches `92.79%`、functions `100%`；
  成功打包轮 cold p50/p95 `140.31/146.68 ms`、warm `13.74/22.10 ms`、scanner p95 `0.594 ms`、
  RSS delta `82.88 MiB`、idle restart true。相邻两轮 cold p95 `179.54/191.54 ms`，冷启动门仍不稳定。
- `silk-math-preview-0.1.1.vsix`：1,171,461 bytes，17 entries，SHA-256
  `02355295F294522A1A559F66407296E2BCC8F867C16E08E167B94F79D85CBC24`。未安装到用户 VS Code，
  未做 Extension Host 或 macOS/Linux 实机视觉验收，等待用户安装后确认最终显示。

## 2026-08-19 v0.1.2 下方浮层与零行高占位

- 用户确认完整公式已显示，但旧 decoration 的 `contentIconPath + width/height + vertical-align` 作为
  普通行内 after 内容参与布局，导致源代码行被撑高、上方出现巨大空白、输入视觉上离开原行。
- 修复采用 VS Code 已支持的相对锚点 + 绝对 before 伪元素：预览锚定公式开始位置，默认
  `top: calc(1lh + 0.25em)`，脱离文本流；hover-widget 主题面板、阴影、`pointer-events:none`，
  源码范围自身不再承载 SVG 宽高或 vertical-align。旧 after/before 配置自动兼容为 below/above。
- `src/core/previewLayout.ts` 独立生成和限制布局，测试验证方向、NaN/超大尺寸、absolute、无
  vertical-align。README/config/changelog 更新到 0.1.2，架构文档写明零行高占位合同。
- 最终流水线：13 files / 83 tests；核心 lines `97.80%`、branches `92.85%`、functions `100%`；
  cold p50/p95 `177.79/192.39 ms`（冷门失败），warm `16.61/29.20 ms`，scanner p95 `0.768 ms`，
  RSS delta `82.75 MiB`，idle restart true。
- `silk-math-preview-0.1.2.vsix` 1,172,227 bytes，SHA-256
  `968F70F88CD28DDBB820579106CD3CDC160EBC3D6B986C5CC05F3B413B0FDB3B`；归档与 package/README/
  changelog/3 bundles 逐字节一致。未修改用户 VS Code 安装，未做 Extension Host 视觉 QA。

## 2026-08-19 v0.1.3 Light/Dark 主题浮层外观

- 用户要求下方浮层具有明确背景、圆角，并自动适配 Light/Dark。实现保留单个绝对定位
  decoration：面板使用 `editorHoverWidget.*` 原生主题令牌、8px 圆角、细边框、
  `0.5em 0.65em` 内边距和 overflow 裁切。
- Light 用浅蓝灰低透明度阴影，Dark 用更深但有界的双层阴影；High Contrast 取消阴影并使用
  2px `contrastBorder`。主题变更仍会清空 SVG cache 并重绘对应前景/光标色。
- 聚焦 12/12 通过，完整 13 files / 83 tests 通过；核心 lines `97.81%`、branches `92.88%`。
  main bundle 74,352 B；warm p50/p95 `31.57/74.26 ms`，scanner p95 `1.986 ms`，RSS delta
  `81.71 MiB`，idle restart true；cold p95 `197.76 ms` 未达 180 ms 目标。
- 最终 `silk-math-preview-0.1.3.vsix` 1,172,709 bytes，SHA-256
  `C31686E8023C30A639F9EABC06909784E4A84220CA8365574A8F1411DF534DA0`，17 entries，不含 src/test/
  ONNX/WASM。未安装用户 VS Code，未做 Extension Host Light/Dark 视觉 QA，由用户安装后确认。

## 2026-08-19 v0.1.4 浮层关闭、全内置环境与垂直节奏

- 用户截图显示光标已移到 `equation` 的 `\label`，但第 115 行旧行内公式浮层仍保留。
  两个根因叠加：跨公式 selection 在异步快照完成前不立即清屏；而 Worker 又因顶层
  `equation` 嵌套失败，所以新预览无法替换旧预览。
- 现在跨出 active region 会同步清除，`Esc` 在 `silkMath.previewVisible` context 下调用
  `dismiss()` 并使所有在途 epoch 失效；下一次移动或编辑仍能自动重开。
- 17 种内置数学环境全部经过真实 MathJax 参数化回归。外层 display 环境转为
  `aligned/alignedat/gathered` 或直接内容；`\label/\notag/\nonumber` 仅从渲染副本去除，
  点击它们仍会把 caret 显示在相邻可见位置。`alignat` 列数参数有额外安全吸附。
- 浮层 top/bottom offset 从 `1lh + 0.25em` 改为 `1lh + 0.08em`，整体上移约 `0.17em`，
  上方空隙更小、下方空隙更大。
- 聚焦 47/47，完整 14 files / 104 tests；核心 lines `97.78%`、branches `92.75%`。main bundle
  76,153 B；warm p50/p95 `25.52/43.13 ms`，scanner p95 `1.315 ms`，RSS delta `82.97 MiB`，
  idle restart true；cold p95 `196.90 ms` 仍未达 180 ms 目标。
- 最终 `silk-math-preview-0.1.4.vsix` 1,173,704 bytes，SHA-256
  `049B220B9A5670A064B3F01E03975A02E32A91FF1BE141D9CCD1D5E799C31D51`，17 entries，不含 src/test/
  ONNX/WASM。未安装用户 VS Code，未运行 Extension Host 视觉 QA。
