/* GB: a tiny geometry builder that merges many primitives into one BufferGeometry with per-vertex colour (linear), smooth or flat normals and
 * world-metre UVs, so a whole street of detailed objects is a handful of draw calls. Units: metres. */
import { T } from '../../core/kit.js';

const tmpC = new T.Color();
export const lin = (c) => { if (c && c.isColor) return c; tmpC.set(c); return tmpC.clone(); };   // sRGB hex -> linear Color

export class GB {
  constructor() { this.P = []; this.N = []; this.C = []; this.U = []; this.I = []; this.m = new T.Matrix4(); this.stack = []; this.nm = new T.Matrix3(); this.uvs = 1 / 3.5; this.n = 0; }
  push(x = 0, y = 0, z = 0, ry = 0, s = 1, rx = 0, rz = 0) {
    this.stack.push(this.m.clone());
    const q = new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz, 'YXZ')); const l = new T.Matrix4().compose(new T.Vector3(x, y, z), q, new T.Vector3(s, s, s)); this.m.multiply(l); this.nm.getNormalMatrix(this.m); return this;
  }
  pop() { this.m.copy(this.stack.pop()); this.nm.getNormalMatrix(this.m); return this; }
  _v(x, y, z, nx, ny, nz, c, u, v) {
    const m = this.m.elements; const X = m[0] * x + m[4] * y + m[8] * z + m[12], Y = m[1] * x + m[5] * y + m[9] * z + m[13], Z = m[2] * x + m[6] * y + m[10] * z + m[14];
    const e = this.nm.elements; let NX = e[0] * nx + e[3] * ny + e[6] * nz, NY = e[1] * nx + e[4] * ny + e[7] * nz, NZ = e[2] * nx + e[5] * ny + e[8] * nz; const L = Math.hypot(NX, NY, NZ) || 1;
    this.P.push(X, Y, Z); this.N.push(NX / L, NY / L, NZ / L); this.C.push(c.r, c.g, c.b);
    if (u === undefined) { u = (X + Z * 0.61) * this.uvs; v = (Y + Z * 0.39 + X * 0.2) * this.uvs; } this.U.push(u, v); return this.n++;
  }
  // flat quad a,b,c,d counter-clockwise seen from the front; uv from the dominant axis of the (world) normal, in metres * uvs
  quad(a, b, c, d, color, o = {}) {
    const col = lin(color), A = new T.Vector3(...a), B = new T.Vector3(...b), C = new T.Vector3(...c);
    const n = new T.Vector3().subVectors(C, B).cross(new T.Vector3().subVectors(A, B)).normalize();
    const k = this.uvs; let uv;
    const wn = n.clone().transformDirection(this.m);
    const P = [a, b, c, d].map((p) => new T.Vector3(...p).applyMatrix4(this.m));
    const ax = Math.abs(wn.x), ay = Math.abs(wn.y), az = Math.abs(wn.z);
    if (o.uv) uv = o.uv; else if (ay >= ax && ay >= az) uv = P.map((p) => [p.x * k, p.z * k]); else if (ax >= az) uv = P.map((p) => [p.z * k, p.y * k]); else uv = P.map((p) => [p.x * k, p.y * k]);
    const i0 = this._v(a[0], a[1], a[2], n.x, n.y, n.z, col, uv[0][0], uv[0][1]), i1 = this._v(b[0], b[1], b[2], n.x, n.y, n.z, col, uv[1][0], uv[1][1]), i2 = this._v(c[0], c[1], c[2], n.x, n.y, n.z, col, uv[2][0], uv[2][1]), i3 = this._v(d[0], d[1], d[2], n.x, n.y, n.z, col, uv[3][0], uv[3][1]);
    this.I.push(i0, i1, i2, i0, i2, i3); return this;
  }
  quadC(a, b, c, d, cols, o = {}) { // quad with a colour per corner (gradients)
    const n = new T.Vector3().subVectors(new T.Vector3(...c), new T.Vector3(...b)).cross(new T.Vector3().subVectors(new T.Vector3(...a), new T.Vector3(...b))).normalize();
    const cs = cols.map(lin), uv = o.uv || [[0, 0], [1, 0], [1, 1], [0, 1]]; const ids = [a, b, c, d].map((p, i) => this._v(p[0], p[1], p[2], n.x, n.y, n.z, cs[i], uv[i][0], uv[i][1])); this.I.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]); return this;
  }
  box(cx, cy, cz, sx, sy, sz, color, o = {}) {
    if (o.ry || o.rx || o.rz) { this.push(cx, cy, cz, o.ry || 0, 1, o.rx || 0, o.rz || 0); this.box(0, 0, 0, sx, sy, sz, color, { ...o, ry: 0, rx: 0, rz: 0 }); this.pop(); return this; }
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2; const c = o.colors || [color, color, color, color, color, color]; const sk = o.skip || [];
    if (!sk.includes('+z')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], c[0], o);
    if (!sk.includes('-z')) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], c[1], o);
    if (!sk.includes('+x')) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], c[2], o);
    if (!sk.includes('-x')) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], c[3], o);
    if (!sk.includes('+y')) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], c[4], o);
    if (!sk.includes('-y')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], c[5], o);
    return this;
  }
  // smooth vertical-axis cylinder / cone (r0 bottom, r1 top). Optional caps.
  cyl(cx, cy, cz, r0, r1, h, color, o = {}) {
    const seg = o.seg || 16, col = lin(color), colT = o.topColor ? lin(o.topColor) : col; const s = (r0 - r1) / h; const base = this.n;
    const ang = o.arc || Math.PI * 2, a0 = o.a0 || 0;
    for (let i = 0; i <= seg; i++) { const a = a0 + (i / seg) * ang, ca = Math.cos(a), sa = Math.sin(a); const nl = Math.hypot(1, s); const nx = ca / nl, ny = s / nl, nz = sa / nl;
      this._v(cx + ca * r0, cy, cz + sa * r0, nx, ny, nz, col, i / seg * Math.PI * 2 * r0 * this.uvs, cy * this.uvs); this._v(cx + ca * r1, cy + h, cz + sa * r1, nx, ny, nz, colT, i / seg * Math.PI * 2 * r1 * this.uvs, (cy + h) * this.uvs); }
    for (let i = 0; i < seg; i++) { const a = base + i * 2; this.I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    if (o.cap !== false && !o.arc) {
      if (r1 > 0) { const c0 = this._v(cx, cy + h, cz, 0, 1, 0, colT, 0, 0); const rr = []; for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; rr.push(this._v(cx + Math.cos(a) * r1, cy + h, cz + Math.sin(a) * r1, 0, 1, 0, colT)); } for (let i = 0; i < seg; i++) this.I.push(c0, rr[i + 1], rr[i]); }
      if (o.bottom && r0 > 0) { const c0 = this._v(cx, cy, cz, 0, -1, 0, col, 0, 0); const rr = []; for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; rr.push(this._v(cx + Math.cos(a) * r0, cy, cz + Math.sin(a) * r0, 0, -1, 0, col)); } for (let i = 0; i < seg; i++) this.I.push(c0, rr[i], rr[i + 1]); }
    }
    return this;
  }
  // cylinder between two points
  rod(a, b, r, color, o = {}) {
    const A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), L = d.length(); if (L < 1e-6) return this;
    const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize()); const e = new T.Euler().setFromQuaternion(q, 'YXZ');
    this.push(A.x, A.y, A.z, e.y, 1, e.x, e.z); this.cyl(0, 0, 0, r, o.r1 === undefined ? r : o.r1, L, color, { seg: o.seg || 6, cap: o.cap !== false, bottom: o.cap !== false }); this.pop(); return this;
  }
  sphere(cx, cy, cz, rx, ry, rz, color, o = {}) {
    const ws = o.w || 14, hs = o.h || 10, col = lin(color), colT = o.topColor ? lin(o.topColor) : col, colB = o.botColor ? lin(o.botColor) : col; const base = this.n; const th0 = o.th0 || 0, th1 = o.th1 === undefined ? Math.PI : o.th1;
    const jit = o.jit; // optional lumpiness function(x,y,z)->scale
    for (let j = 0; j <= hs; j++) { const th = th0 + (j / hs) * (th1 - th0); for (let i = 0; i <= ws; i++) { const ph = (i / ws) * Math.PI * 2; let nx = Math.sin(th) * Math.cos(ph), ny = Math.cos(th), nz = Math.sin(th) * Math.sin(ph);
      let k = 1; if (jit) k = jit(nx, ny, nz); const t = (ny + 1) / 2; const c = new T.Color().copy(colB).lerp(colT, t);
      const px = cx + nx * rx * k, py = cy + ny * ry * k, pz = cz + nz * rz * k; this._v(px, py, pz, nx / rx, ny / ry, nz / rz, c); } }
    for (let j = 0; j < hs; j++) for (let i = 0; i < ws; i++) { const a = base + j * (ws + 1) + i, b = a + ws + 1; this.I.push(a, a + 1, b, a + 1, b + 1, b); }
    return this;
  }
  // extrude a polygon (array of [x,z], any winding) from y0 to y1; walls get wallColor, top capColor. returns nothing
  prism(poly, y0, y1, wallColor, capColor, o = {}) {
    let p = poly.map((q) => new T.Vector2(q[0], q[1])); if (p.length > 2 && p[0].distanceTo(p[p.length - 1]) < 1e-6) p.pop(); if (p.length < 3) return this;
    let area = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; area += a.x * b.y - b.x * a.y; } if (area < 0) p = p.reverse();   // ensure CCW in (x,z) plane
    const wc = lin(wallColor), cc = lin(capColor);
    for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; const dx = b.x - a.x, dz = b.y - a.y, L = Math.hypot(dx, dz); if (L < 1e-4) continue; const nx = dz / L, nz = -dx / L; // outward for CCW (x,z) seen from +y... verified by sign below
      const W = o.wallUV; let u0 = 0, u1 = L / (W || 12); if (o.uOff !== undefined) { u0 = o.uOff[i] || 0; u1 = u0 + L / (W || 12); }
      const v0 = (y0 - (o.vBase || 0)) / (o.wallV || 12.8), v1 = (y1 - (o.vBase || 0)) / (o.wallV || 12.8);
      const k = this.uvs; const a0 = this._v(a.x, y0, a.y, nx, 0, nz, wc, o.wallUV ? u0 : (a.x + a.y) * k, o.wallUV ? v0 : y0 * k), a1 = this._v(b.x, y0, b.y, nx, 0, nz, wc, o.wallUV ? u1 : (b.x + b.y) * k, o.wallUV ? v0 : y0 * k), a2 = this._v(b.x, y1, b.y, nx, 0, nz, wc, o.wallUV ? u1 : (b.x + b.y) * k, o.wallUV ? v1 : y1 * k), a3 = this._v(a.x, y1, a.y, nx, 0, nz, wc, o.wallUV ? u0 : (a.x + a.y) * k, o.wallUV ? v1 : y1 * k);
      this.I.push(a0, a2, a1, a0, a3, a2); }   // winding fixed so the normal (nx,0,nz) faces outward
    if (o.cap !== false) { const tri = T.ShapeUtils.triangulateShape(p, []); const base = this.n; p.forEach((q) => this._v(q.x, y1, q.y, 0, 1, 0, cc, q.x * this.uvs, q.y * this.uvs)); tri.forEach((t) => this.I.push(base + t[0], base + t[2], base + t[1])); }
    return this;
  }
  // thin tube along a polyline of [x,y,z]
  tube(pts, r, color, o = {}) {
    const seg = o.seg || 4, col = lin(color), base = this.n; const N = pts.length; const up = new T.Vector3(0, 1, 0);
    for (let i = 0; i < N; i++) { const p = new T.Vector3(...pts[i]); const t = new T.Vector3(...pts[Math.min(N - 1, i + 1)]).sub(new T.Vector3(...pts[Math.max(0, i - 1)])).normalize(); let a = new T.Vector3().crossVectors(t, up); if (a.lengthSq() < 1e-6) a.set(1, 0, 0); a.normalize(); const b = new T.Vector3().crossVectors(t, a).normalize();
      for (let j = 0; j <= seg; j++) { const ph = (j / seg) * Math.PI * 2; const n = a.clone().multiplyScalar(Math.cos(ph)).addScaledVector(b, Math.sin(ph)); this._v(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r, n.x, n.y, n.z, col); } }
    for (let i = 0; i < N - 1; i++) for (let j = 0; j < seg; j++) { const a0 = base + i * (seg + 1) + j, b0 = a0 + seg + 1; this.I.push(a0, a0 + 1, b0, a0 + 1, b0 + 1, b0); }
    return this;
  }
  // a flat horizontal ribbon along a polyline at height y with half-width hw (xz plane), good for roads/kerbs. cols: colour
  ribbon(pts, hw, y, color, o = {}) {
    const col = lin(color); const base = this.n; let acc = 0; const N = pts.length;
    for (let i = 0; i < N; i++) { const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L; const nx = -dz, nz = dx;
      if (i > 0) acc += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]); const sc = o.miter ? 1 / Math.max(0.5, Math.abs(((dx * (b[0] - p[0]) + dz * (b[1] - p[1])) / (Math.hypot(b[0] - p[0], b[1] - p[1]) || 1)) || 1)) : 1;
      const w = hw * Math.min(1.8, sc); const ys = y; const k = o.us || this.uvs; const A = [p[0] + nx * w, p[1] + nz * w], Bq = [p[0] - nx * w, p[1] - nz * w];
      if (o.world) { this._v(A[0], ys, A[1], 0, 1, 0, col, A[0] * k, A[1] * k); this._v(Bq[0], ys, Bq[1], 0, 1, 0, col, Bq[0] * k, Bq[1] * k); } else { this._v(A[0], ys, A[1], 0, 1, 0, col, acc * k, 0); this._v(Bq[0], ys, Bq[1], 0, 1, 0, col, acc * k, 2 * w * k); } }
    for (let i = 0; i < N - 1; i++) { const a = base + i * 2; this.I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    return this;
  }

  // smooth mesh from raw arrays (computes area-weighted vertex normals); P: flat positions, I: indices
  smooth(P, I, color, cols) {
    const n = P.length / 3, N = new Float32Array(P.length), col = lin(color);
    for (let i = 0; i < I.length; i += 3) { const a = I[i] * 3, b = I[i + 1] * 3, c = I[i + 2] * 3; const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2]; const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; [a, b, c].forEach((q) => { N[q] += nx; N[q + 1] += ny; N[q + 2] += nz; }); }
    const base = this.n; for (let i = 0; i < n; i++) this._v(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2], cols ? cols[i] : col);
    for (let i = 0; i < I.length; i++) this.I.push(base + I[i]); return this;
  }
  // loft along +x: stations [{x,hw,yb,yt, c?}] (half-width, bottom, top), rounded-box rings (superellipse), fan-capped ends.
  loft(st, color, o = {}) {
    if (o.sub) { const sub = o.sub, out = []; const cr = (a, b, c, d, t) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t); for (let i = 0; i < st.length - 1; i++) { const a = st[Math.max(0, i - 1)], b = st[i], c = st[i + 1], d = st[Math.min(st.length - 1, i + 2)]; for (let k = 0; k < sub; k++) { const t = k / sub; out.push({ x: cr(a.x, b.x, c.x, d.x, t), hw: Math.max(0.01, cr(a.hw, b.hw, c.hw, d.hw, t)), yb: cr(a.yb, b.yb, c.yb, d.yb, t), yt: Math.max(cr(a.yb, b.yb, c.yb, d.yb, t) + 0.02, cr(a.yt, b.yt, c.yt, d.yt, t)), c: b.c }); } } out.push(st[st.length - 1]); st = out; }
    const N = o.ring || 16, ne = o.n || 3.2, P = [], I = [], cols = []; const ex = 2 / ne; const sg = (v) => Math.sign(v) * Math.pow(Math.abs(v), ex); const col = lin(color); const zc = o.zc || 0;
    st.forEach((s) => { const ym = (s.yb + s.yt) / 2, hh = (s.yt - s.yb) / 2; const c = s.c ? lin(s.c) : col; for (let j = 0; j < N; j++) { const t = (j / N) * Math.PI * 2; P.push(s.x, ym + hh * sg(Math.sin(t)), zc + s.hw * sg(Math.cos(t))); cols.push(c); } });
    for (let i = 0; i < st.length - 1; i++) for (let j = 0; j < N; j++) { const a = i * N + j, b = i * N + (j + 1) % N, c = (i + 1) * N + j, d = (i + 1) * N + (j + 1) % N; I.push(a, c, b, b, c, d); }
    const cap = (i, flip) => { const s = st[i], ym = (s.yb + s.yt) / 2; const ci = P.length / 3; P.push(s.x, ym, zc); cols.push(s.c ? lin(s.c) : col); for (let j = 0; j < N; j++) { const a = i * N + j, b = i * N + (j + 1) % N; if (flip) I.push(ci, a, b); else I.push(ci, b, a); } };
    cap(0, true); cap(st.length - 1, false); return this.smooth(P, I, color, cols);
  }
  geometry() {
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(this.P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(this.N, 3)); g.setAttribute('color', new T.Float32BufferAttribute(this.C, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(this.U, 2));
    g.setIndex(this.n > 65535 ? new T.Uint32BufferAttribute(this.I, 1) : new T.Uint16BufferAttribute(this.I, 1)); g.computeBoundingSphere(); return g;
  }
  get tris() { return this.I.length / 3; }
}
// deterministic rng
export function rng(seed) { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
