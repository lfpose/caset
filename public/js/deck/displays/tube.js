// Fluorescent tubes: the peak meter (vfd, the hero) and the function indicator (modes).
// One shader family: procedural segments (rounded-box SDF), a legend mask canvas, ghost glow on
// every unlit element, a hexagonal grid mesh, three filament wires, filter glass, per-segment
// unevenness and a per-frame flicker. Ballistics on the CPU: instant attack, 13.3 dB/s release,
// a 60 dB/s phosphor tail and a 1.4 s peak hold.
import { makeCanvas, fontFor, canvasTexture, FRAG_TAIL, rrect, fitText } from "./util.js";

export const THRESH = [-30, -27, -24, -22, -20, -18, -16, -15, -14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1.5, -1, -0.5, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const NSEG = 34, X0 = 1.5, PITCH = 0.32;
// each logical segment is drawn as two hairline bars, as on the Technics tubes: 68 bars a row
const SUBP = PITCH / 2, BARW = 0.05, BARH = 0.15, ROWY = 0.36, RAILY = 0.17;
const CUT = -30.5, OFF = -99;
const segX = (i) => X0 + (i + 0.5) * PITCH;              // logical segment centre, cm from the left edge

// dB -> fractional segment index: floor(n) segments are lit (segment i lit when i + 1 <= n).
export function dbToSeg(db) {
  if (!(db >= THRESH[0])) return db > -60 ? (db - THRESH[0]) / 3 : -10;
  for (let k = 0; k < NSEG - 1; k++) {
    if (db < THRESH[k + 1]) return k + 1 + (db - THRESH[k]) / (THRESH[k + 1] - THRESH[k]);
  }
  return NSEG + Math.min(1, (db - THRESH[NSEG - 1]) / 3);
}

const SHADER_COMMON = `
  uniform sampler2D uMask;
  uniform vec2 uSize;
  uniform float uOn, uFlick, uLitW, uLitA, uLegendLevel, uHalo;
  uniform vec3 uWhite, uAmber, uAmberHot, uGhost, uFilter, uPrint, uFil;
  varying vec2 vUv;
  float hash1(float n){ return fract(sin(n * 91.345 + 7.13) * 43758.5453); }
  float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
  // hexagonal control grid: returns wire coverage (1 on a wire), faded out when a cell is ~1 px
  float hexWire(vec2 p, float s, out float fade){
    vec2 q = p / s;
    const vec2 r = vec2(1.0, 1.7320508);
    vec2 h = r * 0.5;
    vec2 a = mod(q, r) - h;
    vec2 b = mod(q - h, r) - h;
    vec2 g = dot(a, a) < dot(b, b) ? a : b;
    vec2 k = abs(g);
    float e = 0.5 - max(dot(k, vec2(0.5, 0.8660254)), k.x);
    float fw = max(fwidth(e), 1e-4);
    fade = clamp(1.6 - 1.4 * fwidth(q.x) * 2.0, 0.0, 1.0);
    return 1.0 - smoothstep(0.045 - fw, 0.045 + fw, e);
  }
  float filament(vec2 p, float w){
    float pw = max(fwidth(p.y), 1e-5), f = 0.0;
    for (int k = 0; k < 3; k++) {
      float u = p.x / w * 2.0 - 1.0;
      float yf = (float(k) - 1.0) * 0.56 + 0.014 * (1.0 - u * u) - 0.01;
      float dy = abs(p.y - yf);
      f = max(f, clamp((0.003 + 0.5 * pw - dy) / pw, 0.0, 1.0) * min(1.0, 0.006 / pw));
    }
    return f;
  }
  vec3 finish(vec2 p, vec3 phos, float litCov, float cov, vec4 mk){
    // grid over the phosphor
    float fade; float wire = hexWire(p + vec2(0.013, 0.0), 0.05, fade);
    float grid = mix(0.84, 1.0 - 0.8 * wire, fade);
    phos *= grid;
    // filaments: dark over lit phosphor, a faint orange glow over the dark
    float fl = filament(p, uSize.x);
    phos *= 1.0 - 0.35 * fl * litCov;
    vec3 col = phos * uFlick;
    col += uFil * fl * (1.0 - litCov);
    // filter glass + printed scale ink (lit by the room through the smoked bar)
    float edge = min(p.x, uSize.x - p.x);
    col += uFilter * (0.7 + 0.3 * smoothstep(0.0, 0.8, edge)) * (1.0 - cov);
    col += uPrint * mk.b;
    return col;
  }
`;

const METER_FRAG = `
  uniform float uL, uR, uTailL, uTailR, uHoldL, uHoldR, uBoot;
  ${SHADER_COMMON}
  // logical level (fractional segments) per row: bar, phosphor tail, peak hold
  float lvOf(bool top){ return top ? uL : uR; }
  // bar j (0..67) lights when the level passes half a logical segment, so the bar grows smoothly
  float barB(float j, bool top){
    float lv = top ? uL : uR, tl = top ? uTailL : uTailR, hd = top ? uHoldL : uHoldR;
    float need = (j + 1.0) * 0.5;
    float b = step(need, lv);
    b = max(b, 0.35 * step(need, tl));
    b = max(b, (hd >= 1.0 && abs(floor(j * 0.5) - (floor(hd) - 1.0)) < 0.5) ? 1.0 : 0.0);
    return max(b, uBoot);
  }
  vec3 segC(float i){
    return mix(uWhite * uLitW, mix(uAmber, uAmberHot, clamp((i - 24.0) / 9.0, 0.0, 1.0)) * uLitA, step(23.5, i));
  }
  float barD(vec2 p, float j, float ry){
    float cx = ${X0.toFixed(4)} + (j + 0.5) * ${SUBP.toFixed(4)};
    return sdBox(vec2(p.x - cx, ry), vec2(${(BARW / 2).toFixed(4)}, ${BARH.toFixed(4)}), 0.012);
  }
  // the thin segmented rail between each bar row and the legends: lit up to the level only
  // (unlit it shows the ghost grey-blue, as on the Technics tube), so lit length = level
  float railD(vec2 p, float i, float rr){
    float cx = ${X0.toFixed(4)} + (i + 0.5) * ${PITCH.toFixed(4)};
    return sdBox(vec2(p.x - cx, rr), vec2(${(PITCH / 2 - 0.016).toFixed(4)}, 0.016), 0.006);
  }
  void main(){
    vec2 p = vec2(vUv.x * uSize.x, (vUv.y - 0.5) * uSize.y);
    // a negative LOD bias keeps the small legend numerals crisp at a distance
    vec4 mk = texture2D(uMask, vUv, -0.6);
    float px = max(length(vec2(dFdx(p.x), dFdy(p.x))), 1e-5);
    bool top = p.y > 0.0;
    float ry = top ? p.y - ${ROWY.toFixed(3)} : p.y + ${ROWY.toFixed(3)};
    float rr = top ? p.y - ${RAILY.toFixed(3)} : p.y + ${RAILY.toFixed(3)};
    float fj = floor((p.x - ${X0.toFixed(4)}) / ${SUBP.toFixed(4)});
    float j = clamp(fj, 0.0, ${(2 * NSEG - 1).toFixed(1)});
    float i = floor(j * 0.5);
    float d = barD(p, j, ry);
    float m = 1.0 - smoothstep(-0.5 * px, 0.5 * px, d);
    float b = barB(j, top);
    vec3 c = segC(i);
    float uneven = 1.0 + 0.1 * (hash1(j + (top ? 0.0 : 80.0)) - 0.5) + 0.05 * (0.5 - p.x / uSize.x);
    vec3 phos = c * b * m * uneven;
    float litCov = m * min(b, 1.0);
    // rail
    float ri = clamp(floor((p.x - ${X0.toFixed(4)}) / ${PITCH.toFixed(4)}), 0.0, ${(NSEG - 1).toFixed(1)});
    float rd = railD(p, ri, rr);
    float rm = 1.0 - smoothstep(-0.5 * px, 0.5 * px, rd);
    float rb = max(step(ri + 1.0, lvOf(top)), uBoot);
    phos += segC(ri) * rb * rm * 0.85;
    litCov = max(litCov, rm * min(rb, 1.0));
    // legend row: lit numerals and the PEAK legend between the bar rows
    float lm = mk.r;
    vec3 lc = mix(uWhite, uAmber, mk.g) * uLegendLevel * uOn;
    phos += lc * lm;
    litCov = max(litCov, lm * uOn);
    float cov = max(max(m, rm), lm);
    // ghosts on everything unlit
    phos += uGhost * cov * (1.0 - min(1.0, litCov));
    vec3 col = finish(p, phos, litCov, cov, mk);
    // phosphor glow bleeding into the filter glass, from the nearest bars and the rail
    vec3 halo = vec3(0.0);
    for (int k = -2; k <= 2; k++) {
      float jj = fj + float(k);
      if (jj < 0.0 || jj > ${(2 * NSEG - 1).toFixed(1)}) continue;
      float dj = barD(p, jj, ry);
      halo += segC(floor(jj * 0.5)) * barB(jj, top) * exp(-max(dj, 0.0) / 0.035);
    }
    halo += segC(ri) * rb * 0.5 * exp(-max(rd, 0.0) / 0.025);
    col += halo * uHalo * (1.0 - max(m, rm)) * uFlick;
    gl_FragColor = vec4(col, 1.0);
    ${FRAG_TAIL}
  }
`;

const MODES_FRAG = `
  uniform vec4 uRects[10];
  uniform float uLegend[10];
  ${SHADER_COMMON}
  void main(){
    vec2 p = vec2(vUv.x * uSize.x, (vUv.y - 0.5) * uSize.y);
    vec4 mk = texture2D(uMask, vUv, -0.6);
    float L = 0.0, A = 0.0;
    for (int k = 0; k < 10; k++) {
      vec4 r = uRects[k];
      float ins = step(r.x, p.x) * step(p.x, r.z) * step(r.y, p.y) * step(p.y, r.w);
      L = max(L, ins * uLegend[k]);
      // the last two (NO SIGNAL, END) are amber: they say something is wrong or over
      A = max(A, ins * step(7.5, float(k)));
    }
    float lm = mk.r;
    vec3 c = mix(uWhite * uLitW, uAmber * uLitA, A) * 0.8;
    vec3 phos = c * L * lm;
    float litCov = lm * min(1.0, L);
    phos += uGhost * 0.55 * lm * (1.0 - min(1.0, L));
    vec3 col = finish(p, phos, litCov, lm, mk);
    gl_FragColor = vec4(col, 1.0);
    ${FRAG_TAIL}
  }
`;

function commonUniforms(THREE, D, ink, w, h, mask) {
  const ghost = new THREE.Color(D.vfdGhost);
  const gm = Math.max(ghost.r, ghost.g, ghost.b, 1e-4);
  ghost.multiplyScalar(0.03 / gm * (D.vfdGhostLevel / 0.04));
  const filter = new THREE.Color(D.vfdFilter).multiplyScalar(0.6);
  const print = new THREE.Color(ink.onBlack).multiplyScalar(D.vfdPrint ?? 0.75);
  const fil = new THREE.Color("#ff8a3a").multiplyScalar(0.045);
  return {
    uMask: { value: mask },
    uSize: { value: new THREE.Vector2(w, h) },
    uOn: { value: 0 },
    uFlick: { value: 1 },
    uLitW: { value: D.vfdLit },
    uLitA: { value: D.vfdLitAmber },
    uLegendLevel: { value: D.vfdLegend },
    uHalo: { value: D.vfdHalo ?? 0.07 },
    uWhite: { value: new THREE.Color(D.vfdWhite) },
    uAmber: { value: new THREE.Color(D.vfdAmber) },
    uAmberHot: { value: new THREE.Color(D.vfdAmberHot) },
    uGhost: { value: ghost },
    uFilter: { value: filter },
    uPrint: { value: print },
    uFil: { value: fil },
  };
}

// ---------- peak meter mask (4096 x 490, ~288 px/cm): R = legend phosphor, G = amber, B = print
// One dB scale for every row, as on the Technics tube: the values are lit in the middle row
// (white up to 0, amber above) under ticks printed above and below the bars at the same
// segments; PEAK is an amber reversed box in the middle row; the - / + signs sit beside 0.
export const SCALE = [[0, "30"], [4, "20"], [12, "10"], [16, "6"], [19, "3"], [24, "0"], [27, "3"], [30, "6"], [33, "9"]];
function drawMeterMask(font, W, H) {
  const S = 4096 / W, c = makeCanvas(4096, Math.round(H * S)), g = c.getContext("2d");
  const X = (x) => x * S, Y = (y) => (H / 2 - y) * S;
  g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height);
  // lit numerals under their segments
  g.textAlign = "center"; g.textBaseline = "middle";
  g.font = fontFor(0.2 * S, font.numeric, 700);
  for (const [i, t] of SCALE) {
    g.fillStyle = i >= 24 ? "#ffff00" : "#ff0000";
    fitText(g, t, X(segX(i)), Y(0) + 0.012 * S, 0.34 * S, "center");
  }
  g.font = fontFor(0.13 * S, font.panel, 700);
  g.fillStyle = "#ff0000"; g.fillText("−", X(segX(22.6)), Y(0) + 0.01 * S);
  g.fillStyle = "#ffff00"; g.fillText("+", X(segX(25.5)), Y(0) + 0.01 * S);
  // PEAK: an amber box with the word knocked out, between 20 and 10
  {
    const x0 = segX(5.4), x1 = segX(10.6), h = 0.27;
    g.fillStyle = "#ffff00";
    rrect(g, X(x0), Y(h / 2), (x1 - x0) * S, h * S, 0.03 * S); g.fill();
    g.fillStyle = "#000";
    g.font = fontFor(0.15 * S, font.panel, 700);
    fitText(g, "PEAK", X((x0 + x1) / 2), Y(0) + 0.01 * S, (x1 - x0 - 0.16) * S, "center");
  }
  // printed ticks (top and bottom, the same segments), warm grey on the filter, into B
  g.globalCompositeOperation = "lighter";
  g.fillStyle = "#0000ff";
  for (const [i] of SCALE) {
    const x = X(segX(i)), wide = i === 24 ? 0.026 : 0.016;
    g.fillRect(x - (wide / 2) * S, Y(0.66), wide * S, 0.1 * S);
    g.fillRect(x - (wide / 2) * S, Y(-0.56), wide * S, 0.1 * S);
  }
  // a hairline along each printed tick row, from 30 to 9
  g.fillRect(X(segX(0)), Y(0.565), (segX(33) - segX(0)) * S, 0.008 * S);
  g.fillRect(X(segX(0)), Y(-0.565), (segX(33) - segX(0)) * S, 0.008 * S);
  g.textAlign = "center"; g.textBaseline = "alphabetic";
  g.font = fontFor(0.19 * S, font.panel, 600);
  g.fillText("L", X(0.85), Y(0.36) + 0.095 * S);
  g.fillText("R", X(0.85), Y(-0.36) + 0.095 * S);
  g.font = fontFor(0.15 * S, font.panel, 600);
  g.fillText("dB", X(13.25), Y(0) + 0.075 * S);
  g.font = fontFor(0.11 * S, font.panel, 600);
  g.fillText("PEAK HOLD", X(13.25), Y(0.36) + 0.05 * S);
  g.globalCompositeOperation = "source-over";
  return c;
}

