// ── 密钥安全存取（桌面端 safeStorage / Web 端 localStorage 回退）──
// 桌面模式：Key 只进主进程 DPAPI 加密文件，localStorage 不再持有明文。
// Web 模式（无 Electron）：回退为随 settings 走 localStorage（与浏览器习惯一致）。

import type { AppSettings } from "../types";

export const SECRET_FIELDS = [
  "deepseekApiKey",
  "openaiApiKey",
  "qwenApiKey",
  "moonshotApiKey",
  "zhipuApiKey",
  "asrApiKey",
] as const;

export type SecretField = (typeof SECRET_FIELDS)[number];

export function isSecureMode(): boolean {
  return typeof window !== "undefined" && !!window.tiantaiSecure;
}

/** 从主进程加密存储加载全部密钥 */
export async function hydrateSecrets(): Promise<Partial<AppSettings>> {
  if (!isSecureMode()) return {};
  const out: Record<string, string> = {};
  for (const field of SECRET_FIELDS) {
    // eslint-disable-next-line no-await-in-loop
    const v = await window.tiantaiSecure!.get(field);
    if (v) out[field] = v;
  }
  return out as Partial<AppSettings>;
}

/** 写入单个密钥到加密存储 */
export async function saveSecretField(field: SecretField, value: string): Promise<void> {
  await window.tiantaiSecure?.set(field, value);
}

/** 从 settings 对象里剥掉所有密钥字段（持久化前调用） */
export function stripSecrets<T extends Partial<AppSettings>>(obj: T): T {
  const copy: Record<string, unknown> = { ...obj };
  for (const k of SECRET_FIELDS) delete copy[k];
  return copy as T;
}
