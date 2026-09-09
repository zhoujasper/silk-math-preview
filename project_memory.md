# Silk Math Preview 项目记忆

## 2026-09-09 GitHub 同步（0.2.8）

- 按用户要求同步 GitHub 仓库，沿用 `main` 和 0.2.8，将 0.2.1 之后的预览 CSS、分屏定位、菜单失焦、即时清除、OCR 改进、测试及多语言文档一起纳入；主代理独立完成，保留用户唯一 Git 作者，不添加共同作者。
- 推送前确认本地基线与远端 `main` 均为 `3d8f9e7b79660255b00cab51e32467c36af9439c`，远端尚无 0.2.8 标签。完整 `npm run verify` 通过：40 files / 538 tests、typecheck、coverage、build、benchmark、size；核心行覆盖率 96.60%，91 个版本的双语 CHANGELOG 提取检查通过。
- 本轮 Node 26.8.1 普通公式 cold p50/p95 48.15/52.05 ms、warm 3.76/5.27 ms，scanner p95 0.488 ms，空闲重启通过；主 bundle 201,415 B。现有两份 0.2.8 VSIX 哈希未改变，共享 Worker 与当前构建、15 份 GPL 对应源码一致，正式包的主模块及两个 CSS 模块亦一致。未启动浏览器或 Extension Host。
- 发布流程继续从对应 CHANGELOG 提取完整中英双语说明；README 保留全部 11 种语言。远端 CI、标签与下载资产的最终结果将在完成后回填；仓库当前没有 `VSCE_PAT`，Marketplace 与 GitHub Release 分别核验。

## 2026-09-09 离开公式立即清除预览（0.2.8）

- 主代理独立修复。根因是旧鼠标选择策略：若点击位置所在行被估算为浮层占用行，直接 keep-without-clear；当前浮层不接收鼠标事件，这个旧滚动条例外把同一行正文、下方空白和附近正文也当成预览操作。移除该例外、占用行估算及无用的事件类型转换。
- 选择事件与异步更新共用源码定位；光标/选区完全离开公式时同步清除图片、锚点与可见状态。统一清理取消排队渲染、定义刷新和延迟错误提示，递增 epoch 拒绝晚到结果；定义刷新返回也检查 epoch。切换公式先清旧帧，重新进入仍可预览，整块选区仍覆盖当前公式时保留，后台编辑器的选择事件不会误清当前预览。
- 新增 20 项控制器回归，覆盖 4 种事件来源 × 3 个离开位置、整块选区、返回与切换、后台分屏、Math/TikZ 迟到结果、TikZ 排队刷新、延迟错误及定义读取。修复前测试复现保留和多余刷新，修复后通过。删除已无用途的占用行估算测试，保留相关源码/CSS/渲染验证。
- 完整 npm run verify：40 files / 538 tests，typecheck、coverage、build、benchmark、size 均通过；核心 stmts/branch/lines 94.05%/88.51%/96.60%。普通公式本机 Node 26 cold p50/p95 48.69/52.33 ms、warm 3.80/5.37 ms，scanner p95 0.342 ms，空闲重启通过。主 bundle 201,415 B，低于 200 KiB 硬门。
- 从真实 0.2.7 与 0.2.8 双通道 VSIX 加载主 bundle 和布局模块，在临时进程中仅暴露控制器用于调用，以最小 VS Code API 夹具和受控渲染响应验证；旧包都能复现第一次点击仍保留，新包 114 项断言通过。原生 decoration 的 dispose、源锚点/图片移除、可见状态和过期响应均核对；未打开浏览器或 Extension Host，不是用户机器图形界面验收。
- 正式 `silk-math-preview-0.2.8.vsix`：2,277,226 B，SHA-256 `0b4d945314d41456d84721a531dbd9f0bef73b9a057f3d84e0099fece902dc68`。
- 测试 `silk-math-preview-test-0.2.8.vsix`：2,277,359 B，SHA-256 `57d8a16911e01c6e96b521075436cb39a591dcca169b3c9cdcb9255ccde93c25`。
- 两包各 24 条目；版本、通道、默认开关、ZIP、README/双语 CHANGELOG、构建字节和 15 份 GPL 对应源码核对通过。dist 恢复正式通道。保留现有 CSS、OCR/TikZ、语言/发布改动与旧 VSIX；未安装、提交、推送或发布。验证材料在 `/tmp/silk-dismiss-qa/`。

## 2026-09-09 预览留白、圆角与双语 CSS 使用说明（0.2.7）

- 主代理独立调整：默认 padding 为上下 4px、左右 8px，圆角由 8px 改为 6px；CSS 的 padding / border-radius 继续覆盖默认。外框尺寸包含四边内边距和边框，空间足够时保持公式原大小；保留等比例缩放、分屏边界、高对比主题和 notebook 占位。
- 全部 16 个 CSS 参数共用中英文说明：默认值、范围、单位、方向、padding 的 1–4 值写法、示例及重置方法。模板、补全和悬停一致；“参数说明与示例 / Guide & examples” 可为旧 CSS 补齐帮助，原声明不改，新示例均为注释。说明太长时提示且不改编辑内容。防覆盖默认值明确只由 anchor/placement/gap/allow-overlap 四项触发，单独偏移或字号不改变原策略。
- 说明仅随 CSS 编辑模块按需加载，普通预览布局不携带说明/模板。README 的 11 种语言同步留白、圆角和双语帮助，CHANGELOG 保持中英逐项对应。
- 完整 npm run verify：40 files / 519 tests，typecheck、coverage、build、benchmark、size 通过；核心 stmts/branch/lines 94.04%/88.47%/96.61%。最后一处双语措辞精确化后另通过 100 项 CSS 测试。包内编辑模块 318 项断言通过，涵盖每项配置保存、双语模板逐项启用、真实 0.2.6 旧模板补入帮助、重置和通道隔离。
- 包内布局模块 305 项 Chrome 152.0.7977.77 无头断言通过；新增默认/四边内距、边框、高对比、字号不挤小、尺寸限制、窄分屏及两通道各方向。查看截图并核对控制台；未打开浏览器窗口或 Extension Host，不代替 VS Code/Windows/Linux 实机验收。
- 主 bundle 202,004 B，布局模块 17,330 B，硬门保持不变。普通公式本机 Node 26 cold p50/p95 48.10/52.40 ms，warm 3.84/5.50 ms，scanner p95 0.464 ms，空闲重启通过；仅为本轮环境记录。
- 正式 `silk-math-preview-0.2.7.vsix`：2,276,882 B，SHA-256 `b21feebd743492c8677050bf583b88ca44ed6a050a6ac537c9a2fc9fd927f6c7`。
- 测试 `silk-math-preview-test-0.2.7.vsix`：2,277,012 B，SHA-256 `7135751bebb0e81abe01f28f870e819574516f084835417c51f515ef21a3aca2`。
- 两包各 24 条目；通道、默认开关、版本、ZIP、当前 README/CHANGELOG、构建字节和 15 份 GPL 对应源码均核对通过。dist 恢复正式通道。保留全部既有功能、文档和旧安装包；未安装、提交、推送或发布。验证材料位于 `/tmp/silk-advanced-css-qa/`。

## 2026-09-09 高级预览 CSS、定位与严格验证（0.2.6）

