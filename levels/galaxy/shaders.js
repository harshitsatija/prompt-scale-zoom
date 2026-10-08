/* Materials for the galaxy level. All additive light goes through CustomBlending (ONE,ONE; alpha = MAX) so the
 * engine's `mix(backdrop, rgb, alpha)` composite keeps a coverage alpha in lit regions; dust is a normal-blended dark layer. */
import * as T from '../../vendor/three.module.js';

const ADD = { blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneFactor, blendEquationAlpha: T.MaxEquation, blendSrcAlpha: T.OneFactor, blendDstAlpha: T.OneFactor, transparent: true, depthWrite: false, depthTest: false };

export const shared = {
  uPxPerKpc: { value: 100 }, uDpr: { value: 1 }, uFade: { value: 1 }, uGain: { value: 1 }, uDetail: { value: 1 }, uTime: { value: 0 }, uCap: { value: 1.6 },
};

const toLin = `vec3 toLin(vec3 c){ return pow(max(c, vec3(0.0)), vec3(2.2)); }`;
// The engine composites `mix(backdrop, rgb, alpha)`. For additive light we write alpha = A wherever there is light and pre-divide rgb by A,
// so backdrop*(1-A) + rgb is (up to a 20% dimming of the backdrop under lit pixels) a true additive result.
const cover = `uniform float uCap; vec3 softcap(vec3 c){ return c * uCap / (uCap + c); }
const float AK = 0.8; vec4 outc(vec3 c){ float m = max(c.r, max(c.g, c.b)); return vec4(c / AK, AK * smoothstep(0.0, 0.02, m)); }`;

/* ---------- resolved stars: Int16 positions (unit kpc), Uint8 colour+brightness class */
export function starMaterial(o = {}) {
  return new T.ShaderMaterial({
    ...ADD,
    uniforms: { uCap: shared.uCap, uPxPerKpc: shared.uPxPerKpc, uDpr: shared.uDpr, uFade: shared.uFade, uGain: shared.uGain, uUnit: { value: o.unit || 0.001 }, uBase: { value: o.base || 1.5 }, uAmp: { value: o.amp || 1 }, uBig: { value: o.big === undefined ? 6 : o.big }, uHalo: { value: o.halo || 0 }, uCull: { value: o.cull || 0 } },
    vertexShader: `
      attribute vec4 aCol; uniform float uDpr, uBase, uUnit, uBig; varying vec4 vC;
      void main(){
        float b = aCol.a; vec4 mv = modelViewMatrix * vec4(position * uUnit, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = uDpr * uBase * (0.9 + uBig * 0.4 * b * b);
        vC = vec4(aCol.rgb, b);
      }`,
    fragmentShader: `${toLin}${cover}
      uniform float uFade, uGain, uAmp, uHalo; varying vec4 vC;
      void main(){
        vec2 p = gl_PointCoord - 0.5; float d = dot(p, p) * 4.0; if (d > 1.0) discard;
        float k = exp(-d * 3.4) * (1.0 - d * 0.35) + uHalo * exp(-d * 1.6) * (1.0 - d);
        vec3 c = toLin(vC.rgb) * k * uFade * uGain * uAmp * (0.5 + 3.0 * vC.a * vC.a);
        gl_FragColor = outc(c);
      }`,
  });
}

/* ---------- soft blobs with a physical size (kpc) and a minimum pixel size: globular clusters, dwarfs, beacons, Sgr A* */
export function blobMaterial(o = {}) {
  return new T.ShaderMaterial({
    ...ADD,
    uniforms: { uCap: shared.uCap, uPxPerKpc: shared.uPxPerKpc, uDpr: shared.uDpr, uFade: shared.uFade, uAmp: { value: o.amp || 1 }, uMaxPx: { value: o.maxPx || 400 }, uBeacon: { value: o.beacon === undefined ? 1 : o.beacon }, uHide: { value: o.hide || 0 }, uTex: { value: o.tex || null }, uUseTex: { value: o.tex ? 1 : 0 } },
    vertexShader: `
      attribute vec4 aCol; attribute vec2 aSz; uniform float uPxPerKpc, uDpr, uMaxPx, uHide; varying vec4 vC; varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        float phys = aSz.x * 2.0 * uPxPerKpc * uDpr; float px = max(aSz.y * uDpr, phys); px = min(px, uMaxPx * uDpr);
        gl_PointSize = px; vC = aCol; vC.a *= 1.0 / (1.0 + 0.012 * px / uDpr);
        // when the physical disc is bigger than ~ (hide) pixels the textured galaxy has taken over; fade the beacon
        vA = uHide > 0.5 ? 1.0 - smoothstep(18.0, 46.0, phys / uDpr) : 1.0;
      }`,
    fragmentShader: `${toLin}${cover}
      uniform float uFade, uAmp, uUseTex; uniform sampler2D uTex; varying vec4 vC; varying float vA;
      void main(){
        vec2 p = gl_PointCoord - 0.5; float d = dot(p, p) * 4.0; if (d > 1.0) discard;
        float k = exp(-d * 4.2) * (1.0 - d * d);
        vec3 c = toLin(vC.rgb) * k * vC.a * uFade * uAmp * vA;
        if (uUseTex > 0.5) { vec4 t = texture2D(uTex, gl_PointCoord); c = t.rgb * t.a * uFade * uAmp * vA; }
        gl_FragColor = outc(c);
      }`,
  });
}

