// Shared helpers for the display instruments: tokens with fallbacks, canvas text, seeded noise,
// texture setup and the GLSL tail every ShaderMaterial ends with. No three.js import: THREE is
// always passed in by createDisplays.

// §9.2 LOOK.display, used when look.js does not (yet) carry a value.
export const DISPLAY_DEFAULTS = {
  vuZeroDbfs: -24, vfdZeroDbfs: -15, vuEma: 9,
  vuPaper: "#f4e3b6", vuPaperEdge: "#ddc28c", vuInk: "#1d1712", vuRed: "#c8321e",
  vuLamp: [1.0, 0.60, 0.24], vuLampR: [1.0, 0.58, 0.22], vuLampOn: 2.1, vuLampEmpty: 0.45,
  vuOmega: 19, vuZeta: 0.80, vuOmegaR: 18.2, vuZetaR: 0.78,
  vfdWhite: "#c8fff0", vfdAmber: "#ffb347", vfdAmberHot: "#ff7a1a", vfdGhost: "#1c3a3a", vfdFilter: "#0a1418",
  vfdLit: 5.0, vfdLitAmber: 5.2, vfdLegend: 1.5, vfdGhostLevel: 0.02, vfdHalo: 0.07, vfdPrint: 0.75,
  vfdHold: 1.4, vfdHoldFall: 20, vfdRelease: 13.3, vfdTailFall: 60,
  led: "#ff2a1c", ledLit: 4.6, ledGhost: 0.03, ledFilter: "#2a0605",
  dialLamp: "#fff1d8", dialLampOn: 1.7, dialLampEmpty: 0.15, dialInk: "#2a2420",
  dialStation: "#c8321e", needle: "#ff6a1f", needleLit: 3.4, tuned: "#7dffa0",
  lampPlay: "#ff4a1c", lampCue: "#ffb347", lampOn: 4.6, lampOff: 0.05,
  cueWindow: "#e9f1ee", cueLamp: "#ffb347", cueIdle: 0.16, cueOn: 3.0,
  drumBg: "#0c0b0a", drumInk: "#f4ecda", drumGlow: 0.22,
};

const FONT_DEFAULTS = {
  brand: `Futura, "Futura PT", "Century Gothic", "Avenir Next", "Trebuchet MS", system-ui, sans-serif`,
  panel: `"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif`,
  numeric: `"DIN Alternate", "DIN Condensed", "Avenir Next Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif`,
  serif: `Georgia, "Times New Roman", serif`,
  mono: `ui-monospace, "SF Mono", Menlo, Consolas, monospace`,
};

const INK_DEFAULTS = { onAlu: "#2a2725", onBlack: "#9a9286", onBlackDim: "#5f5a52", red: "#c8321e", paper: "#efe4cc", paperInk: "#221a15" };

export function tokens(LOOK) {
  const L = LOOK || {};
  return {
    D: Object.assign({}, DISPLAY_DEFAULTS, L.display || {}),
    font: Object.assign({}, FONT_DEFAULTS, L.font || {}),
    ink: Object.assign({}, INK_DEFAULTS, L.ink || {}),
    stripes: L.STRIPES || ["#e2582b", "#e3b03a", "#8a8b3b", "#3d8d8c", "#33506b"],
  };
}

// Seeded PRNG (mulberry32), so every load paints the same paper grain and the same unevenness.
export function prng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 1D value noise and fbm in [-1, 1], allocation-free (used every frame for cue chatter and hiss).
function h1(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return h1(i) * (1 - u) + h1(i + 1) * u;
}
export function fbm(x) {
  const v = vnoise(x) * 0.5333 + vnoise(x * 2.03 + 17.1) * 0.2667 + vnoise(x * 4.11 + 41.7) * 0.1333 + vnoise(x * 8.07 + 7.3) * 0.0667;
  return v * 2 - 1;
}

export function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

// Font string for a cap height in px: Helvetica-class caps are ~0.72 em, Futura ~0.70, Georgia ~0.69.
export function fontFor(capPx, family, weight = 400, capRatio = 0.72) {
  return `${weight} ${(capPx / capRatio).toFixed(2)}px ${family}`;
}

