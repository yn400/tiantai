import { useState, useCallback, useEffect, useRef, Suspense, lazy } from "react";
import Stars from "./Stars";
import Navigation from "./Navigation";
import ErrorBoundary from "./ErrorBoundary";
import FloatingCompanion from "./FloatingCompanion";
import CallScreen from "./CallScreen";
import MiniPlayer from "./MiniPlayer";
import WeatherFX from "./WeatherFX";
import AchievementToasts from "./AchievementToasts";
import { useAppStore } from "../stores/appStore";
import { getWeather, ensureNotificationPermission } from "../utils/weather";
import { initTrailCanvas } from "../utils/particles";
import { hydrateSecrets, isSecureMode } from "../utils/secureStore";

// 页面级代码分割：首屏只加载 TodayPage，其余按需拉取
const TodayPage = lazy(() => import("./pages/TodayPage"));
const BreathePage = lazy(() => import("./pages/BreathePage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const SoundPage = lazy(() => import("./pages/SoundPage"));
const MyPage = lazy(() => import("./pages/MyPage"));

const PAGES = [TodayPage, BreathePage, ChatPage, SoundPage, MyPage];
const MOOD_COLORS: Record<string, string> = { rad: "#f0b96b", good: "#7eccc8", ok: "#b8a7e8", low: "#7aa8d4", rough: "#ff7e72" };

function PageFallback() {
  return (
    <div className="h-full min-h-[300px] flex items-center justify-center" role="status" aria-label="加载中">
      <div className="w-7 h-7 rounded-full border-2 border-warm-100/25 border-t-warm-100/80 animate-spin" />
    </div>
  );
}

export default function App() {
  const tab = useAppStore((s) => s.tab);
  const currentMood = useAppStore((s) => s.currentMood);
  const careNotifications = useAppStore((s) => s.settings.careNotifications);
  const closeToTray = useAppStore((s) => s.settings.closeToTray);
  const [callActive, setCallActive] = useState(false);
  const [callMode, setCallMode] = useState<"voice" | "video">("voice");
  const [weatherCond, setWeatherCond] = useState<"rain" | "snow" | null>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement>(null);

  // 把关怀通知/托盘开关同步给主进程
  useEffect(() => {
    (window as unknown as { tiantaiCare?: { setEnabled: (v: boolean) => void; setCloseToTray: (v: boolean) => void } })
      .tiantaiCare?.setEnabled(careNotifications);
  }, [careNotifications]);
  useEffect(() => {
    (window as unknown as { tiantaiCare?: { setCloseToTray: (v: boolean) => void } })
      .tiantaiCare?.setCloseToTray(closeToTray);
  }, [closeToTray]);

  // 桌面安全模式：启动时从 DPAPI 加密文件水合各模型/ASR Key
  useEffect(() => {
    if (!isSecureMode()) return;
    hydrateSecrets().then((secrets) => {
      if (Object.keys(secrets).length) {
        useAppStore.getState().updateSettings(secrets);
      }
    });
  }, []);

  const hour = new Date().getHours();
  const isNight = hour >= 22 || hour < 6;
  const accentColor = currentMood ? MOOD_COLORS[currentMood.id] || "#f0b96b" : "#f0b96b";

  // Init trail canvas
  useEffect(() => {
    if (trailCanvasRef.current) return initTrailCanvas(trailCanvasRef.current);
  }, []);

  // Weather → 雨/雪氛围粒子 + 桌面通知（召回触点之一）
  useEffect(() => {
    let disposed = false;
    getWeather().then(async (w) => {
      if (!w || disposed) return;
      const isWet = w.condition === "rain" || w.condition === "snow";
      if (isWet) setWeatherCond(w.condition as "rain" | "snow");
      const willRainSoon = typeof w.rainInMinutes === "number" && w.rainInMinutes <= 120;
      // 雨雪（或即将下雨）弹一次温柔的系统通知；权限未授予则静默跳过
      if (!isWet && !willRainSoon) return;
      try {
        const ok = await ensureNotificationPermission();
        if (!ok || disposed) return;
        const where = `${w.city}${w.place ? " · " + w.place : ""}`;
        const body = isWet
          ? `${where}正在${w.conditionLabel} ${w.icon}\n出门记得带伞，天台的灯给你留着。`
          : `${where}预计 ${w.rainInMinutes} 分钟内开始下雨 ${w.icon}\n带把伞再出门，或者干脆留在天台。`;
        const n = new Notification("天台 · 天气陪伴", { body });
        setTimeout(() => n.close(), 15000);
      } catch { /* 通知失败不影响主流程 */ }
    }).catch(() => {});
    return () => { disposed = true; };
  }, []);

  const handleCallStart = useCallback((mode: "voice" | "video") => { setCallMode(mode); setCallActive(true); }, []);
  const handleCallClose = useCallback(() => setCallActive(false), []);

  const Page = PAGES[tab];

  return (
    <ErrorBoundary>
      <canvas ref={trailCanvasRef} className="fixed inset-0 z-[200] pointer-events-none" aria-hidden="true" />
      <AchievementToasts />

      <div
        className={`app-shell w-full max-w-app mx-auto h-dvh flex flex-col relative overflow-hidden font-serif text-warm-50 transition-colors duration-1000 ${
          isNight ? "bg-gradient-to-b from-[#020510] via-[#050e25] to-[#0a1430]" : "bg-gradient-to-b from-sky-950 via-sky-900 to-sky-850"
        }`}
        style={{ ["--accent" as string]: accentColor }}
      >
        <Stars />
        {weatherCond && <WeatherFX cond={weatherCond} />}

        <main className="flex-1 overflow-y-auto overflow-x-hidden relative z-[1] no-scrollbar">
          <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <Page />
            </Suspense>
          </ErrorBoundary>
        </main>

        <MiniPlayer />

        <Navigation />
        {!callActive && <FloatingCompanion onCallStart={handleCallStart} />}
        {callActive && <CallScreen onClose={handleCallClose} mode={callMode} />}
      </div>
    </ErrorBoundary>
  );
}
