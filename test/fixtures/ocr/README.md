# OCR 图片回归

- `eigenvalue.png`：用户在 2026-09-09 提供的原图，400×104，期望完整识别 `A\mathbf{v}=\lambda\mathbf{v},\qquad\mathbf{v}\ne\mathbf{0}`。
- 其余 PNG：本项目 MathJax SVG 在 macOS AppKit 中栅格化的测试图片；源公式如下，图片仅用于测试，不随 VSIX 分发。

| 文件 | 源公式 |
| --- | --- |
| fraction | `\frac{a+b}{c-d}=\frac{1}{2}` |
| matrix | `\begin{pmatrix}1&2\\3&4\end{pmatrix}` |
| cases | `f(x)=\begin{cases}x^2&x\ge0\\-x&x<0\end{cases}` |
| table | `\begin{array}{|c|c|}\hline x&y\\\hline 1&2\\3&4\\\hline\end{array}` |
| array | `\begin{array}{cc}a&b\\c&d\end{array}` |
| integral | `\int_0^1 x^2\,dx=\frac{1}{3}` |
| decimal | `x=-0.5,\quad y=1.25\times10^{-3}` |
| sum | `S_n=\sum_{k=1}^{n}k=\frac{n(n+1)}{2}` |
| sparseTable | `\begin{array}{|c|c|}\hline{}&{}\\\hline x&{}\\\hline{}&{}\\\hline\end{array}` |

`scripts/validate-ocr-accuracy.mjs` 还从原图生成 5 个背景/留白变体，并覆盖公式和智能模式。两张带框表格是已知模型边界：须保留数据和表格，明确标记复核；不得把它们计入准确识别数量。
