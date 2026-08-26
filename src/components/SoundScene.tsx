import { useEffect, useRef } from "react";
import { addFXLayer } from "../fx/engine";
import type { SoundId } from "../types";

interface Props {
  /** 当前激活的声音 id 列表，以第一个为场景主调 */
  sounds: SoundId[];
}

// ── 声音场景画布：给每种环境音配一幅"活的风景" ─────────────────
// rain 雨夜窗光 / wind 山间雾流 / waves 远海波线 /
// fire 篝火星升 / night 夜城灯火 / white 微尘静界。
// 全部由统一 FX 引擎驱动；场景切换时重新播种粒子。

type Particle = {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  phase: number;
  hue: number; // 备用色相
};

export default function SoundScene({ sounds }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SoundId>(sounds[0] ?? "rain");

  useEffect(() => {
    if (sounds[0]) sceneRef.current = sounds[0];
  }, [sounds]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    let ps: Particle[] = [];
    let seededFor: SoundId | "" = "";
    let bgCache: { key: string; grad: CanvasGradient } | null = null;

    const seed = (id: SoundId, w: number, h: number): void => {
      seededFor = id;
      bgCache = null;
      const n =
        id === "rain" ? 60 : id === "night" ? 42 : id === "white" ? 26 : id === "fire" ? 22 : 14;
      ps = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * (id === "wind" ? 1.2 : 0.2),
        vy:
          id === "rain" ? 5 + Math.random() * 4
          : id === "fire" ? -(0.6 + Math.random() * 1.2)
          : id === "waves" ? 0
          : -(0.15 + Math.random() * 0.35),
        size: id === "night" ? 0.8 + Math.random() * 1.4 : 1 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
        hue: 200 + Math.random() * 40,
      }));
    };

    const background = (id: SoundId, f: { ctx: CanvasRenderingContext2D; width: number; height: number }) => {
      const key = `${id}-${f.width}x${f.height}`;
      if (bgCache && bgCache.key === key) {
        f.ctx.fillStyle = bgCache.grad;
        f.ctx.fillRect(0, 0, f.width, f.height);
        return;
      }
      const g = f.ctx.createLinearGradient(0, 0, 0, f.height);
      switch (id) {
        case "rain":
          g.addColorStop(0, "#0a1226"); g.addColorStop(1, "#101c38");
          break;
        case "wind":
          g.addColorStop(0, "#171230"); g.addColorStop(1, "#241d44");
          break;
        case "waves":
          g.addColorStop(0, "#07231f"); g.addColorStop(1, "#0d3a33");
          break;
        case "fire":
          g.addColorStop(0, "#160c06"); g.addColorStop(1, "#2b1508");
          break;
        case "night":
          g.addColorStop(0, "#05070f"); g.addColorStop(1, "#0d1424");
          break;
        default:
          g.addColorStop(0, "#0b0b10"); g.addColorStop(1, "#141420");
      }
      f.ctx.fillStyle = g;
      f.ctx.fillRect(0, 0, f.width, f.height);
      bgCache = { key, grad: g };
    };

    return addFXLayer(canvas, {
      id: "sound-scene",
      draw: (f) => {
        const id = sceneRef.current;
        if (id !== seededFor || ps.length === 0) seed(id, f.width, f.height);
        background(id, f);

        switch (id) {
          case "rain": {
            // 雨夜窗光：右上角一盏暖灯（每帧绘制，位置随呼吸微动）
            const gx = f.width * 0.82 + Math.sin(f.tSec * 0.6) * 4;
            const glow = f.ctx.createRadialGradient(gx, f.height * 0.25, 0, gx, f.height * 0.25, f.width * 0.45);
            glow.addColorStop(0, "rgba(240,185,107,.15)");
            glow.addColorStop(1, "rgba(0,0,0,0)");
            f.ctx.fillStyle = glow;
            f.ctx.fillRect(0, 0, f.width, f.height);
            // 雨丝 + 底部溅落涟漪
            for (const p of ps) {
              p.y += p.vy * f.dtScale;
              p.x += p.vx * f.dtScale - 0.6 * f.dtScale;
              if (p.y > f.height) { p.y = -8; p.x = Math.random() * f.width; }
              if (p.x < 0) p.x = f.width;
              f.ctx.beginPath();
              f.ctx.moveTo(p.x, p.y);
              f.ctx.lineTo(p.x - 1.2, p.y + p.size * 4);
              f.ctx.strokeStyle = `rgba(170,200,235,${(0.18 + 0.14 * Math.sin(f.tSec * 3 + p.phase)).toFixed(2)})`;
              f.ctx.lineWidth = 1;
              f.ctx.stroke();
            }
            const ry = f.height * 0.92;
            for (let i = 0; i < 3; i++) {
              const t = (f.tSec * 0.9 + i * 1.7) % 2;
              f.ctx.beginPath();
              f.ctx.arc(f.width * (0.2 + i * 0.28), ry, 2 + t * 12, 0, Math.PI * 2);
              f.ctx.strokeStyle = `rgba(170,200,235,${(0.16 * (1 - t / 2)).toFixed(3)})`;
              f.ctx.lineWidth = 1;
              f.ctx.stroke();
            }
            break;
          }
          case "wind": {
            // 横向漂流的雾带
            for (const p of ps) {
              p.x += p.vx * f.dtScale;
              if (p.x > f.width + 60) p.x = -60;
              const yy = p.y + Math.sin(f.tSec * 0.5 + p.phase) * 6;
              const g = f.ctx.createRadialGradient(p.x, yy, 0, p.x, yy, 46 + p.size * 10);
              g.addColorStop(0, "rgba(184,167,232,.09)");
              g.addColorStop(1, "rgba(0,0,0,0)");
              f.ctx.fillStyle = g;
              f.ctx.beginPath();
              f.ctx.arc(p.x, yy, 46 + p.size * 10, 0, Math.PI * 2);
              f.ctx.fill();
            }
            break;
          }
          case "waves": {
            // 五条呼吸波线
            for (let l = 0; l < 5; l++) {
              f.ctx.beginPath();
              for (let x = 0; x <= f.width; x += 8) {
                const y =
                  f.height * (0.35 + l * 0.13) +
                  Math.sin(x * 0.02 + f.tSec * (0.8 + l * 0.12) + l) * (4 + l * 1.6);
                if (x === 0) f.ctx.moveTo(x, y); else f.ctx.lineTo(x, y);
              }
              f.ctx.strokeStyle = `rgba(126,204,200,${(0.16 - l * 0.02).toFixed(3)})`;
              f.ctx.lineWidth = 1.4;
              f.ctx.stroke();
            }
            break;
          }
          case "fire": {
            // 中央火光呼吸 + 升腾火星
            const flick = 0.75 + 0.25 * Math.sin(f.tSec * 7) * Math.sin(f.tSec * 3.3);
            const cx = f.width * 0.5;
            const cy = f.height * 0.95;
            const g = f.ctx.createRadialGradient(cx, cy, 0, cx, cy, f.height * (0.55 * flick + 0.15));
            g.addColorStop(0, `rgba(240,150,80,${(0.30 * flick).toFixed(3)})`);
            g.addColorStop(0.5, `rgba(240,185,107,${(0.10 * flick).toFixed(3)})`);
            g.addColorStop(1, "rgba(0,0,0,0)");
            f.ctx.fillStyle = g;
            f.ctx.fillRect(0, 0, f.width, f.height);

            for (const p of ps) {
              p.y += p.vy * f.dtScale;
              p.x += Math.sin(f.tSec * 2 + p.phase) * 0.4 * f.dtScale;
              if (p.y < -4) { p.y = f.height + 4; p.x = cx + (Math.random() - 0.5) * f.width * 0.3; }
              f.ctx.beginPath();
              f.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              f.ctx.fillStyle = `rgba(255,190,110,${(0.5 * flick).toFixed(2)})`;
              f.ctx.fill();
            }
            break;
          }
          case "night": {
            // 远处城市灯火，缓慢明灭
            for (const p of ps) {
              const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(f.tSec * (0.6 + p.size * 0.4) + p.phase));
              f.ctx.beginPath();
              f.ctx.arc(p.x, f.height * 0.55 + p.y * 0.45, p.size, 0, Math.PI * 2);
              f.ctx.fillStyle =
                p.hue > 215
                  ? `rgba(232,145,74,${(tw * 0.55).toFixed(3)})`
                  : `rgba(140,180,220,${(tw * 0.4).toFixed(3)})`;
              f.ctx.fill();
            }
            break;
          }
          default: {
            // 白噪音：极简微尘
            for (const p of ps) {
              p.y += p.vy * f.dtScale;
              if (p.y < -4) { p.y = f.height + 4; p.x = Math.random() * f.width; }
              const a = 0.12 + 0.18 * (0.5 + 0.5 * Math.sin(f.tSec + p.phase));
              f.ctx.beginPath();
              f.ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2);
              f.ctx.fillStyle = `rgba(237,229,216,${a.toFixed(3)})`;
              f.ctx.fill();
            }
          }
        }
      },
    });
  }, []);

  return (
    <canvas
      ref={ref}
      className="block w-full h-32"
      aria-hidden="true"
    />
  );
}
