// Now-playing readouts outside the panel:
// - the plate caption's right half: the key hint when empty, "A1 · 0:42 / 2:54" when loaded;
// - the mini bar: shown whenever a tape is loaded and the deck has scrolled out of view (so
//   play / stop and the progress stay at hand while reading the notes or browsing the shelf).
//   Art and title scroll back to the deck; one play / stop button.
// Neither is a live region (#status is the only announcer). Text is written once a second.
import { h, fmt, createProgress } from "./dom.js";
import { copy } from "./copy.js";

export function createMini({ el, cap, slot, player, sound }) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const progress = createProgress("mini-prog");
  const art = new Image();
  art.alt = "";
  art.decoding = "async";
  art.draggable = false;
  const title = h("span", { class: "mini-title" });
  const sub = h("span", { class: "mini-sub" });
  const show = h("button", { type: "button", class: "mini-show" },
    h("span", { class: "mini-art", "aria-hidden": "true" }, art),
    h("span", { class: "mini-text" }, title, sub));
  const toggle = h("button", { type: "button", class: "mini-toggle", "aria-pressed": "false" },
    h("span", { class: "mini-ico", "aria-hidden": "true" }));
  el.replaceChildren(progress.el, show, toggle);
  let playing = false, lastSec = -1, lastIdx = -2, tapeId = null;
  const seen = { slot: true };

  show.addEventListener("click", () => {
    slot.scrollIntoView({ block: "start", behavior: reduce.matches ? "auto" : "smooth" });
  });
  toggle.addEventListener("click", () => {
    sound.unlock();
    player.press(playing ? "stop" : "play");
  });

  function visible() {
    const on = !!player.cassette && !seen.slot;
    if (el.classList.contains("is-on") !== on) {
      el.classList.toggle("is-on", on);
      el.inert = !on;
    }
  }
  el.inert = true;
  if ("IntersectionObserver" in window) {
    // the deck counts as out of view once less than a fifth of it shows
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.slot = e.isIntersecting && e.intersectionRatio >= 0.2;
      visible();
    }, { threshold: [0, 0.2] });
    io.observe(slot);
  }

  function labels() {
    const K = copy();
    el.setAttribute("aria-label", K.nowPlaying);
    show.setAttribute("aria-label", K.toDeck);
    toggle.setAttribute("aria-label", K.play);
  }

  // a tape or side went in, or the language changed
  function render() {
    labels();
    const c = player.cassette;
    lastSec = -1;
    lastIdx = -2;
    if (!c) {
      tapeId = null;
      progress.build({ tracks: [] });
      if (cap) cap.textContent = copy().plateHint();
      visible();
      return;
    }
    if (tapeId !== c.id) { art.src = c.cover; tapeId = c.id; }
    progress.build(player);
    tick();
    visible();
  }

  function tick() {
    const c = player.cassette;
    if (!c) return;
    const i = Math.max(0, player.index === -1 ? player.trackAt(player.pos) : player.index);
    const tr = player.tracks[i];
    if (!tr) return;
    const sec = Math.max(0, Math.floor(player.pos - (player.offsets[i] || 0)));
    if (sec === lastSec && i === lastIdx) return;
    if (i !== lastIdx) title.textContent = tr.title;
    lastSec = sec;
    lastIdx = i;
    const where = `${player.side}${i + 1}`;
    const clock = fmt(sec);
    sub.textContent = `${c.name} · ${where} · ${clock}`;
    if (cap) cap.textContent = `${where} · ${clock} / ${fmt(tr.dur)}`;
    progress.set(player);
  }

  player.on("time", tick);
  player.on("track", tick);
  player.on("latch", (a) => {
    playing = a === "play";
    toggle.setAttribute("aria-pressed", String(playing));
  });

  return { render };
}
