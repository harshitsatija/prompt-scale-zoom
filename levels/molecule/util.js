// helpers for the molecule level. Everything in this level is authored in NANOMETRES inside a child group scaled by 1e-9.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export async function gunzip(buf) { const s = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip')); return new Response(s).arrayBuffer(); }
export async function loadGz(ctx, p) { return gunzip(await ctx.fetchBuf(p)); }
export function parseMesh(ab) {
  const hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, 0, 64))); const nv = hdr.nv, nt = hdr.nt; let o = 64;
  const take = (C, n, bytes) => { const a = new C(ab.slice(o, o + n * bytes)); o += n * bytes; return a; };
  const v = take(Float32Array, nv * 3, 4), n = take(Float32Array, nv * 3, 4), c = take(Uint8Array, nv * 3, 1), dw = take(Uint8Array, nv, 1), tm = take(Uint8Array, nv, 1), ch = take(Uint8Array, nv, 1), f = take(Uint32Array, nt * 3, 4);
  return { nv, nt, v, n, c, dw, tm, ch, f };
}
export function meshGeometry(T, m) {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(m.v, 3)); g.setAttribute('normal', new T.BufferAttribute(m.n, 3));
  const lc = new Float32Array(m.c.length); for (let i = 0; i < lc.length; i++) { const x = m.c[i] / 255; lc[i] = x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); } for (let i = 0; i < m.nv; i++) { const w = m.dw[i] / 255; if (w > 0.02) { const k = 0.55 * Math.min(1, w * 1.4); lc[i * 3] = lc[i * 3] * (1 - k) + 0.50 * k; lc[i * 3 + 1] = lc[i * 3 + 1] * (1 - k) + 0.95 * k; lc[i * 3 + 2] = lc[i * 3 + 2] * (1 - k) + 0.78 * k; } }   // lobe D2 (the half that swings shut) is tinted mint against the teal D1
  g.setAttribute('color', new T.BufferAttribute(lc, 3)); g.setAttribute('dw', new T.BufferAttribute(m.dw, 1, true)); g.setAttribute('tmw', new T.BufferAttribute(m.tm, 1, true)); g.setAttribute('chn', new T.BufferAttribute(m.ch, 1, false));
  g.setIndex(new T.BufferAttribute(m.f, 1)); g.boundingSphere = new T.Sphere(new T.Vector3(-2, 0, -2), 16); return g;
}
const _c = new Map();
export function colorize(T, g, hex) { const n = g.attributes.position.count, a = new Float32Array(n * 3); const c = new T.Color(hex); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new T.BufferAttribute(a, 3)); return g; }
const strip = (g) => { g.deleteAttribute('uv'); return g; };
export function ballGeo(T, p, r, hex, w = 12, h = 8) { const g = strip(new T.SphereGeometry(r, w, h)); g.translate(p[0], p[1], p[2]); return colorize(T, g, hex); }
export function stickGeo(T, a, b, r, hex, seg = 6) { const A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), L = d.length(); const g = strip(new T.CylinderGeometry(r, r, L, seg, 1, true)); const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize()); g.applyQuaternion(q); const m = A.clone().addScaledVector(d, 0.5); g.translate(m.x, m.y, m.z); return colorize(T, g, hex); }
export function tubeGeo(T, pts, r, hex, seg, rad) { const curve = new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(...p))); const g = strip(new T.TubeGeometry(curve, seg, r, rad, false)); return colorize(T, g, hex); }
export function merge(T, parts) { return mergeGeometries(parts.map((g) => { if (!g.index) { const idx = []; for (let i = 0; i < g.attributes.position.count; i++) idx.push(i); g.setIndex(idx); } return g; }), false); }
export const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function rodrigues(p, piv, ax, a) { const v = [p[0] - piv[0], p[1] - piv[1], p[2] - piv[2]], c = Math.cos(a), s = Math.sin(a); const dot = ax[0] * v[0] + ax[1] * v[1] + ax[2] * v[2]; const cr = [ax[1] * v[2] - ax[2] * v[1], ax[2] * v[0] - ax[0] * v[2], ax[0] * v[1] - ax[1] * v[0]];
  return [piv[0] + v[0] * c + cr[0] * s + ax[0] * dot * (1 - c), piv[1] + v[1] * c + cr[1] * s + ax[1] * dot * (1 - c), piv[2] + v[2] * c + cr[2] * s + ax[2] * dot * (1 - c)]; }

export function tubeGrad(T, pts, r, hex0, hex1, seg, rad) { const curve = new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(...p))); const g = strip(new T.TubeGeometry(curve, seg, r, rad, false)); const n = g.attributes.position.count, a = new Float32Array(n * 3); const c0 = new T.Color(hex0), c1 = new T.Color(hex1), c = new T.Color();
  for (let i = 0; i < n; i++) { const t = Math.min(1, Math.floor(i / (rad + 1)) / seg); c.copy(c0).lerp(c1, t); a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new T.BufferAttribute(a, 3)); return g; }

