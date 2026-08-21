# 发布 Silk Math Preview

源码仓库：https://github.com/zhoujasper/silk-math-preview  
作者主页：https://zhoujasper.github.io  
Marketplace 扩展 ID：`silkmath.silk-math-preview`

详情页图片靠 GitHub 仓库里的 `media/*.png`。`vsce` 打包时会把 README 相对路径改写成 GitHub 地址，不要加 `--no-rewrite-relative-links`。

推到 `main` 会跑 GitHub Actions：测试、打包 VSIX，并在配置了 `VSCE_PAT` 后自动发布到 Marketplace。版本号没变时 `--skip-duplicate` 会跳过，不会报错。

## 1. 一次性：Marketplace 发布者 + PAT

1. 用 Microsoft 账号打开 [创建发布者](https://marketplace.visualstudio.com/manage/create-publisher)。
2. **Publisher ID 必须是 `silkmath`**（和 `package.json` 的 `publisher` 一致）。显示名可以写成 `Silk Math`。
3. 打开 [Azure DevOps PAT](https://dev.azure.com/_usersSettings/tokens)。若提示建组织，建一个即可。
4. New Token：
   - Organization: **All accessible organizations**
   - Scopes: **Custom** → **Marketplace** → **Manage**
5. 复制 token（只显示一次）。不要写进仓库。

## 2. 把 PAT 交给 GitHub Actions

仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**：

- Name: `VSCE_PAT`
- Secret: 刚才的 Azure DevOps PAT

保存后，下一次推到 `main`（或手动 **Run workflow**）就会发布。

## 3. 以后发新版本

1. 改 `package.json` 和 `package-lock.json` 的 `version`（已发布过的号不能重用）。
2. 更新 `CHANGELOG.md`。
3. `git push origin main`。

Actions 会：跑测试 → 打 VSIX → `vsce publish --skip-duplicate` → 更新 GitHub Release。

别人在 VS Code 搜 **Silk Math Preview**，或打开：

https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview

## 4. 本地手动发布（可选）

```powershell
npx vsce login silkmath
npx vsce publish
```
