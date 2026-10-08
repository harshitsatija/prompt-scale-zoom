/* Materials for the solar level. The engine composites translucent pixels as mix(backdrop, rgb, alpha) where rgb was already alpha-blended,
 * so soft glows output (colour, sqrt(g)): over an empty backdrop that lands on colour*g, which is what we mean by "glow". */
import { T } from '../../core/kit.js';

const COMMON = `
float h11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h31(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 h33(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float vnoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + 11.7; a *= .5; } return s; }
// 3D worley: returns (F1, F2-F1)
vec2 worley(vec3 p){ vec3 i = floor(p), f = fract(p); float d1 = 9., d2 = 9.;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++){ vec3 g = vec3(float(x), float(y), float(z)); vec3 o = h33(i + g); float d = length(g + o - f); if (d < d1){ d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  return vec2(d1, d2 - d1); }
vec3 normSafe(vec3 n){ n /= max(max(abs(n.x), abs(n.y)), max(abs(n.z), 1e-30)); return normalize(n); }
vec4 glowOut(vec3 c, float g){ return vec4(c, sqrt(clamp(g, 0., 1.))); }
`;

// ---------------------------------------------------------------- orbit ribbons (screen-space width, comet-like fade behind the body)
export function ribbonMat(color, uRes) {
  return new T.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, side: T.DoubleSide,
    uniforms: { uRes: { value: uRes }, uWidth: { value: 1.4 }, uPU: { value: 0 }, uAlpha: { value: 1 }, uTail: { value: 3.0 }, uBase: { value: 0.16 }, uCol: { value: new T.Color(color) }, uVis: { value: 1 }, uFoc: { value: new T.Vector3() }, uFR: { value: 1e30 }, uFK: { value: 0 }, uFlo: { value: 0.35 } },
    vertexShader: `
attribute vec3 next; attribute float side; attribute float u; attribute float wk;
uniform vec2 uRes; uniform float uWidth, uPU, uAlpha, uTail, uBase, uFR, uFK, uFlo; uniform vec3 uFoc; varying float vA; varying float vS;
void main(){
  mat4 mvp = projectionMatrix * modelViewMatrix; vec4 a = mvp * vec4(position, 1.), b = mvp * vec4(next, 1.);
  vec2 sa = a.xy / a.w * uRes * .5, sb = b.xy / b.w * uRes * .5, d = sb - sa; float L = length(d); d = L > 1e-7 ? d / L : vec2(1., 0.);
  vec2 n = vec2(-d.y, d.x); float nf = exp(-pow(length(position - uFoc) / uFR, 2.));   // thicker and brighter near the camera's subject, thinning away from it
  a.xy += n * side * uWidth * (1. + uFK * nf) * max(wk, 0.) * .5 / (uRes * .5) * a.w; gl_Position = a;
  float dd = fract(uPU - u); vA = uAlpha * (uBase + (1. - uBase) * exp(-dd * uTail)) * mix(1., mix(uFlo, 1., nf), min(uFK, 1.)); vS = side; }`,
    fragmentShader: `uniform vec3 uCol; uniform float uVis; varying float vA; varying float vS; ${COMMON}
void main(){ float e = 1. - smoothstep(.55, 1., abs(vS)); gl_FragColor = glowOut(uCol * 1.25, vA * e * uVis); }`
  });
}
// ribbon geometry from 3D points (+ per-point u phase and optional width multiplier)
export function ribbonGeo(pts, us, wks, closed = true) {
  const n = pts.length, pos = new Float32Array(n * 2 * 3), nxt = new Float32Array(n * 2 * 3), side = new Float32Array(n * 2), u = new Float32Array(n * 2), wk = new Float32Array(n * 2), idx = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[Math.min(n - 1, i + 1)], pr = pts[Math.max(0, i - 1)]; const nx = (i === n - 1) ? [p[0] + (p[0] - pr[0]), p[1] + (p[1] - pr[1]), p[2] + (p[2] - pr[2])] : q;
    for (let s = 0; s < 2; s++) { const k = i * 2 + s; pos.set(p, k * 3); nxt.set(nx, k * 3); side[k] = s ? 1 : -1; u[k] = us ? us[i] : i / (n - 1); wk[k] = wks ? wks[i] : 1; }
    if (i < n - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('next', new T.BufferAttribute(nxt, 3)); g.setAttribute('side', new T.BufferAttribute(side, 1)); g.setAttribute('u', new T.BufferAttribute(u, 1)); g.setAttribute('wk', new T.BufferAttribute(wk, 1)); g.setIndex(idx);
  g.boundingSphere = new T.Sphere(new T.Vector3(), 1e18); return g;
}

// ---------------------------------------------------------------- the Sun
export function sunMat(map) {
  return new T.ShaderMaterial({
    uniforms: { uMap: { value: map }, uSpin: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vObj; varying vec3 vNv; varying vec3 vVd; ${COMMON}
void main(){ vObj = normalize(position); vec4 mv = modelViewMatrix * vec4(position, 1.); vNv = normSafe(normalMatrix * normal); vVd = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D uMap; uniform float uSpin, uTime; varying vec3 vObj; varying vec3 vNv; varying vec3 vVd; ${COMMON}
void main(){
  float cs = cos(uSpin), sn = sin(uSpin); vec3 d = normalize(vObj); d = vec3(cs * d.x + sn * d.z, d.y, -sn * d.x + cs * d.z);
  float mu = clamp(dot(vNv, vVd), 0., 1.);
  // convection cells (granulation), super-granulation, and active regions
  vec3 wp = d * 16. + vec3(0., uTime * .03, 0.); wp += (vec3(vnoise(wp * .5), vnoise(wp * .5 + 7.), vnoise(wp * .5 + 13.)) - .5) * 1.4; // domain warp -> swirly cells
  vec2 w1 = worley(wp), w2 = worley(d * 40. + 5.);
  float cell = smoothstep(0., .62, w1.x), lane = smoothstep(0.02, .22, w1.y);
  float fine = 1. - smoothstep(0., .5, w2.x);
  float big = fbm(d * 3.0 + 3.);
  vec3 tx = texture2D(uMap, vec2(atan(d.z, d.x) / 6.28318 + .5, asin(clamp(d.y, -1., 1.)) / 3.14159 + .5)).rgb;
  float tl = dot(tx, vec3(.299, .587, .114));
  float h = .50 + .20 * (1. - cell) * lane + .10 * (fine - .4) + .30 * (big - .5) + .18 * (tl - .5);
  // sunspot pairs near +-15 deg latitude, with penumbra, and the bright faculae that surround them
  float spots = 0., fac = 0.; for (int k = 0; k < 6; k++){ float fk = float(k); float lat = (mod(fk, 2.) < 1. ? 1. : -1.) * (.18 + .08 * h11(fk + 2.)); float lon = fk * 1.9 + 1.;
    vec3 c = normalize(vec3(cos(lon) * cos(lat), sin(lat), sin(lon) * cos(lat))); float dd = length(d - c); spots = max(spots, smoothstep(.07 + .012 * mod(fk, 2.), .03, dd)); fac = max(fac, smoothstep(.40, .08, dd)); }
  h -= spots * .5; h += fac * .22 * (.5 + w2.x * 0. + fine * .5);
  h += .10 * pow(1. - mu, 2.) * smoothstep(.45, .7, big);
  float ld = .26 + .74 * pow(mu, .78); h = h * ld - (1. - ld) * .16; h += .16 * pow(mu, 3.) * (.6 + .4 * fine);
  vec3 deep = vec3(.62, .10, .02), or1 = vec3(.96, .34, .04), amber = vec3(1., .58, .10), yel = vec3(1., .79, .32), cream = vec3(1., .95, .78);
  vec3 c = mix(deep, or1, smoothstep(.18, .26, h)); c = mix(c, amber, smoothstep(.36, .44, h)); c = mix(c, yel, smoothstep(.54, .62, h)); c = mix(c, cream, smoothstep(.76, .84, h));
  c = mix(c, vec3(.40, .10, .07), spots * .8);
  c = mix(c, vec3(.92, .26, .05), pow(1. - mu, 2.4) * .55); // red-orange limb
  gl_FragColor = vec4(c * (1.05 + .55 * smoothstep(.62, 1., h)), 1.); }`
  });
}
// camera-facing quad: corona rays, prominences, glow. uK = quad half-size in solar radii.
export function coronaMat() {
  return new T.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true,
    uniforms: { uSize: { value: 1 }, uK: { value: 8 }, uTime: { value: 0 }, uGlow: { value: 1 }, uProm: { value: 1 } },
    vertexShader: `uniform float uSize; varying vec2 vP; void main(){ vP = position.xy; vec4 c = modelViewMatrix * vec4(0., 0., 0., 1.); float sc = length(modelViewMatrix[0].xyz); c.xy += position.xy * uSize * sc; gl_Position = projectionMatrix * c; }`,
    fragmentShader: `uniform float uK, uTime, uGlow, uProm; varying vec2 vP; ${COMMON}
float vn1(float x){ float i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(h11(i), h11(i + 1.), f); }
void main(){
  float rr = length(vP) * uK; float an = atan(vP.y, vP.x); float R = rr - 1.;
  if (rr < .985) { gl_FragColor = vec4(0.); return; }
  float edge = smoothstep(.985, 1.01, rr);
  // streamers: angular noise sets how far each ray reaches; denser toward the equator (x axis of the quad is a screen axis, so use a fixed tilt)
  float t = uTime * .05; float a1 = vn1(an * 3.2 + t) , a2 = vn1(an * 7. - t * 1.3 + 7.), a3 = vn1(an * 12. + t * .7 + 19.);
  float eq = pow(abs(cos(an - .32)), 2.2); float reach = (.14 + .75 * a1 * a1 + .22 * a2 + .05 * a3) * (.45 + 1.15 * eq); float rays = exp(-max(R, 0.) / reach) * (.7 + .3 * a2) * (.55 + .9 * smoothstep(.35, .8, a1));
  float base = exp(-max(R, 0.) * 6.5);
  float halo = exp(-max(R, 0.) * 1.3) * .22 + exp(-max(R, 0.) * .4) * .05;
  // prominences: little loops standing on the limb
  float pr = 0., pf = 0.; for (int k = 0; k < 5; k++){ float fk = float(k); float a0 = fk * 1.27 + 0.6 + .10 * sin(uTime * .15 + fk * 3.); float w = .13 + .09 * h11(fk + 3.), hh = .20 + .30 * h11(fk + 9.);
    float da = abs(mod(an - a0 + 3.14159, 6.28318) - 3.14159); if (da < w * 1.02) { float q = min(da / w, 1.); float arc = hh * pow(1. - q * q, .85); float th = (.028 + .014 * h11(fk)) * (1. - .35 * (1. - q)) + .02 * q * q; // thicker at the feet, slimmer at the crown
      float strand = smoothstep(th * 1.6, th * .3, abs(R - arc)) + .6 * smoothstep(th * 1.6, th * .3, abs(R - arc * .72)) * step(.2, h11(fk + 21.));
      pr += strand * (.8 + .2 * sin(uTime * 1.3 + fk * 5.)); pf += smoothstep(0., arc, arc - R) * step(0., R) * .22 * (1. - q) * smoothstep(0., .08, R); } }
  pr *= uProm; pf *= uProm; vec3 cInner = vec3(1., .86, .52), cMid = vec3(1., .66, .34), cOut = vec3(.95, .62, .86);
  float g = (base * .8 + rays * .5 + halo) * uGlow; vec3 c = mix(cInner, cMid, smoothstep(0., .25, R)); c = mix(c, cOut, smoothstep(.15, 1.4, R) * (.25 + .75 * uProm));
  vec3 col = c * (1.0 + base * .5) + vec3(1., .26, .08) * pr * 1.3; float gg = g + pr * .9 + pf * .5;
  col = mix(col, vec3(1., .33, .12) * 1.5, clamp(pr, 0., 1.) * .85); float rim = smoothstep(uK, uK * .55, rr); gl_FragColor = glowOut(col, gg * edge * rim); }`
  });
}

// ---------------------------------------------------------------- planets, rings, atmosphere halos
export function planetMat(map, o = {}) {
  const ring = o.ring;
  return new T.ShaderMaterial({
    defines: ring ? { RING: 1 } : {},
    uniforms: { uMap: { value: map }, uL: { value: new T.Vector3(1, 0, 0) }, uRim: { value: o.rim === undefined ? 0.5 : o.rim }, uTint: { value: new T.Color(o.tint || 0xffffff) }, uRingMap: { value: ring ? ring.map : null }, uRin: { value: ring ? ring.rin : 1 }, uRout: { value: ring ? ring.rout : 2 }, uNight: { value: o.night || 0 }, uSat: { value: o.sat === undefined ? 0.9 : o.sat }, uTint2: { value: o.bright || 1 } },
    vertexShader: `varying vec3 vObj; varying vec3 vNv; varying vec3 vVd; varying vec2 vUv; ${COMMON}
void main(){ vUv = uv; vObj = normalize(position); vec4 mv = modelViewMatrix * vec4(position, 1.); vNv = normSafe(normalMatrix * normal); vVd = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D uMap; uniform sampler2D uRingMap; uniform vec3 uL; uniform float uRim, uRin, uRout, uNight, uSat; uniform vec3 uTint; uniform float uTint2; varying vec3 vObj; varying vec3 vNv; varying vec3 vVd; varying vec2 vUv; ${COMMON}
void main(){
  vec3 tx = texture2D(uMap, vUv).rgb; float lum = dot(tx, vec3(.299, .587, .114)); tx = mix(vec3(lum), tx, uSat) * uTint;
  vec3 n = normalize(vObj); float l = dot(n, uL); float mu = clamp(dot(vNv, vVd), 0., 1.);
  float sh = 1.;
#ifdef RING
  { // the rings cast a shadow on the globe: march along the sun ray to the ring plane (y = 0 in object space)
    if (abs(uL.y) > 1e-3) { float t = -n.y / uL.y; if (t > 0.) { vec3 hp = n + t * uL; float rr = length(hp.xz); if (rr > uRin && rr < uRout) { float a = texture2D(uRingMap, vec2((rr - uRin) / (uRout - uRin), .5)).a; sh = 1. - .82 * a; } } } }
#endif
  float ll = l * (sh < 1. ? mix(1., .25 + .6 * sh, step(0., l)) : 1.);  // shadowed pixels fall one cel band
  vec3 t0 = vec3(.26, .24, .52), t1 = vec3(.60, .56, .86), t2 = vec3(1., .96, .88), t3 = vec3(1.14, 1.09, 1.0);
  vec3 L = mix(t0, t1, smoothstep(-.16, -.08, ll)); L = mix(L, t2, smoothstep(.16, .24, ll)); L = mix(L, t3, smoothstep(.62, .70, ll));
  if (sh < 1.) L = mix(L, t1, (1. - sh) * smoothstep(0., .2, l) * .9);
  vec3 col = tx * L * uTint2;
  float lit = smoothstep(-.25, .5, l);
  col += vec3(.22, .75, .66) * pow(1. - mu, 3.) * uRim * (.35 + .65 * lit) * .9;
  gl_FragColor = vec4(col, 1.); }`
  });
}
export function ringMat(map, rin, rout) {
  return new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide,
    uniforms: { uMap: { value: map }, uL: { value: new T.Vector3(1, 0, 0) }, uRin: { value: rin }, uRout: { value: rout } },
    vertexShader: `varying vec2 vUv; varying vec3 vP; varying vec3 vNv; varying vec3 vVd; ${COMMON} void main(){ vUv = uv; vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.); vNv = normSafe(normalMatrix * vec3(0., 1., 0.)); vVd = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uL; uniform float uRin, uRout; varying vec2 vUv; varying vec3 vP; varying vec3 vNv; varying vec3 vVd; ${COMMON}
void main(){
  vec4 t = texture2D(uMap, vec2(vUv.x, .5)); float a = max(t.a, .30 * smoothstep(0., .06, vUv.x) * smoothstep(.34, .22, vUv.x)) * smoothstep(0., .07, vUv.x) * smoothstep(1., .93, vUv.x); if (a < .01) discard; // C ring is faint, not absent
  // planet's shadow on the rings (planet = unit sphere at the origin)
  float b = dot(vP, uL), c = dot(vP, vP) - 1., disc = b * b - c;   float inS = (b < 0. && disc > 0.) ? smoothstep(0., .05, disc) : 0.;
  float lit = abs(uL.y) * .5 + .5; vec3 base = t.rgb; float lum = dot(base, vec3(.299, .587, .114)); base = mix(vec3(lum), base, .6) * vec3(2.55, 2.3, 1.9);
  vec3 L = mix(vec3(.30, .27, .55), vec3(1., .96, .88), 1. - inS) * (.55 + .5 * lit);
  float facing = dot(vNv, vVd); // thin rings glow when seen against the light
  vec3 col = base * L; col += vec3(1., .85, .6) * .15 * pow(max(0., 1. - abs(facing)), 2.);
  gl_FragColor = vec4(col, clamp(a * 1.12, 0., 1.)); }`
  });
}
// soft halo around a planet (atmosphere), billboard
export function haloMat(color, k = 1.0) {
  return new T.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uSize: { value: 1 }, uK: { value: 1.5 }, uCol: { value: new T.Color(color) }, uLvl: { value: k }, uSun: { value: new T.Vector3(1, 0, 0) } },
    vertexShader: `uniform float uSize; uniform vec3 uSun; varying vec2 vP; varying vec2 vS; void main(){ vP = position.xy; float sc = length(modelViewMatrix[0].xyz); vS = (mat3(modelViewMatrix) * normalize(uSun)).xy / sc; vec4 c = modelViewMatrix * vec4(0., 0., 0., 1.); c.xy += position.xy * uSize * sc; gl_Position = projectionMatrix * c; }`,
    fragmentShader: `uniform float uK, uLvl; uniform vec3 uCol; varying vec2 vP; varying vec2 vS; ${COMMON}
void main(){ float rr = length(vP) * uK; if (rr < .98) { gl_FragColor = vec4(0.); return; }
  float R = rr - 1.; float side = .45 + .55 * smoothstep(-.7, .8, dot(normalize(vP + 1e-6), normalize(vS + 1e-6)));
  float g = exp(-R * 9.) * .85 * side * uLvl * smoothstep(.98, 1.02, rr); gl_FragColor = glowOut(uCol * 1.2, g * smoothstep(uK, uK * .6, rr)); }`
  });
}

// ---------------------------------------------------------------- Kepler swarms evaluated on the GPU
// three size tiers (80 % / 17 % / 3 %), a slight colour range, and a semi-major-axis fade (uA = [from, to]) so each swarm keeps its real annulus.
export function swarmMat(color, px, uRes, o = {}) {
  return new T.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uDays: { value: 0 }, uPx: { value: px }, uCol: { value: new T.Color(color) }, uAlpha: { value: 1 }, uAU: { value: 1.495978707e11 }, uCol2: { value: new T.Color(o.color2 || color) }, uA: { value: new T.Vector2(...(o.fade || [1e4, 1e4 + 1])) }, uTier: { value: o.tier === undefined ? 1 : o.tier } },
    vertexShader: `attribute vec3 e1; attribute vec3 e2; attribute float hh; uniform float uDays, uPx, uAU, uTier; uniform vec2 uA; varying float vH; varying float vF; varying float vT;
const float PI = 3.14159265;
void main(){
  float a = e1.x, e = e1.y, I = radians(e1.z), Om = radians(e2.x), w = radians(e2.y);
  float n = 0.9856076686 / pow(a, 1.5); float M = radians(e2.z + n * uDays); M = mod(M + PI, 2. * PI) - PI;
  float E = e < .8 ? M : PI * sign(M + 1e-6); for (int i = 0; i < 9; i++) E -= (E - e * sin(E) - M) / (1. - e * cos(E));
  float xp = a * (cos(E) - e), yp = a * sqrt(1. - e * e) * sin(E);
  float co = cos(Om), so = sin(Om), cw = cos(w), sw = sin(w), ci = cos(I), si = sin(I);
  float x = (cw * co - sw * so * ci) * xp + (-sw * co - cw * so * ci) * yp, y = (cw * so + sw * co * ci) * xp + (-sw * so + cw * co * ci) * yp, z = (sw * si) * xp + (cw * si) * yp;
  vec3 p = vec3(x, z, y) * uAU; vH = hh; vF = 1. - smoothstep(uA.x, uA.y, a);
  float tier = hh < .8 ? 0. : (hh < .965 ? 1. : 2.); vT = tier;
  vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (tier < .5 ? .85 : (tier < 1.5 ? 1.25 : 1.75)) * (uTier > .5 ? 1. : 1.); }`,
    fragmentShader: `uniform vec3 uCol, uCol2; uniform float uAlpha; varying float vH; varying float vF; varying float vT; ${COMMON}
void main(){ float d = length(gl_PointCoord - .5) * 2.; if (d > 1.) discard; float g = smoothstep(1., .35, d); vec3 c = mix(uCol, uCol2, fract(vH * 7.31)); gl_FragColor = glowOut(c * (.9 + .25 * vT), g * uAlpha * vF * (.34 + .24 * vT)); }`
  });
}
// a small icon (spacecraft glyph) as a point sprite
export function iconMat(map) {
  return new T.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    uniforms: { uMap: { value: map }, uDpr: { value: 1 }, uSize: { value: 30 }, uA: { value: 1 } },
    vertexShader: `uniform float uDpr, uSize; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = uSize * uDpr; }`,
    fragmentShader: `uniform sampler2D uMap; uniform float uA; ${COMMON} void main(){ vec4 t = texture2D(uMap, vec2(gl_PointCoord.x, 1. - gl_PointCoord.y)); if (t.a < .02) discard; gl_FragColor = glowOut(t.rgb * 1.15, t.a * uA); }`
  });
}
export function markerMat() {
  return new T.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    uniforms: { uDpr: { value: 1 } },
    vertexShader: `attribute float size; attribute float alpha; attribute vec3 col; uniform float uDpr; varying float vA; varying vec3 vC; void main(){ vA = alpha; vC = col; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = size * uDpr; }`,
    fragmentShader: `varying float vA; varying vec3 vC; ${COMMON} void main(){ float d = length(gl_PointCoord - .5) * 2.; if (d > 1.) discard; float core = smoothstep(.34, .22, d), halo = pow(1. - d, 2.2); gl_FragColor = glowOut(mix(vC * 1.1, vec3(1.), core * .25), (core * .95 + halo * .45) * vA); }`
  });
}

// ---------------------------------------------------------------- heliosphere shells (fresnel, double sided): soft body + a crisp rim light
export function shellMat(color, k, rimK = 2.4, o = {}) {
  return new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide,
    uniforms: { uCol: { value: new T.Color(color) }, uK: { value: k }, uVis: { value: 1 }, uRim: { value: rimK }, uBody: { value: o.body === undefined ? 0.5 : o.body }, uCol2: { value: new T.Color(o.rimColor || 0x7fe3c4) } },
    vertexShader: `varying vec3 vNv; varying vec3 vVd; varying float vAx; ${COMMON} void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vNv = normSafe(normalMatrix * normal); vVd = normalize(-mv.xyz); vAx = uv.x; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uCol, uCol2; uniform float uK, uVis, uRim, uBody; varying vec3 vNv; varying vec3 vVd; varying float vAx; ${COMMON}
void main(){ float f = 1. - abs(dot(normalize(vNv), normalize(vVd))); float body = (.05 + .55 * pow(f, 1.5)) * uBody; float rim = pow(f, uRim) * 1.15 + .35 * smoothstep(.985, 1., f);
  float g = uK * (body + rim) * uVis; vec3 c = mix(uCol, uCol2, smoothstep(.5, 1., f) * .75); gl_FragColor = glowOut(c * 1.35, g * (1. - .97 * smoothstep(0.3, .95, vAx))); }`
  });
}
