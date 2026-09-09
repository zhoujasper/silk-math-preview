# 发布 Silk Math Preview

作者主页：https://zhoujasper.github.io  
源码：https://github.com/zhoujasper/silk-math-preview  
管理后台（登录微软账号）：https://marketplace.visualstudio.com/manage

商店详情页 `https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview` **在第一次发布成功之前会是 404**，这是正常的。

## 第一次发布（网页上传，不用命令行）

1. 打开 https://marketplace.visualstudio.com/manage ，用 **Microsoft 账号**登录。
2. 左侧点 **Create publisher**。
   - ID：`silkmath`（必须和 package.json 一致，建好不能改）
   - Name：`Silk Math` 或 `Jasper Zhou`
3. 点 **Create**。
4. 在该发布者页面点 **New extension** → **Visual Studio Code**。
5. 上传仓库 Releases 里的 **正式版** VSIX：  
   https://github.com/zhoujasper/silk-math-preview/releases  
   文件名是 `silk-math-preview-0.1.72.vsix`（不要上传带 `-test-` 的包）。
6. 提交后等几分钟到几小时审核。通过后商店页才会存在。

## 正式版 vs 测试版（本机可同时安装）

本地打两种包，扩展 ID 不同，不会覆盖已经从商店装的正式版：

```
npm run package:release   # silk-math-preview-<version>.vsix
                          # ID：silkmath.silk-math-preview，发 Marketplace 用这个
npm run package:test      # silk-math-preview-test-<version>.vsix
                          # ID：silkmath.silk-math-preview-test，状态栏是 Silk Math Test
npm run package           # 先跑 verify，再打上面两个
```

- 测试包命令前缀是 `silkMathTest.*`，设置是 `silkMathTest.*`，快捷键是 `Ctrl+Alt+Shift+M`。
- 测试包 `private: true`，不要用它发商店。
- VS Code：扩展视图 → `…` → **Install from VSIX**，分别装两个文件即可并排使用。

## 自动发布（GitHub Actions）

每个新版本必须先在 `CHANGELOG.md` 中填写对应版本的完整中英双语说明，固定先 `### 中文`、后 `### English`，两侧更新项一一对应，版本标题与 `package.json` 一致：

```markdown
## <version> - YYYY-MM-DD

### 中文

- 中文更新说明。

### English

- English release note.
```

`node scripts/release-notes.mjs` 检查并输出当前版本的双语说明；也可传入版本号检查历史记录。CI 在测试和发布前检查版本与双语条目，GitHub Release 的创建和更新都使用这份说明。不要改回自动生成的单语提交摘要。发布前仍需人工核对两种语言的含义一致。

`README.md` 继续维护现有 11 种语言（英文、简体中文、繁體中文、日本語、한국어、Deutsch、Français、Español、Português、Русский、Italiano），保留单文件与页内语言导航。

1. 先有 Azure DevOps 组织：打开 https://dev.azure.com 登录，按提示 **Create new organization**（名字随意，例如 `zhoujasper`）。
2. 右上角头像旁齿轮 / 用户菜单 → **Personal access tokens** → **New Token**：
   - Name：`vscode-marketplace`
   - Organization：**All accessible organizations**（不要选某一个组织）
   - Scopes：点 **Show all scopes**，找到 **Marketplace**，勾 **Manage**
   - Create，立刻复制（只显示一次）
3. 打开 https://github.com/zhoujasper/silk-math-preview/settings/secrets/actions  
   → **New repository secret**  
   - Name：`VSCE_PAT`  
   - Secret：刚才的 token
4. 打开 https://github.com/zhoujasper/silk-math-preview/actions → **CI** → **Run workflow**。

以后改 `package.json` 版本号并 `git push origin main`，测试通过后会自动发商店。
