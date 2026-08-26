import { Phone } from "lucide-react";
import { HOTLINES, CRISIS_REPLY } from "../utils/crisis";

// ── 危机关怀卡片：出现在聊天流中的固定求助资源 ────────────────
export default function CrisisSupport() {
  return (
    <div
      className="self-stretch glass p-4 animate-fade-in"
      style={{
        background: "linear-gradient(160deg, rgba(240,185,107,.14), rgba(255,255,255,.05))",
        borderColor: "rgba(240,185,107,.35)",
      }}
      role="alert"
    >
      <p className="text-[13px] leading-[1.85] text-warm-50 whitespace-pre-wrap">{CRISIS_REPLY}</p>

      <div className="flex flex-col gap-2 mt-3.5">
        {HOTLINES.map((h) => (
          <a
            key={h.phone}
            href={`tel:${h.phone}`}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-warm-100/10 border border-warm-100/25 hover:bg-warm-100/20 transition-colors"
          >
            <span className="w-8 h-8 rounded-full bg-warm-100/20 flex items-center justify-center shrink-0">
              <Phone size={15} className="text-warm-100" />
            </span>
            <span className="min-w-0">
              <span className="block text-[12.5px] text-warm-50 truncate">
                {h.name}
                {h.note && <span className="text-warm-300"> · {h.note}</span>}
              </span>
              <span className="block text-[15px] font-mono tracking-wider text-warm-100">
                {h.display ?? h.phone}
              </span>
            </span>
          </a>
        ))}
      </div>

      <p className="text-[10px] text-warm-400 mt-3 leading-relaxed">
        天台是陪伴工具，不能替代专业帮助。以上热线以官方最新公布为准；紧急情况请拨打 120 / 110。
      </p>
    </div>
  );
}
