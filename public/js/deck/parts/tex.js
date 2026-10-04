// Canvas-generated textures for the deck. Everything is drawn once at load from a seeded
// PRNG so every load (and every trace screenshot) looks the same. Units are centimetres.
import { LOOK } from "../look.js";

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w, h) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  return [cv, cv.getContext("2d")];
}

export function texFactory(THREE, maxAniso) {
  return function tex(cv, { srgb = true, repeat = null, mips = true, aniso = true } = {}) {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = aniso ? maxAniso : 1;
    t.generateMipmaps = mips;
    t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    if (repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
    }
    return t;
  };
}

const CAP = 0.72; // cap height / em for the panel faces

// ---------- text on a cm grid ----------
// grid: { sx, sy (px per cm), h (height in cm, so y is measured from the bottom) }
export function printer(g, grid) {
  const X = (x) => x * grid.sx, Y = (y) => (grid.h - y) * grid.sy;
  // panel legends are silkscreened in small tracked capitals (as on 70s/80s Technics fascias)
  function font(cap, weight = 400, family = LOOK.font.panel) {
    return `${weight} ${Math.max(1, (cap / CAP) * grid.sy).toFixed(2)}px ${family}`;
  }
  // draws text with its baseline at y (cm); returns the drawn width in cm
  function text(str, x, y, cap, o = {}) {
    const { weight = 500, family = LOOK.font.panel, align = "left", color = LOOK.ink.onAlu, alpha = LOOK.ink.onAluAlpha,
      track = 0.02, scaleX = 1, maxW = 0 } = o;
    g.save();
    g.font = font(cap, weight, family);
    if ("letterSpacing" in g) g.letterSpacing = `${(track * (cap / CAP) * grid.sy).toFixed(2)}px`;
    let w = g.measureText(str).width * scaleX;
    let sx = scaleX;
    if (maxW && w > maxW * grid.sx) { sx *= (maxW * grid.sx) / w; w = maxW * grid.sx; }
    let x0 = X(x);
    if (align === "center") x0 -= w / 2;
    else if (align === "right") x0 -= w;
    g.translate(x0, Y(y));
    g.scale(sx, 1);
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
    g.fillText(str, 0, 0);
    g.restore();
    return w / grid.sx;
  }
  function rect(x0, x1, y0, y1, color, alpha = 1) {
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fillRect(X(x0), Y(y1), (x1 - x0) * grid.sx, (y1 - y0) * grid.sy);
    g.restore();
  }
  function line(pts, width, color, alpha = 1) {
    g.save();
    g.globalAlpha = alpha;
    g.strokeStyle = color;
    g.lineWidth = width * grid.sy;
    g.lineCap = "butt";
    g.lineJoin = "miter";
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
    g.stroke();
    g.restore();
  }
  return { text, rect, line, X, Y, font };
}

