// The CS-86: a silver, brushed-aluminium, front-loading stereo cassette deck photographed on
// a warm seamless sweep whose edge is the page colour (docs/DESIGN.md §2-§4, §D2.5). This module owns the scene, the body,
// the door choreography, the keys, the lighting, the post chain and the camera framing,
// and mounts the analogue displays from ./displays.js. It knows nothing about audio; the
// player drives it through the contract in docs/ARCHITECTURE.md (plus setLevels).
// Units are centimetres. Panel coordinates (x, y): x from the fascia's left edge (0..44),
// y from its bottom edge (0..14). World: X = x - 22, Y = y, Z = 0 at the fascia face, +Z
// toward the viewer. Colours, fonts and lights: ./look.js.
import * as THREE from "../../vendor/three.module.min.js";
import { RoundedBoxGeometry } from "../../vendor/RoundedBoxGeometry.js";
import { LOOK } from "./look.js";
import { createPost } from "./post.js";
import { createCassette, CAS } from "./parts/cassette.js";
import { mergeStatic } from "./parts/merge.js";
import {
  makeCanvas, texFactory, brushCanvases, spunCanvases, knurlCanvas, smudgeCanvas, glareCanvas,
  softEllipseCanvas, drawFasciaAtlas, drawBackplate, satinCanvas,
  drawLegend, drawGlyph,
} from "./parts/tex.js";

export const KEY_ORDER = ["rewind", "play", "forward", "stop", "flip", "eject"];

// ---------- layout (panel cm) ----------
const X = (x) => x - 22;
const DEG = Math.PI / 180;
const DOOR = { x0: 5.6, x1: 19.8, y0: 4.0, y1: 13.2, t: 0.5, front: 0.25, open: 32 };
const WIN = { x0: 6.0, x1: 19.4, y0: 7.2, y1: 12.8 };
const DIAL = { x0: 5.6, x1: 19.8, y0: 0.8, y1: 3.6 };
const BAR = { x0: 20.2, x1: 43.6, y0: 7.0, y1: 13.2 };
const TRANS = { x0: 20.2, x1: 28.8, y0: 0.8, y1: 6.8 };
const SEAT = { x: 12.7, y: 9.9, z: -1.0 };
const KEYS = {
  rewind: { x: 21.65, y: 5.76, w: 2.4, h: 1.0 },
  forward: { x: 24.5, y: 5.76, w: 2.4, h: 1.0 },
  flip: { x: 27.35, y: 5.76, w: 2.4, h: 1.0 },
  play: { x: 24.5, y: 3.9, w: 8.1, h: 1.0 },
  stop: { x: 24.5, y: 1.9, w: 8.1, h: 1.0 },
  eject: { x: 2.6, y: 10.2, w: 2.4, h: 1.2 },
};
// long, flat, low-profile aluminium bars nearly flush in dark slots (the M226's keys)
const KEY_DEPTH = 1.2;
const Z_REST = 0.22, Z_LATCH = 0.04, Z_TAP = 0.1;
const GAP = 0.08;
// displays: centre (panel) and the Z of their local z = 0 (§3.2)
const MOUNT = {
  counter: [22.2, 11.95, -0.35], led: [26.3, 11.95, -0.35], lamps: [24.6, 9.95, -0.35],
  modes: [24.6, 8.25, -0.35], vuL: [32.5, 11.1, -0.35], vuR: [39.7, 11.1, -0.35],
  vfd: [36.1, 8.25, -0.35], dial: [12.7, 2.2, -0.25],
};
const SIZES = {
  counter: { w: 3.0, h: 1.5 }, led: { w: 4.4, h: 1.5 }, lamps: { w: 7.8, h: 0.7 }, modes: { w: 7.8, h: 1.7 },
  vuL: { w: 7.0, h: 3.6 }, vuR: { w: 7.0, h: 3.6 }, vfd: { w: 14.2, h: 1.7 }, dial: { w: 13.6, h: 2.4 },
};
// close-up regions in panel cm [x0, x1, y0, y1]: the phone's loupe (the VU pair and the peak
// meter, under the whole deck; the transport is the page's own key bar there) and the desktop
// "meters" framing (the whole display window: counter, LED, function tube, VUs, peak meter)
const REGION = {
  loupe: [28.7, 43.75, 6.85, 13.4],
  meters: [20.05, 43.75, 6.85, 13.4],
};
const R_MIN = CAS.rMin, R_MAX = CAS.rMax;

const ease = {
  inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  out: (k) => 1 - Math.pow(1 - k, 3),
  in: (k) => k * k * k,
  lin: (k) => k,
  // back-out with s = 1: about 4% overshoot (1 degree on a 32 degree door)
  back: (k) => { const u = k - 1; return 1 + 2 * u * u * u + u * u; },
};

