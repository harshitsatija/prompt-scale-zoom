/* cortex/morph.js: loads the converted NeuroMorpho reconstructions and turns them into smooth swept-tube meshes (parallel-transport frames,
 * Catmull-Rom resampling, Rall-style radii from subtree size), plus anatomically shaped somas with nuclei. Units: metres (data are micrometres). */
export async function loadMorph(ctx) {
  const meta = await ctx.fetchJSON('cortex/morph.json'), buf = await ctx.fetchBuf('cortex/morph.bin'), N = meta.total;
  const X = new Float32Array(buf, 0, N * 4), P = new Int32Array(buf, N * 16, N), Ty = new Uint8Array(buf, N * 20, N);
  return meta.cells.map((m) => ({ ...m, X: X.subarray(m.off * 4, (m.off + m.n) * 4), P: P.subarray(m.off, m.off + m.n), Ty: Ty.subarray(m.off, m.off + m.n) }));
}
const UM = 1e-6;
/** per-node radius (um) from Rall-like scaling with terminal count, axons thin and beaded later */
export function radii(cell, o = {}) {
  const n = cell.n, P = cell.P, loc = (k) => (P[k] >= 0 ? P[k] - cell.off : -1);
  const nt = new Float32Array(n), kids = new Int32Array(n);
  for (let k = 0; k < n; k++) { const p = loc(k); if (p >= 0) kids[p]++; }
  for (let k = 0; k < n; k++) if (kids[k] === 0) nt[k] = 1;
  for (let k = n - 1; k >= 0; k--) { const p = loc(k); if (p >= 0) nt[p] += nt[k]; }
  const r = new Float32Array(n), rt = o.rtip || 0.3, ex = o.ex || 0.42, cap = o.cap || 3.4;
  for (let k = 0; k < n; k++) { const ty = cell.Ty[k]; let v = ty === 2 ? (o.axon || 0.38) : Math.min(cap, rt * Math.pow(Math.max(1, nt[k]), ex)); if (o.useData) v = Math.max(v, cell.X[k * 4 + 3]); r[k] = v; }
  return r;
}
function rngf(seed) { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export class Mesh3 { // growable geometry accumulator
  constructor() { this.p = []; this.n = []; this.c = []; this.i = []; this.v = 0; }
  toGeometry(T) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3)); g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3)); g.setIndex(this.v > 65535 ? new T.Uint32BufferAttribute(this.i, 1) : new T.Uint16BufferAttribute(this.i, 1)); g.computeBoundingSphere(); return g; }
}
/** sweep a tube along 3D points (metres). pts: array of [x,y,z]; rad: array of radii (same length); sides; spacing h; colour [r,g,b]; flare: radius multiplier at the start. */
export function addTube(M, T, pts, rad, sides, h, col, o = {}) {
  const n0 = pts.length; if (n0 < 2) return null;
  let path;
  if (n0 > 2 && h > 0) { const cv = new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(p[0], p[1], p[2])), false, 'centripetal'); let L = 0; for (let i = 1; i < n0; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); const ns = Math.max(n0 - 1, Math.ceil(L / h)); path = cv.getSpacedPoints(ns).map((v) => [v.x, v.y, v.z]); }
  else path = n0 === 2 && h > 0 ? (() => { const L = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]), ns = Math.max(1, Math.ceil(L / h)); const a = []; for (let i = 0; i <= ns; i++) { const t = i / ns; a.push([pts[0][0] + (pts[1][0] - pts[0][0]) * t, pts[0][1] + (pts[1][1] - pts[0][1]) * t, pts[0][2] + (pts[1][2] - pts[0][2]) * t]); } return a; })() : pts;
  const m = path.length, rr = new Float32Array(m);
  // radius by cumulative chord fraction along the original polyline
  const cum = [0]; for (let i = 1; i < n0; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]) + 1e-12);
  const tot = cum[n0 - 1]; let seg = 0;
  for (let i = 0; i < m; i++) { const f = i / (m - 1) * tot; while (seg < n0 - 2 && cum[seg + 1] < f) seg++; const u = (f - cum[seg]) / (cum[seg + 1] - cum[seg] + 1e-30); rr[i] = rad[seg] + (rad[seg + 1] - rad[seg]) * Math.min(1, Math.max(0, u)); if (o.bead) rr[i] *= 1 + o.bead * Math.pow(Math.max(0, Math.sin(f / o.beadL + (o.phase || 0))), 10); if (o.flare && i < 3) rr[i] *= 1 + o.flare * (1 - i / 3); }
  let t = [0, 0, 0], nrm = null; const base = M.v;
  for (let i = 0; i < m; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(m - 1, i + 1)]; t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const tl = Math.hypot(t[0], t[1], t[2]) || 1; t = [t[0] / tl, t[1] / tl, t[2] / tl];
    if (!nrm) { const ax = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; nrm = [t[1] * ax[2] - t[2] * ax[1], t[2] * ax[0] - t[0] * ax[2], t[0] * ax[1] - t[1] * ax[0]]; }
    else { const d = nrm[0] * t[0] + nrm[1] * t[1] + nrm[2] * t[2]; nrm = [nrm[0] - d * t[0], nrm[1] - d * t[1], nrm[2] - d * t[2]]; }
    let nl = Math.hypot(nrm[0], nrm[1], nrm[2]); if (nl < 1e-9) { nrm = [t[2], 0, -t[0]]; nl = Math.hypot(nrm[0], nrm[1], nrm[2]) || 1; } nrm = [nrm[0] / nl, nrm[1] / nl, nrm[2] / nl];
    const bn = [t[1] * nrm[2] - t[2] * nrm[1], t[2] * nrm[0] - t[0] * nrm[2], t[0] * nrm[1] - t[1] * nrm[0]], p = path[i], r = rr[i];
    for (let s = 0; s < sides; s++) { const th = s / sides * 6.2831853, cs = Math.cos(th), sn = Math.sin(th), ox = cs * nrm[0] + sn * bn[0], oy = cs * nrm[1] + sn * bn[1], oz = cs * nrm[2] + sn * bn[2]; M.p.push(p[0] + ox * r, p[1] + oy * r, p[2] + oz * r); M.n.push(ox, oy, oz); M.c.push(col[0], col[1], col[2]); }
  }
  for (let i = 0; i < m - 1; i++) for (let s = 0; s < sides; s++) { const a = base + i * sides + s, b = base + i * sides + (s + 1) % sides, c = base + (i + 1) * sides + s, d = base + (i + 1) * sides + (s + 1) % sides; M.i.push(a, c, b, b, c, d); }
  M.v += m * sides;
  if (!o.open) { // rounded tip: one apex vertex ahead of the last ring
    const p = path[m - 1], r = rr[m - 1], a = path[m - 2]; let tx = p[0] - a[0], ty = p[1] - a[1], tz = p[2] - a[2]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    M.p.push(p[0] + tx * r * 0.9, p[1] + ty * r * 0.9, p[2] + tz * r * 0.9); M.n.push(tx, ty, tz); M.c.push(col[0], col[1], col[2]); const ap = M.v++, last = base + (m - 1) * sides; for (let s = 0; s < sides; s++) M.i.push(last + s, ap, last + (s + 1) % sides);
  }
  return path;
}
/** lathe-style soma: kind 'pyr' (teardrop with apical taper) or 'round'. R metres, orientation +Y = apex. lat/lon resolution; returns into M with colour. */
export function addSoma(M, R, kind, lat, lon, col, o = {}) {
  const base = M.v, ox = o.ox || 0, oy = o.oy || 0, oz = o.oz || 0, sy = o.sy || (kind === 'pyr' ? 1.28 : 1.0), sx = o.sx || (kind === 'pyr' ? 0.92 : 1.0);
  for (let i = 0; i <= lat; i++) {
    const v = i / lat, ph = v * Math.PI, y = Math.cos(ph), ring = Math.sin(ph);
    let rad = 1, yy = y;
    if (kind === 'pyr') { const up = Math.max(0, y); rad = 1 - 0.42 * Math.pow(up, 1.5); yy = y > 0 ? y * (1 + 0.55 * y * y) : y * 0.92; }
    for (let j = 0; j <= lon; j++) { const th = j / lon * 6.2831853, c = Math.cos(th), s = Math.sin(th);
      const px = c * ring * rad * sx, pz = s * ring * rad * sx, py = yy * sy;
      M.p.push(ox + px * R, oy + py * R, oz + pz * R);
      // normal of an ellipsoid-ish body: approximate with scaled gradient
      let nx = c * ring / (sx * sx), nz = s * ring / (sx * sx), ny = y / (sy * sy); if (kind === 'pyr' && y > 0) { nx *= 1.0; nz *= 1.0; ny *= 0.55; } const nl = Math.hypot(nx, ny, nz) || 1; M.n.push(nx / nl, ny / nl, nz / nl); M.c.push(col[0], col[1], col[2]); }
  }
  for (let i = 0; i < lat; i++) for (let j = 0; j < lon; j++) { const a = base + i * (lon + 1) + j, b = a + 1, c = a + lon + 1, d = c + 1; if (i > 0) M.i.push(a, c, b); if (i < lat - 1) M.i.push(b, c, d); }
  M.v += (lat + 1) * (lon + 1);
}
export function addSphere(M, R, lat, lon, col, ox = 0, oy = 0, oz = 0, sx = 1, sy = 1, sz = 1) {
  const base = M.v;
  for (let i = 0; i <= lat; i++) { const ph = i / lat * Math.PI, y = Math.cos(ph), ring = Math.sin(ph); for (let j = 0; j <= lon; j++) { const th = j / lon * 6.2831853, x = Math.cos(th) * ring, z = Math.sin(th) * ring; M.p.push(ox + x * R * sx, oy + y * R * sy, oz + z * R * sz); const nx = x / sx, ny = y / sy, nz = z / sz, nl = Math.hypot(nx, ny, nz) || 1; M.n.push(nx / nl, ny / nl, nz / nl); M.c.push(col[0], col[1], col[2]); } }
  for (let i = 0; i < lat; i++) for (let j = 0; j < lon; j++) { const a = base + i * (lon + 1) + j, b = a + 1, c = a + lon + 1, d = c + 1; if (i > 0) M.i.push(a, c, b); if (i < lat - 1) M.i.push(b, c, d); }
  M.v += (lat + 1) * (lon + 1);
}
export function chains(cell) { // unbranched runs [parentIdx, ..., endIdx] (local indices); dendrites/axon only
  const n = cell.n, loc = (k) => (cell.P[k] >= 0 ? cell.P[k] - cell.off : -1), kids = Array.from({ length: n }, () => []);
  for (let k = 0; k < n; k++) { const p = loc(k); if (p >= 0) kids[p].push(k); }
  const out = [], starts = [];
  for (let k = 0; k < n; k++) { if (cell.Ty[k] === 1) { for (const c of kids[k]) if (cell.Ty[c] !== 1) starts.push([k, c]); } else if (kids[k].length > 1 || (kids[k].length === 1 && cell.Ty[kids[k][0]] !== cell.Ty[k])) for (const c of kids[k]) if (cell.Ty[c] !== 1) starts.push([k, c]); }
  // roots without soma parent
  for (let k = 0; k < n; k++) if (loc(k) < 0 && cell.Ty[k] !== 1) for (const c of kids[k]) starts.push([k, c]);
  for (const [s, c] of starts) { const ch = [s, c]; let k = c; while (kids[k].length === 1 && cell.Ty[kids[k][0]] === cell.Ty[k]) { k = kids[k][0]; ch.push(k); } out.push(ch); }
  return out;
}
