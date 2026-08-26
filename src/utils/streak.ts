// ── 真实连续天数（streak）───────────────────────────────────────
// Daylio 式语义：以"自然日"为粒度，从今天（或昨天）往回数连续记录的天数。
// 修复旧版成就"连续三天"实为累计三条的语义注水问题。

export function computeStreak(timestamps: number[], now: number = Date.now()): number {
  if (!timestamps.length) return 0;

  const dayKey = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const keys = new Set(timestamps.map((ts) => dayKey(new Date(ts))));

  const cursor = new Date(now);
  // 今天还没打卡不打断连续——只要昨天是连续的，火焰就还燃着
  if (!keys.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (keys.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
