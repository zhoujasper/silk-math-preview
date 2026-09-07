# Silk Math Preview 协作规范

## 2026-09-07 GitHub 同步（0.2.1）

- 按用户要求，将 0.1.76 之后的本地 OCR、数字/单位/宏、TikZ/pgfplots 与性能改进整合到现有 `main`，版本保持 0.2.1；README、CHANGELOG、说明、测试和第三方源码一起纳入。主代理独立处理，提交保留用户唯一作者，不添加共同作者。
- 推送前已确认 `origin/main` 与本地基线 `2ce56337a57351753212bfe0bad616408e261c6e` 一致。恢复 9 个文件原有的 LF 换行，其中 4 个只有换行差异；保留全部实际功能改动。
- 本轮重新运行 `npm run verify`：34 files / 373 tests，typecheck、coverage、build、benchmark、size 全部通过；核心行覆盖率 96.36%。Node 26.8.1 本机普通公式 cold p50/p95 47.55/51.43 ms、warm 3.75/5.37 ms、scanner p95 0.477 ms，idle restart 通过；未重复此前复杂图压力测试或启动图形界面。
- 双通道重新打包均为 22 条目；默认 TikZ 关闭、命令/设置隔离、归档完整性、Worker 与构建一致、GPL 对应源码与当前文件逐字节一致均通过。原安装包保存在 `.tmp-tikz-smoke/github-sync-20260907-original-449_5v7_/`，不纳入 Git。
- 当前正式包 2,226,136 B，SHA-256 `9a57cabdcd9c0b12ff56ced52ab0d6760c22963d54c6525f5be92d32b63fde35`；测试包 2,226,263 B，SHA-256 `241aca006ca50d3b4aad698488fbd6fb271a02ec5bcab9f38ea1d8efe27837c4`。源码换行统一导致源码归档和 VSIX 哈希变化，Worker 字节保持一致；`dist` 已恢复正式通道。
- 发布提交 `1030d0b37476be3231f71a0db1a5c6ee65f98db6` 已推送；GitHub Actions `34108000223` 的 test / publish 均成功，远端同样 34 files / 373 tests。`0.2.1` 标签准确指向该提交，GitHub Release 已公开并补充版本说明；Marketplace 因未配置 `VSCE_PAT` 被跳过，不能宣称商店已更新。
- 实际下载 GitHub Release 的两份包并匹配 GitHub SHA-256、ZIP、清单和默认开关：正式 2,222,698 B / `577718a71223f8e8b42e23aa6007a47f50c750fea000fed7b12a8861fbdbbffc`，测试 2,222,832 B / `68bd9aed60893623ce134964733151fd35ec7a0359d88b393d4e8350b576444e`。两包 Worker 与本机构建一致，15 份对应源码逐文件匹配发布提交。远端 CI 包与本地包的压缩文件哈希分别记录。
- 发布后的结果仅通过文档提交回填，使用 `[skip ci]` 避免相同版本再次上传覆盖资产。Git 不纳入 VSIX、缓存、运行时下载或模型。

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

- 当前文件 `\newcommand` / `\def`、未保存 `.sty` 缓冲区、只失效变化的依赖。
- 公式打字只看光标处控制词，上方已写完的 `\\newcommand` 不再全文失效。
- 流水线：24 files / 259 tests；覆盖率 stmts/branch/lines `93.45%/87.53%/96.10%`。
  main bundle 204,665 B。cold p50/p95 `130.1/142.9 ms`，warm p50/p95
  `12.5/21.1 ms`，scanner p95 `0.77 ms`，idle restart 通过。
- 产物正式版 `silk-math-preview-0.1.76.vsix` 1,226,235 bytes，SHA-256
  `FC2B054113BD38C7519D4DCF68ADA9FBB8CEAE3CD6A735E67F834FC83B934131`；
  测试版 `silk-math-preview-test-0.1.76.vsix` 1,226,367 bytes，SHA-256
  `D8ABD2B10F91862F6F0F7DFB04EB8B0102CA518AEC2817364A6039C82D451808`。

## 2026-08-22 边写边加宏/宏包，大 sty 也要丝滑

- 用户 `\newcommand` / `\usepackage` / 本地 `.sty/.cls` **本来就能进预览**；缺口是未保存缓冲区、
  任意文件改动清空全部解析缓存、大文件 `split('')` 复制、超过 2 MB 静默丢掉。
- 定义解析：`maskTeXComments` 无 `%` 时零拷贝；`parseTeXSource` 一次 mask 扫声明和依赖。
  4000 条宏 p95 内解析。`.sty/.cls` 上限 8 MB，超限写 limitation，不再默默跳过。
- 工作区：优先读已打开文档（未保存的 sty 也能用）；只失效变化的那一个来源；
  peek 在失效后仍保留上一份快照。磁盘 watcher / 文本变更会让预览 48 ms 内重算定义。
- Windows 宏包文件名大小写不敏感；Linux 保持大小写敏感。不加载 CTAN，不执行 expl3。
- 公式打字只看光标处控制词，上方已写完的 `\\newcommand` 不再触发全文失效。
- 流水线：24 files / 259 tests。main bundle 204,665 B（硬门 204,800），不含 MathJax。
  cold p50/p95 `127.8/143.5 ms`，warm p50/p95 `13.3/23.0 ms`，scanner p95 `1.13 ms`，
  idle restart 通过。快照 prelude 已接到 MathJax 实画。
- 本轮未发版、未打 VSIX。

## 2026-08-22 商店搜索与介绍（0.1.75）

- 名字仍是 Silk Math Preview。`description` / `keywords`（最多 30 个）/ `categories`
  改成 Visualization · Notebooks · Education，覆盖 latex、mathjax、jupyter、
  equation、ocr 等搜索词。README 写明 Marketplace 链接。
- GitHub 仓库描述和 topics 同步；主页项目/动态另改 PersonalWebsite-source。
- 流水线：23 files / 235 tests。cold p50/p95 `126.2/135.1 ms`，warm p50/p95
  `13.1/20.3 ms`，scanner p95 `0.87 ms`。main bundle 202,297 B。
- 产物正式版 `silk-math-preview-0.1.75.vsix` 1,225,453 bytes，SHA-256
  `BECA01CB76BE860F74A701EC7A948D0A431110258E7D39F5778CABBD956E14E0`；
  测试版 `silk-math-preview-test-0.1.75.vsix` 1,225,584 bytes，SHA-256
  `00ECF954FF689F7D3512104D63D45B09FCF9E75724727A45CBC0246E8CC86C47`。

## 2026-08-22 常见语言与介绍页（0.1.74）

- 商店只渲染 README.md：页内 `#english` 起 11 种常见语言，示意图仍 4 张。
  不要另开 README.zh-CN.md。命令面板标题仍中英并列，避免测试通道再拆 nls。
- 界面文案在 `src/core/uiLocale.ts`，按 `vscode.env.language` 选；`zh-tw/hk/mo/hant`
  走繁体，其他 `zh*` 走简体，对不上回退英文。菜单、状态栏、OCR 宿主和 OCR
  面板共用这一份；OCR bundle 只收当前语言，不打包整份目录。
- 流水线：23 files / 234 tests；覆盖率 stmts/branch/lines `93.43%/87.51%/96.05%`。
  main bundle 202,297 B。cold p50/p95 `134.2/146.6 ms`，warm p50/p95 `13.0/20.4 ms`，
  scanner p95 `0.83 ms`，idle restart 通过。
