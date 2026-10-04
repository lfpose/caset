# caset CS-86: final design spec

Status: final. This replaces the three proposals in `.work/design/`, which stay there only as background reading. Where this doc and a proposal disagree, this doc wins.

**Update (page v2):** after the owner reviewed the integrated build, the page around the deck was redesigned. **§D2 Page v2** (between §8 and §9) supersedes §8, §9.1, §11.D and the page parts of §0.2 (the walnut plank and dim room become a seamless studio sweep), §2.1 (the `full` fit is now 90% / 82%) and §4.4 (vignette and leak now 0). The deck object, displays, levels and wiring are unchanged.

**Update (critique round 1, page v3):** the layout in §D2.3-§D2.8 is superseded by what is built (see `docs/ARCHITECTURE.md`): an intro row (statement + spec line) over a full-width deck; now playing directly under it (Side A | Side B track columns on the left, the tape header and the recording on the right; a track on the other side is one click); the shelf as a grid of J-card tiles below; a framing switch (whole deck | meters) under the deck; on portrait phones the whole deck plus a loupe on the displays and transport (the five-band `stack` is gone). Deck look-dev changes: overhead soft box, lighter seamless with a stronger pool and contact shadow, 10° camera elevation, flush transport keys, one soft glare band per pane, dark reel tables and a moulded carriage in the empty well, recalibrated meters (§5.1/5.2 values now in `LOOK.display`).

Read `docs/ARCHITECTURE.md` first. The engine (`js/core/*`) does not change. `test/trace.mjs` plus `test/compare.mjs` define behaviour, and that behaviour stays byte-identical.

---

## 0. Decision

### 0.1 Scorecard (1 to 5)

