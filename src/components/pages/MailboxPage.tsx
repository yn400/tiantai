import { useState } from "react";
import { Mail, Lock, Check } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import type { Mail as MailType } from "../../types";

export default function MailboxPage() {
  const mails = useAppStore((s) => s.mails);
  const addMail = useAppStore((s) => s.addMail);
  const openMail = useAppStore((s) => s.openMail);

  const [composing, setComposing] = useState(false);
  const [content, setContent] = useState("");
  const [delayDays, setDelayDays] = useState(7);

  const handleSend = () => {
    if (!content.trim()) return;
    const now = Date.now();
    const mail: MailType = {
      id: `mail-${now}`,
      content: content.trim(),
      createdAt: now,
      unlockAt: now + delayDays * 86400000,
      opened: false,
    };
    addMail(mail);
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    setContent("");
    setComposing(false);
  };

  const now = Date.now();
  const locked = mails.filter((m) => m.unlockAt > now && !m.opened);
  const unlocked = mails.filter((m) => m.unlockAt <= now && !m.opened);
  const read = mails.filter((m) => m.opened);

  return (
    <div className="px-[18px] pb-7 page-enter">
      {/* Header */}
      <div className="pt-[52px] mb-4 flex justify-between items-center">
        <div>
          <h1 className="font-xiaowei text-[25px] text-warm-50">天台信箱</h1>
          <p className="text-[11px] text-warm-300 mt-1 tracking-[.08em]">写给未来的自己</p>
        </div>
        <button
          onClick={() => setComposing(true)}
          className="px-4 py-2 rounded-full text-sm font-serif tracking-[.05em] text-sky-950 transition-transform active:scale-95"
          style={{ background: "linear-gradient(135deg, #f0b96b, #e07d3a)" }}
        >
          写信
        </button>
      </div>

      {/* Compose */}
      {composing && (
        <div className="glass p-4 mb-4 animate-fade-in">
          <p className="text-sm text-warm-50 mb-2.5">✍️ 写一封信</p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="亲爱的未来的我……"
            rows={4}
            autoFocus
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-warm-50 placeholder:text-warm-400 resize-none outline-none focus:border-warm-100/40 transition-colors font-serif"
          />
          <div className="flex items-center gap-2 mt-2.5 mb-3">
            <Lock size={14} className="text-warm-300" />
            <span className="text-xs text-warm-300">锁定</span>
            <select
              value={delayDays}
              onChange={(e) => setDelayDays(Number(e.target.value))}
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-warm-50 outline-none"
            >
              <option value={1}>明天</option>
              <option value={3}>3 天后</option>
              <option value={7}>一周后</option>
              <option value={30}>一个月后</option>
              <option value={90}>三个月后</option>
              <option value={365}>一年后</option>
            </select>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={handleSend}
              disabled={!content.trim()}
              className="flex-1 py-2 rounded-full text-sm font-serif tracking-[.05em] text-sky-950 disabled:opacity-40"
              style={{
                background: content.trim()
                  ? "linear-gradient(135deg, #f0b96b, #e07d3a)"
                  : "rgba(255,255,255,.08)",
                color: content.trim() ? "#050810" : "rgba(237,229,216,.42)",
              }}
            >
              投递 📮
            </button>
            <button
              onClick={() => setComposing(false)}
              className="px-5 py-2 rounded-full border border-white/15 text-xs text-warm-300"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Unlocked (can read now) */}
      {unlocked.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] text-warm-300 tracking-[.1em] mb-2.5">
            📬 可以打开了
          </p>
          {unlocked.map((m) => (
            <button
              key={m.id}
              onClick={() => openMail(m.id)}
              className="glass p-4 w-full text-left mb-2 hover:bg-white/[.07] transition-colors"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Mail size={14} className="text-warm-100" />
                <span className="text-xs text-warm-300">
                  {new Date(m.createdAt).toLocaleDateString("zh-CN")} 写的
                </span>
              </div>
              <p className="text-sm text-warm-50 leading-relaxed whitespace-pre-wrap">{m.content}</p>
            </button>
          ))}
        </div>
      )}

      {/* Locked */}
      {locked.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] text-warm-300 tracking-[.1em] mb-2.5">
            🔒 还在时光里
          </p>
          {locked.map((m) => (
            <div key={m.id} className="glass p-4 w-full mb-2 opacity-60">
              <div className="flex items-center gap-2 mb-1.5">
                <Lock size={14} className="text-warm-300" />
                <span className="text-xs text-warm-300">
                  {new Date(m.createdAt).toLocaleDateString("zh-CN")} 写的 ·{" "}
                  {Math.ceil((m.unlockAt - now) / 86400000)} 天后解锁
                </span>
              </div>
              <p className="text-sm text-warm-400 italic">这封信还在时光里旅行……</p>
            </div>
          ))}
        </div>
      )}

      {/* Read */}
      {read.length > 0 && (
        <div>
          <p className="text-[11px] text-warm-300 tracking-[.1em] mb-2.5">
            ✅ 已读
          </p>
          {read.map((m) => (
            <div key={m.id} className="glass p-4 w-full mb-2 opacity-50">
              <div className="flex items-center gap-2 mb-1.5">
                <Check size={14} className="text-mood-good" />
                <span className="text-xs text-warm-300">
                  {new Date(m.createdAt).toLocaleDateString("zh-CN")} 写的
                </span>
              </div>
              <p className="text-sm text-warm-400 leading-relaxed whitespace-pre-wrap">{m.content}</p>
            </div>
          ))}
        </div>
      )}

      {mails.length === 0 && !composing && (
        <div className="text-center py-16">
          <span className="text-5xl">💌</span>
          <p className="text-sm text-warm-400 mt-4 leading-relaxed">
            给未来的自己写一封信吧
            <br />
            到时间了才能打开
          </p>
        </div>
      )}
    </div>
  );
}