- 产物正式版 `silk-math-preview-0.1.74.vsix` 1,223,654 bytes，SHA-256
  `3DF8B2CC823A5E8B4C3C02BAE4DEB8CDC16401B48A3A4BEE01D13DD8B5889B20`；
  测试版 `silk-math-preview-test-0.1.74.vsix` 1,223,795 bytes，SHA-256
  `57BA27B6B34974CC163439BB544377F56E99516BC16BC3E9EAECE9AC0FB8D5AA`。

## 2026-08-22 表格合并单元格（0.1.73）

- `\multicolumn{n}{align}{...}` / `\multirow{n}{*}{...}` 用 class 标跨度，SVG 按
  相邻 mtd/mtr 的 translate 把内容移到合并区域中心。列数仍用 `&` 占位，避免串列。
- 产物正式版 `silk-math-preview-0.1.73.vsix` 1,203,031 bytes，SHA-256
  `E4EB2C807079C62CC94B64BC289E01C835E3B12C41AF70EED3B532BC230D34C1`；
  测试版 `silk-math-preview-test-0.1.73.vsix` 1,203,169 bytes，SHA-256
  `E79996E40E3352C5C1AFF7FD857EB6988282BF5D4A0FF5F1CEF51AEFC899A93F`。

## 2026-08-22 正式包与测试包分开（0.1.72）

- `npm run package:release` → `silkmath.silk-math-preview`，发 Marketplace。
- `npm run package:test` → `silkmath.silk-math-preview-test`，命令 `silkMathTest.*`，
  设置 `silkMathTest.*`，状态栏 Silk Math Test。两份可同时安装。
- 测试清单 `private: true`。CI 仍只把正式包 `vsce publish`。
- 产物正式版 `silk-math-preview-0.1.72.vsix` 1,201,814 bytes，SHA-256
  `179DB3EB764E1AEFEC27B352A9708EDD24AD90A2F6FFB8FABAD16F7482471891`；
  测试版 `silk-math-preview-test-0.1.72.vsix` 1,201,950 bytes，SHA-256
  `326EE12C89115ADA8A2A9914B226BF50055DE9A7F66956D76EEBF4A3926691AD`。

## 2026-08-22 inner y 向上配对表首（0.1.71）

- MathJax 表格线在 `scale(1,-1)` 下，属性 min-y 是视口下方。TeX 表首配对
  max inner y，表尾配对 min inner y，朝表内加线。混合边界测试用
  `tableRulesInRootSpace` 在翻转后的根坐标里量，表首双线靠近 A 行。
- 流水线：21 files / 224 tests。cold p50/p95 `145.9/161.6 ms`，warm p50/p95
  `15.2/32.8 ms`，scanner p95 `0.94 ms`，idle restart 通过。main bundle 128,845 B。
  产物 `silk-math-preview-0.1.71.vsix`，`1,201,523` bytes，SHA-256
  `6F0BDB67719A996B28D90901D3C94DFC4F28598838EFBC1DF46F226558B24A6E`，15 个条目。

## 2026-08-22 表首双线必须是两根填充横线（0.1.70）

- 框线 `data-frame` 不是填充 `data-line=h`。表首 count≥2 时从 inner max y
  （SVG min-y）画出两根填充横线，间隙一根线宽。混合边界测试断言
  `data-line=h` 至少两根。
- 流水线：21 files / 224 tests。main bundle 128,845 B。cold p50/p95
  `124.0/132.8 ms`，warm p50/p95 `12.5/20.0 ms`，scanner p95 `0.84 ms`，
  idle restart 通过。产物 `silk-math-preview-0.1.70.vsix`，`1,201,394` bytes，
  SHA-256 `1A8B0B0C06ABCD1D6903AD9F5700C0E2E183116CD3C3A0D985B6B62D01FB438F`，15 个条目。

## 2026-08-22 单侧双横线配对（0.1.69）

- `splitDoubleHlines` 不再把含 0 的 TeX 计数和 min-y 槽位 1:1 对齐。只把
  count≥2 的边界配到对应可见线：表首 min-y，表尾 max-y，行间用内线。
  `{|c|c|}\\hline\\hline A\\\\B` 这类只在一侧双线的表不再跳过或画错边。
- 流水线：21 files / 224 tests；覆盖率 stmts/branch/lines `93.56%/87.81%/96.08%`。
  main bundle 128,845 B。产物 `silk-math-preview-0.1.69.vsix`，`1,201,306` bytes，
  SHA-256 `9D89E2D85668DBF0AC9FEFD7533B8F7F10985ECE1A2EDFE7F402680B1C218556`，15 个条目。

## 2026-08-22 双线表格、鼠标点选、未写完公式与热路径（0.1.68）

- 连续 `\hline\hline`：MathJax 会把同一行边界的第二条覆盖掉。按 array 表达式
  计数在 SVG 里再画一根，间隙取线宽、方向朝表内。列格式 `||` 本来就是两根
  近距竖线，收到大约一根线宽。只配对同向共轴的近距线。
- 鼠标点选：文档 offset 落在公式里就立刻更新（含换公式）；只有点在浮层盖住、
  且那里没有公式的行上才保持当前预览。不要 views。
- 未写完的公式只补渲染副本：补括号/环境、丢掉末尾半截命令、给缺参数的
  `\frac` 补 `{}`。失败且同一区域已有成功帧则保留上一帧。源码不改写。
- 恢复放在 MathJax convert 之前，避免失败驱逐上下文。缓存/空闲上限不变。
- 流水线：21 files / 223 tests；覆盖率 stmts/branch/lines `93.56%/87.82%/96.06%`。
  main bundle 128,845 B。cold p50/p95 `121.5/137.2 ms`，warm p50/p95 `12.4/23.6 ms`，
  scanner p95 `0.86 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.68.vsix`，`1,200,705` bytes，SHA-256
  `C48385DB54EDFB1DC6559D2B361D0D3A55136B0B3089EAB34368256075F59DAA`，15 个条目。

## 2026-08-21 GitHub Actions 自动发 Marketplace

- `.github/workflows/ci.yml`：PR/push 跑 typecheck、单元测试、`vsce package`、
  VSIX 内容检查。`main` 或手动 workflow 在测试通过后发布。
- Marketplace 用仓库密钥 `VSCE_PAT`（Azure DevOps Marketplace Manage）。
  没配密钥时跳过发布、不把 CI 标红。版本已存在时 `--skip-duplicate`。
- 同时用 `GITHUB_TOKEN` 创建/更新同号 GitHub Release 并附上 VSIX。
- `package.json` 增加 `vscode:prepublish: npm run build`。步骤见 `docs/PUBLISH.md`。

## 2026-08-21 GitHub 与 Marketplace 发布信息（0.1.67）

- 作者 `Jasper Zhou`，主页 `https://zhoujasper.github.io`，仓库
  `https://github.com/zhoujasper/silk-math-preview`。`package.json` 的
  `publisher` 仍是 `silkmath`（Marketplace ID：`silkmath.silk-math-preview`）。
  `private: false` 才能 `vsce publish`。发布步骤见 `docs/PUBLISH.md`。
- README 末尾带作者主页和 GitHub 链接。详情页图片仍靠仓库 `media/*.png`，
  vsce 不要 `--no-rewrite-relative-links`。

## 2026-08-21 改回顶部 QuickPick（0.1.67）

- 状态栏 Markdown hover 没法当场改勾选（内核 locked hover）。用户要求改回
  之前顶部菜单：点 Silk Math → QuickPick，开关后菜单不关、勾选立刻变。
  `item.command = silkMath.showMenu`。乐观 pending 立刻刷新菜单项。
  不要 views / webview panel / 右侧栏。Esc 关掉菜单。
