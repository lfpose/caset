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
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

// ---------- palette ----------
const C = {
  cream: 0xfbf3e6,
  creamDeep: 0xf0e4d6,
  plum: 0x3a2e4d,
  smoke: 0x352d44,
  tape: 0x6e4d3f,
  hub: 0xf7f2ea,
  rew: 0xb9d6f2,
  play: 0xb3e4cf,
  stop: 0xf6c1cd,
  ff: 0xf8e3a4,
  lilac: 0xd9ccef,
  glass: 0xdfe9ff,
};

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.02, ...extra });

// ---------- lights ----------
scene.add(new THREE.HemisphereLight(0xfff6ef, 0xd8c8ee, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.9);
sun.position.set(3.5, 7, 4.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.radius = 6;
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
scene.add(sun);
const fill = new THREE.DirectionalLight(0xe4f1ff, 0.6);
fill.position.set(-5, 3, -2);
scene.add(fill);

// ---------- ground shadow ----------
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.ShadowMaterial({ opacity: 0.16, color: 0x3a2e4d })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.28;
ground.receiveShadow = true;
scene.add(ground);

// ---------- device ----------
const device = new THREE.Group();
scene.add(device);

function add(mesh, parent = device, { shadow = true } = {}) {
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  parent.add(mesh);
  return mesh;
}

const TOP = 0.275;
add(new THREE.Mesh(new RoundedBoxGeometry(3.6, 0.55, 2.3, 6, 0.14), mat(C.cream)));

// cassette door frame + window
const door = add(new THREE.Mesh(new RoundedBoxGeometry(2.5, 0.12, 1.28, 4, 0.06), mat(C.creamDeep)));
door.position.set(-0.2, TOP + 0.02, -0.28);

const pit = add(new THREE.Mesh(new RoundedBoxGeometry(2.28, 0.1, 1.06, 3, 0.05), mat(C.smoke, { roughness: 0.8 })));
pit.position.set(-0.2, TOP + 0.07, -0.28);

// cassette face (canvas texture)
function cassetteTexture() {
  const w = 1024, h = 480;
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const g = cv.getContext("2d");
  g.fillStyle = "#d9ccef";
  g.fillRect(0, 0, w, h);
  // label
  const r = 26;
  g.fillStyle = "#fbf3e6";
  g.beginPath(); g.roundRect(60, 40, w - 120, 300, r); g.fill();
  g.fillStyle = "#b3e4cf"; g.fillRect(60, 40, w - 120, 46);
  g.fillStyle = "#f6c1cd"; g.fillRect(60, 86, w - 120, 22);
  g.fillStyle = "#3a2e4d";
  g.font = "600 54px ui-rounded, 'SF Pro Rounded', system-ui, sans-serif";
  g.fillText("caset — side A", 100, 180);
  g.font = "500 30px ui-rounded, 'SF Pro Rounded', system-ui, sans-serif";
  g.fillStyle = "#7d6f93";
  g.fillText("90 min · normal bias", 100, 230);
  // pill window (cut out so the reels below show through)
  g.globalCompositeOperation = "destination-out";
  g.beginPath(); g.roundRect(200, 245, w - 400, 160, 80); g.fill();
  g.globalCompositeOperation = "source-over";
  // bottom holes
  g.fillStyle = "#2b2536";
  for (const x of [200, 300, w - 340, w - 240]) { g.beginPath(); g.roundRect(x, 400, 28, 50, 8); g.fill(); }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
const face = add(new THREE.Mesh(new THREE.PlaneGeometry(2.16, 1.0), mat(0xffffff, { map: cassetteTexture(), roughness: 0.7, transparent: true, alphaTest: 0.5 })), device, { shadow: false });
face.rotation.x = -Math.PI / 2;
face.position.set(-0.2, TOP + 0.125, -0.28);

// reels
const R_MAX = 0.34, R_MIN = 0.16;
function makeReel(x) {
  const g = new THREE.Group();
  g.position.set(x, TOP + 0.075, -0.28 + 0.18);
  const spool = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.05, 48), mat(C.tape, { roughness: 0.85 }));
  spool.position.y = 0.02;
  g.add(spool);
  const hub = new THREE.Group();
  hub.position.y = 0.075;
  hub.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 32), mat(C.hub)));
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 24), mat(C.smoke));
  hub.add(core);
  for (let i = 0; i < 6; i++) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.06), mat(C.smoke));
    const a = (i / 6) * Math.PI * 2;
    tooth.position.set(Math.cos(a) * 0.145, 0.005, Math.sin(a) * 0.145);
    tooth.rotation.y = -a;
    hub.add(tooth);
  }
  g.add(hub);
  device.add(g);
  return { group: g, spool, hub };
}
const reelL = makeReel(-0.2 - 0.38);
const reelR = makeReel(-0.2 + 0.38);

