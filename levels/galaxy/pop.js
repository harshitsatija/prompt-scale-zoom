/* The far-field galaxy POPULATION shared by the galaxy level and the web level: the same catalogue entries, the same positions (kpc, galaxy scene frame), colours,
 * glyph types and luminosities, drawn with the same glyph material and brightness law in both levels (galaxy hands the points to web at HANDOFF_Z without any visible change). */
export const HANDOFF_Z = 23.9;
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const eqScene = (raD, decD, dMpc) => { const ra = raD * Math.PI / 180, de = decD * Math.PI / 180, v = [Math.cos(de) * Math.cos(ra), Math.cos(de) * Math.sin(ra), Math.sin(de)];
  const A = [[-0.0548755604, -0.8734370902, -0.4838350155], [0.4941094279, -0.4448296300, 0.7469822445], [-0.8676661490, -0.1980763734, 0.4559837762]];
  const gx = A[0][0] * v[0] + A[0][1] * v[1] + A[0][2] * v[2], gy = A[1][0] * v[0] + A[1][1] * v[1] + A[1][2] * v[2], gz = A[2][0] * v[0] + A[2][1] * v[1] + A[2][2] * v[2];
  return [-gy * dMpc * 1000, gz * dMpc * 1000, -gx * dMpc * 1000]; };
export const NEAR = [ // name, RA, Dec (deg), distance (Mpc), members drawn, radius (Mpc), label. Virgo and Fornax lie beyond UNGC completeness: members are statistical (centres real)
  ['Virgo Cluster', 187.7, 12.4, 16.5, 700, 1.30, 'Virgo Cluster · 54 million ly'], ['Fornax Cluster', 54.6, -35.5, 19.3, 300, 0.85, 'Fornax Cluster · 63 million ly']];
export { eqScene, hash };
const sst = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
// amplitude of each far-field set as a function of z (identical in both levels), and the shared soft cap of the glyph shader
export const popLaw = (z) => ({ ungc: sst(22.4, 23.1, z) * (1 + 0.7 * (1 - sst(23.3, 23.95, z))), nbr: sst(23.0, 23.8, z), dwarf: 2.4 * sst(21.7, 22.4, z) * (1 - 0.35 * sst(23.2, 24.0, z)) });
export const capLaw = (z) => 1.7 - 1.0 * sst(21.4, 22.4, z) - 0.15 * sst(23.4, 24.0, z);
// Local Group dwarfs (McConnachie 2012), minus the galaxies drawn as textured discs by the galaxy level
export function dwarfItems(lg, skip) {
  const out = [];
  lg.galaxies.forEach((g, gi) => {
    if (skip.has(g.name)) return;
    const Mv = g.V === null ? null : g.V - 5 * Math.log10(g.d * 1000 / 10); const lum = Mv === null ? 0.3 : Math.max(0, Math.min(1, (-Mv - 5) / 14));
    const type = g.type || ''; const irr = /dIrr|Irr|Sc|Sb|Sd|Im|Ir/.test(type), dE = /dE|dSph|cE|E/.test(type);
    const c = irr ? [0.72, 0.84, 1.0] : dE ? [1.0, 0.86, 0.66] : [0.88, 0.9, 1.0];
    const r = 0.18 + 0.7 * Math.pow(lum, 1.3) + (/Sc|Sb/.test(type) ? 6 : 0);
    out.push({ p: [g.x, g.y, g.z], r, c, lum: 0.25 + 0.75 * lum, type: irr ? 2 : 0, rot: hash(gi) * 6.283, ar: dE ? 0.55 + 0.4 * hash(gi + 40) : 1, seed: hash(gi + 9) });
  });
  return out;
}
// Updated Nearby Galaxy Catalog (Karachentsev+ 2013): 761 real galaxies out to 26 Mpc
export function ungcItems(ungc) {
  return ungc.g.map((q, k) => { const [x, y, z, dia, Mb, TT, inc, ba] = q; const lum = Math.max(0, Math.min(1, (-Mb - 8.5) / 12.5));
    const early = TT <= -1, late = TT >= 9; const c = early ? [1.0, 0.84, 0.62] : late ? [0.7, 0.84, 1.0] : TT <= 3 ? [1.0, 0.9, 0.78] : [0.78, 0.86, 1.0];
    return { p: [x, y, z], r: Math.max(dia, 0.3) * 0.5, c, lum: 0.2 + 0.8 * lum, type: early ? 0 : late ? 2 : 1, rot: hash(k * 3.1) * 6.283, ar: Math.max(0.2, Math.min(1, ba)), seed: hash(k + 5) }; });
}
// the Virgo and Fornax clusters: real centres, statistical members
export function nbrItems() {
  let n = 0; NEAR.forEach((q) => { n += q[4]; }); const items = []; let sd = 424242; const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(6.2831853 * rnd()); let k = 0; const labels = [];
  NEAR.forEach((q) => { const c = eqScene(q[1], q[2], q[3]); if (q[6]) labels.push({ text: q[6], c });
    for (let i = 0; i < q[4]; i++) { const r = q[5] * 1000 * (i === 0 ? 0.0 : 0.55); const e = rnd() < 0.55 ? 1 : 0;
      const p = [c[0] + gauss() * r * (e ? 0.7 : 1), c[1] + gauss() * r * (e ? 0.7 : 1), c[2] + gauss() * r * (e ? 0.7 : 1)];
      const b = 0.25 + 0.75 * Math.pow(rnd(), 2.2);
      items.push({ p, r: 8 + 20 * b, c: e ? [1.0, 0.84, 0.62] : [0.72, 0.82, 1.0], lum: b, type: e ? 0 : 1, rot: hash(k * 1.7) * 6.283, ar: e ? 0.6 + 0.4 * hash(k) : 0.3 + 0.7 * hash(k + 3), seed: hash(k + 2) }); k++; } });
  return { items, labels };
}
// attribute arrays for the glyph shader (levels/galaxy/shaders.js glyphMaterial)
export function glyphAttrs(T, items, scale = 1) {
  const n = items.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 4), sz = new Float32Array(n * 2), shp = new Float32Array(n * 4);
  items.forEach((it, i) => { pos.set([it.p[0] * scale, it.p[1] * scale, it.p[2] * scale], i * 3); col.set([it.c[0], it.c[1], it.c[2], it.lum], i * 4); sz.set([it.r, 0], i * 2); shp.set([it.type, it.rot, it.ar, it.seed], i * 4); });
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aCol', new T.BufferAttribute(col, 4)); g.setAttribute('aSz', new T.BufferAttribute(sz, 2)); g.setAttribute('aShp', new T.BufferAttribute(shp, 4)); return g;
}
