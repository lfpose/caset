// One URL per track: #<cassette-id>/<a|b>/<n>. Reading it loads that tape, side and track;
// the address bar and the page title follow whatever is in the deck.
export function createRouter(player) {
  let lastHash = null;

  function update() {
    const cur = player.cassette, i = Math.max(0, player.index);
    let hash = "";
    if (cur) hash = `#${cur.id}/${player.side.toLowerCase()}/${i + 1}`;
    const tr = cur && player.tracks[i];
    const title = tr ? `${tr.title} · ${cur.name} · caset` : "caset";
    if (document.title !== title) document.title = title;
    if (hash === lastHash) return;
    lastHash = hash;
    try { history.replaceState(null, "", hash || location.pathname + location.search); } catch { /* ignore */ }
  }
  // no decoding needed: the pattern has nothing that could be percent-encoded
  function parse() {
    const m = /^#([a-z0-9-]+)\/([ab])\/(\d+)$/i.exec(location.hash);
    if (!m) return null;
    const id = m[1].toLowerCase();
    const c = player.getTape(id);
    if (!c) return null;
    const s = m[2].toUpperCase();
    const n = Math.max(1, Math.min(c.sides[s].tracks.length, parseInt(m[3], 10)));
    return { id, side: s, track: n - 1 };
  }
  // put the address bar back in step with the deck (after a link it could not use)
  function canonical() {
    lastHash = null;
    update();
  }

  player.on("track", update);
  player.on("settled", update);
  addEventListener("hashchange", () => {
    const want = parse();
    if (!want) return canonical();
    const cur = player.cassette;
    if (cur && cur.id === want.id && player.side === want.side && player.index === want.track) return canonical();
    player.halt();
    player.load(want.id, want);
  });

  return {
    // follow the link the page was opened with, if any
    start() {
      const want = parse();
      if (want) player.load(want.id, want);
      else if (location.hash) canonical();
    },
  };
}