// ---------- function tube legends (1024 x 223, ~131 px/cm)
// rects in cm: x from the left edge, y from the centre
const MODE_LEGENDS = [
  { key: "rev", text: "REV", x0: 0.30, x1: 2.30, y0: 0.20, y1: 0.68, arrows: -2 },
  { key: "play", text: "PLAY", x0: 2.85, x1: 4.95, y0: 0.20, y1: 0.68, arrows: 1 },
  { key: "cue", text: "CUE", x0: 5.50, x1: 7.50, y0: 0.20, y1: 0.68, arrows: 2 },
  { key: "stop", text: "", x0: 0.30, x1: 0.78, y0: -0.62, y1: -0.16, square: true },
  { key: "A", text: "A", x0: 1.00, x1: 1.42, y0: -0.62, y1: -0.16, boxed: true },
  { key: "B", text: "B", x0: 1.52, x1: 1.94, y0: -0.62, y1: -0.16, boxed: true },
  { key: "nr", text: "NR", x0: 2.18, x1: 2.78, y0: -0.62, y1: -0.16 },
  { key: "cro2", text: "CrO", sub: "2", x0: 2.94, x1: 3.74, y0: -0.62, y1: -0.16 },
  // lit (amber, like END) when the deck plays but no programme reaches it: a missing file
  // or a stalled stream. The meters are dead then; this says why
  { key: "nosig", text: "NO SIGNAL", x0: 3.95, x1: 6.45, y0: -0.62, y1: -0.16 },
  { key: "end", text: "END", x0: 6.70, x1: 7.50, y0: -0.62, y1: -0.16 },
];

