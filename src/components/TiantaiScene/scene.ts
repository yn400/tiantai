// ── TiantaiScene：三渲二天台场景模块（纯 three.js，零 React 依赖）──────
//
// 从阶段一单文件原型移植（原型见 demo/tiantai.html，可独立双击运行）。
// 工程约定对齐 src/fx/engine.ts 的调度哲学：单 rAF / dt 归一化 /
// prefers-reduced-motion 静态帧 / 与 FX 引擎并存互不接管。
//
// 用法：
//   const scene = createTiantaiScene(canvas, { slot: "sunset" });
//   scene.setState("night"); scene.setParallax(px); scene.resize();
//   scene.setPaused(true); scene.dispose();
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { OutlineEffect } from "three/addons/effects/OutlineEffect.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";

export type TiantaiSlot = "dawn" | "sunset" | "night";
export type TiantaiWeather = "clear" | "rain" | "snow" | "cloudy" | "fog" | "storm";

export interface TiantaiSceneOptions {
  /** 初始时段（默认黄昏）；之后用 setState 切换 */
  slot?: TiantaiSlot;
}

export interface TiantaiSceneHandle {
  setState(slot: TiantaiSlot): void;
  /** 天气钩子：rain/storm 压灰压暗、雪/雾轻降饱和（轻量变体，非雨系统） */
  setWeather(condition: TiantaiWeather | null | undefined): void;
  /** 滚动视差：传入容器 scrollTop(px)，内部换算为克制的取景偏移 */
  setParallax(scrollTopPx: number): void;
  /** 循环切换 2~3 个预设机位（今天页"换一张"按钮的场景态） */
  cycleViewPreset(): void;
  /** 页面不可见/不在视口时完全停渲染（省电红线） */
  setPaused(paused: boolean): void;
  resize(): void;
  dispose(): void;
}

// ============================ 色板（四档，收敛于此） ============================
const C = (hex: string) => new THREE.Color(hex);
const SUN_AZ = 0.244; // 太阳方位角(右侧三分线)
const SUN_XZ = new THREE.Vector3(Math.sin(SUN_AZ), 0, -Math.cos(SUN_AZ));

const DUSK = {
  top: C("#2a1f4e"), mid: C("#8f4a78"), low: C("#d4694a"), horizon: C("#f5a45f"),
  sunCol: C("#ffe0b0"), sunDisc: 1.9, sunHalo: 0.45, sunElev: 7.0,
  bandCol: C("#ffb27a"), bandA: 1.0, bandW: 0.16,
  cityGlowCol: C("#52384e"), cityGlowA: 0.10,
  starA: 0, moonA: 0,
  hemiSky: C("#9a6a90"), hemiGround: C("#5c4468"), hemiInt: 1.2,
  dirCol: C("#ff9a5c"), dirInt: 2.8, ptInt: 0,
  bldA: C("#4a3150"), bldB: C("#8f5a72"), bldC: C("#d08a74"),
  floor: C("#524054"), parapet: C("#7a5f70"),
  wtTank: C("#7c4e44"), wtLegs: C("#463244"), antenna: C("#3a2c3e"),
  rope: C("#6a5248"), shirt: C("#e4d6c2"), pants: C("#6e7c98"), towel: C("#a86a5e"),
  fur: C("#df8a4c"), cream: C("#f2d9b4"),
  pot: C("#a85c40"), cactus: C("#5f8a58"), bottle: C("#7fa391"), cushion: C("#7e4650"),
  chime: C("#c8a678"),
  winRate: 0.12, winWarmRatio: 0.95, winWarm: C("#ffc37a"), winCold: C("#b8ccff"), winGlow: 1.2,
  cloudLit: C("#ffd4ae"), cloudShade: C("#8a5a7c"), cloudAlpha: 0.92,
  dustCol: C("#ffd8a2"), dustAlpha: 0.32,
  bloom: 0.5, grain: 0.035,
  rimCol: C("#ffb27a"), rimA: 0.8,
};

const BLUE = {
  top: C("#141a3e"), mid: C("#3d4a80"), low: C("#5c5488"), horizon: C("#7d6a92"),
  sunCol: C("#e8a080"), sunDisc: 1.1, sunHalo: 0.34, sunElev: -1.4,
  bandCol: C("#c8705a"), bandA: 1.0, bandW: 0.055,
  cityGlowCol: C("#52384e"), cityGlowA: 0.32,
  starA: 0.12, moonA: 0,
  hemiSky: C("#565a8c"), hemiGround: C("#34304e"), hemiInt: 0.95,
  dirCol: C("#96687c"), dirInt: 0.7, ptInt: 14,
  bldA: C("#413d62"), bldB: C("#5c547c"), bldC: C("#71698c"),
  floor: C("#4e4458"), parapet: C("#5f5464"),
  wtTank: C("#64465a"), wtLegs: C("#302842"), antenna: C("#2a2438"),
  rope: C("#4a3e4c"), shirt: C("#a89cb4"), pants: C("#46506c"), towel: C("#8c5a62"),
  fur: C("#a86644"), cream: C("#bca688"),
  pot: C("#7e4c3e"), cactus: C("#46684c"), bottle: C("#62807a"), cushion: C("#5c3a44"),
  chime: C("#8e7a64"),
  winRate: 0.42, winWarmRatio: 0.7, winWarm: C("#ffc37a"), winCold: C("#9fb4d8"), winGlow: 1.25,
  cloudLit: C("#a4849a"), cloudShade: C("#444870"), cloudAlpha: 0.8,
  dustCol: C("#c8b8dc"), dustAlpha: 0.3,
  bloom: 0.45, grain: 0.04,
  rimCol: C("#d88a6a"), rimA: 0.5,
};

const NIGHT = {
  top: C("#050810"), mid: C("#0a0f26"), low: C("#141b38"), horizon: C("#1c2448"),
  sunCol: C("#ffe0b0"), sunDisc: 0, sunHalo: 0, sunElev: -8,
  bandCol: C("#c8705a"), bandA: 0, bandW: 0.055,
  cityGlowCol: C("#52384e"), cityGlowA: 0.85,
  starA: 1.0, moonA: 1.0,
  hemiSky: C("#232c4e"), hemiGround: C("#101424"), hemiInt: 0.6,
  dirCol: C("#4e5e92"), dirInt: 0.5, ptInt: 18,
  bldA: C("#141828"), bldB: C("#1c2136"), bldC: C("#212741"),
  floor: C("#262230"), parapet: C("#302a38"),
  wtTank: C("#382c3c"), wtLegs: C("#201a2a"), antenna: C("#1a1624"),
  rope: C("#2a2432"), shirt: C("#46424e"), pants: C("#30344a"), towel: C("#42323c"),
  fur: C("#644233"), cream: C("#7e6a56"),
  pot: C("#4c302c"), cactus: C("#2c4434"), bottle: C("#3c5048"), cushion: C("#38242c"),
  chime: C("#584a3a"),
  winRate: 0.7, winWarmRatio: 0.8, winWarm: C("#ffc37a"), winCold: C("#96aad2"), winGlow: 1.25,
  cloudLit: C("#20274a"), cloudShade: C("#0e132a"), cloudAlpha: 0.55,
  dustCol: C("#9db2dc"), dustAlpha: 0.28,
  bloom: 0.58, grain: 0.055,
  rimCol: C("#6a5c68"), rimA: 0.15,
};

// 黎明：由三档派生（冷靛底 + 残月低垂 + 城市灯未熄尽）
const DAWN = {
  top: C("#1c2244"), mid: C("#3a3a6e"), low: C("#6a5a86"), horizon: C("#a8829a"),
  sunCol: C("#e8b090"), sunDisc: 0, sunHalo: 0.28, sunElev: -3.5,
  bandCol: C("#b87a6e"), bandA: 0.5, bandW: 0.09,
  cityGlowCol: C("#4a3a5e"), cityGlowA: 0.42,
  starA: 0.3, moonA: 0.9,
  hemiSky: C("#4a4a78"), hemiGround: C("#2c2848"), hemiInt: 0.95,
  dirCol: C("#8a7a9a"), dirInt: 0.9, ptInt: 14,
  bldA: C("#2c2a4c"), bldB: C("#44406a"), bldC: C("#5c5884"),
  floor: C("#3a3348"), parapet: C("#4c445c"),
  wtTank: C("#4a3a48"), wtLegs: C("#2c2638"), antenna: C("#262236"),
  rope: C("#3c3444"), shirt: C("#9a92a8"), pants: C("#46506c"), towel: C("#7a5a62"),
  fur: C("#b06a44"), cream: C("#c8ac94"),
  pot: C("#68403a"), cactus: C("#3c5a46"), bottle: C("#52706a"), cushion: C("#4c303c"),
  chime: C("#6a5a4a"),
  winRate: 0.35, winWarmRatio: 0.9, winWarm: C("#ffc37a"), winCold: C("#9fb4d8"), winGlow: 1.3,
  cloudLit: C("#9a86a8"), cloudShade: C("#3a3c64"), cloudAlpha: 0.75,
  dustCol: C("#b8a8d0"), dustAlpha: 0.3,
  bloom: 0.45, grain: 0.05,
  rimCol: C("#8a7a8e"), rimA: 0.4,
};

