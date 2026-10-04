// The analogue displays of the CS-86 (docs/DESIGN.md §5): twin VU needles, the fluorescent peak
// meter, the function tube, the red LED readout, the mechanical counter, pilot lamps and the
// station dial. Each one is a THREE.Object3D built in its own local frame (aperture centred on
// the origin, viewer at +z, everything within z in [-depth, 0]); deck3d.js mounts them.
// THREE and LOOK are passed in; this module never imports three.js itself.
import { tokens, prng, fbm } from "./displays/util.js";
import { buildVU } from "./displays/vu.js";
import { buildMeter, buildModes } from "./displays/tube.js";
import { buildLED } from "./displays/led.js";
import { buildCounter } from "./displays/counter.js";
import { buildLamps } from "./displays/lamps.js";
import { buildDial } from "./displays/dial.js";

export const SIZES = {        // cm; the aperture each display fills (w x h); depth = space it may use behind z = 0
  counter: { w: 3.0, h: 1.5, depth: 1.4 },
  led: { w: 4.4, h: 1.5, depth: 0.6 },
  lamps: { w: 7.8, h: 0.7, depth: 0.5 },
  modes: { w: 7.8, h: 1.7, depth: 0.6 },
  vuL: { w: 7.0, h: 3.6, depth: 1.3 },
  vuR: { w: 7.0, h: 3.6, depth: 1.3 },
  vfd: { w: 14.2, h: 1.7, depth: 0.6 },
  dial: { w: 13.6, h: 2.4, depth: 0.8 },
};

const PIN = -100;   // "nothing": below every scale

