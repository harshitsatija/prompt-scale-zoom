/* Sectioned-solid material for the synapse level.
 * The level is a microtome section: everything behind the plane z_local = 0 is kept, everything in front is clipped.
 * Closed surfaces seen from inside (back faces) are the "cut face": they are drawn in the cytoplasm colour with multi-octave
 * granularity (fading with pixel size so nothing shimmers), and wherever the back face lies within `band` of the plane
 * it is drawn in the membrane colour: the cut bilayer, a line whose width tracks the physical 4 nm up to ~1.5 px. */
import * as kit from '../../core/kit.js';
const { T } = kit;
export const RECS = { post: { value: Array.from({ length: 12 }, () => new T.Vector3(0, 0, 0)) }, pre: { value: Array.from({ length: 12 }, () => new T.Vector3(0, 0, 0)) } };
export const HOLES = { value: Array.from({ length: 10 }, () => new T.Vector3(0, 0, 0)) };
export const SEC = { plane: new T.Plane(new T.Vector3(0, 0, -1), 0), px: 1e-9, bandM: 4e-9, mats: [], glow: { value: new T.Vector4(0, 0, 0, 0) }, glowC: { value: new T.Vector4(0, -1, 0, 0) }, pat: { value: 0 }, glowK: { value: 0 }, glowKey: { value: 0 }, fogR: { value: new T.Vector2(1e-8, 4e-8) }, fogC: { value: new T.Color(0x241f66) }, fogOn: { value: 1 } };
const GLSL_NOISE = `
float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
float oct(vec3 pm, float cs, float amp){ float fade = 1.0 - smoothstep(cs * 0.16, cs * 0.45, uPx); return (vn(pm / cs) - 0.5) * amp * fade; }
float speck(vec3 pm, float cs, float amp){ vec3 q = pm / cs; vec3 i = floor(q); vec3 f = fract(q) - 0.5; float h = h31(i); vec3 o = (vec3(h31(i + 3.1), h31(i + 7.7), h31(i + 1.3)) - 0.5) * 0.5; float d = length(f - o); float fade = 1.0 - smoothstep(cs * 0.14, cs * 0.4, uPx); return step(0.55, h) * smoothstep(0.26, 0.05, d) * amp * fade; }
`;

