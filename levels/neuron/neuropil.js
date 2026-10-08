/* The neuropil around the hero cell (head frame, um): a dense felt of neighbouring axons and dendrites, a capillary with red blood cells,
 * an astrocyte reaching onto the capillary, a microglial cell, and two neighbouring pyramidal somas.  All pieces are kept clear of the hero's own branches. */
import { Builder, sweep, lathe, xform, ellipsoid, basisFromDir, norm, cross, dot, sub, rngf, gauss, fbm, ssm, TAU } from './geo.js';
import { radialShell } from './soma.js';
import { lodInst } from './lodinst.js';

export async function buildNeuropil(ctx, M, model, soma, tree, A, cutN, ng, wg) {
  const { T, kit } = ctx; const U = 1e-6; const R_ = rngf(5150);
  const cut = (m) => { m.clippingPlanes = [cutN]; return m; };
  const C = (hex) => { const c = new T.Color(hex); return [c.r, c.g, c.b]; };
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // ---- hero node hash (head frame) for clearance queries
  const hp = []; for (let i = 0; i < model.N; i++) { if (model.type[i] === 1) continue; const h = model.apply(model.P[i]); hp.push([h[0], h[1], h[2], model.R[i] + (model.type[i] === 2 ? 0.1 : 0.45)]); }
  // soma as a sphere of radius 12.5 (+ proximal stems are in the node list)
  const CS = 8, hash = new Map(); const hk = (x, y, z) => x + ',' + y + ',' + z;
  hp.forEach((p, i) => { const k = hk(Math.floor(p[0] / CS), Math.floor(p[1] / CS), Math.floor(p[2] / CS)); (hash.get(k) || hash.set(k, []).get(k)).push(i); });
  const nearest = (p) => { let best = 1e9; const cx = Math.floor(p[0] / CS), cy = Math.floor(p[1] / CS), cz = Math.floor(p[2] / CS); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const l = hash.get(hk(cx + a, cy + b, cz + c)); if (!l) continue; for (const i of l) { const q = hp[i]; const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) - q[3]; if (d < best) best = d; } } const ds = Math.hypot(...p) - 12.5; return Math.min(best, ds); };
  const nq = norm(A.nq);
  // tortuous walk: persistent curvature (a slowly turning bias) + jitter, so processes meander like real neuropil rather than run in straight rods
  const meander = () => { let cv = norm([R_() - 0.5, R_() - 0.5, R_() - 0.5]); const amp = 0.1 + R_() * 0.22; return (d, jit) => { cv = norm([cv[0] + (R_() - 0.5) * 0.5, cv[1] + (R_() - 0.5) * 0.5, cv[2] + (R_() - 0.5) * 0.5]); return norm([d[0] + cv[0] * amp + (R_() - 0.5) * jit, d[1] + cv[1] * amp + (R_() - 0.5) * jit, d[2] + cv[2] * amp + (R_() - 0.5) * jit]); }; };
  const lap = (pts, it = 2) => { for (let k = 0; k < it; k++) { const q = pts.map((a) => a.slice()); for (let i = 1; i < pts.length - 1; i++) for (let c = 0; c < 3; c++) q[i][c] = 0.5 * pts[i][c] + 0.25 * (pts[i - 1][c] + pts[i + 1][c]); pts = q; } return pts; };
  const smooth = (pts, h) => { if (pts.length < 4) return pts; const cv = new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(p[0], p[1], p[2])), false, 'centripetal'); let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); return cv.getSpacedPoints(Math.max(pts.length, Math.round(L / h))).map((v) => [v.x, v.y, v.z]); };
  const FOGC = [0.07, 0.06, 0.26]; const deep = (c, z, k) => { const t = Math.min(1, Math.min(1, Math.max(0, (-z - 2) / 55)) * k * 1.5 + 0.25); return [c[0] + (FOGC[0] - c[0]) * t, c[1] + (FOGC[1] - c[1]) * t, c[2] + (FOGC[2] - c[2]) * t]; };

  const group = new T.Group(); wg.add(group);
  // ============ 1. the felt of neighbouring axons and dendrites ============
  const nb = new Builder(T); const pal = [C(0x2fae98), C(0x37b9a0), C(0x5b63e0), C(0x7a63d4), C(0x3f8fcf), C(0x2c9a8e), C(0x4a4fc2)]; const varic = [];
  for (let n = 0; n < 230; n++) {
    const c0 = [(R_() * 2 - 1) * 85, (R_() * 2 - 1) * 95, -(1.2 + R_() * 70)]; const isDend = R_() < 0.1; const r = isDend ? 0.3 + R_() * 0.35 : 0.07 + R_() * 0.16;
    let d = R_() < 0.4 ? nq.slice() : norm([R_() - 0.5, R_() - 0.5, R_() - 0.5]); if (R_() < 0.5) d = d.map((v) => -v); const L = isDend ? 45 + R_() * 50 : 22 + R_() * 55; const step = isDend ? 3.2 : 2.6;
    let p = c0.slice(); let pts = []; const mw = meander(); for (let s = 0; s < L / step; s++) { if (nearest(p) < r + 0.55) break; pts.push(p.slice()); d = mw(d, 0.3); p = [p[0] + d[0] * step, p[1] + d[1] * step, p[2] + d[2] * step]; if (p[2] > -(r + 0.45)) { p[2] = -(r + 0.45); d = norm([d[0], d[1], -Math.abs(d[2]) - 0.25]); } }
    if (pts.length < 4) continue; pts = smooth(lap(pts, 2), r > 0.28 ? 1.4 : 2.0); const col0 = pal[Math.floor(R_() * pal.length)], shade = 0.55 + R_() * 0.3; const col = deep(col0, pts[0][2], 0.7); const rad = pts.map((q, i) => r * (1 + 0.18 * Math.sin(i * 0.9 + n)) * (isDend ? 1 - 0.3 * i / pts.length : 1) * (0.25 + 0.75 * ssm(0, 5, Math.min(i, pts.length - 1 - i))));
    sweep(nb, pts, rad, { sides: r > 0.28 ? 14 : r > 0.14 ? 10 : 7, col: () => [col[0] * shade, col[1] * shade, col[2] * shade] });
    if (!isDend) for (let i = 2; i < pts.length - 1; i += 3 + Math.floor(R_() * 3)) if (R_() < 0.7) varic.push({ p: pts[i], tg: norm(sub(pts[i + 1], pts[i - 1])), s: r * (1.9 + R_() * 1.2), col: [col[0] * shade * 1.15, col[1] * shade * 1.15, col[2] * shade * 1.15] });
  }
  const mFelt = cut(M.mat(0xffffff, { vc: true, side: T.DoubleSide, inside: 0xb4aee0, rimK: 0.16 })); const felt = new T.Mesh(nb.geometry(), mFelt); felt.frustumCulled = false; group.add(felt);
  let varicL = null;
  { const mats = new Float32Array(varic.length * 16), cl = new Float32Array(varic.length * 3); const vq = new T.Quaternion(), vm4 = new T.Matrix4(), vp = new T.Vector3(), vs = new T.Vector3(), vy = new T.Vector3(0, 1, 0), vt = new T.Vector3();
    varic.forEach((v, i) => { vt.set(...v.tg); vq.setFromUnitVectors(vy, vt); vm4.compose(vp.set(v.p[0], v.p[1], v.p[2]), vq, vs.set(v.s * 0.8, v.s * 1.3, v.s * 0.8)); mats.set(vm4.elements, i * 16); cl.set(v.col, i * 3); });
    varicL = lodInst(T, { geoHi: new T.SphereGeometry(1, 20, 14), geoLo: new T.SphereGeometry(1, 8, 6), mat: cut(M.toon(0xffffff, { side: T.DoubleSide })), mats, cols: cl, hiW: 40, rcMin: 45, rcK: 1.5, allW: 130 }); group.add(varicL.group); group.userData.varic = varicL.group; }

  // ============ 1b. packed neuropil: fat dendrite / axon / glial profiles filling the volume behind the focal plane (an EM-like felt), deep and desaturated so the hero cell pops ============
  const mPack = cut(M.mat(0xffffff, { vc: true, side: T.DoubleSide, inside: 0x3c3c92, rimK: 0.1 })); let pack;
  { const fb = new Builder(T); const cols = [C(0x2d4f9c), C(0x3a3c9a), C(0x276d8f), C(0x47379a), C(0x2d7d86), C(0x3f4fa6), C(0x5a3f9e)]; let made = 0, tr = 0;
    while (made < 340 && tr++ < 2600) { const c0 = [(R_() * 2 - 1) * 100, (R_() * 2 - 1) * 110, -(2 + R_() * 90)]; const big = R_() < 0.04; const r = big ? 0.5 + R_() * 0.4 : 0.18 + R_() * R_() * 0.6;
      let d = R_() < 0.5 ? nq.slice() : norm([R_() - 0.5, R_() - 0.5, R_() - 0.5]); if (R_() < 0.5) d = d.map((v) => -v); const L = (big ? 30 : 16) + R_() * 55; const step = 3.4 + r * 1.2; let pts = []; let p = c0.slice(), ok = true; const mw = meander();
      for (let k = 0; k < L / step; k++) { if (nearest(p) < r + 0.5) { ok = pts.length > 3 ? true : false; break; } pts.push(p.slice()); d = mw(d, 0.3); p = [p[0] + d[0] * step, p[1] + d[1] * step, p[2] + d[2] * step]; if (p[2] > -(r + 0.45)) { p[2] = -(r + 0.45); d = norm([d[0], d[1], -Math.abs(d[2]) - 0.25]); } }
      if (!ok || pts.length < 4) continue; pts = smooth(lap(pts, 2), r > 0.6 ? 1.3 : 2.1); const col = deep(cols[Math.floor(R_() * cols.length)], pts[0][2], 0.5), sh = 0.6 + R_() * 0.3; const rad = pts.map((q, i) => r * (1 + 0.16 * Math.sin(i * 1.1 + made) + (R_() < 0.06 ? 0.5 : 0)) * (0.45 + 0.55 * ssm(0, 4, Math.min(i, pts.length - 1 - i))));
      sweep(fb, pts, rad, { sides: r > 0.7 ? 16 : 10, col: () => [col[0] * sh, col[1] * sh, col[2] * sh] }); made++; }
    pack = new T.Mesh(fb.geometry(), mPack); pack.frustumCulled = false; group.add(pack); }

  // ============ 1c. near-field felt: chunky, brighter neurites packed around the hero synapse (same palette / calibre as the synapse level's own neuropil, so the hand-off at z = -4.6 does not change the surroundings) ============
  const mNear = cut(M.mat(0xffffff, { vc: true, side: T.DoubleSide, inside: 0xb4aee0, rimK: 0.3 })); let near;
  { const Hd = model.D; const nbld = new Builder(T); const palN = [C(0x5a52c8), C(0x6f5fd0), C(0x2fae98), C(0x3fb9a4), C(0x4a63c9), C(0x7a63d4), C(0x35a79a)]; let made = 0, tr = 0;
    while (made < 150 && tr++ < 2400) { const c0 = [Hd[0] + (R_() * 2 - 1) * 17, Hd[1] + 2.4 + (R_() * 2 - 1) * 11, -(1.4 + R_() * R_() * 9)]; const r = 0.12 + R_() * R_() * 0.34;
      let d = norm([R_() - 0.5, R_() - 0.5, (R_() - 0.5) * 0.3]); if (R_() < 0.5) d = d.map((v) => -v); const L = 9 + R_() * 16; const step = 1.3 + r; let pts = []; let p = c0.slice(); const mw = meander();
      for (let k = 0; k < L / step; k++) { if (nearest(p) < r + 0.5) break; pts.push(p.slice()); d = mw(d, 0.25); d[2] *= 0.5; d = norm(d); p = [p[0] + d[0] * step, p[1] + d[1] * step, p[2] + d[2] * step]; if (p[2] > -(r + 0.45)) { p[2] = -(r + 0.45); d = norm([d[0], d[1], -Math.abs(d[2]) - 0.1]); } }
      if (pts.length < 4) continue; pts = smooth(lap(pts, 2), 1.0); const col = deep(palN[Math.floor(R_() * palN.length)], pts[0][2], 0.15), sh = 0.78 + R_() * 0.22; const rad = pts.map((q, i) => r * (1 + 0.14 * Math.sin(i * 0.8 + made)) * (0.62 + 0.38 * ssm(0, 3, Math.min(i, pts.length - 1 - i))));
      sweep(nbld, pts, rad, { sides: r > 0.25 ? 14 : 10, col: () => [col[0] * sh, col[1] * sh, col[2] * sh] }); made++; }
    near = new T.Mesh(nbld.geometry(), mNear); near.frustumCulled = false; group.add(near); }

  // ---- opaque deep-violet backdrop behind the felt (hides whatever other levels draw behind this slab; fades out as the cortex takes over)
  const bdMat = new T.MeshBasicMaterial({ color: 0x100e40, fog: false, side: T.DoubleSide, transparent: true }); const backdrop = new T.Mesh(new T.PlaneGeometry(900, 900), bdMat); backdrop.position.set(0, 0, -84); backdrop.frustumCulled = false; backdrop.userData.ro = 600; backdrop.visible = false; /* no opaque backdrop: the cortex slab shows through */
  // ============ 2. capillary with red blood cells ============
  let cap = null;
  { let best = null;
    for (let tr = 0; tr < 260; tr++) { const c = [(R_() * 2 - 1) * 55, (R_() * 2 - 1) * 60, -(22 + R_() * 38)]; const d = norm([R_() - 0.5, (R_() - 0.5) * 0.7, (R_() - 0.5) * 0.3]); const pts = []; let mn = 1e9; for (let s = -16; s <= 16; s++) { const q = [c[0] + d[0] * s * 7 + Math.sin(s * 0.35 + tr) * 6, c[1] + d[1] * s * 7 + Math.cos(s * 0.3 + tr) * 5, c[2] + d[2] * s * 7 + Math.sin(s * 0.2) * 3]; pts.push(q); mn = Math.min(mn, nearest(q)); }
      if (!best || mn > best.mn) best = { pts, mn }; }
    const pts = best.pts; const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(...sub(pts[i], pts[i - 1]))); cap = { pts, cum, L: cum[cum.length - 1] };
    const curve = new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(...p))); const dense = curve.getSpacedPoints(120).map((v) => [v.x, v.y, v.z]);
    cap.dense = dense; const dcum = [0]; for (let i = 1; i < dense.length; i++) dcum.push(dcum[i - 1] + Math.hypot(...sub(dense[i], dense[i - 1]))); cap.dcum = dcum; cap.L = dcum[dcum.length - 1];
    const wall = new Builder(T); const cW = C(0xe99aa0), cW2 = C(0xd57a90);
    sweep(wall, dense, dense.map((p, i) => 4.3 + 0.35 * Math.sin(i * 0.5) + (0)), { sides: 24, col: (i) => mixc(cW, cW2, 0.5 + 0.5 * Math.sin(i * 0.2)), capEnd: false });
    const mWall = cut(M.toon(0xffffff, { vc: true, side: T.DoubleSide, opacity: 1 })); mWall.depthWrite = true; const wm = new T.Mesh(wall.geometry(), mWall); wm.frustumCulled = false; group.add(wm);
    // lumen lining (plasma)
    const lum = new Builder(T); sweep(lum, dense, dense.map(() => 3.45), { sides: 20, col: () => C(0xffd9cf), capEnd: false }); const mLum = cut(M.toon(0xffffff, { vc: true, side: T.BackSide })); group.add(Object.assign(new T.Mesh(lum.geometry(), mLum), { frustumCulled: false }));
    // endothelial nucleus bulge + pericyte
    for (const [t, s] of [[0.32, 1], [0.7, -1]]) { const i = Math.floor(t * 120), p = dense[i], tt = norm(sub(dense[i + 1], dense[i - 1])); const [ex, ey, ez] = basisFromDir(tt); const o = [p[0] + ex[0] * 4.4 * s, p[1] + ex[1] * 4.4 * s, p[2] + ex[2] * 4.4 * s]; const eb = new Builder(T); ellipsoid(eb, o, tt, 2.0, 4.2, 28, 16, C(t < 0.5 ? 0xb88ad6 : 0xe2a24a)); group.add(Object.assign(new T.Mesh(eb.geometry(), cut(M.toon(0xffffff, { vc: true, side: T.DoubleSide }))), { frustumCulled: false })); }
    // red blood cells: biconcave discs in single file
    const prof = []; { const Rr = 3.7; const f = (rho) => Rr * Math.sqrt(Math.max(0, 1 - rho * rho)) * (0.2072 + 2.0026 * rho * rho - 1.1228 * rho ** 4); const n = 14; for (let k = 0; k <= n; k++) { const rho = k / n * 0.999; prof.push([rho * Rr, -f(rho)]); } for (let k = n; k >= 0; k--) { const rho = k / n * 0.999; prof.push([rho * Rr, f(rho)]); } }
    const rb = new Builder(T); lathe(rb, prof, 28, xform([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]), { col: [1, 1, 1] });
    const NR = 30; const rim = kit.inst(rb.geometry(), cut(new T.MeshBasicMaterial({ color: 0xd9484c, side: T.DoubleSide })), NR); rim.frustumCulled = false; group.add(rim); cap.rbc = { im: rim, n: NR, off: Array.from({ length: NR }, (_, i) => i * (cap.L / NR) + R_() * 2), tilt: Array.from({ length: NR }, () => [R_() * 0.5, R_() * 6.28]) };
  }
  const posOn = (s) => { const L = cap.L, d = cap.dense, c = cap.dcum; s = ((s % L) + L) % L; let i = 1; while (i < c.length - 1 && c[i] < s) i++; const t = (s - c[i - 1]) / (c[i] - c[i - 1]); const p = [d[i - 1][0] + (d[i][0] - d[i - 1][0]) * t, d[i - 1][1] + (d[i][1] - d[i - 1][1]) * t, d[i - 1][2] + (d[i][2] - d[i - 1][2]) * t]; return { p, t: norm(sub(d[i], d[i - 1])) }; };

  // ============ 3. astrocyte (soma + branching processes + perisynaptic leaflets + endfoot on the capillary) ============
  const astro = {};
  { const aB = new Builder(T), cA = C(0xa88cf0), cA2 = C(0xc9b6ff); let best = null;
    for (let tr = 0; tr < 120; tr++) { const i = Math.floor(R_() * 100) + 10, p = cap.dense[i]; const d = norm([R_() - 0.5, R_() - 0.5, R_() - 0.5]); const c = [p[0] + d[0] * 19, p[1] + d[1] * 19, p[2] + d[2] * 19]; const cl = nearest(c); if (cl > 10 && (!best || cl > best.cl)) best = { c, cl, i }; }
    const c = best ? best.c : [30, 40, -30]; astro.c = c; const nodes = [];
    const field = (d) => 5.2 * (1 + 0.28 * (fbm(d[0] * 1.6 + 3, d[1] * 1.6, d[2] * 1.6, 3) - 0.5)); const sg = radialShell(T, field, 40, 64, { uv: [2, 1], centre: c }); astro.soma = new T.Mesh(sg, cut(M.toon(0xc9b6ff, { side: T.DoubleSide }))); astro.soma.frustumCulled = false; group.add(astro.soma);
    const nuc = new T.Mesh(new T.SphereGeometry(2.5, 28, 20), cut(M.toon(0x7a5fd8, { side: T.DoubleSide }))); nuc.position.set(...c); nuc.scale.set(1, 0.8, 0.9); group.add(nuc);
    const grow = (p, d, len, r, depth, toward) => { const pts = [p.slice()], rad = [r]; let q = p.slice(), dd = d.slice(); const n = Math.max(3, Math.floor(len / 2.2));
      for (let s = 0; s < n; s++) { dd = norm([dd[0] + (R_() - 0.5) * 0.5, dd[1] + (R_() - 0.5) * 0.5, dd[2] + (R_() - 0.5) * 0.5]); if (toward) { const tv = norm(sub(toward, q)); dd = norm([dd[0] + tv[0] * 0.18, dd[1] + tv[1] * 0.18, dd[2] + tv[2] * 0.18]); } q = [q[0] + dd[0] * 2.2, q[1] + dd[1] * 2.2, q[2] + dd[2] * 2.2]; if (nearest(q) < r + 0.3) break; pts.push(q.slice()); rad.push(Math.max(0.1, r * (1 - 0.55 * (s + 1) / n))); }
      if (pts.length < 3) return; sweep(aB, pts, rad, { sides: r > 0.5 ? 9 : 6, col: () => mixc(cA, cA2, Math.min(1, depth * 0.25)) }); nodes.push(...pts.map((v, i) => ({ p: v, r: rad[i] })));
      if (depth < 3 && pts.length > 4) { const nb_ = depth === 0 ? 2 : 2 + (R_() < 0.5 ? 1 : 0); for (let k = 0; k < nb_; k++) { const i = 2 + Math.floor(R_() * (pts.length - 3)); const dd2 = norm([pts[i][0] - pts[i - 1][0] + (R_() - 0.5) * 1.6, pts[i][1] - pts[i - 1][1] + (R_() - 0.5) * 1.6, pts[i][2] - pts[i - 1][2] + (R_() - 0.5) * 1.6]); grow(pts[i], dd2, len * (0.55 + R_() * 0.2), rad[i] * 0.62, depth + 1, null); } } };
    // primary processes (one heads to the capillary and ends in a sheet = endfoot)
    const target = cap.dense[best ? best.i : 60]; const nProc = 7; for (let k = 0; k < nProc; k++) { const d = k === 0 ? norm(sub(target, c)) : norm([R_() - 0.5, R_() - 0.5, R_() - 0.5]); grow([c[0] + d[0] * 4.2, c[1] + d[1] * 4.2, c[2] + d[2] * 4.2], d, 24 + R_() * 14, 1.5 + R_() * 0.4, 0, k === 0 ? target : null); }
    astro.geo = aB.geometry(); const am = new T.Mesh(astro.geo, cut(M.toon(0xffffff, { vc: true, side: T.DoubleSide }))); am.frustumCulled = false; group.add(am);
    // leaflets: flat fenestrated sheets scattered along the finer processes
    const fine = nodes.filter((n) => n.r < 0.55); const NL = Math.min(260, fine.length); const lg = new T.SphereGeometry(1, 10, 6); const lm = kit.inst(lg, cut(M.toon(0xd9ccff, { side: T.DoubleSide })), NL);
    for (let i = 0; i < NL; i++) { const n = fine[Math.floor(R_() * fine.length)]; const s = 0.35 + R_() * 0.6; kit.put(lm, i, n.p[0] + (R_() - 0.5) * 0.8, n.p[1] + (R_() - 0.5) * 0.8, n.p[2] + (R_() - 0.5) * 0.8, s * 1.4, s * 0.12, s * 1.0, R_() * 6, R_() * 6, R_() * 6); } lm.frustumCulled = false; group.add(lm);
    astro.labelPos = () => new T.Vector3(c[0] * U, (c[1] + 6.2) * U, c[2] * U);
    // endfoot sheet on the capillary wall
    { const p = target, i = best ? best.i : 60, tt = norm(sub(cap.dense[i + 1], cap.dense[i - 1])); const [ex, ey, ez] = basisFromDir(tt); const toward = norm(sub(c, p)); const eb = new Builder(T); const ef = (d) => 1; // curved patch hugging the wall
      const G = 12, rows = []; const cd = ez; for (let a = 0; a <= G; a++) { for (let b = 0; b <= G; b++) { const ua = (a / G - 0.5) * 2, ub = (b / G - 0.5) * 2; const th = Math.atan2(toward[0] * ex[0] + toward[1] * ex[1] + toward[2] * ex[2], toward[0] * ez[0] + toward[1] * ez[1] + toward[2] * ez[2]) + ua * 0.9; const y = ub * 6; const rr = 4.75; eb.vert(p[0] + (ex[0] * Math.sin(th) + ez[0] * Math.cos(th)) * rr + ey[0] * y, p[1] + (ex[1] * Math.sin(th) + ez[1] * Math.cos(th)) * rr + ey[1] * y, p[2] + (ex[2] * Math.sin(th) + ez[2] * Math.cos(th)) * rr + ey[2] * y, ex[0] * Math.sin(th) + ez[0] * Math.cos(th), ex[1] * Math.sin(th) + ez[1] * Math.cos(th), ex[2] * Math.sin(th) + ez[2] * Math.cos(th), 1, 1, 1, -1e4, ua, ub); } }
      for (let a = 0; a < G; a++) for (let b = 0; b < G; b++) { const i0 = a * (G + 1) + b, i1 = i0 + 1, i2 = i0 + G + 1, i3 = i2 + 1; eb.tri(i0, i2, i1); eb.tri(i1, i2, i3); }
      group.add(Object.assign(new T.Mesh(eb.geometry(), cut(M.toon(0xc9b6ff, { side: T.DoubleSide, opacity: 0.9 }))), { frustumCulled: false })); }
  }

  // ============ 4. microglia: small soma with ramified thin processes ============
  const micro = {};
  { const mB = new Builder(T), cM = C(0xb8a86a); let best = null; for (let tr = 0; tr < 400; tr++) { const c = [(R_() * 2 - 1) * 70, (R_() * 2 - 1) * 70, -(8 + R_() * 25)]; const cl = nearest(c); const dd = Math.hypot(c[0] - 34, c[1] - 24, (c[2] + 20) * 0.5); if (cl > 8 && (!best || dd < best.d)) best = { c, d: dd }; } const c = best ? best.c : [-40, -30, -15]; micro.c = c;
    const sg = radialShell(T, (d) => 3.6 * (1 + 0.22 * (fbm(d[0] * 2 + 1, d[1] * 2, d[2] * 2, 2) - 0.5)), 30, 48, { uv: [2, 1], centre: c }); group.add(Object.assign(new T.Mesh(sg, cut(M.toon(0xc9b878, { side: T.DoubleSide }))), { frustumCulled: false }));
    const grow = (p, d, len, r, depth) => { const pts = [p.slice()], rad = [r]; let q = p.slice(), dd = d.slice(); const n = Math.max(3, Math.floor(len / 1.6)); for (let s = 0; s < n; s++) { dd = norm([dd[0] + (R_() - 0.5) * 0.7, dd[1] + (R_() - 0.5) * 0.7, dd[2] + (R_() - 0.5) * 0.7]); q = [q[0] + dd[0] * 1.6, q[1] + dd[1] * 1.6, q[2] + dd[2] * 1.6]; if (nearest(q) < r + 0.3) break; pts.push(q.slice()); rad.push(Math.max(0.05, r * (1 - 0.6 * (s + 1) / n))); }
      if (pts.length < 3) return; sweep(mB, pts, rad, { sides: 6, col: () => cM }); if (depth < 2) for (let k = 0; k < 2; k++) { const i = 1 + Math.floor(R_() * (pts.length - 2)); grow(pts[i], norm([pts[i][0] - pts[i - 1][0] + (R_() - 0.5) * 1.8, pts[i][1] - pts[i - 1][1] + (R_() - 0.5) * 1.8, pts[i][2] - pts[i - 1][2] + (R_() - 0.5) * 1.8]), len * 0.6, r * 0.65, depth + 1); } };
    for (let k = 0; k < 6; k++) { const d = norm([R_() - 0.5, R_() - 0.5, R_() - 0.5]); grow([c[0] + d[0] * 3.2, c[1] + d[1] * 3.2, c[2] + d[2] * 3.2], d, 13 + R_() * 8, 0.65, 0); }
    group.add(Object.assign(new T.Mesh(mB.geometry(), cut(M.toon(0xffffff, { vc: true, side: T.DoubleSide }))), { frustumCulled: false })); micro.labelPos = () => new T.Vector3(c[0] * U, (c[1] + 4.5) * U, c[2] * U); }

  // ============ 5. neighbouring pyramidal neurons: coarse copies of the real morphology (rotated about the cortical normal), somas with nuclei ============
  const neigh = [];
  { const defs = [{ T: [-95, 30, -62], th: 2.1, col: 0xe3a98a }, { T: [88, -44, -75], th: 4.2, col: 0xdca283 }];
    for (const d of defs) { const g2 = new T.Group(); g2.position.set(...d.T); const qn = new T.Quaternion().setFromAxisAngle(new T.Vector3(...nq), d.th); g2.quaternion.copy(qn).multiply(ng.quaternion);
      const mt = cut(M.toon(d.col, { side: T.DoubleSide })); g2.add(Object.assign(new T.Mesh(tree.coarseGeo, mt), { frustumCulled: false }));
      const sg = radialShell(T, soma.field, 56, 96, { uv: [3, 2] }); g2.add(Object.assign(new T.Mesh(sg, M.toon(d.col, { side: T.FrontSide })), { frustumCulled: false }));
      const nu = new T.Mesh(new T.SphereGeometry(5.0, 32, 22), M.toon(0x8d86e8, { side: T.FrontSide })); nu.visible = false; nu.position.set(0, -1.3, 0); nu.scale.set(1, 1.05, 1); g2.add(nu);
      group.add(g2); neigh.push(d.T.slice()); }
  }
  function col2hex(c) { const k = new T.Color(); k.setRGB(c[0], c[1], c[2]); return k.getHex(); }

  const labels = [
    { text: 'astrocyte', z0: -4.9, z1: -3.5, right: true, pos: astro.labelPos },
    { text: 'capillary · 7 µm, red blood cells', z0: -4.8, z1: -3.5, pos: () => { const q = posOn(cap.L * 0.5).p; return new T.Vector3(q[0] * U, (q[1] + 6) * U, q[2] * U); } },
    { text: 'microglia', z0: -4.8, z1: -3.5, right: true, pos: micro.labelPos },
    { text: 'neighbouring neuron', z0: -4.6, z1: -3.5, pos: () => new T.Vector3(neigh[0][0] * U, (neigh[0][1] + 11) * U, neigh[0][2] * U) },
  ];
  const rimM = new T.Matrix4(), q4 = new T.Quaternion(), pv = new T.Vector3(), sv = new T.Vector3(1, 1, 1);
  function update(t, S, z, c, W, Fh) {
    const f = (0.22 + 0.78 * (1 - ssm(90, 230, W))) * (1 - ssm(300, 400, W)) * (ctx.params && ctx.params.get('only') && !ctx.params.get('only').split(',').includes('synapse') ? 1 : 1); group.visible = f > 0.01; if (!group.visible) return;
    
    mPack.opacity = f; pack.visible = f > 0.05; { const fn = f * (1 - ssm(40, 110, W)); mNear.opacity = fn; near.visible = fn > 0.02; } { const fc = f * (1 - 0.72 * ssm(30, 110, W)); mFelt.opacity = fc; varicL.meshes.forEach((m) => { m.material.opacity = fc; }); } group.userData.varic.visible = f > 0.05; varicL.update(Fh, W);
    // blood flow
    const R = cap.rbc; for (let i = 0; i < R.n; i++) { const s = R.off[i] + t * 38; const { p, t: tt } = posOn(s); q4.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(...tt)); const tl = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), R.tilt[i][0] * 0.6); q4.multiply(tl); const sc = 1; rimM.compose(pv.set(p[0], p[1], p[2]), q4, sv.set(sc, sc, sc)); R.im.setMatrixAt(i, rimM); } R.im.instanceMatrix.needsUpdate = true;
  }
  return { labels, update, group };
}
