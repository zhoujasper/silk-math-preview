# 预览 CSS 与高级定位（0.2.7）

点击右下角 **Silk Math → 编辑预览 CSS…**。打开的 `preview.css` 是可编辑的原生 CSS 标签，
支持语法高亮、撤销和 Ctrl+S / Cmd+S。保存后生效；清空并保存恢复默认。首次打开带注释示例，
不会改动工作区文件。样式保存在用户设置 `silkMath.previewCss`；测试通道使用
`silkMathTest.previewCss` 和独立的编辑 URI。关闭 CSS 标签后，回到公式即可看到修改。

已有旧版 CSS 时，点击编辑页首行上方的 **参数说明与示例 / Guide & examples** 可补充全部参数的
中英双语说明和使用示例，原设置保持有效。取消需要使用的选项的注释再修改。输入 `--silk-` 或手动触发补全
可查看参数；冒号后可补全值；悬停参数名查看范围和默认行为。

## 定位和字号

```css
.silk-math-preview {
  --silk-anchor: cursor;
  --silk-placement: below;
  --silk-gap: 1lh;
  font-size: 24px;
  --silk-offset-x: -40px;
  --silk-offset-y: 0px;
  --silk-allow-overlap: false;
}
```

| 参数 | 可用值 | 含义 |
| --- | --- | --- |
| `--silk-anchor` | `formula` / `cursor` / `selection` | 整块公式 / 光标所在行与列 / 选区；空选区按光标处理。默认 formula。 |
| `--silk-placement` | `above` / `below` / `right` | 基准的上方、下方或右侧；未设置时沿用菜单方向。 |
| `--silk-gap` | `0–20lh` / `0–1000px` | 到基准边缘的距离；1lh 是编辑器一行的真实高度，与预览字号无关。默认 2px。 |
| `font-size` | `6–96px` / `25–400%` | 缩放实际矢量图片；百分比相对菜单缩放后的原预览。尺寸仍受可用空间限制。 |
| `--silk-offset-x` | `-2000px–2000px` | 负值向左，正值向右，默认 0px。 |
| `--silk-offset-y` | `-2000px–2000px` | 负值向上，正值向下，默认 0px。 |
| `--silk-allow-overlap` | `false` / `true` | 是否允许覆盖整块源码公式。启用高级定位时默认 false；未配置高级定位时保留旧版允许限位覆盖的行为。 |

例如 `formula + above + 2lh` 表示放在整块公式上方、间隔两行；`selection + below` 放在选区
下方。`cursor + below + true` 可紧跟当前行；`cursor + below + false` 仍按光标横坐标定位，
但纵向会让开**整块**源码公式。禁止覆盖时，负向偏移也不能把它推回公式上。

右侧按各行最右边的实际字形定位。开启软换行且禁止覆盖时，公开编辑器 API 无法给出所有
视觉折行的右边界，因此保守地改在下方显示；超过 256 个可见逻辑行也采用这一回退。
空间不足时完整图片等比例缩小，外框可能留白；指定方向完全没有可用空间时不显示图片。
过大的间隔也可能耗尽空间，可以减小间隔或换方向。TikZ 的字号选项缩放整张矢量图，
不改写图内节点字体。高级定位没有新增固定在编辑器左上角的模式。

## 外观

默认 `padding: 4px 8px`（上下 4px、左右 8px），`border-radius: 6px`。
两项均可在 CSS 中覆盖；内边距和边框加在公式外侧，空间足够时不会挤小公式。
`padding` 的 1 / 2 / 3 / 4 值分别表示四边 / 上下、左右 / 上、左右、下 / 上、右、下、左。
例如 `padding: 2px 4px 6px 8px` 表示上 2px、右 4px、下 6px、左 8px。

Default padding is `4px 8px` (4px vertical, 8px horizontal), with a `6px` corner radius.
Override `padding` and `border-radius` in CSS. Padding and borders add outside the formula
without shrinking it when space permits. Padding shorthand accepts 1–4 values: all sides;
vertical/horizontal; top/horizontal/bottom; or top/right/bottom/left.


```css
.silk-math-preview {
  --silk-offset-x: -60px;
  --silk-offset-y: -8px;
  max-width: 640px;
  max-height: 320px;
  background-color: var(--vscode-editorHoverWidget-background);
  border: 1px solid var(--vscode-editorHoverWidget-border);
  border-radius: 6px;
  padding: 4px 8px;
  opacity: 0.98;
}
```

横向偏移负值向左、正值向右；纵向负值向上、正值向下。偏移仍限制在当前编辑器内。
`max-width` 可用 px 或当前内容视口宽度的百分比，`max-height` 用 px；它们是上限，不强制放大图片。
外观还支持 `border-color`、`box-shadow`。每边 padding 为 0–24px，边框宽度为 0–8px；
边框可以是 `none`、`0` 或 `1px solid #888` 等写法。偏移范围 ±2000px，整个 CSS 最多 8192 字符。
主题变量、常用颜色函数可用。样式作用于外框，SVG 里的公式颜色仍跟随编辑器主题。

