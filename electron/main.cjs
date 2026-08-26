const { app, BrowserWindow, session, Menu, Notification, ipcMain, Tray, nativeImage, safeStorage } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow = null;
let tray = null;
let forceQuit = false;
let closeToTrayEnabled = true;

const CLOSE_FLAG_FILE = path.join(app.getPath("userData"), "close-to-tray.json");

function readCloseFlag() {
  try {
    return JSON.parse(fs.readFileSync(CLOSE_FLAG_FILE, "utf8")).enabled !== false;
  } catch {
    return true; // 默认：点 × 隐藏到托盘，托盘右键才真正退出
  }
}

function writeCloseFlag(v) {
  try { fs.writeFileSync(CLOSE_FLAG_FILE, JSON.stringify({ enabled: v })); } catch {}
}

function showMainWindow() {
  if (!mainWindow) { createWindow(); return; }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

// Windows 系统通知需要 AppUserModelId 与安装包 appId 一致
app.setAppUserModelId("com.tiantai.app");

// ── 禁用硬件加速 ────────────────────────────────────────────────
// 部分 Windows 机器的 GPU 驱动存在合成缺陷：渲染器正常绘制但帧无法
// 上屏，表现为"内容闪现后整窗变白"。软件渲染对本应用的轻量 Canvas
// 场景无感知差异，却能彻底绕开驱动问题。必须在 app ready 前调用。
app.disableHardwareAcceleration();

// ── 黑匣子日志：渲染进程崩溃/加载失败/严重控制台错误全部落盘 ──
// 位置：%APPDATA%/tiantai/tiantai-log.txt
const LOG_FILE = path.join(app.getPath("userData"), "tiantai-log.txt");
function logLine(...args) {
  try {
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${args.join(" ")}\n`);
  } catch { /* 日志失败不影响运行 */ }
}

// ── 关怀通知调度器 ──────────────────────────────────────────────
// 人文关怀的三个触点：深夜提醒 / 节气问候 / 天气变化 ping。
// 原则：低频、温柔、可关闭；同类提醒有冷却期，绝不骚扰。

const CARE_FILE = path.join(app.getPath("userData"), "care.json");
let careEnabled = true;
const lastNotifiedAt = {};
let lastPingTemp = null;

function readCareFlag() {
  try {
    return JSON.parse(fs.readFileSync(CARE_FILE, "utf8")).enabled !== false;
  } catch {
    return true;
  }
}

function writeCareFlag(v) {
  try { fs.writeFileSync(CARE_FILE, JSON.stringify({ enabled: v })); } catch {}
}

function oncePer(key, cooldownMs) {
  const now = Date.now();
  if ((lastNotifiedAt[key] || 0) + cooldownMs > now) return false;
  lastNotifiedAt[key] = now;
  return true;
}

function careNotify(title, body) {
  logLine("care-notify", title);
  try {
    if (Notification.isSupported()) new Notification({ title, body }).show();
  } catch {}
}

// 二十四节气近似日期（氛围级精度，与渲染端 lunar.ts 对齐）
const TERMS = [
  [1, 5, "小寒", "最冷的日子，春天已经在路上。"],
  [1, 20, "大寒", "冰坚而春近，熬过这段就是花开。"],
  [2, 4, "立春", "东风解冻，一切都可以重新开始。"],
  [2, 19, "雨水", "润物无声的温柔也是力量。"],
  [3, 5, "惊蛰", "春雷乍动，你心里那件事也该醒醒了。"],
  [3, 20, "春分", "昼夜均分，今天世界是平衡的。"],
  [4, 4, "清明", "记得想念，也记得好好生活。"],
  [4, 20, "谷雨", "你浇灌过的事，正在悄悄发芽。"],
  [5, 5, "立夏", "万物并秀，把日子过得葱茏一点。"],
  [5, 21, "小满", "小得盈满，留白是生活的智慧。"],
  [6, 5, "芒种", "忙而不乱，种下即是收获的开始。"],
  [6, 21, "夏至", "白昼最长的一天，光多陪你一会儿。"],
  [7, 7, "小暑", "心静自然凉，是真的。"],
  [7, 22, "大暑", "湿热至极，秋在转角。"],
  [8, 7, "立秋", "凉风有信，一叶知秋。"],
  [8, 23, "处暑", "燥热退散，适合整理心情。"],
  [9, 7, "白露", "夜里凉了，早点睡。"],
  [9, 23, "秋分", "得失各半，刚刚好。"],
  [10, 8, "寒露", "添一件外套，也添一分从容。"],
  [10, 23, "霜降", "霜打过的菜更甜，经历过的难会变成味道。"],
  [11, 7, "立冬", "允许自己进入低耗模式。"],
  [11, 22, "小雪", "世界要安静了，你也歇歇。"],
  [12, 7, "大雪", "厚雪之下，种子在做梦。"],
  [12, 21, "冬至", "最长的夜过后，白天会一天天变长。"],
];

function todaySolarTerm(now = new Date()) {
  const y = now.getFullYear();
  const stamp = (m, d) => new Date(y, m - 1, d).getTime();
  const today = new Date(y, now.getMonth(), now.getDate()).getTime();
  let cur = null;
  for (const t of TERMS) if (today >= stamp(t[0], t[1])) cur = t;
  if (!cur) cur = TERMS[TERMS.length - 1];
  // 仅在节气"当天"问候
  return today === stamp(cur[0], cur[1]) ? cur : null;
}

async function weatherPing() {
  // IP 级定位足够天气用途；失败静默跳过
  let lat, lon, city;
  try {
    const geo = await fetch("http://ip-api.com/json/?lang=zh-CN").then((r) => r.json());
    lat = geo.lat; lon = geo.lon; city = geo.city || "你的城市";
  } catch {
    return;
  }
  try {
    const w = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`,
    ).then((r) => r.json());
    const code = w.current?.weather_code ?? 0;
    const temp = Math.round(w.current?.temperature_2m ?? 0);
    const wet = (code >= 51 && code <= 86) || code >= 95;

    if (wet && oncePer("wx-wet", 4 * 3600e3)) {
      careNotify("天台 · 天气陪伴", `${city}正在下雨 ${temp}°C\n出门记得带伞，天台的灯给你留着。`);
    } else if (lastPingTemp !== null && lastPingTemp - temp >= 6 && oncePer("wx-cold", 8 * 3600e3)) {
      careNotify("天台 · 降温提醒", `${city}气温降到了 ${temp}°C，比刚才冷了不少。\n添件外套，别硬扛。`);
    }
    lastPingTemp = temp;

    // 空气质量：较差时温柔提醒减少户外
    try {
      const a = await fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`,
      ).then((r) => r.json());
      const aqi = Math.round(a.current?.us_aqi ?? 0);
      if (aqi >= 150 && oncePer("wx-aqi", 12 * 3600e3)) {
        careNotify("天台 · 空气陪伴", `${city}的空气质量指数 ${aqi}，不太适合户外久待。\n今晚就在天台听雨吧。`);
      }
    } catch {}
  } catch {}
}

async function starsPing() {
  // 21 点档：观星条件检查（7Timer astro，无 Key）
  let lat, lon;
  try {
    const geo = await fetch("http://ip-api.com/json/").then((r) => r.json());
    lat = geo.lat; lon = geo.lon;
  } catch { return; }
  try {
    const a = await fetch(
      `https://www.7timer.info/bin/api.pl?lon=${lon.toFixed(2)}&lat=${lat.toFixed(2)}&product=astro&output=json`,
    ).then((r) => r.json());
    const covers = (a.dataseries ?? []).slice(0, 5).map((d) => d.cloudcover ?? 100);
    if (covers.length && Math.min(...covers) <= 25 && oncePer("stars", 20 * 3600e3)) {
      careNotify("天台 · 今夜观星", "今夜云量极少，星空条件极佳 🌌\n抬头看看吧——有些风景只在夜里营业。");
    }
  } catch {}
}

