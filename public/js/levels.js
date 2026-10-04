// Program levels for the deck's meters: per-channel RMS and sample peak of what the <audio>
// element is playing, read from AnalyserNodes on sound.js's own AudioContext (DESIGN.md §6).
//
//   const lv = createLevels({ audio, sound });
//   lv.read()   -> { l, r, pl, pr }   the SAME object every call. Linear 0..1: l / r are RMS over
//                                     the last 1024 samples, pl / pr the sample peak of that window.
//                                     Raw, unsmoothed: the displays apply their own ballistics.
//                                     Zeros when not routed, when paused, or when disabled.
//   lv.routed   -> boolean            the element is flowing through the AudioContext (debugging)
//
// Wiring (app.js, engineer D; this module never touches app.js itself):
//
//   const ZERO = { l: 0, r: 0, pl: 0, pr: 0 };
//   let levels = null;
//   import("./levels.js")
//     .then((m) => { levels = m.createLevels({ audio: $("#player"), sound }); })
//     .catch(() => {});
//   // in loop(), after player.tick(dt):
//   const lv = levels ? levels.read() : ZERO;
//   deck?.setLevels?.(lv);           // the deck copies the numbers; it keeps no reference
//   deck?.frame(t / 1000, dt);
//
// Needs sound.js's context() and hold(on). If either is missing the module stays inert.
//
// Playback is never silenced or blocked:
// - Nothing changes until read() finds sound.js's context already running (sound.unlock() runs in
//   every gesture), so this module never creates or resumes a context outside the hold handlers
//   and no autoplay warning can appear. Before that, the element plays straight to the speakers.
// - The element source goes to ctx.destination at gain 1 before anything else is built. If a later
//   step fails, the audio still plays through the context and the meters just read zero.
// - Once routed: play / playing hold the context awake (sound.hold(true) also resumes it);
//   pause / ended / emptied release it to sound.js's normal 2.5 s idle suspend.
// - A watchdog (a timer, so it also runs with the tab hidden, when rAF stops) resumes the context
//   once a second if the element is playing but the context has been stopped for 500 ms.
// - Kill switch: ?levels=0, or a user agent matching LEVELS_DENY, skips routing entirely.
// - Audio must stay same-origin (it is: /audio/*). A cross-origin source without CORS would
//   come out of a MediaElementAudioSourceNode as silence.
//
// Cost: read() returns at once while paused; while playing it does one 1024-sample pass per
// channel into preallocated buffers, with no allocation. The watchdog timer only runs while playing.

const LEVELS_DENY = [];          // RegExps tested against navigator.userAgent
const FFT = 1024;
const MONO_SECONDS = 0.5;        // R silent while L is not, for this long: mirror L into R
const routedElements = new WeakSet();

