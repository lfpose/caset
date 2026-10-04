// Red 7-segment LED readout (led), after the Lloyd's clock: [S][T] - [m]:[s][s].
// Hexagon-SDF segments slanted 8 degrees, glyph bitmasks as uniforms (no textures), ghost
// segments behind a dark red filter, soft diffusion halo. Side and track sit apart from the
// time behind a dim dash, so "A1 - 0:00" never reads as ten o'clock; the colon is steady.
import { FRAG_TAIL } from "./util.js";

const W = 4.4, H = 1.5;
// cell centres (cm, aperture centre origin): S, T, dash, m, colon, s, s
const CX = [-1.76, -1.14, -0.54, 0.14, 1.02, 1.64];
const COLON_X = 0.58;
const GS = 0.9;   // glyph scale
const NC = CX.length;

// segment bits: a=1 b=2 c=4 d=8 e=16 f=32 g=64
export const GLYPH = {
  " ": 0, "-": 64,
  0: 63, 1: 6, 2: 91, 3: 79, 4: 102, 5: 109, 6: 125, 7: 7, 8: 127, 9: 111,
  A: 119, b: 124,
};
const DIGITS = [63, 6, 91, 79, 102, 109, 125, 7, 127, 111];

const FRAG = `
  uniform float uMask[${NC}];
  uniform float uBright[${NC}];
  uniform float uColon;
  uniform vec3 uLed, uFilter;
  uniform float uLit, uGhost;
  varying vec2 vUv;
  float bit(float m, float k){ return mod(floor(m / exp2(k)), 2.0); }
  // elongated hexagon: horizontal (h = 1) or vertical (h = 0) segment centred at the origin
  float seg(vec2 p, float L, float t, float h){
    vec2 q = h > 0.5 ? abs(p) : abs(p.yx);
    return max(q.y - t, q.x + q.y - L);
  }
  void main(){
    vec2 p = (vUv - 0.5) * vec2(${W.toFixed(2)}, ${H.toFixed(2)});
    p.x -= p.y * 0.14054; // 8 degree slant
    float px = max(length(vec2(dFdx(p.x), dFdy(p.x))), 1e-5);
    float lit = 0.0, ghost = 0.0, halo = 0.0, along = 0.0;
    float pxs = px / ${GS.toFixed(2)};
    for (int c = 0; c < ${NC}; c++) {
      float cx = ${CX[0].toFixed(2)};
      ${CX.slice(1).map((x, k) => `if (c == ${k + 1}) cx = ${x.toFixed(2)};`).join("\n      ")}
      vec2 q = (p - vec2(cx, 0.0)) / ${GS.toFixed(2)};
      if (abs(q.x) > 0.5) continue;
      float m = uMask[c], br = uBright[c];
      for (int k = 0; k < 7; k++) {
        vec2 o; float h; float L;
        if (k == 0) { o = vec2(0.0, 0.45); h = 1.0; L = 0.245; }
        else if (k == 1) { o = vec2(0.27, 0.225); h = 0.0; L = 0.205; }
        else if (k == 2) { o = vec2(0.27, -0.225); h = 0.0; L = 0.205; }
        else if (k == 3) { o = vec2(0.0, -0.45); h = 1.0; L = 0.245; }
        else if (k == 4) { o = vec2(-0.27, -0.225); h = 0.0; L = 0.205; }
        else if (k == 5) { o = vec2(-0.27, 0.225); h = 0.0; L = 0.205; }
        else { o = vec2(0.0, 0.0); h = 1.0; L = 0.245; }
        vec2 r = q - o;
        float d = seg(r, L, 0.058, h);
        float cov = 1.0 - smoothstep(-0.5 * pxs, 0.5 * pxs, d);
        float on = bit(m, float(k)) * br;
        // LED dice are brightest at the middle of each bar
        float a = (h > 0.5 ? abs(r.x) : abs(r.y)) / L;
        lit += cov * on * (1.05 - 0.22 * a * a);
        ghost += cov * (1.0 - min(on, 1.0));
        halo += on * exp(-max(d, 0.0) / 0.045) * (1.0 - cov);
      }
    }
    // colon: two small rounded squares
    vec2 cp = vec2(p.x - ${COLON_X.toFixed(2)}, abs(p.y) - 0.21);
    vec2 cq = abs(cp) - vec2(0.035);
    float cd = length(max(cq, 0.0)) + min(max(cq.x, cq.y), 0.0) - 0.02;
    float ccov = 1.0 - smoothstep(-0.5 * px, 0.5 * px, cd);
    lit += ccov * uColon;
    ghost += ccov * (1.0 - min(uColon, 1.0));
    halo += uColon * exp(-max(cd, 0.0) / 0.045) * (1.0 - ccov);
    vec3 col = uFilter + uLed * (uLit * lit + uGhost * ghost + 0.16 * uLit * halo * 0.25);
    gl_FragColor = vec4(col, 1.0);
    ${FRAG_TAIL}
  }
`;

