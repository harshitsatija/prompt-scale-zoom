/* cortex/tissue.js: view-dependent rendering of the cell field. Every soma in the view is an instanced, smooth, nucleated mesh (3 LODs); at wide fields each
 * pyramidal cell also gets a faint apical dendrite (minicolumn bundles); at close range the cells nearest the section plane are swapped for real NeuroMorpho
 * reconstructions (templates, 3 LODs); a sparse set of such cells is always placed as "Golgi-stained" hero cells. Selection depends on the field width so triangle
 * counts stay bounded at every zoom. */
import { Mesh3, addSoma, addSphere } from './morph.js';
import { query, X0, X1, ZW, MM, KIND, LAYERS, rngf } from './field.js';
const hexc = (T, h) => new T.Color(h);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lodOf = (z) => { const u = clamp((-2.5 - z) / 1.5, 0, 1); return { u, T1: Math.min((0.022 + 0.43 * Math.pow(u, 1.2)) * MM, Math.pow(10, z) * 0.06 + 0.006 * MM), p2: 0.03 + 0.04 * u }; };
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263 + 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

function stub(M, d, r0, len, sides, col, bend) { // a tapered, rounded process leaving the soma along unit direction d (starts inside the soma so there is no gap)
  const ax = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; let u = [d[1] * ax[2] - d[2] * ax[1], d[2] * ax[0] - d[0] * ax[2], d[0] * ax[1] - d[1] * ax[0]]; const ul = Math.hypot(...u); u = u.map((q) => q / ul);
  const w = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]], base = M.v, rings = [[0, 1], [0.5, 0.72], [0.85, 0.42]];
  for (const [f, k] of rings) { const cx = d[0] * len * f, cy = d[1] * len * f, cz = d[2] * len * f; for (let s = 0; s < sides; s++) { const th = s / sides * 6.2831853, c = Math.cos(th), sn = Math.sin(th), nx = c * u[0] + sn * w[0], ny = c * u[1] + sn * w[1], nz = c * u[2] + sn * w[2]; M.p.push(cx + nx * r0 * k, cy + ny * r0 * k, cz + nz * r0 * k); M.n.push(nx + d[0] * 0.25, ny + d[1] * 0.25, nz + d[2] * 0.25); M.c.push(col[0], col[1], col[2]); } }
  for (let r = 0; r < 2; r++) for (let s = 0; s < sides; s++) { const a = base + r * sides + s, b = base + r * sides + (s + 1) % sides, c = a + sides, e = b + sides; M.i.push(a, c, b, b, c, e); }
  const tip = len * 1.0; M.p.push(d[0] * tip, d[1] * tip, d[2] * tip); M.n.push(d[0], d[1], d[2]); M.c.push(col[0], col[1], col[2]); const ap = M.v + 3 * sides; for (let s = 0; s < sides; s++) M.i.push(base + 2 * sides + s, ap, base + 2 * sides + (s + 1) % sides); M.v += 3 * sides + 1;
}
function somaGeo(T, kind, lod) {
  const M = new Mesh3(); const L = [[5, 8], [12, 18], [18, 26]][lod], lat = L[0], lon = L[1], pyr = kind === 'pyr';
  addSoma(M, 1, kind === 'pyr' ? 'pyr' : 'round', lat, lon, [1, 1, 1]);
  const nuc = pyr ? [0.74, 0.60, 0.80] : [0.62, 0.78, 0.76];                 // opaque, matte, darker than the cytoplasm
  if (lod > 0) addSphere(M, pyr ? 0.7 : 0.72, lat - 2, lon - 2, nuc, 0, pyr ? -0.1 : 0, 0, 1.0, 1.0, 1.0);
  if (lod > 1) addSphere(M, 0.14, 6, 8, [0.38, 0.22, 0.42], 0.1, -0.05, 0.12);
  if (pyr) {   // thick tapering apical trunk (continues into the instanced apical straw) + basal dendrite stubs
    stub(M, [0, 1, 0], 0.34, 3.6, lod > 0 ? 6 : 4, [1, 1, 1]);
    if (lod > 0) for (let k = 0; k < 4; k++) { const th = k / 4 * 6.2831853 + 0.5, d = [Math.cos(th) * 0.78, -0.55, Math.sin(th) * 0.78]; const dl = Math.hypot(...d); stub(M, d.map((q) => q / dl), 0.2, 1.9, 5, [1, 1, 1]); }
  } else if (lod > 0 && kind === 'glia') {   // astrocyte-like star: many fine radial processes that end on vessels
    const nP = lod > 1 ? 8 : 6; for (let k = 0; k < nP; k++) { const th = k / nP * 6.2831853 + 0.4 * (k % 3), ph = ((k * 5) % 7 - 3) / 5 * 0.9, d = [Math.cos(th) * Math.cos(ph), Math.sin(ph), Math.sin(th) * Math.cos(ph)]; stub(M, d, 0.2, 3.2 + 0.7 * (k % 3), 5, [1, 1, 1]); }
  } else if (lod > 0 && kind === 'round') {   // multipolar interneuron: 5-6 short stubby primary dendrites
    for (let k = 0; k < 6; k++) { const th = k / 6 * 6.2831853, ph = (k % 2 ? 0.45 : -0.35), d = [Math.cos(th) * Math.cos(ph), Math.sin(ph), Math.sin(th) * Math.cos(ph)]; stub(M, d, 0.27, 1.6 + 0.25 * (k % 3), 6, [1, 1, 1]); }
  }
  return M.toGeometry(T);
}
function strawGeo(T, sides) { // unit tapered prism, base radius 1, top radius 0.28, height 1 along +y
  const M = new Mesh3(); const c = [1, 1, 1];
  for (let s = 0; s < sides; s++) { const th = s / sides * 6.2831853, cs = Math.cos(th), sn = Math.sin(th); M.p.push(cs, 0, sn); M.n.push(cs, 0.15, sn); M.c.push(1.15, 1.15, 1.15); }
  for (let s = 0; s < sides; s++) { const th = s / sides * 6.2831853, cs = Math.cos(th), sn = Math.sin(th); M.p.push(cs * 0.22, 1, sn * 0.22); M.n.push(cs, 0.15, sn); M.c.push(0.62, 0.62, 0.7); }
  for (let s = 0; s < sides; s++) { const a = s, bb = (s + 1) % sides, c1 = a + sides, d = bb + sides; M.i.push(a, c1, bb, bb, c1, d); }
  M.p.push(0, 1.04, 0); M.n.push(0, 1, 0); M.c.push(0.62, 0.62, 0.7); const ap = sides * 2; for (let s = 0; s < sides; s++) M.i.push(sides + s, ap, sides + (s + 1) % sides); M.v = sides * 2 + 1;
  return M.toGeometry(T);
}
export class Tissue {
  constructor(ctx, shade, field, templates, opts) {
    const { T } = ctx; this.ctx = ctx; this.T = T; this.field = field; this.g = new T.Group(); this.shade = shade; this.opts = opts;
    const mat = () => shade.tissue(0xffffff, { vc: true });
    this.mats = { soma: mat(), straw: mat(), tpl: shade.tissue(0xffffff, { vc: true, haze: 0.3 }) };
    const caps = [60000, 14000, 5000];
    this.somas = [];
    for (const kind of ['pyr', 'round', 'glia']) { const row = []; for (let lod = 0; lod < 3; lod++) { const m = new T.InstancedMesh(somaGeo(T, kind, lod), this.mats.soma, caps[lod]); m.frustumCulled = false; m.count = 0; m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(caps[lod] * 3), 3); this.g.add(m); row.push({ m, cap: caps[lod], ids: new Int32Array(caps[lod]) }); } this.somas.push(row); }
    { const cap = 30000, par = new Int32Array(cap), m = new T.InstancedMesh(strawGeo(T, 6), this.mats.straw, cap); m.frustumCulled = false; m.count = 0; m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(cap * 3), 3); this.g.add(m); this.straw = { m, cap, par }; }
    this.tpl = templates.map((t) => {
      const mk = (geo, cap) => { const m = new T.InstancedMesh(geo, this.mats.tpl, cap); m.frustumCulled = false; m.count = 0; m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); this.g.add(m); return m; };
      const stub = { count: 0, instanceMatrix: { count: 0, needsUpdate: false }, instanceColor: { needsUpdate: false }, visible: false, userData: { recs: [] }, setMatrixAt() {}, setColorAt() {}, stub: true };
      return { t, far: mk(t.geoFar, 96), mid: mk(t.geoMid, 120), near: stub, mk, inst: [] };
    });
    this.mats.straw.transparent = true; this.mats.straw.opacity = 0.7;
    this.nearOf = (tp) => { if (tp.near.stub) { tp.near = tp.mk(tp.t.getNear(), 24); tp.near.count = 0; tp.near.userData.recs = []; } return tp.near; };
    this.pyrVar = this.tpl.filter((q) => q.t.kind === 'pyr').sort((a, b) => a.t.D - b.t.D); this.intVar = this.tpl.filter((q) => q.t.kind === 'int');
    this.placeTemplates();
    { // the focal cell: the pyramidal neuron the film is about to dive into (soma 1.2 mm under the pia), full apical tuft to layer I
      const hp = this.pyrVar.reduce((b, v) => (Math.abs(v.t.D - 1.2) < Math.abs(b.t.D - 1.2) ? v : b));
      const rec = { x: 0, y: -1.2 * MM, z: -3e-6, ph: 0.9, rx: 0, rz: 0, s: 1.3, tp: hp, id: 424242, tint: 1.18, cell: -1, focal: true }; hp.inst.push(rec); this.all.push(rec); this.focal = rec; }
    this.cols = { pyr: [hexc(T, 0xe9b08e), hexc(T, 0xf2c19f), hexc(T, 0xdea283)], int: hexc(T, 0x4fc9ae), gran: hexc(T, 0x9ee0c4), astro: hexc(T, 0xb9a4f2), oligo: hexc(T, 0xa6dccd), micro: hexc(T, 0xf0838c) };
  }
  placeTemplates() {
    const rnd = rngf(777); const per = { pyr: 13, int: 9, astro: 10, micro: 8, oligo: 10 };
    this.all = [];
    for (const tp of this.tpl) {
      const kind = tp.t.kind, n = per[kind];
      for (let i = 0; i < n; i++) {
        let x = X0 + 0.25e-3 + rnd() * (X1 - X0 - 0.5e-3), z = -(0.02 + rnd() * 0.36) * MM, y;
        if (kind === 'pyr') y = -(tp.t.D + (rnd() - 0.5) * 0.06) * MM;
        else if (kind === 'int') { const L = [0.3, 0.7, 1.0, 1.45, 1.9, 2.3]; y = -(L[(rnd() * L.length) | 0] + (rnd() - 0.5) * 0.3) * MM; }
        else if (kind === 'astro') y = -(0.04 + rnd() * 2.9) * MM; else if (kind === 'micro') y = -(0.3 + rnd() * 2.3) * MM; else y = -(1.7 + rnd() * 1.6) * MM;
        const rec = { x, y, z, ph: rnd() * 6.283, rx: kind === 'pyr' || kind === 'int' ? 0 : rnd() * 6.283, rz: kind === 'pyr' || kind === 'int' ? 0 : rnd() * 6.283, s: 0.92 + 0.16 * rnd(), tp, id: this.all.length + 100000, tint: (kind === 'pyr' ? 1.02 : 0.9) + 0.2 * rnd(), cell: -1 };
        tp.inst.push(rec); this.all.push(rec);
      }
    }
  }
  /** (re)select what is visible. fx,fy: focus in local metres; W field width (m). */
  select(fx, fy, z, W, hero) {
    const { T, field: F } = this, lod = lodOf(z), R = 0.62 * W * 1.18 + 0.4 * lod.T1, px = W / 1500;
    const lodS = z > -3.05 ? 0 : z > -3.75 ? 1 : 2, cols = this.cols, c = new T.Color(), sm = this.somas, sd = this.straw;
    const mat4 = new T.Matrix4(), qq = new T.Quaternion(), pp = new T.Vector3(), ss = new T.Vector3(), eu = new T.Euler();
    const hx = hero ? hero.x : 1e9, hy = hero ? hero.y : 1e9, hr2 = (hero ? hero.r : 0) ** 2;
    const bgDim = 1 - 0.34 * clamp((z + 3.6) / 0.7, 0, 1), wideK = clamp((W - 1.5e-3) / 2.5e-3, 0, 1), strawFrac = (z < -3.55 ? 0 : 0.3 * Math.exp(-W / 0.9e-3)), tuftOn = W < 0.9e-3;
    const keepP = (depth) => lod.p2 + (1 - lod.p2) * Math.exp(-depth / (lod.T1 / 4));
    if (this.focal) { const iso = !(hero && hero.on) && z < -3.7; this.focal.z = iso ? -13e-6 : -3e-6; this.focal.ph = iso ? Math.PI - (this.focal.tp.t.axAz || 0) : 0.9; this.focal.x = iso && hero ? (hero.fsx || 0) : 0; this.focal.y = -1.2 * MM + (iso && hero ? (hero.fsy || 0) : 0); }
    const cutSkip = (depth, r) => W < 0.3e-3 && depth < r * 1.35;   // at tissue scale cells that straddle the section plane would show flat cut faces: show whole cells only
    const heroSkip = (x, y, depth) => hero && hero.on && ((x - hx) ** 2 + (y - hy) ** 2 < hr2) && depth < hero.depth;
    for (const row of sm) for (const S of row) S.m.count = 0; sd.m.count = 0;
    for (const tp of this.tpl) { tp.far.count = 0; tp.mid.count = 0; tp.near.count = 0; tp.far.userData.recs = []; tp.mid.userData.recs = []; tp.near.userData.recs = []; }
    // ---- background cells replaced by real reconstructions at close range
    const swap = new Set(); this.nSwap = 0; this.swapRecs = [];
    if (z < -2.9) {
      const candP = [], candI = [], candG = { [KIND.ASTRO]: [], [KIND.MICRO]: [], [KIND.OLIGO]: [] };
      query(F, fx, fy, R * 0.95, (i) => { const k = F.k[i]; if (k !== KIND.PYR && k !== KIND.INT && !candG[k]) return; const depth = -F.z[i]; if (depth > Math.max(0.12 * W, 0.04e-3) + 0.06e-3 * 0) return; if (heroSkip(F.x[i], F.y[i], depth) || cutSkip(depth, 1.3 * (F.s[i] + 2e-6))) return; (k === KIND.PYR ? candP : candG[k] || candI).push([depth + (F.r[i] / 255) * 0.02e-3, i]); });
      candP.sort((a, b) => a[0] - b[0]); candI.sort((a, b) => a[0] - b[0]); for (const k in candG) candG[k].sort((a, b) => a[0] - b[0]);
      const nP = Math.min(candP.length, z < -3.7 ? 12 : z < -3.4 ? 26 : 56), nI = Math.min(candI.length, z < -3.7 ? 4 : z < -3.4 ? 8 : 14);
      const put = (i, tp) => { const useNear = W < 0.09e-3; const mesh = useNear ? this.nearOf(tp) : W > 1.0e-3 ? tp.far : tp.mid; if (mesh.count >= mesh.instanceMatrix.count) return; const n = mesh.count++; const rec = { x: F.x[i], y: F.y[i], z: F.z[i], tint: 0.88 + 0.24 * (F.r[i] / 255), id: i, cell: i, tp };
        const ph = hash(i, 5) * 6.283, s = clamp(F.s[i] / (tp.t.somaR || 8e-6), 0.8, 1.3); eu.set(0, ph, 0); qq.setFromEuler(eu); mat4.compose(pp.set(F.x[i], F.y[i], F.z[i]), qq, ss.set(s, s, s)); mesh.setMatrixAt(n, mat4); mesh.setColorAt(n, c.setRGB(rec.tint, rec.tint, rec.tint)); mesh.userData.recs[n] = rec; swap.add(i); this.nSwap++; this.swapRecs.push(rec); };
      for (let q = 0; q < nP; q++) { const i = candP[q][1], d = candP[q][0]; let best = this.pyrVar[0]; for (const v of this.pyrVar) if (v.t.D * MM <= -F.y[i] + 0.06 * MM) best = v; else break; const alts = this.pyrVar.filter((v) => Math.abs(v.t.D - best.t.D) < 0.12); put(i, alts[(hash(i, 9) * alts.length) | 0] || best); }
      for (let q = 0; q < nI; q++) { const i = candI[q][1]; put(i, this.intVar[(hash(i, 11) * this.intVar.length) | 0]); }
      const gl = (k, kind, n) => { const vs = this.tpl.filter((q) => q.t.kind === kind); if (!vs.length) return; const c = candG[k]; for (let q = 0; q < Math.min(c.length, n); q++) { const i = c[q][1]; put(i, vs[(hash(i, 13) * vs.length) | 0]); } };
      gl(KIND.ASTRO, 'astro', z < -3.7 ? 4 : z < -3.4 ? 7 : 12); gl(KIND.MICRO, 'micro', z < -3.7 ? 2 : 5); gl(KIND.OLIGO, 'oligo', z < -3.7 ? 2 : 4);
    }
    // ---- all somata (+ faint apical straws at wide fields)
    query(F, fx, fy, R, (i) => {
      if (swap.has(i)) return;
      const depth = -F.z[i]; if (F.r[i] / 256 >= keepP(depth)) return; if (heroSkip(F.x[i], F.y[i], depth) || (F.k[i] < 3 && cutSkip(depth, F.s[i] * 1.5))) return;
      const k = F.k[i], rowI = k === KIND.PYR ? 0 : (k === KIND.INT || k === KIND.GRAN) ? 1 : 2, rs = F.s[i], rpx = rs / px; let l = rpx < 3.2 ? 0 : rpx < 10 ? 1 : 2; if (z < -3.75) l = 2;
      const S = sm[rowI][l]; if (S.m.count >= S.cap) return; const n = S.m.count++; S.ids[n] = i;
      const sc = Math.max(rs, px * 0.55); mat4.compose(pp.set(F.x[i], F.y[i], F.z[i]), qq.identity(), ss.set(sc, sc, sc)); S.m.setMatrixAt(n, mat4);
      const rr = F.r[i] / 255; let col;
      if (k === KIND.PYR) { col = cols.pyr[Math.min(2, (rr * 3) | 0)].clone().multiplyScalar(0.86 + 0.28 * ((F.r[i] * 7) % 13) / 13); const dm = -F.y[i] / MM; if (dm < 0.38) col.multiply(c.setRGB(1.0, 0.80, 0.92)); else if (dm < 1.3) col.multiply(c.setRGB(1.0, 0.94, 0.86)); else if (dm > 2.12) col.multiply(c.setRGB(0.84, 0.80, 1.05)); else if (dm > 1.62) col.multiply(c.setRGB(1.12, 0.84, 0.62)); }
      else if (k === KIND.INT) col = cols.int.clone().multiplyScalar(0.85 + 0.3 * rr); else if (k === KIND.GRAN) col = cols.gran.clone().multiplyScalar(0.85 + 0.3 * rr); else if (k === KIND.ASTRO) col = cols.astro.clone().multiplyScalar(0.8 + 0.3 * rr); else if (k === KIND.OLIGO) col = cols.oligo.clone().multiplyScalar(0.55 + 0.25 * rr); else col = cols.micro.clone().multiplyScalar(0.8 + 0.3 * rr);
      col.multiplyScalar(bgDim); S.m.setColorAt(n, col);
      if (k === KIND.PYR && hash(i, 23) < strawFrac && sd.m.count < sd.cap - 4) {
        const y0 = F.y[i] + rs * 3.55, top = Math.max(-(0.02 + 0.07 * ((F.r[i] * 13) % 17) / 17) * MM, y0 + (0.3 + 0.55 * hash(i, 3)) * MM), len = top - y0; if (len > 10e-6) {
          const w0 = Math.max(rs * 0.13, px * 0.55, 0.5e-6), n2 = sd.m.count++; mat4.compose(pp.set(F.x[i], y0, F.z[i]), qq.identity(), ss.set(w0, len, w0)); sd.m.setMatrixAt(n2, mat4); sd.m.setColorAt(n2, c.copy(col).multiplyScalar(0.5)); sd.par[n2] = i;
          if (tuftOn && px < 2.2e-6) for (let b2 = 0; b2 < 3 && sd.m.count < sd.cap; b2++) { const h2 = hash(i, 40 + b2), tl = (50 + 70 * h2) * 1e-6, ang = (b2 - 1) * (0.5 + 0.25 * h2) + (hash(i, 7) - 0.5) * 0.3; eu.set((hash(i, 60 + b2) - 0.5) * 0.9, 0, -ang); qq.setFromEuler(eu); const wt = Math.max(w0 * 0.3, px * 0.5, 0.4e-6), n3 = sd.m.count++; mat4.compose(pp.set(F.x[i], top - tl * 0.35, F.z[i]), qq, ss.set(wt, tl, wt)); sd.m.setMatrixAt(n3, mat4); sd.m.setColorAt(n3, c.copy(col).multiplyScalar(0.28)); sd.par[n3] = i; qq.identity(); }
        }
      }
    });
    for (const row of sm) for (const S of row) { S.base = S.m.instanceColor.array.slice(0, S.m.count * 3); S.m.instanceMatrix.needsUpdate = true; S.m.instanceColor.needsUpdate = true; S.m.visible = S.m.count > 0; }
    sd.base = sd.m.instanceColor.array.slice(0, sd.m.count * 3); sd.m.instanceMatrix.needsUpdate = true; sd.m.instanceColor.needsUpdate = true; sd.m.visible = sd.m.count > 0;
    // the focal cell's apical trunk as a bold tube impostor so the cell we dive into reads at tissue scale
    if (!(hero && hero.on) && W > 0.6e-3 && this.focal && sd.m.count < sd.cap) { const f = this.focal, y0 = f.y + 9e-6, top = -0.03 * MM, w0 = Math.max(1.1e-6, px * 0.8), n2 = sd.m.count++; mat4.compose(pp.set(f.x, y0, f.z), qq.identity(), ss.set(w0, top - y0, w0)); sd.m.setMatrixAt(n2, mat4); sd.m.setColorAt(n2, c.setRGB(0.95, 0.72, 0.5)); sd.par[n2] = -1; sd.base = sd.m.instanceColor.array.slice(0, sd.m.count * 3); sd.m.instanceMatrix.needsUpdate = true; sd.m.instanceColor.needsUpdate = true; sd.m.visible = true; }
    // ---- hero templates (always-present sparse Golgi-like cells)
    const useNear = W < 1.1e-3, tpR = R + 0.25e-3, Rn = (W < 0.09e-3 ? 4.5 : 0.85) * W; let nt = this.nSwap;
    for (const rec of this.all) {
      const dx = rec.x - fx, dy = rec.y - fy; if (dx * dx + dy * dy > tpR * tpR) continue; const depth = -rec.z; if (depth > ZW) continue; if (!rec.focal && cutSkip(depth, (rec.tp.somaR || 8e-6) * rec.s * 1.2)) continue;
      if (hero && hero.on && ((rec.x - hx) ** 2 + (rec.y - hy) ** 2 < (hero.r * 2.2) ** 2) && depth < hero.depth) continue;
      const tp = rec.tp, dd = Math.hypot(dx, dy), mesh = !useNear ? tp.far : dd < Rn ? (W < 0.3e-3 ? this.nearOf(tp) : tp.mid) : tp.mid; if (mesh.count >= mesh.instanceMatrix.count) continue;
      const n = mesh.count++; eu.set(rec.rx, rec.ph, rec.rz); qq.setFromEuler(eu); mat4.compose(pp.set(rec.x, rec.y, rec.z), qq, ss.set(rec.s, rec.s, rec.s)); mesh.setMatrixAt(n, mat4); mesh.setColorAt(n, c.setRGB(rec.tint, rec.tint, rec.tint)); mesh.userData.recs[n] = rec; nt++;
    }
    for (const tp of this.tpl) for (const m of [tp.far, tp.mid, tp.near]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; m.visible = m.count > 0; }
    this.stats = { somas: sm.flat().reduce((a, b) => a + b.m.count, 0), straws: sd.m.count, tpl: nt, swapped: this.nSwap, R, lod };
  }
  /** keystroke waves + spontaneous firing: recolour instances (amber HDR on top of base colour) */
  animate(t, S, z, W, fx, fy) {
    const F = this.field, waves = [], ox = fx - 0.62 * W, oy = fy - 0.1 * W, amb = [2.5, 1.05, 0.10];
    for (const [k, age] of S.ages) { if (age > 1.5) continue; const r = 0.6 * W * age, wd = 0.045 * W + 0.03 * W * age; waves.push([r, wd, Math.exp(-age / 1.1), k]); }
    const nW = waves.length; this.waveU = { ox, oy, list: waves.slice(0, 6).map((q) => [q[0], q[1], q[2]]) };
    const pulse = (x, y, id, k, gate) => { let v = 0; const d = Math.hypot(x - ox, y - oy); for (let q = 0; q < nW; q++) { const w = waves[q], u = (d - w[0]) / w[1]; if (u > -2.4 && u < 3 && hash(id, w[3]) < gate) v += w[2] * Math.exp(-(u > 0 ? u * u * 0.5 : u * u * 2)); } const ph = (t * 0.33 + hash(id, 99)) % 1; if (ph < 0.045 && hash(id, 7) < 0.045) v += Math.sin(ph / 0.045 * Math.PI); return Math.min(1.3, v); };
    const inten = (i) => { const k = F.k[i]; if (k >= 3) return 0; return pulse(F.x[i], F.y[i], i, k, k === 0 ? 0.85 : 0.5); };
    const paint = (S2, getI) => { const n = S2.m.count, arr = S2.m.instanceColor.array, base = S2.base; if (!base) return;
      for (let q = 0; q < n; q++) { const v = getI(q); if (v > 0.02) { const kk = Math.min(1, v); arr[q * 3] = base[q * 3] * (1 - kk) + amb[0] * v; arr[q * 3 + 1] = base[q * 3 + 1] * (1 - kk) + amb[1] * v; arr[q * 3 + 2] = base[q * 3 + 2] * (1 - kk) + amb[2] * v; } else { arr[q * 3] = base[q * 3]; arr[q * 3 + 1] = base[q * 3 + 1]; arr[q * 3 + 2] = base[q * 3 + 2]; } }
      S2.m.instanceColor.needsUpdate = true; };
    for (const row of this.somas) for (const S2 of row) { if (S2.m.count) paint(S2, (q) => inten(S2.ids[q])); }
    if (this.straw.m.count) paint(this.straw, (q) => { const pr = this.straw.par[q]; return pr < 0 ? pulse(0, -1.2e-3, 424242, 0, 1.01) * 0.8 : inten(pr) * 0.55; });
    for (const tp of this.tpl) for (const m of [tp.far, tp.mid, tp.near]) { if (!m.count) continue; const recs = m.userData.recs, arr = m.instanceColor.array, kd = tp.t.kind;
      for (let q = 0; q < m.count; q++) { const r = recs[q]; let v = 0; if (kd === 'pyr' || kd === 'int') v = r.cell >= 0 ? inten(r.cell) : pulse(r.x, r.y, r.id, 0, r.focal ? 1.01 : 0.5);
        const kk = Math.min(1, v); arr[q * 3] = r.tint * (1 - kk) + amb[0] * v; arr[q * 3 + 1] = r.tint * (1 - kk) + amb[1] * v; arr[q * 3 + 2] = r.tint * (1 - kk) + amb[2] * v; } m.instanceColor.needsUpdate = true; }
  }
}
