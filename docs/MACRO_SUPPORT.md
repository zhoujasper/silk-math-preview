# 宏与宏包预览

预览自动分析当前文档在光标之前的声明，沿 `\documentclass`、`\usepackage`、
`\RequirePackage`、`\input`、`\include` 读取本地依赖。打开但尚未保存的 `.sty/.cls/.tex`
优先使用编辑器内容；同名文件先匹配准确路径，再搜索工作区。改动依赖后自动更新。
“诊断当前公式”会列出识别到的宏包。

章节文件支持 `% !TeX root = ../main.tex`，继承指定主文件的导言区及其本地依赖。
没有指令时，只检查最多 16 个已打开文档，匹配唯一直接引用当前章节的主文件；多个候选时
提示指定 root。不会为每次输入扫描整个工作区，主文件的其他章节正文不会混入当前宏。

| 内容 | 支持范围 |
| --- | --- |
| 数字 | `\num`、`\numlist`、`\numrange`、`\numproduct`；正负号、小数、`e/E/d/D` 指数、括号不确定度；保留长整数和尾零 |
| 数量和单位 | `\SI/\si`、`\qty/\unit`、相应列表/范围/乘积、`\ang`；常见 SI 前缀、单位、幂、`\per`，以及 `\DeclareSIUnit` |
| 格式 | 命令可选参数、宏包选项和 `\sisetup`；小数位/有效数字/不确定度舍入、补零、进位、`round-half=even`、`round-direction`；地区、小数点、数字分组、指数、列表/范围分隔及单位重复 |
| 不确定度 | `1.23(4)` 可用 `uncertainty-mode=separate` 或 `separate-uncertainty` 显示为 `1.23 ± 0.04`；指数和数量加括号避免歧义；支持 `uncertainty-mode=full` |
| 单位排版 | 符号单位支持 `per-mode=fraction/symbol/reciprocal/reciprocal-positive-first`、`sticky-per`、`inter-unit-product`、幂及下标；默认 `\per` 仅作用于下一个单位 |
| S 列 | 数字、`\num`、可展开的数值宏按实际字形宽度对齐小数点；支持列选项、指数、负数及重复列格式；标题和合并单元格按文本处理 |
| 自定义宏 | 原有 `\newcommand/\renewcommand/\providecommand/\def`、常见 xparse 声明和数学环境；新增 `\gdef`、`\DeclareRobustCommand`、`\DeclarePairedDelimiter` |
| 表格文本 | 文本样式、默认参数、嵌套自定义宏、`\ensuremath`、数字和单位命令；不再把这些命令原样打印在文本格里 |
| 常见宏包 | 根据声明或当前公式中的命令，启用内置的 `mathtools`、`braket`、`upgreek`、`amscd`、`mhchem`、`textcomp`；显式声明 `physics` 时按其含义处理同名 `\qty` |

数字、单位和选项是结构化参数。在这些参数内移动光标时，预览标记吸附到整个命令之后，
避免把指数、单位名或选项拆坏；编辑器里的实际光标和源码都不变。

常见写法：

```tex
\num[round-mode=places,round-precision=2]{1.23456} % 1.23
\num[round-mode=figures,round-precision=3]{9.999}  % 10.0
\num[uncertainty-mode=separate]{1.23(4)}         % 1.23 ± 0.04
\qty[per-mode=fraction]{9.81}{\metre\per\second\squared}
\begin{tabular}{lS[round-mode=places,round-precision=2]}
  项目 & {数值} \\
  Alpha & 1234.567 \\
  Beta  & 0.12 \\
\end{tabular}
```

仍有边界：不支持所有 siunitx 选项，例如指数自动换算、复杂/非对称不确定度、
`table-format` 预留宽度、指数/不确定度的独立对齐，以及完整字体/换行排版。
字面量单位 `m/s^2` 按原写法显示；`per-mode` 只重排 `\metre\per\second\squared` 这类符号单位。
舍入精度限制在 ±1000，超出或无法识别的设置不进行数值变换；带不确定度的数值用
`round-mode=uncertainty` 同步舍入。任意 `\let/\edef/\xdef`、复杂 xparse 参数仍未纳入声明索引。
完整 CTAN 宏包、系统 TeX 搜索路径、动态路径、条件执行、catcode、expl3/LuaTeX 不在这条
MathJax 预览路径中执行。未定义命令仍保留错误标记，受限宏仍在诊断中说明。

性能约束：显示处理留在独立 Worker，单位只解析实际使用的名称；格式和单位缓存各为
64 条/估算 32 KiB。每帧输出后释放 MathJax 临时树，Worker 默认闲置 60 秒退出。
主线程的文档解析、依赖解析分别限制为 12/128 条、各估算 16 MiB；快照和路径缓存也有
数量和估算大小上限。这些是缓存预算，不是整个 VS Code 进程的内存承诺。
普通公式的尾部输入只读编辑点附近 128 字符，复用宏语义快照；更改声明才重新解析。

