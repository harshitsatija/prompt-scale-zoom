/* geometry helpers for the neuron level: everything is authored in MICROMETRES (the level groups are scaled by 1e-6). */
export const TAU = Math.PI * 2;
export const ssm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const clampf = (x, a, b) => Math.min(b, Math.max(a, x));
export function rngf(seed) { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const gauss = (r) => { let u = 0; for (let i = 0; i < 6; i++) u += r(); return (u - 3) / 0.7071; };

// cheap smooth 3D value noise (for organic wobble)
const H = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
export function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(H(xi, yi, zi), H(xi + 1, yi, zi), u), l(H(xi, yi + 1, zi), H(xi + 1, yi + 1, zi), u), v), l(l(H(xi, yi, zi + 1), H(xi + 1, yi, zi + 1), u), l(H(xi, yi + 1, zi + 1), H(xi + 1, yi + 1, zi + 1), u), v), w);
}
export const fbm = (x, y, z, o = 3) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f, z * f); a *= 0.5; f *= 2.03; } return s / (1 - Math.pow(0.5, o)); };

/* A growable merged geometry builder: positions, normals, colours, aU (signal coordinate), uv, indices. */
export class Builder {
  constructor(T) { this.T = T; this.p = []; this.n = []; this.c = []; this.u = []; this.uv = []; this.i = []; this.nv = 0; }
  vert(x, y, z, nx, ny, nz, r, g, b, au, u, v) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(r, g, b); this.u.push(au); this.uv.push(u || 0, v || 0); return this.nv++; }
  tri(a, b, c) { this.i.push(a, b, c); }
  geometry() {
    const T = this.T, g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3)); g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aU', new T.Float32BufferAttribute(this.u, 1)); g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.nv > 65535 ? new T.Uint32BufferAttribute(this.i, 1) : new T.Uint16BufferAttribute(this.i, 1)); g.computeBoundingSphere(); return g;
  }
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/* Sweep a tapered tube along a polyline with parallel-transport frames.
 *  pts [[x,y,z]..], rad [r..], col(i)->[r,g,b], au(i)->signal coordinate, sides, caps: {start,end}
 *  Normals include the taper slope so shading is smooth (no faceting); ends are closed with hemispherical caps. */
export function sweep(B, pts, rad, o) {
  const n = pts.length; if (n < 2) return; const sides = o.sides || 8, col = o.col || (() => [1, 1, 1]), au = o.au || (() => -1e4);
  const tan = []; for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; tan.push(norm(sub(b, a))); }
  let nrm = Math.abs(tan[0][1]) < 0.9 ? cross(tan[0], [0, 1, 0]) : cross(tan[0], [1, 0, 0]); nrm = norm(nrm);
  const base = B.nv, rings = []; const cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(...sub(pts[i], pts[i - 1]))); const vs = o.vscale || 0;
  const ringAt = (c, r, t, nn, b2, i, cap) => { // emit one ring
    const ci = col(i), ua = au(i);
    for (let s = 0; s <= sides; s++) { const th = s / sides * TAU, ct = Math.cos(th), st = Math.sin(th);
      const rx = nn[0] * ct + b2[0] * st, ry = nn[1] * ct + b2[1] * st, rz = nn[2] * ct + b2[2] * st;
      const sl = o.slope ? o.slope[i] || 0 : 0; // d r / d s
      let nx = rx - t[0] * sl, ny = ry - t[1] * sl, nz = rz - t[2] * sl; const l = Math.hypot(nx, ny, nz) || 1;
      B.vert(c[0] + rx * r, c[1] + ry * r, c[2] + rz * r, nx / l, ny / l, nz / l, ci[0], ci[1], ci[2], ua, s / sides, vs ? cum[i] * vs : i / n); }
  };
  const frames = [];
  for (let i = 0; i < n; i++) {
    if (i > 0) { const t = tan[i]; const d = dot(nrm, t); nrm = norm([nrm[0] - t[0] * d, nrm[1] - t[1] * d, nrm[2] - t[2] * d]); }
    frames.push([nrm, cross(tan[i], nrm)]);
  }
  // slope of radius along arc
  const slope = new Array(n).fill(0); for (let i = 0; i < n; i++) { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), L = Math.hypot(...sub(pts[b], pts[a])) || 1; slope[i] = (rad[b] - rad[a]) / L; }
  o = Object.assign({}, o, { slope });
  const ringIdx = [];
  const capRings = o.capEnd === false ? 0 : 3;
  for (let i = 0; i < n; i++) { ringIdx.push(B.nv); ringAt(pts[i], rad[i], tan[i], frames[i][0], frames[i][1], i); }
  const stitch = (r0, r1) => { for (let s = 0; s < sides; s++) { const a = r0 + s, b = r0 + s + 1, c = r1 + s, d = r1 + s + 1; B.tri(a, b, c); B.tri(b, d, c); } };
  for (let i = 0; i < n - 1; i++) stitch(ringIdx[i], ringIdx[i + 1]);
  // start cap (hemisphere) so branch starts / open ends are closed too (no sawn-off tubes)
  if (capRings && o.capStart !== false) { const t = tan[0], c0 = pts[0], r0 = rad[0], fr = frames[0]; const rings = [];
    for (let k = capRings; k >= 1; k--) { const ph = k / capRings * Math.PI / 2, rr = Math.max(r0 * Math.cos(ph), r0 * 0.04), off = -r0 * Math.sin(ph); const cc = [c0[0] + t[0] * off, c0[1] + t[1] * off, c0[2] + t[2] * off]; const idx = B.nv; const ci = col(0), ua = au(0);
      for (let s = 0; s <= sides; s++) { const th = s / sides * TAU, ct = Math.cos(th), st = Math.sin(th); const rx = fr[0][0] * ct + fr[1][0] * st, ry = fr[0][1] * ct + fr[1][1] * st, rz = fr[0][2] * ct + fr[1][2] * st;
        const nx = rx * Math.cos(ph) - t[0] * Math.sin(ph), ny = ry * Math.cos(ph) - t[1] * Math.sin(ph), nz = rz * Math.cos(ph) - t[2] * Math.sin(ph);
        B.vert(cc[0] + rx * rr, cc[1] + ry * rr, cc[2] + rz * rr, nx, ny, nz, ci[0], ci[1], ci[2], ua, s / sides, vs ? cum[0] * vs : 0); }
      rings.push(idx); }
    rings.push(ringIdx[0]); for (let k = 0; k < rings.length - 1; k++) stitch(rings[k], rings[k + 1]); }
  // end cap (hemisphere) so tips are rounded
  if (capRings) { let prev = ringIdx[n - 1]; const t = tan[n - 1], c0 = pts[n - 1], r0 = rad[n - 1], fr = frames[n - 1];
    for (let k = 1; k <= capRings; k++) { const ph = k / capRings * Math.PI / 2, rr = Math.max(r0 * Math.cos(ph), r0 * 0.04), off = r0 * Math.sin(ph); const cc = [c0[0] + t[0] * off, c0[1] + t[1] * off, c0[2] + t[2] * off]; const idx = B.nv; const ci = col(n - 1), ua = au(n - 1);
      for (let s = 0; s <= sides; s++) { const th = s / sides * TAU, ct = Math.cos(th), st = Math.sin(th); const rx = fr[0][0] * ct + fr[1][0] * st, ry = fr[0][1] * ct + fr[1][1] * st, rz = fr[0][2] * ct + fr[1][2] * st;
        const nx = rx * Math.cos(ph) + t[0] * Math.sin(ph), ny = ry * Math.cos(ph) + t[1] * Math.sin(ph), nz = rz * Math.cos(ph) + t[2] * Math.sin(ph);
        B.vert(cc[0] + rx * rr, cc[1] + ry * rr, cc[2] + rz * rr, nx, ny, nz, ci[0], ci[1], ci[2], ua, s / sides, vs ? cum[n - 1] * vs : 1); }
      stitch(prev, idx); prev = idx; } }
}

