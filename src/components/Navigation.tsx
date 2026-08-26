import { Sun, Wind, MessageCircle, Music, User } from "lucide-react";
import { useAppStore } from "../stores/appStore";

const tabs = [
  { icon: Sun, label: "今天" },
  { icon: Wind, label: "呼吸" },
  { icon: MessageCircle, label: "聊聊" },
  { icon: Music, label: "声音" },
  { icon: User, label: "我的" },
];

export default function Navigation() {
  const tab = useAppStore((s) => s.tab);
  const setTab = useAppStore((s) => s.setTab);

  return (
    <nav
      className="flex bg-sky-950/94 backdrop-blur-2xl border-t border-white/10 z-10 shrink-0"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 4px)" }}
      role="tablist"
      aria-label="主导航"
    >
      {tabs.map((t, i) => {
        const Icon = t.icon;
        const active = tab === i;
        return (
          <button
            key={t.label}
            role="tab"
            aria-selected={active}
            aria-label={t.label}
            onClick={() => setTab(i)}
            className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 cursor-pointer bg-transparent border-none font-serif text-[10px] tracking-wider transition-colors relative ${
              active ? "text-warm-100" : "text-warm-300"
            }`}
          >
            <div
              className={`w-1 h-1 rounded-full bg-warm-100 absolute top-1.5 transition-opacity ${
                active ? "opacity-100" : "opacity-0"
              }`}
            />
            <Icon size={21} strokeWidth={1.5} />
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
