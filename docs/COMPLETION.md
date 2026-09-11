# 数学补全 / Math completion

## 排除文件规则与当前文件 / File exclusion rules and individual files

从 0.2.16 起，点击底部 **Silk Math → 编辑文件排除规则…**，直接进入规则编辑菜单。点击“添加预览排除规则…”或“添加补全排除规则…”，输入 `*.tex`、文件名或路径并确认；空列表也始终显示这两个入口。点击已有规则可修改，清空后确认即可删除。新规则默认保存到用户设置；“新规则保存到”可切换用户、工作区、文件夹或当前语言范围。已有规则标明保存范围，并在原范围内编辑；上层规则可能被更具体的范围覆盖。测试版入口叫 **Silk Math Test**，配置前缀为 `silkMathTest`。

Since 0.2.16, **Silk Math → Edit file exclusion rules…** opens a direct rule menu. Choose **Add Preview exclusion…** or **Add Completion exclusion…**, enter `*.tex`, a filename or path, and confirm. These actions remain visible when no rules exist. Select an existing rule to edit it, or clear its value and confirm to delete it. New rules default to User settings; **Save new rules to** selects User, Workspace, Folder, or a current-language override. Existing rules display their scope and are edited there; more specific scopes can override broader ones. The test build uses **Silk Math Test** and the `silkMathTest` prefix.

| 规则 / Rule | 作用 / Effect |
| --- | --- |
| `*.tex` | 所有目录中的 TeX 文件 / TeX files in every directory |
| `notes.tex` | 任意目录中的同名文件 / That filename in any directory |
| `./notes.tex` | 工作区文件夹根目录下的文件 / That file at the workspace folder root |
| `chapters/draft.tex` | 相对于工作区文件夹的指定文件 / One path relative to the workspace folder |
| `/Users/me/paper/draft.tex` | 该绝对路径对应的文件 / Only that absolute path |
| `C:/paper/draft.tex` | Windows 的绝对路径 / An absolute Windows path |
| `chapters/*.tex` | 指定目录中直接包含的 TeX 文件 / TeX files directly in that directory |
| `chapters/**/*.tex` | 该目录及所有子目录的 TeX 文件 / TeX files there and in all subdirectories |