// ---------- brushed aluminium ----------
// One 1024 x 64 tile, repeat-wrapped: long horizontal hairlines. Returns three canvases:
// albedo (sRGB, very subtle: a bright satin silver, 236..250), roughness (linear, G = roughness)
// and normal (the hairline relief). The brushing lives mostly in roughness and relief, as on a
// real satin-brushed panel; the albedo barely varies, so nothing reads as streaky grey plastic
// or aliases into moire at 1x.
export function brushCanvases(seed, { roughMin = 0.26, roughMax = 0.42, W = 1024, H = 64 } = {}) {
  const r = rng(seed);
  const height = new Float32Array(W * H);
  const rough = new Float32Array(W * H);
  // every row: a base value (narrow spread) plus long streaks that wrap around horizontally
  for (let y = 0; y < H; y++) {
    const base = 0.47 + r() * 0.06;
    const rb = 0.35 + r() * 0.3;
    for (let x = 0; x < W; x++) { height[y * W + x] = base; rough[y * W + x] = rb; }
    const n = 3 + Math.floor(r() * 5);
    for (let k = 0; k < n; k++) {
      const x0 = Math.floor(r() * W), len = 80 + Math.floor(r() * 900);
      // rarely a slightly deeper pass of the brush
      const v = r() < 0.01 ? (r() < 0.5 ? -0.5 : 0.5) : (r() * 2 - 1) * 0.5;
      for (let i = 0; i < len; i++) {
        const x = (x0 + i) % W;
        const fade = Math.min(1, i / 40, (len - i) / 40);
        height[y * W + x] += v * 0.12 * fade;
        rough[y * W + x] += v * 0.5 * fade;
      }
    }
  }
  const [ca, ga] = makeCanvas(W, H), [cr, gr] = makeCanvas(W, H), [cn, gn] = makeCanvas(W, H);
  const ia = ga.createImageData(W, H), ir = gr.createImageData(W, H), inn = gn.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, p = i * 4;
      const h = Math.max(0, Math.min(1, height[i]));
      const a = Math.round(236 + h * 14);
      ia.data[p] = a; ia.data[p + 1] = a; ia.data[p + 2] = a; ia.data[p + 3] = 255;
      const rv = roughMin + (roughMax - roughMin) * Math.max(0, Math.min(1, rough[i]));
      const rb = Math.round(rv * 255);
      ir.data[p] = rb; ir.data[p + 1] = rb; ir.data[p + 2] = rb; ir.data[p + 3] = 255;
      // relief only across the hairlines (y), wrapping vertically
      const up = height[((y + H - 1) % H) * W + x], dn = height[((y + 1) % H) * W + x];
      const dy = (dn - up) * 0.9;
      const len = Math.hypot(dy, 1);
      inn.data[p] = 128;
      inn.data[p + 1] = Math.round((dy / len * 0.5 + 0.5) * 255);
      inn.data[p + 2] = Math.round((1 / len * 0.5 + 0.5) * 255);
      inn.data[p + 3] = 255;
    }
  }
  ga.putImageData(ia, 0, 0); gr.putImageData(ir, 0, 0); gn.putImageData(inn, 0, 0);
  return { albedo: ca, rough: cr, normal: cn };
}

// ---------- satin paint (the top cover): a fine, even orange-peel roughness, no grain ----------
export function satinCanvas(seed, N = 256, lo = 0.4, hi = 0.48) {
  const r = rng(seed);
  const [cv, g] = makeCanvas(N, N);
  const img = g.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    const v = Math.round((lo + (hi - lo) * (0.5 + (r() + r() - 1) * 0.5)) * 255);
    const p = i * 4;
    img.data[p] = v; img.data[p + 1] = v; img.data[p + 2] = v; img.data[p + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return cv;
}

// ---------- spun (diamond-cut) knob face: tangential anisotropy direction ----------
export function spunCanvases(seed, N = 512) {
  const r = rng(seed);
  const [ca, ga] = makeCanvas(N, N), [cr, gr] = makeCanvas(N, N);
  const ia = ga.createImageData(N, N), ir = gr.createImageData(N, N);
  const rings = new Float32Array(N);
  for (let i = 0; i < N; i++) rings[i] = r();
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = (x + 0.5) / N - 0.5, v = 0.5 - (y + 0.5) / N;
      const rad = Math.hypot(u, v) + 1e-6;
      const p = (y * N + x) * 4;
      // direction in tangent space (u right, v up): along the circles
      const tx = -v / rad, ty = u / rad;
      ia.data[p] = Math.round((tx * 0.5 + 0.5) * 255);
      ia.data[p + 1] = Math.round((ty * 0.5 + 0.5) * 255);
      ia.data[p + 2] = 255; ia.data[p + 3] = 255;
      const ring = rings[Math.min(N - 1, Math.floor(rad * 2 * N))];
      const rv = 0.24 + ring * 0.12;
      const rb = Math.round(rv * 255);
      ir.data[p] = rb; ir.data[p + 1] = rb; ir.data[p + 2] = rb; ir.data[p + 3] = 255;
    }
  }
  ga.putImageData(ia, 0, 0); gr.putImageData(ir, 0, 0);
  return { aniso: ca, rough: cr };
}

