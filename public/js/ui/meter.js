// The no-WebGL instrument strip: a fluorescent peak meter (two rows of 34 segments, white
// below 0 dB, amber above, with peak hold) and a little station dial whose needle is the
// playhead. Pure HTML; the loop only touches the segments whose state changed.
import { h } from "./dom.js";

// segment thresholds in dB, as on the 3D tube (docs/DESIGN.md §5.2)
const DB = [-30, -27, -24, -22, -20, -18, -16, -15, -14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1.5, -1, -0.5, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const N = DB.length;
const ZERO = Math.pow(10, -8 / 20);      // 0 dB on the meter = -8 dBFS sample peak
const RELEASE = 13.3, HOLD = 1.4, HOLD_FALL = 20;
const LEGEND = [["20", 4], ["10", 12], ["6", 16], ["3", 19], ["0", 24], ["3", 27], ["6", 30], ["9", 33]];

function litFor(db) {
  let n = 0;
  while (n < N && db >= DB[n]) n++;
  return n;
}

export function createMeter({ slot, player }) {
  const rows = [];
  function row(ch) {
    const segs = [];
    const bar = h("span", { class: "nm-segs" });
    for (let i = 0; i < N; i++) {
      const s = h("i", i >= 24 ? { class: "hot" } : {});
      segs.push(s);
      bar.append(s);
    }
    rows.push({ segs, lit: 0, hold: -1, db: -60, holdDb: -60, holdT: 0 });
    return h("span", { class: "nm-row" }, h("span", { class: "nm-ch", text: ch }), bar, h("span", { class: "nm-ch", text: "dB" }));
  }
  const legend = h("span", { class: "nm-legend" });
  for (const [txt, i] of LEGEND) {
    const b = h("b", { text: txt });
    b.style.left = `${((i + 0.5) / N) * 100}%`;
    legend.append(b);
  }
  const pips = h("span", { class: "nm-pips" });
  const needle = h("span", { class: "nm-needle" });
  const sideEl = h("span", { class: "nm-band", text: "side –" });
  const el = h("div", { class: "nmeter", "aria-hidden": "true" },
    h("span", { class: "nm-window" },
      h("span", { class: "nm-caption", text: "fluorescent peak meter" }),
      row("L"),
      h("span", { class: "nm-legrow" }, h("span", { class: "nm-ch" }), legend, h("span", { class: "nm-ch" })),
      row("R")),
    h("span", { class: "nm-dial" }, sideEl, h("span", { class: "nm-scale" }, pips, needle), h("span", { class: "nm-band", text: "min" })));
  slot.insertBefore(el, slot.querySelector(".keys"));

  let needleAt = -1;

  function setProgram() {
    const c = player.cassette;
    sideEl.textContent = c ? `side ${player.side}` : "side –";
    const total = player.total || 0;
    let labelled = -1;   // stations closer than 12% of the scale share one caption
    pips.replaceChildren(...(c && total ? player.tracks.map((tr, i) => {
      const p = h("i");
      const at = player.offsets[i] / total;
      p.style.left = `${at * 100}%`;
      if (labelled < 0 || at - labelled >= 0.12) {
        labelled = at;
        const y = /\b(1[89]\d\d|20\d\d)\b/.exec(tr.date || "");
        p.append(h("b", { text: y ? y[1] : String(i + 1) }));
      }
      return p;
    }) : []));
    el.classList.toggle("is-empty", !c);
    needleAt = -1;
  }

  function setRow(r, lit, hold) {
    if (lit !== r.lit) {
      const a = Math.min(lit, r.lit), b = Math.max(lit, r.lit);
      for (let i = a; i < b; i++) r.segs[i].classList.toggle("on", i < lit);
      r.lit = lit;
    }
    if (hold !== r.hold) {
      if (r.hold >= 0) r.segs[r.hold].classList.remove("pk");
      if (hold >= 0) r.segs[hold].classList.add("pk");
      r.hold = hold;
    }
  }

  function channel(r, peak, dt) {
    const db = peak > 1e-6 ? 20 * Math.log10(peak / ZERO) : -60;
    r.db = db > r.db ? db : Math.max(db, r.db - RELEASE * dt);
    if (db >= r.holdDb) { r.holdDb = db; r.holdT = HOLD; }
    else if (r.holdT > 0) r.holdT -= dt;
    else r.holdDb = Math.max(-60, r.holdDb - HOLD_FALL * dt);
    const lit = litFor(r.db);
    const hl = litFor(r.holdDb) - 1;
    setRow(r, lit, hl >= lit ? hl : -1);
  }

  function update(lv, dt) {
    const playing = player.mode === "play";
    const pl = playing ? (lv.pl || lv.l * 1.41) : 0;
    const pr = playing ? (lv.pr || lv.r * 1.41) : 0;
    channel(rows[0], pl, dt);
    channel(rows[1], pr, dt);
    const total = player.total;
    const at = player.cassette && total ? Math.round(Math.min(1, Math.max(0, player.pos / total)) * 1000) : 0;
    if (at !== needleAt) {
      needleAt = at;
      needle.style.left = (at / 10) + "%";
    }
  }

  setProgram();
  return { update, setProgram, el };
}
