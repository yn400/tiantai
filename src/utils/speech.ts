// ── Speech: STT + Emotional TTS ─────────────────────────────────

export function isSpeechSupported(): boolean {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isTtsSupported(): boolean {
  return "speechSynthesis" in window;
}

export interface SttResult { transcript: string; isFinal: boolean; }

interface SttHandler {
  onResult: ((r: SttResult) => void) | null;
  onError: ((e: string) => void) | null;
  start: () => void;
  stop: () => void;
}

export function createSpeechRecognizer(lang = "zh-CN"): SttHandler {
  let recognition: SpeechRecognition | null = null;

  return {
    onResult: null, onError: null,
    start() {
      const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Ctor) { this.onError?.("浏览器不支持语音识别"); return; }
      try {
        recognition = new Ctor();
        recognition.lang = lang;
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const last = event.results[event.results.length - 1];
          if (last?.[0]) this.onResult?.({ transcript: last[0].transcript, isFinal: last.isFinal });
        };
        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          if (event.error !== "no-speech") this.onError?.(event.error);
        };
        recognition.start();
      } catch { this.onError?.("语音识别启动失败"); }
    },
    stop() { try { recognition?.stop(); } catch {}; recognition = null; },
  };
}

// ── Emotional TTS ────────────────────
let bestVoice: SpeechSynthesisVoice | null = null;
let voicesLoaded = false;

function findBestVoice(): SpeechSynthesisVoice | null {
  if (bestVoice) return bestVoice;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  // Priority: Chinese female voices with natural-sounding names
  const zhVoices = voices.filter((v) =>
    v.lang.startsWith("zh-CN") || v.lang.startsWith("zh-TW") || v.lang.startsWith("zh-HK"),
  );

  // Rank by quality indicators
  const female = zhVoices.filter((v) =>
    v.name.toLowerCase().includes("female") ||
    v.name.includes("女") ||
    v.name.includes("xia") ||
    v.name.includes("ya") ||
    v.name.includes("Ting") ||
    v.name.includes("Mei"),
  );

  // Prefer Google/ premium voices
  const premium = female.filter((v) =>
    v.name.includes("Google") || v.name.includes("Premium") || v.name.includes("Natural"),
  );

  bestVoice = premium[0] || female[0] || zhVoices[0] || null;
  return bestVoice;
}

// Detect emotion from text
function detectEmotion(text: string): "happy" | "calm" | "sad" | "normal" {
  const happy = ["开心", "好", "棒", "喜欢", "爱", "哈哈", "😊", "✨", "太", "真", "不错", "快乐"];
  const sad = ["难过", "伤心", "哭", "累", "痛", "😢", "烦", "焦虑", "孤独", "撑不"];
  if (happy.some((w) => text.includes(w))) return "happy";
  if (sad.some((w) => text.includes(w))) return "sad";
  return "normal";
}

let currentTtsAudio: HTMLAudioElement | null = null;

/** 说话：优先 edge-tts 自然音色（主进程合成），失败回退系统语音 */
export function speakText(text: string): void {
  stopSpeaking();
  if (!text.trim()) return;

  const bridge = (window as unknown as {
    tiantaiTTS?: { speak: (t: string) => Promise<string | null> };
  }).tiantaiTTS;

  if (bridge) {
    void bridge
      .speak(text)
      .then((b64) => {
        if (!b64) return legacySpeak(text);
        currentTtsAudio = new Audio(`data:audio/mp3;base64,${b64}`);
        void currentTtsAudio.play().catch(() => legacySpeak(text));
      })
      .catch(() => legacySpeak(text));
    return;
  }
  legacySpeak(text);
}

function legacySpeak(text: string): void {
  if (!isTtsSupported()) return;
  window.speechSynthesis.cancel();

  const voice = findBestVoice();
  const emotion = detectEmotion(text);

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.volume = 0.85;

  // Emotional modulation
  switch (emotion) {
    case "happy":
      utterance.rate = 1.05;
      utterance.pitch = 1.2;
      break;
    case "sad":
      utterance.rate = 0.78;
      utterance.pitch = 0.85;
      break;
    default:
      utterance.rate = 0.88;
      utterance.pitch = 1.05;
  }

  if (voice) utterance.voice = voice;

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (currentTtsAudio) {
    try { currentTtsAudio.pause(); } catch {}
    currentTtsAudio = null;
  }
  window.speechSynthesis?.cancel();
}

// Preload voices
if (typeof window !== "undefined") {
  window.speechSynthesis?.getVoices();
  window.speechSynthesis?.addEventListener("voiceschanged", () => {
    voicesLoaded = true;
    bestVoice = null; // Re-evaluate
    findBestVoice();
  });
}
