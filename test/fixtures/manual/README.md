# 人工验收：边写边加宏 / 大文件 / 常见边界

`test/*.test.ts` 是自动单测。本目录给你在 VS Code 里点开预览，按步骤打勾。

准备：

1. 安装当前构建的扩展（开发宿主：F5；或 `npm run package:test` 装测试通道）。
2. 用 **打开文件夹** 打开 `test/fixtures/manual`，不要只开单个文件（`.sty` 依赖靠同目录/工作区解析）。
3. 状态栏点 **Silk Math**，确认 LaTeX、Markdown 预览开着。
4. 预览应在**当前公式下方**，水平大致对准公式中心。

文件对照：

| 打开这个 | 用到的宏包/类 |
| --- | --- |
| `01-live-newcommand.tex` | 无，全在本文件 |
| `02-live-package.tex` | `livepkg.sty` |
| `03-unsaved.tex` | 你新建的 `draftlive.sty`，以及 `diskpkg.sty` |
| `04-two-packages.tex` | `onepkg.sty` + `twopkg.sty` |
| `05-large.tex` | `largepkg.sty`（约 300 个宏） |
| `06-order.tex` | 无 |
| `07-markdown.md` | YAML + 正文 `\newcommand` |
| `08-class.tex` | `manualcls.cls` |
| `09-notebook.ipynb` | 第一格定义，第三格使用 |
| `10-edges.tex` | 未知命令 / 未写完 / TikZ / 表 / physics |

下面每条都写了「做什么」和「应该看到什么」。失败时先跑命令面板 **Silk Math: 诊断当前公式**。

---

## A. 同一文件里先写宏，再写后面的公式

打开 `01-live-newcommand.tex`。

| 步骤 | 操作 | 期望 |
| --- | --- | --- |
| A1 | 光标放进 `$\keep$` | 预览是 **K**，不是红字 `\keep` |
| A2 | 光标放进 `$\later$` | 预览是 **α** |
| A3 | 光标放进 `$\ren$` | 预览是 **R**（被 renew 过，不是旧的 r） |
| A4 | 光标放进 `$\pair{a}{b}$` | 预览是 **(a,b)** |
| A5 | 在 `\newcommand{\later}{\alpha}` **下面**再加一行 `\newcommand{\fresh}{\beta}`，下一行写 `$\fresh$`，光标进公式 | 马上（或停顿不到半秒）画出 **β**，不要一直红字 |
| A6 | 光标放进文件**最上面**的 `$x$`（在任何 `\newcommand` 之前） | 只是 x；**不能**把后面才定义的 `\later` 用上 |

---

## B. `\usepackage` 本地包

打开 `02-live-package.tex`（同目录已有 `livepkg.sty`）。

| 步骤 | 操作 | 期望 |
| --- | --- | --- |
| B1 | 光标进 `$\pkgCmd$` | 预览是 **β** |
| B2 | 光标进 `$\pkgNorm{v}$` | 预览是 ‖v‖ |
| B3 | 打开 `livepkg.sty`，把 `\pkgCmd` 改成 `\gamma` 并 **保存**，回到 tex 的 `$\pkgCmd$` | 预览变成 **γ** |
| B4 | 在 sty 里再加 `\newcommand{\pkgNew}{\delta}` 并保存，tex 里写 `$\pkgNew$` | 预览是 **δ** |

---

## C. 未保存的 `.sty`（这次修的重点）

打开 `03-unsaved.tex`。

| 步骤 | 操作 | 期望 |
| --- | --- | --- |
| C1 | 先不要建文件，光标进 `$\draftCmd$` | `\draftCmd` 红色未知命令，公式其余部分仍在 |
| C2 | 命令面板 **新建文本文件**，另存为同目录 `draftlive.sty`（可先保存一次让路径固定） | — |
| C3 | 在 sty 里写 `\newcommand{\draftCmd}{\beta}`，**先不要保存**，立刻回到 tex 点进 `$\draftCmd$` | 预览是 **β**（读的是编辑器缓冲区，不是磁盘） |
| C4 | 把 sty 改成 `\gamma` 仍不保存，再点公式 | 预览变成 **γ** |
| C5 | 同目录已有 `diskpkg.sty` 内容是 `disk`。打开它改成 `buffer` 不保存，点 `03-unsaved.tex` 里的 `$\diskCmd$` | 预览是 **buffer**，不是磁盘上的 disk |

---

## D. 只重读改过的包，打字不卡

打开 `04-two-packages.tex`。

| 步骤 | 操作 | 期望 |
| --- | --- | --- |
| D1 | 光标进 `$\one+\two$` | 预览是 **1+2** |
| D2 | 只改 `onepkg.sty` 把 `1` 改成 `A` 并保存 | `\one` 变成 A，`\two` 仍是 2 |
| D3 | 在 `04-two-packages.tex` 的公式里连续打字（改成 `$\one+\two+x$`） | 预览跟着变，光标处有竖线；不应整秒卡死或闪成空白 |