- 流水线：19 files / 208 tests；覆盖率 stmts/branch/lines `93.52%/87.57%/95.88%`。
  main bundle 125,463 B。cold p50/p95 `150.5/166.8 ms`，warm p50/p95 `16.6/30.1 ms`，
  scanner p95 `0.99 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.67.vsix`，`1,196,438` bytes，SHA-256
  `4E67069AD157F2EB90DD178BC4A32B03D148124C3E8A5E7CC70ACC30F30B294E`，15 个条目。

## 2026-08-21 Copilot 活 DOM vs locked hover（0.1.66）

- 对本机 `workbench.desktop.main.js` 核对 Copilot：`tooltip: { element: token =>
  ChatStatusDashboard }`，`command: R6`（`{id:'statusBar.entry.showTooltip'}`
  对象，`executeCommand` 里 `e===R6` 才 `this.hover.show(true)`）。勾选是同一张
  Toggle 上 `checked=!checked`，`stop(event)`，从不换 tooltip。
- 扩展公开 API 没有 HTMLElement tooltip，也拿不到 R6 对象。Markdown hover
  点开后 `sticky:focus` → `isLocked`。`_createHover` 见 locked 直接 return，
  随后 `ManagedHoverWidget.show` 把旧浮层 dispose。只改 tooltip 会拆掉卡片
  却画不出新的；先清空再 `showHover` 时 activeElement 经常不在状态栏条目上，
  旧卡片又被请回来。
- 0.1.66：点选先写入 pending 新 markdown（拆掉 locked 旧浮层），再写一次
  不同 revision（此时 isLocked 已空，zombie widget 会真正 showHover），然后
  补几次 `showHover`。勾选用 ☑/☐，开/关写在 markdown.value 里。
- 流水线：19 files / 208 tests；覆盖率 stmts/branch/lines `93.52%/87.57%/95.88%`。
  main bundle 130,981 B。cold p50/p95 `144.2/154.5 ms`，warm p50/p95 `14.9/21.7 ms`，
  scanner p95 `0.75 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.66.vsix`，`1,198,013` bytes，SHA-256
  `FFEE6434B9ADEA9019A927201A617B3D20B285B07EF040FDD474AB1DD5777E47`，15 个条目。

## 2026-08-21 闪了但勾选不变（0.1.65）

- 0.1.64 点选会闪（命令跑了、hover 拆掉重开），勾选还是旧的：`update()` 的
  Promise 结束时 `getConfiguration()` 经常仍返回旧值，重开卡片按旧快照画。
  Copilot 内核卡片是活的 HTMLElement；我们只能拆掉再 showHover，所以必须用
  内存里的乐观状态画新勾选，配置稍后落盘。`get()` 对上了再清 pending。
- 流水线：19 files / 208 tests；覆盖率 stmts/branch/lines `93.52%/87.57%/95.88%`。
  main bundle 130,804 B。cold p50/p95 `138.6/149.1 ms`，warm p50/p95 `15.9/21.5 ms`，
  scanner p95 `0.92 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.65.vsix`，`1,197,788` bytes，SHA-256
  `9BA32A92047211545E830A5468F5F7DD024D1F3CAB215532325E97B422D9F4C0`，15 个条目。

## 2026-08-21 isTrusted 白名单静默吞点击（0.1.64）

- 0.1.63 卡片能看见链接但点了没闪：opener `open()` 在 `allowCommands` 是数组时
  `!allowCommands.includes(uri.path)` 直接 `return true`，不执行命令。
  `{ enabledCommands }` 不是 `=== true`，command URI 的 path 对不上就吞掉。
- `isTrusted` 必须是布尔 `true`。链接仍是 markdown `[text](command:)`，文字用前景色
  span，推迟用次级按钮色，不要列表子弹、不要 HTML `<a href="command:">`。
- 流水线：19 files / 207 tests；覆盖率 stmts/branch/lines `93.52%/87.57%/95.88%`。
  main bundle 129,404 B。cold p50/p95 `134.7/146.7 ms`，warm p50/p95 `14.5/23.7 ms`，
  scanner p95 `1.00 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.64.vsix`，`1,197,326` bytes，SHA-256
  `05B57CA38CD5C7F6FA735ECF4D07E1E58C0F167C0345B5897CD7EEB121DDD135`，15 个条目。

## 2026-08-21 command 链接被内核拆掉（0.1.63）

- 点了没闪、也没反应：命令根本没跑。HTML `<table>` 里的 `<a href="command:">` 不是
  markdown `link` token，ExtHost `MarkdownString.from` 只 walk lexer 的 link/image，
  随后 `rewriteRenderedLinks` 在 `!isTrusted` 或空 href 时 `replaceWith(childNodes)`，
  勾选只剩文字。Copilot Chat 自己的 tooltip 用 `[text](command:id)`。
- 改成 markdown command 链接；`isTrusted = { enabledCommands: FLYOUT_COMMANDS }`；
  toggle/snooze/exclude/settings 写入 package.json。点选后状态栏短暂 `$(sync)`，
  再清 tooltip、写回、showHover 两次。
- 流水线：19 files / 207 tests；覆盖率 stmts/branch/lines `93.50%/87.57%/95.87%`。
  main bundle 128,950 B。cold p50/p95 `151.8/169.9 ms`，warm p50/p95 `14.9/21.2 ms`，
  scanner p95 `0.84 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.63.vsix`，`1,197,033` bytes，SHA-256
  `2C02446A235917F343251DF70137000ED658C0DB4E0EA76C4DC8D4ADA1349CF0`，15 个条目。

## 2026-08-21 点选后立刻重开 hover（0.1.62）

- 对本机 VS Code `workbench.desktop.main.js` 核对：点开的状态栏 hover 带
  `sticky: focus` → `isLocked`。`_createHover` 见 locked 直接 return；
  ManagedHoverWidget 再 dispose 旧浮层。`workbench.action.showHover` 只从
  `getActiveElement()` 往父节点找 managed hover。`focusStatusBar` 只聚焦容器，
  `lastFocusedEntry` 只在键盘左右切条目时写入，鼠标点击不会记。
- 点选后：tooltip 置 `undefined` 让 hasContent=false、内核 dispose 并把焦点交回
  条目上的 `<a>`，改 text 的零宽空格逼 ExtHost 真正 `$setEntry`，写入新 Markdown，
  再 `showHover` 两次。不要 focusStatusBar。
- 流水线：19 files / 207 tests；覆盖率 stmts/branch/lines `93.52%/87.48%/95.88%`。
  main bundle 129,664 B。cold p50/p95 `147.6/155.8 ms`，warm p50/p95 `14.4/21.2 ms`，
  scanner p95 `1.35 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.62.vsix`，`1,196,986` bytes，SHA-256
  `0CD901EC67F171FBD96DE7BC392B85E551B4D7A28EF085D02677D5F9AF7F06FE`，15 个条目。

## 2026-08-21 Copilot Chat VSIX：悬浮窗是内核 hover（0.1.61）

- 拆开 `github.copilot-chat-0.48.1.vsix`：插件名 `copilot-chat`。状态栏那张大卡片
  **不是插件画的**。插件用提议 API `chatStatusItem` 的
  `window.createChatStatusItem` 只往内核卡片里塞「Codebase Semantic Index」和
  「Session Sync」两行。自己的 `createStatusBarItem` 是 NES 捕获 / 网络调试 /
  录制，tooltip 是 MarkdownString + command 链接。
