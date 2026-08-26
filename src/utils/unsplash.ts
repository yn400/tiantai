// ── 时段风景：Unsplash License（免费商用/可再分发）+ 本地池 ──────
import { WALLPAPER_POOL, type SlotKey } from "../data/wallpapers";

export interface LandscapeSlot {
  hour: number;
  label: string;
  icon: string;
  slotKey: SlotKey;
  gradient: string;
}

const LANDSCAPES: LandscapeSlot[] = [
  { hour: 5, label: "黎明", icon: "🌅", slotKey: "dawn",
    gradient: "linear-gradient(180deg, #0d0818 0%, #5c2a4a 40%, #d4825a 80%, #87ceeb 100%)" },
  { hour: 8, label: "早晨", icon: "🌤️", slotKey: "morning",
    gradient: "linear-gradient(180deg, #3a6090 0%, #68a0d0 50%, #c8ddf0 100%)" },
  { hour: 12, label: "正午", icon: "☀️", slotKey: "noon",
    gradient: "linear-gradient(180deg, #1a5090 0%, #4090d0 50%, #d0e8f8 100%)" },
  { hour: 15, label: "午后", icon: "🌿", slotKey: "afternoon",
    gradient: "linear-gradient(180deg, #3a6a30 0%, #5a9a50 50%, #a0d090 100%)" },
  { hour: 18, label: "傍晚", icon: "🌇", slotKey: "sunset",
    gradient: "linear-gradient(180deg, #6a3030 0%, #c06030 30%, #d08040 60%, #3a1040 100%)" },
  { hour: 22, label: "深夜", icon: "🌙", slotKey: "night",
    gradient: "linear-gradient(180deg, #010208 0%, #0a1030 50%, #101840 100%)" },
];

export function getTimeSlots(): LandscapeSlot[] {
  return LANDSCAPES;
}

export function getTimeSlotForHour(hour: number): LandscapeSlot {
  for (let i = LANDSCAPES.length - 1; i >= 0; i--)
    if (hour >= LANDSCAPES[i].hour) return LANDSCAPES[i];
  return LANDSCAPES[LANDSCAPES.length - 1];
}

/** 该时段可轮换的壁纸池（至少一张） */
export function getWallpaperPool(hour: number): string[] {
  return WALLPAPER_POOL[getTimeSlotForHour(hour).slotKey] ?? [];
}

export function getGradientForSlot(hour: number): string {
  return getTimeSlotForHour(hour).gradient;
}
