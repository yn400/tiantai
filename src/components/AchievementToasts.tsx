import { useEffect, useState } from "react";
import { onCelebrate, type Celebration } from "../utils/celebrate";

// ── 成就解锁时刻 Toast（Finch 式庆祝感）────────────────────────
// 队列化展示：连续解锁时依次浮现，不打架。
export default function AchievementToasts() {
  const [queue, setQueue] = useState<Celebration[]>([]);
  const [current, setCurrent] = useState<Celebration | null>(null);

  useEffect(
    () => onCelebrate((c) => setQueue((q) => [...q, c])),
    [],
  );

  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
    if (navigator.vibrate) navigator.vibrate([15, 40, 15, 40, 30]);
    const t = setTimeout(() => setCurrent(null), 3400);
    return () => clearTimeout(t);
  }, [queue, current]);

  if (!current) return null;

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[300] pointer-events-none" role="status" aria-live="polite">
      <div
        key={current.title}
        className="glass px-5 py-3 flex items-center gap-3 animate-[toastIn_.35s_ease_forwards]"
        style={{
          background: "linear-gradient(160deg, rgba(240,185,107,.18), rgba(255,255,255,.06))",
          borderColor: "rgba(240,185,107,.32)",
          boxShadow: "0 8px 32px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.08)",
        }}
      >
        <span className="text-[26px] animate-[companionBounce_.5s_ease]">{current.icon}</span>
        <div>
          <p className="text-[10px] text-warm-300 tracking-[.14em]">✨ 解锁成就</p>
          <p className="text-sm text-warm-50 tracking-wide">{current.title}</p>
        </div>
      </div>
    </div>
  );
}
