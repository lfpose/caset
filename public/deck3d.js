// The 3D deck: scene, materials, cassette model, key mechanics and the animations
// for load / eject / flip. It knows nothing about tracks or audio; app.js drives it.
import * as THREE from "./vendor/three.module.min.js";
import { RoundedBoxGeometry } from "./vendor/RoundedBoxGeometry.js";
import { RoomEnvironment } from "./vendor/RoomEnvironment.js";

export const KEY_ORDER = ["rewind", "play", "forward", "stop", "flip", "eject"];
const STRIPES = ["#e2582b", "#e3b03a", "#8a8b3b", "#3d8d8c", "#33506b"];
const FONT = `Futura, "Futura PT", "Century Gothic", "Avenir Next", "Trebuchet MS", system-ui, sans-serif`;
const INK = "#221a15";
const PAPER = "#efe4cc";

// ---- dimensions, in centimetres ----
const DW = 27.4, DD = 20.4;
const ZF = DD / 2, ZB = -DD / 2, XR = DW / 2;
const PLATE_T = 0.22;
const SHELL_B = -2.0;                // bottom of the upper shell, top of the base
const BASE_B = -5.0;
const WELL = { x: -5.9, z: -2.5, w: 11.0, d: 7.4 };
const WELL_FLOOR = -1.95;
const NOTCH = { x: 12.25, z: 5.1 };  // key bed: |x| < NOTCH.x, z > NOTCH.z
const KEY = { w: 3.78, d: 4.0, h: 2.3, pitch: 4.04, r: 0.16, z: 7.45 };
const KEY_UP = 0.42, KEY_LATCH = -0.22, KEY_TAP = -0.3; // top of key
const CAS = { w: 10.0, d: 6.4, t: 1.2, hubX: 2.125, hubZ: -0.4, rMin: 1.08, rMax: 2.28 };
const CAS_Y = WELL_FLOOR + 0.12 + CAS.t / 2;
const LIFT = 3.6;
const LID = { w: 12.1, d: 8.5, bar: 0.6, h: 0.34, open: -1.12 };
const COUNTER = { x: 4.9, z: -6.3 };

const ease = {
  inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  out: (k) => 1 - Math.pow(1 - k, 3),
  in: (k) => k * k * k,
  lin: (k) => k,
};

