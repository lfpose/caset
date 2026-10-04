// The film stock over the whole page: one grain tile, generated once from a seeded PRNG (so
// every load looks the same) and handed to CSS as a data: URL on a custom property. CSS
// steps it at 8 fps (transform only), so the GPU stays idle when the deck does. Plain alpha,
// no blend modes: cheap over a WebGL canvas. (docs/DESIGN.md §D2.6: grain only, 0.035.)

function prng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 256² of light and dark specks; alpha is quantised to a few levels so the PNG stays small
function grainTile(rand) {
  const N = 256;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d");
  const img = g.createImageData(N, N);
  const d = img.data;
  for (let i = 0; i < N * N; i++) {
    // roughly gaussian: the sum of three uniforms, centred
    const v = rand() + rand() + rand() - 1.5;
    const a = Math.min(1, Math.abs(v) / 1.1);
    const q = Math.round(a * a * 7) / 7;          // 8 levels, most pixels near zero
    const light = v > 0;
    const o = i * 4;
    d[o] = light ? 255 : 0;
    d[o + 1] = light ? 246 : 0;
    d[o + 2] = light ? 228 : 0;
    d[o + 3] = Math.round(q * 255);
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

export function createFilm(el) {
  if (!el) return;
  try {
    el.style.setProperty("--grain", `url(${grainTile(prng(0xca5e7))})`);
    el.classList.add("is-ready");
  } catch {
    // no 2D canvas: no grain, nothing else changes
  }
}