- 主代理独立实现 `--silk-anchor`（formula/cursor/selection）、`--silk-placement`（above/below/right）、`--silk-gap`（px/lh）、`--silk-allow-overlap` 与 `font-size`（px/%），保留左右/上下偏移与外观。1lh 按编辑器真实行高；空选区按光标，右侧从实际源码边缘计算，禁止覆盖时保护整块源码。软换行或超过 256 个可见逻辑行时，右侧防覆盖保守回退到下方；无空间时不显示。不新增固定左上角模式。
- 原生 CSS 页增加声明/值补全、悬停说明及「高级参数示例」CodeLens；旧 CSS 不自动改写，点击后插入注释示例，保存生效、清空恢复。所有选项和示例均按正式/测试命名空间隔离；字号缩放矢量图，CSS 修改和光标定位复用 Worker 缓存。TikZ 字号缩放整图，不重写节点字体。
- 严格布局测试发现行内伪元素不能可靠引用祖先包含块和其他绝对定位行。改在 overflow-guard 的覆盖层绘图，CSS 同时引用真实内容视口和源码边缘。源边缘使用各 decoration 独立的 before/after 零宽标记，防止双通道共用源码 span 时互相覆盖 anchor-name；图片 URL 保留 data URI 原始编码。整个公式滚出视口隐藏，滚回复用原图，Esc/切换清理所有标记和覆盖层。
- 用户追加严格测试要求后，使用本机已有 Chrome 152.0.7977.77 无头模式与独立临时配置，无浏览器窗口、无 Extension Host。包含 Monaco 绝对定位、contain: strict、短 span 和相邻 PDF 的布局夹具共 228 项实际断言通过；含 3 基准 × 3 方向 × 2 覆盖策略 × 2 通道、行/像素间隔、字号、外观、正负/极端偏移、窄视口、滚动、尺寸限制、空选区，以及双通道同时启用/关闭一边后的隔离。检查截图和控制台；测试是浏览器布局/API 回归，不是全版本 VS Code 或 Windows/Linux 实机证明。
- 最终 `npm run verify`：40 files / 508 tests、typecheck、coverage、build、benchmark、size 全通过；核心 stmts/branch/lines 94.02%/88.42%/96.60%。本机普通公式 cold p50/p95 48.27/52.06 ms，warm 3.77/5.37 ms，scanner p95 0.319 ms，idle restart 通过。主 bundle 201,967 B，布局模块 16,888 B，按需 CSS 编辑模块 13,640 B；未放宽 200 KiB 主包门限。
- 两份实际 VSIX 的布局模块通过上述 228 项；包内 CSS 编辑模块另通过 170 项参数保存/读取/恢复/错误与注册断言。每包 24 条目，版本/通道/默认 TikZ false、命令/设置/虚拟 URI、Worker 与构建匹配、15 份 GPL 对应源码逐文件一致通过。README 11 种语言和 CHANGELOG 在还原 vsce 链接规范化后与当前文件一致；dist 恢复正式通道。
- 正式 `silk-math-preview-0.2.6.vsix`：2,273,027 B；SHA-256 `ec0ad38db9770edc79761eb8b4dce4395a2f6e376d6342e8cfe650df9653288f`。
- 测试 `silk-math-preview-test-0.2.6.vsix`：2,273,160 B；SHA-256 `4cdf9a2038aca006a990615cc7b0b5439ecd7b645b48f4588915bca43b48dcc1`。
- 保留同期 OCR 0.2.5、菜单/短结束行修复和 README/发布语言任务的代码、文档、旧包与唯一作者约定。README 中本任务新增的高级 CSS 说明由同期本地化任务整合进原有 11 语言条目；本轮不重复追加。未安装、提交、推送或发布。参数与限制见 `docs/PREVIEW_CSS.md`；本机一次性验证脚本、日志和图片在 `/tmp/silk-advanced-css-qa/`，不进入 VSIX/Git。

## 2026-09-09 README 11 种语言补全与本地化

- 用户要求补齐各语言缺失的介绍，并使用合理的本地化翻译。主代理独立核对中英信息的并集与当前菜单、快捷键、通道清单和功能文档，完整改写现有 11 种语言；保持英文优先、单文件、原语言导航、4 张图片及许可页脚。
- 各语言统一覆盖实时公式/表格、宏包与未保存依赖、安装要求、预览开关/文件范围、CSS、TikZ、OCR 输入/快捷键/精度和测试版。明确最低 VS Code 1.95、TikZ/其他文件类型默认关闭、正式与测试图片粘贴默认值、离线组件及兼容边界；未把受限预览写成完整 TeX。
- 使用自然术语：繁中为游標/巨集/剪貼簿，德语快捷键使用 Strg，葡语延续巴西葡语。CSS/TikZ/文件类型菜单逐项对照 `uiLocale.ts`；OCR 图片输入目前仅中英/繁中，其余语言保留实际 `Recognize image…` 并解释含义。中文技术文档链接明确标注语言，TikZ 链接标注中英。
- 保留并同步同期新增的 OCR 留白裁剪、背景处理、一次重试与表格复核；另一任务随后写入 CSS 高级定位功能并在九种语言追加重复项，本轮将光标/选区/整块公式基准、上/下/右位置、行/像素间距、字号、防覆盖、补全、悬停帮助和高级示例合并进全部语言的原 CSS 条目。
- 一次性 Markdown 结构与内容核验通过：11 ×（4 段介绍 + 8 个功能项），共 88 条功能说明；每种语言 31 个代码示例/标识相同（归一化 Strg/Ctrl），共 44 个文档引用目标一致且存在。页内锚点、菜单名、系统/版本与本地图片/链接均通过。把内联 HTML 改为标准行内代码后，`\(...\)`、`\[...\]` 不再丢失反斜杠；修复韩语省略号后的加粗边界。
- 现有 `test/previewManifest.test.ts`、`test/uiLocale.test.ts` 共 14 项通过，文档 `git diff --check` 通过。按项目规范沿用已有 dist/VSIX 运行 benchmark/size：本机 cold p50/p95 47.95/53.50 ms、warm 3.83/5.33 ms、scanner p95 0.475 ms，空闲重启通过；主 bundle 201,830 B，既有包未超限。仅为已有构建状态，不是本次文档改动的性能收益或重新打包结果。
- 本轮只编辑 README、AGENTS 与项目记忆；未主动修改版本/扩展实现，未打开浏览器/Extension Host、重新构建、打包、安装、提交或发布。其他任务的代码、文档、版本与产物变化均保留。
- 后续每次介绍更新应同步完整功能清单和限制，复核本地化语义及实际菜单；条目数一致只作为缺漏检查，不能替代人工语义核对。相关约定已写入 AGENTS.md。

## 2026-09-09 OCR 背景、留白与结构优化（0.2.5）

