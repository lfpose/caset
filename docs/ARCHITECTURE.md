# caset front end: how it fits together

Zero build. Plain ES modules in `public/js/`, three.js vendored in `public/vendor/`, data in `public/tapes.json`.

```
public/
  index.html        page skeleton (the DOM ids below are the only hard requirements)
  style.css         the HTML skin (docs/DESIGN.md §D2): tokens in :root, the grain layer, all layouts
  tapes.json        the shelf (data model in README / handoff)
  covers/*.svg      one cover per cassette (portrait 600x1060, top 415 units = picture)
  vendor/           three.js r186 (minified) plus the few examples the deck uses:
                    postprocessing/ (EffectComposer, UnrealBloomPass, OutputPass...), shaders/,
                    utils/BufferGeometryUtils.js, RoundedBoxGeometry.js. Imports point at
                    ./three.module.min.js; no CDN (CSP is default-src 'self').
  js/
    app.js          composition root: builds everything, wires events, frame loop, boot
    core/           the engine. No styling, no DOM views. Keep it when redesigning.
      player.js     tape state, transport, audio sync, load/flip/eject sequencing
      router.js     #<cassette>/<a|b>/<n> links and the page title
      i18n.js       EN/ES interface copy, language preference, announcement wording
      events.js     tiny emitter
    ui/             HTML views. Replace freely.
      shelf.js      the shelf: ten small flat cassettes (label cut from the cover's picture band),
                    a sticky index beside the deck on desks, a scroll-snap rail under it on
                    tablets and phones; one .case button per tape (stretched over its card) plus
                    A / B side chips that load that side; roving focus (arrows, Home, End)
      liner.js      the panel under the deck, in reading order: the tape header, now playing
                    (clock, side progress, title, who · year · place, missing file), an A | B
                    switch (flips) over the side's three tracks, then the note and credit
      mini.js       the plate caption's live readout and the mini player bar (any width,
                    shown while a tape is loaded and the deck is scrolled out of view)
      copy.js       the page's own EN/ES copy (intro, spec line, shelf heading, How it
                    works...), applied to [data-copy] / [data-copy-label]; pointer-aware hints
      keys.js       HTML transport buttons (over the 3D keys), keyboard shortcuts
      film.js       generates the grain tile for the .film layer (CSS steps it at 8 fps)
      meter.js      no-WebGL instrument strip: peak meter + station dial, fed by levels
      dom.js        h(), fmt(), inkFor(), readable(), sideSeconds(), createProgress()
    deck/           the 3D deck. Replace freely, as long as it honours the contract below.
      deck3d.js     scene, body, door choreography, keys, lights, camera framing, render on demand,
                    and the studio: one seamless sweep (floor, cove, wall) that falls off to the
                    page colour, with a warm pool that leans toward the loaded tape's colour
      look.js       every colour, font, material and light level of the deck and its displays
      post.js       HDR post chain: bloom with warm halation, grade (lift, roll-off, CA, an edge
                    guard that eases the full view's outer 16 px to the ground so bloom never
                    reaches the canvas edge), AgX tone mapping. Falls back to a direct render
                    without float targets (deck3d.js then sets html.post-off: a CSS edge fade)
      displays.js   the analogue displays (VU pair, peak VFD, function tube, red LED, counter,
                    pilot lamps, station dial) as THREE objects; deck3d.js mounts them
      displays/     one builder per display + util.js (shared shaders, noise, LOOK fallbacks)
      parts/        cassette.js (shell, packs, hubs, label), tex.js (canvas textures),
                    merge.js (merges static meshes per material to save draw calls)
    levels.js       live L/R RMS + peak of the <audio> element, on sound.js's AudioContext
    sound.js        synthesised deck sounds (clunks, winding); context() and hold() for levels.js
```
## Redesigning

- **Restyle the 3D deck:** start in `js/deck/look.js` (colours, lights, fonts), then geometry in `deck3d.js` (dimensions are constants at the top, in cm).
- **Restyle the HTML:** `style.css` and the `js/ui/*` views. They only read engine state and listen to its events.
- **Replace the 3D deck entirely:** write a new module that returns an object with the contract below and pass it in `app.js` instead of `createDeck(...)`. Returning `null` (or never creating one) gives the plain HTML-keys mode, so the whole app works with no deck at all.
- **Don't change** `js/core/` for a visual redesign. All behaviour lives there.