const PALETTES: Record<TiantaiSlot, typeof DUSK> = { dawn: DAWN, sunset: DUSK, night: NIGHT };
const COLOR_KEYS = Object.keys(DUSK).filter((k) => (DUSK as Record<string, unknown>)[k] instanceof THREE.Color);
const NUM_KEYS = Object.keys(DUSK).filter((k) => !COLOR_KEYS.includes(k));

const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function mulberry(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const REDUCED =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// 天气 → 压灰/压暗系数（rain 钩子：整体降饱和 + 天色压灰一层 + 楼灯更晕）
const WEATHER_FX: Record<string, { desat: number; dim: number; winDim: number }> = {
  rain: { desat: 0.14, dim: 0.93, winDim: 0.35 },
  storm: { desat: 0.2, dim: 0.88, winDim: 0.45 },
  snow: { desat: 0.08, dim: 1.0, winDim: 0.1 },
  fog: { desat: 0.16, dim: 0.95, winDim: 0.25 },
};
function weatherFX(condition?: TiantaiWeather | null) {
  if (!condition) return { desat: 0, dim: 1, winDim: 0 };
  return WEATHER_FX[condition] ?? { desat: 0, dim: 1, winDim: 0 };
}

// ============================ 场景工厂 ============================
export function createTiantaiScene(
  canvas: HTMLCanvasElement,
  options: TiantaiSceneOptions = {},
): TiantaiSceneHandle {
  // ---------- 基础 ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf0985c, 24, 92); // 雾色每帧同步自色板 horizon → 逐通道相等

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enablePan = false;
  // 横幅里滚轮必须留给页面滚动：禁缩放
  controls.enableZoom = false;
  controls.rotateSpeed = 0.5;
  controls.minPolarAngle = 0.9;
  controls.maxPolarAngle = 1.45;
  controls.minDistance = 4;
  controls.maxDistance = 16;
  controls.minAzimuthAngle = -Math.PI / 3;
  controls.maxAzimuthAngle = Math.PI / 3;
  controls.autoRotateSpeed = 0.2;

  // ---------- 共享 uniforms ----------
  const SHARED = {
    uTime: { value: 0 },
    uSunDirW: { value: V3(0, 1, 0) },
    uRimCol: { value: DUSK.rimCol.clone() },
    uRimA: { value: 1 },
    uWinRate: { value: 0.12 },
    uWinWarmRatio: { value: 0.95 },
    uWinWarm: { value: DUSK.winWarm.clone() },
    uWinCold: { value: DUSK.winCold.clone() },
    uWinDim: { value: 0 }, // 天气钩子:雨天楼灯更晕(发光变柔)
  };

  function makeGradientMap() {
    const steps = [0.35, 0.62, 0.86, 1.0];
    const data = new Uint8Array(steps.map((v) => Math.round(v * 255)));
    const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RedFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }
  const gradientMap = makeGradientMap();

  // rim:背光侧 + 剪影边缘 + 顶部加权,只给一条发光的边
  function injectRim(mat: THREE.MeshToonMaterial) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uSunDirW = SHARED.uSunDirW;
      shader.uniforms.uRimCol = SHARED.uRimCol;
      shader.uniforms.uRimA = SHARED.uRimA;
      shader.vertexShader = `
        varying vec3 vWorldN;
        varying vec3 vWorldP;
      ` + shader.vertexShader.replace("#include <begin_vertex>", `
        #include <begin_vertex>
        vWorldN = normalize(mat3(modelMatrix) * normal);
        vWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;
      `);
      shader.fragmentShader = `
        uniform vec3 uSunDirW, uRimCol;
        uniform float uRimA;
        varying vec3 vWorldN;
        varying vec3 vWorldP;
      ` + shader.fragmentShader.replace("#include <opaque_fragment>", `
        {
          vec3 V = normalize(cameraPosition - vWorldP);
          float fres = pow(1.0 - abs(dot(normalize(vWorldN), V)), 3.0);
          float back = smoothstep(0.18, -0.4, dot(normalize(vWorldN), uSunDirW));
          float top = 0.55 + 0.45 * smoothstep(-0.3, 0.6, normalize(vWorldN).y);
          outgoingLight += uRimCol * (fres * back * top * uRimA);
        }
        #include <opaque_fragment>
      `);
    };
    return mat;
  }

  function heroMat(color: THREE.Color, opts: { double?: boolean; transparent?: boolean; opacity?: number; thickness?: number; rim?: boolean } = {}) {
    const m = new THREE.MeshToonMaterial({
      color, gradientMap, fog: false,
      side: opts.double ? THREE.DoubleSide : THREE.FrontSide,
      transparent: !!opts.transparent, opacity: opts.opacity ?? 1,
    });
    if (opts.rim !== false) injectRim(m);
    m.userData.outlineParameters = { thickness: opts.thickness ?? 0.004, keepAlive: true };
    return m;
  }
  function plainMat(color: THREE.Color, opts: Partial<THREE.MeshToonMaterialParameters> = {}) {
    const m = new THREE.MeshToonMaterial({ color, gradientMap, ...opts });
    m.userData.outlineParameters = { visible: false };
    return m;
  }

  // 楼群材质:instanced + 程序化窗灯
  function buildingMat(baseColor: THREE.Color, opts: { glow?: number; winScale?: number } = {}) {
    const m = new THREE.MeshToonMaterial({ color: baseColor, gradientMap });
    m.userData.outlineParameters = { visible: false };
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = SHARED.uTime;
      shader.uniforms.uWinRate = SHARED.uWinRate;
      shader.uniforms.uWinWarmRatio = SHARED.uWinWarmRatio;
      shader.uniforms.uWinWarm = SHARED.uWinWarm;
      shader.uniforms.uWinCold = SHARED.uWinCold;
      shader.uniforms.uWinDim = SHARED.uWinDim;
      shader.uniforms.uWinGlow = { value: opts.glow ?? 1.3 };
      shader.uniforms.uWinScale = { value: opts.winScale ?? 1.0 };
      shader.vertexShader = `
        attribute vec3 aSize;
        attribute float aSeed;
        varying vec3 vBPos;
        varying vec3 vBSize;
        varying float vSeed;
        varying vec3 vBNormal;
        varying vec3 vBWPos;
      ` + shader.vertexShader.replace("#include <begin_vertex>", `
        #include <begin_vertex>
        vBPos = position;
        vBSize = aSize;
        vSeed = aSeed;
        vBNormal = normal;
        #ifdef USE_INSTANCING
          vBWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vBWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif
      `);
      shader.fragmentShader = `
        uniform float uTime, uWinRate, uWinWarmRatio, uWinGlow, uWinScale, uWinDim;
        uniform vec3 uWinWarm, uWinCold;
        varying vec3 vBPos;
        varying vec3 vBSize;
        varying float vSeed;
        varying vec3 vBNormal;
        varying vec3 vBWPos;
        float hash21(vec2 p) {
          p = fract(p * vec2(234.34, 435.345));
          p += dot(p, p + 34.23);
          return fract(p.x * p.y);
        }
      ` + shader.fragmentShader
        .replace("#include <color_fragment>", `
          #include <color_fragment>
          float winShape = 0.0;
          vec3 winCol = vec3(0.0);
          vec3 bN = normalize(vBNormal);
          float isSide = max(step(0.5, abs(bN.x)), step(0.5, abs(bN.z)));
          if (isSide > 0.5 && vBSize.y > 5.0) {
            vec3 pM = (vBPos + 0.5) * vBSize;
            vec2 fc = (abs(bN.x) > 0.5) ? pM.zy : pM.xy;
            vec2 cell = vec2(2.6 + mod(vSeed, 1.2), 3.2 + mod(vSeed * 1.7, 0.8)) * uWinScale;
            vec2 gid = floor(fc / cell);
            vec2 gf = fract(fc / cell);
            vec2 w = step(vec2(0.34, 0.22), gf) * step(gf, vec2(0.70, 0.74));
            float isWin = w.x * w.y
              * step(1.2, fc.y) * step(fc.y, vBSize.y - 1.2)
              * step(0.5, fc.x) * step(fc.x, vBSize.x - 0.5);
            float hh = hash21(gid + vSeed * 137.0);
            float lit = smoothstep(hh - 0.05, hh + 0.01, uWinRate);
            float bDark = step(hash21(vec2(vSeed, 7.7)), 0.3);
            lit *= 1.0 - bDark * 0.85;
            float fh = hash21(gid * 1.91 + vSeed);
            float flick = mix(1.0, smoothstep(0.35, 0.65, sin(uTime * (0.3 + fh) + fh * 40.0) * 0.5 + 0.5), step(0.93, fh));
            lit *= flick;
            float hc = hash21(gid * 3.7 + vSeed * 29.0);
            winCol = mix(uWinCold, uWinWarm, step(hc, uWinWarmRatio)) * (0.7 + 0.45 * hash21(gid * 5.3 + vSeed));
            float facing = abs(dot(normalize(vBNormal), normalize(cameraPosition - vBWPos)));
            float wf = smoothstep(0.16, 0.34, facing);
            winShape = isWin * lit * wf;
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.72 + vec3(0.012, 0.011, 0.018), isWin * (1.0 - lit) * wf);
          }
        `)
        .replace("#include <emissivemap_fragment>", `
          #include <emissivemap_fragment>
          totalEmissiveRadiance += winCol * winShape * uWinGlow * (1.0 - uWinDim * 0.4);
        `);
    };
    return m;
  }

  // 布料/晾衣绳顶点波动
  function injectWave(mat: THREE.MeshToonMaterial, ampX: number, ampZ: number) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = SHARED.uTime;
      shader.uniforms.uPhase = { value: Math.random() * 6.28 };
      shader.uniforms.uAmpX = { value: ampX };
      shader.uniforms.uAmpZ = { value: ampZ };
      shader.vertexShader = `
        attribute float aWave;
        uniform float uTime, uPhase, uAmpX, uAmpZ;
      ` + shader.vertexShader.replace("#include <begin_vertex>", `
        #include <begin_vertex>
        float wv = aWave;
        transformed.x += sin(uTime * 1.45 + uPhase + wv * 2.1) * wv * uAmpX;
        transformed.z += sin(uTime * 1.02 + uPhase * 1.31 + wv * 3.2) * wv * uAmpZ;
      `);
    };
    return mat;
  }

  // ---------- 分层构建 ----------
  const registry: Array<[THREE.MeshToonMaterial, string]> = [];
  const disposables: Array<{ dispose(): void }> = [];
  function track<T extends { dispose(): void }>(d: T): T { disposables.push(d); return d; }

  // 天空
  const skyUniforms = {
    uTop: { value: DUSK.top.clone() },
    uMid: { value: DUSK.mid.clone() },
    uLow: { value: DUSK.low.clone() },
    uHorizon: { value: DUSK.horizon.clone() },
    uSunDir: { value: V3(0, 1, 0) },
    uSunCol: { value: DUSK.sunCol.clone() },
    uSunDisc: { value: 1.9 },
    uSunHalo: { value: 0.45 },
    uBandCol: { value: DUSK.bandCol.clone() },
    uBandA: { value: 1.0 },
    uBandW: { value: 0.16 },
    uCityGlowCol: { value: DUSK.cityGlowCol.clone() },
    uCityGlowA: { value: 0.1 },
    uStarA: { value: 0 },
    uMoonDir: { value: V3(-0.371, 0.122, -0.920).normalize() },
    uMoonCut: { value: V3(0, 1, 0) },
    uMoonA: { value: 0 },
  };
  {
    const md = skyUniforms.uMoonDir.value;
    const axis = V3(0, 0, 0).crossVectors(md, V3(0, 1, 0)).normalize();
    skyUniforms.uMoonCut.value = md.clone().applyAxisAngle(axis, 0.011).applyAxisAngle(V3(0, 1, 0), 0.004);
  }
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    fog: false, depthWrite: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vDir = wp.xyz - cameraPosition;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 uTop, uMid, uLow, uHorizon;
      uniform vec3 uSunDir, uSunCol, uBandCol, uCityGlowCol;
      uniform float uSunDisc, uSunHalo, uBandA, uBandW, uCityGlowA, uStarA, uMoonA;
      uniform vec3 uMoonDir, uMoonCut;
      varying vec3 vDir;
      float hash13(vec3 p) {
        p = fract(p * 443.8975);
        p += dot(p, p.yzx + 19.19);
        return fract((p.x + p.y) * p.z);
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = mix(uHorizon, uLow, smoothstep(0.0, 0.10, h));
        c = mix(c, uMid, smoothstep(0.07, 0.30, h));
        c = mix(c, uTop, smoothstep(0.26, 0.75, h));
        c = mix(uHorizon, c, smoothstep(-0.12, 0.0, h));
        vec2 dxz = normalize(d.xz);
        vec2 sxz = normalize(uSunDir.xz);
        float band = exp(-pow(max(h, 0.0) / uBandW, 1.6)) * pow(max(dot(dxz, sxz), 0.0), 3.0) * smoothstep(0.004, 0.05, h);
        c = mix(c, uBandCol, band * uBandA);
        float cg = exp(-pow(max(h, 0.0) / 0.05, 1.35));
        c = mix(c, uCityGlowCol, cg * uCityGlowA);
        float sd = max(dot(d, uSunDir), 0.0);
        float disc = pow(sd, 600.0) * uSunDisc;
        float halo = (pow(sd, 24.0) * 0.5 + pow(sd, 6.0) * 0.22) * uSunHalo;
        c += (uSunCol * disc + uSunCol * halo) * smoothstep(-0.035, 0.0, h);
        if (uMoonA > 0.001) {
          float md = dot(d, uMoonDir);
          float mDisc = smoothstep(0.99958, 0.99980, md);
          float cut = smoothstep(0.99932, 0.99962, dot(d, uMoonCut));
          c += vec3(0.82, 0.87, 1.0) * (mDisc * (1.0 - cut)) * 1.05 * uMoonA;
          c += vec3(0.42, 0.50, 0.70) * pow(max(md, 0.0), 350.0) * 0.22 * uMoonA;
        }
        if (uStarA > 0.001) {
          vec3 sp = d * 160.0;
          vec3 id = floor(sp);
          vec3 f = fract(sp) - 0.5;
          float rn = hash13(id);
          float star = step(0.9975, rn);
          vec3 off = vec3(hash13(id + 7.1), hash13(id + 13.7), hash13(id + 29.3)) - 0.5;
          star *= smoothstep(0.16, 0.02, length(f - off * 0.7));
          star *= 0.35 + 0.65 * hash13(id + 51.0);
          c += vec3(0.88, 0.91, 1.0) * star * uStarA * smoothstep(0.02, 0.22, h);
        }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const skyGeo = track(new THREE.SphereGeometry(100, 48, 32));
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  skyMat.userData.outlineParameters = { visible: false };
  scene.add(sky);

  // 云(canvas 轮廓贴图,扁平 billboard)
  function makeCloudTexture(variant: number): THREE.CanvasTexture {
    const cv = document.createElement("canvas");
    cv.width = 256; cv.height = 128;
    const x = cv.getContext("2d")!;
    const rand = mulberry(variant * 911 + 7);
    x.filter = "blur(9px)";
    x.fillStyle = "#fff";
    const n = 10 + variant * 2;
    for (let i = 0; i < n; i++) {
      const px = 44 + rand() * 168;
      const pr = 13 + rand() * 17;
      const py = 92 - pr * (0.35 + rand() * 0.8);
      x.beginPath(); x.arc(px, py, pr, 0, 6.2832); x.fill();
    }
    x.fillRect(48, 74, 160, 20);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.NoColorSpace;
    return track(tex);
  }
  const cloudVert = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;
  function makeCloudMat(tex: THREE.Texture) {
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: tex },
        uLit: { value: DUSK.cloudLit.clone() },
        uShade: { value: DUSK.cloudShade.clone() },
        uAlpha: { value: 0.92 },
        uTint: { value: 0.5 },
        uFlip: { value: 0 },
      },
      vertexShader: cloudVert,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform vec3 uLit, uShade;
        uniform float uAlpha, uTint, uFlip;
        varying vec2 vUv;
        void main() {
          float a = texture2D(uMap, vUv).a;
          if (a < 0.012) discard;
          float lit = smoothstep(0.12, 0.92, vUv.y);
          vec3 col = mix(uShade, uLit, lit);
          float sunSide = mix(1.0 - vUv.x, vUv.x, uFlip);
          col += uLit * pow(max(sunSide - 0.3, 0.0) / 0.7, 1.6) * 0.55 * uTint * lit;
          gl_FragColor = vec4(col, a * uAlpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    });
    m.userData.outlineParameters = { visible: false };
    return m;
  }
  const clouds: THREE.Mesh[] = [];
  {
    const matA = makeCloudMat(makeCloudTexture(0));
    const matB = makeCloudMat(makeCloudTexture(1));
    track(matA); track(matB);
    const defs: Array<[number, number, number, number, number, THREE.ShaderMaterial, number]> = [
      [-20, 20, -78, 42, 10, matA, 0.25],
      [26, 9, -90, 54, 11, matB, 1.0],
      [52, 18, -70, 34, 8, matB, 0.5],
      [2, 28, -96, 62, 12, matA, 0.35],
      [-70, 12, -84, 38, 8, matB, 0.45],
    ];
    const planeGeo = track(new THREE.PlaneGeometry(1, 1));
    for (const [x, y, z, w, h, mat, tint] of defs) {
      const m = new THREE.Mesh(planeGeo, mat);
      m.position.set(x, y, z);
      m.scale.set(w, h, 1);
      m.renderOrder = -5;
      m.userData.baseX = x;
      m.userData.tint = tint;
      m.onBeforeRender = function () {
        (this.material as THREE.ShaderMaterial).uniforms.uTint.value = this.userData.tint as number;
        const ry = this.rotation.y;
        const right = V3(Math.cos(ry), 0, -Math.sin(ry));
        (this.material as THREE.ShaderMaterial).uniforms.uFlip.value = right.dot(SUN_XZ) >= 0 ? 1 : 0;
      };
      scene.add(m);
      clouds.push(m);
    }
  }

  // 城市三带
  const buildingGeoBase = track(new RoundedBoxGeometry(1, 1, 1, 2, 0.06));
  function buildBand(list: number[][], material: THREE.MeshToonMaterial) {
    const geo = track(buildingGeoBase.clone());
    const mesh = new THREE.InstancedMesh(geo, material, list.length);
    mesh.userData.outlineParameters = { visible: false };
    const dummy = new THREE.Object3D();
    const sizes = new Float32Array(list.length * 3);
    const seeds = new Float32Array(list.length);
    const rand = mulberry(4321);
    list.forEach((b, i) => {
      const [x, h, w, d, z] = b;
      dummy.position.set(x, -18 + h / 2, z);
      dummy.scale.set(w, h, d);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      sizes[i * 3] = w; sizes[i * 3 + 1] = h; sizes[i * 3 + 2] = d;
      seeds[i] = rand() * 100;
    });
    geo.setAttribute("aSize", new THREE.InstancedBufferAttribute(sizes, 3));
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
    scene.add(mesh);
  }
  const BAND_A = [
    [-40, 13, 9, 6, -26], [-31, 9, 6, 5, -25], [-24, 17, 8, 6, -27], [-16, 11, 7, 5, -25],
    [-9, 15, 9, 6, -26], [-1, 8, 5, 5, -24], [6, 19, 8, 6, -27], [14, 12, 6, 5, -25],
    [21, 16, 9, 6, -26], [30, 10, 7, 5, -24], [38, 14, 8, 6, -26],
    [-36, 20, 10, 7, -34], [-27, 14, 7, 6, -33], [-18, 23, 9, 7, -35], [-10, 10, 6, 5, -33],
    [-2, 16, 8, 6, -34], [8, 13, 7, 6, -33], [17, 21, 9, 7, -35], [26, 11, 6, 5, -33],
    [34, 18, 8, 6, -34], [42, 12, 7, 6, -33],
    [0, 18, 16, 11, 1.5],
  ];
  {
    const mA = buildingMat(DUSK.bldA, { glow: 1.2 });
    registry.push([mA, "bldA"]); track(mA);
    buildBand(BAND_A, mA);
  }
  {
    // 对街楼顶水箱
    const tank = new THREE.CylinderGeometry(0.9, 0.9, 1.4, 10); tank.translate(0, 1.7, 0);
    const cap = new THREE.ConeGeometry(0.95, 0.5, 10); cap.translate(0, 2.65, 0);
    const parts: THREE.BufferGeometry[] = [tank, cap];
    for (const [lx, lz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
      const leg = new THREE.CylinderGeometry(0.07, 0.07, 1.0, 6);
      leg.translate(lx, 0.5, lz);
      parts.push(leg);
    }
    const geo = track(mergeGeometries(parts));
    const mat = plainMat(DUSK.bldA);
    registry.push([mat, "bldA"]); track(mat);
    const mesh = new THREE.InstancedMesh(geo, mat, 7);
    mesh.userData.outlineParameters = { visible: false };
    const dummy = new THREE.Object3D();
    const spots = [[-40, -26], [-24, -27], [6, -27], [21, -26], [-36, -34], [-18, -35], [17, -35]];
    spots.forEach((s, i) => {
      const hh = BAND_A.find((b) => b[0] === s[0]);
      dummy.position.set(s[0] + 1.5, -18 + (hh ? hh[1] : 14), s[1]);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    scene.add(mesh);
  }
  const BAND_B = [
    [-38, 26, 12, 8, -50], [-26, 17, 8, 7, -48], [-14, 29, 10, 8, -52], [-2, 20, 9, 7, -49],
    [10, 24, 11, 8, -50], [22, 15, 8, 7, -47], [34, 27, 10, 8, -52], [44, 19, 9, 7, -48],
    [-30, 22, 11, 8, -64], [-12, 25, 9, 8, -66], [6, 18, 10, 8, -63], [28, 23, 10, 8, -66], [40, 16, 8, 7, -62],
  ];
  {
    const mB = buildingMat(DUSK.bldB, { glow: 0.7, winScale: 1.6 });
    registry.push([mB, "bldB"]); track(mB);
    buildBand(BAND_B, mB);
  }
  const BAND_C = [
    [-34, 18, 14, 9, -76], [-20, 24, 12, 9, -80], [-6, 15, 13, 8, -74], [8, 21, 12, 9, -78],
    [22, 16, 14, 8, -75], [36, 20, 13, 9, -80], [-46, 14, 12, 8, -78], [46, 17, 12, 8, -76],
    [-27, 20, 12, 8, -90], [14, 18, 13, 8, -92],
    [-62, 16, 14, 9, -84], [60, 15, 13, 9, -82], [-58, 20, 12, 8, -94], [64, 18, 12, 8, -92],
    [55, 22, 14, 10, -68], [-55, 22, 14, 10, -68],
  ];
  {
    const mC = buildingMat(DUSK.bldC, { glow: 0 });
    registry.push([mC, "bldC"]); track(mC);
    buildBand(BAND_C, mC);
  }
  {
    // 标志性高塔
    const tower = new THREE.BoxGeometry(4.5, 30, 4.5); tower.translate(0, 15, 0);
    const spire = new THREE.CylinderGeometry(0.12, 0.3, 5, 6); spire.translate(0, 32.5, 0);
    const geo = track(mergeGeometries([tower, spire]));
    const mat = plainMat(DUSK.bldB);
    registry.push([mat, "bldB"]); track(mat);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(-20, -18, -58);
    m.userData.outlineParameters = { visible: false };
    scene.add(m);
  }
  {
    // 街道地面
    const mat = new THREE.MeshBasicMaterial({ color: 0x241c2e });
    mat.userData.outlineParameters = { visible: false };
    track(mat);
    const g = new THREE.Mesh(track(new THREE.PlaneGeometry(500, 500)), mat);
    g.rotation.x = -Math.PI / 2;
    g.position.y = -18.2;
    g.userData.outlineParameters = { visible: false };
    scene.add(g);
  }

  // 天台本体
  {
    const floorMat = plainMat(DUSK.floor);
    registry.push([floorMat, "floor"]); track(floorMat);
    const slabGeo = track(new THREE.BoxGeometry(16, 0.5, 11.5));
    const slab = new THREE.Mesh(slabGeo, floorMat);
    slab.position.set(0, -0.25, 1.4);
    slab.receiveShadow = true;
    slab.userData.outlineParameters = { visible: false };
    scene.add(slab);

    const paraMat = heroMat(DUSK.parapet, { thickness: 0.0045 });
    registry.push([paraMat, "parapet"]); track(paraMat);
    const f = new THREE.BoxGeometry(16.7, 0.9, 0.35); f.translate(0, 0.45, -4.175);
    const l = new THREE.BoxGeometry(0.35, 0.9, 11.5); l.translate(-8.175, 0.45, 1.4);
    const r = new THREE.BoxGeometry(0.35, 0.9, 11.5); r.translate(8.175, 0.45, 1.4);
    const paraGeo = track(mergeGeometries([f, l, r]));
    const para = new THREE.Mesh(paraGeo, paraMat);
    para.castShadow = true;
    para.receiveShadow = true;
    scene.add(para);
  }

  // 水塔
  {
    const legMat = heroMat(DUSK.wtLegs, { thickness: 0.0035 });
    registry.push([legMat, "wtLegs"]); track(legMat);
    const legGeos: THREE.BufferGeometry[] = [];
    for (const [lx, lz] of [[-0.72, -0.72], [0.72, -0.72], [-0.72, 0.72], [0.72, 0.72]]) {
      const leg = new THREE.CylinderGeometry(0.045, 0.055, 1.85, 8);
      leg.translate(lx * 0.92, 0.92, lz * 0.92);
      leg.rotateX(lz > 0 ? 0.06 : -0.06);
      leg.rotateZ(lx > 0 ? -0.06 : 0.06);
      legGeos.push(leg);
    }
    for (const s of [-1, 1]) {
      const b1 = new THREE.CylinderGeometry(0.018, 0.018, 1.75, 6);
      b1.rotateZ(0.72 * s); b1.translate(0, 0.92, s * 0.72);
      const b2 = new THREE.CylinderGeometry(0.018, 0.018, 1.75, 6);
      b2.rotateZ(-0.72 * s); b2.translate(0, 0.92, s * 0.72);
      legGeos.push(b1, b2);
      const b3 = new THREE.CylinderGeometry(0.018, 0.018, 1.75, 6);
      b3.rotateX(0.72 * s); b3.translate(s * 0.72, 0.92, 0);
      const b4 = new THREE.CylinderGeometry(0.018, 0.018, 1.75, 6);
      b4.rotateX(-0.72 * s); b4.translate(s * 0.72, 0.92, 0);
      legGeos.push(b3, b4);
    }
    const plat = new THREE.CylinderGeometry(0.9, 0.9, 0.08, 14);
    plat.translate(0, 1.9, 0);
    legGeos.push(plat);
    const legs = new THREE.Mesh(track(mergeGeometries(legGeos)), legMat);
    legs.castShadow = true;
    legs.position.set(-5.0, 0, -2.6);
    scene.add(legs);

    const tankMat = heroMat(DUSK.wtTank, { thickness: 0.004 });
    registry.push([tankMat, "wtTank"]); track(tankMat);
    const tank = new THREE.CylinderGeometry(0.82, 0.82, 1.5, 18); tank.translate(0, 2.72, 0);
    const capGeo = new THREE.ConeGeometry(0.88, 0.5, 18); capGeo.translate(0, 3.72, 0);
    const tankMesh = new THREE.Mesh(track(mergeGeometries([tank, capGeo])), tankMat);
    tankMesh.castShadow = true;
    tankMesh.position.set(-5.0, 0, -2.6);
    scene.add(tankMesh);
  }

  // 天线 + 晾衣绳 T 杆
  const antennaParts: THREE.BufferGeometry[] = [];
  function bar(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, r: number) {
    const a = V3(x1, y1, z1), b = V3(x2, y2, z2);
    const len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(r, r, len, 6);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const dirv = b.clone().sub(a).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dirv);
    g.applyQuaternion(q);
    g.translate(mid.x, mid.y, mid.z);
    antennaParts.push(g);
  }
  {
    bar(4.6, 0, -3.3, 4.6, 3.2, -3.3, 0.03);
    bar(4.05, 2.3, -3.3, 5.15, 2.3, -3.3, 0.014);
    bar(4.05, 2.7, -3.3, 5.15, 2.7, -3.3, 0.014);
    bar(4.2, 3.05, -3.3, 5.0, 3.05, -3.3, 0.014);
    bar(-6.9, 0, 2.0, -6.9, 1.9, 2.0, 0.022);
    bar(-7.2, 1.5, 2.0, -6.6, 1.5, 2.0, 0.012);
    bar(-1.4, 0, -3.1, -1.4, 2.3, -3.1, 0.028);
    bar(-1.85, 2.25, -3.1, -0.6, 2.25, -3.1, 0.016);
    const mat = heroMat(DUSK.antenna, { thickness: 0.003 });
    registry.push([mat, "antenna"]); track(mat);
    const mesh = new THREE.Mesh(track(mergeGeometries(antennaParts)), mat);
    mesh.castShadow = true;
    scene.add(mesh);
  }

  // 晾衣绳 + 衣物
  const ropeA = V3(4.6, 3.12, -3.3), ropeB = V3(-1.55, 2.28, -3.1);
  const ropeMid = ropeA.clone().add(ropeB).multiplyScalar(0.5); ropeMid.y -= 0.8;
  const ropeCurve = new THREE.QuadraticBezierCurve3(ropeA, ropeMid, ropeB);
  {
    const tube = new THREE.TubeGeometry(ropeCurve, 40, 0.013, 6, false);
    const n = tube.attributes.position.count;
    const wave = new Float32Array(n);
    const tubular = 40, radial = 6;
    for (let i = 0; i < n; i++) {
      const u = Math.floor(i / (radial + 1)) / tubular;
      wave[i] = Math.sin(Math.PI * u);
    }
    tube.setAttribute("aWave", new THREE.BufferAttribute(wave, 1));
    const mat = heroMat(DUSK.rope, { thickness: 0.003, rim: false });
    registry.push([mat, "rope"]); track(mat);
    injectWave(mat, 0.012, 0.05);
    scene.add(new THREE.Mesh(tube, mat));
  }
  function makeGarment(parts: Array<{ geo: THREE.BufferGeometry; top: number; bottom: number }>, color: THREE.Color, key: string) {
    let total = 0;
    for (const p of parts) total += p.geo.attributes.position.count;
    const wave = new Float32Array(total);
    let off = 0;
    for (const p of parts) {
      const pos = p.geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        wave[off + i] = Math.min(1, Math.max(0, (p.top - y) / (p.top - p.bottom)));
      }
      off += pos.count;
    }
    const geo = track(mergeGeometries(parts.map((p) => p.geo)));
    geo.setAttribute("aWave", new THREE.BufferAttribute(wave, 1));
    const mat = heroMat(color, { double: true, rim: false });
    registry.push([mat, key]); track(mat);
    injectWave(mat, 0.05, 0.032);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  }
  {
    const torso = new THREE.BoxGeometry(0.34, 0.44, 0.035); torso.translate(0, -0.24, 0);
    const sl = new THREE.BoxGeometry(0.09, 0.3, 0.035); sl.rotateZ(0.5); sl.translate(-0.24, -0.1, 0);
    const sr = new THREE.BoxGeometry(0.09, 0.3, 0.035); sr.rotateZ(-0.5); sr.translate(0.24, -0.1, 0);
    const shirt = makeGarment(
      [{ geo: torso, top: 0, bottom: -0.5 }, { geo: sl, top: 0, bottom: -0.5 }, { geo: sr, top: 0, bottom: -0.5 }],
      DUSK.shirt, "shirt");
    const p1 = ropeCurve.getPoint(0.52); shirt.position.set(p1.x, p1.y - 0.01, p1.z);
    shirt.rotation.y = 0.12;
    shirt.scale.setScalar(1.15);
    scene.add(shirt);
    const waist = new THREE.BoxGeometry(0.3, 0.12, 0.03); waist.translate(0, -0.06, 0);
    const ll = new THREE.BoxGeometry(0.12, 0.36, 0.03); ll.translate(-0.075, -0.3, 0);
    const rl = new THREE.BoxGeometry(0.12, 0.36, 0.03); rl.translate(0.075, -0.3, 0);
    const pants = makeGarment(
      [{ geo: waist, top: 0, bottom: -0.48 }, { geo: ll, top: 0, bottom: -0.48 }, { geo: rl, top: 0, bottom: -0.48 }],
      DUSK.pants, "pants");
    const p2 = ropeCurve.getPoint(0.72); pants.position.set(p2.x, p2.y - 0.01, p2.z);
    pants.rotation.y = -0.08;
    pants.scale.setScalar(1.15);
    scene.add(pants);
    const tw = new THREE.BoxGeometry(0.3, 0.4, 0.015); tw.translate(0, -0.22, 0);
    const towel = makeGarment([{ geo: tw, top: 0, bottom: -0.42 }], DUSK.towel, "towel");
    const p3 = ropeCurve.getPoint(0.88); towel.position.set(p3.x, p3.y - 0.005, p3.z);
    towel.rotation.y = 0.05;
    towel.scale.setScalar(1.15);
    scene.add(towel);
  }

  // 橘猫
  const cat: {
    group: THREE.Group; body: THREE.Mesh; head: THREE.Group;
    ears: THREE.Mesh[]; tail: THREE.Mesh;
  } = {
    group: new THREE.Group(), body: null as unknown as THREE.Mesh,
    head: null as unknown as THREE.Group, ears: [], tail: null as unknown as THREE.Mesh,
  };
  {
    const furMat = heroMat(DUSK.fur, { thickness: 0.005 });
    registry.push([furMat, "fur"]); track(furMat);
    const creamMat = heroMat(DUSK.cream, { rim: false, thickness: 0.005 });
    registry.push([creamMat, "cream"]); track(creamMat);
    const g = cat.group;
    g.position.set(1.75, 0.9, -4.05);
    g.rotation.y = -0.2;
    const haunch = new THREE.SphereGeometry(0.15, 18, 14);
    haunch.scale(1.05, 1.12, 1.3); haunch.translate(0, 0.155, 0.045);
    const torso = new THREE.SphereGeometry(0.115, 18, 14);
    torso.scale(0.82, 1.1, 1.0); torso.translate(0, 0.16, -0.095);
    const legGeos: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const leg = new THREE.CylinderGeometry(0.027, 0.03, 0.14, 8);
      leg.translate(s * 0.055, 0.07, -0.125);
      legGeos.push(leg);
    }
    const body = new THREE.Mesh(track(mergeGeometries([haunch, torso, ...legGeos])), furMat);
    body.castShadow = true;
    g.add(body);
    cat.body = body;
    const chest = new THREE.SphereGeometry(0.06, 12, 10);
    chest.scale(1, 1.5, 0.6); chest.translate(0, 0.14, -0.145);
    g.add(new THREE.Mesh(chest, creamMat));
    const headG = new THREE.Group();
    headG.position.set(0, 0.335, -0.13);
    const skull = new THREE.SphereGeometry(0.092, 18, 14);
    skull.scale(0.98, 0.92, 0.92);
    const skullMesh = new THREE.Mesh(skull, furMat);
    skullMesh.castShadow = true;
    headG.add(skullMesh);
    const muzzle = new THREE.SphereGeometry(0.05, 12, 10);
    muzzle.scale(1.2, 0.72, 0.85); muzzle.translate(0, -0.026, -0.06);
    headG.add(new THREE.Mesh(muzzle, creamMat));
    cat.ears = [];
    for (const s of [-1, 1]) {
      const ear = new THREE.ConeGeometry(0.038, 0.07, 8);
      ear.translate(0, 0.035, 0);
      const earMesh = new THREE.Mesh(ear, furMat);
      earMesh.position.set(s * 0.055, 0.078, 0.005);
      earMesh.rotation.z = -s * 0.18;
      headG.add(earMesh);
      cat.ears.push(earMesh);
    }
    g.add(headG);
    cat.head = headG;
    const tailCurve = new THREE.CatmullRomCurve3([
      V3(0, 0.1, 0.1), V3(0.02, 0, 0.17), V3(0.03, -0.12, 0.185), V3(0.02, -0.27, 0.16),
    ]);
    const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 14, 0.024, 7, false), furMat);
    tail.castShadow = true;
    g.add(tail);
    cat.tail = tail;
    scene.add(g);
  }

  // 生活道具
  {
    const cushionMat = plainMat(DUSK.cushion);
    registry.push([cushionMat, "cushion"]); track(cushionMat);
    const cushGeo = track(new THREE.CylinderGeometry(0.27, 0.29, 0.09, 18));
    const cush = new THREE.Mesh(cushGeo, cushionMat);
    cush.position.set(-0.55, 0.05, -2.55);
    cush.rotation.y = 0.3;
    cush.receiveShadow = true;
    scene.add(cush);

    const bottleMat = plainMat(DUSK.bottle, { transparent: true, opacity: 0.82 });
    registry.push([bottleMat, "bottle"]); track(bottleMat);
    const bodyG = new THREE.CylinderGeometry(0.045, 0.05, 0.15, 12); bodyG.translate(0, 0.075, 0);
    const neckG = new THREE.CylinderGeometry(0.016, 0.032, 0.06, 10); neckG.translate(0, 0.18, 0);
    const capG = new THREE.CylinderGeometry(0.017, 0.017, 0.014, 8); capG.translate(0, 0.215, 0);
    const bottle = new THREE.Mesh(track(mergeGeometries([bodyG, neckG, capG])), bottleMat);
    bottle.position.set(0.5, 0.9, -4.12);
    scene.add(bottle);

    const potMat = plainMat(DUSK.pot);
    registry.push([potMat, "pot"]); track(potMat);
    const cactusMat = plainMat(DUSK.cactus);
    registry.push([cactusMat, "cactus"]); track(cactusMat);
    const potGeo = track(new THREE.CylinderGeometry(0.095, 0.075, 0.15, 12));
    const pot = new THREE.Mesh(potGeo, potMat);
    pot.position.set(3.05, 0.975, -4.12);
    pot.receiveShadow = true;
    scene.add(pot);
    const cbody = new THREE.CapsuleGeometry(0.05, 0.12, 6, 10); cbody.translate(0, 0.24, 0);
    const carm = new THREE.CapsuleGeometry(0.026, 0.06, 5, 8); carm.translate(0.055, 0.26, 0);
    const cactus = new THREE.Mesh(track(mergeGeometries([cbody, carm])), cactusMat);
    cactus.position.set(3.05, 0.9, -4.12);
    scene.add(cactus);

    const chimeMat = plainMat(DUSK.chime);
    registry.push([chimeMat, "chime"]); track(chimeMat);
    const cg: THREE.BufferGeometry[] = [];
    const disc = new THREE.CylinderGeometry(0.035, 0.035, 0.008, 10);
    cg.push(disc);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const tube = new THREE.CylinderGeometry(0.0055, 0.0055, 0.05 + (i % 3) * 0.018, 6);
      tube.translate(Math.cos(a) * 0.024, -0.03 - (i % 3) * 0.009, Math.sin(a) * 0.024);
      cg.push(tube);
    }
    const chime = new THREE.Mesh(track(mergeGeometries(cg)), chimeMat);
    chime.position.set(-1.62, 2.19, -3.1);
    scene.add(chime);
  }

  // 灯光
  const hemi = new THREE.HemisphereLight(DUSK.hemiSky, DUSK.hemiGround, DUSK.hemiInt);
  scene.add(hemi);
  const dirLight = new THREE.DirectionalLight(DUSK.dirCol, DUSK.dirInt);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.left = -11; dirLight.shadow.camera.right = 11;
  dirLight.shadow.camera.top = 11; dirLight.shadow.camera.bottom = -11;
  dirLight.shadow.camera.near = 4; dirLight.shadow.camera.far = 80;
  dirLight.shadow.bias = -0.0004;
  dirLight.shadow.normalBias = 0.02;
  dirLight.shadow.camera.updateProjectionMatrix();
  scene.add(dirLight);
  scene.add(dirLight.target);
  const ptLight = new THREE.PointLight(0xffb87a, 0, 9, 2);
  ptLight.position.set(0.2, 1.5, 0.8);
  scene.add(ptLight);

  // 光尘
  const dust = { n: 190, mat: null as unknown as THREE.PointsMaterial, points: null as unknown as THREE.Points, seed: new Float32Array(0) };
  {
    const cv = document.createElement("canvas");
    cv.width = 32; cv.height = 32;
    const x = cv.getContext("2d")!;
    const grad = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.4, "rgba(255,255,255,0.5)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = grad;
    x.fillRect(0, 0, 32, 32);
    const tex = track(new THREE.CanvasTexture(cv));
    const geo = track(new THREE.BufferGeometry());
    const pos = new Float32Array(dust.n * 3);
    const seed = new Float32Array(dust.n);
    const rand = mulberry(777);
    const excl = [[-5.6, -3.0, -3.8, -1.0], [3.9, 6.4, -4.0, -1.2]];
    for (let i = 0; i < dust.n; i++) {
      let px = 0, py = 0, pz = 0, ok = false;
      while (!ok) {
        px = -9 + rand() * 18;
        py = 1.2 + rand() * 5.3;
        pz = -14 + rand() * 12;
        ok = true;
        for (const e of excl) if (px > e[0] && px < e[1] && pz > e[2] && pz < e[3]) ok = false;
      }
      pos[i * 3] = px; pos[i * 3 + 1] = py; pos[i * 3 + 2] = pz;
      seed[i] = rand();
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      map: tex, size: 0.07, sizeAttenuation: true,
      transparent: true, depthWrite: false, opacity: 0.45,
      color: DUSK.dustCol, fog: false,
    });
    mat.userData.outlineParameters = { visible: false };
    dust.mat = mat;
    dust.points = new THREE.Points(geo, mat);
    dust.points.frustumCulled = false;
    dust.points.userData.outlineParameters = { visible: false };
    dust.seed = seed;
    scene.add(dust.points);
  }

  // 低频事件:飞鸟 / 夜航红灯
  const birds = { active: false, nextAt: 20 + Math.random() * 30, t0: 0, n: 6, mesh: null as unknown as THREE.Mesh, mat: null as unknown as THREE.MeshBasicMaterial };
  {
    const geo = track(new THREE.BufferGeometry());
    const pos = new Float32Array(birds.n * 4 * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const idx: number[] = [];
    for (let i = 0; i < birds.n; i++) {
      const b = i * 4;
      idx.push(b, b + 1, b + 2, b, b + 1, b + 3);
    }
    geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({ color: 0xf0985c, side: THREE.DoubleSide, fog: false });
    mat.userData.outlineParameters = { visible: false };
    birds.mat = mat;
    birds.mesh = new THREE.Mesh(geo, mat);
    birds.mesh.frustumCulled = false;
    birds.mesh.visible = false;
    birds.mesh.userData.outlineParameters = { visible: false };
    scene.add(birds.mesh);
  }
  const planeLight = { nextAt: 30 + Math.random() * 40, active: false, t0: 0, points: null as unknown as THREE.Points, mat: null as unknown as THREE.PointsMaterial };
  {
    const cv = document.createElement("canvas");
    cv.width = 32; cv.height = 32;
    const x = cv.getContext("2d")!;
    const grad = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(255,90,70,1)");
    grad.addColorStop(0.3, "rgba(255,60,45,0.55)");
    grad.addColorStop(1, "rgba(255,60,45,0)");
    x.fillStyle = grad; x.fillRect(0, 0, 32, 32);
    const geo = track(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3));
    const mat = new THREE.PointsMaterial({
      map: track(new THREE.CanvasTexture(cv)), size: 1.5, sizeAttenuation: true,
      transparent: true, depthWrite: false, color: 0xff5844, fog: false,
    });
    mat.userData.outlineParameters = { visible: false };
    planeLight.mat = mat;
    planeLight.points = new THREE.Points(geo, mat);
    planeLight.points.visible = false;
    planeLight.points.frustumCulled = false;
    scene.add(planeLight.points);
  }

  // 后期链
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.5, 0.4, 0.85);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  const fxaaPass = new ShaderPass(FXAAShader);
  composer.addPass(fxaaPass);
  const grainPass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uGrain: { value: 0.05 },
      uVig: { value: 0.16 },
      uTime: { value: 0 },
      uDesat: { value: 0 }, // 天气压灰
      uDim: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uGrain, uVig, uTime, uDesat, uDim;
      varying vec2 vUv;
      float hash21(vec2 p) {
        p = fract(p * vec2(1613.0, 1271.0));
        p += dot(p, p + 41.3);
        return fract(p.x * p.y);
      }
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));
        c.rgb = mix(c.rgb, vec3(luma), uDesat);          // 雨天压灰一层
        c.rgb *= uDim;
        float g = hash21(vUv + fract(uTime) * 91.7) - 0.5;
        c.rgb += g * uGrain * (1.0 - luma * 0.75);
        float d = distance(vUv, vec2(0.5));
        c.rgb *= 1.0 - uVig * smoothstep(0.42, 0.96, d);
        gl_FragColor = c;
      }`,
  });
  composer.addPass(grainPass);
  disposables.push(bloomPass, composer);

  // OutlineEffect + 官方 composer 组合姿势(scene.onAfterRender)
  const outlineEffect = new OutlineEffect(renderer, {
    // 深墨描边:composer 线性缓冲里给线性值,经 OutputPass 转 sRGB 后才是预期的暗色
    defaultThickness: 0.004, defaultColor: [0.0175, 0.0105, 0.0272], defaultKeepAlive: true,
  });
  let outlining = false;
  scene.onAfterRender = () => {
    if (outlining) return;
    outlining = true;
    outlineEffect.renderOutline(scene, camera);
    outlining = false;
  };

  // ---------- 状态机 ----------
  let stateIdx: TiantaiSlot = options.slot ?? "sunset";
  const cur = clonePalette(PALETTES[stateIdx]);
  let transFrom: ReturnType<typeof clonePalette> | null = null;
  let transT = 1;
  const _lightDir = V3(0, 1, 0);
  const _tmpV = V3(0, 0, 0);

  function clonePalette(p: typeof DUSK) {
    const o = {} as Record<string, unknown>;
    for (const k of COLOR_KEYS) o[k] = (p as unknown as Record<string, THREE.Color>)[k].clone();
    for (const k of NUM_KEYS) o[k] = (p as unknown as Record<string, number>)[k];
    return o as typeof DUSK;
  }
  function copyPalette(dst: typeof DUSK, src: typeof DUSK) {
    for (const k of COLOR_KEYS) (dst as unknown as Record<string, THREE.Color>)[k].copy((src as unknown as Record<string, THREE.Color>)[k]);
    for (const k of NUM_KEYS) (dst as unknown as Record<string, number>)[k] = (src as unknown as Record<string, number>)[k];
  }
  function lerpPalette(dst: typeof DUSK, a: typeof DUSK, b: typeof DUSK, t: number) {
    for (const k of COLOR_KEYS) (dst as unknown as Record<string, THREE.Color>)[k].lerpColors((a as unknown as Record<string, THREE.Color>)[k], (b as unknown as Record<string, THREE.Color>)[k], t);
    for (const k of NUM_KEYS) (dst as unknown as Record<string, number>)[k] = lerp((a as unknown as Record<string, number>)[k], (b as unknown as Record<string, number>)[k], t);
  }

  let weatherFXCur = { desat: 0, dim: 1, winDim: 0 };

  function applyPalette(p: typeof DUSK) {
    skyUniforms.uTop.value.copy(p.top);
    skyUniforms.uMid.value.copy(p.mid);
    skyUniforms.uLow.value.copy(p.low);
    skyUniforms.uHorizon.value.copy(p.horizon);
    skyUniforms.uSunCol.value.copy(p.sunCol);
    skyUniforms.uSunDisc.value = p.sunDisc;
    skyUniforms.uSunHalo.value = p.sunHalo;
    skyUniforms.uBandCol.value.copy(p.bandCol);
    skyUniforms.uBandA.value = p.bandA;
    skyUniforms.uBandW.value = p.bandW;
    skyUniforms.uCityGlowCol.value.copy(p.cityGlowCol);
    skyUniforms.uCityGlowA.value = p.cityGlowA;
    skyUniforms.uStarA.value = p.starA;
    skyUniforms.uMoonA.value = p.moonA;
    const fog = scene.fog;
    if (fog) fog.color.copy(p.horizon);
    hemi.color.copy(p.hemiSky);
    hemi.groundColor.copy(p.hemiGround);
    hemi.intensity = p.hemiInt;
    dirLight.color.copy(p.dirCol);
    dirLight.intensity = p.dirInt;
    ptLight.intensity = p.ptInt;
    const se = (p.sunElev * Math.PI) / 180;
    const sd = SHARED.uSunDirW.value.set(Math.sin(SUN_AZ) * Math.cos(se), Math.sin(se), -Math.cos(SUN_AZ) * Math.cos(se));
    skyUniforms.uSunDir.value.copy(sd);
    const nightBlend = THREE.MathUtils.smoothstep(-p.sunElev, 2, 6);
    _lightDir.copy(sd).lerp(skyUniforms.uMoonDir.value, nightBlend).normalize();
    dirLight.position.copy(_lightDir).multiplyScalar(30);
    for (const [obj, key] of registry) obj.color.copy(p[key as keyof typeof DUSK] as THREE.Color);
    SHARED.uWinRate.value = p.winRate;
    SHARED.uWinWarmRatio.value = p.winWarmRatio;
    SHARED.uWinWarm.value.copy(p.winWarm);
    SHARED.uWinCold.value.copy(p.winCold);
    for (const c of clouds) {
      const u = (c.material as THREE.ShaderMaterial).uniforms;
      u.uLit.value.copy(p.cloudLit);
      u.uShade.value.copy(p.cloudShade);
      u.uAlpha.value = p.cloudAlpha;
    }
    dust.mat.color.copy(p.dustCol);
    dust.mat.opacity = p.dustAlpha;
    bloomPass.strength = p.bloom;
    grainPass.uniforms.uGrain.value = p.grain;
    SHARED.uRimCol.value.copy(p.rimCol);
    SHARED.uRimA.value = p.rimA;
    // 天气层
    grainPass.uniforms.uDesat.value = weatherFXCur.desat;
    grainPass.uniforms.uDim.value = weatherFXCur.dim;
    SHARED.uWinDim.value = weatherFXCur.winDim;
  }

  // ---------- 尺寸(取自父容器,fixed 钉扎,对齐 fx/engine 的教训) ----------
  let cssW = 1, cssH = 1;
  function applySize(): boolean {
    const p = canvas.parentElement;
    let w = (p && p.clientWidth) || 0;
    let h = (p && p.clientHeight) || 0;
    if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return false;
    cssW = w; cssH = h;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(ratio);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const pr = renderer.getPixelRatio();
    (fxaaPass.material as THREE.ShaderMaterial).uniforms.resolution?.value.set(1 / (w * pr), 1 / (h * pr));
    updateHomeForAspect(w / h);
    return true;
  }

  // ---------- 画幅自适应取景:太阳始终落在三分线上 ----------
  let userOrbited = false;
  const HOME_DIST = 10.07, HOME_POLAR = 1.446;
  function homeAzimuth(): number {
    const hfovHalf = Math.atan(Math.tan((45 * Math.PI) / 360) * camera.aspect);
    const azOff = Math.atan(0.33 * Math.tan(hfovHalf));
    return SUN_AZ - azOff;
  }
  function applyHome() {
    const az = homeAzimuth();
    controls.target.set(0, 2.35, -2.8);
    camera.position.set(
      controls.target.x + HOME_DIST * Math.sin(HOME_POLAR) * Math.sin(az),
      controls.target.y + HOME_DIST * Math.cos(HOME_POLAR),
      controls.target.z + HOME_DIST * Math.sin(HOME_POLAR) * Math.cos(az),
    );
    camera.lookAt(controls.target);
    controls.update();
  }
  function updateHomeForAspect(aspect: number) {
    if (aspect > 0.9 && _lastAspect > 0.9 && Math.abs(aspect - _lastAspect) < 0.01) return;
    _lastAspect = aspect;
    if (!userOrbited) applyHome();
  }
  let _lastAspect = 0;

  // 机位预设(切换机位按钮)
  const viewPresets = [
    { pol: HOME_POLAR, dist: HOME_DIST, azOff: 0 },
    { pol: 1.44, dist: 6.2, azOff: -0.5 },
    { pol: 1.3, dist: 11.5, azOff: 0.62 },
  ];
  let presetIdx = 0;
  function applyPreset(i: number) {
    const az = homeAzimuth() + viewPresets[i].azOff;
    controls.target.set(0, 2.35, -2.8);
    camera.position.set(
      controls.target.x + viewPresets[i].dist * Math.sin(viewPresets[i].pol) * Math.sin(az),
      controls.target.y + viewPresets[i].dist * Math.cos(viewPresets[i].pol),
      controls.target.z + viewPresets[i].dist * Math.sin(viewPresets[i].pol) * Math.cos(az),
    );
    camera.lookAt(controls.target);
    controls.update();
  }

  // ---------- 交互(横幅内克制版) ----------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const catTargets: THREE.Mesh[] = [];
  cat.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) catTargets.push(o as THREE.Mesh); });
  let catReact = { active: false, t: 0, yaw: 0 };
  let downXY: [number, number] | null = null;
  const onPointerDown = (e: PointerEvent) => {
    downXY = [e.clientX, e.clientY];
    wake();
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!downXY) return;
    const dx = e.clientX - downXY[0], dy = e.clientY - downXY[1];
    downXY = null;
    if (dx * dx + dy * dy > 36) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.intersectObjects(catTargets, false).length > 0) {
      const hp = new THREE.Vector3();
      cat.head.getWorldPosition(hp);
      const v = camera.position.clone().sub(hp);
      v.applyAxisAngle(V3(0, 1, 0), -cat.group.rotation.y);
      const yaw = Math.atan2(-v.x, -v.z);
      catReact = { active: true, t: 0, yaw: Math.max(-2.5, Math.min(2.5, yaw)) };
      if (REDUCED) renderStatic();
    }
  };
  const onPointerMove = (e: PointerEvent) => {
    if (Math.random() > 0.25) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    canvas.style.cursor = raycaster.intersectObjects(catTargets, false).length > 0 ? "pointer" : "grab";
  };
  const onOrbitStart = () => { userOrbited = true; wake(); };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointermove", onPointerMove);
  controls.addEventListener("start", onOrbitStart);

  let idleT = 0;
  let idleSpin = 0.2;
  function wake() { idleT = 0; controls.autoRotate = false; }

  let catNext = 6 + Math.random() * 6;
  let earTwitch = { t: 1, side: 0 };
  let tailFlick = { t: 1 };

  // ---------- 动效更新 ----------
  function updateBirds(dt: number, t: number) {
    if (REDUCED) return;
    const isNight = stateIdx === "night";
    if (!birds.active && !isNight && t > birds.nextAt) {
      birds.active = true;
      birds.t0 = t;
      birds.mesh.visible = true;
    }
    if (birds.active) {
      const el = t - birds.t0;
      const dur = 26;
      if (el > dur) {
        birds.active = false;
        birds.mesh.visible = false;
        birds.nextAt = t + 60 + Math.random() * 30;
        return;
      }
      const pos = birds.mesh.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < birds.n; i++) {
        const bx = -140 + el * 6.2 + i * 4.2;
        const by = 11 + Math.sin(el * 0.6 + i * 1.3) * 0.9 + i * 0.5;
        const bz = -52 - (i % 3) * 3;
        const flap = Math.sin(el * 9 + i * 1.7) * 0.3;
        const b = i * 12;
        pos.array[b] = bx + 0.24; pos.array[b + 1] = by; pos.array[b + 2] = bz;
        pos.array[b + 3] = bx - 0.2; pos.array[b + 4] = by; pos.array[b + 5] = bz;
        pos.array[b + 6] = bx; pos.array[b + 7] = by + flap; pos.array[b + 8] = bz - 0.55;
        pos.array[b + 9] = bx; pos.array[b + 10] = by + flap; pos.array[b + 11] = bz + 0.55;
      }
      pos.needsUpdate = true;
      birds.mat.color.copy(cur.horizon).multiplyScalar(0.82);
    }
  }

  function smoothstepJS(x: number) { return x * x * (3 - 2 * x); }

  function updatePlane(t: number) {
    if (REDUCED || stateIdx !== "night") {
      planeLight.points.visible = false;
      if (stateIdx !== "night") planeLight.nextAt = t + 20;
      return;
    }
    if (!planeLight.active && t > planeLight.nextAt) {
      planeLight.active = true;
      planeLight.t0 = t;
      planeLight.points.visible = true;
    }
    if (planeLight.active) {
      const el = t - planeLight.t0;
      const dur = 85;
      if (el > dur) {
        planeLight.active = false;
        planeLight.points.visible = false;
        planeLight.nextAt = t + 120 + Math.random() * 60;
        return;
      }
      const p = planeLight.points.geometry.attributes.position as THREE.BufferAttribute;
      p.array[0] = -170 + el * 3.4;
      p.array[1] = 18 + Math.sin(el * 0.2) * 1.5;
      p.array[2] = -82;
      p.needsUpdate = true;
      const blink = 0.5 + 0.5 * Math.sin(el * 5.2);
      planeLight.mat.opacity = 0.25 + 0.75 * smoothstepJS(blink);
    }
  }

  function updateClouds(dt: number) {
    if (REDUCED) return;
    for (const c of clouds) {
      c.userData.baseX = (c.userData.baseX as number) + dt * 0.22;
      if ((c.userData.baseX as number) > 110) c.userData.baseX = -110;
      c.position.x = c.userData.baseX as number;
      c.rotation.y = Math.atan2(camera.position.x - c.position.x, camera.position.z - c.position.z);
    }
  }

  function updateDust(dt: number, t: number) {
    if (REDUCED) return;
    const pos = dust.points.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < dust.n; i++) {
      const s = dust.seed[i];
      let y = pos.array[i * 3 + 1] + dt * (0.05 + s * 0.1);
      if (y > 6.5) y = 1.2;
      pos.array[i * 3 + 1] = y;
      pos.array[i * 3] += Math.sin(t * 0.3 + s * 40) * dt * 0.05;
    }
    pos.needsUpdate = true;
  }

  function updateCat(dt: number, t: number) {
    const br = 1 + Math.sin(t * 1.7) * 0.018;
    cat.body.scale.y = br;
    cat.head.position.y = 0.335 + Math.sin(t * 1.7 + 0.6) * 0.004;
    if (!REDUCED && t > catNext) {
      catNext = t + 8 + Math.random() * 7;
      if (Math.random() < 0.5) { earTwitch.t = 0; earTwitch.side = Math.random() < 0.5 ? 0 : 1; }
      else tailFlick.t = 0;
    }
    if (earTwitch.t < 1) {
      earTwitch.t = Math.min(1, earTwitch.t + dt * 4);
      const k = Math.sin(earTwitch.t * Math.PI) * 0.35;
      const ear = cat.ears[earTwitch.side];
      ear.rotation.x = -k;
      ear.rotation.z = (earTwitch.side === 0 ? 0.18 : -0.18) - k * 0.4;
    }
    if (tailFlick.t < 1) {
      tailFlick.t = Math.min(1, tailFlick.t + dt * 2.2);
      cat.tail.rotation.x = -Math.sin(tailFlick.t * Math.PI) * 0.22;
      cat.tail.rotation.z = Math.sin(tailFlick.t * Math.PI * 2) * 0.08;
    }
    if (catReact.active) {
      catReact.t += dt;
      const T = catReact.t;
      let k: number;
      if (T < 0.4) k = smootherstep(T / 0.4);
      else if (T < 0.75) k = 1;
      else if (T < 1.2) k = 1 - smootherstep((T - 0.75) / 0.45);
      else { k = 0; catReact.active = false; }
      cat.head.rotation.y = catReact.yaw * k;
      cat.head.rotation.x = -0.12 * k;
      cat.head.rotation.z = 0.16 * k;
      if (catReact.active && T < 0.4) cat.ears[0].rotation.z = 0.18 + k * 0.2;
    }
  }

  // ---------- 视差(取景偏移,不碰轨道状态) ----------
  let parallaxPx = 0;
  function applyParallax() {
    const capped = Math.max(-88, Math.min(88, parallaxPx)) * 0.35; // 比照片版更克制
    if (capped === 0) camera.clearViewOffset();
    else camera.setViewOffset(cssW, cssH, 0, -capped, cssW, cssH);
  }

  // ---------- 主循环 ----------
  const clock = new THREE.Clock();
  let rafId = 0;
  let running = false;
  let paused = false;

  function tick(dt: number) {
    if (!REDUCED) SHARED.uTime.value += dt;
    const t = SHARED.uTime.value;

    if (transFrom && transT < 1) {
      transT = Math.min(1, transT + dt / 8);
      lerpPalette(cur, transFrom, PALETTES[stateIdx], smootherstep(transT));
      applyPalette(cur);
    }

    if (!REDUCED) {
      idleT += dt;
      if (idleT > 10 && !controls.autoRotate) controls.autoRotate = true;
      if (controls.autoRotate) {
        const az = controls.getAzimuthalAngle();
        if (az > 0.92) idleSpin = -0.2;
        else if (az < -0.92) idleSpin = 0.2;
        controls.autoRotateSpeed = idleSpin;
      }
    }

    controls.update();
    applyParallax();
    updateClouds(dt);
    updateDust(dt, t);
    updateCat(dt, t);
    updateBirds(dt, t);
    updatePlane(t);
    grainPass.uniforms.uTime.value = t;

    renderer.info.reset();
    composer.render();
  }

  function loop() {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    tick(Math.min(clock.getDelta(), 0.1));
  }
  function startLoop() {
    if (running || REDUCED || paused) return;
    running = true;
    clock.getDelta();
    rafId = requestAnimationFrame(loop);
  }
  function stopLoop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  // reduced-motion:只渲染当前档静态帧(状态/视差/尺寸变化时补渲)
  function renderStatic() {
    if (!REDUCED) return;
    controls.update();
    applyParallax();
    renderer.info.reset();
    composer.render();
  }

  // ---------- 公开接口 ----------
  applyPalette(cur);
  applySize();
  applyHome();
  startLoop(); // 初始渲染即启动循环(setState/setPaused 只负责后续启停)

  // 仅开发构建:渲染循环探针(验证切走页面 rAF 完全停止 / 内存关卡),生产构建编译期剔除
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__tiantaiSceneDebug = {
      calls: () => renderer.info.render.calls,
      running: () => running,
      paused: () => paused,
    };
  }

  return {
    setState(slot: TiantaiSlot) {
      if (slot === stateIdx) return;
      if (REDUCED) {
        stateIdx = slot;
        copyPalette(cur, PALETTES[slot]);
        transFrom = null; transT = 1;
        applyPalette(cur);
        renderStatic();
        return;
      }
      transFrom = clonePalette(cur);
      stateIdx = slot;
      transT = 0;
      startLoop();
    },
    setWeather(condition) {
      weatherFXCur = weatherFX(condition);
      applyPalette(cur);
      renderStatic();
    },
    setParallax(scrollTopPx: number) {
      parallaxPx = scrollTopPx;
      applyParallax();
      renderStatic();
    },
    cycleViewPreset() {
      presetIdx = (presetIdx + 1) % viewPresets.length;
      userOrbited = false;
      applyPreset(presetIdx);
      renderStatic();
    },
    setPaused(p: boolean) {
      paused = p;
      if (p) stopLoop();
      else startLoop();
    },
    resize() {
      if (applySize()) {
        if (presetIdx !== 0) applyPreset(presetIdx);
        renderStatic();
      }
    },
    dispose() {
      stopLoop();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointermove", onPointerMove);
      controls.removeEventListener("start", onOrbitStart);
      scene.onAfterRender = () => {}; // 卸载后OutlineEffect不再参与渲染
      controls.dispose();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
      for (const d of disposables) {
        try { d.dispose(); } catch { /* 逐项清理,单个失败不阻断 */ }
      }
      composer.dispose();
      renderer.dispose();
      // 不调 forceContextLoss:StrictMode 双挂载时 React 会复用同一 canvas,
      // 保留活上下文让下一次 createTiantaiScene 直接复用;页面真正卸载时上下文随 canvas 回收
    },
  };
}