/* ---------- the galactic disc plane: glow (additive) or dust (normal), global map + higher-resolution Sun-centred map, shader detail noise */
const NOISE = `
float h21(vec2 p){ p = mod(p, 2048.0); vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0); return mix(mix(h21(i), h21(i + vec2(1,0)), f.x), mix(h21(i + vec2(0,1)), h21(i + vec2(1,1)), f.x), f.y); }
float detail(vec2 w, float pxk){ // w in kpc; octaves fade out when their period is < ~3 px so nothing aliases
  float s = 0.0, a = 0.5, tot = 0.0, f = 7.0;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8); vec2 q = w;
  for (int i = 0; i < 5; i++) { q = rot * q + 3.7; float vis = smoothstep(16.0, 34.0, pxk / f); s += a * vis * vn(q * f + float(i) * 13.1); tot += a * vis; a *= 0.55; f *= 2.3; }
  return tot > 0.0 ? s / tot : 0.5; }
`;

export function discMaterial(o) {
  // o: { glow, dust, glowLocal, dustLocal, mode:'glow'|'dust', ext, cx, cy (GC frame offsets), R0, localExt }
  const glow = o.mode === 'glow';
  const m = new T.ShaderMaterial({
    ...(glow ? ADD : { transparent: true, depthWrite: false, depthTest: false, blending: T.NormalBlending }),
    uniforms: { uMul: { value: 1 }, uCap: shared.uCap, uPxPerKpc: shared.uPxPerKpc, uFade: shared.uFade, uDetail: shared.uDetail, uMap: { value: o.map }, uMapL: { value: o.mapLocal || o.map }, uHasL: { value: o.mapLocal ? 1 : 0 }, uExt: { value: o.ext }, uLExt: { value: o.localExt || 12 }, uOff: { value: new T.Vector2(o.offX || 0, o.offY || 0) }, uGain: { value: o.gain || 1 }, uDetAmp: { value: o.detAmp === undefined ? 0.5 : o.detAmp }, uDustCol: { value: new T.Color(o.dustCol || 0x1b0b1c) }, uEdge: { value: o.edge || 0.0 } },
    vertexShader: `
      varying vec2 vW; void main(){ vW = position.xz; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `${toLin}${cover}${NOISE}
      uniform sampler2D uMap, uMapL; uniform float uMul, uHasL, uExt, uLExt, uFade, uGain, uDetAmp, uDetail, uPxPerKpc, uEdge; uniform vec2 uOff; uniform vec3 uDustCol; varying vec2 vW;
      void main(){
        // plane-local coords: x right, z toward the camera (down the page); the face-on map has +Y (up the page) = -z
        vec2 uv = vec2(vW.x / uExt + 0.5, (-vW.y - uOff.y) / uExt + 0.5);
        vec2 q = abs(uv - 0.5); float inside = 1.0 - smoothstep(0.46, 0.5, max(q.x, q.y)); if (inside <= 0.0) discard;
        vec4 g = texture2D(uMap, uv);
        if (uHasL > 0.5) { vec2 ul = vec2(vW.x / uLExt + 0.5, -vW.y / uLExt + 0.5); float wl = 1.0 - smoothstep(0.22, 0.46, length(ul - 0.5)); if (wl > 0.0) g = mix(g, texture2D(uMapL, ul), wl); }
        float n = detail(vW, uPxPerKpc); float dm = 1.0 + uDetAmp * uDetail * (n - 0.5) * 2.0;
        ${glow ? `
        vec3 c = g.rgb * uGain * uFade * uMul * inside * dm;
        float pk = max(c.r, max(c.g, c.b));
        c = softcap(toLin(c));  // textures hold display-referred colour; undo for the linear target
        gl_FragColor = outc(c);` : `
        float a = clamp(g.r * uGain * (1.0 + 0.5 * uDetAmp * uDetail * (n - 0.5) * 2.0), 0.0, 0.82) * uFade * uMul * inside;
        gl_FragColor = vec4(toLin(uDustCol), a);`}
      }`,
  });
  return m;
}

/* ---------- plane for other galaxies: unit square scaled by ext, own texture */
export function galaxyPlaneMaterial(o) {
  const glow = o.mode === 'glow';
  return new T.ShaderMaterial({
    ...(glow ? ADD : { transparent: true, depthWrite: false, depthTest: false, blending: T.NormalBlending }),
    side: T.DoubleSide,
    uniforms: { uMul: { value: 1 }, uCap: shared.uCap, uFade: shared.uFade, uMap: { value: o.map }, uGain: { value: o.gain || 1 }, uDustCol: { value: new T.Color(o.dustCol || 0x1b0b1c) } },
    vertexShader: o.billboard ? `varying vec2 vUv; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy * vec2(length(modelViewMatrix[0].xyz), length(modelViewMatrix[1].xyz)); gl_Position = projectionMatrix * mv; }` : `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${toLin}${cover}
      uniform sampler2D uMap; uniform float uMul, uFade, uGain; uniform vec3 uDustCol; varying vec2 vUv;
      void main(){
        vec2 q = abs(vUv - 0.5); float inside = 1.0 - smoothstep(0.44, 0.5, max(q.x, q.y)); if (inside <= 0.0) discard;
        vec4 g = texture2D(uMap, vUv);
        ${glow ? `vec3 c = softcap(toLin(g.rgb * g.a * uGain)) * uFade * uMul * inside; gl_FragColor = outc(c);` : `gl_FragColor = vec4(toLin(uDustCol), clamp(g.r * uGain, 0.0, 0.97) * uFade * uMul * inside);`}
      }`,
  });
}

/* ---------- galaxy glyphs: one point sprite per real galaxy, drawn procedurally by morphological type
 * (type 0 = smooth elliptical/dSph, 1 = spiral with a bulge and two arms, 2 = irregular/dwarf blob), with the catalogue's apparent axis ratio and a position angle.
 * Size = max(physical diameter, minPx), so far galaxies stay legible as little shapes rather than dots. */
export function glyphMaterial(o = {}) {
  return new T.ShaderMaterial({
    ...ADD,
    uniforms: { uCap: { value: 0.62 }, uPxPerKpc: shared.uPxPerKpc, uDpr: shared.uDpr, uFade: shared.uFade, uAmp: { value: o.amp || 1 }, uMaxPx: { value: o.maxPx || 56 }, uMinPx: { value: o.minPx || 3.5 } },
    vertexShader: `
      attribute vec4 aCol; attribute vec2 aSz; attribute vec4 aShp; uniform float uPxPerKpc, uDpr, uMaxPx, uMinPx; varying vec4 vC; varying vec4 vS; varying float vPx;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        float phys = aSz.x * 2.0 * uPxPerKpc; float px = clamp(max(phys, uMinPx * (0.6 + 0.4 * aCol.a)), 1.0, uMaxPx); gl_PointSize = px * uDpr; vPx = px; vC = aCol; vS = aShp; }`,
    fragmentShader: `${toLin}${cover}
      uniform float uFade, uAmp; varying vec4 vC; varying vec4 vS; varying float vPx;
      void main(){
        vec2 p = (gl_PointCoord - 0.5) * 2.0; float cs = cos(vS.y), sn = sin(vS.y); p = vec2(cs * p.x + sn * p.y, -sn * p.x + cs * p.y); p.y /= max(vS.z, 0.12);
        float r = length(p); if (r > 1.0) discard;
        float k;
        if (vS.x < 0.5) { k = exp(-r * 4.2) * 1.4 + 0.12 * exp(-r * 1.6); }
        else if (vS.x < 1.5) { float th = atan(p.y, p.x); float arm = 0.5 + 0.5 * cos(2.0 * (th - 3.2 * log(r + 0.05)) + vS.w * 6.0);
          float bulge = exp(-r * 9.0) * 1.8; float disc = exp(-r * 2.8) * (0.35 + 0.9 * arm * smoothstep(0.1, 0.35, r)); k = bulge + disc; }
        else { float th = atan(p.y, p.x); float n = 0.65 + 0.35 * sin(th * 3.0 + vS.w * 20.0) * sin(th * 5.0 + vS.w * 9.0); k = exp(-r * 3.0) * n * 1.1; }
        k *= (1.0 - r * r);
        vec3 c = toLin(vC.rgb) * k * (0.35 + 1.6 * vC.a) * uFade * uAmp; gl_FragColor = outc(softcap(c));
      }`,
  });
}
