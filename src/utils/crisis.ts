// ── 危机安全层 ──────────────────────────────────────────────────
// 心理陪伴品类的合规与伦理红线（参照 Wysa / Woebot 的做法）：
// 检测到自伤/轻生信号时，跳过 AI 生成，直接给出固定的温柔回应 + 专业求助渠道。
// 原则：宁可误报，不可漏报。

export interface Hotline {
  name: string;
  /** 纯数字，供 tel: 拨号 */
  phone: string;
  /** 展示格式（带连字符） */
  display?: string;
  note?: string;
}

/** 求助热线（以官方最新公布为准） */
export const HOTLINES: Hotline[] = [
  { name: "全国统一心理援助热线", phone: "12356", note: "24 小时" },
  { name: "希望24热线", phone: "4001619995", display: "400-161-9995" },
];

const KEYWORDS = [
  "自杀",
  "轻生",
  "想死",
  "不想活",
  "活不下去",
  "结束生命",
  "结束这一切",
  "了结自己",
  "割腕",
  "跳楼",
  "跳桥",
  "跳河",
  "安眠药",
  "遗书",
];

/** 检测消息中是否包含危机信号 */
export function detectCrisis(text: string): boolean {
  return KEYWORDS.some((k) => text.includes(k));
}

/** 固定回应：温暖、不评判、把人引向专业支持（不走 AI 生成） */
export const CRISIS_REPLY = [
  "听到你这么说，我很心疼，也真的很在乎你。",
  "你现在承受的这些太重了，不该一个人扛着。",
  "帮我一个忙好吗——拨一下下面的电话，那头有受过专业训练的人，会认真听你说完，不打断、不评判。",
  "我一直在天台等你回来，但你值得比 AI 更专业的陪伴。",
].join("\n");