- 点 Copilot 图标弹出 monaco-hover：内核 `ChatStatusBarEntry` 的
  `command: ShowTooltipCommand` + `tooltip: { element: HTMLElement }`。
  扩展公开等价：`command = workbench.action.showHover` + 可信 MarkdownString。
- 0.1.60 右侧辅助栏是错的。已撤掉 views。点 Silk Math 重新在图标正上方弹 hover。
  点选后先把 tooltip 写成空（让 locked hover 标成已销毁），焦点仍留在条目上，
  再写回新内容并 `showHover`。不要 `focusStatusBar`。
- 流水线：19 files / 207 tests；覆盖率 stmts/branch/lines `93.52%/87.48%/95.88%`。
  main bundle 129,532 B。cold p50/p95 `143.6/160.8 ms`，warm p50/p95 `14.9/26.3 ms`，
  scanner p95 `0.64 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.61.vsix`，`1,196,864` bytes，SHA-256
  `4639865AB7AFAE5AE364171A347CC7B87CC7B905FD98EBFA7E1400C4A7462895`，15 个条目。

## 2026-08-21 Copilot 源码对照：点选立刻刷新（0.1.60）

- Copilot 状态栏卡片不在 Copilot 扩展里，在 VS Code 内核
  `ChatStatusDashboard`：`tooltip: { element: token => HTMLElement }` +
  `command: ShowTooltipCommand`（对象身份 `{ id: 'statusBar.entry.showTooltip' }`）。
  勾选是工作台 `Checkbox`，点了改同一个 DOM。扩展公开 API 只有
  `StatusBarItem.tooltip: MarkdownString`，构造不出那个 command 对象。
- 点开的 Markdown hover 是 `sticky: focus` → `isLocked`。改 tooltip 时
  `ManagedHoverWidget.showHover` 对锁住的浮层直接 `return undefined`，然后把旧
  hover dispose 掉；`workbench.action.focusStatusBar` 焦点在状态栏容器上，
  `showHover` 往父节点找，找不到我们的条目。所以看起来点不动，关了再开才变。
- 扩展能原地刷新的 DOM 只有 webview。`createWebviewPanel` 会多一个编辑器标签
  （0.1.56 已否）。现在点 Silk Math 打开右侧辅助栏里自己画的卡片：真实
  checkbox/button，postMessage 立刻重绘。Esc 关掉。不要下方面板，不要新标签。
- 流水线：19 files / 207 tests；覆盖率 stmts/branch/lines `93.51%/87.53%/95.87%`。
  main bundle 134,949 B。cold p50/p95 `140.5/153.9 ms`，warm p50/p95 `14.3/25.9 ms`，
  scanner p95 `0.89 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.60.vsix`，`1,198,712` bytes，SHA-256
  `0F0E3DED1AAEB384F558E84D0B4E662C595C71DAC0B4E35B98C29ECCC09E0C3A`，15 个条目。

## 2026-08-21 推迟按钮和点选刷新（0.1.59）

- 推迟用主题次级按钮色 + 2px 圆角的文字芯片，不要 SVG 画字（又糊又丑）。
  − / + / 重置只保留前景色文字。勾选用 `$(check)` / `$(primitive-square)`。
- 点完先把 tooltip 冲空等 IPC，拆掉 sticky hover，再写回新 Markdown 并
  `focusStatusBar` + `showHover`。仍然不是 Copilot 的 HTMLElement 原地改 DOM，
  但卡片还是状态栏浮层，不开新标签。
- 流水线：19 files / 207 tests；覆盖率 stmts/branch/lines `93.52%/87.43%/95.88%`。
  main bundle 129,508 B。cold p50/p95 `141.1/158.6 ms`，warm p50/p95 `14.7/26.6 ms`，
  scanner p95 `1.12 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.59.vsix`，`1,196,303` bytes，SHA-256
  `9F47551C6F62A0C22ABDF2D69E0D11E903D7752DF04BFB0075CBA151E2890304`，14 个条目。

## 2026-08-21 点 Silk Math 不再开编辑器标签（0.1.58）

- Copilot 状态栏卡片是内核 `ShowTooltipCommand` + HTMLElement hover，不会新建标签。
  0.1.56 用 `createWebviewPanel` 能原地刷新，但会多一个 Silk Math 编辑器页。
  改回 `command = workbench.action.showHover` + Markdown 卡片，钉在条目上方。
- 推迟按钮是 SVG 小芯片：细描边、浅底、rx=3。文案跟 `vscode.env.language`：
  `zh*` 中文，其余英文。
- 流水线：19 files / 207 tests；覆盖率 stmts/branch/lines `93.56%/87.23%/95.91%`。
  main bundle 129,470 B。cold p50/p95 `138.7/150.7 ms`，warm p50/p95 `14.8/23.5 ms`，
  scanner p95 `0.85 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.58.vsix`，`1,196,393` bytes，SHA-256
  `62D506B35CFB8BA7CDB1D475E6A56E426688212D2BCF1B8519090600A35A3447`，14 个条目。

## 2026-08-21 Jupyter 多行公式下半截被裁（0.1.57）

- notebook 单元格 `overflow` 会裁掉绝对定位 decoration，下一格还会盖住。
  z-index 救不了。用户要预览在公式下方，不能再翻到 above 去盖住源码。
  在锚点行加隐形 `after` 把行盒撑到「行高 + 间隙 + 预览高度」，格子跟着变高，
  浮层整块留在当前格里。notebook 不再按半格高度截断预览。
- 流水线：19 files / 207 tests；覆盖率 stmts/branch/lines `93.48%/87.55%/95.85%`。
  main bundle 133,527 B。cold p50/p95 `131.3/163.6 ms`，warm p50/p95 `13.2/23.0 ms`，
  scanner p95 `1.15 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.57.vsix`，`1,197,511` bytes，SHA-256
  `BCC493454A8FB67358534BB5AFAA68B3C6613E61A3079DD885D4D9DF78A91B64`，14 个条目。

## 2026-08-21 自绘 webview 卡片，勾选立刻变（0.1.56）

- Copilot 状态栏卡片是内核 `tooltip: HTMLElement` + `ShowTooltipCommand`，点勾选改
  同一个 DOM。扩展的 Markdown hover 点开后 sticky，改 tooltip 不会重绘。0.1.53–0.1.55
  都卡在这里。改成点 Silk Math 打开我们自己的 webview 卡片，勾选走 postMessage，
  立刻改 DOM。点卡片外或 Esc 关掉。
- 勾选：空心方框 + 前景色对勾，flex 和文字对齐，不要蓝底。右上角齿轮进设置。
  去掉「预览已启用」和底部设置。推迟是次级按钮 + 说明。底部按钮排除/取消排除。
  卡片 280px，钉在编辑区右下（状态栏上头）。
- 流水线：19 files / 205 tests；覆盖率 stmts/branch/lines `93.46%/87.55%/95.84%`。
  main bundle 132,841 B。cold p50/p95 `134.9/143.5 ms`，warm p50/p95 `14.5/20.5 ms`，
  scanner p95 `0.97 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.56.vsix`，`1,197,170` bytes，SHA-256
  `BE09C8782E895C711E9C36194EAAD00EC598BB477C40750C7E88A607E774B340`，14 个条目。

## 2026-08-21 勾选立刻刷新、推迟并排、上下留白（0.1.55）