---

## E. 大 `.sty`（约 300 个宏）

打开 `05-large.tex`。

| 步骤 | 操作 | 期望 |
| --- | --- | --- |
| E1 | 第一次把光标放进 `$\ma+\mkn$` | 应在约 0.2 秒内画出 **x₀ + x₂₉₉**，不要空白面板 |
| E2 | 在公式里左右移动光标、插入 `+y` | 热更新跟手，不要每次都像冷启动那样转很久 |
| E3 | 光标离开公式再回来 | 仍能展开，不会丢宏 |

若要加压：把 `largepkg.sty` 再复制几遍宏（改名），保存后重复 E1。超过约 8 MB 应提示过大未加载，而不是整份定义消失。

---

## F. 光标前才生效

打开 `06-order.tex`。

| 步骤 | 操作 | 期望 |
| --- | --- | --- |
| F1 | 光标进第一行 `$\before$` | **B** |
| F2 | 光标进 `$\after$` 之前的那条 `$\before$`（中间那条） | 仍是 **B**；不能因为文件后部有 `\after` 就乱套 |
| F3 | 光标进最后的 `$\after$` | **A** |

---

## G. 类文件：文本环境 vs 数学环境

打开 `08-class.tex`（依赖 `manualcls.cls`）。

| 步骤 | 操作 | 期望 |
| --- | --- | --- |
| G1 | 光标进 `\begin{eqmath}...\end{eqmath}` | 整段是一条公式，画出 X = O(h²) 这类结果 |
| G2 | 光标放在 `question` 环境的**正文**上（不在 `$` 里） | **不要**把整段解答当成一条公式 |
| G3 | 光标进 question 里面的 `$u\equiv-1$` 和 `\[ \Delta u=0 \]` | 这两条各自预览 |
| G4 | 光标进 `$\clsOnly{Y}$` | 无衬线 Y |

---

## H. Markdown / Jupyter

| 步骤 | 文件 | 操作 | 期望 |
| --- | --- | --- | --- |
| H1 | `07-markdown.md` | 点 `$x\in\RR$`、`$\mdA u$` | YAML 宏和正文 `\newcommand` 都展开 |
| H2 | 同上 | 点只有 `\newcommand` 的那条 | 默认不预览、不报「渲染为空」；状态栏打开「定义也预览」才画 |
| H3 | 同上 | 点 GFM 表里的 `$\int |\nabla u|^2$` | 竖线不会把公式切碎；能画出积分 |
| H4 | `09-notebook.ipynb` | 第一格定义，第二格代码，第三格 `$ \A u $` | 第三格能用第一格的 `\A`；代码格里的宏不算 |
| H5 | 同上 | 在第一格末尾追加 `\newcommand{\nbFresh}{\gamma}`，到第三格写 `$\nbFresh$` | 新宏能用 |

---

## I. 边界：未知命令、未写完、TikZ、表格

打开 `10-edges.tex`。

| 步骤 | 操作 | 期望 |
| --- | --- | --- |
| I1 | `$\unknownCmd+x$` | `\unknownCmd` 红字，**x 仍在** |
| I2 | 未写完的 `\frac{a}{` 光标停在里面 | 不闪空白；能补画或保留上一帧 |
| I3 | TikZ `tikzpicture` | 提示需要完整 TeX 引擎，不是空白 |
| I4 | `{|c|c|}` 带 `\hline\hline` 的表 | 能看见框线和表首双横线，不是白色色块 |
| I5 | `\usepackage{physics}` 后写 `$\ket{\psi}$`（工作区没有 physics.sty） | `\ket` 红字；**不会**凭空变成完整 physics 包 |
| I6 | 长 `aligned` 把公式滚出视口再滚回来 | 预览仍挂在可见行上，不会整块消失 |

---

## J. 交互

| 步骤 | 操作 | 期望 |
| --- | --- | --- |
| J1 | 点状态栏 Silk Math | 顶部 QuickPick，开关后菜单不关、勾选马上变 |
| J2 | Esc | 关掉菜单；若预览可见则关掉预览 |
| J3 | 点滚动条 | 预览不要因为选区落到浮层盖住的行上而消失 |
| J4 | 主题切 Light/Dark | 公式颜色跟着变，不要留旧颜色 |

---

## 现成的全功能样例

回归「各种公式长什么样」仍用上一级目录：

- `../all-math.tex` — 分隔符、环境、矩阵、underbrace、表格
- `../all-math.md` — Markdown
- `../all-math.ipynb` — Jupyter
- `../silkmath-fixture.sty` / `.cls` — 类文件 + 宏包 + 使用处

那边每个小节都要把光标放到公式开头、中间、结尾各看一次。
