// ── 指针拖尾 FX（引擎托管版）────────────────────────────────────
// 相比旧实现：rAF 循环与 resize 监听交给 fx/engine（修复 HMR 下监听器
// 泄漏与模块级循环常驻），粒子位移经 dtScale 归一化。

import { addFXLayer } from "../fx/engine";

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  type: "ripple" | "float";
  hue: number;
}

const particles: Particle[] = [];
let mouseX = 0, mouseY = 0;
let lastSpawn = 0;
let pointersBound = false;

function onMouseMove(e: MouseEvent) {
  mouseX = e.clientX; mouseY = e.clientY;
  const now = Date.now();
  if (now - lastSpawn > 40) {
    spawnAtMouse();
    lastSpawn = now;
  }
}

function onTouchMove(e: TouchEvent) {
  if (e.touches.length > 0) {
    mouseX = e.touches[0].clientX;
    mouseY = e.touches[0].clientY;
    const now = Date.now();
    if (now - lastSpawn > 40) {
      spawnAtMouse();
      lastSpawn = now;
    }
  }
}

function spawnAtMouse() {
  // 涟漪：扩散水圈
  particles.push({
    x: mouseX, y: mouseY, vx: 0, vy: 0,
    life: 0, maxLife: 35,
    size: 3, type: "ripple", hue: 200 + Math.random() * 30,
  });
  // 浮光
  if (Math.random() < 0.6) {
    particles.push({
      x: mouseX + (Math.random() - 0.5) * 15,
      y: mouseY + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 1 - 0.3,
      life: 0, maxLife: 40 + Math.random() * 20,
      size: 1.5 + Math.random() * 2.5,
      type: "float",
      hue: 200 + Math.random() * 40,
    });
  }
}

/** 在指定位置生成一簇浮光粒子（伙伴拖拽、释放时调用） */
export function spawnTrail(x: number, y: number, count = 3): void {
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -Math.random() * 1.5 - 0.3,
      life: 0, maxLife: 30 + Math.random() * 25,
      size: 2 + Math.random() * 3,
      type: "float",
      hue: 35 + Math.random() * 20,
    });
  }
}

/**
 * 把一个 canvas 注册为拖尾层。返回注销函数。
 */
export function initTrailCanvas(c: HTMLCanvasElement): () => void {
  if (!pointersBound && typeof window !== "undefined") {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    pointersBound = true;
  }

  return addFXLayer(c, {
    id: "pointer-trail",
    draw: (f) => {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += f.dtScale;
        p.x += p.vx * f.dtScale;
        p.y += p.vy * f.dtScale;
        const alpha = 1 - p.life / p.maxLife;
        if (alpha <= 0) { particles.splice(i, 1); continue; }

        if (p.type === "ripple") {
          // 扩散水环
          const r = p.size + (1 - alpha) * 40;
          f.ctx.beginPath();
          f.ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          f.ctx.strokeStyle = `hsla(${p.hue},60%,70%,${(alpha * 0.4).toFixed(3)})`;
          f.ctx.lineWidth = 1.5 * alpha;
          f.ctx.stroke();
          if (alpha > 0.3) {
            f.ctx.beginPath();
            f.ctx.arc(p.x, p.y, r * 0.6, 0, Math.PI * 2);
            f.ctx.strokeStyle = `hsla(${p.hue},50%,80%,${(alpha * 0.25).toFixed(3)})`;
            f.ctx.lineWidth = 0.8;
            f.ctx.stroke();
          }
        } else {
          // 柔浮光斑
          const grad = f.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
          grad.addColorStop(0, `hsla(${p.hue},60%,80%,${(alpha * 0.6).toFixed(3)})`);
          grad.addColorStop(0.5, `hsla(${p.hue},50%,70%,${(alpha * 0.25).toFixed(3)})`);
          grad.addColorStop(1, "rgba(0,0,0,0)");
          f.ctx.beginPath();
          f.ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
          f.ctx.fillStyle = grad;
          f.ctx.fill();
        }
      }
    },
  });
}
