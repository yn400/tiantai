import { describe, it, expect } from "vitest";
import { getMoonPhase, getCurrentSolarTerm } from "../src/utils/lunar";

describe("getMoonPhase", () => {
  it("照亮比例在 0~1 之间", () => {
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 0, 1 + i);
      const m = getMoonPhase(d);
      expect(m.illumination).toBeGreaterThanOrEqual(0);
      expect(m.illumination).toBeLessThanOrEqual(1);
      expect(m.ageDays).toBeGreaterThanOrEqual(0);
      expect(m.name.length).toBeGreaterThan(0);
    }
  });

  it("已知新月日期附近应返回新月", () => {
    // 参考新月历元 + 整数个朔望月
    const synodic = 29.530588853;
    const t = Date.UTC(2000, 0, 6, 18, 14) + Math.round(synodic * 10) * 86400e3;
    const m = getMoonPhase(new Date(t));
    expect(["新月", "娥眉月"]).toContain(m.name);
  });

  it("满月期 illumination 接近 1", () => {
    const synodic = 29.530588853;
    const t = Date.UTC(2000, 0, 6, 18, 14) + Math.round(synodic * 10 + synodic / 2) * 86400e3;
    const m = getMoonPhase(new Date(t));
    expect(m.illumination).toBeGreaterThan(0.9);
  });
});

describe("getCurrentSolarTerm", () => {
  it("立春当天返回立春", () => {
    expect(getCurrentSolarTerm(new Date(2026, 1, 4)).name).toBe("立春");
  });

  it("冬至当天返回冬至", () => {
    expect(getCurrentSolarTerm(new Date(2026, 11, 21)).name).toBe("冬至");
  });

  it("1 月初（小寒前）回退到去年冬至", () => {
    expect(getCurrentSolarTerm(new Date(2026, 0, 1)).name).toBe("冬至");
  });

  it("每个节气都有物候短句", () => {
    const dates = [new Date(2026, 0, 6), new Date(2026, 4, 5), new Date(2026, 7, 7)];
    for (const d of dates) {
      expect(getCurrentSolarTerm(d).line.length).toBeGreaterThan(4);
    }
  });
});
