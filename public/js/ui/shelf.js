// The shelf: one case per cassette, with its cover as the J-card.
import { h } from "./dom.js";
import { sideLabel } from "../core/i18n.js";

export function createShelf({ rail, player, sound }) {
  const label = (c) => `${c.name}: ${sideLabel(c.sides.A)} / ${sideLabel(c.sides.B)}`;

  function render() {
    rail.replaceChildren(...player.tapes.map((c) => {
      const img = new Image();
      img.alt = "";
      img.decoding = "async";
      img.draggable = false;
      const b = h("button", { type: "button", class: "case", "data-id": c.id, "aria-pressed": "false", "aria-label": label(c) },
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
        player.load(c.id);
      });
      return h("li", {}, b);
    }));
  }

  // which case is in the deck, and labels in the current language
  function update() {
    const cur = player.cassette;
    for (const b of rail.querySelectorAll(".case")) {
      b.setAttribute("aria-pressed", String(!!cur && b.dataset.id === cur.id));
      const c = player.getTape(b.dataset.id);
      if (c) b.setAttribute("aria-label", label(c));
    }
  }

  return { render, update };
}