- 用户反馈单行特征值公式被识别成空表格，并漏掉右侧非零条件。原始 400×104 文件在本机旧安装包及当前修改前源码下能识别完整；同图变色/加留白后真实复现 `array`、`hline` 和字母错误，不能把变体复现冒充原文件稳定复现。
- 主代理独立实现 `formulaImage`：边缘背景极性、原分辨率全部笔画边界、浅色/深色白底、低对比度增强、保留抗锯齿与细点、等比例缩放。不会依据小连通域面积丢弃标点/上标；右侧条件与主体一起裁切。
- `formulaStructure` 核验括号/环境、孤立规则、简单数组列数与图上真实格线；数学空白压缩保留控制词边界、显式间距及文字参数。仅对确认单行、简单无框且只有一行有效内容/至少两空行的数组提取有效内容，其他矩阵/分段/对齐/带框表格保持结构。无证据时不补写漏字，不重建未知单元格。
- 解码计算 token 概率，只在结构可疑或低置信度时调整边距再试一次；同图最多两次，不新增并发或模型。正常 EOS 才可成功；无法解决则保留结果并标复核。空白在加载模型前返回。智能模式保留真实表格整表和复核状态，避免回退文字行打散单元格。
- 9 files / 62 项 OCR/通道相关单测与类型检查通过，涵盖有效表格/矩阵正例、用户空数组、非法结构、数字空白、右侧条件/标点、深浅背景、低对比度/透明底、一次重试、空白不加载模型、张量释放与既有取消/恢复。未运行全量覆盖率或图形界面。
- VS Code Node 24.18.1 实际 Worker 19 次：原图、8 张其他公式/表格图及稀疏表格、5 个变色/大留白图、4 个智能模式。16 次识别通过；3 次带框表格保留但仍多列/边线不准，新版明确 `ok:false`，不计为准确识别。原图 cold 2.070 秒，背景/留白变体 warm 1.407–1.578 秒。记录 `.tmp-ocr-accuracy/accuracy-final.json`；固定图片及可复测脚本 `scripts/validate-ocr-accuracy.mjs` 已入项目。
- 本机 Node 26 普通预览 cold p50/p95 48.07/51.87 ms、warm 3.85/6.36 ms，scanner p95 0.459 ms，idle restart 通过。沿用模型包 `2026-08-18.1`；无训练、更换模型、下载或新增依赖，复杂表格/手写/字体仍需复核。
- 版本更新至 0.2.5，新增完整中英 CHANGELOG、OCR 说明与 README 全部 11 种语言介绍。保留已有 VSIX 与同目录正在改动的预览布局/历史双语日志/CI；未安装、提交、推送或发布。
- 冻结当前全目录草稿时发现同期布局代码尚未验证完成：全量单测 445 通过/1 失败（高度变化后的 decoration 次数），该快照首次类型检查还出现通道字面量比较错误，随后当前工作区类型检查已通过。没有交付该草稿包，也没有改写/回退其他任务文件；最终交付改为在已验证的正式/测试 0.2.4 VSIX 上更新 OCR Worker、两种清单及 README/CHANGELOG，使用 `-ocr` 文件名隔离其他任务产物。README 使用加入 OCR 说明后的固定快照，保留工作区随后继续改写的多语言介绍。
- 最终正式 `silk-math-preview-0.2.5-ocr.vsix`：2,249,701 B，SHA-256 `5904b33264961dd5b0d63375192be2380e2eee4b2a9c089e10312c216e6c412a`；测试 `silk-math-preview-test-0.2.5-ocr.vsix`：2,249,830 B，SHA-256 `a2c10d1cd7b24ebdda92bb2a794fabe2289b339265d9a3e922326b8c1eab8395`。内部版本均 0.2.5，各 24 条目。
- 两包除 `extension.vsixmanifest`、`extension/package.json`、`extension/readme.md`、`extension/changelog.md`、`extension/dist/ocr-worker.js` 外，其他条目与各自 0.2.4 包逐字节一致。基础包哈希仍为 `c24fb284ae92987f870177e0aa6db08c8c66e226dea93eea66892fff7bdf52f1` / `c4c575323d16c8d752df073f2a79429eabccbd27787c43578fd41ee36ebf1bc0`；GPL Worker 及其 15 份对应源码档原样保留，不能与正在改动的全工作区源码混为一份构建。
- 归档 CRC、版本、通道 ID/命令/设置、TikZ 默认关闭、README 11 语言/当前双语说明、无源码/测试图/模型/WASM/日志均通过。包内主 bundle 正式/测试 201,065/200,995 B，OCR Worker 均 228,493 B，与当前 OCR 源码构建完全一致；只将 `dist/ocr-worker.js` 同步为交付字节，其他 dist 留给同期布局任务，不做整体覆盖。
- 最终正式包提取的 Worker 再跑全部 19 项：16 次识别通过、3 次真实表格保留复核，记录 `.tmp-ocr-accuracy/packed-final-v2.json`；原图 cold 2.371 秒、5 个背景/留白变体 warm 1.445–1.471 秒，初段与其他本机验证有重叠，仅代表此次本机运行。最终测试包又独立跑原图，两包 OCR 字节完全一致。当前 9 files / 62 项相关测试与类型检查通过；双次低置信度也明确复核。
- 用正式包内实际渲染 Worker 回读原图识别输出：与 `A\mathbf{v}=\lambda\mathbf{v},\qquad\mathbf{v}\ne\mathbf{0}` 的 SVG 逐字节相同，140.01×14.74 px。该包普通渲染基准 cold p50/p95 56.59/68.76 ms、warm 5.39/12.00 ms、scanner p95 0.519 ms、idle restart 通过；此轮与 OCR 同时运行，不将波动当作回归或跨机器承诺。

## 2026-09-09 其他文件与短结束行预览修复（0.2.4）

- 用户截图：已勾选「其他文件类型」，`Untitled-1` 内三行 `\[...array...\]` 没有可见预览。真实 StatusController 策略已允许未保存纯文本，扫描与重建可见公式的 Worker 渲染均正常；本轮修复的是 CSS 视口 anchor 无法解析后的尺寸和位置回退。无法仅凭截图确认用户完整原公式及全部宿主状态。
- Monaco 的绝对定位文字 span 可能仅容纳 `\]`；旧 `anchor-size(... width, 100%)` / `anchor(... right/bottom, 100%)` 回退不是编辑器视口。现用已知 SVG 尺寸和原有上方/下方落点回退，不增加轮询或 Worker 请求；有效 anchor 仍负责精确视口限位。无 anchor 的窄分屏精确边界仍是限制，不能把回退当作真实尺寸测量。
- 新增 5 项轻量回归。直接加载 0.2.3 旧包及 0.2.4 双通道布局模块，在 16px 结束行/无 anchor 的 CSS 计算场景下，126px 宽图从旧 8px 恢复为 126×88px，落点 22px。真实文件类型策略到 decoration、未保存文件即时启用与关闭通过。
- `npm run verify` 36 files / 414 tests、类型、覆盖率、构建、普通公式性能和体积全部通过；核心 stmts/branch/lines 93.88%/88.46%/96.52%。Node 26.8.1 cold p50/p95 47.97/52.87 ms、warm 4.02/7.99 ms、scanner p95 0.499 ms，idle restart 通过；仅为本机结果。主 bundle 201,065 B，独立布局模块 9,251 B。
- 两份实际 VSIX 均在 VS Code Node 24.18.1 中运行包内 Worker，完成数组+光标和后续公式，共 4 次；数组 125.72×88.08px、约 9.1ms。ZIP、通道命令/设置、默认 TikZ/其他类型关闭、当前双语说明、构建字节与 15 份 GPL 对应源码一致；24 条目，dist 恢复正式通道。VSCE 将历史示例 `command:id` 链接转换成 GitHub 路径，两包一致，当前版本说明没有该转换。
- 正式 `silk-math-preview-0.2.4.vsix`：2,247,917 B，SHA-256 `c24fb284ae92987f870177e0aa6db08c8c66e226dea93eea66892fff7bdf52f1`。测试 `silk-math-preview-test-0.2.4.vsix`：2,248,049 B，SHA-256 `c4c575323d16c8d752df073f2a79429eabccbd27787c43578fd41ee36ebf1bc0`。
- 主代理独立完成，保留同期菜单/CSS/双语发布流程和旧包。未打开浏览器或 Extension Host，未安装、提交、推送或发布；用户负责最终实际显示验收。本轮更新双语 CHANGELOG、项目规范和项目记忆，README 的 11 种语言保持原样。

## 2026-09-09 状态栏菜单点击外部关闭（0.2.3）

- 用户要求截图中的 Silk Math Test 菜单点击外部应关闭。根因是 `StatusController.showMenu()` 设置 `picker.ignoreFocusOut = true`；改为 false，复用已有 `onDidHide` 释放订阅、picker 与可见状态。菜单内缩放/开关连续操作仍保持打开并即时刷新。
- 主代理独立完成；正式/测试共用实现，版本统一为 0.2.3，CHANGELOG 新增完整中英记录，README 保留全部 11 种语言。类型检查、既有状态栏/TikZ 接线相关 17 项测试、发布说明提取、构建、benchmark 与 size 通过。未新增镜像实现的测试或运行全量覆盖率、浏览器/Extension Host，实际点击由用户验收。
- 本机 cold p50/p95 47.26/52.37 ms、warm 3.65/5.25 ms、scanner p95 0.437 ms，idle restart 通过；主 bundle 201,065 B，硬门不变。
- 正式 `silk-math-preview-0.2.3.vsix`：2,247,602 B，SHA-256 `fbf914d63ed9d2817b6a1fedcb74898d16906f7a1af68c079c39c44672944e85`；测试 `silk-math-preview-test-0.2.3.vsix`：2,247,735 B，SHA-256 `7ff57941b64160ad6d682c872ea93b3e467acaecfdb15ad022ed567060006d27`。
- 两包各 24 条目；ZIP、版本/通道/命令/设置隔离、TikZ 默认关闭、包内失焦关闭标志、当前双语说明以及通道无关 Worker/资源与本机构建一致均通过，正式包 dist 与本机一致。vsce 会重写历史日志中的相对链接，校验当前版本说明；测试通道的主入口与 CSS 模块使用独立命名空间，不与正式模块强行逐字节比较。旧 0.2.2 两包哈希保持一致，dist 已恢复正式通道；保留工作区其他修改，未安装、提交、推送或发布。

