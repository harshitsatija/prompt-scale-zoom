/* Materials for the cosmic-web level. All light is additive through CustomBlending (ONE,ONE; alpha = MAX) so the engine's
 * `mix(backdrop, rgb, alpha)` composite keeps a coverage alpha; see levels/galaxy/shaders.js for the same convention. */
import * as T from '../../vendor/three.module.js';

const ADD = { blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneFactor, blendEquationAlpha: T.MaxEquation, blendSrcAlpha: T.OneFactor, blendDstAlpha: T.OneFactor, transparent: true, depthWrite: false, depthTest: false };

export const shared = { uPxPerMpc: { value: 3 }, uDpr: { value: 1 }, uVis: { value: 1 }, uTime: { value: 0 }, uShell: { value: 0 }, uShellFront: { value: 0 }, uCamObj: { value: new T.Vector3() }, uPole: { value: new T.Vector3(0, 1, 0) }, uRmax: { value: 14260 }, uCmbGain: { value: 0.45 }, uSlab: { value: 1e9 }, uMorph: { value: 0 }, uGate: { value: new T.Vector2(0, 0) }, uRes: { value: new T.Vector2(1600, 1000) } };

const SCREEN = { ...ADD, blendDst: T.OneMinusSrcColorFactor };
const toLin = `vec3 toLin(vec3 c){ return pow(max(c, vec3(0.0)), vec3(2.2)); }`;
const AKC = `const float AK = 0.8; vec4 outc(vec3 c){ float m = max(c.r, max(c.g, c.b)); return vec4(c / AK, AK * smoothstep(0.0, 0.015, m)); }`;

/* galaxy palette by environment class d (0 = void/field ... 1 = cluster core):  periwinkle -> teal -> cream -> amber */
const OUTP = `vec4 outp(vec3 c){ float m = max(c.r, max(c.g, c.b)); return vec4(c / AK, AK * clamp(m / 0.5, 0.0, 1.0)); }`;
const PAL = `vec3 pal(float d){
  vec3 a = vec3(0.50, 0.60, 1.00), b = vec3(0.64, 0.78, 1.00), c = vec3(0.84, 0.91, 1.00), e = vec3(1.00, 0.93, 0.82);
  vec3 r = mix(a, b, smoothstep(0.12, 0.42, d)); r = mix(r, c, smoothstep(0.46, 0.74, d)); r = mix(r, e, 0.38 * smoothstep(0.80, 1.0, d)); return r; }`;

/* A set of points: Int16 positions (unit Mpc) + 2 bytes (density<<2|kind, brightness).
 * The camera-space depth is used for a slab: only galaxies within +-uSlab (engine units) of the focus plane are drawn, so each frame shows a THICK SLICE of the
 * real universe (like a redshift-survey wedge plot) and not 2.6 M overlapping line-of-sight points. Sprite size is perspective-correct. */
