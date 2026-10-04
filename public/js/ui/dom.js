// Small DOM and formatting helpers shared by the views.
export const $ = (s) => document.querySelector(s);

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids) if (kid != null) el.append(kid);
  return el;
}

export const fmt = (s) => {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// whichever ink reads better on a colour (WCAG contrast)
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
export function inkFor(hex, dark = "#0b0806", light = "#fbf6ea") {
  const l = luminance(hex);
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return ratio(l, luminance(dark)) >= ratio(l, luminance(light)) ? dark : light;
}

// a tape colour as text: mixed toward bone until it reads at 4.5:1 or better on `bg`
export function readable(hex, bg = "#25201a", ink = "#f0e6d2") {
  const p = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
  const a = p(hex), b = p(ink);
  const lb = luminance(bg);
  for (let k = 0; k <= 1.0001; k += 0.05) {
    const m = a.map((v, i) => Math.round(v + (b[i] - v) * k));
    const out = "#" + m.map((v) => v.toString(16).padStart(2, "0")).join("");
    const l = luminance(out);
    if ((Math.max(l, lb) + 0.05) / (Math.min(l, lb) + 0.05) >= 4.5) return out;
  }
  return ink;
}

// total seconds of a side
export const sideSeconds = (sd) => (sd?.tracks || []).reduce((a, t) => a + Math.max(0, Number(t.dur) || 0), 0);

// the side's progress bar: one segment per track, sized by its length, elapsed filled with
// scaleX. set() writes only the segments whose value changed (call it once a second).
export function createProgress(cls) {
  const el = h("span", { class: `prog ${cls}`, "aria-hidden": "true" });
  let fills = [], vals = [];
  return {
    el,
    build(player) {
      const tracks = player.tracks || [];
      fills = tracks.map(() => h("b"));
      vals = tracks.map(() => -1);
      el.replaceChildren(...tracks.map((t, i) => {
        const seg = h("i", {}, fills[i]);
        seg.style.flexGrow = String(Math.max(1, Number(t.dur) || 0));
        return seg;
      }));
    },
    set(player) {
      const pos = player.pos, off = player.offsets, tracks = player.tracks;
      if (!tracks || !fills.length) return;
      const i = player.trackAt(pos);
      for (let k = 0; k < fills.length; k++) {
        const d = Math.max(1, Number(tracks[k]?.dur) || 0);
        const v = k < i ? 1 : k > i ? 0 : Math.round(Math.min(1, Math.max(0, (pos - (off[k] || 0)) / d)) * 1000) / 1000;
        if (vals[k] !== v) { vals[k] = v; fills[k].style.transform = `scaleX(${v})`; }
      }
    },
  };
}