function drawModesMask(font, W, H) {
  const S = 1024 / W, c = makeCanvas(1024, Math.round(H * S)), g = c.getContext("2d");
  const X = (x) => x * S, Y = (y) => (H / 2 - y) * S;
  g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#ff0000";
  const tri = (x, yc, s, dir) => {
    g.beginPath();
    g.moveTo(X(x + (dir > 0 ? s : 0)), Y(yc));
    g.lineTo(X(x + (dir > 0 ? 0 : s)), Y(yc + s * 0.62));
    g.lineTo(X(x + (dir > 0 ? 0 : s)), Y(yc - s * 0.62));
    g.closePath(); g.fill();
  };
  for (const L of MODE_LEGENDS) {
    const yc = (L.y0 + L.y1) / 2, h = L.y1 - L.y0;
    g.fillStyle = "#ff0000";
    g.textBaseline = "middle";
    if (L.square) {
      const s = 0.3; g.fillRect(X((L.x0 + L.x1) / 2 - s / 2), Y(yc + s / 2), s * S, s * S);
      continue;
    }
    if (L.arrows) {
      const s = 0.3, n = Math.abs(L.arrows), dir = Math.sign(L.arrows);
      g.font = fontFor(0.27 * S, font.panel, 700);
      const tw = g.measureText(L.text).width / S;
      const aw = n * s * 0.8 + 0.06;
      const total = aw + 0.14 + tw;
      let x = (L.x0 + L.x1) / 2 - total / 2;
      if (dir < 0) {
        for (let k = 0; k < n; k++) tri(x + k * s * 0.8, yc, s, -1);
        g.textAlign = "left"; g.fillText(L.text, X(x + aw + 0.14), Y(yc) + 0.01 * S);
      } else if (L.key === "play") {
        tri(x, yc, s, 1);
        g.textAlign = "left"; g.fillText(L.text, X(x + aw + 0.14), Y(yc) + 0.01 * S);
      } else {
        g.textAlign = "left"; g.fillText(L.text, X(x), Y(yc) + 0.01 * S);
        for (let k = 0; k < n; k++) tri(x + tw + 0.14 + k * s * 0.8, yc, s, 1);
      }
      continue;
    }
    if (L.boxed) {
      // a lit outline with a lit letter (a solid tile blooms into a blob)
      g.strokeStyle = "#ff0000"; g.lineWidth = 0.035 * S;
      rrect(g, X(L.x0) + 0.018 * S, Y(L.y1) + 0.018 * S, (L.x1 - L.x0 - 0.036) * S, (h - 0.036) * S, 0.04 * S); g.stroke();
      g.font = fontFor(0.22 * S, font.panel, 700);
      g.textAlign = "center"; g.fillText(L.text, X((L.x0 + L.x1) / 2), Y(yc) + 0.01 * S);
      continue;
    }
    g.font = fontFor(0.22 * S, font.panel, 700);
    g.textAlign = "center";
    if (L.sub) {
      const tw = g.measureText(L.text).width;
      g.font = fontFor(0.14 * S, font.panel, 700);
      const sw = g.measureText(L.sub).width;
      const x = X((L.x0 + L.x1) / 2) - (tw + sw) / 2;
      g.font = fontFor(0.22 * S, font.panel, 700);
      g.textAlign = "left"; g.fillText(L.text, x, Y(yc) + 0.01 * S);
      g.font = fontFor(0.14 * S, font.panel, 700);
      g.fillText(L.sub, x + tw, Y(yc - 0.08));
    } else {
      fitText(g, L.text, X((L.x0 + L.x1) / 2), Y(yc) + 0.01 * S, (L.x1 - L.x0) * S, "center");
    }
  }
  // printed divider between the rows, and tiny printed tags
  g.fillStyle = "#0000ff";
  g.globalCompositeOperation = "lighter";
  g.fillRect(X(0.3), Y(-0.02), (7.2) * S, 0.012 * S);
  g.globalCompositeOperation = "source-over";
  return c;
}