## 2026-09-09 文档与发布语言长期约定

- 用户明确要求：“对于我的 changelog 和我之后会发布新的版本的时候都要有中英文双语，加入记忆。readme 还是目前这些多语言”。
- CHANGELOG 每个版本及后续新版本发布说明（包括 GitHub Release）都写完整中文和英文，固定 `### 中文` / `### English`，更新、修复、限制和已知问题逐项对应。不可仅翻译标题或用单语自动生成摘要替代。
- README 继续维护现有 11 种语言：英文、简体中文、繁體中文、日本語、한국어、Deutsch、Français、Español、Português、Русский、Italiano；保留单文件和页内语言导航，后续介绍更新保持这些语言，不缩减为双语。
- 主代理独立补齐全部 85 个版本（0.1.0 至 0.2.2）的双语记录，保留原文、版本标题与日期；同期新增的 0.2.2 记录一并翻译。本轮未改写 README，保留同期 CSS 功能任务新增介绍及全部 11 种语言。
- 新增 `scripts/release-notes.mjs`，按准确版本提取并检查中文/英文两节及条目数；CI 测试阶段检查，发布前再次提取，GitHub Release 创建和更新均使用该内容。发布前仍需核对语义一致。文档见 `docs/PUBLISH.md`。
- 本轮只做文档与发布说明流程检查，不构建、打包、安装、提交、推送或发布扩展；保留工作区已有功能修改。
- 核验：85 个版本、185 对条目、全部原语言正文和版本标题/日期保留；提取器全部历史版本与当前版本 CLI、CRLF、准确版本匹配、缺失/重复/单语/空内容及条目数不匹配等检查通过。CI YAML/shell 语法和 GitHub Release 创建/更新分支通过本地 gh 替身验证，双语说明在发布前生成；未访问网络发布。本次未刷新已有 VSIX 中的 CHANGELOG。

## 2026-09-09 预览 CSS 与分屏遮挡修复（0.2.2）

- 按用户顺序完成：状态栏菜单「编辑预览 CSS…」打开原生 CSS 标签，保存到用户设置后生效，清空保存恢复默认。支持有界偏移、最大尺寸、背景/边框/圆角/阴影/透明度和内边距；模板、声明校验、保存失败保护及外部设置变更同步均已接入。正式/测试通道设置、命令、虚拟文件 URI 隔离；不创建工作区 CSS 文件。
- 遮挡根因来自源码分析：旧版按 120 列（14px 字号时约 1008px）估宽，忽略真实分屏；Monaco 行宽是 scrollWidth 且祖先裁剪，z-index 不能解决。现在用内容视口的 CSS anchor 限位，宽/高图等比例适应，拖动分屏/水平滚动由 CSS 重排；补上纯高度变化签名。两通道都声明完整 anchor-name 列表，避免同时启用时互相覆盖。
- CSS 保存只重画缓存 SVG，不重复请求 Worker；CSS 编辑器独立模块按需加载。CSS 不允许其他选择器、外链或绕开限位的 position/transform。最低 VS Code 1.95（Chromium 128）。保持上方/下方偏好，用户明确暂缓的固定左上方模式未实现；独立 PDF 应用窗口覆盖属于系统窗口层级，CSS 无法改动。
- 本机校验：`npm run verify` 36 files / 409 tests、typecheck、coverage、build、benchmark、size 全通过；核心 stmts/branch/lines 93.87%/88.46%/96.52%，CSS 解析器四项覆盖率 100%。随后双通道 anchor 列表调整又通过类型和 34 项相关测试/构建/size。Node 26.8.1 cold p50/p95 47.29/51.18 ms，warm 3.75/5.25 ms，scanner p95 0.459 ms，idle restart 通过；数值仅代表本机。
- 包内新增 CSS/布局模块已从两份实际 VSIX 中加载验证解析、限位声明、编辑文件、保存、清空及拒绝无效 CSS。ZIP/通道/默认 TikZ 关闭、Worker 与正式构建一致、15 份 GPL 对应源码逐文件一致均通过；每包 24 条目，无源码目录/缓存/日志/模型。`.vscodeignore` 增加临时目录递归及日志排除；dist 已恢复正式通道。
- 最终主 bundle 201,065 B；独立布局模块 9,184 B，按需 CSS 编辑模块 6,377 B，200 KiB 主包硬门未放宽。
- 产物 `silk-math-preview-0.2.2.vsix`：2,247,531 B，SHA-256 `4647b9312e2655edccf58235447a979483d6db61003b0bc76900620ccb65883f`。
- 产物 `silk-math-preview-test-0.2.2.vsix`：2,247,663 B，SHA-256 `650ba71da295ad7a5e7e257de6ceffab8b1bc7264cb496cbd0220f057c3fdf6c`。
- 同目录另一任务的发布日志双语化、CI 与发布说明脚本改动已保留；两包含打包时的 0.2.2 中英说明，随后并行修改的历史日志不追溯进已验证包。本轮未改动这些发布流程实现，功能与对应源码仍匹配当前构建。
- 主代理独立完成；保留原有磁盘维护记录与 0.2.1 两个 VSIX，旧包哈希保持一致。未打开浏览器/Extension Host，未安装、提交、推送或发布；最终双屏图形界面由用户验收。使用与限制见 `docs/PREVIEW_CSS.md`。

## 2026-09-08 项目磁盘维护

- 主代理独立清理约 19.59 MiB：三个 VSIX 解压验证副本、旧 pgfplots 1.18.2 测试运行时、覆盖率及 Vite 缓存、Finder 显示元数据。
- 保留正式/测试 VSIX 和原安装包备份、当前 TikZ 离线运行时、验证脚本及性能记录、对应源码、dist 与全部主项目 node_modules。约 799 MiB 开发依赖主要包含 OCR/ONNX 和 MathJax，不能按目录大小直接删除包内文件。
- 核验：源码与安装包哈希、保留文件元数据及 Git 状态与清理前一致，Git fsck 通过。本轮未改功能、运行浏览器、重新构建或发布。


## 2026-09-07 GitHub 同步（0.2.1）

- 用户授权更新 GitHub，沿用现有 `main` 和 0.2.1 版本，整合自远端 0.1.76 以来的 OCR、数学兼容、TikZ 与性能改进、文档及测试。主代理独立完成本地检查、提交推送与发布核验，保留用户唯一 Git 作者。
- 已刷新远端并确认基线 `2ce56337a57351753212bfe0bad616408e261c6e` 没有分叉；9 个文本文件恢复仓库原有 LF 换行，其中 4 个没有内容改动。全部实际代码修改保留。
- 本轮 `npm run verify` 通过：34 files / 373 tests；核心 stmts/branch/lines 93.65%/87.88%/96.36%。Node 26.8.1 普通公式 cold p50/p95 47.55/51.43 ms、warm 3.75/5.37 ms、scanner p95 0.477 ms，idle restart 通过。未重复复杂 TikZ 长测，不运行浏览器或 Extension Host。
- 重新打包并核验双通道 ID、默认开关、22 条目、归档完整性、Worker 与当前构建一致、GPL 对应源码逐文件一致；工作目录 `dist` 恢复正式版。原 VSIX 保存在 `.tmp-tikz-smoke/github-sync-20260907-original-449_5v7_/`。
- 本轮正式 VSIX 2,226,136 B，SHA-256 `9a57cabdcd9c0b12ff56ced52ab0d6760c22963d54c6525f5be92d32b63fde35`；测试 VSIX 2,226,263 B，SHA-256 `241aca006ca50d3b4aad698488fbd6fb271a02ec5bcab9f38ea1d8efe27837c4`。源码归档随 LF 规范化更新，Worker 字节没有变化。
- 发布提交 `1030d0b37476be3231f71a0db1a5c6ee65f98db6` 已推送 `main`，GitHub Actions `34108000223` 的 test / publish 均成功；远端 373 项测试通过。标签 `0.2.1` 指向该提交，Release 已公开，双通道安装包和详细说明就绪。仓库没有 `VSCE_PAT`，Marketplace 步骤明确跳过，商店未同步。
- 已实际下载并核验远端正式/测试 VSIX：分别 2,222,698 / 2,222,832 B，SHA-256 分别 `577718a71223f8e8b42e23aa6007a47f50c750fea000fed7b12a8861fbdbbffc` / `68bd9aed60893623ce134964733151fd35ec7a0359d88b393d4e8350b576444e`，与 GitHub 记录一致；ZIP/清单/默认开关通过，Worker 与本机构建一致，15 份对应源码与发布提交逐文件一致。不要混用本地包与 CI 包的压缩哈希。
- 远端结果以单独的文档提交回填，使用 `[skip ci]` 避免重复覆盖同版本发布资产；没有代码变化，不重复渲染测试。安装包、缓存、模型和临时验证输出不提交 Git。