export function buildLED(env) {
  const { THREE, D } = env;
  const T = (x) => env.track(x);
  const root = new THREE.Group();
  root.name = "led";
  const u = {
    uMask: { value: new Array(NC).fill(0) },
    uBright: { value: new Array(NC).fill(0) },
    uColon: { value: 0 },
    uLed: { value: new THREE.Color(D.led) },
    uFilter: { value: new THREE.Color(D.ledFilter).multiplyScalar(0.12) },
    uLit: { value: D.ledLit },
    uGhost: { value: D.ledGhost },
  };
  const mat = T(new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: FRAG,
  }));
  mat.name = "led";
  const plane = new THREE.Mesh(T(new THREE.PlaneGeometry(W, H)), mat);
  plane.position.z = -0.25;
  root.add(plane);
  // dark red filter walls
  const wall = T(new THREE.MeshStandardMaterial({ color: 0x0a0303, roughness: 0.6, side: THREE.DoubleSide }));
  const geo = new THREE.BufferGeometry();
  const x = W / 2, y = H / 2, d = 0.25, P = [];
  const quad = (ax, ay, bx, by) => { const v = [[ax, ay, 0], [bx, by, 0], [bx, by, -d], [ax, ay, -d]]; for (const i of [0, 1, 2, 0, 2, 3]) P.push(...v[i]); };
  quad(-x, -y, x, -y); quad(x, -y, x, y); quad(x, y, -x, y); quad(-x, y, -x, -y);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  geo.computeVertexNormals();
  root.add(new THREE.Mesh(T(geo), wall));

  // what is shown; uniforms change only when this key changes
  let kSide = -2, kTrack = -2, kSec = -2, kMode = "", kLoaded = null, kColon = -1, kOn = -1;
  let reduce = false;
  const st = { on: 0, act: 0 };   // doubles in object fields: writes never box
  const mask = u.uMask.value, bright = u.uBright.value;

  function set(i, m, b) { mask[i] = m; bright[i] = b; }

  // f: frame summary. Returns dirty.
  function step(f, warm, dt) {
    const loaded = f.loaded;
    const winding = loaded && (f.mode === "rewind" || f.mode === "forward");
    let secs = 0, idx = -1;
    if (loaded && f.program) {
      if (winding) secs = Math.max(0, Math.floor(f.seconds));
      else {
        idx = f.trackIndex;
        const off = idx >= 0 && idx < f.program.offsets.length ? f.program.offsets[idx] : 0;
        secs = Math.max(0, Math.floor(f.seconds - off));
      }
    }
    const sideK = !loaded ? -1 : f.side === "B" ? 1 : 0;
    const colon = 1;
    const target = warm;
    const prevOn = st.on;
    st.on = target;
    let changed = st.on !== prevOn;
    if (sideK !== kSide || idx !== kTrack || secs !== kSec || f.mode !== kMode || loaded !== kLoaded || colon !== kColon || st.on !== kOn) {
      kSide = sideK; kTrack = idx; kSec = secs; kMode = f.mode; kLoaded = loaded; kColon = colon; kOn = st.on;
      changed = true;
      if (!loaded) {
        for (let i = 0; i < NC; i++) set(i, i === 2 ? 0 : 64, 0.3 * st.on);
        u.uColon.value = 0.3 * st.on;
      } else {
        const m = Math.min(9, Math.floor(secs / 60)), s = secs % 60;
        set(0, sideK === 1 ? GLYPH.b : GLYPH.A, st.on);
        if (winding) { set(1, 0, 0); set(2, 0, 0); }
        else { set(1, DIGITS[(idx + 1) % 10], st.on); set(2, GLYPH["-"], 0.45 * st.on); }
        set(3, DIGITS[m], st.on);
        set(4, DIGITS[Math.floor(s / 10)], st.on);
        set(5, DIGITS[s % 10], st.on);
        u.uColon.value = colon * st.on;
      }
    }
    const a = loaded ? 1 : 0.3;
    st.act += (a * st.on - st.act) * Math.min(1, dt * 6);
    return changed;
  }

  return {
    object: root, step,
    setReduce(v) { reduce = v; kColon = -1; },
    get activity() { return st.act; },
    get shown() { return mask; },
  };
}
