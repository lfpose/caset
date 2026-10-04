// The panel under the deck (#liner): what is in the deck and what is playing, in reading order.
//   1. the tape header (.spine): art, "In the deck", the tape's name, its count and length
//   2. now playing (#now): side and track, clock, the side's progress, the title,
//      who · year · place and, when the file is missing, a calm notice
//   3. the sides: an A | B switch (it flips the tape, the engine's own path) over the side's
//      three tracks; a track is one click (the deck winds to it)
//   4. about this recording: the note and the credit
// Desk: the header across, now playing and the notes on the left, the sides on the right.
// Phones: one column in that order. Flat type on the page; no box, no drop cap.
// It also keeps the EN / ES buttons' aria-pressed in step (they live in the top bar).
// Hooks: .track[data-i] (+ aria-current) exist only for the side in the deck; .missing.
import { $, h, fmt, inkFor, readable, sideSeconds, createProgress } from "./dom.js";
import { t as words, getLang, sideLabel, noteOf } from "../core/i18n.js";
import { copy } from "./copy.js";

export function createLiner({ liner, body, player, sound }) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let timeEl = null, lastTimeText = "", lastTimeSec = -1;
  const progress = createProgress("now-prog");
  let shown = { id: null, side: null }, nowShown = -2;

  // restart a CSS entrance animation (skipped under reduced motion by style.css). Only the
  // text that changed fades: the panel itself never blanks
  function enter(el, cls) {
    if (!el || reduce.matches) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function trackRow(tr, i) {
    return h("button", { type: "button", class: "track", "data-i": String(i), tabindex: "-1" },
      h("span", { class: "tn", text: String(i + 1) }),
      h("span", { class: "eq", "aria-hidden": "true" }, h("i"), h("i"), h("i")),
      h("span", { class: "tt" },
        h("span", { class: "tt-title", text: tr.title }),
        h("span", { class: "tt-who", text: [tr.who, tr.date].filter(Boolean).join(", ") })),
      h("span", { class: "td", text: fmt(tr.dur) }));
  }

  function emptyPanel(title, hint, failed = false) {
    return h("div", { class: `empty${failed ? " is-failed" : ""}` },
      h("p", { class: "eyebrow", "aria-hidden": "true", text: copy().inDeck }),
      h("p", { class: "empty-title", text: title }),
      hint ? h("p", { class: "empty-hint", text: hint }) : null);
  }

  function render() {
    const L = words();
    const K = copy();
    const lang = getLang();
    document.documentElement.lang = lang;
    liner.lang = lang;
    for (const b of document.querySelectorAll(".lang button")) b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    // keep focus on the equivalent control across a re-render (a side button, a track)
    const active = body.contains(document.activeElement) ? document.activeElement : null;
    const refocus = active?.dataset.side ? `.side-switch button[data-side="${active.dataset.side}"]`
      : active?.classList.contains("track") ? `.track[data-i="${active.dataset.i}"]` : null;
    timeEl = null;
    lastTimeText = "";
    nowShown = -2;
    const cur = player.cassette, side = player.side;
    if (!player.tapes.length) {
      shown = { id: null, side: null };
      liner.classList.add("is-empty");
      body.replaceChildren(emptyPanel(L.failed, "", true));
      return;
    }
    if (!cur) {
      shown = { id: null, side: null };
      liner.classList.add("is-empty");
      liner.style.removeProperty("--tape");
      liner.style.removeProperty("--tape-ink");
      liner.style.removeProperty("--tape-text");
      body.replaceChildren(emptyPanel(L.empty, L.pick));
      enter(body, "is-in");
      return;
    }
    liner.classList.remove("is-empty");
    const sd = cur.sides[side];
    const other = side === "A" ? "B" : "A";
    liner.style.setProperty("--tape", cur.color);
    liner.style.setProperty("--tape-ink", inkFor(cur.color));
    liner.style.setProperty("--tape-text", readable(cur.color, "#15110e"));
    const n = player.tapes.indexOf(cur);
    const count = cur.sides.A.tracks.length + cur.sides.B.tracks.length;

    const art = new Image();
    art.alt = "";
    art.decoding = "async";
    art.draggable = false;
    art.src = cur.cover;
    art.addEventListener("error", () => art.remove());

    // the A | B switch: the current side is pressed; the other one flips the tape
    const seg = (s) => {
      const isCur = s === side;
      const b = h("button", { type: "button", "data-side": s, "aria-pressed": String(isCur),
        "aria-label": isCur ? `${L.side} ${s}: ${sideLabel(cur.sides[s])}` : `${K.flipHint(s)}: ${sideLabel(cur.sides[s])}` },
        h("b", { class: "ss-chip", "aria-hidden": "true", text: s }),
        h("span", { class: "ss-lbl", "aria-hidden": "true", text: sideLabel(cur.sides[s]) }),
        h("span", { class: "ss-dur", "aria-hidden": "true", text: fmt(sideSeconds(cur.sides[s])) }));
      b.addEventListener("click", (e) => {
        if (s === player.side) return;
        if (e.detail > 0) b.blur();
        sound?.unlock();
        player.press("flip");
      });
      return b;
    };
    const tracks = h("ol", { class: "tracks" }, ...player.tracks.map((tr, i) => {
      const b = trackRow(tr, i);
      b.addEventListener("click", (e) => { if (e.detail > 0) b.blur(); player.seekTo(i); });
      return h("li", {}, b);
    }));
    tracks.addEventListener("keydown", onListKey);
    const sides = h("div", { class: "sides" },
      h("div", { class: `side-switch is-${side.toLowerCase()}`, role: "group", "aria-label": K.sideGroup }, seg("A"), seg("B")),
      h("div", { class: "tracks-wrap" }, tracks, h("span", { class: "tracks-bar", "aria-hidden": "true" })));

    body.replaceChildren(
      h("header", { class: "spine" },
        h("span", { class: "spine-art", "aria-hidden": "true" }, art),
        h("span", { class: "spine-text" },
          h("span", { class: "eyebrow spine-eyebrow", "aria-hidden": "true", text: `${K.inDeck} · ${String(n + 1).padStart(2, "0")}` }),
          h("span", { class: "spine-name", text: cur.name }),
          h("span", { class: "spine-label", text: `${L.side} ${side} · ${sideLabel(sd)}` })),
        h("span", { class: "spine-meta", "aria-hidden": "true",
          text: `${K.recordings(count)} · ${fmt(sideSeconds(cur.sides.A) + sideSeconds(cur.sides.B))}` }),
        h("p", { class: "flipside", text: `${L.other}: ${sideLabel(cur.sides[other])}` })),
      // not a live region: the clock in here changes every second; #status announces instead
      h("section", { class: "now", id: "now", "aria-label": K.nowEyebrow }),
      sides,
      h("section", { class: "notes", "aria-label": K.notesEyebrow }));

    // a new tape rises in as a whole; a flip cross-fades the sides only
    if (shown.id !== cur.id) enter(body, "is-in");
    else if (shown.side !== side) enter(sides, "is-in");
    shown = { id: cur.id, side };
    progress.build(player);
    renderNow();
    if (refocus) body.querySelector(refocus)?.focus();
  }

  // ↑ / ↓ / Home / End across the track rows (roving tabindex: one Tab stop)
  function rows() { return [...body.querySelectorAll(".track")]; }
  function onListKey(e) {
    const list = rows();
    const i = list.indexOf(document.activeElement);
    if (i < 0 || e.altKey || e.ctrlKey || e.metaKey) return;
    let j = -1;
    if (e.key === "ArrowDown") j = Math.min(list.length - 1, i + 1);
    else if (e.key === "ArrowUp") j = Math.max(0, i - 1);
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = list.length - 1;
    if (j < 0) return;
    e.preventDefault();
    for (const b of list) b.tabIndex = b === list[j] ? 0 : -1;
    list[j].focus();
  }

  function renderNow() {
    const now = $("#now");
    const notes = body.querySelector(".notes");
    const cur = player.cassette;
    if (!now || !cur) return;
    const L = words();
    const K = copy();
    const tracks = player.tracks, curIndex = player.index;
    let curBtn = null;
    const focusInList = body.querySelector(".tracks")?.contains(document.activeElement);
    for (const b of body.querySelectorAll(".track")) {
      if (Number(b.dataset.i) === curIndex) { b.setAttribute("aria-current", "true"); curBtn = b; }
      else b.removeAttribute("aria-current");
    }
    if (!focusInList) {
      const tab = Math.max(0, curIndex);
      for (const b of rows()) b.tabIndex = Number(b.dataset.i) === tab ? 0 : -1;
    }
    // one bar for the current track, moved rather than redrawn
    const bar = body.querySelector(".tracks-bar");
    if (bar) {
      if (curBtn) {
        const li = curBtn.parentElement;
        bar.style.transform = `translateY(${li.offsetTop}px)`;
        bar.style.height = `${li.offsetHeight}px`;
        bar.classList.add("is-on");
      } else bar.classList.remove("is-on");
    }
    const i = Math.max(0, curIndex === -1 ? player.trackAt(player.pos) : curIndex);
    const tr = tracks[i];
    if (!tr) { now.replaceChildren(); notes?.replaceChildren(); return; }
    const { note, lang: noteLang } = noteOf(tr);
    let credit = null;
    if (tr.credit) {
      credit = h("p", { class: "now-credit" }, h("span", { text: `${L.credit}: ${tr.credit}` }));
      if (/^https:\/\//.test(tr.license_url || "")) {
        credit.append(" · ", h("a", { href: tr.license_url, rel: "license noopener noreferrer", target: "_blank", lang: "en", text: L.license }));
      }
    }
    timeEl = h("span", { class: "tnum" });
    lastTimeText = "";
    lastTimeSec = -1;
    now.replaceChildren(
      h("p", { class: "now-pos" },
        h("span", { class: "now-eyebrow", "aria-hidden": "true", text: `${K.nowEyebrow} · ${player.side}${i + 1}` }),
        h("span", { class: "now-clock" }, timeEl, h("span", { class: "now-of", text: ` / ${fmt(tr.dur)} · ${L.trackOf(i + 1, tracks.length)}` }))),
      progress.el,
      h("div", { class: "now-text" }, ...[
        h("h3", { class: "now-title", text: tr.title }),
        h("p", { class: "now-meta", text: [tr.who, tr.date, tr.place].filter(Boolean).join(" · ") }),
        player.isMissing(tr.src)
          ? h("p", { class: "missing", role: "note" },
              h("strong", { text: L.missing }), h("code", { text: tr.src }), h("span", { text: L.silent(fmt(tr.dur)) }))
          : null,
      ].filter(Boolean)));
    notes?.replaceChildren(...[
      h("p", { class: "eyebrow notes-eyebrow", "aria-hidden": "true", text: K.notesEyebrow }),
      note ? h("p", { class: "now-note", lang: noteLang, text: note }) : h("p", { class: "now-note is-empty", text: L.noNote }),
      credit,
    ].filter(Boolean));
    // a new track cross-fades in; a re-render of the same one does not
    if (nowShown !== -2 && nowShown !== i) { enter(now.querySelector(".now-text"), "is-in"); enter(notes, "is-in"); }
    nowShown = i;
    updateTime();
  }

  function updateTime() {
    if (!timeEl || !player.cassette) return;
    const i = Math.max(0, player.index);
    const sec = Math.max(0, Math.floor(player.pos - (player.offsets[i] || 0)));
    if (sec === lastTimeSec && lastTimeText) return; // no string work unless the second changed
    lastTimeSec = sec;
    lastTimeText = fmt(sec);
    timeEl.textContent = lastTimeText;
    progress.set(player);
  }

  player.on("track", renderNow);
  player.on("time", updateTime);
  player.on("missing", (src) => { if (player.tracks[player.index]?.src === src) renderNow(); });

  return { render };
}
