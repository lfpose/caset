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

const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
let reduceMotion = motionQuery.matches;

const canvas = $("#stage");
const slot = $("#slot");
const statusEl = $("#status");

// ---------- engine, sound, deck ----------
const sound = createSound();
const player = createPlayer({ audio: $("#player"), sound, reduceMotion });

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
player.setView(deck);
// The GPU dropped the WebGL context (memory pressure, driver reset): fall back to the
// plain HTML keys for the rest of the visit rather than leave invisible buttons over a blank canvas.
function glLost() {
  deck = null;
  player.setView(null);
  canvas.hidden = true;
  document.body.classList.replace("gl", "nogl");
  keys.unplace();
}
motionQuery.addEventListener?.("change", (e) => {
  reduceMotion = e.matches;
  deck?.setReduceMotion(reduceMotion);
  player.setReduceMotion(reduceMotion);
});

// ---------- views ----------
const shelf = createShelf({ rail: $("#rail"), player, sound });
const liner = createLiner({ liner: $("#liner"), body: $("#liner-body"), player });
const keys = createKeys({ slot, player, getDeck: () => deck });
const router = createRouter(player);

player.on("announce", (msg) => { statusEl.textContent = phrase(msg); });
player.on("deck", () => {
  shelf.update();
  liner.render();
  keys.updateFlipLabel();
});

for (const b of document.querySelectorAll(".lang button")) {
  b.addEventListener("click", () => {
    setLang(b.dataset.lang);
    liner.render();
    shelf.update();
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
  shelf.render();
  liner.render();
  keys.updateLabels();
  keys.place();
  if (!document.hidden) raf = requestAnimationFrame(loop);
  else onVisibility();
  router.start();
}
boot();
