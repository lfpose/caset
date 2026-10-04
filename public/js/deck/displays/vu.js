// VU meters (vuL, vuR): the M206 pair. Ivory face with a true VU law scale, warm two-bulb
// backlight, a tapered needle on 240 Hz IEC ballistics, its blurred shadow on the paper,
// a black shroud with a zero-adjust screw, a lit window tunnel and a glass cover glare.
import { makeCanvas, fontFor, canvasTexture, FRAG_TAIL, rrect, tunnelGeometry } from "./util.js";

const W = 7.0, H = 3.6, DEPTH = 1.3;
const PX = 200;                       // face canvas px per cm (1400 x 720)
const PIVOT_Y = -2.9;                 // face coordinates (cm), below the visible face
const Z_FACE = -1.05, Z_NEEDLE = -0.80, Z_SHROUD = -0.74, Z_GLASS = -0.03;
const DEG = Math.PI / 180;
const REF = Math.pow(10, 3 / 20);
const PIN_LO = -47 * DEG, PIN_HI = 48 * DEG;
const STEP = 1 / 240;
const VU_T99 = 0.30;

// Dimensionless time (wn * t) for a unit step to first reach 99 %, with the same integrator.
function k99(zeta) {
  const h = 0.0005;
  let x = 0, v = 0, t = 0;
  while (x < 0.99 && t < 20) { v += (1 - x - 2 * zeta * v) * h; x += v * h; t += h; }
  return t;
}

// True VU law: reading in VU -> needle angle from vertical, clockwise positive (radians).
export function vuAngle(R) {
  return (-45 + 90 * Math.pow(10, R / 20) / REF) * DEG;
}