| Criterion | Silver "CS-86" | Black "Night Shift" | Free "SD-77 Estación" |
|---|---|---|---|
| Technics-like ("a player like that Technics": the silver M226) | **5**: the M226's grammar, laid out to the cm | 3: M206 black, not the main model | 4: M226 bones, but a full-width radio dial changes the silhouette |
| Realistic material (brushed alu, smoked glass) | **5**: anisotropic soft-box look-dev is the core of the plan | 4 | 4 |
| Beautiful analogue displays | 4: VU pair, VFD, counter, small tape dial | **5**: VU, VFD with mode legends, red LED, program dial, light spill | **5**: VFD hero, station dial with years, TUNED lamp, reel-turn counter |
| Creative freedom (not a copy) | 3 | 4 | **5** |
| Retro / film vibe | 4 | **5** | 4 |
| Buildable in three.js, no build step | 3: regenerating the fascia per phone preset is costly | 3: ffmpeg level files, a data pipeline, and a bottom sheet | 3: six displays, plus a dial bridge across the top |
| Performance | 4 | 4: but its camera "breathing" keeps the GPU busy | 4 |
| Phone usability | 3: presets rebuild geometry | 4: one canvas, scissored bands | 4: same, plus a dial magnifier |
| Fits the levels constraint (analyser on sound.js's context) | 2: dedicated context | 1: precomputed envelopes | 2: dedicated context |
| **Total** | **33** | **33** | **35** |

Free scores highest on paper, but the owner's first sentence is "a player like that Technics". A top dial bridge makes a receiver, not that Technics. **The base is Silver**: the M226 body, its materials and its grammar. The best displays from the other two proposals are grafted on, in places where a 1983 Technics could plausibly have put them. Black's single-canvas multi-view phone strategy replaces Silver's presets. The levels come from neither proposal: they follow the brief (§6).

### 0.2 The direction in one paragraph

**caset CS-86** is a silver, brushed-aluminium, front-loading stereo cassette deck. It is seen almost head-on, on a walnut plank in a dim, warm room, and filmed on old stock. The silhouette and parts are an M226's: a left column with eject, power and phones, a front-loading door with a smoked window, a long smoked display bar across the upper right, long flat aluminium transport keys in black slots, and a big knurled aluminium knob. Behind the display glass, every instrument reads real data:

- a **mechanical counter** that counts reel turns
- a **red 7-segment LED** showing side, track and time (Lloyd's)
- **pilot lamps**
- a **fluorescent function tube** with PLAY, CUE, REV and END legends (Black)
- **twin amber-backlit VU needles** with IEC ballistics (M206)
- a white and amber **fluorescent peak meter** with ghost segments, filament wires and peak hold (the M226 close-up)

A **backlit station dial** sits under the cassette door, where each track is a "station" labelled with its year and an orange needle is the playhead. This is the Lloyd's dial and the backlit dial reference, rewired to tune into the tape (Free). The cassette is a clear smoked Duoman shell with brown tape packs, white toothed hubs and a label cut from the cover art. The room carries the film reference: warm bokeh light leaks, grain, dust, halation around everything that glows.

### 0.3 What comes from where

| From | Taken |
|---|---|
| Silver | Body, proportions, every material, the soft-box environment, the door choreography (Y-axis flip, swap at edge-on), the VU and VFD core specs, the mechanical counter, the empty open case on the shelf, the J-card liner, the bloom mips tinted red for halation, the cut discipline |
| Black | The red LED readout, VFD mode legends, compartment lamp levels, each VU with its own mechanics for mono tapes, light spill on the panel, a single canvas with scissored views on phones, the "rec lamp never lights" joke, the HDR emissive discipline |
| Free | The station dial (year as frequency, band change on flip, TUNED lamp), the counter counting reel turns, needle "knock" impulses on clunks, hub motion blur when winding, the tape colour tinting the room light, the cassette label layout |
| Brief | Levels from an AnalyserNode on **sound.js's own AudioContext**, kept awake while media plays (§6) |

The five-stripe brand **stays**. Rainbow stripes are period-correct for 1980s hi-fi and home computers. They appear in the HTML header, as a small printed stripe under the deck's "caset" wordmark, and on cassette labels that have no art. Nowhere else.

No real brand marks appear anywhere: no Technics, Sony, Maxell or Dolby. "NR B C" and "Normal CrO₂ Metal" are generic.

---

## 1. Ownership and parallel work

| # | Engineer | Owns (exclusive write) | Must not touch |
|---|---|---|---|
| A | **Deck** | `public/js/deck/deck3d.js` (rewrite), `public/js/deck/look.js`, `public/js/deck/post.js`, optional helpers under `public/js/deck/parts/*.js`, vendored files under `public/vendor/postprocessing/`, `public/vendor/shaders/`, `public/vendor/utils/` | everything else |
| B | **Displays** | `public/js/deck/displays.js`, optional helpers under `public/js/deck/displays/*.js`, dev harness `public/dev/displays*.{html,js}` | everything else |
| C | **Audio** | `public/js/levels.js` (new), `public/js/sound.js` (additive changes only, §6.1), dev harness `public/dev/levels*.{html,js}` | everything else |
| D | **Page UI** | `public/index.html`, `public/style.css`, `public/js/ui/*`, `public/js/app.js`, new `public/js/ui/film.js` and `public/js/ui/meter.js` | everything else |

Off-limits for everyone: `public/tapes.json`, `public/audio/*`, `public/covers/*`, `public/js/core/*`, `src/worker.js`, `test/*`. No commits, pushes or deploys.

**Seams that keep the four engineers unblocked:**

- `deck3d.js` loads displays with a **dynamic import**: `import("./displays.js").then(m => mount(m.createDisplays(...))).catch(() => {})`. With no displays module, or a broken one, the deck still works and its display windows stay dark.
- `app.js` loads levels with a **dynamic import** and falls back to a zero source (§7). With no levels module, the meters rest.
- `createDisplays` receives `THREE` and `LOOK` as parameters and imports nothing itself. Its harness can run before `look.js` exists by passing a copy of §9.2.
- The literal `LOOK` object (§9.2) and CSS tokens (§9.1) are in this doc. Engineer A pastes `LOOK` into `look.js` as the first step; engineer D pastes the tokens into `style.css`.
- `public/dev/` is deleted at integration.

---

## 2. Coordinates, units, camera

- **Units are centimetres everywhere** (geometry, layout tables, display sizes).
- **Panel coordinates** `(x, y)` are used in all layout tables: `x` from the fascia's **left** edge (0 to 44), `y` from its **bottom** edge (0 to 14).
- **World coordinates:** `X = x - 22`, `Y = y`, and `Z = 0` is the fascia's front face, with **+Z toward the viewer**. The deck's feet stand on the plank at `Y = -1.0`. The chassis runs back to `Z = -28`.
- **Displays** are built in their own local frame (§5.0). Deck engineer A places them with `mesh.position.set(cx - 22, cy, zMount)`.

### 2.1 Presets and views

`fit()` picks a preset from `#slot`'s CSS size `(sw, sh)`:

- **`stack`** when `sw < 600 && sh > 0.9 * sw` (portrait phones)
- **`full`** otherwise (desktop, tablet, landscape phone)

The canvas lives **inside `#slot`** (§8.1) and is sized to it. A *view* is `{ name, region: [x0, x1, y0, y1] (panel cm, at Z = 0), viewport: {x, y, w, h} (CSS px inside the canvas, top-left origin), camera }`. Rendering draws every view of the preset into one target with viewport and scissor set (§4.4).

**`full`**: a single view covering the whole canvas.

- Camera elevation 7°, azimuth -4° (camera slightly left of centre), aimed at world `(0, 6.6, 0)`.
- Fitted with the existing iterative bounds fit, so the fit box fills 94% of the binding dimension. The fit box spans world X -22.4 to 22.4, Y -1.4 to 14.5, Z -2 to 2.6.
- The final FOV comes out of the fit with a starting FOV of 20°. It is a long lens, so verticals stay straight.

**`stack`**: five views, stacked top to bottom with `g = 4 px` gutters (the gutters are room colour). `W` is the slot width.

| View | Region (panel cm) x0-x1 / y0-y1 | Viewport | Height at W = 358 |
|---|---|---|---|
| `meters` | 28.8-43.6 / 7.0-13.2 (VU pair + VFD) | full width | `W·6.2/14.8` = 150 |
| `door` | 0.4-19.9 / 5.8-13.4 (left column + cassette window) | full width | `W·7.6/19.5` = 140 |
| `dial` | 5.5-19.9 / 0.6-3.8 | full width | `W·3.2/14.4` = 80 |
| `readouts` + `keys` (one row) | readouts 20.2-28.8 / 7.0-13.2 (left); keys 20.0-29.0 / 0.6-6.9 (right) | both at scale `s = (W - g) / 17.6` px/cm, side by side, `g` apart | `6.3·s` = 127 |

The total at W = 358 is 508 px, so the UI sets `aspect-ratio: 358 / 508` on the phone slot (§8.3).

- If the real slot height differs, every view height scales by the same factor, and each region is fitted **contain** and centred in its viewport.
- Phone view cameras are dead-on: elevation 2°, azimuth 0, FOV 12°. The distance is solved so the region exactly fills the viewport. Off-axis projection is not needed.

**Pointer parallax** (desktop, `full` only, fine pointer, motion allowed) is first in the cut list.

- The camera orbits the aim point by at most ±0.8° azimuth and ±0.5° elevation, critically damped over 0.6 s.
- It renders only while converging. `keyRects` are not recomputed: keys sit on the orbit plane, so the error stays under 1.5 px (verify this).

### 2.2 keyRects

For each key, project the 8 corners of its cap (at its current depth) through **the camera of the view that contains it**, then add the view's viewport offset and the slot's page offset (`slot.getBoundingClientRect()`). In `stack`, `eject` belongs to `door` and the other five keys to `keys`.

Then **pad** each rect:

1. Grow each rect around its centre to at least 44 × 44 CSS px.
2. For every pair that now overlaps, shrink both rects back along the axis where their *unpadded* rects were separated, so they meet at the midpoint of the original gap.
3. Clamp each rect to its view's viewport.

The result: desktop rects are about 57 × 44 px (2.4 cm keys at about 23.6 px/cm); phone row keys about 48 × 40 px (the row pitch is the limit: 2.0 cm × 20.1 px/cm); phone eject 44 × 44.

---

## 3. The deck (engineer A)

### 3.1 Body

| Part | Spec |
|---|---|
| Fascia | 44.0 × 14.0 × 0.3 slab. `ExtrudeGeometry` from a `Shape` with holes (door aperture, display-bar aperture, dial aperture, transport recess, the eject and power key wells, phones hole), bevel 0.06. Front face at Z = 0 |
| Top cover | U-wrap of 0.08 sheet. Top surface at Y = 14.3; front lip overhangs to Z = +0.15. A 0.22 dark gap (inner frame, `#050505`) shows between Y 14.0 and 14.22 |
| Chassis | Depth 28. Barely visible; it matters for shadows and the top-cover sliver |
| Feet | 4 × Ø3.2 × 1.0 black rubber, 2.5 in from the corners |
| Plank (`full` only) | Walnut, top at Y = -1.0, front edge at Z = +7, 140 wide, 2.4 thick, canvas grain map. It receives a soft contact shadow (blurred ellipse plane) plus the shadow map |
| Backdrop (`full` only) | A plane at Z = -60, a dark wall with a warm radial pool behind the deck (`LOOK.room`, `LOOK.roomPool`). The clear colour is calibrated so canvas corners match CSS `--room` within ±4 per channel after post (§4.4) |

### 3.2 Panel layout (panel cm; rect = x0-x1 / y0-y1)

```
y 14 +------+----------------------+------------------------------------------------+
     |caset |  +----------------+  | [counter][ LED A2 1:34 ] | VU left  | VU right   |  13.2
     |≡≡≡≡≡ |  |  smoked window |  |  tape counter  side·trk  |          |            |
     |eject |  |   cassette     |  | (play)(cue)  lamps       |          |            |  9.3
     | [==] |  |                |  | [ FUNCTION VFD ▶PLAY  A] |[ PEAK METER  L/PEAK/R ]|  7.4
     |power |  +----------------+  +------------------------------------------------+  7.0
     | [  ]•|  ==> Stereo Cassette |  rew    ff     side B  | ┌NR┐  tape select  output|
     |      |  Deck CS-86          |  [===]  [===]  [===]    | [=][=]  Normal CrO₂  level|
     |phones+----------------------+  play                   |  left right  (o)    (  O  )|
     | (o)  | ░ STATION DIAL ░░░░░ |  [==================]   |  (o)  (o)          (     )|
     |      | 1969  1977  1994  ▌  |  stop                   |  └ mic ┘                  |
     |      +----------------------+  [==================]   |                           |  0.8
y 0  +------+----------------------+-------------------------+---------------------------+
     0      5.6                 19.8 20.2                 28.8                         43.6 44
```

**Left column (x 0 to 5.4)**

| Element | Rect / centre | Spec |
|---|---|---|
| Wordmark "caset" | left 1.0, baseline 12.55 | `LOOK.font.brand` bold, cap height 0.62, ink `LOOK.ink.onAlu` at 86%, `scale(0.92, 1)` |
| Brand stripe | 1.0-3.6 / 11.95-12.27 | Five bands of 0.05 with 0.018 gaps, `LOOK.STRIPES`, printed (matte) |
| Legend "eject" | left 1.4, baseline 11.0 | Panel legend (§3.6) |
| **Eject key** | 1.4-3.8 / 9.6-10.8, centre (2.6, 10.2) | Live: `eject`. Aluminium cap 2.4 × 1.2 |
| Legend "power / push on" | left 1.4, baselines 8.75 and 8.45 | |
| Power key | 1.4-3.8 / 6.0-8.2 | Decorative, always latched (sits 0.15 deeper). Red pilot LED Ø0.26 at (4.4, 7.9), emissive `LOOK.display.lampPlay` × 2.4, always on |
| Phones jack | centre (2.6, 2.6) | Chrome ring Ø1.3, bakelite insert, bore Ø0.62 with real depth. Legend "phones" centred at baseline 3.65 |

**Cassette door (x 5.6 to 19.8, y 4.0 to 13.2)**

- **Door:** 14.2 × 9.2 × 0.5, front at Z = +0.25, shadow gap 0.12 all round. The hinge is the line Y = 4.0, Z = 0, and the door opens with its top toward the viewer.
- **Window:** aperture 6.0-19.4 / 7.2-12.8 (13.4 × 5.6), with a 0.2 chamfered aluminium frame. Smoked acrylic 0.3 thick, two faces (back at opacity 0.12 to darken, front carrying the reflection).
- **Window print**, on the inside of the glass: a tape-remaining scale "100 ı ı ı ı ı ı ı ı ı 0", white at 60%, on 10.2-15.2 / 7.32-7.62.
- **Door plate** (lower door, 4.0-7.0), with its own brushing:
  - a hollow arrow at 8.2-10.2 / 6.1-6.5
  - "Stereo Cassette Deck  **CS-86**", centred at x 12.7, baseline 5.25, cap height 0.26 (the model number in bold)
  - "Front Loading · Station Dial · Fluorescent Peak · Full Auto Stop", baseline 4.7, cap height 0.17
- **Compartment:** a black well behind the door down to Z = -4.5. It holds:
  - a gunmetal carriage (`#2b2b2d`, metalness 0.8, roughness 0.5)
  - two drive spindles at the hub positions
  - chrome play and erase heads, a capstan, and a black pinch roller at Y 6.3-6.8 (visible when the door is open or the deck is empty)
  - a **compartment lamp**: `PointLight` `#ffcf8a`, distance 14, decay 2, no shadow, at (12.7, 13.0, -1.2). Intensity by state: empty and closed 0.15; loaded and stopped 0.35; playing 0.7; winding 0.7 ±3% flicker; door open 1.0. Linear ramp, 250 ms.

**Station dial (x 5.6 to 19.8, y 0.8 to 3.6)**

- Chrome bezel 0.15 wide, recessed 0.25. Glass flush with the bezel.
- **`dial` mount:** centre (12.7, 2.2), size 13.6 × 2.4, local z = 0 at Z = -0.25.

**Display bar (x 20.2 to 43.6, y 7.0 to 13.2)**

- One continuous smoked acrylic window: outer face at Z = +0.35, back face at Z = +0.05, with a 0.12 dark frame gap.
- Behind it, a matte black **backplate** (`LOOK.mat.backplate`) at **Z = -0.35**, with one rectangular cut-out per display. **Each display mounts with its local z = 0 at Z = -0.35.**

| Display | Centre (x, y) | Size w × h | Notes |
|---|---|---|---|
| `counter` | (22.2, 11.95) | 3.0 × 1.5 | |
| `led` | (26.3, 11.95) | 4.4 × 1.5 | |
| `lamps` | (24.6, 9.95) | 7.8 × 0.7 | |
| `modes` | (24.6, 8.25) | 7.8 × 1.7 | function VFD |
| `vuL` | (32.5, 11.1) | 7.0 × 3.6 | |
| `vuR` | (39.7, 11.1) | 7.0 × 3.6 | |
| `vfd` | (36.1, 8.25) | 14.2 × 1.7 | peak meter |

The deck prints the backplate legends: warm-grey `LOOK.ink.onBlack`, `LOOK.font.panel`, lowercase, M226-style.

- "tape counter", centred x 22.2, baseline 10.8, cap height 0.17
- "side · track · time", centred x 26.3, baseline 10.8
- "function indicator", centred x 24.6, baseline 7.1, cap height 0.15
- "fluorescent peak meter", centred x 36.1, baseline 7.1, cap height 0.15
- a vertical hairline at x 28.75 from y 7.3 to 12.9
- hairline rules under the two captions, 0.6 long, as in the M226 close-up

**Transport block (x 20.2 to 28.8, y 0.8 to 6.8)**

A recessed satin sub-panel, 0.1 deep, with its own finer brushing (`LOOK.mat.aluSub`). Keys sit in black ABS slots with a 0.08 gap all round.

| Action | Centre (x, y) | Cap w × h | Legend (above the cap's left end) | Cap glyph |
|---|---|---|---|---|
| `rewind` | (21.65, 5.9) | 2.4 × 1.0 | `keys.rewind` | ◀◀ |
| `forward` | (24.5, 5.9) | 2.4 × 1.0 | `keys.forward` | ▶▶ |
| `flip` | (27.35, 5.9) | 2.4 × 1.0 | flip label ("side B") | ⇅ |
| `play` | (24.5, 3.9) | 8.1 × 1.0 | `keys.play`, plus a 0.04 orange rule under it | ▶, with a 0.3 orange tip strip (`LOOK.mat.playTip`) at the left end |
| `stop` | (24.5, 1.9) | 8.1 × 1.0 | `keys.stop` | ■ |
| `eject` | (2.6, 10.2) | 2.4 × 1.2 | `keys.eject` (left column) | ⏏ |

**Function block (x 28.8 to 43.6, y 0.8 to 6.8): decorative**

- Two NR push keys, 1.6 × 0.6, at (30.4, 5.3) and (32.6, 5.3). Bracket legend "┌ NR ┐" at baseline 6.1; sub-legends "out · in" and "B · C".
- Mic jacks Ø1.1 at (30.4, 2.6) and (32.6, 2.6), with legends "left" and "right" at baseline 3.5 and a "└ mic ┘" bracket at baseline 1.3.
- Tape-select knob at (35.6, 3.4), Ø2.0, with a matte grey pointer bar. Legend "tape select" at baseline 6.1, and "Normal  CrO₂  Metal" at baseline 5.4 with leader ticks.
- **Big knob "output level"** at (40.4, 3.6), Ø4.2, 2.2 deep:
  - diamond-cut face (radial `anisotropyMap`) and a knurled skirt
  - printed scale 0 to 10 from -135° to +135°: ticks at r 2.35-2.55, numerals at r 2.8
  - legend right-aligned at x 43.3, baseline 6.35

### 3.3 Materials (MeshPhysicalMaterial unless noted; values in `LOOK.pbr`)

| Part | Colour | Metal | Rough | Extras |
|---|---|---|---|---|
| Fascia | `mat.alu` #cfccc6 | 1.0 | 0.34 (roughness map 0.26-0.42, horizontal streaks) | `anisotropy` 0.75, rotation 0; weak streak normal (0.15). Print atlas: colour multiply, plus roughness 0.55 where ink is (ink is matte on satin) |
| Transport sub-panel | `mat.aluSub` #bdb9b1 | 1.0 | 0.42 | brushing repeat ×3, anisotropy 0.6 |
| Door plate | `mat.aluDoor` #d6d3cc | 1.0 | 0.30 | own brushing |
| Top cover | `mat.topCover` #b9b6b0 | 1.0 | 0.48 | brushed front to back (`anisotropyRotation` π/2) |
| Key caps | `mat.aluKey` #d9d6cf | 1.0 | 0.28 | RoundedBox (radius 0.06, top-edge chamfer that catches a bright line), brushed lengthwise |
| Slots, collars | `mat.slot` #0b0a0a | 0 | 0.8 | |
| Smoked acrylic | `mat.smoke` #0e0c0b, opacity 0.38 | 0 | 0.04 (smudge map 0.04-0.14) | `ior` 1.49, `envMapIntensity` 1.6, `depthWrite: false`. **No `transmission`** |
| Knobs | `mat.aluKnob` #dedbd4 | 1.0 | 0.22 | radial anisotropy face, knurl normal on skirt |
| Jacks | chrome #e8e8e8 (rough 0.12); insert #121010 (rough 0.5) | | | |
| Backplate | `mat.backplate` #0a0909 | 0 | 0.7 | printed legends |
| Cassette shell | `mat.cassetteShell` mixed toward the tape colour by `mat.cassetteTint` 0.15, opacity 0.35 | 0 | 0.08 | `envMapIntensity` 1.3, clearcoat 0.6 |
| Tape packs | `mat.pack` #2a1910 | 0 | 0.38 | concentric microgroove normal map (rings glint) |
| Hubs | `mat.hub` #ece6d8 | 0 | 0.5 | 6 real teeth |
| Label | `mat.label` #efe4cc | 0 | 0.85 | separate plane 0.005 proud, with a dark 1 px edge |

**Textures:**

- All textures are canvas-generated at load from a seeded PRNG (seed `0xCA5E7`), so every load, and every trace screenshot, looks the same.
- Fascia print atlas: 4096 × 1304 (93 px/cm), mipmapped, max anisotropy. Brushing roughness: 1024 × 64, repeat-wrapped.
- Fascia UVs come straight from the extrude's front-face shape coordinates: `u = x / 44`, `v = y / 14`.

**Low tier** (§10) swaps every physical material for `MeshStandardMaterial` with the same maps, without anisotropy.

### 3.4 The cassette

- **Shell:** Philips size, 10.0 × 6.4 × 1.2, bevelled, clear smoked. It has five chrome screw heads, two guide windows and head openings along the bottom edge, and write-protect tabs on the top edge.
- **Local frame:** origin at the shell centre, label face toward +z, tape opening down.

**Inside the shell:**

- **Hubs** at local (±2.1, +0.15), each with a pack, white hub and 6 teeth.
- **Pack radii** use the player's reel law, with `R_MIN = 1.08`, `R_MAX = 2.28` and `f = frac`:
  - left (supply): `rL = sqrt(R_MAX² - (R_MAX² - R_MIN²)·f)`
  - right (take-up): `rR = sqrt(R_MIN² + (R_MAX² - R_MIN²)·f)`
- **Rotation:** both reels turn at `ω = 4.76·speed / r` rad/s, clamped to ±15 rad/s. Positive speed is **counter-clockwise as seen by the viewer**, on both sides of the tape (after a flip the new side's supply reel is again on the left). Integrate the angle per frame.
- **Hub motion blur:** when |ω| > 12, crossfade the hub cap to a radially blurred texture and hide the teeth.
- **Tape path:** a 0.38 oxide ribbon between the packs along the bottom (local y -3.2 to -2.6), with guide rollers and a felt pressure pad on a bronze spring.

**Label:** a paper strip 9.2 × 1.7 at local y 1.45 to 3.15, drawn on a 1024 × 190 canvas.

- **Left 2.6 cm:** the cover's top 415-unit picture band, drawn from the `cassette.cover` SVG (same origin), cropped to fill (aspect 1.53, close to the band's 1.45). The picture is warmed: multiply `#ffd9a8` at 15%.
- **Middle:** `cassette.name` in `LOOK.font.brand` bold, with `sideLabel` underneath in `LOOK.font.panel`.
- **Right 1.3 cm:** a big side letter "A" or "B" in brand bold, on a field of `cassette.color` with `inkFor` ink.
- **Fallback with no art:** the five stripes in the tape colour.

Each side has its own label (the back face carries the other side). Label textures are cached per `id:side` and disposed when another tape loads; this keeps the existing `labelCache` policy, including its stale-image guard.

**Seated pose:** cassette centre at panel (12.7, 9.9), Z = -1.0. The window shows panel y 7.2 to 12.8, which is the label plus the hubs.

### 3.5 Choreography (contract mapping)

The door rotates about its hinge line (Y = 4.0, Z = 0). "Open" is **-24°**: top out, toward the viewer. The cassette holder is a child of the door. Out-of-frame travel goes **down and toward the camera**, out of the bottom of the slot, which reads as "back to the rack below".

All motion goes through one `tween(duration, fn, ease)` that returns a Promise. When `reduceMotion` is on, the duration is 0 (resolved immediately, `fn(1)` applied), but **`onEvent` calls still fire, in the same order**, as in today's `deck3d.js`. On `webglcontextlost`, set `reduceMotion = true`, finish every running tween at once and fire `onEvent("contextlost")`. Choreographies are `async` step sequences, so the remaining steps run instantly. That way `swap()` still happens **exactly once** and every promise resolves exactly once.

**`load(c, side, swap)`**, about 1.75 s from an empty deck:

| t (s) | Step | Event |
|---|---|---|
| 0 | Door opens 0 → -24°, 380 ms, critically damped with 1° overshoot. Compartment lamp → 1.0 | `lid` |
| 0.30 | `swap()`, then `displays.setProgram(new program)`. The new cassette (label for `side` already applied) appears at world (X of holder, -16, +16), rolled 14°, and rises on a cubic Bézier into the open holder, 560 ms, ease in-out | `slide` at the start |
| 0.86 | Seats with a 0.8 cm drop, 120 ms, ease-in. `displays.knock(1)` | `drop` at the end |
| 1.12 | Door closes -24° → 0, 240 ms, ease-in, ending in a 0.4° bounce. `displays.knock(0.6)`. The carriage draws the tape back 0.3 cm over 120 ms. `state.loaded = true` | `lid-shut` at the end |
| 1.60 | Resolve (the lamps keep warming on their own) | |

If a tape is already in, *eject-out* runs first: the door opens (`lid`), `state.loaded = false`, the old tape lifts 2.8 cm (200 ms), then flies down and out (450 ms, `slide`). The sequence then continues from t = 0.30 with the door already open (no second `lid`). `swap()` therefore happens once the old tape is out of frame and the new one starts rising, which is when its case on the shelf opens.

**`flip(to, swap)`**, about 1.75 s:

1. Door opens (`lid`).
2. The cassette lifts 2.8 cm along the door normal, then moves 4 cm toward the camera, 300 ms (`slide`).
3. It turns 180° about its **own vertical (Y) axis**, 560 ms, ease in-out, with a 6° tilt so light rakes the shell (`turn` at the start). **`swap()` and `displays.setProgram(new side)` happen at exactly 50%**, edge-on. The label switches here, and the dial starts its band change.
4. It goes back into the holder, 280 ms (`drop`, `knock(1)`).
5. The door shuts (`lid-shut`, `knock(0.6)`), then resolve.

**`eject()`**, about 1.25 s:

1. Door opens (`lid`). `state.loaded = false` immediately, so the lamps start fading.
2. Lift (200 ms), then fly down and out (450 ms, `slide`). `displays.setProgram(null)` when it leaves the frame.
3. The empty, lit well stays open for 300 ms.
4. Door closes (`lid-shut`). Compartment lamp → 0.15. Resolve.

**`setCassette(c, side)`:** instant. Door closed, tape seated, labels applied, `setProgram`, `loaded = true`. **No `onEvent`.**

**Keys:**

- Keys travel into the fascia (-Z): rest = cap front at Z = +0.45; latched = 0.28 in; tap = 0.35 in and back. They use the existing critically damped follow at a rate of 22/s.
- Latched caps also tilt 1.5°, like a soft-touch key.
- The power key is fixed at its latched depth. Refused taps dip like any other tap, which is honest mechanical feedback.

### 3.6 Panel legends

- **Panel legends:** `LOOK.font.panel` 400, **lowercase** (M226). Cap height 0.20, tracking +0.02 em, ink `LOOK.ink.onAlu` at 86%.
- **Secondary uppercase legends** (NR, Normal / CrO₂ / Metal): 0.15, tracking +0.08 em.
- **Measure-and-fit every string** (Helvetica Neue on macOS, Arial on Windows, Roboto on Android). Never rely on fixed widths.
- **Key legends** change language. Each one is drawn on its own canvas (512 × 64, covering the key width × 0.4 cm), placed 0.18 above the key top and left-aligned. `setKeyLabel` and `setFlipLabel` redraw only that canvas, shrinking the text to fit (Spanish "reproducir" and "rebobinar" must fit). Everything else is in the static atlas and stays English, like an export deck.

### 3.7 Light spill (cut item 4)

Additive planes 0.02 in front of the fascia, multiplied by the brushing roughness so the glow is streaky. They are coloured:

- amber under the VU windows
- white-blue under the VFD
- red near the LED
- warm white above the dial

Each plane's intensity is `0.15 + 0.5 · displays.activity.<name>` (§5.0), and stays below the bloom threshold. A soft amber ellipse also falls on the plank in front of the deck.

### 3.8 Deck-side extras to the contract

| Member | Called by | Meaning |
|---|---|---|
| `setLevels({ l, r, pl?, pr? })` | app.js, every rAF, before `frame()` | Linear 0..1: `l` and `r` are per-channel RMS; `pl` and `pr` are optional sample peaks. The deck **copies the numbers** into its preallocated `state.levels` and keeps no reference to the object. It is a no-op before the displays mount |

Nothing else is added. The deck learns the track layout from the cassette passed to `load` and `setCassette`:

- `tracks = c.sides[side].tracks`
- `offsets[i] = Σ_{j<i} max(1, Number(tracks[j].dur) || 0)`
- `total` = the full sum

These are exactly the player's formulas. The track index is `trackAt(seconds)` with the player's loop, and mode comes from the latch and the speed (§5.0).

---

## 4. Lighting, environment, post (engineer A: `deck3d.js`, `post.js`)

### 4.1 Renderer

- `new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" })`. Return `null` on failure, as today.
- `outputColorSpace = SRGBColorSpace`, `toneMapping = AgXToneMapping`, exposure `LOOK.light.exposure` (1.0). If AgX greys the amber in review, switch to `ACESFilmicToneMapping` with `LOOK.light.toneMapping = "aces"`.
- Size: `renderer.setSize(slot.clientWidth, slot.clientHeight, false)`, with CSS sizing the canvas to 100% of the slot.
- Pixel ratio: `pr = clamp(min(devicePixelRatio, 2, sqrt(2.6e6 / (sw·sh))), 1, 2)`. Recheck it in every `fit()`.
- Shadows: `PCFSoftShadowMap`, `autoUpdate = false`, with `needsUpdate` set only when a key, the door or the cassette moves (the existing `shadowsDirty` scheme).

### 4.2 Environment (make or break: budget a day of look-dev)

Build the environment once with `PMREMGenerator.fromScene(envScene, 0.02)` from a tiny procedural room, then dispose the room:

- a dark box (`#0a0908`)
- soft box A: a white plane above-left, intensity 8
- soft box B: above-right, intensity 4
- a long thin strip light behind the camera, intensity 3
- a warm floor bounce, `#3a2418`, intensity 0.6
- a dim orange glow low-left, `#ff8a3a`, 1.2, which echoes the CSS leak

Then set `scene.environmentIntensity` from `LOOK.light.environment`. The long horizontal sheens these soft boxes put on brushed metal are what make it read as aluminium.

### 4.3 Lights

| Light | Spec |
|---|---|
| Key | `DirectionalLight` `#fff1de`, 2.2, from azimuth -35° and elevation 40°. The only shadow caster: a 2048 map (1024 on the low tier), frustum tight around the deck (46 × 32), normal bias 0.02 |
| Fill | `HemisphereLight` `#e9eef5` / `#2a1d14`, 0.35 |
| Rim | `DirectionalLight` `#9ec3d0`, 0.6, from behind-right (top-cover edge, knob chamfers) |
| Compartment | §3.2 |

Displays are emissive surfaces, not lights.

### 4.4 Post chain (`post.js`)

Vendor these from `.../scratchpad/t/node_modules/three/examples/jsm/`, rewriting `from 'three'` to the relative vendored path and keeping the folder layout:

- into `public/vendor/postprocessing/`: `EffectComposer.js`, `Pass.js`, `ShaderPass.js`, `MaskPass.js`, `UnrealBloomPass.js`, `OutputPass.js`, all importing `'../three.module.min.js'`
- into `public/vendor/shaders/`: `CopyShader.js`, `LuminosityHighPassShader.js`, `OutputShader.js`
- into `public/vendor/utils/`: `BufferGeometryUtils.js`

```js
// public/js/deck/post.js
export function createPost({ THREE, renderer, LOOK, tier /* "high" | "low" */ }) → {
  setSize(cssW, cssH, pixelRatio),
  render(scene, views),   // views: [{ camera, x, y, w, h }] in CSS px, top-left origin in the canvas
  setTier(tier),
  get ok(),               // false if HDR targets are unsupported: deck then calls renderer.render directly
  dispose(),
}
```

1. **ViewsPass** (custom `Pass`): clears the read buffer to `LOOK.post.clear`. Then, for each view, it sets `rt.viewport` and `rt.scissor` (device px, y flipped), sets `scissorTest = true`, and calls `renderer.render(scene, view.camera)`. The target is `HalfFloatType`, `samples: tier === "high" ? 4 : 0`.
2. **UnrealBloomPass**:
   - resolution = target / 2 on the high tier, / 3 on the low tier
   - threshold `LOOK.post.bloomThreshold` (1.25, linear HDR), strength 0.62, radius 0.5
   - **halation:** `bloomTintColors` = `[1,1,1]`, `[1,.97,.92]`, `[1,.85,.70]`, `[1,.60,.42]`, `[1,.45,.30]`, written into `compositeMaterial.uniforms.bloomTintColors`
3. **GradePass** (`ShaderPass`, linear in and out):
   - lift blacks toward `LOOK.post.lift` (#0b0908)
   - soft warm highlight roll-off
   - radial chromatic aberration (0 at the centre, `LOOK.post.ca` = 0.6 px at the corners)
   - vignette 0.18
   - a static warm edge leak from the left at 4% (`LOOK.post.leak`)
   - **no grain**: grain is a page-level CSS layer (§8.4), so idle frames stay idle
4. **OutputPass**: AgX plus sRGB.

If `EXT_color_buffer_float` / half-float render targets are unavailable, `ok = false` and the deck renders straight to the canvas with renderer tone mapping. No bloom; everything else stays the same.

**Debug:** with `?debug=bloom`, GradePass outputs only the bloom contribution. Acceptance: only displays and lamps show up.

### 4.5 Render on demand

`frame(t, dt)` renders **only when dirty**:

- a tween is running
- a key is moving
- `|speed| > 0` (reels)
- `displays.update(state)` returned `true`
- parallax is converging
- after `fit()`, or after a label or legend texture upload
- the compartment lamp is ramping

Stopped and settled means **zero GL work**. Playing means one render per rAF.

**Auto-downgrade:** while playing, average the CPU time between consecutive rendered frames over the first 90 frames. If it is above 22 ms, call `setTier("low")` once per visit and never go back up.

---

## 5. The displays (engineer B: `displays.js`)

### 5.0 Interface

```js
// public/js/deck/displays.js
export const SIZES = {        // cm; the aperture each display fills (w × h); depth = space it may use behind z = 0
  counter: { w: 3.0,  h: 1.5, depth: 1.4 },
  led:     { w: 4.4,  h: 1.5, depth: 0.6 },
  lamps:   { w: 7.8,  h: 0.7, depth: 0.5 },
  modes:   { w: 7.8,  h: 1.7, depth: 0.6 },
  vuL:     { w: 7.0,  h: 3.6, depth: 1.3 },
  vuR:     { w: 7.0,  h: 3.6, depth: 1.3 },
  vfd:     { w: 14.2, h: 1.7, depth: 0.6 },
  dial:    { w: 13.6, h: 2.4, depth: 0.8 },
};

export function createDisplays({ THREE, renderer, LOOK, maxAniso }) → {
  meshes: { counter, led, lamps, modes, vuL, vuR, vfd, dial },  // THREE.Object3D each
  activity: { vu: 0, vfd: 0, led: 0, dial: 0 },   // 0..1 smoothed glow for the deck's spill (read-only)
  setProgram(program | null),
  update(state) → boolean,     // true when anything changed and a render is needed
  knock(strength),             // 0..1 mechanical impulse (drop / lid-shut)
  setReduceMotion(bool),
  dispose(),
}
```

**Local frame of every mesh:**

- The aperture rectangle is centred on the origin in the XY plane, with +x right and +y up.
- The viewer is at +z. **Everything lies within `z ∈ [-depth, 0]`.**
- The deck places the origin at the backplate cut-out centre (display-bar displays at Z = -0.35, the dial at Z = -0.25) and guarantees nothing of its own intrudes into that box.
- Each display draws **everything inside its aperture**: faces, bezels, in-window captions, glass tints. It draws nothing outside it.
- The deck owns the smoked front glass and the backplate print.

**`program`**, set by the deck at swap time and by `setCassette`:

```js
{ id, name, color, side: "A" | "B", total, offsets: [s...],
  tracks: [{ title, date, dur }] }      // from tapes.json; date may be "1969" or "1969-07-20" or ""
```

**`state`**, one preallocated object owned by the deck and mutated in place before each `update()` call:

```js
{ t, dt,                                  // seconds; dt clamped to 0.1
  levels: { l, r, pl, pr },               // linear 0..1; pl/pr = 0 when unknown
  frac, speed, seconds,                   // from setTape
  mode: "stop" | "play" | "rewind" | "forward",   // latched play → play; else sign of speed; else stop
  track: { index, count },                // index -1 when empty
  side: "A" | "B", loaded: boolean }      // loaded = seated and door shut (§3.5)
```

**Rules for `update()` and the rest:**

- No allocation in `update()`: no `new`, no array or object literals, no closures, no template strings. Mutate uniforms in place.
- Return `false` once every needle is at rest (`|θ - θ*| < 1e-4` and `|ω| < 1e-3`), every decay is finished and nothing is blinking.
- While `mode === "play"` it may return `true` every frame.
- **Bloom** picks displays by luminance only: there are no layers. Lit HDR values go through `LOOK.display` (lit segments 2.4 to 3.2, which bloom). Backlit faces reach at most about 1.3, and only at the bulb hotspots. Ghosts are ≤ 0.06.
- `ShaderMaterial`s write **linear** HDR colour. Canvas colour maps use `colorSpace = SRGBColorSpace`, mipmaps, and `anisotropy = maxAniso`.
- **Boot warm-up:** on the first `update()`, lamps and backlights rise from 0 with `1 - e^(-3t)` over about 1.2 s. With reduced motion they are instant.
- **Power** is always on. "Empty" means `loaded = false`.

**Synthetic inputs** (honest, never pretending to be music):

- **Cue chatter** while `mode` is rewind or forward and a tape is loaded: the heads are lifted and the levels are 0. The VU target is -14 VU + 5 dB × fbm(t·9) × `min(1, |speed|/16)`; the VFD gets the same, plus 6 dB. The CUE or REV legend and the cue lamp light.
- **Hiss floor** when `mode === "play"` but `l + r < 1e-4` for more than 0.6 s (a missing file, or silence in the recording): the VU sits at -30 VU with ±0.5 dB tremble, and the VFD flickers 1 or 2 segments around -36 dB. It looks like blank tape passing the head.

### 5.1 VU meters (`vuL`, `vuR`): the M206 pair

**Face:** a canvas of 1400 × 720 (200 px/cm), drawn once.

- Ivory paper `vuPaper` with a radial falloff to `vuPaperEdge` in the upper corners, plus 3% paper noise.
- **Geometry in face coordinates** (cm, centre origin): pivot P = (0, -2.9), below the visible face and hidden. Scale arc radius 3.9; major ticks at r 3.72-4.05, minor at 3.85-4.05; numerals at r 4.35.
- **True VU law:** a reading R in VU sits at angle `θ(R) = -45° + 90° · 10^(R/20) / 10^(3/20)`, measured from vertical, clockwise positive. Numerals at -20, -10, -7, -5, -3, -2, -1, 0, +1, +2, +3, so -20 to -10 crowds to the left as on a real meter.
- **Red zone** 0 to +3: a thick arc (0.09) in `vuRed`, with red numerals.
- An inner percentage arc at r 3.45: 0, 20, 40, 60, 80, 100, where 100% = 0 VU, in thinner grey ink.
- "VU" in `LOOK.font.serif` 0.42 cap height, centred at (0, -0.55). A small "left" or "right" at the lower left. "CLASS 1.5" at 0.12 at the bottom right. A hairline under the numerals.

**Backlight:**

- The face material outputs `faceRGB × vuLamp × lampLevel × hot(uv)`.
- `hot` comes from two bulbs below the face at (±1.6, -2.4): a sum of Gaussians, 1.0 at the bottom centre, about 0.55 in the upper corners, and at most 1.35 at the hotspots.
- `lampLevel` is `vuLampOn` when loaded and `vuLampEmpty` when not, ramping over 400 ms.
- **R's lamp is 3% warmer than L's** (`vuLampR`), so the two meters are not identical.

**Needle:**

- A tapered black blade from r 1.1 to 4.15, 0.06 wide at the base and 0.025 at the tip, sitting 0.25 in front of the face. Behind the pivot, a red-black counterweight paddle.
- A black half-disc shroud (r 1.25) at the bottom centre hides the pivot.
- **Needle shadow:** a second copy on the face plane, 0.10 above the needle (the bulbs are below), a blurred-alpha texture at 25%, same angle. It is the biggest realism cue: never cut it before item 6 in §12.

**Input mapping:**

- `rel = rms / 10^(vuZeroDbfs/20)`, with 0 VU at -16 dBFS RMS.
- `R = 20·log10(max(rel, 1e-5))`.
- Target `θ* = θ(min(R, 3.5))`. When `R < -40` (or with no tape), the target is the left pin at -47°.

**Ballistics:**

- Per needle, fixed 240 Hz substeps through an accumulator, semi-implicit Euler: `α = ωn²(θ* - θ) - 2ζωn·ω`.
- L uses `vuOmega` 19 rad/s and `vuZeta` 0.80 (about 300 ms to 99%, about 1.5% overshoot: the IEC 60268-17 feel). R uses `vuOmegaR` 18.2 and `vuZetaR` 0.78.
- Zero offsets: L -0.4°, R +0.3°. On mono tapes the two needles move together but never in lockstep.
- Pins at -47° and +48°, bounce restitution 0.25.
- `knock(s)` adds `0.8·s` rad/s to both needles.
- **Reduced motion:** ζ = 1, ωn = 14, no knock.

### 5.2 Peak meter (`vfd`): the hero

One `ShaderMaterial` on one plane (14.2 × 1.7). Segments are procedural (`fract`, `step`, rounded-box SDF), plus a static legend mask canvas of 2048 × 256.

**Layout** (cm from the aperture's left edge):

- **Rows:** top scale numerals printed in warm grey on the dark filter (y +0.68); L bar row centred at +0.36, 0.36 tall; legend row at 0.0, 0.32 tall; R bar row at -0.36; bottom scale numerals at -0.68.
- **Segments:** 34 per row, thin vertical bars 0.22 wide on a 0.32 pitch, starting at x 1.5. "L", "R" and "dB" captions sit at the ends.
- **Thresholds** (dB, segment i = 0..33): `-30 -27 -24 -22 -20 -18 -16 -15 -14 -13 -12 -11 -10 -9 -8 -7 -6 -5 -4 -3 -2 -1.5 -1 -0.5 0 +1 +2 +3 +4 +5 +6 +7 +8 +9`. Segments 24 to 33 (0 dB and above) are **amber**.
- **Legend row:** lit boxes with knocked-out dark numerals, as in the close-up: `20 PEAK 10 6 4 2 0 2 4 6 9`, each box under its segment, with "PEAK" as a wide box.

**Colour and HDR:**

- below 0 dB: `vfdWhite` (#d8f4ff) × `vfdLit` 2.6
- 0 dB and above: `vfdAmber` (#ffb347), going to `vfdAmberHot` (#ff7a1a) at +9, × `vfdLitAmber` 3.0
- legend boxes: `vfdLegend` 1.1, lit whenever a tape is in (below the bloom threshold)

**What makes it a real tube** (every item is required):

1. **Ghost segments:** every unlit segment and legend glows at `vfdGhostLevel` 4% in `vfdGhost` cold teal.
2. **Grid mesh:** a hexagonal wire grid with a 0.05 pitch, multiplied over lit areas at 0.85.
3. **Filaments:** three horizontal wires 0.006 thick across the whole tube. They are dark (0.35 black) over lit areas and a faint orange (`#ff8a3a` × 0.06) over unlit areas.
4. **Filter glass:** a `#0a1418` tint at 60% around the segments.
5. **Unevenness:** a static per-segment hash of ±5%, plus a 5% left-to-right gradient.
6. **Flicker:** ±1% per rendered frame while lit. Off with reduced motion.

**Ballistics** (on the CPU, 2 floats per channel):

- The input is peak dB: `20·log10(pl / 10^(vfdZeroDbfs/20))`, with 0 dB at -8 dBFS peak. If `pl` is 0 or missing, use `l · 1.41`.
- Attack is instant. Release is `vfdRelease` 13.3 dB/s (20 dB in 1.5 s).
- **Phosphor tail:** a second level that falls at 60 dB/s. Segments between the bar and the tail glow at 35%.
- **Peak hold:** one segment at the maximum stays lit for `vfdHold` 1.4 s, then falls at `vfdHoldFall` 20 dB/s, 15% brighter than the bar.
- **Uniforms:** `uL`, `uR`, `uTailL`, `uTailR`, `uHoldL`, `uHoldR` (fractional segment index), `uOn` (0..1), `uSeed`, `uMask`.

**Boot test:** on the first load per visit, every segment lights for 350 ms, then the bar falls to the live level. Skipped with reduced motion.

### 5.3 Function tube (`modes`): cut item 3

The same shader family on its own mask (1024 × 224), so share code with `vfd`. It has 10 legends, each with its own brightness: `uLegend[10]` (0, ghost, lit, or dimmed).

| Legend | Lit when |
|---|---|
| `◀◀ REV` | mode rewind |
| `▶ PLAY` | mode play |
| `CUE ▶▶` | mode forward |
| `■` | stop and loaded. Blinks twice on the transition into stop |
| `A`, `B` | the loaded side |
| `NR` | loaded |
| `CrO₂` | loaded |
| `AUTO STOP` | lit for 2.5 s after the tape reaches the end of the side (frac ≥ 0.999 and mode leaves play or forward) |
| `END` | blinks 3 × 250 ms in amber at the end of the side, then steady at 50% until mode changes |

On load, the legends light in a 60 ms ripple. All legends are white phosphor at `vfdLit` × 0.8; END is amber. Reduced motion: no blinks or ripple, steady states only.

### 5.4 Red LED readout (`led`): from the Lloyd's

- **Glyphs:** 5 digits plus a colon, as `[S][T] [m]:[s][s]`. Seven-segment cells 0.62 × 1.0 at a pitch of 0.78, slanted 8°, drawn as hexagon SDFs in the shader. The glyph bitmasks arrive as uniforms, so there are no textures.
- **Shows:**
  - while loaded and not winding: side letter (`A` or `b`), track number, then elapsed time in the current track (`seconds - offsets[index]`)
  - while winding: side letter, blank, then side time (`seconds`)
  - empty: `- -  - : - -` at 30%
- **Colon** blinks at 1 Hz (500 ms on, 500 ms off) while playing; otherwise it is steady.
- **Colour:** `led` (#ff2a1c) × `ledLit` 3.0. Unlit segments show at `ledGhost` 3% behind a `ledFilter` (#2a0605) glass tint.
- Only change uniforms when the shown value changes (on a change of `floor(seconds)`, or of the index or mode).

### 5.5 Mechanical counter (`counter`)

- **Build:** three real drums (radius 0.48, width 0.62, 20 facets) with a canvas digit band: `drumInk` numerals on `drumBg`, bold condensed. They sit behind a black bezel cut to a 2.2 × 0.9 window, with a small white "◀" pointer printed to the right.
- **Lighting:** lit by the scene, plus a faint `drumGlow` emissive (0.18) so the digits read through the smoked glass. A thin glass cover reflects the environment.
- **Value: take-up reel turns, counted from the start of the side.** With `a = R_MIN²` and `b = (R_MAX² - R_MIN²)/total`:
  - `θ(s) = 4.76 · 2(√(a + b·s) - √a)/b` radians
  - counter = `θ/2π`, about 216 at the end of an 8-minute side
  - it is non-linear in time, as on a real deck, and stateless: it is derived from `seconds` and `total`, so per-side memory just works
- **Odometer:** the units drum turns continuously with the fractional count. The tens drum rolls only during the units drum's 9 → 0 tenth, and the hundreds drum likewise.
- **On load:** spin from 000 to the remembered value over 300 ms (instant with reduced motion). On flip, the drums spin to the new side's value during the turn.
- **Wind blur:** when the count rate is above 6 per second, the units drum swaps to a pre-smeared digit band.

### 5.6 Pilot lamps (`lamps`)

A strip with real lens geometry (small bevelled boxes) and emissive material, plus in-strip captions (`LOOK.font.panel`, 0.15, `onBlack` ink), left to right:

| Lamp | Shape | Lit when |
|---|---|---|
| `play` | 0.7 × 0.32 rect, `lampPlay` red-orange (the M226 "rec" lamp shape) | mode play, at 3.2. While winding, at 1.2 |
| `cue & review` | 0.7 × 0.32 rect, `lampCue` amber | winding |
| `rec` | 0.32 dome, dark red | **never**: this deck only plays. A quiet joke |

### 5.7 Station dial (`dial`): from the Lloyd's

- **Scale canvas:** 2048 × 362 (150 px/cm), redrawn on `setProgram` (load, flip, setCassette). Keep an LRU of 4. Ink `dialInk` on a milky `dialLamp` ground.
- **Rows,** mirroring a receiver's FM and AM rows:
  1. **Minute row:** "SIDE A" at the far left where "FM" would be; minute numerals 0, 1, 2 … ⌈total/60⌉, spread across x 1.6 to 13.0; ticks every 10 s with majors at each minute; "min" at the far right where "MHz" would be.
  2. **Station row:** one marker per track at its offset, as a station. Each has an amber-red pip (`dialStation`), the **year in bold** as the "frequency" (`date.match(/\b(1[89]\d\d|20\d\d)\b/)`, falling back to the track number) and, at 0.2, the title in uppercase condensed, truncated before the next marker. Bands alternate faint tones so the tracks read like frequency allocations.
  3. **Logging scale:** fine ticks from 0 to 100 along the bottom.
- **Backlight:** `dialLamp` × `dialLampOn` (1.35) × hotspots at 25% and 75% of the length; the ends are 35% dimmer.
- **Needle:**
  - a real thin box 0.06 × 2.2 in `needle` orange × `needleLit` 2.2 (it blooms), riding 0.25 in front of the scale
  - a dark dial cord line along the top, with two tiny pulleys at the ends
  - x = the scale's x for `seconds`, followed by a dial-cord spring (ωn 18, ζ 0.85): imperceptible in play, a whip and settle when winding
- **TUNED lamp:** a small green (`tuned`) dot at the far right, captioned "tuned". It is steady while playing and **drops out for 250 ms then re-locks** whenever `track.index` changes.
- **Band change** (`setProgram` with a different side or tape): the backlight dims to 10% over 200 ms, the canvas swaps, then it warms back over 400 ms. Instant with reduced motion.
- **Empty:** the backlight is at `dialLampEmpty` (15%), the minute row is blank with "SIDE –", and the needle is parked at the left stop.

### 5.8 Behaviour by state (summary)

| State | VU | Peak VFD | Function tube | LED | Dial | Lamps | Counter |
|---|---|---|---|---|---|---|---|
| empty | on the pin, lamp 35% | ghosts only | ghosts | dashes at 30% | 15%, blank | off | 000 |
| loaded, stop | pin | holds decay | ■ A/B NR CrO₂ | `A1 0:00` | lit, needle at the playhead | off | value |
| play | real RMS | real peaks | ▶ PLAY | ticking, colon blinks | needle tracks, TUNED | play | rolls |
| rewind / forward | cue chatter | cue chatter | REV / CUE | side time | needle whips | cue, plus play at 1.2 | spins, blurred |
| play, silent or missing file | hiss floor | -36 dB flicker | ▶ PLAY | ticking | normal | play | rolls |
| end of side | falls to the pin | decays | END ×3, AUTO STOP | frozen | needle at the end | off | value |

### 5.9 Displays acceptance

- [ ] Harness `public/dev/displays.html` renders all 8 meshes side by side at 3 zoom levels, plus a slider panel for every `state` field (fake `l`, `r`, `pl`, `pr`, frac, mode, etc.). Headless screenshots at 1×, 2× and 4× show crisp segments and legends.
- [ ] VU step test: a step from -40 to 0 VU reaches 99% in 0.28-0.33 s with 1-2% overshoot (log θ from the harness).
- [ ] VFD: attack in 1 frame, release 20 dB in 1.5 ± 0.1 s, hold 1.4 s.
- [ ] `update()` returns `false` within 2 s of stop. No allocation (code review and the DevTools allocation timeline flat over 10 s of play in the harness).
- [ ] Reduced motion: no overshoot, no blinks, no flicker, meters still live.
- [ ] Nothing renders outside its `SIZES` box (a harness wireframe toggle shows each box).
- [ ] `node --check` passes. No console errors or warnings.

---

## 6. Levels (engineer C: `levels.js`, `sound.js`)

### 6.1 `sound.js` additions (additive only; existing behaviour unchanged)

```js
let held = false;
// in settle(): add `|| held` to the early return
//   if (!ctx || windLevel > 0 || held) return;
context() { return ctx; },          // never creates one; null before unlock()
hold(on) {                           // keep the context awake while program audio flows through it
  held = !!on;
  if (held) wake(); else settle();
},
```

### 6.2 `levels.js`

```js
// public/js/levels.js
export function createLevels({ audio, sound }) → {
  read() → { l, r, pl, pr },   // the SAME object every call; linear 0..1; zeros when not routed / paused
  get routed(),                 // boolean, for debugging
}
```

**Routing:**

- **Lazily**, inside `read()`: only when the context exists and `ctx.state === "running"`. `levels.js` **never** creates or resumes a context itself, outside the `hold` handlers below. `sound.unlock()` already runs inside every gesture (`pointerdown` in app.js, `player.press`, `seekTo`, and a shelf click), so no autoplay warning can appear.
- **Graph:**
  - `src = ctx.createMediaElementSource(audio)`
  - `src → ctx.destination`, at gain 1 (the user hears exactly what they heard before)
  - `src → splitter (ChannelSplitter 2, channelInterpretation "speakers", in a try) → analyserL (out 0)` and `→ analyserR (out 1)`
  - each analyser: `fftSize 1024`, `smoothingTimeConstant 0`
- **Once only:** guard with a module-level `WeakSet` of elements (`createMediaElementSource` throws if called twice). Wrap the whole graph build in `try`; on any failure set `disabled = true` and never try again, and audio keeps playing directly.

**Never silence playback.** Before routing nothing changes. After routing:

- `audio` `play` and `playing` → `sound.hold(true)` (which wakes the context: `resume()`).
- `pause`, `ended`, `emptied` → `sound.hold(false)`, which allows the normal 2.5 s idle suspend.
- Every path that starts playback (`press`, `seekTo`) calls `sound.unlock()` inside a gesture first, so the context is running when audio starts. Auto-advance between tracks happens while held.
- **Watchdog:** if `!audio.paused && ctx.state !== "running"` for 500 ms, call `ctx.resume()` once per second.

**Kill switch:** `?levels=0` in the URL, or `navigator.userAgent` matching a list in `LEVELS_DENY` (empty by default), skips routing. Then `read()` returns zeros and the meters show only the hiss and cue synthesis.

**read():**

- If not routed, or `audio.paused`, return zeros.
- Otherwise `getFloatTimeDomainData` into two preallocated `Float32Array(1024)` buffers. In one loop per channel, compute the mean square and the max of the absolute value: `l = sqrt(ms)`, `pl = max`.
- **Mono heuristic:** if R stays below 1e-6 while L is above 1e-4 for more than 0.5 s (a splitter that did not up-mix), mirror L into R from then on, for that source.
- No allocation, no closures, at most 0.15 ms per call.

### 6.3 Levels acceptance

- [ ] The trace and compare pass with levels wired (no new console warnings, behaviour identical).
- [ ] Harness `public/dev/levels.html`: play a stereo file (`ocean`) and a mono file (`voices`). The logged `l` and `r` are non-zero and plausible (speech RMS about 0.03-0.15), and mono gives L ≈ R.
- [ ] Headless check: after routing, play, pause, wait 3 s, play again. `audio.currentTime` advances, and `ctx.state` is `running` while playing.
- [ ] Never-silence check: with `?levels=0` the behaviour is identical.
- [ ] Manual note in the hand-off: Safari macOS / iOS still to be checked by the owner on a real device (headless cannot prove audibility).

---

## 7. Wiring (engineer D: `app.js`)

```js
const ZERO = { l: 0, r: 0, pl: 0, pr: 0 };
let levels = null;
import("./levels.js").then((m) => { levels = m.createLevels({ audio: $("#player"), sound }); }).catch(() => {});

// in loop(), after player.tick(dt):
const lv = levels ? levels.read() : ZERO;
deck?.setLevels?.(lv);
deck?.frame(t / 1000, dt);
if (!deck && nogl meter is on) meter.update(lv);   // optional nogl strip (§8.6)
```

Everything else in app.js stays as it is (event wiring, `glLost`, visibility handling, boot).

- **`?nogl`** (dev only) skips `createDeck`, to test the no-WebGL look.
- **Body classes stay exactly `gl` or `nogl`.** The trace compares `body.className`. Put any other state on `<html>` or on `.app` (for example `html.is-loaded`, `html.rm`).

---

## 8. The page (engineer D): SUPERSEDED by §D2

> **Superseded.** Kept for history only. The page is now specified in **§D2 Page v2** (after this section), which wins wherever the two disagree. The walnut rack, the J-card liner, the room leaks, dust and vignette, and the aluminium EN/ES keys described below are gone.

### 8.1 DOM (hooks preserved)

- Move `<canvas id="stage" aria-hidden="true">` **inside `#slot`**, as its first child (before `.keys`). The canvas is `position: absolute; inset: 0; width: 100%; height: 100%`.
- Because the canvas scrolls with the slot, the page may scroll on any device, and `keyRects` stay aligned. `keys.place()` runs on resize and on the slot's `ResizeObserver`, as now. Also call it once after fonts and layout settle.
- **Keep, unchanged:**
  - the `.key[data-action]` buttons, **in this DOM order:** rewind, play, forward, stop, flip, eject. Each keeps its `.key-ico` and `.key-lbl` spans, and its existing `aria-pressed` attributes (stop, flip and eject have none)
  - `#status` (polite, visually hidden), `#rail`, `#liner`, `#liner-body`, the `.lang` group with `button[data-lang]`, and `#player`
- **Reserved class names** (the trace selects them): `.key`, `.case`, `.track`, `.missing`, and `.lang button`. Never use these classes on anything else; for example, decorative HTML keys must not be `.key`.
- **Add:**
  - `<div class="room" aria-hidden="true">` (light leaks, behind everything) as the first child of `body`
  - `<div class="film" aria-hidden="true">` (grain, dust, vignette, above everything, `pointer-events: none`) as the last child of `body`

### 8.2 Desktop and tablet (width ≥ 600)

```
┌─ header 44px: [caset ≡≡≡≡≡]                                    ─┐
│  #slot: full width, height clamp(280px, 50vh, 560px)             │  ← deck, "full" preset
│  ───────────────── (the 3D plank ends here) ────────────────      │
│  ┌ rack (walnut, 2 shelves × 5) ┐  ┌ liner: J-card ──────────┐   │
│  │ [▯][▯][▯][▯][▯]              │  │ spine │ tracks │ now     │   │
│  │ [▯][▯][▯][▯][▯]              │  │ (internal scroll)        │   │
│  └──────────────────────────────┘  └──────────────────────────┘   │
│  footer: lucaspose.cl                                             │
```

- **Grid:** `brand` / `deck` / (`rack` | `liner`) / `foot`. The lower row is `minmax(0, 1.2fr) minmax(340px, 1fr)` at ≥ 1024 wide and stacks at 600-1023.
- **At 1280 × 800** the slot is about 1216 × 400. Height binds, so the deck is about 1050 px wide (about 23.6 px/cm), and the lower row is about 300 px, so nothing scrolls. On shorter viewports the page scrolls.
- **Liner:** `max-height` equal to the lower row, `overflow: auto`. At ≥ 1024 its body splits into two J-card panels (tracks | now) when it is ≥ 560 px wide.

### 8.3 Phones

- **Portrait (< 600 wide):** brand row (44 px, wordmark and stripes) / `#slot` with `aspect-ratio: 358 / 508` (the deck's `stack` views, §2.1) / rack as a single horizontal row (`scroll-snap-type: x mandatory`, edge-fade mask, cases 64 × 101) / liner at full width and natural height. The page scrolls.
- **Landscape (height < 500 and width ≥ 600):** a slim 32 px brand bar; `#slot` at `height: calc(100dvh - 44px)` and full width (deck `full`, about 17 px/cm); then the rack and liner below (scroll).
- 16 px side gutters, `env(safe-area-inset-*)` respected, and no horizontal page scroll at 390.

### 8.4 Room and film (`style.css` plus `js/ui/film.js`)

**`.room`** (fixed, `z-index: 0`, behind `.app`):

- ground: `--room`, with a warm pool `--room-2` radial at `var(--gx) var(--gy)` (keys.place already sets these)
- five large blurred radial-gradient leaks, as in the film reference:
  - red-orange `--leak-red` at 16%, behind and right of the deck
  - amber `--leak-amber` at 12%
  - teal `--leak-teal` at 10% on the left edge
  - cream `#ffe9c2` at 6%
  - **the current tape's colour** (`--tape-glow`, set by app.js on the `deck` event) at 10%, so each tape tints the room
- they drift on 60-90 s `transform`-only loops, and are static with reduced motion

**`.film`** (fixed, `z-index: 10`, `pointer-events: none`):

- **Grain:** `film.js` paints a 256² seeded noise tile once (light and dark specks with alpha, **no `mix-blend-mode`**: plain alpha is much cheaper over a WebGL canvas), and sets it with `el.style.setProperty("--grain", "url(data:...)")` (CSSOM is allowed under the CSP; `img-src data:` is allowed). Opacity 0.07. It steps `background-position` with `steps(1)` keyframes at 12 fps; static with reduced motion.
- **Dust and hair:** a 1024² sparse tile, also generated (14 specks of 1-3 px and two hairline scratches), at 0.14 opacity. It jumps to a new position every 2.5 s, like a film gate. Off with reduced motion.
- **Vignette:** a radial gradient from 0 at the centre to 0.5 black at the corners.

No gate weave: it would move the key overlays. All film effects are page-level, so canvas and HTML share one film stock and the GPU stays idle when the deck does.

**Canvas edge:** `#stage` gets `mask-image` linear fades on all four edges (32 px desktop, 12 px phone), so the deck's room dissolves into the page's room.

### 8.5 The rack (`ui/shelf.js`): pick a tape, then play

- **Desktop:** a CSS walnut rack (`--walnut`, `--walnut-hi`), drawn as repeating gradients: a lit front edge of 6 px, a dark top face, and a grain made of 6 offset gradients. It holds **two shelves of five** Norelco cases, 76 × 120.
- **Phone:** one strip of 64 × 101 cases.
- **Case anatomy in CSS:**
  - a clear box (1 px light border plus an inner shadow) holding the cover as the J-card, `object-fit: cover`, top-aligned so the picture band shows
  - a left hinge strip with two notches
  - `.case-shine`, a 30° diagonal glare at 10%
  - a contact shadow on the board
  - the name in `--font-panel` lowercase on the board edge, under the case
- **Hover and focus:** the case lifts 8 px and tilts back 4°, and the glare sweeps once (200 ms). With reduced motion it only lifts.
- **Loaded** (`aria-pressed="true"`): the case is **open and empty**. The front cover rotates 25° on its hinge (`rotateX`), the tray shows a faint hub imprint, and the J-card stays in the lid, dimmed to 70%. It closes again on eject.
- **Keep:** `.case[data-id]` buttons with `aria-pressed` and `aria-label` (exact wording from `label(c)`); the `sound.unlock()` and `player.load` click path; `.nocover` / `.hascover` fallbacks with the stripes.

### 8.6 Liner (`ui/liner.js`): the J-card

- **Paper:** `--paper` with `--paper-ink` text and a CSS fibre texture (two low-alpha repeating radial gradients), plus a 1 px fold line 46 px from the top.
- **Spine** (`.spine`): a band in the tape colour (`--tape` / `--tape-ink`, set exactly as now), a big boxed side letter, the name in brand bold, and "Side A · Science".
- **Tracks** (`.track[data-i]` buttons): the number in mono, the title in brand medium, who and date in serif italic, and the duration in tabular mono. **`aria-current`** gets an orange "tuning pip" on the left (`--needle`) and a faint wash of the tape colour.
- **Now** (`#now`): the time in mono (tabular), the title in serif 22 px, meta, the note in serif 16/1.55 with `max-width: 58ch`, and the credit with its license link small.
- **Missing** (`.missing`, `role=note`, wording unchanged): a red rubber-stamp box with a 2 px border, rotated -1.5°, uppercase heading.
- **EN / ES** (`.lang button`): two tiny aluminium push keys (CSS brushed gradient). The pressed one sits lower with an inner shadow. `aria-pressed` is unchanged.
- **Empty and failed states:** a blank J-card with ruled lines and the existing copy.

**No WebGL** (`body.nogl`): the `.key` buttons become visible as **brushed-aluminium flat keys in a black slot bar** (CSS gradients, `--font-panel` legends, play with the orange tip).

Optional (cut item 1): `ui/meter.js`, an `aria-hidden` nogl meter strip inside `#slot`. It has two VFD-style rows of 34 `<i>` segments whose opacity is set from levels in the loop, plus a CSS dial line.

### 8.7 Focus and accessibility

- `:focus-visible` everywhere: `outline: 2px solid var(--amber); outline-offset: 2px; box-shadow: 0 0 0 4px rgba(14, 11, 9, 0.85)`. On the invisible key overlays this outlines the 3D key.
- Contrast: liner ink on paper is at least 7:1. Ivory UI text on the room is at least 4.5:1.
- `prefers-reduced-motion`: no drifts, grain or dust animation, case tilt or glare sweeps. The deck does its own part (§10).

---

## D2. Page v2: a modern website of a retro object (replaces §8)

Status: final, after the owner saw the integrated build. **This section replaces §8 completely**, the page half of §9.1, §10.2's page bullet, §11.D and the film-room line in §12. It also changes the scene around the deck (§D2.5). It does **not** change the CS-86 object, its materials, its displays, its choreography or its post chain (bloom and halation), apart from the values listed in §D2.5.

Owner feedback it answers: *"It looks great and realistic. The mood and spacing are not quite there anymore. The presentation of the content and its navigation is still far from optimal, UX-wise and UI-wise. I want a modern approach to retro: the website should look like a modern website of a retro object, in a retro aesthetic."*

Background reading (not normative): `.work/design/page-product.md`, `page-editorial.md` and `page-app.md`, with their mocks in the scratchpad (`shots/pv2-*-mock-*.png`).

### D2.0 Decision

| Criterion (1 to 5) | Product launch | Catalogue No. 86 | Listening room |
|---|---|---|---|
| "Modern website of a retro object" | **5**: reads as a 2026 product page | 4: editorial, very good | 3: reads as an app, not a website |
| Mood (one atmosphere for the scene and the page) | **5** | **5** | 4: graphite is colder than the deck's warm lamps |
| Spacing and air | **5** | 4 | 3: dense panes |
| Browsing ten tapes by topic | 3: the grid is lovely but sits below the fold | **5**: a sticky index, all ten visible with topics and times | **5** |
| Tape then track in 2 clicks, without scrolling | 3 | **5** | **5** |
| Now playing (readable, well placed) | **5**: directly under the deck | **5** | 4: inner scroll |
| Phone feels designed | 4: but the 2-column grid pushes the panel far down | **5**: rail right under the deck | **5** |
| Trace risk | 3: a card below the fold scrolls the page while keys are clicked | **5** | 4: the no-page-scroll shell |
| **Total** | **33** | **38** | **33** |

The **base is "Catalogue No. 86"**: the sticky index beside the deck keeps all ten tapes, their topics and times in view at 1280 × 800, so tape → track never needs a scroll. The deck is no smaller than in the product mock (both about 815 px wide at 1280). **Grafted on:**

- **From Product launch:** the product-page mood and language (a seamless umber cyclorama whose edge *is* the page; air around the object; a nav with an EN | ES pill; a "How it works" strip with key chips below the fold), the warm umber palette, the 4 pt scale, the mini-player bar on small screens, and the calm amber missing-file notice.
- **From Listening room:** the A | B segmented side switch, amber meaning only "live", the playing equaliser on the current row, the side progress bar split by track, and ↑ / ↓ roving focus in lists.
- **From Catalogue:** the numbered index rows, the serif reading column with a drop cap, the phone order (statement, deck, rail, panel), and the plate caption.
- **Dropped:** the app's no-scroll shell and breadcrumbs, the product's below-the-fold card grid and its "scroll back to the deck" jump, the editorial's numbered callouts on the plate, the app's extra single-letter shortcuts (F, E, L, 1 to 3, ?).

**One sentence:** a silver 1983 deck photographed on a warm seamless, set in a quiet, precise 2026 page whose type, colours and details come from a 1980s hi-fi catalogue, with the deck as the only realistic thing on it.

### D2.1 Principles

1. **The realism belongs to the deck.** The HTML is flat: hairlines, type, numbers and the cover art. No wood, paper, fibre, stamps, bevels, case lids, glare, gloss or drop shadows.
2. **One studio, one light.** The scene's backdrop is the page colour at its edges. Nothing on the page is lit differently from the deck: there are no CSS light leaks, bokeh or vignette. The tape colour tints the studio *inside* the scene, not over the page.
3. **Retro lives in the details:** Futura display, tracked uppercase panel legends, tabular figures, catalogue numbering 01 to 10, the five stripes, VFD amber, a faint grain.
4. **Content before chrome.** In 3 seconds a visitor knows what caset is and sees the ten tapes with their topics. One click loads a tape and a second picks a track, with no scrolling at 1280 × 800.
5. **Colour has meaning.** Bone on umber for everything. The **tape colour** says *which tape* (a 2 px bar, a chip, the drop cap). **Amber** says *live* (progress, the playing equaliser, the focus ring). **Needle orange** says *attention* (the missing file). The five stripes appear only as brand.

### D2.2 Tokens (`style.css :root`; replaces the §9.1 block)

```css
:root {
  /* palette: warm umber studio; contrast measured on --bg */
  --bg:     #15110e;  /* page = cyclorama edge = canvas edge = theme-color */
  --bg-2:   #1c1814;  /* hover, raised surfaces (mini bar, rail card hover) */
  --bg-3:   #25201a;  /* selected: loaded index row, current track, pressed segment */
  --line:   rgba(240, 230, 210, 0.10);   /* hairlines */
  --line-2: rgba(240, 230, 210, 0.20);   /* control borders */
  --ink:    #f0e6d2;  /* bone, 15.2:1 */
  --ink-2:  #b8ab95;  /* secondary, 8.3:1 */
  --ink-3:  #968a77;  /* legends, numbers, captions: 5.5:1 on --bg, 4.8:1 on --bg-3. Never body text */
  --amber:  #ffb347;  /* live: progress fill, equaliser, focus ring */
  --needle: #ff6a1f;  /* attention: the missing-file notice */
  --signal: #e2582b;  /* brand only (stripes); the play tip lives on the deck */
  --s-orange: #e2582b; --s-mustard: #e3b03a; --s-olive: #8a8b3b; --s-teal: #3d8d8c; --s-navy: #33506b;
  /* --tape and --tape-ink are set per tape by the views, exactly as now */

  /* type: system stacks only (the CSP forbids web fonts) */
  --font-display: Futura, "Futura PT", "Century Gothic", "Avenir Next", "Trebuchet MS", system-ui, sans-serif;
  --font-ui:      "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif;
  --font-serif:   "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  --font-mono:    ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  /* spacing: 4 pt scale, nothing off it */
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px; --s6: 32px; --s7: 48px; --s8: 64px; --s9: 96px;

  /* grid */
  --margin: clamp(16px, 2.5vw, 32px); --gutter: 24px; --max: 1440px;
  --bar-h: 56px;          /* top bar: 52 on phones, 40 in landscape phones */

  /* radius */
  --r1: 2px;  /* cover art */  --r2: 6px;  /* controls, rows, rail cards */  --r3: 12px; /* the floating mini bar */  --pill: 999px;

  /* motion */
  --ease: cubic-bezier(.2, .7, .2, 1); --t1: 140ms; --t2: 220ms; --t3: 320ms;
}
```

- `body { background: var(--bg); color: var(--ink); }`. `meta theme-color` becomes `#15110e`.
- **Gutter on phones:** 16 px (`--margin`), and the grid has 4 columns. Tablet: 8 columns.
- **Hit targets:** at least 44 × 44 px on coarse pointers, at least 32 px tall on fine pointers.

**Type scale** (px size / line height; every line height is a multiple of 4):

| Token | Size / LH | Face | Use |
|---|---|---|---|
| `legend` | 11 / 16, weight 600, `letter-spacing: .14em`, uppercase | ui | eyebrows ("THE SHELF · 10 TAPES"), side letters, "IN THE DECK", "NOW PLAYING". Labels only, never sentences |
| `caption` | 12 / 16 | ui | credit, plate caption, rail durations |
| `meta` | 13 / 20 | ui | who · year · place, topics, statement on the top bar |
| `ui` | 15 / 20 | ui | track titles, buttons, body copy of "How it works" |
| `note` | 17 / 28 (16 / 24 on phones) | serif | the recording's note, `max-width: 60ch` |
| `name-s` | 15 / 20, weight 600 | display | tape names in index rows and rail cards |
| `name-l` | 28 / 32, weight 700, `letter-spacing: -.01em` | display | tape name in the panel (24 / 28 on phones) |
| `title` | 30 / 36, `letter-spacing: -.01em` | serif | now-playing title (26 / 32 on phones) |
| `head` | 24 / 28, weight 700 | display | index heading, "How it works" heading; the phone statement at 20 / 28 |
| `num` | 11, 12 or 13, `tabular-nums` | mono | 01 to 10, clocks, durations, counts |

### D2.3 Grid and layout

Breakpoints: **desk** ≥ 1100 wide · **tab** 600 to 1099 · **phone** < 600 · **short** (landscape phone) `(max-height: 500px) and (min-width: 600px)`, which overrides tab.

**Desk (≥ 1100):** 12 columns, `--margin` 32 at 1280, gutter 24, content max 1440 (centred above it).

- **Main column = columns 1 to 9** (906 px at 1280, 1026 at 1440): the plate (deck), its caption, the now-playing panel.
- **Index = columns 10 to 12** (286 px at 1280): `position: sticky; top: calc(var(--bar-h) + 16px)`, a 1 px `--line` rule in the gutter on its left. If `100dvh - top` is shorter than the index, the index scrolls inside itself (rows go to 48 px first, below 820 px of height).
- Vertical rhythm at 1280 × 800: bar 56 · 16 · **slot 368** (`height: clamp(300px, 46vh, 460px)`) · 12 · caption 16 · 16 · rule · 24 · panel. The tape header and all three tracks end at about y = 740, above the fold. The note can run below the fold: **the page scrolls, never a box inside it**.

**Tab (600 to 1099):** one column, 8 grid columns, `--margin` 24. Order: bar, statement, plate (`height: clamp(280px, 46vh, 440px)`, `full` preset), shelf rail, panel (two columns tracks | now at ≥ 760 wide, stacked below that), How it works, footer.

**Phone (< 600):** one column, 16 px gutters (§D2.8).

**Short (landscape phone):** bar 40; plate `height: calc(100dvh - 48px)`, `full` preset; then rail, panel (tracks | now), How it works and footer.

No horizontal page scroll anywhere. `env(safe-area-inset-*)` is respected on every edge.

### D2.4 Information architecture and navigation

```
top bar     caset ≡≡≡≡≡ CS-86 · statement (desk) ·············· How it works · [EN|ES]
main        PLATE: the deck (keys on it) + caption
            PANEL (#liner): tape header + A|B switch · tracks · now playing
index       THE SHELF · 10 TAPES: heading, lede, rows 01..10 (= #rail, .case buttons)
            (desk: sticky right column · tab/phone: a rail between the plate and the panel)
about       How it works: 3 steps · keys · where the recordings come from
footer      stripes · caset CS-86 · lucaspose.cl
mini bar    phone/tab only, when a tape is loaded and both the deck and the panel are off screen
```

- **What caset is (3 s).** Two pieces of copy, both new view copy in `js/ui/copy.js` (EN/ES; `core/i18n.js` is untouched):
  - **statement:** EN "A cassette deck in your browser, loaded with ten tapes of recorded history." ES "Una casetera en tu navegador, con diez cintas de historia grabada." On the desk top bar (13 / 20 `--ink-2`, one line, hidden below 1100) and as the phone/tab hero (§D2.8).
  - **index heading + lede:** EN "Ten tapes of recorded history." / "Carl Sagan, Apollo 11, whale song, the oldest recorded voice. Pick one: it slides into the deck." ES "Diez cintas de historia grabada." / "Carl Sagan, el Apolo 11, el canto de las ballenas, la voz grabada más antigua. Elige una: entra en la casetera."
  - The `<h1>` stays the wordmark ("caset"); give it a visually hidden suffix with the statement so the outline reads well.
- **Naming:** the index is called **the shelf** ("The shelf · 10 tapes" / "El estante · 10 cintas"), because the engine's `L.pick` copy already says "Pick a tape from the shelf".
- **Two clicks, no scroll (desk):** row in the index → track in the panel. Both are visible at 1280 × 800 at all times.
- **Side:** the A | B switch in the panel and the flip key on the deck. The switch calls `player.press("flip")`, the same engine path as the key.
- **EN | ES:** a pill at the top right of the top bar on every viewport. It is **the** `.lang` group (moved out of `#liner`, exactly one group, two buttons).
- **Anchors:** "How it works" (`#about`) in the top bar on desk and tab. A skip link "Skip to the tapes" (`#rail`) is the first focusable element.
- **Empty deck:** the panel shows the existing `L.empty` (as `name-l`), `L.pick` and `L.hint` copy; an arrow points at the index on desk ("→") and up at the rail on phone/tab ("↑"), drawn in CSS (`::after`, so no new text).
- **Failed (no tapes.json):** the panel shows `L.failed` in the same style; the index shows nothing.

### D2.5 The scene: deck on a seamless (engineer A: `deck3d.js`, `look.js`, `post.js`)

The deck, its key/fill/rim lights, its environment map and its bloom are **approved: do not retune them**. Only the room around it, the framing and two grade values change.

**Remove** (in `deck3d.js`, "the room" block, about lines 710 to 757): the walnut plank (`BoxGeometry(140, 2.4, 60)`), the plank vignette plane `pv`, the far-floor fade `ff`, the backdrop wall `ShaderMaterial` with its pool and bokeh textures. Drop the now-unused `M.walnut`, `LOOK.mat.walnut`, `LOOK.deck.walnut`, `LOOK.deck.wall` and the `walnutCanvas`, `wallCanvas` and `bokehCanvas` imports (delete them from `parts/tex.js` if nothing else uses them). **Keep** the contact shadows `c1` and `c2` (`M.contact`).

**Add `sweep`, one mesh, one draw call** (in the same `room` group, so `room.visible = preset === "full"` still hides it on phones):

- **Profile** (in YZ, extruded along X over 320 cm): the floor at `Y = -1.0` from `Z = +40` back to `Z = -34` (flat under the whole chassis, which ends at `Z = -28`), a quarter-circle cove of radius 30 (centre `Y = 29, Z = -34`), then a vertical wall at `Z = -64` up to `Y = +110`. Build it from a `PlaneGeometry(320, arcLength, 1, 64)` whose vertices are bent along the profile. `uv = (X, s)`, where `s` is the arc length in cm from the front edge (so the falloff below is in real centimetres).
- **Material:** `MeshStandardMaterial({ color: LOOK.stage.sweep, roughness: 0.92, metalness: 0, envMapIntensity: 0.15 })`, `receiveShadow = true`, `castShadow = false`. It is lit by the existing key, so the deck's real shadow falls on it.
- **Falloff to the page** (`onBeforeCompile`, injected just before `#include <tonemapping_fragment>`, so it runs in linear HDR; into the post chain's float target three applies no tone mapping there): `f = 1 - smoothstep(F.r0, 1.0, length((vUv - F.c) / F.r))`, then `gl_FragColor.rgb = mix(uGround, gl_FragColor.rgb, f) + uPool * exp(-dot(q, q))`, where `q = (vUv - P.c) / P.r`. Beyond the falloff ellipse the sweep **is** `uGround` exactly.
- **The pool:** a soft, warm, elliptical pool on the wall behind the deck (centre at the wall point seen just above the top cover). `uPool` is `LOOK.stage.pool`, lerped `LOOK.stage.poolTape` (10%) of the way toward the loaded tape's colour (linear). Set the target in `load` / `flip` / `setCassette` at `swap()` time (to the base pool on `eject`), and ease over `LOOK.stage.poolMs` (1200 ms; instant with reduced motion). While it eases the deck is dirty; afterwards render on demand settles to zero draws as before.
- **The clear colour** is `uGround` too (`LOOK.post.clear` and the ViewsPass clear), so wherever the sweep does not cover the frame, the frame is still the page.

**Edge match (make or break).** The page is `#15110e`. Tune `LOOK.stage.groundLinear` once, with the post chain on (AgX, lift, grade), until canvas pixels 4 px inside each corner and each edge midpoint read `#15110e` within ±2 per channel. Check it empty and loaded (the pool must not reach the edges), at 1280 × 800, 1440 × 900 and 844 × 390. Write the tuned value into `look.js` with a comment. When `post.ok` is false (direct render), clear with `new THREE.Color("#15110e")` and set `html.post-off` so the CSS keeps a 16 px edge fade (below).

**`look.js` deltas** (everything else in `LOOK` stays):

```js
room: "#15110e",                       // was "#0e0b09"; the stack preset's gutter background
stage: {                               // new
  ground: "#15110e",                   // the page colour the canvas edge must hit (sRGB)
  groundLinear: [0.0070, 0.0052, 0.0040], // starting guess; TUNE (see edge match) and record
  sweep: 0x2a231d, sweepRough: 0.92,
  fall: { c: [0, 60], r: [46, 34], r0: 0.40 },   // cm in (X, s); starting values, TUNE with the edge match
  pool: [0.020, 0.013, 0.008],         // linear HDR, under the bloom knee
  pool_c: [0, 102], pool_r: [46, 22], poolTape: 0.10, poolMs: 1200,
},
post: { ..., clear: /* = stage.groundLinear */, vignette: 0.0 /* was 0.18 */, leakAmount: 0.0 /* was 0.005 */ },
// removed: mat.walnut, deck.walnut, deck.wall
```

(`fall` and `pool_*` are in the sweep's `(X, s)` coordinates. With the profile above, the floor under the deck is `s = 40` (fascia, `Z = 0`) to `s = 68` (`Z = -28`), the cove runs `s = 74 to 121`, and the line of sight just over the top cover meets the cove at about `s = 100`. The falloff must reach 1 before the frame's bottom edge (the floor about 10 to 15 cm in front of the fascia, `s ≈ 25 to 30`) and before the left and right edges at every slot aspect from 2.0 to 3.2; the pool must stay inside the frame. These are starting values: tune them with the edge-match check.)

**`post.js`:** no code change. `uVig` reads 0 and `uLeak` reads 0 through `LOOK`. Keep the lift, the chromatic aberration, the warm roll-off, the bloom and its halation tints.

**Framing (`fitFull`, `full` preset only):**

| Value | Was | Now | Why |
|---|---|---|---|
| fill of width / height | 0.95 / 0.97 | **0.90 / 0.82** | air around the object, like a product plate |
| vertical offset of the fitted box | centred | **4% of the frame up** (`elements[9] = cy - 0.08` in NDC, sign verified by screenshot) | more floor in front for the contact shadow |
| `FULL_FOV`, elevation, azimuth, `AIM`, `FIT_BOX` | 14°, 7°, -4°, (0, 6.6, 0) | unchanged | the approved view |
| parallax | ±0.8° / ±0.5° | unchanged | first item in the deck's cut list as before |

At 1280 × 800 the slot is 906 × 368, so the width binds and the deck renders about 815 × 284 px, with about 42 px of sweep above and below. At 1440 × 900 it is about 920 px wide.

**`stack` preset (phones):** unchanged (views, seams, regions, cameras). The gutter clear uses `LOOK.room`, which is now the page colour.

**Light:** unchanged (key `#fff1de` 2.2 from -35°/40°, hemisphere fill 0.35, rim 0.6, env as baked). The sweep receives the key's shadow, which is the "studio" read. If the silhouette's top edge merges with the dark wall in review, raise `LOOK.light.rimIntensity` 0.6 → 0.8; that is the only allowed light change.

### D2.6 Components and states

All of them are flat. Every interactive element has hover, `:focus-visible` (amber ring, §D2.9), active and disabled styles. **Reserved classes** (`.key`, `.case`, `.track`, `.missing`, `.lang`) are used only for their hooks.

| Component | Markup / owner | Anatomy | States |
|---|---|---|---|
| **Top bar** | `index.html` header, sticky | wordmark "caset" (display 22 / 700) + stripes (five 24 × 2 px bars stacked, 24 × 10 overall) + "CS-86" (mono 11 `--ink-3`); statement (desk); "How it works" (ui 13); the `.lang` pill | at the top: transparent. Scrolled: `--bg` at 88% + `backdrop-filter: blur(12px)` + hairline under it (`html.is-scrolled`, set by an IntersectionObserver sentinel, not a scroll handler) |
| **EN \| ES pill** | `.lang` with `button[data-lang]`, `aria-pressed` | 32 px tall (44 on coarse), two segments, 1 px `--line-2` border | pressed: `--ink` fill, `--bg` text. Not pressed: `--ink-2`, hover `--ink`. `liner.js` sets `aria-pressed` on `document.querySelectorAll(".lang button")` |
| **Plate** | `<figure class="plate">` around `#slot` | the canvas, the `.key` overlays, and `<figcaption>` (caption 12, mono): left "CS-86 · Stereo cassette deck", right the hint "Space play/stop · ← → wind" or, when loaded, `A1 · 0:42 / 2:54` (`aria-hidden`; `#status` stays the only announcer) | empty / loaded / playing are the deck's. `html.post-off`: `#stage` gets a 16 px `mask-image` edge fade. Otherwise no mask on desk/tab, none on the phone stack |
| **Index row** (desk) / **rail card** (tab, phone) | `.case[data-id]` button, one set, rendered by `shelf.js`; `aria-label` = `label(c)` unchanged; all visible content `aria-hidden` | `.c-no` "01" (mono 11 `--ink-3`), `.c-art` (the cover's picture band: `aspect-ratio: 600 / 415; object-fit: cover; object-position: top`, `--r1`), `.c-name` (`name-s`), `.c-topics` ("Science / History", meta 12 `--ink-2`, one line with ellipsis on rows, two lines on cards), `.c-dur` ("A 4:50 / B 4:05", mono 11 `--ink-3`; per-side sums of `dur`, computed in the view), `.c-state` ("In the deck", legend) | **Row** (desk): grid `24px 64px 1fr auto`, height 56, art 64 × 44, padding 6 / 12, `--r2`. **Card** (rail): 136 wide, art 136 × 94, then name, topics, durations. Hover: `--bg-2`; the art shifts 2 px right (row) or up (card). **Loaded** (`aria-pressed=true`): `--bg-3`, a 2 px `--tape` bar on the left edge (row) or under the art (card), the number in `--tape` (lightened to ≥ 4.5:1 if needed), `.c-dur` replaced by `.c-state`; while playing, `.c-state` becomes a 3-bar amber equaliser (static under reduced motion). `.nocover`: a `--tape` block with the five stripes and the name. ↑ / ↓ move focus between rows (roving `tabindex`; the shelf is one Tab stop; Home / End jump) |
| **Panel** | `#liner` (the `<section>` that holds `#liner-body`) | no box: type on the backdrop, opened by a 1 px `--line` rule with a 2 px `--tape` segment over its first 64 px | empty, failed, loaded (below) |
| **Tape header** | `.spine` inside `#liner-body` | art 64 × 44, then `.spine-name` (`name-l`) over a mono 12 `--ink-3` line "01 · 6 recordings · 8:55" (`aria-hidden`, from copy.js). `.spine-side` and `.spine-label` stay in the DOM, visually hidden. The **side switch** on the right | |
| **Side switch** | `.side-switch` (`role="group"`, `aria-label` "Side"), two `<button>`s with `aria-pressed`; rendered by `liner.js` inside `.spine` | `[A] Science │ [B] History`; each letter is an 18 px chip; 36 px tall (44 coarse), `--r2`, 1 px `--line-2` | current: `--bg-3` fill, chip in `--tape` / `--tape-ink`, label `--ink`; other: `--ink-2`, hover `--ink`. A thumb (one pseudo-element) slides between halves over `--t2` on `deck`. Clicking the other side: `sound.unlock(); player.press("flip")`; clicking the current side does nothing. `.flipside` ("On the other side: …") stays in `#liner-body`, visually hidden |
| **Tracks** | `ol.tracks` of `.track[data-i]` buttons with `aria-current` (markup unchanged: `.tn`, `.tt-title`, `.tt-who`, `.td`) | 56 px rows (60 coarse): `.tn` mono 12 `--ink-3`, title `ui` 15 `--ink`, who · year meta 13 `--ink-2`, `.td` mono 13 right, hairlines between rows | hover `--bg-2`; current: `--bg-3`, a 2 px `--tape` bar on the left, the title stays `--ink`; while playing, `.tn` shows the amber equaliser. ↑ / ↓ roving focus, as in the index |
| **Now playing** | `#now` | `.now-pos` as an eyebrow row: the clock (mono 13 `--ink`) and "/ 2:54 · Track 1 of 3" (`legend` style); the **side progress bar** under it (`aria-hidden`, 2 px, one segment per track sized by `dur`, 2 px gaps, elapsed in `--amber`, the rest `--line-2`; updated with `transform: scaleX()` only when the second changes, from the existing `time` handler); `.now-title` (`title`, serif); `.now-meta` (meta 13 `--ink-2`); `.now-note` (`note`, with a 3-line drop cap in `--tape`, lightened for contrast; `::first-letter`, no extra text); `.now-credit` (caption 12 `--ink-3`, the license link underlined) | `is-empty` note: italic `--ink-3`. Track change: cross-fade (§D2.9) |
| **Missing file** | `.missing`, `role="note"`, wording unchanged | a flat inline notice: `--needle` at 8% fill, 1 px `--needle` at 35% border, `--r2`; `strong` as a `legend` in `--needle`, `code` in mono 12, the silent line in meta 13 | never rotated, no stamp texture |
| **Empty / failed panel** | `.empty` in `#liner-body` | `L.empty` as `name-l`, `L.pick` in `ui` 15 `--ink-2`, `L.hint` in caption 12 `--ink-3`, max 46ch; the CSS arrow toward the shelf | |
| **How it works** | `<section id="about">`, after the main grid | `legend` eyebrow, `head` heading, three steps on 4 columns each (01 Pick a tape · 02 Press play · 03 Wind to a track) with `kbd` chips (Space, ←, →; 1 px `--line-2`, mono 12, `--r2`), then one sentence on sources ("Public-domain and permitted recordings. Each track lists its credit and license.") | static |
| **Footer** | `footer` | a 2 px five-stripe rule (32 px wide), "caset · CS-86" mono 12 `--ink-3`, "lucaspose.cl" | |
| **Mini bar** | new `<div class="mini" aria-label="Now playing">` (not a live region), outside `#liner`; phone and tab only | a 2 px side progress line on its top edge (same segments as the panel), art 40 × 28, title (ui 15, ellipsis) over "Voices · A1 · 0:42" (mono 12), a 44 px round play/stop button `.mini-toggle` (`aria-pressed` = playing, label "Play"/"Stop" from copy.js; calls `player.press(mode === "play" ? "stop" : "play")`) | hidden by default. Shown when a tape is loaded **and** neither `#slot` nor `#liner` intersects the viewport (one IntersectionObserver). Slides up over `--t2`. Tapping the art or title scrolls `#slot` into view (smooth unless reduced motion). Fixed bottom with 8 px insets plus `env(safe-area-inset-bottom)`, `--bg-2` at 92% + blur, `--r3`, 60 px tall (52 in short) |
| **No-WebGL keys** | `body.nogl .key` | a flat row of six graphite buttons under the plate (`--bg-2`, 1 px `--line-2`, `--r2`, `--font-ui` legends, play with an amber dot when latched) on the same backdrop, with `meter.js` above them | latched: `--bg-3` + amber dot; refused tap: 120 ms dim |
| **Grain** | `.film` (last child of body) | one `.grain` tile from `film.js` at **0.035** opacity, stepped at 8 fps with `steps(1)` keyframes | static under reduced motion. **Removed:** the dust tile, the hairline scratches and the page vignette |

`.room` and its leaks and bokeh are **deleted** from `index.html` and `style.css`. Update the "DOM the current views expect" paragraph in `docs/ARCHITECTURE.md` (no `.room`; `.film` holds only grain; `.lang` lives in the top bar; the mini bar).

### D2.7 Desktop wireframe (1280 × 800, tape loaded, playing)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ caset ≡ CS-86   A cassette deck in your browser, loaded with ten tapes…  How it works (EN|es)│ 56
├──────────────────────────────────────────────────────────────┬───────────────────────────┤
│                                                              │ THE SHELF · 10 TAPES      │
│        . . . warm pool on the seamless (tape-tinted) . . .   │ Ten tapes of recorded     │
│     ┌──────────────────────────────────────────────────┐     │ history.                  │
│     │      CS-86 deck, ~815 × 284, keys overlaid       │     │ Carl Sagan, Apollo 11, …  │
│     └──────────────────────────────────────────────────┘     │───────────────────────────│ slot 368
│           ▁▁▁▁▁▁▁ real shadow on the sweep ▁▁▁▁▁▁▁            │▌01 [art] Voices    ılı    │
│ CS-86 · STEREO CASSETTE DECK                A1 · 0:42 / 2:54 │    Science / History      │
│ ━━━━━─────────────────────────────────────────────────────── │ 02 [art] Moonshot  A 5:01 │
│ [art] Voices                     ┌[A] Science │ [B] History┐ │    Going / Trouble… B 4:15│
│       01 · 6 recordings · 8:55   └────────────┴────────────┘ │ 03 [art] Other worlds  …  │
│ ┃ılı Pale Blue Dot         2:54 │ 0:42 / 2:54 · TRACK 1 OF 3  │ 04 … First sounds         │
│ ┃    Carl Sagan, 1994           │ ▬▬▬▬───────── ─────── ───── │ 05 … Living things        │
│  2  The beauty of a flower 1:01 │ Pale Blue Dot      (serif 30)│ 06 … Ocean               │
│     Richard Feynman, 1981       │ Carl Sagan · 1994           │ 07 … Live                 │
│  3  Now I am become Death  0:53 │ C̲arl Sagan looks at Voyager │ 08 … Now                  │
│     J. Robert Oppenheimer, 1965 │ 1's photo of Earth… (17/28) │ 09 … Words                │
│                                 │ (continues below the fold)  │ 10 … Music                │
└─────────────────────────────────┴─────────────────────────────┴───────────────────────────┘
  ↓ credit · missing-file notice · HOW IT WORKS (3 steps, keys) · footer
```

Panel columns inside the 9-column main: tracks = columns 1 to 4 (382 px), now = columns 5 to 9 (500 px, so the note runs about 58 characters a line).

### D2.8 Phone (390 × 844) and landscape

**Portrait, one column, 16 px gutters, the page scrolls:**

1. **Top bar 52, sticky:** wordmark + stripes, EN | ES pill (44 tall hit area). No anchors.
2. **Statement:** `head` 20 / 28 one line "A cassette deck in your browser." + meta 13 / 20 one line "Ten tapes of recorded history. Pick one, press play." (ES: "Una casetera en tu navegador." / "Diez cintas de historia grabada. Elige una y dale play."). About 80 px.
3. **Plate:** `#slot` 358 wide, `aspect-ratio: 358 / 508` (the `stack` preset, unchanged). Caption hidden.
4. **Shelf rail:** `legend` eyebrow "THE SHELF · 10 TAPES" with "01 / 10" position in mono on the right (updated on scroll-end, `aria-hidden`); a horizontal rail of 136 px cards, 12 px gap, `scroll-snap-type: x mandatory`, `scroll-padding-inline: 16px`, bleeding to the screen edges so the third card peeks. The loaded card is scrolled into view (`inline: "nearest"`) on `deck`. **At 844 tall the art, names and topics of the first two cards are above the fold** (plate ends at y ≈ 640, cards start at y ≈ 684).
5. **Panel:** tape header (art, name 24, meta line), the side switch full width (44 tall), the tracks (60 px rows), then now playing (title 26, note 16 / 24, credit, missing notice). Tracks come before the note because the track is the second click.
6. **How it works**, footer.
7. **Mini bar** (§D2.6).

Card click on phone/tab: `sound.unlock(); player.load(id)` as now, and **only if** `#slot` is less than 40% visible, scroll it into view (`block: "start"`, offset by the bar via `scroll-margin-top`; smooth unless reduced motion). With the rail directly under the plate this rarely fires. Keyboard activation (`e.detail === 0`) moves focus to the first `.track` after `settled`.

```
┌──────────────────────────────┐
│ caset ≡≡≡             (EN|es)│ 52 sticky
│ A cassette deck in your      │
│ browser. Ten tapes… press play│ ~80
│ ┌──────────────────────────┐ │
│ │ VU · VU · peak meter     │ │
│ │ door + cassette window   │ │ 358 × 508 (stack)
│ │ station dial             │ │
│ │ LED/counter │ keys       │ │
│ └──────────────────────────┘ │
│ THE SHELF · 10 TAPES   01/10 │
│ [art  ][art  ][ar→           │ 136 px cards, snap
│ Voices  Moonshot  Other…     │ ← fold ≈ 844
│ Science/History  Going/…     │
│ A 4:50 · B 4:05  IN THE DECK │
│ [art] Voices  01·6 rec·8:55  │
│ [ [A] Science │ [B] History ]│ 44
│ ┃ılı Pale Blue Dot      2:54 │ 60 rows
│  2  The beauty of a…    1:01 │
│  3  Now I am become…    0:53 │
│ 0:42 / 2:54 · TRACK 1 OF 3   │
│ ▬▬▬───── ──── ───            │
│ Pale Blue Dot (serif 26)     │
│ note (serif 16/24) · credit  │
│╭────────────────────────────╮│
││[a] Pale Blue Dot        (■)││ mini bar: only when the deck
││    Voices · A1 · 0:42      ││ and the panel are off screen
│╰────────────────────────────╯│
└──────────────────────────────┘
```

**Landscape phone (844 × 390, "short"):** bar 40 with the statement inline (meta 13, ellipsis) and the pill; plate `calc(100dvh - 48px)` tall, full width, `full` preset (the deck is about 730 px wide); then the rail, the panel in two columns (tracks | now), How it works, footer. Mini bar 52.

### D2.9 Motion and focus

Only `transform` and `opacity` animate. The page adds no `requestAnimationFrame` loop of its own: everything is driven by engine events or CSS.

| Moment | What moves | Timing |
|---|---|---|
| Hover on a row, card, track, segment | background fade; art nudge 2 px | `--t1` |
| Load (`deck` event after a load) | panel content out (opacity, 120 ms) then in (opacity + 4 px rise, `--t2`); the index row's tape bar grows from 0 (scaleY); the plate caption swaps | in sync with `swap()` |
| Flip (`deck` event after a flip) | the side switch thumb slides (`--t2`); the tracks cross-fade | on the engine's swap, mid-turn |
| Track change (`track` event) | now-playing title, meta and note cross-fade (180 ms); the current-track bar is one absolutely positioned element moved with `translateY` (`--t2`) | |
| Progress | `scaleX` on the current segment, written once per second | |
| Scene pool | the deck's pool colour eases to the tape (1200 ms) | inside the deck |
| Mini bar | slides up / down 100% (`--t2`) | IntersectionObserver |
| Top bar | background and hairline fade in when scrolled (`--t2`) | sentinel observer |
| Equaliser | three bars, `scaleY` keyframes 0.9 to 1.3 s, while `html.is-playing` | off under reduced motion |
| Grain | `steps(1)` at 8 fps | off under reduced motion |

- **Reduced motion** (`prefers-reduced-motion: reduce`): every transition above becomes instant (cross-fades become opacity-only 0 ms swaps), no smooth scrolling, no equaliser animation, static grain, no art nudges. The deck keeps its own §10.2 behaviour.
- **State classes** live on `<html>` (`is-booted`, `is-loaded`, `is-playing`, `is-scrolled`, `post-off`), never on `body`. `is-playing` is set from the `latch` event (`action === "play"`).
- **Focus:** `:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }`, inset (`-2px`) on rows and cards inside scroll containers so it is never clipped. The invisible key overlays outline the 3D key as now. Tab order: skip link → top bar (How it works, EN | ES) → deck keys → panel (side switch, tracks, credit link) → shelf (one stop) → about links → footer. On desk the visual order puts the shelf to the right of the panel, which matches reading order.
- **Contrast:** text ≥ 4.5:1 everywhere (`--ink-3` is the floor, used only for 11 to 13 px labels). Tape colours used as text are lightened (mix with `--ink` until ≥ 4.5:1 on `--bg-3`) in the view.

### D2.10 Code changes by file (views only; engine untouched)

- **`index.html`:** top bar (`<header class="bar">` with the wordmark `<h1>`, statement, How it works, the `.lang` pill), skip link, `<div class="layout">` with `<main>` (plate figure with `#slot`, `#status`; then `#liner` with `#liner-body`) and `<nav class="shelf" aria-labelledby>` (heading, lede, `#rail`), `#about`, footer, `.mini`, `#player`, `.film`. Remove `.room`.
- **`ui/copy.js` (new):** EN/ES for the statement, the shelf heading and lede, "The shelf · 10 tapes", "In the deck", "recordings", the side switch label, How it works, the sources line, the mini bar's labels, the skip link. It reads `getLang()`; app.js re-renders it with the other views on a language click.
- **`ui/shelf.js`:** the new `.case` content (§D2.6), per-side durations, roving focus, loaded/playing state, the rail position readout. `label(c)`, `aria-pressed`, the click path and `.nocover` / `.hascover` unchanged.
- **`ui/liner.js`:** `.lang` lookup becomes `document.querySelectorAll(".lang button")`; the side switch and the meta line inside `.spine`; the progress bar inside `#now`; roving focus in `.tracks`. Existing elements, classes and text order stay.
- **`ui/mini.js` (new):** the mini bar and its observer.
- **`ui/film.js`:** grain tile only (drop the dust tile).
- **`app.js`:** `html.is-playing` from `latch`; mount `copy.js` and `mini.js`; nothing else changes.
- **`style.css`:** rewritten around §D2.2. No wood, paper, case, stamp, bevel, leak or bokeh rules remain.
- **`deck/look.js`, `deck/deck3d.js`:** §D2.5 only. `post.js`: no change.

### D2.11 Trace safety (read before building)

`test/compare.mjs` compares, per snapshot: `hash`, `title`, `status`, `keys`, `shelf`, `lang`, `langBtns`, `current`, `missing`, `body`. (`liner` text, `shelfLabels` and `tape` are recorded but not compared; keep them stable anyway.) So:

- exactly **one** `.lang` group with **two** buttons in the document; `#liner.lang` still set by `liner.js`.
- exactly **one** set of `.case` buttons (no duplicate for phone or desk).
- `.track` and `.missing` exist only inside `#liner-body`; the mini bar and the plate caption use other classes.
- no new `.key`; the six `.key` buttons keep their order, `.key-lbl`, `aria-pressed` and `aria-label`.
- `body.className` stays exactly `gl` or `nogl`; `document.title` is not touched by the views.
- `#status` is the only live region (the mini bar and the caption are not).
- The phone step clicks `.case` at 390 × 844 **without** `force`: the rail cards must be hittable. The mini bar is hidden while `#liner` is in view, and the rail sits directly above the panel, so it never covers a card; add `scroll-padding-bottom: 76px` on `html` at < 1100 as insurance.
- The keys are clicked with `force: true` at their centres: nothing (the sticky bar, the mini bar) may sit over a key at click time, and the page must not be smooth-scrolling then. Programmatic scrolls happen only on phone/tab, only when the deck is < 40% visible, and are instant under reduced motion. If compare.mjs shows a key miss, make the phone top bar non-sticky (cut item 5).

### D2.12 Acceptance checklist (replaces §11.D)

- [ ] `node test/trace.mjs <scratch>/out.json` then `node test/compare.mjs <scratch>/out.json` prints **"behaviour identical to baseline"** with `errors: []`.
- [ ] Screenshots at **1280 × 800**, **1440 × 900**, **390 × 844** and **844 × 390**: empty, loaded, playing, missing file, ES, reduced motion, `?nogl`, after context loss. Reviewed against §D2.1.
- [ ] 1280 × 800, no scrolling: the statement, the whole deck, all ten index rows with names, both topics and both side times, the tape header, the side switch and all three tracks are visible. One click loads a tape; a second click on a track winds to it.
- [ ] 390 × 844, no scrolling: the statement, the whole deck, and the art, names and topics of at least two rail cards. Card → track in two taps (one scroll allowed).
- [ ] **Edge match:** canvas pixels 4 px inside each corner and edge midpoint equal `#15110e` within ±2 per channel (post on), empty and loaded, at 1280 × 800, 1440 × 900 and 844 × 390. No visible seam between canvas and page in any screenshot.
- [ ] The deck at 1280 × 800 is 800 to 830 px wide, with the sweep visible above and below it and its shadow on the floor; the pool changes tint with the tape and settles; zero GL frames after 3 s stopped (as §11.A).
- [ ] No wood, paper, stamp, bevel, light leak, bokeh, dust or page vignette remains in `style.css` or the DOM. Grain opacity is 0.035.
- [ ] Every spacing value is on the 4 pt scale (grep `style.css` for px values off the scale; only 1 px hairlines, 2 px bars and the type sizes are exempt). Every colour comes from a token.
- [ ] Now playing: title, who · year · place, note, credit and the missing notice are readable without any inner scroll at every size; the note is ≤ 60ch wide.
- [ ] EN | ES in the top bar at every size; switching re-renders the copy.js strings, the liner and the case labels; `aria-pressed` correct on both buttons.
- [ ] The side switch flips (same announcement as the key), slides on the swap, and shows both side names.
- [ ] Mini bar: appears on phone and tab only when loaded and both the deck and the panel are off screen; play/stop works and the key's `aria-pressed` follows; never covers a rail card or a key.
- [ ] Keyboard: skip link, the visible amber ring everywhere, ↑ / ↓ / Home / End in the shelf and in the tracks, Space / ← / → unchanged; the shelf is one Tab stop.
- [ ] Reduced motion via `emulateMedia`: nothing moves except what the deck allows (§10.2); no smooth scroll.
- [ ] 60 fps playing on a laptop (pixel-ratio cap unchanged; the page adds no per-frame DOM writes beyond the existing once-per-second clock and progress), no console errors or warnings, `node --check` on every changed `.js`.
- [ ] `docs/ARCHITECTURE.md` updated (DOM paragraph, `ui/` list: `copy.js`, `mini.js`; the room description in `deck/deck3d.js`).

### D2.13 Cut order (cut from the top) and never-cut

1. The drop cap.
2. The equaliser animation (keep a static amber dot).
3. The rail position readout ("01 / 10").
4. The pool's tint toward the tape (keep the fixed warm pool).
5. The sticky top bar on phones (make it static).
6. ↑ / ↓ roving focus (plain Tab order).
7. The mini bar.

**Never cut:** the seamless sweep with the canvas edge equal to the page; the deck at the new framing with air; the statement; the sticky index on desk and the rail on phone, both with names, topics and side times; the now-playing panel directly under the deck with no inner scroll; the side switch; EN | ES in the top bar; the flat, token-only UI with no skeuomorphic furniture.

---

## 9. Shared tokens

### 9.1 CSS `:root` (engineer D pastes this): SUPERSEDED by §D2.2

> Superseded: use the §D2.2 tokens. The deck-side `LOOK` in §9.2 stays, with the §D2.5 deltas.

```css
:root {
  --room: #0e0b09;  --room-2: #1d1611;
  --ivory: #efe4cc; --ivory-dim: #a8998a; --line: rgba(239, 228, 204, 0.14);
  --alu: #cfccc6;   --alu-dim: #8f8b84;   --alu-ink: #2a2725; --slot-black: #0b0a0a;
  --paper: #efe4cc; --paper-ink: #221a15; --paper-dim: #6d5f50;
  --walnut: #3b2416; --walnut-hi: #5a3a24;
  --amber: #ffb347; --vfd: #d8f4ff; --vu-lamp: #ffb25c; --led: #ff2a1c; --dial: #fff1d8;
  --needle: #ff6a1f; --signal: #e2582b; --lamp-red: #ff4a1c; --stamp: #c8321e;
  --leak-red: #ff5a2a; --leak-amber: #ffb347; --leak-teal: #3d8d8c;
  --orange: #e2582b; --mustard: #e3b03a; --olive: #8a8b3b; --teal: #3d8d8c; --navy: #33506b;
  --font-brand: Futura, "Futura PT", "Century Gothic", "Avenir Next", "Trebuchet MS", system-ui, sans-serif;
  --font-panel: "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif;
  --font-serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --case-w: 76px; --case-h: 120px;
}
```

`body` gets `background: var(--room)` explicitly. `meta theme-color` is `#0e0b09`. No web fonts (the CSP forbids them).

### 9.2 `LOOK` (engineer A pastes this into `look.js`; B reads only `LOOK.font`, `LOOK.ink`, `LOOK.STRIPES`, `LOOK.display`)

```js
export const LOOK = {
  STRIPES: ["#e2582b", "#e3b03a", "#8a8b3b", "#3d8d8c", "#33506b"],
  font: {
    brand: `Futura, "Futura PT", "Century Gothic", "Avenir Next", "Trebuchet MS", system-ui, sans-serif`,
    panel: `"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif`,
    numeric: `"DIN Alternate", "DIN Condensed", "Avenir Next Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif`,
    serif: `Georgia, "Times New Roman", serif`,
    mono: `ui-monospace, "SF Mono", Menlo, Consolas, monospace`,
  },
  room: "#0e0b09", roomPool: "#2a1d14",
  ink: { onAlu: "#2a2725", onAluAlpha: 0.86, onBlack: "#9a9286", onBlackDim: "#5f5a52",
         red: "#c8321e", paper: "#efe4cc", paperInk: "#221a15" },
  mat: {
    alu: 0xcfccc6, aluSub: 0xbdb9b1, aluDoor: 0xd6d3cc, aluKey: 0xd9d6cf, aluKnob: 0xdedbd4,
    topCover: 0xb9b6b0, slot: 0x0b0a0a, backplate: 0x0a0909, smoke: 0x0e0c0b, rubber: 0x111111,
    innerFrame: 0x050505, carriage: 0x2b2b2d, chrome: 0xe8e8e8, playTip: 0xe2582b, walnut: 0x3b2416,
    hub: 0xece6d8, pack: 0x2a1910, cassetteShell: 0x9c9a95, cassetteTint: 0.15, label: 0xefe4cc,
  },
  pbr: {
    alu: { rough: 0.34, roughMin: 0.26, roughMax: 0.42, aniso: 0.75 },
    aluSub: { rough: 0.42, aniso: 0.6 }, key: { rough: 0.28, aniso: 0.8 }, knob: { rough: 0.22 },
    smoke: { opacity: 0.38, rough: 0.04, ior: 1.49, env: 1.6 }, shell: { opacity: 0.35, rough: 0.08, env: 1.3 },
  },
  light: {
    toneMapping: "agx", exposure: 1.0, environment: 0.9,
    key: 0xfff1de, keyIntensity: 2.2, fillSky: 0xe9eef5, fillGround: 0x2a1d14, fill: 0.35,
    rim: 0x9ec3d0, rimIntensity: 0.6, compartment: 0xffcf8a,
  },
  post: {
    clear: 0x0b0908, bloomThreshold: 1.25, bloomStrength: 0.62, bloomRadius: 0.5,
    tints: [[1, 1, 1], [1, 0.97, 0.92], [1, 0.85, 0.7], [1, 0.6, 0.42], [1, 0.45, 0.3]],
    lift: "#0b0908", ca: 0.6, vignette: 0.18, leak: "#ff5a2a", leakAmount: 0.04,
  },
  display: {
    vuZeroDbfs: -16, vfdZeroDbfs: -8,
    vuPaper: "#f2e2b8", vuPaperEdge: "#c9ab72", vuInk: "#1d1712", vuRed: "#c8321e",
    vuLamp: [1.0, 0.70, 0.36], vuLampR: [1.0, 0.68, 0.33], vuLampOn: 1.55, vuLampEmpty: 0.35,
    vuOmega: 19, vuZeta: 0.80, vuOmegaR: 18.2, vuZetaR: 0.78,
    vfdWhite: "#d8f4ff", vfdAmber: "#ffb347", vfdAmberHot: "#ff7a1a", vfdGhost: "#1c3a3a", vfdFilter: "#0a1418",
    vfdLit: 2.6, vfdLitAmber: 3.0, vfdLegend: 1.1, vfdGhostLevel: 0.04,
    vfdHold: 1.4, vfdHoldFall: 20, vfdRelease: 13.3, vfdTailFall: 60,
    led: "#ff2a1c", ledLit: 3.0, ledGhost: 0.03, ledFilter: "#2a0605",
    dialLamp: "#fff1d8", dialLampOn: 1.35, dialLampEmpty: 0.15, dialInk: "#2a2420",
    dialStation: "#c8321e", needle: "#ff6a1f", needleLit: 2.2, tuned: "#7dffa0",
    lampPlay: "#ff4a1c", lampCue: "#ffb347", lampOn: 3.2, lampOff: 0.05,
    drumBg: "#141110", drumInk: "#f1e6cf", drumGlow: 0.18,
  },
};
```

---

## 10. Performance, reduced motion, fallbacks

### 10.1 Budget

| Item | Budget |
|---|---|
| Canvas | Slot-sized (not the viewport). DPR at most 2, at most 2.6 MP |
| Draw calls per view | under 160 (`full`); frustum culling keeps each `stack` view under 70. Merge static fascia parts per material with `mergeGeometries` |
| Triangles | under 250k (knobs: 64-segment lathes; drums: 20 facets) |
| GPU textures | under 64 MB (fascia atlas 4096 × 1304, VU faces 1400 × 720 × 2, dial 2048 × 362 × 4, label 1024 × 190 × 2, legend canvases, the VFD masks) |
| Frame while playing | GPU under 8 ms at 1280 × 800 on an M1-class laptop; JS under 2 ms; zero per-frame allocation in `frame`, `update`, `read` and `setLevels` |
| Idle (stopped) | 0 GL frames. The page's only animation is the CSS grain step at 12 fps (compositor only) |
| High tier | MSAA 4, bloom at 1/2 res, shadow 2048, physical materials |
| Low tier | MSAA 0, bloom at 1/3 res, shadow 1024, standard materials, no parallax |

The low tier is the default when `matchMedia("(pointer: coarse)")` matches and `min(screen.width, screen.height) < 600`, and it is the auto-downgrade target (§4.5).

### 10.2 Reduced motion (`setReduceMotion(true)` and the player's `setCassette` path)

- Choreographies run at duration 0, and the events still fire.
- No parallax, no counter spin-up, no VFD boot test or blinks or flicker, no dial band-change fades, no knock.
- VU needles are critically damped (ζ = 1). **Meters stay live**: they are information, not decoration.
- The page: static grain and leaks, no dust, no case tilt.

### 10.3 Fallbacks

| Case | Behaviour |
|---|---|
| No WebGL / context lost | Today's `body.nogl` path. Aluminium HTML keys; the optional CSS meter strip; the rack, liner and film stay |
| HDR targets unsupported | `post.ok = false`: direct render, no bloom |
| No Web Audio, routing failed, or `?levels=0` | Zeros. Meters show cue and hiss synthesis only, and audio plays untouched |
| Cover image fails | Label with five stripes; the shelf case shows `.nocover` |
| `displays.js` fails to load | The deck works with dark windows |

---

## 11. Acceptance checklists

**Shared harness:** `npx wrangler dev --port <yours>` in the background (kill it when done). Headless Chromium only, with `--use-angle=swiftshader --enable-unsafe-swiftshader`. Screenshots go in the scratchpad `shots/` folder. **Never** use the Playwright MCP or Claude-in-Chrome tools.

**A. Deck**

- [ ] Implements every contract member in ARCHITECTURE.md, plus `setLevels`. `swap()` is called exactly once per load and flip (assert with a counter in a dev build), and every promise resolves exactly once, including after a context loss mid-animation.
- [ ] Screenshots at 1280 × 800, 390 × 844 and 844 × 390, empty and loaded, while playing. The deck reads as brushed aluminium (long horizontal sheens, not grey plastic). The cassette is visible and warm through the smoked window. The legends are sharp.
- [ ] `stack` preset: 5 views in the right order, gutters, `keyRects` inside their views, eject reachable. Phone row keys about 48 × 40, eject 44 × 44. No overlapping rects at any size.
- [ ] `?debug=bloom`: only displays, lamps and the dial needle glow. Canvas corners match `--room` within ±4.
- [ ] Zero GL frames when idle (count `renderer.info.render.frame` over 3 s stopped). Draw calls and triangles are within budget (logged under `?debug`).
- [ ] Choreography timings within ±15% of §3.5. Flip swaps the label while edge-on.
- [ ] No console errors or warnings, including three.js deprecation warnings. `node --check` passes on every file.

**B. Displays**: §5.9.

**C. Audio**: §6.3.

**D. Page UI**: superseded by the §D2.12 checklist.

- [ ] Every DOM hook in the hard rules is present. `body.className` is only ever `gl` or `nogl`. The reserved classes are used only for their hooks.
- [ ] Layouts at 1280 × 800 (no page scroll), 390 × 844 (page scroll, no horizontal scroll, 16 px gutters) and 844 × 390, in `gl` and `?nogl` modes. Screenshots reviewed.
- [ ] Tab order: brand, the keys (visible focus rings over the 3D keys), the cases, the tracks, the license link, EN / ES. Focus is always visible.
- [ ] Reduced motion via `emulateMedia`: nothing drifts or steps.
- [ ] The loaded case shows open and empty and closes on eject. The tape colour tints the room.
- [ ] `node --check` passes. No console errors or warnings.

---

## 12. Cut order (cut from the top) and never-cut list

1. The nogl CSS meter strip (`ui/meter.js`).
2. Pointer parallax.
3. The function tube (`modes`). The backplate keeps its caption-free black area.
4. Light spill planes (§3.7) and the plank spill.
5. Hub motion blur, counter wind blur, the counter's spin-up on load.
6. Dust on the glass, the fingerprint smudge maps, the decorative function-block parts (NR keys, mic jacks, tape-select knob). Keep the big knob.
7. Dial station titles (keep the years, pips, minute row and needle).
8. The LED readout (the counter and dial still show position).
9. The halation tints (keep plain bloom).

**Never cut:** the brushed anisotropic aluminium with the soft-box environment; the smoked glass; the front-loading door choreography with the Y-axis flip; the twin VU meters with real ballistics and needle shadows; the peak VFD with ghosts, grid, filaments and peak hold; the mechanical counter; the station dial with its needle; real levels on sound.js's context. (The page's "film room" is superseded by §D2: grain only, at 0.035; the seamless sweep is never-cut there.)

---

## 13. Integration checklist (in this order)

1. Merge A's `look.js` first. B and D rebase on its values (§9 should already match).
2. Wire D's `app.js` (dynamic `levels.js`, `setLevels`). Check that it runs with C's module present and with it missing.
3. Load the deck with B's displays (the dynamic import succeeds). Mount positions match §3.2: overlay a debug wireframe of every `SIZES` box on the backplate cut-outs.
4. Start a fresh server, then run `node test/trace.mjs <scratch>/out.json <scratch>/shots/t` and `node test/compare.mjs <scratch>/out.json`. The result must be **"behaviour identical to baseline"** with `errors: []`.
5. Take screenshots: desktop, phone portrait and landscape; empty, loaded, playing (mid-track), winding, flipped, reduced motion, `?nogl`, and after context loss. Review them against §0.2 and §5.8.
6. Run `node --check` on every changed `.js`, and the idle zero-frame check.
7. Delete `public/dev/`, kill the dev servers, and list every changed file for the owner. No commit or deploy.
