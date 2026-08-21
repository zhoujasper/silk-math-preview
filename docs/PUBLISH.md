# 发布 Silk Math Preview

源码仓库：https://github.com/zhoujasper/silk-math-preview  
作者主页：https://zhoujasper.github.io  
Marketplace 扩展 ID：`silkmath.silk-math-preview`

详情页图片靠 GitHub 仓库里的 `media/*.png`。`vsce` 打包时会把 README 相对路径改写成 GitHub 地址，不要加 `--no-rewrite-relative-links`。

## 1. 推到 GitHub

当前远程已是 `origin` → `zhoujasper/silk-math-preview`。在仓库根目录：

```powershell
git add -A
git commit -m "Release 0.1.67."
git push origin main
```

可选：打一个 GitHub Release，并附上 `silk-math-preview-0.1.67.vsix`，别人就能从 Releases 下载。

## 2. 创建 Marketplace 发布者

1. 用 Microsoft 账号打开 [创建发布者](https://marketplace.visualstudio.com/manage/create-publisher)。
2. **Publisher ID 必须是 `silkmath`**（和 `package.json` 的 `publisher` 一致）。显示名可以写成 `Silk Math`。
3. 用同一账号打开 [管理发布者](https://marketplace.visualstudio.com/manage)，确认能看到 `silkmath`。

如果这个 ID 已被占用，要么换一个未占用的 ID 并同步改 `package.json` 的 `publisher`，要么申请认领。

## 3. Azure DevOps 个人访问令牌（PAT）

Marketplace 发布走 Azure DevOps，不是 GitHub token。

1. 打开 [Azure DevOps PAT](https://dev.azure.com/_usersSettings/tokens)。若提示建组织，建一个即可（例如 `zhoujasper`）。
2. New Token：
   - Organization: **All accessible organizations**
   - Expiration: 按需要选
   - Scopes: **Custom** → **Marketplace** → **Manage**
3. 生成后立刻复制，只显示一次。

不要把 PAT 写进仓库、README 或聊天记录。

## 4. 登录并发布

在仓库根目录（已 `npm install`）：

```powershell
npx vsce login silkmath
npx vsce publish
```

`vsce login` 会要刚才的 PAT。之后 `publish` 会跑打包并上传。也可以指定已打好的包：

```powershell
npx vsce publish --packagePath silk-math-preview-0.1.67.vsix
```

第一次审核可能要几分钟到几小时。通过后地址是：

https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview

别人在 VS Code 扩展视图搜 **Silk Math Preview** 就能装。

## 5. 以后发新版本

1. 改 `package.json` / `package-lock.json` 的 `version`（已发布过的版本号不能重用）。
2. 更新 `CHANGELOG.md`。
3. `npm run package` 本地验证。
4. `git push`，然后 `npx vsce publish`。

GitHub Actions 若配置了仓库密钥 `VSCE_PAT`，也可以在打 tag / Release 时自动发布。