// door glass
const glass = new THREE.Mesh(
  new RoundedBoxGeometry(2.36, 0.04, 1.14, 3, 0.02),
  new THREE.MeshPhysicalMaterial({ color: C.glass, roughness: 0.1, transparent: true, opacity: 0.14, clearcoat: 1 })
);
glass.position.set(-0.2, TOP + 0.2, -0.28);
device.add(glass);

// screws on the door
for (const [x, z] of [[-1.38, -0.86], [0.98, -0.86], [-1.38, 0.3], [0.98, 0.3]]) {
  const s = add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 16), mat(0xcdbfd8)), device, { shadow: false });
  s.position.set(x, TOP + 0.085, z);
}

// keys (3D)
const keyDefs = [
  { action: "rewind", color: C.rew },
  { action: "play", color: C.play },
  { action: "stop", color: C.stop },
  { action: "forward", color: C.ff },
];
const KEY_UP = TOP + 0.08, KEY_DOWN = TOP + 0.02;
const keys3d = keyDefs.map((d, i) => {
  const m = add(new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.2, 0.4, 4, 0.06), mat(d.color, { roughness: 0.45 })));
  m.position.set(-1.25 + i * 0.58, KEY_UP, 0.72);
  m.userData.action = d.action;
  return m;
});

// speaker grille
const holeGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.03, 12);
const holeMat = mat(0xd6c9df, { roughness: 0.9 });
for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
  if ((i === 0 || i === 4) && (j === 0 || j === 4)) continue;
  const h = new THREE.Mesh(holeGeo, holeMat);
  h.position.set(1.15 + i * 0.13, TOP + 0.005, -0.72 + j * 0.13);
  device.add(h);
}

// LED
const led = add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), mat(0xe8dcef, { emissive: 0x000000 })), device, { shadow: false });
led.position.set(1.4, TOP + 0.02, 0.35);

// volume wheel
const wheel = add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 40), mat(0xe9dff2, { roughness: 0.35 })));
wheel.rotation.z = Math.PI / 2;
wheel.position.set(1.8, 0.02, 0.62);
for (let i = 0; i < 24; i++) {
  const rib = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.03), mat(0xcdbfd8));
  const a = (i / 24) * Math.PI * 2;
  rib.position.set(Math.cos(a) * 0.235, 0, Math.sin(a) * 0.235);
  rib.rotation.y = -a;
  wheel.add(rib);
}

// headphone jack
const jack = add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 20), mat(C.smoke)), device, { shadow: false });
jack.rotation.x = Math.PI / 2;
jack.position.set(-1.5, 0.02, 1.13);

device.position.y = 0;