// Draw text so it fits maxW: condense horizontally (down to 72%) before shrinking.
export function fitText(g, text, x, y, maxW, align = "left") {
  const w = g.measureText(text).width;
  let sx = 1;
  if (w > maxW && maxW > 0) sx = Math.max(0.5, maxW / w);
  g.save();
  g.translate(x, y);
  g.scale(sx, 1);
  g.textAlign = align;
  g.fillText(text, 0, 0);
  g.restore();
  return w * sx;
}

// Letter-spaced text (canvas letterSpacing is not everywhere yet).
export function spacedText(g, text, x, y, trackingPx, align = "left") {
  let total = 0;
  for (const ch of text) total += g.measureText(ch).width + trackingPx;
  total -= trackingPx;
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  const prev = g.textAlign;
  g.textAlign = "left";
  for (const ch of text) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + trackingPx; }
  g.textAlign = prev;
  return total;
}

export function canvasTexture(THREE, canvas, maxAniso, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  // data masks are opaque canvases, so premultiplying is a no-op; it also keeps Chrome off a slow
  // read-back upload path (flipY + unpremultiplied RGBA8 logs "GPU stall due to ReadPixels")
  if (!srgb) t.premultiplyAlpha = true;
  t.anisotropy = maxAniso || 1;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

// Linear-space colour from a CSS hex (ColorManagement converts sRGB -> linear working space).
export function lin(THREE, hex, k = 1) {
  return new THREE.Color(hex).multiplyScalar(k);
}

// GLSL tail: linear HDR in; renderer applies tone mapping + sRGB only when drawing to the screen
// (the deck's post chain renders to a linear half-float target, where both chunks are no-ops).
export const FRAG_TAIL = `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

export const VERT_UV = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Rounded rectangle path in the current canvas transform.
export function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Soft additive glare for a small glass cover: a diagonal sheen and a bright top edge.
export function glareCanvas(w, h, strength = 1) {
  const c = makeCanvas(w, h), g = c.getContext("2d");
  const lg = g.createLinearGradient(0, 0, w * 0.9, h);
  lg.addColorStop(0.0, `rgba(255,248,236,${0.0})`);
  lg.addColorStop(0.18, `rgba(255,248,236,${0.10 * strength})`);
  lg.addColorStop(0.30, `rgba(255,248,236,${0.02 * strength})`);
  lg.addColorStop(0.52, `rgba(255,248,236,0)`);
  lg.addColorStop(0.60, `rgba(255,248,236,${0.05 * strength})`);
  lg.addColorStop(0.66, `rgba(255,248,236,0)`);
  g.fillStyle = lg; g.fillRect(0, 0, w, h);
  const tg = g.createLinearGradient(0, 0, 0, h * 0.12);
  tg.addColorStop(0, `rgba(255,250,240,${0.22 * strength})`);
  tg.addColorStop(1, "rgba(255,250,240,0)");
  g.fillStyle = tg; g.fillRect(0, 0, w, h * 0.12);
  return c;
}

export function rampTo(cur, target, rate, dt) {
  if (cur < target) return Math.min(target, cur + rate * dt);
  if (cur > target) return Math.max(target, cur - rate * dt);
  return cur;
}

// Four inner walls of a rectangular window, from z = 0 back to z = -d. uv.y = 0 at the front,
// 1 at the back, so a shader can warm the walls toward a backlit face.
export function tunnelGeometry(THREE, w, h, d) {
  const x = w / 2, y = h / 2, P = [], U = [];
  const quad = (ax, ay, bx, by) => {
    const v = [[ax, ay, 0], [bx, by, 0], [bx, by, -d], [ax, ay, -d]];
    const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (const i of [0, 1, 2, 0, 2, 3]) { P.push(v[i][0], v[i][1], v[i][2]); U.push(uv[i][0], uv[i][1]); }
  };
  quad(-x, -y, x, -y); quad(x, -y, x, y); quad(x, y, -x, y); quad(-x, y, -x, -y);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  geo.computeVertexNormals();
  return geo;
}
