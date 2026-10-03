// The liner card: the current side's tracklist, the track under the playhead with its
// note and credit, the missing-file notice, and the EN / ES toggle.
import { $, h, fmt, inkFor } from "./dom.js";
import { t as words, getLang, sideLabel, noteOf } from "../core/i18n.js";

export function createLiner({ liner, body, player }) {
  let timeEl = null, lastTimeText = "", lastTimeSec = -1;

  function render() {
    const L = words();
    const lang = getLang();
    document.documentElement.lang = lang;
    liner.lang = lang;
    for (const b of liner.querySelectorAll(".lang button")) b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    timeEl = null;
    lastTimeText = "";
    const cur = player.cassette, side = player.side;
    if (!player.tapes.length) {
      body.replaceChildren(h("div", { class: "empty" }, h("p", { class: "empty-title", text: L.failed })));
      return;
    }
    if (!cur) {
      liner.style.removeProperty("--tape");
      body.replaceChildren(h("div", { class: "empty" },
        h("p", { class: "empty-title", text: L.empty }),
        h("p", { text: L.pick }),
        h("p", { class: "hint", text: L.hint })));
      return;
    }
    const sd = cur.sides[side];
    const other = cur.sides[side === "A" ? "B" : "A"];
    liner.style.setProperty("--tape", cur.color);
    liner.style.setProperty("--tape-ink", inkFor(cur.color));
    const list = h("ol", { class: "tracks" }, ...player.tracks.map((tr, i) => {
      const b = h("button", { type: "button", class: "track", "data-i": String(i) },
        h("span", { class: "tn", text: String(i + 1) }),
        h("span", { class: "tt" },
          h("span", { class: "tt-title", text: tr.title }),
          h("span", { class: "tt-who", text: [tr.who, tr.date].filter(Boolean).join(", ") })),
        h("span", { class: "td", text: fmt(tr.dur) }));
      b.addEventListener("click", (e) => { if (e.detail > 0) b.blur(); player.seekTo(i); });
      return h("li", {}, b);
    }));
    body.replaceChildren(
      h("header", { class: "spine" },
        h("span", { class: "spine-side", text: side }),
        h("span", { class: "spine-text" },
          h("span", { class: "spine-name", text: cur.name }),
          h("span", { class: "spine-label", text: `${L.side} ${side} · ${sideLabel(sd)}` }))),
      list,
      h("p", { class: "flipside", text: `${L.other}: ${sideLabel(other)}` }),
      // not a live region: the clock in here changes every second; #status announces instead
      h("section", { class: "now", id: "now" }));
    renderNow();
  }

  function renderNow() {
    const now = $("#now");
    const cur = player.cassette;
    if (!now || !cur) return;
    const L = words();
    const tracks = player.tracks, curIndex = player.index;
    for (const b of body.querySelectorAll(".track")) {
      if (Number(b.dataset.i) === curIndex) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    }
    const i = Math.max(0, curIndex === -1 ? player.trackAt(player.pos) : curIndex);
    const tr = tracks[i];
    if (!tr) { now.replaceChildren(); return; }
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
    now.replaceChildren(...[
      h("p", { class: "now-pos" }, timeEl, h("span", { text: ` / ${fmt(tr.dur)} · ${L.trackOf(i + 1, tracks.length)}` })),
      h("h3", { class: "now-title", text: tr.title }),
      h("p", { class: "now-meta", text: [tr.who, tr.date, tr.place].filter(Boolean).join(" · ") }),
      note ? h("p", { class: "now-note", lang: noteLang, text: note }) : h("p", { class: "now-note is-empty", text: L.noNote }),
      credit,
      player.isMissing(tr.src)
        ? h("p", { class: "missing", role: "note" },
            h("strong", { text: L.missing }), h("code", { text: tr.src }), h("span", { text: L.silent(fmt(tr.dur)) }))
        : null,
    ].filter(Boolean));
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
  }

  player.on("track", renderNow);
  player.on("time", updateTime);
  player.on("missing", (src) => { if (player.tracks[player.index]?.src === src) renderNow(); });

  return { render };
}
