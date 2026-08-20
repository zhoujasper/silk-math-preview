# 架构与性能预算

## 数据流

```text
selection/document event
        │
        ▼
BoundedMathScan ── 编辑与选区热路径只扫有界窗口
        │
        ├── DefinitionWorkspaceIndex（仅依赖文件变化时更新）
        │
        ▼
PreviewScheduler（合并事件、latest-wins、版本去重）
        │
        ▼
lazy Render Worker ── MathJax TeX -> standalone SVG（一次渲染）
        │
        ▼
单一 editor decoration（绝对定位浮层、latest-wins、最后有效帧保留）
```

默认预览路径不在主扩展线程加载 MathJax，也不运行外部进程。Worker 仅在光标进入公式后启动，
空闲后终止。编辑和移动光标始终只解析附近窗口；语言诊断在停输后独立执行，不再额外为预览
重复全文扫描。定义来源按加载顺序批量提交一次，快照只在光标跨过声明/依赖边界时变化。
SVG 通过锚定公式起点的 `before` 伪元素显示，公式范围只提供 `position: relative` 定位上下文；
预览自身使用 `position: absolute` 放在下方或上方，不参与文本流、不撑高源码行，也不改变输入光标基线。
面板背景/前景/边框直接使用 `editorHoverWidget.*` 主题令牌，高对比模式使用 `contrastBorder`；
Light/Dark 只切换一层轻量 CSS 阴影，切换 VS Code 主题时会清空 SVG 缓存并重绘数学前景色。
选区移到当前公式区域外时会在 selection event 中立即清理 decoration，不等待定义快照或
Worker；浮层可见时用 context key 限定 `Esc` 关闭命令，关闭后不吞掉编辑器的其他 Escape 语义。
扫描区域仍覆盖完整 `\begin/\end`；渲染前把不可嵌套的外层 display 环境转为
`aligned/alignedat/gathered` 或直接内容，并移除无视觉作用且会污染 MathJax 状态的
`\label/\notag/\nonumber`。

## 可选 OCR 数据流

```text
右下状态栏 ── 首次明确确认 ── 固定版本/大小/SHA-256 下载
      │
      ▼
系统全屏截图（失败则选择图片）── Webview 原始像素框选
      │
      ├── pix2text-mfr：公式 -> LaTeX -> MathJax 二次预览
      └── PP-OCRv5 通用：多语言文字 -> 可编辑文本
                                      │
                                      └── 用户显式复制 / 插入原编辑光标
```

ORT、模型和图片始终使用本地 Webview URI；CSP 禁止任意网络源。基础 VSIX 不含约 94 MiB 模型。

## 公式光标

源码 cursor offset 先经过轻量 TeX tokenizer 映射到合法 seam。控制序列内部、`\left` 与 delimiter
之间、环境头内部等位置会吸附到最近安全 token 边界。渲染请求注入扩展私有 caret macro；SVG
中的 caret 是约 `0.07em × 1.28em` 的细竖线。返回值同时标记 `exact` 或
`nearest-token-boundary`，避免虚假声称像素级精确。

## 自定义定义

根文件和依赖图识别 `\documentclass`、`\usepackage`、`\RequirePackage`、`\input`、
`\include`。定义分为三级：

1. 已识别：名称和来源可用于补全，避免未知符号误报；
2. 可展开：声明式定义可送入 MathJax 预览；
3. 受限：复杂 TeX 程序只给出说明，不尝试不安全求值。

## 性能预算

| 指标 | 目标 | 硬门/处理 |
|---|---:|---|
| VSIX | `< 2 MB` | `> 2.5 MB` 构建失败 |
| 主扩展 bundle | `< 200 KB` | 禁止包含 MathJax |
| Worker 首次渲染 p95 | `< 180 ms` | 报告实测，不隐瞒失败 |
| 热渲染 p50 / p95 | `< 35 / 80 ms` | 500 字符以内公式 |
| 主线程输入处理 p95 | `< 3 ms` | 增量窗口，不全量工作区扫描 |
| Worker 生命周期 | idle `60 s` | 自动终止 |
| SVG LRU | `64` 项 / `8 MB` | 超限按 LRU 淘汰 |

## 可信边界

不启用 MathJax `autoload`、`require` 或外部图片。仅加载 caret 所需的 TeX `html` 命令集；SVG
返回主线程前会移除脚本、事件、链接、既有 style 节点和非白名单内联样式，并重建受控根属性。
定义 prelude 只写入最多两个受限上下文；每个公式进入 MathJax `begingroupSandbox`，禁用
`\global/\gdef`，公式内临时宏不会污染下一次公式。工作区内容仅作为 TeX 数据解析，不执行
其中代码。
