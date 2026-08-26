/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sky: {
          950: "#050810",
          900: "#0a1020",
          850: "#0e1527",
        },
        warm: {
          50: "#ede5d8",
          100: "#f0b96b",
          200: "#e07d3a",
          300: "rgba(237,229,216,0.42)",
          400: "rgba(237,229,216,0.38)",
          500: "rgba(237,229,216,0.08)",
        },
        mood: {
          rad: "#f0b96b",
          good: "#7eccc8",
          ok: "#b8a7e8",
          low: "#7aa8d4",
          rough: "#ff7e72",
        },
      },
      fontFamily: {
        // 本地字体栈：优先 Noto/思源宋系，逐级回落到系统衬线，绝不依赖在线字体
        serif: ['"Noto Serif SC"', '"Source Han Serif SC"', '"STZhongsong"', '"STSong"', "SimSun", "serif"],
        xiaowei: ['"ZCOOL XiaoWei"', '"STZhongsong"', "SimSun", "serif"],
      },
      borderRadius: {
        glass: "20px",
      },
      maxWidth: {
        app: "430px",
      },
      animation: {
        "fade-in": "fadeIn 0.35s ease forwards",
        blink: "blink 1s step-end infinite",
        "typing-dot": "tdot 0.9s ease-in-out infinite",
        "wave-bar": "wv 0.75s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
        "fade-slide": "fadeSlideIn 0.3s ease forwards",
        // 唯美氛围层
        kenburns: "kenburns 36s ease-in-out infinite alternate",
        "float-slow": "floatSlow 7s ease-in-out infinite",
        "glow-pulse": "glowPulse 4s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        tdot: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        wv: {
          "0%,100%": { height: "5px" },
          "50%": { height: "18px" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        fadeSlideIn: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        kenburns: {
          from: { transform: "scale(1) translateY(0%)" },
          to: { transform: "scale(1.12) translateY(-2.5%)" },
        },
        floatSlow: {
          "0%,100%": { transform: "translateY(0) translateX(0)", opacity: "0.25" },
          "50%": { transform: "translateY(-16px) translateX(6px)", opacity: "0.7" },
        },
        glowPulse: {
          "0%,100%": { opacity: "0.35" },
          "50%": { opacity: "0.85" },
        },
      },
    },
  },
  plugins: [],
};
