import { useState, useEffect, useMemo, useRef } from "react";
import { RefreshCw } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { useDailyQuote, useDailyFortune } from "../../hooks/useDailyQuote";
import MoodOrbs from "../MoodOrbs";
import { getWeather, refreshWeather, type WeatherData } from "../../utils/weather";
import { getTimeSlots, getTimeSlotForHour, getWallpaperPool, getGradientForSlot } from "../../utils/unsplash";
import { getMoonPhase, getCurrentSolarTerm } from "../../utils/lunar";
import { computeStreak } from "../../utils/streak";
import type { Mood } from "../../types";

export default function TodayPage() {
  const currentMood = useAppStore((s) => s.currentMood);
  const moodHistory = useAppStore((s) => s.moodHistory);
  const setMood = useAppStore((s) => s.setMood);
  const setTab = useAppStore((s) => s.setTab);
  const quote = useDailyQuote();
  const fortune = useDailyFortune();

  const [typed, setTyped] = useState("");
  const [cursor, setCursor] = useState(true);
  const [showDiary, setShowDiary] = useState(false);
  const [diaryNote, setDiaryNote] = useState("");

  const pageRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  // 心灵主义氛围件：月相 / 节气 / 真实连续记录天数
  const moon = useMemo(() => getMoonPhase(), []);
  const term = useMemo(() => getCurrentSolarTerm(), []);
  const streak = useMemo(
    () => computeStreak(moodHistory.map((m) => m.timestamp)),
    [moodHistory],
  );

  // Selected time slot (default = current hour)
  const realHour = new Date().getHours();
  const [selectedHour, setSelectedHour] = useState(realHour);
  const timeSlots = getTimeSlots();
  const currentSlot = getTimeSlotForHour(selectedHour);

  // 壁纸池 + 轮换
  const wallpaperPool = useMemo(() => getWallpaperPool(selectedHour), [selectedHour]);
  const [wallIdx, setWallIdx] = useState(0);
  useEffect(() => { setWallIdx(0); }, [selectedHour]);
  // 预加载池内其余壁纸，轮换零等待
  useEffect(() => {
    for (const src of wallpaperPool) {
      if (src !== wallpaperPool[wallIdx % Math.max(1, wallpaperPool.length)]) {
        const img = new Image();
        img.src = src;
      }
    }
  }, [wallpaperPool, wallIdx]);
  const rotateWallpaper = () => {
    if (wallpaperPool.length < 2) return;
    if (navigator.vibrate) navigator.vibrate(8);
    setWallIdx((i) => (i + 1 + Math.floor(Math.random() * (wallpaperPool.length - 1))) % wallpaperPool.length);
  };
  const wallpaper = wallpaperPool.length ? wallpaperPool[wallIdx % wallpaperPool.length] : "";

  // Weather + 手动定位（点击天气徽章重新定位到街道级）
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [locating, setLocating] = useState(false);
  useEffect(() => {
    getWeather().then(setWeather).catch(() => {});
  }, []);
  const locate = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const w = await refreshWeather();
      if (w) setWeather(w);
    } finally {
      setLocating(false);
    }
  };

  // 风景横幅滚动视差：背景以 0.35 倍速缓移（Ken Burns 由 CSS 动画负责）
  useEffect(() => {
    const scroller = pageRef.current?.closest("main") as HTMLElement | null;
    if (!scroller || !bannerRef.current) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = Math.min(scroller.scrollTop * 0.35, 88);
        if (bannerRef.current) bannerRef.current.style.translate = `0 ${y}px`;
      });
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Typing effect
  useEffect(() => {
    let i = 0;
    setTyped("");
    setCursor(true);
    const iv = setInterval(() => {
      if (i <= quote.text.length) {
        setTyped(quote.text.slice(0, i));
        i++;
      } else {
        setCursor(false);
        clearInterval(iv);
      }
    }, 55);
    return () => clearInterval(iv);
  }, [quote]);

  const h = selectedHour;
  const greet =
    h < 6 ? "夜深了，还没睡？"
    : h < 12 ? "早安，今天如何？"
    : h < 17 ? "下午好，你还好吗？"
    : h < 20 ? "傍晚了，去窗边看看？"
    : "晚上好，今天辛苦了。";

  const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const d = new Date();
  const dateStr = `${d.getMonth() + 1}月${d.getDate()}日 ${days[d.getDay()]}`;

  const handleMoodSelect = (mood: Mood) => {
    setMood(mood);
    setShowDiary(true);
    if (navigator.vibrate) navigator.vibrate([10, 20, 15]);
  };

  const gradient = getGradientForSlot(selectedHour);

  // 光尘颜色随天气×时刻映射：雨天偏冷蓝、雪天冰晶、晴夜星光、晴天暖金
  const dustStyle = useMemo(() => {
    const c = weather?.condition;
    if (c === "rain") return { core: "rgba(150,180,220,.9)", glow: "rgba(120,160,210,.8)" };
    if (c === "snow") return { core: "rgba(235,244,255,.95)", glow: "rgba(200,225,255,.85)" };
    if (c === "fog" || c === "storm") return { core: "rgba(190,195,205,.8)", glow: "rgba(160,168,185,.7)" };
    const isNightNow = new Date().getHours() >= 20 || new Date().getHours() < 6;
    if (isNightNow) return { core: "rgba(190,214,255,.9)", glow: "rgba(140,170,230,.75)" };
    return { core: "rgba(240,200,150,.85)", glow: "rgba(240,185,107,.8)" };
  }, [weather]);

  return (
    <div className="pb-7 page-enter">
      {/* ── Landscape Banner：Ken Burns 缓推 + 滚动视差 + 光尘 ── */}
      <div ref={pageRef} className="relative w-full h-[210px] overflow-hidden">
        <div
          ref={bannerRef}
          className="absolute -inset-x-4 -top-24 bottom-[-16px] animate-kenburns will-change-transform"
          style={{
            background: wallpaper
              ? `url(${wallpaper}) center/cover no-repeat`
              : gradient,
          }}
        >
          {/* 光尘：缓慢上浮的微粒，颜色随天气×时刻映射（雨天冷蓝/雪天冰晶/晴夜星光/晴日暖金） */}
          {[...Array(6)].map((_, i) => (
            <span
              key={i}
              className="absolute rounded-full animate-float-slow"
              style={{
                left: `${12 + i * 14}%`,
                top: `${25 + (i % 3) * 18}%`,
                width: 2 + (i % 3),
                height: 2 + (i % 3),
                background: dustStyle.core,
                boxShadow: `0 0 6px ${dustStyle.glow}`,
                animationDelay: `${i * 1.1}s`,
                animationDuration: `${6 + (i % 4)}s`,
              }}
            />
          ))}
        </div>
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, rgba(5,8,16,0.08) 0%, rgba(5,8,16,0.42) 72%, rgba(5,8,16,1) 100%)",
          }}
        />
        {/* 轮换按钮：换个该时段的风景 */}
        {wallpaperPool.length > 1 && (
          <button
            onClick={rotateWallpaper}
            className="absolute bottom-3 right-3 z-[3] w-9 h-9 rounded-full glass flex items-center justify-center hover:bg-white/10 active:scale-90 transition-transform"
            style={{ backdropFilter: "blur(12px)" }}
            aria-label={`换一张${currentSlot.label}的风景`}
            title={`换一张${currentSlot.label}风景（${wallpaperPool.length} 张可选）`}
          >
            <RefreshCw size={15} className="text-warm-100" />
          </button>
        )}
      </div>

      {/* ── Time Slider ── */}
      <div className="px-[18px] -mt-2 relative z-[2] mb-3">
        <div className="flex justify-between items-end glass p-2.5 px-3 overflow-x-auto no-scrollbar gap-1">
          {timeSlots.map((slot) => {
            const isActive = selectedHour === slot.hour;
            const isNow = realHour >= slot.hour && realHour < (timeSlots[timeSlots.indexOf(slot) + 1]?.hour || 24);
            return (
              <button
                key={slot.hour}
                onClick={() => setSelectedHour(slot.hour)}
                className={`flex flex-col items-center shrink-0 px-2 py-1.5 rounded-xl transition-all min-w-[52px] ${
                  isActive
                    ? "bg-warm-100/15 border border-warm-100/30 scale-105"
                    : "hover:bg-white/5 border border-transparent"
                }`}
              >
                <span className="text-[17px]">
                  {slot.hour === 5 ? "🌅" : slot.hour === 8 ? "🌤️" : slot.hour === 12 ? "☀️" : slot.hour === 15 ? "🌿" : slot.hour === 18 ? "🌇" : "🌙"}
                </span>
                <span className={`text-[10px] tracking-[.06em] mt-0.5 ${isActive ? "text-warm-100" : "text-warm-400"}`}>
                  {slot.label}
                </span>
                <span className={`text-[9px] ${isActive ? "text-warm-200" : "text-warm-500"}`}>
                  {slot.hour}:00
                </span>
                {isNow && (
                  <div className="w-1.5 h-1.5 rounded-full bg-mood-good mt-0.5" title="当前时间" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-[18px] relative z-[1]">
        {/* Header */}
        <div className="mb-1.5">
          <div className="text-[11px] text-warm-300 tracking-[.14em] mb-1.5">{dateStr}</div>
          <h1 className="font-xiaowei text-[25px] leading-relaxed text-warm-50">{greet}</h1>

          {/* 节气 · 月相 · 连续记录 · 天气 —— 一眼可得的「今日感」 */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            <span className="chip" title={term.line}>{term.emoji} {term.name}</span>
            <span className="chip" title={`月龄 ${moon.ageDays.toFixed(1)} 天 · 月面照亮 ${(moon.illumination * 100).toFixed(0)}%`}>
              {moon.emoji} {moon.name}
            </span>
            {streak > 0 && (
              <span className="chip" style={{ borderColor: "rgba(240,185,107,.35)", color: "#f0b96b" }}>
                🔥 连续 {streak} 天
              </span>
            )}
            {weather && (
              <button
                className="chip"
                style={{ cursor: "pointer" }}
                title={`${weather.city}${weather.place ? " · " + weather.place : ""}\n点击重新定位`}
                onClick={locate}
              >
                {locating ? "🛰️ 定位中…" : `${weather.icon} ${weather.temp}°C · ${weather.conditionLabel}`}
                {!locating && weather.place && <span className="opacity-80"> · {weather.place}</span>}
                {!locating && weather.aqi && <span> · 空气{weather.aqi.label}</span>}
              </button>
            )}
          </div>

          {/* 节气物候一句 */}
          <p className="text-[11px] text-warm-400 mt-2 tracking-[.06em] leading-relaxed">{term.line}</p>
        </div>

        {/* Quote */}
        <div className="glass p-[22px_20px] my-4 relative min-h-[108px]">
          <span className="text-[46px] opacity-10 font-serif absolute top-2.5 left-[13px] leading-none text-warm-100 select-none">&ldquo;</span>
          <div className="text-[14.5px] leading-[1.95] tracking-[.05em] pl-1.5 min-h-[56px]">
            {typed}{cursor && <span className="text-warm-100 animate-blink">|</span>}
          </div>
          <div className="text-[11px] text-warm-300 mt-2.5 pl-1.5 tracking-[.08em]">{quote.author}</div>
        </div>

        {/* Fortune */}
        <div className="glass p-3.5 px-4 mb-4 text-center">
          <span className="text-[11px] text-warm-300 tracking-[.1em]">🔮 今日天台签</span>
          <p className="text-[13px] text-warm-50 mt-1.5 tracking-[.03em]">{fortune}</p>
        </div>

        {/* Mood */}
        <div className="glass p-[17px_18px]">
          <div className="text-[11px] text-warm-300 tracking-[.12em] mb-[13px]">此刻你的状态</div>
          <MoodOrbs current={currentMood} onSelect={handleMoodSelect} />
          {currentMood && !showDiary && (
            <div className="text-center mt-2.5 text-[12.5px] tracking-[.08em]" style={{ color: currentMood.color }}>
              记下了 · {currentMood.label}
            </div>
          )}
        </div>

        {showDiary && currentMood && (
          <div className="glass p-4 mt-3 animate-fade-in">
            <p className="text-xs text-warm-300 mb-2.5 tracking-[.08em]">{currentMood.emoji} 想记下什么吗？（可选）</p>
            <textarea value={diaryNote} onChange={(e) => setDiaryNote(e.target.value)} placeholder="此刻的感受……" rows={2} autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-warm-50 placeholder:text-warm-400 resize-none outline-none focus:border-warm-100/40 transition-colors font-serif" />
            <div className="flex gap-2.5 mt-2.5">
              <button onClick={() => { if (diaryNote.trim()) setMood(currentMood!, diaryNote.trim()); setShowDiary(false); setDiaryNote(""); }}
                className="flex-1 py-2 rounded-full text-sm font-serif tracking-[.05em] text-sky-950"
                style={{ background: "linear-gradient(135deg, #f0b96b, #e07d3a)" }}>保存</button>
              <button onClick={() => setShowDiary(false)} className="px-5 py-2 rounded-full border border-white/15 text-xs text-warm-300">跳过</button>
            </div>
          </div>
        )}

        {/* Mood trend */}
        {moodHistory.length > 0 && (
          <div className="glass p-[13px_18px] mt-3">
            <div className="text-[11px] text-warm-300 tracking-[.1em]">最近的心情轨迹</div>
            <div className="flex gap-[5px] items-end h-11 mt-2.5">
              {moodHistory.slice(-14).map((e, i) => {
                const hs: Record<string, number> = { rad: 40, good: 32, ok: 24, low: 15, rough: 7 };
                const cs: Record<string, string> = { rad: "#f0b96b", good: "#7eccc8", ok: "#b8a7e8", low: "#7aa8d4", rough: "#ff7e72" };
                return <div key={i} className="flex-1 rounded-[3px] min-h-1 transition-all duration-500"
                  style={{ height: hs[e.mood.id] || 20, background: cs[e.mood.id] || "#b8a7e8", opacity: 0.45 + (i / moodHistory.length) * 0.55 }} />;
              })}
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-warm-400">更早</span><span className="text-[10px] text-warm-400">现在</span>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          {[{ icon: "🌬️", label: "一分钟呼吸", sub: "平复一下", tab: 1 }, { icon: "🎵", label: "环境音", sub: "安静一会", tab: 3 }].map((t) => (
            <button key={t.label} onClick={() => setTab(t.tab)}
              className="glass p-[14px_13px] flex gap-2.5 items-center cursor-pointer hover:bg-white/[0.07] transition-colors">
              <span className="text-[26px]">{t.icon}</span>
              <div className="text-left"><div className="text-[13px] tracking-[.02em] text-warm-50">{t.label}</div><div className="text-[10px] text-warm-300 mt-0.5">{t.sub}</div></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
