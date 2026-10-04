// Station dial (dial), after the Lloyd's receiver: a milky backlit scale where each track is a
// "station" with its year as the frequency, a minute row like the FM row, a logging scale, an
// orange lit needle on a dial cord with pulleys (spring-followed), a TUNED lamp, band changes.
import { makeCanvas, fontFor, canvasTexture, FRAG_TAIL, fitText, spacedText } from "./util.js";

const W = 13.6, H = 2.4;
const PX = 2048 / W;                  // ~150.6 px/cm
const SX0 = 1.6, SX1 = 13.0;          // scale span, cm from the left edge
const Z_SCALE = -0.78, Z_NEEDLE = -0.53, Z_CORD = -0.47;
const STEP = 1 / 240;

export function yearOf(date) {
  const m = /(1[89]\d\d|20\d\d)(s?)/.exec(String(date || ""));
  return m ? m[1] + m[2] : "";
}

// compact: the phone layout (kept for the contract; the scale is the same: years, minutes and
// the logging ticks, all set to hold at small sizes).
function drawScale(D, font, prog, inkHex, compact = false) {
  const c = makeCanvas(2048, Math.round(H * PX)), g = c.getContext("2d");
  const X = (x) => x * PX, Y = (y) => (H / 2 - y) * PX;   // x from left edge, y from centre (up)
  // diffuser ground: a warm parchment (not paper white), so the backlit scale keeps its ink
  g.fillStyle = "#e6d9c0"; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 160; i++) {
    const x = (i * 97.13) % c.width, y = (i * 53.7) % c.height;
    const rg = g.createRadialGradient(x, y, 0, x, y, 60 + (i % 5) * 20);
    rg.addColorStop(0, "rgba(230,215,190,0.05)"); rg.addColorStop(1, "rgba(230,215,190,0)");
    g.fillStyle = rg; g.fillRect(x - 140, y - 140, 280, 280);
  }
  const ink = inkHex;
  const total = prog ? prog.total : 0;
  const xs = (s) => SX0 + (SX1 - SX0) * (total > 0 ? s / total : 0);

  // cord channel along the top
  g.fillStyle = "rgba(42,36,32,0.10)"; g.fillRect(0, Y(1.2), c.width, 0.3 * PX);
  g.fillStyle = "rgba(42,36,32,0.35)"; g.fillRect(X(0.3), Y(0.9), X(13.3) - X(0.3), 1.5);

  // left captions (where FM / AM would be)
  g.fillStyle = ink; g.textBaseline = "alphabetic"; g.textAlign = "left";
  g.font = fontFor(0.21 * PX, font.brand, 700, 0.7);
  spacedText(g, prog ? `SIDE ${prog.side}` : "SIDE –", X(0.2), Y(0.36), 0.02 * PX);
  g.font = fontFor(0.15 * PX, font.brand, 700, 0.7);
  spacedText(g, "STATION", X(0.2), Y(-0.1), 0.012 * PX);
  g.font = fontFor(0.12 * PX, font.brand, 700, 0.7);
  g.fillStyle = "rgba(42,36,32,0.8)";
  spacedText(g, "LOG", X(0.2), Y(-0.7), 0.01 * PX);

  // right captions
  g.textAlign = "left";
  g.font = fontFor(0.16 * PX, font.panel, 500);
  g.fillStyle = ink;
  g.fillText("min", X(13.08), Y(0.38));

  // ---- minute row
  const lineY = 0.32;
  if (prog && total > 0) {
    g.fillStyle = ink;
    g.fillRect(X(SX0) - 1, Y(lineY), X(SX1) - X(SX0) + 2, 0.022 * PX);
    for (let s = 0; s <= total + 1e-6; s += 10) {
      const major = s % 60 === 0, half = s % 30 === 0;
      const h = major ? 0.2 : half ? 0.14 : 0.09;
      const w = major ? 0.035 : 0.022;
      g.fillRect(X(xs(s)) - (w * PX) / 2, Y(lineY + h), w * PX, h * PX);
    }
    // end-of-side mark
    g.fillRect(X(SX1) - 1, Y(lineY + 0.24), 0.02 * PX, 0.24 * PX);
    g.font = fontFor(0.3 * PX, font.numeric, 700);
    g.textAlign = "center";
    for (let m = 0; m * 60 <= total + 1e-6; m++) {
      const x = X(xs(m * 60));
      if (X(SX1) - x < 0.3 * PX && m > 0) continue;
      g.fillText(String(m), x, Y(lineY + 0.22));
    }
  } else {
    g.fillStyle = "rgba(42,36,32,0.25)";
    g.fillRect(X(SX0), Y(lineY), X(SX1) - X(SX0), 0.012 * PX);
  }

  // ---- station row
  const sy = 0.02;
  g.fillStyle = "rgba(42,36,32,0.55)";
  g.fillRect(X(SX0), Y(sy), X(SX1) - X(SX0), 0.01 * PX);
  if (prog && total > 0) {
    const n = prog.tracks.length;
    for (let i = 0; i < n; i++) {
      const x0 = xs(prog.offsets[i]);
      const x1 = i + 1 < n ? xs(prog.offsets[i + 1]) : SX1;
      // allocation band: alternate faint tones, the even ones tinted with the tape colour
      g.globalAlpha = i % 2 ? 0.07 : 0.13;
      g.fillStyle = i % 2 ? ink : prog.color || ink;
      g.fillRect(X(x0), Y(0.12), X(x1) - X(x0), 0.74 * PX);
      g.globalAlpha = 1;
      // station pip
      g.fillStyle = D.dialStation;
      g.fillRect(X(x0) - 0.05 * PX, Y(0.1), 0.1 * PX, 0.3 * PX);
      // the year as the frequency, large and bold. No titles on the dial: they cannot be read
      // at the deck's size, and the page's liner carries them
      const t = prog.tracks[i];
      const yr = yearOf(t.date) || String(i + 1);
      g.fillStyle = ink;
      g.textAlign = "left";
      g.font = fontFor(0.5 * PX, font.numeric, 700);
      const avail = (x1 - x0 - 0.24) * PX;
      fitText(g, yr, X(x0) + 0.14 * PX, Y(-0.58), Math.max(0.4 * PX, Math.min(avail, 2.4 * PX)));
    }
  }

  // ---- logging scale 0..100
  const ly = -0.62;
  g.fillStyle = ink;
  g.fillRect(X(SX0), Y(ly), X(SX1) - X(SX0), 0.016 * PX);
  for (let i = 0; i <= 50; i++) {
    const x = X(SX0 + ((SX1 - SX0) * i) / 50);
    const h = i % 5 === 0 ? 0.14 : 0.07;
    const w = (i % 5 === 0 ? 0.03 : 0.018) * PX;
    g.fillRect(x - w / 2, Y(ly), w, h * PX);
  }
  // tuned caption under its lamp
  g.textAlign = "center";
  g.font = fontFor(0.12 * PX, font.panel, 600);
  g.fillStyle = ink;
  g.fillText("tuned", X(13.3), Y(-0.4));
  // fine border line inside the window
  g.strokeStyle = "rgba(42,36,32,0.25)"; g.lineWidth = 2;
  g.strokeRect(X(0.08), Y(1.12), X(13.52) - X(0.08), 2.24 * PX);
  return c;
}