## 2026-09-07 TikZ 兼容修复、复杂图验证与资源优化（0.2.1）

- 修复截图 `compat=1.18`：旧缓存含 pgfplots 1.16；现在随 VSIX 分发未修改的 pgfplots 1.18.3 完整宏源码（105 个 TeX 文件，压缩 720,878 B，SHA-256 `77f39113e52895dde53d042dd49c0600ca21884a7cdb1bf7121354b73e344ecb`），仅在可选 Worker 内覆盖旧包，原 WASM 缓存不改写、不重下载。默认兼容 1.18，尊重显式设置。
- 保留库/宏包选项并在导言区加载；支持分组、填充、统计、日期等库，补齐旧式样式、数学函数、图层与内存表声明。修复渐变变黑、纹理定义缺失；缺字、缺失 SVG 引用、未支持的 SVG 驱动功能会明确报错。
- 新增测试发现圆与线交点触发 300 项参数栈上限。对固定 SHA 的 PGF 库在内存中将四个递归函数体包装成无参数延续，提前释放参数帧；运算、精度、顺序不改，真实圆线交点通过。适配器与对应源码随 GPL Worker 分发。
- 密集曲面原 SVG 嵌套深度 1165，图像读取器拒绝。现在线性重建并压平纯继承颜色分组至 8 层；保留变换、裁剪、命名引用和组透明度。重复标签复用原坐标下的精确轮廓，80 分式同一帧从 978,101 B 降至 100,233 B。36 张真实 SVG 均由默认独立图像读取器成功栅格化；7 组复杂图做逐像素对照完全一致；密集曲面新 SVG 在默认读取器中成功并人工查看。旧曲面无法正常读入，未宣称它也完成像素对照。
- 宏包与原生定义分开缓存，各只保留当前一份；相同页共享。抛物线场景核心/宏包/定义的逻辑快照约 10.38/14.75/14.75 MiB，实际共享缓冲约 18.88 MiB，WASM 固定 68.75 MiB。上下文/帧错误均能恢复；图形内全局定义不污染下一帧。关闭仍不加载 TikZ，空闲 60 秒、Esc/关闭与 15 秒超时回收。
- 同一机器、VS Code Node 24.18.1、相同 21 次外部宏编辑前后：首次 475.79/481.26 ms，热 p50 319.53/103.01 ms，p95 324.68/105.88 ms；CPU 7202.01/2798.93 ms，测试进程峰值 RSS 297.81/283.34 MiB。RSS 不是 VS Code 总内存或净增量；不宣称该组件只用几 MB。
- 最终 Worker 96 次真实正确性/恢复请求通过：31 种图库图形、8 个兼容/设置场景、3 种额外环境、16 组原生定义对照及错误/限制/超时/空闲恢复。另有 109 次压力请求，含 8 组复杂图各 6 次源码变化、30 请求突发合并（28 次跳过）、30 帧多公式标签长测及重启；实际计算 81 次。新增树、交点、图层、角标、逻辑门、曲线文字、参数曲线和向量场。
- 长测期间环境有明显波动：普通曲线 p50 268 ms、625 点曲面 p50 7.27 秒（此前平稳轮约 2.27 秒）；最终 30 帧标签均不超过 324 ms。测试宿主定时器间隔 p95/max 12.10/25.20 ms，空闲 500 ms CPU 0.49 ms。记录全部数据于 docs/TIKZ_PERFORMANCE.md，不把最快一轮当作普遍承诺。任意 TikZ/复杂图瞬时低耗无法保证；LuaTeX、外部文件、额外 CTAN、CJK、path fading 等边界仍明确保留。
- 校验：34 files / 373 tests；typecheck、coverage、build、普通公式 benchmark、size 均通过。核心 stmts/branch/lines 93.65%/87.88%/96.36%；普通公式 Node 26 cold p50/p95 47.48/51.33 ms，warm 3.67/5.38 ms，scanner p95 0.362 ms，idle restart 通过。主 bundle 202,783 B，TikZ Worker 293,345 B，上下文 4,841 B，OCR Worker 223,351 B。
- 正式 `silk-math-preview-0.2.1.vsix`：2,226,257 B，SHA-256 `7b68723501d7eae75c1836ae35d0ea95d7a630ecc577059e2d68f0b23c16cf38`。
- 测试 `silk-math-preview-test-0.2.1.vsix`：2,226,384 B，SHA-256 `be320cd1f1df58066995763f328c585459c042205a12b9ae5119d75e9208635b`。
- 均 22 条目，独立通道 ID/设置/命令且 TikZ 默认 false。正式包提取的 Worker 再次通过全部 96 次请求；包内 Worker/上下文与当前构建逐字节一致，对应源码归档逐文件核验，工作目录 dist 恢复正式通道。保留旧 VSIX 及所有此前 OCR/数学修改。主代理独立实现与验证；不打开浏览器或 Extension Host，不安装、提交、推送或发布。

## 2026-09-07 版本统一为 0.2.0

- 按用户要求将 package.json、package-lock.json 根包版本同步为 0.2.0；CHANGELOG 新增对应版本记录。
- 本轮由主代理独立完成版本调整与双通道重新打包；沿用 0.1.81 已验证的功能和性能实现，TikZ 默认关闭。
- 核验：双通道构建、包体积门限、包内版本/命名空间/默认开关及 GPL 源码归档一致性通过；两个包内 Worker 与当前构建逐字节一致，工作目录 dist 已恢复正式通道并与正式 VSIX 一致。本次仅调整版本，未重复运行上一轮的渲染和性能测试。
- 产物 `silk-math-preview-0.2.0.vsix`：1,497,528 B，SHA-256 `e249c5991605ae299d79b81b9413991041d7913c0c01b353f5c44ebecb6b0bb6`；21 条目，ID `silkmath.silk-math-preview`。
- 产物 `silk-math-preview-test-0.2.0.vsix`：1,497,654 B，SHA-256 `30888f49fe9b08c46c54910443346d302e9d0302fc1e63f692c414df0b433341`；21 条目，ID `silkmath.silk-math-preview-test`。

## 2026-09-07 TikZ 原生定义与底层优化（0.1.81）

