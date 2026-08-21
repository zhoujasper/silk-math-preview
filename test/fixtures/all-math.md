---
macros:
  ZZ: "\\mathbb{Z}"
  mdNorm: ['\\lVert #1 \\rVert', 1]
math:
  macros:
    RR: '\mathbb{R}'
    pair: ['(#1,#2)', 2]
---

# Markdown 系统预览样例

正文 TeX 声明（frontmatter 之外也应生效）：

\newcommand{\mdA}{\mathbf{A}}
\def\mdE{\varepsilon}

点进下面每条公式。YAML 里的 `\RR` `\ZZ` `\mdNorm` `\pair` 和正文 `\mdA` `\mdE` 都应展开。
预览从当前公式下方往右排。

## 纯定义（默认不预览）

$\newcommand{\mdOnly}{\mathbf{M}}$

上面只有 `\newcommand`。默认不画、也不报“渲染为空”。打开「定义也预览」才会画出 **M**。

## 分隔符

行内 $x\in\RR$、$\mdNorm{v}$、$\pair{a}{b}$、$\mdA u=\mdE$。

圆括号 \(\sum_{n=1}^N \frac{1}{n^2}\)。

把光标放进行尾公式，预览应对准它而不是行首：前面垫一些文字让公式靠右 $E=mc^2$。

独立段：

$$
\int_0^1 x^2\,\mathrm{d}x=\frac13
$$

\[
  \mdA^\top \mdA v = \lambda v
\]

美元套 equation（Markdown / Jupyter 里很常见）：

$$
\begin{equation}
  u_t = \Delta u
\end{equation}
$$

\[
\begin{align}
  a &= b \\
  c &= d
\end{align}
\]

跨行行内：
$E(u)=\int_\Omega
|\nabla u|^2\,\mathrm{d}x$

## 矩阵、underbrace、划掉

$$
\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}
\quad
\begin{bmatrix} a \\ b \end{bmatrix}
\quad
\begin{cases} x & x>0 \\ 0 & x\le 0 \end{cases}
$$

$$
\underbrace{\mdA u}_{=0 \text{ by the PDE}}
\quad
\sqrt{1+x^2}
\quad
\cancel{h^2}
$$

$$
\frac{a}{b}+\binom{n}{k}+\sum_{\substack{i=1\\i\neq j}}^n a_{ij}
$$

$$
\left( \frac{1}{2} \right)
\quad \textcolor{red}{x}
\quad \mathbf{x}+\mathbb{Z}+\mathcal{L}
$$

## GFM 管道表格

单元格里的 `$` 不是独立公式区域。`$ |\nabla u|^2 $` 里的竖线也不是列分隔。

| 项 | 记号 | 值 |
| --- | :---: | ---: |
| 矩阵 | $\mdA$ | $n\times n$ |
| 能量 | $E(u)$ | $\int |\nabla u|^2$ |
| 绝对值 | $|x|$ | $\lVert v \rVert$ |

无外框竖线也可以：

左对齐 | 居中 | 右对齐
:--- | :---: | ---:
$a$ | $b$ | $c$

## 代码里的公式也可以预览

行内代码 `$E=mc^2$` 把光标放进反引号里也应预览。fence 同样：

```tex
$also not math$
\begin{equation}
  ignored
\end{equation}
```

## 未定义命令

$\unknownMdCmd + x^2$ 应红字，其余仍显示。
