# 可滚动公式浮层与预览 CSS / Scrollable preview and CSS（0.3.4）

## 中文

公式仍显示在编辑器内的浮层中。过宽或过高时保留字号，超出窗口的内容可以左右、上下滚动，
不再为了放下全貌而缩小整张图片。行间公式（`$$…$$`、`\[…\]`、独立数学环境）比以前小 15%；
行内 `$…$`、`\(…\)` 保持原字号，表格和 TikZ 保留各自的缩放比例。

### 滚动与编辑位置

- 连续输入时保留当前浮层和上一张有效图片，新图完成后直接更新，不逐字关闭再打开。
  编辑器失焦、离开公式或按 Esc 仍按原规则关闭；手动滚动后再次编辑会定位到新的光标附近。
- 打开预览、编辑公式或移动源码光标时，先显示公式中对应光标的周围内容，两个方向都参与定位。
  当前公式没有可安全显示的光标（例如宏的结构参数、关闭预览光标或 TikZ）时按源码位置近似定位。
- 首次定位后即可自由滚动；鼠标滚轮或触控板查看纵向内容，横向手势或拖动底部滑块查看左右内容。
  手动位置保留到下一次编辑或源码光标移动。滚动只改变预览视窗，不修改公式或移动源码光标。
- 滑块宽 `5px`，操作轨道宽 `8px`，采用主题颜色和圆角，悬停、拖动时加强反馈。
  只有对应方向溢出时才需要滚动条。浮层最大尺寸默认 `960×500px`，还会根据编辑器真实可见区域限制。
- 宽度超过 `640px` 或高度超过编辑器 8 行时，自动在编辑行上方或下方选择空间，优先避开编辑位置。
  这时光标避让优先于 CSS 中的公式/选区基准、方向、间隔和偏移；自定义字号、外观及宽高上限继续生效。
  高度限制最多约为编辑器可见区域的一半，并为编辑行留出空间，不依赖文件后有多少空行。
- 光标滚出可见区域时收起浮层；回到可见区域时可恢复。离开公式或按 `Esc` 立即清除预览；浮层获得焦点时 Esc 仍有效，两个通道同一编辑位置的迟到结果不会重新弹出。
- 使用 VS Code 原生悬浮组件接收鼠标操作。两个通道同时为同一编辑器提供预览时，测试版优先使用这个浮层；
  关闭测试版预览后可显示正式版。两份设置、文件排除和快捷键仍独立。

### 复制白底黑字 PNG

点击浮层右上角的 **复制白底黑字 PNG**，会在后台复制完整公式，包括滚动窗口外的内容。
导出图固定白色不透明背景、黑色公式，不带编辑光标、浮层边框、阴影和滚动条；不改变屏幕预览主题。
默认按 2 倍像素导出，四边各留 4px 白边；超大图等比限制到最长边 8192px、总计 1600 万像素，不裁切公式。

不会打开额外页面或切换编辑器。仅剪贴板写入成功后，原按钮的复制图标淡出，绿色勾轻微放大出现；
约 1.6 秒后恢复复制图标。失败、取消或已切换公式不显示误导性的勾；系统减少动态效果时直接切换。
普通预览不加载 PNG 栅格化器，每次复制的后台 Worker 完成后立即释放。

Windows/macOS 使用系统自带剪贴板接口。Linux 的 Wayland 会话需要 `wl-copy`（wl-clipboard），
X11 会话需要 `xclip`；缺少工具时明确提示失败，不会擅自安装或复制文本代替图片。
远程工作区需让扩展运行在本地 UI 扩展宿主，才能写入当前电脑的剪贴板；清单优先使用本地 UI 宿主。

### 编辑 CSS

点击右下角 **Silk Math → 编辑预览 CSS…**。在原生编辑标签中修改，按 Ctrl+S / Cmd+S 生效；
清空并保存恢复默认。无需在工作区创建文件。设置保存在 `silkMath.previewCss`，测试版使用
`silkMathTest.previewCss`。返回公式即可看到修改。

编辑页提供参数补全、悬停说明与注释示例。旧 CSS 可点击首行上方的 **参数说明与示例 / Guide & examples**
补充全部中英说明，已有生效值不会改变。下面的例子缩小滚动窗口，不会压缩公式字号：

