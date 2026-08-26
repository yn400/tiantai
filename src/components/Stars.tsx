import { useEffect, useRef } from "react";
import { addFXLayer, type FXFrame } from "../fx/engine";

interface Star {
  x: number; y: number;
  r: number; phase: number;
  alpha: number; twinkleSpeed: number;
  vx: number; vy: number;
}

interface ShootingStar {
  x: number; y: number;
  dx: number; dy: number;
  life: number; maxLife: number;
  trail: { x: number; y: number }[];
}

// ── 星空层：极光渐变 + 闪烁星群 + 流星 ──────────────────────────
// 相比旧实现：渐变对象与昼夜判定缓存化（原来每帧新建/查询）、
// 速度经 dtScale 归一化、支持 reduced-motion 静态绘制。
export default function Stars() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    let W = 0;
    let H = 0;
    let stars: Star[] = [];
    let shoots: ShootingStar[] = [];
    let auroraCache: { key: string; grad: CanvasGradient } | null = null;
    let lastHourCheck = -Infinity;
    let isNightBucket = true;

    const seed = (w: number, h: number) => {
      W = w; H = h;
      stars = Array.from({ length: 120 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h * 0.85,
        r: 0.4 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.18 + Math.random() * 0.45,
        twinkleSpeed: 0.5 + Math.random() * 2,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.04,
      }));
      shoots = [];
      auroraCache = null;
    };

    const drawAurora = (f: FXFrame) => {
      // 昼夜判定每 30 秒刷新（旧版每帧 new Date().getHours()）
      if (f.tSec - lastHourCheck > 30) {
        lastHourCheck = f.tSec;
        const hour = new Date().getHours();
        isNightBucket = hour >= 20 || hour < 5;
      }
      // 极光中心缓慢漂移；位置按 24px 粒度进缓存键，避免每帧新建渐变
      const ax = f.width * 0.55 + Math.sin(f.tSec * 0.03) * 40;
      const key = `${f.width}x${f.height}-${isNightBucket}-${Math.round(ax / 24)}`;
      if (!auroraCache || auroraCache.key !== key) {
        const ay = f.height * 0.15;
        const grad = f.ctx.createRadialGradient(ax, ay, 0, f.width * 0.4, f.height * 0.2, f.width * 1.2);
        if (isNightBucket) {
          grad.addColorStop(0, "rgba(80,60,200,0.07)");
          grad.addColorStop(0.4, "rgba(40,30,120,0.04)");
        } else {
          grad.addColorStop(0, "rgba(240,185,107,0.06)");
          grad.addColorStop(0.4, "rgba(200,150,80,0.03)");
        }
        grad.addColorStop(1, "rgba(0,0,0,0)");
        auroraCache = { key, grad };
      }
      f.ctx.fillStyle = auroraCache.grad;
      f.ctx.fillRect(0, 0, f.width, f.height);
    };

    const dispose = addFXLayer(canvas, {
      id: "stars",
      staticWhenReducedMotion: true,
      onResize: (w, h) => {
        if (w !== W || h !== H || stars.length === 0) seed(w, h);
      },
      draw: (f) => {
        drawAurora(f);

        for (const s of stars) {
          s.x += s.vx * f.dtScale;
          s.y += s.vy * f.dtScale;
          if (s.x < -5) s.x = f.width + 5;
          else if (s.x > f.width + 5) s.x = -5;
          if (s.y < -5) s.y = f.height + 5;
          else if (s.y > f.height + 5) s.y = -5;

          const twinkle = 0.5 + 0.5 * Math.sin(f.tSec * s.twinkleSpeed + s.phase);
          const alpha = Math.min(s.alpha * (0.5 + 0.5 * twinkle), 0.9);

          f.ctx.beginPath();
          f.ctx.arc(s.x, s.y, s.r * (0.8 + twinkle * 0.4), 0, Math.PI * 2);
          f.ctx.fillStyle = `rgba(240,218,185,${alpha.toFixed(3)})`;
          f.ctx.fill();

          if (s.alpha > 0.4 && twinkle > 0.7) {
            f.ctx.beginPath();
            f.ctx.arc(s.x, s.y, s.r * 2.5, 0, Math.PI * 2);
            f.ctx.fillStyle = `rgba(240,218,185,${(alpha * 0.2).toFixed(3)})`;
            f.ctx.fill();
          }
        }

        // 流星
        for (let i = shoots.length - 1; i >= 0; i--) {
          const ss = shoots[i];
          ss.life += f.dtScale;
          ss.x += ss.dx * f.dtScale;
          ss.y += ss.dy * f.dtScale;
          ss.trail.push({ x: ss.x, y: ss.y });
          if (ss.trail.length > 20) ss.trail.shift();

          const progress = ss.life / ss.maxLife;
          const alpha = progress < 0.2 ? progress * 5 : 1 - (progress - 0.2) / 0.8;

          if (ss.trail.length > 2) {
            f.ctx.beginPath();
            f.ctx.moveTo(ss.trail[0].x, ss.trail[0].y);
            for (let j = 1; j < ss.trail.length; j++) f.ctx.lineTo(ss.trail[j].x, ss.trail[j].y);
            f.ctx.strokeStyle = `rgba(255,255,255,${(alpha * 0.6).toFixed(3)})`;
            f.ctx.lineWidth = 1.5;
            f.ctx.stroke();
          }

          f.ctx.beginPath();
          f.ctx.arc(ss.x, ss.y, 2.5, 0, Math.PI * 2);
          f.ctx.fillStyle = `rgba(255,255,255,${(alpha * 0.9).toFixed(3)})`;
          f.ctx.fill();

          if (ss.life >= ss.maxLife || ss.x < -20 || ss.x > f.width + 20 || ss.y > f.height + 20) {
            shoots.splice(i, 1);
          }
        }

        if (shoots.length < 3 && Math.random() < 0.005 * f.dtScale) {
          const angle = -0.25 - Math.random() * 0.6;
          const speed = 4 + Math.random() * 7;
          shoots.push({
            x: Math.random() * f.width * 0.7,
            y: Math.random() * f.height * 0.3,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            life: 0,
            maxLife: 35 + Math.random() * 35,
            trail: [],
          });
        }
      },
    });

    return dispose;
  }, []);

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 z-0 pointer-events-none"
      aria-hidden="true"
    />
  );
}
