// The page's own copy in English and Spanish: the intro, the shelf heading, How it works, the
// view switch, the mini player. The engine's wording stays in core/i18n.js; this only reads its
// language. applyCopy() fills every [data-copy] / [data-copy-label] / [data-copy-title] element;
// strings that depend on the pointer (tap vs. keys) are picked by matchMedia.
// Tape names stay as they are in tapes.json in both languages: they are the tapes' titles
// (brand names, like an album's), and the engine announces them that way too.
import { getLang } from "../core/i18n.js";
import { h } from "./dom.js";

const touch = () => matchMedia("(pointer: coarse)").matches;

const C = {
  en: {
    statement: "A cassette deck in your browser, loaded with ten tapes of recorded history.",
    heroTitle: "A cassette deck in your browser.",
    heroLede: "Ten tapes of recorded history, from the oldest recorded voice to Apollo 11. Pick one and press play.",
    skip: "Skip to the tapes",
    pageNav: "Page",
    navTapes: "The tapes",
    language: "Language",
    finish: "Deck finish",
    finishSilver: "Silver",
    finishBlack: "Black",
    keys: "Transport keys",
    liner: "Liner notes",
    nowPlaying: "Now playing",
    loupe: "VU and peak meters",
    viewGroup: "View",
    viewDeck: "Deck",
    viewMeters: "Meters",
    viewMetersTitle: "A close-up of the meters, which move with the recording",
    shelfEyebrow: (n) => `The shelf · ${n} tapes`,
    inDeck: "In the deck",
    recordings: (n) => `${n} recordings`,
    sideGroup: "Side",
    sideBtn: (name, s, label) => `${name}, side ${s}: ${label}`,
    flipHint: (s) => `Flip to side ${s}`,
    nowEyebrow: "Now playing",
    notesEyebrow: "About this recording",
    plate: "CS-86 · Stereo cassette deck",
    plateHint: () => touch() ? "Tap a tape, then play" : "Space play/stop · ← → wind",
    how: "How it works",
    steps: () => [
      { t: "Pick a tape", d: "Ten cassettes, two sides of three recordings each. Pick one, or one of its sides, and it slides into the deck.", k: [] },
      touch()
        ? { t: "Press play", d: "Use the keys under the deck. Flip the tape for the other side.", k: [] }
        : { t: "Press play", d: "Use the keys on the deck or the space bar. Flip the tape for the other side.", k: ["Space"] },
      touch()
        ? { t: "Wind to a track", d: "Tap any track and the deck winds straight to it.", k: [] }
        : { t: "Wind to a track", d: "Click any track and the deck winds straight to it, or wind with the arrow keys.", k: ["←", "→"] },
      { t: "Watch the meters", d: "The VU needles and the peak meter follow the recording. Meters frames them up close.", k: [] },
    ],
    sources: "Public-domain and permitted recordings. Each track lists its credit and license.",
    play: "Play",
    stop: "Stop",
    toDeck: "Show the deck",
  },
  es: {
    statement: "Una casetera en tu navegador, con diez cintas de historia grabada.",
    heroTitle: "Una casetera en tu navegador.",
    heroLede: "Diez cintas de historia grabada, de la voz grabada más antigua al Apolo 11. Elige una y dale play.",
    skip: "Saltar a las cintas",
    pageNav: "Página",
    navTapes: "Las cintas",
    language: "Idioma",
    finish: "Acabado de la casetera",
    finishSilver: "Plata",
    finishBlack: "Negro",
    keys: "Teclas de transporte",
    liner: "Notas de la cinta",
    nowPlaying: "Sonando ahora",
    loupe: "Vúmetros y medidor de picos",
    viewGroup: "Vista",
    viewDeck: "Casetera",
    viewMeters: "Medidores",
    viewMetersTitle: "Un acercamiento a los medidores, que se mueven con la grabación",
    shelfEyebrow: (n) => `El estante · ${n} cintas`,
    inDeck: "En la casetera",
    recordings: (n) => `${n} grabaciones`,
    sideGroup: "Lado",
    sideBtn: (name, s, label) => `${name}, lado ${s}: ${label}`,
    flipHint: (s) => `Dar vuelta al lado ${s}`,
    nowEyebrow: "Sonando ahora",
    notesEyebrow: "Sobre esta grabación",
    plate: "CS-86 · Casetera estéreo",
    plateHint: () => touch() ? "Toca una cinta y dale play" : "Espacio play/stop · ← → bobinar",
    how: "Cómo funciona",
    steps: () => [
      { t: "Elige una cinta", d: "Diez casetes, con dos lados de tres grabaciones. Elige uno, o uno de sus lados, y entra en la casetera.", k: [] },
      touch()
        ? { t: "Dale play", d: "Usa las teclas bajo la casetera. Da vuelta la cinta para el otro lado.", k: [] }
        : { t: "Dale play", d: "Usa las teclas de la casetera o la barra espaciadora. Da vuelta la cinta para el otro lado.", k: ["Espacio"] },
      touch()
        ? { t: "Ve a una pista", d: "Toca cualquier pista y la casetera va directo a ella.", k: [] }
        : { t: "Ve a una pista", d: "Haz clic en cualquier pista y la casetera va directo a ella, o bobina con las flechas.", k: ["←", "→"] },
      { t: "Mira los medidores", d: "Las agujas VU y el medidor de picos siguen la grabación. Medidores los muestra de cerca.", k: [] },
    ],
    sources: "Grabaciones de dominio público o con permiso. Cada pista indica sus créditos y su licencia.",
    play: "Reproducir",
    stop: "Detener",
    toDeck: "Ver la casetera",
  },
};

export const copy = () => C[getLang()] || C.en;

// fill the static page copy in the current language. counts: { tapes }
export function applyCopy(counts = {}) {
  const K = copy();
  const nTapes = counts.tapes || 10;
  for (const el of document.querySelectorAll("[data-copy]")) {
    const v = K[el.dataset.copy];
    const text = typeof v === "function" ? v(nTapes) : v;
    if (typeof text === "string" && el.textContent !== text) el.textContent = text;
  }
  for (const el of document.querySelectorAll("[data-copy-label]")) {
    const v = K[el.dataset.copyLabel];
    if (typeof v === "string") el.setAttribute("aria-label", v);
  }
  for (const el of document.querySelectorAll("[data-copy-title]")) {
    const v = K[el.dataset.copyTitle];
    if (typeof v === "string") el.setAttribute("title", v);
  }
  const steps = document.getElementById("steps");
  if (steps) {
    steps.replaceChildren(...K.steps().map((s, i) => h("li", { class: "step" },
      h("span", { class: "step-no", "aria-hidden": "true", text: String(i + 1).padStart(2, "0") }),
      h("h3", { class: "step-title", text: s.t }),
      h("p", { class: "step-text", text: s.d }),
      s.k.length ? h("p", { class: "step-keys" }, ...s.k.map((k) => h("kbd", { text: k }))) : null)));
  }
}