- TikZ 使用独立原生上下文，按源码顺序保留 `def/gdef/edef/xdef/let`、定界参数、new/renewcommand、局部/全局作用域与常用条件分支；不用 MathJax 的重排/转换定义。支持图形内定义、数学分隔符里的图形前定义、未保存的本地 sty/cls/tex 依赖，以及主文件导言区。图形之后的重定义不提前生效。
- 原生声明提取器为独立 `dist/tikz-context.js`，真正进入 TikZ 时才加载。图形内编辑复用上下文，不重新读取大段前缀；前置定义或依赖变化则失效。取消 128k 截断，当前文档前缀上限 8 MiB，展开上下文与图形合计 200k 字符；动态 catcode/依赖/生成声明等仍有提取边界。
- 新的同步、纯内存 TeX ABI 适配器：取消每个文件的 asyncify 定时等待；WASM 只分配一次 68.75 MiB 工作内存，核心快照只保留约 10.4 MiB 非零页。对固定 WASM 检查四个 i32 全局布局并仅添加导出；完整恢复全局、内存、文件游标/输出，缓存最多一个宏包/上下文检查点。上游包文件不改写，额外代码随 GPL Worker 对应源码归档发布。
- 输入合并 80 ms，仍只运行当前和最新等待请求；原生语法错误/I/O 错误保留可恢复检查点，避免反复冷启动。图形内 gdef 不泄漏到下一帧；字体最多缓存 16 项。下载组件路径在本次会话校验成功后复用，Esc/关闭仍销毁 Worker，空闲默认 60 秒，超时 15 秒。
- VS Code Node 24.18.1、相同 21 次抛物线请求：旧/新首次 543.9/494.3 ms，热 p50 389.7/103.8 ms、p95 391.6/106.8 ms，累计 CPU 7688.0/2831.7 ms，测试进程峰值 RSS 447.7/275.7 MiB。RSS 含驱动/Node 固定开销，不是 VS Code 总内存；输入合并等待不计入渲染耗时。详见 docs/TIKZ_PERFORMANCE.md。
- 真实 SVG 对照原包：用户原图（280×126）、箭头/希腊字母节点、文字标签逐字节一致；修复新 I/O 边界引入的多余空格后再验证。原生宏与显式展开图形逐字节对比；补充交换图、电路、3D 绘图、错误/超时/空闲恢复。groupplots 不在当前运行时组件内，明确返回缺失文件，不能宣称支持全部 TeX/宏包。
- 校验：32 files / 357 tests，typecheck、核心 coverage stmts/branch/lines 93.65%/87.88%/96.36%、build、普通公式 benchmark、size 通过。普通公式本机 Node 26 冷 p50/p95 48.75/52.41 ms，热 3.90/5.33 ms，scanner p95 0.478 ms，idle restart 通过。
- 主代理独立完成；保留同目录 0.1.80 数字/表格优化、OCR 及所有旧安装包。未打开浏览器或 Extension Host；用户负责最终视觉验收。不开新分支、不提交、不推送或发布商店。
- 产物 `silk-math-preview-0.1.81.vsix`：1,497,430 B，SHA-256 `c11331aa1fbc6eefdbff408cbe8d3b7faed79eae811666be4c4b449dcd02d987`；21 条目，ID `silkmath.silk-math-preview`，TikZ 默认关闭。
- 产物 `silk-math-preview-test-0.1.81.vsix`：1,497,556 B，SHA-256 `505c83ebfdd54e35121f4bfa9b83bb39e5f8144e0dc39cce67500be224480c8e`；21 条目，ID `silkmath.silk-math-preview-test`，TikZ 默认关闭。
- 正式/测试包内 TikZ Worker 与当前源码构建逐字节一致；两个包内的独立上下文模块均通过 VS Code Node 24.18.1 实际导入调用。正式包内 Worker 完成 50 次真实请求验证（16 个原生定义用例、交换图/电路/3D、语法和 I/O 错误、缺失库、超时与空闲恢复）。GPL 对应源码归档与当前文件逐字节一致。工作目录 dist 已恢复正式通道并与正式包一致。
- 最终主 bundle 202,637 B，TikZ Worker 287,153 B、按需上下文 4,463 B，OCR Worker 223,351 B；200 KiB 主 bundle 和 2.5 MiB VSIX 硬门不变。


## 2026-09-07 数字显示与底层性能（0.1.80）

- 数字用十进制字符串按小数位、有效数字或不确定度舍入；支持补零、进位、half-even、方向控制和分离不确定度。精度限 ±1000，长整数不转浮点。
- 单位改为解析实际使用的符号，移除每次调用注入上百个宏的路径；支持分式、负指数、符号除号、sticky-per、幂、用户单位。只缓存展开后的纯格式结果，用户局部重定义和下一帧隔离仍有效。
- S 列按两侧实际 MathJax 字形宽度设置 MathML padding，保留原列数，不靠补几个空格，也不二次生成 SVG；普通公式不运行表格对齐测量。指数、数值宏、列选项、重复列和光标路径已测。
- 根文件：显式 `% !TeX root = ../main.tex` 或唯一已打开主文件（最多看 16 份）；只继承导言区与依赖，多个候选提示指定。不全工作区反向搜索，也不执行动态 TeX。
- 按键处理只读取前 128 字符；位于最后声明之后的普通输入复用语义版本，不重读/解析全文。宏/依赖过滤改线性游标，连续定义成批索引，序列化只做一次。
- 解析文件/打开文档/快照/路径均有数量和估算大小上限；先 stat 拒绝过大文件，关闭文档清理，已失效异步遍历停止，旧结果不能覆盖新快照。保留原有依赖顺序和未保存文件语义。
- 每帧及时清理 MathJax parseOptions、mathNode/latex、output math/table/container/document 引用，只保留可复用宏/字体；不依赖下一帧来释放大表格，空闲 Worker 仍默认 60 秒回收。
- 本机 Node 26：24 个数量单位 p50 12.33→7.09 ms；4000 宏+4000 依赖 27.75→6.32 ms；5000 位数分组 13.25→0.059 ms。GC 后测试进程 heap 17.27→15.00 MiB。普通公式冷 p50/p95 53.05/58.67 ms、热 4.38/5.90 ms；不宣称所有路径都更快或这是 VS Code 总内存。详见 docs/PERFORMANCE_0.1.80.md。
- 校验：32 files / 350 tests、typecheck、核心 coverage stmts/branch/lines 93.65%/87.88%/96.36%、build、benchmark、size 通过。主 bundle 200,495 B（仍低于 200 KiB）。不启动浏览器/Extension Host，最终图形验收由用户执行。
- 协作：主代理独立完成；保留同目录 OCR/TikZ 更新与已有 VSIX。完整 TeX、复杂 xparse、任意 let/edef/xdef 和高级 siunitx 的剩余边界在 docs/MACRO_SUPPORT.md。
- 双通道产物来自固定源码快照，包内 Worker 在 Node 26.8.1 与 VS Code Node 24.18.1 各通过 7 项实际渲染检查（截图表格、自定义宏、舍入、单位分式/不确定度、S 列、错误和恢复）；20 条目，通道 ID/命令和内容限制正确。未安装、提交、推送或发布商店。
- 产物 `silk-math-preview-0.1.80-optimized.vsix`：1,487,047 B，SHA-256 `a797ae33d52253bae1f58a3d4d436d83c1da4d1b9b9b0242aae3765642f2b3fb`。
- 产物 `silk-math-preview-test-0.1.80-optimized.vsix`：1,487,180 B，SHA-256 `31fea9f48b59df5a21e7cf5c57c2287253dd226f6b303a57bd261cd0109c7883`。
- 打包后同目录独立 TikZ 任务继续修改 src/tikz/source.ts；本轮安装包保持已验证快照，数学渲染相关源码/Worker 和主 bundle 与交付版本一致，不覆盖其他任务的后续源码。


## 2026-09-07 TikZ / pgfplots 实时图片（0.1.79）

