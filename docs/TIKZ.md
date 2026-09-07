# TikZ / pgfplots 实时图片预览

默认关闭。点状态栏 **Silk Math → TikZ / pgfplots 实时预览**，勾选后把光标
放进图形源码，预览会显示在编辑器的现有浮层中。修改源码后无需保存或手动编译。
也可在设置中搜索 `silkMath.tikz.enabled`；测试通道为 `silkMathTest.tikz.enabled`。
关闭开关不加载引擎、不下载组件；Esc 关闭当前图片。

```tex
\begin{tikzpicture}
\begin{axis}[width=8cm,height=4cm,xlabel={$x$},ylabel={$x^2$},grid=major]
  \addplot[blue,thick,domain=0:2,samples=30]{x^2};
\end{axis}
\end{tikzpicture}
```

首次真正预览图形时下载本地组件，显示可取消的进度。下载固定版本的包并校验 SHA-512，
装好后可离线使用。源码不上传，也不用安装 TeX Live / MiKTeX。组件保存在扩展的
globalStorage 目录，取消或失败的下载不会被当作已安装。下载失败后再次进入图形即可重试。

支持 `.tex`、Markdown（包括 `tikz` 代码块）和 Jupyter 单元格中被启用的语言。
`tikzpicture`、`tikzcd`、`pgfpicture`、`circuitikz` 会作为整体识别，坐标标签中的
`$x$` 不会抢走图形预览。`axis` / `addplot` 自动加载 pgfplots；可使用常见的
`\usetikzlibrary`、`\usepgfplotslibrary`、`\tikzset`、`\pgfplotsset` 和已有自定义宏。

连续输入合并约 80 ms；后台只处理当前请求和最新的等待请求。缺少结束环境时只补
渲染副本，不改文件；其他语法尚未写完时保留该图形的上一张成功图片。单次渲染超过
15 秒会回收 Worker，空闲时间默认 60 秒。缩放沿用菜单中的预览大小设置。
文字转成矢量路径，图片保留白底和原始绘图颜色，不依赖系统字体或联网加载字体。

引擎最多保留一份宏包检查点和一份定义检查点；修改外部 `\def` 时复用已加载宏包。
每帧恢复 WASM 全局、内存及文件状态，图形内的全局定义不会污染下一帧。
检查点共享未变化的内存页，字体缓存最多 16 项；重复文字使用同一份精确矢量轮廓。
普通语法错误保留干净检查点；超时销毁 Worker。
[性能记录与复现方法](TIKZ_PERFORMANCE.md) 列出了实测速度、内存和验证范围。

插件附带 **pgfplots 1.18.3** 完整宏源码，默认兼容级别 **1.18**，支持显式
`compat=1.16`、`1.17`、`1.18` 和 `newest`。升级插件后会覆盖内存中的旧宏包，
原有 WASM 缓存可直接复用，不需要清缓存或重新下载。源码压缩包约 704 KiB，
仅在 TikZ Worker 中读取，普通公式不加载它。

支持 `groupplots`、`fillbetween`、`statistics`、`dateplot`、`patchplots`、`polar`、
`ternary`、`smithchart` 等已分发绘图库；专用坐标环境会按需加载对应库。
库和带选项的宏包放在 LaTeX 导言区加载；保留显式兼容级别、旧式 `\tikzstyle`、
自定义数学函数及内存数据表。渐变、纹理、透明度和裁剪保留在自包含 SVG 内。
曲面仅含颜色继承的深层分组会被压平，避免复杂 SVG 超过图像读取器的嵌套限制。
曲线交点计算提前释放递归参数帧，保留 PGF 原有运算、精度和结果顺序。

范围与限制：这仍不是完整 TeX Live。shell、LuaTeX、外部图片/数据读取、gnuplot、
任意额外 CTAN 包及 CJK 字体不在当前运行环境内；SVG 驱动未实现的功能（例如
`path fading`）会明确报错。编译错误、缺字、缺少 SVG 定义均不会当作完整图片返回。
图形之前的原生声明按源码顺序继承，包含 `\def` / `\gdef` / `\edef` / `\xdef`、
`\let`、带定界参数的宏、`\newcommand` / `\renewcommand`、绘图样式和常用条件分支。
保留分组作用域；定义本体不会提前执行，图形之后的重定义不会影响当前图形。
本地 `.sty/.cls/.tex` 依赖及未保存的缓冲区可提供声明；导言区不再截断在 128,000 字符，
当前文件前缀上限 8 MiB，提取并展开后的上下文与图片源码合计上限 200,000 字符。
动态图形可执行真实 TeX；导言区提取不等同于运行整份文档，高级 catcode、动态依赖、
执行宏来生成新的声明等写法仍有边界。

简写 `\tikz ...` 请改成完整的 `tikzpicture` 环境。默认单个图形上限与公式相同，
为 20,000 字符。首次初始化和复杂图形会比普通公式慢。

可直接打开 [手动示例](../test/fixtures/manual/tikz.tex) 验收；开发验证使用
`npm run build && npm run validate:tikz`，压力测试使用 `npm run stress:tikz`，
均不启动浏览器或 Extension Host。具体时延随图形复杂度与运行环境变化，复杂图并不保证瞬时完成。
第三方组件与对应源码见 [许可说明](../resources/TIKZ_THIRD_PARTY_NOTICES.md)。

## English

Enable **Silk Math → TikZ / pgfplots live preview** (off by default), then place
the caret anywhere in a picture. Unsaved edits update its SVG in the existing
editor overlay. The first picture downloads a verified local WASM runtime;
later previews work offline without installing LaTeX. The example above loads
pgfplots automatically. Incomplete edits retain the last successful image.

The extension bundles the complete pgfplots 1.18.3 macro sources, with compatibility
level 1.18 and the distributed plot libraries, independently of the cached WASM runtime.
Explicit older compatibility levels are preserved. It is a limited local TeX runtime,
not a full TeX distribution. External files, shell escape, LuaTeX and arbitrary
CTAN packages are unavailable. Native declarations keep their order and group scope,
including definitions from unsaved local dependencies. Package/context checkpoints
avoid recompiling pgfplots on every edit, and all mutable TeX state is restored
before each frame. Complex pictures can take longer than formulas.

Implementation references: [Node-TikZJax](https://github.com/prinsss/node-tikzjax),
[PGF/TikZ](https://github.com/pgf-tikz/pgf), [pgfplots](https://github.com/pgf-tikz/pgfplots).
