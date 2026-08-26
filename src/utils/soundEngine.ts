// ── Sound Engine: 真实采样优先 + 程序合成兜底 ────────────────────
// 每种环境音优先加载 public/sounds/<id>.ogg 的高质量真实录音
// （授权见 docs/SOUND-LICENSES.md）；文件缺失或解码失败时，
// 自动回退到多层滤波噪声合成，保证任何环境下都有声音可用。

import type { SoundId, ActiveSound } from "../types";

/** 采样文件映射；没有采样的 id（night）直接走合成 */
const SAMPLE_FILES: Partial<Record<SoundId, string>> = {
  rain: "sounds/rain.ogg",
  waves: "sounds/waves.ogg",
  wind: "sounds/wind.ogg",
  fire: "sounds/fire.ogg",
  white: "sounds/white.ogg",
};

/** 合成路径的基准增益（真实采样用原生响度，不乘这些系数） */
const SYNTH_BASE: Record<SoundId, number> = {
  rain: 0.14,
  wind: 0.08,
  waves: 0.12,
  fire: 0.07,
  night: 0.15,
  white: 0.05,
};

type SoundNode =
  | { kind: "sample"; el: HTMLAudioElement }
  | { kind: "synth"; gain: GainNode; sources: AudioBufferSourceNode[] };

