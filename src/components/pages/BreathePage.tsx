import { useState, useRef, useCallback, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { speakText, stopSpeaking } from "../../utils/speech";
import { addFXLayer } from "../../fx/engine";
import Avatar from "../Avatar";
import type { Expression } from "../Avatar";

export default function BreathePage() {
  const settings = useAppStore((s) => s.settings);
  const addBreathLog = useAppStore((s) => s.addBreathLog);
  const breathLogs = useAppStore((s) => s.breathLogs);

  const [phase, setPhase] = useState<"idle" | "inhale" | "hold" | "exhale">("idle");
  const [count, setCount] = useState(0);
  const [cycles, setCycles] = useState(0);
  const [showCelebrate, setShowCelebrate] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cyclesRef = useRef(0);
  const activeRef = useRef(false);

  // Particle state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // 呼吸粒子：极坐标 + 引擎托管（相位切换不再销毁重建动画循环）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    type P = { ang: number; dist: number; size: number; alpha: number };
    const ps: P[] = Array.from({ length: 60 }, () => ({
      ang: Math.random() * Math.PI * 2,
      dist: 0.35 + Math.random() * 0.65,
      size: 1.5 + Math.random() * 2.5,
      alpha: 0.3 + Math.random() * 0.5,
    }));
    let glowCache: { key: string; grad: CanvasGradient } | null = null;

    return addFXLayer(canvas, {
      id: "breathe",
      draw: (f) => {
        const cx = f.width / 2;
        const cy = f.height / 2;
        const R = Math.min(f.width, f.height) * 0.42;
        const ph = phaseRef.current;
        const glowAlpha = ph === "idle" ? 0.3 : 0.8;

        for (const p of ps) {
          // 吸气扩散、呼气收拢、屏住微缩，向目标半径平滑插值
          const target =
            ph === "inhale" ? Math.min(1, p.dist * 1.15 + 0.02)
            : ph === "exhale" ? Math.max(0.12, p.dist * 0.72)
            : ph === "hold" ? p.dist * 0.85
            : p.dist;
          p.dist += (target - p.dist) * 0.06;

          // 缓慢公转，让粒子群有生命感而非机械缩放
          const a = p.ang + f.tSec * 0.05;
          const x = cx + Math.cos(a) * p.dist * R;
          const y = cy + Math.sin(a) * p.dist * R;

          f.ctx.beginPath();
          f.ctx.arc(x, y, p.size, 0, Math.PI * 2);
          f.ctx.fillStyle = `rgba(240,185,107,${(p.alpha * glowAlpha).toFixed(3)})`;
          f.ctx.fill();
        }

        // 中心辉光（按尺寸+相位缓存渐变对象）
        const key = `${Math.round(R)}-${ph}`;
        if (!glowCache || glowCache.key !== key) {
          const spread = ph === "inhale" ? 1 : ph === "exhale" ? 1.6 : ph === "hold" ? 0.4 : 1;
          const g = f.ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(30, 90 * spread));
          g.addColorStop(0, `rgba(240,185,107,${0.15 * glowAlpha})`);
          g.addColorStop(1, "rgba(0,0,0,0)");
          glowCache = { key, grad: g };
        }
        f.ctx.fillStyle = glowCache.grad;
        f.ctx.fillRect(0, 0, f.width, f.height);
      },
    });
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    activeRef.current = false;
    setPhase("idle");
    setCount(0);
    stopSpeaking();
  }, []);

  const runPhase = useCallback((p: "inhale" | "hold" | "exhale") => {
    if (!activeRef.current) return;
    const dur = { inhale: 4, hold: 4, exhale: 6 }[p];
    setPhase(p);
    setCount(dur);

    if (settings.breathingSoundEnabled) {
      const labels = { inhale: "吸气", hold: "屏住", exhale: "呼气" };
      speakText(labels[p]);
    }

    let c = dur;
    const tick = () => {
      if (!activeRef.current) return;
      c--;
      if (c <= 0) {
        const nxt = p === "inhale" ? "hold" : p === "hold" ? "exhale" : "inhale";
        if (p === "exhale") {
          const newCycles = cyclesRef.current + 1;
          cyclesRef.current = newCycles;
          setCycles(newCycles);

          if (newCycles % 5 === 0) {
            setShowCelebrate(true);
            if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 100]);
            setTimeout(() => setShowCelebrate(false), 2500);
          }
          addBreathLog({ cycles: 1, timestamp: Date.now() });
        }
        runPhase(nxt);
      } else {
        setCount(c);
        timerRef.current = setTimeout(tick, 1000);
      }
    };
    timerRef.current = setTimeout(tick, 1000);
  }, [settings.breathingSoundEnabled, addBreathLog]);

  const start = useCallback(() => {
    activeRef.current = true;
    cyclesRef.current = 0;
    setCycles(0);
    runPhase("inhale");
  }, [runPhase]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      stopSpeaking();
    };
  }, []);

  const sz = phase === "inhale" ? 130 : phase === "exhale" ? 100 : 116;

  // Avatar expression
  const avExpr: Expression = phase === "idle" ? "calm" : "listening";

  // Weekly stats
  const weekAgo = Date.now() - 7 * 86400000;
  const weeklyLogs = breathLogs.filter((l) => l.timestamp > weekAgo);
  const totalCycles = weeklyLogs.reduce((s, l) => s + l.cycles, 0);

  return (
    <div className="flex flex-col items-center px-[18px] page-enter">
      <div className="self-start w-full pt-[52px]">
        <h1 className="font-xiaowei text-[25px] text-warm-50">呼吸</h1>
        <p className="text-[11px] text-warm-300 mt-1.5 tracking-[.1em]">4 · 4 · 6 · 放松神经系统</p>
      </div>

      <div className="flex flex-col items-center gap-6 py-3 flex-1 relative w-full">
        {/* Particle canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
          aria-hidden="true"
        />

        {/* Avatar breathing */}
        <div className="relative z-[1] mt-2" style={{ transition: "transform 0.8s ease", transform: `scale(${phase === "inhale" ? 1.08 : phase === "exhale" ? 0.92 : 1})` }}>
          <Avatar
            expression={avExpr}
            size={sz}
            breathing={phase !== "idle"}
          />
        </div>

        {/* Phase label + count */}
        <div className="text-center z-[1]">
          <button
            onClick={() => (activeRef.current ? stop() : start())}
            className="font-xiaowei text-xl text-warm-100 tracking-[.12em] mb-1"
          >
            {phase === "idle" ? "点击开始" : phase === "inhale" ? "吸 气" : phase === "hold" ? "屏 住" : "呼 气"}
          </button>
          {phase !== "idle" && (
            <div className="text-[40px] font-light text-warm-50">{count}</div>
          )}
        </div>

        {/* Celebration */}
        {showCelebrate && (
          <div className="animate-fade-in text-center z-[1]">
            <span className="text-3xl">✨</span>
            <p className="text-sm text-warm-100 mt-1">完成 {cycles} 次循环！</p>
          </div>
        )}

        {cycles > 0 && !showCelebrate && (
          <p className="text-[13px] text-warm-300 z-[1]">
            已完成 <span className="text-warm-100 text-[17px]">{cycles}</span> 次循环
          </p>
        )}

        {/* Guide */}
        <div className="glass p-[17px_18px] w-full z-[1]">
          <p className="text-[11px] text-warm-300 tracking-[.1em] mb-3">呼吸节律</p>
          {[
            { name: "吸气", dur: "4秒", color: "#f0b96b" },
            { name: "屏住", dur: "4秒", color: "#b8a7e8" },
            { name: "呼气", dur: "6秒", color: "#7eccc8" },
          ].map((s) => (
            <div key={s.name} className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2 text-[13px] text-warm-50">
                <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                {s.name}
              </div>
              <span className="text-[12px] text-warm-300">{s.dur}</span>
            </div>
          ))}
          <p className="text-[11.5px] text-warm-300 leading-[1.75] mt-2">
            规律呼吸激活副交感神经，快速舒缓焦虑与紧绷感。
          </p>
        </div>

        {weeklyLogs.length > 0 && (
          <div className="glass p-3.5 w-full text-center z-[1]">
            <p className="text-[11px] text-warm-300 tracking-[.1em]">
              本周练习 <span className="text-warm-100">{weeklyLogs.length}</span> 次 · 共{" "}
              <span className="text-warm-100">{totalCycles}</span> 个循环
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
