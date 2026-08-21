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
5. 上传仓库 Releases 里的 VSIX：  
   https://github.com/zhoujasper/silk-math-preview/releases  
   文件名类似 `silk-math-preview-0.1.67.vsix`。
6. 提交后等几分钟到几小时审核。通过后商店页才会存在。

## 自动发布（GitHub Actions）

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
