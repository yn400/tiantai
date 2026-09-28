import { defineConfig, type Plugin } from "vite";
import { copyFileSync, mkdirSync } from "node:fs";
import react from "@vitejs/plugin-react";

// Electron 以 file:// 协议加载打包产物，origin 为 null，
// Vite 默认给 <script>/<link> 加的 crossorigin 属性会触发 CORS 拦截
// （"from origin 'null' has been blocked"），导致白/黑屏。
// 此插件在构建产物中移除所有 crossorigin 属性。
const stripCrossOrigin = (): Plugin => ({
  name: "strip-crossorigin",
  transformIndexHtml(html: string): string {
    return html.replace(/ crossorigin(="[^"]*")?/g, "");
  },
});

// demo/ 阶段一原型随构建发布到 dist/demo（GitHub Pages 在线演示入口，零 CI 改动）
const copyDemo = (): Plugin => ({
  name: "copy-demo",
  apply: "build",
  closeBundle() {
    mkdirSync("dist/demo", { recursive: true });
    copyFileSync("demo/tiantai.html", "dist/demo/tiantai.html");
  },
});

export default defineConfig({
  // 相对路径：file:// 协议下绝对路径 /assets/... 会解析到磁盘根导致全量 404
  base: "./",
  plugins: [react(), stripCrossOrigin(), copyDemo()],
  build: {
    rollupOptions: {
      output: {
        // three 独立分包:版本升级时今天页其余代码的缓存不失效
        manualChunks: { three: ["three"] },
      },
    },
  },
});
