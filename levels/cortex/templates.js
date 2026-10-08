/* cortex/templates.js: build the "hero" cell templates (real reconstructions) at two levels of detail, with the apical trunk fitted so each
 * pyramidal cell's tuft really ends in layer I from its own layer. Everything in metres, soma at origin, +Y = toward the pia. */
import { radii, chains, addTube, addSoma, addSphere, Mesh3 } from './morph.js';
const UM = 1e-6;
const hex = (T, h) => { const c = new T.Color(h); return [c.r, c.g, c.b]; };

/** returns a modified copy of cell.X (Float32Array n*4, um) with uniform scale s and the apical trunk stretched so the apical tip sits `dTarget` um above the soma */
function fitCell(cell, s, tipTarget) {
  const n = cell.n, X = new Float32Array(cell.X), loc = (k) => (cell.P[k] >= 0 ? cell.P[k] - cell.off : -1);
  for (let k = 0; k < n; k++) { X[k * 4] *= s; X[k * 4 + 1] *= s; X[k * 4 + 2] *= s; }
  let tip = -1e9; for (let k = 0; k < n; k++) if (cell.Ty[k] === 4) tip = Math.max(tip, X[k * 4 + 1]);
  if (tipTarget === undefined || tip < 0) return { X, tip };
  const delta = tipTarget - tip; if (Math.abs(delta) < 3) return { X, tip };
  // trunk: from the soma along the apical child with most descendants, until the first real bifurcation
  const kids = Array.from({ length: n }, () => []); for (let k = 0; k < n; k++) { const p = loc(k); if (p >= 0) kids[p].push(k); }
  const nt = new Float32Array(n); for (let k = n - 1; k >= 0; k--) { if (kids[k].length === 0) nt[k] = 1; const p = loc(k); if (p >= 0) nt[p] += nt[k]; }
  let root = -1, best = -1; for (let k = 0; k < n; k++) if (cell.Ty[k] === 4 && (loc(k) < 0 || cell.Ty[loc(k)] === 1) && nt[k] > best) { best = nt[k]; root = k; }
  if (root < 0) return { X, tip };
  const trunk = [root]; let k = root; for (;;) { const ks = kids[k].filter((c) => cell.Ty[c] === 4).sort((a, b) => nt[b] - nt[a]); if (!ks.length) break; if (ks.length > 1 && nt[ks[1]] >= 0.3 * nt[ks[0]] && X[k * 4 + 1] > 80 * s) break; k = ks[0]; trunk.push(k); }
  const cum = [0]; for (let i = 1; i < trunk.length; i++) { const a = trunk[i - 1] * 4, b = trunk[i] * 4; cum.push(cum[i - 1] + Math.hypot(X[b] - X[a], X[b + 1] - X[a + 1], X[b + 2] - X[a + 2])); }
  const L = cum[cum.length - 1] || 1, fr = new Map(trunk.map((t, i) => [t, cum[i] / L]));
  // limit compression so the trunk never inverts
  const dl = Math.max(delta, -0.7 * L);
  const att = new Float32Array(n); for (let q = 0; q < n; q++) { if (fr.has(q)) att[q] = fr.get(q); else { const p = loc(q); att[q] = p >= 0 && cell.Ty[q] !== 1 ? att[p] : 0; } }
  // the trunk is not exactly vertical: shift along the local y only (keeps apical alignment)
  for (let q = 0; q < n; q++) if (cell.Ty[q] !== 1) X[q * 4 + 1] += dl * att[q];
  return { X, tip: tip + dl };
}

