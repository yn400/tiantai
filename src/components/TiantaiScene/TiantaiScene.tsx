// ── TiantaiScene.tsx:三渲二天台场景的 React 壳 ──────────────────────
// 职责边界:canvas 装卸 / ResizeObserver / 页面不可见即停渲染 / WebGL
// 失败兜底回照片横幅 / 卸载时全量 dispose。场景本体在 scene.ts(零 React 依赖)。
import { useEffect, useRef } from "react";
import {
  createTiantaiScene,
  type TiantaiSceneHandle,
  type TiantaiSlot,
  type TiantaiWeather,
} from "./scene";

interface TiantaiSceneProps {
  slot: TiantaiSlot;
  weather?: TiantaiWeather | null;
  /** 场景就绪后把句柄交给父级(滚动视差 / 切换机位) */
  onSceneReady?: (handle: TiantaiSceneHandle | null) => void;
  /** WebGL 创建失败或运行中丢失上下文 → 父级回退照片横幅 */
  onFallback?: () => void;
}

/** 本会话内只警告一次,避免开合页面刷屏 */
let contextLossWarned = false;

export default function TiantaiScene({ slot, weather, onSceneReady, onFallback }: TiantaiSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<TiantaiSceneHandle | null>(null);
  // 用 ref 透传回调,避免父级未 memo 的回调把挂载 effect 打爆重装场景
  const readyCb = useRef(onSceneReady);
  const fallbackCb = useRef(onFallback);
  readyCb.current = onSceneReady;
  fallbackCb.current = onFallback;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let handle: TiantaiSceneHandle | null = null;
    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;
    let inViewport = true;

    const updatePaused = () => {
      // 页面不可见 / 不在视口 → 完全停渲染(省电红线)
      handleRef.current?.setPaused(document.hidden || !inViewport);
    };
    const onVisChange = () => updatePaused();
    const onContextLost = (e: Event) => {
      e.preventDefault();
      if (!contextLossWarned) {
        contextLossWarned = true;
        console.warn("[TiantaiScene] WebGL 上下文丢失,回退照片横幅");
      }
      fallbackCb.current?.();
    };

    try {
      handle = createTiantaiScene(canvas, { slot });
    } catch (err) {
      if (!contextLossWarned) {
        contextLossWarned = true;
        console.warn("[TiantaiScene] WebGL 初始化失败,回退照片横幅:", err);
      }
      fallbackCb.current?.();
      return;
    }
    handleRef.current = handle;
    readyCb.current?.(handle);
    canvas.addEventListener("webglcontextlost", onContextLost);
    document.addEventListener("visibilitychange", onVisChange);

    ro = new ResizeObserver(() => handleRef.current?.resize());
    ro.observe(container);
    io = new IntersectionObserver(
      (entries) => {
        inViewport = entries.some((e) => e.isIntersecting);
        updatePaused();
      },
      { threshold: 0 },
    );
    io.observe(container);
    updatePaused();

    return () => {
      ro?.disconnect();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisChange);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      readyCb.current?.(null);
      // 卸载即全量释放(geometry/material/texture/renderer/上下文),开合页面内存零增长
      handleRef.current?.dispose();
      handleRef.current = null;
    };
    // 仅挂载/卸载时装卸场景;slot / weather 变化走下面的独立 effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 时段切换:8s 平滑过渡在场景内部完成
  useEffect(() => {
    handleRef.current?.setState(slot);
  }, [slot]);

  // 天气钩子:雨/雪/雾/暴雨的轻量变体(压灰一层 + 楼灯更晕)
  useEffect(() => {
    handleRef.current?.setWeather(weather);
  }, [weather]);

  return (
    <div ref={containerRef} className="absolute inset-0" aria-hidden="true">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

export type { TiantaiSceneHandle, TiantaiSlot, TiantaiWeather };
