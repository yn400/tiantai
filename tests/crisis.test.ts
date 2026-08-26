import { describe, it, expect } from "vitest";
import { detectCrisis, HOTLINES, CRISIS_REPLY } from "../src/utils/crisis";

describe("detectCrisis", () => {
  it.each([
    "我不想活了",
    "最近总有自杀的念头",
    "活着好累，想死",
    "写了封遗书",
    "想跳楼",
  ])("命中危机信号: %s", (text) => {
    expect(detectCrisis(text)).toBe(true);
  });

  it.each([
    "今天天气真好",
    "工作太累了想辞职",
    "这部电影主角最后死了",
    "死记硬背没用",
  ])("普通内容不误报: %s", (text) => {
    expect(detectCrisis(text)).toBe(false);
  });
});

describe("危机资源完整性", () => {
  it("至少有一条热线且含全国热线", () => {
    expect(HOTLINES.length).toBeGreaterThanOrEqual(1);
    expect(HOTLINES.some((h) => h.phone.includes("12356"))).toBe(true);
  });

  it("固定回应包含求助引导", () => {
    expect(CRISIS_REPLY.length).toBeGreaterThan(20);
  });
});