只接受 `.silk-math-preview { … }` 或直接的声明列表，不支持其他选择器、外链、脚本、
`position` / `left` / `top` / `transform` 等绕过边界的属性。原生编辑页发现不支持的声明会拒绝保存，
保留上一份生效设置；直接在设置 JSON 中填入无效 CSS 时显示提示并回退默认外观。

## 遮挡原因与修复

反馈截图只有问题描述，没有实际窗口布局，因此下列结论来自代码与宿主实现分析，
不是对用户双屏机器的现场复现。

1. **内部左右分屏 / PDF Webview**：旧实现默认按 `120 × 字号 × 0.6` 估宽，且最少 480px；
   字号 14 时约为 1008px。实际左侧内容区若只有 360px，预览仍可能被放到更右侧，最终被
   编辑器裁掉或落入相邻 PDF 所在区域。`wordWrapColumn` 同样只描述换行规则，不能作为窗口宽度。
2. **长行、水平滚动和窄分屏**：Monaco 的 `.view-lines` / `.view-line` 按 `scrollWidth` 布局，
   `lines-content` 会随水平滚动移动，并有 `contain: strict`；所以单用 `max-width: 100%`
   或更大的 `z-index` 不能准确表示内容视口，也不能跨过祖先的裁剪。
3. **只改变可见高度**：旧 decoration 签名没有包含 `boxHeightPx`，有时会复用不合适的旧高度。
4. **独立系统 PDF 窗口压在 VS Code 上方**：属于系统窗口层级，扩展 CSS 无法覆盖另一个应用。
   本次处理的是预览越过当前编辑器边界造成的遮挡，不能承诺消除系统窗口本身的重叠。

现在为含本扩展 decoration 的 Monaco 内容视口和源码边缘的零宽标记注册按通道区分的 anchor，
图片放在 `overflow-guard` 的覆盖层伪元素内。覆盖层的包含块与内容视口同级，浏览器才能
引用完整视口和不同源码行；行内伪元素直接引用祖先包含块或其他绝对定位行会失效。
`anchor()` 计算位置，`anchor-size()` 限制尺寸；可用空间由四边 inset 划定，背景图片使用
`contain` 保持比例，预留 4px 视口边缘。正式与测试通道使用不同伪元素、源码名和设置。
不修改工作台文件、源码或其他编辑器布局，不注入页面脚本，不轮询或重复请求渲染。

VS Code 1.95 升级到 Chromium 128，提供本方案使用的 CSS 嵌套、`:has()` 和锚点定位支持；
因此安装包最低版本设为 1.95。VS Code 衍生编辑器还需要相应的 Chromium CSS 支持和 Monaco DOM 结构。

### 0.2.4：短结束行与未保存文件

当视口 anchor 无法解析时，之前的 `anchor-size(... width, 100%)` 会回退到预览的定位包含块。
VS Code 的 `.view-line > span` 是绝对定位的文字容器，短结束行（例如 `\]`）的宽度并非编辑器宽度。
这会把正常 SVG 缩得几乎看不见；`anchor(... right/bottom, 100%)` 也可能让浮层退回到结束行内。
现在宽度和边界回退采用已知图片尺寸与原定落点，保留上方/下方偏好；真实视口 anchor 可用时仍使用它限位。
无法获得真实视口的回退路径只保证正常图片尺寸和落点，窄分屏的精确边界仍依赖有效 anchor。

「其他文件类型」原本已允许未保存纯文本按 LaTeX 扫描，不要求先另存为 `.tex`。
本次补充真实状态栏策略到预览控制器的三行数组测试、即时开关测试，以及短文字容器的 CSS 回退计算；
重建截图可见内容后通过独立 Worker 输出可绘制 SVG。未启动图形界面，用户截图完整公式和实机布局仍需最终验收。

实现依据：[VS Code 1.95 Electron 更新](https://code.visualstudio.com/updates/v1_95#_electron-32-update)、
[Chrome CSS anchor API](https://developer.chrome.com/docs/css-ui/anchor-positioning-api)、
[Monaco viewLines 实现](https://github.com/microsoft/vscode/blob/main/src/vs/editor/browser/viewParts/viewLines/viewLines.ts)、
[VS Code decoration CSS 生成](https://github.com/microsoft/vscode/blob/main/src/vs/editor/browser/services/abstractCodeEditorService.ts)。

验证覆盖全部参数的解析、保存/恢复/失败、补全与说明、示例插入、光标/选区/公式锚点、
空行、UTF-16 代理对、可见范围变化和清理、字号和定位复用缓存、双通道安装包。
用户要求严格测试后，额外使用本机 Chrome 无头模式，在包含 Monaco 的绝对定位、
`contain: strict`、短源码 span 和相邻 PDF 面板的夹具里测量实际布局，覆盖方向、组合、
防覆盖、字号、外观、尺寸限制、极端偏移、滚动和窄分屏，并检查截图及控制台。
未打开浏览器窗口或 Extension Host；这是浏览器布局与扩展 API 回归，不能代替所有
VS Code 版本、Windows/Linux 以及用户双屏设备上的实机验收。

最终验证：40 个测试文件、519 项测试；包内编辑模块 318 项断言、包内布局模块 305 项 Chrome 无头断言均通过。两个通道的 ZIP、清单、默认开关、构建字节和 15 份 GPL 对应源码核对通过。
