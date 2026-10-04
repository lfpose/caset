// Composition root: builds the engine, the deck view, the sound and the HTML views,
// wires them together, runs the frame loop and boots from tapes.json.
// Swap the look by replacing the views (js/ui/*, style.css) or the deck (js/deck/*);
// the engine in js/core/ stays as it is. See docs/ARCHITECTURE.md.
import { createPlayer } from "./core/player.js";
import { createRouter } from "./core/router.js";
import { setLang, phrase } from "./core/i18n.js";
import { createDeck } from "./deck/deck3d.js";
import { createSound } from "./sound.js";
import { $ } from "./ui/dom.js";
import { createShelf } from "./ui/shelf.js";
import { createLiner } from "./ui/liner.js";
import { createKeys } from "./ui/keys.js";
import { createFilm } from "./ui/film.js";
import { createMeter } from "./ui/meter.js";
import { applyCopy } from "./ui/copy.js";
import { createMini } from "./ui/mini.js";

const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
let reduceMotion = motionQuery.matches;

const canvas = $("#stage");
const slot = $("#slot");
const statusEl = $("#status");
const audio = $("#player");
const html = document.documentElement;

createFilm($(".film"));
applyCopy();
// the shelf heading's count, from the shelf itself
function counts() {
  return { tapes: player?.tapes?.length || 10 };
}

// ---------- engine, sound, deck ----------
const sound = createSound();
const player = createPlayer({ audio, sound, reduceMotion });

// ?nogl (dev): skip the 3D deck to see the plain HTML deck
const noGL = /[?&]nogl\b/.test(location.search);
let deck = null;
// a deck that cannot be built (no WebGL, or it throws) leaves the plain HTML deck
if (!noGL) {
  try {
    deck = createDeck({
      canvas, slot, reduceMotion,
      onEvent(kind) {
        if (kind === "lid") sound.clunk("lid");
        else if (kind === "lid-shut") sound.clunk("shut");
        else if (kind === "drop") sound.clunk("drop");
        else if (kind === "slide" || kind === "turn") sound.clunk("slide");
        else if (kind === "contextlost") glLost();
        else if (kind === "keys") keys?.sync();
        else if (kind === "focus") syncView();
      },
    }) || null;
  } catch (err) {
    console.error(err);
    deck = null;
  }
}
// the body class is exactly "gl" or "nogl" (the behaviour trace compares it);
// any other page state lives on <html>
let meter = null;
if (!deck) {
  canvas.remove();
  document.body.classList.add("nogl");
} else {
  document.body.classList.add("gl");
}
player.setView(deck);
// The GPU dropped the WebGL context (memory pressure, driver reset): fall back to the
// plain HTML keys for the rest of the visit rather than leave invisible buttons over a blank canvas.
function glLost() {
  deck = null;
  syncView();
  player.setView(null);
  canvas.hidden = true;
  document.body.classList.replace("gl", "nogl");
  keys.unplace();
  startMeter();
}
// the HTML instrument strip of the no-WebGL deck (optional: a failure leaves just the keys)
function startMeter() {
  if (meter) return;
  try { meter = createMeter({ slot, player }); } catch { meter = null; }
}
motionQuery.addEventListener?.("change", (e) => {
  reduceMotion = e.matches;
  deck?.setReduceMotion(reduceMotion);
  player.setReduceMotion(reduceMotion);
});

// ---------- levels (programme audio on sound.js's context; optional module) ----------
const ZERO = { l: 0, r: 0, pl: 0, pr: 0 };
let levels = null;
import("./levels.js")
  .then((m) => { levels = m.createLevels({ audio, sound }); })
  .catch(() => { levels = null; });
function readLevels() {
  if (!levels) return ZERO;
  try { return levels.read() || ZERO; } catch { levels = null; return ZERO; }
}
// is a programme reaching the meters? Not when the track's file is missing, nor while the
// element is stalled (playing, but its clock has not moved for 0.6 s). The deck's meters go
// dead then instead of faking a response (deck.setSignal, optional)
let sigAt = -1, sigStall = 0;
function signal(dt) {
  if (!player.cassette || player.mode !== "play") { sigStall = 0; sigAt = -1; return true; }
  const tr = player.tracks[Math.max(0, player.index)];
  if (!tr || player.isMissing(tr.src)) return false;
  const at = audio.currentTime;
  if (audio.paused || at === sigAt) sigStall += dt; else sigStall = 0;
  sigAt = at;
  return sigStall < 0.6;
}

