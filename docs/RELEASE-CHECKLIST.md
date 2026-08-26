# 天台 · 发布关卡清单（内测 → 上架）

> 决策记录：天台采用 **BYOK（Bring Your Own Key）** 模式 —— 用户在设置页自填自己的模型 API Key，
> 应用不内置任何密钥、不代理任何请求。参照 ChatBox / Cherry Studio / LobeChat 的成熟实践。

## 🔴 内测期必做（已完成 ✅ / 待办 ⬜）

- [x] 生产构建不再携带任何密钥：默认 Key 移入 `.env.local`（gitignore 覆盖），
      `appStore.ts` 仅在 `import.meta.env.DEV` 时读取
- [x] 设置页提供「测试连接」按钮 + DeepSeek 申请指引，降低内测同学配置门槛
- [x] Electron 显式权限策略（geolocation / media / notifications），避免打包后天气、通话静默失效
- [x] 单实例锁：重复启动聚焦已有窗口
- [x] 成就 streak 语义修复（真实连续天数）+ 解锁时刻感 Toast
- [x] 感恩墙持久化修复（原先刷新即丢失）
- [x] SSE 流式对话（逐字渲染、可中断、中断保留半截）
- [x] 多 Provider 设置页（DeepSeek/OpenAI/千问/Kimi/智谱 + 连接测试）
- [x] git 版本控制初始化（.env.local 已确认不入库）
- [x] 声音页动态场景画布（六种环境音各配氛围视觉）
- [x] 长期记忆滚动摘要（conversationMemory 空壳转真功能）
- [ ] ⚠️ **到 platform.deepseek.com 作废旧 Key**（曾明文出现在旧版 `.env` 中，视为已泄露）
- [ ] `git init` 并完成首次提交（当前项目无版本控制）

## 🟠 上架前硬性关卡

### 安全
- [ ] API Key 迁移至主进程 safeStorage 加密存储（Windows DPAPI），
      渲染进程经 preload contextBridge IPC 读写，bundle 与 localStorage 不再出现明文 Key
- [ ] index.html 增加 CSP meta；main.cjs 收紧 webPreferences（sandbox: true）
- [ ] 危机安全层：检测自伤/轻生关键词 → 固定展示心理援助热线卡片（参照 Wysa/Woebot），
      关于页加「非医疗建议」免责声明 —— 心理陪伴品类的合规红线

### 版权与资源
- [x] 壁纸压缩为 WebP（140MB → 0.66MB，仅保留 6 张在用图）
      ⚠️ 推送 GitHub 前需压缩 git 历史：基线提交里含旧 JPG 大文件，
      用 `git rebase`/重建仓库方式瘦身，否则克隆会拉下 140MB 垃圾
- [ ] 移除网易云第三方代理歌单（api.injahow.cn），改为 Jamendo/CC 音乐或用户本地音乐导入
- [ ] 壁纸压缩为 WebP（当前约 140MB，含三份重复的 16MB 同图）或替换为自有版权/CC0 素材
- [ ] 字体自托管子集化，移除 Google Fonts 运行时依赖（国内网络不可达）

### 桌面端基本功
- [ ] electron-updater 自动更新 + electron-builder 发布配置（icon / artifactName）
- [ ] 托盘图标实现（现为空壳）、关闭最小化到托盘选项
- [ ] Sentry 或同类的崩溃上报
- [ ] 数据迁出 localStorage：聊天/情绪记录写入 userData 目录（SQLite 或 JSONL），
      补齐「导入」功能与「导出」配对

## 🟡 产品化方向（按优先级）

1. DeepSeek SSE 流式输出（体感提升最大）
2. 真·记忆系统：滚动摘要写入 conversationMemory（当前是未接线的空壳）或砍掉该功能
3. Provider 设置页：激活 aiClient.ts 已有的 5 家模型支持
4. 统计回顾页（Daylio 式周/月聚合）；成就 streak 改为真实连续天数判定
5. 伙伴成长体系（Finch 式）：打卡/呼吸/写信驱动小天成长
6. 高质量 TTS（MiniMax / 火山引擎 / Edge-TTS）替换浏览器 speechSynthesis；
   STT 弃用 webkitSpeechRecognition（Electron 打包后不可用），改云端 ASR