export function pointMaterial(o = {}) {
  return new T.ShaderMaterial({
    ...SCREEN,
    uniforms: { uRes: shared.uRes, uPxPerMpc: shared.uPxPerMpc, uDpr: shared.uDpr, uVis: shared.uVis, uTime: shared.uTime, uSlab: shared.uSlab, uMorph: o.morph ? shared.uMorph : { value: 0 },
      uUnit: { value: o.unit }, uSizeMpc: { value: o.sizeMpc || 0.15 }, uMinPx: { value: o.minPx || 1.8 }, uMaxPx: { value: o.maxPx || 6 }, uGain: { value: o.gain || 1 },
      uSizeR: { value: o.sizeR || 0 }, uGainR: { value: o.gainR || 0 }, uDmin: { value: o.dmin || 0 }, uComp: { value: o.comp === undefined ? 1.7 : o.comp },
      uGate: shared.uGate, uRealBoost: { value: o.realBoost === undefined ? 1.4 : o.realBoost }, uFillK: { value: o.fillK === undefined ? 1.0 : o.fillK }, uNearFade: { value: o.nearFade || 1.5 },
      uDLo: { value: o.dlo === undefined ? 0.2 : o.dlo }, uDHi: { value: o.dhi === undefined ? 1.5 : o.dhi }, uDSize: { value: o.dsize === undefined ? 0.6 : o.dsize }, uSub: { value: o.sub === undefined ? 1.0 : o.sub } },
    vertexShader: `
      attribute vec2 aA; ${o.morph ? 'attribute float aR; uniform float uMorph;' : ''} uniform float uUnit, uSizeMpc, uMinPx, uMaxPx, uDpr, uPxPerMpc, uGain, uSizeR, uGainR, uDmin, uComp, uRealBoost, uFillK, uNearFade, uSlab, uDLo, uDHi, uDSize, uSub; uniform vec2 uGate;
      varying vec4 vC;
      ${PAL}
      float hash(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
      void main(){
        float dc = floor(aA.x / 4.0) / 63.0, kind = aA.x - floor(aA.x / 4.0) * 4.0, b = aA.y / 255.0;
        vec3 p = position * uUnit; float rr = length(p); float rr0 = rr;
        ${o.morph ? 'p *= mix(1.0, aR / max(rr, 1.0), uMorph); rr = length(p);' : ''}
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        float depth = -mv.z;
        float slab = 1.0 - smoothstep(0.55 * uSlab, uSlab, abs(depth - 16.0));
        float h = hash(float(gl_VertexID));
        float dens = smoothstep(0.14, 0.66, dc);
        float phys = (uSizeMpc + uSizeR * rr) * (0.75 + 0.5 * h) * (1.0 + uDSize * dens) * uPxPerMpc * (16.0 / max(depth, 1.0));
        float px = clamp(phys, uMinPx, uMaxPx);
        float flux = pow(uMinPx / px, uComp) * min(1.0, pow(phys / uMinPx, uSub));
        float isReal = (kind < 1.5) ? 1.0 : 0.0;
        float real = mix(uFillK, uRealBoost, isReal);
        float nf = smoothstep(0.35, uNearFade, depth);
        float dw = mix(uDLo, 1.0, dens) * (1.0 + uDHi * smoothstep(0.55, 1.0, dc));
        float g = uGain * (1.0 + uGainR * rr) * flux * nf * real * dw * slab * (0.45 + 0.9 * b * b) * smoothstep(uGate.x, max(uGate.y, uGate.x + 1e-3), rr0); g = min(g, 1.5);
        if (dc < uDmin || slab < 0.003) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }
        gl_PointSize = px * uDpr;
        vec3 col = pal(dc); col = mix(col, vec3(0.92, 0.94, 1.0), 0.22); col = mix(col, vec3(1.0, 0.95, 0.86), 0.10 * isReal); col = mix(col, vec3(0.55, 0.58, 1.0), 0.50 * smoothstep(350.0, 3200.0, rr));   // redshift tint: far = cool violet
        vC = vec4(col, g);
      }`,
    fragmentShader: `${toLin}${AKC}${OUTP}
      uniform float uVis, uDpr; uniform vec2 uRes; varying vec4 vC;
      void main(){
        vec2 q = gl_PointCoord - 0.5; float d = dot(q, q) * 4.0; if (d > 1.0) discard;
        vec2 fp = gl_FragCoord.xy / uDpr; float tyy = uRes.y / uDpr - fp.y;
        float tl = 1.0 - 0.7 * (1.0 - smoothstep(70.0, 120.0, tyy)) * (1.0 - smoothstep(380.0, 520.0, fp.x));   // keep the title / subtitle readable
        float k = exp(-d * 4.2) * (1.0 - smoothstep(0.35, 1.0, d));   // Gaussian that reaches exactly 0 at the sprite edge (no rim, no square halo)
        vec3 c = toLin(vC.rgb) * k * vC.a * uVis * tl;
        c = 1.0 - exp(-c);
        gl_FragColor = outp(c);
      }`,
  });
}

