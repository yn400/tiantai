// ── FX Engine：全应用唯一的装饰性 Canvas 调度器 ─────────────────────
//
// 设计原则（对齐主流做法）：
// - 单一 rAF 循环驱动所有图层（GSAP ticker / Framer Motion 同思路），
//   替代此前 Stars / 天气 / 拖尾 / 呼吸各自为政的 4 个循环
// - DPR 感知 + ResizeObserver 自动重设尺寸，位图仅在尺寸变化时重建
// - dt 归一化：动画速度与帧率解耦（高刷屏不再加速、掉帧不再瞬移）
// - prefers-reduced-motion：声明 staticWhenReducedMotion 的层只绘制静态帧
// - 故障隔离：单层 draw 抛错自动摘除，不影响其余层（ErrorBoundary 思想）

export const REDUCED_MOTION =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface FXFrame {
  ctx: CanvasRenderingContext2D;
  /** CSS 像素宽 */
  width: number;
  /** CSS 像素高 */
  height: number;
  /** 相对 60fps 的速度倍率（60fps=1），位移量请乘以它 */
  dtScale: number;
  /** 引擎纪元起的秒数，用于相位/闪烁 */
  tSec: number;
}

export interface FXLayerOptions {
  id?: string;
  /** reduced-motion 时改为仅静态绘制一次（适合氛围背景类） */
  staticWhenReducedMotion?: boolean;
  draw: (f: FXFrame) => void;
  onResize?: (width: number, height: number) => void;
}

interface LayerRecord extends FXLayerOptions {
  id: string;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  ro: ResizeObserver;
}

const layers = new Map<string, LayerRecord>();
let uid = 0;
let rafId = 0;
let lastTs = 0;
let epoch = 0;
let running = false;

function dpr(): number {
  return window.devicePixelRatio || 1;
}

/** 位图单边上限：防御性钳制，杜绝任何反馈回路把位图吹到 GB 级 */
const MAX_BITMAP_DIM = 4096;

function measure(l: LayerRecord): boolean {
  const c = l.canvas;
  // ── 尺寸来源：父容器而非画布自身 ──────────────────────────
  // 本机器（Windows 缩放 164%）上，canvas 的 clientWidth 曾被
  // 位图反馈污染成指数膨胀值；父容器由正常文档布局驱动，永远可信。
  const p = c.parentElement;
  let w = (p && p.clientWidth) || c.clientWidth || c.offsetWidth;
  let h = (p && p.clientHeight) || c.clientHeight || c.offsetHeight;
  if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return false;

  // 全屏层（fixed inset-0）的父级可能是 body，取视口更稳
  const cs = getComputedStyle(c);
  if (cs.position === "fixed") {
    w = Math.max(w, window.innerWidth);
    h = Math.max(h, window.innerHeight);
  }

  const ratio = dpr();
  let bw = Math.round(w * ratio);
  let bh = Math.round(h * ratio);
  const shrink = Math.min(1, MAX_BITMAP_DIM / Math.max(bw, bh));
  bw = Math.max(1, Math.round(bw * shrink));
  bh = Math.max(1, Math.round(bh * shrink));
  if (c.width !== bw || c.height !== bh) {
    c.width = bw;
    c.height = bh;
  }
  // 钉死 CSS 尺寸到父容器实测值，切断任何"位图→布局"反馈
  const sw = `${Math.round(w)}px`;
  const sh = `${Math.round(h)}px`;
  if (c.style.width !== sw) c.style.width = sw;
  if (c.style.height !== sh) c.style.height = sh;

  l.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  if (l.width !== w || l.height !== h) {
    l.width = w;
    l.height = h;
    l.onResize?.(w, h);
  }
  return true;
}

function tick(ts: number): void {
  if (!running) return;
  if (!lastTs) lastTs = ts;
  const dtMs = Math.min(48, ts - lastTs);
  lastTs = ts;
  const tSec = (ts - epoch) / 1000;
  const dtScale = dtMs / 16.6667;

  for (const l of Array.from(layers.values())) {
    if (!measure(l)) continue;
    l.ctx.clearRect(0, 0, l.width, l.height);
    try {
      l.draw({ ctx: l.ctx, width: l.width, height: l.height, dtScale, tSec });
    } catch (err) {
      // 故障层自动摘除，不让一颗粒子打死整片星空
      console.error(`[fx] layer "${l.id}" draw error, removing`, err);
      layers.delete(l.id);
    }
  }
  rafId = requestAnimationFrame(tick);
}

function ensureLoop(): void {
  if (running) return;
  running = true;
  lastTs = 0;
  epoch = performance.now();
  rafId = requestAnimationFrame(tick);
}

// 窗口尺寸变化：解除 CSS 钉扎让布局回流，下一帧引擎按新尺寸重新钉扎
if (typeof window !== "undefined") {
  window.addEventListener("resize", () => {
    for (const l of layers.values()) {
      l.canvas.style.width = "";
      l.canvas.style.height = "";
      l.width = 0;
      l.height = 0;
    }
  }, { passive: true });
}

function stopLoop(): void {
  running = false;
  cancelAnimationFrame(rafId);
}

/**
 * 注册一个 FX 图层。返回注销函数（React effect cleanup 直接返回它即可）。
 */
export function addFXLayer(
  target: HTMLCanvasElement,
  options: FXLayerOptions,
): () => void {
  const ctx = target.getContext("2d");
  if (!ctx) return () => {};

  const record: LayerRecord = {
    ...options,
    id: options.id ?? `fx-${++uid}`,
    canvas: target,
    ctx,
    width: 0,
    height: 0,
    ro: null as unknown as ResizeObserver,
  };

  record.ro = new ResizeObserver(() => {
    const ok = measure(record);
    // 静态层在 reduced-motion 下没有循环，靠 resize 回调补绘
    if (ok && REDUCED_MOTION && record.staticWhenReducedMotion) {
      record.ctx.clearRect(0, 0, record.width, record.height);
      record.draw({
        ctx: record.ctx,
        width: record.width,
        height: record.height,
        dtScale: 1,
        tSec: 0,
      });
    }
  });
  record.ro.observe(target);

  layers.set(record.id, record);
  measure(record);

  if (!(REDUCED_MOTION && record.staticWhenReducedMotion)) ensureLoop();

  return () => {
    record.ro.disconnect();
    layers.delete(record.id);
    record.ctx.clearRect(0, 0, record.width, record.height);
    if (layers.size === 0) stopLoop();
  };
}