实现对照：[MathJax 文本宏机制](https://docs.mathjax.org/en/v4.1/input/tex/extensions/textmacros.html)、
[siunitx 官方说明](https://tug.ctan.org/macros/latex/contrib/siunitx/siunitx.pdf)。


## 定理环境中的公式与长文档

`\newtheorem{proposition}{Proposition}` 定义的是带正文和编号的定理环境，不等同于数学环境。本扩展预览其中的 `$...$`、`\[...\]` 或数学环境，不排版整个命题，也不把 `\newtheorem` 当作 MathJax 数学环境声明执行。

0.3.11 修复了从任意局部窗口起点扫描时，可能把结束 `$` 当作开始 `$` 并将后面的 `\begin{proposition}` 混入公式的问题。公式索引保留完整上下文；光标移动复用索引，闭合公式内编辑局部更新，结构变化从可信边界重新扫描。Markdown 结构变化会重新扫描当前文档。LaTeX 的 `\verb`、`verbatim`、`Verbatim`、`lstlisting`、`minted` 和 `comment` 原样区域不参与数学定界符配对。

如果公式本身直接包含 MathJax 不支持的环境，仍会报告错误，不会为消除报错而静默删除该环境或改变用户源码。遇到问题可以使用“诊断当前公式”在本机检查截取的区域和表达式；诊断结果可能含源码，分享前请自行脱敏。

## 父目录与类文件继承（0.3.13）

本地依赖支持 `\documentclass{../../note}`、`\usepackage{../样式/my macros}` 和 `\input{../defs}`；有工作区时，规范化后的目标仍须位于当前工作区内。单独打开文件时可按明确的相对路径读取父目录依赖。含目录的路径仅按准确位置解析，不按文件名猜测替代文件。

类文件的 `\LoadClass` / `\LoadClassWithOptions`、样式文件的 `\RequirePackageWithOptions` 也进入依赖链；文件内定义继续按源码顺序覆盖，已打开依赖优先读取尚未保存的内容。这里只提取已有支持的声明式宏，不执行任意 TeX 程序，也不搜索系统 TeX 安装目录。


## Markdown 数学与编号（0.3.21）

除 `$...$`、`$$...$$`、`\(...\)`、`\[...\]` 及独立数学环境外，支持 GitHub 的 `$` 加单反引号包裹的行内数学，以及标记为 `math` 的反引号或波浪号代码围栏。围栏内直接写表达式，不需要再加 `$$`。MDX 和 Notebook Markdown 单元格沿用相同解析路径；普通代码围栏保持既有公式预览行为，代码里的声明不导入全局宏上下文。

`\tag{1}` 保留括号编号，`\tag*{A}` 保留无括号编号；标签内容按 MathJax 文本模式解释，数学下标可写 `\tag{$A_1$}`。支持带标签的 equation、align、alignat、gather、multline（及星号形式），包括 `$$` 或 `\[...\]` 外包装。编号不再依赖网页百分比宽度；导出 PNG 使用相同完整图形。

命令或环境声明的替换文本不会单独当作可执行图形；例如 `\newenvironment{foo}{\begin{tikzpicture}}{\end{tikzpicture}}` 不应在两个定义参数之间产生括号错误。显式数学区域内的宏定义仍可用于当前表达式。复杂动态 TeX、catcode 或尚未完成的声明不等价于完整 TeX 编译。

预览不建立整篇文档自动编号和跨公式引用表；`\ref` / `\eqref` 在无法解析目标时可能显示 `???`。扩展使用 MathJax，并非完整 LaTeX 或 KaTeX 替代品；仅支持打包的宏包及可安全解析的本地声明。网页/Markdown 平台各有扩展语法，HTML/JSX、远程 `\require`、任意宏包及全文档排版不在这一支持范围。

### English

GitHub-style backtick-protected inline math and `math` fences are supported alongside the existing dollar, parenthesis, bracket, and environment delimiters. MDX and Notebook Markdown cells share this path. Explicit equation tags retain their contents and placement in SVG and PNG, including tagged equation, align, alignat, gather, and multline environments and their starred forms. Declaration replacement bodies are not independently treated as live formulas. Document-wide automatic numbering, cross-formula references, arbitrary packages, and remote loading remain outside the standalone preview scope.

### 语法依据 / Syntax references

- [GitHub mathematical expressions](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/writing-mathematical-expressions)
- [MathJax equation numbers and tags](https://docs.mathjax.org/en/v4.0/input/tex/eqnumbers.html)
- [Jupyter Notebook mathematical notation](https://github.com/jupyter/notebook/blob/main/docs/source/notebook.md)
- [MathJax differences from TeX](https://docs.mathjax.org/en/latest/input/tex/differences.html)
- [KaTeX support table, for comparison](https://katex.org/docs/support_table.html)
