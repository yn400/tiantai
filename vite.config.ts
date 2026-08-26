import { defineConfig, type Plugin } from "vite";
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

export default defineConfig({
  // 相对路径：file:// 协议下绝对路径 /assets/... 会解析到磁盘根导致全量 404
  base: "./",
  plugins: [react(), stripCrossOrigin()],
});
