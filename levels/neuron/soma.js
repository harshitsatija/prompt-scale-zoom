/* The cell body of a human pyramidal neuron (~20 um): membrane shell with flared dendrite roots and axon hillock, nucleus with envelope,
 * chromatin and nucleolus, rough ER (stacked ribosome-studded cisternae = Nissl bodies), Golgi stack with vesicles, mitochondria with cristae,
 * lipofuscin granules.  All in the neuron-local frame (micrometres, +y' = apical axis).  Organelle layout follows standard cell-biology references
 * (nucleus central, ER wrapping it, Golgi on the apical side of the nucleus, lipofuscin at the basal pole in aged cells). */
import { Builder, sweep, lathe, xform, basisFromDir, norm, cross, dot, rngf, gauss, fbm, ssm, TAU } from './geo.js';

export function somaBasis(axis) { const ey = norm(axis); let ex = norm(cross([0, 0, 1], ey)); if (Math.hypot(...cross([0, 0, 1], ey)) < 0.2) ex = norm(cross([1, 0, 0], ey)); const ez = cross(ex, ey); return { ex, ey, ez }; } // right-handed (a left-handed basis cannot be used as a quaternion rotation)

// radial field of the soma membrane: r(direction)
export function makeSomaField(model) {
  const { ex, ey, ez } = somaBasis(model.meta.axis);
  const roots = []; const { P, R, type, par, N } = model;
  for (let i = 0; i < N; i++) if (par[i] >= 0 && type[par[i]] === 1 && type[i] !== 1) { const d = norm(P[i]); roots.push({ d, r: R[i], type: type[i], node: i }); }
  const A = [9.0, 10.0, 8.0];
  const field = (d) => {
    const x = dot(d, ex), y = dot(d, ey), z = dot(d, ez);
    let r = 1 / Math.sqrt((x / A[0]) ** 2 + (y / A[1]) ** 2 + (z / A[2]) ** 2);
    r += 0.35 * (fbm(d[0] * 2.3 + 5, d[1] * 2.3, d[2] * 2.3, 3) - 0.5);          // gentle organic irregularity
    r += 1.4 * Math.max(0, y) ** 2 * 0.9;                                          // pyramidal apex
    for (const q of roots) { const c = dot(d, q.d); const sg = q.type === 4 ? 0.62 : q.type === 2 ? 0.34 : 0.42 + Math.min(0.2, q.r * 0.12); const amp = q.type === 4 ? 4.2 : q.type === 2 ? 1.9 : 0.7 + 1.5 * Math.min(1.5, q.r); r += amp * Math.exp(-(1 - c) / (0.5 * sg * sg)); }
    return r;
  };
  const ell = (d) => 1 / Math.sqrt((dot(d, ex) / A[0]) ** 2 + (dot(d, ey) / A[1]) ** 2 + (dot(d, ez) / A[2]) ** 2);
  return { field, roots, ell, A, basis: { ex, ey, ez } };
}

// a closed star-shaped shell around the origin: radius function over directions; smooth normals from the surface gradient
export function radialShell(T, fn, nLat, nLon, o = {}) {
  const B = new Builder(T), col = o.col || [1, 1, 1], uvs = o.uv || [3, 2], c0 = o.centre || [0, 0, 0];
  const pt = (d) => { const r = fn(d); return [d[0] * r, d[1] * r, d[2] * r, r]; };
  for (let i = 0; i <= nLat; i++) { const th = i / nLat * Math.PI; for (let j = 0; j <= nLon; j++) { const ph = j / nLon * TAU;
    const d = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]; const p = pt(d), r = p[3];
    // tangent basis
    const e1 = norm(cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), e2 = cross(d, e1); const eps = 0.02;
    const rd = (e) => { const dd = norm([d[0] + e[0] * eps, d[1] + e[1] * eps, d[2] + e[2] * eps]); return fn(dd); };
    const g1 = (rd(e1) - rd(e1.map((v) => -v))) / (2 * eps), g2 = (rd(e2) - rd(e2.map((v) => -v))) / (2 * eps);
    const nx = d[0] - (g1 * e1[0] + g2 * e2[0]) / r, ny = d[1] - (g1 * e1[1] + g2 * e2[1]) / r, nz = d[2] - (g1 * e1[2] + g2 * e2[2]) / r; const l = Math.hypot(nx, ny, nz);
    B.vert(c0[0] + p[0], c0[1] + p[1], c0[2] + p[2], nx / l, ny / l, nz / l, col[0], col[1], col[2], -1e4, j / nLon * uvs[0], i / nLat * uvs[1]); } }
  for (let i = 0; i < nLat; i++) for (let j = 0; j < nLon; j++) { const a = i * (nLon + 1) + j, b = a + 1, c = a + nLon + 1, d = c + 1; B.tri(a, c, b); B.tri(b, c, d); }
  // winding check is by construction: theta down, phi ccw seen from +y -> outward
  return B.geometry();
}

