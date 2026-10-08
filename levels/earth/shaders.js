/* GLSL for the Earth level. Everything works in planet-radius units (R = 1) so float32 survives, and in the level-local frame
 * (origin = Earth's centre, +y up at Bangalore). Output is linear HDR; the engine's post pass does bloom + tone.
 * Look: stylised realism — real maps, soft 3-4 band cel ramp with violet shadows (same family as kit.toon's ramp), warm twilight,
 * amber city lights that bloom, teal/indigo night airglow. */

export const R_E = 6371000;

const COMMON = /* glsl */`
precision highp float;
const float PI = 3.14159265358979;
uniform vec3 uSun, uMoonDir, uPole, uE1, uE2, uCam;     // frame vectors (unit) and camera position in R units
uniform float uLon0, uCloudRot, uTime, uPx;   // uPx = metres per screen pixel
// the shared cel ramp: soft bands (anti-aliased by smoothstep) from indigo shadow through lilac to warm cream
vec3 softclip(vec3 c) { float m = max(c.r, max(c.g, c.b)); float k = m > 0.66 ? (0.66 + 0.26 * (1.0 - exp(-(m - 0.66) / 0.34))) / m : 1.0; return c * k; }
vec3 ramp(float L) {
  float b0 = smoothstep(-0.075, 0.045, L), b1 = smoothstep(0.10, 0.25, L), b2 = smoothstep(0.44, 0.60, L);
  vec3 c = mix(vec3(0.075, 0.08, 0.21), vec3(0.56, 0.52, 0.84), b0);
  c = mix(c, vec3(0.84, 0.80, 0.97), b1); return mix(c, vec3(1.06, 1.0, 0.90), b2);
}
vec2 cloudUV(vec3 p) { p = normalize(p); float lat = asin(clamp(dot(p, uPole), -1.0, 1.0)); float lon = atan(dot(p, uE2), dot(p, uE1)) + uLon0 - uCloudRot; return vec2(fract(lon / (2.0 * PI) + 0.5), lat / PI + 0.5); }
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
const mat3 ROT3 = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = ROT3 * p * 2.03 + 11.7; a *= 0.5; } return s; }
`;

