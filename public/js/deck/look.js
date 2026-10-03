// The look of the 3D deck: every colour, font and light level deck3d.js uses.
// Change the vibe here first; geometry and animation live in deck3d.js.
// CSS has its own copy of the palette in style.css (:root); keep the two in step.
export const LOOK = {
  // the five chroma stripes (deck front, cassette labels without art)
  STRIPES: ["#e2582b", "#e3b03a", "#8a8b3b", "#3d8d8c", "#33506b"],
  FONT: `Futura, "Futura PT", "Century Gothic", "Avenir Next", "Trebuchet MS", system-ui, sans-serif`,
  INK: "#221a15",          // dark text on key tops and labels
  PAPER: "#efe4cc",        // label paper, light ink on dark tape colours

  // canvas-drawn textures
  tex: {
    brushedLight: "#e4e1dc", // brushed-metal plate, colour map
    brushedDark: "#8c8c8c",  // brushed-metal plate, roughness map
    wordmark: "rgba(34,26,21,0.72)",
    digitsBg: "#1a1411",     // counter drums
    digitsInk: "#f1e6cf",
    tapeRings: "#3a2619",    // tape pack seen through the window
    labelDim: "#6d5f50",     // secondary text on cassette labels
    labelWindow: "rgba(24,17,13,0.9)",
  },

  // materials (three.js colours)
  mat: {
    body: 0x2a211c,
    bodyDark: 0x120e0c,
    plate: 0xc6b69b,         // brushed top plate
    chrome: 0xd8d2c8,
    rubber: 0x151110,
    key: 0xe7dcc4,
    playKey: 0xe2582b,
    hub: 0xece3d0,
    shell: 0x2b2420,
    shellInner: 0x0c0a09,
    glassTint: 0x0c0806,
    lamp: 0x3a1a10,
    lampGlow: 0xff5a1f,
    cassetteShell: 0x1d1714, // mixed with the tape's own colour by cassetteTint
    cassetteTint: 0.32,
  },

  // key tops: [top gradient, bottom gradient]
  keyTop: {
    play: ["#e8653a", "#d9542a"],
    playInk: "#2a120a",
    other: ["#efe6d2", "#ded2b9"],
  },

  light: {
    exposure: 0.92,          // ACES tone mapping exposure
    environment: 0.62,       // room environment map strength
    sky: 0xffeedd, ground: 0x1a120d, hemi: 0.35,
    sun: 0xffe6c8, sunIntensity: 2.6,
    rim: 0x9ec3d0, rimIntensity: 0.9,
  },

  // starfield tints: three common ones, then a rare accent (index 3)
  stars: [0xffffff, 0xfff1d6, 0xd8e6ff, 0xe3b03a],
};
