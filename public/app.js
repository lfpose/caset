import * as THREE from "./vendor/three.module.js";
import { RoundedBoxGeometry } from "./vendor/RoundedBoxGeometry.js";

// ---------- setup ----------
const canvas = document.getElementById("stage");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
} catch {
  canvas.remove();
  const p = document.createElement("p");
  p.className = "nogl";
  p.textContent = "This player needs WebGL. Your browser has it turned off.";
  document.body.prepend(p);
  throw new Error("no webgl");
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);

// ---------- palette ----------
const C = {
  body: 0x2b2521,
  face: 0x3b332d,
  rim: 0x4a403a,
  ivory: 0xefe4cc,
  ivoryDim: 0xbfae94,
  black: 0x1c1613,
  shell: 0x1e1a18,
  tape: 0x8a6650,
  hub: 0xe9dfca,
  orange: 0xe2582b,
  mustard: 0xe3b03a,
  olive: 0x8a8b3b,
  teal: 0x3d8d8c,
  navy: 0x33506b,
  glass: 0xcfd8d6,
};
const STRIPES = ["#e2582b", "#e3b03a", "#8a8b3b", "#3d8d8c", "#33506b"];

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...extra });

// ---------- lights ----------
scene.add(new THREE.HemisphereLight(0xfff1dc, 0x2a1f18, 1.0));
const key = new THREE.DirectionalLight(0xffe9cc, 2.2);
key.position.set(3, 6, 5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.radius = 5;
Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
scene.add(key);
const rim = new THREE.DirectionalLight(0x8fb6c8, 1.2);
rim.position.set(-4, 3, -4);
scene.add(rim);
const warm = new THREE.PointLight(0xe2582b, 6, 8, 2);
warm.position.set(2.5, 1.5, 2.5);
scene.add(warm);

// ---------- ground ----------
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.ShadowMaterial({ opacity: 0.45, color: 0x000000 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.6;
ground.receiveShadow = true;
scene.add(ground);

// ---------- device ----------
const device = new THREE.Group();
scene.add(device);
const BASE_TILT = 0.62; // propped up toward the viewer

function add(mesh, parent = device, { shadow = true } = {}) {
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  parent.add(mesh);
  return mesh;
}

const TOP = 0.275;
add(new THREE.Mesh(new RoundedBoxGeometry(3.6, 0.55, 2.3, 6, 0.12), mat(C.body, { roughness: 0.7 })));
// faceplate
const plate = add(new THREE.Mesh(new RoundedBoxGeometry(3.4, 0.05, 2.1, 4, 0.05), mat(C.face, { roughness: 0.5, metalness: 0.25 })));
plate.position.y = TOP;

// stripe band along the right side (texture)
function stripeTexture() {
  const w = 410, h = 1024;
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const g = cv.getContext("2d");
  const bar = 30, gap = 8, total = STRIPES.length * bar + (STRIPES.length - 1) * gap;
  const x0 = 300 - total / 2;
  g.lineCap = "round";
  STRIPES.forEach((c, i) => {
    const x = x0 + i * (bar + gap) + bar / 2;
    g.strokeStyle = c; g.lineWidth = bar;
    g.beginPath();
    g.moveTo(x, -20);
    g.lineTo(x, h * 0.62 - (STRIPES.length - 1 - i) * (bar + gap));
    g.lineTo(x - 420, h * 0.62 + 420 - (STRIPES.length - 1 - i) * (bar + gap));
    g.stroke();
  });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
const band = add(new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.9), mat(0xffffff, { map: stripeTexture(), transparent: true, roughness: 0.5 })), device, { shadow: false });
band.rotation.x = -Math.PI / 2;
band.rotation.z = Math.PI; // stripes run from the back edge toward the front, bending at the front
band.position.set(1.38, TOP + 0.027, 0);

// cassette door frame + pit
const door = add(new THREE.Mesh(new RoundedBoxGeometry(2.5, 0.12, 1.28, 4, 0.05), mat(C.rim, { roughness: 0.45, metalness: 0.3 })));
door.position.set(-0.35, TOP + 0.02, -0.28);
const pit = add(new THREE.Mesh(new RoundedBoxGeometry(2.28, 0.1, 1.06, 3, 0.04), mat(C.black, { roughness: 0.85 })));
pit.position.set(-0.35, TOP + 0.02, -0.28);

// cassette face (canvas texture; re-rendered per track)
function labelTexture(title, sub) {
  const w = 1024, h = 480;
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const g = cv.getContext("2d");
  g.fillStyle = "#1e1a18";
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#efe4cc";
  g.beginPath(); g.roundRect(60, 40, w - 120, 300, 22); g.fill();
  STRIPES.forEach((c, i) => { g.fillStyle = c; g.fillRect(60, 48 + i * 14, w - 120, 10); });
  g.fillStyle = "#17120f";
  g.font = "700 46px Futura, 'Century Gothic', 'Avenir Next', system-ui, sans-serif";
  g.fillText(fitText(g, title, w - 220), 100, 190);
  g.font = "500 28px Futura, 'Century Gothic', 'Avenir Next', system-ui, sans-serif";
  g.fillStyle = "#6b5f52";
  g.fillText(sub, 100, 235);
  g.globalCompositeOperation = "destination-out";
  g.beginPath(); g.roundRect(200, 245, w - 400, 160, 80); g.fill();
  g.globalCompositeOperation = "source-over";
  g.fillStyle = "#0f0b09";
  for (const x of [200, 300, w - 340, w - 240]) { g.beginPath(); g.roundRect(x, 400, 28, 50, 8); g.fill(); }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
function fitText(g, text, max) {
  if (g.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 3 && g.measureText(s + "…").width > max) s = s.slice(0, -1);
  return s.trimEnd() + "…";
}
const faceMat = mat(0xffffff, { map: labelTexture("caset", "side A"), roughness: 0.75, transparent: true, alphaTest: 0.5 });
const face = add(new THREE.Mesh(new THREE.PlaneGeometry(2.16, 1.0), faceMat), device, { shadow: false });
face.rotation.x = -Math.PI / 2;
face.position.set(-0.35, TOP + 0.135, -0.28);
function setLabel(title, sub) {
  const old = faceMat.map;
  faceMat.map = labelTexture(title, sub);
  faceMat.needsUpdate = true;
  old?.dispose();
}

// reels
const R_MAX = 0.34, R_MIN = 0.16;
function makeReel(x) {
  const g = new THREE.Group();
  g.position.set(x, TOP + 0.075, -0.28 + 0.18);
  const spool = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.03, 48), mat(C.tape, { roughness: 0.85 }));
  spool.position.y = 0.01;
  g.add(spool);
  const hub = new THREE.Group();
  hub.position.y = 0.08;
  hub.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 32), mat(C.hub)));
  hub.add(new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 24), mat(C.black)));
  for (let i = 0; i < 6; i++) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.06), mat(C.black));
    const a = (i / 6) * Math.PI * 2;
    tooth.position.set(Math.cos(a) * 0.145, 0.005, Math.sin(a) * 0.145);
    tooth.rotation.y = -a;
    hub.add(tooth);
  }
  g.add(hub);
  device.add(g);
  return { group: g, spool, hub };
}
const reelL = makeReel(-0.35 - 0.38);
const reelR = makeReel(-0.35 + 0.38);