function drawFace(D, font, which, rand) {
  const c = makeCanvas(W * PX, H * PX), g = c.getContext("2d");
  const X = (x) => c.width / 2 + x * PX, Y = (y) => c.height / 2 - y * PX;

  // paper: ivory, browning toward the upper corners (old lacquer), with a little grain
  g.fillStyle = D.vuPaper; g.fillRect(0, 0, c.width, c.height);
  const rg = g.createRadialGradient(X(0), Y(-1.6), PX * 1.2, X(0), Y(-1.2), PX * 4.9);
  rg.addColorStop(0, "rgba(0,0,0,0)");
  rg.addColorStop(1, D.vuPaperEdge);
  g.globalAlpha = 0.5;
  g.fillStyle = rg; g.fillRect(0, 0, c.width, c.height);
  g.globalAlpha = 1;
  const img = g.getImageData(0, 0, c.width, c.height), px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const n = 1 + (rand() - 0.5) * 0.06 + (rand() < 0.002 ? -0.06 : 0);
    px[i] *= n; px[i + 1] *= n; px[i + 2] *= n;
  }
  g.putImageData(img, 0, 0);
  // faint fibres
  g.strokeStyle = "rgba(90,60,30,0.05)"; g.lineWidth = 1;
  for (let i = 0; i < 90; i++) {
    const x = rand() * c.width, y = rand() * c.height, a = rand() * Math.PI, l = 8 + rand() * 30;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }

  const P = { x: X(0), y: Y(PIVOT_Y) };
  // canvas angle for a meter angle th (from vertical, clockwise): canvas 0 rad = +x, y down
  const ca = (th) => -Math.PI / 2 + th;
  const pt = (th, r) => [P.x + Math.sin(th) * r * PX, P.y - Math.cos(th) * r * PX];
  const arc = (r, a0, a1, w, col) => {
    g.beginPath(); g.arc(P.x, P.y, r * PX, ca(a0), ca(a1)); g.lineWidth = w * PX; g.strokeStyle = col; g.lineCap = "butt"; g.stroke();
  };
  const tick = (th, r0, r1, w, col) => {
    const [x0, y0] = pt(th, r0), [x1, y1] = pt(th, r1);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineWidth = w * PX; g.strokeStyle = col; g.lineCap = "butt"; g.stroke();
  };
  const ink = D.vuInk, red = D.vuRed;
  const a20 = vuAngle(-20), a0 = vuAngle(0), a3 = vuAngle(3);

  // main scale: hairline over the black range, thick red band 0..+3
  arc(3.9, a20 - 0.4 * DEG, a0, 0.024, ink);
  arc(3.945, a0, a3 + 0.3 * DEG, 0.09, red);
  arc(3.9, a0, a3, 0.024, red);
  // hairline under the numerals
  arc(4.12, a20 - 1.2 * DEG, a0, 0.010, "rgba(29,23,18,0.55)");
  arc(4.12, a0, a3 + 1.2 * DEG, 0.010, "rgba(200,50,30,0.6)");

  const majors = [-20, -10, -7, -5, -3, -2, -1, 0, 1, 2, 3];
  const minors = [-15, -12, -9, -8, -6, -4, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5];
  // the ink is set to hold at a distance: ticks of 0.022 / 0.035 cm, numerals 0.3 cm at 600
  for (const v of minors) tick(vuAngle(v), 3.84, 4.05, 0.022, v >= 0 ? red : ink);
  for (const v of majors) tick(vuAngle(v), 3.68, 4.05, v === 0 ? 0.045 : 0.035, v > 0 ? red : ink);

  // numerals, rotated along the radius like a printed meter
  g.textBaseline = "alphabetic";
  for (const v of majors) {
    if (v === -1 || v === 2) continue;   // the crowded pairs near 0: every other one, as on the M206
    const th = vuAngle(v);
    const [x, y] = pt(th, 4.38);
    g.save(); g.translate(x, y); g.rotate(th);
    g.fillStyle = v > 0 ? red : ink;
    g.font = fontFor(0.3 * PX, font.numeric, v === 0 ? 700 : 600);
    g.textAlign = "center";
    g.fillText(String(Math.abs(v)), 0, 0.15 * PX);
    g.restore();
  }
  // end signs
  g.font = fontFor(0.34 * PX, font.panel, 600);
  g.fillStyle = ink; g.textAlign = "center";
  { const [x, y] = pt(vuAngle(-20) - 6.5 * DEG, 4.2); g.fillText("−", x, y + 0.14 * PX); }
  g.fillStyle = red;
  { const [x, y] = pt(a3 + 6 * DEG, 4.2); g.fillText("+", x, y + 0.14 * PX); }

  // VU legend
  g.fillStyle = ink; g.textAlign = "center";
  g.font = fontFor(0.42 * PX, font.serif, 400, 0.69);
  g.fillText("VU", X(0), Y(-0.55) + 0.21 * PX);
  // small engraved lines either side of VU, as on old faces
  g.fillRect(X(-1.05), Y(-0.34), 0.5 * PX, 0.012 * PX);
  g.fillRect(X(0.55), Y(-0.34), 0.5 * PX, 0.012 * PX);
  g.font = fontFor(0.15 * PX, font.panel, 400);
  g.textAlign = "left";
  g.fillText(which === "R" ? "right" : "left", X(-3.15), Y(-1.42));
  g.font = fontFor(0.1 * PX, font.panel, 500);
  g.textAlign = "right";
  g.fillStyle = "rgba(29,23,18,0.78)";
  g.fillText("CLASS 1.5", X(3.15), Y(-1.5));
  g.fillText("dB", X(3.15), Y(-1.32));
  // tiny maker-ish mark, generic
  g.font = fontFor(0.085 * PX, font.panel, 400);
  g.fillText("CS-86 · 600Ω", X(3.15), Y(-1.66));
  return c;
}

function drawShadow() {
  // tapered blade, blurred via canvas shadow (works in every engine; ctx.filter does not)
  const c = makeCanvas(96, 512), g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, 96, 512);
  g.shadowColor = "#fff"; g.shadowBlur = 16; g.shadowOffsetX = 1000;
  g.fillStyle = "#fff";
  g.beginPath();
  g.moveTo(48 - 1000 - 6, 480); g.lineTo(48 - 1000 + 6, 480);
  g.lineTo(48 - 1000 + 2.5, 32); g.lineTo(48 - 1000 - 2.5, 32); g.closePath(); g.fill();
  return c;
}

// the needle as an alpha-mapped plane: a tapered black blade. Texture filtering antialiases it
// at any angle (the deck has no MSAA). Opaque mask (white = blade) for a fast upload.
// The plane spans x -0.08..0.08, y 1.68..4.17 cm in the pivot frame.
const BLADE = { x: 0.08, y0: 1.68, y1: 4.17, base: 0.06, tip: 0.025 };
function drawBlade() {
  const w = 64, h = 1024, c = makeCanvas(w, h), g = c.getContext("2d");
  const sx = w / (2 * BLADE.x), sy = h / (BLADE.y1 - BLADE.y0);
  const X = (x) => w / 2 + x * sx, Y = (y) => h - (y - BLADE.y0) * sy;
  g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
  const yb = 1.7, yt = 4.15;
  g.beginPath();
  g.moveTo(X(-BLADE.base / 2), Y(yb)); g.lineTo(X(BLADE.base / 2), Y(yb));
  g.lineTo(X(BLADE.tip / 2), Y(yt)); g.lineTo(X(-BLADE.tip / 2), Y(yt)); g.closePath();
  g.fillStyle = "#fff"; g.fill();
  return c;
}

