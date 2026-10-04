// The tape engine: which cassette is in the deck, which side, where the tape is, what the
// transport is doing, and keeping one <audio> element slaved to that tape position.
//
// It never touches the DOM (apart from the audio element it is handed) and never formats
// text. Views read its state through the getters below and react to its events:
//
//   latch    (action | null)  the latched transport key changed (rewind / play / forward)
//   announce (message)        something worth saying to a screen reader; see i18n.js
//   deck     ()               a cassette or side was swapped in (mid-animation)
//   settled  ()               a load / flip / eject finished
//   track    (index)          the track under the playhead changed
//   time     ()               the playhead moved (every frame while a tape is in)
//   missing  (src)            an audio file turned out not to exist
//
// The 3D (or any) deck view is optional; see docs/ARCHITECTURE.md for its contract.
import { createEmitter } from "./events.js";

export const WIND = 24;                 // rewind / fast-forward speed, x real time
const R_MIN = 1.08, R_MAX = 2.28;       // reel pack radii, cm (pitch of the wind whine)

export function createPlayer({ audio, sound, view = null, reduceMotion = false }) {
  const ev = createEmitter();

  // ---------- state ----------
  let tapes = [];
  const byId = new Map();
  const memory = new Map();             // id -> { A: seconds, B: seconds, side }
  const missing = new Set();
  let cur = null;                       // cassette in the deck
  let side = "A";
  let tracks = [], offsets = [], total = 0;
  let pos = 0;                          // seconds from the start of the side
  let mode = "stop";                    // stop | play | rewind | forward | seek
  let seekTarget = 0, seekSpeed = WIND;
  let busy = false;                     // a mechanism animation is running
  let queued = null;
  let curIndex = -1;
  let announcedTrack = -1;
  let lastSpeed = 0;

  const announce = (msg) => ev.emit("announce", msg);

  function mem(id) {
    if (!memory.has(id)) memory.set(id, { A: 0, B: 0, side: "A" });
    return memory.get(id);
  }
  function savePos() {
    if (!cur) return;
    const m = mem(cur.id);
    m[side] = pos;
    m.side = side;
  }
  function bindSide() {
    tracks = cur ? cur.sides[side].tracks : [];
    offsets = [];
    let acc = 0;
    for (const t of tracks) { offsets.push(acc); acc += Math.max(1, Number(t.dur) || 0); }
    total = acc;
    pos = cur ? Math.min(mem(cur.id)[side], total) : 0;
    curIndex = -1;
    audioTrack = -1;
  }
  function trackAt(p) {
    let i = 0;
    while (i < tracks.length - 1 && p >= offsets[i + 1] - 1e-6) i++;
    return i;
  }
  function trackEnd(i) { return i + 1 < offsets.length ? offsets[i + 1] : total; }

  // ---------- audio: one element, slaved to the tape ----------
  let audioTrack = -1, audioEnded = false, waitT = 0, resyncT = 0, pendingSeek = null;
  const absUrl = (src) => new URL(src, location.href).href;

  audio.addEventListener("loadedmetadata", () => {
    if (pendingSeek != null) {
      try { audio.currentTime = pendingSeek; } catch { /* ignore */ }
      pendingSeek = null;
    }
  });
  audio.addEventListener("ended", () => { audioEnded = true; });
  audio.addEventListener("error", () => {
    const t = tracks[audioTrack];
    if (t && audio.src === absUrl(t.src)) markMissing(t.src);
  });

  function startTrackAudio(i) {
    audioTrack = i;
    audioEnded = false;
    waitT = 0;
    const t = tracks[i];
    if (!t || missing.has(t.src)) { audio.pause(); return; }
    const local = pos - offsets[i];
    const url = absUrl(t.src);
    if (audio.src !== url) {
      pendingSeek = local;
      audio.src = url;
    } else if (audio.readyState >= 1) {
      try { audio.currentTime = local; } catch { /* ignore */ }
    } else pendingSeek = local;
    const p = audio.play();
    if (p) p.catch((err) => {
      if (err.name === "NotAllowedError") { if (mode === "play") setMode("stop"); }
      else if (err.name === "NotSupportedError") markMissing(t.src);
    });
  }

  function markMissing(src) {
    if (missing.has(src)) return;
    missing.add(src);
    ev.emit("missing", src);
  }

  // Ask the worker which files exist, so a missing one runs silent without a 404.
  // If that endpoint is unavailable, the media element's own error does the job.
  const probed = new Set();
  const probing = new Set();
  const known = new Set();
  function probe(c) {
    if (probed.has(c.id)) return;
    probed.add(c.id);
    probing.add(c.id);
    const q = new URLSearchParams();
    for (const s of ["A", "B"]) for (const t of c.sides[s].tracks) q.append("src", t.src);
    fetch(`/audio-status?${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!res || typeof res !== "object") return;
        for (const [src, ok] of Object.entries(res)) {
          known.add(src);
          if (!ok) markMissing(src);
        }
      })
      .catch(() => {})
      .finally(() => probing.delete(c.id));
  }

  // ---------- transport ----------
  function latchedKey() {
    if (mode === "seek") return seekTarget < pos ? "rewind" : "forward";
    return mode === "stop" ? null : mode;
  }
  function setMode(m) {
    mode = m;
    const latched = latchedKey();
    view?.setLatched(latched);
    ev.emit("latch", latched);
    if (m === "play") { audioTrack = -1; waitT = 0; }
    else audio.pause();
    if (m !== "rewind" && m !== "forward" && m !== "seek") sound.setWind(0, 0);
    if (!cur) return;
    const t = m === "play" && tracks[trackAt(pos)];
    if (t) announcedTrack = trackAt(pos);
    announce({ kind: "mode", mode: m, track: t || null });
  }

  function tap(action, kind = "key") {
    view?.tap(action);
    sound.clunk(kind);
  }

  function press(action) {
    sound.unlock();
    if (busy) return;
    switch (action) {
      case "play":
        if (!cur || mode === "play" || pos >= total - 0.05) return tap(action);
        sound.clunk("latch");
        return setMode("play");
      case "rewind":
        if (!cur || mode === "rewind" || pos <= 0.01) return tap(action);
        sound.clunk("latch");
        return setMode("rewind");
      case "forward":
        if (!cur || mode === "forward" || pos >= total - 0.01) return tap(action);
        sound.clunk("latch");
        return setMode("forward");
      case "stop":
        tap(action);
        if (mode !== "stop") setMode("stop");
        return;
      case "flip": return flip();
      case "eject": return eject();
    }
  }

  function endOfSide(auto = true) {
    pos = total;
    setMode("stop");
    if (auto) sound.clunk("key");
    announce({ kind: "end" });
  }

  function seekTo(i) {
    sound.unlock();
    if (!cur || busy || !tracks[i]) return;
    const target = offsets[i];
    if (Math.abs(target - pos) < 0.25) {
      pos = target;
      if (mode === "play") startTrackAudio(i);
      else { sound.clunk("latch"); setMode("play"); }
      return;
    }
    sound.clunk("latch");
    seekTarget = target;
    seekSpeed = Math.max(WIND, Math.abs(target - pos) / 1.47); // a click-to-wind takes at most ~1.5 s
    setMode("seek");
  }

  function tick(dt) {
    let speed = 0;
    if (cur && !busy) {
      if (mode === "play") speed = tickPlay(dt);
      else if (mode === "rewind") {
        pos -= WIND * dt; speed = -WIND;
        if (pos <= 0) { pos = 0; setMode("stop"); sound.clunk("key"); }
      } else if (mode === "forward") {
        pos += WIND * dt; speed = WIND;
        if (pos >= total) endOfSide();
      } else if (mode === "seek") {
        const d = seekTarget - pos, step = seekSpeed * dt;
        if (Math.abs(d) <= step) {
          pos = seekTarget;
          sound.clunk("latch");
          setMode("play");
        } else { pos += Math.sign(d) * step; speed = Math.sign(d) * seekSpeed; }
      }
    }
    const frac = total > 0 ? pos / total : 0;
    if (speed !== 0 && mode !== "play") {
      const f = frac;
      const take = speed > 0 ? Math.sqrt(R_MIN ** 2 + (R_MAX ** 2 - R_MIN ** 2) * f) : Math.sqrt(R_MAX ** 2 + (R_MIN ** 2 - R_MAX ** 2) * f);
      sound.setWind(1, Math.min(15, (Math.abs(speed) * 4.76) / take));
    } else if (lastSpeed !== 0 && mode !== "play") sound.setWind(0, 0);
    lastSpeed = speed;
    view?.setTape(frac, speed, dt, pos);
    if (cur) {
      const i = trackAt(pos);
      if (i !== curIndex) {
        // a new track while playing is announced once (not while winding past tracks)
        if (mode === "play" && curIndex !== -1 && i !== announcedTrack) {
          announcedTrack = i;
          announce({ kind: "track", track: tracks[i], index: i, count: tracks.length });
        }
        curIndex = i;
        ev.emit("track", i);
      }
      ev.emit("time");
    }
  }

  function tickPlay(dt) {
    if (pos >= total - 1e-3) { endOfSide(); return 0; }
    const i = trackAt(pos);
    const t = tracks[i];
    if (i !== audioTrack) {
      // wait (briefly) for the file check so a missing file is never requested
      if (probing.has(cur.id) && !known.has(t.src) && waitT < 2) { waitT += dt; return 0; }
      startTrackAudio(i);
    }
    const end = trackEnd(i);
    let moving = true;
    if (missing.has(t.src) || audioEnded) pos += dt;
    else if (!audio.paused && !audio.seeking && audio.readyState >= 3) {
      waitT = 0;
      const at = offsets[i] + audio.currentTime;
      if (Math.abs(at - pos) < 0.75) pos = Math.max(pos, at);
      else {
        // the audio drifted from the tape (a seek that did not take): tape leads, audio follows
        pos += dt;
        resyncT += dt;
        if (resyncT > 0.5) {
          resyncT = 0;
          try { audio.currentTime = pos - offsets[i]; } catch { /* not seekable yet */ }
        }
      }
    } else {
      // still buffering: hold the tape briefly, then run on regardless
      waitT += dt;
      if (waitT > 3) pos += dt; else moving = false;
    }
    if (pos >= end - 1e-6) {
      pos = end;
      if (i === tracks.length - 1) { endOfSide(); return 0; }
      audio.pause();
      audioTrack = -1;
    }
    return moving ? 1 : 0;
  }

  // ---------- mechanism: load / flip / eject ----------
  async function flip() {
    if (!cur) return tap("flip");
    tap("flip");
    savePos();
    if (mode !== "stop") setMode("stop");
    busy = true;
    const to = side === "A" ? "B" : "A";
    const swap = () => {
      side = to;
      mem(cur.id).side = to;
      bindSide();
      ev.emit("deck");
    };
    try {
      if (view) await view.flip(to, swap); else swap();
    } finally {
      busy = false;
    }
    ev.emit("settled");
    announce({ kind: "flip", side });
    runQueued(); // a tape picked (or a link followed) while the cassette was turning
  }

  async function eject() {
    queued = null; // eject means an empty deck: never let an older request load after it
    if (!cur) return tap("eject");
    tap("eject");
    savePos();
    if (mode !== "stop") setMode("stop");
    busy = true;
    try { if (view) await view.eject(); } finally { busy = false; }
    cur = null;
    bindSide();
    ev.emit("deck");
    ev.emit("settled");
    announce({ kind: "eject" });
    runQueued();
  }

  // opts: { side?: "A" | "B", track?: zero-based index }
  async function load(id, opts = {}) {
    const c = byId.get(id);
    if (!c) return;
    if (busy) { queued = { id, ...opts }; return; }
    const wantSide = opts.side || mem(id).side || "A";
    if (cur && cur.id === id && opts.track == null && wantSide === side) return;
    if (cur && cur.id === id) {
      // same tape: just move to the requested side and track
      if (wantSide !== side) { await flip(); }
      if (busy || cur !== c) return; // something queued during the flip has taken over
      if (opts.track != null) { pos = offsets[Math.min(opts.track, tracks.length - 1)] || 0; audioTrack = -1; }
      return;
    }
    probe(c);
    savePos();
    if (mode !== "stop") setMode("stop");
    busy = true;
    const swap = () => {
      cur = c;
      side = wantSide;
      const m = mem(c.id);
      m.side = side;
      if (opts.track != null) {
        tracks = c.sides[side].tracks;
        let acc = 0;
        for (let k = 0; k < Math.min(opts.track, tracks.length - 1); k++) acc += Math.max(1, Number(tracks[k].dur) || 0);
        m[side] = acc;
      }
      bindSide();
      ev.emit("deck");
    };
    try {
      if (view && !reduceMotion) await view.load(c, wantSide, swap);
      else { swap(); view?.setCassette(c, wantSide); }
    } finally {
      busy = false;
    }
    ev.emit("settled");
    announce({ kind: "load", cassette: c, side });
    runQueued();
  }
  function runQueued() {
    if (!queued) return;
    const q = queued;
    queued = null;
    load(q.id, q);
  }

  return {
    on: ev.on,
    // data
    setTapes(list) {
      tapes = list;
      byId.clear();
      for (const c of tapes) byId.set(c.id, c);
    },
    get tapes() { return tapes; },
    getTape: (id) => byId.get(id),
    // what is in the deck
    get cassette() { return cur; },
    get side() { return side; },
    get tracks() { return tracks; },
    get offsets() { return offsets; },
    get total() { return total; },
    get pos() { return pos; },
    get mode() { return mode; },
    get index() { return curIndex; },   // track under the playhead, -1 until first tick
    trackAt,
    isMissing: (src) => missing.has(src),
    // actions
    press,            // "rewind" | "play" | "forward" | "stop" | "flip" | "eject"
    seekTo,           // wind to a track of the current side, then play
    load,             // load a cassette (queued if the mechanism is busy)
    halt() { if (mode !== "stop") setMode("stop"); },   // stop without a key sound
    tick,             // advance the tape by dt seconds; call every frame
    // environment
    setView(v) { view = v; },
    setReduceMotion(v) { reduceMotion = v; },
  };
}