- Copilot 点勾选是改同一个 HTMLElement。扩展 Markdown hover 点开后 sticky，
  `showHover` 在已有 widget 时是空操作。更糟的是 ExtHost `setTimeout(0)` 会把
  「tooltip=undefined」和随后的 `refresh()` 合成一次，锁住的浮层一直显示旧内容。
  勾选后先暂停 refresh，单独把 tooltip 冲空并等 IPC，再写回新内容，
  `focusStatusBar` + `showHover` 钉回 Silk Math 上头。
- 卡片 360px。两个推迟同一行左右排。整张卡一张 HTML 表，去掉顶部空段，
  底部 14px 占位。
- 流水线：19 files / 204 tests；覆盖率 stmts/branch/lines `93.58%/87.37%/95.93%`。
  main bundle 129,330 B。cold p50/p95 `142.3/152.5 ms`，warm p50/p95 `14.2/20.6 ms`，
  scanner p95 `0.88 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.55.vsix`，`1,195,617` bytes，SHA-256
  `12D70E0C6BA13E38CB65E68F6A6CF0CBFA12E088A2C8272DB559185DC4A84CCB`，14 个条目。

## 2026-08-21 状态栏卡片加宽、次级按钮、点了立刻刷新（0.1.54）

- 工作台把点开的 hover 锁成 sticky：`ManagedHoverWidget.update` 调 `showHover`
  时若 `isLocked` 就返回 undefined，再 `oldHoverWidget.dispose()`。扩展改
  tooltip 不会原地重绘，看起来像没点到。勾选后先把 tooltip 清空冲掉锁住的
  hover，再写回新 Markdown，`focusStatusBar` + `showHover` 钉在 Silk Math 上头。
- 卡片用 400px 占位图撑开。勾选是 18px 圆角方框 SVG（不是蓝色 `pass-filled`）。
  按钮用允许的 span style：`button-secondaryForeground/Background` +
  `border-radius:4px`，标签强制 `--vscode-foreground`，不再继承链接蓝。
- 流水线：19 files / 204 tests；覆盖率 stmts/branch/lines `93.61%/87.37%/95.98%`。
  main bundle 129,335 B。cold p50/p95 `139.0/159.1 ms`，warm p50/p95 `14.7/22.2 ms`，
  scanner p95 `0.96 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.54.vsix`，`1,195,440` bytes，SHA-256
  `421AF6F66543099BA8A3C13EEDE965AF54DAF7DE484C6D6867F989C8DEB88E86`，14 个条目。

## 2026-08-21 状态栏卡片 Copilot 勾选布局（0.1.53）

- 启用范围不要蓝色超链接。勾选框单独是 command 链接，标签是普通文字。
  点勾选框后用 revision 刷新 tooltip，工作台 hover 原地重绘。
- 暂停做成 Copilot 那种「推迟 + 说明」。
- 流水线：19 files / 203 tests；覆盖率 stmts/branch/lines `93.55%/87.61%/95.94%`。
  main bundle 126,249 B。cold p50/p95 `142.6/146.8 ms`，warm p50/p95 `14.5/23.5 ms`，
  scanner p95 `0.69 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.53.vsix`，`1,194,549` bytes，SHA-256
  `581F765198473009A3F6F71D348C786845009C85484F664E28087C76C63E7353`，14 个条目。

## 2026-08-21 表格文本格光标渲染成源码（0.1.52）

- Markdown 表里判断文本/数学不能从整张表开头数 `$`。上一格 `` `$` `` 或
  `$|\nabla u|$` 后面的单元格会被误判成数学模式，caret 不包 `$...$`，
  `\text{}` 再把 `\class{silk-math-caret}{\rule...}` 转义成原文。
  改为只看当前单元格；wrapCell 也会给文本格里的 caret 补上 `$...$`。
- 流水线：19 files / 203 tests；覆盖率 stmts/branch/lines `93.57%/87.70%/95.93%`。
  main bundle 126,187 B。cold p50/p95 `135.5/157.1 ms`，warm p50/p95 `13.7/22.3 ms`，
  scanner p95 `0.91 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.52.vsix`，`1,194,416` bytes，SHA-256
  `B1187A35E7D9D6DD7F1B509BFE744176DB641071750A809892C287639EB1BA18`，14 个条目。

## 2026-08-21 滚动条拖动不再关掉预览（0.1.51）

- 点滚动条会把光标落到浮层盖住的源码行，selection 当成离开公式就把预览清了。
  鼠标选区落在浮层占用的行上时保持当前预览。
- 滚动条用 `scrollbar-width: thin` + 透明轨道，不要系统那种宽条带底色。
- 流水线：19 files / 202 tests；覆盖率 stmts/branch/lines `94.60%/88.90%/97.10%`。
  main bundle 124,661 B。cold p50/p95 `135.5/152.1 ms`，warm p50/p95 `13.7/21.5 ms`，
  scanner p95 `0.80 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.51.vsix`，`1,193,950` bytes，SHA-256
  `3A84A46BC879B104324A94AC41111DB13DE27ADC9026D247940628143B18F4F0`，14 个条目。

## 2026-08-21 预览对准公式正下方居中（0.1.50）

- Monaco 里 decoration 的 `position:absolute` 包含块是整行，`left:0` 会贴行首。
  要用公式起止列算出中心，预览以中心向两侧变宽；超出视口宽/高则滚动。
- 流水线：19 files / 200 tests；覆盖率 stmts/branch/lines `94.57%/88.75%/97.08%`。
  main bundle 123,489 B。cold p50/p95 `142.7/149.0 ms`，warm p50/p95 `13.9/23.0 ms`，
  scanner p95 `1.14 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.50.vsix`，`1,193,611` bytes，SHA-256
  `D35B694956A69B26EE6EE752F6CD61246852F910EB20ED63FBA1557D2FA121C4`，14 个条目。

## 2026-08-21 点击 Silk Math 弹出 Copilot 同款状态栏卡片（0.1.49）

- Copilot 的点击浮层**不是扩展 API**。它是 VS Code 内核
  `ChatStatusDashboard`：`statusbarService.addEntry({ tooltip: HTMLElement, command: ShowTooltipCommand })`。
  `ShowTooltipCommand` 是 `{ id: 'statusBar.entry.showTooltip' }` 的**对象引用**，
  `command === ShowTooltipCommand` 才调用 `hover.show(true)`。扩展 IPC 过去的
  `{ id: 'statusBar.entry.showTooltip' }` 对不上，会走 `executeCommand` 然后报命令不存在。
- 公开等价路径：状态栏条目 `tooltip = MarkdownString`（trusted command 链接），
  `command = 'workbench.action.showHover'`。点击时焦点在状态栏条目上，工作台立刻弹出
  **钉在该条目正上方**的 hover，和 Copilot 同一套 HoverService。不经过扩展宿主，
  所以不会因为点状态栏丢掉编辑器焦点而画不出来。
- 上一版用 editor decoration + `data:` SVG 画卡片：没有可见编辑器、Jupyter 裁切、
  选区事件、`contentIconPath` 都可能让点击完全没反应。已拆掉。
- 命令面板里的「打开设置卡片」仍打开 QuickPick（那时焦点不在状态栏）。
- 流水线：19 files / 199 tests；覆盖率 stmts/branch/lines `94.57%/88.88%/97.11%`。
  main bundle 122,566 B。cold p50/p95 `140.2/154.4 ms`，warm p50/p95 `14.0/20.7 ms`，
  scanner p95 `0.75 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.49.vsix`，`1,193,251` bytes，SHA-256
  `4D7D378BC7DCB6F88575502DBFF5A006D1297F1970568EDE23BACE5A2267436D`，14 个条目。

## 2026-08-21 列竖线画不出来（0.1.48）