/* the Local Volume: 865 real galaxies of the Karachentsev+2013 catalogue, drawn as soft smudges sized by stellar mass; late types blue-teal, early types cream-amber */
export function localMaterial() {
  return new T.ShaderMaterial({
    ...SCREEN,
    uniforms: { uPxPerMpc: shared.uPxPerMpc, uDpr: shared.uDpr, uVis: shared.uVis, uGain: { value: 1 } },
    vertexShader: `attribute vec3 aL; attribute vec2 aE; attribute float aH; uniform float uPxPerMpc, uDpr, uGain; varying vec4 vC; varying float vL, vH; varying vec3 vE;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        float lum = aL.x, early = aL.y, sd = aL.z;
        float depth = -mv.z; float rel = 16.0 / max(depth, 1.0);
        float px = clamp((0.030 + 0.165 * lum * lum) * uPxPerMpc * rel * (0.85 + 0.3 * sd), 4.5, 80.0);   // major axis, ~1.4x the true stellar disc
        if (aH > 0.0) px = clamp(aH * 3.2 * uPxPerMpc * rel, 26.0, 150.0);                              // the big spirals (MW, M31, M33, ...): true disc diameter aH (Mpc), drawn 3x so they read as discs
        gl_PointSize = px * uDpr; vL = lum; vH = aH > 0.0 ? 1.0 : 0.0; vE = vec3(aE.x, cos(aE.y), sin(aE.y));
        vec3 late = vec3(0.52, 0.80, 1.0), earlyc = vec3(1.0, 0.84, 0.58); vC = vec4(mix(late, earlyc, clamp(early, 0.0, 1.0)), uGain * (0.42 + 0.9 * lum) * smoothstep(0.35, 1.5, depth)); }`,
    fragmentShader: `${toLin}${AKC}${OUTP} uniform float uVis; varying vec4 vC; varying float vL, vH; varying vec3 vE;
      void main(){ vec2 q = (gl_PointCoord - 0.5) * 2.0; vec2 r = vec2(vE.y * q.x + vE.z * q.y, -vE.z * q.x + vE.y * q.y); r.y /= max(vE.x, 0.15);
        float d = dot(r, r); if (dot(q, q) > 1.0) discard;
        if (vH > 0.5) {   // stylised spiral: bulge + two log-spiral arms + disc, inclined by vE.x (axis ratio) at position angle vE.yz
          float rho = sqrt(d) * 0.62, ang = atan(r.y, r.x), arms = pow(max(0.5 + 0.5 * cos(2.0 * ang - 5.2 * log(rho + 0.07)), 0.0), 1.4);
          float disc = exp(-rho * 3.0) * (0.30 + 0.85 * arms) * (1.0 - smoothstep(0.55, 0.98, rho)) * smoothstep(0.0, 0.05, rho), bulge = exp(-rho * rho * 90.0) * 1.5, halo = exp(-dot(q, q) * 6.0) * 0.12;
          vec3 cArm = vec3(0.45, 0.78, 1.0), cCore = vec3(1.0, 0.88, 0.62); vec3 col = mix(cArm, cCore, clamp(bulge * 0.7 + exp(-rho * 7.0) * 0.5, 0.0, 1.0));
          vec3 c = toLin(col) * (disc * 1.1 + bulge + halo) * vC.a * 1.25 * uVis; c = 1.0 - exp(-c); gl_FragColor = outp(c); return; }
        float core = exp(-d * 40.0), disc = exp(-sqrt(d) * 4.2) * (0.45 + 0.6 * vL) * (1.0 - smoothstep(0.6, 1.0, sqrt(d))), halo = exp(-dot(q, q) * 5.0) * 0.16;
        vec3 c = toLin(vC.rgb) * (core * 1.2 + disc * 0.6 + halo) * vC.a * uVis; c = 1.0 - exp(-c); gl_FragColor = outp(c); }`,
  });
}

/* a single soft marker of fixed pixel size: a core, a glow and a thin ring (the Milky Way / 'her', and the markers of named structures) */
export function markerMaterial(color, px, ring = 0.22) {
  return new T.ShaderMaterial({
    ...SCREEN,
    uniforms: { uDpr: shared.uDpr, uVis: { value: 1 }, uPx: { value: px }, uCol: { value: new T.Color(color) }, uGain: { value: 1 }, uRing: { value: ring } },
    vertexShader: `uniform float uPx, uDpr; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * uDpr; }`,
    fragmentShader: `${toLin}${AKC} uniform vec3 uCol; uniform float uVis, uGain, uRing;
      void main(){ vec2 q = gl_PointCoord - 0.5; float d = dot(q, q) * 4.0; if (d > 1.0) discard;
        float core = exp(-d * 28.0), glow = exp(-d * 4.5) * 0.45, ring = exp(-pow((sqrt(d) - 0.62) * 9.0, 2.0)) * uRing;
        vec3 c = toLin(uCol) * (core * 1.2 + glow + ring) * uGain * uVis; gl_FragColor = outc(c); }`,
  });
}

/* small ring markers for named structures: per-point colour/alpha, ring + faint disc, fixed pixel size */
export function ringsMaterial() {
  return new T.ShaderMaterial({
    ...SCREEN,
    uniforms: { uDpr: shared.uDpr, uPx: { value: 20 } },
    vertexShader: `attribute vec4 aC; uniform float uPx, uDpr; varying vec4 vC; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * uDpr; vC = aC; }`,
    fragmentShader: `${toLin}${AKC} varying vec4 vC; void main(){ vec2 q = gl_PointCoord - 0.5; float d = dot(q, q) * 4.0; if (d > 1.0) discard;
      float ring = exp(-pow((sqrt(d) - 0.72) * 11.0, 2.0)), dot_ = exp(-d * 60.0) * 0.8;
      vec3 c = toLin(vC.rgb) * (ring * 0.9 + dot_) * vC.a; gl_FragColor = outc(c); }`,
  });
}