const RING_GLSL = `
float ringsp(vec3 pm, float cs, float rr){ vec3 q = pm / cs; vec3 i = floor(q); vec3 f = fract(q) - 0.5; float h = h31(i + 4.4); vec2 o = (vec2(h31(i + 1.1), h31(i + 2.2)) - 0.5) * 0.5; float d = length(f.xy - o) * cs; float fade = 1.0 - smoothstep(cs * 0.03, cs * 0.1, uPx);
  float dd = abs(d - rr); return step(0.42, h) * (-smoothstep(rr * 0.45, 0.0, dd) * 0.34 + smoothstep(rr * 0.7, 0.0, d) * 0.16) * fade; }
float dotsp(vec3 pm, float cs, float rr){ vec3 q = pm / cs; vec3 i = floor(q); vec3 f = fract(q) - 0.5; float h = h31(i + 8.8); vec3 o = (vec3(h31(i + 5.1), h31(i + 6.2), h31(i + 7.3)) - 0.5) * 0.6; float d = length(f - o) * cs; float fade = 1.0 - smoothstep(cs * 0.03, cs * 0.1, uPx); return step(0.55, h) * smoothstep(rr, rr * 0.5, d) * fade; }
`;
const LIPID_GLSL = `
float lh(float x){ return fract(sin(x * 12.9898 + 4.1414) * 43758.5453); }
vec3 lipidCol(float s, float v, float aa) {
  float av = abs(v); float lf = v > 0.0 ? 0.0 : 1.0;
  float cell = s / 0.66 + lf * 0.5; float id = floor(cell); float fr = fract(cell) - 0.5; float h = lh(id + lf * 31.0), h2 = lh(id * 1.7 + lf * 13.0 + 5.0);
  float x = (fr + (h - 0.5) * 0.3) * 0.66; float wob = 0.07 * sin(av * 3.1 + h * 40.0) + 0.03 * (h2 - 0.5);
  vec3 bgH = vec3(0.95, 0.80, 0.70), bgT = vec3(0.20, 0.16, 0.52);
  vec3 col = mix(bgH, bgT, smoothstep(1.62, 1.50, av));
  float tm = smoothstep(1.62 + aa, 1.62 - aa, av) * smoothstep(0.05 - aa, 0.05 + aa, av);
  float ch = step(0.86, h2) * (1.0 - lf * 0.5); float dt = min(abs(x - 0.19 - wob), abs(x + 0.19 + wob)); col = mix(col, vec3(0.78, 0.72, 1.0), smoothstep(0.09 + aa, 0.09 - aa, dt) * tm * (1.0 - ch));
  { float rod = smoothstep(0.13 + aa, 0.13 - aa, abs(x * 1.0 + 0.02 * sin(av * 6.0))) * smoothstep(1.62 + aa, 1.62 - aa, av) * smoothstep(0.30 - aa, 0.30 + aa, av); vec3 cc = vec3(1.0, 0.80, 0.42) * (0.82 + 0.18 * sin(av * 17.0 + h * 9.0)); col = mix(col, cc, rod * ch); }
  float dg = length(vec2(x, av - 1.52)); col = mix(col, vec3(1.0, 0.60, 0.10), smoothstep(0.2 + aa, 0.2 - aa, dg));
  float rh = (0.30 + 0.08 * h2) * (1.0 + 0.1 * (1.0 - lf));  float dh = length(vec2(x, av - 2.04)); float head = smoothstep(rh + aa, rh - aa, dh);
  vec3 hc = mix(vec3(1.0, 0.96, 0.84), vec3(0.80, 0.72, 1.0), smoothstep(-0.5, 0.5, 0.6 * x - (av - 2.04))); hc = mix(hc, hc * vec3(0.88, 0.92, 1.06), lf * 0.8);
  col = mix(col, hc, head); col *= 1.0 - 0.28 * smoothstep(rh + aa * 3.0, rh + aa, dh) * (1.0 - head) * smoothstep(1.62, 1.8, av);
  return pow(col, vec3(2.2));
}`;
export function secMat(o) {
  const unit = o.unit || 1e-6;
  const m = kit.toon(o.color === undefined ? 0xffffff : o.color, { vc: !!o.vc, side: o.side || T.DoubleSide, opacity: o.opacity, map: o.map });
  m.clippingPlanes = [SEC.plane]; m.side = o.side || T.DoubleSide; m.fog = false;
  const u = { uFogR: SEC.fogR, uFogC: SEC.fogC, uFogOn: SEC.fogOn, uInner: { value: new T.Color(o.inner === undefined ? 0x888888 : o.inner) }, uBandC: { value: new T.Color(o.band === undefined ? 0xffe8c0 : o.band) }, uUnit: { value: unit }, uBandOn: { value: o.noBand ? 0 : 1 }, uBandW: { value: 4e-9 }, uPx: { value: 1e-9 }, uInnerK: { value: o.innerK === undefined ? 0 : o.innerK }, uNoise: { value: o.noise === undefined ? 1 : o.noise }, uGlowW: SEC.glow, uGlowC: SEC.glowC, uGlowOn: { value: o.glow ? 1 : 0 }, uGlowCol: { value: new T.Color(0xffb02e) }, uBandHi: { value: o.bandHi === undefined ? 0 : o.bandHi }, uSpeck: { value: o.speck === undefined ? 1 : o.speck }, uRings: { value: o.rings || 0 }, uSurf: { value: o.surf || 0 }, uBS: { value: o.bshade || 0 }, uDepth: { value: o.depth || 4.5e-7 }, uDepthK: { value: o.depthK === undefined ? 0.5 : o.depthK }, uFade: { value: 1 }, uFadeCol: { value: new T.Color(0x1d1a66) }, uLip: { value: o.lip ? 1 : 0 }, uEdge: { value: new T.Vector2(o.edge ? o.edge[0] : 1e9, o.edge ? o.edge[1] : 2e9) }, uHoleOn: { value: o.holes ? 1 : 0 }, uHoles: HOLES, uXT: { value: o.xtoon || 0 }, uUnlit: { value: o.unlit ? 1 : 0 }, uUnlitK: { value: o.unlitK || 1 }, uMatch: { value: 0 }, uMatchCol: { value: new T.Color(0xffffff) }, uMatchEdge: { value: new T.Color(0xffffff) }, uRimK: { value: 0 } };
  if (o.edge) { m.transparent = true; m.depthWrite = true; }
  m.userData.u = u; m.userData.unit = unit; SEC.mats.push(m);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vL;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n vL = (instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\n vL = transformed;\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  if (uHoleOn > 0.5) { for (int hi = 0; hi < 10; hi++) { vec3 hh = uHoles[hi]; if (hh.z > 0.0 && length(vL.xz - hh.xy) < hh.z) discard; } }').replace('#include <common>', `#include <common>
varying vec3 vL; uniform vec2 uFogR; uniform vec3 uFogC; uniform float uFogOn; uniform vec3 uInner, uBandC, uGlowCol, uFadeCol; uniform float uFade, uXT; uniform vec2 uEdge; uniform float uHoleOn; uniform vec3 uHoles[10]; uniform float uDepth, uDepthK, uUnlit, uUnlitK; float gUnlit; vec3 gBase; uniform float uRings, uSurf, uBS, uMatch, uRimK; uniform vec3 uMatchCol, uMatchEdge; uniform float uUnit, uBandOn, uBandW, uPx, uInnerK, uNoise, uGlowOn, uBandHi, uSpeck, uLip; uniform vec4 uGlowW, uGlowC;
${GLSL_NOISE}
${RING_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  diffuseColor.a *= 1.0 - smoothstep(uEdge.x, uEdge.y, length(vL));
  gUnlit = 0.0; float isBand = 0.0; vec3 Lm = vL * uUnit; float glowA = 0.0;
  if (uSurf > 0.0 && gl_FrontFacing) { float sv = oct(Lm, 5e-7, 0.7) + oct(Lm, 1.4e-7, 0.6) + oct(Lm, 4e-8, 0.5) + 0.5 * speck(Lm + 4.0, 6e-8, 0.4) - 0.5 * speck(Lm + 9.0, 2.2e-7, 0.5); diffuseColor.rgb *= 1.0 + uSurf * sv; }
  if (uGlowOn > 0.5) { float gd = length(Lm - uGlowC.xyz); float front = uGlowW.x; glowA = uGlowW.y * exp(-pow((gd - front) / max(uGlowW.z, 1e-12), 2.0)) + uGlowW.w * exp(-gd / max(uGlowC.w, 1e-12)); }
  if (gl_FrontFacing && uLip > 0.5) { float lf = 1.0 - smoothstep(0.06e-9, 0.2e-9, uPx); if (lf > 0.0) { vec3 fn = normalize(cross(dFdx(Lm), dFdy(Lm))); float shade = 1.0;
      if (abs(fn.y) > 0.8) { vec2 p = Lm.xz / 0.72e-9; float fwp = max(length(dFdx(p)), length(dFdy(p))); lf *= 1.0 - smoothstep(0.22, 0.55, fwp); vec2 rr = vec2(1.0, 1.7320508); vec2 hh = rr * 0.5; vec2 a1 = mod(p, rr) - hh; vec2 b1 = mod(p - hh, rr) - hh; vec2 gg = dot(a1, a1) < dot(b1, b1) ? a1 : b1; float dd = length(gg); shade = (1.0 - 0.30 * smoothstep(0.3, 0.55, dd) + 0.16 * smoothstep(0.3, 0.0, dd)) * (0.9 + 0.2 * h31(vec3(floor(p / rr), 3.7))); }
      else { vec3 q = Lm / 0.72e-9; lf *= 1.0 - smoothstep(0.22, 0.55, max(length(dFdx(q)), length(dFdy(q)))); vec3 ci = floor(q); vec3 cf = fract(q); vec3 jt = vec3(h31(ci + 1.7), h31(ci + 9.1), h31(ci + 4.3)) - 0.5; float dd = length(cf - 0.5 - 0.3 * jt); shade = 1.0 - 0.36 * smoothstep(0.22, 0.52, dd) + 0.1 * smoothstep(0.3, 0.0, dd); }
      diffuseColor.rgb *= mix(1.0, shade, lf); } }
  if (!gl_FrontFacing) {
    float dz = -Lm.z; isBand = uBandOn * (1.0 - step(uBandW, dz));
    vec3 base = uInnerK > 0.0 ? diffuseColor.rgb * uInnerK : uInner;
    float nz = 1.0 + uNoise * (oct(Lm, 2.4e-6, 0.10) + oct(Lm, 5.5e-7, 0.09) + oct(Lm, 1.3e-7, 0.09) + oct(Lm, 3.2e-8, 0.10) + oct(Lm, 8e-9, 0.12));
    base *= nz; base += uSpeck * uNoise * (speck(Lm + 11.0, 1.1e-8, 0.30) + speck(Lm + 5.0, 3.4e-8, 0.22) + speck(Lm + 2.0, 1.0e-7, 0.14)) * (uInnerK > 0.0 ? base : max(uInner, vec3(0.2)));
    if (uRings > 0.0) { base *= 1.0 + uRings * (ringsp(Lm + 3.0, 1.5e-7, 1.25e-8) + ringsp(Lm + 9.0, 2.6e-7, 1.25e-8) + ringsp(Lm + 17.0, 4.5e-7, 1.25e-8)); base *= 1.0 - uRings * 0.3 * (dotsp(Lm + 5.0, 9e-8, 1.1e-8) + dotsp(Lm + 12.0, 1.7e-7, 1.4e-8)); }
    base *= mix(1.0, 1.0 - uDepthK, 1.0 - exp(-max(dz, 0.0) / uDepth));
    diffuseColor.rgb = base; gUnlit = uUnlit; gBase = base * uUnlitK;
  }`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
  if (uXT > 0.0 && gl_FrontFacing) { vec3 Ld = normalize(vec3(-0.6, 0.75, 0.45)); float dl = dot(normal, Ld); float bnd = smoothstep(-0.2, 0.05, dl) * 0.3 + smoothstep(0.2, 0.4, dl) * 0.35 + smoothstep(0.58, 0.76, dl) * 0.35; vec3 lc = mix(vec3(0.34, 0.30, 0.62), vec3(1.0, 0.97, 0.9), bnd); float rim = pow(1.0 - clamp(abs(normal.z), 0.0, 1.0), 2.5); vec3 xc = diffuseColor.rgb * lc * (1.0 - 0.35 * rim * uXT) + vec3(0.25, 0.55, 0.5) * rim * 0.22 * uXT * smoothstep(0.0, 0.5, -dl + 0.3); gl_FragColor.rgb = mix(gl_FragColor.rgb, xc, min(1.0, uXT)); }
  if (uBS > 0.0 && !gl_FrontFacing) { vec3 Ld = normalize(vec3(-0.6, 0.75, 0.45)); float dl = dot(normal, Ld); float bnd = smoothstep(-0.25, 0.05, dl) * 0.3 + smoothstep(0.15, 0.4, dl) * 0.35 + smoothstep(0.55, 0.78, dl) * 0.35; vec3 lc = mix(vec3(0.50, 0.42, 0.74), vec3(1.0, 0.96, 0.9), bnd); gBase = mix(gBase, diffuseColor.rgb * lc * uUnlitK, uBS); }
  { vec3 bc = uBandC * (1.0 + uBandHi * 0.0); gl_FragColor.rgb = mix(gl_FragColor.rgb, gBase, gUnlit); gl_FragColor.rgb = mix(gl_FragColor.rgb, bc, isBand); if (!gl_FrontFacing) { float ffv = clamp(abs(normalize(normal).z), 0.0, 1.0); vec3 mc = mix(uMatchEdge, uMatchCol, smoothstep(0.05, 0.8, ffv)); mc *= mix(vec3(1.0), vec3(0.97, 0.93, 0.89), smoothstep(-1.75, -1.6, vL.y)); gl_FragColor.rgb = mix(gl_FragColor.rgb, mc, uMatch * (1.0 - isBand)); } else gl_FragColor.rgb += vec3(0.50, 0.60, 1.0) * smoothstep(0.12, 0.85, pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.4)) * uRimK;
    gl_FragColor.rgb += uGlowCol * glowA * (isBand * 1.6 + 0.35 * (1.0 - isBand)); { float dd = max(0.0, -vL.z * uUnit); float fa = smoothstep(uFogR.x, uFogR.y, dd) * 0.88 * uFogOn; gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogC, fa); } gl_FragColor.rgb = mix(uFadeCol, gl_FragColor.rgb, uFade); }`);
  };
  m.customProgramCacheKey = () => 'sec8' + (o.edge ? 'e' : '') + (o.vc ? 'v' : '') + (o.glow ? 'g' : '') + (o.lip ? 'l' : '');
  return m;
}
/* call every frame: updates the clip plane (z_local = 0 of `group`) and the pixel-size dependent uniforms */
const _n = new T.Vector3(), _p = new T.Vector3(), _q = new T.Quaternion();
export const RIB = [];
export function ribbonMat(color, half, minPx, collapse, holes, glow, yq, recY) {
  const m = new T.MeshBasicMaterial({ color, side: T.DoubleSide, fog: true }); const u = { uHalf: { value: half }, uMinPx: { value: minPx }, uPxU: { value: 1e-3 }, uCollapse: { value: collapse ? 1 : 0 }, uHoleOn: { value: holes ? 1 : 0 }, uHoles: HOLES, uYQ: { value: yq || 0 }, uGlowW: SEC.glow, uGlowC: SEC.glowC, uGlowOn: { value: glow ? 1 : 0 }, uGlowCol: { value: new T.Color(0xffb02e) }, uFade: { value: 1 }, uFadeCol: { value: new T.Color(0x1d1a66) }, uPat: SEC.pat, uCore: { value: collapse ? 1 : 0 }, uRecs: holes ? RECS.pre : RECS.post, uRecOn: { value: (holes || glow) ? 1 : 0 }, uRecY: { value: recY === undefined ? (holes ? 0.0189 : -0.0089) : recY } };
  m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, u); sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uHalf, uMinPx, uPxU, uCollapse; varying vec3 vP; attribute float aS; varying float vS, vSd;').replace('#include <begin_vertex>', 'float ex = max(uHalf, uMinPx * uPxU); if (uCollapse > 0.5 && uHalf < 0.8 * uPxU) ex = 0.0;\nvec3 transformed = vec3(position); transformed.xy += normal.xy * normal.z * ex; vP = transformed; vS = aS; vSd = normal.z;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vP; varying float vS, vSd; uniform float uHoleOn, uYQ, uGlowOn, uPat, uCore, uPxU, uRecOn, uRecY; uniform vec3 uRecs[12]; uniform vec3 uHoles[10]; uniform vec4 uGlowW, uGlowC; uniform vec3 uGlowCol, uFadeCol; uniform float uFade;' + LIPID_GLSL).replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  if (uCore > 0.5 && uPat > 0.5) discard;\n  float plugU = 9.0; float plugV = 0.0;\n  if (uRecOn > 0.5) { for (int ri = 0; ri < 12; ri++) { vec3 q = uRecs[ri]; if (q.y > 0.0 && abs(vP.x - q.x) < q.y && abs(vP.y - uRecY) < 0.0031) { plugU = (vP.x - q.x) / q.y; plugV = (vP.y - uRecY) / 0.0031; } } }\n  if (uHoleOn > 0.5 && abs(vP.y - (uYQ + 0.0024)) < 0.0046) { for (int hi = 0; hi < 10; hi++) { vec3 hh = uHoles[hi]; float r2 = hh.z * hh.z - (vP.z - hh.y) * (vP.z - hh.y); if (hh.z > 0.0 && r2 > 0.0 && abs(vP.x - hh.x) < sqrt(r2)) discard; } }').replace('#include <opaque_fragment>', '#include <opaque_fragment>\n  if (uCore < 0.5 && uPat > 0.002) gl_FragColor.rgb = mix(gl_FragColor.rgb, lipidCol(vS * 1000.0, vSd * 2.4, uPxU * 1000.0 * 0.8), uPat);\n  if (uGlowOn > 0.5) { float gd = length(vP * 1e-6 - uGlowC.xyz); float ga = uGlowW.y * exp(-pow((gd - uGlowW.x) / max(uGlowW.z, 1e-12), 2.0)) + uGlowW.w * exp(-gd / max(uGlowC.w, 1e-12)); gl_FragColor.rgb += uGlowCol * ga * (1.4 - 1.0 * uPat); } gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb, 0.0);\n\nif (plugU < 8.0) { float u = plugU, v = plugV; float edge = 0.93 + 0.10 * cos(v * 1.7) - 0.04 * sin(v * 5.0 + u * 3.0); float vE = 0.94 + 0.05 * sin(u * 9.0 + 1.3) + 0.03 * sin(u * 23.0);  if (abs(u) > edge || abs(v) > vE) { /* outside the transmembrane bundle: leave the lipid cartoon */ } else {    vec3 pc = vec3(0.30, 0.13, 0.22); float cov = 0.0;    for (int k = 0; k < 2; k++) { float fk = float(k); for (int i = 0; i < 6; i++) { float fi = float(i) + fk * 6.0; float u0 = -0.82 + float(i) * 0.33 + fk * 0.165 + 0.04 * sin(fi * 7.3); float uc = u0 + 0.12 * sin(fi * 3.1 + 1.0) * v; float hw = 0.175 + 0.02 * sin(fi * 5.0); float d = (u - uc) / hw;      if (abs(d) < 1.0 && (k == 0 || cov < 0.5)) { float sh = sqrt(1.0 - d * d); float turn = 0.5 + 0.5 * sin((v * 9.0 + d * 1.4 + fi * 0.7) * 3.14159); vec3 c0 = mod(fi, 2.0) < 0.5 ? vec3(1.0, 0.66, 0.38) : vec3(0.95, 0.46, 0.46); vec3 c = mix(c0 * 0.42, c0 * (0.95 + 0.1 * turn), sh); c = mix(c, vec3(1.0, 0.94, 0.84), 0.30 * pow(max(0.0, sh - 0.55 - 0.2 * d), 2.0) * 3.0); if (k == 1) c *= 0.62; pc = c; if (k == 0) cov = 1.0; } } }    float ev = smoothstep(0.55, 1.0, max(abs(u) / edge, abs(v) / vE)); pc = mix(pc, vec3(0.42, 0.20, 0.30), ev * 0.55); gl_FragColor.rgb = pow(pc, vec3(2.2)); } }\n  gl_FragColor.rgb = mix(uFadeCol, gl_FragColor.rgb, uFade);'); };
  m.customProgramCacheKey = () => 'rib2' + (holes ? 'h' : '') + (glow ? 'g' : ''); m.userData.u = u; RIB.push(m); return m;
}
export function updateSection(group, c) {
  group.updateWorldMatrix(true, false);
  group.getWorldQuaternion(_q); _n.set(0, 0, -1).applyQuaternion(_q); _p.set(0, 0, 0).applyMatrix4(group.matrixWorld);
  SEC.plane.setFromNormalAndCoplanarPoint(_n, _p);
  SEC.px = c.W / 1500; SEC.fogR.value.set(c.W * 0.9, c.W * 3.6); SEC.bandM = Math.max(4.2e-9, SEC.px * 2.6);
  for (const m of SEC.mats) { const u = m.userData.u; u.uPx.value = SEC.px; u.uBandW.value = SEC.bandM; }
  SEC.pat.value = 1 - Math.min(1, Math.max(0, (SEC.px * 1e9 - 0.075) / 0.065)); for (const m of RIB) m.userData.u.uPxU.value = SEC.px / 1e-6;
}
