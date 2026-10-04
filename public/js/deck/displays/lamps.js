// Pilot lamps (lamps): a black strip with printed captions, left to right:
// play (a round red-orange pilot dome), the "Cue & Review" legend window of the M206 / M226
// (a pale diffuser with the legend printed on it: dim when idle, backlit amber while winding),
// rec (a dark red slot lamp, never lit: this deck only plays). Lamps ramp like small bulbs
// and spill onto the strip.
import { makeCanvas, fontFor, canvasTexture, tunnelGeometry, rrect, FRAG_TAIL } from "./util.js";

const W = 7.8, H = 0.7;
const PLAY_X = -3.4, CUE_X = -0.45, CUE_W = 2.6, CUE_H = 0.48, REC_X = 2.3;
const CAP = 0.19;                     // caption cap height, cm

function lensMap() {
  // a lit dome: bright core, a filament glint, darker rim (used as emissiveMap)
  const c = makeCanvas(64, 64), g = c.getContext("2d");
  const rg = g.createRadialGradient(30, 28, 1, 32, 32, 34);
  rg.addColorStop(0, "#ffffff"); rg.addColorStop(0.5, "#cfcfcf"); rg.addColorStop(1, "#505050");
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  g.fillStyle = "rgba(255,255,255,0.8)"; g.fillRect(24, 30, 16, 3);
  return c;
}

function spillMap() {
  const c = makeCanvas(128, 64), g = c.getContext("2d");
  const rg = g.createRadialGradient(64, 32, 0, 64, 32, 64);
  rg.addColorStop(0, "rgba(255,255,255,0.55)"); rg.addColorStop(0.35, "rgba(255,255,255,0.16)"); rg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = rg; g.fillRect(0, 0, 128, 64);
  return c;
}

// the legend window: R = diffuser coverage (rounded rect), G = printed legend
function cueMask(font) {
  const S = 1024 / CUE_W, c = makeCanvas(1024, Math.round(CUE_H * S)), g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#ff0000";
  rrect(g, 0.03 * S, 0.03 * S, c.width - 0.06 * S, c.height - 0.06 * S, 0.05 * S); g.fill();
  g.globalCompositeOperation = "lighter";
  g.fillStyle = "#00ff00";
  g.font = fontFor(0.2 * S, font.panel, 500);
  g.textAlign = "center"; g.textBaseline = "middle";
  if ("letterSpacing" in g) g.letterSpacing = `${(0.02 * S).toFixed(1)}px`;
  g.fillText("Cue & Review", c.width / 2, c.height / 2 + 0.01 * S);
  g.globalCompositeOperation = "source-over";
  return c;
}

