// ── 月相 & 二十四节气 ───────────────────────────────────────────
// 心灵主义氛围件：无需网络与后端，纯本地天文/历法近似。
// 精度定位：氛围展示级（月相 ±1 天、节气 ±1 天），不做农历日历用途。

// ── 月相 ────────────────────────────────────────────────────────

/** 朔望月平均长度（天） */
const SYNODIC = 29.530588853;
/** 参考新月：2000-01-06 18:14 UTC */
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14);

export interface MoonPhase {
  emoji: string;
  name: string;
  /** 被照亮比例 0~1 */
  illumination: number;
  /** 月龄（天） */
  ageDays: number;
}

export function getMoonPhase(date: Date = new Date()): MoonPhase {
  const days = (date.getTime() - NEW_MOON_EPOCH) / 86400000;
  const age = ((days % SYNODIC) + SYNODIC) % SYNODIC;
  const frac = age / SYNODIC;
  const illumination = (1 - Math.cos(2 * Math.PI * frac)) / 2;

  let emoji: string;
  let name: string;
  if (frac < 0.03 || frac > 0.97) { emoji = "🌑"; name = "新月"; }
  else if (frac < 0.22) { emoji = "🌒"; name = "娥眉月"; }
  else if (frac < 0.28) { emoji = "🌓"; name = "上弦月"; }
  else if (frac < 0.47) { emoji = "🌔"; name = "盈凸月"; }
  else if (frac < 0.53) { emoji = "🌕"; name = "满月"; }
  else if (frac < 0.72) { emoji = "🌖"; name = "亏凸月"; }
  else if (frac < 0.78) { emoji = "🌗"; name = "下弦月"; }
  else { emoji = "🌘"; name = "残月"; }

  return { emoji, name, illumination, ageDays: age };
}

// ── 二十四节气 ──────────────────────────────────────────────────
// 每个节气在公历年中的近似日期（±1 天，氛围级精度足够）

interface TermDef {
  name: string;
  month: number;
  day: number;
  line: string; // 一句节气物候诗意短句
}

const TERMS: TermDef[] = [
  { name: "小寒", month: 1, day: 5, line: "雁北乡，鹊始巢。最冷的日子，春天已经在路上。" },
  { name: "大寒", month: 1, day: 20, line: "冰坚而春近。熬过这一段，就是花开。" },
  { name: "立春", month: 2, day: 4, line: "东风解冻，万物含苞。一切都可以重新开始。" },
  { name: "雨水", month: 2, day: 19, line: "好雨知时节。润物无声的温柔也是力量。" },
  { name: "惊蛰", month: 3, day: 5, line: "春雷乍动，蛰虫惊起。你心里那件事，也该醒醒了。" },
  { name: "春分", month: 3, day: 20, line: "昼夜均，寒暑平。今天世界是平衡的，你也可以是。" },
  { name: "清明", month: 4, day: 4, line: "气清景明。记得想念，也记得好好生活。" },
  { name: "谷雨", month: 4, day: 20, line: "雨生百谷。你浇灌过的事，正在悄悄发芽。" },
  { name: "立夏", month: 5, day: 5, line: "万物并秀。把日子过得葱茏一点。" },
  { name: "小满", month: 5, day: 21, line: "小得盈满，未及全满。留一点余地，是生活的智慧。" },
  { name: "芒种", month: 6, day: 5, line: "有芒之谷可种。忙而不乱，种下即是收获的开始。" },
  { name: "夏至", month: 6, day: 21, line: "白昼最长的一天。光多留一会儿陪你。" },
  { name: "小暑", month: 7, day: 7, line: "温风至。心静自然凉，是真的。" },
  { name: "大暑", month: 7, day: 22, line: "湿热至极，秋在转角。再撑一下就凉快了。" },
  { name: "立秋", month: 8, day: 7, line: "凉风有信。一叶落而知天下秋。" },
  { name: "处暑", month: 8, day: 23, line: "暑气至此而止。燥热退散，适合整理心情。" },
  { name: "白露", month: 9, day: 7, line: "露从今夜白。夜里凉了，早点睡。" },
  { name: "秋分", month: 9, day: 23, line: "昼夜再度平分。得失各半，刚刚好。" },
  { name: "寒露", month: 10, day: 8, line: "露气寒冷。添一件外套，也添一分从容。" },
  { name: "霜降", month: 10, day: 23, line: "霜打过的菜更甜。经历过的难，都会变成味道。" },
  { name: "立冬", month: 11, day: 7, line: "万物收藏。允许自己进入低耗模式。" },
  { name: "小雪", month: 11, day: 22, line: "初雪将临。世界要安静下来了，你也歇歇。" },
  { name: "大雪", month: 12, day: 7, line: "雪落无声。厚厚的雪被下，种子在做梦。" },
  { name: "冬至", month: 12, day: 21, line: "阴极之至，阳气始生。最长的夜过后，白天会一天天变长。" },
];

function seasonEmoji(name: string): string {
  if (/春/.test(name)) return "🌱";
  if (/夏/.test(name)) return "☀️";
  if (/秋/.test(name)) return "🍂";
  return "❄️";
}

export interface SolarTerm {
  name: string;
  emoji: string;
  line: string;
}

export function getCurrentSolarTerm(date: Date = new Date()): SolarTerm {
  const y = date.getFullYear();
  const stamp = (m: number, d: number) => new Date(y, m - 1, d).getTime();
  const now = new Date(y, date.getMonth(), date.getDate()).getTime();

  // 找到最近一个已开始的节气；若早于小寒，则取去年冬至
  let current: TermDef | null = null;
  for (const t of TERMS) {
    if (now >= stamp(t.month, t.day)) current = t;
  }
  if (!current) current = TERMS[TERMS.length - 1]; // 去年冬至

  return {
    name: current.name,
    emoji: seasonEmoji(current.name),
    line: current.line,
  };
}
