/* GLSL for the stars level. All world positions are in metres relative to the Sun; the engine scales the root by s = Wu/W (down to 1e-21),
 * so no matrix/vector in these shaders may be squared or normalised naively (length() of a 1e-21 vector underflows). We only ever
 * multiply positions by the model-view matrix (fine in float32) and use uS (= s, supplied from JS) for any metre -> world conversion. */

const SAFE_N = /* glsl */`
vec3 safeN(vec3 v){ float m = max(max(abs(v.x), abs(v.y)), max(abs(v.z), 1e-30)); v /= m; return v / max(length(v), 1e-20); }
`;

// ---------- star sprites: instanced screen-space quads, size from absolute magnitude through the zoom-dependent cut ----------
export const starVert = /* glsl */`
precision highp float;
attribute vec2 corner;
attribute vec3 iPos; attribute float iM; attribute vec4 iCol;
uniform float uMcut, uSizeK, uMaxSize, uSizeBoost, uS, uDf, uKd, uInvW, uR0, uR1, uBoost, uAmpK, uHero, uMBoost, uSunD;
uniform vec2 uRes, uClu; uniform vec4 uKind;
varying vec2 vP; varying vec3 vCol; varying float vI; varying float vSz; varying float vSpike;
void main(){
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  float dist = max(-mv.z, 1e-6) / uS;                          // metres from the camera along the view axis
  float rS = length(iPos * uInvW);                              // distance from the Sun in field widths
  float kind = floor(iCol.a * 255.0 + 0.5);
  bool clu = kind > 4.5; bool hero = kind > 2.5 && !clu;
  float kf = kind < 0.5 ? uKind.x : (kind < 1.5 ? uKind.y : (kind < 2.5 ? uKind.z : (kind < 3.5 ? uKind.w : (clu ? uClu.x : uHero))));
  float vol = kind > 2.5 ? 1.0 : 1.0 - smoothstep(uR0, uR1, rS);   // we show a sphere of ~2 field widths around the Sun
  float boost = uBoost * (1.0 - smoothstep(0.12, 0.40, rS)) * (kind > 2.5 ? 0.0 : 1.0);   // the Sun's immediate neighbours (red dwarfs) stay visible
  float dm = uMcut + boost - (iM - ((kind > 3.5 && !clu) ? uMBoost : 0.0)) - uKd * log(dist / uDf) / 2.302585;       // distance modulus: nearer than the focus plane = brighter
  if (clu) dm = max(dm, uClu.y);                                // open-cluster members stay visible as a swarm of dots
  if (dm < -0.6 || kf * vol < 0.01 || mv.z > -0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vP = vec2(0.0); vCol = vec3(0.0); vI = 0.0; vSz = 1.0; vSpike = 0.0; return; }
  float d = max(dm, 0.0);
  float d0 = max(dm - boost, 0.0);
  float size = min(1.5 + 0.17 * d0 * d0 + 0.05 * d, uMaxSize) * uSizeBoost * (kind > 2.5 && kind < 3.5 ? 0.8 : 1.0);
  if (hero) size = max(size, kind < 3.5 ? 8.0 : 9.0);
  if (kind > 2.5 && kind < 3.5) size = max(size, uSunD);          // the Sun: same size law as the solar level's sphere (its diameter in px, shrinking with the field), never smaller than a hero star          // the Sun and the named marquee stars always read as glowing stars, not as a label dot
  float amp = smoothstep(-0.6, 1.6, dm) * (0.30 + 0.70 * min(d / 6.0, 1.0));
  float hot = 1.0 + 0.9 * smoothstep(12.0, 24.0, size);        // only the hero stars exceed the bloom threshold
  if (clu) size = min(size, 5.5); else if (kind > 0.5 && kind < 1.5) size = min(size, 8.0);                                // cluster members are a swarm of dots, never flares
  float spike = smoothstep(10.0, 21.0, size) * (kind > 2.5 && kind < 3.5 ? 0.55 : 1.0) * 0.25;
  if (clu || (kind > 0.5 && kind < 1.5)) spike = 0.0;                // procedural fills never get diffraction spikes (they would stack into a grid)   // only the top ~1% of stars get diffraction spikes
  float ext = 1.0 + spike * 3.2;
  vec4 cp = projectionMatrix * mv;
  vec2 off = corner * (size * 0.5 * ext * uSizeK) * 2.0 / uRes;
  gl_Position = cp; gl_Position.xy += off * cp.w;
  vP = corner * ext; vCol = iCol.rgb; vI = amp * kf * vol * hot * uAmpK * (clu ? 0.7 : 1.0); vSz = size; vSpike = spike;
}`;
export const starFrag = /* glsl */`
precision highp float;
varying vec2 vP; varying vec3 vCol; varying float vI; varying float vSz; varying float vSpike;
void main(){
  if (vI <= 0.0) discard;
  float r = length(vP);                                  // 1.0 == the star's nominal radius
  float core = exp(-r * r * 5.2);
  float halo = 0.22 / (1.0 + r * r * 9.0) * (1.0 - smoothstep(1.4, 3.6, r));
  float sp = 0.0, ring = 0.0;
  if (vSpike > 0.001) {
    vec2 q = abs(vP);
    float h = exp(-q.y * (11.0 + 12.0 / (1.0 + q.x))) * exp(-q.x * 0.55);
    float v = exp(-q.x * (11.0 + 12.0 / (1.0 + q.y))) * exp(-q.y * 0.55);
    sp = (h + v) * 0.85 * vSpike * (1.0 - smoothstep(2.4, 3.9, max(q.x, q.y)));
    vec2 dgl = vec2(vP.x + vP.y, vP.x - vP.y) * 0.7071; vec2 qd = abs(dgl);
    sp += (exp(-qd.y * 16.0) + exp(-qd.x * 16.0)) * exp(-length(dgl) * 1.1) * 0.22 * smoothstep(0.55, 1.0, vSpike);
    ring = exp(-(r - 1.28) * (r - 1.28) * 56.25) * 0.0 * smoothstep(0.4, 1.0, vSpike);   // the Kurzgesagt-style halo ring round the hero flares
  }
  float I = (core * 0.70 + halo * 0.9 + sp + ring) * vI;
  vec3 col = mix(vCol, vec3(1.0, 0.97, 0.9), clamp(core * 0.6, 0.0, 0.7));
  col = mix(col, vCol * 1.1, clamp(ring * 2.0, 0.0, 0.8));
  vec3 o = col * I; gl_FragColor = vec4(o, smoothstep(0.003, 0.03, max(o.r, max(o.g, o.b))));
}`;