let ctx: AudioContext | null = null;
const activeNodes = new Map<SoundId, SoundNode>();

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function makeBuffer(audioCtx: AudioContext, duration: number, generator: (i: number, sampleRate: number) => number): AudioBuffer {
  const sr = audioCtx.sampleRate;
  const buf = audioCtx.createBuffer(1, sr * duration, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = generator(i, sr);
  return buf;
}

function createSource(audioCtx: AudioContext, buffer: AudioBuffer): AudioBufferSourceNode {
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

// ── 合成生成器（兜底路径）────────────────────────────────────────

function buildRain(c: AudioContext, gain: GainNode): AudioBufferSourceNode[] {
  const buf1 = makeBuffer(c, 2, () => {
    const noise = Math.random() * 2 - 1;
    const dropEnv = Math.random() < 0.003 ? 3 : 1;
    return noise * dropEnv * 0.6;
  });
  const src1 = createSource(c, buf1);
  const f1 = c.createBiquadFilter();
  f1.type = "bandpass"; f1.frequency.value = 2000; f1.Q.value = 0.8;
  src1.connect(f1); f1.connect(gain);

  const buf2 = makeBuffer(c, 3, () => Math.random() * 2 - 1);
  const src2 = createSource(c, buf2);
  const f2 = c.createBiquadFilter();
  f2.type = "lowpass"; f2.frequency.value = 600;
  src2.connect(f2); f2.connect(gain);

  const buf3 = makeBuffer(c, 2, () => Math.random() * 2 - 1);
  const src3 = createSource(c, buf3);
  const f3 = c.createBiquadFilter();
  f3.type = "highpass"; f3.frequency.value = 4000;
  const g3 = c.createGain(); g3.gain.value = 0.25;
  src3.connect(f3); f3.connect(g3); g3.connect(gain);
  return [src1, src2, src3];
}

function buildWind(c: AudioContext, gain: GainNode): AudioBufferSourceNode[] {
  const buf = makeBuffer(c, 4, (i, sr) => {
    const noise = Math.random() * 2 - 1;
    const lfo = Math.sin(i / sr * 0.3) * 0.5 + 0.5;
    return noise * (0.6 + lfo * 0.4);
  });
  const src = createSource(c, buf);
  const f = c.createBiquadFilter();
  f.type = "lowpass"; f.frequency.value = 350;
  src.connect(f); f.connect(gain);

  const buf2 = makeBuffer(c, 3, (i, sr) => {
    const lfo2 = Math.sin(i / sr * 0.7) * 0.3 + 0.7;
    return (Math.random() * 2 - 1) * lfo2 * 0.5;
  });
  const src2 = createSource(c, buf2);
  const f2 = c.createBiquadFilter();
  f2.type = "bandpass"; f2.frequency.value = 800; f2.Q.value = 0.5;
  src2.connect(f2); f2.connect(gain);
  return [src, src2];
}

function buildWaves(c: AudioContext, gain: GainNode): AudioBufferSourceNode[] {
  const buf = makeBuffer(c, 5, (i, sr) => {
    const noise = Math.random() * 2 - 1;
    const wave = Math.sin(i / sr * 0.08) * 0.6 + 0.4;
    return noise * wave;
  });
  const src = createSource(c, buf);
  const f = c.createBiquadFilter();
  f.type = "bandpass"; f.frequency.value = 250; f.Q.value = 1.5;
  src.connect(f); f.connect(gain);

  const buf2 = makeBuffer(c, 3, (i, sr) => {
    const wave2 = Math.sin(i / sr * 0.12) * 0.5 + 0.5;
    return (Math.random() * 2 - 1) * wave2 * 0.6;
  });
  const src2 = createSource(c, buf2);
  const g2 = c.createGain(); g2.gain.value = 0.4;
  src2.connect(g2); g2.connect(gain);
  return [src, src2];
}

function buildFire(c: AudioContext, gain: GainNode): AudioBufferSourceNode[] {
  const buf1 = makeBuffer(c, 2, () => (Math.random() * 2 - 1) * 0.5);
  const src1 = createSource(c, buf1);
  const f1 = c.createBiquadFilter();
  f1.type = "lowpass"; f1.frequency.value = 200;
  const g1 = c.createGain(); g1.gain.value = 0.6;
  src1.connect(f1); f1.connect(g1); g1.connect(gain);

  const buf2 = makeBuffer(c, 1.5, () => {
    let v = Math.random() * 2 - 1;
    if (Math.random() < 0.002) v *= 2 + Math.random() * 8;
    return v * 0.7;
  });
  const src2 = createSource(c, buf2);
  const f2 = c.createBiquadFilter();
  f2.type = "bandpass"; f2.frequency.value = 3000; f2.Q.value = 2.5;
  const g2 = c.createGain(); g2.gain.value = 0.5;
  src2.connect(f2); f2.connect(g2); g2.connect(gain);

  const buf3 = makeBuffer(c, 2, () => {
    const env = Math.random() < 0.001 ? 2 : 0.3;
    return (Math.random() * 2 - 1) * env;
  });
  const src3 = createSource(c, buf3);
  const f3 = c.createBiquadFilter();
  f3.type = "highpass"; f3.frequency.value = 5000;
  const g3 = c.createGain(); g3.gain.value = 0.25;
  src3.connect(f3); f3.connect(g3); g3.connect(gain);
  return [src1, src2, src3];
}

function buildNight(c: AudioContext, gain: GainNode): AudioBufferSourceNode[] {
  const buf = makeBuffer(c, 5, () => {
    let v = Math.random() * 2 - 1;
    if (Math.random() < 0.0005) v *= 3 + Math.random() * 5;
    return v * 0.4;
  });
  const src = createSource(c, buf);
  const f = c.createBiquadFilter();
  f.type = "lowpass"; f.frequency.value = 180;
  src.connect(f); f.connect(gain);
  return [src];
}

function buildWhite(c: AudioContext, gain: GainNode): AudioBufferSourceNode[] {
  const buf = makeBuffer(c, 2, () => Math.random() * 2 - 1);
  const src = createSource(c, buf);
  src.connect(gain);
  return [src];
}

const SYNTH_BUILDERS: Record<SoundId, (c: AudioContext, gain: GainNode) => AudioBufferSourceNode[]> = {
  rain: buildRain,
  wind: buildWind,
  waves: buildWaves,
  fire: buildFire,
  night: buildNight,
  white: buildWhite,
};

// ── Public API ──────────────────────────────────────────────────

export function playSound(id: SoundId, volume = 0.6): void {
  stopSound(id);

  // ① 真实采样优先
  const file = SAMPLE_FILES[id];
  if (file) {
    const el = new Audio(file);
    el.loop = true;
    el.volume = Math.min(1, Math.max(0, volume));
    el.addEventListener(
      "error",
      () => {
        // 采样缺失/损坏 → 合成兜底（仅当该 id 仍由本元素持有时）
        const cur = activeNodes.get(id);
        if (cur && cur.kind === "sample" && cur.el === el) {
          activeNodes.delete(id);
          playSynth(id, volume);
        }
      },
      { once: true },
    );
    activeNodes.set(id, { kind: "sample", el });
    el.play().catch(() => { /* error 事件统一处理 */ });
    return;
  }

  // ② 无采样 → 合成
  playSynth(id, volume);
}

function playSynth(id: SoundId, volume: number): void {
  const c = getCtx();
  const g = c.createGain();
  g.gain.value = SYNTH_BASE[id] * volume;
  g.connect(c.destination);
  const sources = SYNTH_BUILDERS[id](c, g);
  for (const s of sources) s.start();
  activeNodes.set(id, { kind: "synth", gain: g, sources });
}

export function stopSound(id: SoundId): void {
  const n = activeNodes.get(id);
  if (!n) return;
  if (n.kind === "sample") {
    try { n.el.pause(); n.el.removeAttribute("src"); } catch {}
  } else {
    for (const s of n.sources) { try { s.stop(); } catch {} }
  }
  activeNodes.delete(id);
}

export function setSoundVolume(id: SoundId, volume: number): void {
  const n = activeNodes.get(id);
  if (!n) return;
  const v = Math.min(1, Math.max(0, volume));
  if (n.kind === "sample") {
    n.el.volume = v;
  } else {
    n.gain.gain.setTargetAtTime(SYNTH_BASE[id] * v, getCtx().currentTime, 0.15);
  }
}

export function applySoundState(sounds: ActiveSound[]): void {
  for (const id of activeNodes.keys()) {
    if (!sounds.find((s) => s.id === id)) stopSound(id);
  }
  for (const s of sounds) {
    if (activeNodes.has(s.id)) setSoundVolume(s.id, s.volume);
    else playSound(s.id, s.volume);
  }
}

export function stopAllSounds(): void {
  for (const id of [...activeNodes.keys()]) stopSound(id);
}