- `{cc|c}` 的 `|` MathJax 画成零宽度 `<line>`。VS Code decoration 把 SVG 当图片画，
  竖线 bbox 宽度为 0，整根丢掉；横线够长所以还在。改成有宽度的细矩形。
- 流水线：19 files / 199 tests；覆盖率 stmts/branch/lines `94.57%/88.88%/97.11%`。
  main bundle 129,066 B。cold p50/p95 `130.8/147.7 ms`，warm p50/p95 `14.1/22.7 ms`，
  scanner p95 `0.96 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.48.vsix`，`1,195,020` bytes，SHA-256
  `8F9460B48065F9D85A313B7FCC85E28D5D02BD489B1848D25A8861876CC75A9B`，14 个条目。

## 2026-08-21 带框表格渲染成白色色块（0.1.47）

- MathJax 用铺满表格的 `rect[data-frame]` 画外框，stylesheet 里是 `fill:none;stroke-width:70px`。
  独立 SVG 剥掉外部 CSS 后，`svg{fill:currentColor}` 把整块矩形涂满，深色主题里就是一坨白。
  只在 `{|c|c|c|}` / `\hline` 这类有框线的表上出现。
- 流水线：19 files / 198 tests；覆盖率 stmts/branch/lines `94.57%/88.88%/97.11%`。
  main bundle 129,066 B。cold p50/p95 `134.7/151.7 ms`，warm p50/p95 `13.6/20.9 ms`，
  scanner p95 `1.04 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.47.vsix`，`1,194,787` bytes，SHA-256
  `C9CAAFAED650A8D2D5EAC8D448D85B64EF1B1B4CE6B5C594BC7EF889D7BD501E`，14 个条目。

## 2026-08-21 自定义环境套 equation 无法预览（0.1.46）

- `.cls` 里 `\newenvironment{eqmath}{\begin{equation}}{\end{equation}}` 在预览数学模式里
  会报 “Erroneous nesting of equation structures”。prelude 把 equation 去壳、align→aligned。
- 流水线：19 files / 196 tests；覆盖率 stmts/branch/lines `94.57%/88.88%/97.11%`。
  main bundle 129,066 B。cold p50/p95 `133.8/154.1 ms`，warm p50/p95 `14.6/23.7 ms`，
  scanner p95 `0.94 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.46.vsix`，`1,194,570` bytes，SHA-256
  `003A71D2988091C6E2CA0B28B7FE71AE7D0A13EB7F0C5EF6C175AC03712ABF8F`，14 个条目。

## 2026-08-21 Markdown 行内代码点反引号也预览（0.1.45）

- `` `$not math$` `` 整段都是公式：光标在两侧反引号上也要命中。
  `` `see $x$` `` 这种夹着别的字的，仍然只命中 `$x$`。
- Jupyter 样例原先写「不是公式」，已改成「也应预览」。
- 流水线：19 files / 193 tests；覆盖率 stmts/branch/lines `94.56%/88.86%/97.10%`。
  main bundle 128,892 B。cold p50/p95 `135.9/144.6 ms`（本轮冷门数字低于 180 ms，
  仍不宣称稳定达标），warm p50/p95 `13.7/19.0 ms`，scanner p95 `0.77 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.45.vsix`，`1,194,588` bytes，SHA-256
  `E4EBC9A9F18CF4CAB0FC80A52F1C6F3D15FBD085E7B8D81DDCB071ED48DEE2F2`，14 个条目。

## 2026-08-21 Markdown 代码里的公式也预览（0.1.44）

- 行内 `` `$...$` `` 和 fence 里的公式要扫描。`ignoredRanges` 仍包含代码，
  以免 `\newcommand` 从代码块里进定义。
- 配对和恢复不能跨出当前 code span / fence。
- 流水线：19 files / 192 tests；覆盖率 stmts/branch/lines `94.51%/88.80%/97.08%`。
  main bundle 128,411 B。cold p50/p95 `145.0/165.9 ms`（冷门未达 180 ms 目标），warm p50/p95
  `15.7/21.6 ms`，scanner p95 `0.74 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.44.vsix`，`1,194,383` bytes，SHA-256
  `3BF3B0729708C47E43834B04A85126970B870F2AD3B11D1B796F6D95C4680167`，14 个条目。

## 2026-08-21 Markdown 表格框线（0.1.43）

- GFM 预览用 `|l|c|r|` + 每行 `\hline`，否则 MathJax array 没有框。
- 流水线：19 files / 191 tests；覆盖率 stmts/branch/lines `94.64%/88.78%/97.26%`。
  main bundle 127,557 B。cold p50/p95 `130.7/146.2 ms`，warm p50/p95 `13.4/20.9 ms`，
  scanner p95 `0.58 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.43.vsix`，`1,194,035` bytes，SHA-256
  `362C6C7C05B2B1E9A93F1C00FE4E29E10ED27AC1B8D0F12869A92E1A1F36D7AD`，14 个条目。

## 2026-08-21 更新 fixtures 与全量扫掠

- `test/fixtures/` 与当前行为对齐：预览在公式下方往右、GFM 表内 `|`、纯定义默认跳过。
- `test/fixtureSweep.test.ts` 对 .tex/.md/.txt/.ipynb 每个公式区域跑 MathJax。
  TikZ 不是数学环境，不要指望 scanner 扫到它。自定义环境用 aligned，不要套 equation。

## 2026-08-21 GFM 表内公式竖线（0.1.42）

- 拆 Markdown 表行时，`$...$` / `\(...\)` / `\[...\]` 里的 `|` 不是列分隔。
  否则 `$\int |\nabla u|^2$` 会被切成 `$\int` 和 `\nabla u|^2$`，MathJax 报
  math mode not terminated。
- 流水线：18 files / 186 tests；覆盖率 stmts/branch/lines `93.13%/87.42%/95.73%`。
  main bundle 127,463 B。cold p50/p95 `131.5/140.7 ms`，warm p50/p95 `13.6/22.2 ms`，
  scanner p95 `0.74 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.42.vsix`，`1,193,957` bytes，SHA-256
  `C1677153BFD1070168413285FB6708A76F457E4A66309B708F65BD1DFC52AE06`，14 个条目。

## 2026-08-21 预览从公式起点往右排（0.1.41）

- decoration range 必须从公式列开始，不能从 `lineAt().range.start`（行首）。
  否则同一行靠右的 `$...$` 预览会画在行左边。
- 超出右缘用负 `left` 往左推；比视口还宽则 `overflow-x: auto`。
- 流水线：18 files / 184 tests；覆盖率 stmts/branch/lines `93.67%/87.62%/96.42%`。
  main bundle 126,947 B。cold p50/p95 `132.2/140.4 ms`，warm p50/p95 `14.5/24.3 ms`，
  scanner p95 `0.86 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.41.vsix`，`1,193,720` bytes，SHA-256
  `0095D8947AFFD0F57A6FD15FF64FD62E3A88F0A955C764A90C8718AD3B2CE38C`，14 个条目。

## 2026-08-21 预览一律在公式下方（0.1.40）

- 不要再按单元格剩余高度把 below 改成 above。用户要浮层在公式下面。
- `silkMath.previewPosition` 才是方向开关，默认 below。
- 流水线：18 files / 180 tests；覆盖率 stmts/branch/lines `93.63%/87.74%/96.42%`。
  main bundle 125,185 B。cold p50/p95 `136.6/148.5 ms`，warm p50/p95 `14.6/22.7 ms`，
  scanner p95 `0.59 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.40.vsix`，`1,193,070` bytes，SHA-256
  `9EE14EEE9D8E9337951E5338E0A31283B0F26FCAA2563F1C96C5AA6756C8F124`，14 个条目。

