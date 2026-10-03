// The transport keys as HTML buttons. With a 3D deck they are invisible and laid exactly
// over the 3D keys (so clicks, focus and screen readers work); without one they are the
// visible controls. Also the keyboard shortcuts.
import { t as words } from "../core/i18n.js";

export function createKeys({ slot, player, getDeck }) {
  const buttons = new Map([...slot.querySelectorAll(".key")].map((b) => [b.dataset.action, b]));

  for (const [action, b] of buttons) {
    b.addEventListener("click", (e) => {
      if (e.detail > 0) b.blur();
      player.press(action);
    });
  }
  player.on("latch", (latched) => {
    for (const [a, b] of buttons) {
      if (b.hasAttribute("aria-pressed")) b.setAttribute("aria-pressed", String(a === latched));
    }
  });

  // key names follow the language, on the HTML buttons and on the 3D key tops
  function updateLabels() {
    const L = words();
    for (const [action, b] of buttons) {
      if (action === "flip") continue;
      b.querySelector(".key-lbl").textContent = L.keys[action];
      getDeck()?.setKeyLabel(action, L.keys[action]);
    }
    updateFlipLabel();
  }
  function updateFlipLabel() {
    const to = player.cassette && player.side === "B" ? "A" : "B";
    const label = words().sideKey(to);
    const b = buttons.get("flip");
    b.querySelector(".key-lbl").textContent = label;
    b.setAttribute("aria-label", words().flipTo(to));
    getDeck()?.setFlipLabel(label);
  }

  function place() {
    const deck = getDeck();
    if (!deck) return;
    deck.fit();
    const sr = slot.getBoundingClientRect();
    const root = document.documentElement.style;
    root.setProperty("--gx", `${Math.round(sr.left + sr.width / 2)}px`);
    root.setProperty("--gy", `${Math.round(sr.top + sr.height * 0.62)}px`);
    for (const r of deck.keyRects) {
      const b = buttons.get(r.action);
      b.style.left = `${r.x - sr.left}px`;
      b.style.top = `${r.y - sr.top}px`;
      b.style.width = `${r.w}px`;
      b.style.height = `${r.h}px`;
    }
  }
  addEventListener("resize", place);
  if ("ResizeObserver" in window) new ResizeObserver(place).observe(slot);

  // back to the plain HTML keys (the 3D deck went away)
  function unplace() {
    for (const b of buttons.values()) for (const k of ["left", "top", "width", "height"]) b.style.removeProperty(k);
  }

  addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target;
    const tag = el?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
    if (e.key === " " || e.code === "Space") {
      if (tag === "BUTTON" || tag === "A") return; // let the focused control handle it
      e.preventDefault();
      player.press(player.mode === "stop" ? "play" : "stop");
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      player.press("rewind");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      player.press("forward");
    }
  });

  return { updateLabels, updateFlipLabel, place, unplace };
}
