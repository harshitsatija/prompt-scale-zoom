/* cortex/field.js: the cell field of the slab (every soma, every glial nucleus) as typed arrays, laid out by real layer thicknesses and densities,
 * with minicolumn organisation; plus a spatial grid for fast view-dependent selection. Units: metres. Local frame: +Y toward the pia (pia at y=0), z<=0 behind the section plane. */
export const MM = 1e-3;
// depth boundaries in mm (human neocortex ~2.7 mm grey matter), neuron / glia density (thousand per mm^3), pyramidal fraction, mean soma diameter (um)
const DSC = 3.55 / 2.7;   // the real fsaverage ribbon at the locus is 3.55 mm thick (assets/brain/locus.json): the block's laminae are stretched to it so the grey/white boundary sits where the brain plate puts it
export const LAYERS = [
  { n: 'I', a: 0, b: 0.15, dn: 5, pf: 0, dg: 24, d: 8, ast: 0.62 },
  { n: 'II', a: 0.15, b: 0.38, dn: 80, pf: 0.86, dg: 20, d: 9.5, ast: 0.30 },
  { n: 'III', a: 0.38, b: 1.30, dn: 44, pf: 0.82, dg: 22, d: 12.5, ast: 0.30 },
  { n: 'IV', a: 1.30, b: 1.62, dn: 72, pf: 0.88, dg: 24, d: 9, ast: 0.28 },
  { n: 'V', a: 1.62, b: 2.12, dn: 30, pf: 0.80, dg: 26, d: 16, ast: 0.26 },
  { n: 'VI', a: 2.12, b: 2.70, dn: 42, pf: 0.78, dg: 28, d: 11.5, ast: 0.24 },
  { n: 'WM', a: 2.70, b: 3.60, dn: 0.4, pf: 0, dg: 52, d: 9, ast: 0.22 }].map((L) => Object.assign(L, { a: L.a * DSC, b: L.n === 'WM' ? 4.75 : L.b * DSC }));
export const X0 = -3.3 * MM, X1 = 3.3 * MM, ZW = 0.42 * MM, YB = 4.8 * MM, BIN = 0.1 * MM;
export function rngf(seed) { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const KIND = { PYR: 0, INT: 1, GRAN: 2, ASTRO: 3, OLIGO: 4, MICRO: 5 };
export function buildField(densScale = 1) {
  const rnd = rngf(20260610), gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += rnd(); return (u - 2) * 1.7; };
  // minicolumn lattice (hex, 52 um) in x,z
  const sp = 52e-6, cols = []; for (let j = 0, zz = -ZW; zz < 0.02e-3; j++, zz += sp * 0.866) for (let x = X0 + (j % 2) * sp / 2; x < X1; x += sp) cols.push(x, zz);
  const nc = cols.length / 2;
  const cap = 900000; const x = new Float32Array(cap), y = new Float32Array(cap), z = new Float32Array(cap), s = new Float32Array(cap), k = new Uint8Array(cap), r = new Uint8Array(cap); let n = 0;
  const add = (kk, xx, yy, zz, rad) => { if (n >= cap) return; x[n] = xx; y[n] = yy; z[n] = zz; s[n] = rad; k[n] = kk; r[n] = (rnd() * 256) | 0; n++; };
  for (const L of LAYERS) {
    const vol = (X1 - X0) / MM * (ZW / MM) * (L.b - L.a); // mm^3
    const nN = Math.round(vol * L.dn * 1000 * densScale), nG = Math.round(vol * L.dg * 1000 * densScale);
    for (let i = 0; i < nN; i++) {
      let xx, zz; if (rnd() < 0.68 && L.n !== 'I') { const c = (rnd() * nc) | 0; xx = cols[2 * c] + gauss() * 8e-6; zz = cols[2 * c + 1] + gauss() * 8e-6; } else { xx = X0 + rnd() * (X1 - X0); zz = -rnd() * ZW; }
      if (zz > 0.012e-3 || zz < -ZW) { zz = -rnd() * ZW; }
      const yy = -(L.a + rnd() * (L.b - L.a)) * MM, depth = -yy / MM, pyr = rnd() < L.pf;
      let d = L.d * (0.82 + 0.36 * rnd()); if (L.n === 'III') d *= 0.8 + 0.4 * (depth - 0.38) / 0.92; if (L.n === 'V' && rnd() < 0.09) d *= 1.55; if (L.n === 'VI') d *= 0.9 + 0.2 * rnd();
      add(pyr ? (L.n === 'IV' ? KIND.GRAN : KIND.PYR) : KIND.INT, xx, yy, zz, d * 0.5e-6);
    }
    for (let i = 0; i < nG; i++) {
      const xx = X0 + rnd() * (X1 - X0), zz = -rnd() * ZW, yy = -(L.a + rnd() * (L.b - L.a)) * MM, q = rnd();
      if (L.n === 'WM') add(q < 0.7 ? KIND.OLIGO : q < 0.93 ? KIND.ASTRO : KIND.MICRO, xx, yy, zz, (q < 0.7 ? 3.0 : q < 0.93 ? 4.0 : 2.6) * 1e-6 * (0.85 + 0.3 * rnd()));
      else add(q < L.ast ? KIND.ASTRO : q < L.ast + 0.55 ? KIND.OLIGO : KIND.MICRO, xx, yy, zz, (q < L.ast ? 3.9 : q < L.ast + 0.55 ? 2.9 : 2.5) * 1e-6 * (0.85 + 0.3 * rnd()));
    }
  }
  // spatial grid in (x, y)
  const gx = Math.ceil((X1 - X0) / BIN), gy = Math.ceil(YB / BIN), cnt = new Int32Array(gx * gy + 1), bin = new Int32Array(n);
  for (let i = 0; i < n; i++) { const bx = Math.min(gx - 1, Math.max(0, ((x[i] - X0) / BIN) | 0)), by = Math.min(gy - 1, Math.max(0, ((-y[i]) / BIN) | 0)); bin[i] = by * gx + bx; cnt[bin[i] + 1]++; }
  for (let i = 0; i < gx * gy; i++) cnt[i + 1] += cnt[i];
  const start = new Int32Array(cnt), fill = new Int32Array(gx * gy), idx = new Int32Array(n);
  for (let i = 0; i < n; i++) { const b = bin[i]; idx[start[b] + fill[b]++] = i; }
  return { n, x, y, z, s, k, r, gx, gy, start, idx };
}
/** collect the indices of cells within radius R of (cx,cy) (local metres). cb(i) is called for each. */
export function query(F, cx, cy, R, cb) {
  const bx0 = Math.max(0, Math.floor((cx - R - X0) / BIN)), bx1 = Math.min(F.gx - 1, Math.floor((cx + R - X0) / BIN)), by0 = Math.max(0, Math.floor((-(cy + R)) / BIN)), by1 = Math.min(F.gy - 1, Math.floor((-(cy - R)) / BIN)), R2 = R * R;
  for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) { const b = by * F.gx + bx; for (let q = F.start[b]; q < F.start[b + 1]; q++) { const i = F.idx[q], dx = F.x[i] - cx, dy = F.y[i] - cy; if (dx * dx + dy * dy <= R2) cb(i); } }
}
