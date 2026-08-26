import { useState } from "react";
import { useAppStore } from "../stores/appStore";

// ── 感恩墙（已持久化）──────────────────────────────────────────
// 修复旧版：便签原先只存 useState，刷新即蒸发；现接入 zustand persist。
export default function GratitudeWall() {
  const notes = useAppStore((s) => s.gratitudeNotes);
  const addGratitudeNote = useAppStore((s) => s.addGratitudeNote);
  const [input, setInput] = useState("");

  const addNote = () => {
    if (!input.trim()) return;
    addGratitudeNote({
      id: `g-${Date.now()}`,
      text: input.trim(),
      x: 10 + Math.random() * 80,
      y: 10 + Math.random() * 70,
      rotation: (Math.random() - 0.5) * 15,
      createdAt: Date.now(),
    });
    setInput("");
    if (navigator.vibrate) navigator.vibrate(15);
  };

  return (
    <div className="page-enter">
      <div className="pt-[52px] px-[18px] mb-4">
        <h1 className="font-xiaowei text-[25px] text-warm-50">感恩墙</h1>
        <p className="text-[11px] text-warm-300 mt-1 tracking-[.08em]">写下让你感到温暖的事 · 会一直留在这里</p>
      </div>

      {/* Input */}
      <div className="px-[18px] mb-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addNote()}
          placeholder="今天有什么让你感恩的？"
          className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-warm-50 placeholder:text-warm-400 outline-none focus:border-warm-100/40 font-serif"
        />
        <button
          onClick={addNote}
          className="px-4 py-2 rounded-xl text-sm text-sky-950 font-serif"
          style={{ background: "linear-gradient(135deg, #f0b96b, #e07d3a)" }}
        >
          添加
        </button>
      </div>

      {/* Notes wall */}
      <div className="relative mx-[18px] min-h-[300px] rounded-2xl border border-white/10 bg-white/[.02] overflow-hidden pb-6">
        {notes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-warm-400">这里还空着，添一张便签吧~</p>
          </div>
        )}
        {notes.map((n) => (
          <div
            key={n.id}
            className="absolute p-3 rounded-lg shadow-lg animate-fade-in"
            style={{
              left: `${n.x}%`,
              top: `${n.y}%`,
              transform: `translate(-50%, -50%) rotate(${n.rotation}deg)`,
              background: "linear-gradient(135deg, rgba(240,185,107,0.15), rgba(255,255,255,0.08))",
              border: "1px solid rgba(240,185,107,0.2)",
              maxWidth: "180px",
              backdropFilter: "blur(8px)",
            }}
          >
            <p className="text-xs text-warm-50 leading-relaxed">{n.text}</p>
            <p className="text-[9px] text-warm-400 mt-1.5 tracking-wide">
              {new Date(n.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