export function buildVU(env, which) {
  const { THREE, D, font } = env;
  const T = (x) => env.track(x);
  const root = new THREE.Group();
  root.name = which === "R" ? "vuR" : "vuL";

  // ---- face (backlit paper)
  const faceTex = T(canvasTexture(THREE, drawFace(D, font, which, env.rand), env.maxAniso));
  const lamp = which === "R" ? D.vuLampR : D.vuLamp;
  const faceU = {
    uMap: { value: faceTex },
    uLamp: { value: new THREE.Vector3(lamp[0], lamp[1], lamp[2]) },
    uLevel: { value: 0 },
    uAmb: { value: 0.03 },
  };
  const faceMat = T(new THREE.ShaderMaterial({
    uniforms: faceU,
    vertexShader: `
      varying vec2 vUv; varying vec2 vP;
      void main(){ vUv = uv; vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform vec3 uLamp; uniform float uLevel; uniform float uAmb;
      varying vec2 vUv; varying vec2 vP;
      float gs(vec2 d){ return exp(-dot(d,d) / (2.0 * 1.21)); }
      void main(){
        vec3 paper = texture2D(uMap, vUv).rgb;
        // two bulbs behind the lower face at (+-1.3, -1.3): a hot amber centre low on the paper
        // (just over the bloom knee), falling off to dim corners, as on the M206
        // a concentrated pool: about 1.8x in the centre, 0.25x in the corners
        float hot = 0.2 + 1.3 * (gs(vP - vec2(1.1, -1.4)) + gs(vP - vec2(-1.1, -1.4)));
        hot = min(hot, 1.8);
        // the window tunnel shades the top band of the paper
        hot *= 1.0 - 0.32 * smoothstep(0.6, 1.8, vP.y);
        // the warm lamp keeps its colour through the tone mapper: saturate the light, not the paper
        vec3 lamp = uLamp * uLamp;
        vec3 col = paper * (lamp * uLevel * hot + uAmb);
        gl_FragColor = vec4(col, 1.0);
        ${FRAG_TAIL}
      }`,
  }));
  const face = new THREE.Mesh(T(new THREE.PlaneGeometry(W, H)), faceMat);
  face.position.z = Z_FACE;
  root.add(face);

  // ---- tunnel walls: dark plastic, warmed by the lamp near the face
  const wallU = { uLamp: faceU.uLamp, uLevel: faceU.uLevel };
  const wallMat = T(new THREE.ShaderMaterial({
    uniforms: wallU,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uLamp; uniform float uLevel; varying vec2 vUv;
      void main(){
        float k = pow(vUv.y, 2.2);
        vec3 col = vec3(0.012, 0.010, 0.009) + uLamp * uLevel * (0.02 + 0.22 * k);
        gl_FragColor = vec4(col, 1.0);
        ${FRAG_TAIL}
      }`,
    side: THREE.DoubleSide,
  }));
  const tunnel = new THREE.Mesh(T(tunnelGeometry(THREE, W - 0.002, H - 0.002, -Z_FACE)), wallMat);
  root.add(tunnel);

  // ---- needle shadow on the paper (the biggest realism cue)
  const shTex = T(canvasTexture(THREE, drawShadow(), env.maxAniso, false));
  const SH_OPACITY = 0.65;
  const shMat = T(new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: shTex, transparent: true, opacity: SH_OPACITY, depthWrite: false }));
  const shGeo = T(new THREE.PlaneGeometry(0.6, 2.6));
  shGeo.translate(0, 1.75 + 2.6 / 2, 0);
  const shadowPivot = new THREE.Group();
  // offset down and right of the blade (the lamps sit low, the room light comes from above
  // left): the blade stands 0.25 cm off the paper, so its soft shadow reads as a separate thing
  shadowPivot.position.set(0.22, PIVOT_Y - 0.14, Z_FACE + 0.004);
  const shadow = new THREE.Mesh(shGeo, shMat);
  shadow.renderOrder = 1;
  shadowPivot.add(shadow);
  root.add(shadowPivot);

  // ---- needle: tapered black blade (alpha-mapped plane, antialiased by filtering)
  const bladeTex = T(canvasTexture(THREE, drawBlade(), env.maxAniso, false));
  const needleMat = T(new THREE.MeshBasicMaterial({ color: 0x050302, alphaMap: bladeTex, transparent: true, depthWrite: false }));
  const needlePivot = new THREE.Group();
  needlePivot.name = "needle";
  needlePivot.position.set(0, PIVOT_Y, Z_NEEDLE);
  const bladeGeo = T(new THREE.PlaneGeometry(2 * BLADE.x, BLADE.y1 - BLADE.y0));
  bladeGeo.translate(0, (BLADE.y0 + BLADE.y1) / 2, 0);
  const bladeMesh = new THREE.Mesh(bladeGeo, needleMat);
  bladeMesh.renderOrder = 2;
  needlePivot.add(bladeMesh);
  root.add(needlePivot);

  // ---- shroud: black arch over the needle root, bevelled so its edge catches the light
  const SR = 1.7, yCut = -H / 2 + 0.021;
  const a0 = Math.acos((yCut - PIVOT_Y) / SR);       // angle from vertical where the arch meets the face bottom
  const sh = new THREE.Shape();
  sh.moveTo(-Math.sin(a0) * SR, yCut);
  for (let i = 0; i <= 40; i++) {
    const a = -a0 + (2 * a0 * i) / 40;
    sh.lineTo(Math.sin(a) * SR, PIVOT_Y + Math.cos(a) * SR);
  }
  sh.lineTo(Math.sin(a0) * SR, yCut);
  sh.closePath();
  const shroudGeo = T(new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 24 }));
  const shroudMat = T(new THREE.MeshStandardMaterial({ color: 0x0c0a09, roughness: 0.42, metalness: 0.1 }));
  const shroud = new THREE.Mesh(shroudGeo, shroudMat);
  shroud.position.z = Z_SHROUD - 0.06;
  root.add(shroud);
  // zero-adjust screw
  const screwMat = T(new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.35, metalness: 0.9 }));
  const screw = new THREE.Mesh(T(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 24)), screwMat);
  screw.rotation.x = Math.PI / 2;
  screw.position.set(0, -1.52, Z_SHROUD + 0.005);
  root.add(screw);
  const slot = new THREE.Mesh(T(new THREE.BoxGeometry(0.13, 0.018, 0.01)), T(new THREE.MeshBasicMaterial({ color: 0x050404 })));
  slot.rotation.z = which === "R" ? 0.9 : 0.35;
  slot.position.set(0, -1.52, Z_SHROUD + 0.022);
  root.add(slot);

  // ---- window mask: thin black frame inside the aperture (face edges never show raw)
  const fr = new THREE.Shape();
  fr.moveTo(-W / 2, -H / 2); fr.lineTo(W / 2, -H / 2); fr.lineTo(W / 2, H / 2); fr.lineTo(-W / 2, H / 2); fr.closePath();
  const hole = new THREE.Path();
  const m = 0.09, r = 0.12;
  hole.moveTo(-W / 2 + m + r, -H / 2 + m);
  hole.lineTo(W / 2 - m - r, -H / 2 + m); hole.quadraticCurveTo(W / 2 - m, -H / 2 + m, W / 2 - m, -H / 2 + m + r);
  hole.lineTo(W / 2 - m, H / 2 - m - r); hole.quadraticCurveTo(W / 2 - m, H / 2 - m, W / 2 - m - r, H / 2 - m);
  hole.lineTo(-W / 2 + m + r, H / 2 - m); hole.quadraticCurveTo(-W / 2 + m, H / 2 - m, -W / 2 + m, H / 2 - m - r);
  hole.lineTo(-W / 2 + m, -H / 2 + m + r); hole.quadraticCurveTo(-W / 2 + m, -H / 2 + m, -W / 2 + m + r, -H / 2 + m);
  fr.holes.push(hole);
  const frame = new THREE.Mesh(T(new THREE.ShapeGeometry(fr, 8)), T(new THREE.MeshStandardMaterial({ color: 0x070606, roughness: 0.6 })));
  frame.position.z = -0.012;
  root.add(frame);

  // ---- glass cover glare (additive, faint; the deck's smoked bar sits in front of it)
  const glareTex = T(canvasTexture(THREE, glare(), env.maxAniso));
  const glass = new THREE.Mesh(T(new THREE.PlaneGeometry(W - 0.18, H - 0.18)),
    T(new THREE.MeshBasicMaterial({ map: glareTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.3 })));
  glass.position.z = Z_GLASS;
  glass.renderOrder = 2;
  root.add(glass);

  // ---- ballistics
  const isR = which === "R";
  const zero = (isR ? 0.3 : -0.4) * DEG;
  // IEC 60268-17: 99 % of the reading in 300 ms. The natural frequency is solved from zeta so
  // the meter honours that whatever LOOK says; R keeps LOOK's small mismatch against L.
  const z0 = isR ? D.vuZetaR : D.vuZeta;
  const wn0 = (k99(z0) / VU_T99) * (isR ? D.vuOmegaR / D.vuOmega : 1);
  // mutable doubles live in a typed array: closure `let`s would box a new number on every write
  const S = new Float64Array(8);   // th, om, acc, target, level, wn, zeta, th of the last frame
  S[0] = PIN_LO; S[3] = PIN_LO; S[5] = wn0; S[6] = z0; S[7] = PIN_LO;
  let reduce = false;

  function setReduce(on) {
    reduce = on;
    S[5] = on ? 14 : wn0;
    S[6] = on ? 1 : z0;
  }

  // R in VU (or < -40 / NaN for the pin). Returns true while the needle moves.
  function step(R, lampTarget, dt, warm) {
    const target = (R > -40 ? vuAngle(Math.min(R, 3.5)) : PIN_LO) + zero;
    const wn = S[5], zeta = S[6];
    let th = S[0], om = S[1], acc = S[2] + dt;
    if (acc > 0.25) acc = 0.25;
    while (acc >= STEP) {
      acc -= STEP;
      const a = wn * wn * (target - th) - 2 * zeta * wn * om;
      om += a * STEP;
      th += om * STEP;
      if (th < PIN_LO) { th = PIN_LO; om = om < -0.05 ? -om * 0.25 : 0; }
      else if (th > PIN_HI) { th = PIN_HI; om = om > 0.05 ? -om * 0.25 : 0; }
    }
    // the shadow trails the blade by a frame: it reads as a separate thing on the paper
    shadowPivot.rotation.z = -(reduce ? th : S[7]);
    S[7] = S[0];
    S[0] = th; S[1] = om; S[2] = acc; S[3] = target;
    needlePivot.rotation.z = -th;
    // lamp: 400 ms ramp between empty and on
    const lt = lampTarget * warm;
    const prev = S[4];
    let level = prev;
    if (reduce) level = lt;
    else {
      const rate = Math.max(D.vuLampOn, 0.01) / 0.4;
      level = level < lt ? Math.min(lt, level + rate * dt) : Math.max(lt, level - rate * dt);
    }
    S[4] = level;
    faceU.uLevel.value = level;
    if (level !== prev) shMat.opacity = SH_OPACITY * (0.3 + 0.7 * Math.min(1, level / Math.max(D.vuLampOn, 0.01)));
    const tgt = Math.min(PIN_HI, Math.max(PIN_LO, target));
    const moving = !(Math.abs(th - tgt) < 1e-4 && Math.abs(om) < 1e-3);
    return moving || level !== prev;
  }

  function knock(s) { if (!reduce) S[1] += 0.8 * s; }

  // widen the blade (never past 2.2x) so its tip stays at least ~1.3 device px wide
  let bladeScale = 1;
  function setPixelScale(pxPerCm) {
    const k = pxPerCm > 0 ? Math.min(2.2, Math.max(1, 1.3 / (BLADE.tip * pxPerCm))) : 1;
    if (Math.abs(k - bladeScale) < 0.01) return false;
    bladeScale = k;
    bladeMesh.scale.x = k;
    return true;
  }

  return {
    object: root,
    step, knock, setReduce, setPixelScale,
    get level() { return S[4]; },
    get angle() { return S[0]; },
  };
}

function glare() {
  const c = makeCanvas(512, 264), g = c.getContext("2d");
  const lg = g.createLinearGradient(0, 0, 512, 264);
  lg.addColorStop(0.00, "rgba(255,246,230,0)");
  lg.addColorStop(0.14, "rgba(255,246,230,0.18)");
  lg.addColorStop(0.24, "rgba(255,246,230,0.04)");
  lg.addColorStop(0.50, "rgba(255,246,230,0)");
  lg.addColorStop(0.58, "rgba(255,246,230,0.09)");
  lg.addColorStop(0.63, "rgba(255,246,230,0)");
  g.fillStyle = lg; g.fillRect(0, 0, 512, 264);
  // top edge catch-light of the cover's bevel
  const tg = g.createLinearGradient(0, 0, 0, 14);
  tg.addColorStop(0, "rgba(255,250,240,0.28)"); tg.addColorStop(1, "rgba(255,250,240,0)");
  g.fillStyle = tg; rrect(g, 6, 0, 500, 14, 4); g.fill();
  return c;
}
