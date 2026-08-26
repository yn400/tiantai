import { useMemo } from "react";
import { getDailyQuote, getDailyFortune } from "../utils/quotes";

export function useDailyQuote() {
  return useMemo(() => getDailyQuote(), []);
}

export function useDailyFortune() {
  return useMemo(() => getDailyFortune(), []);
}
