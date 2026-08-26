import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AppState,
  Achievement,
  Mood,
  MoodEntry,
  ChatMessage,
  ActiveSound,
  BreathLog,
  Mail,
  GratitudeNote,
  AppSettings,
} from "../types";
import { computeStreak } from "../utils/streak";
import { celebrate } from "../utils/celebrate";
import { isSecureMode, stripSecrets } from "../utils/secureStore";

const MOODS: Mood[] = [
  { id: "rad", emoji: "🌟", label: "很好", color: "#f0b96b", bg: "rgba(240,185,107,.18)" },
  { id: "good", emoji: "🌿", label: "不错", color: "#7eccc8", bg: "rgba(126,204,200,.18)" },
  { id: "ok", emoji: "☁️", label: "平常", color: "#b8a7e8", bg: "rgba(184,167,232,.18)" },
  { id: "low", emoji: "🌧", label: "有点低", color: "#7aa8d4", bg: "rgba(122,168,212,.18)" },
  { id: "rough", emoji: "🌑", label: "很难", color: "#ff7e72", bg: "rgba(255,126,114,.18)" },
];

export const MOOD_MAP: Record<string, Mood> = Object.fromEntries(MOODS.map((m) => [m.id, m]));

/** 就地解锁成就并广播庆祝时刻（Finch 式：解锁必须有时刻感） */
function unlockAndCelebrate(list: Achievement[], id: string): void {
  const a = list.find((x) => x.id === id);
  if (a && !a.unlockedAt) {
    a.unlockedAt = Date.now();
    celebrate({ icon: a.icon, title: a.title, description: a.description });
  }
}

const DEFAULT_SETTINGS: AppSettings = {
  // AI
  aiProvider: "deepseek",
  aiModel: "deepseek-chat",
  // 仅开发/内测构建注入默认 Key（来自 .env.local）；生产构建强制为空 —— 上架为纯 BYOK，用户自填。
  deepseekApiKey: import.meta.env.DEV ? import.meta.env.VITE_DEEPSEEK_API_KEY || "" : "",
  openaiApiKey: "",
  qwenApiKey: "",
  moonshotApiKey: "",
  zhipuApiKey: "",
  // 偏好
  defaultVolume: 0.6,
  hapticEnabled: true,
  breathingSoundEnabled: true,
  careNotifications: true,
  closeToTray: true,
  asrProvider: "siliconflow",
  asrApiKey: "",
};