```css
.silk-math-preview {
  max-width: 640px;
  max-height: 280px;
  padding: 4px 8px;
  border-radius: 6px;
  background-color: var(--vscode-editorHoverWidget-background);
}
```

### 全部参数

| 参数 | 可用值与默认行为 |
| --- | --- |
| `--silk-anchor` | `formula`（默认）/ `cursor` / `selection`。短公式的定位基准；空选区按光标处理。长宽公式优先跟随编辑行。 |
| `--silk-placement` | `above` / `below` / `right`。短公式指定方向，未设置时沿用菜单偏好；标准浮层和长宽公式可自动选择光标上下的空间。 |
| `--silk-gap` | `0–20lh` / `0–1000px`。短公式与基准边缘的间隔，默认 2px；1lh 为编辑器一行高度。编辑光标仍有保护间隔。 |
| `--silk-allow-overlap` | `false` / `true`。短公式是否可以覆盖其他源码；高级定位默认 false。true 也不能覆盖当前编辑光标；长公式优先光标避让。 |
| `font-size` | `6–96px` / `25–400%`。公式字号；默认跟随菜单缩放，100% 保持当前默认尺寸。行间公式已包含 0.85 的比例；TikZ 缩放整图。 |
| `--silk-offset-x` | `-2000px–2000px`，默认 0px。短公式水平偏移，负值向左。受编辑器边界及光标避让限制。 |
| `--silk-offset-y` | `-2000px–2000px`，默认 0px。短公式垂直偏移，负值向上。受编辑器边界及光标避让限制。 |
| `max-width` | 正数 px 或 %，数值最多 10000；% 相对编辑器内容视口。默认上限 960px，并受真实视口限制。约束滚动窗口，不缩小公式。 |
| `max-height` | 正数，最多 10000px。默认上限 500px，并受视口可用高度限制。约束滚动窗口，不缩小公式。 |
| `background-color` | 默认 `var(--vscode-editorHoverWidget-background)`。支持十六进制、rgb/rgba 等颜色和主题变量，不改变公式文字颜色。 |
| `border` | 默认无；`none`、`0` 或如 `1px solid #888`。宽度 0–8px，支持 solid/dashed/dotted/double。高对比主题另有主题轮廓。 |
| `border-color` | 修改已有边框颜色，先用 border 指定宽度及样式。 |
| `border-radius` | 默认 6px，0px 为直角。 |
| `padding` | 默认 `4px 8px`。每边 0–24px；1 值为四边，2 值为上下/左右，3 值为上/左右/下，4 值为上/右/下/左。 |
| `box-shadow` | 默认柔和阴影，可用 `none` 或如 `0px 2px 8px #000`。 |
| `opacity` | 默认 0.98，范围 0–1；0 完全透明，1 完全不透明。 |

短公式的高级例子：

```css
.silk-math-preview {
  --silk-anchor: cursor;
  --silk-placement: above;
  --silk-gap: 1lh;
  --silk-allow-overlap: true;
  font-size: 110%;
}
```

开启软换行且禁止覆盖整块源码时，右侧定位保守地退回下方；超过 256 个可见逻辑行亦如此。
短公式的自定义方向完全没有空间，或间隔过大时，窗口可能无法显示；请减小间隔或清空定位设置。
长宽公式不采用这种强制方向，会优先在当前编辑行上下显示可滚动区域。

只支持 `.silk-math-preview { … }` 或直接声明列表，总长度最多 8192 字符。
不支持其他选择器、外链、脚本以及 `position`、`left`、`top`、`transform` 等属性。
编辑标签遇到无效声明时不保存，保留旧设置；直接修改设置 JSON 填入无效 CSS 时提示并回退默认。

### 兼容与核验边界

浮层使用公开 Hover API、短 Markdown 透明占位图以及仅匹配本扩展图片的样式。完整 SVG 由样式绘制，
避开宿主对 Markdown 的 100000 字符截断，不增加磁盘读写；不修改 VS Code 安装文件，
不注入工作台脚本、不轮询 DOM、不回写用户文档。源码标记和 SVG 中已有的光标提供定位信息；
首次布局采用短暂的 CSS 滚动吸附，随后解除，避免干扰手动滚动。

最低 VS Code 版本保持 1.95。衍生编辑器仍需兼容的 Chromium CSS 和 Monaco 悬浮结构。
原生 hover 的显示时机、无障碍焦点及系统滚动设置由宿主管理；第三方扩展也可能主动替换该悬浮组件。
特别复杂的公式仍受原有 2 MiB SVG 及输入资源限制，不将超限当作成功显示。