export function buildMeter(env) {
  const { THREE, D, font, ink } = env;
  const T = (x) => env.track(x);
  const W = 14.2, H = 1.7;
  const mask = T(canvasTexture(THREE, drawMeterMask(font, W, H), env.maxAniso, false));
  const u = commonUniforms(THREE, D, ink, W, H, mask);
  Object.assign(u, {
    uL: { value: -10 }, uR: { value: -10 }, uTailL: { value: -10 }, uTailR: { value: -10 },
    uHoldL: { value: -10 }, uHoldR: { value: -10 }, uBoot: { value: 0 },
  });
  const mat = T(new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: METER_FRAG,
  }));
  mat.name = "vfd";
  const root = new THREE.Group();
  root.name = "vfd";
  const plane = new THREE.Mesh(T(new THREE.PlaneGeometry(W, H)), mat);
  plane.position.z = -0.3;
  root.add(plane);
  addTubeFrame(env, root, W, H, -0.3);

  // ballistics (dB) per channel: bar, tail, hold, hold timer. Doubles live in a typed array so
  // update() never boxes a number.
  const S = new Float64Array(10);   // barL barR tailL tailR holdL holdR htL htR boot act
  for (let i = 0; i < 6; i++) S[i] = OFF;
  let booted = false, reduce = false;

  function chan(inp, bar, dt) { return inp > bar ? inp : Math.max(inp, bar - D.vfdRelease * dt); }
  function holdStep(bar, hold, ht, live, dt, out) {
    if (bar > CUT && bar >= hold) { hold = bar; ht = live ? D.vfdHold : 0; }
    else if (ht > 0) ht = Math.max(0, ht - dt);
    else hold = Math.max(bar, hold - D.vfdHoldFall * dt);
    S[out] = hold < CUT ? OFF : hold; S[out + 2] = ht;
  }

  // dbL/dbR: input peak dB (or < -60 for nothing). on: legend boxes lit (0..1).
  // live: heads on the tape (play or cue). Returns dirty.
  function step(dbL, dbR, on, dt, loadedEdge, live) {
    const pL = S[0], pR = S[1], ptl = S[2], ptr = S[3], phl = S[4], phr = S[5], pb = S[8];
    let barL = chan(dbL, pL, dt), barR = chan(dbR, pR, dt);
    let tailL = Math.max(barL, ptl - D.vfdTailFall * dt), tailR = Math.max(barR, ptr - D.vfdTailFall * dt);
    // heads lifted: the hold lets go at once
    if (!live) { S[6] = 0; S[7] = 0; }
    holdStep(barL, phl, S[6], live, dt, 4);
    holdStep(barR, phr, S[7], live, dt, 5);
    // below the first threshold nothing is lit: park there so the meter goes idle
    if (barL < CUT) barL = OFF;
    if (barR < CUT) barR = OFF;
    if (tailL < CUT) tailL = OFF;
    if (tailR < CUT) tailR = OFF;
    // boot test: every segment for 350 ms on the first load of the visit
    let boot = pb;
    if (loadedEdge && !booted) { booted = true; if (!reduce) boot = 0.35; }
    if (boot > 0) {
      boot -= dt;
      if (boot <= 0) { boot = 0; tailL = tailR = 9.5; S[4] = S[5] = 9; S[6] = S[7] = 0.25; }
    }
    S[0] = barL; S[1] = barR; S[2] = tailL; S[3] = tailR; S[8] = boot;
    u.uL.value = dbToSeg(barL); u.uR.value = dbToSeg(barR);
    u.uTailL.value = dbToSeg(tailL); u.uTailR.value = dbToSeg(tailR);
    u.uHoldL.value = S[4] > CUT ? dbToSeg(S[4]) : -10;
    u.uHoldR.value = S[5] > CUT ? dbToSeg(S[5]) : -10;
    u.uBoot.value = boot > 0 ? 1 : 0;
    const onPrev = u.uOn.value;
    u.uOn.value = on;
    // activity for the deck's light spill: lit fraction, smoothed
    const litFrac = Math.max(0, Math.min(1, (u.uL.value + u.uR.value) / (2 * NSEG))) * 0.7 + on * 0.3;
    S[9] += (litFrac - S[9]) * Math.min(1, dt * 8);
    return pL !== barL || pR !== barR || ptl !== tailL || ptr !== tailR || phl !== S[4] || phr !== S[5] || pb !== boot || onPrev !== on || S[6] > 0 || S[7] > 0;
  }

  function flicker(v) { u.uFlick.value = v; }

  return {
    object: root, step, flicker,
    setReduce(on) { reduce = on; },
    get activity() { return S[9]; },
  };
}

