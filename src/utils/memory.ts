// ── 长期记忆：滚动摘要 ──────────────────────────────────────────
// 策略（Replika 式记忆的轻量本地版）：
// - 每累计 N 条用户消息，用一次廉价调用把「旧摘要 + 最近对话」压缩成新摘要
// - 摘要写入 store.conversationMemory，之后每次对话作为 system 提示注入
// - 失败静默跳过：记忆是增强项，绝不能干扰主对话

import { chatWithAI, resolveActiveModel } from "./aiClient";
import type { AppSettings, ChatMessage } from "../types";

/** 每累计多少条用户消息刷新一次记忆 */
const TRIGGER_EVERY = 4;

/** 摘要参与计算的最近消息条数 */
const RECENT_WINDOW = 16;

let updating = false;

export function shouldUpdateMemory(messages: ChatMessage[]): boolean {
  if (updating) return false;
  const userCount = messages.filter((m) => m.role === "user").length;
  return userCount > 0 && userCount % TRIGGER_EVERY === 0;
}

/**
 * 生成新的记忆摘要。返回 null 表示本次不更新（失败/信息不足/并发占用）。
 */
export async function updateMemory(
  settings: AppSettings,
  history: ChatMessage[],
  existing: string,
): Promise<string | null> {
  if (updating) return null;
  updating = true;
  try {
    const { provider, model, apiKey } = resolveActiveModel(settings);
    if (!apiKey) return null;

    const recent = history
      .slice(-RECENT_WINDOW)
      .map((m) => `${m.role === "user" ? "用户" : "小天"}：${m.text}`)
      .join("\n");

    const system = [
      "你在为陪伴App维护一份关于用户的长期记忆摘要。",
      "基于已有记忆与最近对话，输出不超过80字的第三人称要点：用户的近况、喜好、在意的事、情绪主题。",
      "只输出摘要正文，不要客套、不要标题、不要引号。",
      "若最近对话没有新的长期价值信息，原样输出已有记忆。",
    ].join("");

    const user = [
      existing ? `已有记忆：${existing}` : "尚无已有记忆。",
      "",
      `最近对话：\n${recent}`,
    ].join("\n");

    const out = await chatWithAI(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      provider,
      model,
      apiKey,
    );
    const clean = out.trim();
    return clean.length > 0 && clean.length <= 300 ? clean : null;
  } catch {
    return null;
  } finally {
    updating = false;
  }
}
