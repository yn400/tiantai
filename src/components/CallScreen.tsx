import { useState, useEffect, useRef, useCallback } from "react";
import { PhoneOff, Mic, MicOff, Video, Phone } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { speakText, stopSpeaking } from "../utils/speech";
import { chatWithAI, resolveActiveModel } from "../utils/aiClient";
import { buildSystemPrompt } from "../utils/deepseek";
import { VoiceRecorder, transcribe, getAsrConfig } from "../utils/asr";
import { detectCrisis } from "../utils/crisis";
import type { SttResult } from "../utils/speech";

interface Props {
  onClose: () => void;
  mode: "voice" | "video";
}

export default function CallScreen({ onClose, mode }: Props) {
  const currentMood = useAppStore((s) => s.currentMood);
  const settings = useAppStore((s) => s.settings);
  const [isMuted, setIsMuted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [callState, setCallState] = useState<"connecting" | "idle" | "talking">("connecting");
  const [lastReply, setLastReply] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const isProcessing = useRef(false);
  const mountedRef = useRef(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const speakingRef = useRef(false);
  const voiceRef = useRef<VoiceRecorder | null>(null);
  const vadStopRef = useRef<(() => void) | null>(null);

  const asrCfg = getAsrConfig(settings);

  // ── VAD 静音检测：说过话后持续 ~1.35s 安静 → 自动结束并发送 ──
  function attachVad(stream: MediaStream) {
    try {
      const AC = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const actx = new AC();
      const src = actx.createMediaStreamSource(stream);
      const analyser = actx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      let speechSeen = false;
      let silentTicks = 0;
      const detach = () => {
        window.clearInterval(iv);
        void actx.close().catch(() => {});
        if (vadStopRef.current === detach) vadStopRef.current = null;
      };
      const iv = window.setInterval(() => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        if (rms > 0.05) {
          speechSeen = true;
          silentTicks = 0;
        } else if (speechSeen) {
          silentTicks++;
          if (silentTicks >= 9) {
            detach();
            void onMicUp();
          }
        }
      }, 150);
      vadStopRef.current = detach;
    } catch { /* VAD 失败不影响手动松开发送 */ }
  }

  // Start camera for video mode
  useEffect(() => {
    if (mode !== "video") return;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
      .then((stream) => {
        if (videoRef.current && mountedRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      })
      .catch(() => { /* camera not available */ });
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
    };
  }, [mode]);

  useEffect(() => {
    mountedRef.current = true;
    const t = setTimeout(() => { if (mountedRef.current) setCallState("idle"); }, 1200);
    return () => {
      mountedRef.current = false;
      clearTimeout(t);
      stopSpeaking();
    };
  }, []);

  const handleHangup = () => {
    vadStopRef.current?.();
    vadStopRef.current = null;
    recognizerAbort();
    onClose();
  };

  /** 兼容旧接口的占位：不再使用浏览器 STT */
  function recognizerAbort() {
    voiceRef.current = null;
    setRecording(false);
    setTranscribing(false);
  }

  // ── 按住说话：pointerdown 开始录音，pointerup 识别并发送 ──
  const onMicDown = useCallback(async () => {
    if (recording || transcribing || isProcessing.current) return;
    if (!asrCfg) {
      setCaption("请先在「我的 → 语音识别」里配置 Key");
      return;
    }
    try {
      voiceRef.current = new VoiceRecorder();
      await voiceRef.current.start();
      const stream = voiceRef.current.getStream();
      if (stream) attachVad(stream);
      setRecording(true);
      setCaption("");
      setLastReply(null);
    } catch {
      setCaption("麦克风不可用，请检查系统权限");
    }
  }, [recording, transcribing, asrCfg]);

  const onMicUp = useCallback(async () => {
    const rec = voiceRef.current;
    if (!rec || !recording) return;
    vadStopRef.current?.();
    vadStopRef.current = null;
    voiceRef.current = null;
    setRecording(false);
    setTranscribing(true);
    try {
      const blob = await rec.stop();
      if (blob.size < 1200) {
        setTranscribing(false);
        setCaption("没听清，再按住说一次？");
        return;
      }
      const text = await transcribe(blob, asrCfg!);
      setTranscribing(false);
      if (!text) {
        setCaption("没听清，再按住说一次？");
        return;
      }
      await processVoice(text);
    } catch (err) {
      setTranscribing(false);
      setCaption((err as Error).message.slice(0, 60));
    }
  }, [recording, asrCfg]);

  const processVoice = useCallback(async (text: string) => {
    if (isProcessing.current) return;
    // 危机检测覆盖语音路径（红线无死角）
    if (detectCrisis(text)) {
      setCaption("别一个人扛。拨打 12356，有人想听你说。我一直在。");
      if (!isMuted) speakText("别一个人扛。拨打一二三五六，有人想听你说。");
      return;
    }
    const { provider, model, apiKey } = resolveActiveModel(settings);
    if (!apiKey) {
      setCaption("未配置 AI 模型 Key");
      return;
    }
    isProcessing.current = true;
    setCallState("talking");
    setCaption("");

    try {
      const reply = await chatWithAI(
        [{ role: "system", content: buildSystemPrompt(currentMood?.label) + "\n语音通话中。回复简短自然，像在说话。20字以内。" }, { role: "user", content: text }],
        provider,
        model,
        apiKey,
      );
      if (!mountedRef.current) return;
      setLastReply(reply);
      setCaption(reply);
      if (!isMuted) {
        speakText(reply);
        speakingRef.current = true;
        setTimeout(() => { speakingRef.current = false; }, reply.length * 150 + 500);
      }
    } catch {
      if (mountedRef.current) setLastReply("…");
    } finally {
      if (mountedRef.current) {
        isProcessing.current = false;
        setCallState("idle");
      }
    }
  }, [settings, currentMood, isMuted]);

  const statusText =
    callState === "connecting" ? "正在连接…"
    : recording ? "在听……松开结束"
    : transcribing ? "识别中……"
    : callState === "talking" ? "通话中…"
    : isMuted ? "已静音"
    : asrCfg ? "按住麦克风说话"
    : "未配置语音识别";

  const isVideo = mode === "video";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(180deg, #060c1a 0%, #0d1528 40%, #111a30 100%)" }}>
      {/* Video background */}
      {isVideo && (
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-60" muted playsInline autoPlay />
      )}

      {/* Subtle particles */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white/10" style={{
            width: 1 + Math.random() * 2, height: 1 + Math.random() * 2,
            left: Math.random() * 100 + "%", top: Math.random() * 100 + "%",
            animation: `blink ${2 + Math.random() * 3}s infinite`,
            animationDelay: Math.random() * 3 + "s",
          }} />
        ))}
      </div>

      {/* Avatar area */}
      <div className={`relative mb-4 transition-all duration-700 ${isVideo ? "scale-125" : ""}`}>
        <div className="absolute inset-0 rounded-full animate-[callPulse_2s_infinite]" style={{
          boxShadow: "0 0 0 0 rgba(240,185,107,0.35)",
          transform: "scale(1.3)",
        }} />
        <div className="absolute inset-0 rounded-full border border-warm-100/8 scale-140" />
        <div className="absolute inset-0 rounded-full border border-warm-100/4 scale-160" />

        <img
          src="https://api.dicebear.com/9.x/lorelei/svg?seed=tiantai&mood=happy&backgroundColor=ffdfbf"
          alt="小天"
          width={isVideo ? 200 : 140}
          height={isVideo ? 200 : 140}
          className="rounded-full relative z-[1]"
          style={{ filter: "drop-shadow(0 0 30px rgba(240,185,107,0.25))" }}
        />
      </div>

      {/* Name + status */}
      <h2 className="font-xiaowei text-2xl text-warm-50 mb-1 relative z-[1]">小天</h2>
      <p className="text-sm text-warm-300 mb-6 relative z-[1]">
        {statusText}
        {isVideo && " · 视频"}
      </p>

      {/* Caption / last reply */}
      <div className="w-full max-w-[300px] min-h-[60px] px-4 mb-6 text-center relative z-[1]">
        {transcriptPlaceholder()}
        {caption && <p className="text-base text-warm-50 leading-relaxed animate-fade-in">{caption}</p>}
      </div>

      {/* Wave animation when talking */}
      {callState === "talking" && (
        <div className="flex gap-1 mb-6 relative z-[1]">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-1 rounded-full bg-warm-100/50 animate-wave-bar"
              style={{ height: 8 + Math.random() * 12, animationDelay: `${i * 0.12}s` }} />
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-8 relative z-[1] mt-2">
        <button onClick={() => setIsMuted(!isMuted)}
          className="w-11 h-11 rounded-full bg-white/8 border border-white/12 flex items-center justify-center hover:bg-white/12 transition-colors"
          aria-label={isMuted ? "取消静音" : "静音"}>
          {isMuted ? <MicOff size={18} className="text-red-400" /> : <Mic size={18} className="text-warm-50" />}
        </button>

        <button
          onPointerDown={(e) => { e.preventDefault(); void onMicDown(); }}
          onPointerUp={(e) => { e.preventDefault(); void onMicUp(); }}
          onPointerLeave={() => { if (recording) void onMicUp(); }}
          disabled={isMuted}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
            recording ? "bg-red-500/90 scale-110 shadow-lg shadow-red-500/30" : "bg-warm-100/25 hover:bg-warm-100/35"
          } disabled:opacity-40`}
          aria-label={recording ? "松开发送" : "按住说话"}
          title={recording ? "松开发送" : "按住说话"}
        >
          <Mic size={24} className={recording ? "text-white" : "text-warm-50"} />
        </button>

        <button onClick={handleHangup}
          className="w-14 h-14 rounded-full bg-red-500/80 flex items-center justify-center hover:bg-red-500 transition-colors shadow-lg shadow-red-500/15"
          aria-label="挂断">
          <PhoneOff size={22} className="text-white" />
        </button>

        <button className="w-11 h-11 rounded-full bg-white/8 border border-white/12 flex items-center justify-center"
          aria-label={isVideo ? "视频中" : "语音中"}>
          {isVideo ? <Video size={18} className="text-warm-100" /> : <Phone size={18} className="text-warm-50" />}
        </button>
      </div>
    </div>
  );

  function transcriptPlaceholder() {
    if (!lastReply && !caption && !recording && !transcribing) {
      return <p className="text-xs text-white/30 italic">{asrCfg ? "" : ""}</p>;
    }
    return null;
  }
}

// 保留类型引用避免 tree-shake 报错（历史兼容）
export type { SttResult };