0.3.2 已修复用可见源码行数估算高度导致 EOF 缩小的问题。0.3.3 进一步改为真实滚动窗口，
不再依赖以前的伪元素背景图缩放或 Notebook 图片占位路径。

本机核验使用真实 Worker、扩展 API 夹具及已安装 Chrome 的原生悬浮结构组件，检查横纵定位、手动滚动、
窄视口、空源码标记、关闭/过期请求及双通道调度。组件中的鼠标模型为宿主接口夹具；没有启动新的
Extension Host，不能替代用户实际 VS Code、其他衍生编辑器及 Windows/Linux 的最终交互验收。

## English

Formulas remain in a floating editor preview. Wide or tall formulas retain their font size and scroll in both
axes instead of shrinking the full image. Display math (`$$…$$`, `\[…\]`, standalone math environments)
is 15% smaller than before. Inline `$…$` and `\(…\)` keep their previous size; tables and TikZ retain their own scales.

### Scrolling and the editing position

- While typing, retain the current hover and its last valid image, then update it when the new render is ready,
  without closing and reopening it for every character. Losing editor focus, leaving the formula, and Esc still
  dismiss the preview; editing again after manual scrolling reveals the new caret position.
- Opening, editing, or moving the source caret initially shows the surroundings of the rendered math caret in both axes.
  If no safe rendered caret is available, including structural macro arguments, hidden preview carets, or TikZ,
  positioning falls back to an approximate source position.
- Initial positioning releases its snap constraint. Use a wheel or trackpad vertically, and a horizontal gesture or the
  bottom scrollbar horizontally. Manual scrolling persists until the next edit or source-caret move; it changes neither
  the source formula nor the editor caret.
- Scroll thumbs are 5px wide with 8px interaction tracks, rounded corners, theme colors, and hover/drag feedback.
  Only overflowing axes need scrollbars. The default maximum is 960×500px, further constrained by the actual editor viewport.
- Formulas wider than 640px or taller than 8 editor lines choose space above or below the editing line, keeping the editing
  position clear. This takes priority over custom source/selection anchors, placement, gaps, and offsets; font size,
  appearance, and size caps still apply. Height is capped at roughly half the viewport with room reserved for editing,
  independently of trailing blank lines.
- Scrolling the source caret out of view hides the preview; bringing it back can restore it. Leaving the formula or
  pressing Esc clears the preview immediately, including while the hover has focus, and prevents late results from either channel at the same editing position from reopening it.
- VS Code's native hover receives mouse interactions. When both channels provide previews in the same editor, the test
  build takes priority in the shared floating window. Disabling its preview allows the release preview to appear.
  Settings, exclusions, and shortcuts remain separate.

### Copying a PNG with black ink on white

Click **Copy PNG (black on white)** at the upper right to copy the complete formula in the background,
including scrolled-out content. The export has a solid white background and black formula ink, without the
editing caret, floating border, shadow, or scrollbars; the on-screen preview theme stays unchanged.
The default is 2× pixel density with 4px white margins. Oversized images scale proportionally within 8192px
per edge and 16 million pixels, without cropping.

No extra page opens and the editor keeps focus. Only after the clipboard write succeeds does the copy icon
fade into a gently scaling green checkmark, then return after 1.6 seconds. Failure, cancellation, or switching
formulas never produces a misleading checkmark. Reduced-motion settings disable the transition.
Ordinary preview does not load the PNG rasterizer; each copy Worker is released immediately after finishing.

Windows/macOS use built-in system clipboard interfaces. Linux requires `wl-copy` (wl-clipboard) for Wayland
or `xclip` for X11. Missing tools produce an explicit error; they are not installed automatically, and source
text is never substituted for an image. In remote workspaces, run the extension in the local UI extension
host to write the current computer’s clipboard; the manifest prefers that host.

### Editing CSS

Choose **Silk Math → Edit preview CSS…**, edit in the native editor tab, and save with Ctrl+S / Cmd+S.
Clear and save to reset. No workspace file is created. Settings use `silkMath.previewCss`, or
`silkMathTest.previewCss` for the test build. Return to a formula to see the result.

