// ── AI Provider ──────────────────────
export type AIProvider = "deepseek" | "openai" | "qwen" | "moonshot" | "zhipu";

// ── Mood ─────────────────────────────
export interface Mood {
  id: "rad" | "good" | "ok" | "low" | "rough";
  emoji: string;
  label: string;
  color: string;
  bg: string;
}

export interface MoodEntry {
  mood: Mood;
  note?: string;
  timestamp: number;
}

// ── Chat ─────────────────────────────
export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

// ── Sound ────────────────────────────
export type SoundId = "rain" | "wind" | "waves" | "fire" | "night" | "white";

export interface SoundDef {
  id: SoundId;
  icon: string;
  name: string;
  scene: string;
  color: string;
  glow: string;
}

export interface ActiveSound {
  id: SoundId;
  volume: number;
}

// ── Breath ───────────────────────────
export interface BreathLog {
  cycles: number;
  timestamp: number;
}

// ── Achievement ──────────────────────
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: number;
}

// ── Mail ─────────────────────────────
export interface Mail {
  id: string;
  content: string;
  createdAt: number;
  unlockAt: number;
  opened: boolean;
}

// ── Gratitude（感恩墙便签，需持久化）──
export interface GratitudeNote {
  id: string;
  text: string;
  x: number;
  y: number;
  rotation: number;
  createdAt: number;
}

// ── Settings ─────────────────────────
export interface AppSettings {
  // AI 提供商 & 模型
  aiProvider: AIProvider;
  aiModel: string;
  // 各提供商 API Key
  deepseekApiKey: string;
  openaiApiKey: string;
  qwenApiKey: string;
  moonshotApiKey: string;
  zhipuApiKey: string;
  // 应用偏好
  defaultVolume: number;
  hapticEnabled: boolean;
  breathingSoundEnabled: boolean;
  /** 关怀通知（深夜提醒/天气问候/节气仪式感），由主进程调度 */
  careNotifications: boolean;
  /** 点 × 隐藏到托盘（托盘右键才真正退出），桌面端专属 */
  closeToTray: boolean;
  // ── 语音识别（云端 ASR，BYOK）──
  asrProvider: "siliconflow" | "openai";
  asrApiKey: string;
}

// ── App Store ────────────────────────
export interface AppState {
  // Tab
  tab: number;

  // Mood
  currentMood: Mood | null;
  moodHistory: MoodEntry[];

  // Chat
  chatMessages: ChatMessage[];

  // Sound
  activeSounds: ActiveSound[];
  sleepTimerMinutes: number | null;
  sleepTimerStartedAt: number | null;

  // Breath
  breathLogs: BreathLog[];

  // Achievements
  achievements: Achievement[];

  // Mailbox
  mails: Mail[];

  // Gratitude
  gratitudeNotes: GratitudeNote[];

  // Settings
  settings: AppSettings;

  // Song
  currentSong: { name: string; artist: string; url: string } | null;
  isSongPlaying: boolean;
  songList: { name: string; artist: string; url: string }[];
  playMode: "sequential" | "shuffle" | "repeat";

  // AI memory
  conversationMemory: string;

  // Companion
  companionPosition: { x: number; y: number };

  // Actions
  setTab: (tab: number) => void;
  setMood: (mood: Mood, note?: string) => void;
  addChatMessage: (msg: ChatMessage) => void;
  clearChat: () => void;
  setActiveSounds: (sounds: ActiveSound[]) => void;
  setSleepTimer: (minutes: number | null) => void;
  clearSleepTimer: () => void;
  addBreathLog: (log: BreathLog) => void;
  unlockAchievement: (id: string) => void;
  addMail: (mail: Mail) => void;
  openMail: (id: string) => void;
  addGratitudeNote: (note: GratitudeNote) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  setCompanionPosition: (pos: { x: number; y: number }) => void;
  /** 从导出的 JSON 恢复数据（校验失败返回 false） */
  importData: (json: string) => boolean;
  setCurrentSong: (song: { name: string; artist: string; url: string } | null) => void;
  setIsSongPlaying: (playing: boolean) => void;
  setSongList: (list: { name: string; artist: string; url: string }[]) => void;
  setPlayMode: (mode: "sequential" | "shuffle" | "repeat") => void;
  setConversationMemory: (memory: string) => void;
  exportData: () => string;
}
