// ── 云端语音识别（ASR）：录音 → OpenAI 兼容 transcriptions 接口 ──
// BYOK：用户在设置里填自己的识别服务 Key（硅基流动 / OpenAI）。
// 录音仅在按住时进行，音频直接发往所选服务商，不经任何中间服务器。

import type { AppSettings } from "../types";

export interface AsrConfig {
  label: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export const ASR_PRESETS: Record<AppSettings["asrProvider"], Omit<AsrConfig, "apiKey">> = {
  siliconflow: {
    label: "硅基流动",
    baseUrl: "https://api.siliconflow.cn/v1",
    model: "FunAudioLLM/SenseVoiceSmall",
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "whisper-1",
  },
};

export function getAsrConfig(settings: AppSettings): AsrConfig | null {
  const preset = ASR_PRESETS[settings.asrProvider] ?? ASR_PRESETS.siliconflow;
  if (!settings.asrApiKey) return null;
  return { ...preset, apiKey: settings.asrApiKey };
}

/** 麦克风录音器：start() 开始，stop() 返回音频 Blob */
export class VoiceRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = typeof MediaRecorder !== "undefined"
      && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm"
      : undefined;
    this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start();
  }

  /** 底层媒体流（供静音检测 VAD 分析） */
  getStream(): MediaStream | null {
    return this.stream;
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const rec = this.recorder;
      if (!rec) {
        reject(new Error("没有进行中的录音"));
        return;
      }
      rec.onstop = () => {
        this.stream?.getTracks().forEach((t) => t.stop());
        const type = rec.mimeType || "audio/webm";
        resolve(new Blob(this.chunks, { type }));
      };
      rec.stop();
    });
  }
}

export async function transcribe(blob: Blob, cfg: AsrConfig): Promise<string> {
  const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
  const fd = new FormData();
  fd.append("file", blob, `voice.${ext}`);
  fd.append("model", cfg.model);
  const res = await fetch(`${cfg.baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
    body: fd,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`语音识别失败 (${res.status}): ${errText.slice(0, 120)}`);
  }
  const d = (await res.json()) as { text?: string };
  return (d.text ?? "").trim();
}