## 2026-08-21 状态栏不要 Silk Math 左边的图标（0.1.39）

- 条目文案只能是 `Silk Math`，不要 `$(chevron-up)` / `$(add)` / 齿轮。
- 点击后也不要在左边展开 − % + 齿轮；控件放卡片和 hover。
- 流水线：18 files / 183 tests；覆盖率 stmts/branch/lines `93.68%/87.71%/96.44%`。
  main bundle 125,558 B。cold p50/p95 `137.4/152.3 ms`，warm p50/p95 `13.8/20.0 ms`，
  scanner p95 `0.55 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.39.vsix`，`1,193,106` bytes，SHA-256
  `1F49EBA059E5EE62D873179BC88EE11F4088A0110ED486F1D56B44DA4A124444`，14 个条目。

## 2026-08-21 Jupyter 设置卡片跑到左上角（0.1.38）

- 不能锚在 `activeTextEditor`（光标所在格往往在窗口上半截）。要选
  `notebook.visibleRanges` 最后一格。
- 单元格文档很短，`bottom: 8px; right: 16px` 相对这一格就能落在右下角。
  普通长文件仍用最后可见行 + `translateY(-100%)`，不能用 bottom。
- 流水线：18 files / 183 tests；覆盖率 stmts/branch/lines `93.68%/87.71%/96.44%`。
  main bundle 126,903 B。cold p50/p95 `136.4/156.3 ms`，warm p50/p95 `14.8/23.6 ms`，
  scanner p95 `1.14 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.38.vsix`，`1,193,307` bytes，SHA-256
  `7D402EFC4F56591B5197275146E09C50280CD2968BA943F03B9E0A389D32097E`，14 个条目。

## 2026-08-21 纯定义公式不报空渲染（0.1.37）

- `$ \def\A{\mathbf{A}} $` 对 MathJax 是成功但无图元。不要报“渲染结果为空”。
- 默认跳过；`silkMath.previewDefinitions` 打开后在声明后补 `\A` / `\norm{x}` 再画。
- 流水线：18 files / 183 tests；覆盖率 stmts/branch/lines `93.67%/87.68%/96.44%`。
  main bundle 125,983 B。cold p50/p95 `139.9/147.3 ms`，warm p50/p95 `15.4/22.5 ms`，
  scanner p95 `0.66 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.37.vsix`，`1,193,008` bytes，SHA-256
  `629EA94BB17D15ED1F83F433972778CC3E5D19AB3DE41749912E584838E3370A`，14 个条目。

## 2026-08-21 人工系统预览样例（test/fixtures）

- 视觉回归用 `test/fixtures/`，不要和 `test/*.test.ts` 混在一起。
- `.cls` 的 `question`/`solution` 必须是文本环境；数学宏放 `.sty`，主文件
  `\documentclass{silkmath-fixture}` 才能测到「类文件 + 宏包 + 使用处」。
- Jupyter 第一格写 `$\def\A{...}$`，后面格子用 `\A`；代码格不提供定义。

## 2026-08-21 详情页与 GitHub 显示图标（0.1.36）

- README 顶部放 `media/icon.png`（约 96px）。同一文件同时给商店详情页和 GitHub。
- `package.json` 的 `icon` 仍是商店卡片用的 256px 图标；README 里要再写一张，否则介绍正文没有 logo。
- 流水线：17 files / 179 tests；覆盖率 stmts/branch/lines `93.81%/88.08%/96.37%`。
  main bundle 123,732 B。cold p50/p95 `138.8/152.6 ms`，warm p50/p95 `14.0/23.1 ms`，
  scanner p95 `0.89 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.36.vsix`，`1,192,175` bytes，SHA-256
  `86DC6778733995E0336FB2F6667320F34F9D6ECE6EE8FFCD59F96551A95C2E60`，14 个条目。

## 2026-08-21 详情页默认英文、可切换、示意图缩小（0.1.35）

- 详情页已经有 displayName，README 仍不要一级标题。默认英文；用
  `href="#english"` / `href="#chinese"` 做页内切换，不要另开 README.zh-CN.md
  （商店只渲染 README.md）。
- 示意图 `<img width="480">`，最多两三张。相对路径 `media/*.png`，靠 vsce 改写成
  GitHub https。短描述英文在前。
- 流水线：17 files / 179 tests；覆盖率 stmts/branch/lines `93.81%/88.08%/96.37%`。
  main bundle 123,732 B。cold p50/p95 `139.2/158.1 ms`，warm p50/p95 `14.9/21.9 ms`，
  scanner p95 `0.65 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.35.vsix`，`1,192,129` bytes，SHA-256
  `37712EA9B9820DF747CFBEBC472A891DE8CA15FC3A0334C8ABAFFF3460EBA1F0`，14 个条目。

## 2026-08-21 卡片错位到左边（0.1.34）

- 用户截图：卡片在 Jupyter 单元格左边，Silk Math 在右下角。原因是 decoration
  给行设了 `position: relative`，`right: 0` 相对短行行盒，不是编辑器右缘。
- 不要给锚点行设 relative。包含块走 `lines-content`，`right: 10px` 钉在编辑器
  右边（状态栏 Silk Math 上头）；竖直用 `translateY(-100% - 8px)` 抬到最后可见行上方。
- 点击后不要改状态栏文案（不要 `$(chevron-up)`）。
- 流水线：17 files / 178 tests；覆盖率 stmts/branch/lines `93.81%/88.08%/96.37%`。
  main bundle 123,732 B。cold p50/p95 `181.5/191.5 ms`（冷门未达 180 ms），warm p50/p95
  `16.8/25.6 ms`，scanner p95 `0.81 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.34.vsix`，`1,192,094` bytes，SHA-256
  `321C96800ED0F488A4211DAEEB9A96964E55ECD2AF52C66DEE5B3909B3CDDF6F`，14 个条目。

## 2026-08-21 点击状态栏没反应（0.1.33）

- 点 **Silk Math** 没反应不是命令没绑上。0.1.32 画了卡片，但立刻被关掉或画到视口外：
  1. `onDidChangeActiveTextEditor(undefined)` / Mouse 选区在点击后马上 `hideFlyout`。
  2. Monaco `lines-content` 带 `transform`，`position: fixed; bottom: 26px` 相对整篇
     文档而不是窗口，卡片落在文件末尾。
- 不要再尝试 `statusBar.entry.showTooltip`：核心用对象身份比较 `ShowTooltipCommand`，
  扩展设同名字符串会走 commandService，命令并未注册，等于空点击。
- 卡片用与公式预览相同的 `position: relative` 锚 + `position: absolute; bottom: 100%`。
  状态栏同时展开 `−` / `%` / `+` / 齿轮，因为 decoration 里的 SVG 是图片，`command:`
  链接点不了。
- 流水线：17 files / 178 tests；覆盖率 stmts/branch/lines `93.81%/88.08%/96.37%`。
  main bundle 123,784 B。cold p50/p95 `138.3/144.5 ms`，warm p50/p95 `13.7/20.5 ms`，
  scanner p95 `0.81 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.33.vsix`，`1,191,985` bytes，SHA-256
  `1F726698618F590CB1B9F3B5A629BD9D2E3C11BE7F21CC72F344B91DAFE3B343`，14 个条目。

## 2026-08-21 点击状态栏弹出 Copilot 位卡片（0.1.32）