export function buildModes(env) {
  const { THREE, D, font, ink } = env;
  const T = (x) => env.track(x);
  const W = 7.8, H = 1.7;
  const mask = T(canvasTexture(THREE, drawModesMask(font, W, H), env.maxAniso, false));
  const u = commonUniforms(THREE, D, ink, W, H, mask);
  const rects = MODE_LEGENDS.map((L) => new THREE.Vector4(L.x0 - 0.04, L.y0 - 0.04, L.x1 + 0.04, L.y1 + 0.04));
  const lv = new Array(10).fill(0);
  Object.assign(u, { uRects: { value: rects }, uLegend: { value: lv } });
  const mat = T(new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: MODES_FRAG,
  }));
  mat.name = "modes";
  const root = new THREE.Group();
  root.name = "modes";
  const plane = new THREE.Mesh(T(new THREE.PlaneGeometry(W, H)), mat);
  plane.position.z = -0.3;
  root.add(plane);
  addTubeFrame(env, root, W, H, -0.3);

  // legend logic state
  let prevMode = "stop", prevLoaded = false, endOn = false, reduce = false;
  const TS = new Float64Array([-10, -10, -10]);   // tStop, tLoad, tEnd
  const out = lv;

  // f: the frame summary from displays.js
  function step(f) {
    const t = f.t, mode = f.mode, loaded = f.loaded;
    if (loaded && !prevLoaded) TS[1] = t;
    if (!loaded) endOn = false;
    if (mode !== prevMode) {
      if (mode === "stop" && prevMode !== "stop") TS[0] = t;
      if ((prevMode === "play" || prevMode === "forward") && f.frac >= 0.999 && loaded) { TS[2] = t; endOn = true; }
      else endOn = false;
    }
    prevMode = mode; prevLoaded = loaded;
    const tStop = TS[0], tLoad = TS[1], tEnd = TS[2];

    let anim = loaded && !reduce && t - tLoad < 0.06 * 9 + 0.06;
    const L = loaded ? 1 : 0;
    out[0] = loaded && mode === "rewind" ? 1 : 0;
    out[1] = loaded && mode === "play" ? 1 : 0;
    out[2] = loaded && mode === "forward" ? 1 : 0;
    let st = loaded && mode === "stop" ? 1 : 0;
    if (st && !reduce) {
      const ts = t - tStop;
      if (ts < 0.48) { anim = true; const ph = Math.floor(ts / 0.12); if (ph === 0 || ph === 2) st = 0; }
    }
    out[3] = st;
    out[4] = loaded && f.side === "A" ? ripple(t, tLoad, 4, reduce) : 0;
    out[5] = loaded && f.side === "B" ? ripple(t, tLoad, 5, reduce) : 0;
    out[6] = L * ripple(t, tLoad, 6, reduce);
    out[7] = L * ripple(t, tLoad, 7, reduce);
    out[3] *= ripple(t, tLoad, 3, reduce);
    const nosig = loaded && mode === "play" && f.signal === false ? 1 : 0;
    if (nosig !== out[8]) anim = true;
    out[8] = nosig;
    let end = 0;
    if (endOn && loaded) {
      const te = t - tEnd;
      if (!reduce && te < 1.5) { anim = true; end = (Math.floor(te / 0.25) % 2 === 0) ? 1 : 0; }
      else end = 0.5;
    }
    out[9] = end;
    u.uOn.value = L;
    return anim;
  }

  return {
    object: root, step,
    flicker(v) { u.uFlick.value = v; },
    setReduce(on) { reduce = on; },
    get legends() { return out; },
  };
}