export const surfaceVS = /* glsl */`
uniform float uLift; varying vec3 vPn; varying vec2 vUv;
void main() { vec3 p = position; float r = length(p); p *= (r + uLift) / r; vPn = p / ${R_E.toFixed(1)}; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;

const SURF_UNI = /* glsl */`
uniform sampler2D tDay, tNrm, tNight, tCloud, tCity;
uniform vec4 uAtlas, uCityBox; uniform float uCityK;
uniform float uHillK, uCityMatch; uniform float uCel; uniform float uDbg; uniform float uSlope, uEx, uLights, uExp, uCloudShadow, uNightRes, uDetailK;
`;
// the whole ground look of the planet as one function: the planet's surface layers call it, and so does the city level's terrain (levels/city/terrain.js) so that the city IS this surface at higher resolution
const SURF_FN = /* glsl */`
float q5(float t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
const float HC = 14000.0 / ${R_E.toFixed(1)};
vec3 earthShade(vec3 vPn, vec2 vUv) {
  vec3 n = normalize(vPn); vec3 E = normalize(cross(uPole, n)); vec3 N = cross(n, E);
  vec3 sn = texture2D(tNrm, vUv).rgb; vec2 sl = (sn.rg - 0.5) * 2.0 * uSlope; float water = sn.b;
  vec3 np = normalize(n - uEx * (sl.x * E + sl.y * N) * (1.0 - 0.85 * water));
  vec3 alb = texture2D(tDay, vUv).rgb;
  { float la = dot(alb, vec3(0.30, 0.59, 0.11)); float qv = la * 6.5, qa = floor(qv), fr = qv - qa, w = clamp(fwidth(qv) * 0.9, 0.10, 0.5);   // soft-edged tone bands: the NASA photo becomes flat cel tones, edges anti-aliased
    float qs = (qa + smoothstep(0.5 - w, 0.5 + w, fr)) / 6.5; alb *= mix(1.0, (qs + 0.035) / (la + 0.035), uCel); }
  float Lg = dot(n, uSun), L = mix(Lg, dot(np, uSun), 0.92);
  // cloud shadow: where the sun ray from this point meets the cloud deck
  float shade = 1.0;
  if (Lg > -0.1 && uCloudShadow > 0.0) { float b = dot(n, uSun), c = 1.0 - (1.0 + HC) * (1.0 + HC); float t = -b + sqrt(max(b * b - c, 0.0)); vec3 pc = n + uSun * t; shade = 1.0 - 0.5 * uCloudShadow * texture2D(tCloud, cloudUV(pc)).r; }
  vec3 col = softclip(alb * ramp(L) * uExp * (0.58 + 0.42 * smoothstep(0.05, 0.75, L)) * mix(1.0, shade, smoothstep(0.0, 0.3, Lg)));
  // warm twilight on the terminator
  float tw = exp(-pow((Lg - 0.01) / 0.055, 2.0)); col += vec3(1.0, 0.42, 0.20) * tw * 0.40 * (0.25 + dot(alb, vec3(0.33)) * 2.2) * smoothstep(-0.2, 0.0, Lg);
  // sun glint on open water
  vec3 V = normalize(uCam - vPn); vec3 H = normalize(uSun + V); float gl = pow(max(dot(n, H), 0.0), 70.0) * water * smoothstep(0.05, 0.4, Lg);
  col += vec3(0.80, 0.78, 1.0) * gl * 0.28;
  // night: earthshine-violet ambience, moonlit relief, city lights
  float nightK = 1.0 - smoothstep(-0.10, 0.10, Lg);
  float ml = max(dot(np, uMoonDir), 0.0); float sk = max(dot(np, normalize(vec3(0.35, 0.55, -0.45))), 0.0) - max(dot(n, normalize(vec3(0.35, 0.55, -0.45))), 0.0) * 0.9;
  col += alb * (vec3(0.030, 0.040, 0.110) + vec3(0.30, 0.34, 0.60) * ml * 0.07 + vec3(0.30, 0.34, 0.62) * (0.5 + 3.2 * sk) * 0.10) * nightK * uExp * mix(0.30, 1.35, water);
  { float hill = clamp(dot(sl, vec2(0.7, -0.7)) * uEx * 2.6, -1.0, 1.0); float lum = dot(alb, vec3(0.33));   // faint skyshine hill-shading: the relief reads on the dark land (Ghats escarpment, Deccan, Himalaya)
    col += vec3(0.30, 0.38, 0.80) * (0.040 + 0.060 * hill) * (0.35 + lum * 1.6) * nightK * (1.0 - water) * uHillK; }
  vec2 nr = vUv * uNightRes - 0.5; vec2 nf = fract(nr); vec2 nuv = (floor(nr) + 0.5 + vec2(q5(nf.x), q5(nf.y))) / uNightRes;   // C1-smooth sampling: no bilinear diamonds
  vec2 dUx = dFdx(vUv), dUy = dFdy(vUv);
  float li = uPx > 6000.0 ? texture2D(tNight, vUv).r : textureGrad(tNight, nuv, dUx, dUy).r;   // far away: plain mip-mapped fetch (the C1 remap only matters when a texel spans many pixels)
  float cityLi = 0.0, wb = 0.0, lonF = 0.0, latF = 0.0, cityMask = 1.0; vec3 csK = vec3(0.0);
  if (uCityK > 0.0) {                                                               // the real road network + building coverage (OSM) under the VIIRS glow
    float lon = uAtlas.x + vUv.x * uAtlas.z, lat = uAtlas.y + vUv.y * uAtlas.w; lonF = lon; latF = lat; vec2 cuv = vec2((lon - uCityBox.x) / uCityBox.z, (lat - uCityBox.y) / uCityBox.w);
    vec2 ce = min(cuv, 1.0 - cuv); float em = min(ce.x, ce.y); wb = smoothstep(0.0, 0.07, em) * (em > 0.0 ? 1.0 : 0.0) * uCityK;
    vec2 gx = dFdx(cuv), gy = dFdy(cuv); vec3 cs = wb > 0.0 ? textureGrad(tCity, cuv, gx, gy).rgb : vec3(0.0); float cgb = wb > 0.0 ? textureGrad(tCity, cuv, gx * 14.0, gy * 14.0).r : 0.0;
    csK = cs; cityLi = pow(cs.r, 1.35) * 2.0 + pow(cgb, 1.25) * 0.50; cityMask = (1.0 - 0.9 * cs.g) * (1.0 - 0.45 * cs.b);              // roads sharp, a tight halo, lakes (G) and parks (B) carved dark
  }
  float core = smoothstep(0.30, 0.85, li);                                          // VIIRS saturates metro cores: put the structure back
  float aLow = 1.0 - smoothstep(160.0, 420.0, uPx), aRid = 1.0 - smoothstep(70.0, 220.0, uPx), aHi = 1.0 - smoothstep(28.0, 90.0, uPx);
  float lowf = aLow > 0.0 ? fbm(n * 4200.0) : 0.5, hif = aHi > 0.0 ? fbm(n * 21000.0) : 0.5, ridge = aRid > 0.0 ? 1.0 - abs(2.0 * vnoise(n * 9000.0) - 1.0) : 0.5;
  float det = 0.14 + 1.55 * mix(0.5, lowf, aLow) + 1.1 * core * mix(0.25, ridge * ridge, aRid) + 0.45 * (mix(0.5, hif, aHi) - 0.5);
  li = li * mix(1.0, det, smoothstep(0.02, 0.3, li) * (0.35 + 0.65 * aLow) * (1.0 - wb));
  float dB = length(vec2((lonF - 77.5946) * 108.45, (latF - 12.9716) * 110.57));
  float kd = 1.0 - smoothstep(380.0, 1100.0, uPx);                                    // the OSM detail only counts while a pixel is smaller than ~0.4 km
  li *= mix(1.0, 0.10 + 0.90 * smoothstep(22.0, 85.0, dB), wb * kd);                 // the metro's own VIIRS plateau is replaced by the OSM glow; VIIRS towns beyond stay
  li *= mix(1.0, 0.30, wb * kd); li = mix(li, li * li * 2.4, 0.7 * wb * kd);                                                    // VIIRS haze is ~500 m/px: let the road network carry the picture when the pixel is smaller
  li = (li + cityLi * kd) * mix(1.0, cityMask, wb * kd); li = 1.0 - exp(-0.95 * li);
  vec3 lc = mix(mix(vec3(1.0, 0.30, 0.06), vec3(1.0, 0.60, 0.22), smoothstep(0.10, 0.55, li)), vec3(1.0, 0.84, 0.55), smoothstep(0.62, 1.0, li)) * li;
  { float km = wb * kd * uCityMatch; vec3 tanc = mix(vec3(0.72, 0.46, 0.27), vec3(1.0, 0.84, 0.60), smoothstep(0.10, 0.85, li)) * li; lc = mix(lc, tanc, 0.85 * km); }   // roads read as the city level's tan hairlines, not orange ribbons
  { vec3 lL = lc * uLights * (1.0 - 0.28 * wb * kd * uCityMatch); lL /= 1.0 + 0.32 * max(lL.r, max(lL.g, lL.b)); col += lL * 1.25 * nightK * (1.0 - 0.5 * water); }
  { float km = wb * kd * uCityMatch; float nk = max(nightK, 0.0); col = mix(col, vec3(0.075, 0.46, 0.60) * (0.55 + 0.45 * nk), smoothstep(0.2, 0.7, csK.g) * km * 0.92);   // lakes: the same saturated cyan as the city level
    col = mix(col, col * vec3(0.7, 1.15, 0.8) + vec3(0.004, 0.02, 0.01), csK.b * km * 0.5); }   // parks: a hint of the city's green
  if (uDbg > 0.5) { float v = uDbg < 1.5 ? textureGrad(tNight, nuv, dUx, dUy).r : (uDbg < 2.5 ? cityLi : (uDbg < 3.5 ? det * 0.5 : li)); col = vec3(v); }
  return col;
}
`;
// the same code with every identifier prefixed, for splicing into another material (no clashes with three.js chunks or that material's own uniforms)
export const EARTH_IDS = ['uSun', 'uMoonDir', 'uPole', 'uE1', 'uE2', 'uCam', 'uLon0', 'uCloudRot', 'uTime', 'uPx', 'tDay', 'tNrm', 'tNight', 'tCloud', 'tCity', 'uAtlas', 'uCityBox', 'uCityK', 'uHillK', 'uCityMatch', 'uCel', 'uDbg', 'uSlope', 'uEx', 'uLights', 'uExp', 'uCloudShadow', 'uNightRes', 'uDetailK'];
export const earthShadeChunk = () => { let g = (COMMON + SURF_UNI + SURF_FN).replace('precision highp float;', ''); const all = EARTH_IDS.concat(['PI', 'softclip', 'ramp', 'cloudUV', 'hash13', 'vnoise', 'ROT3', 'fbm', 'q5', 'HC', 'earthShade']); all.forEach((k) => { g = g.replace(new RegExp('\\b' + k + '\\b', 'g'), 'E_' + k); }); return g; };
export const surfaceFS = COMMON + SURF_UNI + SURF_FN + /* glsl */`
uniform float uAlpha, uFeather; varying vec3 vPn; varying vec2 vUv;
void main() {
  vec2 e = min(vUv, 1.0 - vUv); float feather = smoothstep(0.0, uFeather, min(e.x, e.y) + 1e-6); if (uFeather <= 0.0) feather = 1.0;
  float alpha = uAlpha * feather; if (alpha < 0.01) discard;
  gl_FragColor = vec4(earthShade(vPn, vUv), alpha);
}`;

export const cloudFS = COMMON + /* glsl */`
uniform sampler2D tCloud; uniform float uAlpha; uniform vec2 uTexSize;
float cloudTex(vec2 uv, vec2 gx, vec2 gy) {   // cubic B-spline through 4 bilinear taps (no diamond texel edges when magnified), mip-filtered via explicit gradients (no shimmer when minified)
  vec2 st = uv * uTexSize - 0.5, i = floor(st), f = st - i;
  vec2 w0 = (1.0 - f) * (1.0 - f) * (1.0 - f) / 6.0, w1 = (4.0 - 6.0 * f * f + 3.0 * f * f * f) / 6.0, w3 = f * f * f / 6.0, w2 = 1.0 - w0 - w1 - w3;
  vec2 s0 = w0 + w1, s1 = w2 + w3, f0 = w1 / s0, f1 = w3 / s1;
  vec4 t = (vec4(i.xy, i.xy) + vec4(-0.5 + f0, 1.5 + f1)) / uTexSize.xyxy;
  return (textureGrad(tCloud, t.xy, gx, gy).r * s0.x + textureGrad(tCloud, t.zy, gx, gy).r * s1.x) * s0.y + (textureGrad(tCloud, t.xw, gx, gy).r * s0.x + textureGrad(tCloud, t.zw, gx, gy).r * s1.x) * s1.y;
}
varying vec3 vPn; varying vec2 vUv;
void main() {
  vec3 n = normalize(vPn); vec2 uv = cloudUV(n);
  vec2 g1 = cloudUV(normalize(vPn + dFdx(vPn))) - uv, g2 = cloudUV(normalize(vPn + dFdy(vPn))) - uv; g1.x -= floor(g1.x + 0.5); g2.x -= floor(g2.x + 0.5);   // seam-free uv derivatives
  float c0 = cloudTex(uv, g1, g2);
  float fr0 = 6371000.0 / (uPx * 9.0), amp = smoothstep(4.0, 24.0, fr0), fr = clamp(fr0, 4.0, 520.0);    // noise cells never smaller than ~9 px
  vec3 q = n * fr + vec3(uCloudRot * fr * 0.05, 0.0, 0.0); vec3 qw = q; if (amp > 0.0) { vec3 wv = vec3(fbm(q * 0.55 + 9.0), fbm(q * 0.55 + 3.1), fbm(q * 0.55 + 6.7)) - 0.5; qw = q + wv * 2.2 * vec3(1.0, 0.35, 1.0); } float f = amp > 0.0 ? fbm(qw) : 0.5, f2 = amp > 0.0 ? fbm(qw * 3.1 + 5.0) : 0.5;
  float dens = smoothstep(0.06, 0.98, c0 + amp * ((f - 0.5) * 0.46 * (0.25 + c0) + 0.10 * (f2 - 0.5)));    // soft ramp: thin veils to thick deck, no hard threshold
  if (dens < 0.012) discard;
  vec3 E = normalize(cross(uPole, n)), N = cross(n, E);
  vec3 qb = n * fr * 1.7; float e = 0.6; float h0 = 0.5, hx = 0.5, hy = 0.5;
  if (amp > 0.0) { h0 = vnoise(qb) * 0.65 + vnoise(qb * 2.1) * 0.35; hx = vnoise(qb + E * e) * 0.65 + vnoise((qb + E * e) * 2.1) * 0.35; hy = vnoise(qb + N * e) * 0.65 + vnoise((qb + N * e) * 2.1) * 0.35; }
  vec3 np = normalize(n + 0.2 * amp * ((h0 - hx) * E + (h0 - hy) * N) * dens);
  float Lg = dot(n, uSun), L = mix(Lg, dot(np, uSun), 0.55) - 0.16 * smoothstep(0.45, 1.0, dens);     // thick cloud: its own shadow side, cel-banded
  float dayK = smoothstep(-0.10, 0.10, Lg);
  vec3 dayCol = softclip(ramp(L) * vec3(0.98, 0.97, 1.0) * (0.55 + 0.45 * smoothstep(0.05, 0.75, L)));
  float ml = max(dot(np, uMoonDir), 0.0);
  float edge = 1.0 - smoothstep(0.12, 0.55, dens); vec3 nightCol = vec3(0.060, 0.070, 0.200) * (0.45 + 0.55 * smoothstep(0.1, 0.9, dens)) + vec3(0.07, 0.085, 0.19) * ml * 0.8 + vec3(0.10, 0.13, 0.34) * edge * (0.25 + 0.75 * ml);
  vec3 col = mix(nightCol, dayCol, dayK);
  float tw = exp(-pow((Lg - 0.0) / 0.08, 2.0)); col += vec3(1.0, 0.42, 0.20) * tw * 0.50 * smoothstep(-0.2, 0.0, Lg) * (0.4 + 0.6 * dens);
  float a = smoothstep(0.012, 0.8, dens) * mix(0.13 + 0.08 * ml, 0.70, dayK);                            // night: nearly invisible, a faint moon-lit veil; day: bright, soft-edged
  gl_FragColor = vec4(col, uAlpha * a);
}`;

export const atmoVS = /* glsl */`varying vec3 vPn; void main() { vPn = position / ${R_E.toFixed(1)}; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const atmoFS = COMMON + /* glsl */`
uniform float uExpo, uRA, uHS, uRim;
varying vec3 vPn;
vec2 rs(vec3 o, vec3 d, float r) { float b = dot(o, d); vec3 m = o - d * b; float h = r * r - dot(m, m); if (h < 0.0) return vec2(-1.0); h = sqrt(h); return vec2(-b - h, -b + h); }   // closest-approach form: b*b - c cancels catastrophically in float32 when the camera is 100s of radii away (that was the dotted lattice on the far globe)
void main() {
  vec3 o = uCam, d = normalize(vPn - uCam);
  vec2 ta = rs(o, d, uRA); if (ta.y < 0.0) discard;
  float t0 = max(ta.x, 0.0), t1 = ta.y; vec2 tp = rs(o, d, 1.0); if (tp.x > 0.0) t1 = min(t1, tp.x);
  if (t1 <= t0) discard;
  const int NS = 18; float ds = (t1 - t0) / float(NS);
  vec3 BETA = vec3(45.0, 106.0, 260.0); vec3 od = vec3(0.0), sum = vec3(0.0); float air = 0.0;
  float cg = dot(d, uSun); float phase = 0.0597 * (1.0 + cg * cg);
  for (int i = 0; i < NS; i++) {
    float t = t0 + (float(i) + 0.5) * ds; vec3 p = o + d * t; float r = length(p), rho = exp(-(r - 1.0) / uHS); vec3 pn = p / r; float mu = dot(pn, uSun);
    float perp = r * sqrt(max(1.0 - mu * mu, 0.0)); float vis = mu >= 0.0 ? 1.0 : smoothstep(0.972, 1.012, perp);
    float tauS = rho * uHS * 2.0 / (max(mu, 0.0) + 0.06); vec3 Ts = exp(-BETA * tauS * 0.55);
    od += BETA * rho * ds; sum += rho * ds * BETA * exp(-od) * Ts * vis * phase; float gz = 1.0 - abs(dot(d, pn)); air += rho * ds * exp(-od.b) * gz * gz;
  }
  vec3 col = sum * uExpo * vec3(1.0, 1.0, 1.0);
  col += vec3(0.05, 0.30, 0.34) * air * 9.0 * 0.5 * (0.3 + 0.7 * (1.0 - smoothstep(-0.2, 0.3, dot(normalize(vPn), uSun))));   // faint teal night airglow
  { vec3 pn0 = normalize(vPn); float rim = pow(1.0 - abs(dot(d, pn0)), 5.5); float lit = 0.38 + 0.62 * smoothstep(-0.35, 0.45, dot(pn0, uSun));
    col += vec3(0.26, 0.34, 1.0) * rim * lit * uRim * (0.4 + 0.6 * smoothstep(0.0, 0.5, air * 40.0 + rim)); }   // stylised violet limb glow, brighter on the sunward side
  float a = clamp(max(col.r, max(col.g, col.b)) * 1.6, 0.0, 1.0);
  gl_FragColor = vec4(col, a);
}`;

export const moonVS = /* glsl */`varying vec3 vN; varying vec2 vUv; void main() { vN = normalize(position); vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const moonFS = COMMON + /* glsl */`
uniform sampler2D tMoon; uniform vec3 uSunL, uEarthL; uniform float uExp2;
varying vec3 vN; varying vec2 vUv;
void main() {
  vec3 n = normalize(vN); vec3 alb = texture2D(tMoon, vUv).rgb;
  float L = dot(n, uSunL); float eL = max(dot(n, uEarthL), 0.0);
  vec3 col = alb * ramp(L) * uExp2 * mix(0.42, 1.0, smoothstep(-0.08, 0.06, L)) + alb * vec3(0.20, 0.30, 0.60) * 0.34 * eL * (1.0 - smoothstep(-0.05, 0.1, L)) * uExp2;   // dark limb stays dark: a clear crescent/gibbous
  gl_FragColor = vec4(col, 1.0);
}`;
