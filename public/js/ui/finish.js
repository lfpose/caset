// The deck's finish switch in the top bar: silver (default) | black. The one .finish group
// keeps aria-pressed; the choice is kept in localStorage "caset-finish" and handed to the deck
// at boot (createDeck({ finish })) so the first frame is already in it. Without a 3D deck
// (body.nogl) style.css hides the group.
const KEY = "caset-finish";
const NAMES = ["silver", "black"];

export function savedFinish() {
  try {
    const v = localStorage.getItem(KEY);
    return NAMES.includes(v) ? v : "silver";
  } catch {
    return "silver";
  }
}

export function createFinish({ el, getDeck }) {
  const btns = el ? [...el.querySelectorAll("button[data-finish]")] : [];
  let current = getDeck()?.finish || savedFinish();
  function sync() {
    for (const b of btns) b.setAttribute("aria-pressed", String(b.dataset.finish === current));
    document.documentElement.dataset.finish = current;
  }
  function set(name) {
    if (!NAMES.includes(name)) return;
    const deck = getDeck();
    current = deck?.setFinish ? deck.setFinish(name) : name;
    try { localStorage.setItem(KEY, current); } catch { /* private mode: this visit only */ }
    sync();
  }
  for (const b of btns) b.addEventListener("click", () => set(b.dataset.finish));
  sync();
  return { set, get: () => current, sync };
}
