/* The hero synapse at neuron scale (head frame, um) -- must agree with the synapse level: cleft centre S = Hn + (35, -5+2.36) um, bouton above (+y),
 * mushroom spine below with head centre 0.35 um under the cleft, dendrite shaft along x with axis 2.36 um below S (r = 0.7 um).
 * Plus presynaptic boutons (with their axon strands) on a few dozen neighbouring spines of the hero dendrites. */
import { Builder, sweep, lathe, xform, ellipsoid, basisFromDir, norm, cross, rngf, TAU, ssm } from './geo.js';

export function buildHero(ctx, M, model, A, cutN, tree, spines) {
  const { T, kit } = ctx; const D = model.D;
  // when the synapse level is loaded it draws the molecular detail of this very spine; the neuron level then keeps only the matching envelope
  const solo = (() => { const o = ctx.params && ctx.params.get('only'); return !!o && !o.split(',').includes('synapse'); })(); // shaft axis point (head frame, um) relative to the soma
  const group = new T.Group(), nGroup = new T.Group(); const cut = (m) => { m.clippingPlanes = [cutN]; return m; };
  const cleftY = D[1] + 2.36, SC = 0.97;              // our copy is 3 % smaller so it sits just inside the synapse level's own spine (no z-fighting)
  // ---- spine (mushroom): neck from the shaft top to a flattened head whose top face is the postsynaptic density
  const B = new Builder(T); const yH = cleftY - 0.35, rxz = 0.38 * SC, ry = (0.35 - 0.011) * SC, yb = D[1] + 0.45;
  const prof = [[0.52, yb - 0.08], [0.38, yb + 0.08], [0.26, yb + 0.24], [0.185, yb + 0.4], [0.135, yb + 0.56], [0.118, yb + 0.85], [0.13, yH - ry * 0.97 - 0.05]];
  const ph0 = -Math.asin(0.62); for (let k = 0; k <= 64; k++) { const ph = ph0 + (Math.PI / 2 - ph0) * k / 64; const c = Math.cos(ph), s = Math.sin(ph); const xr = ph > 0 ? Math.pow(c, 0.64) : c, yr = ph > 0 ? Math.pow(s, 0.64) : s; prof.push([Math.max(0, rxz * xr), yH + ry * yr]); } prof[prof.length - 1][0] = 0;   // flattened head top (superellipse) = the face that carries the PSD
  // head-underside fillet: ensure neck meets head radius
  const sp = new T.Group(); const bend = 0.0;
  lathe(B, prof, 96, xform([D[0], 0, D[2]], [1, 0, 0], [0, 1, 0], [0, 0, 1]), { col: [1, 1, 1], au: (i) => -0.2 - (prof.length - i) * 0.1 });
  const mSp = cut(M.mat(0xe6ae92, { side: T.DoubleSide, sig: true, inside: 0xdc9a74 })); const spineMesh = new T.Mesh(B.geometry(), mSp); spineMesh.frustumCulled = false; group.add(spineMesh);
  // ---- presynaptic bouton: a swelling of a thin axon with a FLAT contact face against the spine head (the active zone), rounded sides and dome
  const y0 = cleftY + 0.011; const BB = new Builder(T), cB = new T.Color(0x1f9a8a), cb = [cB.r, cB.g, cB.b];
  const bpr = new T.CatmullRomCurve3([[0.001, 0], [0.24, 0], [0.37, 0.014], [0.49, 0.07], [0.575, 0.16], [0.615, 0.28], [0.595, 0.41], [0.51, 0.54], [0.37, 0.64], [0.19, 0.71], [0.001, 0.735]].map((p) => new T.Vector3(p[0], p[1], 0)), false, 'centripetal').getPoints(70).map((v) => [v.x, v.y]);
  const rAtY = (y) => { let r = 0; for (let i = 1; i < bpr.length; i++) { const a = bpr[i - 1], b = bpr[i]; if ((a[1] - y) * (b[1] - y) <= 0 && Math.abs(b[1] - a[1]) > 1e-6) r = Math.max(r, a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1])); } return r; };
  lathe(BB, bpr, 96, xform([D[0] + 0.02, y0, D[2]], [1, 0, 0], [0, 1, 0], [0, 0, 1]), { col: cb });
  // axon continuation: leaves the bouton up and to the left (same heading as the synapse level's axon, flattening to horizontal), then runs on as a thin axon
  const path = []; { let p = [D[0] - 0.45, y0 + 0.5, D[2] - (solo ? 0.3 : 0.05)]; for (let i = 0; i < 48; i++) { path.push(p.slice()); const ang = 0.5 * (1 - Math.min(1, i * 0.5 / 7)) + 0.05 * Math.sin(i * 0.23); p = [p[0] - Math.cos(ang) * 0.5, p[1] + Math.sin(ang) * 0.5, p[2] + (solo ? -0.03 : 0.0)]; } }
  const BS = new Builder(T); sweep(BS, path, path.map((p, i) => 0.15 + 0.025 * Math.sin(i * 0.8) * (i > 3 ? 1 : 0) + 0.12 * Math.exp(-i / 1.5)), { sides: 14, col: () => cb });
  { const mS = cut(M.mat(0xffffff, { vc: true, side: T.DoubleSide, inside: 0x2bb5a5 })); group.add(Object.assign(new T.Mesh(BS.geometry(), mS), { frustumCulled: false })); }
  const mB = cut(M.mat(0xffffff, { vc: true, side: T.DoubleSide, inside: 0x2bb5a5 })); mB.emissive = new T.Color(0xff9f1c); mB.emissiveIntensity = 0;
  const bMesh = new T.Mesh(BB.geometry(), mB); bMesh.frustumCulled = false; group.add(bMesh);
  // ---- solo-only fine structure: synaptic vesicles, a presynaptic mitochondrion, the postsynaptic density and a cleft glow
  let vimKey = ''; let cleftHalo = null; const vimPos = []; let vimRef = null; const vimR = [];
  const plate = (R, h, tint) => { const prof = []; const n = 10; prof.push([0.001, -h]); prof.push([R - h * 1.4, -h]); for (let k = 1; k < n; k++) { const a = -Math.PI / 2 + k / n * Math.PI; prof.push([R - h * 1.4 + h * 1.4 * Math.cos(a), h * Math.sin(a) * 1.0]); } prof.push([R - h * 1.4, h]); prof.push([0.001, h]); return prof; };
  if (solo) {
    const bc = [D[0] + 0.02, y0, D[2]]; const Rv = rngf(404);
    const NV = 380, vim = kit.inst(new T.SphereGeometry(1, 20, 14), cut(M.mat(0xd9ccf4, { side: T.FrontSide, rim: false })), NV); let nv = 0, tr = 0;
    const mito = { c: [bc[0] - 0.2, y0 + 0.43, bc[2] - 0.05], a: 0.2, b: 0.085 };
    while (nv < NV && tr++ < 60000) { const y = 0.05 + Rv() * 0.65; if (Rv() > 0.3 + 0.7 * Math.exp(-y / 0.2)) continue; const rm = rAtY(y) - 0.04; if (rm < 0.05) continue; const a = Rv() * TAU, rr = rm * Math.sqrt(Rv()); const p = [bc[0] + Math.cos(a) * rr, bc[1] + y, bc[2] + Math.sin(a) * rr];
      if (Math.hypot((p[0] - mito.c[0]) / (mito.a + 0.05), (p[1] - mito.c[1]) / (mito.b + 0.05), (p[2] - mito.c[2]) / (mito.b + 0.05)) < 1) continue;
      const r = 0.02 + Rv() * 0.0035; if (vimPos.some((q, j) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < r + vimR[j] + 0.006)) continue; vimPos.push(p); vimR.push(r); kit.put(vim, nv++, p[0], p[1], p[2], r); }
    vim.count = nv; group.add(vim); vimRef = vim;
    const MB = new Builder(T); { const pts = [], rad = []; for (let i = 0; i <= 12; i++) { const t = i / 12 * 2 - 1; pts.push([mito.c[0] + t * mito.a, mito.c[1] + 0.02 * (1 - t * t), mito.c[2]]); rad.push(Math.max(0.03, mito.b * Math.sqrt(Math.max(0, 1 - Math.pow(t, 4))))); } sweep(MB, pts, rad, { sides: 16, col: () => [1, 1, 1], vscale: 1 / 0.2 }); }
    group.add(Object.assign(new T.Mesh(MB.geometry(), cut(M.mat(0xffc58a, { map: M.tex.cristae(), side: T.DoubleSide }))), { frustumCulled: false }));
    // post-synaptic density (dense plate under the cleft, rounded rim) + presynaptic active-zone grid (thin, lighter) -- one plate each side of the 20 nm cleft
    const PB = new Builder(T); lathe(PB, plate(0.17 * SC, 0.022), 56, xform([D[0], cleftY - 0.047, D[2]], [1, 0, 0], [0, 1, 0], [0, 0, 1]), { col: [1, 1, 1] });
    group.add(Object.assign(new T.Mesh(PB.geometry(), cut(M.mat(0x6a47ad, { side: T.DoubleSide }))), { frustumCulled: false }));
    const AB = new Builder(T); lathe(AB, plate(0.27, 0.014), 56, xform([D[0] + 0.02, y0 + 0.03, D[2]], [1, 0, 0], [0, 1, 0], [0, 0, 1]), { col: [1, 1, 1] });
    group.add(Object.assign(new T.Mesh(AB.geometry(), cut(M.mat(0x9f86e6, { side: T.DoubleSide }))), { frustumCulled: false }));
    cleftHalo = kit.halo(0xffb347, 0); cleftHalo.position.set(D[0], cleftY, D[2]); cleftHalo.scale.setScalar(0.9); group.add(cleftHalo);
  }
  // ---- neighbouring presynaptic boutons on spines (neuron-local frame)
  const R_ = rngf(31); const NB = new Builder(T); let nb = 0;
  const cN = new T.Color(0x6fd9bd), cn = [cN.r, cN.g, cN.b];
  const hn = model.applyT([D[0], D[1], D[2]]); const dH = (s) => Math.hypot(s.pos[0] - hn[0], s.pos[1] - hn[1], s.pos[2] - hn[2]);
  const cand = spines.inst.map((s, i) => i).filter((i) => { const s = spines.inst[i]; const r = Math.hypot(...s.pos); return r > 22 && r < 140 && dH(s) > 2.2; });
  const near = cand.filter((i) => dH(spines.inst[i]) < 12 && dH(spines.inst[i]) > 2.2 && spines.inst[i].kind !== 'stub').sort(() => R_() - 0.5).slice(0, 12); for (const i of near) cand.splice(cand.indexOf(i), 1);
  for (let n = 0; n < 76 && (cand.length || near.length); n++) { const i = near.length ? near.pop() : cand.splice(Math.floor(R_() * cand.length), 1)[0]; const s = spines.inst[i]; const m = s.m; const d = norm([m[4], m[5], m[6]]); const L = (s.kind === 'stub' ? 0.6 : s.kind === 'mush' ? 1.4 : 1.35) * (m[5] * 0 + Math.hypot(m[4], m[5], m[6]));
    const top = [s.pos[0] + d[0] * (L + 0.1), s.pos[1] + d[1] * (L + 0.1), s.pos[2] + d[2] * (L + 0.1)]; const bs = 0.3 + R_() * 0.12; ellipsoid(NB, [top[0] + d[0] * bs * 0.8, top[1] + d[1] * bs * 0.8, top[2] + d[2] * bs * 0.8], d, bs * 1.15, bs * 0.8, 28, 16, cn);
    // axon strand continuing away: gentle curvature, bias away from the dendrite for the first few um, then smoothed (no kinks)
    let p = [top[0] + d[0] * bs * 1.6, top[1] + d[1] * bs * 1.6, top[2] + d[2] * bs * 1.6], dd = norm([d[0] + (R_() - 0.5) * 0.9, d[1] + (R_() - 0.5) * 0.9, d[2] + (R_() - 0.5) * 0.9]); let pts = []; let rad = []; const len = 10 + R_() * 14;
    for (let k = 0; k < len; k++) { pts.push(p.slice()); const w = k < 4 ? 0.5 : 0.0; dd = norm([dd[0] + (R_() - 0.5) * 0.28 + d[0] * w, dd[1] + (R_() - 0.5) * 0.28 + d[1] * w, dd[2] + (R_() - 0.5) * 0.28 + d[2] * w]); p = [p[0] + dd[0] * 0.9, p[1] + dd[1] * 0.9, p[2] + dd[2] * 0.9]; }
    { const cv = new T.CatmullRomCurve3(pts.map((q) => new T.Vector3(q[0], q[1], q[2])), false, 'centripetal'); const sp = cv.getSpacedPoints(Math.round(len * 1.8)); pts = sp.map((v) => [v.x, v.y, v.z]); rad = pts.map((q, k) => 0.085 + 0.03 * Math.sin(k * 0.9) * Math.sin(k * 0.9)); }
    sweep(NB, pts, rad, { sides: 8, col: () => cn }); nb++; }
  const mN = M.mat(0xffffff, { vc: true, side: T.DoubleSide, ball: true, inside: 0xd4fbee }); const nMesh = new T.Mesh(NB.geometry(), mN); nMesh.frustumCulled = false; nGroup.add(nMesh);
  return { group, nGroup, mB, solo, labelSpine: () => new T.Vector3((D[0] + 0.15) * 1e-6, (D[1] + 1.15) * 1e-6, D[2] * 1e-6), labelSyn: () => new T.Vector3((D[0] + 0.5) * 1e-6, (cleftY + 0.03) * 1e-6, D[2] * 1e-6),
    update(t, S, flash, W, pl) { mB.emissiveIntensity = flash * 0.55; if (cleftHalo) cleftHalo.material.opacity = Math.min(0.9, flash * 0.9);
      if (vimRef && pl) { const key = pl.normal.x.toFixed(4) + pl.normal.z.toFixed(4) + pl.constant.toFixed(4); if (key !== vimKey) { vimKey = key; for (let i = 0; i < vimPos.length; i++) { const p = vimPos[i], r = vimR[i], d = pl.normal.x * p[0] + pl.normal.y * p[1] + pl.normal.z * p[2] + pl.constant; kit.put(vimRef, i, p[0], p[1], p[2], d >= r ? r : 1e-7); } vimRef.instanceMatrix.needsUpdate = true; } } } };
}