function ripple(t, tLoad, k, reduce) {
  if (reduce) return 1;
  const r = (t - tLoad - k * 0.06) / 0.06;
  return r <= 0 ? 0 : r >= 1 ? 1 : r;
}

// A tube is a glass envelope seen through its filter: dark side walls from the aperture down to
// the phosphor plane, and a faint inner reflection along the envelope's top edge.
function addTubeFrame(env, root, W, H, z) {
  const { THREE } = env;
  const T = (x) => env.track(x);
  const mat = T(new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.5, metalness: 0.0, side: THREE.DoubleSide }));
  const sides = new THREE.Mesh(T(tunnelGeo(THREE, W, H, -z)), mat);
  root.add(sides);
  // envelope highlight (additive, very faint)
  const c = makeCanvas(256, 32), g = c.getContext("2d");
  const lg = g.createLinearGradient(0, 0, 0, 32);
  lg.addColorStop(0, "rgba(200,230,255,0.0)");
  lg.addColorStop(0.5, "rgba(200,230,255,0.10)");
  lg.addColorStop(1, "rgba(200,230,255,0)");
  g.fillStyle = lg; g.fillRect(0, 0, 256, 32);
  const h = T(canvasTexture(THREE, c, env.maxAniso));
  const hl = new THREE.Mesh(T(new THREE.PlaneGeometry(W - 0.4, 0.05)),
    T(new THREE.MeshBasicMaterial({ map: h, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35 })));
  hl.position.set(0, H / 2 - 0.07, -0.05);
  hl.renderOrder = 2;
  root.add(hl);
}

function tunnelGeo(THREE, w, h, d) {
  const x = w / 2, y = h / 2, P = [];
  const quad = (ax, ay, bx, by) => {
    const v = [[ax, ay, 0], [bx, by, 0], [bx, by, -d], [ax, ay, -d]];
    for (const i of [0, 1, 2, 0, 2, 3]) P.push(v[i][0], v[i][1], v[i][2]);
  };
  quad(-x, -y, x, -y); quad(x, -y, x, y); quad(x, y, -x, y); quad(-x, y, -x, -y);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  geo.computeVertexNormals();
  return geo;
}
