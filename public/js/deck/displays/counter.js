// Mechanical tape counter (counter): three real drums (20 facets) with printed digit bands behind
// a black bezel, counting take-up reel turns. Odometer carry, a 300 ms spin on load / flip,
// a smeared units band when winding fast, a little glass cover and window shading.
import { makeCanvas, fontFor, canvasTexture, rrect } from "./util.js";

const W = 3.0, H = 1.5;
const R = 0.62, DW = 0.62, PITCH = 0.70;
const WIN_X0 = -1.27, WIN_X1 = 0.93, WIN_Y = 0.24;        // three apertures, 0.48 tall (a digit and a sliver of its neighbours)
const AP_W = 0.54;                                         // each drum's own aperture; black bezel bars between them
const WIN_CX = (WIN_X0 + WIN_X1) / 2;
const Z_AXIS = -0.74;
const R_MIN = 1.08, R_MAX = 2.28;

// take-up reel turns at `s` seconds into a side of `total` seconds
export function reelTurns(s, total) {
  if (!(total > 0) || !(s > 0)) return 0;
  const a = R_MIN * R_MIN, b = (R_MAX * R_MAX - R_MIN * R_MIN) / total;
  const th = (4.76 * 2 * (Math.sqrt(a + b * Math.min(s, total)) - Math.sqrt(a))) / b;
  return th / (2 * Math.PI);
}

function drawBand(D, font, smear) {
  const c = makeCanvas(160, 1280), g = c.getContext("2d");
  g.fillStyle = D.drumBg; g.fillRect(0, 0, c.width, c.height);
  // faint vertical shading of the printed band edges
  const lg = g.createLinearGradient(0, 0, 160, 0);
  lg.addColorStop(0, "rgba(0,0,0,0.45)"); lg.addColorStop(0.1, "rgba(0,0,0,0)");
  lg.addColorStop(0.9, "rgba(0,0,0,0)"); lg.addColorStop(1, "rgba(0,0,0,0.45)");
  g.fillStyle = lg; g.fillRect(0, 0, 160, 1280);
  g.textAlign = "center"; g.textBaseline = "middle";
  // condensed digits that fill the drum face: cap ~84 % of the 128 px digit pitch
  g.font = fontFor(106, font.numeric, 700, 0.72);
  const draw = (alpha, dy) => {
    g.fillStyle = D.drumInk;
    g.globalAlpha = alpha;
    for (let k = 0; k <= 10; k++) {
      g.save(); g.translate(80, k * 128 + dy); g.scale(0.74, 1); g.fillText(String(k % 10), 0, 5); g.restore();
    }
    g.globalAlpha = 1;
  };
  if (!smear) draw(1, 0);
  else for (let i = -6; i <= 6; i++) draw(0.16, i * 11);
  // tiny index ticks between digits, as printed on real drums
  g.fillStyle = "rgba(241,230,207,0.3)";
  for (let k = 0; k <= 10; k++) { g.fillRect(6, k * 128 + 63, 8, 2); g.fillRect(146, k * 128 + 63, 8, 2); }
  return c;
}

