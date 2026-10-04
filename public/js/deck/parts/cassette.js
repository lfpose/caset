// The cassette: a clear smoked Philips shell with brown tape packs, white toothed hubs,
// guide rollers, a felt pad on a bronze spring and a paper label cut from the cover art.
// Local frame: origin at the shell centre, label face toward +z, tape opening down (cm).
import { LOOK } from "../look.js";
import { makeCanvas, ringsCanvases } from "./tex.js";
import { mergeStatic } from "./merge.js";

export const CAS = { w: 10.0, h: 6.4, t: 1.2, hubX: 2.1, hubY: 0.15, rMin: 1.08, rMax: 2.28 };
const LABEL = { w: 9.2, h: 1.7, y0: 1.45, W: 1024, H: 190 };

// a tiny tangent-space normal map of moulded ridges, 8 per cm (the shell faces' uv is in cm)
function gridCanvas(N = 64) {
  const [cv, g] = makeCanvas(N, N);
  const img = g.createImageData(N, N);
  const step = N / 8;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const fx = (x % step) / step, fy = (y % step) / step;
    const dx = fx < 0.12 ? 0.6 : fx > 0.88 ? -0.6 : 0, dy = fy < 0.12 ? 0.6 : fy > 0.88 ? -0.6 : 0;
    const len = Math.hypot(dx, dy, 1), p = (y * N + x) * 4;
    img.data[p] = Math.round((dx / len * 0.5 + 0.5) * 255);
    img.data[p + 1] = Math.round((dy / len * 0.5 + 0.5) * 255);
    img.data[p + 2] = Math.round((1 / len * 0.5 + 0.5) * 255);
    img.data[p + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return cv;
}

export function createCassette({ THREE, tex, physical, envMap = null }) {
  const group = new THREE.Group();
  group.name = "cassette";
  const Mat = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;

  // ---------- materials ----------
  const shellColor = new THREE.Color(LOOK.deck.shellBody);
  // the fine moulded grid of a clear shell (as on the Duoman tape): it breaks up the gloss
  const gridNrm = tex(gridCanvas(), { srgb: false, repeat: [1, 1] });
  const shell = new Mat({
    color: shellColor.clone(), metalness: 0, roughness: LOOK.pbr.shell.rough,
    transparent: true, opacity: LOOK.pbr.shell.opacity, depthWrite: false,
    envMap, envMapIntensity: LOOK.pbr.shell.env, normalMap: gridNrm, normalScale: new THREE.Vector2(0.3, 0.3),
    ...(physical ? { clearcoat: 1, clearcoatRoughness: 0.04 } : {}),
  });
  // clear plastic is nearly invisible face-on and nearly opaque at a glance: a Fresnel term on
  // the shell's opacity and a little sheen, so its silhouette, walls and bevels catch the light
  // while the packs still read through the faces
  function fresnel(m, edge, sheen) {
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace("#include <opaque_fragment>", `#include <opaque_fragment>
        {
          float fr = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), 2.2);
          gl_FragColor.a = clamp(gl_FragColor.a + fr * ${edge.toFixed(2)}, 0.0, 1.0);
          gl_FragColor.rgb += fr * vec3(${sheen.toFixed(3)});
        }`);
    };
    m.customProgramCacheKey = () => `caset-fresnel-${edge}-${sheen}`;
    return m;
  }
  fresnel(shell, 0.55, 0.05);
  const shellEdge = fresnel(shell.clone(), 0.35, 0.06);
  // the thick clear edges, the window frame and the head-opening wall: a lighter, much denser
  // moulding, so the shell has a body
  shellEdge.opacity = 0.6;
  const edgeTint = new THREE.Color(0x8f8a83);
  const rc = ringsCanvases(LOOK.deck.seed + 11);
  const packTex = tex(rc.color);
  const packNrm = tex(rc.normal, { srgb: false });
  const pack = new Mat({
    color: LOOK.deck.packLit, map: packTex, normalMap: packNrm, normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.28, metalness: 0.0,
    // the wound pack is glossy oxide: one crisp ring of light on its face
    ...(physical ? { sheen: 0.3, sheenRoughness: 0.3, sheenColor: new THREE.Color(0x7a5236), clearcoat: 0.45, clearcoatRoughness: 0.18 } : {}),
  });
  const packEdge = new THREE.MeshStandardMaterial({ color: 0x1c110a, roughness: 0.5, metalness: 0.0 });
  // moulded off-white hubs: glossy enough that the teeth and rims catch the light
  const hub = new THREE.MeshStandardMaterial({ color: LOOK.mat.hub, roughness: 0.35, metalness: 0 });
  const roller = new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.35 });
  const pin = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 1, roughness: 0.2 });
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0x3a2214, roughness: 0.42, metalness: 0.05, side: THREE.DoubleSide });
  const felt = new THREE.MeshStandardMaterial({ color: 0xe8e1d0, roughness: 1 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0xc89a5a, metalness: 1, roughness: 0.3 });
  const screwMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, metalness: 1, roughness: 0.15 });
  const blurMat = new THREE.MeshBasicMaterial({ color: 0xd9d3c6, transparent: true, opacity: 0.0, depthWrite: false });
  const inner = new THREE.MeshStandardMaterial({ color: 0x0d0a08, roughness: 0.6, transparent: true, opacity: 0.7, depthWrite: false });
  // the window: a darker smoked pane between the label and the tape path, with a dense frame
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x0b0908, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1714, roughness: 0.3, metalness: 0, transparent: true, opacity: 0.85, depthWrite: false });

  const add = (geo, mat, parent = group) => { const m = new THREE.Mesh(geo, mat); parent.add(m); return m; };
  const cstat = new THREE.Group(); // fixed parts, merged per material at the end
  group.add(cstat);

  // ---------- shell ----------
  const W2 = CAS.w / 2, H2 = CAS.h / 2, T2 = CAS.t / 2;
  function outline(inset = 0) {
    const s = new THREE.Shape();
    const x0 = -W2 + inset, x1 = W2 - inset, y0 = -H2 + inset, y1 = H2 - inset, r = Math.max(0.05, 0.32 - inset);
    s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r);
    s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1);
    s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r);
    s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
    return s;
  }
  const circle = (x, y, r) => { const p = new THREE.Path(); p.absarc(x, y, r, 0, Math.PI * 2, true); return p; };
  {
    // faces: 0.1 thick, with the hub openings
    const face = outline();
    face.holes.push(circle(-CAS.hubX, CAS.hubY, 0.66), circle(CAS.hubX, CAS.hubY, 0.66));
    const fg = new THREE.ExtrudeGeometry(face, { depth: 0.1, bevelEnabled: false, curveSegments: 24 });
    const front = add(fg, shell); front.position.z = T2 - 0.1; front.renderOrder = 2;
    const back = add(fg, shell); back.position.z = -T2; back.renderOrder = 2;
    // side walls: the thick clear edge catches more light
    const ring = outline();
    ring.holes.push(outline(0.14));
    const rg = new THREE.ExtrudeGeometry(ring, { depth: CAS.t - 0.2, bevelEnabled: false, curveSegments: 8 });
    const wall = add(rg, shellEdge); wall.position.z = -T2 + 0.1; wall.renderOrder = 2;
    // raised trapezoid along the tape opening, both faces
    const trap = new THREE.Shape();
    trap.moveTo(-3.75, -H2 + 0.04); trap.lineTo(3.75, -H2 + 0.04); trap.lineTo(3.05, -H2 + 1.28); trap.lineTo(-3.05, -H2 + 1.28); trap.closePath();
    const tg = new THREE.ExtrudeGeometry(trap, { depth: 0.07, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.02, bevelSegments: 1 });
    const t1 = add(tg, shellEdge); t1.position.z = T2; t1.renderOrder = 2;
    const t2 = add(tg, shellEdge); t2.position.z = -T2 - 0.07; t2.renderOrder = 2;
    // dark inner ribs that hold the window area (seen through the clear faces)
    const rib = new THREE.BoxGeometry(0.08, 3.2, CAS.t - 0.3);
    for (const x of [-4.55, 4.55]) { const r = add(rib, inner); r.position.set(x, 0.3, 0); }
    const ribH = new THREE.BoxGeometry(8.9, 0.08, CAS.t - 0.3);
    { const r = add(ribH, inner); r.position.set(0, -1.95, 0); }
    // the window, both faces: a smoked pane and its moulded frame (8.0 x 2.2 cm, round ends)
    {
      const win = (inset) => {
        const sh = new THREE.Shape(), w = 4.0 - inset, h = 1.1 - inset, y = CAS.hubY, r = h;
        sh.moveTo(-w + r, y - h); sh.lineTo(w - r, y - h); sh.absarc(w - r, y, r, -Math.PI / 2, Math.PI / 2, false);
        sh.lineTo(-w + r, y + h); sh.absarc(-w + r, y, r, Math.PI / 2, Math.PI * 1.5, false);
        return sh;
      };
      const pane = new THREE.ShapeGeometry(win(0.12), 24);
      const frame = win(0); frame.holes.push(win(0.12));
      const fg = new THREE.ShapeGeometry(frame, 24);
      for (const sd of [1, -1]) {
        const p = add(pane, windowMat); p.position.z = sd * (T2 - 0.105); p.renderOrder = 1; if (sd < 0) p.rotation.y = Math.PI;
        const f = add(fg, frameMat); f.position.z = sd * (T2 + 0.002); f.renderOrder = 3; if (sd < 0) f.rotation.y = Math.PI;
      }
    }
    // screws (five per face): a bright head in a dark recess, so they register at a distance
    const sg = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16); sg.rotateX(Math.PI / 2);
    const recess = new THREE.RingGeometry(0.12, 0.2, 20);
    const recessMat = new THREE.MeshBasicMaterial({ color: 0x0c0a09 });
    const slot = new THREE.BoxGeometry(0.18, 0.035, 0.02);
    const slotMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    for (const s of [1, -1]) {
      for (const [x, y] of [[-4.55, 2.82], [4.55, 2.82], [-4.55, -2.82], [4.55, -2.82], [0, -2.5]]) {
        const z0 = s * (T2 + (y === -2.5 ? 0.07 : 0.0));
        const rc = add(recess, recessMat, cstat); rc.position.set(x, y, z0 + s * 0.004); if (s < 0) rc.rotation.y = Math.PI;
        const sc = add(sg, screwMat, cstat); sc.position.set(x, y, z0 + s * 0.02);
        const sl = add(slot, slotMat, cstat); sl.position.set(x, y, z0 + s * 0.045);
        sl.rotation.z = (x + y) * 1.3;
      }
    }
    // write-protect tabs on the top edge
    const tab = new THREE.BoxGeometry(0.55, 0.12, 0.35);
    const tabMat = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.6 });
    for (const x of [-4.1, 4.1]) { const tb = add(tab, tabMat, cstat); tb.position.set(x, H2 - 0.07, 0); }
  }

  // ---------- reels ----------
  const packGeo = new THREE.CylinderGeometry(1, 1, 0.38, 96, 1, false);
  packGeo.rotateX(Math.PI / 2);
  const hubRing = (() => {
    const s = new THREE.Shape(); s.absarc(0, 0, CAS.rMin, 0, Math.PI * 2, false);
    s.holes.push(circle(0, 0, 0.6));
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1, curveSegments: 40 });
    g.translate(0, 0, -0.3);
    return g;
  })();
  const flange = (() => {
    const s = new THREE.Shape(); s.absarc(0, 0, CAS.rMin + 0.04, 0, Math.PI * 2, false);
    s.holes.push(circle(0, 0, 0.6));
    return new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false, curveSegments: 40 });
  })();
  const toothGeo = new THREE.BoxGeometry(0.2, 0.16, 0.56);
  const blurGeo = (() => { const s = new THREE.Shape(); s.absarc(0, 0, 0.62, 0, Math.PI * 2, false); return new THREE.ShapeGeometry(s, 32); })();
  const reels = [-1, 1].map((sx) => {
    const g = new THREE.Group();
    g.position.set(sx * CAS.hubX, CAS.hubY, 0);
    group.add(g);
    const p = add(packGeo, [packEdge, pack, pack], g);
    const spin = new THREE.Group();
    g.add(spin);
    add(hubRing, hub, spin);
    const teeth = new THREE.Group();
    spin.add(teeth);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const t = add(toothGeo, hub, teeth);
      t.position.set(Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0);
      t.rotation.z = a;
    }
    // little index windows in the hub flange so rotation reads
    for (const z of [0.3, -0.33]) {
      const f = add(flange, hub, spin); f.position.z = z;
    }
    const blur = add(blurGeo, blurMat, g);
    blur.position.z = 0.32;
    blur.visible = false;
    const blurB = add(blurGeo, blurMat, g);
    blurB.position.z = -0.32; blurB.rotation.y = Math.PI;
    blurB.visible = false;
    return { g, pack: p, spin, teeth, blur, blurB };
  });

  // ---------- tape path along the bottom ----------
  const rollerGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.5, 24); rollerGeo.rotateX(Math.PI / 2);
  const pinGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 12); pinGeo.rotateX(Math.PI / 2);
  const ROLL = [[-3.65, -2.55], [3.65, -2.55]];
  for (const [x, y] of ROLL) { const r = add(rollerGeo, roller, cstat); r.position.set(x, y, 0); }
  for (const x of [-4.35, 4.35]) { const p = add(pinGeo, pin, cstat); p.position.set(x, -2.85, 0); }
  const ribbon = new THREE.PlaneGeometry(1, 0.38);
  ribbon.rotateX(Math.PI / 2); // lies in x, width along z
  const bottom = add(ribbon, tapeMat, cstat);
  bottom.position.set(0, -3.06, 0);
  bottom.scale.x = 8.7;
  const lead = [add(ribbon, tapeMat), add(ribbon, tapeMat)];
  const leadOuter = [add(ribbon, tapeMat), add(ribbon, tapeMat)];
  for (const [i, x] of [[0, -1], [1, 1]]) {
    leadOuter[i].position.set(x * 4.0, -2.95, 0);
    leadOuter[i].rotation.z = x * 0.45;
    leadOuter[i].scale.x = 0.75;
  }
  // felt pressure pad on a bronze leaf spring
  { const f = add(new THREE.BoxGeometry(0.5, 0.18, 0.36), felt, cstat); f.position.set(0, -2.92, 0); }
  { const b = add(new THREE.BoxGeometry(1.6, 0.04, 0.3), bronze, cstat); b.position.set(0, -2.78, 0); }
  // tape running from a pack (radius r, centre c) to a roller: approximate tangent segment
  const tmpA = new THREE.Vector2(), tmpB = new THREE.Vector2();
  function setLead(i, r) {
    const sx = i === 0 ? -1 : 1;
    const c = tmpA.set(sx * CAS.hubX, CAS.hubY);
    const R = ROLL[i];
    // leave the pack at its lower outer side, arrive at the roller's underside
    const ax = c.x + sx * r * 0.2, ay = c.y - r * 0.98;
    const b = tmpB.set(R[0] + sx * 0.02, R[1] - 0.2);
    const dx = b.x - ax, dy = b.y - ay;
    const len = Math.hypot(dx, dy);
    lead[i].position.set((ax + b.x) / 2, (ay + b.y) / 2, 0);
    lead[i].rotation.set(0, 0, Math.atan2(dy, dx));
    lead[i].scale.x = len;
  }

  // ---------- label ----------
  const labelGeo = new THREE.PlaneGeometry(LABEL.w, LABEL.h);
  const labelMatA = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 });
  const labelMatB = labelMatA.clone();
  const labelA = add(labelGeo, labelMatA);
  labelA.position.set(0, LABEL.y0 + LABEL.h / 2, T2 + 0.005);
  const labelB = add(labelGeo, labelMatB);
  labelB.position.set(0, LABEL.y0 + LABEL.h / 2, -T2 - 0.005);
  labelB.rotation.y = Math.PI;

  const coverCache = new Map();
  function coverImage(src) {
    if (coverCache.has(src)) return coverCache.get(src);
    const p = new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
    coverCache.set(src, p);
    return p;
  }
  function lum(hex) {
    const c = new THREE.Color(hex);
    return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  }
  function inkFor(hex) {
    const l = lum(hex);
    const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const dark = LOOK.ink.paperInk, light = LOOK.ink.paper;
    return ratio(l, lum(dark)) >= ratio(l, lum(light)) ? dark : light;
  }
  function fit(g, text, max, size, weight, family) {
    let s = size;
    g.font = `${weight} ${s}px ${family}`;
    while (s > size * 0.55 && g.measureText(text).width > max) { s -= 2; g.font = `${weight} ${s}px ${family}`; }
    if (g.measureText(text).width <= max) return text;
    let t = text;
    while (t.length > 1 && g.measureText(t + "…").width > max) t = t.slice(0, -1);
    return t.trimEnd() + "…";
  }
  function drawLabel(g, c, side, img) {
    const { W, H } = LABEL;
    const pxcm = W / LABEL.w;
    const sd = c.sides[side];
    g.clearRect(0, 0, W, H);
    g.fillStyle = LOOK.ink.paper;
    g.fillRect(0, 0, W, H);
    // paper fibre
    g.globalAlpha = 0.05;
    for (let i = 0; i < 400; i++) { g.fillStyle = i % 2 ? "#6d5f50" : "#fff"; g.fillRect((i * 97) % W, (i * 53) % H, 2 + (i % 5), 1); }
    g.globalAlpha = 1;
    // left: the cover's picture band, warmed
    const aw = Math.round(2.6 * pxcm), m = 8;
    g.save();
    g.beginPath(); g.rect(m, m, aw - m, H - 2 * m); g.clip();
    g.fillStyle = c.color; g.fillRect(m, m, aw - m, H - 2 * m);
    if (img) {
      const iw = img.naturalWidth || 600, ih = img.naturalHeight || 1060;
      const bw = iw, bh = ih > iw ? iw * (415 / 600) : ih;
      const s = Math.max((aw - m) / bw, (H - 2 * m) / bh);
      const cw = (aw - m) / s, ch = (H - 2 * m) / s;
      g.drawImage(img, (bw - cw) / 2, (bh - ch) / 2, cw, ch, m, m, aw - m, H - 2 * m);
      g.globalCompositeOperation = "multiply";
      g.globalAlpha = 0.15;
      g.fillStyle = "#ffd9a8";
      g.fillRect(m, m, aw - m, H - 2 * m);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    } else {
      const n = 5, bh = (H - 2 * m) / (n * 1.4);
      LOOK.STRIPES.forEach((col, i) => { g.fillStyle = col; g.fillRect(m, m + bh * 0.4 + i * bh * 1.4, aw - m, bh); });
    }
    g.restore();
    // right: big side letter on the tape colour
    const rw = Math.round(1.3 * pxcm), rx = W - rw - m;
    g.fillStyle = c.color; g.fillRect(rx, m, rw, H - 2 * m);
    g.fillStyle = inkFor(c.color);
    g.font = `700 ${Math.round(H * 0.62)}px ${LOOK.font.brand}`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(side, rx + rw / 2, H / 2 + H * 0.03);
    // middle: name and side label, with ruled writing lines
    const mx = aw + 26, mw = rx - mx - 26;
    g.strokeStyle = "rgba(109,95,80,0.35)"; g.lineWidth = 1.5;
    for (const y of [H * 0.66, H * 0.84]) { g.beginPath(); g.moveTo(mx, y); g.lineTo(mx + mw, y); g.stroke(); }
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.fillStyle = LOOK.ink.paperInk;
    const name = fit(g, c.name, mw, Math.round(H * 0.34), 700, LOOK.font.brand);
    g.fillText(name, mx, H * 0.42);
    g.fillStyle = "#6d5f50";
    const sub = fit(g, sd.label || "", mw, Math.round(H * 0.17), 400, LOOK.font.panel);
    g.fillText(sub, mx + 2, H * 0.63);
    // tiny maker stripe at the right of the middle field
    LOOK.STRIPES.forEach((col, i) => { g.fillStyle = col; g.fillRect(mx + mw - 120 + i * 24, H * 0.76, 20, 6); });
    g.fillStyle = "#6d5f50";
    g.font = `500 ${Math.round(H * 0.1)}px ${LOOK.font.panel}`;
    g.textAlign = "right";
    g.fillText("caset · C-" + Math.max(10, Math.round(sumDur(c) / 60) * 2), mx + mw - 130, H * 0.8);
    // dark 1 px edge
    g.strokeStyle = "rgba(34,26,21,0.55)"; g.lineWidth = 2;
    g.strokeRect(1, 1, W - 2, H - 2);
  }
  function sumDur(c) {
    let s = 0;
    for (const k of ["A", "B"]) for (const t of c.sides[k].tracks) s += Math.max(1, Number(t.dur) || 0);
    return s / 2;
  }
  const labelCache = new Map();
  let onChange = () => {};
  function labelTexture(c, side) {
    const k = `${c.id}:${side}`;
    if (labelCache.has(k)) return labelCache.get(k);
    const [cv, g] = makeCanvas(LABEL.W, LABEL.H);
    drawLabel(g, c, side, null);
    const t = tex(cv);
    labelCache.set(k, t);
    coverImage(c.cover).then((img) => {
      if (!img || labelCache.get(k) !== t) return; // gone: another tape was loaded meanwhile
      try {
        drawLabel(g, c, side, img);
        t.needsUpdate = true;
        onChange();
      } catch { /* a broken image keeps the colour label */ }
    });
    return t;
  }
  function setLook(c) {
    labelMatA.map = labelTexture(c, "A");
    labelMatB.map = labelTexture(c, "B");
    labelMatA.needsUpdate = labelMatB.needsUpdate = true;
    for (const [k, t] of labelCache) {
      if (k.slice(0, k.lastIndexOf(":")) === c.id) continue;
      t.dispose();
      if (t.image) t.image.width = t.image.height = 0;
      labelCache.delete(k);
    }
    const col = new THREE.Color(c.color);
    shell.color.copy(shellColor).lerp(col, LOOK.mat.cassetteTint);
    shellEdge.color.copy(edgeTint).lerp(col, LOOK.mat.cassetteTint);
  }

  // ---------- per-frame reel state ----------
  let lastR = -1;
  // rL / rR: radii of the packs on the viewer's left / right; aL / aR: their angles
  // (counter-clockwise as seen by the viewer); sideB: the cassette is turned over
  function setReels(rL, rR, aL, aR, sideB, blurL, blurR) {
    const left = sideB ? reels[1] : reels[0];
    const right = sideB ? reels[0] : reels[1];
    left.pack.scale.set(rL, rL, 1);
    right.pack.scale.set(rR, rR, 1);
    const s = sideB ? -1 : 1;
    left.spin.rotation.z = s * aL;
    right.spin.rotation.z = s * aR;
    setBlur(left, blurL); setBlur(right, blurR);
    if (rL !== lastR) {
      lastR = rL;
      // reels[0] is the physical left reel of side A
      setLead(0, sideB ? rR : rL);
      setLead(1, sideB ? rL : rR);
    }
  }
  function setBlur(r, k) {
    const on = k > 0.01;
    r.teeth.visible = k < 0.6;
    r.blur.visible = r.blurB.visible = on;
    if (on) blurMat.opacity = Math.min(0.85, k);
  }

  group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  mergeStatic(THREE, cstat);
  for (const r of reels) { mergeStatic(THREE, r.teeth, { deep: false }); mergeStatic(THREE, r.spin, { deep: false }); }
  return { group, setLook, setReels, onLabel(fn) { onChange = fn; } };
}
