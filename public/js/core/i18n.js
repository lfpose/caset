// Interface copy in English and Spanish, the remembered language choice, and the
// wording of the engine's announcements. Track notes live in tapes.json (note / note_es).
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
export const LANGS = Object.keys(T);

let lang = "en";
try {
  const saved = localStorage.getItem("caset-lang");
  if (saved === "en" || saved === "es") lang = saved;
} catch { /* storage blocked: stay in English */ }

export const getLang = () => lang;
export const t = () => T[lang];
export function setLang(l) {
  if (!T[l]) return;
  lang = l;
  try { localStorage.setItem("caset-lang", lang); } catch { /* ignore */ }
}

// fields of tapes.json that have a Spanish twin
export const sideLabel = (sd) => (lang === "es" && sd.label_es) || sd.label;
export function noteOf(track) {
  const note = (lang === "es" ? track.note_es || track.note : track.note) || "";
  const fallback = lang === "es" && !track.note_es; // an English fallback is read as English
  return { note, lang: fallback ? "en" : null };
}

// the engine's announcements (see core/player.js) as words
export function phrase(msg) {
  const L = T[lang];
  switch (msg.kind) {
    case "mode": return msg.track ? `${L.status.play}: ${msg.track.title}` : L.status[msg.mode] || "";
    case "end": return L.status.end;
    case "track": return `${msg.track.title}, ${L.trackOf(msg.index + 1, msg.count)}`;
    case "flip": return L.status.flip(msg.side);
    case "eject": return L.status.eject;
    case "load": return L.status.load(msg.cassette.name, msg.side);
    default: return "";
  }
}