- 新增 `silkMath.tikz.enabled`，默认 false；现有 QuickPick 菜单增加「TikZ / pgfplots 实时预览」勾选项，点选不关菜单，状态立即刷新。测试通道对应 `silkMathTest.tikz.enabled`，也默认关闭。开启后把光标放进图形，不保存即可更新图片。
- 扫描器把 `tikzpicture/tikzcd/pgfpicture/circuitikz` 作为完整区域；坐标轴标签里的 `$x$` 不再抢先成为公式。支持裸环境、数学分隔符包裹和 Markdown fence / notebook 里的源码；关闭时既不下载也不启动 TikZ 或标签公式 Worker。
- 按需 WebAssembly TeX 引擎独立运行，真正生成 DVI/SVG；`axis/addplot` 自动加载 pgfplots，支持图形之前的常见绘图库/样式声明和已解析宏。网页 `&#x20;` 等空格只在渲染副本解码；未闭合环境补结束标记，其他错误保留当前图形上一帧，不插入 MathJax 光标。
- 固定 `node-tikzjax@1.0.5` 和 `@prinsss/dvi2html@0.0.1` 原包，下载校验 SHA-512，解包禁止越界路径/链接并限制大小；组件缓存启动前验证各文件 SHA-256。源码不上传，TeX 只访问内存包文件，不调用系统 LaTeX、shell 或用户文件。此按需且默认关闭的组件是默认渲染路径不联网原则的明确扩展。
- 文本转本地 BaKoMa 字形路径，清理 SVG 外链/事件/脚本，保留绘图原色和白底。180 ms 合并输入、latest-wins、重复光标请求复用、15 秒超时回收、默认 60 秒空闲释放；Esc/关闭防止在途结果复活。
- 兼容范围：运行时 pgfplots 1.16，不是完整 TeX Live；外部图片/数据、gnuplot、LuaTeX、任意 CTAN 包及 CJK 字体不保证支持。额外 TikZ 前导声明读取当前文件前 128,000 字符内、图形之前的部分。详细说明 `docs/TIKZ.md`，手动样例 `test/fixtures/manual/tikz.tex`。
- 验证：新增 18 项 TikZ 源码/默认开关/编辑器接线/请求取消/重启测试；合并工作区共 32 files / 326 tests，typecheck、coverage、build、benchmark、size 通过。核心 stmts/branch/lines `93.42%/87.64%/96.18%`。Node 26 真实 WASM 样例涵盖用户 axis 原文、x³ 修改、缺少结束环境、箭头节点、希腊字母和自定义宏；错误、无限循环超时后的恢复及空闲重启通过。用户例首次 488 ms、后续 374–376 ms；简单图形 13–38 ms，均仅代表本次本机环境。
- 普通公式本轮 cold p50/p95 `48.60/66.42 ms`、warm `3.94/5.81 ms`、scanner p95 `0.464 ms`，idle restart 通过；未打开浏览器或 Extension Host，最终视觉与 Windows/Linux 实机验收由用户完成。
- 主代理独立完成此功能；同目录并行完成的 0.1.78 数字/宏包改动和 `-macros.vsix` 均保留，最终整合版使用 0.1.79。不开分支、不提交、不推送或发布商店。
- 许可：主扩展仍 MIT；独立可选 TikZ Worker 采用 GPL-3.0-or-later，原包许可与字形许可保留。VSIX 附第三方声明、GPL 全文及该 Worker 对应源码压缩包（许可证要求的定向源码例外），不含运行时 TeX/WASM/字体。渲染组件版本与代码分离，核心 200 KiB / VSIX 2.5 MiB 上限不变。
- VSIX 内的 TikZ Worker 又用 VS Code 自带 Node 24.18.1 实跑：用户原图 510 ms，编辑为 x³ 后 411 ms，均输出 280×126 的自包含 SVG；此验证未打开 GUI。
- 最终产物 `silk-math-preview-0.1.79.vsix`：1,481,290 B，SHA-256 `e2d8667dfe879f511802ee38af320b858abba8103847d62b0210477345c67b87`，20 个条目；ID `silkmath.silk-math-preview`，TikZ 默认关闭。
- 最终产物 `silk-math-preview-test-0.1.79.vsix`：1,481,425 B，SHA-256 `0c871ed7f4bd470cbc99b51ef09399b146d42a6515caaefe7c143222297e7335`，20 个条目；ID `silkmath.silk-math-preview-test`，TikZ 默认关闭。
- 两包归档完整性、通道清单、默认值、源码归档一致性及 Worker 字节一致性通过。正式 main 196,545 B、TikZ Worker 277,100 B；工作目录 dist 已恢复正式通道并与正式 VSIX 逐字节一致。保留原 0.1.76/0.1.77 和 0.1.78-macros 安装包。


## 2026-09-07 数字、文本宏与宏包自动分析（0.1.78）

- 截图中的 `tabular` 默认文本单元格不再原样打印 `\num`：MathJax 启用 `textmacros`，数字/单位命令在文本中显式交回数学解析。`\textbf`、嵌套宏、默认参数、`\ensuremath` 同时支持。
- 新增 siunitx 常用 `\num/\SI/\si/\qty/\unit`、列表/范围/乘积、角度、常见单位和前缀。数字用字符串格式化，保留长整数、尾零、指数、括号不确定度；自定义数值常量有界展开，递归超过上限停止。
- 自动从 `\usepackage/\RequirePackage` 和本地递归依赖收集宏包与选项，随快照传给 Worker，参与缓存；按声明或命令启用内置 mathtools/braket/upgreek/amscd/mhchem/textcomp。显式 physics 保留它的 `\qty` 语义。
- 声明索引增加 `\sisetup`、`\DeclareSIUnit`、`\DeclareRobustCommand`、`\gdef` 和 `\DeclarePairedDelimiter`。同名文件先匹配准确路径，避免其他已打开的同名 sty 抢先；未保存缓冲区继续有效。
- 单位别名使用真正的 `\begingroup/\endgroup` 隔离，不能用普通 `{}` 假设 MathJax 会恢复宏。用户同名字符串宏优先；`\sisetup` 尊重组作用域，公式内设置不泄漏到下一帧。
- 数字/单位是数据参数，预览光标吸附到整个命令后，避免拆坏指数与可选参数。源码及真实光标不改写。
- 真实回归：本轮新增 35 项，相关 55 项通过；合并工作目录共 30 files / 319 tests，typecheck、coverage、build、benchmark、size 均通过。核心 stmts/branch/lines `93.42%/87.64%/96.18%`。Node 26 cold p50/p95 `46.94/51.10 ms`，warm `4.50/6.86 ms`，scanner p95 `0.518 ms`，idle restart 通过。主 bundle 196,337 B；性能仅代表本次本机环境。
- 同目录的独立 TikZ 更新被保留。本轮只负责数字、宏和宏包兼容；未启动浏览器或 Extension Host，最终视觉由用户验收。手动样例 `test/fixtures/manual/11-siunitx.tex`。
- 边界详见 `docs/MACRO_SUPPORT.md`：高级 siunitx 舍入/单位排版/S 列按近似处理，不执行完整 CTAN、系统 TeX 搜索路径、expl3、catcode、动态依赖或条件代码。
- 协作分工：主代理独立完成本轮修复与验证。
- 产物：`silk-math-preview-0.1.78-macros.vsix` 1,480,126 B，SHA-256 `0f4e194791550baf1281a60f19f3070f539bb2f600dfcc78fee416cb8de22cdb`；`silk-math-preview-test-0.1.78-macros.vsix` 1,480,261 B，SHA-256 `966d48a8b048c88763e1236cfdf463a6969b0366fe87b534a959668547506c8b`。均 20 条目，包内 Worker 各完成 4 项实测，正式/测试 ID 和命令前缀正确。为避开同目录并行打包的覆盖，安装包来自独立源码快照并使用 `-macros` 文件名；扩展内部版本仍为 0.1.78。
- 打包时修复了并行 TikZ 源码归档脚本的 ESM 八进制转义语法错误，改为按 tar 字段写 ustar 标识和版本；已实际读取校验生成的 tar.gz。

## 2026-09-07 原生框选与后台 OCR（0.1.77）

