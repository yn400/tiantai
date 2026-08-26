import type { Mood } from "../types";

const MOODS: Mood[] = [
  { id: "rad", emoji: "🌟", label: "很好", color: "#f0b96b", bg: "rgba(240,185,107,.18)" },
  { id: "good", emoji: "🌿", label: "不错", color: "#7eccc8", bg: "rgba(126,204,200,.18)" },
  { id: "ok", emoji: "☁️", label: "平常", color: "#b8a7e8", bg: "rgba(184,167,232,.18)" },
  { id: "low", emoji: "🌧", label: "有点低", color: "#7aa8d4", bg: "rgba(122,168,212,.18)" },
  { id: "rough", emoji: "🌑", label: "很难", color: "#ff7e72", bg: "rgba(255,126,114,.18)" },
];

interface Props {
  current: Mood | null;
  onSelect: (mood: Mood) => void;
  size?: "sm" | "md";
}

export default function MoodOrbs({ current, onSelect, size = "md" }: Props) {
  const orbSize = size === "sm" ? "w-10 h-10 text-lg" : "w-[52px] h-[52px] text-[22px]";

  return (
    <div className="flex justify-around">
      {MOODS.map((m) => {
        const active = current?.id === m.id;
        return (
          <button
            key={m.id}
            onClick={() => {
              onSelect(m);
              if (navigator.vibrate) navigator.vibrate(15);
            }}
            title={m.label}
            aria-label={`心情：${m.label}`}
            className={`${orbSize} rounded-full flex items-center justify-center cursor-pointer transition-transform active:scale-90 border-[1.5px] border-white/10 bg-white/5 ${
              active ? "scale-[1.18]" : ""
            }`}
            style={
              active
                ? {
                    background: m.bg,
                    borderColor: m.color + "55",
                    boxShadow: `0 0 18px ${m.color}44`,
                  }
                : {}
            }
          >
            {m.emoji}
          </button>
        );
      })}
    </div>
  );
}

export { MOODS };
