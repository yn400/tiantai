import { useState, useRef, useCallback, useEffect } from "react";
import { useAppStore } from "../stores/appStore";
import Avatar from "./Avatar";
import { speakText, stopSpeaking } from "../utils/speech";
import { chatWithAI, resolveActiveModel } from "../utils/aiClient";
import { buildSystemPrompt } from "../utils/deepseek";
import { detectCrisis } from "../utils/crisis";
import { spawnTrail } from "../utils/particles";
import { VoiceRecorder, transcribe, getAsrConfig } from "../utils/asr";
import type { Expression } from "./Avatar";

interface Props {
  onCallStart: (mode: "voice" | "video") => void;
}

export default function FloatingCompanion({ onCallStart }: Props) {
  const savedPos = useAppStore((s) => s.companionPosition);
  const setSavedPos = useAppStore((s) => s.setCompanionPosition);
  const currentMood = useAppStore((s) => s.currentMood);
  const settings = useAppStore((s) => s.settings);

  const ref = useRef<HTMLDivElement>(null);
  const targetPos = useRef(savedPos);
  const currentPos = useRef(savedPos);
  const dragStart = useRef({ x: 0, y: 0 });
  const pointerStart = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);
  const dragging = useRef(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lerpRaf = useRef<number>(0);
  const trailSpawnTimer = useRef(0);

  const [bouncing, setBouncing] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleText, setBubbleText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [expression, setExpression] = useState<Expression>("calm");
  const [hugging, setHugging] = useState(false);
  const voiceRef = useRef<VoiceRecorder | null>(null);
  const recordingRef = useRef(false);

  // Lerp animation loop for smooth movement
  useEffect(() => {
    const lerp = () => {
      const factor = 0.25; // Smoothness factor
      const cp = currentPos.current;
      const tp = targetPos.current;

      if (!dragging.current && Math.abs(cp.x - tp.x) < 0.5 && Math.abs(cp.y - tp.y) < 0.5) {
        currentPos.current = { ...tp };
        if (ref.current) {
          ref.current.style.transform = `translate(${tp.x}px, ${tp.y}px)`;
        }
        lerpRaf.current = requestAnimationFrame(lerp);
        return;
      }

      cp.x += (tp.x - cp.x) * factor;
      cp.y += (tp.y - cp.y) * factor;

      if (ref.current) {
        ref.current.style.transform = `translate(${cp.x}px, ${cp.y}px)`;
      }

      lerpRaf.current = requestAnimationFrame(lerp);
    };
    lerp();
    return () => cancelAnimationFrame(lerpRaf.current);
  }, []);

  // Position ref on mount
  useEffect(() => {
    currentPos.current = { ...savedPos };
    targetPos.current = { ...savedPos };
    if (ref.current) {
      ref.current.style.transform = `translate(${savedPos.x}px, ${savedPos.y}px)`;
    }
  }, []);

  // Expression from mood
  useEffect(() => {
    const map: Record<string, Expression> = {
      rad: "happy", good: "calm", ok: "calm", low: "worried", rough: "sad",
    };
    setExpression(currentMood ? map[currentMood.id] || "calm" : "calm");
  }, [currentMood]);

  /** 松开/取消：结束录音 → 识别 → 走对话 */
  const finalizeVoiceRecording = useCallback(async () => {
    const rec = voiceRef.current;
    if (!recordingRef.current || !rec) return;
    recordingRef.current = false;
    voiceRef.current = null;
    setIsListening(false);

    try {
      const blob = await rec.stop();
      if (!ref.current?.isConnected) return;
      if (blob.size < 1200) {
        setExpression("calm");
        setBubbleText("没听清，再长按说一次？");
        setTimeout(() => setShowBubble(false), 1800);
        return;
      }
      setBubbleText("识别中……");
      const cfg = getAsrConfig(settings);
      const text = cfg ? await transcribe(blob, cfg) : "";
      if (!ref.current?.isConnected) return;
      if (text) {
        await handleVoiceQuery(text);
      } else {
        setExpression("calm");
        setBubbleText("没听清，再长按说一次？");
        setTimeout(() => setShowBubble(false), 1800);
      }
    } catch (err) {
      if (!ref.current?.isConnected) return;
      setExpression("calm");
      setBubbleText((err as Error).message.slice(0, 50));
      setTimeout(() => { setShowBubble(false); }, 3000);
    }
  }, [settings, currentMood, handleVoiceQuery]);

  /** 松开/取消：结束录音 → 识别 → 走对话 */
  const clamp = useCallback((x: number, y: number) => {
    const elRef = ref.current;
    const ew = elRef?.offsetWidth ?? 64;
    const eh = elRef?.offsetHeight ?? 80;
    const margin = 8;
    return {
      x: Math.min(Math.max(x, margin), window.innerWidth - ew - margin),
      y: Math.min(Math.max(y, margin), window.innerHeight - eh - 80 - margin),
    };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    dragging.current = true;
    dragStart.current = { ...targetPos.current };
    pointerStart.current = { x: e.clientX, y: e.clientY };
    didDrag.current = false;
    trailSpawnTimer.current = 0;

    pressTimer.current = setTimeout(() => {
      if (!didDrag.current) {
        dragging.current = false;
        handleLongPress();
      }
    }, 500);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      didDrag.current = true;
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
      const clamped = clamp(dragStart.current.x + dx, dragStart.current.y + dy);
      targetPos.current = clamped;

      // Direct update while dragging (bypass lerp for responsiveness)
      currentPos.current = clamped;
      if (ref.current) {
        ref.current.style.transform = `translate(${clamped.x}px, ${clamped.y}px)`;
      }

      // Spawn trail particles periodically during drag
      const now = Date.now();
      if (now - trailSpawnTimer.current > 40) {
        spawnTrail(e.clientX, e.clientY, 3);
        trailSpawnTimer.current = now;
      }
    }
  }, [clamp]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    ref.current?.releasePointerCapture(e.pointerId);
    dragging.current = false;
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    // 录音中松开 → 结束识别并走对话（优先级高于拖拽/点按）
    if (recordingRef.current) {
      void finalizeVoiceRecording();
      return;
    }
    if (didDrag.current) {
      setSavedPos(targetPos.current);
      // Burst on release
      spawnTrail(e.clientX, e.clientY, 6);
    } else {
      handleTap();
    }
    setTimeout(() => { didDrag.current = false; }, 50);
  }, [setSavedPos, finalizeVoiceRecording]);

  const handleTap = useCallback(() => {
    setBouncing(true);
    if (navigator.vibrate) navigator.vibrate(10);
    const replies = ["在呢~", "想说什么？", "我在听", "嗯嗯", "天台的风很舒服", "抱抱"];
    const msg = replies[Math.floor(Math.random() * replies.length)];
    if (msg === "抱抱") {
      setHugging(true);
      setBubbleText("抱抱你 🤗");
      if (navigator.vibrate) navigator.vibrate([30, 50, 30, 50, 100]);
      setTimeout(() => setHugging(false), 2000);
    } else {
      setBubbleText(msg);
    }
    setShowBubble(true);
    setTimeout(() => setShowBubble(false), 2500);
    setTimeout(() => setBouncing(false), 400);
  }, []);

  const handleLongPress = useCallback(() => {
    if (recordingRef.current) return; // 已在录音（松开会自动结束）
    const cfg = getAsrConfig(settings);
    if (!cfg) {
      setBubbleText("长按语音需要先配置识别 Key~");
      setShowBubble(true);
      setTimeout(() => setShowBubble(false), 3000);
      return;
    }
    setTranscript("");
    setIsListening(true);
    setExpression("listening");
    setBubbleText("在听……松开告诉我");
    setShowBubble(true);
    recordingRef.current = true;
    voiceRef.current = new VoiceRecorder();
    voiceRef.current.start().catch(() => {
      recordingRef.current = false;
      voiceRef.current = null;
      setIsListening(false);
      setExpression("calm");
      setBubbleText("麦克风不可用，请检查权限");
      setTimeout(() => setShowBubble(false), 2500);
    });
  }, [settings]);

  async function handleVoiceQuery(text: string) {
    // 危机信号优先：不走 AI，直接给出求助指引
    if (detectCrisis(text)) {
      setExpression("worried");
      setBubbleText("别一个人扛。拨打 12356，有人想听你说。我一直在天台。");
      setShowBubble(true);
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
      setTimeout(() => { setShowBubble(false); setExpression("calm"); }, 7000);
      return;
    }
    const { provider, model, apiKey } = resolveActiveModel(settings);
    if (!apiKey) {
      setBubbleText("请先在「我的」里配置 AI Key~"); setShowBubble(true);
      setTimeout(() => setShowBubble(false), 3000);
      return;
    }
    setIsSpeaking(true); setBubbleText("……");
    try {
      const reply = await chatWithAI(
        [{ role: "system", content: buildSystemPrompt(currentMood?.label) }, { role: "user", content: text }],
        provider,
        model,
        apiKey,
      );
      setBubbleText(reply); setExpression("happy"); speakText(reply);
      setTimeout(() => { setIsSpeaking(false); setShowBubble(false); setExpression("calm"); }, reply.length * 200 + 1000);
    } catch {
      setBubbleText("信号有点弱…"); setIsSpeaking(false);
      setTimeout(() => setShowBubble(false), 2000);
    }
  };

  useEffect(() => () => {
    recordingRef.current = false;
    voiceRef.current = null;
    stopSpeaking();
  }, []);

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="fixed z-50 select-none touch-none"
      style={{ left: 0, top: 0, willChange: "transform" }}
    >
      {showBubble && (
        <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-2xl border border-white/15 rounded-2xl px-4 py-2.5 text-sm text-warm-50 max-w-[200px] text-center shadow-xl animate-fade-in whitespace-pre-wrap leading-relaxed">
          {isSpeaking && (
            <span className="inline-flex gap-1 mr-2 align-middle">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-warm-100 animate-typing-dot" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
          )}
          {bubbleText}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-black/40 border border-white/15 rotate-45 border-t-transparent border-l-transparent" />
        </div>
      )}

      {isListening && (
        <div className="absolute inset-0 rounded-full animate-[callPulse_1.5s_infinite]" style={{ boxShadow: "0 0 0 0 rgba(255,100,100,0.35)" }} />
      )}

      <button
        className={`flex items-center justify-center cursor-pointer transition-all ${bouncing ? "animate-[companionBounce_0.4s_ease]" : ""}`}
        aria-label="AI 陪伴助手小天"
        style={{ filter: isListening ? "drop-shadow(0 0 12px rgba(255,100,100,0.4))" : "drop-shadow(0 4px 20px rgba(240,185,107,0.2))" }}
      >
        <Avatar expression={expression} size={hugging ? 80 : 64} breathing={!bouncing && !isListening} hugging={hugging} talking={isSpeaking} />
      </button>

      {/* Call buttons — outside drag capture */}
      <button
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onCallStart("voice"); }}
        onPointerUp={(e) => { e.stopPropagation(); e.preventDefault(); }}
        className="absolute -top-2 -right-10 w-7 h-7 rounded-full bg-warm-100/20 border border-warm-100/40 flex items-center justify-center text-xs hover:bg-warm-100/30 transition-colors cursor-pointer"
        aria-label="语音通话"
        title="语音通话"
        style={{ touchAction: "none" }}
      >📞</button>
      <button
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onCallStart("video"); }}
        onPointerUp={(e) => { e.stopPropagation(); e.preventDefault(); }}
        className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-purple-400/20 border border-purple-400/30 flex items-center justify-center text-xs hover:bg-purple-400/30 transition-colors cursor-pointer"
        aria-label="视频通话"
        title="视频通话"
        style={{ touchAction: "none" }}
      >📹</button>
    </div>
  );
}
