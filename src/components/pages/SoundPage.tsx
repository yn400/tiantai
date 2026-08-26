import { useState, useEffect, useRef } from "react";
import { Clock, Volume2, Play, Pause, Music, Plus } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { applySoundState, stopAllSounds } from "../../utils/soundEngine";
import SoundScene from "../SoundScene";
import { saveTracks, loadTracks } from "../../utils/musicStore";
import type { SoundId, ActiveSound } from "../../types";

const SOUNDS: { id: SoundId; icon: string; name: string; scene: string; color: string; glow: string }[] = [
  { id: "rain", icon: "🌧", name: "雨声", scene: "城市雨夜", color: "#7aa8d4", glow: "rgba(122,168,212,.4)" },
  { id: "wind", icon: "🌬", name: "风声", scene: "山间微风", color: "#b8a7e8", glow: "rgba(184,167,232,.4)" },
  { id: "waves", icon: "🌊", name: "海浪", scene: "远方海岸", color: "#7eccc8", glow: "rgba(126,204,200,.4)" },
  { id: "fire", icon: "🔥", name: "篝火", scene: "噼啪声响", color: "#f0b96b", glow: "rgba(240,185,107,.4)" },
  { id: "night", icon: "🌃", name: "夜城", scene: "远处喧嚣", color: "#e8914a", glow: "rgba(232,145,74,.4)" },
  { id: "white", icon: "✨", name: "白噪音", scene: "清空思绪", color: "#ff7e72", glow: "rgba(255,126,114,.4)" },
];

const SCENES = [
  { icon: "🌆", name: "天台黄昏", desc: "夜城 + 风声，适合发呆", ids: ["night", "wind"] as SoundId[] },
  { icon: "🛋", name: "雨天居家", desc: "雨声 + 篝火，适合放松", ids: ["rain", "fire"] as SoundId[] },
  { icon: "🎧", name: "深夜专注", desc: "海浪声，适合工作", ids: ["waves"] as SoundId[] },
];

