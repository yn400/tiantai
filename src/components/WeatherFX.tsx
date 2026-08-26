import { useEffect, useRef } from "react";
import { addFXLayer } from "../fx/engine";

interface Drop {
  x: number; y: number;
  speed: number;
  size: number;
  wind: number;
  phase: number;
}

interface Props {
  cond: "rain" | "snow";
}

// ── 天气粒子层（雨/雪）────────────────────────────────────────
// 相比旧 App 内联实现：正弦相位替代逐粒子随机 alpha（消除每帧 fillStyle
// 抖动）、dt 归一化、尺寸变化自动重建。
export default function WeatherFX({ cond }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const isSnow = cond === "snow";
    let W = 0;
    let H = 0;
    let drops: Drop[] = [];

    const seed = (w: number, h: number) => {
      W = w; H = h;
      drops = Array.from({ length: isSnow ? 60 : 80 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        speed: (isSnow ? 0.3 : 3) + Math.random() * (isSnow ? 0.8 : 4),
        size: isSnow ? 1 + Math.random() * 3 : 0.5 + Math.random(),
        wind: (Math.random() - 0.5) * (isSnow ? 0.3 : 0.6),
        phase: Math.random() * Math.PI * 2,
      }));
    };

    return addFXLayer(canvas, {
      id: `weather-${cond}`,
      onResize: (w, h) => {
        if (w !== W || h !== H || drops.length === 0) seed(w, h);
      },
      draw: (f) => {
        for (const p of drops) {
          p.y += p.speed * f.dtScale;
          p.x += p.wind * f.dtScale;
          if (p.y > f.height) { p.y = -10; p.x = Math.random() * f.width; }
          if (p.x < 0) p.x = f.width;
          else if (p.x > f.width) p.x = 0;

          if (isSnow) {
            const a = 0.3 + 0.3 * (0.5 + 0.5 * Math.sin(f.tSec * 2 + p.phase));
            f.ctx.beginPath();
            f.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            f.ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
            f.ctx.fill();
          } else {
            const a = 0.15 + 0.15 * (0.5 + 0.5 * Math.sin(f.tSec * 3 + p.phase));
            f.ctx.beginPath();
            f.ctx.moveTo(p.x, p.y);
            f.ctx.lineTo(p.x + p.wind * 2, p.y + p.speed * 4);
            f.ctx.strokeStyle = `rgba(180,200,220,${a.toFixed(2)})`;
            f.ctx.lineWidth = p.size;
            f.ctx.stroke();
          }
        }
      },
    });
  }, [cond]);

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 z-[2] pointer-events-none"
      aria-hidden="true"
    />
  );
}
