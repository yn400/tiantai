import { useState } from "react";
import { Bot, Volume2, Vibrate, Download, Eye, EyeOff, Mic, Upload, Save } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { PROVIDERS, PROVIDER_MAP, chatWithAI } from "../../utils/aiClient";
import { ASR_PRESETS } from "../../utils/asr";
import { saveSecretField, type SecretField } from "../../utils/secureStore";
import type { AIProvider, AppSettings } from "../../types";

// 各 Provider 的 Key 在 settings 中的字段名
const KEY_FIELD: Record<AIProvider, keyof AppSettings> = {
  deepseek: "deepseekApiKey",
  openai: "openaiApiKey",
  qwen: "qwenApiKey",
  moonshot: "moonshotApiKey",
  zhipu: "zhipuApiKey",
};

export default function SettingsPage() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const achievements = useAppStore((s) => s.achievements);
  const exportData = useAppStore((s) => s.exportData);

  const [showKey, setShowKey] = useState(false);
  const [exported, setExported] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const provider = PROVIDER_MAP[settings.aiProvider] ?? PROVIDER_MAP.deepseek;
  const keyValue = String(settings[KEY_FIELD[provider.id]] ?? "");
  // 切换 provider 后残留的旧模型 id 回落到默认模型（与 resolveActiveModel 同规则）
  const modelValue = provider.models.some((m) => m.id === settings.aiModel)
    ? settings.aiModel
    : provider.defaultModel;

  const handleExport = () => {
    const json = exportData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `天台-数据-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 3000);
  };

  // BYOK 模式的关键体验：让用户立刻确认自己的 Key 可用，而不是等到聊天失败才发现
  const handleTestKey = async () => {
    if (!keyValue || testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      await chatWithAI(
        [{ role: "user", content: "请只回复：在" }],
        provider.id,
        modelValue,
        keyValue,
      );
      setTestResult({ ok: true, msg: `✅ ${provider.name} 连接成功` });
    } catch (err) {
      setTestResult({ ok: false, msg: `❌ ${(err as Error).message || "连接失败"}` });
    } finally {
      setTesting(false);
    }
  };

  const unlocked = achievements.filter((a) => a.unlockedAt);

  return (
    <div className="px-[18px] pb-7 page-enter">
      {/* Header */}
      <div className="pt-[52px] mb-4">
        <h1 className="font-xiaowei text-[25px] text-warm-50">我的</h1>
        <p className="text-[11px] text-warm-300 mt-1 tracking-[.08em]">设置 · 成就 · 数据</p>
      </div>

      {/* ── AI Provider ── */}
      <div className="glass p-4 mb-3">
        <div className="flex items-center gap-2 mb-3">
          <Bot size={16} className="text-warm-100" />
          <span className="text-sm text-warm-50">AI 模型</span>
          <span className="text-[10px] text-warm-400 ml-auto">自带 Key · 仅存本地</span>
        </div>

        {/* Provider chips */}
        <div className="flex flex-wrap gap-1.5 mb-3.5">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => updateSettings({ aiProvider: p.id, aiModel: p.defaultModel })}
              aria-pressed={p.id === provider.id}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                p.id === provider.id
                  ? "bg-warm-100/15 border-warm-100/35 text-warm-100"
                  : "border-white/10 text-warm-300 hover:bg-white/5"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Model select */}
        <label className="block mb-3">
          <span className="text-[10px] text-warm-300 tracking-[.12em]">模型</span>
          <select
            value={modelValue}
            onChange={(e) => updateSettings({ aiModel: e.target.value })}
            className="mt-1 w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-warm-50 outline-none focus:border-warm-100/40 transition-colors"
            aria-label="选择模型"
          >
            {provider.models.map((m) => (
              <option key={m.id} value={m.id} className="bg-sky-950">
                {m.name}
              </option>
            ))}
          </select>
        </label>

        {/* Key input */}
        <label className="block">
          <span className="text-[10px] text-warm-300 tracking-[.12em]">{provider.name} API Key</span>
          <div className="relative mt-1">
            <input
              type={showKey ? "text" : "password"}
              value={keyValue}
              onChange={(e) => {
                const field = KEY_FIELD[provider.id] as SecretField;
                updateSettings({ [field]: e.target.value } as Partial<AppSettings>);
                void saveSecretField(field, e.target.value);
              }}
              placeholder={provider.placeholder}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-3 pr-10 text-sm text-warm-50 placeholder:text-warm-400 outline-none focus:border-warm-100/40 transition-colors font-mono"
              aria-label={`${provider.name} API Key`}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-200 transition-colors"
              aria-label={showKey ? "隐藏" : "显示"}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        <p className="text-[10px] text-warm-400 mt-1.5 leading-relaxed">
          Key 仅存储在本地浏览器中，不会上传到任何服务器。
        </p>

        <div className="flex items-center gap-3 mt-2.5">
          <button
            onClick={handleTestKey}
            disabled={!keyValue || testing}
            className="px-3.5 py-1.5 rounded-full text-xs border border-warm-100/30 bg-warm-100/10 text-warm-100 hover:bg-warm-100/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {testing ? "测试中……" : "测试连接"}
          </button>
          {provider.id === "deepseek" && (
            <a
              href="https://platform.deepseek.com/api_keys"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-warm-300 underline underline-offset-2 hover:text-warm-100 transition-colors"
            >
              没有 Key？去 DeepSeek 申请 ↗
            </a>
          )}
        </div>
        {testResult && (
          <p className={`text-xs mt-2 ${testResult.ok ? "text-mood-good" : "text-red-300/90"}`}>
            {testResult.msg}
          </p>
        )}
      </div>

      {/* ── 语音识别（ASR）── */}
      <div className="glass p-4 mb-3">
        <div className="flex items-center gap-2 mb-3">
          <Mic size={16} className="text-warm-100" />
          <span className="text-sm text-warm-50">语音识别</span>
          <span className="text-[10px] text-warm-400 ml-auto">通话 · 长按语音</span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {(Object.keys(ASR_PRESETS) as Array<keyof typeof ASR_PRESETS>).map((k) => (
            <button
              key={k}
              onClick={() => updateSettings({ asrProvider: k })}
              aria-pressed={settings.asrProvider === k}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                settings.asrProvider === k
                  ? "bg-warm-100/15 border-warm-100/35 text-warm-100"
                  : "border-white/10 text-warm-300 hover:bg-white/5"
              }`}
            >
              {ASR_PRESETS[k].label}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="text-[10px] text-warm-300 tracking-[.12em]">
            {ASR_PRESETS[settings.asrProvider].label} API Key
          </span>
          <input
            type="password"
            value={settings.asrApiKey}
            onChange={(e) => {
              updateSettings({ asrApiKey: e.target.value });
              void saveSecretField("asrApiKey", e.target.value);
            }}
            placeholder="sk-……"
            className="mt-1 w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-warm-50 placeholder:text-warm-400 outline-none focus:border-warm-100/40 transition-colors font-mono"
            aria-label="语音识别 API Key"
          />
        </label>
        <p className="text-[10px] text-warm-400 mt-1.5 leading-relaxed">
          仅存本地。推荐 siliconflow.cn 注册免费额度；模型 SenseVoice 中文识别效果好。
        </p>
      </div>

      {/* ── 偏好设置 ── */}
      <div className="glass p-4 mb-3 space-y-4">
        <p className="text-[11px] text-warm-300 tracking-[.1em]">偏好设置</p>

        {/* Default Volume */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 size={16} className="text-warm-300" />
            <span className="text-sm text-warm-50">默认音量</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.defaultVolume}
            onChange={(e) => updateSettings({ defaultVolume: parseFloat(e.target.value) })}
            className="w-24 h-1 accent-warm-100"
            aria-label="默认音量"
          />
        </div>

        {/* Haptic */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Vibrate size={16} className="text-warm-300" />
            <span className="text-sm text-warm-50">触觉反馈</span>
          </div>
          <button
            onClick={() => updateSettings({ hapticEnabled: !settings.hapticEnabled })}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              settings.hapticEnabled ? "bg-warm-100/40" : "bg-white/10"
            }`}
            aria-label={settings.hapticEnabled ? "关闭触觉反馈" : "开启触觉反馈"}
          >
            <div
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                settings.hapticEnabled ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>

        {/* Breathing sound */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">🗣️</span>
            <span className="text-sm text-warm-50">呼吸语音引导</span>
          </div>
          <button
            onClick={() => updateSettings({ breathingSoundEnabled: !settings.breathingSoundEnabled })}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              settings.breathingSoundEnabled ? "bg-warm-100/40" : "bg-white/10"
            }`}
            aria-label={settings.breathingSoundEnabled ? "关闭呼吸语音" : "开启呼吸语音"}
          >
            <div
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                settings.breathingSoundEnabled ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>

        {/* Care notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">🔔</span>
            <div>
              <p className="text-sm text-warm-50">关怀通知</p>
              <p className="text-[10px] text-warm-400 leading-tight">深夜提醒 · 节气问候 · 天气变化</p>
            </div>
          </div>
          <button
            onClick={() => {
              const next = !settings.careNotifications;
              updateSettings({ careNotifications: next });
              // 同步给主进程调度器（经 preload 安全桥）
              window.tiantaiCare?.setEnabled(next);
            }}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              settings.careNotifications ? "bg-warm-100/40" : "bg-white/10"
            }`}
            aria-label={settings.careNotifications ? "关闭关怀通知" : "开启关怀通知"}
          >
            <div
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                settings.careNotifications ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>

        {/* Close to tray */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">📥</span>
            <div>
              <p className="text-sm text-warm-50">关闭时隐藏到托盘</p>
              <p className="text-[10px] text-warm-400 leading-tight">点 × 缩进托盘，右键托盘才彻底退出</p>
            </div>
          </div>
          <button
            onClick={() => {
              const next = !settings.closeToTray;
              updateSettings({ closeToTray: next });
              window.tiantaiCare?.setCloseToTray(next);
            }}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              settings.closeToTray ? "bg-warm-100/40" : "bg-white/10"
            }`}
            aria-label={settings.closeToTray ? "关闭时直接退出" : "关闭时隐藏到托盘"}
          >
            <div
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                settings.closeToTray ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>

        {/* 今天页实景天台 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">🌇</span>
            <div>
              <p className="text-sm text-warm-50">今天页实景天台</p>
              <p className="text-[10px] text-warm-400 leading-tight">黎明 / 傍晚 / 深夜为三渲二实时场景，关闭回退照片横幅</p>
            </div>
          </div>
          <button
            onClick={() => updateSettings({ useSceneBanner: !settings.useSceneBanner })}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              settings.useSceneBanner ? "bg-warm-100/40" : "bg-white/10"
            }`}
            aria-label={settings.useSceneBanner ? "关闭实景天台" : "开启实景天台"}
          >
            <div
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                settings.useSceneBanner ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Achievements */}
      <div className="glass p-4 mb-3">
        <p className="text-[11px] text-warm-300 tracking-[.1em] mb-3">陪伴成就</p>
        {unlocked.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {unlocked.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warm-100/10 border border-warm-100/20 text-xs text-warm-50"
                title={a.description}
              >
                <span>{a.icon}</span>
                <span>{a.title}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-warm-400">还没有成就，去记录今天的心情吧~</p>
        )}
        {achievements.filter((a) => !a.unlockedAt).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {achievements
              .filter((a) => !a.unlockedAt)
              .map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-warm-400 opacity-50"
                  title={a.description}
                >
                  <span>{a.icon}</span>
                  <span>{a.title}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Data Export */}
      <div className="glass p-4 mb-3">
        <p className="text-[11px] text-warm-300 tracking-[.1em] mb-3">数据管理</p>
        <div className="space-y-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-warm-50 hover:bg-white/10 transition-colors"
          >
            <Download size={16} />
            导出全部数据 (JSON)
          </button>

          <label
            htmlFor="import-data-input"
            className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-warm-50 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Upload size={16} />
            从 JSON 恢复数据
          </label>
          <input
            id="import-data-input"
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                const ok = useAppStore.getState().importData(await file.text());
                setImportMsg(ok ? "✅ 数据已恢复" : "❌ 文件格式不对");
              } catch {
                setImportMsg("❌ 读取文件失败");
              }
              setTimeout(() => setImportMsg(null), 4000);
            }}
          />

          {window.tiantaiBackup && (
            <button
              onClick={async () => {
                const json = exportData();
                const ok = await window.tiantaiBackup!.backup(json);
                setImportMsg(ok ? "✅ 已备份到应用数据目录" : "❌ 备份失败");
                setTimeout(() => setImportMsg(null), 4000);
              }}
              className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-warm-50 hover:bg-white/10 transition-colors"
            >
              <Save size={16} />
              备份到电脑（保留最近 7 份）
            </button>
          )}

          {importMsg && (
            <p className={`text-xs ${importMsg.startsWith("✅") ? "text-mood-good" : "text-red-300/90"}`}>
              {importMsg}
            </p>
          )}
        </div>
      </div>

      {/* App info */}
      <p className="text-center text-[10px] text-warm-400 mt-6 leading-relaxed">
        天台 v2.1 · 你的隐私陪伴 · AI 由你自己的 Key 驱动
        <br />
        陪伴工具，不能替代专业帮助；情绪危机请拨打心理援助热线 12356
      </p>
    </div>
  );
}