export function createDeck({ canvas, slot, reduceMotion, onEvent = () => {} }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  const params = new URLSearchParams(location.search);
  // ?debug (or ?debug=bloom, ?debug=slow...) exposes window.__deck
  const DEBUG = params.has("debug") ? (params.get("debug") || "1") : null;
  const coarse = matchMedia("(pointer: coarse)").matches;
  let tier = coarse && Math.min(screen.width, screen.height) < 600 ? "low" : "high";
  // a software rasteriser (no GPU) gets the light tier from the start
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || "");
    if (/swiftshader|llvmpipe|software/i.test(name)) tier = "low";
  } catch { /* keep the guess */ }
  if (params.get("tier") === "low" || params.get("tier") === "high") tier = params.get("tier");
  const physical = tier === "high";
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const tex = texFactory(THREE, maxAniso);

  // every lit material ends with this chunk: cap the linear HDR output, so a specular glint on
  // a bevel (anisotropic GGX at grazing light) can never be a one-pixel spike past the
  // half-float range, which the post chain smears into a streak. Glints still bloom.
  if (!THREE.ShaderChunk.tonemapping_fragment.includes("caset-cap")) {
    THREE.ShaderChunk.tonemapping_fragment = "gl_FragColor.rgb = min(gl_FragColor.rgb, vec3(24.0)); // caset-cap\n" + THREE.ShaderChunk.tonemapping_fragment;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = LOOK.light.toneMapping === "aces" ? THREE.ACESFilmicToneMapping : THREE.AgXToneMapping;
  renderer.toneMappingExposure = LOOK.light.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  // the studio ground: the linear value the post chain turns into the page colour (look.js
  // stage.groundLinear). ?debug&ground=r,g,b overrides it while tuning the edge match.
  const G = LOOK.stage;
  let groundRGB = G.groundLinear;
  if (DEBUG && params.get("ground")) {
    const v = params.get("ground").split(",").map(Number);
    if (v.length === 3 && v.every((n) => n >= 0 && n < 1)) groundRGB = v;
  }
  const ground = new THREE.Color().setRGB(groundRGB[0], groundRGB[1], groundRGB[2], THREE.LinearSRGBColorSpace);
  const post = createPost({ THREE, renderer, LOOK: { ...LOOK, post: { ...LOOK.post, clear: ground } }, tier, debugBloom: DEBUG === "bloom" || DEBUG === "hdr" ? DEBUG : false, disabled: params.get("post") === "0" });
  // without the post chain the frame is drawn directly: clear to the page colour itself, and
  // let the page soften the canvas edge (style.css html.post-off)
  const clearColor = post.ok ? ground : new THREE.Color(G.ground);
  if (!post.ok) document.documentElement.classList.add("post-off");
  renderer.setClearColor(clearColor, 1);

  const tweens = [];
  let lost = false;
  let dirty = true;
  let shadowsDirty = true;
  canvas.addEventListener("webglcontextlost", () => {
    lost = true;
    // finish every animation at once so nothing waits on frames that will never be drawn
    reduceMotion = true;
    for (const tw of tweens.splice(0)) { tw.fn(1); tw.resolve(); }
    onEvent("contextlost");
  });

  const scene = new THREE.Scene();
  let glassEnv = null;
  const root = new THREE.Group();
  scene.add(root);
  const stat = new THREE.Group(); // everything that never moves: merged per material once built
  root.add(stat);

  // ======================================================================
  // environment: a tiny procedural soft-box room, baked once (§4.2)
  // ======================================================================
  {
    const E = LOOK.deck.env;
    const env = new THREE.Scene();
    const box = new THREE.Mesh(new THREE.BoxGeometry(200, 200, 200), new THREE.MeshBasicMaterial({ color: E.box, side: THREE.BackSide }));
    env.add(box);
    const lamp = (w, h, color, k, pos) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(...pos);
      m.lookAt(0, 0, 0);
      env.add(m);
      return m;
    };
    lamp(70, 40, 0xffffff, E.softA, [-45, 60, 30]);            // soft box A, above left
    lamp(56, 30, 0xfdfbf8, E.softB, [50, 52, 22]);             // soft box B, above right
    // the big diffuser behind the camera, brighter toward its top: the fascia's silver
    const front = [];
    for (let i = 0; i < 6; i++) front.push(lamp(240, 9, 0xfbf9f5, E.front * (0.55 + i * 0.12), [0, -8 + i * 9, 92]));
    lamp(170, 4, 0xfff2e2, E.strip, [0, 50, 84]);             // long strip light, high behind the camera
    // a broad soft box straight overhead, a little in front: the lid's satin sheen and a soft
    // light falloff down the fascia
    const over = lamp(120, 50, 0xfffaf2, E.overhead, [0, 80, 12]);
    over.rotation.set(Math.PI / 2, 0, 0);
    const floor = lamp(200, 200, E.bounce, E.bounceI, [0, -40, 0]);
    floor.rotation.set(-Math.PI / 2, 0, 0);
    lamp(40, 18, E.glow, E.glowI, [-70, -6, 28]);              // warm glow low left
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(env, 0.02).texture;
    scene.environmentIntensity = LOOK.light.environment;
    // the acrylic and the cassette shell see the room as it is in front of a real deck: dark,
    // with only the soft boxes up top. Lit by the big front diffuser they would wear a grey veil.
    for (const m of front) m.visible = false;
    glassEnv = pmrem.fromScene(env, 0.02).texture;
    pmrem.dispose();
    env.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  }

  // ======================================================================
  // textures
  // ======================================================================
  const brush = brushCanvases(LOOK.deck.seed, { roughMin: LOOK.pbr.alu.roughMin, roughMax: LOOK.pbr.alu.roughMax });
  const brushSub = brushCanvases(LOOK.deck.seed + 1, { roughMin: 0.36, roughMax: 0.48 });
  const brushKey = brushCanvases(LOOK.deck.seed + 2, { roughMin: 0.22, roughMax: 0.34 });
  // the light tier has no anisotropy, but keeps the hairline relief and roughness streaks
  // (two cheap texture fetches): without them the metal reads as flat grey plastic
  function brushSet(set, rep, rough = 0.34) {
    return {
      map: tex(set.albedo, { repeat: rep }),
      roughnessMap: tex(set.rough, { srgb: false, repeat: rep }),
      normalMap: tex(set.normal, { srgb: false, repeat: rep }),
      roughness: 1,
    };
  }
  // print atlas for the fascia and the door (uv = panel x / 44, y / 14)
  const [atlasCv, atlasG] = makeCanvas(4096, 1304);
  drawFasciaAtlas(atlasCv, atlasG);
  const atlas = tex(atlasCv);
  // baked ambient occlusion: env light is not shadowed, so contact shade is painted (aoMap)
  const aoTex = tex(drawAO(), { srgb: false });

  // ======================================================================
  // materials
  // ======================================================================
  const Phys = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  function phys(base, extra = {}) {
    const m = new Phys(base);
    if (physical) Object.assign(m, extra);
    return m;
  }
  // ink is matte paint on the metal: colour, metalness 0 and roughness 0.55 where printed
  function withPrint(m, map) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uPrint = { value: map };
      sh.vertexShader = sh.vertexShader
        .replace("#include <uv_pars_vertex>", "#include <uv_pars_vertex>\nvarying vec2 vPrintUv;")
        .replace("#include <uv_vertex>", "#include <uv_vertex>\nvPrintUv = uv;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <uv_pars_fragment>", "#include <uv_pars_fragment>\nvarying vec2 vPrintUv;\nuniform sampler2D uPrint;\nvec4 printInk;")
        .replace("#include <map_fragment>", "#include <map_fragment>\nprintInk = texture2D(uPrint, vPrintUv, -0.5);\nprintInk.a = clamp(printInk.a * 1.7, 0.0, 1.0);\ndiffuseColor.rgb = mix(diffuseColor.rgb, printInk.rgb, printInk.a);")
        .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.5, printInk.a);")
        .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.0, printInk.a);")
        .replace("#include <lights_physical_fragment>", "#include <lights_physical_fragment>\nmaterial.specularColor *= 1.0 - 0.7 * printInk.a;\nmaterial.specularF90 *= 1.0 - 0.7 * printInk.a;");
    };
    m.customProgramCacheKey = () => "caset-print";
    return m;
  }
  // metal never blooms: its lit output is held just under the bloom threshold (post.js blooms
  // the brightest channel over LOOK.post.bloomThreshold), so a satin bend or a bevel reflects
  // the soft box instead of glowing from inside. Only the displays and the lamps bloom.
  const METAL_MAX = (LOOK.post.bloomThreshold - 0.05).toFixed(2);
  function noBloom(m, max = METAL_MAX) {
    const prev = m.onBeforeCompile;
    const key = m.customProgramCacheKey();
    m.onBeforeCompile = (sh, r) => {
      prev.call(m, sh, r);
      sh.fragmentShader = sh.fragmentShader.replace("#include <tonemapping_fragment>",
        `gl_FragColor.rgb = min(gl_FragColor.rgb, vec3(${max}));\n#include <tonemapping_fragment>`);
    };
    m.customProgramCacheKey = () => key + "|nb" + max;
    return m;
  }
  const nrm = (s) => new THREE.Vector2(s, s);
  const ao = (t) => { t.channel = 0; return t; };

  const M = {};
  M.alu = noBloom(withPrint(phys({
    color: LOOK.mat.alu, metalness: 1, ...brushSet(brush, [2, 11], LOOK.pbr.alu.rough), normalScale: nrm(0.15),
    aoMap: ao(aoTex), aoMapIntensity: 1,
  }, { anisotropy: LOOK.pbr.alu.aniso, anisotropyRotation: 0 }), atlas));
  M.door = noBloom(withPrint(phys({
    color: LOOK.mat.aluDoor, metalness: 1, ...brushSet(brush, [2.3, 13], 0.3), normalScale: nrm(0.12),
    aoMap: ao(aoTex), aoMapIntensity: 1,
  }, { anisotropy: LOOK.pbr.alu.aniso, anisotropyRotation: 0 }), atlas));
  M.sub = noBloom(phys({
    color: LOOK.mat.aluSub, metalness: 1, ...brushSet(brushSub, [6, 33], LOOK.pbr.aluSub.rough), normalScale: nrm(0.15),
    aoMap: ao(aoTex), aoMapIntensity: 1,
  }, { anisotropy: LOOK.pbr.aluSub.aniso }));
  {
    // the top cover is a painted satin wrap (as on the M206 / M226 cabinets), not brushed: an
    // even fine orange peel that carries the overhead soft box as one broad, smooth gradient,
    // with no grain at any size
    const satin = tex(satinCanvas(LOOK.deck.seed + 6), { srgb: false, repeat: [8, 5] });
    M.top = noBloom(phys({ color: LOOK.mat.topCover, metalness: 0.85, roughness: 1, roughnessMap: satin, envMapIntensity: 0.9 }));
    // the bends: rougher and dimmer, so the shoulders read as a soft roll of light, never a line
    M.topBend = noBloom(phys({ color: LOOK.mat.topCover, metalness: 0.85, roughness: 0.72, envMapIntensity: 0.55 }));
  }
  M.key = phys({ color: LOOK.mat.aluKey, metalness: 1, ...brushSet(brushKey, [0.11, 0.8], LOOK.pbr.key.rough), normalScale: nrm(0.08) },
    { anisotropy: LOOK.pbr.key.aniso });
  // one brushing at world scale for every cap (the texture tile is 22 cm x 1.25 cm, as on the
  // fascia): a cap's face uv spans its own w x h, so the repeat follows its size
  function keyMat(w, h) {
    const m = M.key.clone();
    for (const k of ["map", "roughnessMap", "normalMap"]) if (M.key[k]) { m[k] = M.key[k].clone(); m[k].repeat.set(w / 22, h / 1.25); }
    return noBloom(m);
  }
  M.keySmall = keyMat(2.4, 2.2);
  const spun = spunCanvases(LOOK.deck.seed + 3);
  M.knobFace = noBloom(phys({ color: LOOK.mat.aluKnob, metalness: 1, roughness: 1, roughnessMap: tex(spun.rough, { srgb: false }), envMapIntensity: 0.65 },
    { anisotropy: 0.85, anisotropyMap: tex(spun.aniso, { srgb: false, aniso: false }) }));
  const knurl = tex(knurlCanvas(), { srgb: false, repeat: [1, 1] });
  M.knobSkirt = noBloom(phys({ color: 0xc9c5be, metalness: 1, roughness: 0.3, normalMap: knurl, normalScale: nrm(0.9) }));
  M.knobChamfer = noBloom(phys({ color: 0xf2efe8, metalness: 1, roughness: 0.12 }), "2.60");
  M.slot = new THREE.MeshStandardMaterial({ color: LOOK.mat.slot, roughness: 0.8, metalness: 0 });
  M.inner = new THREE.MeshStandardMaterial({ color: LOOK.mat.innerFrame, roughness: 0.9, metalness: 0 });
  M.chrome = noBloom(new THREE.MeshStandardMaterial({ color: LOOK.mat.chrome, roughness: 0.12, metalness: 1 }), "2.60");
  M.insert = new THREE.MeshStandardMaterial({ color: 0x121010, roughness: 0.5, metalness: 0 });
  M.rubber = new THREE.MeshStandardMaterial({ color: LOOK.mat.rubber, roughness: 0.9, metalness: 0 });
  M.carriage = new THREE.MeshStandardMaterial({ color: LOOK.mat.carriage, roughness: 0.7, metalness: 0 });
  M.well = new THREE.MeshStandardMaterial({ color: 0x0c0b0a, roughness: 0.75, metalness: 0, side: THREE.BackSide });
  M.holder = new THREE.MeshStandardMaterial({ color: 0x1b1918, roughness: 0.55, metalness: 0 });
  M.pointer = new THREE.MeshStandardMaterial({ color: 0x8e8b86, roughness: 0.6, metalness: 0.2 });
  M.backplate = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0 });
  const smudge = tex(smudgeCanvas(LOOK.deck.seed + 4), { srgb: false });
  M.smoke = phys({
    color: LOOK.mat.smoke, metalness: 0, roughness: 1, roughnessMap: smudge,
    transparent: true, opacity: LOOK.pbr.smoke.opacity, depthWrite: false, envMapIntensity: LOOK.pbr.smoke.env,
  }, { ior: LOOK.pbr.smoke.ior, specularIntensity: 1 });
  M.smoke.envMap = glassEnv;
  // the door window is darker and warmer than the display bar: only the label and hubs read
  M.smokeDoor = M.smoke.clone();
  M.smokeDoor.color.set(LOOK.pbr.smokeDoor.color);
  M.smokeDoor.opacity = LOOK.pbr.smokeDoor.opacity;
  M.smokeDoor.envMapIntensity = LOOK.pbr.smokeDoor.env;

  M.smokeBack = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.08, depthWrite: false, toneMapped: false });
  // the glass reflections: one soft band per pane, each placed differently, so no two panes
  // carry the same streak (the door window, the display bar, the dial)
  const glareMat = (o, k) => new THREE.MeshBasicMaterial({
    map: tex(glareCanvas(LOOK.deck.seed + 5, o)), color: new THREE.Color(1, 1, 1).multiplyScalar(k),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  M.glare = glareMat({ band: 0.2, width: 0.18 }, LOOK.deck.glare);
  M.glareBar = glareMat({ W: 1024, H: 256, band: 0.62, width: 0.08, top: 0.3 }, LOOK.deck.glareBar);
  M.glareDial = glareMat({ band: 0.78, width: 0.12, top: 0.6 }, LOOK.deck.glare);
  M.led = new THREE.MeshStandardMaterial({ color: 0x3a0804, emissive: new THREE.Color(LOOK.display.lampPlay), emissiveIntensity: LOOK.deck.lamp.power, roughness: 0.25 });
  M.contact = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: tex(softEllipseCanvas(256, 128, 0.25), { srgb: false }), transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false });

  // ======================================================================
  // geometry helpers
  // ======================================================================
  function rectShape(x0, y0, x1, y1, r = 0, path = new THREE.Shape()) {
    if (r <= 0) {
      path.moveTo(x0, y0); path.lineTo(x1, y0); path.lineTo(x1, y1); path.lineTo(x0, y1); path.lineTo(x0, y0);
      return path;
    }
    path.moveTo(x0 + r, y0); path.lineTo(x1 - r, y0); path.quadraticCurveTo(x1, y0, x1, y0 + r);
    path.lineTo(x1, y1 - r); path.quadraticCurveTo(x1, y1, x1 - r, y1);
    path.lineTo(x0 + r, y1); path.quadraticCurveTo(x0, y1, x0, y1 - r);
    path.lineTo(x0, y0 + r); path.quadraticCurveTo(x0, y0, x0 + r, y0);
    return path;
  }
  const rectHole = (x0, y0, x1, y1, r = 0) => rectShape(x0, y0, x1, y1, r, new THREE.Path());
  const circleHole = (x, y, r) => { const p = new THREE.Path(); p.absarc(x, y, r, 0, Math.PI * 2, true); return p; };
  // uv = panel position (x / 44, y / 14); walls get a z term so their tangent frame is never degenerate
  function panelUV(g) {
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + 22, y = p.getY(i), z = p.getZ(i);
      uv.setXY(i, x / 44 + z * 0.02, y / 14 + z * 0.02);
    }
    uv.needsUpdate = true;
  }
  // extrude a panel-space shape so its front face sits at zFront
  function panelExtrude(shape, depth, bevel, zFront, segs = 2) {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.002, depth - 2 * bevel), curveSegments: 24,
      bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: segs,
    });
    g.computeBoundingBox();
    g.translate(-22, 0, zFront - g.boundingBox.max.z);
    panelUV(g);
    return g;
  }
  function add(geo, mat, parent = stat, { cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = receive;
    parent.add(m);
    return m;
  }
  function planeAt(w, h, mat, x, y, z, parent = stat) {
    const m = add(new THREE.PlaneGeometry(w, h), mat, parent, { cast: false });
    m.position.set(X(x), y, z);
    return m;
  }

  // ======================================================================
  // the body
  // ======================================================================
  // fascia: one slab with every aperture cut out
  {
    const s = rectShape(0, 0, 44, 14);
    const g = 0.12;
    s.holes.push(rectHole(DOOR.x0 - g, DOOR.y0 - g, DOOR.x1 + g, DOOR.y1 + g));
    s.holes.push(rectHole(BAR.x0 - g, BAR.y0 - 0.06, BAR.x1 + g, BAR.y1 + g));
    s.holes.push(rectHole(DIAL.x0, DIAL.y0, DIAL.x1, DIAL.y1));
    s.holes.push(rectHole(TRANS.x0, TRANS.y0, TRANS.x1, TRANS.y1));
    const E = KEYS.eject;
    s.holes.push(rectHole(E.x - E.w / 2 - GAP, E.y - E.h / 2 - GAP, E.x + E.w / 2 + GAP, E.y + E.h / 2 + GAP));
    s.holes.push(rectHole(1.4 - GAP, 6.0 - GAP, 3.8 + GAP, 8.2 + GAP)); // power
    s.holes.push(circleHole(2.6, 2.6, 0.5));                              // phones
    for (const x of [30.4, 32.6]) {
      s.holes.push(circleHole(x, 2.6, 0.42));                             // mic jacks
      s.holes.push(rectHole(x - 0.8 - 0.05, 5.3 - 0.3 - 0.05, x + 0.8 + 0.05, 5.3 + 0.3 + 0.05)); // NR keys
    }
    add(panelExtrude(s, 0.3, 0.04, 0), M.alu);
  }
  // black slot liners behind every key opening
  function slotBack(x0, y0, x1, y1, z) {
    const m = add(new THREE.PlaneGeometry(x1 - x0, y1 - y0), M.slot, stat, { cast: false });
    m.position.set(X((x0 + x1) / 2), (y0 + y1) / 2, z);
    return m;
  }
  slotBack(1.2, 9.4, 4.0, 11.0, -0.31);
  slotBack(1.2, 5.8, 4.0, 8.4, -0.31);
  for (const x of [30.4, 32.6]) slotBack(x - 0.95, 4.9, x + 0.95, 5.7, -0.31);

  // transport sub-panel, recessed 0.1, with its own finer brushing
  {
    const s = rectShape(TRANS.x0, TRANS.y0, TRANS.x1, TRANS.y1);
    for (const a of ["rewind", "forward", "flip", "play", "stop"]) {
      const k = KEYS[a];
      s.holes.push(rectHole(k.x - k.w / 2 - GAP, k.y - k.h / 2 - GAP, k.x + k.w / 2 + GAP, k.y + k.h / 2 + GAP, 0.04));
      slotBack(k.x - k.w / 2 - 0.2, k.y - k.h / 2 - 0.2, k.x + k.w / 2 + 0.2, k.y + k.h / 2 + 0.2, -0.32);
    }
    add(panelExtrude(s, 0.2, 0.02, -0.1, 1), M.sub);
  }

  // top cover (U wrap), the dark inner frame gap, chassis, feet
  {
    // the cover is one folded sheet: a flat top, two sides and rounded bends between them, so
    // its shoulders catch a soft highlight instead of reading as a 1 px line
    {
      const o = 22.08, top = 14.3, th = 0.08, R = 0.38, L = 28.15, zc = 0.15 - L / 2;
      const plate = add(new RoundedBoxGeometry(2 * (o - R), th, L, 2, 0.03), M.top);
      plate.position.set(0, top - th / 2, zc);
      for (const sx of [-1, 1]) {
        const side = add(new RoundedBoxGeometry(th, top - R, L, 2, 0.03), M.top);
        side.position.set(sx * (o - th / 2), (top - R) / 2, zc);
        // the bend: a quarter tube along z (outer skin; the inside is never seen)
        const bend = new THREE.CylinderGeometry(R, R, L, 14, 1, true, sx > 0 ? Math.PI / 2 : Math.PI, Math.PI / 2);
        bend.rotateX(Math.PI / 2);
        // the bends: rougher and dimmer in the env, so the overhead soft box never flashes along
        // the shoulders into a bloom streak
        const bm = add(bend, M.topBend);
        bm.position.set(sx * (o - R), top - R, zc);
      }
    }
    // Phillips screws holding the cover, on the sides near the front and the back
    {
      const head = new THREE.LatheGeometry([[0, 0.075], [0.12, 0.07], [0.2, 0.04], [0.23, 0.0]].map(([r, h]) => new THREE.Vector2(r, h)), 24);
      head.rotateZ(-Math.PI / 2);                    // axis along +x
      const slotA = new THREE.BoxGeometry(0.02, 0.26, 0.045), slotB = new THREE.BoxGeometry(0.02, 0.045, 0.26);
      M.screw = M.screw || noBloom(new THREE.MeshStandardMaterial({ color: 0xb9b5ad, metalness: 1, roughness: 0.3 }));
      for (const sx of [-1, 1]) for (const z of [-1.3, -26.6]) for (const y of [2.2, 12.2]) {
        const hm = add(head, M.screw, stat, { cast: false });
        hm.rotation.y = sx < 0 ? Math.PI : 0; hm.position.set(sx * 22.08, y, z);
        for (const sg of [slotA, slotB]) {
          const sm = add(sg, M.slot, stat, { cast: false });
          sm.position.set(sx * 22.15, y, z);
        }
      }
    }
    const lip = add(new THREE.BoxGeometry(44.0, 0.22, 0.4), M.inner, stat, { cast: false });
    lip.position.set(0, 14.11, -0.25);
    // the chassis starts behind the deepest display and the cassette well
    const chassis = add(new THREE.BoxGeometry(43.8, 14.0, 23.0), M.inner);
    chassis.position.set(0, 7.0, -5.0 - 23.0 / 2);
    const footGeo = new THREE.CylinderGeometry(1.6, 1.7, 1.0, 32);
    for (const x of [-19.5, 19.5]) for (const z of [-2.5, -25.5]) {
      const f = add(footGeo, M.rubber);
      f.position.set(x, -0.5, z);
    }
  }

  // ---------- left column: eject, power, LED, phones ----------
  const keyCapGeo = new Map();
  function capGeo(w, h) {
    const k = `${w}x${h}`;
    if (!keyCapGeo.has(k)) {
      // nearly square edges: a flat bar with a fine radius that catches one bright line
      const g = new RoundedBoxGeometry(w, h, KEY_DEPTH, 2, 0.03);
      g.translate(0, 0, -KEY_DEPTH / 2);
      keyCapGeo.set(k, g);
    }
    return keyCapGeo.get(k);
  }
  {
    const power = add(capGeo(2.4, 2.2), M.keySmall);
    power.position.set(X(2.6), 7.1, Z_LATCH);
    // the power symbol printed on the cap
    {
      const [pc, pg] = makeCanvas(128, 128);
      pg.strokeStyle = "rgba(24,23,21,0.88)"; pg.lineWidth = 7; pg.lineCap = "round";
      pg.beginPath(); pg.arc(64, 68, 30, -Math.PI / 2 + 0.75, -Math.PI / 2 - 0.75 + Math.PI * 2); pg.stroke();
      pg.beginPath(); pg.moveTo(64, 26); pg.lineTo(64, 66); pg.stroke();
      const pm = add(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshLambertMaterial({ map: tex(pc), transparent: true, depthWrite: false }), stat, { cast: false });
      pm.position.set(X(2.6), 7.1, Z_LATCH + 0.002);
    }
    // pilot LED with a chrome bezel
    const bez = add(new THREE.TorusGeometry(0.19, 0.05, 10, 28), M.chrome, stat, { cast: false });
    bez.position.set(X(4.4), 7.9, 0.04);
    const led = add(new THREE.SphereGeometry(0.14, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.led, stat, { cast: false });
    led.rotation.x = Math.PI / 2;
    led.position.set(X(4.4), 7.9, 0.0);
  }
  function jack(x, y, outer, bore) {
    const prof = [[bore + 0.02, -0.02], [outer - 0.05, 0.0], [outer, 0.07], [outer - 0.06, 0.13], [bore + 0.08, 0.12], [bore, 0.05]]
      .map(([r, z]) => new THREE.Vector2(r, z));
    const ring = new THREE.LatheGeometry(prof, 48);
    ring.rotateX(Math.PI / 2);
    const r = add(ring, M.chrome, stat, { cast: false });
    r.position.set(X(x), y, 0);
    const ins = add(new THREE.RingGeometry(bore, outer - 0.03, 40), M.insert, stat, { cast: false });
    ins.position.set(X(x), y, -0.05);
    const tube = add(new THREE.CylinderGeometry(bore, bore, 0.9, 32, 1, true), M.bore || (M.bore = new THREE.MeshStandardMaterial({ color: 0x0a0908, roughness: 0.6, side: THREE.BackSide })), stat, { cast: false });
    tube.rotation.x = Math.PI / 2;
    tube.position.set(X(x), y, -0.5);
    const floor = add(new THREE.CircleGeometry(bore, 24), M.slot, stat, { cast: false });
    floor.position.set(X(x), y, -0.94);
  }
  jack(2.6, 2.6, 0.65, 0.31);
  jack(30.4, 2.6, 0.55, 0.28);
  jack(32.6, 2.6, 0.55, 0.28);

  // ---------- function block: NR push keys, tape select, output level ----------
  M.keyNR = keyMat(1.6, 0.6);
  for (const x of [30.4, 32.6]) {
    const k = add(capGeo(1.6, 0.6), M.keyNR);
    k.position.set(X(x), 5.3, x < 31 ? 0.16 : 0.06);
  }
  function knob(x, y, r, depth, { pointer = false } = {}) {
    const g = new THREE.Group();
    g.position.set(X(x), y, 0);
    stat.add(g);
    // collar (dark gap ring on the panel)
    const col = add(new THREE.RingGeometry(r * 0.98, r * 1.08, 64), M.slot, g, { cast: false });
    col.position.z = 0.003;
    const skirt = new THREE.LatheGeometry([[r * 0.97, 0.0], [r, 0.06], [r, depth - 0.16]].map(([a, b]) => new THREE.Vector2(a, b)), 72);
    // lathe goes around +Y; after the turn its axis is +Z (toward the viewer)
    skirt.rotateX(Math.PI / 2);
    add(skirt, M.knobSkirt, g);
    const cham = new THREE.LatheGeometry([[r, depth - 0.16], [r - 0.06, depth - 0.03], [r - 0.14, depth]].map(([a, b]) => new THREE.Vector2(a, b)), 72);
    cham.rotateX(Math.PI / 2);
    add(cham, M.knobChamfer, g);
    const face = add(new THREE.CircleGeometry(r - 0.14, 72), M.knobFace, g);
    face.position.z = depth;
    if (pointer) {
      const bar = add(new RoundedBoxGeometry(0.32, r * 1.55, 0.3, 2, 0.06), M.pointer, g);
      bar.position.set(0, 0, depth + 0.1);
    } else {
      const dot = add(new THREE.CircleGeometry(0.09, 20), M.slot, g, { cast: false });
      dot.position.set(Math.sin(40 * DEG) * (r - 0.45), Math.cos(40 * DEG) * (r - 0.45), depth + 0.003);
    }
    return g;
  }
  knob(35.6, 3.4, 1.0, 1.25, { pointer: true });
  knob(40.4, 3.6, 2.1, 2.2);

  // ---------- display bar: smoked acrylic, dark frame gap, printed backplate ----------
  {
    const s = new THREE.Shape();
    rectShape(BAR.x0 - 0.12, BAR.y0 - 0.06, BAR.x1 + 0.12, BAR.y1 + 0.12, 0, s);
    s.holes.push(rectHole(BAR.x0, BAR.y0, BAR.x1, BAR.y1));
    const ring = new THREE.ExtrudeGeometry(s, { depth: 0.66, bevelEnabled: false });
    ring.translate(-22, 0, -0.35);
    add(ring, M.inner, stat, { cast: false });
    // a raised dark anodised frame around the window: its bevel catches a thin line of light
    {
      // four bevelled bars (one extruded ring triangulates badly this close to its hole)
      M.bezel = new THREE.MeshStandardMaterial({ color: LOOK.mat.bezel, roughness: 0.3, metalness: 0.7 });
      const ox0 = BAR.x0 - 0.22, ox1 = BAR.x1 + 0.32, oy0 = BAR.y0 - 0.14, oy1 = BAR.y1 + 0.32;
      const ix0 = BAR.x0 - 0.12, ix1 = BAR.x1 + 0.12, iy0 = BAR.y0 - 0.06, iy1 = BAR.y1 + 0.12;
      const bar = (x0, x1, y0, y1) => {
        const m = add(new RoundedBoxGeometry(x1 - x0, y1 - y0, 0.13, 2, Math.min(0.04, (y1 - y0) / 2 - 0.001, (x1 - x0) / 2 - 0.001)), M.bezel, stat, { cast: false });
        m.position.set(X((x0 + x1) / 2), (y0 + y1) / 2, 0.12 - 0.065);
      };
      bar(ox0, ox1, iy1, oy1); bar(ox0, ox1, oy0, iy0);
      bar(ox0, ix0, iy0, iy1); bar(ix1, ox1, iy0, iy1);
    }
    // backplate with a cut-out per display
    const b = rectShape(BAR.x0, BAR.y0, BAR.x1, BAR.y1);
    for (const k of ["counter", "led", "lamps", "modes", "vuL", "vuR", "vfd"]) {
      const [cx, cy] = MOUNT[k], { w, h } = SIZES[k];
      b.holes.push(rectHole(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2));
    }
    const bg = new THREE.ShapeGeometry(b, 4);
    const p = bg.attributes.position, uv = bg.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - BAR.x0) / (BAR.x1 - BAR.x0), (p.getY(i) - BAR.y0) / (BAR.y1 - BAR.y0));
    bg.translate(-22, 0, -0.35);
    const [bcv, bgx] = makeCanvas(2176, 577);
    drawBackplate(bcv, bgx);
    M.backplate.map = tex(bcv);
    add(bg, M.backplate, stat, { cast: false });
    // what lies behind the cut-outs: a black box, so nothing of the chassis shows
    const back = add(new THREE.PlaneGeometry(BAR.x1 - BAR.x0, BAR.y1 - BAR.y0), M.slot, stat, { cast: false });
    back.position.set(X((BAR.x0 + BAR.x1) / 2), (BAR.y0 + BAR.y1) / 2, -1.9);
    // acrylic: back face darkens, front face reflects, glare on top
    const w = BAR.x1 - BAR.x0, h = BAR.y1 - BAR.y0, cx = X((BAR.x0 + BAR.x1) / 2), cy = (BAR.y0 + BAR.y1) / 2;
    const bk = add(new THREE.PlaneGeometry(w, h), M.smokeBack, stat, { cast: false, receive: false });
    bk.position.set(cx, cy, 0.05); bk.renderOrder = 3;
    const fr = add(new THREE.PlaneGeometry(w, h), M.smoke, stat, { cast: false, receive: false });
    fr.position.set(cx, cy, 0.35); fr.renderOrder = 4;
    const gl = add(new THREE.PlaneGeometry(w, h), M.glareBar, stat, { cast: false, receive: false });
    gl.position.set(cx, cy, 0.352); gl.renderOrder = 5;
    // the acrylic's edges: a thin bright rim where the slab meets the frame
    const edge = add(new THREE.BoxGeometry(w, 0.3, 0.02), M.smoke, stat, { cast: false, receive: false });
    edge.position.set(cx, BAR.y0 + 0.01, 0.2); edge.rotation.x = Math.PI / 2; edge.renderOrder = 4;
  }

  // ---------- station dial bezel ----------
  {
    const s = rectShape(DIAL.x0, DIAL.y0, DIAL.x1, DIAL.y1);
    s.holes.push(rectHole(DIAL.x0 + 0.15, DIAL.y0 + 0.15, DIAL.x1 - 0.15, DIAL.y1 - 0.15));
    add(panelExtrude(s, 0.3, 0.05, 0.0), M.chrome, stat, { cast: false });
    const back = add(new THREE.PlaneGeometry(DIAL.x1 - DIAL.x0, DIAL.y1 - DIAL.y0), M.slot, stat, { cast: false });
    back.position.set(X((DIAL.x0 + DIAL.x1) / 2), (DIAL.y0 + DIAL.y1) / 2, -1.1);
    // the dial's own walls between bezel and mount
    const wall = new THREE.Shape();
    rectShape(DIAL.x0 + 0.1, DIAL.y0 + 0.1, DIAL.x1 - 0.1, DIAL.y1 - 0.1, 0, wall);
    wall.holes.push(rectHole(DIAL.x0 + 0.16, DIAL.y0 + 0.16, DIAL.x1 - 0.16, DIAL.y1 - 0.16));
    const wg = new THREE.ExtrudeGeometry(wall, { depth: 1.0, bevelEnabled: false });
    wg.translate(-22, 0, -1.1);
    add(wg, M.inner, stat, { cast: false });
    const gw = DIAL.x1 - DIAL.x0 - 0.3, gh = DIAL.y1 - DIAL.y0 - 0.3;
    const gf = add(new THREE.PlaneGeometry(gw, gh), M.smoke.clone(), stat, { cast: false, receive: false });
    // a darker cover glass: the backlit scale glows against it instead of reading as paper
    gf.material.opacity = 0.26;
    gf.position.set(X((DIAL.x0 + DIAL.x1) / 2), (DIAL.y0 + DIAL.y1) / 2, -0.02); gf.renderOrder = 4;
    const gg = add(new THREE.PlaneGeometry(gw, gh), M.glareDial, stat, { cast: false, receive: false });
    gg.position.set(X((DIAL.x0 + DIAL.x1) / 2), (DIAL.y0 + DIAL.y1) / 2, -0.018); gg.renderOrder = 5;
  }

  // ---------- compartment behind the door ----------
  const spindles = [];
  let lamp;
  {
    const wx0 = DOOR.x0 - 0.1, wx1 = DOOR.x1 + 0.1, wy0 = DOOR.y0 - 0.1, wy1 = DOOR.y1 + 0.1;
    const well = add(new THREE.BoxGeometry(wx1 - wx0, wy1 - wy0, 4.2), M.well, stat, { cast: false });
    well.position.set(X((wx0 + wx1) / 2), (wy0 + wy1) / 2, -0.3 - 2.1);
    const carriage = add(new RoundedBoxGeometry(12.6, 7.6, 0.3, 2, 0.1), M.carriage, stat, { cast: false });
    carriage.position.set(X(SEAT.x), 9.3, -4.3);
    // the carriage's back plate: moulded guide legends and ribs, dark grey on black (what an
    // empty transport shows through the window)
    {
      const [cv, g] = makeCanvas(1024, 512);
      g.fillStyle = "#1e1c1a"; g.fillRect(0, 0, 1024, 512);
      const ink = "#55504a";
      g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = 3;
      g.font = `600 30px ${LOOK.font.panel}`; g.textAlign = "center"; g.textBaseline = "middle";
      if ("letterSpacing" in g) g.letterSpacing = "6px";
      g.fillText("TYPE I · II · IV", 512, 92);
      // a hollow insert arrow pointing down, and moulded ribs either side
      g.beginPath(); g.moveTo(492, 150); g.lineTo(532, 150); g.lineTo(532, 196); g.lineTo(552, 196); g.lineTo(512, 236); g.lineTo(472, 196); g.lineTo(492, 196); g.closePath(); g.stroke();
      g.lineWidth = 4;
      for (const x of [150, 874]) for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(x - 60, 140 + i * 44); g.lineTo(x + 60, 140 + i * 44); g.stroke(); }
      const pm = new THREE.MeshStandardMaterial({ color: 0xb0aaa2, roughness: 0.6, metalness: 0, map: tex(cv) });
      const plate = add(new THREE.PlaneGeometry(12.0, 6.0), pm, stat, { cast: false });
      plate.position.set(X(SEAT.x), 9.9, -4.14);
    }
    // two drive spindles at the hub positions: black moulded reel tables with six small drive
    // teeth, so an empty well recedes instead of showing two white discs
    M.reelTable = new THREE.MeshStandardMaterial({ color: 0x141312, roughness: 0.45, metalness: 0.1 });
    M.reelTooth = new THREE.MeshStandardMaterial({ color: 0x232120, roughness: 0.4, metalness: 0.2 });
    for (const sx of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(X(SEAT.x + sx * CAS.hubX), SEAT.y + CAS.hubY, -4.15);
      root.add(g);
      const flange = add(new THREE.CylinderGeometry(0.72, 0.78, 0.25, 40), M.reelTable, g, { cast: false });
      flange.rotation.x = Math.PI / 2; flange.position.z = 0.12;
      const ring = add(new THREE.TorusGeometry(0.66, 0.03, 8, 40), M.chrome, g, { cast: false });
      ring.position.z = 0.26;
      const shaft = add(new THREE.CylinderGeometry(0.3, 0.3, 3.0, 24), M.reelTable, g, { cast: false });
      shaft.rotation.x = Math.PI / 2; shaft.position.z = 1.6;
      const spin = new THREE.Group();
      g.add(spin);
      for (let i = 0; i < 6; i++) {
        const tooth = add(new THREE.BoxGeometry(0.1, 0.22, 1.1), M.reelTooth, spin, { cast: false });
        const a = (i / 6) * Math.PI * 2;
        tooth.position.set(Math.cos(a) * 0.36, Math.sin(a) * 0.36, 2.5);
        tooth.rotation.z = a + Math.PI / 2;
      }
      spindles.push(spin);
    }
    // heads, capstan and pinch roller (seen with the door open or the deck empty)
    const head = add(new RoundedBoxGeometry(1.3, 0.55, 1.4, 2, 0.12), M.chrome, stat, { cast: false });
    head.position.set(X(SEAT.x), 6.55, -1.6);
    const erase = add(new RoundedBoxGeometry(0.8, 0.5, 1.2, 2, 0.1), M.chrome, stat, { cast: false });
    erase.position.set(X(SEAT.x - 2.3), 6.55, -1.7);
    const capstan = add(new THREE.CylinderGeometry(0.1, 0.1, 2.2, 16), M.chrome, stat, { cast: false });
    capstan.rotation.x = Math.PI / 2; capstan.position.set(X(SEAT.x + 2.9), 6.6, -2.0);
    const pinch = add(new THREE.CylinderGeometry(0.32, 0.32, 0.9, 28), M.rubber, stat, { cast: false });
    pinch.rotation.x = Math.PI / 2; pinch.position.set(X(SEAT.x + 3.6), 6.55, -1.6);
    lamp = new THREE.PointLight(LOOK.light.compartment, 0, 14, 2);
    lamp.position.set(X(SEAT.x), 13.0, -1.2);
    root.add(lamp);
  }

  // ---------- the door (hinged at Y = 4.0, Z = 0) ----------
  const door = new THREE.Group();
  door.position.set(0, DOOR.y0, 0);
  root.add(door);
  const holder = new THREE.Group();
  door.add(holder);
  {
    // an assembled part: the window frame above, the printed plate below, a dark seam between
    const SPLIT = 6.72;
    const s = rectShape(DOOR.x0, SPLIT + 0.03, DOOR.x1, DOOR.y1);
    s.holes.push(rectHole(WIN.x0 - 0.2, WIN.y0 - 0.2, WIN.x1 + 0.2, WIN.y1 + 0.2));
    const g = panelExtrude(s, DOOR.t, 0.05, DOOR.front);
    g.translate(0, -DOOR.y0, 0);
    add(g, M.door, door);
    const lp = panelExtrude(rectShape(DOOR.x0, DOOR.y0, DOOR.x1, SPLIT - 0.03), DOOR.t, 0.05, DOOR.front - 0.02);
    lp.translate(0, -DOOR.y0, 0);
    add(lp, M.door, door);
    const seam = add(new THREE.PlaneGeometry(DOOR.x1 - DOOR.x0, 0.2), M.slot, door, { cast: false });
    seam.position.set(X((DOOR.x0 + DOOR.x1) / 2), SPLIT - DOOR.y0, DOOR.front - DOOR.t + 0.05);
    // chamfered window frame: catches a bright line on its bevel
    const f = rectShape(WIN.x0 - 0.2, WIN.y0 - 0.2, WIN.x1 + 0.2, WIN.y1 + 0.2);
    f.holes.push(rectHole(WIN.x0, WIN.y0, WIN.x1, WIN.y1));
    const fg = panelExtrude(f, 0.36, 0.07, DOOR.front - 0.02, 1);
    fg.translate(0, -DOOR.y0, 0);
    add(fg, M.door, door);
    const ww = WIN.x1 - WIN.x0, wh = WIN.y1 - WIN.y0, cx = X((WIN.x0 + WIN.x1) / 2), cy = (WIN.y0 + WIN.y1) / 2 - DOOR.y0;
    const bk = add(new THREE.PlaneGeometry(ww, wh), M.smokeBack, door, { cast: false, receive: false });
    bk.position.set(cx, cy, -0.2); bk.renderOrder = 3;
    // tape-remaining scale printed on the inside of the glass
    const [pc, pg] = makeCanvas(1024, 64);
    drawTapeScale(pg, 1024, 64);
    const pm = new THREE.MeshBasicMaterial({ map: tex(pc), transparent: true, depthWrite: false, color: new THREE.Color(0.6, 0.6, 0.6) });
    const pr = add(new THREE.PlaneGeometry(5.0, 0.3125), pm, door, { cast: false, receive: false });
    pr.position.set(X(12.7), 7.47 - DOOR.y0, -0.19); pr.renderOrder = 4;
    const fr = add(new THREE.PlaneGeometry(ww, wh), M.smokeDoor, door, { cast: false, receive: false });
    fr.position.set(cx, cy, 0.12); fr.renderOrder = 5;
    const gl = add(new THREE.PlaneGeometry(ww, wh), M.glare, door, { cast: false, receive: false });
    gl.position.set(cx, cy, 0.125); gl.renderOrder = 6;
    // cassette holder: two dark side rails and a floor ledge behind the window
    const rail = new RoundedBoxGeometry(0.5, 7.2, 1.6, 2, 0.08);
    for (const sx of [-1, 1]) {
      const r = add(rail, M.holder, holder, { cast: false });
      r.position.set(X(SEAT.x + sx * 5.28), SEAT.y - DOOR.y0 - 0.1, SEAT.z);
    }
    const ledge = add(new RoundedBoxGeometry(11.0, 0.3, 1.6, 2, 0.08), M.holder, holder, { cast: false });
    ledge.position.set(X(SEAT.x), SEAT.y - DOOR.y0 - 3.38, SEAT.z);
  }

  // ---------- transport keys + eject ----------
  const keys = KEY_ORDER.map((action) => {
    const k = KEYS[action];
    const group = new THREE.Group();
    group.position.set(X(k.x), k.y, Z_REST);
    root.add(group);
    // each cap has its own material (world-scale brushing for its size), so a latched key can
    // also go a shade darker (it sinks out of the light)
    const capMat = keyMat(k.w, k.h);
    add(capGeo(k.w, k.h), capMat, group);
    // printed glyph on the cap
    const gw = Math.round(k.w * 120), gh = Math.round(k.h * 120);
    const [gc, gg] = makeCanvas(Math.min(gw, 512), gh);
    drawGlyph(gg, gc.width, gc.height, action);
    // printed ink is matte and diffuse: Lambert, so it never picks up the env sheen of the metal
    const glyph = add(new THREE.PlaneGeometry(Math.min(k.w, 512 / 120), k.h), new THREE.MeshLambertMaterial({ map: tex(gc), transparent: true, depthWrite: false }), group, { cast: false });
    glyph.position.set(0, 0, 0.002);
    // the legend above the cap's left end (redrawn on language change): the transport keys carry
    // theirs white on a black anodised strip, as the M226's dark legend bands; eject is printed
    // on the fascia itself
    const lw = Math.round(Math.max(2.4, k.w) * 240), lh = 100;
    const [lc, lg] = makeCanvas(lw, lh);
    const ltex = tex(lc);
    const lmat = new THREE.MeshLambertMaterial({ map: ltex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const lgeo = new THREE.PlaneGeometry(Math.max(2.4, k.w), 0.42);
    const lmesh = add(lgeo, lmat, root, { cast: false });
    const zSurf = action === "eject" ? 0.002 : -0.098;
    lmesh.position.set(X(k.x - k.w / 2 + Math.max(2.4, k.w) / 2), k.y + k.h / 2 + 0.31, zSurf);
    // green rules over the tape-moving keys, as printed on the M226
    const rule = action === "rewind" || action === "forward" || action === "play" ? LOOK.mat.ruleGreen : null;
    return { action, group, capMat, base: capMat.color.clone(), z: Z_REST, target: Z_REST, tap: 0, lcv: lc, lg, ltex, label: "", rule, band: action !== "eject", w: k.w, h: k.h, x: k.x, y: k.y };
  });
  const keyByAction = Object.fromEntries(keys.map((k) => [k.action, k]));
  function setLegend(k, text) {
    if (k.label === text) return;
    k.label = text;
    drawLegend(k.lg, k.lcv.width, k.lcv.height, text, { rule: k.rule ? "#" + new THREE.Color(k.rule).getHexString() : null, band: k.band });
    k.ltex.needsUpdate = true;
    dirty = true;
  }
  for (const k of keys) setLegend(k, k.action === "flip" ? "side B" : k.action === "forward" ? "forward" : k.action);

  // ---------- the cassette ----------
  const cas = createCassette({ THREE, tex, physical, envMap: glassEnv });
  cas.group.visible = false;
  holder.add(cas.group);
  cas.onLabel(() => { dirty = true; });
  const SEAT_LOCAL = new THREE.Vector3(X(SEAT.x), SEAT.y - DOOR.y0, SEAT.z);

  // ---------- the room: a seamless sweep and the contact shadows (§D2.5) ----------
  const room = new THREE.Group();
  root.add(room);
  // the sweep's uniforms: the ground (= the page), the falloff to it, the warm pool on the wall
  const sweepU = {
    uGround: { value: new THREE.Vector3(groundRGB[0], groundRGB[1], groundRGB[2]) },
    uPool: { value: new THREE.Vector3(...G.pool) },
    // the falloff to the page: a wide, very soft ellipse in screen space (device px: centre,
    // radii), set by fit() from the full view. Screen-aligned, so the cove's crease can never
    // cut a wedge out of it
    uFallPx: { value: new THREE.Vector4(0, 0, 1, 1) },
    uR0: { value: G.fall.r0 },
    uPoolC: { value: new THREE.Vector4(G.pool_c[0], G.pool_c[1], G.pool_r[0], G.pool_r[1]) },
    // the full view's rectangle in device pixels, and the guard band (px) along its edges in
    // which the sweep is forced to the ground, whatever the slot's aspect
    uView: { value: new THREE.Vector4(0, 0, 1, 1) },
    uGuard: { value: new THREE.Vector2(4, 24) },
  };
  {
    // profile in YZ, s = arc length in cm from the front edge: the floor at Y = -1 from Z = +40
    // to Z = -34, a 30 cm cove, then the wall at Z = -64 up to Y = +110
    const FLOOR = 74, COVE_R = 30, COVE = Math.PI / 2 * COVE_R, WALL = 110 - (29);
    const LEN = FLOOR + COVE + WALL;
    const geo = new THREE.PlaneGeometry(320, LEN, 1, 64);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), sArc = pos.getY(i) + LEN / 2;
      let y, z;
      if (sArc <= FLOOR) { y = -1; z = 40 - sArc; }
      else if (sArc <= FLOOR + COVE) { const th = (sArc - FLOOR) / COVE_R; y = 29 - COVE_R * Math.cos(th); z = -34 - COVE_R * Math.sin(th); }
      else { y = 29 + (sArc - FLOOR - COVE); z = -64; }
      pos.setXYZ(i, x, y, z);
      uv.setXY(i, x, sArc);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: G.sweep, roughness: G.sweepRough, metalness: 0, envMapIntensity: G.sweepEnv });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, sweepU);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vSw;")
        .replace("#include <uv_vertex>", "#include <uv_vertex>\nvSw = uv;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", `#include <common>
          varying vec2 vSw;
          uniform vec3 uGround, uPool; uniform vec4 uFallPx, uPoolC, uView; uniform float uR0; uniform vec2 uGuard;`)
        .replace("#include <tonemapping_fragment>", `{
          // linear HDR, before tone mapping: beyond the ellipse the sweep IS the ground
          float f = 1.0 - smoothstep(uR0, 1.0, length((gl_FragCoord.xy - uFallPx.xy) / uFallPx.zw));
          f *= f * (3.0 - 2.0 * f);
          vec2 px = gl_FragCoord.xy - uView.xy;
          vec2 e = min(px, uView.zw - px);
          float guard = smoothstep(uGuard.x, uGuard.y, min(e.x, e.y));
          vec2 q = (vSw - uPoolC.xy) / uPoolC.zw;
          gl_FragColor.rgb = mix(uGround, gl_FragColor.rgb + uPool * exp(-dot(q, q)), f * guard);
        }
        #include <tonemapping_fragment>`);
    };
    mat.customProgramCacheKey = () => "caset-sweep";
    add(geo, mat, room, { cast: false, receive: true });
    const c1 = add(new THREE.PlaneGeometry(56, 40), M.contact, room, { cast: false, receive: false });
    c1.rotation.x = -Math.PI / 2; c1.position.set(0, -0.995, -13.5); c1.renderOrder = 1;
    // the soft contact shade along the front: wide and deep enough to read as the deck resting
    // on the floor, with no hard strip
    const c2mat = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: tex(softEllipseCanvas(256, 64, 0.4), { srgb: false }), transparent: true, opacity: 0.72, depthWrite: false, toneMapped: false });
    const c2 = add(new THREE.PlaneGeometry(52, 10), c2mat, room, { cast: false, receive: false });
    c2.rotation.x = -Math.PI / 2; c2.position.set(0, -0.994, -2.0); c2.renderOrder = 1;
  }
  // the pool leans toward the loaded tape's colour (at swap time), easing over stage.poolMs
  const poolBase = new THREE.Vector3(...G.pool);
  const pool = { from: poolBase.clone(), to: poolBase.clone(), k: 1 };
  const poolLum = 0.2126 * G.pool[0] + 0.7152 * G.pool[1] + 0.0722 * G.pool[2];
  const cTmp = new THREE.Color();
  function poolToward(c) {
    pool.from.copy(sweepU.uPool.value);
    if (c && c.color) {
      cTmp.set(c.color); // linear working space
      const lum = 0.2126 * cTmp.r + 0.7152 * cTmp.g + 0.0722 * cTmp.b;
      const sc = lum > 1e-5 ? poolLum / lum : 0;
      pool.to.set(cTmp.r * sc, cTmp.g * sc, cTmp.b * sc).lerp(poolBase, 1 - G.poolTape);
    } else {
      pool.to.copy(poolBase);
    }
    pool.k = 0;
    if (reduceMotion || lost) { pool.k = 1; sweepU.uPool.value.copy(pool.to); }
    dirty = true;
  }
  function stepPool(dt) {
    if (pool.k >= 1) return;
    pool.k = Math.min(1, pool.k + dt * 1000 / G.poolMs);
    const k = pool.k * pool.k * (3 - 2 * pool.k);
    sweepU.uPool.value.lerpVectors(pool.from, pool.to, k);
    dirty = true;
  }

  // ---------- lights (§4.3) ----------
  const key = new THREE.DirectionalLight(LOOK.light.key, LOOK.light.keyIntensity);
  {
    const az = -35 * DEG, el = 40 * DEG;
    key.position.set(Math.sin(az) * Math.cos(el) * 60, 6 + Math.sin(el) * 60, -6 + Math.cos(az) * Math.cos(el) * 60);
    key.target.position.set(0, 6, -6);
    root.add(key.target);
    key.castShadow = true;
    const sz = tier === "high" ? 2048 : 1024;
    key.shadow.mapSize.set(sz, sz);
    key.shadow.radius = 3;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    Object.assign(key.shadow.camera, { left: -26, right: 26, top: 18, bottom: -18, near: 20, far: 110 });
    root.add(key);
  }
  root.add(new THREE.HemisphereLight(LOOK.light.fillSky, LOOK.light.fillGround, LOOK.light.fill));
  {
    const rim = new THREE.DirectionalLight(LOOK.light.rim, LOOK.light.rimIntensity);
    rim.position.set(30, 30, -40);
    root.add(rim);
  }

  mergeStatic(THREE, stat);

  // ---------- light spill: the displays' glow on the brushed metal (§3.7) ----------
  // additive planes just in front of the fascia, streaked by the brushing, below bloom
  const spill = [];
  {
    const [cv, g] = makeCanvas(512, 64);
    const grd = g.createLinearGradient(0, 0, 0, 64);
    grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.35, "rgba(255,255,255,0.4)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 512, 64);
    g.globalCompositeOperation = "destination-in";
    const side = g.createLinearGradient(0, 0, 512, 0);
    side.addColorStop(0, "rgba(0,0,0,0)"); side.addColorStop(0.12, "rgba(0,0,0,1)"); side.addColorStop(0.88, "rgba(0,0,0,1)"); side.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = side; g.fillRect(0, 0, 512, 64);
    g.globalCompositeOperation = "multiply";
    g.drawImage(brush.albedo, 0, 0, 512, 64);
    const fade = tex(cv, { mips: true });
    const S = LOOK.deck.spill;
    const make = (key, col, x0, x1, y1, h, flip = false) => {
      const mat = new THREE.MeshBasicMaterial({ map: fade, color: new THREE.Color(0, 0, 0), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
      const m = add(new THREE.PlaneGeometry(x1 - x0, h), mat, root, { cast: false, receive: false });
      m.position.set(X((x0 + x1) / 2), flip ? y1 + h / 2 : y1 - h / 2, 0.02);
      if (flip) m.rotation.z = Math.PI;
      m.renderOrder = 7;
      spill.push({ key, base: new THREE.Color(...col), mat, k: -1 });
    };
    make("vu", S.vu, 29.0, 43.4, 6.94, 1.3);
    make("vfd", S.vfd, 30.5, 42.0, 6.94, 0.9);
    make("led", S.led, 24.2, 28.6, 6.94, 0.35);
    make("dial", S.dial, 5.8, 19.6, 0.8, 0.7);
    make("dial", S.dial, 5.8, 19.6, 3.6, 0.3, true);
  }
  function updateSpill() {
    const a = displays ? displays.activity : null;
    for (const s of spill) {
      const k = (0.15 + 0.5 * (a ? a[s.key] || 0 : 0)) * 0.11;
      if (Math.abs(k - s.k) < 1e-4) continue;
      s.k = k;
      s.mat.color.copy(s.base).multiplyScalar(k);
    }
  }

  // ======================================================================
  // displays (engineer B): dynamic import; labelled placeholders until it arrives
  // ======================================================================
  let displays = null;
  const placeholders = new Map();
  for (const name of Object.keys(MOUNT)) {
    const { w, h } = SIZES[name];
    const [pc, pg] = makeCanvas(Math.round(w * 40), Math.round(h * 40));
    pg.fillStyle = "#0d0c0b"; pg.fillRect(0, 0, pc.width, pc.height);
    pg.strokeStyle = "#3a3632"; pg.lineWidth = 2; pg.strokeRect(1, 1, pc.width - 2, pc.height - 2);
    pg.fillStyle = "#5f5a52"; pg.font = `500 ${Math.min(22, pc.height * 0.4)}px ${LOOK.font.panel}`;
    pg.textAlign = "center"; pg.textBaseline = "middle";
    pg.fillText(name, pc.width / 2, pc.height / 2);
    const m = add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex(pc) }), root, { cast: false, receive: false });
    const [x, y, z] = MOUNT[name];
    m.position.set(X(x), y, z - 0.3);
    placeholders.set(name, m);
  }
  const dstate = {
    t: 0, dt: 0,
    levels: { l: 0, r: 0, pl: 0, pr: 0 },
    frac: 0, speed: 0, seconds: 0,
    mode: "stop",
    track: { index: -1, count: 0 },
    side: "A", loaded: false,
    signal: true,
  };
  let program = null;
  import("./displays.js").then((mod) => {
    if (lost || typeof mod.createDisplays !== "function") return;
    const d = mod.createDisplays({ THREE, renderer, LOOK, maxAniso });
    for (const [name, mesh] of Object.entries(d.meshes || {})) {
      if (!MOUNT[name] || !mesh) continue;
      const [x, y, z] = MOUNT[name];
      mesh.position.set(X(x), y, z);
      root.add(mesh);
      const ph = placeholders.get(name);
      if (ph) { root.remove(ph); ph.geometry.dispose(); ph.material.map?.dispose(); ph.material.dispose(); placeholders.delete(name); }
    }
    displays = d;
    d.setReduceMotion?.(reduceMotion);
    d.setCompact?.(preset === "phone");
    updatePixelScale();
    d.setProgram?.(program);
    dirty = true;
  }).catch((e) => { if (DEBUG) console.info("displays.js not mounted:", e && e.message); });

  // ======================================================================
  // state
  // ======================================================================
  let now = 0;
  let tapeIn = null;          // the cassette in the deck (seated or moving)
  let sideUp = "A";
  let loaded = false;         // seated and door shut
  let latched = null;
  let doorDeg = 0;
  let lampLevel = LOOK.deck.lamp.empty;
  let angL = 0, angR = 0, blurL = 0, blurR = 0;
  let tracks = [], offsets = [], total = 0;
  let lastFrac = -1;

  function tween(dur, fn, curve = ease.inOut) {
    return new Promise((resolve) => {
      if (reduceMotion || lost || dur <= 0) { fn(1); dirty = shadowsDirty = true; resolve(); return; }
      tweens.push({ t0: -1, dur, fn, curve, resolve });
      dirty = true;
    });
  }
  const wait = (s) => tween(s, () => {});
  function runTweens() {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      if (tw.t0 < 0) tw.t0 = now;
      const k = Math.min(1, (now - tw.t0) / tw.dur);
      tw.fn(tw.curve(k));
      if (k >= 1) { tweens.splice(i, 1); tw.resolve(); }
    }
  }

  function setDoor(deg) {
    doorDeg = deg;
    door.rotation.x = deg * DEG;
    // tilted toward the floor the silver reflects the floor bounce (look.js env.bounce) and
    // darkens a little by itself; the env is cut by at most 10 %, so it stays the same metal
    M.door.envMapIntensity = 1 - 0.1 * Math.min(1, Math.abs(deg) / DOOR.open);
  }
  function openDoor() {
    if (doorDeg >= DOOR.open - 0.01) return Promise.resolve();
    onEvent("lid");
    const a0 = doorDeg;
    return tween(0.38, (k) => setDoor(a0 + (DOOR.open - a0) * k), ease.back);
  }
  async function closeDoor() {
    const a0 = doorDeg;
    await tween(0.24, (k) => setDoor(a0 * (1 - k)), ease.in);
    setDoor(0);
    onEvent("lid-shut");
    displays?.knock?.(0.6);
    // the carriage draws the tape back, the door settles with a small bounce
    const z0 = cas.group.position.z;
    const p1 = tween(0.12, (k) => { if (cas.group.parent === holder) cas.group.position.z = z0 + (SEAT.z - z0) * k; }, ease.out);
    const p2 = tween(0.1, (k) => setDoor(-0.4 * Math.sin(k * Math.PI)), ease.lin);
    await Promise.all([p1, p2]);
    setDoor(0);
    if (tapeIn) setLoaded(true);
  }
  function setLoaded(v) { loaded = v; dirty = true; }

  function trackAt(p) {
    let i = 0;
    while (i < tracks.length - 1 && p >= offsets[i + 1] - 1e-6) i++;
    return i;
  }
  function makeProgram(c, side) {
    if (!c) { tracks = []; offsets = []; total = 0; return null; }
    tracks = c.sides[side].tracks;
    offsets = [];
    let acc = 0;
    for (const t of tracks) { offsets.push(acc); acc += Math.max(1, Number(t.dur) || 0); }
    total = acc;
    return {
      id: c.id, name: c.name, color: c.color, side, total, offsets: offsets.slice(),
      tracks: tracks.map((t) => ({ title: t.title, date: t.date || "", dur: Math.max(1, Number(t.dur) || 0) })),
    };
  }
  function setProgram(c, side) {
    program = makeProgram(c, side);
    displays?.setProgram?.(program);
    dirty = true;
  }

  // cassette poses
  const sideQ = new THREE.Quaternion();
  const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), qT = new THREE.Quaternion();
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), vD = new THREE.Vector3(), vT = new THREE.Vector3();
  const eTmp = new THREE.Euler();
  function sideQuat(side, out = sideQ) { return out.setFromEuler(eTmp.set(0, side === "B" ? Math.PI : 0, 0)); }
  function applyLook(c, side) {
    cas.setLook(c);
    poolToward(c);
    sideUp = side;
    dirty = true;
  }
  function seatInHolder(zOffset = 0) {
    holder.attach(cas.group);
    cas.group.position.copy(SEAT_LOCAL);
    cas.group.position.z += zOffset;
    cas.group.quaternion.copy(sideQuat(sideUp));
    cas.group.visible = true;
  }
  // world point of the seat, plus `up` cm along the holder's up axis and `out` cm along its
  // normal (toward the viewer)
  function seatWorld(up, out, fwd = 0) {
    door.updateMatrixWorld(true);
    out.set(SEAT_LOCAL.x, SEAT_LOCAL.y + up, SEAT_LOCAL.z + 0.3 + fwd);
    return holder.localToWorld(out);
  }
  function bezier(p0, p1, p2, p3, k, out) {
    const u = 1 - k;
    return out.set(0, 0, 0)
      .addScaledVector(p0, u * u * u).addScaledVector(p1, 3 * u * u * k)
      .addScaledVector(p2, 3 * u * k * k).addScaledVector(p3, k * k * k);
  }
  const OUT = new THREE.Vector3(X(SEAT.x), -16, 16);
  // a hand draws the tape out of the open holder: a little up, mostly toward the viewer. The
  // whole path stays below the cabinet's roof line on screen (it never seems to pass the lid)
  const PULL_UP = 2.5, PULL_OUT = 2.5;
  const vPull = new THREE.Vector3(), vBase = new THREE.Vector3();
  function pullVector(out) {
    seatWorld(0, vBase);
    return seatWorld(PULL_UP, out, PULL_OUT).sub(vBase);
  }

  // drawn out of the holder, then an arc toward the camera and down, out of the frame
  async function flyOut() {
    root.attach(cas.group);
    const p0 = cas.group.position.clone();
    const q0 = cas.group.quaternion.clone();
    pullVector(vPull);
    const pulled = p0.clone().add(vPull);
    await tween(0.24, (k) => { cas.group.position.copy(p0).addScaledVector(vPull, k); dirty = shadowsDirty = true; }, ease.out);
    onEvent("slide");
    const p1 = pulled.clone().add(vT.set(0, -0.5, 6));
    const p2 = new THREE.Vector3(X(SEAT.x) + 1, -4, 20);
    const qEnd = qT.setFromEuler(eTmp.set(0.35, 0, 14 * DEG)).multiply(sideQuat(sideUp, qB)).clone();
    await tween(0.45, (k) => {
      bezier(pulled, p1, p2, OUT, k, cas.group.position);
      cas.group.quaternion.slerpQuaternions(q0, qEnd, k);
    }, ease.in);
    cas.group.visible = false;
  }
  // rise from below the frame toward the open holder, slide in along its normal, seat with a drop
  async function flyIn() {
    root.attach(cas.group);
    cas.group.visible = true;
    const q0 = new THREE.Quaternion().setFromEuler(eTmp.set(0.35, 0, 14 * DEG)).multiply(sideQuat(sideUp, qB));
    cas.group.position.copy(OUT);
    cas.group.quaternion.copy(q0);
    onEvent("slide");
    const p1 = new THREE.Vector3(X(SEAT.x) - 1, -3, 20);
    await tween(0.56, (k) => {
      const p3 = seatWorld(0.8, vC);
      const p2 = seatWorld(PULL_UP + 0.8, vD, PULL_OUT + 2.5);
      bezier(OUT, p1, p2, p3, k, cas.group.position);
      holder.getWorldQuaternion(qA).multiply(sideQuat(sideUp, qB));
      cas.group.quaternion.slerpQuaternions(q0, qA, ease.out(k));
    }, ease.inOut);
    seatInHolder(0.3);
    cas.group.position.y += 0.8;
    const y0 = cas.group.position.y;
    await tween(0.12, (k) => { cas.group.position.y = y0 - 0.8 * k; }, ease.in);
    onEvent("drop");
    displays?.knock?.(1);
  }

  // ======================================================================
  // the contract
  // ======================================================================
  const api = {
    renderer,
    keyRects: [],
    get dirty() { return dirty; },
    set dirty(v) { dirty = !!v; },

    setCassette(c, side) {
      // instant (reduced motion): door shut, tape seated, labels applied, no events
      for (const tw of tweens.splice(0)) { tw.fn(1); tw.resolve(); }
      setDoor(0);
      if (!c) {
        tapeIn = null; cas.group.visible = false; setLoaded(false); setProgram(null); poolToward(null);
        shadowsDirty = true;
        return;
      }
      tapeIn = c;
      applyLook(c, side);
      seatInHolder(0);
      setProgram(c, side);
      setLoaded(true);
      shadowsDirty = true;
    },

    async load(c, side, swap) {
      setFocus("full");
      if (tapeIn) {
        await openDoor();
        setLoaded(false);
        await flyOut();
      } else {
        openDoor();
        await wait(0.3);
      }
      swap?.();
      tapeIn = c;
      applyLook(c, side);
      setProgram(c, side);
      await flyIn();
      await wait(0.14);
      await closeDoor();
      await wait(0.24);
    },

    async eject() {
      if (!tapeIn) return;
      setFocus("full");
      await openDoor();
      setLoaded(false);
      await flyOut();
      tapeIn = null;
      setProgram(null);
      poolToward(null);
      await wait(0.3);
      await closeDoor();
    },

    async flip(toSide, swap) {
      if (!tapeIn) { swap?.(); return; }
      setFocus("full");
      await openDoor();
      setLoaded(false);
      // drawn out of the holder toward the camera, upright, to turn in front of the open door
      // (below the cabinet's top, so it never seems to pass through the lid)
      root.attach(cas.group);
      const p0 = cas.group.position.clone();
      const q0 = cas.group.quaternion.clone();
      const pUp = seatWorld(PULL_UP, new THREE.Vector3(), PULL_OUT);
      const pOut = new THREE.Vector3(X(SEAT.x), 8.2, 12.5);
      const bump = 1;
      const qUp = sideQuat(sideUp, new THREE.Quaternion());
      onEvent("slide");
      await tween(0.3, (k) => {
        bezier(p0, pUp, vT.copy(pUp).add(vA.set(0, 0, 3)), pOut, k, cas.group.position);
        cas.group.quaternion.slerpQuaternions(q0, qUp, k);
      }, ease.inOut);
      // turn 180 degrees about its own vertical axis, tilted so light rakes the shell
      onEvent("turn");
      const from = sideUp;
      let swapped = false;
      const qTurn = new THREE.Quaternion();
      await tween(0.56, (k) => {
        eTmp.set(6 * DEG * Math.sin(k * Math.PI), (from === "B" ? Math.PI : 0) + Math.PI * k, 0);
        qTurn.setFromEuler(eTmp);
        cas.group.quaternion.copy(qTurn);
        cas.group.position.set(pOut.x, pOut.y + Math.sin(k * Math.PI) * 0.6 * bump, pOut.z + Math.sin(k * Math.PI) * 1.2 * bump);
        if (!swapped && k >= 0.5) {
          swapped = true;
          sideUp = toSide;
          swap?.();
          setProgram(tapeIn, toSide);
        }
      }, ease.inOut);
      if (!swapped) { sideUp = toSide; swap?.(); setProgram(tapeIn, toSide); }
      // back into the holder
      const p3 = cas.group.position.clone();
      const q3 = sideQuat(sideUp, new THREE.Quaternion());
      await tween(0.28, (k) => {
        const pS = seatWorld(0, vC);
        const pU = seatWorld(PULL_UP, vD, PULL_OUT);
        bezier(p3, vB.copy(pU).add(vA.set(0, 0, 3)), pU, pS, k, cas.group.position);
        holder.getWorldQuaternion(qA).multiply(q3);
        cas.group.quaternion.slerpQuaternions(qT.copy(q3), qA, k);
      }, ease.inOut);
      seatInHolder(0.3);
      onEvent("drop");
      displays?.knock?.(1);
      await wait(0.08);
      await closeDoor();
    },

    setKeyLabel(action, text) {
      const k = keyByAction[action];
      if (k) setLegend(k, text);
    },
    setFlipLabel(text) { api.setKeyLabel("flip", text); },

    setReduceMotion(v) {
      reduceMotion = !!v;
      displays?.setReduceMotion?.(reduceMotion);
      dirty = shadowsDirty = true;
    },

    setLatched(action) {
      latched = action || null;
      for (const k of keys) k.target = k.action === latched ? Z_LATCH : Z_REST;
      dirty = true;
    },

    tap(action) {
      const k = keyByAction[action];
      if (k) { k.tap = 1; dirty = true; }
    },

    setTape(f, speed, dt, seconds) {
      dstate.frac = f;
      dstate.speed = speed;
      dstate.seconds = seconds || 0;
      const rL = Math.sqrt(R_MAX * R_MAX - (R_MAX * R_MAX - R_MIN * R_MIN) * f);
      const rR = Math.sqrt(R_MIN * R_MIN + (R_MAX * R_MAX - R_MIN * R_MIN) * f);
      let bl = 0, br = 0;
      if (speed !== 0) {
        const v = 4.76 * speed;
        const wL = Math.max(-15, Math.min(15, v / rL)), wR = Math.max(-15, Math.min(15, v / rR));
        angL += wL * dt; angR += wR * dt;
        bl = Math.max(0, Math.min(1, (Math.abs(wL) - 12) / 2.5));
        br = Math.max(0, Math.min(1, (Math.abs(wR) - 12) / 2.5));
        if (reduceMotion) bl = br = 0;
        dirty = true;
      }
      if (bl !== blurL || br !== blurR) { blurL = bl; blurR = br; dirty = true; }
      if (f !== lastFrac) { lastFrac = f; dirty = true; }
      cas.setReels(rL, rR, angL, angR, sideUp === "B", blurL, blurR);
      spindles[0].rotation.z = angL;
      spindles[1].rotation.z = angR;
    },

    // optional: false while the deck plays with no programme reaching it (app.js: a missing file
    // or a stalled stream). The meters go dead and the function tube lights NO SIGNAL
    setSignal(on) {
      const v = on !== false;
      if (v !== dstate.signal) { dstate.signal = v; dirty = true; }
    },

    setLevels(lv) {
      if (!lv) return;
      const L = dstate.levels;
      L.l = +lv.l || 0; L.r = +lv.r || 0; L.pl = +lv.pl || 0; L.pr = +lv.pr || 0;
    },

    fit,
    frame,
    // optional extras (docs/ARCHITECTURE.md): the camera's framing, "full" or "meters"
    setFocus(name) { setFocus(name); },
    get focus() { return focus.name; },
  };

  // ======================================================================
  // views, camera framing, key rects (§2)
  // ======================================================================
  const fullCam = new THREE.PerspectiveCamera(20, 1, 5, 2000);
  const loupeCam = new THREE.PerspectiveCamera(12, 1, 5, 2000);
  const metersCam = new THREE.PerspectiveCamera(14, 1, 5, 2000);
  let views = [];
  let gutters = [];
  const roomColor = new THREE.Color(LOOK.room);
  // "full": the whole deck on its sweep (desk, tablet, landscape phone). "phone": the whole deck
  // as the hero, and under it a loupe on the displays and the transport (portrait phones)
  let preset = "full";
  let cssW = 1, cssH = 1, canvasLeft = 0, canvasTop = 0;
  const FIT_BOX = [];
  for (const x of [-22.4, 22.4]) for (const y of [-1.1, 14.5]) for (const z of [-2, 2.4]) FIT_BOX.push(new THREE.Vector3(x, y, z));
  // the lid's back edge: at the product angle it rises above the fascia's top in the frame
  for (const x of [-22.4, 22.4]) FIT_BOX.push(new THREE.Vector3(x, 14.4, -28));
  const AIM = new THREE.Vector3(0, 6.6, 0);
  const FULL_FOV = 14;
  // a product angle: high enough that the lid and the floor in front read, low enough that the
  // fascia stays the hero
  const FULL_EL = 10, FULL_AZ = -4;
  // the fitted box is raised this much (NDC) for more floor in front
  const FULL_RAISE = 0.04;
  // the phone's loupe: its layout in the slot (the page draws its frame and caption from the
  // --loupe-* custom properties set in fit())
  const LOUPE_GAP = 32, LOUPE_INSET = 12;

  // pointer parallax (desktop, fine pointer, motion allowed): a tiny critically damped orbit
  const parallax = { on: !coarse && matchMedia("(pointer: fine)").matches, tx: 0, ty: 0, x: 0, y: 0, vx: 0, vy: 0 };
  if (parallax.on) {
    addEventListener("pointermove", (e) => {
      if (reduceMotion || lost) return;
      parallax.tx = Math.max(-1, Math.min(1, (e.clientX / innerWidth) * 2 - 1));
      parallax.ty = Math.max(-1, Math.min(1, (e.clientY / innerHeight) * 2 - 1));
      dirty = true;
    }, { passive: true });
  }
  let fitW = 1, fitH = 1;
  const vDir = new THREE.Vector3();
  function stepParallax(dt) {
    const P = parallax;
    if (Math.abs(P.tx - P.x) < 1e-4 && Math.abs(P.ty - P.y) < 1e-4 && Math.abs(P.vx) < 1e-4 && Math.abs(P.vy) < 1e-4) return;
    // critically damped spring, settles in about 0.6 s
    const w = 10, h = Math.min(dt, 0.05);
    P.vx += (w * w * (P.tx - P.x) - 2 * w * P.vx) * h; P.x += P.vx * h;
    P.vy += (w * w * (P.ty - P.y) - 2 * w * P.vy) * h; P.y += P.vy * h;
    placeFull();
    dirty = true;
  }
  function fitFull(cam, w, h, dAz = 0, dEl = 0, fillW = 0.9, fillH = 0.82) {
    const el = (FULL_EL + dEl) * DEG, az = (FULL_AZ + dAz) * DEG;
    const dir = vDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    cam.fov = FULL_FOV; cam.aspect = w / h; cam.updateProjectionMatrix();
    let d = 150, cx = 0, cy = 0;
    for (let it = 0; it < 10; it++) {
      cam.position.copy(AIM).addScaledVector(dir, d);
      cam.lookAt(AIM);
      cam.updateMatrixWorld();
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const c of FIT_BOX) {
        vT.copy(c).project(cam);
        x0 = Math.min(x0, vT.x); x1 = Math.max(x1, vT.x); y0 = Math.min(y0, vT.y); y1 = Math.max(y1, vT.y);
      }
      cx = (x0 + x1) / 2; cy = (y0 + y1) / 2;
      // fill a share of the width or the height, whichever binds first: air around the
      // object, like a product plate
      d *= Math.max((x1 - x0) / 2 / fillW, (y1 - y0) / 2 / fillH);
    }
    cam.projectionMatrix.elements[8] = cx;
    // raised a little, so more floor shows in front for the contact shadow
    cam.projectionMatrix.elements[9] = cy - FULL_RAISE;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }
  // a region of the fascia, seen almost head-on, filling the viewport (contain, centred)
  function fitRegion(cam, region, vw, vh, fill = 1, fov = 12, el = 2) {
    const [x0, x1, y0, y1] = region;
    const rw = (x1 - x0) / fill, rh = (y1 - y0) / fill;
    const aspect = vw / vh;
    const visH = Math.max(rh, rw / aspect);
    cam.fov = fov; cam.aspect = aspect; cam.updateProjectionMatrix();
    const d = visH / 2 / Math.tan((fov / 2) * DEG);
    const c = vA.set(X((x0 + x1) / 2), (y0 + y1) / 2, 0);
    cam.position.set(c.x, c.y + Math.sin(el * DEG) * d, Math.cos(el * DEG) * d);
    cam.lookAt(c);
    cam.updateMatrixWorld();
  }

  // ---------- focus: the whole deck, or the camera eased in on the meters (desk and tablet) ----------
  const focus = { name: "full", k: 0, target: 0 };
  const fP = new THREE.Vector3(), fQ = new THREE.Quaternion();
  let fE8 = 0, fE9 = 0;
  // full framing (with parallax), then blended toward the meters framing by focus.k
  function placeFull() {
    if (preset !== "full") return;
    fitFull(fullCam, fitW, fitH, parallax.x * 0.8, -parallax.y * 0.5, FILL.w, FILL.h);
    if (focus.k <= 0) return;
    const k = ease.inOut(focus.k);
    fP.copy(fullCam.position); fQ.copy(fullCam.quaternion);
    fE8 = fullCam.projectionMatrix.elements[8]; fE9 = fullCam.projectionMatrix.elements[9];
    fullCam.position.lerpVectors(fP, metersCam.position, k);
    fullCam.quaternion.slerpQuaternions(fQ, metersCam.quaternion, k);
    fullCam.projectionMatrix.elements[8] = fE8 * (1 - k);
    fullCam.projectionMatrix.elements[9] = fE9 * (1 - k);
    fullCam.projectionMatrixInverse.copy(fullCam.projectionMatrix).invert();
    fullCam.updateMatrixWorld();
  }
  function setFocus(name) {
    const want = name === "meters" && preset === "full" ? "meters" : "full";
    if (want === focus.name) return;
    focus.name = want;
    focus.target = want === "meters" ? 1 : 0;
    if (reduceMotion || lost) { focus.k = focus.target; placeFull(); computeKeyRects(); updatePixelScale(); onEvent("keys"); }
    dirty = true;
    onEvent("focus");
  }
  function stepFocus(dt) {
    if (focus.k === focus.target) return;
    // 1.1 s, eased in placeFull
    const step = dt / 1.1;
    focus.k = focus.k < focus.target ? Math.min(focus.target, focus.k + step) : Math.max(focus.target, focus.k - step);
    placeFull();
    computeKeyRects();
    updatePixelScale();
    onEvent("keys");
    dirty = true;
  }
  // how much of the slot the full framing may fill: a wide desk slot takes more (the deck is
  // the hero), a near-square one less
  const FILL = { w: 0.9, h: 0.82 };

  function fit() {
    const sr = slot.getBoundingClientRect();
    let cr = canvas.getBoundingClientRect();
    if (cr.width < 2 || cr.height < 2) cr = sr;
    cssW = Math.max(2, Math.round(cr.width)); cssH = Math.max(2, Math.round(cr.height));
    canvasLeft = cr.left; canvasTop = cr.top;
    const pr = Math.max(1, Math.min(2, Math.min(devicePixelRatio || 1, 2, Math.sqrt(2.6e6 / (cssW * cssH)))));
    renderer.setPixelRatio(pr);
    renderer.setSize(cssW, cssH, false);
    if (post.ok) post.setSize(cssW, cssH, pr);
    const sw = Math.max(40, sr.width), sh = Math.max(40, sr.height);
    const ox = sr.left - cr.left, oy = sr.top - cr.top;
    preset = sw < 600 && sh > 0.9 * sw ? "phone" : "full";
    if (displays?.setCompact?.(preset === "phone")) dirty = true;
    views = [];
    gutters = [];
    if (preset === "full") {
      const wide = sw / sh;
      FILL.w = wide > 2.8 ? 0.92 : 0.9;
      FILL.h = wide > 2.8 ? 0.88 : 0.82;
      fitW = sw; fitH = sh;
      // the meters framing: the display window across ~94 % of the width (or 86 % of the height);
      // what lies outside it fades to the ground through the grade's widened edge guard
      fitRegion(metersCam, REGION.meters, sw, sh, 1, FULL_FOV, 4);
      {
        const [x0, x1, y0, y1] = REGION.meters;
        const aspect = sw / sh;
        const visH = Math.max((y1 - y0) / 0.86, (x1 - x0) / 0.94 / aspect);
        const d = visH / 2 / Math.tan((FULL_FOV / 2) * DEG);
        const c = vA.set(X((x0 + x1) / 2), (y0 + y1) / 2, 0);
        metersCam.position.set(c.x, c.y + Math.sin(4 * DEG) * d, Math.cos(4 * DEG) * d);
        metersCam.lookAt(c);
        metersCam.updateMatrixWorld();
      }
      placeFull();
      views.push({ name: "full", camera: fullCam, x: ox, y: oy, w: sw, h: sh });
      sweepU.uView.value.set(ox * pr, (cssH - oy - sh) * pr, sw * pr, sh * pr);
      sweepU.uGuard.value.set(4 * pr, 24 * pr);
      setFall(ox, oy, sw, sh, pr);
      slot.style.removeProperty("--loupe-top");
      slot.style.removeProperty("--loupe-h");
      slot.style.removeProperty("--loupe-x");
    } else {
      // portrait phones: the whole deck as the hero, then the loupe on the VU pair and the peak
      // meter at about 24 px/cm (the owner's displays, featured). The transport is the page's own
      // key bar under it there (keys.js docks the keys), so no knob or jack takes loupe space
      focus.k = focus.target = 0; focus.name = "full";
      const W = sw, LI = LOUPE_INSET;
      const [x0, x1, y0, y1] = REGION.loupe;
      const lw = W - 2 * LI;
      const lh = Math.round(lw * (y1 - y0) / (x1 - x0));
      const hh = Math.max(Math.round(W * 0.36), Math.round(sh - lh - LOUPE_GAP));
      fitFull(fullCam, W, hh, 0, 0, 0.94, 0.84);
      views.push({ name: "full", camera: fullCam, x: ox, y: oy, w: W, h: hh });
      const ly = oy + hh + LOUPE_GAP;
      fitRegion(loupeCam, REGION.loupe, lw, lh, 0.97);
      views.push({ name: "loupe", camera: loupeCam, x: ox + LI, y: ly, w: lw, h: lh });
      // the gap between them and the strips beside the loupe are the page (painted after post,
      // so no bloom crosses them)
      gutters.push({ x: ox, y: oy + hh, w: W, h: LOUPE_GAP });
      gutters.push({ x: ox, y: ly, w: LI, h: lh }, { x: ox + W - LI, y: ly, w: LI, h: lh });
      if (ly + lh < oy + sh - 1) gutters.push({ x: ox, y: ly + lh, w: W, h: Math.round(oy + sh - ly - lh) });
      sweepU.uView.value.set(ox * pr, (cssH - oy - hh) * pr, W * pr, hh * pr);
      sweepU.uGuard.value.set(4 * pr, 16 * pr);
      setFall(ox, oy, W, hh, pr);
      slot.style.setProperty("--loupe-top", `${Math.round(ly - oy)}px`);
      slot.style.setProperty("--loupe-h", `${lh}px`);
      slot.style.setProperty("--loupe-x", `${LI}px`);
    }
    computeKeyRects();
    updatePixelScale();
    dirty = shadowsDirty = true;
  }

  // the sweep's falloff ellipse for a view rectangle (css px): centred a little below the middle
  // (the deck's foot), wide and soft enough that only the ground reaches the frame's edge
  function setFall(x, y, w, h, pr) {
    const F = G.fall;
    sweepU.uFallPx.value.set((x + w * F.c[0]) * pr, (cssH - y - h * F.c[1]) * pr, w * F.r[0] * pr, h * F.r[1] * pr);
  }

  // device px per cm at the VU meters in the view that shows them largest
  function updatePixelScale() {
    if (!displays?.setPixelScale) return;
    const v = views.find((x) => x.name === "loupe") || views[0];
    if (!v) return;
    const pr = renderer.getPixelRatio();
    vT.set(X(32.5) - 1, 11.1, -0.8).project(v.camera);
    const ax = vT.x;
    vT.set(X(32.5) + 1, 11.1, -0.8).project(v.camera);
    const px = (Math.abs(vT.x - ax) / 2) * v.w * 0.5 * pr;
    if (displays.setPixelScale(px)) dirty = true;
  }

  // every key is on the main view (on phones the page docks the keys in its own bar)
  function viewFor() { return views[0]; }
  function computeKeyRects() {
    // the canvas may have moved without resizing since fit() (page scroll, a layout shift
    // above the deck), and keys.js places the buttons against the slot's current rect
    const cr = canvas.getBoundingClientRect();
    if (cr.width >= 2 && cr.height >= 2) { canvasLeft = cr.left; canvasTop = cr.top; }
    const raw = keys.map((k) => {
      const v = viewFor(k.action);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const dx of [-1, 1]) for (const dy of [-1, 1]) for (const z of [k.z, -0.1]) {
        vT.set(X(k.x) + (dx * k.w) / 2, k.y + (dy * k.h) / 2, z).project(v.camera);
        const px = v.x + ((vT.x + 1) / 2) * v.w, py = v.y + ((1 - vT.y) / 2) * v.h;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      return { action: k.action, v, x0, x1, y0, y1 };
    });
    // 1. grow to at least 44 x 44 around the centre
    const pad = raw.map((r) => {
      const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
      const w = Math.max(44, r.x1 - r.x0), h = Math.max(44, r.y1 - r.y0);
      return { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 };
    });
    // 2. overlapping pairs split their gap. Vertically, a key with nothing above (or below) it
    //    can grow that way instead, so the split favours its neighbour: the middle key of a
    //    stack of three still gets its 44 px.
    const freeAbove = raw.map((A) => !raw.some((B) => B !== A && B.v === A.v && B.x0 < A.x1 && A.x0 < B.x1 && B.y1 <= A.y0));
    const freeBelow = raw.map((A) => !raw.some((B) => B !== A && B.v === A.v && B.x0 < A.x1 && A.x0 < B.x1 && B.y0 >= A.y1));
    const lockTop = raw.map(() => false), lockBottom = raw.map(() => false);
    for (let i = 0; i < raw.length; i++) for (let j = i + 1; j < raw.length; j++) {
      if (raw[i].v !== raw[j].v) continue;
      const a = pad[i], b = pad[j];
      if (a.x0 >= b.x1 || b.x0 >= a.x1 || a.y0 >= b.y1 || b.y0 >= a.y1) continue;
      const A = raw[i], B = raw[j];
      const gx = Math.max(B.x0 - A.x1, A.x0 - B.x1), gy = Math.max(B.y0 - A.y1, A.y0 - B.y1);
      if (gx >= gy) {
        const [L, R, l, r] = A.x1 <= B.x0 ? [a, b, A, B] : [b, a, B, A];
        const m = (l.x1 + r.x0) / 2;
        L.x1 = Math.min(L.x1, m); R.x0 = Math.max(R.x0, m);
      } else {
        const up = A.y1 <= B.y0;
        const [T, D, t, d, ti, di] = up ? [a, b, A, B, i, j] : [b, a, B, A, j, i];
        let m = (t.y1 + d.y0) / 2;
        const want = (r) => (r.y0 + r.y1) / 2;
        if (freeAbove[ti] && !freeBelow[di]) m = want(d) - 22;      // the lower key keeps its 44 px
        else if (freeBelow[di] && !freeAbove[ti]) m = want(t) + 22;  // the upper key keeps its 44 px
        m = Math.max(t.y1 + 1, Math.min(d.y0 - 1, m));               // never over a visible cap
        T.y1 = Math.min(T.y1, m); D.y0 = Math.max(D.y0, m);
        lockBottom[ti] = true; lockTop[di] = true;
      }
    }
    // a key that gave up height to a neighbour grows on its free side
    pad.forEach((p, i) => {
      const short = 44 - (p.y1 - p.y0);
      if (short <= 0) return;
      if (!lockTop[i]) p.y0 -= short;
      else if (!lockBottom[i]) p.y1 += short;
    });
    // 3. clamp to the view, then to page (client) coordinates. A key whose cap centre is out of
    //    the view (the meters framing) is hidden: no target over something else
    api.keyRects = raw.map((r, i) => {
      const p = pad[i], v = r.v;
      const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
      const out = cx < v.x || cx > v.x + v.w || cy < v.y || cy > v.y + v.h;
      const x0 = Math.max(v.x, p.x0), x1 = Math.min(v.x + v.w, p.x1);
      const y0 = Math.max(v.y, p.y0), y1 = Math.min(v.y + v.h, p.y1);
      return { action: r.action, x: canvasLeft + x0, y: canvasTop + y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0), hidden: out };
    });
  }

  // ======================================================================
  // frame: render on demand (§4.5)
  // ======================================================================
  let lastRender = -1, perfN = 0, perfSum = 0, downgraded = false;
  function render() {
    if (shadowsDirty) { renderer.shadowMap.needsUpdate = true; shadowsDirty = false; }
    if (post.ok) {
      // the grade's edge guard: the full view eases to the ground over its outer 16 px, so
      // the bloom never reaches the canvas edge (on a phone: the hero view; the loupe is cropped)
      const u = post.uniforms;
      if (u && u.uEdge && u.uEdge.value) {
        u.uEdge.value.copy(sweepU.uView.value);
        // wider while framing the meters, so what the close-up crops fades instead of cutting
        u.uEdgeW.value = (16 + 56 * ease.inOut(focus.k)) * renderer.getPixelRatio();
      }
      post.render(scene, views);
    } else {
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, cssW, cssH);
      renderer.autoClear = false;
      renderer.clear(true, true, true);
      for (const v of views) {
        const y = cssH - v.y - v.h;
        renderer.setViewport(v.x, y, v.w, v.h);
        renderer.setScissor(v.x, y, v.w, v.h);
        renderer.setScissorTest(true);
        renderer.clearDepth();
        renderer.render(scene, v.camera);
      }
      renderer.setScissorTest(false);
    }
    if (gutters.length) {
      renderer.setRenderTarget(null);
      renderer.setClearColor(roomColor, 1);
      renderer.setScissorTest(true);
      const fill = (x, y, w, h, c) => {
        renderer.setClearColor(c, 1);
        renderer.setScissor(x, cssH - y - h, w, h);
        renderer.setViewport(x, cssH - y - h, w, h);
        renderer.clear(true, false, false);
      };
      for (const gt of gutters) fill(gt.x, gt.y, gt.w, gt.h, roomColor);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, cssW, cssH);
      renderer.setClearColor(clearColor, 1);
    }
  }
  const TIME_SCALE = DEBUG === "slow" ? 0.08 : 1; // dev: watch the choreography in slow motion
  function frame(t, dt) {
    now = t * TIME_SCALE;
    if (lost) return;
    if (tweens.length) { runTweens(); dirty = shadowsDirty = true; }
    stepPool(dt);
    // keys: critically damped follow toward rest / latched, with a dip for taps
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      let target = k.target;
      if (k.tap > 0) {
        k.tap = Math.max(0, k.tap - dt * (reduceMotion ? 1e3 : 6));
        target = Math.min(target, Z_TAP + (Z_REST - Z_TAP) * (1 - Math.sin(k.tap * Math.PI)));
        dirty = true;
      }
      const nz = reduceMotion ? target : k.z + (target - k.z) * Math.min(1, dt * 22);
      if (Math.abs(nz - k.z) > 1e-4) { k.z = nz; dirty = shadowsDirty = true; }
      else if (k.z !== target) { k.z = target; dirty = shadowsDirty = true; }
      k.group.position.z = k.z;
      const press = Math.max(0, Math.min(1, (Z_REST - k.z) / (Z_REST - Z_LATCH)));
      k.group.rotation.x = -1.5 * DEG * press;
      if (k.press !== press) { k.press = press; k.capMat.color.copy(k.base).multiplyScalar(1 - 0.2 * press); }
    }
    // compartment lamp
    const speed = dstate.speed;
    const mode = latched === "play" ? "play" : speed < 0 ? "rewind" : speed > 0 ? "forward" : "stop";
    const L = LOOK.deck.lamp;
    let lt = doorDeg > 0.5 ? L.open : !tapeIn ? L.empty : mode === "stop" ? L.loaded : L.play;
    if (!reduceMotion && (mode === "rewind" || mode === "forward") && doorDeg <= 0.5) lt *= 1 + 0.03 * Math.sin(t * 37) * Math.sin(t * 13.3);
    if (lampLevel !== lt) {
      const step = reduceMotion ? 1 : dt * 4;
      lampLevel = Math.abs(lt - lampLevel) <= step ? lt : lampLevel + Math.sign(lt - lampLevel) * step;
      dirty = true;
    }
    lamp.intensity = lampLevel * LOOK.deck.lampGain;
    // displays
    dstate.t = t;
    dstate.dt = Math.min(0.1, dt);
    dstate.mode = mode;
    dstate.side = sideUp;
    dstate.loaded = loaded;
    if (tapeIn && tracks.length) { dstate.track.index = trackAt(dstate.seconds); dstate.track.count = tracks.length; }
    else { dstate.track.index = -1; dstate.track.count = 0; }
    if (displays && displays.update(dstate)) dirty = true;
    if (dirty) updateSpill();
    if (parallax.on && !reduceMotion && preset === "full") stepParallax(dt);
    stepFocus(dt);
    if (!dirty) return;
    dirty = false;
    const t0 = performance.now();
    if (DEBUG) { renderer.info.autoReset = false; renderer.info.reset(); }
    render();
    // auto-downgrade: CPU time between rendered frames while playing
    if (!downgraded && mode === "play" && post.ok) {
      if (lastRender > 0) { perfSum += t0 - lastRender; perfN++; }
      if (perfN >= 90) {
        if (perfSum / perfN > 22) { post.setTier("low"); post.setSize(cssW, cssH, renderer.getPixelRatio()); }
        downgraded = true;
      }
    }
    lastRender = t0;
    if (DEBUG && DEBUG !== "bloom") debugLog();
  }
  let logged = 0;
  function debugLog() {
    if (now - logged < 2) return;
    logged = now;
    const i = renderer.info;
    console.info(`deck: ${preset} views=${views.length} calls=${i.render.calls} tris=${i.render.triangles} tex=${i.memory.textures} geo=${i.memory.geometries}`);
  }

  if (DEBUG) window.__deck = { api, renderer, scene, post, dstate, get displays() { return displays; }, get views() { return views; }, frame: () => { dirty = true; } };
  return api;

  // ---------- painted textures that need the layout constants ----------
  function drawAO() {
    const W = 1024, H = 326, sx = W / 44, sy = H / 14;
    const [cv, g] = makeCanvas(W, H);
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    const R = (x0, y0, x1, y1, a, blur) => {
      g.save();
      g.filter = `blur(${blur * sx}px)`;
      g.fillStyle = `rgba(0,0,0,${a})`;
      g.fillRect(x0 * sx, (14 - y1) * sy, (x1 - x0) * sx, (y1 - y0) * sy);
      g.restore();
    };
    const C = (x, y, r, a, blur) => {
      g.save();
      g.filter = `blur(${blur * sx}px)`;
      g.fillStyle = `rgba(0,0,0,${a})`;
      g.beginPath(); g.arc(x * sx, (14 - y) * sy, r * sx, 0, Math.PI * 2); g.fill();
      g.restore();
    };
    // under the top cover lip
    R(0, 13.75, 44, 14.2, 0.5, 0.18);
    // around the protruding door and display window (shade falls down and right)
    R(DOOR.x0 - 0.1, DOOR.y0 - 0.35, DOOR.x1 + 0.25, DOOR.y1 - 0.2, 0.35, 0.25);
    R(BAR.x0 - 0.1, BAR.y0 - 0.32, BAR.x1 + 0.2, BAR.y1 - 0.3, 0.3, 0.22);
    // keys, knobs, jacks
    for (const a of KEY_ORDER) {
      const k = KEYS[a];
      R(k.x - k.w / 2 + 0.05, k.y - k.h / 2 - 0.22, k.x + k.w / 2 + 0.18, k.y + k.h / 2 - 0.1, 0.42, 0.14);
    }
    R(1.45, 5.75, 3.95, 8.1, 0.35, 0.15);
    for (const x of [30.4, 32.6]) { R(x - 0.75, 4.95, x + 0.9, 5.5, 0.35, 0.1); C(x + 0.05, 2.55, 0.62, 0.35, 0.12); }
    C(2.65, 2.55, 0.72, 0.35, 0.12);
    C(35.75, 3.2, 1.15, 0.5, 0.3);
    C(40.7, 3.25, 2.35, 0.55, 0.45);
    // the transport recess walls
    R(TRANS.x0, TRANS.y1 - 0.18, TRANS.x1, TRANS.y1 + 0.02, 0.35, 0.08);
    return cv;
  }
  function drawTapeScale(g, w, h) {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#fff";
    g.font = `500 ${h * 0.62}px ${LOOK.font.panel}`;
    g.textBaseline = "middle";
    g.textAlign = "left";
    g.fillText("100", 0, h * 0.5);
    g.textAlign = "right";
    g.fillText("0", w, h * 0.5);
    const a = w * 0.12, b = w * 0.94;
    for (let i = 0; i <= 10; i++) {
      const x = a + ((b - a) * i) / 10;
      g.fillRect(x - 2, h * (i % 5 === 0 ? 0.12 : 0.3), 4, h * (i % 5 === 0 ? 0.76 : 0.4));
    }
  }
}