export function buildLamps(env) {
  const { THREE, D, font, ink } = env;
  const T = (x) => env.track(x);
  const root = new THREE.Group();
  root.name = "lamps";

  // strip with printed captions
  const S = 2048 / W, c = makeCanvas(2048, Math.round(H * S)), g = c.getContext("2d");
  g.fillStyle = "#0b0a0a"; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = ink.onBlack;
  g.font = fontFor(CAP * S, font.panel, 500);
  g.textBaseline = "middle"; g.textAlign = "left";
  g.fillText("play", (PLAY_X + 0.32 + W / 2) * S, (H / 2) * S + 0.01 * S);
  g.fillText("rec", (REC_X + 0.24 + W / 2) * S, (H / 2) * S + 0.01 * S);
  // a fine frame line around the legend window, as printed on the M226
  g.strokeStyle = ink.onBlackDim; g.lineWidth = 0.012 * S;
  rrect(g, (CUE_X - CUE_W / 2 - 0.06 + W / 2) * S, (H / 2 - CUE_H / 2 - 0.06) * S, (CUE_W + 0.12) * S, (CUE_H + 0.12) * S, 0.06 * S);
  g.stroke();
  const stripTex = T(canvasTexture(THREE, c, env.maxAniso));
  const strip = new THREE.Mesh(T(new THREE.PlaneGeometry(W, H)), T(new THREE.MeshStandardMaterial({ map: stripTex, roughness: 0.72, metalness: 0 })));
  strip.position.z = -0.45;
  root.add(strip);
  // side walls so the recess never shows a gap at an angle
  root.add(new THREE.Mesh(T(tunnelGeometry(THREE, W - 0.002, H - 0.002, 0.45)),
    T(new THREE.MeshStandardMaterial({ color: 0x080707, roughness: 0.8, side: THREE.DoubleSide }))));

  const spill = T(canvasTexture(THREE, spillMap(), 1));
  const lamps = {};
  function addSpill(x, w, col) {
    const sp = new THREE.Mesh(T(new THREE.PlaneGeometry(w, 0.68)),
      T(new THREE.MeshBasicMaterial({ map: spill, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })));
    sp.position.set(x, 0, -0.435);
    sp.renderOrder = 1;
    root.add(sp);
    return sp;
  }

  // ---- play: a round pilot dome with a lens highlight, in a dark metal bezel
  {
    const col = new THREE.Color(D.lampPlay);
    const geo = T(new THREE.SphereGeometry(0.15, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2));
    geo.rotateX(Math.PI / 2);
    geo.scale(1, 1, 0.7);
    const mat = T(new THREE.MeshStandardMaterial({
      color: col.clone().multiplyScalar(0.16), emissive: col, emissiveIntensity: D.lampOff,
      emissiveMap: T(canvasTexture(THREE, lensMap(), env.maxAniso)), roughness: 0.18, metalness: 0,
    }));
    const m = new THREE.Mesh(geo, mat);
    m.position.set(PLAY_X, 0, -0.42);
    root.add(m);
    const bezel = new THREE.Mesh(T(new THREE.RingGeometry(0.15, 0.2, 32)),
      T(new THREE.MeshStandardMaterial({ color: 0x3a3836, roughness: 0.3, metalness: 0.9 })));
    bezel.position.set(PLAY_X, 0, -0.43);
    root.add(bezel);
    lamps.play = { set(l) { mat.emissiveIntensity = D.lampOff + l; }, sp: addSpill(PLAY_X, 1.0, col), level: 0 };
  }

  // ---- Cue & Review: a backlit legend window
  {
    const lamp = new THREE.Color(D.cueLamp || D.lampCue);
    const u = {
      uMap: { value: T(canvasTexture(THREE, cueMask(font), env.maxAniso, false)) },
      uGround: { value: new THREE.Color(D.cueWindow || "#e9f1ee") },
      uLamp: { value: lamp },
      uIdle: { value: D.cueIdle != null ? D.cueIdle : 0.16 },
      uLevel: { value: 0 },
    };
    const mat = T(new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform sampler2D uMap; uniform vec3 uGround, uLamp; uniform float uIdle, uLevel; varying vec2 vUv;
        void main(){
          vec4 m = texture2D(uMap, vUv);
          // one small bulb behind the middle: brighter in the centre of the diffuser
          float x = (vUv.x - 0.5) * 2.0;
          float hot = 0.78 + 0.32 * exp(-x * x * 2.2);
          vec3 lit = uGround * uIdle + uLamp * uLevel * hot;
          vec3 inkc = vec3(0.010, 0.009, 0.008) + lit * 0.05;
          vec3 col = mix(vec3(0.004), mix(lit, inkc, m.g), m.r);
          gl_FragColor = vec4(col, 1.0);
          ${FRAG_TAIL}
        }`,
    }));
    mat.name = "cue";
    const m = new THREE.Mesh(T(new THREE.PlaneGeometry(CUE_W, CUE_H)), mat);
    m.position.set(CUE_X, 0, -0.4);
    root.add(m);
    lamps.cue = { set(l) { u.uLevel.value = l; }, sp: addSpill(CUE_X, CUE_W + 0.8, lamp), level: 0 };
  }

  // ---- rec: a narrow dark red slot lamp, never lit
  {
    const mat = T(new THREE.MeshStandardMaterial({ color: 0x3a0705, emissive: new THREE.Color("#5a0d08"), emissiveIntensity: D.lampOff, roughness: 0.25 }));
    const m = new THREE.Mesh(T(new THREE.BoxGeometry(0.12, 0.38, 0.06)), mat);
    m.position.set(REC_X, 0, -0.42);
    root.add(m);
    const collar = new THREE.Mesh(T(new THREE.PlaneGeometry(0.22, 0.48)), T(new THREE.MeshStandardMaterial({ color: 0x020202, roughness: 0.85 })));
    collar.position.set(REC_X, 0, -0.44);
    root.add(collar);
  }

  let reduce = false;
  const st = { act: 0 };

  function drive(l, target, dt) {
    const prev = l.level;
    if (reduce) l.level = target;
    else {
      // small incandescent bulb: ~70 ms up, ~150 ms down
      const k = target > l.level ? 1 - Math.exp(-dt / 0.035) : 1 - Math.exp(-dt / 0.07);
      l.level += (target - l.level) * k;
      if (Math.abs(target - l.level) < 1e-3) l.level = target;
    }
    l.set(l.level);
    l.sp.material.opacity = Math.min(1, l.level / D.lampOn) * 0.5;
    return l.level !== prev;
  }

  function step(f, warm, dt) {
    const loaded = f.loaded, winding = loaded && (f.mode === "rewind" || f.mode === "forward");
    const play = loaded && f.mode === "play" ? D.lampOn : winding ? 1.2 : 0;
    const cue = winding ? (D.cueOn != null ? D.cueOn : D.lampOn) : 0;
    let d = drive(lamps.play, play * warm, dt);
    d = drive(lamps.cue, cue * warm, dt) || d;
    st.act = Math.min(1, (lamps.play.level + lamps.cue.level) / D.lampOn);
    return d;
  }

  return {
    object: root, step,
    setReduce(v) { reduce = v; },
    get activity() { return st.act; },
  };
}
