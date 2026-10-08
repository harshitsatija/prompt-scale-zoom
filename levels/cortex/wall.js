/* cortex/wall.js: the tissue behind the section plane, painted procedurally in a fragment shader (so it is sharp at every zoom).
 *  - wide fields: a Nissl-like layered background. A depth lookup table (LAYERS) gives each lamina its tint, cell-presence probability, cell size and cell class
 *    (pyramidal cream / interneuron teal / glia lilac); cells are drawn as soft out-of-focus discs, plus faint radial dendrite bundles in the cortex and
 *    tangential myelinated fibre striations in the white matter. Fine texture is faded by the pixel footprint so nothing aliases or shimmers.
 *  - close fields (< ~0.3 mm): an electron-microscopy-like neuropil: packed rounded profiles of dendrites, axons, glia in a restrained indigo / violet / teal
 *    palette with dark membranes, mitochondria, and a few myelinated axon cross-sections (ring + pale core). */
import { LAYERS, X0, X1, ZW, MM, YB } from './field.js';
const ss01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function makeWall(ctx, shade) {
  const { T } = ctx, group = new T.Group();
  // ---- depth lookup tables (256 texels over 0..3.7 mm), colours are sRGB
  const NT = 256, DMAX = 4.8, lutA = new Uint8Array(NT * 4), lutB = new Uint8Array(NT * 4);
  const tint = { I: [0x5a, 0x5c, 0xc4], II: [0x16, 0x18, 0x62], III: [0x33, 0x34, 0x9a], IV: [0x0c, 0x38, 0x70], V: [0x58, 0x32, 0x9c], VI: [0x2a, 0x34, 0x8c], WM: [0xa4, 0x98, 0xd8] };
  const dens = { I: 0.07, II: 0.90, III: 0.62, IV: 0.95, V: 0.50, VI: 0.58, WM: 0.12 };     // probability that a lattice cell holds a soma (relative)
  const rad = { I: 0.22, II: 0.27, III: 0.31, IV: 0.25, V: 0.40, VI: 0.30, WM: 0.20 };       // soma radius as a fraction of the lattice pitch
  const pyr = { I: 0.1, II: 0.8, III: 0.8, IV: 0.2, V: 0.85, VI: 0.7, WM: 0 };               // pyramidal share (cream) vs interneuron (teal)
  const L = (d) => { for (const l of LAYERS) if (d >= l.a && d < l.b) return l.n; return d < 0 ? 'I' : 'WM'; };
  const lerp = (a, b, t) => a + (b - a) * t;
  for (let i = 0; i < NT; i++) {
    const d = (i + 0.5) / NT * DMAX, a = L(d - 0.04), b = L(d + 0.04), t = a === b ? 0 : 0.5, k = (n) => n;
    for (let c = 0; c < 3; c++) lutA[i * 4 + c] = lerp(tint[k(a)][c], tint[k(b)][c], t);
    lutA[i * 4 + 3] = 255 * lerp(dens[a], dens[b], t);
    lutB[i * 4] = 255 * lerp(rad[a], rad[b], t) * 2; lutB[i * 4 + 1] = 255 * lerp(pyr[a], pyr[b], t); lutB[i * 4 + 2] = a === 'WM' || b === 'WM' ? (d > 3.55 ? 255 : 120) : 0; lutB[i * 4 + 3] = 255;
  }
  const blur = (data, rad, chans) => { const src = Uint8Array.from(data); for (let i = 0; i < NT; i++) for (const c of chans) { let a = 0, w = 0; for (let k = -rad; k <= rad; k++) { const j = Math.min(NT - 1, Math.max(0, i + k)), ww = Math.exp(-(k * k) / (0.5 * rad * rad)); a += src[j * 4 + c] * ww; w += ww; } data[i * 4 + c] = a / w; } };
  blur(lutA, 4, [0, 1, 2, 3]); blur(lutB, 3, [0, 1]);
  const mk = (data) => { const t = new T.DataTexture(data, NT, 1, T.RGBAFormat); t.minFilter = t.magFilter = T.LinearFilter; t.colorSpace = T.NoColorSpace; t.needsUpdate = true; return t; };
  const U = { tA: { value: mk(lutA) }, tB: { value: mk(lutB) }, uMix: { value: 0 }, uPx: { value: 1e-6 }, uA: { value: 1 }, uFlat: { value: 0 }, uBr: { value: 0 }, uCell: { value: 1 / 1.3e-6 }, uDmax: { value: DMAX * MM } };
  const mat = new T.ShaderMaterial({
    uniforms: U, depthWrite: true,
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
uniform sampler2D tA; uniform sampler2D tB; uniform float uMix; uniform float uPx; uniform float uCell; uniform float uDmax; uniform float uA; uniform float uFlat; uniform float uBr; varying vec2 vP;
vec2 h22(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
float h12(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), f.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), f.x), f.y); }
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
// Nissl-like soft cells on a jittered lattice; returns rgb contribution (premultiplied) and writes coverage
vec4 nissl(vec2 p, float pitch, float depthN, vec4 la, vec4 lb, float seed){
  vec2 x = p / pitch; vec2 n = floor(x), f = fract(x); vec4 acc = vec4(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j)); vec2 id = n + g + seed; vec2 o = h22(id); float pres = step(h12(id + 17.0), la.a);
    if (pres < 0.5) continue;
    vec2 r = g + o * 0.8 + 0.1 - f; float rr = lb.r * 0.5 * (0.75 + 0.5 * h12(id + 5.0)); float d = length(r);
    float cov = smoothstep(rr, rr * 0.45, d); float pc = step(h12(id + 29.0), lb.g);
    vec3 col = pc > 0.5 ? vec3(0.98, 0.80, 0.64) : vec3(0.42, 0.85, 0.74); col *= 0.55 + 0.45 * h12(id + 3.0);
    float nuc = smoothstep(rr * 0.55, rr * 0.2, d) * 0.35; col = mix(col, vec3(1.0, 0.95, 0.85), nuc);
    acc.rgb = mix(acc.rgb, col, cov); acc.a = max(acc.a, cov);
  }
  return acc;
}
void main(){
  float depth = clamp(-vP.y, 0.0, uDmax); vec4 la = texture2D(tA, vec2(depth / uDmax, 0.5)), lb = texture2D(tB, vec2(depth / uDmax, 0.5));
  vec3 base = mix(lin(la.rgb), lin(vec3(0.20, 0.21, 0.56)), uFlat * 0.78);
  vec3 col = base;
  if (uMix < 0.999) {
    // far / blurred cells at two depths of field (large pitch = deeper, dimmer)
    float fade1 = 1.0 - smoothstep(0.35, 0.9, uPx / 5.5e-6);   // pixel footprint vs lattice pitch (11 um): fade out before it aliases
    float mean = la.a * lb.r * lb.r * 0.9;
    vec3 meanC = mix(vec3(0.42, 0.85, 0.74), vec3(0.98, 0.80, 0.64), lb.g) * 0.55;
    if (fade1 > 0.001) {
      vec4 c2 = nissl(vP + vec2(3.1e-4, 1.7e-4), 17e-6, depth, la, lb, 31.0); col = mix(col, lin(c2.rgb) * 0.30 + base * 0.70, c2.a * 0.42 * fade1);
      vec4 c1 = nissl(vP, 11e-6, depth, la, lb, 7.0); col = mix(col, lin(c1.rgb) * 0.50 + base * 0.50, c1.a * 0.55 * fade1);
    }
    col = mix(col, mix(base, lin(meanC * 1.5), min(0.9, 0.30 * mean * 3.2)), 1.0 - fade1);
    // radial dendrite / axon bundles (minicolumns, ~50 um), cortex only
    float cortex = 1.0 - smoothstep(3.4e-3, 3.6e-3, depth);
    float fadeS = 1.0 - smoothstep(0.35, 0.9, uPx / 10e-6);
    float sl = vn(vec2(vP.x / 26e-6, vP.y / 260e-6)) * vn(vec2(vP.x / 9e-6, vP.y / 120e-6 + 7.0));
    col += lin(vec3(0.95, 0.74, 0.6)) * smoothstep(0.36, 0.6, sl) * 0.045 * cortex * fadeS * smoothstep(0.1e-3, 0.3e-3, depth);
    // white matter: tangential myelinated fibre striations
    float wmk = smoothstep(3.5e-3, 3.62e-3, depth);
    float st = vn(vec2(vP.x / 260e-6, vP.y / 11e-6)) * vn(vec2(vP.x / 90e-6 + 4.0, vP.y / 4e-6));
    col = mix(col, lin(vec3(0.96, 0.88, 0.74)) * (0.22 + 0.7 * st), wmk * (1.0 - 0.45 * uFlat) * (0.45 + 0.4 * st) * (1.0 - 0.6 * (1.0 - fadeS)));
    // Baillarger bands (myelinated horizontal fibres in IV and V/VI) as faint cream stripes
    float bb = exp(-pow((depth - 1.47e-3) / 55e-6, 2.0)) + 0.8 * exp(-pow((depth - 2.08e-3) / 80e-6, 2.0));
    col += lin(vec3(0.95, 0.82, 0.62)) * 0.06 * bb * cortex;
    // dark pial / CSF above the surface
    float outside = smoothstep(0.0, max(0.01e-3, 2.0 * uPx), vP.y); col = mix(col, lin(vec3(0.05, 0.05, 0.22)), outside);
    float sub = exp(-pow(max(0.0, -vP.y) / 60e-6, 1.0)) * 0.18 * (1.0 - outside); col += lin(vec3(0.7, 0.62, 0.9)) * sub;   // subpial glow
    float pw = max(9e-6, 2.6 * uPx); col = mix(col, lin(vec3(1.0, 0.90, 0.74)), smoothstep(pw, pw * 0.35, abs(vP.y + pw * 0.4)) * 0.85);   // the pia: a thin cream membrane on the surface
    // a slow vignette of depth: the far wall dims toward the section edges
  }
  if (uMix > 0.001) {
    vec2 x = vP * uCell; x += 0.34 * (vec2(vn(x * 0.55), vn(x * 0.55 + 5.2)) - 0.5) + 0.12 * (vec2(vn(x * 1.7 + 2.0), vn(x * 1.7 + 9.1)) - 0.5);   // organic, wavy profile outlines
    vec2 n = floor(x), f = fract(x); float d1 = 8.0, d2 = 8.0; vec2 id1 = vec2(0.0), r1 = vec2(0.0);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 g = vec2(float(i), float(j)); vec2 o = h22(n + g); vec2 r = g + o - f; float d = dot(r, r); if (d < d1) { d2 = d1; d1 = d; id1 = n + g; r1 = r; } else if (d < d2) d2 = d; }
    float e = sqrt(d2) - sqrt(d1), dd = sqrt(d1); float k = h12(id1), k2 = h12(id1 + 11.0), k3 = h12(id1 + 23.0);
    float prof = (0.30 + 0.20 * k2);
    float shape = min(e * 0.8, prof - dd * 0.5);
    float inside = smoothstep(0.0, 0.25, shape);
    vec3 pc = vec3(0.15, 0.16, 0.46);                                        // dendrite shaft: indigo
    if (k > 0.46) pc = vec3(0.23, 0.23, 0.58);                                // axon: violet
    if (k > 0.74) pc = vec3(0.10, 0.30, 0.38);                                // terminal: teal
    if (k > 0.86) pc = vec3(0.38, 0.31, 0.60);                                // astrocyte process: lilac
    if (k > 0.95) pc = vec3(0.40, 0.25, 0.44);                                // plum
    pc *= 0.88 + 0.2 * k3;
    float lit = dot(normalize(r1 + 1e-4), vec2(-0.6, 0.8)) * smoothstep(0.0, 0.7, dd / prof);
    pc *= 1.0 + 0.22 * lit;
    vec2 y2 = vP * uCell * 3.0; vec2 n2 = floor(y2), f2 = fract(y2); vec2 o2 = h22(n2 + id1 * 3.7); float sp = smoothstep(0.22, 0.12, length(f2 - o2)) * step(0.50, h12(n2 + id1 * 5.3)) * step(0.55, k);
    pc = mix(pc, pc * 0.6 + vec3(0.04, 0.03, 0.12), sp * 0.5);
    if (k2 > 0.93 && k < 0.46) { float q = dd / prof; vec3 ring = vec3(0.80, 0.68, 0.54) * 0.62; pc = mix(pc, ring, smoothstep(0.55, 0.66, q)); pc = mix(pc, vec3(0.30, 0.30, 0.64), 1.0 - smoothstep(0.40, 0.52, q)); }
    vec3 mem = vec3(0.06, 0.055, 0.2);
    vec3 em = mix(mem, pc, inside);
    col = mix(col, mix(lin(em * vec3(0.52, 0.5, 0.56)), base * 1.4, 0.62) * (0.8 + 0.4 * vn(vP * uCell * 0.09 + 3.0)) * (1.0 + 0.25 * vn(vP * uCell * 0.03)), uMix);
  }
  if (uBr > 0.001) {
    // the brain level's own section-plate palette (pink grey matter with its darker lamina bands, cream white matter), so the slab reads as an excised block of the same ribbon
    float dp = clamp(-vP.y, 0.0, 5.0e-3); float wmk2 = smoothstep(3.5e-3, 3.62e-3, dp);
    vec3 gmc = mix(lin(vec3(0.659, 0.439, 0.596)), lin(vec3(0.859, 0.635, 0.682)), 0.62 + 0.38 * (1.0 - smoothstep(0.0, 0.5e-3, dp)));
    gmc *= 1.0 - 0.20 * exp(-pow((dp - 1.45e-3) / 0.30e-3, 2.0)) - 0.12 * exp(-pow((dp - 2.1e-3) / 0.25e-3, 2.0));
    vec3 wmc = lin(vec3(0.953, 0.875, 0.741)) * (0.97 + 0.03 * vn(vec2(vP.x / 260e-6, vP.y / 11e-6)));
    vec3 bc = mix(gmc, wmc, wmk2); float outs = smoothstep(0.0, max(0.01e-3, 2.0 * uPx), vP.y); bc = mix(bc, lin(vec3(0.137, 0.153, 0.478)), outs);
    col = mix(col, bc + (col - base) * 0.45 * (1.0 - outs), uBr);
  }
  gl_FragColor = vec4(col, uA);
}` });
  const geo = new T.PlaneGeometry(2.4 * (X1 - X0), 2 * YB + 0.1 * MM); geo.translate(0, -(2 * YB - 0.1 * MM) / 2, 0);   // vertex xy = local slab coordinates (y = -depth)
  const m = new T.Mesh(geo, mat); m.position.set(0, 0, -ZW); group.add(m);
  // laminar tint: a translucent cel-tinted sheet on the section plane (one flat colour per lamina) so the bands read at wide fields
  const ov = { I: [0xa9b0ff, 0.26], II: [0x1f2290, 0.34], III: [0x6a6ee0, 0.14], IV: [0x12b5a0, 0.36], V: [0xc070e8, 0.30], VI: [0x3550d8, 0.26], WM: [0xf4e8cc, 0.60] };
  const lutO = new Uint8Array(NT * 4); for (let i = 0; i < NT; i++) { const d = (i + 0.5) / NT * DMAX, n = L(d), c = ov[n][0]; lutO[i * 4] = (c >> 16) & 255; lutO[i * 4 + 1] = (c >> 8) & 255; lutO[i * 4 + 2] = c & 255; lutO[i * 4 + 3] = 255 * ov[n][1]; }
  const tO = new T.DataTexture(lutO, NT, 1, T.RGBAFormat); blur(lutO, 2, [0, 1, 2, 3]); tO.minFilter = tO.magFilter = T.LinearFilter; tO.colorSpace = T.NoColorSpace; tO.needsUpdate = true;
  const UO = { tO: { value: tO }, uOv: { value: 0 }, uWv: { value: 0 }, uWc: { value: new T.Vector2() }, uW: { value: Array.from({ length: 6 }, () => new T.Vector3()) }, uDmax: U.uDmax, uA: U.uA };
  const matO = new T.ShaderMaterial({ uniforms: UO, transparent: true, depthWrite: false, vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D tO; uniform float uOv; uniform float uWv; uniform vec2 uWc; uniform vec3 uW[6]; uniform float uDmax; uniform float uA; varying vec2 vP; void main(){ float depth = clamp(-vP.y, 0.0, uDmax); vec4 o = texture2D(tO, vec2(depth / uDmax, 0.5)); float inside = step(vP.y, 0.0); float d = length(vP - uWc); float wv = 0.0; for (int i = 0; i < 6; i++) { float u = (d - uW[i].x) / max(uW[i].y, 1e-9); float s = uW[i].z * 1.3 * exp(-(u > 0.0 ? u * u * 0.6 : u * u * 2.2)); wv += s; } wv = min(1.0, wv) * uWv; vec3 tint = pow(o.rgb, vec3(2.2)); vec3 amber = vec3(1.0, 0.52, 0.06); vec3 rgb = mix(tint, amber, wv * 0.95); float a = max(o.a * uOv, wv * (0.16 + 0.24 * uOv)); gl_FragColor = vec4(rgb, a * inside * uA); }' });
  const mo = new T.Mesh(geo, matO); mo.position.set(0, 0, 0.4e-6); mo.renderOrder = 503; mo.frustumCulled = false; group.add(mo);
  // the pial surface: the top face of the slab (visible when the section is seen a little from above) as a cream membrane with sulcal shading, vessels run on it
  { const tg = new T.PlaneGeometry(X1 - X0, ZW, 1, 1); tg.rotateX(-Math.PI / 2); tg.translate(0, 0, -ZW / 2);
    const tm = new T.ShaderMaterial({ uniforms: { uA: U.uA, uBr: U.uBr }, transparent: true, depthWrite: true, side: T.DoubleSide, vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uA; uniform float uBr; varying vec3 vP; float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); } float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }' +
        'void main(){ float zz = -vP.z / ' + ZW.toExponential(3) + '; float n = vn(vec2(vP.x / 140e-6, vP.z / 160e-6)) * 0.6 + vn(vec2(vP.x / 45e-6, vP.z / 50e-6)) * 0.4; vec3 cream = vec3(0.96, 0.80, 0.66); vec3 viol = vec3(0.22, 0.20, 0.55); vec3 viol = mix(viol, vec3(0.86, 0.64, 0.68), uBr); cream = mix(cream, vec3(0.93, 0.74, 0.74), uBr); c = mix(cream, viol, smoothstep(0.0, 1.0, zz) * 0.8); c *= 0.78 + 0.34 * n; float sulc = smoothstep(0.35, 0.5, vn(vec2(vP.x / 600e-6 + 3.0, vP.z / 500e-6))); c = mix(c, c * vec3(0.7, 0.62, 0.9), sulc * 0.5); gl_FragColor = vec4(pow(c, vec3(2.2)), uA); }' });
    const tmesh = new T.Mesh(tg, tm); tmesh.frustumCulled = false; group.add(tmesh); }
  return { group, mesh: m, U, UO, update(z, Wm) { U.uBr.value = ss01(-3.05, -2.5, z); U.uFlat.value = ss01(-2.95, -2.55, z); UO.uOv.value = ss01(0.5e-3, 1.5e-3, Wm) * (1 - ss01(-3.05, -2.7, z)) * 0.8; UO.uWv.value = ss01(0.12e-3, 0.5e-3, Wm); mo.visible = UO.uOv.value > 0.01 || UO.uWv.value > 0.01;
    const d = Math.min(ZW, Math.max(0.03 * MM, 0.5 * Wm + 0.012 * MM)); m.position.z = -d;
    U.uMix.value = 1 - Math.min(1, Math.max(0, (Wm - 0.14 * MM) / (0.3 * MM)));
    U.uCell.value = 1 / (Math.max(1.0e-6, Math.min(1.6e-6, Wm / 40))); U.uPx.value = Wm / 1600 * (1 + d / Math.max(Wm, 1e-9) * 0.0); this.depth = d; } };
}