const ACHIEVEMENTS = [
  { id: "first-mood", title: "第一次记录", description: "记录你的第一个心情", icon: "🌱" },
  { id: "streak-3", title: "连续三天", description: "连续 3 天记录心情", icon: "🔥" },
  { id: "streak-7", title: "一周陪伴", description: "连续 7 天记录心情", icon: "⭐" },
  { id: "breathe-5", title: "呼吸新手", description: "完成 5 次呼吸练习", icon: "🧘" },
  { id: "breathe-20", title: "呼吸达人", description: "完成 20 次呼吸练习", icon: "🌬️" },
  { id: "chat-10", title: "倾诉者", description: "发送 10 条消息", icon: "💬" },
  { id: "first-mail", title: "时光信使", description: "写下第一封给未来的信", icon: "💌" },
];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      tab: 0,
      currentMood: null,
      moodHistory: [],
      chatMessages: [],
      activeSounds: [],
      sleepTimerMinutes: null,
      sleepTimerStartedAt: null,
      breathLogs: [],
      achievements: ACHIEVEMENTS.map((a) => ({ ...a })),
      mails: [],
      gratitudeNotes: [],
      settings: { ...DEFAULT_SETTINGS },
      companionPosition: { x: 16, y: 120 },
      currentSong: null,
      isSongPlaying: false,
      songList: [],
      playMode: "sequential",
      conversationMemory: "",

      setTab: (tab) => set({ tab }),
      setCurrentSong: (song) => set({ currentSong: song, isSongPlaying: !!song }),
      setIsSongPlaying: (playing) => set({ isSongPlaying: playing }),
      setSongList: (list) => set({ songList: list }),
      setPlayMode: (mode) => set({ playMode: mode }),
      setConversationMemory: (memory) => set({ conversationMemory: memory }),

      setMood: (mood, note) => {
        const entry: MoodEntry = { mood, note, timestamp: Date.now() };
        set((s) => {
          const history = [...s.moodHistory, entry];
          const updated = [...s.achievements];
          unlockAndCelebrate(updated, "first-mood");
          // 真实连续天数（自然日粒度），而非累计条数
          const streak = computeStreak(history.map((h) => h.timestamp));
          if (streak >= 3) unlockAndCelebrate(updated, "streak-3");
          if (streak >= 7) unlockAndCelebrate(updated, "streak-7");
          return { currentMood: mood, moodHistory: history, achievements: updated };
        });
      },

      addChatMessage: (msg) => {
        set((s) => {
          const messages = [...s.chatMessages, msg].slice(-200);
          const updated = [...s.achievements];
          const userMsgs = messages.filter((m) => m.role === "user").length;
          if (userMsgs >= 10) unlockAndCelebrate(updated, "chat-10");
          return { chatMessages: messages, achievements: updated };
        });
      },

      clearChat: () => set({ chatMessages: [] }),

      setActiveSounds: (sounds) => set({ activeSounds: sounds }),

      setSleepTimer: (minutes) =>
        set({ sleepTimerMinutes: minutes, sleepTimerStartedAt: minutes ? Date.now() : null }),

      clearSleepTimer: () => set({ sleepTimerMinutes: null, sleepTimerStartedAt: null }),

      addBreathLog: (log) => {
        set((s) => {
          const logs = [...s.breathLogs, log];
          const updated = [...s.achievements];
          const total = logs.length;
          if (total >= 5) unlockAndCelebrate(updated, "breathe-5");
          if (total >= 20) unlockAndCelebrate(updated, "breathe-20");
          return { breathLogs: logs, achievements: updated };
        });
      },

      unlockAchievement: (id) => {
        set((s) => {
          const updated = [...s.achievements];
          unlockAndCelebrate(updated, id);
          return { achievements: updated };
        });
      },

      addMail: (mail) => {
        set((s) => {
          const mails = [...s.mails, mail];
          const updated = [...s.achievements];
          unlockAndCelebrate(updated, "first-mail");
          return { mails, achievements: updated };
        });
      },

      addGratitudeNote: (note) => {
        set((s) => ({ gratitudeNotes: [...s.gratitudeNotes, note] }));
      },

      openMail: (id) => {
        set((s) => ({
          mails: s.mails.map((m) => (m.id === id ? { ...m, opened: true } : m)),
        }));
      },

      updateSettings: (partial) =>
        set((s) => ({ settings: { ...s.settings, ...partial } })),

      setCompanionPosition: (pos) => set({ companionPosition: pos }),

      importData: (json) => {
        try {
          const d = JSON.parse(json) as Record<string, unknown>;
          const arr = <T>(v: unknown, fallback: T): T => (Array.isArray(v) ? (v as T) : fallback);
          set((s) => ({
            moodHistory: arr(d.moodHistory, s.moodHistory),
            chatMessages: arr(d.chatMessages, s.chatMessages),
            breathLogs: arr(d.breathLogs, s.breathLogs),
            achievements:
              Array.isArray(d.achievements) && d.achievements.length > 0
                ? (d.achievements as typeof s.achievements)
                : s.achievements,
            mails: arr(d.mails, s.mails),
            gratitudeNotes: arr(d.gratitudeNotes, s.gratitudeNotes),
          }));
          return true;
        } catch {
          return false;
        }
      },

      exportData: () => {
        const s = get();
        return JSON.stringify(
          {
            moodHistory: s.moodHistory,
            chatMessages: s.chatMessages,
            breathLogs: s.breathLogs,
            achievements: s.achievements,
            mails: s.mails,
            gratitudeNotes: s.gratitudeNotes,
            exportedAt: new Date().toISOString(),
          },
          null,
          2,
        );
      },
    }),
    {
      name: "tiantai-app-storage",
      // 深度合并 settings，确保新字段使用默认值（向前兼容）
      merge: (persistedState, currentState) => {
        const pState = persistedState as Partial<AppState>;
        return {
          ...currentState,
          ...pState,
          settings: {
            ...currentState.settings,
            ...(pState.settings ?? {}),
          },
        };
      },
      partialize: (state) => ({
        moodHistory: state.moodHistory,
        chatMessages: state.chatMessages,
        breathLogs: state.breathLogs,
        achievements: state.achievements,
        mails: state.mails,
        gratitudeNotes: state.gratitudeNotes,
        // 桌面安全模式下剥离密钥：明文只存主进程 DPAPI 加密文件
        settings: isSecureMode() ? stripSecrets(state.settings) : state.settings,
        companionPosition: state.companionPosition,
        activeSounds: state.activeSounds,
        sleepTimerMinutes: state.sleepTimerMinutes,
        sleepTimerStartedAt: state.sleepTimerStartedAt,
        currentSong: state.currentSong,
        isSongPlaying: state.isSongPlaying,
        currentMood: state.currentMood,
      }),
    },
  ),
);