// door glass
const glass = new THREE.Mesh(
  new RoundedBoxGeometry(2.36, 0.04, 1.14, 3, 0.02),
  new THREE.MeshPhysicalMaterial({ color: C.glass, roughness: 0.08, transparent: true, opacity: 0.12, clearcoat: 1 })
);
glass.position.set(-0.35, TOP + 0.2, -0.28);
device.add(glass);

// screws
for (const [x, z] of [[-1.53, -0.86], [0.83, -0.86], [-1.53, 0.3], [0.83, 0.3]]) {
  const s = add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 16), mat(0x8d8378, { metalness: 0.6, roughness: 0.4 })), device, { shadow: false });
  s.position.set(x, TOP + 0.085, z);
}

// keys (3D)
const keyDefs = [
  { action: "rewind", color: C.ivory },
  { action: "play", color: C.orange },
  { action: "stop", color: C.ivory },
  { action: "forward", color: C.ivory },
];
const KEY_UP = TOP + 0.08, KEY_DOWN = TOP + 0.02;
const keys3d = keyDefs.map((d, i) => {
  const m = add(new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.2, 0.4, 4, 0.04), mat(d.color, { roughness: 0.4 })));
  m.position.set(-1.4 + i * 0.58, KEY_UP, 0.72);
  m.userData.action = d.action;
  return m;
});