// ---------- Oort comets: tiny soft icy sparks with a depth cue ----------
export const sparkVert = /* glsl */`
precision highp float;
attribute vec2 corner; attribute vec4 iPos;
uniform float uSizeK, uOp, uInner; uniform vec2 uRes;
varying vec2 vP; varying float vI; varying vec3 vC;
void main(){
  vec4 mv = modelViewMatrix * vec4(iPos.xyz, 1.0);
  float depth = -mv.z;
  if (mv.z > -0.5) { gl_Position = vec4(2.0); vI = 0.0; vP = vec2(0.0); vC = vec3(0.0); return; }
  float near = smoothstep(0.5, 6.0, depth);
  bool inner = iPos.w >= 2.0; float tw = iPos.w - (inner ? 2.0 : 0.0);        // 0..1 random; +2 marks the inner (Hills) cloud
  float persp = clamp(16.0 / depth, 0.55, 2.4);                        // nearer comets look bigger, farther ones smaller
  float size = (0.62 + 0.8 * tw * tw * tw) * persp * uSizeK;
  vec4 cp = projectionMatrix * mv;
  gl_Position = cp; gl_Position.xy += corner * size * 2.0 / uRes * cp.w;
  vP = corner; vI = uOp * near * (0.10 + 0.50 * tw) * clamp(persp, 0.6, 1.5) * (inner ? uInner : 1.0);
  vC = tw > 0.9 ? vec3(0.62, 0.66, 0.78) : (tw > 0.5 ? vec3(0.42, 0.55, 0.78) : vec3(0.32, 0.42, 0.7));
}`;
export const sparkFrag = /* glsl */`
precision highp float; varying vec2 vP; varying float vI; varying vec3 vC;
void main(){ float r = length(vP); if (vI <= 0.0 || r > 1.0) discard; float c = exp(-r * r * 4.6) + 0.12 * (1.0 - r); vec3 o = vC * c * vI; gl_FragColor = vec4(o, smoothstep(0.003, 0.03, max(o.r, max(o.g, o.b)))); }`;

