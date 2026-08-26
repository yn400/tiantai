// ── Weather via Open-Meteo (free, no API key) ──────────────────

export interface WeatherData {
  temp: number;
  condition: string; // "clear" | "rain" | "snow" | "cloudy" | "fog" | "storm"
  conditionLabel: string;
  icon: string;
  city: string;
  /** 街道/镇级地名（反向地理编码，可能为空） */
  place?: string;
  /** 空气质量指数（US EPA 标准） */
  aqi?: { value: number; label: string };
  /** 未来 2 小时内的降水预报：null=无降水；数字=预计 N 分钟后开始（15 分钟精度） */
  rainInMinutes?: number | null;
}

function aqiLabel(v: number): string {
  if (v <= 50) return "优";
  if (v <= 100) return "良";
  if (v <= 150) return "轻度污染";
  if (v <= 200) return "中度污染";
  if (v <= 300) return "重度污染";
  return "严重污染";
}

async function fetchAqi(lat: number, lon: number): Promise<WeatherData["aqi"] | undefined> {
  try {
    const res = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`,
    );
    const d = (await res.json()) as { current?: { us_aqi?: number } };
    const v = d.current?.us_aqi;
    if (typeof v !== "number") return undefined;
    return { value: Math.round(v), label: aqiLabel(v) };
  } catch {
    return undefined;
  }
}

// Weather codes → simplified conditions
function weatherCodeToCondition(code: number): { condition: string; label: string; icon: string } {
  if (code === 0) return { condition: "clear", label: "晴朗", icon: "☀️" };
  if (code <= 3) return { condition: "cloudy", label: "多云", icon: "⛅" };
  if (code <= 48) return { condition: "fog", label: "雾", icon: "🌫️" };
  if (code <= 57) return { condition: "rain", label: "小雨", icon: "🌧️" };
  if (code <= 67) return { condition: "rain", label: "雨", icon: "🌧️" };
  if (code <= 77) return { condition: "snow", label: "雪", icon: "❄️" };
  if (code <= 82) return { condition: "rain", label: "阵雨", icon: "🌧️" };
  if (code <= 86) return { condition: "snow", label: "阵雪", icon: "❄️" };
  if (code === 95) return { condition: "storm", label: "雷暴", icon: "⛈️" };
  if (code <= 99) return { condition: "storm", label: "雷暴冰雹", icon: "⛈️" };
  return { condition: "clear", label: "晴", icon: "☀️" };
}

let cachedWeather: WeatherData | null = null;
let cacheTime = 0;

const CACHE_MS = 30 * 60 * 1000;

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("no-geolocation"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 10 * 60 * 1000,
    });
  });
}

/** 街道/镇级地名：Nominatim zoom=16（街区级） */
async function reverseGeocode(lat: number, lon: number): Promise<{ city: string; place?: string }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&accept-language=zh-CN`,
    );
    const d = (await res.json()) as {
      address?: Record<string, string>;
    };
    const a = d.address ?? {};
    const place = a.suburb || a.neighbourhood || a.town || a.village || a.city_district || a.road;
    const city = a.city || a.town || a.county || a.state || "你所在的城市";
    return { city, place };
  } catch {
    return { city: "你所在的城市" };
  }
}

export async function getWeather(force = false): Promise<WeatherData | null> {
  if (!force && cachedWeather && Date.now() - cacheTime < CACHE_MS) return cachedWeather;

  try {
    const pos = await getPosition();
    const { latitude, longitude } = pos.coords;

    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`,
    );
    const data = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };

    const code = data.current?.weather_code ?? 0;
    const cond = weatherCodeToCondition(code);
    const geo = await reverseGeocode(latitude, longitude);
    const aqi = await fetchAqi(latitude, longitude);

    // 分钟级降水预报：解决"城市一半下雨一半晴"的痛点（坐标级 nowcast）
    let rainInMinutes: number | null | undefined;
    try {
      const nr = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&minutely_15=precipitation&forecast_days=1`,
      );
      const nd = (await nr.json()) as { minutely_15?: { precipitation?: number[] } };
      const arr = nd.minutely_15?.precipitation ?? [];
      const idx = arr.findIndex((v) => v > 0.05);
      rainInMinutes = idx === -1 ? null : idx * 15;
    } catch {
      rainInMinutes = undefined;
    }

    cachedWeather = {
      temp: Math.round(data.current?.temperature_2m ?? 20),
      condition: cond.condition,
      conditionLabel: cond.label,
      icon: cond.icon,
      city: geo.city,
      place: geo.place,
      aqi,
      rainInMinutes,
    };
    cacheTime = Date.now();
    return cachedWeather;
  } catch {
    return null;
  }
}

/** 强制刷新（用户点击定位按钮时） */
export function refreshWeather(): Promise<WeatherData | null> {
  cacheTime = 0;
  return getWeather(true);
}

/** 通知权限：Electron 需主进程 setAppUserModelId 后才能弹系统通知 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const p = await Notification.requestPermission();
  return p === "granted";
}
