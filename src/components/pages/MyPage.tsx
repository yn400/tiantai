import { useState } from "react";
import SettingsPage from "./SettingsPage";
import MailboxPage from "./MailboxPage";
import DoodlePage from "./DoodlePage";
import GratitudeWall from "../GratitudeWall";
import MemoryTimeline from "../MemoryTimeline";
import { useAppStore } from "../../stores/appStore";
import { chatWithAI, resolveActiveModel } from "../../utils/aiClient";
import { buildStoryPrompt } from "../../utils/deepseek";
import { speakText } from "../../utils/speech";

type SubTab = "settings" | "mailbox" | "doodle" | "gratitude" | "timeline";

const DAILY_CHALLENGES = [
  { icon: "💧", text: "喝一杯温水" },
  { icon: "🌿", text: "深呼吸 3 次" },
  { icon: "📝", text: "写下一件感恩的事" },
  { icon: "🚶", text: "起身走 5 分钟" },
  { icon: "💬", text: "对自己说一句温柔的话" },
  { icon: "🎵", text: "听一首喜欢的歌" },
  { icon: "🪟", text: "去窗边看 2 分钟天空" },
  { icon: "🤗", text: "给自己一个拥抱" },
];

export default function MyPage() {
  const [subTab, setSubTab] = useState<SubTab>("settings");
  const settings = useAppStore((s) => s.settings);
  const [storyLoading, setStoryLoading] = useState(false);
  const [storyText, setStoryText] = useState<string | null>(null);

  const active = resolveActiveModel(settings);
  const hasKey = !!active.apiKey;

  // Daily challenge: pick based on day
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const challenge = DAILY_CHALLENGES[dayOfYear % DAILY_CHALLENGES.length];

  const generateStory = async () => {
    if (!hasKey || storyLoading) return;
    setStoryLoading(true);
    setStoryText(null);
    try {
      const story = await chatWithAI(
        [{ role: "system", content: buildStoryPrompt() }, { role: "user", content: "讲一个睡前故事" }],
        active.provider,
        active.model,
        active.apiKey,
      );
      setStoryText(story);
      speakText(story);
    } catch {
      setStoryText("生成失败了，但天台的风还在陪着你。");
    }
    setStoryLoading(false);
  };

  if (subTab === "mailbox") return <MailboxPage />;
  if (subTab === "doodle") return <DoodlePage />;
  if (subTab === "gratitude") return <GratitudeWall />;
  if (subTab === "timeline") return <MemoryTimeline />;

  return (
    <div className="px-[18px] pb-7 page-enter">
      <div className="pt-[52px] mb-4">
        <h1 className="font-xiaowei text-[25px] text-warm-50">我的</h1>
        <p className="text-[11px] text-warm-300 mt-1 tracking-[.08em]">工具 · 成就 · 故事</p>
      </div>

      {/* Daily challenge */}
      <div className="glass p-4 mb-4 flex items-center gap-3">
        <span className="text-2xl">{challenge.icon}</span>
        <div className="flex-1">
          <p className="text-[10px] text-warm-300 tracking-[.1em] uppercase">今日小挑战</p>
          <p className="text-sm text-warm-50 mt-0.5">{challenge.text}</p>
        </div>
        <div className="text-[10px] text-warm-400">每日更新</div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { icon: "💌", label: "天台信箱", sub: "写给未来的自己", tab: "mailbox" as SubTab },
          { icon: "🎨", label: "天台画板", sub: "涂鸦随风飘散", tab: "doodle" as SubTab },
          { icon: "🌟", label: "感恩墙", sub: "温暖的小事", tab: "gratitude" as SubTab },
          { icon: "📋", label: "记忆时间线", sub: "心情足迹", tab: "timeline" as SubTab },
        ].map((t) => (
          <button
            key={t.label}
            onClick={() => setSubTab(t.tab)}
            className="glass p-[14px_13px] flex gap-2.5 items-center cursor-pointer hover:bg-white/[0.07] transition-colors text-left"
          >
            <span className="text-[26px]">{t.icon}</span>
            <div>
              <div className="text-[13px] tracking-[.02em] text-warm-50">{t.label}</div>
              <div className="text-[10px] text-warm-300 mt-0.5">{t.sub}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Bedtime story */}
      <div className="glass p-4 mb-4">
        <p className="text-[11px] text-warm-300 tracking-[.1em] mb-3">🌙 AI 睡前故事</p>
        {storyText ? (
          <p className="text-sm text-warm-50 leading-relaxed mb-3">{storyText}</p>
        ) : (
          <p className="text-xs text-warm-400 mb-3">让小天为你讲一个温柔的故事</p>
        )}
        <button
          onClick={generateStory}
          disabled={storyLoading || !hasKey}
          className="w-full py-2.5 rounded-full text-sm font-serif tracking-[.05em] disabled:opacity-40"
          style={{
            background: hasKey
              ? "linear-gradient(135deg, #f0b96b, #e07d3a)"
              : "rgba(255,255,255,.08)",
            color: hasKey ? "#050810" : "rgba(237,229,216,.42)",
          }}
        >
          {storyLoading ? "生成中……" : storyText ? "再讲一个" : "生成睡前故事"}
        </button>
      </div>

      {/* Settings content */}
      <SettingsPage />
    </div>
  );
}
