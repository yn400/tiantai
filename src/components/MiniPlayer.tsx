import { useEffect, useRef, useState } from "react";
import { Play, Pause, ChevronRight, SkipBack, SkipForward, Shuffle, Repeat } from "lucide-react";
import { useAppStore } from "../stores/appStore";

// ── 迷你播放器：自包含的音频域 ─────────────────────────────────
// 从 App.tsx 抽离。timeupdate 频繁 setState 现在只重渲染本组件，
// 不再拖动整棵应用树（旧版每 ~250ms 全局重渲一次）。
export default function MiniPlayer() {
  const currentSong = useAppStore((s) => s.currentSong);
  const isSongPlaying = useAppStore((s) => s.isSongPlaying);
  const setCurrentSong = useAppStore((s) => s.setCurrentSong);
  const setIsSongPlaying = useAppStore((s) => s.setIsSongPlaying);
  const songList = useAppStore((s) => s.songList);
  const playMode = useAppStore((s) => s.playMode);
  const setPlayMode = useAppStore((s) => s.setPlayMode);

  const [songProgress, setSongProgress] = useState(0);
  const [songDuration, setSongDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // 事件回调经 ref 读最新列表，避免闭包过期（原方案保留）
  const songListRef = useRef(songList);
  const playModeRef = useRef(playMode);
  const currentSongRef = useRef(currentSong);
  useEffect(() => { songListRef.current = songList; }, [songList]);
  useEffect(() => { playModeRef.current = playMode; }, [playMode]);
  useEffect(() => { currentSongRef.current = currentSong; }, [currentSong]);

  // Sync audio with store
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (currentSong?.url && currentSong.url !== audio.src) {
      audio.src = currentSong.url;
      audio.play().catch(() => {});
    }
    if (isSongPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [currentSong, isSongPlaying]);

  // Audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setSongProgress(audio.currentTime);
    const onDuration = () => setSongDuration(audio.duration || 0);
    const onEnded = () => {
      const mode = playModeRef.current;
      const list = songListRef.current;
      const cur = currentSongRef.current;
      if (mode === "repeat") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      const curIdx = list.findIndex((s) => s.url === cur?.url);
      if (curIdx >= 0 && list.length > 0) {
        let nextIdx: number;
        if (mode === "shuffle") {
          nextIdx = Math.floor(Math.random() * list.length);
        } else {
          nextIdx = curIdx + 1 >= list.length ? 0 : curIdx + 1;
        }
        setCurrentSong(list[nextIdx]);
      } else {
        setIsSongPlaying(false);
      }
    };
    const onPlay = () => setIsSongPlaying(true);
    const onPause = () => {
      if (!audio.ended) setIsSongPlaying(false);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDuration);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDuration);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [setCurrentSong, setIsSongPlaying]);

  if (!currentSong) return null;

  const handleSeek = (e: React.MouseEvent) => {
    const el = progressRef.current;
    const audio = audioRef.current;
    if (!el || !audio || !songDuration) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * songDuration;
  };

  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const curIdx = songList.findIndex((s) => s.url === currentSong.url);
  const prev = () => { if (songList.length) { const i = curIdx <= 0 ? songList.length - 1 : curIdx - 1; setCurrentSong(songList[i]); } };
  const next = () => { if (songList.length) { const i = curIdx >= songList.length - 1 ? 0 : curIdx + 1; setCurrentSong(songList[i]); } };
  const cycleMode = () => {
    const modes: Array<"sequential" | "shuffle" | "repeat"> = ["sequential", "shuffle", "repeat"];
    setPlayMode(modes[(modes.indexOf(playMode) + 1) % 3]);
  };

  return (
    <div className="shrink-0 glass mx-3 mb-1 px-2 py-1.5 flex items-center gap-1.5 z-[5]" style={{ borderRadius: 14 }}>
      <audio ref={audioRef} />
      <button onClick={prev} className="text-warm-400 hover:text-warm-200 p-0.5" aria-label="上一首"><SkipBack size={13} /></button>
      <button onClick={() => setIsSongPlaying(!isSongPlaying)}
        className="w-7 h-7 rounded-full flex items-center justify-center bg-warm-100/20"
        aria-label={isSongPlaying ? "暂停" : "播放"}>
        {isSongPlaying ? <Pause size={13} className="text-warm-100" /> : <Play size={13} className="text-warm-100" />}
      </button>
      <button onClick={next} className="text-warm-400 hover:text-warm-200 p-0.5" aria-label="下一首"><SkipForward size={13} /></button>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-warm-50 truncate">{currentSong.name} · {currentSong.artist}</p>
        <div ref={progressRef} onClick={handleSeek} className="mt-0.5 h-1 bg-white/10 rounded-full cursor-pointer overflow-hidden">
          <div className="h-full bg-warm-100/60 rounded-full" style={{ width: songDuration ? `${(songProgress / songDuration) * 100}%` : "0%" }} />
        </div>
        <div className="flex justify-between mt-0.5"><span className="text-[8px] text-warm-400">{formatTime(songProgress)}</span><span className="text-[8px] text-warm-400">{formatTime(songDuration)}</span></div>
      </div>
      <button onClick={cycleMode} className="text-warm-400 hover:text-warm-200 p-0.5" aria-label={playMode} title={playMode === "sequential" ? "顺序播放" : playMode === "shuffle" ? "随机播放" : "单曲循环"}>
        {playMode === "shuffle" ? <Shuffle size={13} /> : playMode === "repeat" ? <Repeat size={13} /> : <SkipForward size={13} className="opacity-50" />}
      </button>
      <button onClick={() => { setCurrentSong(null); setIsSongPlaying(false); }} className="text-warm-400 hover:text-warm-200 p-0.5" aria-label="关闭"><ChevronRight size={14} /></button>
    </div>
  );
}