## Deck view contract

What `player.js` and the views call on the deck. All methods are optional only in the sense that `deck` may be `null`; if a deck exists it must implement all of them.

| Member | Called by | Meaning |
|---|---|---|
| `load(cassette, side, swap)` → Promise | player | Animate a tape in (eject the old one first). Call `swap()` once, at the moment the new tape becomes "the one in the deck". Resolve when settled. |
| `flip(toSide, swap)` → Promise | player | Turn the tape over. Call `swap()` once, mid-turn. |
| `eject()` → Promise | player | Take the tape out, leave the deck empty. |
| `setCassette(cassette, side)` | player | Same as load but instant (reduced motion). |
| `setTape(frac, speed, dt, seconds)` | player, every frame | Playhead as a 0..1 fraction of the side, speed in x real time (negative = rewinding), seconds into the side (counter). |
| `setLatched(action \| null)` | player | Which transport key is held down: `rewind`, `play`, `forward`, or none. |
| `tap(action)` | player | A momentary key press (including refused ones). |
| `setKeyLabel(action, text)`, `setFlipLabel(text)` | keys.js | Key-top text in the current language. |
| `keyRects` | keys.js | `[{ action, x, y, w, h }]` in page pixels, after `fit()`. The HTML buttons are laid over these. |
| `fit()` | keys.js | Re-fit the camera to `#slot`'s size and refresh `keyRects`. |
| `frame(t, dt)` | app.js, every frame | Render. |
| `setReduceMotion(bool)` | app.js | Instant transitions, no idle motion. |
| `setLevels({ l, r, pl, pr })` (optional) | app.js, every frame before `frame()` | Programme levels from `levels.js`: linear 0..1 RMS (`l`, `r`) and sample peak (`pl`, `pr`). The deck copies the numbers and keeps no reference. app.js calls it as `deck.setLevels?.(lv)`, so a deck without meters can leave it out. |
| `setSignal(bool)` (optional) | app.js, every frame | Whether a programme reaches the meters (false for a missing file or a stalled stream): the VU and peak meter go dead and the function tube lights NO SIGNAL. |
| `setFocus("full" \| "meters")`, `focus` (optional) | app.js (the caption's view switch, Escape, a click on the deck) | The camera's framing: the whole deck, or eased in (1.1 s) on the display bar. Desk / tablet / landscape only; the deck returns to `full` by itself on load, flip and eject. `keyRects` entries then carry `hidden: true` for keys out of the frame (keys.js hides those buttons). |

`createDeck({ canvas, slot, reduceMotion, onEvent })` reports mechanical moments through `onEvent(kind)`: `lid`, `lid-shut`, `slide`, `turn`, `drop` (app.js turns these into sounds), `contextlost` (app.js falls back to HTML keys), `keys` (key rects moved without a re-fit, during a focus move: app.js calls `keys.sync()`) and `focus` (the framing changed).

Framing presets (`fit()`): **full** (one view, the deck on its sweep) everywhere except portrait phones, which get **phone**: the whole deck as the hero, then a gap, then a *loupe* view of the VU pair and the peak meter (`REGION.loupe`). On phones and touch screens keys.js docks the HTML keys as a flat 56 px key bar under the deck (`html.is-dock`); the 3D keys still move with them. deck3d.js publishes the loupe's place as `--loupe-top` / `--loupe-h` on `#slot` (style.css draws its rounded frame and caption). Every lit material's output is capped at 24 (linear) in `tonemapping_fragment`, so a grazing specular glint never overflows the half-float target.

The deck renders on demand: `frame()` only draws when something moved (keys, door, tape,
meters, lamps, parallax). With a tape loaded and stopped it settles to zero draws within a few
seconds, once the meters have fallen back.

### Displays (`deck/displays.js`)

`createDisplays({ THREE, renderer, LOOK })` returns `{ meshes, activity, setProgram(p), update(state) -> dirty, knock(s), setReduceMotion(b), setCompact(b), setPixelScale(pxPerCm) -> dirty, dispose() }` (`setCompact` switches the station dial to its phone layout; `setPixelScale` keeps the VU needles at least ~1.3 device px wide). Backlights (VU lamps, the peak meter's legend) follow the power-on warm-up, not the tape, so they stay lit through a flip. Calibration (`LOOK.display`): VU 0 = -24 dBFS RMS, peak-meter 0 = -15 dBFS peak, a per-track loudness reference seeded from the first 300 ms and aimed `vuEma` (9) dB under VU 0. `SIZES` (exported) gives each display's aperture in cm; every mesh is built in its own frame (aperture centred on the origin, facing +z) and deck3d.js positions it on the fascia. `update()` takes the deck's preallocated per-frame state (`t, dt, mode, loaded, side, seconds, frac, speed, track, levels`) and returns whether anything visible changed, which feeds render on demand. `activity` (0..1 per group) drives the light spill on the metal. displays.js imports no three.js and reads only `LOOK.font`, `LOOK.ink`, `LOOK.STRIPES` and `LOOK.display`.

### Levels (`levels.js`)

`createLevels({ audio, sound })` returns `{ read(), routed }`. `read()` returns the same `{ l, r, pl, pr }` object every call (zeros when paused, before routing or when disabled). The `<audio>` element is routed through sound.js's context only once that context is already running (after a gesture), always to the speakers first at gain 1, so a failure never silences playback. While the element plays, `sound.hold(true)` keeps the context from idling. app.js loads it with a dynamic import; if it is missing, the meters read zero and nothing else changes. `?levels=0` turns it off.

## Engine events (`player.on(name, fn)`)

| Event | Payload | Used for |
|---|---|---|
| `latch` | action or null | key aria-pressed state |
| `announce` | `{ kind, ... }`, worded by `i18n.phrase()` | the `#status` live region |
| `deck` | | a tape or side was swapped in: re-render shelf state, liner, flip label |
| `settled` | | load / flip / eject finished: update the URL |
| `track` | index | track under the playhead changed: liner "now", URL |
| `time` | | playhead moved: liner clock |
| `missing` | src | an audio file does not exist: liner notice |

Read state through `player.cassette`, `side`, `tracks`, `offsets`, `total`, `pos`, `mode`, `index`, `tapes`, `getTape(id)`, `trackAt(seconds)`, `isMissing(src)`. Act through `press(action)`, `seekTo(i)`, `load(id, { side, track })`, `halt()`.

## DOM the current views expect

`#stage` (canvas) and `.loupe` in `#slot` (inside `figure.plate#deck`), `.key[data-action]` buttons with a `.key-lbl` span, `.view button[data-view]` (the framing switch in the caption), `#status` (the only live region), `#rail` (the shelf: one set of `.case[data-id]` buttons, inside `section#tapes`), `#liner` with `#liner-body` (`.track[data-i]` with `aria-current` for the side in the deck only; the other side is reached through the `.side-switch` A | B buttons; `.missing`), exactly one `.lang` group with `button[data-lang]` (in the top bar; liner.js keeps their `aria-pressed`), `#cap-r` (plate caption), `#mini` (mini player), `#steps`, `#player` (audio). A new design can change all of this together with the `ui/` modules.

`body` carries exactly `gl` or `nogl` (the trace compares it); other page state lives on `<html>` (`is-booted`, `is-loaded`, `is-playing`, `is-scrolled`, `is-meters`, `post-off`). There is no room layer any more: the deck's own studio is the backdrop and its edge is the page colour (`LOOK.stage.groundLinear`, tuned so the canvas edge reads `#15110e`; re-tune it if the post chain or tone mapping change). `.film` (last child of body) holds only the grain tile.

## Dev switches (query string)

`?nogl` skip the 3D deck (HTML deck + meter.js) · `?tier=low|high` force the deck's quality tier (software renderers start on low) · `?post=0` no post chain · `?levels=0` no level metering · `?debug` exposes `window.__deck` and logs draw calls · `?debug=bloom` shows only the bloom · `?debug=slow` plays the deck's animations at 0.08x.

## Checking behaviour after changes

A headless trace drives the deck through 36 states (deep link, play, wind, flip, click-to-wind, held track, ES, bad links, end of side, eject, tapes queued mid-animation, phone width, reduced motion, lost WebGL) and records the visible state. Two runs on unchanged code are identical, so any difference means behaviour changed.

```
npx wrangler dev --port 8787 &
node test/trace.mjs /tmp/out.json [/tmp/shots/t]
node test/compare.mjs /tmp/out.json      # must print "behaviour identical to baseline"
```

It runs Chromium headless with SwiftShader, which is far slower than a GPU: the first page of a freshly launched browser can run at a few frames per second for several seconds, so timing-sensitive checks should warm up a page first.
