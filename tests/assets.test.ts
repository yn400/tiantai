import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { WALLPAPER_POOL } from "../src/data/wallpapers";
import { QUOTES, FORTUNES } from "../src/utils/quotes";

const ROOT = join(__dirname, "..");
const POOL_FILE = readFileSync(join(ROOT, "src/data/wallpapers.ts"), "utf8");

describe("壁纸池完整性", () => {
  it("六个时段都有壁纸", () => {
    for (const key of ["dawn", "morning", "noon", "afternoon", "sunset", "night"] as const) {
      expect(WALLPAPER_POOL[key].length).toBeGreaterThanOrEqual(1);
    }
  });

  it("清单引用的每个文件都真实存在于 public/landscapes", () => {
    const refs = [...POOL_FILE.matchAll(/"([^"]+\.webp)"/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThanOrEqual(13);
    for (const ref of refs) {
      expect(existsSync(join(ROOT, "public", ref))).toBe(true);
    }
  });
});

describe("文案库规模与质量", () => {
  it("每日一言 ≥60 条且无重复", () => {
    expect(QUOTES.length).toBeGreaterThanOrEqual(60);
    expect(new Set(QUOTES.map((q) => q.text)).size).toBe(QUOTES.length);
    for (const q of QUOTES) {
      expect(q.text.length).toBeGreaterThan(4);
      expect(q.author.startsWith("—")).toBe(true);
    }
  });

  it("天台签 ≥24 条且无重复", () => {
    expect(FORTUNES.length).toBeGreaterThanOrEqual(24);
    expect(new Set(FORTUNES).size).toBe(FORTUNES.length);
  });
});
