import { createDeck } from "./deck3d.js";
import { createSound } from "./sound.js";

const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
let reduceMotion = motionQuery.matches;
const WIND = 16;                       // rewind / fast-forward speed, x real time
const R_MIN = 1.08, R_MAX = 2.28;      // reel pack radii, cm (for the wind whine)

const $ = (s) => document.querySelector(s);
const canvas = $("#stage");
const slot = $("#slot");
const rail = $("#rail");
const liner = $("#liner");
const linerBody = $("#liner-body");
const statusEl = $("#status");
const audio = $("#player");
const keyButtons = new Map([...document.querySelectorAll(".key")].map((b) => [b.dataset.action, b]));
const langButtons = [...document.querySelectorAll(".lang button")];

// ---------- words ----------
const T = {
  en: {
    empty: "The deck is empty.",
    pick: "Pick a tape from the shelf.",
    hint: "Space plays and stops, the arrow keys wind. Click a track to wind straight to it.",
    side: "Side",
    other: "On the other side",
    noNote: "No notes for this one yet.",
    missing: "Missing audio file",
    silent: (d) => `The tape runs silent for ${d}.`,
    trackOf: (i, n) => `track ${i} of ${n}`,
    failed: "The tapes could not be loaded. Try reloading the page.",
    credit: "Credit",
    license: "license",
    keys: { rewind: "rewind", play: "play", forward: "forward", stop: "stop", eject: "eject" },
    sideKey: (s) => `side ${s}`,
    flipTo: (s) => `Flip to side ${s}`,
    status: { play: "Playing", stop: "Stopped", rewind: "Rewinding", forward: "Fast forward", seek: "Winding", end: "End of side", eject: "Deck empty", load: (n, s) => `${n}, side ${s} loaded`, flip: (s) => `Side ${s}` },
  },
  es: {
    empty: "La casetera está vacía.",
    pick: "Elige una cinta del estante.",
    hint: "Espacio reproduce y detiene, las flechas rebobinan y adelantan. Toca una pista para ir directo a ella.",
    side: "Lado",
    other: "Al otro lado",
    noNote: "Todavía no hay notas para esta.",
    missing: "Falta el archivo de audio",
    silent: (d) => `La cinta corre en silencio durante ${d}.`,
    trackOf: (i, n) => `pista ${i} de ${n}`,
    failed: "No se pudieron cargar las cintas. Prueba recargando la página.",
    credit: "Créditos",
    license: "licencia",
    keys: { rewind: "rebobinar", play: "reproducir", forward: "adelantar", stop: "detener", eject: "expulsar" },
    sideKey: (s) => `lado ${s}`,
    flipTo: (s) => `Dar vuelta al lado ${s}`,
    status: { play: "Reproduciendo", stop: "Detenido", rewind: "Rebobinando", forward: "Adelantando", seek: "Buscando", end: "Fin del lado", eject: "Casetera vacía", load: (n, s) => `${n}, lado ${s} cargado`, flip: (s) => `Lado ${s}` },
  },
};
let lang = "en";
try {
  const saved = localStorage.getItem("caset-lang");
  if (saved === "en" || saved === "es") lang = saved;
} catch { /* storage blocked: stay in English */ }

// ---------- state ----------
let tapes = [];
const byId = new Map();
const memory = new Map();              // id -> { A: seconds, B: seconds, side }
const missing = new Set();
let cur = null;                        // cassette in the deck
let side = "A";
let tracks = [], offsets = [], total = 0;
let pos = 0;                           // seconds from the start of the side
let mode = "stop";                     // stop | play | rewind | forward | seek
let seekTarget = 0, seekSpeed = WIND;
let busy = false;                      // a mechanism animation is running
let queued = null;
let curIndex = -1;
let announcedTrack = -1;
let lastSpeed = 0;

