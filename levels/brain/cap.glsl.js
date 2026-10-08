/* The sagittal section plate. Everything on it is derived in the shader from baked real-data textures:
 *   tA  (half-float, 0.25 mm)  R,G,B = signed distance (mm, + inside) to the fsaverage pial-surface section, white-surface section, outer tissue outline
 *   tT  ICBM152 2009b T1 (0.5 mm average of 152 brains) resampled to the plate (8 bit)
 *   tB  RGB = nucleus tint (MASSP20 / MIAL67 thalamic nuclei / aseg), A = tint coverage
 *   tC  R,G,B = x-ray footprints of V1 / left frontal (DLPFC+Broca) / hand-knob motor cortex, A = aseg cortex validity
 *   tD  R = T1 unsharp detail, G = structure boundary lines, B = in-structure weight
 * Colours are classified per pixel with ~1 px wide transitions (fwidth) so edges stay crisp at every zoom. */
export const capVert = /* glsl */`
varying vec2 vUv;

void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const capFrag = /* glsl */`
precision highp float;
uniform sampler2D tA, tB, tC, tD, tT, tE, tF, tG, tH, tHf, tI;
uniform vec2 uOrg; uniform vec4 uWin; uniform vec3 cCbGm, cCbWm, cCbDeep, cBandIn, cBandOut;
uniform vec2 uSizeMM;           // plate size in mm
uniform vec3 uHot;              // activity of V1, frontal, motor 0..1.4
uniform float uTime, uZoomK, uDbg, uA, uHist; uniform vec4 uCutR, uCutE; uniform vec2 uLo, uSz;
uniform vec2 uTexel;           // sdf texel size in uv
uniform vec3 cCsf, cGm, cGmD, cWm, cWmD, cDura, cGlow, cCsfBand;
varying vec2 vUv;
float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float stepAA(float x, float aa){ return smoothstep(-aa, aa, x); }
float edge(float x, float e, float w){ return smoothstep(e - w, e + w, x); }
vec4 texBC(sampler2D t, vec2 uv, vec2 size){   // cubic B-spline filtered fetch (4 bilinear taps): C1-smooth fields at any magnification
  vec2 x = uv * size - 0.5; vec2 f = fract(x); vec2 i = floor(x);
  vec2 w0 = (1.0 / 6.0) * (1.0 - f) * (1.0 - f) * (1.0 - f), w1 = (1.0 / 6.0) * (3.0 * f * f * f - 6.0 * f * f + 4.0), w2 = (1.0 / 6.0) * (-3.0 * f * f * f + 3.0 * f * f + 3.0 * f + 1.0), w3 = (1.0 / 6.0) * f * f * f;
  vec2 g0 = w0 + w1, g1 = w2 + w3, h0 = -1.0 + w1 / g0, h1 = 1.0 + w3 / g1;
  vec2 p0 = (i + 0.5 + h0) / size, p1 = (i + 0.5 + h1) / size;
  return g0.y * (g0.x * texture2D(t, vec2(p0.x, p0.y)) + g1.x * texture2D(t, vec2(p1.x, p0.y))) + g1.y * (g0.x * texture2D(t, vec2(p0.x, p1.y)) + g1.x * texture2D(t, vec2(p1.x, p1.y)));
}
// ======================= histology (cells in the cortical ribbon, fibres in the white matter) =======================
// Curvilinear coordinates from the real section: a = arclength (mod PER mm) along the nearest pial point, b = depth below the pia (the signed distance)
const float PER = 2.0;
float hs(float n){ return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
float wrapD(float a, float b){ return mod(a - b + 1.0, PER) - 1.0; }
float cover(float d, float w, float ap){ return clamp((w - d) / ap + 0.5, 0.0, 1.0) * smoothstep(0.55, 1.7, 2.0 * w / ap); }
vec2 rot(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }

float segd(vec2 p, vec2 dir, float L){ float t = clamp(dot(p, dir), 0.0, L); return length(p - dir * t); }
// pyramidal cells in the cortex level's own cream / apricot (so the block's cells and the plate's cells are the same family), interneurons teal
const vec3 kSomaD = vec3(0.62, 0.33, 0.27), kSomaM = vec3(0.96, 0.66, 0.42), kSomaL = vec3(1.0, 0.86, 0.64), kNuc = vec3(0.84, 0.60, 0.52), kDend = vec3(0.90, 0.60, 0.44);
const vec3 kGlia = vec3(0.62, 0.64, 0.97), kInter = vec3(0.24, 0.72, 0.64), kVes = vec3(0.80, 0.33, 0.37), kVesL = vec3(1.0, 0.62, 0.55), kFib = vec3(1.0, 0.97, 0.86);
// a gently bent two-segment process (basal dendrite / axon collateral): thick root, thinner tip
float curvy(vec2 p, vec2 d, float L, float bend, float w0, float ap){ float a = cover(segd(p, d, L * 0.55), w0, ap); vec2 e = d * L * 0.55; vec2 d2 = rot(d, bend); return max(a, cover(segd(p - e, d2, L * 0.45), w0 * 0.62, ap) * 0.95); }
void soma(inout vec3 col, vec2 p, float r, float ap, vec3 cm, float pyr){
  float rx = r * mix(1.0, 0.62 + 0.38 * smoothstep(-1.0, 1.0, p.y / r), pyr), ry = r * mix(1.0, 1.25, pyr);
  float e = length(vec2(p.x / rx, p.y / ry)); float sd = (e - 1.0) * min(rx, ry);
  float c = clamp(0.5 - sd / ap, 0.0, 1.0) * smoothstep(1.5, 3.0, r / ap);
  if (c <= 0.0) return;
  float lit = (-p.y / ry) * 0.8 + (-p.x / rx) * 0.55;
  vec3 sc = mix(cm * 0.60, cm, smoothstep(-0.55, 0.05, lit)); sc = mix(sc, kSomaL * (cm / kSomaM), smoothstep(0.15, 0.65, lit));
  float res = smoothstep(2.5, 6.0, r / ap);
  vec2 q = p - vec2(0.05 * r, 0.05 * r); float nuc = (1.0 - smoothstep(0.50 * r - ap, 0.50 * r + ap, length(q))) * res;
  sc = mix(sc, mix(sc, kNuc, 0.7), nuc * 0.6); sc *= 1.0 - 0.16 * smoothstep(0.72, 1.0, e) * res;
  col = mix(col, sc, c);
}
void pyramids(inout vec3 col, float a, float b, float T, float ap, float N, float seed, float pe, vec2 fr, vec2 rr, vec2 topr, float dA){
  float cs = PER / N; float j0 = floor(a / cs);
  for (int k = -1; k <= 1; k++){
    float jm = mod(j0 + float(k), N); float h = hs(jm * 3.1 + seed); if (h > pe) continue;
    float da = wrapD(a, (jm + 0.5 + (hs(jm * 5.7 + seed + 1.0) - 0.5) * 0.6) * cs);
    float bc = mix(fr.x, fr.y, hs(jm * 7.3 + seed + 2.0)) * T, r = mix(rr.x, rr.y, hs(jm * 9.1 + seed + 3.0)), top = mix(topr.x, topr.y, hs(jm * 2.3 + seed + 4.0)) * T;
    float wob = 0.0018 * sin(b * 21.0 + h * 40.0) + 0.0010 * sin(b * 53.0 + h * 9.0);
    float w0 = (0.0008 + r * 0.085) * (1.0 - 0.5 * clamp((bc - b) / (bc - top + 1e-4), 0.0, 1.0));
    float api = cover(abs(da - wob), w0, ap) * step(b, bc - r * 0.8) * step(top, b);
    // oblique branches off the trunk and the terminal tuft
    float br = 0.0; for (int q = 0; q < 2; q++){ float sg = q == 0 ? -1.0 : 1.0; float bb = mix(bc, top, 0.45 + 0.2 * hs(jm + seed + float(q))); vec2 pp = vec2(da - wob, b - bb); br = max(br, cover(segd(pp, normalize(vec2(sg * 0.9, -0.45)), 0.04 + 0.03 * h), w0 * 0.7, ap)); }
    vec2 pt = vec2(da - wob, b - top - 0.05); float tuft = max(cover(segd(pt, normalize(vec2(-0.6, -0.8)), 0.06), w0 * 0.6, ap), cover(segd(pt, normalize(vec2(0.6, -0.8)), 0.06), w0 * 0.6, ap));
    col = mix(col, kDend, max(max(api, br * 0.9), tuft * 0.9) * dA);
    vec2 p = vec2(da, b - bc);
    for (int q = 0; q < 5; q++){ float th = 1.65 + (float(q) - 2.0) * 0.62 + (h - 0.5) * 0.5; vec2 d = vec2(sin(th), cos(th)); float Lq = 0.06 + 0.06 * hs(jm + float(q) * 3.0 + seed); col = mix(col, kDend, curvy(p, d, Lq, (hs(jm * 1.7 + float(q)) - 0.5) * 1.3, w0 * 0.78, ap) * 0.9); }
    col = mix(col, kDend * 0.85, cover(abs(da), w0 * 0.5, ap) * step(bc + r * 0.9, b) * 0.3);     // axon descending to the white matter
    soma(col, p, r, ap, kSomaM, 1.0);
  }
}
void grains(inout vec3 col, float a, float b, float T, float ap){
  const float N = 112.0; const float cs = PER / N; float j0 = floor(a / cs), i0 = floor(b / cs);
  for (int i = -1; i <= 1; i++) for (int k = -1; k <= 1; k++){
    float jm = mod(j0 + float(k), N), ib = i0 + float(i); if (ib < 0.0) continue;
    float hh = hs(jm * 1.7 + ib * 12.9 + 31.0); float f = (ib + 0.5) * cs / T; if (f > 1.0) continue;
    float p = f < 0.10 ? 0.05 : f < 0.20 ? 0.26 : f < 0.38 ? 0.20 : f < 0.48 ? 0.62 : f < 0.68 ? 0.11 : 0.20; if (hh > p * 1.35) continue;
    vec2 q = vec2(wrapD(a, (jm + 0.2 + 0.6 * hs(jm + ib * 3.3 + 5.0)) * cs), b - (ib + 0.2 + 0.6 * hs(jm * 2.0 + ib + 9.0)) * cs); float ty = hs(jm * 5.0 + ib * 7.0 + 2.0);
    if (ty < 0.74) soma(col, q, 0.0042 + 0.0020 * hs(jm + ib), ap, kSomaM * 0.92, 0.0);
    else if (ty < 0.92) soma(col, q, 0.0026, ap, kGlia, 0.0); else soma(col, q, 0.0046, ap, kInter, 0.0);
  }
}
void grainsMid(inout vec3 col, vec2 mm, float f, float ap){   // Nissl-style cell stipple for fields of a few mm to a few cm (isotropic in the plate): dots >= ~1.6 px, spacing >= 8 px, density follows the cortical layers
  float G = max(0.075, 8.0 * ap); vec2 gi = floor(mm / G); float r = 1.7 * ap;
  float p = f < 0.085 ? 0.10 : f < 0.175 ? 0.55 : f < 0.36 ? 0.42 : f < 0.47 ? 0.85 : f < 0.68 ? 0.40 : 0.48; float big = (f > 0.47 && f < 0.68) ? 1.35 : 1.0;
  for (int i = -1; i <= 1; i++) for (int k = -1; k <= 1; k++){
    vec2 c = gi + vec2(float(i), float(k)); float h = hs(c.x * 17.3 + c.y * 91.7 + 61.0); if (h > p) continue;
    vec2 q = mm - (c + vec2(0.2 + 0.6 * hs(c.x * 3.1 + c.y * 7.7), 0.2 + 0.6 * hs(c.x * 5.3 + c.y * 2.9))) * G; float rr = r * big * (0.8 + 0.4 * hs(c.x + c.y * 13.0));
    float cc = clamp(0.5 - (length(q) - rr) / ap, 0.0, 1.0); float lit = clamp(0.5 + 0.5 * (-(q.x + q.y)) / rr, 0.0, 1.0);
    col = mix(col, mix(vec3(0.46, 0.22, 0.40), vec3(0.76, 0.52, 0.60), lit * 0.8), cc * 0.6);
  }
}
void vessels(inout vec3 col, float a, float b, float T, float ap, float rmin, float keep){
  // penetrating arterioles / venules from the pia (wavy, radial) + a finer capillary net
  for (int fam = 0; fam < 2; fam++){
    float N = fam == 0 ? 9.0 : 40.0; float cs = PER / N; float j0 = floor(a / cs); float rv = max(fam == 0 ? 0.0046 : 0.0026, rmin); if (fam == 1 && keep < 0.5) continue;
    for (int k = -1; k <= 1; k++){
      float jm = mod(j0 + float(k), N); float h = hs(jm * 4.3 + 77.0 + float(fam) * 31.0); if (fam == 1 && h > 0.62) continue; if (fam == 0 && keep < 0.5 && h > 0.55) continue;
      float da = wrapD(a, (jm + 0.5 + (h - 0.5) * 0.5) * cs);
      float wob = (fam == 0 ? 0.006 : 0.012) * sin(b * (fam == 0 ? 11.0 : 17.0) + h * 30.0) + 0.0025 * sin(b * 37.0 + h * 5.0);
      float top = fam == 0 ? 0.03 : 0.10 + 0.3 * h; float bot = fam == 0 ? T * (0.55 + 0.45 * h) : T * (0.35 + 0.6 * hs(jm + 3.0));
      float cv = cover(abs(da - wob), rv, ap) * step(top, b) * step(b, bot);
      float cl = cover(abs(da - wob), rv * 0.42, ap) * cv;
      float rr2 = clamp(abs(da - wob) / rv, 0.0, 1.0); vec3 tube = mix(kVesL * 1.02, kVes * 0.66, smoothstep(0.15, 1.0, rr2)); tube = mix(tube, tube * 1.12, step(0.0, -(da - wob)) * 0.4);
      col = mix(col, tube, cv * (fam == 0 ? 0.95 : 0.78));
    }
  }
}
void fibres(inout vec3 col, float aw, float bw, float ap, float amp){
  // myelinated fibres radiating from the white surface into the gyral cores; spacing / width adapt to the pixel size so they never alias into hairlines
  float N = floor(PER / max(0.031, 9.0 * ap)); float cs = PER / N; float j0 = floor(aw / cs);
  float fade = smoothstep(3.4, 0.8, bw) * smoothstep(0.0085, 0.0045, ap);
  for (int k = -1; k <= 1; k++){
    float jm = mod(j0 + float(k), N); float h = hs(jm * 2.9 + 501.0); if (h > 0.62) continue;
    float da = wrapD(aw, (jm + 0.5 + (hs(jm + 7.0) - 0.5) * 0.7) * cs);
    float wob = 0.003 * sin(bw * 23.0 + h * 50.0);
    col = mix(col, kFib, cover(abs(da - wob), max(0.0011 + 0.0007 * h, 0.9 * ap), ap) * fade * step(0.0, bw) * 0.42 * amp);
  }
}

void main(){
#ifndef WALLMODE
  if (uCutE.w > 0.5) { vec2 d = uLo + vUv * uSz - uCutR.xy; vec2 l = vec2(uCutR.z * d.x + uCutR.w * d.y, -uCutR.w * d.x + uCutR.z * d.y); if (abs(l.x) < uCutE.x && l.y < uCutE.y && l.y > uCutE.z) discard; }
#endif
  vec4 A = texBC(tA, vUv, 1.0 / uTexel), B = texBC(tB, vUv, 2.0 / uTexel), C = texture2D(tC, vUv), Dv = texture2D(tD, vUv);
  vec2 mm = vUv * uSizeMM; vec2 dm = fwidth(mm); float aa = max(max(dm.x, dm.y) * 0.8, 0.010);
  vec4 Gm = texture2D(tG, vUv); vec4 Hd = texture2D(tH, vUv);
  float t = texBC(tT, vUv, vec2(1504.0, 1488.0)).r * 1.3;
  float sp = A.r, sw = A.g, so = A.b, sb = A.a;
  float det = (Dv.r - 0.5) / 1.6, line = Dv.g, pill = Dv.b;
  float ft = max(fwidth(t), 0.012); float w = clamp(ft * 0.9, 0.012, 0.09);
  // local frame of the folded cortex: direction normal to the white-matter / pial surface (from the sdf gradients)
  vec2 eu = uTexel; float fine = smoothstep(0.14, 0.03, aa);
  vec2 gw = vec2(texture2D(tA, vUv + vec2(eu.x, 0.0)).g - texture2D(tA, vUv - vec2(eu.x, 0.0)).g, texture2D(tA, vUv + vec2(0.0, eu.y)).g - texture2D(tA, vUv - vec2(0.0, eu.y)).g) / (2.0 * eu * uSizeMM);
  vec2 gp = vec2(texture2D(tA, vUv + vec2(eu.x, 0.0)).r - texture2D(tA, vUv - vec2(eu.x, 0.0)).r, texture2D(tA, vUv + vec2(0.0, eu.y)).r - texture2D(tA, vUv - vec2(0.0, eu.y)).r) / (2.0 * eu * uSizeMM);
  float lw = length(gw), lp = length(gp);
  vec2 dw = lw > 1e-3 ? gw / lw : vec2(0.0, 1.0), dp = lp > 1e-3 ? gp / lp : vec2(0.0, 1.0);
  // ---- base class from T1: csf -> grey matter -> white matter
  float gmK = edge(t, 0.40, w), wmK = edge(t, 0.74, w * 1.2);
  vec3 gmc = mix(cGmD, cGm, smoothstep(0.42, 0.72, t));
  vec3 wmc = mix(mix(cWmD, cWm, 0.72), cWm, smoothstep(0.70, 1.00, t) * 0.25);   // flat banded white-matter fill: no MRI-intensity blotches
  vec3 col = mix(cCsf, gmc, gmK); col = mix(col, wmc, wmK);
  { float cbm = smoothstep(0.30, 0.70, Gm.g);          // cerebellum: deeper plum cortex against bright white matter so the folia and the arbor vitae read crisply
    float fol = (Dv.r - 0.5) * 1.0;
    float tb = t + fol * 0.8; vec3 cbc = mix(cCbDeep, cCbGm, edge(tb, 0.52, w * 1.5)); cbc = mix(cbc, cCbWm, edge(tb, 0.76, w * 1.5));
    cbc *= 1.0 + fol * 0.7 * smoothstep(0.12, 0.03, aa);
    { vec4 Ic = texture2D(tI, vUv); float dpt = Ic.b * 7.0 - 1.0; vec2 cs = Ic.rg * 2.0 - 1.0; float angw = atan(cs.y, cs.x) + 4.6 * (vnoise(mm * 0.27) - 0.5) + 1.2 * (vnoise(mm * 1.1) - 0.5); float tid = floor(angw / 6.2831853 + 0.5 + 20.0 * 6.2831853) ; float cph = cos(angw) * smoothstep(0.1, 0.4, length(cs));
      float fw = clamp(dm.x * 0.8 / 0.10, 0.04, 0.9);                                     // widen the transitions when a folium is thinner than ~3 px so it never aliases
      float inF = step(0.0, dpt) * smoothstep(4.0, 3.0, dpt) * smoothstep(0.03, 0.12, Ic.b) * cbm;
      float wmF = smoothstep(0.05 - fw * 0.3, 0.30 + fw * 0.3, cph) * smoothstep(0.38, 0.62, dpt);   // white-matter core of each folium (under a ~0.5 mm grey rim)
      float lenF = 1.2 + 2.3 * vnoise(mm * 0.42) + 0.9 * hs(floor((angw + 40.0) / 6.2831853) + 3.0); wmF *= smoothstep(lenF, lenF - 0.7, dpt);
      float par = mod(floor(angw / 6.2831853 + 0.5 + 400.0), 2.0); float fis = smoothstep(-0.55 + fw * 0.2, -0.95, cph) * smoothstep(3.6, 0.2, dpt) * mix(1.0, smoothstep(2.0, 0.8, dpt), par);                // fissures between folia
      vec3 fc = mix(mix(cCbDeep, cCbGm, 0.55), cCbWm, wmF); fc = mix(fc, cCbDeep * 0.62, fis * 0.9);
      if (inF > 0.002) cbc = mix(cbc, fc, inF * (1.0 - 0.7 * smoothstep(0.0, 0.5, fw - 0.5))); }
    col = mix(col, cbc, cbm * gmK); }
  // ---- cerebral cortex ribbon, crisp from the surface sections
  float inP = stepAA(sp, aa), inW = stepAA(sw, aa);
  float valid = smoothstep(0.25, 0.55, C.a); { vec2 fsx = uOrg + mm; valid = max(valid, 1.0 - smoothstep(26.0, 44.0, length(fsx - vec2(31.33, 57.94)))); }   // around the locus the cortical ribbon / white matter come straight from the pial / white surface sections: no mask-edge rectangles
  float ribbon = inP * (1.0 - inW) * valid;
  // pial depth coordinate, layer fraction f = depth / thickness
  float apx = max(max(dm.x, dm.y) * 0.8, 0.00015);
  float dep = clamp(sp, 0.0, 4.0); float thick = clamp(sp - sw, 1.4, 4.5); float f = clamp(dep / thick, 0.0, 1.0);
  vec4 F = texBC(tF, vUv, 1.0 / uTexel) * 2.0 - 1.0; float pa = (atan(F.y, F.x) / 6.2831853 + 0.5) * PER, wa = (atan(F.w, F.z) / 6.2831853 + 0.5) * PER; float pr = smoothstep(0.2, 0.6, length(F.xy)) * uHist, wr = smoothstep(0.55, 0.88, length(F.zw));
   float zoom = smoothstep(0.0060, 0.0028, apx); float mid = smoothstep(0.040, 0.012, apx);           // 1 when individual cells are resolvable (fine detail fades in below ~45 um/px)
  float lamt = 0.10 * (1.0 - smoothstep(0.07, 0.13, f)) - 0.10 * smoothstep(0.34, 0.40, f) * (1.0 - smoothstep(0.46, 0.52, f)) - 0.03 * smoothstep(0.66, 0.72, f) - 0.02 * smoothstep(0.18, 0.28, f) * (1.0 - smoothstep(0.30, 0.38, f));
  vec3 rib = mix(cGm, cGmD, smoothstep(0.0, 3.0, dep) * 0.45) * (1.0 + lamt * 2.6);
  float dens = 0.12 + 0.62 * smoothstep(0.08, 0.14, f) * (1.0 - smoothstep(0.34, 0.38, f)) + 0.95 * smoothstep(0.36, 0.40, f) * (1.0 - smoothstep(0.47, 0.50, f)) + 0.45 * smoothstep(0.47, 0.50, f) * (1.0 - smoothstep(0.66, 0.70, f)) + 0.6 * smoothstep(0.66, 0.70, f);
  float midK = 0.30 + 0.70 * smoothstep(0.002, 0.008, apx);
  rib = mix(rib, rib * vec3(0.84, 0.92, 0.97) + vec3(0.0, 0.03, 0.045), clamp(dens, 0.0, 1.0) * 0.75 * midK * smoothstep(0.08, 0.03, apx));      // cell-dense layers read cooler/darker when single cells are sub-pixel
  rib *= 1.0 + (vnoise(mm * 70.0) * 0.6 + vnoise(mm * 190.0) * 0.4 - 0.5) * 0.08 * zoom;
  rib = mix(rib, rib * 0.78, smoothstep(0.10 + aa, 0.10, dep) * 0.0 + smoothstep(0.07 + aa, 0.0, abs(dep - 0.035)) * 0.55);   // pia
  float wmIn = inW * valid * smoothstep(0.30, 0.46, t);
  vec3 wmh = wmc * mix(1.0, 0.93, zoom);
  rib *= mix(vec3(1.0), vec3(0.95, 0.88, 0.93), zoom); rib *= 1.0 + (vnoise(mm * 9.0) - 0.5) * 0.10 * zoom * smoothstep(0.01, 0.0015, apx);

  { // laminar structure of the cortex (layers I-VI): thin cool boundaries + alternating tone, readable from a few mm to a few cm
    float lw2 = max(0.010, 1.1 * apx) / thick; float ln = 0.0;
    ln = max(ln, smoothstep(lw2, 0.0, abs(f - 0.085))); ln = max(ln, smoothstep(lw2, 0.0, abs(f - 0.175))); ln = max(ln, smoothstep(lw2, 0.0, abs(f - 0.36)));
    ln = max(ln, smoothstep(lw2, 0.0, abs(f - 0.47))); ln = max(ln, smoothstep(lw2, 0.0, abs(f - 0.68)));
    float lay = (f < 0.085 ? 1.05 : f < 0.175 ? 0.97 : f < 0.36 ? 1.0 : f < 0.47 ? 0.91 : f < 0.68 ? 1.0 : 0.95);
    rib *= mix(1.0, lay, 0.8 * mid) * (1.0 - 0.13 * ln * mid * smoothstep(0.003, 0.012, thick) * (1.0 - zoom));
  }
#ifdef FINE
  if (mid * (1.0 - zoom) * pr > 0.001 && ribbon > 0.002) { vec3 r0 = rib; grainsMid(rib, mm, f, apx); rib = mix(r0, rib, pr * smoothstep(0.0, 0.0035, 1.0 - zoom) * 1.0); }
  if (zoom * pr > 0.001 && ribbon > 0.002) {
    float ap = apx; vec3 rib0 = rib;
    { const float G = 0.0075; vec2 gi = floor(mm / G);       // neuropil: fine stipple of dendrite / axon / glial-process cross-sections
      for (int i = -1; i <= 1; i++) for (int k = -1; k <= 1; k++){
        vec2 c = gi + vec2(float(i), float(k)); float h = hs(c.x * 13.7 + c.y * 71.3 + 9.0); if (h > 0.7) continue;
        vec2 q = mm - (c + vec2(0.15 + 0.7 * hs(c.x * 3.3 + c.y * 5.1), 0.15 + 0.7 * hs(c.x * 7.9 + c.y * 1.3))) * G; float r = 0.0011 + 0.0016 * hs(c.x * 2.1 + c.y * 9.7);
        float cc = clamp(0.5 - (length(q) - r) / ap, 0.0, 1.0) * smoothstep(0.7, 1.9, r / ap);
        rib = mix(rib, rib * (h < 0.35 ? vec3(1.07, 1.05, 1.02) : vec3(0.92, 0.90, 0.93)), cc * 0.45);
      } }
    vessels(rib, pa, dep, thick, ap, 0.0, 1.0);
    pyramids(rib, pa, dep, thick, ap, 26.0, 11.0, 0.85, vec2(0.50, 0.66), vec2(0.0150, 0.0210), vec2(0.03, 0.06), 0.95);    // L5 large pyramids
    pyramids(rib, pa, dep, thick, ap, 52.0, 41.0, 0.85, vec2(0.12, 0.36), vec2(0.0085, 0.0125), vec2(0.03, 0.07), 0.62);    // L2/3 pyramids
    pyramids(rib, pa, dep, thick, ap, 38.0, 71.0, 0.80, vec2(0.70, 0.95), vec2(0.0095, 0.0135), vec2(0.18, 0.5), 0.62);     // L6 pyramids
    grains(rib, pa, dep, thick, ap);
    rib = mix(rib0, rib, pr);
  }

#endif
  { float st = vnoise(mm * 2.2) * 0.6 + vnoise(mm * 6.5) * 0.4; wmh *= 1.0 + (st - 0.5) * 0.07 + 0.05 * smoothstep(0.0, 3.0, max(sw, 0.0)) * smoothstep(0.08, 0.02, apx); }

#ifdef FINE
  if (false && uDbg < 5.5 && zoom * wr > 0.001 && wmIn > 0.002) { fibres(wmh, wa, max(sw, 0.0), apx, wr * smoothstep(0.93, 0.995, lw)); }
#endif
  col = mix(col, rib, ribbon);
  col = mix(col, wmh, wmIn * 0.95);
  // ---- nuclei and brainstem tints from the atlases (keep the T1 shading underneath)
  float kcv = max(fwidth(B.a) * 0.75, 0.035); float bcov = smoothstep(0.5 - kcv, 0.5 + kcv, B.a);
  vec3 tint = pow(B.rgb, vec3(2.2));
  float lum = dot(col, vec3(0.30, 0.59, 0.11)) / dot(cWm, vec3(0.30, 0.59, 0.11));
  float lumT = max(dot(tint, vec3(0.30, 0.59, 0.11)), 0.03); vec3 hueT = tint / lumT; float lc = max(dot(col, vec3(0.30, 0.59, 0.11)), 0.42);
  vec3 tcol = mix(tint * (0.55 + 0.55 * lum), hueT * lc * 1.12, 0.62) * (1.0 + (line - 0.5) * 2.2) * (0.94 + det * 1.8) * (0.86 + 0.22 * smoothstep(0.40, 0.95, pill));
  { vec2 eB = vec2(3.0 / 1504.0, 3.0 / 1488.0); vec2 gB = vec2(texture2D(tB, vUv + vec2(eB.x, 0.0)).a - texture2D(tB, vUv - vec2(eB.x, 0.0)).a, texture2D(tB, vUv + vec2(0.0, eB.y)).a - texture2D(tB, vUv - vec2(0.0, eB.y)).a);
    float bev = clamp(-dot(gB, vec2(-0.6, 0.8)) * 2.6, -0.3, 0.3); tcol *= 1.0 + bev * 0.9; tcol *= 0.74 + 0.26 * smoothstep(0.52, 0.95, B.a); }
  tcol *= 1.0 + (vnoise(mm * 0.55) - 0.5) * 0.10 + (vnoise(mm * 1.7) - 0.5) * 0.06;     // painterly low-frequency mottling so nuclei are never flat colour

#ifdef FINE
  if (zoom > 0.001 && bcov > 0.05) {   // grey-matter nuclei are cell-dense: stipple of somas (same cell language as the cortex)
    const float G = 0.031; vec2 gi = floor(mm / G);
    for (int i = -1; i <= 1; i++) for (int k = -1; k <= 1; k++){
      vec2 c = gi + vec2(float(i), float(k)); float h = hs(c.x * 17.3 + c.y * 91.7 + 3.0); if (h > 0.34) continue;
      vec2 q = mm - (c + vec2(0.2 + 0.6 * hs(c.x * 3.1 + c.y * 7.7), 0.2 + 0.6 * hs(c.x * 5.3 + c.y * 2.9))) * G; float r = 0.0042 + 0.0022 * hs(c.x + c.y * 13.0);
      float cc = clamp(0.5 - (length(q) - r) / apx, 0.0, 1.0) * min(1.0, r / apx); float lit = step(0.0, -(q.x + q.y) / r + 0.2);
      tcol = mix(tcol, tcol * (lit > 0.5 ? 1.22 : 0.70), cc * 0.75 * zoom);
    }
  }

#endif
  { float sdB = (Gm.r - 0.5) * 24.0; float inB = smoothstep(-0.6, 0.6, sdB) * step(0.5, Gm.r);
    vec2 fs3 = uOrg + mm; vec2 axd = vec2(-0.18, -0.984), prp = vec2(0.984, -0.18);
    vec2 e2 = vec2(3.0 / 1504.0, 3.0 / 1488.0);
    vec2 gB = vec2(texture2D(tG, vUv + vec2(e2.x, 0.0)).r - texture2D(tG, vUv - vec2(e2.x, 0.0)).r, texture2D(tG, vUv + vec2(0.0, e2.y)).r - texture2D(tG, vUv - vec2(0.0, e2.y)).r);
    float ant = smoothstep(0.15, 0.65, -gB.x / (length(gB) + 1e-5));                 // 1 where the outer surface faces anterior (ventral surface of the brainstem)
    float pst = smoothstep(0.15, 0.65, gB.x / (length(gB) + 1e-5));
    float fibr = vnoise(vec2(dot(fs3, prp) * 2.4, dot(fs3, axd) * 0.20)) * 0.6 + vnoise(vec2(dot(fs3, prp) * 6.0, dot(fs3, axd) * 0.45)) * 0.4;
    float ss0 = (2.0 - fs3.y) * 0.98 + (-26.0 - fs3.x) * 0.18;
    float cl = 1.0 - 0.22 * smoothstep(4.5, 0.0, sdB);
    tcol *= mix(1.0, cl * (0.93 + 0.14 * fibr), inB);
    float basis = ant * smoothstep(9.0, 3.5, sdB) * inB;                              // corticospinal fibres: cerebral peduncle -> basis pontis -> pyramids, the ventral strip of the brainstem
    tcol = mix(tcol, vec3(0.99, 0.82, 0.90) * (0.90 + 0.18 * fibr), basis * 0.42);
    float groove = (exp(-pow((ss0 - 21.5) / 0.9, 2.0)) + exp(-pow((ss0 - 46.0) / 0.9, 2.0))) * smoothstep(7.0, 1.0, sdB) * (0.4 + 0.6 * ant) * inB;   // pontomesencephalic / pontomedullary sulci
    tcol *= 1.0 - 0.34 * groove;
    tcol *= 1.0 + 0.10 * pst * smoothstep(5.0, 0.0, sdB) * inB;                        // dorsal rim catches the light
  }

  tcol *= 1.0 - 0.10 * smoothstep(0.2, 0.9, texture2D(tE, vUv).a) * smoothstep(0.075, 0.02, apx);
  tcol /= max(1.0, max(tcol.r, max(tcol.g, tcol.b)) / 0.93);
  col = mix(col, tcol, bcov * smoothstep(0.26, 0.42, t) * 0.80);
  { // deep white matter: fibre bundles (LIC of the corona-radiata orientation field derived from the real white surface); a finer window around the flight path shows them at 1-2 cm fields of view
    vec2 fs2 = uOrg + mm; vec2 wuv = (fs2 - uWin.xz) / (uWin.yw - uWin.xz);
    float inW2 = step(0.0, wuv.x) * step(wuv.x, 1.0) * step(0.0, wuv.y) * step(wuv.y, 1.0);
    float edgeF = smoothstep(0.0, 0.03, min(min(wuv.x, 1.0 - wuv.x), min(wuv.y, 1.0 - wuv.y)));
    float kw = inW2 * edgeF;
    float lbF = texture2D(tHf, wuv, 1.2).r, lbC = texture2D(tH, vUv, 0.0).r;
    float lb = mix(lbC, lbF, kw);
    float isWM = smoothstep(0.68, 0.84, t) * inW * (1.0 - bcov) * (1.0 - smoothstep(0.30, 0.70, Gm.g)) * (1.0 - ribbon);
    // white-matter tracts: the LIC streamline field (U-fibres tangential under the cortex, corona-radiata fan deeper) cut into flat two-tone bundles, tinted by direction (horizontal = cool lilac, vertical = warm rose), same cel language as the cortex
    float bun = smoothstep(0.44, 0.56, lb); float bun2 = smoothstep(0.30, 0.38, lb) * (1.0 - smoothstep(0.62, 0.70, lb));
    vec2 dir = vec2(Hd.g, Hd.b) * 2.0 - 1.0; float vert = abs(dir.y) / max(length(dir), 1e-3);
    vec3 tone = mix(vec3(0.90, 0.83, 0.94), vec3(1.03, 1.02, 0.99), bun);
    tone *= mix(vec3(0.96, 0.98, 1.05), vec3(1.05, 0.97, 0.93), smoothstep(0.35, 0.8, vert));
    tone *= 1.0 - 0.07 * bun2;
    float strK = smoothstep(0.22, 0.05, apx) * (0.35 + 0.65 * smoothstep(0.0015, 0.012, apx * 3.0));
    col = mix(col, col * tone, isWM * strK * 0.9);
  }
  // sulcal CSF: pial-surface gaps inside the hemisphere (the 0.5 mm T1 cannot resolve narrow ones) are dark CSF, never white-matter cream
  float slit = smoothstep(0.0, 0.10, -sp) * stepAA(so, aa) * smoothstep(0.25, 0.55, C.a) * (1.0 - bcov) * (1.0 - smoothstep(0.30, 0.70, Gm.g));
  col = mix(col, mix(vec3(0.40, 0.21, 0.42), cCsf * 0.72, smoothstep(0.1, 2.0, -sp)), slit * 0.9);
  // ---- outline: tissue, subarachnoid CSF, dura
  float tissue = stepAA(so, aa);
  float band = (1.0 - stepAA(so, aa)) * stepAA(sb + 1.3, aa * 1.5);
  float arach = smoothstep(0.05 + aa, 0.0, abs(sb + 1.3)) * (1.0 - tissue);
  float dura = smoothstep(0.22 + aa, 0.0, abs(sb + 2.45));
  col *= 1.0 + 0.10 * smoothstep(0.9, 0.0, so) * tissue;                 // thin rim light
  col *= 1.0 - 0.10 * smoothstep(0.7, 0.0, so) * tissue;                 // soft inner shade just inside the pia
  // ---- functional glow (x-ray footprint, amber), animated by uHot
  float g = clamp(C.r * uHot.x + C.g * uHot.y + C.b * uHot.z, 0.0, 1.4);
  float core = smoothstep(0.55, 1.0, g);
  float onGm = 0.05 + 0.95 * ribbon;
  col = mix(col, cGlow * (0.8 + 0.4 * core), clamp(g * 0.18 + core * 0.22, 0.0, 0.42) * tissue * onGm);
  // ---- x-ray silhouettes of structures lying behind the plane (hippocampus, amygdala, putamen/pallidum): translucent tint + a fine outline
  vec4 E = texture2D(tE, vUv);
  vec3 gcol = vec3(0.50, 0.89, 0.77) * E.r + vec3(1.0, 0.49, 0.59) * E.g + vec3(0.55, 0.58, 0.95) * E.b;
  float gm = max(max(smoothstep(0.45, 0.6, E.r), smoothstep(0.45, 0.6, E.g)), smoothstep(0.45, 0.6, E.b));
  float oline = 1.0 * max(max(1.0 - smoothstep(0.0, max(fwidth(E.r), 1e-4) * 1.2, abs(E.r - 0.5)), 1.0 - smoothstep(0.0, max(fwidth(E.g), 1e-4) * 1.2, abs(E.g - 0.5))), 1.0 - smoothstep(0.0, max(fwidth(E.b), 1e-4) * 1.2, abs(E.b - 0.5)));
  vec3 gc = pow(gcol / max(E.r + E.g + E.b, 1e-3), vec3(2.2));
  float gsoft = max(max(smoothstep(0.30, 0.70, E.r), smoothstep(0.30, 0.70, E.g)), smoothstep(0.30, 0.70, E.b));
  float ghostK = gsoft * (1.0 - bcov) * tissue;
  col = mix(col, gc * 1.18, ghostK * 0.46);           // structures lying behind the plane (x-ray): soft translucent fills, no outlines
  col = mix(col, gc * 1.5, ghostK * smoothstep(0.62, 0.95, gsoft) * 0.0);
  // sulcal CSF slits inside the cortex are open: you look into the sulcus at the real folded surface behind the plate
  float hole = (1.0 - gmK) * inP * (1.0 - inW) * valid * (1.0 - bcov) * smoothstep(0.1, 0.5, sp);
  col = mix(col, mix(cCsf * 0.85, vec3(0.50, 0.26, 0.46), smoothstep(0.04, 0.38, t) * 0.8), hole * 0.85); vec3 outc = col; float alpha = tissue * (1.0 - hole * 0.40) * (1.0 - slit * 0.3);
  vec3 bandC = mix(cBandOut, cBandIn, smoothstep(-1.3, -0.1, sb));
  outc = mix(outc, bandC, band * (1.0 - tissue)); alpha = max(alpha, band * smoothstep(-1.3, -0.45, sb) * max(mix(0.55, 0.97, smoothstep(0.35, -0.35, sb)), 0.97 * smoothstep(0.0, 1.0, uZoomK)));   // over the convexity the CSF is opaque (nothing of the mesh behind may show through); sulcal gaps stay see-through
  outc = mix(outc, vec3(0.62, 0.60, 0.95), arach * 0.35); alpha = max(alpha, arach * 0.4);
  float duraT = smoothstep(0.10 + aa * 0.6, 0.0, abs(sb + 2.45));
  outc = mix(outc, cDura, duraT * 0.55); alpha = max(alpha, duraT * 0.4);
  { float tn = Gm.b; col = mix(col, cDura * 1.05, tn * 0.85 * tissue); outc = mix(outc, cDura * 1.05, tn * 0.85 * tissue); }

#ifdef FINE
  float lumn = max(1.0 - tissue, max(slit, hole));
  if (mid > 0.001 && sp < 0.02 && sp > -1.5) {
    const float N = 22.0; const float cs = PER / N; float j0 = floor(pa / cs); float ap = apx;
    for (int k = -1; k <= 1; k++){
      float jm = mod(j0 + float(k), N); float h = hs(jm * 6.1 + 901.0); if (h > 0.55) continue;
      float rr = 0.012 + 0.020 * hs(jm + 29.0); vec2 q = vec2(wrapD(pa, (jm + 0.5) * cs), sp + rr * 0.92);
      float d = length(q); float c = clamp(0.5 - (d - rr) / ap, 0.0, 1.0) * min(1.0, rr / ap);
      vec3 vc = d < rr * 0.62 ? vec3(0.55, 0.16, 0.27) : kVes; vc = d < rr * 0.30 ? vec3(0.80, 0.28, 0.35) : vc;
      outc = mix(outc, vc, c * lumn); alpha = max(alpha, c * lumn);
    }
  }
  if (zoom > 0.001 && sp < 0.0 && sp > -1.2) {            // arachnoid trabeculae: fine threads bridging the pia and the arachnoid across the CSF
    float ap2 = apx; const float N2 = 30.0; const float cs2 = PER / N2; float j02 = floor(pa / cs2); float tr = 0.0;
    for (int k = -1; k <= 1; k++){ float jm = mod(j02 + float(k), N2); float h = hs(jm * 2.3 + 401.0); if (h > 0.62) continue; float da = wrapD(pa, (jm + 0.5) * cs2) + 0.02 * sin(sp * 14.0 + h * 40.0 + float(k)); tr = max(tr, cover(abs(da), 0.0022 + 0.0012 * h, ap2) * step(sp, -0.02) * step(-0.18 - 0.35 * h, sp)); }
    outc = mix(outc, vec3(0.80, 0.72, 0.96), tr * 0.42 * lumn * pr); alpha = max(alpha, tr * 0.5 * lumn * pr);
  }
  if (mid > 0.001 && sp < 0.02 && sp > -1.4) {   // pial arteries (MCA/ACA branches) running over the pia inside the subarachnoid CSF, with a lit tube profile
    float ap3 = apx;
    for (int k = 0; k < 3; k++){
      float fk = float(k); float off = -(0.10 + 0.30 * hs(fk * 3.7 + 11.0)); float wob = 0.05 * (vnoise(mm * 1.3 + fk * 5.0) - 0.5);
      float rv = 0.022 + 0.010 * hs(fk + 5.0); float dd = abs(sp - off - wob);
      float brk = smoothstep(0.42, 0.60, vnoise(mm * 0.55 + fk * 11.0));          // vessels come and go along the surface (branching / diving)
      float cv = clamp((rv - dd) / ap3 + 0.5, 0.0, 1.0) * smoothstep(0.55, 1.7, 2.0 * rv / ap3) * brk;
      float prof = clamp(1.0 - dd / rv, 0.0, 1.0);
      vec3 vc = mix(kVes * 0.62, kVesL, smoothstep(0.0, 0.85, prof) * (0.55 + 0.45 * step(0.0, wob * 0.0 + (sp - off - wob) * -1.0)));
      outc = mix(outc, vc, cv * lumn); alpha = max(alpha, cv * lumn);
    }
  }
#endif
  gl_FragColor = vec4(outc, alpha * uA);
  if (uDbg > 0.5 && uDbg < 5.5) { if (uDbg < 1.5) gl_FragColor = vec4(B.rgb, 1.0); else if (uDbg < 2.5) gl_FragColor = vec4(vec3(t), 1.0); else if (uDbg < 3.5) gl_FragColor = vec4(E.rgb, 1.0); else if (uDbg < 4.5) gl_FragColor = vec4(vec3(tissue), 1.0); else gl_FragColor = vec4(vec3(bcov), 1.0); }
  if (uDbg > 7.5 && uDbg < 8.5) gl_FragColor = vec4(valid, wmIn, inW, 1.0); if (uDbg > 8.5 && uDbg < 9.5) gl_FragColor = vec4(C.rgb, 1.0);
  if (uDbg > 5.5 && uDbg < 6.5) gl_FragColor = vec4(Gm.rgb, 1.0); else if (uDbg > 6.5 && uDbg < 7.5) gl_FragColor = vec4(texture2D(tI, vUv).rgb, 1.0);
  if (gl_FragColor.a < 0.003) discard;
}`;