- 状态栏截图按钮直接启动系统区域选取：macOS `screencapture -i -s -x`，Windows 临时 WinForms 屏幕覆盖层，Linux 区域工具（Wayland slurp/grim、GNOME、KDE、scrot）。松开后自动识别，Esc 取消；移除 OCR Webview 和整屏二次裁切。
- 原生 QuickPick 提供结果复制、插入、编辑、切换公式/智能/文字；新增 `ocr.open`、`ocr.paste`、`ocr.openImage`，图片来源支持剪贴板和 PNG/JPEG 文件。输入菜单 Ctrl+V/⌘V、编辑器图片粘贴 Provider 均接后台识别。
- 正式通道快捷键 Ctrl+Alt+O / Ctrl+Alt+V（Mac ⌘⌥O / ⌘⌥V）；测试通道额外 Shift。测试通道 `ocr.pasteImages` 默认关闭，避免与正式通道同时处理同一次图片粘贴；菜单和显式粘贴命令始终可用。
- 报错根因：文字和公式会话竞争同一 WASM 初始化，并交叉尝试 WebGPU/WASM。现在固定单线程 WASM，公共 ORT shim 串行创建所有会话，取消/失败/超时销毁整个 Worker，空闲 60 秒释放。Node 模块和 WASM 用 file URL，支持空格、中文、# 及 Windows 盘符。
- 后台图片处理使用 PureImage 0.4.20 / PNG / JPEG 纯 JS，不引入随 VSIX 发布的原生模块。补平滑采样保留细笔画；透明底合成白色、深色反相、16 MP/20 MB 限制。已有 94 MiB 模型包继续复用，不需升级模型包。智能模式保留明显的短文字，避免 MFR 用数学符号改写普通短句。
- 插入检查原文档版本，识别期间编辑过文档则让用户复制后选位置；临时截图/剪贴板文件在读取或取消后清理。取消框选不回退到其他截图工具、不弹失败。
- 验证：27 files / 273 tests；类型、覆盖率、构建通过。核心 stmts/branch/lines `93.45%/87.53%/96.10%`。Node 26 本机预览 cold p50/p95 `45.58/48.88 ms`、warm `3.66/5.39 ms`、scanner p95 `0.365 ms`，idle restart 通过；这是本轮运行环境数字，不能当作跨机器承诺。
- 真实 OCR：VS Code 的 Node 24.18.1 运行 5 个合成样例，分式、深色平方公式、纯文字、智能文字、JPEG 均返回正确结构/文字；公式可能保留模型推断的粗体样式。分式首轮约 1.9 s，第二条公式约 1.4 s。macOS AppKit 空剪贴板、私有剪贴板图片读取及 PNG 转换路径通过（未改动用户剪贴板）；未启动浏览器/Extension Host 做视觉自动化，也未在 Windows/Linux 实机操作框选。
- 协作分工：本轮由主代理完成实现、回归、真实 Worker 验证和双通道打包。最终图形界面手动验收按用户要求由用户执行。
- 产物核验：正式 `silk-math-preview-0.1.77.vsix` 1,283,347 B，SHA-256 `c4bad5a1c449512c5b116d29ef5ef5a8f07a7c5c3d811353fa8e33aa85db9edc`；测试 `silk-math-preview-test-0.1.77.vsix` 1,283,476 B，SHA-256 `37ffaa9c357fa8ac2359246113d313ad5675680cea9ca41814c16bcf9cbd6df6`。均 16 条目，无 Webview、模型、WASM、原生模块或源码/测试。正式 main 184,289 B，OCR Worker 223,351 B；工作目录 dist 已恢复正式通道并与正式 VSIX 逐字节一致。

## 2026-08-23 边写边加宏/大文件热路径（0.1.76）

- 未保存 `.sty`、增量失效、公式打字不误伤上方 `\newcommand`。
- 0.1.76 正式版 1,226,235 bytes SHA-256
  `FC2B054113BD38C7519D4DCF68ADA9FBB8CEAE3CD6A735E67F834FC83B934131`。

## 2026-08-22 边写边加宏/宏包（未发版）

- 自定义 `\newcommand` 和本地 `.sty/.cls` 一直支持。这轮修的是热路径：未保存缓冲区、
  增量失效、大文件解析、超过上限要说明而不是静默丢掉。
- 不模拟完整 CTAN 宏包。MathJax 仍只有 base/ams/newcommand/color 等。
- 24 files / 258 tests 全绿。main bundle 204,666 B。cold p95 `142.0 ms`，warm p95 `23.1 ms`。
  `DefinitionWorkspace` 快照 prelude 接到 `MathJaxSvgRenderer.render` 实画后加的宏。

## 2026-08-22 商店搜索与介绍（0.1.75）

- 不改名。关键词/分类/README 按 Marketplace 搜索补全。GitHub topics 已改。
- 0.1.75 正式版 1,225,453 bytes SHA-256
  `BECA01CB76BE860F74A701EC7A948D0A431110258E7D39F5778CABBD956E14E0`。

## 2026-08-22 常见语言与介绍页（0.1.74）

- README 页内 11 语；UI 跟 `vscode.env.language`。简繁分开。命令标题仍中英并列。
- 0.1.74 正式版 1,223,654 bytes SHA-256
  `3DF8B2CC823A5E8B4C3C02BAE4DEB8CDC16401B48A3A4BEE01D13DD8B5889B20`；
  测试版 1,223,795 bytes SHA-256
  `57BA27B6B34974CC163439BB544377F56E99516BC16BC3E9EAECE9AC0FB8D5AA`。
  main bundle 202,297 B（仍低于 200 KiB 硬门 204,800）。

## 2026-08-22 表格合并单元格（0.1.73）

- `\multicolumn` / `\multirow` 预览把文字移到跨列/跨行中心，不再只占第一格。

## 2026-08-22 正式包与测试包分开（0.1.72）

- 测试 VSIX 用独立扩展 ID，避免覆盖商店正式版。命令/配置/状态栏都加 Test 命名空间。
- 0.1.72 正式版 1,201,814 bytes SHA-256
  `179DB3EB764E1AEFEC27B352A9708EDD24AD90A2F6FFB8FABAD16F7482471891`；
  测试版 1,201,950 bytes SHA-256
  `326EE12C89115ADA8A2A9914B226BF50055DE9A7F66956D76EEBF4A3926691AD`。

## 2026-08-22 inner y 向上配对表首（0.1.71）

- TeX 表首 = max inner y（翻轴后是视口上方）。测试走 `tableRulesInRootSpace`。
- 0.1.71：`silk-math-preview-0.1.71.vsix` 1,201,523 bytes，
  SHA-256 `6F0BDB67719A996B28D90901D3C94DFC4F28598838EFBC1DF46F226558B24A6E`。
  cold p95 `161.6 ms`，warm p95 `32.8 ms`。

## 2026-08-22 表首双线两根填充横线（0.1.70）

- 表首 `\hline\hline` 不再只靠框线凑一对：画出两根 `data-line=h`。
  TeX 表首 = MathJax inner max y → SVG min-y。
- 0.1.70：`silk-math-preview-0.1.70.vsix` 1,201,394 bytes，
  SHA-256 `1A8B0B0C06ABCD1D6903AD9F5700C0E2E183116CD3C3A0D985B6B62D01FB438F`。
  cold p95 `132.8 ms`，warm p95 `20.0 ms`，scanner p95 `0.84 ms`。

## 2026-08-22 单侧双横线配对（0.1.69）

- 只把 count≥2 的 `\hline` 边界配到表首/行间/表尾的可见线，避免 1:1 对不齐时
  跳过或画错边。224 tests；覆盖率 `93.56%/87.81%/96.08%`。
- 0.1.69：`silk-math-preview-0.1.69.vsix` 1,201,306 bytes，
  SHA-256 `9D89E2D85668DBF0AC9FEFD7533B8F7F10985ECE1A2EDFE7F402680B1C218556`。

## 2026-08-22 双线表格、鼠标点选、未写完公式（0.1.68）

- `\hline\hline` 在 MathJax 里会合成一根；预览按 TeX 计数在 SVG 上拆成紧致双线。
  `||` 两根近距竖线收到大约一根线宽。滚动条点选仍保持预览，点进公式则立刻更新。
- 未写完的括号/命令只补渲染副本，同区域失败保留上一帧。
- 0.1.68：`silk-math-preview-0.1.68.vsix` 1,200,705 bytes，
  SHA-256 `C48385DB54EDFB1DC6559D2B361D0D3A55136B0B3089EAB34368256075F59DAA`。
  223 tests；覆盖率 `93.56%/87.82%/96.06%`；cold p95 `137.2 ms`，warm p95 `23.6 ms`。

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