export function createLevels({ audio, sound }) {
  const out = { l: 0, r: 0, pl: 0, pr: 0 };
  let disabled = !audio || !sound || typeof sound.context !== "function" || typeof sound.hold !== "function" || killed();
  let ctx = null;
  let routed = false;            // the element source exists: the hold handlers are live
  let metered = false;           // the analysers exist
  let anL = null, anR = null;
  let bufL = null, bufR = null;  // Float32Array, or Uint8Array on engines without float time data
  let useFloat = true;
  let mirror = false, monoT = 0, lastRead = 0;
  let watch = 0, stalledAt = 0, lastResume = 0;

  function killed() {
    try {
      if (/(?:^|[?&])levels=0(?:&|$)/.test(location.search)) return true;
      const ua = navigator.userAgent || "";
      for (let i = 0; i < LEVELS_DENY.length; i++) if (LEVELS_DENY[i].test(ua)) return true;
    } catch { /* no location / navigator: allow */ }
    return false;
  }

  function zero() {
    out.l = 0; out.r = 0; out.pl = 0; out.pr = 0;
    return out;
  }

  // ---------- routing (once per element, lazily, only on a running context) ----------
  function route() {
    const c = sound.context();
    if (!c || c.state !== "running") return;
    if (routedElements.has(audio)) { disabled = true; return; }
    let src;
    try {
      src = c.createMediaElementSource(audio);
    } catch {
      disabled = true;            // nothing was rerouted: the element still plays directly
      return;
    }
    routedElements.add(audio);
    ctx = c;
    try {
      src.connect(c.destination);  // first: the listener hears exactly what they heard before
    } catch {
      // Cannot happen on a sane engine; if it does, the element is silent, so say so loudly.
      console.error("levels: could not connect the audio element to the output");
    }
    routed = true;
    listen();
    if (!audio.paused) start();

    try {
      // Up-mix to exactly two channels before splitting, so a mono source feeds both meters.
      // A 2-channel "explicit" / "speakers" gain node does this deterministically; setting
      // "speakers" on the splitter alone left R intermittently silent on mono files in Chromium.
      // The mono heuristic in read() covers engines that refuse either.
      const up = c.createGain();
      try {
        up.channelCount = 2;
        up.channelCountMode = "explicit";
        up.channelInterpretation = "speakers";
      } catch { /* keep the defaults */ }
      const split = c.createChannelSplitter(2);
      try { split.channelInterpretation = "speakers"; } catch { /* keep discrete */ }
      anL = c.createAnalyser();
      anR = c.createAnalyser();
      anL.fftSize = FFT; anR.fftSize = FFT;
      anL.smoothingTimeConstant = 0; anR.smoothingTimeConstant = 0;
      src.connect(up);
      up.connect(split);
      split.connect(anL, 0);
      split.connect(anR, 1);
      // A silent sink, so engines that only pull nodes connected to the output still run the
      // analysers. Gain 0 adds nothing to what is heard.
      const sink = c.createGain();
      sink.gain.value = 0;
      anL.connect(sink); anR.connect(sink);
      sink.connect(c.destination);
      useFloat = typeof anL.getFloatTimeDomainData === "function";
      bufL = useFloat ? new Float32Array(FFT) : new Uint8Array(FFT);
      bufR = useFloat ? new Float32Array(FFT) : new Uint8Array(FFT);
      metered = true;
    } catch {
      metered = false;            // playback is untouched; the meters read zero
    }
  }

  // ---------- keeping the context awake while program audio flows through it ----------
  function start() {
    sound.hold(true);
    stalledAt = 0;
    if (!watch) watch = setInterval(watchdog, 250);
  }
  function stop() {
    sound.hold(false);
    if (watch) { clearInterval(watch); watch = 0; }
    stalledAt = 0;
  }
  function watchdog() {
    if (audio.paused) { stop(); return; }
    if (ctx.state === "running") { stalledAt = 0; return; }
    const now = performance.now();
    if (!stalledAt) { stalledAt = now; return; }
    if (now - stalledAt >= 500 && now - lastResume >= 1000) {
      lastResume = now;
      ctx.resume().catch(() => {});
    }
  }
  function onStateChange() {
    // a suspend we did not ask for (another tab, an OS interruption): let the watchdog retry
    if (ctx.state !== "running" && !audio.paused) start();
  }
  function newSource() {
    mirror = false; monoT = 0;
    stop();
  }
  function listen() {
    audio.addEventListener("play", start);
    audio.addEventListener("playing", start);
    audio.addEventListener("pause", stop);
    audio.addEventListener("ended", stop);
    audio.addEventListener("emptied", newSource);
    try { ctx.addEventListener("statechange", onStateChange); } catch { /* old engines */ }
  }

  // ---------- reading ----------
  function measure(an, buf) {
    // returns RMS; leaves the peak in measure.peak (a number on a function: no allocation)
    let sum = 0, peak = 0;
    if (useFloat) {
      an.getFloatTimeDomainData(buf);
      for (let i = 0; i < FFT; i++) {
        const v = buf[i];
        sum += v * v;
        const a = v < 0 ? -v : v;
        if (a > peak) peak = a;
      }
    } else {
      an.getByteTimeDomainData(buf);
      for (let i = 0; i < FFT; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
        const a = v < 0 ? -v : v;
        if (a > peak) peak = a;
      }
    }
    measure.peak = peak > 1 ? 1 : peak;
    const rms = Math.sqrt(sum / FFT);
    return rms > 1 ? 1 : rms;
  }
  measure.peak = 0;

  function read() {
    if (disabled) return zero();
    if (!routed) {
      route();
      if (!routed) return zero();
    }
    if (!metered || audio.paused) { lastRead = 0; return zero(); }

    const l = measure(anL, bufL);
    const pl = measure.peak;
    let r, pr;
    if (mirror) {
      r = l; pr = pl;
    } else {
      r = measure(anR, bufR);
      pr = measure.peak;
      const now = performance.now();
      if (r < 1e-6 && l > 1e-4) {
        if (lastRead) monoT += (now - lastRead) / 1000;
        if (monoT > MONO_SECONDS) { mirror = true; r = l; pr = pl; }
      } else if (r >= 1e-6) {
        monoT = 0;
      }
      lastRead = now;
    }
    out.l = l; out.r = r; out.pl = pl; out.pr = pr;
    return out;
  }

  return {
    read,
    get routed() { return routed; },
  };
}