The editor offers completion, hover help, and commented examples. **Guide & examples** above the first line
adds all Chinese/English explanations to older CSS without changing active values. The first example above
limits the scroll viewport to 640×280px without reducing math font size.

### All options

| Option | Values and default behavior |
| --- | --- |
| `--silk-anchor` | `formula` (default), `cursor`, or `selection`; empty selections use the caret. Applies to short formulas; oversized formulas follow the editing line. |
| `--silk-placement` | `above`, `below`, or `right` for short formulas; menu preference when unset. Standard and oversized previews may choose space above/below the caret. |
| `--silk-gap` | `0–20lh` or `0–1000px`; default 2px for short formulas. 1lh is one editor line. The editing caret retains a protective gap. |
| `--silk-allow-overlap` | `false` or `true`; advanced short-formula positioning defaults to false. Allows overlap with other source text, never the editing caret; oversized formulas prioritize caret avoidance. |
| `font-size` | `6–96px` or `25–400%`; follows menu scaling by default. 100% keeps the current default, including the 0.85 display-math factor. Scales the whole TikZ image. |
| `--silk-offset-x` | `-2000px–2000px`, default 0px; negative moves short formulas left. Editor bounds and caret avoidance still apply. |
| `--silk-offset-y` | `-2000px–2000px`, default 0px; negative moves short formulas up. Editor bounds and caret avoidance still apply. |
| `max-width` | Positive px or %, numeric value up to 10000; % refers to the editor content viewport. Default cap 960px plus viewport constraints. Limits the scroll window, not the formula font size. |
| `max-height` | Positive px up to 10000; default cap 500px plus available viewport height. Limits the scroll window, not the formula font size. |
| `background-color` | Editor hover theme by default; hex, rgb/rgba, other supported color functions and theme variables. Does not change math ink. |
| `border` | None by default; `none`, `0`, or e.g. `1px solid #888`; 0–8px, solid/dashed/dotted/double. High-contrast themes also have a themed outline. |
| `border-color` | Color for an existing border; first set its width/style with border. |
| `border-radius` | Default 6px; 0px gives square corners. |
| `padding` | Default `4px 8px`; each side 0–24px. Shorthand: all; vertical/horizontal; top/horizontal/bottom; top/right/bottom/left. |
| `box-shadow` | Soft shadow by default; `none` or e.g. `0px 2px 8px #000`. |
| `opacity` | Default 0.98; range 0–1, from fully transparent to opaque. |

The second example places a short formula above the caret, allowing overlap with other source lines, with
110% font size. With wrapping and source-overlap protection, right placement conservatively falls back
below, also when more than 256 logical lines are visible. A forced short-formula direction or excessive
gap can leave no display space; reduce the gap or reset positioning. Oversized formulas instead choose
space around the current editing line for their scroll viewport.

Only `.silk-math-preview { … }` or a declaration list is accepted, up to 8192 characters. Other selectors,
external resources, scripts, `position`, `left`, `top`, and `transform` are unsupported. Invalid editor-tab
CSS is not saved; invalid settings JSON triggers a notice and falls back to defaults.

### Compatibility and verification limits

The preview uses the public Hover API, short transparent Markdown image placeholders, and styles scoped to this extension's images.
The full SVG is drawn by those styles, avoiding the host's 100,000-character Markdown truncation without disk I/O.
It does not modify installed workbench files, inject workbench scripts, poll the DOM, or edit user documents.
Source markers and existing SVG carets supply positioning. Brief CSS snapping handles initial layout and
then releases manual scrolling.

VS Code 1.95 remains the minimum version. Derivatives need compatible Chromium CSS and Monaco hover structure.
The host manages hover timing, accessibility focus, and system scrolling preferences; another extension may
actively replace the shared hover. Existing 2 MiB SVG and input resource limits still apply to complex formulas.

Version 0.3.2 removed EOF height estimates based on visible source-line counts. Version 0.3.3 uses a true
scroll viewport instead of the old pseudo-element background scaling and Notebook image spacer path.

Local verification uses real Workers, an extension API fixture, and a native-hover DOM/CSS component in
installed Chrome. It covers both coordinates, manual scrolling, narrow viewports, absent source-marker DOM,
dismissal/stale requests, and channel coordination. Mouse handling in the component uses a host-interface
fixture. No new Extension Host was launched; these checks do not replace acceptance in the user's actual
VS Code, its derivatives, or Windows/Linux.
