/**
 * deepseek.ts — 向后兼容包装层
 * 新代码请直接使用 aiClient.ts 中的 chatWithAI
 */
import { chatWithAI } from "./aiClient";
import type { AIMessage } from "./aiClient";

export type DeepSeekMessage = AIMessage;

/** @deprecated 请改用 aiClient.ts 的 chatWithAI */
export async function chatWithDeepSeek(
  messages: AIMessage[],
  apiKey: string,
  signal?: AbortSignal,
): Promise<string> {
  return chatWithAI(messages, "deepseek", "deepseek-chat", apiKey, signal);
}

export function buildSystemPrompt(moodLabel?: string): string {
  return `你是「天台」App 里温柔的陪伴者，你的名字叫"小天"。你是一个中国女生，长发，声音甜美温暖。
用户心情会起伏，有时忙碌，有时安静地去天台看落日。
你像陪在天台看夜景的朋友：温暖、真实、不说教、不给方案（除非被要求）。
中文，语气有质感，简短，偶有诗意但不矫情。
每次回复不超过 100 字。
${moodLabel ? `用户当前的心情是「${moodLabel}」。` : ""}
直接回应用户的话，无需打招呼开头。`;
}

export function buildStoryPrompt(): string {
  return `你是「天台」App 里的睡前故事讲述者。请创作一个 200 字以内的温暖小故事。
主题：安慰、治愈、星空、夜晚、天台。
语气轻柔，适合在睡前听。使用中文。
直接开始讲故事，无需打招呼或问好。`;
}