export function createDeck({ canvas, slot, reduceMotion, onEvent = () => {} }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  // at most 2x, and at most ~3.5 megapixels per frame however big the window is
  const pixelRatio = () => Math.min(devicePixelRatio || 1, Math.max(1, Math.min(2, Math.sqrt(3.5e6 / (innerWidth * innerHeight)))));
  renderer.setPixelRatio(pixelRatio());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // shadows are redrawn only when something that casts one moves (see frame())
  renderer.shadowMap.autoUpdate = false;
  let lost = false;
  canvas.addEventListener("webglcontextlost", () => {
    lost = true;
    // finish every animation at once so nothing waits on frames that will never be drawn
    reduceMotion = true;
    for (const tw of tweens.splice(0)) { tw.fn(1); tw.resolve(); }
    onEvent("contextlost");
  });

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.035).texture;
  scene.environmentIntensity = 0.62;
  room.dispose?.();
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 1, 3000);
  const fitCam = new THREE.PerspectiveCamera(30, 1, 1, 3000);

  // ---------- helpers ----------
  function canvasTex(cv, { srgb = true, repeat = null } = {}) {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = maxAniso;
    if (repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
    }
    return t;
  }
  function makeCanvas(w, h) {
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    return [cv, cv.getContext("2d")];
  }
  function mesh(geo, material, parent, { cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = cast;
    m.receiveShadow = receive;
    parent.add(m);
    return m;
  }
  // shape helpers work in the XZ plane: shape y = -z, extruded upward after rotateX(-PI/2)
  function roundRectPath(p, x0, z0, x1, z1, r) {
    const a = -z1, b = -z0; // shape y range
    p.moveTo(x0 + r, a);
    p.lineTo(x1 - r, a); p.quadraticCurveTo(x1, a, x1, a + r);
    p.lineTo(x1, b - r); p.quadraticCurveTo(x1, b, x1 - r, b);
    p.lineTo(x0 + r, b); p.quadraticCurveTo(x0, b, x0, b - r);
    p.lineTo(x0, a + r); p.quadraticCurveTo(x0, a, x0 + r, a);
    return p;
  }
  function extrudeXZ(shape, depth, y0, bevel = 0) {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: depth - bevel * 2, curveSegments: 10,
      bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, y0 + bevel, 0);
    return g;
  }

  // ---------- textures ----------
  function brushed(light) {
    const [cv, g] = makeCanvas(1024, 1024);
    g.fillStyle = light ? "#e4e1dc" : "#8c8c8c";
    g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 4200; i++) {
      const y = Math.random() * 1024;
      const v = light ? 200 + Math.random() * 55 : 90 + Math.random() * 90;
      g.strokeStyle = `rgba(${v},${v},${v},${0.18 + Math.random() * 0.3})`;
      g.lineWidth = Math.random() < 0.8 ? 1 : 2;
      const x = Math.random() * 1024, len = 150 + Math.random() * 900;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke();
      if (x + len > 1024) { g.beginPath(); g.moveTo(x - 1024, y); g.lineTo(x + len - 1024, y); g.stroke(); }
    }
    return canvasTex(cv, { srgb: light, repeat: [1 / 14, 1 / 14] });
  }

  function stripeBand() {
    const [cv, g] = makeCanvas(2048, 256);
    const bar = 36, gap = 12, total = 5 * bar + 4 * gap;
    const y0 = (256 - total) / 2;
    STRIPES.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, y0 + i * (bar + gap), 2048, bar); });
    return canvasTex(cv);
  }

  function wordmark() {
    const [cv, g] = makeCanvas(1024, 320);
    g.fillStyle = INK;
    g.font = `700 150px ${FONT}`;
    g.textBaseline = "alphabetic";
    g.fillText("caset", 20, 190);
    const w = g.measureText("caset").width;
    const bar = 14, gap = 7;
    STRIPES.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(24 + w + 34, 88 + i * (bar + gap), 300, bar);
    });
    g.font = `500 44px ${FONT}`;
    g.fillStyle = "rgba(34,26,21,0.72)";
    g.fillText("stereo cassette deck", 24, 272);
    return canvasTex(cv);
  }

  function digitsTex() {
    // ten cells around the drum; each digit is drawn turned so that it reads upright on top
    const [cv, g] = makeCanvas(1280, 256);
    g.fillStyle = "#1a1411";
    g.fillRect(0, 0, 1280, 256);
    g.fillStyle = "#f1e6cf";
    g.font = `600 112px ${FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let d = 0; d < 10; d++) {
      g.save();
      g.translate(d * 128 + 64, 128);
      g.rotate(-Math.PI / 2);
      g.scale(1, 1.18);
      g.fillText(String(d), 0, 4);
      g.restore();
    }
    return canvasTex(cv);
  }

  function ringsTex() {
    const [cv, g] = makeCanvas(512, 512);
    g.fillStyle = "#3a2619";
    g.fillRect(0, 0, 512, 512);
    for (let r = 4; r < 256; r += 1.5) {
      const v = 50 + Math.random() * 50;
      g.strokeStyle = `rgba(${v + 30},${v + 8},${v - 10},${0.2 + Math.random() * 0.3})`;
      g.lineWidth = 1;
      g.beginPath(); g.arc(256, 256, r, 0, Math.PI * 2); g.stroke();
    }
    return canvasTex(cv);
  }

  // key tops: icon + lowercase label
  function drawIcon(g, action, cx, cy, s) {
    g.beginPath();
    const tri = (x, y, w, h, dir) => {
      g.moveTo(x - (w / 2) * dir, y - h / 2);
      g.lineTo(x + (w / 2) * dir, y);
      g.lineTo(x - (w / 2) * dir, y + h / 2);
      g.closePath();
    };
    if (action === "play") tri(cx + s * 0.04, cy, s * 0.62, s * 0.7, 1);
    else if (action === "rewind") { tri(cx - s * 0.2, cy, s * 0.42, s * 0.56, -1); tri(cx + s * 0.2, cy, s * 0.42, s * 0.56, -1); }
    else if (action === "forward") { tri(cx - s * 0.2, cy, s * 0.42, s * 0.56, 1); tri(cx + s * 0.2, cy, s * 0.42, s * 0.56, 1); }
    else if (action === "stop") g.rect(cx - s * 0.27, cy - s * 0.27, s * 0.54, s * 0.54);
    else if (action === "eject") {
      g.moveTo(cx - s * 0.34, cy + s * 0.06); g.lineTo(cx, cy - s * 0.34); g.lineTo(cx + s * 0.34, cy + s * 0.06); g.closePath();
      g.rect(cx - s * 0.34, cy + s * 0.18, s * 0.68, s * 0.14);
    }
    if (action !== "flip") { g.fill(); return; }
    // flip: two arcs chasing each other
    g.lineWidth = s * 0.09;
    g.lineCap = "butt";
    const r = s * 0.3;
    for (const a0 of [Math.PI * 0.15, Math.PI * 1.15]) {
      g.beginPath();
      g.arc(cx, cy, r, a0, a0 + Math.PI * 0.72);
      g.stroke();
      const a1 = a0 + Math.PI * 0.72;
      const hx = cx + Math.cos(a1) * r, hy = cy + Math.sin(a1) * r;
      const tx = -Math.sin(a1), ty = Math.cos(a1);
      const nx = Math.cos(a1), ny = Math.sin(a1);
      const L = s * 0.17;
      g.beginPath();
      g.moveTo(hx + tx * L, hy + ty * L);
      g.lineTo(hx + nx * L * 0.8, hy + ny * L * 0.8);
      g.lineTo(hx - nx * L * 0.8, hy - ny * L * 0.8);
      g.closePath();
      g.fill();
    }
  }
  function drawKeyTop(g, action, label, bg, ink) {
    const S = 512;
    const grd = g.createLinearGradient(0, 0, 0, S);
    grd.addColorStop(0, bg[0]); grd.addColorStop(1, bg[1]);
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    g.fillStyle = ink; g.strokeStyle = ink;
    drawIcon(g, action, S / 2, S * 0.38, S * 0.36);
    let fs = 76;
    g.font = `500 ${fs}px ${FONT}`;
    while (fs > 44 && g.measureText(label).width > S * 0.9) { fs -= 4; g.font = `500 ${fs}px ${FONT}`; }
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillText(label, S / 2, S * 0.83);
  }

  // cassette labels: cover art around the window, name and side on a paper strip
  const LBL = { w: 9.0, h: 4.9, z0: -3.05 };
  // labels are laid out on a 2048-wide grid and drawn at half that: the label is never
  // more than ~600 device pixels wide on screen
  const LW = 2048, LH = Math.round((2048 * LBL.h) / LBL.w), LSCALE = 0.5;
  const PXCM = LW / LBL.w;
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function coverFit(g, img, x, y, w, h) {
    const iw = img.naturalWidth || 1000, ih = img.naturalHeight || 1000;
    const s = Math.max(w / iw, h / ih);
    const dw = iw * s, dh = ih * s;
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    g.restore();
  }
  // whichever of the two inks has the higher WCAG contrast on the tape colour
  function lum(hex) {
    const c = new THREE.Color(hex); // linear components
    return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  }
  function inkFor(hex) {
    const l = lum(hex);
    const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    return ratio(l, lum(INK)) >= ratio(l, lum(PAPER)) ? INK : PAPER;
  }
  function fitText(g, text, max, size, weight) {
    let s = size;
    g.font = `${weight} ${s}px ${FONT}`;
    while (s > 40 && g.measureText(text).width > max) { s -= 4; g.font = `${weight} ${s}px ${FONT}`; }
    if (g.measureText(text).width <= max) return text;
    let t = text;
    while (t.length > 1 && g.measureText(t + "…").width > max) t = t.slice(0, -1);
    return t.trimEnd() + "…";
  }
  function drawLabel(g, cas, side, img) {
    const sd = cas.sides[side];
    g.clearRect(0, 0, LW, LH);
    roundRect(g, 0, 0, LW, LH, 28);
    g.fillStyle = PAPER; g.fill();
    const stripY = Math.round(1.25 * PXCM);
    // art frame
    const ax = 22, ay = stripY, aw = LW - 44, ah = LH - stripY - 22;
    g.save(); roundRect(g, ax, ay, aw, ah, 18); g.clip();
    g.fillStyle = cas.color; g.fillRect(ax, ay, aw, ah);
    if (img) coverFit(g, img, ax, ay, aw, ah);
    else {
      const bar = 26, gap = 10, y0 = LH - 22 - 5 * (bar + gap) - 34;
      STRIPES.forEach((c, i) => { g.fillStyle = c; g.fillRect(ax, y0 + i * (bar + gap), aw, bar); });
    }
    g.restore();
    // side letter disc
    const cx = 150, cy = stripY / 2 + 4;
    g.beginPath(); g.arc(cx, cy, 96, 0, Math.PI * 2);
    g.fillStyle = cas.color; g.fill();
    g.fillStyle = inkFor(cas.color);
    g.font = `700 128px ${FONT}`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(side, cx, cy + 8);
    // name + side label
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.fillStyle = INK;
    const name = fitText(g, cas.name, LW - 300 - 470, 118, 700);
    g.fillText(name, 290, stripY * 0.52);
    g.fillStyle = "#6d5f50";
    const sub = fitText(g, sd.label, LW - 300 - 470, 70, 500);
    g.fillText(sub, 292, stripY * 0.52 + 92);
    // maker's corner
    g.textAlign = "right";
    g.fillStyle = INK;
    g.font = `700 60px ${FONT}`;
    g.fillText("caset", LW - 70, 112);
    g.font = `500 42px ${FONT}`;
    g.fillStyle = "#6d5f50";
    const mins = Math.max(1, Math.round(sd.tracks.reduce((s, t) => s + (t.dur || 0), 0) / 60));
    g.fillText(`${sd.tracks.length} tracks · ${mins} min`, LW - 70, 176);
    const bw = 34, bx = LW - 70 - 5 * bw - 4 * 8;
    STRIPES.forEach((c, i) => { g.fillStyle = c; g.fillRect(bx + i * (bw + 8), 206, bw, 12); });
    // window
    const wz = CAS.hubZ - LBL.z0;
    const ww = 6.9 * PXCM, wh = 2.3 * PXCM;
    const wx = (LW - ww) / 2, wy = wz * PXCM - wh / 2;
    roundRect(g, wx - 16, wy - 16, ww + 32, wh + 32, wh / 2 + 16);
    g.fillStyle = "rgba(24,17,13,0.9)"; g.fill();
    g.globalCompositeOperation = "destination-out";
    roundRect(g, wx, wy, ww, wh, wh / 2);
    g.fill();
    g.globalCompositeOperation = "source-over";
  }
  const coverCache = new Map();
  function coverImage(src) {
    if (coverCache.has(src)) return coverCache.get(src);
    const p = new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
    coverCache.set(src, p);
    return p;
  }
  const labelCache = new Map();
  function labelTexture(cas, side) {
    const k = `${cas.id}:${side}`;
    if (labelCache.has(k)) return labelCache.get(k);
    const [cv, g] = makeCanvas(Math.round(LW * LSCALE), Math.round(LH * LSCALE));
    g.scale(LSCALE, LSCALE);
    drawLabel(g, cas, side, null);
    const tex = canvasTex(cv);
    labelCache.set(k, tex);
    coverImage(cas.cover).then((img) => {
      if (!img || labelCache.get(k) !== tex) return; // gone: another tape was loaded meanwhile
      try {
        drawLabel(g, cas, side, img);
        tex.needsUpdate = true;
        dirty = true;
      } catch { /* a broken image just keeps the colour label */ }
    });
    return tex;
  }

  // ---------- materials ----------
  const M = {
    body: new THREE.MeshStandardMaterial({ color: 0x2a211c, roughness: 0.58, metalness: 0 }),
    bodyDark: new THREE.MeshStandardMaterial({ color: 0x120e0c, roughness: 0.8, metalness: 0 }),
    plate: new THREE.MeshPhysicalMaterial({
      color: 0xc6b69b, metalness: 1, roughness: 0.62,
      map: brushed(true), roughnessMap: brushed(false),
      anisotropy: 0.75, anisotropyRotation: 0,
    }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd8d2c8, metalness: 1, roughness: 0.18 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x151110, roughness: 0.9 }),
    ivory: new THREE.MeshPhysicalMaterial({ color: 0xe7dcc4, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.08 }),
    orange: new THREE.MeshPhysicalMaterial({ color: 0xe2582b, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.08 }),
    hub: new THREE.MeshStandardMaterial({ color: 0xece3d0, roughness: 0.45 }),
    tape: new THREE.MeshStandardMaterial({ color: 0xffffff, map: ringsTex(), roughness: 0.34, metalness: 0.1 }),
    shell: new THREE.MeshPhysicalMaterial({ color: 0x2b2420, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
    shellInner: new THREE.MeshStandardMaterial({ color: 0x0c0a09, roughness: 0.9 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x000000, roughness: 0.04, metalness: 0, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, envMapIntensity: 0.9, specularIntensity: 1,
    }),
    tint: new THREE.MeshBasicMaterial({ color: 0x0c0806, transparent: true, opacity: 0.1, depthWrite: false }),
    window: new THREE.MeshPhysicalMaterial({
      color: 0x000000, roughness: 0.08, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, envMapIntensity: 0.6,
    }),
    print: (map) => new THREE.MeshStandardMaterial({
      map, transparent: true, roughness: 0.55, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
  };

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xffeedd, 0x1a120d, 0.35));
  const sun = new THREE.DirectionalLight(0xffe6c8, 2.6);
  sun.position.set(-12, 30, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 6;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 5, far: 80 });
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x9ec3d0, 0.9);
  rim.position.set(14, 10, -18);
  scene.add(rim);

  // ---------- deck ----------
  const deck = new THREE.Group();
  scene.add(deck);

  // shadow catcher so the deck sits on something in the dark
  const floor = mesh(new THREE.PlaneGeometry(90, 90), new THREE.ShadowMaterial({ opacity: 0.55 }), scene, { cast: false });
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = BASE_B - 0.01;

  // base
  const base = mesh(new RoundedBoxGeometry(DW, SHELL_B - BASE_B, DD, 2, 0.1), M.body, deck);
  base.position.y = (SHELL_B + BASE_B) / 2;

  // upper shell with the cassette well and the key notch
  function outline(inset) {
    const s = new THREE.Shape();
    const x0 = -XR + inset, x1 = XR - inset, zb = ZB + inset, zf = ZF - inset;
    const nx = NOTCH.x + inset, nz = NOTCH.z + inset;
    s.moveTo(x0, -zb); s.lineTo(x1, -zb); s.lineTo(x1, -zf); s.lineTo(nx, -zf);
    s.lineTo(nx, -nz); s.lineTo(-nx, -nz); s.lineTo(-nx, -zf); s.lineTo(x0, -zf); s.closePath();
    const h = new THREE.Path();
    roundRectPath(h, WELL.x - WELL.w / 2 - inset, WELL.z - WELL.d / 2 - inset, WELL.x + WELL.w / 2 + inset, WELL.z + WELL.d / 2 + inset, 0.25);
    s.holes.push(h);
    return s;
  }
  mesh(extrudeXZ(outline(0), -PLATE_T - SHELL_B, SHELL_B), M.body, deck);
  const plateGeo = extrudeXZ(outline(0.22), PLATE_T, -PLATE_T, 0.03);
  mesh(plateGeo, M.plate, deck);

  // the well
  const wellFloor = mesh(new THREE.BoxGeometry(WELL.w + 0.4, 0.1, WELL.d + 0.4), M.bodyDark, deck);
  wellFloor.position.set(WELL.x, WELL_FLOOR - 0.05, WELL.z);
  const wallGeoX = new THREE.BoxGeometry(WELL.w, -PLATE_T - WELL_FLOOR, 0.02);
  const wallGeoZ = new THREE.BoxGeometry(0.02, -PLATE_T - WELL_FLOOR, WELL.d);
  for (const s of [-1, 1]) {
    const a = mesh(wallGeoX, M.bodyDark, deck, { cast: false });
    a.position.set(WELL.x, (WELL_FLOOR - PLATE_T) / 2, WELL.z + s * (WELL.d / 2 - 0.01));
    const b = mesh(wallGeoZ, M.bodyDark, deck, { cast: false });
    b.position.set(WELL.x + s * (WELL.w / 2 - 0.01), (WELL_FLOOR - PLATE_T) / 2, WELL.z);
  }
  // drive spindles, head and pinch roller in the well
  const spindles = [-1, 1].map((s) => {
    const g = new THREE.Group();
    g.position.set(WELL.x + s * CAS.hubX, WELL_FLOOR, WELL.z + CAS.hubZ);
    mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.16, 40), M.chrome, g).position.y = 0.08;
    const core = mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.05, 24), M.hub, g);
    core.position.y = 0.55;
    for (let i = 0; i < 3; i++) {
      const tooth = mesh(new THREE.BoxGeometry(0.16, 0.9, 0.2), M.hub, g);
      const a = (i / 3) * Math.PI * 2;
      tooth.position.set(Math.cos(a) * 0.38, 0.5, Math.sin(a) * 0.38);
      tooth.rotation.y = -a;
    }
    deck.add(g);
    return g;
  });
  const head = mesh(new RoundedBoxGeometry(1.5, 0.9, 0.5, 2, 0.08), M.chrome, deck);
  head.position.set(WELL.x, WELL_FLOOR + 0.45, WELL.z + WELL.d / 2 - 0.3);
  const capstan = mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 12), M.chrome, deck);
  capstan.position.set(WELL.x + 2.9, WELL_FLOOR + 0.55, WELL.z + WELL.d / 2 - 0.3);
  const pinch = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.7, 24), M.rubber, deck);
  pinch.position.set(WELL.x + 3.45, WELL_FLOOR + 0.5, WELL.z + WELL.d / 2 - 0.3);

  // lid: framed glass on a rear hinge
  const lid = new THREE.Group();
  lid.position.set(WELL.x, 0, WELL.z - LID.d / 2);
  deck.add(lid);
  {
    const s = new THREE.Shape();
    roundRectPath(s, -LID.w / 2, 0, LID.w / 2, LID.d, 0.28);
    const h = new THREE.Path();
    roundRectPath(h, -LID.w / 2 + LID.bar, LID.bar, LID.w / 2 - LID.bar, LID.d - LID.bar, 0.12);
    s.holes.push(h);
    mesh(extrudeXZ(s, LID.h, 0, 0.05), M.body, lid);
    const pane = mesh(new THREE.BoxGeometry(LID.w - LID.bar * 2 + 0.2, 0.05, LID.d - LID.bar * 2 + 0.2), M.glass, lid, { cast: false, receive: false });
    pane.position.set(0, LID.h - 0.1, LID.d / 2);
    pane.renderOrder = 3;
    const tint = mesh(new THREE.PlaneGeometry(LID.w - LID.bar * 2 + 0.2, LID.d - LID.bar * 2 + 0.2), M.tint, lid, { cast: false, receive: false });
    tint.rotation.x = -Math.PI / 2;
    tint.position.set(0, LID.h - 0.13, LID.d / 2);
    tint.renderOrder = 2;
    // soft diagonal glints so the pane reads as glass even in flat light
    const [gcv, gg] = makeCanvas(512, 512);
    const band = (x, w, a) => {
      const gr = gg.createLinearGradient(x - w, 0, x + w, 0);
      gr.addColorStop(0, "rgba(255,255,255,0)");
      gr.addColorStop(0.5, `rgba(255,248,236,${a})`);
      gr.addColorStop(1, "rgba(255,255,255,0)");
      gg.fillStyle = gr;
      gg.fillRect(0, 0, 512, 512);
    };
    gg.setTransform(1, 0, -0.55, 1, 140, 0);
    band(150, 60, 0.12); band(250, 18, 0.1); band(430, 40, 0.06);
    const glint = mesh(new THREE.PlaneGeometry(LID.w - LID.bar * 2 + 0.2, LID.d - LID.bar * 2 + 0.2),
      new THREE.MeshBasicMaterial({ map: canvasTex(gcv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
      lid, { cast: false, receive: false });
    glint.rotation.x = -Math.PI / 2;
    glint.position.set(0, LID.h - 0.05, LID.d / 2);
    glint.renderOrder = 4;
    // finger notch on the front edge
    const notch = mesh(new RoundedBoxGeometry(2.4, 0.12, 0.3, 2, 0.05), M.chrome, lid);
    notch.position.set(0, LID.h + 0.02, LID.d - 0.3);
    for (const sx of [-1, 1]) {
      const hinge = mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.6, 16), M.chrome, deck);
      hinge.rotation.z = Math.PI / 2;
      hinge.position.set(WELL.x + sx * (LID.w / 2 - 1.6), 0.18, WELL.z - LID.d / 2 - 0.05);
    }
  }

  // counter: three drums behind a bezel
  const counterGroup = new THREE.Group();
  counterGroup.position.set(COUNTER.x, 0, COUNTER.z);
  counterGroup.scale.setScalar(1.3);
  deck.add(counterGroup);
  const drums = [];
  {
    const bez = new THREE.Shape();
    roundRectPath(bez, -2.15, -1.05, 2.15, 1.05, 0.22);
    const hole = new THREE.Path();
    roundRectPath(hole, -1.62, -0.4, 1.62, 0.4, 0.08);
    bez.holes.push(hole);
    mesh(extrudeXZ(bez, 0.34, 0, 0.04), M.body, counterGroup);
    const well = mesh(new THREE.BoxGeometry(3.3, 0.1, 1.1), M.bodyDark, counterGroup);
    well.position.y = -0.1;
    const dtex = digitsTex();
    const dmat = new THREE.MeshStandardMaterial({ map: dtex, roughness: 0.5 });
    const dg = new THREE.CylinderGeometry(0.62, 0.62, 0.92, 40, 1, false);
    dg.rotateZ(-Math.PI / 2);
    for (let i = 0; i < 3; i++) {
      const d = mesh(dg, dmat, counterGroup, { cast: false });
      d.position.set((i - 1) * 1.02, -0.36, 0);
      drums.push(d);
    }
    const glassC = mesh(new THREE.PlaneGeometry(3.3, 1.1), M.window, counterGroup, { cast: false, receive: false });
    glassC.rotation.x = -Math.PI / 2;
    glassC.position.y = 0.3;
    glassC.renderOrder = 3;
  }

  // printed graphics
  const mark = mesh(new THREE.PlaneGeometry(7.0, 2.19), M.print(wordmark()), deck, { cast: false });
  mark.rotation.x = -Math.PI / 2;
  mark.position.set(COUNTER.x + 4.6, 0.002, -1.9);
  const front = mesh(new THREE.PlaneGeometry(DW - 0.4, 1.9), M.print(stripeBand()), deck, { cast: false });
  front.position.set(0, (SHELL_B + BASE_B) / 2 - 0.1, ZF + 0.002);

  // tiny playing lamp
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x3a1a10, emissive: 0xff5a1f, emissiveIntensity: 0, roughness: 0.3 });
  const lamp = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 20), lampMat, deck, { cast: false });
  lamp.position.set(COUNTER.x + 3.5, 0.06, COUNTER.z);

  // keys
  const keys = KEY_ORDER.map((action, i) => {
    const group = new THREE.Group();
    const x = (i - 2.5) * KEY.pitch;
    group.position.set(x, KEY_UP - KEY.h / 2, KEY.z);
    const isPlay = action === "play";
    const body = mesh(new RoundedBoxGeometry(KEY.w, KEY.h, KEY.d, 3, KEY.r), isPlay ? M.orange : M.ivory, group);
    body.userData.action = action;
    const [cv, g] = makeCanvas(512, 512);
    const colors = isPlay ? ["#e8653a", "#d9542a"] : ["#efe6d2", "#ded2b9"];
    const ink = isPlay ? "#2a120a" : INK;
    const label = action === "flip" ? "side B" : action;
    drawKeyTop(g, action, label, colors, ink);
    const tex = canvasTex(cv);
    const topMat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.08 });
    const top = mesh(new THREE.PlaneGeometry(KEY.w - KEY.r * 2, KEY.d - KEY.r * 2), topMat, group, { cast: false });
    top.rotation.x = -Math.PI / 2;
    top.position.y = KEY.h / 2 + 0.002;
    deck.add(group);
    return { action, group, y: KEY_UP, target: KEY_UP, tap: 0, canvas: g, tex, colors, ink, x, label };
  });
  const keyByAction = Object.fromEntries(keys.map((k) => [k.action, k]));

  // ---------- cassette ----------
  const cas = new THREE.Group();
  cas.visible = false;
  deck.add(cas);
  const shellMat = M.shell;
  {
    const outer = new THREE.Shape();
    roundRectPath(outer, -CAS.w / 2, -CAS.d / 2, CAS.w / 2, CAS.d / 2, 0.36);
    const win = new THREE.Path();
    roundRectPath(win, -3.45, CAS.hubZ - 1.15, 3.45, CAS.hubZ + 1.15, 1.1);
    outer.holes.push(win);
    mesh(extrudeXZ(outer, CAS.t, -CAS.t / 2, 0.05), shellMat, cas);
    // raised trapezoid by the tape opening, both faces
    const trap = new THREE.Shape();
    trap.moveTo(-3.7, -CAS.d / 2 + 0.05); trap.lineTo(3.7, -CAS.d / 2 + 0.05);
    trap.lineTo(3.0, -CAS.d / 2 + 1.3); trap.lineTo(-3.0, -CAS.d / 2 + 1.3); trap.closePath();
    const tg = new THREE.ExtrudeGeometry(trap, { depth: 0.08, bevelEnabled: false });
    tg.rotateX(-Math.PI / 2); // shape y -> -z : trapezoid near +z
    for (const s of [1, -1]) {
      const t = mesh(tg, shellMat, cas);
      t.position.y = s * CAS.t / 2 - (s < 0 ? 0.08 : 0);
    }
    for (const s of [1, -1]) {
      for (const [x, z] of [[-4.62, -2.82], [4.62, -2.82], [-4.62, 2.82], [4.62, 2.82], [0, 2.55]]) {
        const sc = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 14), M.chrome, cas, { cast: false });
        sc.position.set(x, s * (CAS.t / 2 + (z > 2.4 && x === 0 ? 0.1 : 0.02)), z);
      }
      // window pane
      const w = new THREE.Shape();
      roundRectPath(w, -3.45, CAS.hubZ - 1.15, 3.45, CAS.hubZ + 1.15, 1.1);
      const wg = new THREE.ShapeGeometry(w, 12);
      wg.rotateX(-Math.PI / 2);
      if (s < 0) wg.rotateX(Math.PI);
      const pane = mesh(wg, M.window, cas, { cast: false, receive: false });
      pane.position.y = s * (CAS.t / 2 - 0.02);
      pane.renderOrder = 3;
    }
  }
  // labels, one per face
  const labelGeo = new THREE.PlaneGeometry(LBL.w, LBL.h);
  const labelMatA = new THREE.MeshStandardMaterial({ roughness: 0.62, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const labelMatB = labelMatA.clone();
  const labelA = mesh(labelGeo, labelMatA, cas, { cast: false });
  labelA.rotation.x = -Math.PI / 2;
  labelA.position.set(0, CAS.t / 2 + 0.004, LBL.z0 + LBL.h / 2);
  const labelBGeo = labelGeo.clone();
  labelBGeo.rotateZ(Math.PI); labelBGeo.rotateX(Math.PI / 2);
  const labelB = mesh(labelBGeo, labelMatB, cas, { cast: false });
  labelB.position.set(0, -CAS.t / 2 - 0.004, LBL.z0 + LBL.h / 2);

  // reels: tape pack (scaled per position) + hub with teeth
  const packGeo = new THREE.CylinderGeometry(1, 1, 0.64, 72);
  const reels = [-1, 1].map((s) => {
    const g = new THREE.Group();
    g.position.set(s * CAS.hubX, 0, CAS.hubZ);
    const pack = mesh(packGeo, M.tape, g, { cast: false });
    const hub = new THREE.Group();
    const ring = new THREE.Shape();
    ring.absarc(0, 0, CAS.rMin - 0.02, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.62, 0, Math.PI * 2, true);
    ring.holes.push(hole);
    const rg = new THREE.ExtrudeGeometry(ring, { depth: 0.9, bevelEnabled: false, curveSegments: 40 });
    rg.rotateX(-Math.PI / 2);
    rg.translate(0, -0.45, 0);
    mesh(rg, M.hub, hub, { cast: false });
    for (let i = 0; i < 6; i++) {
      const tooth = mesh(new THREE.BoxGeometry(0.2, 0.9, 0.22), M.hub, hub, { cast: false });
      const a = (i / 6) * Math.PI * 2;
      tooth.position.set(Math.cos(a) * 0.56, 0, Math.sin(a) * 0.56);
      tooth.rotation.y = -a;
    }
    g.add(hub);
    cas.add(g);
    return { g, pack, hub };
  });

  const HOME = new THREE.Vector3(WELL.x, CAS_Y, WELL.z);
  cas.position.copy(HOME);

  // ---------- starfield ----------
  const stars = (() => {
    const N = 2600;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const size = new Float32Array(N), phase = new Float32Array(N);
    const tints = [new THREE.Color(0xffffff), new THREE.Color(0xfff1d6), new THREE.Color(0xd8e6ff), new THREE.Color(0xe3b03a)];
    for (let i = 0; i < N; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u), R = 900;
      pos[i * 3] = R * r * Math.cos(th);
      pos[i * 3 + 1] = R * u;
      pos[i * 3 + 2] = R * r * Math.sin(th);
      const c = tints[Math.random() < 0.9 ? (Math.random() * 3) | 0 : 3];
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      const big = Math.random();
      size[i] = big < 0.04 ? 3.4 + Math.random() * 1.8 : big < 0.3 ? 1.9 + Math.random() : 1.1 + Math.random() * 0.7;
      phase[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPR: { value: renderer.getPixelRatio() } },
      vertexShader: `
        attribute float aSize; attribute float aPhase;
        uniform float uTime, uPR;
        varying vec3 vColor; varying float vA;
        void main() {
          vColor = color;
          vA = 0.65 + 0.35 * sin(uTime * (0.6 + fract(aPhase) * 1.4) + aPhase);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPR;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor; varying float vA;
        void main() {
          float r = length(gl_PointCoord - 0.5);
          gl_FragColor = vec4(vColor, smoothstep(0.5, 0.12, r) * vA);
        }`,
      vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    const pts = new THREE.Points(geo, m);
    pts.frustumCulled = false;
    scene.add(pts);
    return pts;
  })();

  // ---------- state ----------
  let dirty = true;
  let shadowsDirty = true;          // something that casts a shadow moved
  let shadowFrac = -1;              // tape fraction the shadow map was last drawn at
  let starsAt = -1;                 // last time the starfield was advanced
  const STAR_STEP = 1 / 24;         // an idle deck only redraws for the stars, at this rate
  let sideUp = "A";
  let angL = 0, angR = 0;          // reel angles as seen from above (left / right reel)
  let frac = 0;
  let counterValue = 0;
  const tweens = [];
  let now = 0;

  function tween(dur, fn, curve = ease.inOut) {
    return new Promise((resolve) => {
      if (reduceMotion || dur <= 0) { fn(1); dirty = shadowsDirty = true; resolve(); return; }
      tweens.push({ t0: -1, dur, fn, curve, resolve });
    });
  }
  const wait = (s) => tween(s, () => {});

  function runTweens() {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      if (tw.t0 < 0) tw.t0 = now;
      const k = Math.min(1, (now - tw.t0) / tw.dur);
      tw.fn(tw.curve(k));
      if (k >= 1) { tweens.splice(i, 1); tw.resolve(); }
    }
  }

  let lidAngle = 0;
  function setLid(a) { lidAngle = a; lid.rotation.x = a; }
  async function openLid() {
    if (lidAngle <= LID.open + 0.01) return;
    onEvent("lid");
    const a0 = lidAngle;
    await tween(0.34, (k) => setLid(a0 + (LID.open - a0) * k), ease.out);
  }
  async function closeLid() {
    const a0 = lidAngle;
    await tween(0.3, (k) => setLid(a0 * (1 - k)), ease.in);
    onEvent("lid-shut");
  }

  function applySide(side) {
    sideUp = side;
    dirty = true;
  }

  function setCassetteLook(c) {
    labelMatA.map = labelTexture(c, "A");
    labelMatB.map = labelTexture(c, "B");
    labelMatA.needsUpdate = labelMatB.needsUpdate = true;
    // only the tape in the deck keeps its labels in memory
    for (const [k, tex] of labelCache) {
      if (k.slice(0, k.lastIndexOf(":")) === c.id) continue;
      tex.dispose();
      if (tex.image) tex.image.width = tex.image.height = 0;
      labelCache.delete(k);
    }
    const col = new THREE.Color(c.color);
    shellMat.color.set(0x1d1714).lerp(col, 0.32);
  }

  const OUT = { y: -7, z: 24 };
  function outPath(k) {
    // lift above the keys first, then fall away toward the shelf
    cas.position.x = HOME.x + 3 * k;
    cas.position.z = HOME.z + (OUT.z - HOME.z) * k;
    cas.position.y = CAS_Y + LIFT + 2.2 * Math.sin(Math.min(1, k * 1.6) * Math.PI / 2) - (LIFT + 2.2 - OUT.y + CAS_Y) * k * k * k;
    cas.rotation.x = 0.55 * k;
  }
  async function liftOut() {
    await openLid();
    await tween(0.32, (k) => { cas.position.y = CAS_Y + LIFT * k; }, ease.out);
    onEvent("slide");
    await tween(0.55, (k) => outPath(k), ease.in);
    cas.visible = false;
    cas.rotation.x = 0;
    dirty = shadowsDirty = true;
  }
  async function slideIn(c, side) {
    setCassetteLook(c);
    applySide(side);
    cas.rotation.set(0, 0, side === "B" ? Math.PI : 0);
    outPath(1);
    cas.visible = true;
    await openLid();
    onEvent("slide");
    await tween(0.6, (k) => outPath(1 - k), ease.out);
    cas.position.copy(HOME); cas.position.y = CAS_Y + LIFT; cas.rotation.x = 0;
    await tween(0.26, (k) => { cas.position.y = CAS_Y + LIFT * (1 - k); }, ease.in);
    onEvent("drop");
    await wait(0.12);
    await closeLid();
  }

  let loaded = null;
  const api = {
    renderer,
    get loaded() { return loaded; },
    setCassette(c, side) {
      // instant, used when motion is reduced
      loaded = c;
      cas.visible = !!c;
      shadowsDirty = true;
      if (!c) return (dirty = true);
      setCassetteLook(c);
      applySide(side);
      cas.position.copy(HOME);
      cas.rotation.set(0, 0, side === "B" ? Math.PI : 0);
      dirty = true;
    },
    // onSwap runs once the old tape is out and before the new one comes in
    async load(c, side, onSwap) {
      if (loaded) await liftOut();
      loaded = c;
      onSwap?.();
      await slideIn(c, side);
    },
    async eject() {
      if (!loaded) return;
      await liftOut();
      loaded = null;
      await closeLid();
    },
    async flip(toSide, onMid) {
      if (!loaded) return;
      await openLid();
      await tween(0.3, (k) => { cas.position.y = CAS_Y + LIFT * k; }, ease.out);
      onEvent("turn");
      const r0 = cas.rotation.z;
      let swapped = false;
      await tween(0.62, (k) => {
        cas.rotation.z = r0 + Math.PI * k;
        cas.position.y = CAS_Y + LIFT + Math.sin(k * Math.PI) * 1.2;
        if (!swapped && k >= 0.5) { swapped = true; applySide(toSide); onMid?.(); }
      }, ease.inOut);
      if (!swapped) { applySide(toSide); onMid?.(); }
      cas.rotation.z = toSide === "B" ? Math.PI : 0;
      await tween(0.24, (k) => { cas.position.y = CAS_Y + LIFT * (1 - k); }, ease.in);
      onEvent("drop");
      await wait(0.1);
      await closeLid();
    },
    setKeyLabel(action, text) {
      const k = keyByAction[action];
      if (!k || k.label === text) return;
      k.label = text;
      drawKeyTop(k.canvas, action, text, k.colors, k.ink);
      k.tex.needsUpdate = true;
      dirty = true;
    },
    setFlipLabel(text) { api.setKeyLabel("flip", text); },
    setReduceMotion(v) {
      reduceMotion = !!v;
      dirty = shadowsDirty = true;
    },
    setLatched(action) {
      for (const k of keys) {
        k.target = k.action === action ? KEY_LATCH : KEY_UP;
      }
      lampMat.emissiveIntensity = action === "play" ? 2.2 : action ? 0.9 : 0;
      dirty = true;
    },
    tap(action) {
      const k = keyByAction[action];
      if (k) { k.tap = 1; dirty = true; }
    },
    // per-frame tape state: fraction of the side played, linear tape speed (x real time)
    setTape(f, speed, dt, counter) {
      frac = f;
      const rL = Math.sqrt(CAS.rMax ** 2 + (CAS.rMin ** 2 - CAS.rMax ** 2) * f);
      const rR = Math.sqrt(CAS.rMin ** 2 + (CAS.rMax ** 2 - CAS.rMin ** 2) * f);
      if (speed !== 0) {
        const v = 4.76 * speed; // cm/s
        const cap = 15;
        angL += Math.max(-cap, Math.min(cap, v / rL)) * dt;
        angR += Math.max(-cap, Math.min(cap, v / rR)) * dt;
        dirty = true;
      }
      if (counter !== counterValue) { counterValue = counter; dirty = true; }
      // the tape packs cast shadows too: redraw them when a pack has visibly grown or shrunk
      if (Math.abs(f - shadowFrac) > 0.01) { shadowFrac = f; dirty = shadowsDirty = true; }
      // left/right as seen from above; with side B up the cassette is upside down
      const a = sideUp === "A";
      const left = a ? reels[0] : reels[1];
      const right = a ? reels[1] : reels[0];
      left.pack.scale.set(rL, 1, rL);
      right.pack.scale.set(rR, 1, rR);
      left.g.rotation.y = a ? angL : -angL;
      right.g.rotation.y = a ? angR : -angR;
      spindles[0].rotation.y = angL;
      spindles[1].rotation.y = angR;
    },
    keyRects: [],
    fit,
    get dirty() { return dirty; },
    set dirty(v) { dirty = v; },
    frame,
  };

  // ---------- counter drums ----------
  // digit v sits at the top of the drum, where the bezel window is
  function drumAngle(v) { return (3 * Math.PI) / 2 - (2 * Math.PI * (v + 0.5)) / 10 + 0.06; }
  function updateCounter() {
    const n = Math.max(0, counterValue);
    const u = n % 10;
    const c1 = u > 9 ? u - 9 : 0;
    const tensBase = Math.floor(n / 10) % 10;
    const t = tensBase + c1;
    const c2 = tensBase === 9 ? c1 : 0;
    const h = (Math.floor(n / 100) % 10) + c2;
    drums[0].rotation.x = drumAngle(h);
    drums[1].rotation.x = drumAngle(t);
    drums[2].rotation.x = drumAngle(u);
  }

  // ---------- camera fit to the slot ----------
  const corners = [];
  for (const x of [-XR, XR]) for (const y of [BASE_B, 0.6]) for (const z of [ZB, ZF]) corners.push(new THREE.Vector3(x, y, z));
  const tmp = new THREE.Vector3();
  const target = new THREE.Vector3(0, -1.6, 0.4);
  const camDir = new THREE.Vector3();
  function fit() {
    const W = innerWidth, H = innerHeight;
    renderer.setPixelRatio(pixelRatio()); // re-checked: the window may have moved to another screen
    renderer.setSize(W, H, false);
    stars.material.uniforms.uPR.value = renderer.getPixelRatio();
    const r = slot.getBoundingClientRect();
    const w = Math.max(40, r.width), h = Math.max(40, r.height);
    const phone = w < 560;
    const elev = THREE.MathUtils.degToRad(phone ? 52 : 47);
    const azim = THREE.MathUtils.degToRad(phone ? 0 : -7);
    camDir.set(Math.sin(azim) * Math.cos(elev), Math.sin(elev), Math.cos(azim) * Math.cos(elev));
    const fs = 26;
    fitCam.fov = fs; fitCam.aspect = w / h; fitCam.updateProjectionMatrix();
    let d = 80, cx = 0, cy = 0;
    const fill = phone ? 0.96 : 0.9;
    for (let it = 0; it < 6; it++) {
      fitCam.position.copy(target).addScaledVector(camDir, d);
      fitCam.lookAt(target);
      fitCam.updateMatrixWorld();
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const c of corners) {
        tmp.copy(c).project(fitCam);
        x0 = Math.min(x0, tmp.x); x1 = Math.max(x1, tmp.x);
        y0 = Math.min(y0, tmp.y); y1 = Math.max(y1, tmp.y);
      }
      cx = (x0 + x1) / 2; cy = (y0 + y1) / 2;
      const e = Math.max((x1 - x0) / 2, (y1 - y0) / 2) / fill;
      d *= e;
    }
    // main camera: same pose, fov scaled so the slot sees exactly what fitCam sees
    const tanS = Math.tan(THREE.MathUtils.degToRad(fs / 2));
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan((tanS * H) / h));
    camera.aspect = W / H;
    camera.position.copy(fitCam.position);
    camera.quaternion.copy(fitCam.quaternion);
    camera.updateProjectionMatrix();
    const Xc = ((r.left + w / 2) / W) * 2 - 1;
    const Yc = -(((r.top + h / 2) / H) * 2 - 1);
    const sx = Xc - (cx * w) / W, sy = Yc - (cy * h) / H;
    camera.projectionMatrix.elements[8] = -sx;
    camera.projectionMatrix.elements[9] = -sy;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.updateMatrixWorld();
    // overlay rectangles for the HTML keys
    api.keyRects = keys.map((k) => {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const dx of [-1, 1]) for (const dy of [-1, 1]) for (const dz of [-1, 1]) {
        tmp.set(k.x + (dx * KEY.w) / 2, KEY_UP - KEY.h / 2 + (dy * KEY.h) / 2, KEY.z + (dz * KEY.d) / 2);
        if (dy < 0 && dz < 0) continue;
        tmp.project(camera);
        const px = ((tmp.x + 1) / 2) * W, py = ((1 - tmp.y) / 2) * H;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      return { action: k.action, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    });
    dirty = shadowsDirty = true;
  }

  // ---------- frame ----------
  function frame(t, dt) {
    now = t;
    if (lost) return;
    if (tweens.length) { runTweens(); dirty = shadowsDirty = true; }
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      let target = k.target;
      if (k.tap > 0) {
        k.tap = Math.max(0, k.tap - dt * (reduceMotion ? 1e3 : 6));
        target = Math.min(target, KEY_TAP + (KEY_UP - KEY_TAP) * (1 - Math.sin(k.tap * Math.PI)));
        dirty = true;
      }
      const ny = reduceMotion ? target : k.y + (target - k.y) * Math.min(1, dt * 22);
      if (Math.abs(ny - k.y) > 1e-4) { k.y = ny; dirty = shadowsDirty = true; }
      else if (k.y !== target) { k.y = target; dirty = shadowsDirty = true; }
      k.group.position.y = k.y - KEY.h / 2;
    }
    updateCounter();
    // the starfield alone never needs 60 frames a second, nor a new shadow pass
    if (!reduceMotion && t - starsAt >= STAR_STEP) {
      starsAt = t;
      stars.material.uniforms.uTime.value = t;
      stars.rotation.y = t * 0.004;
      dirty = true;
    }
    if (dirty) {
      if (shadowsDirty) { renderer.shadowMap.needsUpdate = true; shadowsDirty = false; }
      renderer.render(scene, camera);
      dirty = false;
    }
  }

  return api;
}
