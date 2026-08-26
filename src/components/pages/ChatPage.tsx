import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Trash2, Square } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { chatWithAIStream, resolveActiveModel } from "../../utils/aiClient";
import { buildSystemPrompt } from "../../utils/deepseek";
import { shouldUpdateMemory, updateMemory } from "../../utils/memory";
import { detectCrisis, CRISIS_REPLY } from "../../utils/crisis";
import CrisisSupport from "../CrisisSupport";
import type { ChatMessage } from "../../types";

export default function ChatPage() {
  const chatMessages = useAppStore((s) => s.chatMessages);
  const addChatMessage = useAppStore((s) => s.addChatMessage);
  const clearChat = useAppStore((s) => s.clearChat);
  const currentMood = useAppStore((s) => s.currentMood);
  const settings = useAppStore((s) => s.settings);
  const conversationMemory = useAppStore((s) => s.conversationMemory);
  const setConversationMemory = useAppStore((s) => s.setConversationMemory);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crisisAt, setCrisisAt] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const partialRef = useRef("");

  const active = useMemo(() => resolveActiveModel(settings), [settings]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, loading, streamText]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    // ── 危机信号优先：固定温柔回应 + 专业求助资源，不走 AI 生成 ──
    if (detectCrisis(text)) {
      addChatMessage({ role: "user", text, timestamp: Date.now() });
      addChatMessage({ role: "assistant", text: CRISIS_REPLY, timestamp: Date.now() });
      setCrisisAt(Date.now());
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
      return;
    }
    setCrisisAt(null);

    if (!active.apiKey) {
      setError("请先在「我的」页面配置所选模型的 API Key");
      return;
    }

    const userMsg: ChatMessage = { role: "user", text, timestamp: Date.now() };
    addChatMessage(userMsg);
    setInput("");
    setLoading(true);
    setError(null);
    setStreamText("");
    partialRef.current = "";

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const messages = [
        ...chatMessages.map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("assistant" as const),
          content: m.text,
        })),
        { role: "user" as const, content: text },
      ];

      // 流式：小天的回复逐字浮现，随时可停
      const full = await chatWithAIStream(
        [
          {
            role: "system",
            content:
              buildSystemPrompt(currentMood?.label) +
              (conversationMemory
                ? `\n\n你和用户之前的对话要点（请自然地引用，不要刻意复述）：${conversationMemory}`
                : ""),
          },
          ...messages,
        ],
        active.provider,
        active.model,
        active.apiKey,
        (t) => {
          partialRef.current = t;
          setStreamText(t);
        },
        controller.signal,
      );

      addChatMessage({ role: "assistant", text: full || "……我在。", timestamp: Date.now() });
      if (navigator.vibrate) navigator.vibrate(10);

      // 长期记忆：每累计 N 条用户消息后台滚动更新一次（不阻塞对话）
      const historyWithReply: ChatMessage[] = [
        ...chatMessages,
        userMsg,
        { role: "assistant", text: full, timestamp: Date.now() },
      ];
      if (shouldUpdateMemory(historyWithReply)) {
        void updateMemory(settings, historyWithReply, conversationMemory).then((m) => {
          if (m) setConversationMemory(m);
        });
      }
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") {
        // 用户主动停止：保留已生成的半截回复
        const partial = partialRef.current.trim();
        if (partial) {
          addChatMessage({ role: "assistant", text: `${partial} …`, timestamp: Date.now() });
        }
      } else {
        setError((err as Error).message || "网络出错了");
        addChatMessage({ role: "assistant", text: "信号有点弱，但我一直在这里。", timestamp: Date.now() });
      }
    } finally {
      setLoading(false);
      setStreamText(null);
      abortRef.current = null;
    }
  }, [input, loading, active, chatMessages, currentMood, conversationMemory, settings, addChatMessage, setConversationMemory]);

  const handleRetry = () => {
    setError(null);
    // Re-send last user message
    const lastUser = [...chatMessages].reverse().find((m) => m.role === "user");
    if (lastUser) {
      setInput(lastUser.text);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col h-full px-4 page-enter">
      {/* Header */}
      <div className="pt-[52px] shrink-0">
        <div className="flex justify-between items-center">
          <h1 className="font-xiaowei text-[25px] text-warm-50">陪我说说</h1>
          {chatMessages.length > 0 && (
            <button
              onClick={() => { clearChat(); setCrisisAt(null); }}
              className="text-warm-400 hover:text-warm-300 transition-colors p-1"
              aria-label="清空对话"
              title="清空对话"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
        <p className="text-[11px] text-warm-300 mt-1 tracking-[.08em]">AI · 随时都在</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-[13px] pb-2.5 mt-2">
        {chatMessages.length === 0 && streamText === null && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-warm-400 text-center leading-relaxed">
              嗨，我在这里。
              <br />
              不管今天是忙得脚不沾地，
              <br />
              还是一个人去了天台看落日——
              <br />
              都可以跟我说说。
            </p>
          </div>
        )}

        {chatMessages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[83%] px-[15px] py-[11px] rounded-[18px] text-[13.5px] leading-[1.78] tracking-[.025em] whitespace-pre-wrap ${
              m.role === "user"
                ? "self-end bg-gradient-to-br from-warm-100/20 to-warm-200/15 border border-warm-100/20 rounded-br-[5px]"
                : "self-start bg-white/5 border border-white/10 rounded-bl-[5px]"
            }`}
          >
            {m.text}
          </div>
        ))}

        {/* 流式回复气泡 */}
        {streamText !== null && (
          <div className="self-start max-w-[83%] px-[15px] py-[11px] rounded-[18px] rounded-bl-[5px] bg-white/5 border border-white/10 text-[13.5px] leading-[1.78] tracking-[.025em] whitespace-pre-wrap animate-fade-in">
            {streamText ? (
              <span>
                {streamText}
                <span className="inline-block w-[2px] h-[14px] ml-0.5 align-middle bg-warm-100 animate-blink" />
              </span>
            ) : (
              <span className="flex gap-[5px] items-center py-0.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-[7px] h-[7px] rounded-full bg-warm-300 animate-typing-dot"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
            )}
          </div>
        )}

        {error && (
          <div className="self-center glass px-4 py-2 text-xs text-red-300/80 flex items-center gap-2">
            <span>{error}</span>
            <button onClick={handleRetry} className="underline text-warm-100">
              重试
            </button>
          </div>
        )}

        {/* 危机关怀卡片：跟随触发消息出现在对话流中 */}
        {crisisAt !== null && <CrisisSupport />}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="relative pb-3.5 shrink-0">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && send()}
          placeholder="说点什么……"
          disabled={loading}
          className="w-full bg-white/5 border border-white/10 rounded-3xl py-3 pl-[18px] pr-[46px] text-sm text-warm-50 placeholder:text-warm-400 outline-none focus:border-warm-100/40 transition-colors font-serif"
          aria-label="输入消息"
        />
        <button
          onClick={loading ? stop : send}
          disabled={!loading && !input.trim()}
          className="absolute right-[7px] top-1/2 -translate-y-1/2 w-[34px] h-[34px] rounded-full flex items-center justify-center transition-colors"
          style={{
            background:
              input.trim() || loading
                ? "linear-gradient(135deg, #f0b96b, #e07d3a)"
                : "rgba(255,255,255,.08)",
          }}
          aria-label={loading ? "停止生成" : "发送"}
          title={loading ? "停止生成" : "发送"}
        >
          {loading ? (
            <Square size={12} fill="#07091a" color="#07091a" />
          ) : (
            <Send
              size={15}
              fill={input.trim() ? "#07091a" : "rgba(237,229,216,.42)"}
              color={input.trim() ? "#07091a" : "transparent"}
            />
          )}
        </button>
      </div>
    </div>
  );
}
