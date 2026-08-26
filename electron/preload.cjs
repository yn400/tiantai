// ── 预加载桥：渲染进程与主进程之间的最小安全接口 ────────────────
// 仅暴露明确列出的能力，不泄漏任何 Node 能力到渲染端。
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tiantaiCare", {
  /** 开关关怀通知（主进程调度器读取） */
  setEnabled: (v) => ipcRenderer.invoke("care:set-enabled", Boolean(v)),
  /** 开关"关闭时隐藏到托盘" */
  setCloseToTray: (v) => ipcRenderer.invoke("app:set-close-to-tray", Boolean(v)),
});

contextBridge.exposeInMainWorld("tiantaiSecure", {
  /** 加密写入一个密钥字段（safeStorage / DPAPI） */
  set: (key, value) => ipcRenderer.invoke("secure:set", String(key), String(value ?? "")),
  /** 读取密钥明文（仅返回给本应用渲染端） */
  get: (key) => ipcRenderer.invoke("secure:get", String(key)),
});

contextBridge.exposeInMainWorld("tiantaiTTS", {
  /** 合成自然语音，返回 base64 mp3；失败返回 null（渲染端回退系统语音） */
  speak: (text) => ipcRenderer.invoke("tts:synthesize", String(text ?? "")),
});

contextBridge.exposeInMainWorld("tiantaiBackup", {
  /** 把数据 JSON 快照写入 userData/backups（保留最近 7 份） */
  backup: (json) => ipcRenderer.invoke("data:backup", String(json ?? "")),
});