- Copilot 卡片是核心 `ShowTooltipCommand` + HTML hover，扩展点不到。
- 点击不要用 QuickPick（会出现在窗口顶部）。用 decoration `position: fixed; bottom: 26px; right: 10px` 钉在状态栏上方。
- 流水线：17 files / 176 tests；覆盖率 stmts/branch/lines `93.80%/88.07%/96.36%`。
  main bundle 121,740 B。cold p50/p95 `136.0/143.8 ms`，warm p50/p95 `13.9/20.9 ms`，
  scanner p95 `0.86 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.32.vsix`，`1,191,461` bytes，SHA-256
  `17C2FFB4397786E17BF215062E3FF5DF43EF7797A5A93C2B5DAC560D7DB0561A`，14 个条目。

## 2026-08-21 Markdown 表格与更轻的热路径（0.1.31）

- GFM `| col |` + 分隔行当成一张表，和 tabular 一样译成 `array`。表内 `$` 不再单独成区域。
- Worker 同时只跑最新请求，旧的直接 superseded。连打字时 CPU/内存都比排队渲染低。
- 流水线：17 files / 175 tests；覆盖率 stmts/branch/lines `93.87%/88.60%/96.32%`。
  main bundle 116,640 B。cold p50/p95 `141.3/145.2 ms`，warm p50/p95 `13.8/22.9 ms`，
  scanner p95 `0.98 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.31.vsix`，`1,189,847` bytes，SHA-256
  `791D44B7B7CD2B47B3BEBCF75D96C609CEDB96779A24D1DA947E1BD821CF07B8`，14 个条目。

## 2026-08-21 Jupyter 单元格裁切浮层（0.1.30）

- notebook 单元格 `overflow` 会裁掉 decoration，z-index 救不了。公式贴底时把
  浮层翻到上方，仍画在当前格内部。
- 流水线：16 files / 167 tests；覆盖率 stmts/branch/lines `94.12%/88.68%/96.26%`。
  main bundle 113,156 B。cold p50/p95 `135.7/146.8 ms`，warm p50/p95 `13.8/22.1 ms`，
  scanner p95 `0.46 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.30.vsix`，`1,188,662` bytes，SHA-256
  `54E5137FDF136CA0F3CD1749A37F253CBFC9EE9469DA70DC2685B3A5BFF69A8C`，14 个条目。

## 2026-08-21 underbrace 拉伸段必须几何裁剪（0.1.29）

- 装饰 SVG 是 `content: url(data:image/svg+xml;base64,...)`。里面的
  `clip-path="url(#id)"` 不会生效，看起来就像多一根横线、括号右端断开。
- 内层 svg 里的拉伸段是轴对齐矩形。按 viewBox 求交后写成 `M x y H x V y H x Z`，
  不要依赖 fragment URL。
- 流水线：16 files / 162 tests；覆盖率 stmts/branch/lines `94.22%/88.98%/96.34%`。
  main bundle 112,323 B。cold p50/p95 `143.8/151.2 ms`，warm p50/p95 `15.2/25.1 ms`，
  scanner p95 `0.65 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.29.vsix`，`1,188,340` bytes，SHA-256
  `E3D3925D6EC06F9E0C6B0C01B3074E3D5809B6B49F9F4BB4C3B62FC94F919BF5`，14 个条目。

## 2026-08-21 状态栏点击必须有可见反馈（0.1.28）

- 不要把 `item.command` 设成 `statusBar.entry.showTooltip` 再注册空实现：
  扩展走不到核心的对象身份分支，点击等于没反应。
- 点击用 `silkMath.showMenu`（QuickPick，开关后保持打开）。悬停才是 Markdown
  悬浮框。两者都要有，不能只留悬停。
- 流水线：16 files / 162 tests；覆盖率 stmts/branch/lines `94.22%/88.98%/96.34%`。
  main bundle 112,323 B。cold p50/p95 `170.3/211.4 ms`（冷门未达 180 ms），warm p50/p95
  `16.5/24.9 ms`，scanner p95 `0.70 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.28.vsix`，`1,187,454` bytes，SHA-256
  `244147F421CD20BC5A496628C24A65242AB42A7CB3B761DFC4B0D73FE6B44BF6`，14 个条目。

## 2026-08-21 underbrace 裁剪、浮层留白、默认 135%（0.1.27）

- 内层 svg 展成 `<g>` 时必须保留 viewBox 裁剪（`clipPath`）。否则拉伸矩形铺开，
  `\underbrace` 看起来像一根直线。
- `expandViewBoxToContent` 只在定位点落在原 viewBox **之外** 时才外扩。对每个
  transform 原点一律 ±2000 会让所有公式四周空一圈。
- `silkMath.previewScale` 默认 `1.35`。界面百分比 = 实际倍率 / 1.35。
- 流水线：16 files / 162 tests；覆盖率 stmts/branch/lines `94.22%/88.98%/96.34%`。
  main bundle 111,881 B。cold p50/p95 `177.8/231.5 ms`（冷门未达 180 ms），warm p50/p95
  `17.0/32.0 ms`，scanner p95 `1.16 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.27.vsix`，`1,187,260` bytes，SHA-256
  `12690FB4CBE2508121A6DF5DACFB8672DE4F76F87857372A1F5E37EB0AD272F2`，14 个条目。

## 2026-08-21 underbrace 空浮层（0.1.26）

- 浮层有宽高、里面是空的 = SVG 当 `contentIconPath` 图片失败，不是 MathJax 没画出 path。
- `\underbrace` 拉伸段是**内层 `<svg x y viewBox>`**。Webview `innerHTML` 能画，VS Code
  装饰的 `content: url(data:image/svg+xml)` 遇到嵌套 svg 整张空白。
- 修法：内层 svg 展平成等价 `<g transform>`；viewBox 按变换后的定位点外扩，否则
  `{=0 \text{ by the PDE}}` 会被根 viewBox 裁掉。
- 流水线：16 files / 162 tests；覆盖率 stmts/branch/lines `94.22%/88.98%/96.34%`。
  main bundle 111,880 B。cold p50/p95 `132.6/154.6 ms`，warm p50/p95 `13.3/21.7 ms`，
  scanner p95 `0.65 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.26.vsix`，`1,187,027` bytes，SHA-256
  `4F6C8E455B78E674D362B9C323B910B1D4D5D5882135288DD876F931E1864249`，14 个条目。

## 2026-08-21 状态栏 Copilot 式悬浮框，不再贡献视图（0.1.25）

- 用户要的是 Copilot 那种钉在状态栏上方的小卡片，不是 panel / 辅助栏。
  `views` / `viewsContainers` 会永远带着工作区 chrome，而且 VS Code 会记住旧位置，
  所以 0.1.16–0.1.24 的 webview 卡片在用户机器上仍显示成底栏整条「Silk Math」标签。
- 扩展没有 Copilot 的 `statusBar.entry.showTooltip` 对象身份；公开能力是
  可信 MarkdownString tooltip（同一套 hover 组件）。点击挂同名 command，未命中时
  空实现，避免「找不到命令」。不要再加 view。
- 流水线：16 files / 162 tests；覆盖率 stmts/branch/lines `94.12%/88.73%/96.23%`。
  main bundle 111,880 B。cold p50/p95 `136.7/144.2 ms`，warm p50/p95 `12.4/22.3 ms`，
  scanner p95 `0.45 ms`，idle restart 通过。
- 产物 `silk-math-preview-0.1.25.vsix`，`1,185,627` bytes，SHA-256
  `94FF6F39CC5E4B06727B8A4CF01DC5EAAE792F39203EF6A02D9DE3C2614D315D`，14 个条目。

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
