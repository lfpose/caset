// Deck sounds, synthesised with WebAudio: mechanical clunks, tape hiss, winding whine.
// Nothing here loads a file.
export function createSound() {
  let ctx = null;
  let out, noise, hissGain, windGain, windBand, whine, whineGain;
  let windLevel = 0, windPitch = 0, hissOn = false;
  let idleTimer = 0;

  // The looping noise and the whine run for as long as the context does, so the context
  // is suspended once the deck has been quiet for a moment and woken on the next sound.
  function wake() {
    clearTimeout(idleTimer);
    idleTimer = 0;
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  }
  function settle() {
    clearTimeout(idleTimer);
    idleTimer = 0;
    if (!ctx || hissOn || windLevel > 0) return;
    idleTimer = setTimeout(() => {
      idleTimer = 0;
      if (ctx.state === "running" && !hissOn && windLevel === 0) ctx.suspend().catch(() => {});
    }, 2500);
  }

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
    out = ctx.createGain();
    out.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    out.connect(comp).connect(ctx.destination);

    // two seconds of pinkish noise, reused by every voice
    const len = ctx.sampleRate * 2;
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }

    // hiss: bright, quiet, only while the tape runs at play speed
    const hissSrc = loopNoise();
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 2400;
    const shelf = ctx.createBiquadFilter();
    shelf.type = "highshelf"; shelf.frequency.value = 7000; shelf.gain.value = 4;
    hissGain = ctx.createGain(); hissGain.gain.value = 0;
    hissSrc.connect(hp).connect(shelf).connect(hissGain).connect(out);

    // wind: band of noise plus a motor whine that follows reel speed
    const windSrc = loopNoise();
    windBand = ctx.createBiquadFilter();
    windBand.type = "bandpass"; windBand.frequency.value = 900; windBand.Q.value = 1.4;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    windSrc.connect(windBand).connect(windGain).connect(out);
    whine = ctx.createOscillator();
    whine.type = "triangle"; whine.frequency.value = 220;
    const wl = ctx.createBiquadFilter();
    wl.type = "lowpass"; wl.frequency.value = 1400;
    whineGain = ctx.createGain(); whineGain.gain.value = 0;
    whine.connect(wl).connect(whineGain).connect(out);
    whine.start();
    return ctx;
  }

  function loopNoise() {
    const s = ctx.createBufferSource();
    s.buffer = noise; s.loop = true;
    s.start(0, Math.random() * 1.5);
    return s;
  }

  const KINDS = {
    key:   { thump: 0.34, f0: 150, f1: 62, len: 0.08, click: 0.3, cf: 2600, q: 1.2 },
    latch: { thump: 0.42, f0: 130, f1: 55, len: 0.1, click: 0.36, cf: 2000, q: 1.0 },
    lid:   { thump: 0.14, f0: 260, f1: 140, len: 0.05, click: 0.2, cf: 3600, q: 2.0 },
    shut:  { thump: 0.3, f0: 180, f1: 70, len: 0.08, click: 0.3, cf: 2800, q: 1.4 },
    drop:  { thump: 0.75, f0: 118, f1: 40, len: 0.2, click: 0.34, cf: 1500, q: 0.9, rattle: true },
    slide: { thump: 0, f0: 0, f1: 0, len: 0.3, click: 0.1, cf: 1100, q: 0.6, swish: true },
  };

  function clunk(kind = "key") {
    if (!ctx) return;
    wake();
    const k = KINDS[kind] || KINDS.key;
    const t = ctx.currentTime + 0.005;
    if (k.thump) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(k.f0, t);
      o.frequency.exponentialRampToValueAtTime(k.f1, t + k.len);
      const g = ctx.createGain();
      g.gain.setValueAtTime(k.thump, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + k.len * 1.6);
      o.connect(g).connect(out);
      o.start(t); o.stop(t + k.len * 1.7);
    }
    burst(t, k.click, k.cf, k.q, k.swish ? k.len : 0.03, k.swish);
    if (k.rattle) burst(t + 0.045, k.click * 0.45, k.cf * 1.6, 1.5, 0.025);
    settle();
  }

  function burst(t, level, freq, q, len, swell = false) {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = q;
    const g = ctx.createGain();
    if (swell) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(level, t + len * 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    } else {
      g.gain.setValueAtTime(level, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    }
    s.connect(bp).connect(g).connect(out);
    s.start(t, Math.random() * 1.5, len + 0.05);
  }

  return {
    unlock() {
      if (!init()) return;
      wake();
      settle();
    },
    clunk,
    setHiss(on) {
      if (!ctx || on === hissOn) return;
      hissOn = on;
      if (on) wake();
      hissGain.gain.setTargetAtTime(on ? 0.05 : 0, ctx.currentTime, 0.08);
      if (!on) settle();
    },
    // level 0..1 for winding, pitch in reel radians per second
    setWind(level, pitch) {
      if (!ctx) return;
      if (Math.abs(level - windLevel) < 0.02 && Math.abs(pitch - windPitch) < 0.4) return;
      windLevel = level; windPitch = pitch;
      if (level > 0) wake();
      const t = ctx.currentTime;
      windGain.gain.setTargetAtTime(level * 0.16, t, 0.06);
      whineGain.gain.setTargetAtTime(level * 0.035, t, 0.06);
      windBand.frequency.setTargetAtTime(600 + pitch * 55, t, 0.1);
      whine.frequency.setTargetAtTime(140 + pitch * 18, t, 0.1);
      if (level === 0) settle();
    },
  };
}