/* lathe: revolve a profile [[r, y],...] (r = radius, y along the axis) around +y. Returns {pos,nor,idx} arrays appended to builder with a transform. */
export function lathe(B, prof, seg, xf, o = {}) {
  const col = o.col || [1, 1, 1], au = o.au === undefined ? -1e4 : o.au, m = prof.length, base = B.nv;
  const prn = []; for (let i = 0; i < m; i++) { const a = prof[Math.max(0, i - 1)], b = prof[Math.min(m - 1, i + 1)]; const dr = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dr, dy) || 1; prn.push([dy / l, -dr / l]); } // 2D normal (outward for ccw profile bottom->top)
  for (let i = 0; i < m; i++) for (let s = 0; s <= seg; s++) { const th = s / seg * TAU, ct = Math.cos(th), st = Math.sin(th);
    const p = xf.p(prof[i][0] * ct, prof[i][1], prof[i][0] * st), nn = xf.n(prn[i][0] * ct, prn[i][1], prn[i][0] * st);
    B.vert(p[0], p[1], p[2], nn[0], nn[1], nn[2], col[0], col[1], col[2], typeof au === 'function' ? au(i) : au, s / seg, i / (m - 1)); }
  for (let i = 0; i < m - 1; i++) for (let s = 0; s < seg; s++) { const a = base + i * (seg + 1) + s, b = a + 1, c = a + seg + 1, d = c + 1; B.tri(a, c, b); B.tri(b, c, d); }
}
// transform from basis: origin o, axes ex, ey, ez, uniform scale
export function xform(o, ex, ey, ez, sc = 1) {
  return { p: (x, y, z) => [o[0] + (ex[0] * x + ey[0] * y + ez[0] * z) * sc, o[1] + (ex[1] * x + ey[1] * y + ez[1] * z) * sc, o[2] + (ex[2] * x + ey[2] * y + ez[2] * z) * sc],
    n: (x, y, z) => { const a = ex[0] * x + ey[0] * y + ez[0] * z, b = ex[1] * x + ey[1] * y + ez[1] * z, c = ex[2] * x + ey[2] * y + ez[2] * z; const l = Math.hypot(a, b, c) || 1; return [a / l, b / l, c / l]; } };
}
export function basisFromDir(d) { // orthonormal basis with ey = d
  const ey = norm(d), t = Math.abs(ey[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; const ex = norm(cross(t, ey)), ez = cross(ey, ex); return [ex, ey, ez];
}
export { norm, cross, dot, sub };

// closed ellipsoid of revolution around axis d (semi-axes: rxz across, ry along d) -- smooth, for boutons / varicosities
export function ellipsoid(B, c, d, rxz, ry, seg, ring, col, au = -1e4, flatBottom = 0) {
  const [ex, ey, ez] = basisFromDir(d), prof = []; for (let k = 0; k <= ring; k++) { const a = k / ring * Math.PI; prof.push([rxz * Math.sin(a), -ry * Math.cos(a) * (Math.cos(a) < 0 ? 1 - flatBottom : 1)]); }
  lathe(B, prof, seg, xform(c, ex, ey, ez), { col, au });
}
