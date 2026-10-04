// Post chain for the deck (docs/DESIGN.md §4.4): every view is drawn into one HDR target
// with viewport + scissor, then bloom with warm halation tints, a film grade (lift, warm
// roll-off, radial chromatic aberration, vignette, a faint warm leak) and AgX + sRGB.
// Grain is not here: it is a page-level CSS layer, so idle frames stay idle.
import { EffectComposer } from "../../vendor/postprocessing/EffectComposer.js";
import { Pass, FullScreenQuad } from "../../vendor/postprocessing/Pass.js";
import { ShaderPass } from "../../vendor/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "../../vendor/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "../../vendor/postprocessing/OutputPass.js";

const GradeShader = {
  name: "CasetGrade",
  uniforms: {
    tDiffuse: { value: null },
    tPre: { value: null },
    uRes: { value: null },
    uLift: { value: null },
    uLeakCol: { value: null },
    uCA: { value: 0.6 },
    uVig: { value: 0.18 },
    uLeak: { value: 0.04 },
    uBloomOnly: { value: 0 },
    // edge guard (docs/DESIGN.md §D2.5): within uEdge.w px of the view rectangle uEdge.xy-zw
    // the frame eases to the clear colour, so bloom never reaches the canvas edge (0 = off)
    uEdge: { value: null },
    uEdgeW: { value: 0 },
    uEdgeCol: { value: null },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform sampler2D tPre;
    uniform vec2 uRes;
    uniform vec3 uLift;
    uniform vec3 uLeakCol;
    uniform float uCA, uVig, uLeak, uBloomOnly, uEdgeW;
    uniform vec4 uEdge;
    uniform vec3 uEdgeCol;
    varying vec2 vUv;
    void main() {
      vec2 d = vUv - 0.5;
      // radial chromatic aberration, only toward the corners: the fascia's centre stays clean
      vec2 off = d * (uCA / max(1.0, length(0.5 * uRes))) * smoothstep(0.38, 0.72, length(d));
      vec3 c;
      c.r = texture2D(tDiffuse, vUv + off).r;
      c.g = texture2D(tDiffuse, vUv).g;
      c.b = texture2D(tDiffuse, vUv - off).b;
      // no stray spike (a specular glint past the half-float range) reaches the tone mapper
      c = min(c, vec3(64.0));
      if (uBloomOnly > 0.5) {
        vec3 pre = vec3(texture2D(tPre, vUv + off).r, texture2D(tPre, vUv).g, texture2D(tPre, vUv - off).b);
        gl_FragColor = vec4(max(c - pre, 0.0) * 3.0, 1.0);
        return;
      }
      // soft warm highlight roll-off: blue compresses first, red last
      vec3 over = max(c - 0.8, 0.0);
      c -= over * vec3(0.10, 0.16, 0.26) * over / (over + 0.6);
      // lift the blacks toward a warm floor
      c = uLift + c * (1.0 - uLift);
      // vignette (aspect-correct)
      vec2 q = d * vec2(uRes.x / uRes.y, 1.0);
      float v = smoothstep(0.35, 1.25, length(q));
      c *= 1.0 - uVig * v;
      // a static warm leak from the left edge: one soft, wide falloff, never a hard band
      vec2 lq = vec2(vUv.x / 0.42, (vUv.y - 0.55) / 0.6);
      c += uLeakCol * uLeak * exp(-dot(lq, lq) * 1.6);
      vec2 epx = gl_FragCoord.xy - uEdge.xy;
      if (uEdgeW > 0.0 && epx.x >= 0.0 && epx.y >= 0.0 && epx.x <= uEdge.z && epx.y <= uEdge.w) {
        // only inside the guarded view (the phone's loupe below it is left as it is)
        vec2 px = epx;
        vec2 e = min(px, uEdge.zw - px);
        // the clear colour as it comes through the lift above
        c = mix(uLift + uEdgeCol * (1.0 - uLift), c, smoothstep(2.0, uEdgeW, min(e.x, e.y)));
      }
      gl_FragColor = vec4(c, 1.0);
    }`,
};

class ViewsPass extends Pass {
  constructor(THREE, clear) {
    super();
    this.THREE = THREE;
    this.scene = null;
    this.views = null;
    this.clearColor = new THREE.Color(clear);
    this.needsSwap = false;
    this.pr = 1;
    this.h = 1;
    this._old = new THREE.Color();
    this._empty = new THREE.Scene();
    this._cam = new THREE.Camera();
    this.save = null; // debug: copy of the pre-bloom image
  }
  render(renderer, writeBuffer, readBuffer) {
    const rt = readBuffer;
    renderer.getClearColor(this._old);
    const oldAlpha = renderer.getClearAlpha();
    const oldAuto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setClearColor(this.clearColor, 1);
    rt.scissorTest = false;
    rt.viewport.set(0, 0, rt.width, rt.height);
    renderer.setRenderTarget(rt);
    renderer.clear(true, true, true);
    const pr = this.pr, H = this.h;
    for (const v of this.views) {
      const x = Math.round(v.x * pr), y = Math.round((H - v.y - v.h) * pr);
      const w = Math.round(v.w * pr), h = Math.round(v.h * pr);
      rt.viewport.set(x, y, w, h);
      rt.scissor.set(x, y, w, h);
      rt.scissorTest = true;
      renderer.setRenderTarget(rt);
      renderer.clearDepth();
      renderer.render(this.scene, v.camera);
    }
    rt.scissorTest = false;
    rt.viewport.set(0, 0, rt.width, rt.height);
    renderer.setRenderTarget(rt);
    // a full-target no-op draw so a multisampled target resolves everywhere (gutters too)
    renderer.render(this._empty, this._cam);
    if (this.save) {
      renderer.setRenderTarget(this.save);
      renderer.clear();
      this.copy.material.uniforms.tDiffuse.value = rt.texture;
      this.copy.render(renderer);
    }
    renderer.setClearColor(this._old, oldAlpha);
    renderer.autoClear = oldAuto;
  }
}

export function createPost({ THREE, renderer, LOOK, tier = "high", debugBloom = false, disabled = false }) {
  const gl = renderer.getContext();
  const isGL2 = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
  const hasFloat = isGL2 && !!(gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"));
  let ok = hasFloat && !disabled;
  let composer = null, views = null, bloom = null, grade = null, output = null, rt = null;
  let cssW = 1, cssH = 1, pr = 1, builtSamples = -1;
  let curTier = tier;

  // the light tier keeps 4x MSAA at 1x density and 2x at high density (phones): thin bezel
  // and key edges stair-step without it
  const samplesFor = () => (curTier === "high" || pr < 1.5 ? 4 : 2);
  function build() {
    rt = new THREE.WebGLRenderTarget(16, 16, {
      type: THREE.HalfFloatType, samples: samplesFor(), depthBuffer: true,
    });
    builtSamples = rt.samples;
    composer = new EffectComposer(renderer, rt);
    views = new ViewsPass(THREE, LOOK.post.clear);
    composer.addPass(views);
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), LOOK.post.bloomStrength, LOOK.post.bloomRadius, LOOK.post.bloomThreshold);
    // a soft knee: the brightest metal highlights sit below it, the lit displays and lamps above
    bloom.highPassUniforms.smoothWidth.value = LOOK.post.bloomKnee;
    // threshold on the brightest channel, not luminance: a red LED or an amber lamp blooms at the
    // same level as a white phosphor, and grey metal is unaffected (its channels are equal)
    bloom.materialHighPassFilter.fragmentShader = bloom.materialHighPassFilter.fragmentShader
      .replace("float v = luminance( texel.xyz );", "float v = max( max( texel.r, texel.g ), texel.b );")
      // clamp what feeds the blur: a one-pixel chrome glint at 100 must not outshine a lit tube
      .replace("vec4 texel = texture2D( tDiffuse, vUv );", "vec4 texel = texture2D( tDiffuse, vUv ); texel.rgb = min( texel.rgb, vec3( 4.0 ) );");
    bloom.materialHighPassFilter.needsUpdate = true;
    const tints = LOOK.post.tints;
    for (let i = 0; i < 5; i++) bloom.bloomTintColors[i].set(tints[i][0], tints[i][1], tints[i][2]);
    composer.addPass(bloom);
    grade = new ShaderPass(GradeShader);
    grade.uniforms.uRes.value = new THREE.Vector2(1, 1);
    grade.uniforms.uLift.value = new THREE.Color(LOOK.post.lift); // linear
    grade.uniforms.uLeakCol.value = new THREE.Color(LOOK.post.leak);
    grade.uniforms.uCA.value = pr < 1.5 ? 0 : LOOK.post.ca;
    grade.uniforms.uVig.value = LOOK.post.vignette;
    grade.uniforms.uLeak.value = LOOK.post.leakAmount;
    grade.uniforms.uEdge.value = new THREE.Vector4(0, 0, 1, 1);
    grade.uniforms.uEdgeCol.value = new THREE.Color(LOOK.post.clear);
    composer.addPass(grade);
    output = new OutputPass();
    composer.addPass(output);
    if (debugBloom) {
      views.save = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType });
      views.copy = new FullScreenQuad(new THREE.ShaderMaterial({
        uniforms: { tDiffuse: { value: null } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
        fragmentShader: "uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tDiffuse, vUv); }",
      }));
      grade.uniforms.tPre.value = views.save.texture;
      // ?debug=bloom shows only what blooms; ?debug=hdr keeps the image and the linear copy
      grade.uniforms.uBloomOnly.value = debugBloom === "hdr" ? 0 : 1;
    }
  }
  function sizeAll() {
    if (!composer) return;
    composer.setPixelRatio(pr);
    composer.setSize(cssW, cssH);
    const W = Math.round(cssW * pr), H = Math.round(cssH * pr);
    const div = curTier === "high" ? 1 : 2 / 3; // UnrealBloomPass halves internally: 1/2 or 1/3
    bloom.setSize(Math.max(2, Math.round(W * div)), Math.max(2, Math.round(H * div)));
    grade.uniforms.uRes.value.set(W, H);
    // at 1x the unresolved edges are a pixel wide: any CA reads as a red/blue misregistration
    grade.uniforms.uCA.value = pr < 1.5 ? 0 : LOOK.post.ca;
    if (views.save) views.save.setSize(W, H);
    views.pr = pr; views.h = cssH;
  }
  if (ok) {
    try { build(); } catch { ok = false; }
  }

  return {
    get ok() { return ok; },
    get uniforms() { return grade ? grade.uniforms : null; },
    get bloom() { return bloom; },
    get hdr() { return views ? views.save : null; },
    setSize(w, h, pixelRatio) {
      cssW = w; cssH = h; pr = pixelRatio;
      // crossing 1.5x (a window moved between screens) changes the light tier's MSAA
      if (ok && composer && builtSamples !== samplesFor()) { dispose(); build(); }
      sizeAll();
    },
    render(scene, list) {
      views.scene = scene;
      views.views = list;
      composer.render(0.016);
    },
    setTier(t) {
      if (t === curTier || !ok) return;
      curTier = t;
      dispose();
      build();
      sizeAll();
    },
    dispose,
  };
  function dispose() {
    if (!composer) return;
    composer.renderTarget1.dispose();
    composer.renderTarget2.dispose();
    bloom.dispose();
    grade.material.dispose?.();
    output.dispose();
    views.save?.dispose();
    composer = null;
  }
}