// ---------- knurled skirt: fine vertical ridges (normal map, u runs around) ----------
export function knurlCanvas(N = 1024, ridges = 180) {
  const [cv, g] = makeCanvas(N, 8);
  const img = g.createImageData(N, 8);
  for (let x = 0; x < N; x++) {
    const ph = (x / N) * ridges * Math.PI * 2;
    const dx = Math.cos(ph) * 0.9;
    const len = Math.hypot(dx, 1);
    for (let y = 0; y < 8; y++) {
      const p = (y * N + x) * 4;
      img.data[p] = Math.round((dx / len * 0.5 + 0.5) * 255);
      img.data[p + 1] = 128;
      img.data[p + 2] = Math.round((1 / len * 0.5 + 0.5) * 255);
      img.data[p + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return cv;
}

// ---------- tape pack: concentric microgrooves (normal map, cylinder-cap uv) ----------
export function ringsCanvases(seed, N = 512) {
  const r = rng(seed);
  const [cn, gn] = makeCanvas(N, N), [cc, gc] = makeCanvas(N, N);
  const inn = gn.createImageData(N, N), ic = gc.createImageData(N, N);
  const prof = new Float32Array(N);
  let h = 0;
  for (let i = 0; i < N; i++) { h = h * 0.6 + (r() - 0.5); prof[i] = h; }
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = (x + 0.5) / N - 0.5, v = (y + 0.5) / N - 0.5;
      const rad = Math.hypot(u, v);
      const k = Math.min(N - 2, Math.floor(rad * 2 * N));
      const d = (prof[k + 1] - prof[k]) * 0.8;
      const nx = (u / (rad + 1e-6)) * d, ny = (v / (rad + 1e-6)) * d;
      const len = Math.hypot(nx, ny, 1);
      const p = (y * N + x) * 4;
      inn.data[p] = Math.round((nx / len * 0.5 + 0.5) * 255);
      inn.data[p + 1] = Math.round((-ny / len * 0.5 + 0.5) * 255);
      inn.data[p + 2] = Math.round((1 / len * 0.5 + 0.5) * 255);
      inn.data[p + 3] = 255;
      const s = 0.85 + prof[k] * 0.12;
      ic.data[p] = Math.round(255 * Math.min(1, s)); ic.data[p + 1] = Math.round(255 * Math.min(1, s * 0.97));
      ic.data[p + 2] = Math.round(255 * Math.min(1, s * 0.94)); ic.data[p + 3] = 255;
    }
  }
  gn.putImageData(inn, 0, 0); gc.putImageData(ic, 0, 0);
  return { normal: cn, color: cc };
}

// ---------- smudges for glass roughness (G channel) ----------
export function smudgeCanvas(seed, W = 512, H = 256) {
  const r = rng(seed);
  const [cv, g] = makeCanvas(W, H);
  g.fillStyle = "rgb(10,10,10)"; // 0.04
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9; i++) {
    const x = r() * W, y = r() * H, rad = 20 + r() * 60;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(36,36,36,${0.35 + r() * 0.4})`);
    gr.addColorStop(1, "rgba(36,36,36,0)");
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  // a thumb print: concentric arcs
  const fx = W * 0.78, fy = H * 0.7;
  g.strokeStyle = "rgba(34,34,34,0.5)";
  g.lineWidth = 1.2;
  for (let k = 3; k < 26; k += 2.2) { g.beginPath(); g.ellipse(fx, fy, k * 1.2, k, 0.4, 0.3, Math.PI * 1.7); g.stroke(); }
  return cv;
}

// ---------- additive reflection on a smoked window ----------
// One wide, soft diagonal band (the soft box over the camera, seen in the glass) and a faint sheen
// along the top edge; no hard streaks, no dust. `band` places the band (0..1 across), so each pane
// gets its own; `top` keeps the band in the upper part of the glass (the display bar).
export function glareCanvas(seed, { W = 512, H = 256, band = 0.22, width = 0.2, top = 1.0 } = {}) {
  const r = rng(seed);
  const [cv, g] = makeCanvas(W, H);
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
  g.save();
  g.setTransform(1, 0, -0.55, 1, H * 0.35, 0);
  const x = W * band, w = W * width;
  const gr = g.createLinearGradient(x - w, 0, x + w, 0);
  gr.addColorStop(0, "rgba(255,248,236,0)");
  gr.addColorStop(0.45, `rgba(255,248,236,${0.32 + r() * 0.04})`);
  gr.addColorStop(0.55, `rgba(255,248,236,${0.30 + r() * 0.04})`);
  gr.addColorStop(1, "rgba(255,248,236,0)");
  g.fillStyle = gr;
  g.fillRect(x - w, 0, w * 2, H);
  g.restore();
  // top edge sheen
  const sh = g.createLinearGradient(0, 0, 0, H * 0.14);
  sh.addColorStop(0, "rgba(255,250,240,0.4)"); sh.addColorStop(1, "rgba(255,250,240,0)");
  g.fillStyle = sh; g.fillRect(0, 0, W, H * 0.14);
  // the reflection fades toward the bottom of the glass (sooner on the display bar)
  const fade = g.createLinearGradient(0, H * 0.15 * top, 0, H * Math.min(1, 0.85 * top + 0.15));
  fade.addColorStop(0, "rgba(0,0,0,0)"); fade.addColorStop(1, "rgba(0,0,0,1)");
  g.fillStyle = fade; g.fillRect(0, H * 0.15 * top, W, H);
  return cv;
}

// a soft blurred ellipse (contact shadow, light spill)
export function softEllipseCanvas(W = 256, H = 128, inner = 0.2, invert = false) {
  const [cv, g] = makeCanvas(W, H);
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
  if (invert) {
    g.save(); g.scale(1, H / W);
    const gi = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
    gi.addColorStop(0, "rgba(255,255,255,0)"); gi.addColorStop(inner, "rgba(255,255,255,0.15)"); gi.addColorStop(1, "rgba(255,255,255,1)");
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, W);
    g.globalCompositeOperation = "destination-out";
    const go = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
    go.addColorStop(0, "rgba(0,0,0,1)"); go.addColorStop(inner, "rgba(0,0,0,0.85)"); go.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = go; g.fillRect(0, 0, W, W);
    g.restore();
    // back onto black so the alpha lives in RGB (alphaMap reads green)
    const [c2, g2] = makeCanvas(W, H);
    g2.fillStyle = "#000"; g2.fillRect(0, 0, W, H); g2.drawImage(cv, 0, 0);
    return c2;
  }
  g.save();
  g.scale(1, H / W);
  const gr = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(inner, "rgba(255,255,255,0.85)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, W, W);
  g.restore();
  return cv;
}

// ---------- the fascia print atlas: 4096 x 1304 for the 44 x 14 cm panel ----------
// RGB = ink colour, A = ink coverage. The fascia, door and sub-panel shaders mix it over
// the metal (ink is matte paint: metalness 0, roughness 0.55 where it is).
export function drawFasciaAtlas(cv, g) {
  const grid = { sx: cv.width / 44, sy: cv.height / 14, h: 14 };
  const P = printer(g, grid);
  const ink = LOOK.ink.onAlu;
  g.clearRect(0, 0, cv.width, cv.height);
  // legends: uppercase, tracked 0.08 em, in the condensed numeric face, 0.24 cm caps for primary
  // ones and 0.2 cm for secondary ones, in full-strength ink
  const LEG = { track: 0.08, weight: 600, family: LOOK.font.numeric, alpha: 1 };
  const leg = (s, x, y, o = {}) => P.text(s.toUpperCase(), x, y, o.cap || 0.24, { ...LEG, ...o });
  const caps = (s) => (/₂/.test(s) ? s : s.toUpperCase());   // CrO₂ keeps its chemistry
  const up = (s, x, y, o = {}) => P.text(caps(s), x, y, o.cap || 0.2, { ...LEG, ...o });

  // ---- left column ----
  // a small, refined wordmark (as on the M226), over a thin printed 1 mm five-colour band
  P.text("caset", 1.0, 12.5, 0.42, { weight: 500, family: LOOK.font.brand, track: 0.06 });
  LOOK.STRIPES.forEach((c, i) => P.rect(1.0, 3.0, 12.12 - i * 0.022 - 0.02, 12.12 - i * 0.022, c, 1));
  leg("power", 1.4, 8.75);
  up("push on", 1.4, 8.42, { cap: 0.17 });
  leg("phones", 2.6, 3.65, { align: "center" });

  // ---- door plate (the door shares this atlas: its uv is panel x / 44, y / 14) ----
  // hollow arrow
  P.line([[8.2, 6.18], [9.75, 6.18], [9.75, 6.1], [10.2, 6.3], [9.75, 6.5], [9.75, 6.42], [8.2, 6.42], [8.2, 6.18]], 0.035, ink, 0.8);
  {
    g.save();
    const fam = LOOK.font.numeric;
    g.font = P.font(0.28, 500, fam);
    if ("letterSpacing" in g) g.letterSpacing = `${(0.1 * (0.28 / CAP) * grid.sy).toFixed(2)}px`;
    const a = "STEREO CASSETTE DECK  ";
    const wa = g.measureText(a).width / grid.sx;
    g.font = P.font(0.28, 700, fam);
    const wb = g.measureText("CS-86").width / grid.sx;
    g.restore();
    const x0 = 12.7 - (wa + wb) / 2;
    P.text(a, x0, 5.25, 0.28, { track: 0.1, weight: 500, family: fam, alpha: 1 });
    P.text("CS-86", x0 + wa, 5.25, 0.28, { weight: 700, track: 0.1, family: fam, alpha: 1 });
  }
  P.text("FRONT LOADING · STATION DIAL · FLUORESCENT PEAK · AUTO STOP", 12.7, 4.6, 0.2, { align: "center", track: 0.08, weight: 600, family: LOOK.font.numeric, alpha: 1, maxW: 13.2 });

  // ---- function block ----
  // NR bracket over the two push keys
  const nrY = 6.1;
  const wNR = up("NR", 31.5, nrY, { align: "center", cap: 0.22 });
  P.line([[29.75, nrY - 0.25], [29.75, nrY + 0.08], [31.5 - wNR / 2 - 0.12, nrY + 0.08]], 0.02, ink, 0.86);
  P.line([[31.5 + wNR / 2 + 0.12, nrY + 0.08], [33.25, nrY + 0.08], [33.25, nrY - 0.25]], 0.02, ink, 0.86);
  up("out · in", 30.4, 4.5, { align: "center" });
  up("B · C", 32.6, 4.5, { align: "center" });
  // mic jacks
  leg("left", 30.4, 3.5, { align: "center" });
  leg("right", 32.6, 3.5, { align: "center" });
  const wm = leg("mic", 31.5, 1.3, { align: "center" });
  P.line([[29.9, 1.85], [29.9, 1.38], [31.5 - wm / 2 - 0.12, 1.38]], 0.02, ink, 0.86);
  P.line([[31.5 + wm / 2 + 0.12, 1.38], [33.1, 1.38], [33.1, 1.85]], 0.02, ink, 0.86);
  // tape select
  leg("tape select", 35.6, 6.1, { align: "center" });
  const ts = [["Normal", 34.55], ["CrO₂", 35.6], ["Metal", 36.65]];
  for (const [s, x] of ts) up(s, x, 5.4, { align: "center", cap: 0.17, track: 0.04 });
  // leader ticks from each legend down toward the knob rim
  P.line([[34.55, 5.25], [34.75, 4.75]], 0.018, ink, 0.8);
  P.line([[35.6, 5.25], [35.6, 4.65]], 0.018, ink, 0.8);
  P.line([[36.65, 5.25], [36.45, 4.75]], 0.018, ink, 0.8);
  // big knob scale: 0..10 over -135..+135 degrees
  const KX = 40.4, KY = 3.6;
  for (let i = 0; i <= 50; i++) {
    const a = (-135 + (270 * i) / 50) * Math.PI / 180;
    const major = i % 5 === 0;
    const r0 = major ? 2.33 : 2.4, r1 = 2.55;
    P.line([[KX + Math.sin(a) * r0, KY + Math.cos(a) * r0], [KX + Math.sin(a) * r1, KY + Math.cos(a) * r1]], major ? 0.025 : 0.014, ink, 0.86);
    if (major) {
      const n = i / 5;
      P.text(String(n), KX + Math.sin(a) * 2.86, KY + Math.cos(a) * 2.86 - 0.11, 0.22, { align: "center", track: 0, family: LOOK.font.numeric });
    }
  }
  leg("output level", 43.3, 6.35, { align: "right" });
  // balance mark and the generic NR badge, bottom right
  P.text("L", 37.0, 0.9, 0.2, { align: "center", ...LEG });
  P.line([[37.25, 1.0], [37.75, 1.0]], 0.018, ink, 0.86);
  g.save(); g.globalAlpha = 0.86; g.strokeStyle = ink; g.lineWidth = 0.02 * grid.sy;
  g.beginPath(); g.arc(P.X(37.85), P.Y(1.0), 0.1 * grid.sx, 0, Math.PI * 2); g.stroke(); g.restore();
  P.line([[37.95, 1.0], [38.45, 1.0]], 0.018, ink, 0.86);
  P.text("R", 38.7, 0.9, 0.2, { align: "center", ...LEG });
  {
    const bx0 = 40.9, bx1 = 43.45, by0 = 0.55, by1 = 1.0;
    P.line([[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1], [bx0, by0]], 0.02, ink, 0.9);
    up("NR SYSTEM B·C", (bx0 + bx1) / 2, 0.69, { align: "center", cap: 0.16, track: 0.08 });
  }
  return grid;
}

// ---------- the display-bar backplate print (matte black, warm grey ink) ----------
// covers panel x 20.2..43.6, y 7.0..13.2
export function drawBackplate(cv, g) {
  const x0 = 20.2, y0 = 7.0, W = 23.4, H = 6.2;
  const grid = { sx: cv.width / W, sy: cv.height / H, h: H };
  const P = printer(g, grid);
  const C = LOOK.ink.onBlack, D = LOOK.ink.onBlackDim;
  const lx = (x) => x - x0, ly = (y) => y - y0;
  const o = { color: C, alpha: 1 };
  g.fillStyle = "#fff"; // the material colour carries the black; white = no change
  g.fillRect(0, 0, cv.width, cv.height);
  // matte black base drawn into the map itself
  g.fillStyle = "#1a1817";
  g.fillRect(0, 0, cv.width, cv.height);
  const cap = { ...o, align: "center", weight: 600, family: LOOK.font.numeric, track: 0.1 };
  P.text("TAPE COUNTER", lx(22.2), ly(10.82), 0.17, cap);
  P.text("SIDE · TRACK · TIME", lx(26.3), ly(10.82), 0.17, cap);
  P.text("FUNCTION", lx(24.6), ly(7.1), 0.16, cap);
  P.text("FLUORESCENT PEAK METER", lx(36.1), ly(7.1), 0.16, cap);
  // hairline rules under the captions (as in the M226 close-up)
  P.line([[lx(21.9), ly(10.68)], [lx(22.5), ly(10.68)]], 0.012, C);
  P.line([[lx(26.0), ly(10.68)], [lx(26.6), ly(10.68)]], 0.012, C);
  // vertical divider between readouts and meters
  P.line([[lx(28.75), ly(7.3)], [lx(28.75), ly(12.9)]], 0.012, D);
  // fine warm frame around the meter field
  P.line([[lx(28.95), ly(7.32)], [lx(43.4), ly(7.32)], [lx(43.4), ly(12.95)], [lx(28.95), ly(12.95)], [lx(28.95), ly(7.32)]], 0.01, "#6f6556", 0.8);
  return grid;
}

// a key legend (per key, redrawn on language change), in tracked capitals. `band`: white on a
// black anodised strip (the transport keys, as the dark legend strips of the M226), otherwise
// dark ink on the metal; `rule`: a coloured rule under the text (green over the tape-moving keys)
export function drawLegend(g, w, h, text, { rule = null, band = false } = {}) {
  g.clearRect(0, 0, w, h);
  text = String(text || "").toUpperCase();
  let fs = h * (band ? 0.5 : 0.62);
  const font = (px) => `600 ${px}px ${LOOK.font.numeric}`;
  g.font = font(fs);
  if ("letterSpacing" in g) g.letterSpacing = `${(fs * 0.1).toFixed(2)}px`;
  const pad = band ? h * 0.18 : 2;
  const maxW = w - pad * 2;
  while (fs > h * 0.3 && g.measureText(text).width > maxW) {
    fs -= 1; g.font = font(fs);
    if ("letterSpacing" in g) g.letterSpacing = `${(fs * 0.1).toFixed(2)}px`;
  }
  if (band) {
    g.globalAlpha = 1;
    g.fillStyle = "#121110";
    const bh = h * (rule ? 0.76 : 0.88);
    g.beginPath();
    if (g.roundRect) g.roundRect(0, 0, w, bh, h * 0.08); else g.rect(0, 0, w, bh);
    g.fill();
    g.fillStyle = "#ebe6dc";
    g.textBaseline = "middle";
    g.fillText(text, pad, bh * 0.54, maxW);
  } else {
    g.globalAlpha = 1;
    g.fillStyle = LOOK.ink.onAlu;
    g.textBaseline = "alphabetic";
    g.fillText(text, pad, h * 0.66, maxW);
  }
  // the rule runs the width of the key, under its legend
  if (rule) {
    g.globalAlpha = 0.95;
    g.fillStyle = rule;
    g.fillRect(0, h * 0.84, w, Math.max(2, h * 0.1));
  }
}

// the glyph printed on a key cap: near-black ink with a faint light edge below (it reads as
// pressed into the anodising), centred
export function drawGlyph(g, w, h, action) {
  g.clearRect(0, 0, w, h);
  const s = h * 0.46, cx = w / 2, cy = h / 2;
  const tri = (x, y, tw, th, dir) => {
    g.moveTo(x - (tw / 2) * dir, y - th / 2);
    g.lineTo(x + (tw / 2) * dir, y);
    g.lineTo(x - (tw / 2) * dir, y + th / 2);
    g.closePath();
  };
  const path = (dy) => {
    g.beginPath();
    const y = cy + dy;
    if (action === "play") tri(cx, y, s * 0.8, s * 0.9, 1);
    else if (action === "rewind") { tri(cx - s * 0.36, y, s * 0.7, s * 0.8, -1); tri(cx + s * 0.36, y, s * 0.7, s * 0.8, -1); }
    else if (action === "forward") { tri(cx - s * 0.36, y, s * 0.7, s * 0.8, 1); tri(cx + s * 0.36, y, s * 0.7, s * 0.8, 1); }
    else if (action === "stop") g.rect(cx - s * 0.38, y - s * 0.38, s * 0.76, s * 0.76);
    else if (action === "eject") {
      g.moveTo(cx - s * 0.5, y + s * 0.08); g.lineTo(cx, y - s * 0.48); g.lineTo(cx + s * 0.5, y + s * 0.08); g.closePath();
      g.rect(cx - s * 0.5, y + s * 0.24, s, s * 0.2);
    } else if (action === "flip") {
      // two opposed arrows
      tri(cx - s * 0.32, y - s * 0.05, s * 0.5, s * 0.7, -1);
      g.rect(cx - s * 0.12, y - s * 0.12, s * 0.5, s * 0.14);
      tri(cx + s * 0.32, y + s * 0.25, s * 0.5, s * 0.7, 1);
      g.rect(cx - s * 0.38, y + s * 0.18, s * 0.5, s * 0.14);
    }
  };
  if (!action) return;
  const d = Math.max(1, h * 0.012);
  g.fillStyle = "rgba(255,255,255,0.55)"; path(d); g.fill();
  g.fillStyle = "rgba(24,23,21,0.9)"; path(0); g.fill();
}