// ---------- cloudy fresnel membranes (Oort cloud, heliopause, Local Bubble) ----------
export const shellVert = /* glsl */`
precision highp float;
attribute vec3 aDir; attribute float aR;      // unit direction, radius (m)
uniform float uR; uniform vec3 uScale;
varying vec3 vN; varying vec3 vDir; varying float vFres; varying vec3 vV;
${SAFE_N}
void main(){
  vec3 p = aDir * (aR * uR) * uScale;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 nrm = safeN(mat3(modelViewMatrix) * normalize(aDir / uScale));
  vec3 vdir = safeN(-mv.xyz);
  vFres = 1.0 - abs(dot(nrm, vdir));
  vDir = aDir; vN = nrm;
  gl_Position = projectionMatrix * mv;
}`;
export const shellFrag = /* glsl */`
precision highp float;
uniform vec3 uColor; uniform float uOp, uPow, uNoise, uSeed, uBase;
varying vec3 vDir; varying float vFres;
float h3(vec3 p){ p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
void main(){
  float f = pow(clamp(vFres, 0.0, 1.0), uPow);
  float n = fbm(vDir * uNoise + uSeed);
  float cloud = mix(1.0, smoothstep(0.25, 0.8, n), 0.55);
  float I = (f * 0.9 + uBase) * cloud * uOp;
  vec3 o = uColor * I; gl_FragColor = vec4(o, smoothstep(0.003, 0.03, max(o.r, max(o.g, o.b))));
}`;

// ---------- nebula billboards: real imagery, additive, camera-facing quads of true physical size ----------
export const nebVert = /* glsl */`
precision highp float;
attribute vec2 corner;
uniform vec3 uC; uniform vec2 uHalf; uniform float uS;
varying vec2 vUv;
void main(){
  vec4 mv = modelViewMatrix * vec4(uC, 1.0);
  mv.xy += corner * uHalf * uS;
  vUv = corner * 0.5 + 0.5;
  gl_Position = projectionMatrix * mv;
}`;
export const nebFrag = /* glsl */`
precision highp float; uniform sampler2D uTex; uniform float uOp; uniform vec3 uTint; varying vec2 vUv;
void main(){ vec3 c = texture2D(uTex, vUv).rgb; vec3 o = c * uTint * uOp; gl_FragColor = vec4(o, smoothstep(0.003, 0.03, max(o.r, max(o.g, o.b)))); }`;

// ---------- spacecraft / marker dots: fixed-size amber core + ring ----------
export const markVert = /* glsl */`
precision highp float;
attribute vec2 corner; attribute vec3 iPos;
uniform float uSizeK, uPx; uniform vec2 uRes;
varying vec2 vP;
void main(){
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0); vec4 cp = projectionMatrix * mv;
  if (mv.z > -0.5) { gl_Position = vec4(2.0); vP = vec2(0.0); return; }
  gl_Position = cp; gl_Position.xy += corner * uPx * uSizeK * 2.0 / uRes * cp.w; vP = corner;
}`;
export const markFrag = /* glsl */`
precision highp float; varying vec2 vP; uniform float uOp, uCore; uniform vec3 uColor;
void main(){ float r = length(vP); float core = exp(-r * r * 38.0) * uCore, ring = exp(-(r - 0.62) * (r - 0.62) * 81.0) * 0.0; vec3 o = uColor * (core * 1.1 + ring) * uOp;
  gl_FragColor = vec4(o, smoothstep(0.003, 0.03, max(o.r, max(o.g, o.b)))); }`;

// ---------- camera-facing range rings (the silhouette of a distance sphere around the Sun) ----------
export const rangeVert = /* glsl */`
precision highp float;
uniform float uR, uS; varying float vD;
void main(){ vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy * uR * uS; gl_Position = projectionMatrix * mv; }`;
export const rangeFrag = /* glsl */`
precision highp float; uniform vec3 uColor;
void main(){ gl_FragColor = vec4(uColor, smoothstep(0.003, 0.03, max(uColor.r, max(uColor.g, uColor.b)))); }`;

