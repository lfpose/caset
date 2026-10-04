// The transport keys as HTML buttons. With a 3D deck on a desk they are invisible and laid
// exactly over the 3D keys (so clicks, focus and screen readers work). On phones and touch
// screens they are docked: a flat bar of 56 px keys under the deck (html.is-dock), because the
// 3D keys are too small to hit there; the 3D keys still move with them. Without a deck they are
// the visible controls. Also the keyboard shortcuts.
import { t as words } from "../core/i18n.js";

export function createKeys({ slot, player, getDeck }) {
  const buttons = new Map([...slot.querySelectorAll(".key")].map((b) => [b.dataset.action, b]));
  const dockQ = matchMedia("(max-width: 599px), (pointer: coarse)");
  const docked = () => dockQ.matches;
  function syncDock() {
    document.documentElement.classList.toggle("is-dock", docked());
  }
  syncDock();

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
    syncDock();
    const deck = getDeck();
    if (!deck) return;
    deck.fit();
    sync();
  }
  // lay the buttons over the deck's current key rects (also while its camera moves, without
  // re-fitting). A key out of the camera's view is hidden, so no target sits over the meters
  function sync() {
    const deck = getDeck();
    if (!deck) return;
    if (docked()) { unplace(); return; }
    const sr = slot.getBoundingClientRect();
    for (const r of deck.keyRects) {
      const b = buttons.get(r.action);
      b.style.left = `${r.x - sr.left}px`;
      b.style.top = `${r.y - sr.top}px`;
      b.style.width = `${r.w}px`;
      b.style.height = `${r.h}px`;
      b.classList.toggle("is-off", !!r.hidden);
    }
  }
  addEventListener("resize", place);
  dockQ.addEventListener?.("change", place);
  if ("ResizeObserver" in window) new ResizeObserver(place).observe(slot);
  // once more after fonts and layout settle (the header and rack can shift the slot)
  document.fonts?.ready.then(() => requestAnimationFrame(place)).catch(() => {});
  addEventListener("load", () => requestAnimationFrame(place), { once: true });

  // back to the plain HTML keys (the 3D deck went away)
  function unplace() {
    for (const b of buttons.values()) {
      if (!b.style.length && !b.classList.contains("is-off")) continue;
      for (const k of ["left", "top", "width", "height"]) b.style.removeProperty(k);
      b.classList.remove("is-off");
    }
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

  return { updateLabels, updateFlipLabel, place, sync, unplace };
}