// ---------- views ----------
const shelf = createShelf({ rail: $("#rail"), player, sound, slot });
const liner = createLiner({ liner: $("#liner"), body: $("#liner-body"), player, sound });
const mini = createMini({ el: $("#mini"), cap: $("#cap-r"), slot, player, sound });
var keys = createKeys({ slot, player, getDeck: () => deck });

// the camera's framing (desk, tablet, landscape): the whole deck, or eased in on the meters.
// The deck goes back to the whole view by itself on load, flip and eject.
const viewBtns = [...document.querySelectorAll(".view button")];
function syncView() {
  const f = deck?.focus || "full";
  for (const b of viewBtns) b.setAttribute("aria-pressed", String(b.dataset.view === f));
  html.classList.toggle("is-meters", f === "meters");
}
for (const b of viewBtns) b.addEventListener("click", () => { deck?.setFocus?.(b.dataset.view); syncView(); });
// a click on the deck itself, or Escape, leaves the meters view
canvas.addEventListener("click", () => { if (deck?.focus === "meters") { deck.setFocus("full"); syncView(); } });
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && deck?.focus === "meters") { deck.setFocus("full"); syncView(); }
});
const router = createRouter(player);
if (!deck) startMeter();

// page state lives on <html> (the deck tints its own studio light, see deck3d.js)
function tintRoom() {
  html.classList.toggle("is-loaded", !!player.cassette);
}
player.on("latch", (a) => { html.classList.toggle("is-playing", a === "play"); });
// the top bar gets its backdrop once the page has scrolled (a sentinel, not a scroll handler)
if ("IntersectionObserver" in window) {
  const sentinel = $(".top-sentinel");
  if (sentinel) new IntersectionObserver(([e]) => { html.classList.toggle("is-scrolled", !e.isIntersecting); }).observe(sentinel);
}

player.on("announce", (msg) => { statusEl.textContent = phrase(msg); });
player.on("deck", () => {
  shelf.update();
  liner.render();
  keys.updateFlipLabel();
  meter?.setProgram();
  mini.render();
  tintRoom();
});

for (const b of document.querySelectorAll(".lang button")) {
  b.addEventListener("click", () => {
    setLang(b.dataset.lang);
    applyCopy(counts());
    liner.render();
    shelf.update();
    mini.render();
    keys.updateLabels();
  });
}
addEventListener("pointerdown", () => sound.unlock(), { passive: true });

// ---------- loop ----------
let last = performance.now();
let raf = 0, hiddenTimer = 0;
function loop(t) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.1, Math.max(0, (t - last) / 1000));
  last = t;
  player.tick(dt);
  const lv = readLevels();
  if (deck) {
    deck.setLevels?.(lv);
    deck.setSignal?.(signal(dt));
    deck.frame(t / 1000, dt);
  } else if (meter) {
    meter.update(lv, dt);
  }
}
function onVisibility() {
  if (document.hidden) {
    cancelAnimationFrame(raf);
    raf = 0;
    last = performance.now();
    // keep the tape moving (audio keeps playing) without drawing anything
    hiddenTimer = setInterval(() => {
      const n = performance.now();
      player.tick(Math.min(1, (n - last) / 1000));
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
  let tapes;
  try {
    const r = await fetch("/tapes.json", { cache: "no-cache" });
    if (!r.ok) throw new Error(String(r.status));
    tapes = (await r.json()).filter((c) => c && c.id && c.sides?.A && c.sides?.B);
  } catch {
    tapes = [];
  }
  player.setTapes(tapes);
  applyCopy(counts());
  shelf.render();
  liner.render();
  mini.render();
  keys.updateLabels();
  keys.place();
  html.classList.add("is-booted");
  if (!document.hidden) raf = requestAnimationFrame(loop);
  else onVisibility();
  router.start();
}
boot();