function drumGeometry(THREE) {
  const N = 20, P = [], Nn = [], U = [], I = [];
  for (let j = 0; j <= N; j++) {
    const f = (j / N) * Math.PI * 2, y = Math.sin(f) * R, z = Math.cos(f) * R;
    for (const s of [-1, 1]) {
      P.push((s * DW) / 2, y, z); Nn.push(0, Math.sin(f), Math.cos(f)); U.push(s < 0 ? 0 : 1, j / N);
    }
  }
  for (let j = 0; j < N; j++) { const a = j * 2; I.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(Nn, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  geo.setIndex(I);
  return geo;
}

export function buildCounter(env) {
  const { THREE, D, font } = env;
  const T = (x) => env.track(x);
  const root = new THREE.Group();
  root.name = "counter";

  const band = T(canvasTexture(THREE, drawBand(D, font, false), env.maxAniso));
  const smear = T(canvasTexture(THREE, drawBand(D, font, true), env.maxAniso));
  band.wrapT = smear.wrapT = THREE.RepeatWrapping;
  const mk = () => T(new THREE.MeshStandardMaterial({ map: band, emissiveMap: band, emissive: 0xffffff, emissiveIntensity: D.drumGlow, roughness: 0.5, metalness: 0 }));
  const unitsMat = mk(), mat = mk();
  const geo = T(drumGeometry(THREE));
  const flangeGeo = T(new THREE.CylinderGeometry(R + 0.025, R + 0.025, 0.03, 32));
  flangeGeo.rotateZ(Math.PI / 2);
  const flangeMat = T(new THREE.MeshStandardMaterial({ color: 0x2b2826, roughness: 0.35, metalness: 0.7 }));
  const drums = [];
  for (let i = 0; i < 3; i++) {
    const d = new THREE.Mesh(geo, i === 2 ? unitsMat : mat);
    d.position.set(WIN_CX + (i - 1) * PITCH, 0, Z_AXIS);
    root.add(d);
    drums.push(d);
    for (const s of [-1, 1]) {
      const fl = new THREE.Mesh(flangeGeo, flangeMat);
      fl.position.set(d.position.x + s * (DW / 2 + 0.018), 0, Z_AXIS);
      root.add(fl);
    }
  }
  drums[0].name = "drum100"; drums[1].name = "drum10"; drums[2].name = "drum1";

  // back of the well
  const back = new THREE.Mesh(T(new THREE.PlaneGeometry(W, H)), T(new THREE.MeshBasicMaterial({ color: 0x030303 })));
  back.position.z = -1.35;
  root.add(back);

  // bezel: black satin plate with the window cut out, plus the window's inner walls
  const plate = new THREE.Shape();
  const bw = W / 2 - 0.016, bh = H / 2 - 0.016;
  plate.moveTo(-bw, -bh); plate.lineTo(bw, -bh); plate.lineTo(bw, bh); plate.lineTo(-bw, bh); plate.closePath();
  const r = 0.05;
  for (let i = 0; i < 3; i++) {
    const cx = WIN_CX + (i - 1) * PITCH, x0 = cx - AP_W / 2, x1 = cx + AP_W / 2;
    const hole = new THREE.Path();
    hole.moveTo(x0 + r, -WIN_Y); hole.lineTo(x1 - r, -WIN_Y); hole.quadraticCurveTo(x1, -WIN_Y, x1, -WIN_Y + r);
    hole.lineTo(x1, WIN_Y - r); hole.quadraticCurveTo(x1, WIN_Y, x1 - r, WIN_Y);
    hole.lineTo(x0 + r, WIN_Y); hole.quadraticCurveTo(x0, WIN_Y, x0, WIN_Y - r);
    hole.lineTo(x0, -WIN_Y + r); hole.quadraticCurveTo(x0, -WIN_Y, x0 + r, -WIN_Y);
    plate.holes.push(hole);
  }
  const bezelGeo = T(new THREE.ExtrudeGeometry(plate, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 6 }));
  const bezelMat = T(new THREE.MeshStandardMaterial({ color: 0x0b0a0a, roughness: 0.38, metalness: 0.15 }));
  const bezel = new THREE.Mesh(bezelGeo, bezelMat);
  bezel.position.z = -0.135;
  root.add(bezel);

  // printed pointer and dividers on the bezel
  const pr = makeCanvas(512, 256), pg = pr.getContext("2d");
  const S = 512 / W, PX = (x) => (x + W / 2) * S, PY = (y) => (H / 2 - y) * (256 / H);
  pg.clearRect(0, 0, 512, 256);
  // the reset pointer, and a fine silver frame line around the three apertures
  pg.fillStyle = "#f4ecda";
  pg.beginPath(); pg.moveTo(PX(WIN_X1 + 0.08), PY(0)); pg.lineTo(PX(WIN_X1 + 0.42), PY(0.19)); pg.lineTo(PX(WIN_X1 + 0.42), PY(-0.19)); pg.closePath(); pg.fill();
  pg.strokeStyle = "rgba(200,196,188,0.55)"; pg.lineWidth = 2;
  pg.strokeRect(PX(WIN_X0 - 0.07), PY(WIN_Y + 0.07), (WIN_X1 - WIN_X0 + 0.14) * S, (2 * WIN_Y + 0.14) * (256 / H));
  pg.fillStyle = "rgba(241,230,207,0.6)";
  pg.font = fontFor(0.13 * S, font.panel, 500);
  pg.textAlign = "center";
  pg.fillText("×1", PX(WIN_CX + PITCH), PY(-WIN_Y - 0.27));
  const printTex = T(canvasTexture(THREE, pr, env.maxAniso));
  const print = new THREE.Mesh(T(new THREE.PlaneGeometry(W, H)), T(new THREE.MeshStandardMaterial({ map: printTex, transparent: true, roughness: 0.6, depthWrite: false })));
  print.position.z = -0.018;
  root.add(print);

  // window shading: the drums go dark toward the window's top and bottom lips
  const sh = makeCanvas(8, 128), sg = sh.getContext("2d");
  const lg = sg.createLinearGradient(0, 0, 0, 128);
  lg.addColorStop(0, "rgba(0,0,0,0.85)"); lg.addColorStop(0.28, "rgba(0,0,0,0)");
  lg.addColorStop(0.72, "rgba(0,0,0,0)"); lg.addColorStop(1, "rgba(0,0,0,0.75)");
  sg.fillStyle = lg; sg.fillRect(0, 0, 8, 128);
  const shTex = T(canvasTexture(THREE, sh, 1));
  const shade = new THREE.Mesh(T(new THREE.PlaneGeometry(WIN_X1 - WIN_X0, WIN_Y * 2)),
    T(new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false })));
  shade.position.set(WIN_CX, 0, -0.06);
  shade.renderOrder = 1;
  root.add(shade);

  // glass cover glare
  const gc = makeCanvas(256, 104), gg = gc.getContext("2d");
  const gl = gg.createLinearGradient(0, 0, 256, 104);
  gl.addColorStop(0, "rgba(255,248,236,0)"); gl.addColorStop(0.2, "rgba(255,248,236,0.16)");
  gl.addColorStop(0.32, "rgba(255,248,236,0.02)"); gl.addColorStop(1, "rgba(255,248,236,0)");
  gg.fillStyle = gl; gg.fillRect(0, 0, 256, 104);
  gg.fillStyle = "rgba(255,250,240,0.25)"; rrect(gg, 6, 0, 244, 5, 2); gg.fill();
  const glare = new THREE.Mesh(T(new THREE.PlaneGeometry(WIN_X1 - WIN_X0, WIN_Y * 2)),
    T(new THREE.MeshBasicMaterial({ map: T(canvasTexture(THREE, gc, env.maxAniso)), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 })));
  glare.position.set(WIN_CX, 0, -0.01);
  glare.renderOrder = 2;
  root.add(glare);

  // ---- value
  let reduce = false, blurred = false, prog = null;
  const st = { shown: 0, from: 0, spinT: 1, spinDur: 0.3 };   // doubles in object fields: writes never box
  const TWO_PI = Math.PI * 2;

  function apply(v) {
    const u = v - Math.floor(v / 10) * 10;
    const tens = Math.floor(v / 10) + Math.max(0, u - 9);
    const tv = tens - Math.floor(tens / 10) * 10;
    const hund = Math.floor(v / 100) + Math.max(0, tv - 9);
    drums[2].rotation.x = -TWO_PI * v / 10;
    drums[1].rotation.x = -TWO_PI * tens / 10;
    drums[0].rotation.x = -TWO_PI * hund / 10;
  }
  apply(0);

  function setProgram(p) {
    prog = p;
    st.from = st.shown; st.spinT = reduce ? 1 : 0;
    if (p && st.from > 0 && !reduce) st.spinDur = 0.3;
  }

  // f: frame summary. Returns dirty.
  function step(f, dt) {
    const target = f.loaded || prog ? reelTurns(f.seconds, prog ? prog.total : 0) : 0;
    const prev = st.shown;
    if (st.spinT < 1) {
      st.spinT = Math.min(1, st.spinT + dt / st.spinDur);
      const k = st.spinT, e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * st.spinT + 2, 3) / 2;
      st.shown = st.from + (target - st.from) * e;
    } else st.shown = target;
    if (!prog && st.spinT >= 1) st.shown = 0;
    if (st.shown !== prev) apply(st.shown);
    const rate = dt > 0 ? Math.abs(st.shown - prev) / dt : 0;
    const blur = rate > 6;
    if (blur !== blurred) {
      blurred = blur;
      unitsMat.map = unitsMat.emissiveMap = blur ? smear : band;
    }
    return st.shown !== prev || st.spinT < 1;
  }

  return {
    object: root, step, setProgram,
    setReduce(v) { reduce = v; if (v) st.spinT = 1; },
    get value() { return st.shown; },
  };
}
