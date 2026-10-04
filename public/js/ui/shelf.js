// The shelf: the ten tapes, rendered once. Each tape is a card: a small cassette (its label cut
// from the cover's picture band, a smoked shell, the packs in the window), its catalogue number,
// its name and both sides spelled out (letter and topic), and two side chips (letter and
// running time). The card's main target is the .case button (stretched over the whole card):
// it loads the tape on the side it was last on. The side chips are targets of their own and
// load that side directly (mouse and touch shortcuts; keyboard users pick the tape, then flip).
// The chips never cover the card's centre.
// Desk: a sticky index beside the deck, all ten in view. Tablet and phone: a horizontal rail
// right under the deck. The shelf is one Tab stop: ↑ / ↓ / ← / → / Home / End move.
// The loaded tape says "In the deck" (an amber equaliser while playing).
import { h, fmt, readable, inkFor, sideSeconds } from "./dom.js";
import { sideLabel } from "../core/i18n.js";
import { copy } from "./copy.js";

export function createShelf({ rail, player, sound, slot }) {
  const label = (c) => `${c.name}: ${sideLabel(c.sides.A)} / ${sideLabel(c.sides.B)}`;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let focusTracksOnSettle = false;

  const buttons = () => [...rail.querySelectorAll(".case")];
  function rove(target) {
    for (const b of buttons()) b.tabIndex = b === target ? 0 : -1;
  }

  // the cassette thumbnail: label (cover band, name, side letter), shell, window, packs
  function cassette(c, img) {
    return h("span", { class: "c-art", "aria-hidden": "true" },
      h("span", { class: "c-shell" },
        h("span", { class: "c-reel is-l" }), h("span", { class: "c-reel is-r" }),
        h("span", { class: "c-window" }),
        h("span", { class: "c-label" },
          h("span", { class: "c-cover" }, img,
            // no cover: the tape's colour with the five stripes
            h("span", { class: "c-stripes" }, h("i"), h("i"), h("i"), h("i"), h("i"))),
          h("span", { class: "c-lname", text: c.name }),
          h("b", { class: "c-lside", text: "A" })),
        h("span", { class: "c-trap" })));
  }

  function render() {
    const K = copy();
    rail.replaceChildren(...player.tapes.map((c, n) => {
      const img = new Image();
      img.alt = "";
      img.decoding = "async";
      img.loading = "lazy";
      img.draggable = false;
      const topic = (s) => h("span", { class: "c-topic", "data-side": s },
        h("b", { class: "c-letter", text: s }),
        h("span", { class: "c-lbl", text: sideLabel(c.sides[s]) }));
      const sideBtn = (s) => {
        const b = h("button", { type: "button", class: "c-side", "data-side": s, tabindex: "-1", "aria-label": K.sideBtn(c.name, s, sideLabel(c.sides[s])) },
          h("b", { class: "c-letter", "aria-hidden": "true", text: s }),
          h("span", { class: "c-dur", "aria-hidden": "true", text: fmt(sideSeconds(c.sides[s])) }));
        b.addEventListener("click", (e) => {
          sound.unlock();
          if (e.detail > 0) b.blur();
          pick(c, s, false);
        });
        return b;
      };
      const b = h("button", { type: "button", class: "case", "data-id": c.id, "aria-pressed": "false", "aria-label": label(c), tabindex: n === 0 ? "0" : "-1" });
      b.addEventListener("click", (e) => {
        sound.unlock();
        if (e.detail > 0) b.blur();
        rove(b);
        pick(c, null, e.detail === 0);
      });
      const li = h("li", { class: "c-li" },
        cassette(c, img),
        h("span", { class: "c-head", "aria-hidden": "true" },
          h("span", { class: "c-no", text: String(n + 1).padStart(2, "0") }),
          h("span", { class: "c-name", text: c.name }),
          h("span", { class: "c-state" },
            h("span", { class: "eq" }, h("i"), h("i"), h("i")),
            h("span", { class: "c-state-lbl", text: K.inDeck }))),
        h("span", { class: "c-topics", "aria-hidden": "true" }, topic("A"), topic("B")),
        b,
        h("span", { class: "c-sides" }, sideBtn("A"), sideBtn("B")));
      li.style.setProperty("--tape", c.color);
      li.style.setProperty("--tape-text", readable(c.color, "#15110e"));
      li.style.setProperty("--tape-ink", inkFor(c.color));
      img.addEventListener("error", () => li.classList.add("nocover"));
      img.addEventListener("load", () => li.classList.add("hascover"));
      img.src = c.cover;
      return li;
    }));
  }

  // load a tape (on a given side, or the one it was last on). A keyboard pick carries focus on
  // to the tracks once the tape is in
  function pick(c, side, byKeyboard) {
    focusTracksOnSettle = byKeyboard;
    player.load(c.id, side ? { side } : undefined);
    revealDeck();
  }

  // bring the deck back into view if it is mostly off screen (it is right beside or above the
  // shelf, so this rarely fires). The deck lands under the top bar; if that would slice the
  // intro above it, the page goes to the top instead
  function revealDeck() {
    const r = slot.getBoundingClientRect();
    const bar = document.querySelector(".bar")?.getBoundingClientRect().bottom || 0;
    const seen = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, bar));
    if (!(r.height > 0) || seen / r.height >= 0.4) return;
    let y = scrollY + r.top - bar - 8;
    const intro = document.querySelector(".intro");
    if (intro && intro.offsetParent && y < scrollY + intro.getBoundingClientRect().bottom) y = 0;
    scrollTo({ top: Math.max(0, y), behavior: reduce.matches ? "auto" : "smooth" });
  }

  player.on("settled", () => {
    if (!focusTracksOnSettle) return;
    focusTracksOnSettle = false;
    document.querySelector("#liner-body .track")?.focus({ preventScroll: false });
  });

  // ↑ / ↓ / ← / → / Home / End between tapes. The arrow keys left and right wind the tape
  // everywhere else; here, with a tape focused, they move along the shelf
  rail.addEventListener("keydown", (e) => {
    const list = buttons();
    const i = list.indexOf(document.activeElement);
    if (i < 0 || e.altKey || e.ctrlKey || e.metaKey) return;
    let j = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") j = Math.min(list.length - 1, i + 1);
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") j = Math.max(0, i - 1);
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = list.length - 1;
    if (j < 0) return;
    e.preventDefault();
    e.stopPropagation();
    rove(list[j]);
    list[j].focus();
    list[j].closest("li")?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce.matches ? "auto" : "smooth" });
  });

  // which tape is in the deck, and labels in the current language
  function update() {
    const cur = player.cassette;
    const K = copy();
    let loadedBtn = null;
    for (const b of buttons()) {
      const on = !!cur && b.dataset.id === cur.id;
      b.setAttribute("aria-pressed", String(on));
      const li = b.closest("li");
      li.classList.toggle("is-loaded", on);
      if (on) loadedBtn = b;
      const c = player.getTape(b.dataset.id);
      if (c) {
        b.setAttribute("aria-label", label(c));
        for (const s of li.querySelectorAll(".c-topic")) {
          const t = s.querySelector(".c-lbl");
          const text = sideLabel(c.sides[s.dataset.side]);
          if (t && t.textContent !== text) t.textContent = text;
          s.classList.toggle("is-cur", on && player.side === s.dataset.side);
        }
        for (const s of li.querySelectorAll(".c-side")) {
          s.setAttribute("aria-label", K.sideBtn(c.name, s.dataset.side, sideLabel(c.sides[s.dataset.side])));
          s.classList.toggle("is-cur", on && player.side === s.dataset.side);
        }
        const ls = li.querySelector(".c-lside");
        const side = on ? player.side : "A";
        if (ls && ls.textContent !== side) ls.textContent = side;
      }
      const s = li.querySelector(".c-state-lbl");
      if (s && s.textContent !== K.inDeck) s.textContent = K.inDeck;
    }
    // the Tab stop follows the loaded tape unless focus is already in the shelf
    if (loadedBtn && !rail.contains(document.activeElement)) rove(loadedBtn);
    // the rail shows the loaded tape (phones and tablets; a no-op on the desk index)
    if (loadedBtn && rail.scrollWidth > rail.clientWidth + 1) {
      const li = loadedBtn.closest("li");
      const lr = li.getBoundingClientRect(), rr = rail.getBoundingClientRect();
      if (lr.left < rr.left || lr.right > rr.right) {
        rail.scrollTo({ left: rail.scrollLeft + lr.left - rr.left - 16, behavior: reduce.matches ? "auto" : "smooth" });
      }
    }
  }

  return { render, update };
}