// LED
const led = add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), mat(0x5a2a1a, { emissive: 0x000000 })), device, { shadow: false });
led.position.set(1.05, TOP + 0.02, 0.72);

// volume wheel
const wheel = add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 40), mat(C.rim, { roughness: 0.35, metalness: 0.3 })));
wheel.rotation.z = Math.PI / 2;
wheel.position.set(1.8, 0.02, 0.62);
for (let i = 0; i < 24; i++) {
  const rib = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.03), mat(C.body));
  const a = (i / 24) * Math.PI * 2;
  rib.position.set(Math.cos(a) * 0.235, 0, Math.sin(a) * 0.235);
  rib.rotation.y = -a;
  wheel.add(rib);
}

// headphone jack
const jack = add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 20), mat(C.black)), device, { shadow: false });
jack.rotation.x = Math.PI / 2;
jack.position.set(-1.5, 0.02, 1.13);

device.rotation.x = BASE_TILT;

// ---------- stars ----------
const STAR_COUNT = 2600;
const stars = (() => {
  const pos = new Float32Array(STAR_COUNT * 3);
  const col = new Float32Array(STAR_COUNT * 3);
  const size = new Float32Array(STAR_COUNT);
  const phase = new Float32Array(STAR_COUNT);
  const tints = [new THREE.Color(0xffffff), new THREE.Color(0xfff1d6), new THREE.Color(0xd8e6ff), new THREE.Color(0xe3b03a)];
  for (let i = 0; i < STAR_COUNT; i++) {
    // uniform on a sphere, camera-facing hemisphere weighted
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u), R = 60;
    pos[i * 3] = R * r * Math.cos(th);
    pos[i * 3 + 1] = R * u;
    pos[i * 3 + 2] = R * r * Math.sin(th) - 20;
    const c = tints[Math.random() < 0.9 ? (Math.random() * 3) | 0 : 3];
    col.set([c.r, c.g, c.b], i * 3);
    const big = Math.random();
    size[i] = big < 0.04 ? 3.6 + Math.random() * 1.8 : big < 0.3 ? 2.0 + Math.random() : 1.1 + Math.random() * 0.7;
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
        float tw = 0.65 + 0.35 * sin(uTime * (0.6 + fract(aPhase) * 1.4) + aPhase);
        vA = tw;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPR;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vA;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d);
        float a = smoothstep(0.5, 0.12, r) * vA;
        gl_FragColor = vec4(vColor, a);
      }`,
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, m);
  scene.add(pts);
  return pts;
})();

// ---------- tape + tracks ----------
const WIND = 14;
const audio = document.getElementById("player");
const counterEl = document.getElementById("counter");
const nowEl = document.getElementById("now");
const listEl = document.getElementById("tracks");
const htmlKeys = [...document.querySelectorAll(".key")];

let tracks = [];          // { slug, title, year, duration, src }
let offsets = [];         // cumulative start seconds
let total = 240;          // seconds of tape on this side (fallback when no audio)
let pos = 0;              // seconds from the start of the side
let mode = "idle";        // idle | play | rewind | forward
let angL = 0, angR = 0;
let keyTargets = keys3d.map(() => KEY_UP);
let current = -1;

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function trackAt(p) {
  let i = 0;
  while (i < tracks.length - 1 && p >= offsets[i + 1]) i++;
  return i;
}

function renderList() {
  listEl.replaceChildren(...tracks.map((t, i) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.className = "track"; b.type = "button"; b.dataset.index = i;
    b.innerHTML = `<span class="t">${t.title}<span class="y">${t.year}</span></span><span class="d">${fmt(t.duration)}</span>`;
    b.addEventListener("click", () => { click(); pos = offsets[i]; setCurrent(i); setMode("play"); });
    li.append(b);
    return li;
  }));
}

function setCurrent(i) {
  if (i === current) return;
  current = i;
  const t = tracks[i];
  for (const b of listEl.querySelectorAll(".track")) b.toggleAttribute("aria-current", Number(b.dataset.index) === i);
  if (t) {
    nowEl.textContent = `${t.title} · ${t.year}`;
    setLabel(t.title, `${t.year} — side A, track ${String(i + 1).padStart(2, "0")}`);
    if (audio.src !== t.src) audio.src = t.src;
  }
}

async function loadTracks() {
  try {
    const r = await fetch("/audio/tracks.json", { cache: "no-cache" });
    if (!r.ok) throw new Error(r.status);
    tracks = (await r.json()).map((t) => ({ ...t, src: new URL(`/audio/${t.slug}.mp3`, location.href).href }));
  } catch {
    tracks = [];
  }
  offsets = tracks.reduce((a, t, i) => (a.push(i ? a[i - 1] + tracks[i - 1].duration : 0), a), []);
  total = tracks.reduce((s, t) => s + t.duration, 0) || 240;
  document.getElementById("side-empty").hidden = tracks.length > 0;
  renderList();
  if (tracks.length) setCurrent(0);
}

// keep audio element in sync with tape position
function syncAudio() {
  if (!tracks.length) return;
  const i = trackAt(pos);
  setCurrent(i);
  const local = pos - offsets[i];
  const apply = () => { if (Math.abs(audio.currentTime - local) > 0.35) audio.currentTime = local; };
  if (audio.readyState >= 1) apply(); else audio.addEventListener("loadedmetadata", apply, { once: true });
}

audio.addEventListener("ended", () => {
  if (current < tracks.length - 1) { pos = offsets[current + 1]; syncAudio(); audio.play(); }
  else { pos = total; setMode("idle"); }
});

function setMode(next) {
  if ((next === "play" || next === "forward") && pos >= total) next = "idle";
  if (next === "rewind" && pos <= 0) next = "idle";
  mode = next;
  for (const b of htmlKeys) {
    const latched = b.dataset.action === mode;
    b.classList.toggle("is-down", latched);
    if (b.dataset.action === "play") b.setAttribute("aria-pressed", String(latched));
  }
  keyTargets = keys3d.map((k) => (k.userData.action === mode ? KEY_DOWN : KEY_UP));
  led.material.emissive.set(mode === "idle" ? 0x000000 : 0xff6a30);
  led.material.emissiveIntensity = mode === "idle" ? 0 : 2;
  if (mode === "play" && tracks.length) { syncAudio(); audio.play().catch(() => {}); }
  else audio.pause();
  hiss(mode === "idle" ? 0 : mode === "play" ? 0.012 : 0.04);
}

function press(action) {
  click();
  if (action === "stop") return setMode("idle");
  setMode(mode === action ? "idle" : action);
}
for (const b of htmlKeys) b.addEventListener("click", () => press(b.dataset.action));
addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLButtonElement && e.key !== "Escape") return;
  if (e.code === "Space") { e.preventDefault(); press(mode === "play" ? "stop" : "play"); }
  else if (e.key === "ArrowLeft") press("rewind");
  else if (e.key === "ArrowRight") press("forward");
  else if (e.key === "Escape") press("stop");
});

// 3D key picking
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
canvas.addEventListener("pointerdown", (e) => {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(keys3d, false)[0];
  if (hit) press(hit.object.userData.action);
});
canvas.addEventListener("pointermove", (e) => {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  canvas.style.cursor = ray.intersectObjects(keys3d, false).length ? "pointer" : "";
});

// ---------- synthesised click + hiss ----------
let actx, hissGain;
function ctxAudio() {
  if (actx) return actx;
  actx = new (window.AudioContext || window.webkitAudioContext)();
  const len = actx.sampleRate * 2;
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = actx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const bp = actx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = 3200; bp.Q.value = 0.6;
  hissGain = actx.createGain(); hissGain.gain.value = 0;
  src.connect(bp).connect(hissGain).connect(actx.destination);
  src.start();
  return actx;
}
function hiss(level) {
  if (!actx) return;
  hissGain.gain.setTargetAtTime(level, actx.currentTime, 0.15);
}
function click() {
  const ctx = ctxAudio();
  if (ctx.state === "suspended") ctx.resume();
  const len = ctx.sampleRate * 0.04;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 1800;
  const g = ctx.createGain(); g.gain.value = 0.5;
  src.connect(lp).connect(g).connect(ctx.destination);
  src.start();
}

// ---------- pointer parallax ----------
const look = { x: 0, y: 0 };
addEventListener("pointermove", (e) => {
  look.x = (e.clientX / innerWidth - 0.5) * 2;
  look.y = (e.clientY / innerHeight - 0.5) * 2;
});

// ---------- camera ----------
function fit() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const wide = camera.aspect > 1.1;
  const d = THREE.MathUtils.clamp(Math.max((wide ? 3.2 : 2.3) / (half * camera.aspect), 1.8 / half), 6, 16);
  const el = THREE.MathUtils.degToRad(9);
  camera.position.set(0, Math.sin(el) * d, Math.cos(el) * d);
  camera.lookAt(0, wide ? -0.25 : -0.8, 0);
  camera.updateProjectionMatrix();
}
addEventListener("resize", fit);
fit();

// ---------- loop ----------
const timer = new THREE.Timer();

function tick() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = timer.getElapsed();

  // transport
  let v = 0;
  if (mode === "play") {
    if (tracks.length) {
      if (!audio.paused && !audio.seeking) pos = offsets[current] + audio.currentTime;
      v = audio.paused ? 0 : 1;
    } else { v = 1; pos += dt; }
  } else if (mode === "forward") { v = WIND; pos += WIND * dt; }
  else if (mode === "rewind") { v = -WIND; pos -= WIND * dt; }
  pos = THREE.MathUtils.clamp(pos, 0, total);
  if (mode !== "idle" && mode !== "play" && (pos <= 0 || pos >= total)) setMode("idle");
  if (mode !== "play" && tracks.length && v) setCurrent(trackAt(pos));

  const frac = pos / total;
  const rL = Math.sqrt(THREE.MathUtils.lerp(R_MAX ** 2, R_MIN ** 2, frac));
  const rR = Math.sqrt(THREE.MathUtils.lerp(R_MIN ** 2, R_MAX ** 2, frac));
  reelL.spool.scale.set(rL, 1, rL);
  reelR.spool.scale.set(rR, 1, rR);
  const lin = v * 0.18; // tape linear speed, scene units/s at 1x
  angL -= (lin / rL) * dt;
  angR -= (lin / rR) * dt;
  reelL.hub.rotation.y = reelL.spool.rotation.y = angL;
  reelR.hub.rotation.y = reelR.spool.rotation.y = angR;
  counterEl.textContent = String(Math.round(frac * 999)).padStart(4, "0");

  keys3d.forEach((k, i) => { k.position.y += (keyTargets[i] - k.position.y) * Math.min(1, dt * 18); });

  const tx = BASE_TILT + (reduceMotion ? 0 : look.y * 0.08);
  const ty = reduceMotion ? 0 : look.x * 0.18;
  device.rotation.x += (tx - device.rotation.x) * Math.min(1, dt * 3);
  device.rotation.y += (ty - device.rotation.y) * Math.min(1, dt * 3);
  if (!reduceMotion) device.position.y = Math.sin(t * 0.8) * 0.015;

  stars.material.uniforms.uTime.value = reduceMotion ? 0 : t;
  if (!reduceMotion) stars.rotation.y = t * 0.004;

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
setMode("idle");
loadTracks();
tick();
