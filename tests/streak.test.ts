import { describe, it, expect } from "vitest";
import { computeStreak } from "../src/utils/streak";

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
};

describe("computeStreak", () => {
  it("空记录为 0", () => {
    expect(computeStreak([])).toBe(0);
  });

  it("今天打卡 → 连续 1 天", () => {
    expect(computeStreak([day(0)])).toBe(1);
  });

  it("今天没打但昨天打了 → 火焰不断，从昨天起算", () => {
    expect(computeStreak([day(-1)])).toBe(1);
  });

  it("连续三天（含今天）→ 3", () => {
    expect(computeStreak([day(0), day(-1), day(-2)])).toBe(3);
  });

  it("中间断一天 → 只算到断点", () => {
    expect(computeStreak([day(0), day(-1), day(-3), day(-4)])).toBe(2);
  });

  it("同一天多次记录只算一天", () => {
    const t = day(0);
    expect(computeStreak([t, t + 3600e3, t + 7200e3])).toBe(1);
  });
});
