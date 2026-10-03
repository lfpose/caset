# caset front end: how it fits together

Zero build. Plain ES modules in `public/js/`, three.js vendored in `public/vendor/`, data in `public/tapes.json`.

```
public/
  index.html        page skeleton (the DOM ids below are the only hard requirements)
  style.css         the HTML skin: palette tokens in :root
  tapes.json        the shelf (data model in README / handoff)
  covers/*.svg      one cover per cassette (portrait 600x1060, top 415 units = picture)
  js/
    app.js          composition root: builds everything, wires events, frame loop, boot
    core/           the engine. No styling, no DOM views. Keep it when redesigning.
      player.js     tape state, transport, audio sync, load/flip/eject sequencing
      router.js     #<cassette>/<a|b>/<n> links and the page title
      i18n.js       EN/ES interface copy, language preference, announcement wording
      events.js     tiny emitter
    ui/             HTML views. Replace freely.
      shelf.js      cassette cases
      liner.js      tracklist, now playing, note, credit, missing file, EN/ES
      keys.js       HTML transport buttons (over the 3D keys), keyboard shortcuts
      dom.js        h(), fmt(), inkFor()
    deck/           the 3D deck. Replace freely, as long as it honours the contract below.
      deck3d.js     scene, model, animations
      look.js       every colour, font and light level of the 3D deck
    sound.js        synthesised deck sounds (clunks, winding)
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

`createDeck({ canvas, slot, reduceMotion, onEvent })` reports mechanical moments through `onEvent(kind)`: `lid`, `lid-shut`, `slide`, `turn`, `drop` (app.js turns these into sounds) and `contextlost` (app.js falls back to HTML keys).

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

`#stage` (canvas), `#slot` containing `.key[data-action]` buttons with a `.key-lbl` span, `#status` (polite live region), `#rail` (shelf list), `#liner` with `#liner-body` and `.lang button[data-lang]`, `#player` (audio). A new design can change all of this together with the `ui/` modules.

## Checking behaviour after changes

A headless trace drives the deck through 36 states (deep link, play, wind, flip, click-to-wind, held track, ES, bad links, end of side, eject, tapes queued mid-animation, phone width, reduced motion, lost WebGL) and records the visible state. Two runs on unchanged code are identical, so any difference means behaviour changed. It is not in the repo yet; ask for it to be added under `test/` if the redesign agent should run it.