/* dotted annotation outlines (Laniakea / void rings): fixed-size soft dots with per-point colour and alpha */
export function dotsMaterial(px) {
  return new T.ShaderMaterial({
    ...SCREEN,
    uniforms: { uDpr: shared.uDpr, uPx: { value: px } },
    vertexShader: `attribute vec4 aC; uniform float uPx, uDpr; varying vec4 vC; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * uDpr; vC = aC; }`,
    fragmentShader: `${toLin}${AKC} varying vec4 vC; void main(){ vec2 q = gl_PointCoord - 0.5; float d = dot(q, q) * 4.0; if (d > 1.0) discard;
      vec3 c = toLin(vC.rgb) * exp(-d * 5.0) * vC.a; gl_FragColor = outc(c); }`,
  });
}

/* leader lines: thin lines with per-vertex colour (alpha folded into the colour) */
export function leaderMaterial() {
  return new T.ShaderMaterial({
    ...SCREEN,
    vertexShader: `attribute vec4 aC; varying vec4 vC; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vC = aC; }`,
    fragmentShader: `${toLin}${AKC} varying vec4 vC; void main(){ gl_FragColor = outc(toLin(vC.rgb) * vC.a); }`,
  });
}

/* Outside the observable universe there is nothing: a screen-filling replica of the engine's violet well (no flare stars) that takes over the backdrop as z rises. */
export function voidMaterial() {
  return new T.ShaderMaterial({
    ...ADD,
    uniforms: { uRes: shared.uRes, uA: { value: 0 } },
    vertexShader: `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform vec2 uRes; uniform float uA;
      void main(){ vec2 vUv = gl_FragCoord.xy / uRes; vec2 asp = vec2(uRes.x / uRes.y, 1.0); vec2 qq = (vUv - vec2(0.5, 0.55)) * asp; float rr = length(qq);
        vec3 bg = mix(vec3(0.115, 0.095, 0.30), vec3(0.035, 0.03, 0.115), smoothstep(0.0, 0.95, rr));
        bg += vec3(0.30, 0.10, 0.34) * 0.22 * exp(-pow(length(qq - vec2(0.42, 0.18)) * 2.1, 2.0)) + vec3(0.06, 0.30, 0.36) * 0.20 * exp(-pow(length(qq + vec2(0.45, 0.2)) * 2.4, 2.0));
        gl_FragColor = vec4(pow(bg, vec3(2.2)), uA); }`,
  });
}

/* Volumetric haze: a smooth density field (two periodic Zel'dovich LCDM boxes, tiled with different rotations/scales so the repeat is invisible) ray-marched through a
 * slab of the universe around the focus plane. Homogeneous on large scales (the real universe is), so it fills the whole field out to the CMB shell; the sampling
 * level follows the pixel footprint so sub-pixel structure averages away instead of aliasing. Drawn as a screen quad that rebuilds its own rays from the camera matrices. */