/* build the soma group. returns {group, flashMats:[...]} */
export function buildSoma(ctx, M, model, cutPlane) {
  const { T, kit } = ctx; const g = new T.Group();
  const { field, roots, basis, ell, A: somaA } = makeSomaField(model); const { ex, ey, ez } = basis;
  const cut = (m) => { m.clippingPlanes = [cutPlane]; return m; };
  const C = (hex) => new T.Color(hex);
  const R_ = rngf(77);
  const tb = (v) => [ex[0] * v[0] + ey[0] * v[1] + ez[0] * v[2], ex[1] * v[0] + ey[1] * v[1] + ez[1] * v[2], ex[2] * v[0] + ey[2] * v[1] + ez[2] * v[2]]; // soma-frame (x,y,z) -> neuron-local
  const fl = []; const lab = {};
  // ---------- membrane shell: outside = cream-teal membrane, inside = cytoplasm
  const sg = radialShell(T, field, 90, 160, { uv: [4, 3] });
  const mOut = cut(M.mat(0xf7caa6, { map: M.tex.membrane(), side: T.FrontSide, flash: true })); fl.push(mOut);
  const mIn = cut(M.mat(0xfff0d6, { map: M.tex.cyto(), side: T.BackSide, flash: true })); fl.push(mIn);
  const shellOut = new T.Mesh(sg, mOut), shellIn = new T.Mesh(sg, mIn); shellOut.frustumCulled = shellIn.frustumCulled = false; g.add(shellOut, shellIn);
  // ---------- nucleus (frame: soma coords)
  const fromHead = (v) => { const l = model.applyT(v); return [dot(l, ex), dot(l, ey), dot(l, ez)]; };   // head-frame offset (um) -> soma coordinates
  const nc = fromHead([0.4, -0.8, -0.5]), nR = [5.0, 5.4, 4.9];
  const nf = (d) => 1 / Math.sqrt((d[0] / nR[0]) ** 2 + (d[1] / nR[1]) ** 2 + (d[2] / nR[2]) ** 2) + 0.25 * (fbm(d[0] * 3 + 9, d[1] * 3, d[2] * 3 + 4, 3) - 0.5);
  const ng = radialShell(T, nf, 64, 112, { uv: [3, 2] });
  const nucG = new T.Group(); nucG.position.set(...tb(nc)); { const m = new T.Matrix4().makeBasis(new T.Vector3(...ex), new T.Vector3(...ey), new T.Vector3(...ez)); nucG.quaternion.setFromRotationMatrix(m); }
  const nEnvOut = cut(M.mat(0x9a93ee, { map: M.tex.envelope(), side: T.FrontSide })), nIn = cut(M.mat(0xe6e2ff, { map: M.tex.chromatin(), side: T.BackSide }));
  nucG.add(new T.Mesh(ng, nEnvOut), new T.Mesh(ng, nIn));
  // nucleolus (dense amber) + Cajal body
  const nuc = new T.Mesh(new T.SphereGeometry(1.0, 48, 32), cut(M.mat(0xffa83a, { map: M.tex.lipo(), side: T.DoubleSide }))); const npos = fromHead([1.5, 0.9, -1.7]); nuc.position.set(npos[0] - nc[0], npos[1] - nc[1], npos[2] - nc[2]); nucG.add(nuc);
  const nuc2 = new T.Mesh(new T.SphereGeometry(0.4, 24, 16), cut(M.mat(0xffcb80, { side: T.DoubleSide }))); { const q2 = fromHead([-2.6, -1.2, -1.2]); nuc2.position.set(q2[0] - nc[0], q2[1] - nc[1], q2[2] - nc[2]); } nucG.add(nuc2);
  // heterochromatin clumps against the envelope (instanced blobs inside)
  { const n = 70, im = kit.inst(new T.SphereGeometry(1, 14, 10), cut(M.mat(0x6c64d4, { side: T.DoubleSide })), n); for (let i = 0; i < n; i++) { const u = R_() * 2 - 1, ph = R_() * TAU, s = Math.sqrt(1 - u * u); const d = [s * Math.cos(ph), u, s * Math.sin(ph)]; const rr = nf(d) - 0.35 - R_() * 0.4; const sz = 0.35 + R_() * 0.55; kit.put(im, i, d[0] * rr, d[1] * rr, d[2] * rr, sz * 1.5, sz * 0.7, sz * 1.1, R_() * 3, R_() * 3, R_() * 3); } nucG.add(im); }
  g.add(nucG);
  const inNuc = (p) => { const q = [p[0] - nc[0], p[1] - nc[1], p[2] - nc[2]]; const l = Math.hypot(...q); return l < nf(q.map((v) => v / l)) + 0.6; };
  const inSoma = (p, m) => { const l = Math.hypot(...p); return l < field(p.map((v) => v / l)) - m; };
  // the section plane is (nearly) perpendicular to the view, i.e. along head-frame (-0.33,0,-0.94): organelles are placed in that back half-space so they are visible in the cut-away
  const vb = model.applyT([-0.33, 0, -0.94]); const back = (p, m) => dot(p, vb) > m;
  const sf = new T.Group(); sf.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(...ex), new T.Vector3(...ey), new T.Vector3(...ez))); g.add(sf);
  // ---------- rough ER: stacked ribosome-studded cisternae wrapping the nucleus (Nissl substance)
  { const B = new Builder(T); let made = 0, tries = 0;
    while (made < 15 && tries++ < 200) { const u = R_() * 2 - 1, ph = R_() * TAU, s = Math.sqrt(1 - u * u); let dn = [s * Math.cos(ph), u, s * Math.sin(ph)]; if (!back(tb(dn), 0.1)) continue; made++; if (made === 3) lab.er = tb([nc[0] + dn[0] * (nf(dn) + 1.2), nc[1] + dn[1] * (nf(dn) + 1.2), nc[2] + dn[2] * (nf(dn) + 1.2)]);
      const ang = 0.3 + R_() * 0.3, stack = 2 + Math.floor(R_() * 3), e1 = norm(cross(dn, Math.abs(dn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), e2 = cross(dn, e1), ro = R_() * TAU;
      for (let sh = 0; sh < stack; sh++) { const gap = 0.75 + sh * 0.42 + R_() * 0.08, G = 14, rot = ro + sh * 0.25, ax = ang * (0.95 + R_() * 0.5), ay = ang * (0.55 + R_() * 0.35);
        const grid = []; for (let a = 0; a <= G; a++) { const row = []; for (let b = 0; b <= G; b++) { let ua = (a / G * 2 - 1), ub = (b / G * 2 - 1); const rr0 = Math.hypot(ua, ub); const sh2 = rr0 > 0.001 ? Math.min(1, 1 / rr0) : 1; const rr = Math.min(rr0, 1); // square -> disc
              const u2 = ua * (rr0 > 1 ? 1 / rr0 : 1) * (1 - 0.08 * ssm(0.7, 1, rr)), v2 = ub * (rr0 > 1 ? 1 / rr0 : 1) * (1 - 0.08 * ssm(0.7, 1, rr));
              const aa = (u2 * Math.cos(rot) - v2 * Math.sin(rot)) * ax, bb = (u2 * Math.sin(rot) + v2 * Math.cos(rot)) * ay;
              const d = norm([dn[0] + e1[0] * aa + e2[0] * bb, dn[1] + e1[1] * aa + e2[1] * bb, dn[2] + e1[2] * aa + e2[2] * bb]); const rad = (nf(d) + gap) * (1 - 0.05 * rr * rr) + 0.2 * Math.sin(ua * 4 + sh) * Math.sin(ub * 3 + made);
              row.push({ p: [nc[0] + d[0] * rad, nc[1] + d[1] * rad, nc[2] + d[2] * rad], d, keep: rr0 <= 1.0 }); } grid.push(row); }
        const base = B.nv; for (let a = 0; a <= G; a++) for (let b = 0; b <= G; b++) { const q = grid[a][b]; B.vert(q.p[0], q.p[1], q.p[2], q.d[0], q.d[1], q.d[2], 1, 1, 1, -1e4, a / G * 1.2, b / G * 1.2); }
        for (let a = 0; a < G; a++) for (let b = 0; b < G; b++) { if (!(grid[a][b].keep && grid[a + 1][b].keep && grid[a][b + 1].keep && grid[a + 1][b + 1].keep)) continue; const i0 = base + a * (G + 1) + b, i1 = i0 + 1, i2 = i0 + G + 1, i3 = i2 + 1; B.tri(i0, i2, i1); B.tri(i1, i2, i3); } } }
    const er = new T.Mesh(B.geometry(), cut(M.mat(0x4fc3b3, { map: M.tex.er(), side: T.DoubleSide, inside: 0xb8efe3 }))); sf.add(er);
    // smooth ER tubules + vesicles + lysosomes in the cytoplasm
    const TB = new Builder(T); let nt = 0, tr2 = 0; while (nt < 26 && tr2++ < 400) { const c = [(R_() * 2 - 1) * 8, (R_() * 2 - 1) * 9, (R_() * 2 - 1) * 7]; const cl = tb(c); if (!inSoma(cl, 1.6) || inNuc(c) || !back(cl, 0.8)) continue; const d = norm([R_() - 0.5, R_() - 0.5, R_() - 0.5]); const pts = []; let q = c.slice(), dd = d; for (let k = 0; k < 9; k++) { pts.push(tb(q)); dd = norm([dd[0] + (R_() - 0.5) * 0.9, dd[1] + (R_() - 0.5) * 0.9, dd[2] + (R_() - 0.5) * 0.9]); q = [q[0] + dd[0] * 0.8, q[1] + dd[1] * 0.8, q[2] + dd[2] * 0.8]; } sweep(TB, pts, pts.map((p, i) => 0.1 + 0.02 * Math.sin(i)), { sides: 6, col: () => [1, 1, 1] }); nt++; }
    g.add(new T.Mesh(TB.geometry(), cut(M.mat(0x73d6c4, { side: T.DoubleSide }))));
    const NV = 130, vim = kit.inst(new T.SphereGeometry(1, 12, 8), cut(M.mat(0xfff0cf, { side: T.DoubleSide })), NV); let iv = 0, t3 = 0; while (iv < NV && t3++ < 2000) { const c = [(R_() * 2 - 1) * 9, (R_() * 2 - 1) * 10, (R_() * 2 - 1) * 8]; const cl = tb(c); if (!inSoma(cl, 0.8) || inNuc(c) || !back(cl, 0.6)) continue; const s = 0.1 + R_() * 0.17; kit.put(vim, iv++, cl[0], cl[1], cl[2], s); } vim.count = iv; g.add(vim);
    const NL = 14, lim = kit.inst(new T.SphereGeometry(1, 16, 12), cut(M.mat(0x7a55b8, { side: T.DoubleSide })), NL); iv = 0; t3 = 0; while (iv < NL && t3++ < 2000) { const c = [(R_() * 2 - 1) * 9, (R_() * 2 - 1) * 10, (R_() * 2 - 1) * 8]; const cl = tb(c); if (!inSoma(cl, 1.2) || inNuc(c) || !back(cl, 1.0)) continue; const s = 0.28 + R_() * 0.22; kit.put(lim, iv++, cl[0], cl[1], cl[2], s, s * 0.9, s); } lim.count = iv; g.add(lim); }
  // ---------- Golgi apparatus: a curved stack of flattened cisternae on the apical side of the nucleus, with budding vesicles
  { const B = new Builder(T); let gl = [0, 0, 0]; { const base = tb([-2.4, 7.0, 0.5]); const bv = dot(base, vb); const sh = Math.max(0, 3.4 - bv); gl = [base[0] + vb[0] * sh, base[1] + vb[1] * sh, base[2] + vb[2] * sh]; }
    // stack axis roughly pointing away from the nucleus, tilted so the cisternae are seen edge-on from the viewer
    const nloc = tb(nc); const away = norm([gl[0] - nloc[0], gl[1] - nloc[1], gl[2] - nloc[2]]); const sideV = cross(away, vb); const pj = away.map((v, i) => v - dot(away, vb) * vb[i]); const dirG = norm(pj); const [gx, gy, gz] = basisFromDir(dirG);
    for (let i = 0; i < 7; i++) { const Rr = 2.5 - Math.abs(i - 3) * 0.12 - i * 0.05, off = (i - 3) * 0.34; const n = 16, lens = []; const profT = (r) => 0.1 + 0.07 * Math.exp(-Math.pow((r - Rr * 0.95) / 0.35, 2)) * 1.0; // fenestrated rims are bulbous
      for (let k = 0; k <= n; k++) { const r = k / n * Rr; lens.push([r, (r * r) * 0.11 - profT(r) * 0.5]); } for (let k = n; k >= 0; k--) { const r = k / n * Rr; lens.push([r, (r * r) * 0.11 + profT(r) * 0.5]); }
      lathe(B, lens, 36, xform([gl[0] + dirG[0] * off, gl[1] + dirG[1] * off, gl[2] + dirG[2] * off], gx, gy, gz), { col: [1, 1, 1] }); }
    lab.golgi = gl.slice();
    g.add(new T.Mesh(B.geometry(), cut(M.mat(0xe0709a, { side: T.DoubleSide, inside: 0xffc2d6 }))));
    const nV = 52, vim = kit.inst(new T.SphereGeometry(1, 12, 8), cut(M.mat(0xffc9a8, { side: T.DoubleSide })), nV); for (let i = 0; i < nV; i++) { const a = R_() * TAU, h = (R_() - 0.3) * 3.4, rr = 2.0 + R_() * 1.8, s = 0.1 + R_() * 0.14; const q = [gl[0] + gx[0] * Math.cos(a) * rr + gz[0] * Math.sin(a) * rr + dirG[0] * h, gl[1] + gx[1] * Math.cos(a) * rr + gz[1] * Math.sin(a) * rr + dirG[1] * h, gl[2] + gx[2] * Math.cos(a) * rr + gz[2] * Math.sin(a) * rr + dirG[2] * h]; kit.put(vim, i, q[0], q[1], q[2], s); } g.add(vim); }
  // ---------- mitochondria (bent sausages with cristae)
  { const B = new Builder(T); const placed = []; let tries = 0;
    while (placed.length < 90 && tries++ < 4000) { const c = [(R_() * 2 - 1) * 8.5, (R_() * 2 - 1) * 9.5, (R_() * 2 - 1) * 7.5]; const L = 0.8 + R_() * R_() * 2.4 + R_() * 0.5; const cl = tb(c); if (!inSoma(cl, 1.4 + L * 0.3) || inNuc(c) || !back(cl, 0.9)) continue; if (placed.some((p) => Math.hypot(c[0] - p[0], c[1] - p[1], c[2] - p[2]) < 1.05 + 0.2 * L)) continue; placed.push([...c, L]); }
    if (placed.length) { let bi = 0, bd = 1e9; placed.forEach((q, i) => { const d = dot(tb(q.slice(0, 3)), vb); if (d < bd) { bd = d; bi = i; } }); lab.mito = tb(placed[bi].slice(0, 3)); }
    for (const [cx, cy, cz, L] of placed) { const d = norm([R_() - 0.5, R_() - 0.5, R_() - 0.5]), [ax, ay, az] = basisFromDir(d); const bend = (R_() - 0.5) * 1.6, pts = [], rad = []; const r0 = 0.17 + R_() * 0.1; const n = 10;
      for (let i = 0; i <= n; i++) { const t = i / n - 0.5; const q = [cx + d[0] * t * L + az[0] * bend * (0.25 - t * t) * L * 0.8, cy + d[1] * t * L + az[1] * bend * (0.25 - t * t) * L * 0.8, cz + d[2] * t * L + az[2] * bend * (0.25 - t * t) * L * 0.8]; pts.push(tb(q)); rad.push(r0 * (0.6 + 0.4 * Math.sqrt(Math.max(0.0, 1 - Math.pow(Math.abs(t) * 2, 4))))); }
      sweep(B, pts, rad, { sides: 12, col: () => [1, 1, 1], vscale: 1 / 0.8, capEnd: true }); }
    const mm = new T.Mesh(B.geometry(), cut(M.mat(0xf0bd90, { map: M.tex.cristae(), side: T.DoubleSide }))); g.add(mm); }
  // ---------- lipofuscin granules (aged human neurons accumulate them at the basal pole)
  { const n = 22, geo = new T.IcosahedronGeometry(1, 2), im = kit.inst(geo, cut(M.mat(0xb07a45, { map: M.tex.lipo(), side: T.DoubleSide })), n);
    const cl = [[3.5, -6.4, 2.0], [-4.2, -5.0, -3.0], [4.8, -2.5, -4.6]]; let i = 0; for (const c of cl) { let q0 = tb(c); const sh = Math.max(0, 2.2 - dot(q0, vb)); q0 = [q0[0] + vb[0] * sh, q0[1] + vb[1] * sh, q0[2] + vb[2] * sh]; for (let k = 0; k < 7 && i < n; k++, i++) { const q = [q0[0] + gauss(R_) * 0.8, q0[1] + gauss(R_) * 0.7, q0[2] + gauss(R_) * 0.8]; const s = 0.3 + R_() * 0.35; kit.put(im, i, q[0], q[1], q[2], s * 1.2, s, s * 1.1, R_() * 3, R_() * 3, 0); } }
    im.count = i; g.add(im); }
  // ---------- ribosomes / polysomes: tiny dark dots scattered through the cytoplasm
  { const n = 420, im = kit.inst(new T.SphereGeometry(1, 8, 6), cut(M.mat(0x5a52c4, { side: T.DoubleSide })), n); let i = 0; let tr = 0; while (i < n && tr++ < 8000) { const c = [(R_() * 2 - 1) * 9, (R_() * 2 - 1) * 10, (R_() * 2 - 1) * 8]; const q = tb(c); if (!inSoma(q, 0.8) || inNuc(c) || !back(q, 0.4)) continue; const s = 0.07 + R_() * 0.05; kit.put(im, i++, q[0], q[1], q[2], s); } im.count = i; g.add(im); }
  g.traverse((o) => { o.frustumCulled = false; });
  { lab.nucleolus = tb(fromHead([1.5, 0.9, -1.7])); const hd = model.applyT(norm([0.9, 0.45, -0.1])); const d = norm([dot(hd, ex), dot(hd, ey), dot(hd, ez)]); lab.nucleus = tb([nc[0] + d[0] * nf(d), nc[1] + d[1] * nf(d), nc[2] + d[2] * nf(d)]); }
  return { group: g, field, ell, A: somaA, roots, basis, flashMats: fl, tb, lab };
}
