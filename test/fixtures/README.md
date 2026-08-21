# Silk Math 系统预览样例

`test/*.test.ts` 是 vitest 单测。本目录是给人打开、也给 `fixtureSweep.test.ts` 扫一遍的真实文档。

| 文件 | 测什么 |
| --- | --- |
| `silkmath-fixture.sty` | `.sty` 里的宏、颜色、算子；`eqmath`/`almath` 用 equation/align 包一层（真实 .cls 写法） |
| `silkmath-fixture.cls` | 类文件宏；`question`/`solution` 是文本环境，不能吞掉里面的公式 |
| `all-math.tex` | `\documentclass{silkmath-fixture}`：分隔符、环境、矩阵、underbrace、表格、靠右行内公式 |
| `all-math.md` | YAML / 正文宏、GFM 表（含 `$|\nabla u|$`）、行内代码和 fence 里的 `$` 也要预览 |
| `all-math.txt` | 纯文本。先在状态栏打开「其他文件类型」 |
| `all-math.ipynb` | 第一格定义 `\A`，后面格子使用；预览应在公式**下方**；纯定义默认不预览；markdown 行内代码里的 `$` 也要预览 |

人工验收：每个小节把光标放进公式的开头、中间、结尾。预览从**当前公式下方往右**排。