// ---------- lathe shells with real normals (heliopause bubble, same profile as the solar level so the handover is seamless) ----------
export const latheVert = /* glsl */`
precision highp float;
varying vec3 vDir; varying float vFres;
${SAFE_N}
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 nrm = safeN(mat3(modelViewMatrix) * normal);
  vec3 vdir = safeN(-mv.xyz);
  vFres = 1.0 - abs(dot(nrm, vdir));
  vDir = normal;
  gl_Position = projectionMatrix * mv;
}`;

// ---------- drop-lines ("stalks") from stars down to the galactic plane, ESO solar-neighbourhood-map style ----------
export const stalkVert = /* glsl */`
precision highp float;
attribute float aD; attribute float aSide; uniform float uInvW, uOp; varying vec3 vC; varying float vA;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
  float q = aD * uInvW;                                          // star distance in field widths
  vA = uOp * smoothstep(0.06, 0.16, q) * (1.0 - smoothstep(0.35, 0.8, q));
  vC = aSide > 0.5 ? vec3(0.45, 0.85, 1.0) : vec3(1.0, 0.72, 0.38);
}`;
export const stalkFrag = /* glsl */`
precision highp float; varying vec3 vC; varying float vA;
void main(){ vec3 o = vC * vA; gl_FragColor = vec4(o, smoothstep(0.003, 0.03, max(o.r, max(o.g, o.b)))); }`;