规则不区分大小写。`*` 匹配文件名中的任意字符，`?` 匹配一个字符，整段 `**` 匹配任意层级目录。不支持 `!` 反向规则或花括号展开；其他字符按字面匹配。路径可用 `/` 或 `\`；在 JSON 中写 Windows 反斜杠需要写成 `\\`，使用 `/` 更方便。没有打开工作区文件夹时，使用文件名或绝对路径。

Patterns are case-insensitive. `*` matches any characters within a filename, `?` matches one character, and a whole-segment `**` matches any directory depth. Negation with `!` and brace expansion are not supported; other characters are literal. Paths accept `/` or `\`; JSON needs `\\` for a literal backslash, so `/` is easier. Without an open workspace folder, use a filename or absolute path.

例如，下列配置关闭 Markdown 文件的预览，并关闭全部 TeX 文件和指定笔记的数学补全：

For example, this configuration disables preview for Markdown files, and math completion for all TeX files plus one named note:

```json
{
  "silkMath.preview.excludeFiles": ["*.md"],
  "silkMath.completion.excludeFiles": ["*.tex", "private-notes.md"]
}
```

- 原有 `preview.excludeFileTypes` 和 `completion.excludeFileTypes` 继续生效，可写扩展名（`.tex`、`tex`、`*.tex`）或语言 ID（`latex`、`markdown`）；这些旧设置仅支持类型，不支持路径。当前文档有此类设置时，编辑入口也会显示它们，避免遗漏仍在生效的规则。未保存文件可按语言排除，保存新路径后重新判断。
- Notebook 单元格按所属 `.ipynb` 文件匹配，当前文件按钮也作用于整个 Notebook。
- **当前文件**下保留三个操作：**排除当前文件的预览**、**排除当前文件的补全**、**排除当前文件的预览和补全**。再次点击对应的“恢复”操作可取消。只排除一项时，“两者”操作会全部排除；都已排除时则一起恢复。
- 单文件按钮的记录保存在 VS Code 当前工作区的本地状态中，不创建项目配置文件。菜单显示“恢复”表示该文件已被按钮规则排除，与普通设置中的默认值无关；旧版记录继续只影响预览。文件名/路径列表则保存在你选定范围的 VS Code 设置中。
- 恢复单文件不会覆盖列表规则、预览开关或 `completion.mode`；菜单会显示仍在排除文件的具体规则。若仍被列表排除，从编辑入口删除对应规则。补全排除同时禁止自动与手动的 Silk 候选，不影响其他扩展、CSS 补全或显式 Quick Fix。

- Existing `preview.excludeFileTypes` and `completion.excludeFileTypes` still accept extensions (`.tex`, `tex`, `*.tex`) or language IDs (`latex`, `markdown`). These older settings accept types, not paths. When configured for the active document, the editing entry also shows them so that active rules remain discoverable. Untitled files can be excluded by language; saving under a new path updates the policy.
- Notebook cells use their parent `.ipynb` file for patterns and current-file actions.
- **This file** retains separate **Exclude preview**, **Exclude completion**, and **Exclude preview and completion** actions. Use the corresponding Restore action to undo one. If only one feature is excluded, the combined action excludes both; if both are excluded, it restores both.
- Current-file actions are stored locally in VS Code's workspace state, without creating project settings. A Restore action means that the file has a stored button exclusion, regardless of default settings. Old records remain preview-only. Filename/path lists are stored in VS Code settings at your chosen scope.
- Restoring a file does not override list rules, preview switches, or `completion.mode`. The menu identifies a rule that still excludes the file; remove it through the editing entry if needed. Completion exclusions block both automatic and manual Silk candidates, leaving other extensions, CSS completion, and explicit Quick Fixes.

## 修改截图及其他操作的快捷键 / Customize capture and other shortcuts

点击 **Silk Math → 修改各项快捷键…**，选择“截图识别公式或文字”“识别图片”“放大预览”等操作。随后会打开 VS Code 的“键盘快捷方式”，准确定位该命令；双击快捷键列即可修改，未绑定的操作也可添加按键。也可以直接从命令面板运行 **Silk Math: 修改各项快捷键 / Configure All Keyboard Shortcuts**。

所有公开操作都有命令名称和独立命令 ID。预览开关、截图、剪贴板识图、选择图片、缩放、排除文件以及暂停 5 分钟、暂停 30 分钟和结束暂停均可单独绑定。保留已有默认键位和用户自定义配置；“关闭当前预览”只在预览显示时生效，Silk 数学补全触发仍仅限 `manual`。编辑器中识别剪贴板图片和识图菜单内粘贴默认使用同一命令的两个不同条件绑定，修改时可分别选择对应的一行。

Choose **Silk Math → All keyboard shortcuts…**, then select capture, image recognition, preview size, or another action. VS Code’s Keyboard Shortcuts opens to that exact command. Double-click its keybinding column to change the keys, or assign a shortcut to an unbound action. The Command Palette also provides **Silk Math: Configure All Keyboard Shortcuts**.

Every public action has a command title and ID. You can bind preview toggling, capture, clipboard recognition, image selection, scaling, file exclusions, separate 5- and 30-minute pauses, and resume. Existing defaults and user bindings are preserved. Dismiss Preview applies while a preview is visible, and Silk’s math completion trigger remains limited to `manual`. Clipboard recognition has two default bindings for the same command—one in the editor and one in the image-input menu—so select the appropriate row when editing.

## 按语言开关 / Per-language modes


从 0.2.9 起，`silkMath.completion.mode` 支持 `on`（默认）、`off`、`manual`，可在用户、工作区、文件夹和语言设置中覆盖。补全与预览独立；关闭补全不会关闭公式预览、CSS 编辑器补全或显式 Quick Fix。

Since 0.2.9, `silkMath.completion.mode` supports `on` (default), `off`, and `manual`, with user, workspace, folder, and language overrides. Completion is independent of preview, CSS editor completion, and explicit Quick Fixes.

**在哪里调整：** 从 0.2.12 起，打开一个 `.tex` 或 `.md` 文件，点击底部 **Silk Math → 数学补全模式…**，即可在 VS Code 设置页的 **Completion: Mode** 下拉框选择 `on`、`off` 或 `manual`。页面会自动筛选当前语言，状态栏菜单也会显示该语言当前的模式。命令面板可运行 **Silk Math: 设置数学补全模式 / Set Math Completion Mode**。没有打开支持的文件时，此入口打开通用补全模式设置。

也可以直接打开 VS Code 设置，搜索 `@id:silkMath.completion.mode`；只修改 Markdown 时加上 `@lang:markdown`。测试版搜索 `@id:silkMathTest.completion.mode`。选择用户、工作区或文件夹设置页，决定此设置保存在哪里。修改后立即生效，无需重启预览。

**Where to change it:** Since 0.2.12, open a `.tex` or `.md` file and choose **Silk Math → Math completion mode…** from the status bar. Select `on`, `off`, or `manual` in VS Code's **Completion: Mode** dropdown, filtered to the current language. The status menu also displays that language's current mode. The Command Palette provides **Silk Math: Set Math Completion Mode**. With no supported file open, this entry opens the general completion mode setting.

Alternatively, search VS Code Settings for `@id:silkMath.completion.mode`; add `@lang:markdown` for a Markdown override. For the test build, search `@id:silkMathTest.completion.mode`. Choose the User, Workspace, or Folder settings tab to control where the value is saved. Changes apply immediately without restarting preview.

与 LaTeX Workshop、Markdown All in One 配合的配置示例 / Example for coexistence:

```json
{
  "[latex]": { "silkMath.completion.mode": "off" },
  "[tex]": { "silkMath.completion.mode": "off" },
  "[markdown]": { "silkMath.completion.mode": "manual" },
  "[mdx]": { "silkMath.completion.mode": "manual" }
}
```

| 模式 / Mode | 输入字符 / Typing | 手动 / Manual | 预览 / Preview |
| --- | --- | --- | --- |
| `on` | 自动提供候选 / Automatic | VS Code 原有补全操作 / Native VS Code completion | 保持原设置 / Unchanged |
| `off` | 无 Silk 候选 / No Silk items | 无 Silk 候选 / No Silk items | 保持原设置 / Unchanged |
| `manual` | 不启动 Silk 补全 / No automatic Silk completion | `Ctrl+Space` 或 Silk 命令 / or Silk command | 保持原设置 / Unchanged |

`manual` 模式支持以下三种用法，调用的都是 **Silk Math: 触发数学补全 / Trigger Math Completion**：

1. **默认快捷键**：在公式中按 `Ctrl+Space`。例如已经输入 `\alp`，也能重新打开补全列表。
2. **自定义快捷键**：点击底部 Silk Math 状态栏，选择“数学补全快捷键…”。打开的 VS Code“键盘快捷方式”会直接显示数学补全命令，双击快捷键列即可修改。也可以从命令面板运行 **Silk Math: 修改数学补全快捷键 / Change Math Completion Shortcut**。
3. **命令面板**：运行 **Silk Math: 触发数学补全 / Trigger Math Completion**，无需使用补全快捷键。

Silk 专用快捷键、上述触发命令及改键入口仅在 `manual` 下启用。`on` 下，在公式内输入 `\` 等字符自动提供候选，`Ctrl+Space` 保持 VS Code 原有的补全操作；`off` 不提供 Silk 数学候选。

`manual` 模式下，正常打字不会启动 Silk 补全。手动打开列表后，继续打字会筛选当前候选；关闭列表后，再次按快捷键或运行上述命令即可重新打开。默认 `Ctrl+Space` 在列表关闭时启动补全，列表打开时保留 VS Code 原有的详情操作。其他扩展仍可在同一个列表中提供候选。

修改快捷键时，请选择 **Silk Math 的数学补全命令**。仅修改 VS Code 通用的 **Trigger Suggest** 快捷键，不会自动改动 Silk 的手动补全快捷键。若系统占用了 `Ctrl+Space`，可以使用自定义快捷键或命令面板。

In `manual` mode, three entry points use **Silk Math: Trigger Math Completion**:

1. **Default shortcut:** Press `Ctrl+Space` inside a formula, including after a partial command such as `\alp`.
2. **Custom shortcut:** Click the Silk Math status bar item and choose **Math completion shortcut…**. VS Code's **Keyboard Shortcuts** opens directly to the completion command; double-click its keybinding column to change the keys. You can also run **Silk Math: Change Math Completion Shortcut** from the Command Palette.
3. **Command Palette:** Run **Silk Math: Trigger Math Completion** without using a completion shortcut.

Silk's dedicated shortcut, trigger command, and shortcut settings entry are enabled only in `manual`. In `on`, typing characters such as `\` inside a formula triggers suggestions and `Ctrl+Space` retains VS Code's native completion behavior. `off` provides no Silk math items.

In `manual` mode, ordinary typing does not start Silk completion. After opening the list manually, further typing filters its items. Once dismissed, use the shortcut or command again to reopen it. The default `Ctrl+Space` starts completion when the list is closed and retains VS Code's details action while it is open. Other extensions may contribute to the same list.

When customizing the shortcut, select **Silk Math's completion command**. Changing only VS Code's generic **Trigger Suggest** shortcut does not change Silk's manual completion shortcut. If the operating system intercepts `Ctrl+Space`, use a custom shortcut or the Command Palette.

```json
// keybindings.json：示例自定义快捷键 / example custom shortcut
{
  "key": "ctrl+alt+space",
  "command": "silkMath.triggerCompletion",
  "when": "editorTextFocus && !editorReadonly && silkMath.manualCompletion && !suggestWidgetVisible"
}
```

测试版使用 `silkMathTest.*` 设置和 `silkMathTest.triggerCompletion`，手动快捷键为 `Ctrl+Alt+Shift+Space`，避免与正式版争用。/ The test build uses `silkMathTest.*`, `silkMathTest.triggerCompletion`, and `Ctrl+Alt+Shift+Space` to avoid shortcut conflicts with the release build.

## 候选与模板 / Items and snippets

- 仅在公式内部和开始/结束数学环境时提供候选。普通正文、插图路径、Markdown 链接、TeX 注释和 Markdown 代码中的补全不扩展；某些代码中的公式仍可预览，这是独立功能。
- 分式、根式、字体、重音、叠放、积分/求和上下限、自动定界符，以及矩阵、分段、对齐环境提供 snippet。`\frac` 插入 `\frac{}{} ` 的参数结构（不强制末尾空格），用 `Tab` 跳到下一参数。可选参数变体有不同的签名；`completion.optionalArguments` 默认 `true`，可关闭。
- `\begin{ali` 可插入完整环境；已有右花括号或现成结束环境时保留现有正文，只补环境名。`\end{` 优先提示当前最内层环境。`\matrix` 等数学环境名也可在公式内直接生成环境模板。
- 当前命令后已有 `{...}` 或 `[...]` 时不再添加第二套参数；在 `\al|pha`、`\fr|ac{x}{y}` 中间补全会替换整个命令，避免留下后缀。
- 沿已有定义索引识别自定义宏与参数、可选默认值和来源，读取未保存的 `.sty/.cls/.tex`；重新定义的同名命令优先。复杂 TeX 定义仍明确标注预览限制。公式内同一行的选中文字可进入模板的首个必选参数；多行包裹不作为本轮保证。
- 词库构建时从固定的 MathJax 4.1.3 提取 9 组映射，共 1,124 个去重前条目。常用词库默认可用；`mathtools`、`physics`、`braket`、`upgreek` 按声明启用，也可用 `completion.packages` 手动补充。词库条目数不等于可用宏包数或全部命令都能预览；尤其 `\qty` 根据 `physics` 声明选择物理定界符或 siunitx 参数模板。
- `\ref`、`\eqref` 等公式内引用可补全当前文档、可达章节、同一本 notebook 文本单元格的前向标签；公式内 `\cite` 一类命令可读取 `\bibliography`、`\addbibresource` 的 `.bib` 和 `\bibitem`，展示作者、年份与标题。逗号列表仅替换当前键，过滤已经选中的键。`\label{` 提供避免重名的新键。
- 项目索引只在标签/引用/文献参数补全时创建，复用解析缓存，磁盘变更、未保存编辑和关闭文件会失效。最多 128 个可达文件、单文件 2 MiB 文本限制、累计 8 MiB 估算文本；达到限制的候选会标注。动态生成的路径/标签、远程 bibliography、工作区外依赖不解析；缺失文件不会下载。支持 `% !TeX root` 及唯一已打开的直接引用主文件，不扫描全部工作区猜测主文件。普通命令补全只缓存一份不超过 256 Ki 字符的源码扫描；候选说明按需生成，引用索引闲置 60 秒释放。

- Completion is limited to formulas and math environment openers/closers. It does not expand into prose, image paths, Markdown links, TeX comments, or Markdown code. Preview inside some code remains a separate feature.
- Snippets cover fractions, roots, fonts, accents, stacked expressions, integral/sum limits, paired delimiters, matrices, cases, and alignment environments. `\frac` inserts two argument groups, navigated with `Tab`, without forcing trailing whitespace. Optional-argument variants have distinct signatures; `completion.optionalArguments` defaults to `true`.
- `\begin{ali` can insert a complete environment. Existing closing braces or matching environment endings are preserved; only the name is completed. `\end{` prioritizes the innermost open environment. Names such as `\matrix` also insert environment templates inside math.
- Existing `{...}` or `[...]` arguments are preserved, without adding another argument list. Completion in `\al|pha` or `\fr|ac{x}{y}` replaces the entire command, including its suffix.
- The existing definition index supplies custom macros, arguments, optional defaults, and source information, including unsaved `.sty/.cls/.tex` changes. Document redefinitions take precedence. Complex TeX definitions retain explicit preview limitations. A single-line selection inside math can fill the first required argument; multiline wrapping is not guaranteed in this iteration.
- Build-time extraction from pinned MathJax 4.1.3 supplies 9 mapping groups and 1,124 entries before cross-package deduplication. Common entries are available by default; `mathtools`, `physics`, `braket`, and `upgreek` follow declarations or `completion.packages`. Counts do not imply support for all TeX packages or previewability of every command. `\qty` uses the physics delimiter or siunitx template according to the declared package.
- Formula-local references such as `\ref` and `\eqref` complete forward labels from the current document, reachable chapters, and markup cells in the same notebook. Formula-local citation commands read `.bib` files declared by `\bibliography` / `\addbibresource` and local `\bibitem` entries, displaying author, year, and title. Comma lists replace only the current key and omit already selected keys. `\label{` offers a new key that avoids existing names.
- Project indexing starts only for label/reference/citation arguments and caches parsed data, invalidating on disk changes, unsaved edits, and document closure. Limits are 128 reachable files, a 2 MiB per-file text limit, and 8 MiB estimated total text; affected items indicate truncation. Dynamically generated paths/labels, remote bibliographies, and dependencies outside the workspace are not resolved or downloaded. `% !TeX root` and a unique directly including open parent are supported; no whole-workspace root search is performed. Ordinary command completion retains one source scan of up to 256 Ki characters. Item documentation is generated on demand; the project index is released after 60 seconds of inactivity.

## 自定义模板 / Custom templates

`completion.snippets` 优先于内置词库和文档定义。键为不含反斜杠的命令名，值为**完整 VS Code snippet**，空字符串隐藏命令。最多 256 项、每项 8,192 字符。JSON 和 snippet 均有反斜杠转义，因此示例的四个反斜杠最终插入一个。/ `completion.snippets` overrides built-in and document definitions. Keys are command names without the leading backslash; values are **complete VS Code snippets**. Empty strings hide commands. Limits: 256 items, 8,192 characters each. Both JSON and snippet syntax escape backslashes, so the four backslashes below insert one.

```json
{
  "silkMath.completion.snippets": {
    "RR": "\\\\mathbb{R}",
    "frac": "\\\\frac{${1:numerator}}{${2:denominator}}$0",
    "alpha": ""
  }
}
```
