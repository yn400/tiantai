import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// 自托管中文衬线字体（简中子集，按需加载，离线可用）
import "@fontsource/noto-serif-sc/chinese-simplified-400.css";
import "@fontsource/noto-serif-sc/chinese-simplified-600.css";
import "@fontsource/zcool-xiaowei/chinese-simplified-400.css";
import App from "./components/App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