const sound = createSound();
let deck = createDeck({
  canvas, slot, reduceMotion,
  onEvent(kind) {
    if (kind === "lid") sound.clunk("lid");
    else if (kind === "lid-shut") sound.clunk("shut");
    else if (kind === "drop") sound.clunk("drop");
    else if (kind === "slide" || kind === "turn") sound.clunk("slide");
    else if (kind === "contextlost") glLost();
  },
});
if (!deck) {
  canvas.remove();
  document.body.classList.add("nogl");
} else {
  document.body.classList.add("gl");
}
// The GPU dropped the WebGL context (memory pressure, driver reset): fall back to the
// plain HTML keys for the rest of the visit rather than leave invisible buttons over a blank canvas.
function glLost() {
  deck = null;
  canvas.hidden = true;
  document.body.classList.replace("gl", "nogl");
  for (const b of keyButtons.values()) for (const k of ["left", "top", "width", "height"]) b.style.removeProperty(k);
}
motionQuery.addEventListener?.("change", (e) => {
  reduceMotion = e.matches;
  deck?.setReduceMotion(reduceMotion);
});

// ---------- helpers ----------
function h(tag, attrs = {}, ...kids) {
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
const fmt = (s) => {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
function announce(text) { statusEl.textContent = text; }
function mem(id) {
  if (!memory.has(id)) memory.set(id, { A: 0, B: 0, side: "A" });
  return memory.get(id);
}
function savePos() {
  if (!cur) return;
  const m = mem(cur.id);
  m[side] = pos;
  m.side = side;
}
function bindSide() {
  tracks = cur ? cur.sides[side].tracks : [];
  offsets = [];
  let acc = 0;
  for (const t of tracks) { offsets.push(acc); acc += Math.max(1, Number(t.dur) || 0); }
  total = acc;
  pos = cur ? Math.min(mem(cur.id)[side], total) : 0;
  curIndex = -1;
  audioTrack = -1;
}
function trackAt(p) {
  let i = 0;
  while (i < tracks.length - 1 && p >= offsets[i + 1] - 1e-6) i++;
  return i;
}
function trackEnd(i) { return i + 1 < offsets.length ? offsets[i + 1] : total; }

// ---------- audio: one element, slaved to the tape ----------
let audioTrack = -1, audioEnded = false, waitT = 0, resyncT = 0, pendingSeek = null;
const absUrl = (src) => new URL(src, location.href).href;

audio.addEventListener("loadedmetadata", () => {
  if (pendingSeek != null) {
    try { audio.currentTime = pendingSeek; } catch { /* ignore */ }
    pendingSeek = null;
  }
});
audio.addEventListener("ended", () => { audioEnded = true; });
audio.addEventListener("error", () => {
  const t = tracks[audioTrack];
  if (t && audio.src === absUrl(t.src)) markMissing(t.src);
});

function startTrackAudio(i) {
  audioTrack = i;
  audioEnded = false;
  waitT = 0;
  const t = tracks[i];
  if (!t || missing.has(t.src)) { audio.pause(); return; }
  const local = pos - offsets[i];
  const url = absUrl(t.src);
  if (audio.src !== url) {
    pendingSeek = local;
    audio.src = url;
  } else if (audio.readyState >= 1) {
    try { audio.currentTime = local; } catch { /* ignore */ }
  } else pendingSeek = local;
  const p = audio.play();
  if (p) p.catch((err) => {
    if (err.name === "NotAllowedError") { if (mode === "play") setMode("stop"); }
    else if (err.name === "NotSupportedError") markMissing(t.src);
  });
}

function markMissing(src) {
  if (missing.has(src)) return;
  missing.add(src);
  if (tracks[curIndex]?.src === src) renderNow();
}

// Ask the worker which files exist, so a missing one runs silent without a 404.
// If that endpoint is unavailable, the media element's own error does the job.
const probed = new Set();
const probing = new Set();
const known = new Set();
function probe(c) {
  if (probed.has(c.id)) return;
  probed.add(c.id);
  probing.add(c.id);
  const q = new URLSearchParams();
  for (const s of ["A", "B"]) for (const t of c.sides[s].tracks) q.append("src", t.src);
  fetch(`/audio-status?${q}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((res) => {
      if (!res || typeof res !== "object") return;
      for (const [src, ok] of Object.entries(res)) {
        known.add(src);
        if (!ok) markMissing(src);
      }
    })
    .catch(() => {})
    .finally(() => probing.delete(c.id));
}

// ---------- transport ----------
function latchedKey() {
  if (mode === "seek") return seekTarget < pos ? "rewind" : "forward";
  return mode === "stop" ? null : mode;
}
function setMode(m) {
  mode = m;
  const latched = latchedKey();
  deck?.setLatched(latched);
  for (const [a, b] of keyButtons) {
    if (b.hasAttribute("aria-pressed")) b.setAttribute("aria-pressed", String(a === latched));
  }
  if (m === "play") { audioTrack = -1; waitT = 0; }
  else audio.pause();
  sound.setHiss(m === "play");
  if (m !== "rewind" && m !== "forward" && m !== "seek") sound.setWind(0, 0);
  if (!cur) return;
  const t = m === "play" && tracks[trackAt(pos)];
  if (t) announcedTrack = trackAt(pos);
  announce(t ? `${T[lang].status.play}: ${t.title}` : T[lang].status[m] || "");
}

function tap(action, kind = "key") {
  deck?.tap(action);
  sound.clunk(kind);
}

function press(action) {
  sound.unlock();
  if (busy) return;
  switch (action) {
    case "play":
      if (!cur || mode === "play" || pos >= total - 0.05) return tap(action);
      sound.clunk("latch");
      return setMode("play");
    case "rewind":
      if (!cur || mode === "rewind" || pos <= 0.01) return tap(action);
      sound.clunk("latch");
      return setMode("rewind");
    case "forward":
      if (!cur || mode === "forward" || pos >= total - 0.01) return tap(action);
      sound.clunk("latch");
      return setMode("forward");
    case "stop":
      tap(action);
      if (mode !== "stop") setMode("stop");
      return;
    case "flip": return flip();
    case "eject": return eject();
  }
}

function endOfSide(auto = true) {
  pos = total;
  setMode("stop");
  if (auto) sound.clunk("key");
  announce(T[lang].status.end);
}

function seekTo(i) {
  sound.unlock();
  if (!cur || busy || !tracks[i]) return;
  const target = offsets[i];
  if (Math.abs(target - pos) < 0.25) {
    pos = target;
    if (mode === "play") startTrackAudio(i);
    else { sound.clunk("latch"); setMode("play"); }
    return;
  }
  sound.clunk("latch");
  seekTarget = target;
  seekSpeed = Math.max(WIND, Math.abs(target - pos) / 2.2);
  setMode("seek");
}

function transport(dt) {
  let speed = 0;
  if (cur && !busy) {
    if (mode === "play") speed = tickPlay(dt);
    else if (mode === "rewind") {
      pos -= WIND * dt; speed = -WIND;
      if (pos <= 0) { pos = 0; setMode("stop"); sound.clunk("key"); }
    } else if (mode === "forward") {
      pos += WIND * dt; speed = WIND;
      if (pos >= total) endOfSide();
    } else if (mode === "seek") {
      const d = seekTarget - pos, step = seekSpeed * dt;
      if (Math.abs(d) <= step) {
        pos = seekTarget;
        sound.clunk("latch");
        setMode("play");
      } else { pos += Math.sign(d) * step; speed = Math.sign(d) * seekSpeed; }
    }
  }
  const frac = total > 0 ? pos / total : 0;
  if (speed !== 0 && mode !== "play") {
    const f = frac;
    const take = speed > 0 ? Math.sqrt(R_MIN ** 2 + (R_MAX ** 2 - R_MIN ** 2) * f) : Math.sqrt(R_MAX ** 2 + (R_MIN ** 2 - R_MAX ** 2) * f);
    sound.setWind(1, Math.min(15, (Math.abs(speed) * 4.76) / take));
  } else if (lastSpeed !== 0 && mode !== "play") sound.setWind(0, 0);
  lastSpeed = speed;
  deck?.setTape(frac, speed, dt, pos);
  if (cur) {
    const i = trackAt(pos);
    if (i !== curIndex) {
      // a new track while playing is announced once (not while winding past tracks)
      if (mode === "play" && curIndex !== -1 && i !== announcedTrack) {
        announcedTrack = i;
        announce(`${tracks[i].title}, ${T[lang].trackOf(i + 1, tracks.length)}`);
      }
      curIndex = i;
      renderNow();
      updateHash();
    }
    updateTime();
  }
}

function tickPlay(dt) {
  if (pos >= total - 1e-3) { endOfSide(); return 0; }
  const i = trackAt(pos);
  const t = tracks[i];
  if (i !== audioTrack) {
    // wait (briefly) for the file check so a missing file is never requested
    if (probing.has(cur.id) && !known.has(t.src) && waitT < 2) { waitT += dt; return 0; }
    startTrackAudio(i);
  }
  const end = trackEnd(i);
  let moving = true;
  if (missing.has(t.src) || audioEnded) pos += dt;
  else if (!audio.paused && !audio.seeking && audio.readyState >= 3) {
    waitT = 0;
    const at = offsets[i] + audio.currentTime;
    if (Math.abs(at - pos) < 0.75) pos = Math.max(pos, at);
    else {
      // the audio drifted from the tape (a seek that did not take): tape leads, audio follows
      pos += dt;
      resyncT += dt;
      if (resyncT > 0.5) {
        resyncT = 0;
        try { audio.currentTime = pos - offsets[i]; } catch { /* not seekable yet */ }
      }
    }
  } else {
    // still buffering: hold the tape briefly, then run on regardless
    waitT += dt;
    if (waitT > 3) pos += dt; else moving = false;
  }
  if (pos >= end - 1e-6) {
    pos = end;
    if (i === tracks.length - 1) { endOfSide(); return 0; }
    audio.pause();
    audioTrack = -1;
  }
  return moving ? 1 : 0;
}

// ---------- mechanism ----------
// key names follow the language, on the HTML buttons and on the 3D key tops
function updateKeyLabels() {
  const L = T[lang];
  for (const [action, b] of keyButtons) {
    if (action === "flip") continue;
    b.querySelector(".key-lbl").textContent = L.keys[action];
    deck?.setKeyLabel(action, L.keys[action]);
  }
  updateFlipLabel();
}
function updateFlipLabel() {
  const to = cur && side === "B" ? "A" : "B";
  const label = T[lang].sideKey(to);
  const b = keyButtons.get("flip");
  b.querySelector(".key-lbl").textContent = label;
  b.setAttribute("aria-label", T[lang].flipTo(to));
  deck?.setFlipLabel(label);
}

async function flip() {
  if (!cur) return tap("flip");
  tap("flip");
  savePos();
  if (mode !== "stop") setMode("stop");
  busy = true;
  const to = side === "A" ? "B" : "A";
  const swap = () => {
    side = to;
    mem(cur.id).side = to;
    bindSide();
    renderLiner();
    updateFlipLabel();
  };
  try {
    if (deck) await deck.flip(to, swap); else swap();
  } finally {
    busy = false;
  }
  updateHash();
  announce(T[lang].status.flip(side));
  runQueued(); // a tape picked (or a link followed) while the cassette was turning
}

async function eject() {
  queued = null; // eject means an empty deck: never let an older request load after it
  if (!cur) return tap("eject");
  tap("eject");
  savePos();
  if (mode !== "stop") setMode("stop");
  busy = true;
  try { if (deck) await deck.eject(); } finally { busy = false; }
  cur = null;
  bindSide();
  renderShelfState();
  renderLiner();
  updateHash();
  updateFlipLabel();
  announce(T[lang].status.eject);
  runQueued();
}

async function loadCassette(id, opts = {}) {
  const c = byId.get(id);
  if (!c) return;
  if (busy) { queued = { id, ...opts }; return; }
  const wantSide = opts.side || mem(id).side || "A";
  if (cur && cur.id === id && opts.track == null && wantSide === side) return;
  if (cur && cur.id === id) {
    // same tape: just move to the requested side and track
    if (wantSide !== side) { await flip(); }
    if (busy || cur !== c) return; // something queued during the flip has taken over
    if (opts.track != null) { pos = offsets[Math.min(opts.track, tracks.length - 1)] || 0; audioTrack = -1; }
    return;
  }
  probe(c);
  savePos();
  if (mode !== "stop") setMode("stop");
  busy = true;
  const swap = () => {
    cur = c;
    side = wantSide;
    const m = mem(c.id);
    m.side = side;
    if (opts.track != null) {
      tracks = c.sides[side].tracks;
      let acc = 0;
      for (let k = 0; k < Math.min(opts.track, tracks.length - 1); k++) acc += Math.max(1, Number(tracks[k].dur) || 0);
      m[side] = acc;
    }
    bindSide();
    renderShelfState();
    renderLiner();
    updateFlipLabel();
  };
  try {
    if (deck && !reduceMotion) await deck.load(c, wantSide, swap);
    else { swap(); deck?.setCassette(c, wantSide); }
  } finally {
    busy = false;
  }
  updateHash();
  announce(T[lang].status.load(c.name, side));
  runQueued();
}
function runQueued() {
  if (!queued) return;
  const q = queued;
  queued = null;
  loadCassette(q.id, q);
}

// ---------- URL ----------
let lastHash = null;
function updateHash() {
  let hash = "";
  if (cur) hash = `#${cur.id}/${side.toLowerCase()}/${Math.max(0, curIndex) + 1}`;
  const t = cur && tracks[Math.max(0, curIndex)];
  const title = t ? `${t.title} · ${cur.name} · caset` : "caset";
  if (document.title !== title) document.title = title;
  if (hash === lastHash) return;
  lastHash = hash;
  try { history.replaceState(null, "", hash || location.pathname + location.search); } catch { /* ignore */ }
}
// no decoding needed: the pattern has nothing that could be percent-encoded
function parseHash() {
  const m = /^#([a-z0-9-]+)\/([ab])\/(\d+)$/i.exec(location.hash);
  if (!m) return null;
  const id = m[1].toLowerCase();
  const c = byId.get(id);
  if (!c) return null;
  const s = m[2].toUpperCase();
  const n = Math.max(1, Math.min(c.sides[s].tracks.length, parseInt(m[3], 10)));
  return { id, side: s, track: n - 1 };
}
// put the address bar back in step with the deck (after a link it could not use)
function canonicalHash() {
  lastHash = null;
  updateHash();
}
addEventListener("hashchange", () => {
  const want = parseHash();
  if (!want) return canonicalHash();
  if (cur && cur.id === want.id && side === want.side && curIndex === want.track) return canonicalHash();
  if (mode !== "stop") setMode("stop");
  loadCassette(want.id, want);
});

// ---------- shelf ----------
function renderShelf() {
  rail.replaceChildren(...tapes.map((c) => {
    const img = new Image();
    img.alt = "";
    img.decoding = "async";
    img.draggable = false;
    const b = h("button", {
      type: "button", class: "case", "data-id": c.id, "aria-pressed": "false",
      "aria-label": `${c.name}: ${sideLabel(c.sides.A)} / ${sideLabel(c.sides.B)}`,
    },
      h("span", { class: "case-body", "aria-hidden": "true" },
        h("span", { class: "jcard" },
          h("span", { class: "jc-art" }, img),
          h("span", { class: "fallback" },
            h("span", { class: "fb-name", text: c.name }),
            h("span", { class: "fb-stripes" }, h("i"), h("i"), h("i"), h("i"), h("i")))),
        h("span", { class: "case-shine" })),
      h("span", { class: "case-name", "aria-hidden": "true", text: c.name }));
    b.style.setProperty("--tape", c.color);
    img.addEventListener("error", () => b.classList.add("nocover"));
    img.addEventListener("load", () => b.classList.add("hascover"));
    img.src = c.cover;
    b.addEventListener("click", (e) => {
      sound.unlock();
      if (e.detail > 0) b.blur();
      loadCassette(c.id);
    });
    return h("li", {}, b);
  }));
}
function renderShelfState() {
  for (const b of rail.querySelectorAll(".case")) {
    const on = !!cur && b.dataset.id === cur.id;
    b.setAttribute("aria-pressed", String(on));
    const c = byId.get(b.dataset.id);
    if (c) b.setAttribute("aria-label", `${c.name}: ${sideLabel(c.sides.A)} / ${sideLabel(c.sides.B)}`);
  }
}

// ---------- liner card ----------
const sideLabel = (sd) => (lang === "es" && sd.label_es) || sd.label;
let timeEl = null, lastTimeText = "", lastTimeSec = -1;
// whichever ink reads better on the tape colour (WCAG contrast), for the liner spine
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
function inkFor(hex) {
  const DARK = "#0b0806", LIGHT = "#fbf6ea";
  const l = luminance(hex);
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return ratio(l, luminance(DARK)) >= ratio(l, luminance(LIGHT)) ? DARK : LIGHT;
}
function renderLiner() {
  const L = T[lang];
  document.documentElement.lang = lang;
  liner.lang = lang;
  for (const b of langButtons) b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
  timeEl = null;
  lastTimeText = "";
  if (!tapes.length) {
    linerBody.replaceChildren(h("div", { class: "empty" }, h("p", { class: "empty-title", text: L.failed })));
    return;
  }
  if (!cur) {
    liner.style.removeProperty("--tape");
    linerBody.replaceChildren(h("div", { class: "empty" },
      h("p", { class: "empty-title", text: L.empty }),
      h("p", { text: L.pick }),
      h("p", { class: "hint", text: L.hint })));
    return;
  }
  const sd = cur.sides[side];
  const other = cur.sides[side === "A" ? "B" : "A"];
  liner.style.setProperty("--tape", cur.color);
  liner.style.setProperty("--tape-ink", inkFor(cur.color));
  const list = h("ol", { class: "tracks" }, ...tracks.map((t, i) => {
    const b = h("button", { type: "button", class: "track", "data-i": String(i) },
      h("span", { class: "tn", text: String(i + 1) }),
      h("span", { class: "tt" },
        h("span", { class: "tt-title", text: t.title }),
        h("span", { class: "tt-who", text: [t.who, t.date].filter(Boolean).join(", ") })),
      h("span", { class: "td", text: fmt(t.dur) }));
    b.addEventListener("click", (e) => { if (e.detail > 0) b.blur(); seekTo(i); });
    return h("li", {}, b);
  }));
  linerBody.replaceChildren(
    h("header", { class: "spine" },
      h("span", { class: "spine-side", text: side }),
      h("span", { class: "spine-text" },
        h("span", { class: "spine-name", text: cur.name }),
        h("span", { class: "spine-label", text: `${L.side} ${side} · ${sideLabel(sd)}` }))),
    list,
    h("p", { class: "flipside", text: `${L.other}: ${sideLabel(other)}` }),
    // not a live region: the clock in here changes every second; #status announces instead
    h("section", { class: "now", id: "now" }));
  renderNow();
}
function renderNow() {
  const now = $("#now");
  if (!now || !cur) return;
  const L = T[lang];
  for (const b of linerBody.querySelectorAll(".track")) {
    if (Number(b.dataset.i) === curIndex) b.setAttribute("aria-current", "true");
    else b.removeAttribute("aria-current");
  }
  const i = Math.max(0, curIndex === -1 ? trackAt(pos) : curIndex);
  const t = tracks[i];
  if (!t) { now.replaceChildren(); return; }
  const note = (lang === "es" ? t.note_es || t.note : t.note) || "";
  const noteLang = lang === "es" && !t.note_es ? "en" : null; // an English fallback is read as English
  let credit = null;
  if (t.credit) {
    credit = h("p", { class: "now-credit" }, h("span", { text: `${L.credit}: ${t.credit}` }));
    if (/^https:\/\//.test(t.license_url || "")) {
      credit.append(" · ", h("a", { href: t.license_url, rel: "license noopener noreferrer", target: "_blank", lang: "en", text: L.license }));
    }
  }
  timeEl = h("span", { class: "tnum" });
  lastTimeText = "";
  now.replaceChildren(...[
    h("p", { class: "now-pos" }, timeEl, h("span", { text: ` / ${fmt(t.dur)} · ${L.trackOf(i + 1, tracks.length)}` })),
    h("h3", { class: "now-title", text: t.title }),
    h("p", { class: "now-meta", text: [t.who, t.date, t.place].filter(Boolean).join(" · ") }),
    note ? h("p", { class: "now-note", lang: noteLang, text: note }) : h("p", { class: "now-note is-empty", text: L.noNote }),
    credit,
    missing.has(t.src)
      ? h("p", { class: "missing", role: "note" },
          h("strong", { text: L.missing }), h("code", { text: t.src }), h("span", { text: L.silent(fmt(t.dur)) }))
      : null,
  ].filter(Boolean));
  updateTime();
}
function updateTime() {
  if (!timeEl || !cur) return;
  const i = Math.max(0, curIndex);
  const sec = Math.max(0, Math.floor(pos - (offsets[i] || 0)));
  if (sec === lastTimeSec && lastTimeText) return; // no string work unless the second changed
  lastTimeSec = sec;
  lastTimeText = fmt(sec);
  timeEl.textContent = lastTimeText;
}

for (const b of langButtons) {
  b.addEventListener("click", () => {
    lang = b.dataset.lang;
    try { localStorage.setItem("caset-lang", lang); } catch { /* ignore */ }
    renderLiner();
    renderShelfState();
    updateKeyLabels();
  });
}

// ---------- keys: HTML buttons laid over the 3D keys ----------
for (const [action, b] of keyButtons) {
  b.addEventListener("click", (e) => {
    if (e.detail > 0) b.blur();
    press(action);
  });
}
function placeKeys() {
  if (!deck) return;
  deck.fit();
  const sr = slot.getBoundingClientRect();
  const root = document.documentElement.style;
  root.setProperty("--gx", `${Math.round(sr.left + sr.width / 2)}px`);
  root.setProperty("--gy", `${Math.round(sr.top + sr.height * 0.62)}px`);
  for (const r of deck.keyRects) {
    const b = keyButtons.get(r.action);
    b.style.left = `${r.x - sr.left}px`;
    b.style.top = `${r.y - sr.top}px`;
    b.style.width = `${r.w}px`;
    b.style.height = `${r.h}px`;
  }
}
addEventListener("resize", placeKeys);
if ("ResizeObserver" in window) new ResizeObserver(placeKeys).observe(slot);

addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const el = e.target;
  const tag = el?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
  if (e.key === " " || e.code === "Space") {
    if (tag === "BUTTON" || tag === "A") return; // let the focused control handle it
    e.preventDefault();
    press(mode === "stop" ? "play" : "stop");
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    press("rewind");
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    press("forward");
  }
});
addEventListener("pointerdown", () => sound.unlock(), { passive: true });

// ---------- loop ----------
let last = performance.now();
let raf = 0, hiddenTimer = 0;
function loop(t) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.1, Math.max(0, (t - last) / 1000));
  last = t;
  transport(dt);
  deck?.frame(t / 1000, dt);
}
function onVisibility() {
  if (document.hidden) {
    cancelAnimationFrame(raf);
    raf = 0;
    last = performance.now();
    // keep the tape moving (audio keeps playing) without drawing anything
    hiddenTimer = setInterval(() => {
      const n = performance.now();
      transport(Math.min(1, (n - last) / 1000));
      last = n;
    }, 250);
  } else {
    clearInterval(hiddenTimer);
    last = performance.now();
    if (!raf) raf = requestAnimationFrame(loop);
  }
}
document.addEventListener("visibilitychange", onVisibility);

// ---------- boot ----------
async function boot() {
  try {
    const r = await fetch("/tapes.json", { cache: "no-cache" });
    if (!r.ok) throw new Error(String(r.status));
    tapes = (await r.json()).filter((c) => c && c.id && c.sides?.A && c.sides?.B);
  } catch {
    tapes = [];
  }
  for (const c of tapes) byId.set(c.id, c);
  renderShelf();
  renderLiner();
  updateKeyLabels();
  placeKeys();
  if (!document.hidden) raf = requestAnimationFrame(loop);
  else onVisibility();
  const want = parseHash();
  if (want) loadCassette(want.id, want);
  else if (location.hash) canonicalHash();
}
boot();
