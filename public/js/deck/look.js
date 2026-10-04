// The look of the CS-86 deck: every colour, font, material and light level of the 3D deck
// and its displays (docs/DESIGN.md §9.2). Change the vibe here first; geometry lives in
// deck3d.js and parts/*. CSS keeps its own copy of the palette in style.css (:root).
// displays.js reads only LOOK.font, LOOK.ink, LOOK.STRIPES and LOOK.display.
export const LOOK = {
  STRIPES: ["#e2582b", "#e3b03a", "#8a8b3b", "#3d8d8c", "#33506b"],
  font: {
    brand: `Futura, "Futura PT", "Century Gothic", "Avenir Next", "Trebuchet MS", system-ui, sans-serif`,
    panel: `"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif`,
    numeric: `"DIN Alternate", "DIN Condensed", "Avenir Next Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif`,
    serif: `Georgia, "Times New Roman", serif`,
    mono: `ui-monospace, "SF Mono", Menlo, Consolas, monospace`,
  },
  // the page colour (style.css --bg): the stack preset's gutters and the studio's ground
  room: "#15110e",
  // the studio around the deck (docs/DESIGN.md §D2.5): one seamless sweep whose edge is the page
  stage: {
    ground: "#15110e",                       // the page colour the canvas edge must hit (sRGB)
    // linear HDR value that comes out of the post chain (lift, grade, AgX, sRGB) as #15110e.
    // Tuned headless against the edge-match check (4 px inside every corner and edge midpoint,
    // empty and loaded, 1280x800, 1440x900, 844x390); TUNE AGAIN if post.js or the tone mapping change.
    groundLinear: [0.0097, 0.0079, 0.0065],  // measured: #15110e +-1 (the right edge +2 from the VU lamps)
    // a lighter warm grey seamless, so the floor and the cove read as a studio the deck stands in
    sweep: 0x4a4036, sweepRough: 0.92, sweepEnv: 0.15,
    // falloff in screen space, as fractions of the full view: centre (x from the left, y from
    // the top) and radii. Wide and very soft: the lit sweep around the deck, the ground at the edge
    fall: { c: [0.5, 0.56], r: [0.62, 0.78], r0: 0.08 },
    // the warm pool on the wall behind the deck (linear HDR, under the bloom knee)
    pool: [0.085, 0.058, 0.038],
    pool_c: [0, 98], pool_r: [40, 14], poolTape: 0.10, poolMs: 1200,
  },
  ink: { onAlu: "#2a2725", onAluAlpha: 0.92, onBlack: "#9a9286", onBlackDim: "#5f5a52",
         red: "#c8321e", paper: "#efe4cc", paperInk: "#221a15" },
  mat: {
    // bright satin silver (the M226), the brightest large surface on the page
    alu: 0xdedbd4, aluSub: 0xcdc9c1, aluDoor: 0xe2dfd8, aluKey: 0xe2dfd8, aluKnob: 0xe4e1da,
    topCover: 0xb4b1ab, slot: 0x0b0a0a, backplate: 0x0a0909, smoke: 0x0e0c0b, rubber: 0x111111,
    innerFrame: 0x050505, carriage: 0x0d0c0c, chrome: 0xe8e8e8, playTip: 0xe2582b, ruleGreen: 0x4f8f55, bezel: 0x161514,
    hub: 0xe6dfd0, pack: 0x2a1910, cassetteShell: 0x9c9a95, cassetteTint: 0.15, label: 0xefe4cc,
  },
  pbr: {
    alu: { rough: 0.34, roughMin: 0.26, roughMax: 0.42, aniso: 0.75 },
    aluSub: { rough: 0.42, aniso: 0.6 }, key: { rough: 0.28, aniso: 0.8 }, knob: { rough: 0.22 },
    // the acrylic and the shell use a second env map without the front diffuser (deck3d.js)
    // the display bar is a lighter smoked acrylic: the lit faces read through clean
    smoke: { opacity: 0.16, rough: 0.04, ior: 1.49, env: 0.6 }, shell: { opacity: 0.12, rough: 0.05, env: 1.3 },
    // the door window: a darker, warmer smoked acrylic, so only the label and the hubs read through
    smokeDoor: { color: 0x1a120c, opacity: 0.34, env: 0.8 },
  },
  light: {
    toneMapping: "agx", exposure: 1.0, environment: 0.9,
    key: 0xfff1de, keyIntensity: 2.2, fillSky: 0xe9eef5, fillGround: 0x2a1d14, fill: 0.35,
    // a faint, nearly neutral rim: it separates the silhouette from the dark wall without a glow
    rim: 0xd6dbdc, rimIntensity: 0.2, compartment: 0xffcf8a,
  },
  post: {
    // bloom: a soft knee from bloomThreshold to bloomThreshold + bloomKnee (linear HDR luminance).
    // The brightest env-lit alu highlights stay under it; displays, LEDs and lamps sit above.
    // clear: the ViewsPass clear; deck3d.js passes stage.groundLinear here (see stage)
    clear: 0x15110e, bloomThreshold: 2.0, bloomKnee: 1.0, bloomStrength: 0.7, bloomRadius: 0.5,
    tints: [[1, 1, 1], [1, 0.97, 0.92], [0.85, 0.74, 0.62], [0.42, 0.30, 0.22], [0.12, 0.08, 0.06]],
    lift: "#060606", ca: 0.6, vignette: 0.0, leak: "#ffa36a", leakAmount: 0.0,
  },
  display: {
    // calibration (offline sim over all 53 recordings, scratchpad fix/sim2.mjs): VU in the red ~6 %,
    // the peak meter's amber (+dB) half lit ~20 %, VU over 0 while the peak reads under 0 ~1 %
    vuZeroDbfs: -24, vfdZeroDbfs: -15, vuEma: 9,
    // ivory paper: the amber comes from the lamps behind it, not from the paper
    vuPaper: "#efe2c2", vuPaperEdge: "#c9b48c", vuInk: "#1d1712", vuRed: "#c8321e",
    vuLamp: [1.0, 0.50, 0.16], vuLampR: [1.0, 0.48, 0.15], vuLampOn: 2.1, vuLampEmpty: 0.45,
    vuOmega: 19, vuZeta: 0.80, vuOmegaR: 18.2, vuZetaR: 0.78,
    // the phosphor: blue-green white, driven a little over the bloom knee (a soft glow, never a
    // smear), so the hairline bar pairs stay hairlines
    vfdWhite: "#c9fff0", vfdAmber: "#ffb347", vfdAmberHot: "#ff7a1a", vfdGhost: "#2a3238", vfdFilter: "#07090a",
    vfdLit: 2.6, vfdLitAmber: 2.8, vfdLegend: 1.5, vfdGhostLevel: 0.02, vfdHalo: 0.04, vfdPrint: 0.75,
    vfdHold: 1.4, vfdHoldFall: 20, vfdRelease: 13.3, vfdTailFall: 60,
    led: "#ff2a1c", ledLit: 2.8, ledGhost: 0.03, ledFilter: "#1a0403",
    // the dial's diffuser stays under the bloom knee: only the needle and the TUNED lamp glow
    dialLamp: "#fff1d8", dialLampOn: 1.1, dialLampEmpty: 0.15, dialInk: "#2a2420",
    dialStation: "#c8321e", needle: "#ff6a1f", needleLit: 4.5, tuned: "#7dffa0",
    lampPlay: "#ff4a1c", lampCue: "#ffb347", lampOn: 4.6, lampOff: 0.05, cueWindow: "#e9f1ee", cueLamp: "#ffb347", cueIdle: 0.16, cueOn: 3.0,
    drumBg: "#0c0b0a", drumInk: "#f4ecda", drumGlow: 0.22,
  },

  // ---- finishes: the same deck in silver (the M226, default) or black anodised (the M206) ----
  // deck3d.js setFinish(name) applies one of these to the existing materials and redraws the
  // printed canvases (fascia atlas, key legends) whose ink depends on the finish. Displays,
  // glass, slots and the studio are shared. `silver` mirrors mat / pbr / ink above.
  finishes: {
    silver: {
      // fascia, door and transport sub-panel: bright satin brushed silver
      alu: 0xdedbd4, aluSub: 0xcdc9c1, aluDoor: 0xe2dfd8, metal: 1, env: 1,
      aniso: 0.75, anisoSub: 0.6, normal: 0.15, normalSub: 0.15, normalDoor: 0.12,
      // the top cover (painted satin wrap)
      top: 0xb4b1ab, topMetal: 0.85, topEnv: 0.9, topBendEnv: 0.55,
      // key caps: the same brushed silver
      key: 0xe2dfd8, keyMetal: 1, keyEnv: 1,
      // knobs: spun face, knurled skirt, bright chamfer, the tape-select pointer
      knobFace: 0xe4e1da, knobSkirt: 0xc9c5be, knobChamfer: 0xf2efe8, pointer: 0x8e8b86, screw: 0xb9b5ad,
      // printed ink on the metal (fascia atlas, eject legend), and the transport legend bands
      ink: "#2a2725", inkAlpha: 0.92, band: "#121110", bandInk: "#ebe6dc",
      // the displays' light spill on the metal (a dark panel takes much less of it)
      spill: 1,
    },
    black: {
      // black anodised aluminium: a dyed oxide over brushed metal. The dye eats the diffuse,
      // the oxide keeps a neutral satin sheen, and the brushing reads as long soft streaks of
      // reflected soft box rather than as grain
      alu: 0x232120, aluSub: 0x1d1c1b, aluDoor: 0x252322, metal: 0.55, env: 1.25,
      aniso: 0.85, anisoSub: 0.7, normal: 0.22, normalSub: 0.2, normalDoor: 0.18,
      top: 0x1c1b1a, topMetal: 0.5, topEnv: 1.05, topBendEnv: 0.7,
      // silver-grey keys (the M206 keeps light caps on the black panel), a touch darker than silver
      key: 0xbab6af, keyMetal: 1, keyEnv: 0.95,
      // dark knurled skirts, a spun silver-grey face and a bright chamfer ring
      knobFace: 0xb9b5ae, knobSkirt: 0x2a2826, knobChamfer: 0xd8d4cc, pointer: 0xc9c5bd, screw: 0x2c2a28,
      // light grey silkscreen
      ink: "#cfcac1", inkAlpha: 0.95, band: "#0c0b0b", bandInk: "#e2ddd3",
      spill: 0.18,
    },
  },

  // ---- deck-only extras (not part of the shared §9.2 contract) ----
  deck: {
    seed: 0xca5e7,
    // the procedural soft-box room the environment map is baked from (§4.2)
    // overhead: a broad soft box straight above the deck, so the lid and the fascia's upper third
    // carry a satin gradient highlight. The floor bounce is a neutral warm grey (a brown bounce
    // mirrored in the tilted door turned it to wood)
    env: { box: 0x0a0908, softA: 3, softB: 1.6, strip: 1.2, front: 2.3, overhead: 2.0, bounce: 0x4a4640, bounceI: 0.45, glow: 0xff8a3a, glowI: 0.25 },
    // reflections on the glass (linear HDR, under the bloom knee): one soft band, no dust
    glare: 0.09, glareBar: 0.12,
    spill: { vu: [1.0, 0.58, 0.26], vfd: [0.55, 0.8, 1.0], led: [1.0, 0.22, 0.12], dial: [1.0, 0.86, 0.66] },
    lamp: { empty: 0.38, loaded: 0.45, play: 0.7, open: 1.0, power: 2.4 },
    lampGain: 11,          // compartment PointLight intensity per unit of lamp level
    packLit: 0x5a3420,     // tape pack base colour as lit inside the shell: a lit chocolate oxide
    shellBody: 0x2a2724,   // clear plastic has almost no diffuse: the smoked shell reads by its gloss
  },
};