export function buildDial(env) {
  const { THREE, D, font } = env;
  const T = (x) => env.track(x);
  const root = new THREE.Group();
  root.name = "dial";

  const cache = new Map();   // key -> texture (LRU of 4, plus the empty scale)
  const emptyTex = T(canvasTexture(THREE, drawScale(D, font, null, D.dialInk), env.maxAniso));
  let compact = false;
  const u = {
    uMap: { value: emptyTex },
    uLamp: { value: new THREE.Color(D.dialLamp) },
    uLevel: { value: 0 },
  };
  const mat = T(new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform vec3 uLamp; uniform float uLevel; varying vec2 vUv;
      void main(){
        vec3 tex = texture2D(uMap, vUv).rgb;
        // two dial lamps behind the ends of the scale, a broad milky falloff toward the middle
        float a = (vUv.x - 0.1) / 0.32, b = (vUv.x - 0.9) / 0.32;
        float prof = 0.45 + 0.62 * (exp(-a * a) + exp(-b * b));
        prof *= 0.88 + 0.12 * (1.0 - abs(vUv.y - 0.4) * 2.0);
        // the bezel's inner shadow: the diffuser darkens into the frame
        float ex = min(vUv.x, 1.0 - vUv.x) * ${W.toFixed(2)}, ey = min(vUv.y, 1.0 - vUv.y) * ${H.toFixed(2)};
        prof *= smoothstep(0.0, 0.32, ex) * 0.55 + 0.45;
        prof *= smoothstep(0.0, 0.22, ey) * 0.6 + 0.4;
        vec3 col = tex * (uLamp * uLevel * prof + 0.02);
        gl_FragColor = vec4(col, 1.0);
        ${FRAG_TAIL}
      }`,
  }));
  mat.name = "dial";
  const scale = new THREE.Mesh(T(new THREE.PlaneGeometry(W, H)), mat);
  scale.position.z = Z_SCALE;
  root.add(scale);

  // side walls of the dial well
  const wallMat = T(new THREE.MeshStandardMaterial({ color: 0x14110f, roughness: 0.7, side: THREE.DoubleSide }));
  const P = [], x = W / 2, y = H / 2, d = -Z_SCALE;
  const quad = (ax, ay, bx, by) => { const v = [[ax, ay, 0], [bx, by, 0], [bx, by, -d], [ax, ay, -d]]; for (const i of [0, 1, 2, 0, 2, 3]) P.push(...v[i]); };
  quad(-x, -y, x, -y); quad(x, -y, x, y); quad(x, y, -x, y); quad(-x, y, -x, -y);
  const wg = new THREE.BufferGeometry();
  wg.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  wg.computeVertexNormals();
  root.add(new THREE.Mesh(T(wg), wallMat));

  // dial cord with two pulleys
  const cordMat = T(new THREE.MeshStandardMaterial({ color: 0x1b1714, roughness: 0.8 }));
  const cord = new THREE.Mesh(T(new THREE.CylinderGeometry(0.012, 0.012, 13.0, 6)), cordMat);
  cord.rotation.z = Math.PI / 2;
  cord.position.set(0, 1.0, Z_CORD);
  root.add(cord);
  const pulleyMat = T(new THREE.MeshStandardMaterial({ color: 0xb8a27a, roughness: 0.3, metalness: 0.9 }));
  const pulleyGeo = T(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 24));
  pulleyGeo.rotateX(Math.PI / 2);
  const hubGeo = T(new THREE.CylinderGeometry(0.035, 0.035, 0.07, 12));
  hubGeo.rotateX(Math.PI / 2);
  const hubMat = T(new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.4, metalness: 0.6 }));
  const pulleys = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(pulleyGeo, pulleyMat);
    p.position.set(s * 6.55, 0.9, Z_CORD - 0.02);
    root.add(p);
    const h = new THREE.Mesh(hubGeo, hubMat);
    h.position.copy(p.position); h.position.z += 0.01;
    root.add(h);
    pulleys.push(p);
  }

  // needle: lit orange blade on a dark carriage clipped to the cord
  const needle = new THREE.Group();
  needle.name = "needle";
  const needleCol = new THREE.Color(D.needle);
  const needleMat = T(new THREE.MeshBasicMaterial({ color: needleCol.clone() }));
  const blade = new THREE.Mesh(T(new THREE.BoxGeometry(0.06, 2.2, 0.03)), needleMat);
  blade.position.y = -0.1;
  needle.add(blade);
  const carriage = new THREE.Mesh(T(new THREE.BoxGeometry(0.2, 0.13, 0.07)), T(new THREE.MeshStandardMaterial({ color: 0x0f0d0c, roughness: 0.45, metalness: 0.2 })));
  carriage.position.set(0, 1.0, Z_CORD - Z_NEEDLE + 0.01);
  needle.add(carriage);
  // the lit blade glows into the diffuser behind it (additive, soft both sides)
  const gcv = makeCanvas(64, 256), gg = gcv.getContext("2d");
  const hg = gg.createLinearGradient(0, 0, 64, 0);
  hg.addColorStop(0, "rgba(255,255,255,0)"); hg.addColorStop(0.5, "rgba(255,255,255,1)"); hg.addColorStop(1, "rgba(255,255,255,0)");
  gg.fillStyle = hg; gg.fillRect(0, 0, 64, 256);
  gg.globalCompositeOperation = "destination-in";
  const vg = gg.createLinearGradient(0, 0, 0, 256);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(0.15, "rgba(0,0,0,1)"); vg.addColorStop(0.85, "rgba(0,0,0,1)"); vg.addColorStop(1, "rgba(0,0,0,0)");
  gg.fillStyle = vg; gg.fillRect(0, 0, 64, 256);
  const glowMat = T(new THREE.MeshBasicMaterial({ map: T(canvasTexture(THREE, gcv, 1)), color: needleCol.clone(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const glow = new THREE.Mesh(T(new THREE.PlaneGeometry(0.8, 2.3)), glowMat);
  glow.position.set(0, -0.1, Z_SCALE - Z_NEEDLE + 0.01);
  glow.renderOrder = 1;
  needle.add(glow);
  needle.position.z = Z_NEEDLE;
  root.add(needle);

  // TUNED lamp
  const tunedCol = new THREE.Color(D.tuned);
  const tunedMat = T(new THREE.MeshBasicMaterial({ color: tunedCol.clone().multiplyScalar(0.03) }));
  const tuned = new THREE.Mesh(T(new THREE.CircleGeometry(0.065, 24)), tunedMat);
  tuned.position.set(13.3 - W / 2, -0.17, Z_SCALE + 0.05);
  root.add(tuned);
  const ring = new THREE.Mesh(T(new THREE.RingGeometry(0.065, 0.095, 24)), T(new THREE.MeshBasicMaterial({ color: 0x15120f })));
  ring.position.copy(tuned.position); ring.position.z -= 0.005;
  root.add(ring);

  // ---- state
  const xLocal = (cmFromLeft) => cmFromLeft - W / 2;
  const LEFT_STOP = xLocal(SX0 - 0.35);
  let prog = null, pending = null, hasPending = false, phase = 0, reduce = false, prevIndex = -2;
  // doubles in object fields: writes never box
  const st = { fade: 1, level: 0, nx: LEFT_STOP, nv: 0, acc: 0, tunedLevel: 0, dropT: 0, act: 0 };
  needle.position.x = st.nx;

  function textureFor(p) {
    if (!p) return emptyTex;
    const key = p.id + ":" + p.side + (compact ? ":c" : "");
    let t = cache.get(key);
    if (t) { cache.delete(key); cache.set(key, t); return t; }
    t = canvasTexture(THREE, drawScale(D, font, p, D.dialInk, compact), env.maxAniso);
    cache.set(key, t);
    while (cache.size > 4) {
      const k = cache.keys().next().value;
      const old = cache.get(k);
      cache.delete(k);
      if (old !== u.uMap.value) old.dispose();
    }
    return t;
  }

  function setProgram(p) {
    const same = p && prog && p.id === prog.id && p.side === prog.side && p.total === prog.total;
    if (same) { prog = p; return; }
    if (reduce || (!prog && st.level < 0.02)) {
      prog = p; u.uMap.value = textureFor(p); phase = 0; st.fade = 1;
    } else {
      pending = p; hasPending = true; phase = 1;
    }
  }

  function step(f, warm, dt) {
    let dirty = false;
    // band change: dim to 10 % in 200 ms, swap, warm back in 400 ms
    if (phase === 1) {
      st.fade = Math.max(0.1, st.fade - (0.9 / 0.2) * dt);
      if (st.fade <= 0.1) {
        if (hasPending) { prog = pending; pending = null; hasPending = false; u.uMap.value = textureFor(prog); }
        phase = 2;
      }
      dirty = true;
    } else if (phase === 2) {
      st.fade = Math.min(1, st.fade + (0.9 / 0.4) * dt);
      if (st.fade >= 1) phase = 0;
      dirty = true;
    }
    const base = prog ? D.dialLampOn : D.dialLampEmpty * D.dialLampOn;
    const prevLevel = st.level;
    st.level = base * st.fade * warm;
    u.uLevel.value = st.level;
    if (st.level !== prevLevel) dirty = true;
    const lit = st.level / D.dialLampOn;
    needleMat.color.copy(needleCol).multiplyScalar(D.needleLit * (0.12 + 0.88 * Math.min(1, lit)));
    glowMat.color.copy(needleCol).multiplyScalar(0.5 * Math.min(1, lit));

    // needle on its cord spring (wn 18, zeta 0.85)
    const total = prog ? prog.total : 0;
    const target = prog && total > 0 ? xLocal(SX0 + (SX1 - SX0) * Math.min(1, Math.max(0, f.seconds / total))) : LEFT_STOP;
    const wn = 18, z = reduce ? 1 : 0.85;
    const px = st.nx;
    st.acc += dt;
    if (st.acc > 0.25) st.acc = 0.25;
    while (st.acc >= STEP) {
      st.acc -= STEP;
      const a = wn * wn * (target - st.nx) - 2 * z * wn * st.nv;
      st.nv += a * STEP;
      st.nx += st.nv * STEP;
    }
    if (Math.abs(target - st.nx) < 1e-4 && Math.abs(st.nv) < 1e-3) { st.nx = target; st.nv = 0; }
    if (st.nx !== px) {
      needle.position.x = st.nx;
      pulleys[0].rotation.z = -st.nx / 0.12; pulleys[1].rotation.z = -st.nx / 0.12;
      dirty = true;
    }

    // TUNED: steady in play, drops out 250 ms on every track change
    const idx = f.trackIndex;
    if (idx !== prevIndex) { if (prevIndex >= 0 && idx >= 0 && !reduce) st.dropT = 0.25; prevIndex = idx; }
    if (st.dropT > 0) { st.dropT -= dt; dirty = true; }
    const tl = f.loaded && f.mode === "play" && st.dropT <= 0 ? warm : 0;
    if (tl !== st.tunedLevel) {
      st.tunedLevel = tl;
      tunedMat.color.copy(tunedCol).multiplyScalar(0.03 + 2.2 * tl);
      dirty = true;
    }
    st.act += (lit - st.act) * Math.min(1, dt * 6);
    return dirty;
  }

  return {
    object: root, step, setProgram,
    setReduce(v) { reduce = v; },
    // phone layout on / off: swap to the matching scale (cached like any other)
    setCompact(v) {
      v = !!v;
      if (v === compact) return false;
      compact = v;
      if (prog && phase === 0) u.uMap.value = textureFor(prog);
      return true;
    },
    get activity() { return st.act; },
    get needleX() { return st.nx; },
    dispose() { for (const t of cache.values()) t.dispose(); cache.clear(); },
  };
}
