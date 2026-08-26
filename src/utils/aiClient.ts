import type { AIProvider, AppSettings } from "../types";

export type { AIProvider };

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelOption {
  id: string;
  name: string;
}

export interface ProviderConfig {
  id: AIProvider;
  name: string;
  baseUrl: string;
  models: ModelOption[];
  placeholder: string;
  defaultModel: string;
}

export const PROVIDERS: ProviderConfig[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1/chat/completions",
    models: [
      { id: "deepseek-chat", name: "DeepSeek V3 (Chat)" },
      { id: "deepseek-reasoner", name: "DeepSeek R1 (Reasoner)" },
    ],
    placeholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
    defaultModel: "deepseek-chat",
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    models: [
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-4o-mini", name: "GPT-4o mini" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
      { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
    ],
    placeholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
    defaultModel: "gpt-4o-mini",
  },
  {
    id: "qwen",
    name: "通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    models: [
      { id: "qwen-turbo", name: "Qwen Turbo" },
      { id: "qwen-plus", name: "Qwen Plus" },
      { id: "qwen-max", name: "Qwen Max" },
      { id: "qwen-long", name: "Qwen Long" },
    ],
    placeholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
    defaultModel: "qwen-turbo",
  },
  {
    id: "moonshot",
    name: "Kimi 月之暗面",
    baseUrl: "https://api.moonshot.cn/v1/chat/completions",
    models: [
      { id: "moonshot-v1-8k", name: "Moonshot 8k" },
      { id: "moonshot-v1-32k", name: "Moonshot 32k" },
      { id: "moonshot-v1-128k", name: "Moonshot 128k" },
    ],
    placeholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
    defaultModel: "moonshot-v1-8k",
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    models: [
      { id: "glm-4-flash", name: "GLM-4 Flash（免费）" },
      { id: "glm-4-air", name: "GLM-4 Air" },
      { id: "glm-4", name: "GLM-4" },
      { id: "glm-4-plus", name: "GLM-4 Plus" },
    ],
    placeholder: "xxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxx",
    defaultModel: "glm-4-flash",
  },
];

export const PROVIDER_MAP: Record<AIProvider, ProviderConfig> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p]),
) as Record<AIProvider, ProviderConfig>;

/**
 * 统一 AI 对话接口，支持所有 OpenAI 兼容格式的提供商。
 */
export async function chatWithAI(
  messages: AIMessage[],
  provider: AIProvider,
  model: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<string> {
  const config = PROVIDER_MAP[provider];
  if (!config) throw new Error(`未知的模型提供商: ${provider}`);
  if (!apiKey) throw new Error(`请先在设置中配置 ${config.name} API Key`);

  const res = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 300,
      temperature: 0.8,
      top_p: 0.9,
    }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ||
        `API 错误 ${res.status}`,
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  return data.choices?.[0]?.message?.content || "……我在。";
}

/**
 * 根据当前 provider 返回对应的 API Key。
 */
export function getApiKeyForProvider(
  provider: AIProvider,
  settings: {
    deepseekApiKey: string;
    openaiApiKey: string;
    qwenApiKey: string;
    moonshotApiKey: string;
    zhipuApiKey: string;
  },
): string {
  switch (provider) {
    case "deepseek":
      return settings.deepseekApiKey;
    case "openai":
      return settings.openaiApiKey;
    case "qwen":
      return settings.qwenApiKey;
    case "moonshot":
      return settings.moonshotApiKey;
    case "zhipu":
      return settings.zhipuApiKey;
    default:
      return settings.deepseekApiKey;
  }
}

/** 当前生效的 AI 路由：provider + 校验过的 model + 对应 key */
export interface ActiveModel {
  provider: AIProvider;
  model: string;
  apiKey: string;
}

export function resolveActiveModel(settings: AppSettings): ActiveModel {
  const provider = settings.aiProvider ?? "deepseek";
  const config = PROVIDER_MAP[provider];
  const apiKey = getApiKeyForProvider(provider, settings);
  // 切换 provider 后残留的旧模型 id 一律回落到该 provider 的默认模型
  const model = config.models.some((m) => m.id === settings.aiModel)
    ? settings.aiModel
    : config.defaultModel;
  return { provider, model, apiKey };
}

/**
 * SSE 流式对话（OpenAI 兼容 delta 协议）。
 * onDelta 收到的是"累计全文"，直接 setState 即可。
 * 返回完整回复文本。
 */
export async function chatWithAIStream(
  messages: AIMessage[],
  provider: AIProvider,
  model: string,
  apiKey: string,
  onDelta: (fullText: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const config = PROVIDER_MAP[provider];
  if (!config) throw new Error(`未知的模型提供商: ${provider}`);
  if (!apiKey) throw new Error(`请先在设置中配置 ${config.name} API Key`);

  const res = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: 300,
      temperature: 0.8,
      top_p: 0.9,
    }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ||
        `API 错误 ${res.status}`,
    );
  }

  // 极端环境无响应体时退化为非流式
  if (!res.body) return chatWithAI(messages, provider, model, apiKey, signal);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  const processLine = (line: string): void => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    try {
      const json = JSON.parse(payload) as {
        choices?: { delta?: { content?: string }; message?: { content?: string } }[];
      };
      const choice = json.choices?.[0];
      const delta = choice?.delta?.content ?? choice?.message?.content ?? "";
      if (delta) {
        full += delta;
        onDelta(full);
      }
    } catch {
      /* 忽略无法解析的心跳/注释行 */
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // 末段可能被分包截断，留待下一块拼接
    for (const line of lines) processLine(line);
  }
  buffer += decoder.decode(); // flush 残余多字节字符
  if (buffer) processLine(buffer);

  return full || "……我在。";
}