// ---------- sphere impostors: GL points that are shaded and depth-written as true spheres (perfectly smooth at any zoom, ~0 triangles) ----------
const DPR = () => { try { const q = new URLSearchParams(location.search); return q.has('dpr') ? Number(q.get('dpr')) : Math.min(2, window.devicePixelRatio || 1); } catch (e) { return 1; } };
export function impostorMaterial(T, o = {}) {
  const U = T.UniformsUtils.merge([T.UniformsLib.fog, { uH: { value: 1000 }, uRs: { value: 1 }, uGlow: { value: 0 }, uGlowCol: { value: new T.Color(0xffa31a) }, uTint: { value: new T.Vector3(1, 1, 1) }, uDepthFade: { value: new T.Vector4(0, 0, 0, 0) }, uFade: { value: 1 } }]);
  const m = new T.ShaderMaterial({ uniforms: U, fog: true, transparent: false, alphaToCoverage: true, vertexShader: `
uniform float uH; uniform float uRs; uniform float uFade;
attribute vec3 acol; attribute float rad;
varying vec3 vC; varying float vRv; varying float vZ; varying float vP22; varying float vP32; varying float vFogDepth; varying float vK;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float sc = length(modelViewMatrix[0].xyz);
  float r = rad * uRs * sc; vec4 cp = projectionMatrix * mv;
  float px = 2.0 * r * projectionMatrix[1][1] * uH * 0.5 / max(cp.w, 1e-6);
  gl_PointSize = clamp(px, 0.0, 1000.0); vK = px > 1000.0 ? 1000.0 / px : 1.0;
  vC = acol; vRv = r; vZ = mv.z; vP22 = projectionMatrix[2][2]; vP32 = projectionMatrix[3][2]; vFogDepth = -mv.z;
  gl_Position = (rad * uRs <= 0.0 || uFade <= 0.0) ? vec4(2.0, 2.0, 2.0, 1.0) : cp;
}`, fragmentShader: `
#include <fog_pars_fragment>
uniform float uGlow; uniform vec3 uGlowCol; uniform vec3 uTint; uniform float uFade;
varying vec3 vC; varying float vRv; varying float vZ; varying float vP22; varying float vP32; varying float vK;
vec3 ramp(float x){ // the kit toon ramp (4 bands), softened a touch so edges do not alias
  vec3 c0 = vec3(0.345, 0.322, 0.588), c1 = vec3(0.588, 0.549, 0.804), c2 = vec3(0.922, 0.886, 0.961), c3 = vec3(1.0, 0.98, 0.925);
  float w = 0.035; vec3 c = c0; c = mix(c, c1, smoothstep(0.25 - w, 0.25 + w, x)); c = mix(c, c2, smoothstep(0.5 - w, 0.5 + w, x)); c = mix(c, c3, smoothstep(0.75 - w, 0.75 + w, x)); return c; }
void main(){
  vec2 d = (gl_PointCoord - 0.5) * 2.0; d.y = -d.y; float r2 = dot(d, d); if (r2 > 1.0) discard;
  float z = sqrt(1.0 - r2); vec3 n = vec3(d, z);
  float zv = vZ + vRv * z; gl_FragDepth = ((vP22 * zv + vP32) / (-zv)) * 0.5 + 0.5;
  vec3 L = normalize(vec3(-0.45, 0.68, 0.55)); float nl = dot(n, L);
  vec3 base = vC * uTint;
  vec3 lit = base * (ramp(nl * 0.5 + 0.5) * 0.84 + 0.07);
  float rim = pow(1.0 - z, 3.0); lit += vec3(0.35, 0.88, 0.76) * rim * 0.22 * base;
  float sp = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 36.0); lit += vec3(1.0, 0.96, 0.86) * sp * 0.16;
  lit += uGlowCol * base * (0.35 + 0.65 * z) * uGlow * 1.3;
  float a = (1.0 - smoothstep(0.90, 1.0, sqrt(r2)));
  gl_FragColor = vec4(lit, a);
  #include <fog_fragment>
}` });
  m.userData.setH = () => { U.uH.value = (typeof innerHeight === 'number' ? innerHeight : 1000) * DPR(); }; m.userData.setH();
  return m;
}
export class Atoms { // a Points cloud of sphere impostors with a growable buffer
  constructor(T, mat, cap) { this.T = T; this.cap = cap; this.n = 0; const g = new T.BufferGeometry(); this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 3); this.rad = new Float32Array(cap);
    g.setAttribute('position', new T.BufferAttribute(this.pos, 3).setUsage(T.DynamicDrawUsage)); g.setAttribute('acol', new T.BufferAttribute(this.col, 3).setUsage(T.DynamicDrawUsage)); g.setAttribute('rad', new T.BufferAttribute(this.rad, 1).setUsage(T.DynamicDrawUsage));
    g.boundingSphere = new T.Sphere(new T.Vector3(), 1e6); g.setDrawRange(0, 0); this.geo = g; this.obj = new T.Points(g, mat); this.obj.frustumCulled = false; this.c = new T.Color(); }
  clear() { this.n = 0; } 
  add(x, y, z, hex, r, shade = 1) { if (this.n >= this.cap) return false; const i = this.n++; this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; if (typeof hex === 'number') { this.c.setHex(hex); this.col[i * 3] = this.c.r * shade; this.col[i * 3 + 1] = this.c.g * shade; this.col[i * 3 + 2] = this.c.b * shade; } else { this.col[i * 3] = hex[0] * shade; this.col[i * 3 + 1] = hex[1] * shade; this.col[i * 3 + 2] = hex[2] * shade; } this.rad[i] = r; return true; }
  flush() { const a = this.geo.attributes; a.position.needsUpdate = a.acol.needsUpdate = a.rad.needsUpdate = true; this.geo.setDrawRange(0, this.n); }
}