// ---------- particles ----------
const spriteTex = (() => {
  const s = 64, cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const g = cv.getContext("2d");
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.5, "rgba(255,255,255,0.55)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

const PAL = [0xf6c1cd, 0xb3e4cf, 0xb9d6f2, 0xf8e3a4, 0xe6d8f5, 0xffffff].map((c) => new THREE.Color(c));
const BOX = { x: 14, y: 8, z: 10 };
function makeParticles(count, size, opacity) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * BOX.x;
    pos[i * 3 + 1] = (Math.random() - 0.5) * BOX.y;
    pos[i * 3 + 2] = (Math.random() - 0.5) * BOX.z - 1;
    const c = PAL[(Math.random() * PAL.length) | 0];
    col.set([c.r, c.g, c.b], i * 3);
    seed[i] = Math.random() * 1000;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({
    size, map: spriteTex, vertexColors: true, transparent: true, opacity,
    depthWrite: false, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, m);
  pts.userData.seed = seed;
  scene.add(pts);
  return pts;
}
const dustFar = makeParticles(420, 0.16, 0.7);
const dustNear = makeParticles(140, 0.4, 0.5);
const notes = makeParticles(90, 0.28, 0.0); // emitted from the player while running
notes.userData.life = new Float32Array(90).fill(-1);

// ---------- state ----------
const TAPE_SECONDS = 240;      // full side at 1x
const WIND = 14;               // rewind/forward multiplier
let mode = "idle";             // idle | play | rewind | forward
let tape = 0.12;               // fraction wound onto the right reel
let angL = 0, angR = 0;
let keyTargets = keys3d.map(() => KEY_UP);

const counterEl = document.getElementById("counter");
const htmlKeys = [...document.querySelectorAll(".key")];
const keyByAction = Object.fromEntries(htmlKeys.map((b) => [b.dataset.action, b]));

function setMode(next) {
  if (next === "play" && tape >= 1) next = "idle";
  if (next === "forward" && tape >= 1) next = "idle";
  if (next === "rewind" && tape <= 0) next = "idle";
  mode = next;
  for (const b of htmlKeys) {
    const latched = b.dataset.action === mode;
    b.classList.toggle("is-down", latched);
    if (b.dataset.action === "play") b.setAttribute("aria-pressed", String(latched));
  }
  keyTargets = keys3d.map((k) => (k.userData.action === mode ? KEY_DOWN : KEY_UP));
  led.material.emissive.set(mode === "play" ? 0x7fd9b4 : 0x000000);
  led.material.emissiveIntensity = mode === "play" ? 1.4 : 0;
  hiss(mode !== "idle" ? (mode === "play" ? 0.02 : 0.045) : 0);
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

// ---------- sound (synthesised, tiny) ----------
let actx, hissGain;
function audio() {
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
  const ctx = audio();
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

// ---------- resize / camera ----------
function fit() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const d = THREE.MathUtils.clamp(Math.max(2.35 / (half * camera.aspect), 1.9 / half), 6, 16);
  const el = THREE.MathUtils.degToRad(40);
  camera.position.set(0, Math.sin(el) * d, Math.cos(el) * d);
  camera.lookAt(0, camera.aspect < 0.8 ? -1.0 : -0.55, 0);
  camera.updateProjectionMatrix();
}
addEventListener("resize", fit);
fit();

// ---------- loop ----------
const timer = new THREE.Timer();
const tmpV = new THREE.Vector3();

function tick() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = timer.getElapsed();

  // tape transport
  let v = 0;
  if (mode === "play") v = 1 / TAPE_SECONDS;
  if (mode === "forward") v = WIND / TAPE_SECONDS;
  if (mode === "rewind") v = -WIND / TAPE_SECONDS;
  if (v) {
    tape = THREE.MathUtils.clamp(tape + v * dt, 0, 1);
    if (tape === 0 || tape === 1) setMode("idle");
  }
  const rL = Math.sqrt(THREE.MathUtils.lerp(R_MAX ** 2, R_MIN ** 2, tape));
  const rR = Math.sqrt(THREE.MathUtils.lerp(R_MIN ** 2, R_MAX ** 2, tape));
  reelL.spool.scale.set(rL, 1, rL);
  reelR.spool.scale.set(rR, 1, rR);
  const lin = v * TAPE_SECONDS * 0.9; // tape linear speed in scene units/s
  angL -= (lin / rL) * dt;
  angR -= (lin / rR) * dt;
  reelL.hub.rotation.y = angL;
  reelR.hub.rotation.y = angR;
  reelL.spool.rotation.y = angL;
  reelR.spool.rotation.y = angR;

  counterEl.textContent = String(Math.round(tape * 2400)).padStart(4, "0");

  // keys settle
  keys3d.forEach((k, i) => { k.position.y += (keyTargets[i] - k.position.y) * Math.min(1, dt * 18); });

  // device attitude
  const tx = reduceMotion ? 0 : look.y * 0.10;
  const ty = reduceMotion ? 0 : look.x * 0.22;
  device.rotation.x += (tx - device.rotation.x) * Math.min(1, dt * 3);
  device.rotation.y += (ty - device.rotation.y) * Math.min(1, dt * 3);
  if (!reduceMotion) device.position.y = Math.sin(t * 0.8) * 0.02;

  // ambient dust
  if (!reduceMotion) {
    const running = mode !== "idle";
    for (const pts of [dustFar, dustNear]) {
      const p = pts.geometry.attributes.position.array;
      const seed = pts.userData.seed;
      const rise = (running ? 0.35 : 0.08) * dt;
      for (let i = 0; i < seed.length; i++) {
        const k = i * 3;
        p[k] += Math.sin(t * 0.6 + seed[i]) * 0.12 * dt;
        p[k + 1] += rise + Math.sin(t * 0.9 + seed[i] * 1.3) * 0.05 * dt;
        if (p[k + 1] > BOX.y / 2) { p[k + 1] = -BOX.y / 2; p[k] = (Math.random() - 0.5) * BOX.x; }
      }
      pts.geometry.attributes.position.needsUpdate = true;
    }
    // notes from the player
    const p = notes.geometry.attributes.position.array;
    const life = notes.userData.life;
    const seed = notes.userData.seed;
    let alive = 0;
    for (let i = 0; i < life.length; i++) {
      const k = i * 3;
      if (life[i] < 0) {
        if (running && Math.random() < dt * 1.2) {
          life[i] = 0;
          tmpV.set(-0.2 + (Math.random() - 0.5) * 2.0, TOP + 0.25, -0.28 + (Math.random() - 0.5) * 0.8);
          device.localToWorld(tmpV);
          p[k] = tmpV.x; p[k + 1] = tmpV.y; p[k + 2] = tmpV.z;
        } else { p[k + 1] = -99; continue; }
      }
      life[i] += dt;
      p[k] += Math.sin(t * 2 + seed[i]) * 0.25 * dt;
      p[k + 1] += 0.55 * dt;
      p[k + 2] += Math.cos(t * 1.7 + seed[i]) * 0.15 * dt;
      if (life[i] > 4.5) life[i] = -1;
      alive++;
    }
    notes.material.opacity += ((alive ? 0.8 : 0) - notes.material.opacity) * Math.min(1, dt * 2);
    notes.geometry.attributes.position.needsUpdate = true;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
setMode("idle");
tick();