/** build geometry parts. opts: {far, kind, somaR (um), cols} */
function buildGeo(T, cell, X, kind, far, cols, mid) {
  const M = new Mesh3(), c2 = Object.assign({}, cell, { X });
  const r = radii(c2, kind === 'pyr' ? { rtip: 0.3, ex: 0.43, cap: 3.3, axon: 0.45 } : kind === 'int' ? { rtip: 0.27, ex: 0.4, cap: 2.4, axon: 0.3 } : kind === 'astro' ? { rtip: 0.2, ex: 0.46, cap: 1.9 } : kind === 'micro' ? { rtip: 0.22, ex: 0.4, cap: 1.2 } : { rtip: 0.28, ex: 0.4, cap: 1.0 });
  const sides = far ? 3 : mid ? 5 : kind === 'astro' ? 8 : 10, h = (far ? 16 : mid ? 6 : 0.9) * UM;
  const rmin = far ? 0.5 : mid ? 0.34 : 0;
  const hasKid = new Uint8Array(c2.n); for (let k = 0; k < c2.n; k++) { const pk = c2.P[k] >= 0 ? c2.P[k] - c2.off : -1; if (pk >= 0) hasKid[pk] = 1; }
  for (const ch of chains(c2)) {
    const ty = c2.Ty[ch[1]]; if ((far || (mid && kind === 'pyr')) && ty === 2) continue;
    const i1 = ch[1]; const rs0 = r[ch[0]], rc = r[i1]; if (r[ch[ch.length - 1]] < 0.01) continue;
    if ((far || mid) && Math.max(rc, rs0 * 0.5) < rmin) continue;
    let pts = ch.map((i) => [X[i * 4] * UM, X[i * 4 + 1] * UM, X[i * 4 + 2] * UM]);
    if (!far && c2.Ty[ch[0]] === 1 && (kind === 'pyr' || kind === 'int')) { // start the process at the cell membrane, not at the soma centre (cut-open cells would otherwise show a tube running through the nucleus)
      const Rs = (kind === 'pyr' ? Math.min(8.2, Math.max(5.4, cell.somaR * 0.82)) : Math.min(6.6, Math.max(4.6, cell.somaR * 0.72))) * UM, nd = (p) => Math.hypot(p[0] / Rs, p[1] / (Rs * (kind === 'pyr' ? (p[1] > 0 ? 2.0 : 1.2) : 1)), p[2] / Rs);
      let k0 = 0; while (k0 < pts.length - 2 && nd(pts[k0 + 1]) < 0.95) k0++;
      if (k0 > 0 || nd(pts[0]) < 0.9) { const a = pts[k0], b = pts[k0 + 1], da = nd(a), db = nd(b), f = db > da ? Math.min(1, Math.max(0, (0.95 - da) / (db - da))) : 0; pts = [[a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]].concat(pts.slice(k0 + 1)); } }
    const wd = far ? 2.4 : 1; const nCh = ch.length, leaf = !hasKid[ch[nCh - 1]]; const rad = ch.map((i, j) => (j === 0 ? Math.min(rs0, rc * 1.5) : r[i]) * UM * wd * (leaf && ty === 2 ? (j === nCh - 1 ? 0.22 : j === nCh - 2 ? 0.7 : 1) : 1));   // truncated axon ends taper to a fine tip instead of stopping as a cut tube
    const col = ty === 2 ? cols.axon : cols.dend;
    if (pts.length === 2 && Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]) < 0.3 * UM) continue;
    if (!far && !mid && rad[0] > 0.2 * UM && ty !== 2) addSphere(M, rad[0] * 1.02, 6, 9, col, pts[0][0], pts[0][1], pts[0][2]);   // rounded branch point: no open elbow
    addTube(M, T, pts, rad, sides, h, col, { flare: 0.35, bead: ty === 2 && kind === 'int' ? 0.9 : 0, beadL: 2.2 * UM, phase: i1 * 0.7 });
  }
  const rsd = kind === 'pyr' ? Math.min(8.2, Math.max(5.4, cell.somaR * 0.82)) : kind === 'int' ? Math.min(6.6, Math.max(4.6, cell.somaR * 0.72)) : kind === 'astro' ? 5.8 : kind === 'micro' ? 4.2 : 5.0;
  const lat = far ? 6 : mid ? 10 : 26, lon = far ? 8 : mid ? 14 : 36;
  addSoma(M, rsd * UM, kind === 'pyr' ? 'pyr' : 'round', lat, lon, cols.soma);
  if (!far || kind === 'pyr') addSphere(M, rsd * UM * (kind === 'pyr' ? 0.64 : 0.66), far ? 5 : mid ? 8 : 10, far ? 7 : mid ? 11 : 14, cols.nuc, 0, kind === 'pyr' ? -0.08 * rsd * UM : 0, 0);
  if (!far && !mid && (kind === 'pyr' || kind === 'int')) addSphere(M, rsd * UM * 0.14, 6, 8, cols.nucleolus, rsd * UM * 0.10, 0.0, rsd * UM * 0.06);
  if (!far && !mid) { // near: perikaryon texture (Nissl mottling), organelles, dendritic spines
    const R = rsd * UM, rr = (() => { let a = (cell.id * 2654435761) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
    if (kind === 'pyr' || kind === 'int') {
      const nm = kind === 'pyr' ? 0.5 : 0.52;   // nuclear radius fraction (R-relative) used for organelle placement outside the nucleus
      const nB = kind === 'pyr' ? 34 : 26;
      for (let q = 0; q < nB; q++) { // mitochondria: short rods in the perikaryon
        let x, y, z, d; do { x = (rr() * 2 - 1); y = (rr() * 2 - 1) * 1.4; z = (rr() * 2 - 1); d = Math.hypot(x, y / 1.3, z); } while (d > 0.88 || d < 0.72 * nm + 0.3);
        addSphere(M, R * 0.06, 8, 12, kind === 'pyr' ? [0.80, 0.50, 0.38] : [0.30, 0.62, 0.55], x * R * 0.92, y * R * 0.92, z * R * 0.92, 2.4, 0.85, 0.85); }
      for (let q = 0; q < 70; q++) { // Nissl granules (rough ER ribosome clusters)
        let x, y, z, d; do { x = (rr() * 2 - 1); y = (rr() * 2 - 1) * 1.4; z = (rr() * 2 - 1); d = Math.hypot(x, y / 1.3, z); } while (d > 0.9 || d < 0.7);
        addSphere(M, R * 0.035, 6, 8, kind === 'pyr' ? [0.50, 0.28, 0.46] : [0.15, 0.4, 0.38], x * R * 0.95, y * R * 0.95, z * R * 0.95); }
    }
    // surface mottling on the cytoplasm: smooth value noise multiplies the vertex colour (no flat two-tone blob)
    const hsh = (i, j, k) => { let h = (i * 374761393 + j * 668265263 + k * 2147483647 + 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const vn3 = (x, y, z) => { const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = x - i, fy = y - j, fz = z - k, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz); const L = (a, b, c) => hsh(i + a, j + b, k + c); const m = (a, b, t) => a + (b - a) * t; return m(m(m(L(0, 0, 0), L(1, 0, 0), u), m(L(0, 1, 0), L(1, 1, 0), u), v), m(m(L(0, 0, 1), L(1, 0, 1), u), m(L(0, 1, 1), L(1, 1, 1), u), v), w); };
    const sr = R * 1.5; // vertices within the soma bounding region get mottled (dendrites are thin: leave them)
    for (let v = 0; v < M.v; v++) { const x = M.p[v * 3], y = M.p[v * 3 + 1], z = M.p[v * 3 + 2]; if (Math.abs(x) < sr && Math.abs(y) < sr * 1.9 && Math.abs(z) < sr && Math.hypot(x, y, z) < R * 2.4) { const k = 0.82 + 0.34 * (0.6 * vn3(x / (R * 0.45), y / (R * 0.45), z / (R * 0.45)) + 0.4 * vn3(x / (R * 0.18) + 7, y / (R * 0.18), z / (R * 0.18))); M.c[v * 3] *= k; M.c[v * 3 + 1] *= k; M.c[v * 3 + 2] *= k * (1.05 - 0.05 * k); } }
    // dendritic spines: thin neck + head, thousands per cell in life; here on the finer dendrites within ~160 um of the soma (pyramidal cells only)
    if (kind === 'pyr') { let ns = 0; const maxS = 1700, sp = 1.25 * UM;
      for (const ch of chains(c2)) { const ty = c2.Ty[ch[1]]; if (ty === 2 || ty === 1) continue; if (r[ch[ch.length - 1]] > 0.62 || r[ch[0]] > 1.5) continue;
        let acc = 0; for (let j = 1; j < ch.length && ns < maxS; j++) { const a = ch[j - 1], b = ch[j], ax = X[a * 4] * UM, ay = X[a * 4 + 1] * UM, az = X[a * 4 + 2] * UM, bx = X[b * 4] * UM, by = X[b * 4 + 1] * UM, bz = X[b * 4 + 2] * UM, L = Math.hypot(bx - ax, by - ay, bz - az); if (L < 1e-9) continue; if (Math.hypot(ax, ay, az) > 160 * UM) break;
          const tx = (bx - ax) / L, ty2 = (by - ay) / L, tz = (bz - az) / L; let e = sp - acc; while (e < L && ns < maxS) { const f = e / L, px = ax + (bx - ax) * f, py = ay + (by - ay) * f, pz = az + (bz - az) * f, th = rr() * 6.2832;
              // any vector perpendicular to the dendrite
              let ux = -tz, uy = 0, uz = tx; let ul = Math.hypot(ux, uy, uz); if (ul < 1e-3) { ux = 0; uy = tz; uz = -ty2; ul = Math.hypot(ux, uy, uz) || 1; } ux /= ul; uy /= ul; uz /= ul; const wx = ty2 * uz - tz * uy, wy = tz * ux - tx * uz, wz = tx * uy - ty2 * ux;
              const dx = Math.cos(th) * ux + Math.sin(th) * wx, dy = Math.cos(th) * uy + Math.sin(th) * wy, dz = Math.cos(th) * uz + Math.sin(th) * wz, rd = r[b] * UM, nl = (0.5 + 0.7 * rr()) * UM;
              const hx = px + dx * (rd + nl), hy = py + dy * (rd + nl), hz = pz + dz * (rd + nl);
              addTube(M, T, [[px + dx * rd * 0.6, py + dy * rd * 0.6, pz + dz * rd * 0.6], [hx, hy, hz]], [0.11 * UM, 0.09 * UM], 4, 0, cols.dend, { open: true });
              addSphere(M, 0.2 * UM, 4, 6, cols.dend, hx + dx * 0.1 * UM, hy + dy * 0.1 * UM, hz + dz * 0.1 * UM, 1, 1, 1); ns++; e += sp * (0.6 + 0.8 * rr()); }
          acc = (acc + L) % sp; } } }
  }
  const g = M.toGeometry(T); g.userData.somaR = rsd * UM; return g;
}

/** variants: [{id, cls, D (mm depth the soma sits at), somaK}] -> templates */
export function buildTemplates(ctx, morphs) {
  const { T } = ctx, byId = new Map(morphs.map((m) => [m.id, m]));
  const PAL = { pyr: { soma: hex(T, 0xf4c7a1), dend: hex(T, 0xe2ab92), axon: hex(T, 0xfff0d2), nuc: hex(T, 0xd49c88), nucleolus: hex(T, 0x6a2e52) },
    int: { soma: hex(T, 0x6fd9bd), dend: hex(T, 0x37b9a0), axon: hex(T, 0x9be8d2), nuc: hex(T, 0x3fa595), nucleolus: hex(T, 0x0a3a36) },
    astro: { soma: hex(T, 0xc9b6ff), dend: hex(T, 0xa88cf0), axon: hex(T, 0xa88cf0), nuc: hex(T, 0x8d74d8), nucleolus: hex(T, 0x3a2a80) },
    micro: { soma: hex(T, 0xff8f98), dend: hex(T, 0xf0707e), axon: hex(T, 0xf0707e), nuc: hex(T, 0xd9606e), nucleolus: hex(T, 0x6a1a30) },
    oligo: { soma: hex(T, 0xbfeee3), dend: hex(T, 0xa8e0d3), axon: hex(T, 0xa8e0d3), nuc: hex(T, 0x5fb8a8), nucleolus: hex(T, 0x1a4a42) } };
  const PYR = [ // [morph id, soma depth mm, uniform scale]
    [102568, 0.27, 0.85], [102588, 0.31, 0.9], [102567, 0.36, 0.95], [102579, 0.5, 1.0], [102566, 0.58, 1.0], [102589, 0.68, 1.0],
    [102562, 0.86, 1.0], [102565, 0.98, 1.05], [102593, 1.08, 1.1], [102563, 1.16, 1.0], [102564, 1.24, 1.05], [102575, 1.38, 1.0],
    [102592, 1.78, 1.25], [102559, 1.9, 1.3], [102563, 1.98, 1.25], [102560, 2.32, 1.0], [102575, 2.46, 0.95], [102586, 2.58, 0.95]];
  const out = [];
  const mk = (id, kind, D, s, name) => { const cell = byId.get(id); if (!cell) return; let fit;
    if (kind === 'pyr') { fit = fitCell(cell, s, D * 1e3 - 45); } else fit = fitCell(cell, s);
    const cols = PAL[kind]; const geoFar = buildGeo(T, cell, fit.X, kind, true, cols), geoMid = buildGeo(T, cell, fit.X, kind, false, cols, true); let geoNear = null; const getNear = () => (geoNear || (geoNear = buildGeo(T, cell, fit.X, kind, false, cols)));
    let bx = 0, bz = 0, by = 1e9, bY = -1e9; for (let k = 0; k < cell.n; k++) { bx = Math.max(bx, Math.abs(fit.X[k * 4])); bz = Math.max(bz, Math.abs(fit.X[k * 4 + 2])); by = Math.min(by, fit.X[k * 4 + 1]); bY = Math.max(bY, fit.X[k * 4 + 1]); }
    let axAz = 0; for (let k = 0; k < cell.n; k++) if (cell.Ty[k] === 2) { const pk = cell.P[k] >= 0 ? cell.P[k] - cell.off : -1; if (pk < 0 || cell.Ty[pk] === 1) { axAz = Math.atan2(fit.X[k * 4], fit.X[k * 4 + 2]); break; } }   // azimuth of the axon's root (so a showcase cell can be turned with its axon hidden behind the soma)
    out.push({ id, kind, D, axAz, getNear, geoFar, geoMid, somaR: geoMid.userData.somaR, extent: { x: bx * UM, z: bz * UM, ymin: by * UM, ymax: bY * UM }, name }); };
  for (const [id, D, s] of PYR) mk(id, 'pyr', D, s, 'pyramidal');
  for (const id of [102403, 102405, 102587, 102595, 102599, 102577]) mk(id, 'int', 1.0, 1.0, 'interneuron');
  for (const id of [104770, 117262, 117267]) mk(id, 'astro', 1.0, 1.0, 'astrocyte');
  for (const id of [106334, 106336]) mk(id, 'micro', 1.0, 1.0, 'microglia');
  for (const id of [131077, 131078]) mk(id, 'oligo', 1.0, 1.0, 'oligodendrocyte');
  return out;
}