function startCareScheduler() {
  careEnabled = readCareFlag();
  closeToTrayEnabled = readCloseFlag();

  ipcMain.handle("care:set-enabled", (_e, v) => {
    careEnabled = Boolean(v);
    writeCareFlag(careEnabled);
    return careEnabled;
  });

  ipcMain.handle("app:set-close-to-tray", (_e, v) => {
    closeToTrayEnabled = Boolean(v);
    writeCloseFlag(closeToTrayEnabled);
    return closeToTrayEnabled;
  });

  // ── 密钥加密存储：safeStorage（Windows=DPAPI）──────────────────
  // 渲染端的 AI/ASR Key 不再进 localStorage，改存主进程加密文件。
  const SECRETS_FILE = path.join(app.getPath("userData"), "secrets.json");
  function readSecrets() {
    try { return JSON.parse(fs.readFileSync(SECRETS_FILE, "utf8")); } catch { return {}; }
  }
  ipcMain.handle("secure:set", (_e, key, value) => {
    if (!key) return false;
    const store = readSecrets();
    if (!value) {
      delete store[key];
    } else if (safeStorage.isEncryptionAvailable()) {
      store[key] = safeStorage.encryptString(String(value)).toString("base64");
    } else {
      store[key] = "plain:" + String(value); // 极端环境无 DPAPI 时降级并打标
    }
    fs.writeFileSync(SECRETS_FILE, JSON.stringify(store));
    return true;
  });
  ipcMain.handle("secure:get", (_e, key) => {
    const v = readSecrets()[key];
    if (!v) return "";
    if (v.startsWith("plain:")) return v.slice(6);
    try { return safeStorage.decryptString(Buffer.from(v, "base64")); } catch { return ""; }
  });

  // ── 数据备份：JSON 快照写入 userData/backups，保留最近 7 份 ────
  ipcMain.handle("data:backup", (_e, json) => {
    try {
      const dir = path.join(app.getPath("userData"), "backups");
      fs.mkdirSync(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
      fs.writeFileSync(path.join(dir, `天台备份-${stamp}.json`), json);
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
      while (files.length > 7) fs.unlinkSync(path.join(dir, files.shift()));
      return true;
    } catch {
      return false;
    }
  });

  // ── TTS 合成：edge-tts 晓晓音色（免费，自然度远超系统 SAPI）─────
  let ttsClient = null;
  let ttsVoice = "";
  const TTS_VOICE = "zh-CN-XiaoxiaoNeural";
  ipcMain.handle("tts:synthesize", async (_e, text) => {
    const clean = String(text ?? "").slice(0, 400).trim();
    if (!clean) return null;
    try {
      if (!ttsClient || ttsVoice !== TTS_VOICE) {
        const mod = require("msedge-tts");
        ttsClient = new mod.MsEdgeTTS();
        await ttsClient.setMetadata(TTS_VOICE, mod.OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        ttsVoice = TTS_VOICE;
      }
      const { audioStream } = ttsClient.toStream(clean);
      const chunks = [];
      for await (const ch of audioStream) chunks.push(ch);
      return Buffer.concat(chunks).toString("base64");
    } catch (err) {
      logLine("tts-error", String(err).slice(0, 120));
      return null; // 渲染端回退到系统语音
    }
  });

  // 启动时：节气当天问候（延迟几秒等窗口稳定）
  const term = todaySolarTerm();
  if (term && oncePer(`term-${term[2]}`, 20 * 3600e3)) {
    setTimeout(() => {
      if (careEnabled) careNotify(`天台 · 今日${term[2]}`, term[3]);
    }, 4000);
  }

  setInterval(() => {
    if (!careEnabled) return;
    const h = new Date().getHours();

    // 深夜提醒：22 点后每晚一次
    if (h >= 22 && oncePer("night", 20 * 3600e3)) {
      careNotify("天台 · 夜深了", "今晚的风很轻，屏幕那头的你早点休息。\n晚安，好梦在排队。");
      return;
    }

    // 白天时段：天气 ping（雨雪/降温/坏空气才发声）
    if (h >= 8 && h < 22 && oncePer("wx-tick", 55 * 60e3)) {
      weatherPing();
    }

    // 观星通知：21-22 点档，晴夜才会响
    if (h >= 21 && h < 23 && oncePer("stars-tick", 55 * 60e3)) {
      starsPing();
    }
  }, 60 * 1000);

  // 首次进入白天时段也 ping 一次
  if (careEnabled) {
    const h = new Date().getHours();
    if (h >= 8 && h < 22) weatherPing();
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 430,
    height: 820,
    minWidth: 360,
    minHeight: 600,
    frame: true,
    resizable: true,
    title: "天台",
    // icon: path.join(__dirname, "../public/favicon.svg"),
    backgroundColor: "#050810",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  // 渲染进程崩溃 → 记录并自愈重载（GPU 驱动偶发崩溃等场景自动恢复）
  mainWindow.webContents.on("render-process-gone", (_e, details) => {
    logLine("renderer-gone", JSON.stringify(details));
    if (mainWindow && !mainWindow.isDestroyed()) {
      logLine("self-heal", "reloading after renderer crash");
      mainWindow.webContents.reload();
    }
  });
  mainWindow.webContents.on("did-fail-load", (_e, code, desc, url) => {
    // code -3 (ABORTED) 是正常导航中断，忽略
    if (code !== -3) logLine("did-fail-load", `code=${code}`, desc, String(url).slice(0, 120));
  });
  mainWindow.webContents.on("console-message", (_e, level, message, line, sourceId) => {
    if (level < 2) return;
    // ResizeObserver 循环告警是 Chromium 的良性噪音，不入库
    if (message.includes("ResizeObserver loop")) return;
    logLine(`console:L${level}`, message.slice(0, 300), `${sourceId}:${line}`);
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("close", (e) => {
    // 点 × 默认隐藏到托盘（关怀通知需要常驻）；托盘右键"彻底退出"才真退
    if (!forceQuit && closeToTrayEnabled) {
      e.preventDefault();
      mainWindow.hide();
      return;
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  try {
    const icon = nativeImage.createFromPath(path.join(__dirname, "tray.png"));
    tray = new Tray(icon);
    tray.setToolTip("天台 · 温柔的陪伴");
    const menu = Menu.buildFromTemplate([
      { label: "显示天台", click: () => showMainWindow() },
      { type: "separator" },
      { label: "彻底退出", click: () => { forceQuit = true; app.quit(); } },
    ]);
    tray.setContextMenu(menu);
    tray.on("click", () => showMainWindow());
  } catch (err) {
    logLine("tray-error", String(err).slice(0, 120));
    tray = null;
  }
}

app.whenReady().then(() => {
  logLine("app-start", `version=${app.getVersion()} packaged=${app.isPackaged}`);

  // 产品化：去掉默认的 File/Edit/View 菜单栏（陪伴应用不需要工程菜单）
  Menu.setApplicationMenu(null);

  // 显式权限策略：不设置 handler 时各版本默认行为不一致，打包后定位/摄像头可能静默失败。
  // 放行：geolocation(天气) / media(通话摄像头麦克风) / notifications / fullscreen；其余一律拒绝。
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    const allowed = ["geolocation", "media", "notifications", "fullscreen"];
    callback(allowed.includes(permission));
  });

  createWindow();
  try {
    createTray();
  } catch { /* tray may not be supported */ }

  // 关怀通知调度器（深夜提醒/节气问候/天气 ping）
  startCareScheduler();
});

app.on("child-process-gone", (_e, details) => {
  logLine("child-process-gone", details.type, details.reason, details.exitCode ?? "");
});

// 单实例锁：重复启动时聚焦已有窗口（Telegram/Discord 桌面端标准行为）
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (!mainWindow) createWindow();
});
