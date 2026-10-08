/* cortex/vessels.js: the cortical vasculature. Pial artery and vein on the surface, penetrating arterioles and ascending venules running perpendicular to the
 * pia, and a capillary bed (5-7 um lumen, ~400 mm of vessel per mm^3 = a 48 um lattice with 31 % of bonds present, tortuous), with red blood cells flowing
 * and pericytes on the walls. The capillary bed is generated on demand for the part of the slab in view. */
import { Mesh3, addTube, addSphere } from './morph.js';
import { X0, X1, ZW, MM, YB, rngf } from './field.js';
const A = 48e-6, UM = 1e-6;
function h3(i, j, k, s) { let h = (i * 374761393 + j * 668265263 + k * 2147483647 + s * 362437 + 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
import * as THREE from '../../vendor/three.module.js';
const L3 = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
export const VCOL = { cap: L3(0xe0728f), art: L3(0xd9506a), vein: L3(0x5c58d4), peri: L3(0xf08fc0), rbc: L3(0xe8404f) };
export class Vessels {
  constructor(ctx, shade, opts) {
    const { T } = ctx; this.T = T; this.shade = shade; this.g = new T.Group(); this.opts = opts || {};
    this.matV = shade.tissue(0xffffff, { vc: true, haze: 0.38 }); this.matR = shade.tissue(0xffffff, { vc: true, haze: 0.55 });
    this.matC = shade.tissue(0xffffff, { vc: true, haze: 0.55 }); this.matC.transparent = true; this.matC.opacity = 0.46; this.matC.depthWrite = false;   // translucent endothelium: the red cells inside show through
    this.big = new T.Mesh(new T.BufferGeometry(), this.matV); this.cap = new T.Mesh(new T.BufferGeometry(), this.matC); this.big.frustumCulled = false; this.cap.frustumCulled = false; this.g.add(this.big, this.cap);
    const rnd = rngf(4242); this.art = []; this.ven = [];
    // pial artery & vein paths (local x runs along the surface)
    this.pialA = (x) => ({ y: 20e-6 + 5e-6 * Math.sin(x / 0.5e-3 + 1), z: -(0.1 + 0.04 * Math.sin(x / 0.7e-3 + 1)) * MM, r: 22e-6 });
    this.pialV = (x) => ({ y: 26e-6 + 6e-6 * Math.sin(x / 0.6e-3), z: -(0.24 + 0.03 * Math.sin(x / 0.9e-3)) * MM, r: 28e-6 });
    const nA = 6, nV = 4;
    for (let i = 0; i < nA; i++) { const x = X0 + (i + 0.35 + 0.3 * rnd()) / nA * (X1 - X0), p = this.pialA(x); this.art.push({ x, z: p.z, depth: (1.7 + 0.8 * rnd()) * MM, r0: (5 + 1.6 * rnd()) * UM, ph: rnd() * 6.28 }); }
    this.art.push({ x: 0.31e-3, z: -0.012 * MM, depth: 1.9 * MM, r0: 8 * UM, ph: 1.3, cut: true }); // one that the section plane slices lengthwise
    for (let i = 0; i < nV; i++) { const x = X0 + (i + 0.6 + 0.3 * rnd()) / nV * (X1 - X0), p = this.pialV(x); this.ven.push({ x, z: p.z, depth: (2.5 + 0.2 * rnd()) * MM, r0: (7.5 + 2 * rnd()) * UM, ph: rnd() * 6.28 }); }
    this.buildBig(); this.rbcGeo = this.makeRBC(); this.key = ''; this.rbc = null; this.edges = [];
  }
  makeRBC() { const M = new Mesh3(), nr = 9, na = 22, c = VCOL.rbc, R = 1; const base = M.v;
    // biconcave disc (Evans-Fung profile), axis along +Y, radius 1
    const prof = (rho) => R * Math.sqrt(Math.max(0, 1 - rho * rho)) * (0.2072 + 2.0026 * rho * rho - 1.1228 * rho ** 4) * 0.5;
    for (const side of [1, -1]) for (let i = 0; i <= nr; i++) { const rho = i / nr; for (let j = 0; j <= na; j++) { const th = j / na * 6.2831853; const y = side * prof(rho), dy = side * (prof(Math.min(1, rho + 0.02)) - prof(Math.max(0, rho - 0.02))) / 0.04; const nx = Math.cos(th) * (-dy) , nz = Math.sin(th) * (-dy), ny = side; const nl = Math.hypot(nx, ny, nz); M.p.push(Math.cos(th) * rho, y, Math.sin(th) * rho); M.n.push(nx / nl, ny / nl, nz / nl); M.c.push(c[0], c[1], c[2]); } }
    const per = (nr + 1) * (na + 1); for (let s = 0; s < 2; s++) for (let i = 0; i < nr; i++) for (let j = 0; j < na; j++) { const a = s * per + i * (na + 1) + j, b = a + 1, cc = a + na + 1, d = cc + 1; if (s === 0) M.i.push(a, cc, b, b, cc, d); else M.i.push(a, b, cc, b, d, cc); }
    M.v = 2 * per; return M.toGeometry(this.T); }
  buildBig() {
    const { T } = this, M = new Mesh3(), rnd = rngf(11);
    // pial artery / vein ribbons along x
    const run = (fn, col, sides) => { const pts = [], rad = []; for (let x = X0 - 0.2e-3; x <= X1 + 0.2e-3; x += 80e-6) { const p = fn(x); const e = Math.min(1, Math.min(x - (X0 - 0.2e-3), (X1 + 0.2e-3) - x) / 0.5e-3); pts.push([x, p.y, p.z]); rad.push(p.r * (0.12 + 0.88 * e * e * (3 - 2 * e))); } addTube(M, T, pts, rad, sides, 60e-6, col, { open: false }); };
    run(this.pialA, VCOL.art, 16); if (!this.opts.noVein) run(this.pialV, VCOL.vein, 18);
    const dive = (v, col, up) => { // penetrating vessel from the pial vessel straight down with a slow wiggle
      const top = up ? this.pialV(v.x) : this.pialA(v.x), pts = [], rad = []; const n = 38;
      for (let i = 0; i <= n; i++) { const u = i / n, y = top.y - u * (top.y + v.depth); const w = (22e-6 * Math.sin(u * 7 + v.ph) + 11e-6 * Math.sin(u * 19 + 2 * v.ph) + 30e-6 * Math.sin(u * 2.6 + 0.7 * v.ph)) * Math.min(1, u * 3); pts.push([v.x + w * Math.cos(v.ph) + 8e-6 * Math.sin(u * 13 + v.ph) * u, y, v.z + (v.cut ? 0 : 0) + w * Math.sin(v.ph) * 0.8]); const r = up ? (v.r0 * (1.15 - 0.55 * u) + 2.2e-6) : (v.r0 * (1 - 0.7 * u) + 1.8e-6); rad.push(r); }
      rad[0] = top.r * 0.75; rad[1] = Math.max(rad[1] * 1.5, top.r * 0.35); v.pts = pts; v.rad = rad; addTube(M, T, pts, rad, 14, up ? 30e-6 : 6e-6, col, { open: false, bead: up ? 0 : 0.07, beadL: 8e-6, phase: v.ph });
      // side branches: precapillary arterioles / venular tributaries leave the trunk obliquely and thin to capillary calibre (they then join the capillary bed)
      const nb = up ? 3 : 6; for (let b = 0; b < nb; b++) { const u = 0.12 + 0.8 * (b + 0.5 * rnd()) / nb, j = Math.min(n, Math.round(u * n)), p0 = pts[j], r0 = rad[j] * 0.55, th = rnd() * 6.283, Lb = (150 + 250 * rnd()) * UM, dy = (rnd() - 0.55) * 0.5;
        const bp = [], br = []; let cx = p0[0], cy = p0[1], cz = p0[2], a = th; const sg = rnd() < 0.5 ? -1 : 1; for (let q = 0; q <= 8; q++) { bp.push([cx, cy, cz]); br.push(Math.max(2.1e-6, r0 * (1 - q / 8 * 0.7))); a += (rnd() - 0.5) * 0.7; const st2 = Lb / 8, fl = Math.min(1, q / 8 * 1.1), down = (0.82 - 0.55 * fl) * sg * 0 - (0.8 - 0.6 * fl), hor = 0.55 + 0.35 * fl; cx += Math.cos(a) * st2 * hor; cz += Math.sin(a) * st2 * hor * 0.5; cy += down * st2 * 0.9; if (cz > -4e-6) cz = -4e-6; if (cz < -ZW) cz = -ZW; }
        addTube(M, T, bp, br, 8, 14e-6, col, { open: false }); } };
    this.art.forEach((v) => dive(v, VCOL.art, false)); if (!this.opts.noVein) this.ven.forEach((v) => dive(v, VCOL.vein, true));
    // arteriole smooth-muscle rings (bands) as small flares are skipped: shape reads from the tapered tube
    this.bigGeo = M.toGeometry(T); this.big.geometry = this.bigGeo;
  }
  /** view-dependent capillary bed: a jittered 3D lattice of bonds (48 um spacing, 24 % present = ~400 mm of vessel per mm^3), pruned of dead ends, traced into
   *  continuous runs between junctions, and each run swept as ONE smooth tortuous tube (so there are no polyline kinks). Red cells ride along the run's own path. */
  select(fx, fy, R, depthMax, z, hero) {
    if (z > -3.0) { this.cap.visible = false; this.edges = []; this.rbcList = []; this.stats = { edges: 0, runs: 0 }; if (this.rbc) { this.rbc.count = 0; this.rbc.visible = false; } return; }
    this.cap.visible = true;
    const { T } = this, M = new Mesh3(), W = 2 * R / 1.2, far = z > -3.05, sides = far ? 5 : 8, rr = 2.6 * UM, chainsOut = [];
    const i0 = Math.floor((fx - R - X0) / A), i1 = Math.ceil((fx + R - X0) / A), j0 = Math.max(0, Math.floor(-(fy + R) / A)), j1 = Math.min(Math.ceil(YB / A), Math.ceil(-(fy - R) / A)), k1 = Math.min(Math.ceil(ZW / A), Math.ceil(depthMax / A));
    const node = (i, j, k) => [X0 + (i + 0.5 + (h3(i, j, k, 1) - 0.5) * 0.8) * A, -(j + 0.5 + (h3(i, j, k, 2) - 0.5) * 0.8) * A, -(k + (h3(i, j, k, 3) - 0.5) * 0.8) * A + 0.3 * A];
    const key = (i, j, k) => i + ',' + j + ',' + k, pm = far ? 0.2 : 0.26, R2 = R * R, adj = new Map(), pos = new Map();
    const inside = (p) => { const dx = p[0] - fx, dy = p[1] - fy; return dx * dx + dy * dy <= R2; };
    const heroOut = (p) => hero && hero.on && ((p[0] - hero.x) ** 2 + (p[1] - hero.y) ** 2 < (hero.r * 1.2) ** 2) && -p[2] < hero.depth;
    const getP = (i, j, k) => { const kk = key(i, j, k); let p = pos.get(kk); if (!p) { p = node(i, j, k); pos.set(kk, p); } return p; };
    let ne = 0; const maxE = far ? 9000 : 14000;
    for (let k = 0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const p = getP(i, j, k); if (!inside(p)) continue;
      for (let ax = 0; ax < 3; ax++) { if (h3(i, j, k, 10 + ax) > pm) continue; const ni = i + (ax === 0), nj = j + (ax === 1), nk = k + (ax === 2); if (nk > k1 || nj > j1 + 1) continue; const q = getP(ni, nj, nk); if (q[2] > 0.5 * A) continue; if (heroOut(p) || heroOut(q)) continue;
        if (ne >= maxE) break; ne++; const a = key(i, j, k), b = key(ni, nj, nk);
        if (!adj.has(a)) adj.set(a, []); if (!adj.has(b)) adj.set(b, []); adj.get(a).push({ to: b, ax, ei: key(i, j, k) + '>' + ax }); adj.get(b).push({ to: a, ax, ei: key(i, j, k) + '>' + ax }); }
    }
    // prune dead ends that are well inside the view (capillaries form loops)
    const interior = (kk) => { const p = pos.get(kk); const dx = p[0] - fx, dy = p[1] - fy; return dx * dx + dy * dy < R2 * 0.6 && p[1] < -A && -p[2] < depthMax - A; };
    for (let it = 0; it < 4; it++) { let ch = false; for (const [kk, l] of adj) if (l.length === 1 && interior(kk)) { const o = l[0].to, ol = adj.get(o); const ix = ol.findIndex((e) => e.ei === l[0].ei); if (ix >= 0) ol.splice(ix, 1); adj.delete(kk); ch = true; } if (!ch) break; }
    // trace chains between junctions
    const seen = new Set(), nuclei = [], pericytes = [], junc = [], edges = [], rbcRuns = [];
    const walk = (start, e0) => {
      const ids = [start]; let prev = start, cur = e0.to, ei = e0.ei; seen.add(ei); ids.push(cur);
      while (true) { const l = adj.get(cur); if (!l || l.length !== 2) break; const nx = l.find((e) => e.ei !== ei); if (!nx || seen.has(nx.ei)) break; seen.add(nx.ei); prev = cur; cur = nx.to; ei = nx.ei; ids.push(cur); if (ids.length > 24) break; }
      return ids;
    };
    const emit = (ids) => {
      const pts = []; let hh = 0; for (let q = 0; q < ids.length; q++) { const p = pos.get(ids[q]); hh += p[0] * 1e3 + p[1] * 7e2 + p[2] * 3e2; pts.push(p);
        if (q < ids.length - 1) { const a = p, b = pos.get(ids[q + 1]), u = Math.sin((a[0] * 1.7e5 + a[1] * 3.1e5) * 1.0) * 43758.5, v = Math.sin((a[1] * 2.3e5 + a[2] * 1.3e5) * 1.0) * 24634.6, w = Math.sin((a[2] * 2.9e5 + a[0] * 1.9e5)) * 31337.1;
          pts.push([(a[0] + b[0]) / 2 + ((u - Math.floor(u)) - 0.5) * 0.5 * A, (a[1] + b[1]) / 2 + ((v - Math.floor(v)) - 0.5) * 0.5 * A, (a[2] + b[2]) / 2 + ((w - Math.floor(w)) - 0.5) * 0.5 * A]); } }
      const hf = Math.abs(Math.sin(hh * 12.9898) * 43758.5453) % 1, r = rr * (0.82 + 0.36 * hf), h = far ? 12 * UM : 4.5 * UM;
      const path = addTube(M, T, pts, pts.map(() => r), sides, h, VCOL.cap, { open: true }); if (!path) return;
      let Lc = 0; const cum = new Float32Array(path.length); for (let q = 1; q < path.length; q++) { Lc += Math.hypot(path[q][0] - path[q - 1][0], path[q][1] - path[q - 1][1], path[q][2] - path[q - 1][2]); cum[q] = Lc; }
      const mid = path[path.length >> 1]; edges.push({ m: mid, r, len: Lc }); if (!far) rbcRuns.push({ path, cum, L: Lc, r, h: hf, dir: hf < 0.5 ? 1 : -1, s: 0.55 + hf });
      if (!far && hf < 0.16) pericytes.push([mid[0], mid[1], mid[2], r]);
      if (!far && hf > 0.62 && path.length > 6) { const a = path[(path.length * 0.4) | 0], b = path[((path.length * 0.4) | 0) + 1], dl = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1; nuclei.push([a[0], a[1], a[2], r, Math.abs((b[0] - a[0]) / dl) > Math.abs((b[1] - a[1]) / dl)]); }
    };
    for (const [kk, l] of adj) if (l.length !== 2) { if (l.length >= 3 && !far) { const p = pos.get(kk); junc.push([p[0], p[1], p[2]]); } for (const e of l) if (!seen.has(e.ei)) emit(walk(kk, e)); }
    for (const [kk, l] of adj) for (const e of l) if (!seen.has(e.ei)) emit(walk(kk, e)); // closed loops
    for (const p of junc) addSphere(M, rr * 1.08, 5, 8, VCOL.cap, p[0], p[1], p[2]);
    for (const nu of nuclei) addSphere(M, nu[3] * 1.0, 6, 9, [0.62, 0.30, 0.52], nu[0], nu[1], nu[2], nu[4] ? 2.1 : 0.85, nu[4] ? 0.85 : 2.1, 0.85);   // endothelial nucleus bulging the wall
    for (const pc of pericytes) addSphere(M, 4.4 * UM, 7, 10, VCOL.peri, pc[0], pc[1], pc[2], 1.5, 0.8, 1);
    if (this.cap.geometry) this.cap.geometry.dispose();
    this.cap.geometry = M.v ? M.toGeometry(T) : new T.BufferGeometry(); this.edges = edges; this.stats = { edges: ne, runs: edges.length };
    // red cells: ~1 per 22 um of lumen, spaced irregularly; they follow each run's own swept path
    if (!this.rbc) { this.rbc = new T.InstancedMesh(this.rbcGeo, this.matR, 3600); this.rbc.frustumCulled = false; this.g.add(this.rbc); }
    this.rbcList = []; if (!this.opts.noRbc && !far) for (const run of rbcRuns) { const n = Math.max(1, Math.round(run.L / (24 * UM) * (0.55 + 0.5 * run.h))); for (let q = 0; q < n && this.rbcList.length < 3300; q++) this.rbcList.push({ run, ph: (run.h * 5.1 + (q + 0.4 * Math.sin(q * 12.9 + run.h * 40)) / n) % 1 }); }
    // red cells in single-file lanes inside the penetrating arterioles (visible where the section plane slices them open)
    if (!this.opts.noRbc && !far) for (const a of this.art) { if (!a.pts || Math.abs(a.x - fx) > R * 1.3) continue; for (const lane of [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) {
      const pts = a.pts.map((p, i) => [p[0] + lane[0] * a.rad[i] * 0.8, p[1], p[2] + lane[1] * a.rad[i] * 0.8]); const cum = new Float32Array(pts.length); let Lc = 0; for (let q = 1; q < pts.length; q++) { Lc += Math.hypot(pts[q][0] - pts[q - 1][0], pts[q][1] - pts[q - 1][1], pts[q][2] - pts[q - 1][2]); cum[q] = Lc; }
      const run = { path: pts, cum, L: Lc, r: 3.4 * UM, h: a.ph, dir: 1, s: 3.2 }, n = Math.round(Lc / (17 * UM)); for (let q = 0; q < n && this.rbcList.length < 3400; q++) this.rbcList.push({ run, ph: (q + 0.35 * Math.sin(q * 7.7 + lane[0] * 9 + lane[1] * 5)) / n }); } }
    this.rbc.count = 0; this.rbc.visible = false;
  }
  update(t, z, W) {
    if (!this.rbc || !this.rbcList.length || z > -3.05) { if (this.rbc) this.rbc.visible = false; return; }
    const T = this.T, m = new T.Matrix4(), q = new T.Quaternion(), p = new T.Vector3(), s = new T.Vector3(), up = new T.Vector3(0, 1, 0), tg = new T.Vector3(), tg2 = new T.Vector3(); let n = 0;
    for (const o of this.rbcList) { const run = o.run, path = run.path, cum = run.cum; let u = (o.ph + run.dir * t * 22 * UM * run.s / run.L) % 1; if (u < 0) u += 1; const sd = u * run.L;
      let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] < sd) lo = mid; else hi = mid; } const a = path[lo], b = path[hi], f = (sd - cum[lo]) / Math.max(1e-12, cum[hi] - cum[lo]);
      p.set(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f); tg.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize(); if (run.dir < 0) tg.negate();
      { const d = tg.z, px2 = -tg.x * d, py2 = -tg.y * d, pz2 = 1 - d * d, pl = Math.hypot(px2, py2, pz2); if (pl > 0.3) { tg2.set(px2 / pl, py2 / pl, pz2 / pl); q.setFromUnitVectors(up, tg2); } else q.identity(); } const k = run.r * (run.s > 3 ? 1.0 : 0.92), ka = run.s > 3 ? k : k * 1.25; m.compose(p, q, s.set(k, ka, k)); this.rbc.setMatrixAt(n++, m); }
    this.rbc.count = n; this.rbc.instanceMatrix.needsUpdate = true; this.rbc.visible = n > 0;
  }
}