// ---------- plain lines whose alpha follows their brightness (so a fading line vanishes instead of turning black under MAX-alpha compositing) ----------
export const lineVert = /* glsl */`
precision highp float;
void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const lineFrag = /* glsl */`
precision highp float; uniform vec3 uColor;
void main(){ gl_FragColor = vec4(uColor, smoothstep(0.003, 0.03, max(uColor.r, max(uColor.g, uColor.b)))); }`;

// ---------- Milky Way disc continuation: fixed-pixel soft points, colour = stellar population, intensity = per-point weight ----------
export const diskVert = /* glsl */`
precision highp float;
attribute vec2 corner; attribute vec3 iPos; attribute vec4 iCol;
uniform float uSizeK, uOp, uPx; uniform vec2 uRes;
varying vec2 vP; varying vec3 vC; varying float vI;
void main(){
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  if (mv.z > -0.5 || uOp <= 0.0) { gl_Position = vec4(2.0); vP = vec2(0.0); vC = vec3(0.0); vI = 0.0; return; }
  vec4 cp = projectionMatrix * mv;
  float sz = uPx * (0.7 + 0.9 * iCol.a);
  gl_Position = cp; gl_Position.xy += corner * sz * uSizeK * 2.0 / uRes * cp.w;
  vP = corner; vC = iCol.rgb; vI = uOp * (0.25 + 0.75 * iCol.a);
}`;
export const diskFrag = /* glsl */`
precision highp float; varying vec2 vP; varying vec3 vC; varying float vI;
void main(){ float r = length(vP); if (vI <= 0.0 || r > 1.0) discard; float c = exp(-r * r * 3.8); vec3 o = vC * c * vI; gl_FragColor = vec4(o, smoothstep(0.003, 0.03, max(o.r, max(o.g, o.b)))); }`;

// ---------- full-screen veil: repaints the engine's violet backdrop (same gradient, linear) so its screen-fixed flare stars are hidden ----------
export const veilVert = /* glsl */`
precision highp float; attribute vec2 corner;
void main(){ gl_Position = vec4(corner, 0.99999, 1.0); }`;
export const veilFrag = /* glsl */`
precision highp float; uniform float uOp; uniform vec2 uRes;
void main(){
  if (uOp <= 0.001) discard;
  vec2 uv = gl_FragCoord.xy / uRes; vec2 asp = vec2(uRes.x / uRes.y, 1.0); vec2 qq = (uv - vec2(0.5, 0.55)) * asp; float rr = length(qq);
  vec3 bg = mix(vec3(0.115, 0.095, 0.30), vec3(0.035, 0.03, 0.115), smoothstep(0.0, 0.95, rr));
  bg += vec3(0.30, 0.10, 0.34) * 0.22 * exp(-pow(length(qq - vec2(0.42, 0.18)) * 2.1, 2.0)) + vec3(0.06, 0.30, 0.36) * 0.20 * exp(-pow(length(qq + vec2(0.45, 0.2)) * 2.4, 2.0));
  gl_FragColor = vec4(pow(bg, vec3(2.2)), uOp);
}`;


// ================================================================= round-3 additions =================================================================
const NOISE = /* glsl */`
float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
`;

// ---------- cel-ramped membranes (heliopause, termination shock, Local Bubble): 3 soft bands, shadow->light colour ramp, thin rim light at the limb ----------
export const celFrag = /* glsl */`
precision highp float;
uniform vec3 uColor, uColor2; uniform float uOp, uPow, uNoise, uSeed, uBase, uCel, uRim;
varying vec3 vDir; varying float vFres;
${NOISE}
void main(){
  float fr = clamp(vFres, 0.0, 1.0);
  float f = pow(fr, uPow);
  float n = fbm(vDir * uNoise + uSeed);
  float cloud = mix(1.0, smoothstep(0.22, 0.85, n), 0.62);
  float I = (f * 0.95 + uBase) * cloud;
  float band = (smoothstep(0.05, 0.11, I) + smoothstep(0.20, 0.28, I) + smoothstep(0.45, 0.56, I)) / 3.0;
  float Ic = mix(I, band * 0.95, uCel);
  float rim = smoothstep(0.90, 0.99, fr) * uRim;
  vec3 col = mix(uColor2, uColor, smoothstep(0.02, 0.8, Ic));
  col = mix(col, vec3(1.0, 0.95, 0.86), clamp(rim * 0.7, 0.0, 0.8));
  vec3 o = col * (Ic + rim * 0.55) * uOp;
  gl_FragColor = vec4(o, smoothstep(0.003, 0.03, max(o.r, max(o.g, o.b))));
}`;

// ---------- Oort cloud as a column-density haze: the outer cloud (isotropic, soft power-law) and the inner Hills disc (flattened, denser) ----------
export const hazeVert = /* glsl */`
precision highp float;
attribute vec2 corner; uniform float uHalf, uS; varying vec2 vUv;
void main(){ vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += corner * uHalf * uS; vUv = corner; gl_Position = projectionMatrix * mv; }`;
export const hazeFrag = /* glsl */`
precision highp float;
uniform vec3 uRight, uUp, uFwd, uEcl; uniform float uHalf, uOuter, uInner, uCel, uOp;
varying vec2 vUv;
const float AU = 1.495978707e11;
float pow2(float x){ return x * x; }
vec2 dens(vec3 p){                                  // p in AU from the Sun -> (outer, inner) number density (arbitrary units)
  float r = max(length(p), 1.0);
  float outer = pow(r / 30000.0, -3.4) * smoothstep(9000.0, 30000.0, r) * exp(-pow(r / 86000.0, 3.2));
  float h = dot(p, uEcl); float rc = max(sqrt(max(r * r - h * h, 1.0)), 1800.0);
  float inner = pow(rc / 4500.0, -1.7) * exp(-pow2(h / (0.30 * r + 350.0))) * smoothstep(800.0, 2600.0, r) * (1.0 - smoothstep(13000.0, 30000.0, r));
  return vec2(outer, inner);
}
void main(){
  float L = uHalf / AU;
  vec3 P0 = (uRight * vUv.x + uUp * vUv.y) * L;
  vec2 acc = vec2(0.0);
  for (int i = 0; i < 48; i++) {
    float s = (float(i) + 0.5) / 48.0; float t = L * s * s * s; float dt = L * 3.0 * s * s / 48.0;
    acc += (dens(P0 + uFwd * t) + dens(P0 - uFwd * t)) * dt;
  }
  float bAU = length(P0) / 1.0;                      // impact parameter from the Sun in AU: the cloud's hollow core (inner edge ~2,000 AU, outer ~9,000 AU) reads as a shell with a dark centre
  float co = (1.0 - exp(-acc.x * uOuter)) * smoothstep(1500.0, 7000.0, bAU), ci = (1.0 - exp(-acc.y * uInner)) * smoothstep(250.0, 2200.0, bAU);
  float bo = (smoothstep(0.05, 0.10, co) + smoothstep(0.20, 0.30, co) + smoothstep(0.45, 0.60, co)) / 3.0;
  float bi = (smoothstep(0.05, 0.10, ci) + smoothstep(0.22, 0.32, ci) + smoothstep(0.50, 0.65, ci)) / 3.0;
  co = mix(co, bo, uCel * 0.4); ci = mix(ci, bi, uCel);
  vec3 cOut = mix(vec3(0.14, 0.10, 0.42), vec3(0.46, 0.34, 0.90), smoothstep(0.0, 0.9, co));   // the violet of the space itself (no teal, no grey)
  vec3 cIn  = mix(vec3(0.16, 0.10, 0.44), vec3(0.56, 0.36, 0.92), smoothstep(0.0, 0.9, ci));
  vec3 o = (cOut * co * 0.12 + cIn * ci * 0.14) * uOp * (1.0 - smoothstep(0.92, 1.0, length(vUv)));
  gl_FragColor = vec4(o, smoothstep(0.003, 0.03, max(o.r, max(o.g, o.b))));
}`;

// ---------- the Milky Way disc: analytic barred-spiral luminosity in the galactic plane (kpc), warm bulge + bar, bluish arms, dark dust lanes, pink H II knots ----------
export const galVert = /* glsl */`
precision highp float;
attribute vec2 corner; uniform vec3 uAx, uAy, uC; uniform float uHalf;     // metres: plane axes (galactic X,Y), centre, half size
varying vec2 vXY;
void main(){ vec3 p = uC + (uAx * corner.x + uAy * corner.y) * uHalf; vXY = corner * 19.0;      // kpc from the galactic centre
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
export const galFrag = /* glsl */`
precision highp float;
uniform float uOp, uSeed; varying vec2 vXY;
${NOISE}
const float PI = 3.14159265, TWO_PI = 6.2831853;
float wrapA(float a){ return mod(a + PI, TWO_PI) - PI; }
void main(){
  float X = vXY.x, Y = vXY.y;
  float R = length(vXY); float phi = atan(Y, X);
  float tanP = 0.26, sinP = 0.251;                                             // pitch ~13 deg
  float disc = exp(-R / 4.0) * (1.0 - exp(-R / 1.2));
  float outer = 1.0 - smoothstep(12.0, 16.5, R);
  // bar: ~27 deg to the Sun-centre line, semi-major ~4 kpc, axis ratio ~0.2
  float cb = cos(0.4712), sb = sin(0.4712); float xb = X * cb + Y * sb, yb = -X * sb + Y * cb;
  float bar = exp(-pow(abs(xb) / 3.1, 3.2) - (yb / 0.62) * (yb / 0.62)) * (1.0 - smoothstep(5.0, 8.0, R));
  float bulge = exp(-pow(R / 1.15, 0.55) * 1.25) * (1.0 - smoothstep(4.0, 9.0, R));
  // four log-spiral arms (Scutum-Centaurus + Perseus major, Sagittarius + Outer minor); crossings at the Sun's azimuth (phi = pi): 4.7, 6.6, 9.4, 13.2 kpc
  float arm = 0.0, lane = 0.0, young = 0.0;
  float rk[4]; rk[0] = 4.7; rk[1] = 6.6; rk[2] = 9.4; rk[3] = 13.2;
  float wk[4]; wk[0] = 1.0; wk[1] = 0.32; wk[2] = 1.0; wk[3] = 0.26;
  float sig = 0.38 + 0.075 * R;
  for (int k = 0; k < 4; k++) {
    float pk = PI + log(max(R, 0.3) / rk[k]) / tanP;
    float d = wrapA(phi - pk) * R * sinP;                                     // kpc across the arm
    arm += wk[k] * exp(-(d / sig) * (d / sig));
    lane += wk[k] * exp(-((d + 0.80 * sig) / (0.36 * sig)) * ((d + 0.80 * sig) / (0.36 * sig)));         // dust sits on the leading (inner) edge
    young += wk[k] * exp(-((d - 0.10 * sig) / (0.55 * sig)) * ((d - 0.10 * sig) / (0.55 * sig)));
  }
  float armOn = smoothstep(3.0, 4.6, R);                                       // arms start at the ends of the bar
  arm *= armOn; lane *= armOn; young *= armOn;
  float clump = smoothstep(0.45, 0.8, fbm(vec3(X, Y, 0.0) * 1.6 + uSeed));
  float interarm = 0.20;
  float dust = clamp(lane * (0.35 + 0.75 * fbm(vec3(X, Y, 1.0) * 3.0 + uSeed)), 0.0, 0.85);
  float stars = disc * (interarm + 2.2 * arm * (0.65 + 0.7 * clump)) * outer;
  stars *= 1.0 - 0.70 * dust * smoothstep(2.5, 4.5, R);
  float core = bar * 0.55 + bulge * 1.5;
  vec3 warm = vec3(1.0, 0.76, 0.46), disk = vec3(0.98, 0.9, 0.80), blue = vec3(0.50, 0.68, 1.0), pink = vec3(1.0, 0.42, 0.66);
  vec3 col = mix(disk, blue, clamp(young * 0.9 * armOn, 0.0, 1.0));
  vec3 o = (col * stars * 0.62 + warm * core * (1.0 - 0.45 * dust) * 0.75) * uOp;
  gl_FragColor = vec4(o, smoothstep(0.003, 0.03, max(o.r, max(o.g, o.b))));
}`;

// ---------- Orion complex: ray-marched emission / reflection / dust cloud (procedural volume), colours of H-alpha (pink), reflection (blue), O III core (teal) ----------
export const volVert = /* glsl */`
precision highp float;
attribute vec2 corner; uniform vec3 uC; uniform float uHalf, uS; varying vec2 vUv;
void main(){ vec4 mv = modelViewMatrix * vec4(uC, 1.0); mv.xy += corner * uHalf * uS; vUv = corner; gl_Position = projectionMatrix * mv; }`;
export const volFrag = /* glsl */`
precision highp float;
uniform vec3 uRight, uUp, uFwd, uAx; uniform float uHalf, uMag, uOp, uSeed;
varying vec2 vUv;
const float LY = 9.4607304725808e15;
${NOISE}
void main(){
  float H = uHalf / LY / uMag;                                   // half size in true light-years
  vec3 P0 = (uRight * vUv.x + uUp * vUv.y) * H;
  float T = 1.0; vec3 acc = vec3(0.0); const int N = 28; float dt = 2.0 * H / float(N);
  for (int i = 0; i < N; i++) {
    vec3 p = P0 + uFwd * (-H + (float(i) + 0.5) * dt);
    float al = dot(p, uAx); vec3 pr = p - uAx * al;
    float env = exp(-al * al / (2.0 * 85.0 * 85.0) - dot(pr, pr) / (2.0 * 42.0 * 42.0));
    float nz = fbm(p * 0.04 + uSeed);
    float d = env * smoothstep(0.32, 0.86, nz);
    float core = exp(-dot(p, p) / (2.0 * 12.0 * 12.0));
    float em = d * 0.55 + core * 1.5;
    float hue = smoothstep(0.35, 0.72, fbm(p * 0.055 + uSeed * 2.3 + 5.0));
    vec3 col = mix(vec3(1.0, 0.30, 0.55), vec3(0.34, 0.55, 1.0), hue * (1.0 - core));
    col = mix(col, vec3(1.0, 0.88, 0.82), core * 0.55) + vec3(0.05, 0.50, 0.42) * core * 0.35;
    acc += T * col * em * dt * 0.095;
    T *= exp(-d * dt * 0.05);
  }
  vec3 o = acc * uOp * (1.0 - smoothstep(0.78, 1.0, length(vUv)));
  gl_FragColor = vec4(o, smoothstep(0.003, 0.03, max(o.r, max(o.g, o.b))));
}`;

// ---------- label leader lines: per-vertex alpha so each leader fades with its label ----------
export const leadVert = /* glsl */`
precision highp float; attribute float aA; varying float vA;
void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const leadFrag = /* glsl */`
precision highp float; uniform vec3 uColor; varying float vA;
void main(){ vec3 o = uColor * vA; gl_FragColor = vec4(o, smoothstep(0.003, 0.03, max(o.r, max(o.g, o.b)))); }`;
