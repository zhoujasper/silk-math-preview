# 开发计划

1. `[完成] core-scan`：公式区域、有界热路径、TeX token seam、诊断与修复；核心覆盖率 ≥90%。
2. `[完成] definitions`：`.tex/.sty/.cls` 依赖、声明式定义索引、Markdown 宏、自定义补全/环境。
3. `[完成] render-worker`：懒加载单次 TeX→SVG、latest-wins、LRU、SVG 清理和性能基准。
4. `[完成] vscode-adapter`：事件合并、selection/document 同步、单 decoration、Completion、
   Diagnostic、CodeAction。
5. `[完成] optional-ocr`：状态栏入口、明确按需下载、本地截图框选、公式/通用多语言文字识别、复制/插入。
6. `[完成] release-gates`：typecheck、unit/coverage、Worker smoke、benchmark、VSIX 体积和跨平台静态检查。
