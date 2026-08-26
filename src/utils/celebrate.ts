// ── 庆祝时刻总线 ────────────────────────────────────────────────
// 极轻量发布/订阅：store 的成就解锁动作广播，AchievementToasts 组件订阅。
// 不进 zustand——庆祝是瞬态 UI 事件，不是需要持久化的状态。

export interface Celebration {
  icon: string;
  title: string;
  description: string;
}

type Listener = (c: Celebration) => void;

let listener: Listener | null = null;

/** 订阅庆祝事件。返回取消订阅函数。 */
export function onCelebrate(fn: Listener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

export function celebrate(c: Celebration): void {
  listener?.(c);
}
