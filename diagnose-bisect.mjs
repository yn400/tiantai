import { chromium } from "playwright-core";
const browser = await chromium.connectOverCDP("http://127.0.0.1:9223");
const page = browser.contexts()[0].pages()[0];
async function snap(label) {
  await page.screenshot({ path: `bisect-${label}.png` });
  console.log(`[${label}] 截图完成`);
}
await snap("0-original");
// 1: 移除全部 canvas
await page.evaluate(() => { document.querySelectorAll("canvas").forEach(c => c.remove()); });
await snap("1-no-canvas");
// 2: 禁用所有动画/过渡/滤镜/阴影
await page.evaluate(() => {
  const s = document.createElement("style");
  s.textContent = "*{animation:none!important;transition:none!important;backdrop-filter:none!important;filter:none!important;box-shadow:none!important}";
  document.head.appendChild(s);
});
await snap("2-no-anim");
// 3: 移除所有图片
await page.evaluate(() => { document.querySelectorAll("img").forEach(i => i.remove()); });
await snap("3-no-img");
// 4: 清空 React 树
await page.evaluate(() => { document.getElementById("root").innerHTML = ""; });
await snap("4-empty-root");
console.log("解剖完成");
await browser.close();
