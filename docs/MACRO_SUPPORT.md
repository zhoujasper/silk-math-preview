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

手动验收样例：[11-siunitx.tex](../test/fixtures/manual/11-siunitx.tex)。

实现对照：[MathJax 文本宏机制](https://docs.mathjax.org/en/v4.1/input/tex/extensions/textmacros.html)、
[siunitx 官方说明](https://tug.ctan.org/macros/latex/contrib/siunitx/siunitx.pdf)。
