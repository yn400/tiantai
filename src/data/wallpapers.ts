// ── 壁纸池：按 public/landscapes 实际文件生成，每时段可轮换 ──
export type SlotKey = "dawn" | "morning" | "noon" | "afternoon" | "sunset" | "night";
export const WALLPAPER_POOL: Record<SlotKey, string[]> = {
  dawn : [
    "landscapes/dawn-00base.webp",
    "landscapes/dawn-14759241.webp",
    "landscapes/dawn-14694749.webp",
  ],
  morning : [
    "landscapes/morning-00base.webp",
    "landscapes/morning-14483752.webp",
    "landscapes/morning-15184959.webp",
  ],
  noon : [
    "landscapes/noon-00base.webp",
    "landscapes/noon-14544965.webp",
    "landscapes/noon-15069059.webp",
  ],
  afternoon : [
    "landscapes/afternoon-00base.webp",
    "landscapes/afternoon-14700714.webp",
  ],
  sunset : [
    "landscapes/sunset-00base.webp",
    "landscapes/sunset-14721204.webp",
    "landscapes/sunset-15003820.webp",
  ],
  night : [
    "landscapes/night-00base.webp",
    "landscapes/night-14440807.webp",
    "landscapes/night-15021342.webp",
  ],
};