export default function SoundPage() {
  const activeSounds = useAppStore((s) => s.activeSounds);
  const setActiveSounds = useAppStore((s) => s.setActiveSounds);
  const settings = useAppStore((s) => s.settings);
  const sleepTimerMinutes = useAppStore((s) => s.sleepTimerMinutes);
  const sleepTimerStartedAt = useAppStore((s) => s.sleepTimerStartedAt);
  const setSleepTimer = useAppStore((s) => s.setSleepTimer);
  const clearSleepTimer = useAppStore((s) => s.clearSleepTimer);

  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 本地音乐：用户自己的音频文件，版权零风险
  const songList = useAppStore((s) => s.songList);
  const setSongList = useAppStore((s) => s.setSongList);
  const currentSong = useAppStore((s) => s.currentSong);
  const isSongPlaying = useAppStore((s) => s.isSongPlaying);
  const setCurrentSong = useAppStore((s) => s.setCurrentSong);

  const onPickMusic = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])].filter((f) => f.type.startsWith("audio"));
    if (!files.length) return;
    const list = files.map((f) => ({
      name: f.name.replace(/\.[^.]+$/, ""),
      artist: "本地音乐",
      url: URL.createObjectURL(f),
    }));
    setSongList(list);
    setCurrentSong(list[0]);
    // 持久化到 IndexedDB：重开应用歌单还在
    void saveTracks(files.map((f) => ({ name: f.name.replace(/\.[^.]+$/, ""), blob: f })));
  };

  // 启动时从 IndexedDB 恢复上次导入的歌单
  useEffect(() => {
    void (async () => {
      const stored = await loadTracks();
      if (stored.length && !useAppStore.getState().songList.length) {
        setSongList(
          stored.map((t) => ({
            name: t.name,
            artist: "本地音乐",
            url: URL.createObjectURL(t.blob),
          })),
        );
      }
    })();
  }, [setSongList]);

  // Sync active sounds to engine
  useEffect(() => {
    applySoundState(activeSounds);
    return () => {
      stopAllSounds();
    };
  }, [activeSounds]);

  // Sleep timer countdown
  useEffect(() => {
    if (sleepTimerMinutes && sleepTimerStartedAt) {
      const update = () => {
        const elapsed = (Date.now() - sleepTimerStartedAt) / 60000;
        const remaining = Math.max(0, sleepTimerMinutes - elapsed);
        setSleepRemaining(Math.ceil(remaining));
        if (remaining <= 0) {
          setActiveSounds([]);
          clearSleepTimer();
          setSleepRemaining(null);
        }
      };
      update();
      intervalRef.current = setInterval(update, 30000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      setSleepRemaining(null);
    }
  }, [sleepTimerMinutes, sleepTimerStartedAt, setActiveSounds, clearSleepTimer]);

  const toggleSound = (id: SoundId) => {
    if (navigator.vibrate) navigator.vibrate(8);
    const existing = activeSounds.find((s) => s.id === id);
    if (existing) {
      setActiveSounds(activeSounds.filter((s) => s.id !== id));
    } else {
      setActiveSounds([...activeSounds, { id, volume: settings.defaultVolume }]);
    }
  };

  const toggleScene = (ids: SoundId[]) => {
    const allActive = ids.every((id) => activeSounds.some((s) => s.id === id));
    if (allActive) {
      setActiveSounds(activeSounds.filter((s) => !ids.includes(s.id)));
    } else {
      const newSounds = [...activeSounds];
      for (const id of ids) {
        if (!newSounds.find((s) => s.id === id)) {
          newSounds.push({ id, volume: settings.defaultVolume });
        }
      }
      setActiveSounds(newSounds);
    }
  };

  const setVolume = (id: SoundId, vol: number) => {
    setActiveSounds(activeSounds.map((s) => (s.id === id ? { ...s, volume: vol } : s)));
  };

  return (
    <div className="px-[18px] pb-7 page-enter">
      {/* Header */}
      <div className="pt-[52px]">
        <h1 className="font-xiaowei text-[25px] text-warm-50">声音</h1>
        <p className="text-[11px] text-warm-300 mt-1 tracking-[.1em]">沉浸式环境音 · 点击播放</p>
      </div>

      {/* Now playing：动态场景画布 + 状态标签 */}
      {activeSounds.length > 0 && (
        <div className="relative mt-3 overflow-hidden rounded-[20px] border border-white/10">
          <SoundScene sounds={activeSounds.map((s) => s.id)} />
          <div className="absolute left-3 bottom-2.5 right-3 flex items-center justify-between pointer-events-none">
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-warm-50 truncate">
              正在播放 · {activeSounds.map((s) => SOUNDS.find((d) => d.id === s.id)?.name).join(" + ")}
            </span>
            <div className="flex gap-[3px] items-end h-[16px] shrink-0">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-[3px] rounded-[2px] animate-wave-bar"
                  style={{
                    background: SOUNDS.find((s) => s.id === activeSounds[0]?.id)?.color ?? "#f0b96b",
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sound pads */}
      <div className="grid grid-cols-3 gap-2.5 mt-3">
        {SOUNDS.map((s) => {
          const active = activeSounds.find((as) => as.id === s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggleSound(s.id)}
              className={`aspect-square rounded-[18px] flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-transform active:scale-[.93] border border-white/10 bg-white/5 p-1 ${
                active ? "scale-[1.02]" : ""
              }`}
              style={
                active
                  ? { borderColor: s.color + "44", background: s.color + "10", boxShadow: `0 0 22px ${s.glow}` }
                  : {}
              }
              aria-label={`${s.name} - ${s.scene}`}
            >
              <span className="text-[28px]">{s.icon}</span>
              <span
                className="text-xs transition-colors"
                style={{ color: active ? s.color : "#ede5d8" }}
              >
                {s.name}
              </span>
              <span className="text-[9.5px] text-warm-300">{s.scene}</span>

              {/* Volume slider when active */}
              {active && (
                <div
                  className="flex items-center gap-1 mt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Volume2 size={10} className="text-warm-400" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={active.volume}
                    onChange={(e) => setVolume(s.id, parseFloat(e.target.value))}
                    className="w-10 h-1 accent-warm-100"
                    aria-label={`${s.name} 音量`}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Sleep timer */}
      <div className="glass p-3.5 mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-warm-300">
          <Clock size={14} />
          <span>定时关闭</span>
        </div>
        <div className="flex gap-2">
          {[15, 30, 60].map((min) => (
            <button
              key={min}
              onClick={() => (sleepTimerMinutes === min ? clearSleepTimer() : setSleepTimer(min))}
              className={`px-2.5 py-1 rounded-full text-[11px] transition-colors ${
                sleepTimerMinutes === min
                  ? "bg-warm-100/20 text-warm-100 border border-warm-100/30"
                  : "text-warm-400 border border-white/10"
              }`}
            >
              {min}分
            </button>
          ))}
        </div>
      </div>
      {sleepRemaining && (
        <p className="text-[11px] text-warm-300 text-center mt-2">
          ⏳ {sleepRemaining} 分钟后自动停止
        </p>
      )}

      {/* Recommended scenes */}
      <div className="glass p-[17px_18px] mt-3">
        <p className="text-[11px] text-warm-300 tracking-[.1em] mb-3">推荐场景</p>
        {SCENES.map((sc) => {
          const active = sc.ids.every((id) => activeSounds.some((s) => s.id === id));
          return (
            <button
              key={sc.name}
              onClick={() => toggleScene(sc.ids)}
              className="flex items-center gap-3.5 mb-3 w-full cursor-pointer hover:bg-white/[.03] rounded-lg p-1 transition-colors"
            >
              <span className="text-[26px]">{sc.icon}</span>
              <div className="flex-1 text-left">
                <p className="text-[13px] text-warm-50">{sc.name}</p>
                <p className="text-[11px] text-warm-300 mt-0.5">{sc.desc}</p>
              </div>
              <div
                className={`w-3 h-3 rounded-full border ${
                  active ? "bg-warm-100 border-warm-100" : "border-white/20"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* ── 本地音乐 ── */}
      <div className="glass p-[17px_18px] mt-3">
        <div className="flex items-center gap-2 mb-1">
          <Music size={14} className="text-warm-100" />
          <p className="text-[11px] text-warm-300 tracking-[.1em]">本地音乐</p>
        </div>
        <p className="text-[10px] text-warm-400 leading-relaxed mb-3">
          播放你电脑里的音频文件 —— 版权完全属于你，配合环境音一起混音
        </p>

        <label
          htmlFor="local-music-input"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-warm-100 hover:bg-white/10 transition-colors cursor-pointer"
        >
          <Plus size={14} />
          选择音频文件（可多选）
        </label>
        <input
          id="local-music-input"
          type="file"
          accept="audio/*"
          multiple
          onChange={onPickMusic}
          className="hidden"
        />

        {songList.length > 0 && (
          <div className="mt-3 space-y-1 max-h-[220px] overflow-y-auto no-scrollbar">
            {songList.map((song, i) => {
              const active = currentSong?.url === song.url;
              return (
                <button
                  key={`${song.url}-${i}`}
                  onClick={() => setCurrentSong(song)}
                  className={`flex items-center gap-3 w-full p-2 rounded-lg transition-colors text-left ${
                    active ? "bg-warm-100/10" : "hover:bg-white/5"
                  }`}
                >
                  <span className="w-6 text-center text-[11px] text-warm-400">{i + 1}</span>
                  <span className={`flex-1 min-w-0 text-[12px] truncate ${active ? "text-warm-100" : "text-warm-50"}`}>
                    {song.name}
                  </span>
                  {active && isSongPlaying ? (
                    <Pause size={13} className="text-warm-100 shrink-0" />
                  ) : (
                    <Play size={13} className="text-warm-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 采样来源 ── */}
      <p className="text-[10px] text-warm-400 text-center mt-4 leading-relaxed">
        真实环境音采样来自 Wikimedia Commons（PD / CC 授权）
        <br />
        作者与许可详见项目 docs/SOUND-LICENSES.md
      </p>
    </div>
  );
}
