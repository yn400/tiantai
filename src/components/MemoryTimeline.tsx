import { useAppStore } from "../stores/appStore";

export default function MemoryTimeline() {
  const moodHistory = useAppStore((s) => s.moodHistory);

  const sorted = [...moodHistory].reverse();

  return (
    <div className="page-enter">
      <div className="pt-[52px] px-[18px] mb-4">
        <h1 className="font-xiaowei text-[25px] text-warm-50">记忆时间线</h1>
        <p className="text-[11px] text-warm-300 mt-1 tracking-[.08em]">
          {sorted.length} 条心情记录
        </p>
      </div>

      <div className="px-[18px] pb-7">
        {sorted.length === 0 && (
          <div className="text-center py-16">
            <span className="text-5xl">📝</span>
            <p className="text-sm text-warm-400 mt-4">还没有记录，去「今天」页记录心情吧~</p>
          </div>
        )}

        <div className="relative pl-6 border-l border-white/10 space-y-5">
          {sorted.map((entry, i) => (
            <div key={i} className="relative animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
              {/* Dot */}
              <div
                className="absolute -left-[27px] top-1 w-3 h-3 rounded-full border-2 border-sky-950"
                style={{ background: entry.mood.color }}
              />

              {/* Date */}
              <p className="text-[10px] text-warm-400 mb-1 tracking-[.08em]">
                {new Date(entry.timestamp).toLocaleDateString("zh-CN", {
                  month: "short",
                  day: "numeric",
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>

              {/* Mood + note */}
              <div className="glass p-3">
                <span className="text-lg mr-2">{entry.mood.emoji}</span>
                <span className="text-sm text-warm-50">{entry.mood.label}</span>
                {entry.note && (
                  <p className="text-xs text-warm-300 mt-1.5 leading-relaxed">{entry.note}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