export function createDisplays({ THREE, renderer, LOOK, maxAniso }) {
  const { D, font, ink } = tokens(LOOK);
  const disposables = [];
  let aniso = maxAniso;
  if (!(aniso >= 1)) {
    try { aniso = renderer && renderer.capabilities ? renderer.capabilities.getMaxAnisotropy() : 1; } catch { aniso = 1; }
  }
  const env = {
    THREE, D, font, ink, maxAniso: Math.min(16, aniso || 1), rand: prng(0xca5e7),
    track(x) { disposables.push(x); return x; },
  };

  const vuL = buildVU(env, "L");
  const vuR = buildVU(env, "R");
  const vfd = buildMeter(env);
  const modes = buildModes(env);
  const led = buildLED(env);
  const counter = buildCounter(env);
  const lamps = buildLamps(env);
  const dial = buildDial(env);

  const meshes = {
    counter: counter.object, led: led.object, lamps: lamps.object, modes: modes.object,
    vuL: vuL.object, vuR: vuR.object, vfd: vfd.object, dial: dial.object,
  };
  const activity = { vu: 0, vfd: 0, led: 0, dial: 0 };

  // per-frame summary handed to the instruments (preallocated, mutated in place)
  const f = { t: 0, dt: 0, mode: "stop", loaded: false, side: "A", seconds: 0, frac: 0, speed: 0, trackIndex: -1, program: null, signal: true };
  let program = null, reduce = false, prevLoaded = false;
  // ema / emaT / trk: a slow per-track loudness reference, so a quiet archival recording still
  // moves the needles (both meters shift together, at most +-8 dB)
  // ema starts from the first 300 ms of each track (accT / accSum / accN), so a loud opening
  // never pins the needles while the reference catches up
  const st = { bootT: -1, warm: 0, silentT: 0, ema: 0, emaT: 0, trk: -2, accT: 0, accSum: 0, accN: 0, started: 0 };   // doubles in object fields: writes never box

  function normProgram(p) {
    if (!p) return null;
    const tracks = Array.isArray(p.tracks) ? p.tracks : [];
    let offsets = p.offsets, total = Number(p.total);
    if (!Array.isArray(offsets) || offsets.length !== tracks.length || !(total > 0)) {
      offsets = []; total = 0;
      for (const t of tracks) { offsets.push(total); total += Math.max(1, Number(t.dur) || 0); }
    }
    return { id: String(p.id || ""), name: p.name || "", color: p.color || "", side: p.side === "B" ? "B" : "A", total, offsets, tracks };
  }

  function setProgram(p) {
    program = normProgram(p);
    f.program = program;
    counter.setProgram(program);
    dial.setProgram(program);
  }

  function update(state) {
    const s = state || f;
    const dt = Math.min(0.1, Math.max(0, Number(s.dt) || 0));
    f.t = Number(s.t) || 0;
    f.dt = dt;
    f.mode = s.mode || "stop";
    f.loaded = !!s.loaded;
    f.side = s.side === "B" ? "B" : "A";
    f.seconds = Number(s.seconds) || 0;
    f.frac = Number(s.frac) || 0;
    f.speed = Number(s.speed) || 0;
    f.trackIndex = s.track ? s.track.index : -1;
    // false when the deck plays but no programme can reach it (a missing file, a stalled stream)
    f.signal = s.signal !== false;

    // boot warm-up: lamps and backlights rise as 1 - e^(-3t)
    let dirty = false;
    if (st.bootT < 0) { st.bootT = 0; dirty = true; } else st.bootT += dt;
    const w = reduce ? 1 : 1 - Math.exp(-3 * st.bootT);
    const nw = w > 0.995 ? 1 : w;
    if (nw !== st.warm) { st.warm = nw; dirty = true; }

    const loaded = f.loaded, mode = f.mode;
    const loadedEdge = loaded && !prevLoaded;
    prevLoaded = loaded;
    const winding = loaded && (mode === "rewind" || mode === "forward");

    // ---- levels: real, cue chatter, hiss floor, or nothing
    let vuDbL = PIN, vuDbR = PIN, pkDbL = PIN, pkDbR = PIN;
    const lv = s.levels;
    const l = lv ? Number(lv.l) || 0 : 0, r = lv ? Number(lv.r) || 0 : 0;
    if (winding) {
      st.silentT = 0;
      const k = Math.min(1, Math.abs(f.speed) / 16);
      vuDbL = -14 + 5 * fbm(f.t * 9) * k;
      vuDbR = -14 + 5 * fbm(f.t * 9 + 31.7) * k;
      pkDbL = vuDbL + 6; pkDbR = vuDbR + 6;
    } else if (loaded && mode === "play" && !f.signal) {
      // no source: the meters are dead (needles at rest, no bars); the function tube says
      // NO SIGNAL. Nothing pretends to respond to audio that is not there
      st.silentT = 0;
    } else if (loaded && mode === "play") {
      if (l + r < 1e-4) st.silentT += dt; else st.silentT = 0;
      if (st.silentT > 0.6) {
        // a routed, playing, near-silent source: the needles rest, and at most the first
        // segment of the peak meter flickers dimly with the tape hiss
        pkDbL = -33 + 3.4 * (0.5 + 0.5 * fbm(f.t * 17));
        pkDbR = -33 + 3.4 * (0.5 + 0.5 * fbm(f.t * 17 + 5.1));
      } else {
        if (f.trackIndex !== st.trk) {
          st.trk = f.trackIndex; st.emaT = 0; st.ema = D.vuZeroDbfs - D.vuEma;
          st.accT = 0; st.accSum = 0; st.accN = 0; st.started = 0;
        }
        const rmsDb = 20 * Math.log10(Math.max(l, r, 1e-5));
        if (!st.started && rmsDb > -45) {
          st.accSum += rmsDb; st.accN += 1; st.accT += dt;
          if (st.accT >= 0.3) { st.started = 1; st.ema = st.accSum / st.accN; st.emaT = 0.3; }
        }
        if (st.started && rmsDb > -45) {
          st.emaT += dt;
          const tau = Math.min(8, 1 + st.emaT);
          st.ema += (rmsDb - st.ema) * Math.min(1, dt / tau);
        }
        const off = Math.max(-8, Math.min(8, st.ema + D.vuEma - D.vuZeroDbfs));
        const vz = Math.pow(10, (D.vuZeroDbfs + off) / 20), pz = Math.pow(10, (D.vfdZeroDbfs + off) / 20);
        vuDbL = 20 * Math.log10(Math.max(l / vz, 1e-5));
        vuDbR = 20 * Math.log10(Math.max(r / vz, 1e-5));
        const pl = lv && lv.pl > 0 ? lv.pl : l * 1.41, pr = lv && lv.pr > 0 ? lv.pr : r * 1.41;
        pkDbL = pl > 0 ? 20 * Math.log10(pl / pz) : PIN;
        pkDbR = pr > 0 ? 20 * Math.log10(pr / pz) : PIN;
      }
    } else st.silentT = 0;

    // ---- instruments. The backlights follow the power (the boot warm-up), as on a real deck:
    // they stay lit through a flip or an eject; only the programme (needles, bars, digits) needs a tape
    const lampVU = D.vuLampOn;
    if (vuL.step(vuDbL, lampVU, dt, st.warm)) dirty = true;
    if (vuR.step(vuDbR, lampVU, dt, st.warm)) dirty = true;
    if (vfd.step(pkDbL, pkDbR, st.warm, dt, loadedEdge, loaded && (mode === "play" || winding))) dirty = true;
    if (modes.step(f)) dirty = true;
    if (led.step(f, st.warm, dt)) dirty = true;
    if (counter.step(f, dt)) dirty = true;
    if (lamps.step(f, st.warm, dt)) dirty = true;
    if (dial.step(f, st.warm, dt)) dirty = true;

    // flicker: +-1 % per rendered frame while lit (never a reason to render by itself)
    const fl = reduce ? 1 : 1 + (Math.random() * 2 - 1) * 0.01;
    vfd.flicker(fl);
    modes.flicker(fl);

    activity.vu = Math.min(1, (vuL.level + vuR.level) / (2 * D.vuLampOn));
    activity.vfd = vfd.activity;
    activity.led = led.activity;
    activity.dial = dial.activity;
    if (loaded && mode === "play") dirty = true;
    return dirty;
  }

  function knock(strength) {
    const k = Math.max(0, Math.min(1, Number(strength) || 0));
    vuL.knock(k); vuR.knock(k);
  }

  // the phone ("stack") layout reads the dial at a quarter of the desktop size
  function setCompact(on) { return dial.setCompact(on); }

  // device px per cm at the meters in the largest view: the needles never draw thinner than
  // about 1.3 device px (a sub-pixel blade breaks into a dotted line). Returns dirty.
  function setPixelScale(pxPerCm) {
    const a = vuL.setPixelScale(pxPerCm), b = vuR.setPixelScale(pxPerCm);
    return a || b;
  }

  function setReduceMotion(on) {
    reduce = !!on;
    vuL.setReduce(reduce); vuR.setReduce(reduce);
    vfd.setReduce(reduce); modes.setReduce(reduce);
    led.setReduce(reduce); counter.setReduce(reduce);
    lamps.setReduce(reduce); dial.setReduce(reduce);
  }

  function dispose() {
    dial.dispose();
    for (const x of disposables) { try { x.dispose(); } catch { /* already gone */ } }
    disposables.length = 0;
    for (const k in meshes) { const m = meshes[k]; if (m.parent) m.parent.remove(m); }
  }

  return { meshes, activity, setProgram, update, knock, setReduceMotion, setCompact, setPixelScale, dispose };
}
