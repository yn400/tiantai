export type Expression = "happy" | "calm" | "worried" | "sad" | "listening" | "shy";

interface Props {
  expression?: Expression;
  size?: number;
  breathing?: boolean;
  hugging?: boolean;
  talking?: boolean;
}

// DiceBear lorelei style — cute portrait avatar with hair, eyes, smile
// Seed "tiantai" generates a consistent character
const AVATAR_BASE = "https://api.dicebear.com/9.x/lorelei/svg";

export default function Avatar({
  expression = "calm",
  size = 160,
  breathing = true,
  hugging = false,
}: Props) {
  // Expression → DiceBear mood modifier (mouth style)
  const mood = expression === "happy" ? "happy" : expression === "sad" ? "sad" : "happy";

  return (
    <div
      className={`relative flex items-center justify-center ${breathing && !hugging ? "animate-[companionFloat_3s_ease-in-out_infinite]" : ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Particle ring */}
      <div className="absolute inset-0 rounded-full animate-[spin_14s_linear_infinite]" style={{
        border: "1px solid rgba(240,185,107,0.10)",
        borderTopColor: "rgba(240,185,107,0.18)",
        transform: "scale(0.96)",
      }} />
      <div className="absolute inset-0 rounded-full animate-[spin_9s_linear_infinite_reverse]" style={{
        border: "1px solid rgba(180,160,210,0.06)",
        borderBottomColor: "rgba(180,160,210,0.12)",
        transform: "scale(0.86)",
      }} />

      {/* DiceBear Avatar Image */}
      <img
        src={`${AVATAR_BASE}?seed=tiantai&mood=${mood}&backgroundColor=ffdfbf`}
        alt="小天"
        width={size * 0.82}
        height={size * 0.82}
        className="rounded-full"
        style={{
          filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.12))",
          background: "linear-gradient(135deg, rgba(240,185,107,.12), rgba(255,255,255,.05))",
        }}
      />

      {/* Hug arms */}
      {hugging && (
        <>
          <div className="absolute animate-fade-in rounded-full" style={{
            width: size * 0.2, height: size * 0.6,
            background: "linear-gradient(90deg, #f5d8c0, #e8c0a8)",
            borderRadius: "40% 0 0 40%",
            left: -size * 0.18, top: size * 0.18,
          }} />
          <div className="absolute animate-fade-in rounded-full" style={{
            width: size * 0.2, height: size * 0.6,
            background: "linear-gradient(270deg, #f5d8c0, #e8c0a8)",
            borderRadius: "0 40% 40% 0",
            right: -size * 0.18, top: size * 0.18,
          }} />
        </>
      )}
    </div>
  );
}
