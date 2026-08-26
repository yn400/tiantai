# 🚀 GitHub 发布手册（三分钟版）

> 仓库内容、CI/发布工作流、安装包产物全部就绪。
> 只剩"你的 GitHub 账号"这一步必须本人操作。

## 前置一次性设置

```powershell
# 1) 设置 git 身份（推送到哪都显示这个署名）
git config --global user.name  "你的名字"
git config --global user.email "你的GitHub邮箱"

# 2) 安装 GitHub CLI（二选一）
winget install GitHub.cli        # Win10+/11
# 或官网下载 https://cli.github.com

# 3) 登录（会开浏览器授权一次）
gh auth login                    # 选 GitHub.com → HTTPS → Login with web browser
```

## 路线 A · gh CLI 一条龙（推荐）

```powershell
cd D:\reasonixCodeProjects\tt-app

# 创建仓库（--private 先私有试运行；满意后再改公开）
gh repo create tiantai --private --source=. --remote=origin --push

# 开启 GitHub Pages（Web 在线版，自动部署 dist）
gh api -X POST repos/{owner}/tiantai/pages -f "build_type=workflow"

# 打预发布标签 → 自动触发 Release 工作流：
#   构建 Setup.exe → 创建【草稿预发布】并挂上安装包
git tag v2.0.0-beta.1
git push origin v2.0.0-beta.1
```

完成后：
- `https://github.com/你/tiantai` —— 私有仓库（草稿态）
- `Actions` 页看两条流水线跑完
- `Releases` 页出现 **草稿预发布**，检查后点 Publish 即正式可见
- `https://你.github.io/tiantai/` —— Web 在线版

## 路线 B · 纯网页操作（不装 CLI）

1. github.com/new 新建**空**仓库 `tiantai`（Private，不要勾任何初始化文件）
2. 回到项目目录：
   ```powershell
   git branch -M main
   git remote add origin https://github.com/你的用户名/tiantai.git
   git push -u origin main          # 会弹浏览器登录授权
   git tag v2.0.0-beta.1
   git push origin v2.0.0-beta.1
   ```
3. 仓库 Settings → Pages → Source 选 **GitHub Actions**
4. Releases 检查草稿 → Publish

## ✅ 发布前检查清单（都已替你确认过）

- [x] 密钥不入库（secrets.json 在系统用户数据目录，仓库零密钥）
- [x] git 历史已压缩（121MB → 19MB，旧壁纸大文件已清除）
- [x] CI 工作流（测试 + 构建）就绪
- [x] Release 工作流（tag → exe → 草稿发布）就绪
- [x] Pages 工作流（Web 版部署）就绪
- [ ] LICENSE 已选 AGPL-3.0 ✓ / README 截图 GIF 待补（可选）
- [ ] git 全局身份 ← **唯一需要你填的**

## 🔒 公开时机建议

Private 试运行几天确认无密钥泄漏、Pages 正常 →
Settings → General → Danger Zone → **Change visibility → Public**，
同时把仓库 About 填上：`温柔的 AI 陪伴桌面应用 · BYOK · Electron + React19`
Topics 建议：`electron` · `react` · `ai-companion` · `mental-health` · `chinese` · `byok`

## 🔁 之后的日常发版

```powershell
npm version patch        # 2.0.0 → 2.0.1，自动打 tag
git push && git push --tags
# Release 工作流自动出新版本草稿
```