export function hazeMaterial(texA, texB) {
  return new T.ShaderMaterial({
    ...SCREEN,
    uniforms: { uA: { value: texA }, uB: { value: texB }, uRes: shared.uRes, uR: shared.uRmax, uSlabMpc: { value: 150 }, uGain: { value: 1 }, uBias: { value: 0.35 }, uInner: { value: 0.3 }, uContrast: { value: 1 }, uWarm: { value: 0 }, uCmb: shared.uShell, uVis: shared.uVis },
    vertexShader: `uniform vec2 uRes; varying vec3 vO, vD, vF; varying float vPx;
      void main(){ gl_Position = vec4(position.xy, 0.0, 1.0);
        mat4 iMV = inverse(modelViewMatrix); mat4 iP = inverse(projectionMatrix);
        vec4 v = iP * vec4(position.xy, 1.0, 1.0); vec3 dv = v.xyz / v.w;
        vD = mat3(iMV) * dv; vO = (iMV * vec4(0.0, 0.0, 0.0, 1.0)).xyz; vF = mat3(iMV) * vec3(0.0, 0.0, -1.0);
        vPx = 2.0 / (projectionMatrix[1][1] * uRes.y); }`,
    fragmentShader: `${toLin}${AKC}
      precision highp sampler3D;
      uniform sampler3D uA, uB; uniform float uR, uSlabMpc, uGain, uInner, uVis, uBias, uContrast, uWarm; varying vec3 vO, vD, vF; varying float vPx;
      const mat3 RA = mat3(0.36, 0.48, -0.80, -0.93, 0.15, -0.34, -0.07, 0.86, 0.50), RB = mat3(0.60, -0.64, 0.48, 0.74, 0.20, -0.64, 0.30, 0.74, 0.60);
      float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
      ${PAL}
      void main(){
        vec3 d = normalize(vD), f = normalize(vF), o = vO; float c = dot(d, f), of = dot(o, f);
        float S = uSlabMpc, bq = dot(o, d), cc = dot(o, o) - uR * uR, disc = bq * bq - cc;
        if (disc <= 0.0 || c < 1e-4) { gl_FragColor = vec4(0.0); return; }
        float sq = sqrt(disc), t0 = max(max((-S - of) / c, -bq - sq), 0.0), t1 = min((S - of) / c, -bq + sq);
        if (t1 <= t0) { gl_FragColor = vec4(0.0); return; }
        const int N = 22; float dt = (t1 - t0) / float(N), j = ign(gl_FragCoord.xy);
        float acc = 0.0, hue = 0.0;
        for (int i = 0; i < N; i++) {
          float t = t0 + (float(i) + j) * dt; vec3 p = o + d * t;
          float fp = max(dt, t * vPx);
          float la = clamp(log2(fp / 6.0) + uBias, 0.0, 5.0), lb = clamp(log2(fp / 9.0) + uBias, 0.0, 5.0);
          float a = textureLod(uA, fract(RA * p / 768.0 + vec3(0.13, 0.57, 0.31)), la).r, b = textureLod(uB, fract(RB * p / 1152.0 + vec3(0.71, 0.22, 0.46)), lb).r;
          float rho = a * 0.78 + b * 0.22;
          float rr = length(p); float m = mix(uInner, 1.0, smoothstep(250.0, 2300.0, rr));
          acc += m; hue += rho;
        }
        acc /= float(N); hue /= float(N);
        // soft, low-contrast field (no threshold, no banding): the real density field is near-homogeneous above ~100 Mpc, so deep slices read as a smooth cloudy haze with faint filament texture
        float dd = smoothstep(0.04, 0.9, hue); dd = (0.04 + 0.96 * dd * dd * (1.2 - 0.2 * dd)) * acc * uContrast;
        vec3 col = mix(vec3(0.20, 0.23, 0.70), vec3(0.42, 0.62, 0.90), smoothstep(0.35, 1.0, dd));
        col = mix(col, mix(vec3(0.50, 0.60, 1.0), vec3(0.84, 0.91, 1.0), smoothstep(0.3, 0.9, dd)), uWarm);   // inside the CMB sphere the web reads as warm cream / teal against the violet shell
        float edgeSoft = smoothstep(0.0, 0.35 * uR * uR, disc); vec3 lin = toLin(col) * dd * uGain * uVis * 0.95 * edgeSoft; lin = 1.0 - exp(-lin);
        gl_FragColor = outc(lin);
      }`,
  });
}

/* the Planck CMB shell, seen from outside as the inside of a sphere: the real SMICA temperature pattern, smoothed to ~2 degrees (mip level) and mapped onto a narrow
 * indigo - lavender ramp so it reads as a soft gradient, lit gently from the upper left; the limb dissolves into the space colour (no rim, no outline). */
export function shellMaterial(map, back) {
  return new T.ShaderMaterial({
    ...ADD, side: T.BackSide,
    uniforms: { uMap: { value: map }, uShell: shared.uShell, uCam: shared.uCamObj, uR: shared.uRmax, uGain: shared.uCmbGain },
    vertexShader: `varying vec3 vP; varying vec3 vN; void main(){ vP = position; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${toLin}
      uniform samplerCube uMap; uniform float uShell, uR, uGain; uniform vec3 uCam; varying vec3 vP; varying vec3 vN;
      void main(){
        vec3 d = normalize(vP);
        float t = (textureLod(uMap, d, 5.0).r * 255.0 - 128.0) / 127.0 * 340.0;
        float s = clamp(0.5 + t / 800.0, 0.0, 1.0);
        vec3 cold = vec3(0.14, 0.13, 0.44), hot = vec3(0.36, 0.34, 0.70);
        vec3 tex = mix(cold, hot, s * s * (3.0 - 2.0 * s));
        vec3 v = normalize(uCam - vP); float cs = abs(dot(d, v));
        float soft = pow(cs, 0.85);                         // soft limb: the shell thins to nothing at the silhouette
        float shade = 0.86 + 0.16 * (-0.55 * vN.x + 0.8 * vN.y);   // gentle light from the upper left, slightly deeper toward the limb
        float A = clamp(soft * uGain * uShell, 0.0, 1.0);   // coverage: the engine mixes the backdrop toward this colour
        gl_FragColor = vec4(toLin(tex * shade) * A, A);   // additive over the space colour: scaled by A so the limb and the fade-in vanish into the backdrop
      }`,
  });
}
