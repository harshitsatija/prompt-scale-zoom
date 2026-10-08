/* Dendrites, axon, myelin, nodes of Ranvier, spines and presynaptic boutons built from the real morphology. Units: um, neuron-local frame. */
import { Builder, sweep, lathe, xform, basisFromDir, norm, cross, dot, sub, rngf, ssm, TAU, fbm } from './geo.js';

const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function spineProfile(type, v, nNeck, nHead) {
  const pr = []; let L, hr, rn, flat = 1.05;
  if (type === 'thin') { L = 0.95 + v * 0.55; hr = 0.15 + v * 0.05; rn = 0.075; }
  else if (type === 'mush') { L = 0.85 + v * 0.55; hr = 0.34 + v * 0.1; rn = 0.115; flat = 1.12; }
  else { L = 0.42 + v * 0.26; hr = 0.0; rn = 0.3; }
  if (type === 'stub') { // squat, smooth dome with a broad base (no profile kinks)
    const nd = nHead + 4; pr.push([0.36, -0.5], [0.3, -0.12]); for (let k = 1; k <= nd; k++) { const a = k / nd * Math.PI / 2; pr.push([0.27 * Math.pow(Math.cos(a), 0.8) + 0.03 * Math.cos(a), -0.12 + (L + 0.12) * Math.sin(a)]); } pr[pr.length - 1][0] = 0.0; return pr;
  }
  const yh = L; const p0 = -Math.asin(0.55);
  pr.push([0.21, -0.55]);
  for (let k = 1; k <= nNeck; k++) { const t = k / (nNeck + 1); pr.push([rn + (0.21 - rn) * Math.pow(1 - t, 2.2), -0.55 + t * (yh - hr * 0.6 + 0.55)]); }
  for (let k = 0; k <= nHead; k++) { const ph = p0 + (Math.PI / 2 - p0) * k / nHead; pr.push([Math.max(0, hr * Math.cos(ph) * flat), yh + hr * Math.sin(ph)]); }
  pr[pr.length - 1][0] = 0.0; return pr;
}
export function spineGeometry(T, type, v, seg, nNeck, nHead, bend) {
  const B = new Builder(T); const prof = spineProfile(type, v, nNeck, nHead);
  const xf = { p: (x, y, z) => [x + bend * Math.max(0, y) * Math.max(0, y) * 0.5, y, z], n: (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; } };
  lathe(B, prof, seg, xf, { col: [1, 1, 1] }); return B.geometry();
}

export function buildTree(ctx, M, model, soma, cutPlane) {
  const { T, kit } = ctx; const { P, R: R0, geo, par, type, children, N, Ld } = model; const out = {};
  const R_ = rngf(2024); const R = R0.slice();
  const C = (hex) => { const c = new T.Color(hex); return [c.r, c.g, c.b]; };
  const cSoma = C(0xf9d3b2), cDend = C(0xf0b894), cDendFar = C(0xe8a07e), cApic = C(0xf4c09b), cAxon = C(0x74d6c0), cAIS = C(0xb59cf5), cMy = C(0xfff3d6), cMyEnd = C(0xf1dcc4);
  // ---- main axon trunk (root -> tip) and axon calibre
  const main = []; { let k = model.meta.tip; while (k >= 0 && type[k] === 2) { main.push(k); k = par[k]; } main.reverse(); }
  const isMain = new Uint8Array(N); main.forEach((k) => { isMain[k] = 1; });
  for (let i = 0; i < N; i++) if (type[i] === 2) { const g = geo[i]; if (g < 46) R[i] = 0.44 - 0.06 * ssm(14, 46, g); else R[i] = isMain[i] ? 0.37 : 0.15; }
  // ---- branches
  const dB = new Builder(T), aB = new Builder(T), cB = new Builder(T); const spineSites = []; const boutonSites = []; const uAx = (k) => Ld + geo[k];
  const starts = []; for (let i = 0; i < N; i++) { if (type[i] === 1 || par[i] < 0) continue; const p = par[i]; if (type[p] === 1 || children[p].length >= 2 || type[p] !== type[i]) starts.push(i); }
  const sides = (r) => (r > 1.3 ? 22 : r > 0.55 ? 16 : r > 0.4 ? 12 : r > 0.26 ? 8 : 6);
  const rootsDone = new Set();
  for (const s of starts) {
    const ty = type[s], isAx = ty === 2; const chain = [s]; { let k = s; while (children[k].length === 1 && type[children[k][0]] === ty) { k = children[k][0]; chain.push(k); } }
    let pts = [], rad = [], nodes = [];
    const p = par[s];
    let startFlare = 1.5, startR;
    if (type[p] === 1) { // leaves the soma: start just inside the membrane
      let found = -1; for (let i = 0; i < chain.length; i++) { const d = Math.hypot(...P[chain[i]]); const u = P[chain[i]].map((v) => v / d); if (d > soma.field(u) - 0.35) { found = i; break; } }
      if (found < 0) continue; const k = chain[found]; const d1 = Math.hypot(...P[k]), u1 = P[k].map((v) => v / d1), rs = Math.min(soma.field(u1) - 0.4, soma.ell(u1) * 0.8); const prevP = found > 0 ? P[chain[found - 1]] : [0, 0, 0]; const prevD = Math.hypot(...prevP), tt = Math.max(0, Math.min(1, (rs - prevD) / Math.max(1e-6, d1 - prevD)));
      pts.push(lerp3(prevP, P[k], tt)); nodes.push(found > 0 ? chain[found - 1] : k); startFlare = isAx ? 2.9 : 2.0; startR = R[s];
      for (let i = found; i < chain.length; i++) { pts.push(P[chain[i]]); nodes.push(chain[i]); }
    } else { pts.push(P[p]); nodes.push(p); for (const k of chain) { pts.push(P[k]); nodes.push(k); } startR = R[p]; startFlare = 1.25; }
    if (pts.length < 2) continue;
    // drop duplicate / tiny steps
    { const q = [pts[0]], nn = [nodes[0]]; for (let i = 1; i < pts.length; i++) { if (Math.hypot(...sub(pts[i], q[q.length - 1])) > 0.35 || i === pts.length - 1) { q.push(pts[i]); nn.push(nodes[i]); } } pts = q; nodes = nn; }
    if (pts.length < 2) continue;
    // light smoothing
    for (let it = 0; it < 2; it++) { const q = pts.map((a) => a.slice()); for (let i = 1; i < pts.length - 1; i++) for (let c = 0; c < 3; c++) q[i][c] = 0.5 * pts[i][c] + 0.25 * (pts[i - 1][c] + pts[i + 1][c]); pts = q; }
    // radii: constant Rall radius with slight taper along the run + flare at the start
    const rc = R[s], rEnd = R[chain[chain.length - 1]]; let arc = 0; const cum = [0]; for (let i = 1; i < pts.length; i++) { arc += Math.hypot(...sub(pts[i], pts[i - 1])); cum.push(arc); }
    const rp = Math.min(startR || rc, 99); const rs0 = Math.min(Math.max(rc * startFlare, rc), Math.max(rp * 0.82, rc * 1.15)); const rsRoot = type[p] === 1 ? (isAx ? 2.3 : rc * 1.5 + 0.7) : rs0;
    for (let i = 0; i < pts.length; i++) { const t = cum[i] / Math.max(1e-6, arc); let r = isAx ? R[nodes[i]] : (rc * (1.12 - 0.22 * t) + (rEnd - rc) * t * 0.0); const fl = type[p] === 1 ? (isAx ? 1 - ssm(0, 9, cum[i]) : Math.pow(1 - Math.min(1, cum[i] / (8 + 4 * rc)), 2.4)) : Math.exp(-cum[i] / (2.2 * rc + 1.6)) * 0.8; r = r + (rsRoot - r) * fl; if (!isAx && model.chain.has(nodes[i])) r = R[nodes[i]]; if (i === pts.length - 1 && children[chain[chain.length - 1]].length === 0) r *= 0.85; rad.push(Math.max(0.07, r)); }
    // smooth the calibre profile (removes the stepped ribbing of per-node radii), then resample thick branches on a centripetal Catmull-Rom spline (~0.9 um rings) so close-ups are round, not polygonal
    for (let it = 0; it < 3; it++) { const q = rad.slice(); for (let i = 1; i < rad.length - 1; i++) q[i] = 0.25 * rad[i - 1] + 0.5 * rad[i] + 0.25 * rad[i + 1]; rad = q; }
    const auRaw = (k) => { if (isAx) return uAx(k); const u = model.uDend[k]; return u > -1e3 ? u : -1e4; };
    let gArr = nodes.map((k) => geo[k]), uArr = nodes.map((k) => auRaw(k));
    if (Math.max(...rad) > 0.4 && pts.length > 2) {
      const curve = new T.CatmullRomCurve3(pts.map((q) => new T.Vector3(q[0], q[1], q[2])), false, 'centripetal'); const nS = Math.max(pts.length, Math.ceil(arc / 0.9)); const np = [], nr = [], ng = [], nu = [], nn = [];
      for (let j = 0; j <= nS; j++) { const t = j / nS, v = curve.getPoint(t), f = t * (pts.length - 1), a = Math.min(pts.length - 2, Math.floor(f)), b = a + 1, w = f - a; np.push([v.x, v.y, v.z]); nr.push(rad[a] * (1 - w) + rad[b] * w); ng.push(gArr[a] * (1 - w) + gArr[b] * w); nu.push(uArr[a] > -1e3 && uArr[b] > -1e3 ? uArr[a] * (1 - w) + uArr[b] * w : (w < 0.5 ? uArr[a] : uArr[b])); nn.push(nodes[w < 0.5 ? a : b]); }
      pts = np; rad = nr; gArr = ng; uArr = nu; nodes = nn;
    }
    const rmax = Math.max(...rad); const B = isAx ? aB : dB;
    const colAt = (i) => { const g = gArr[i]; if (isAx) { if (g < 14) return mixc(cSoma, cAIS, ssm(4, 14, g)); if (g < 48) return mixc(cAIS, cAxon, ssm(36, 52, g)); return cAxon; } const base = ty === 4 ? cApic : cDend; const t = ssm(40, 420, g); return mixc(mixc(cSoma, base, ssm(4, 34, g)), cDendFar, t * 0.55); };
    const auAt = (i) => uArr[i];
    sweep(B, pts, rad, { sides: sides(rmax), col: colAt, au: auAt, vscale: 1 / 5 });
    if (!isAx && rmax > 0.34) sweep(cB, pts, rad, { sides: 6, col: () => [1, 1, 1] });
    // sites for spines (dendrites) / boutons (axon collaterals)
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], L = Math.hypot(...sub(b, a)); if (L < 1e-3) continue; const g = gArr[i];
      if (!isAx) { const dens = (ty === 4 ? 1.7 : 2.2) * ssm(10, 30, g) * (0.75 + 0.5 * fbm(g * 0.04, ty, 1.7)); let want = dens * L; while (want > 0) { if (R_() < Math.min(1, want)) { const t = R_(); spineSites.push({ pos: lerp3(a, b, t), tan: norm(sub(b, a)), r: rad[i - 1] + (rad[i] - rad[i - 1]) * t, g, ty }); } want -= 1; } }
      else if (!isMain[nodes[i]] && g > 30) { let want = L / 6.5; while (want > 0) { if (R_() < Math.min(1, want)) { const t = R_(); boutonSites.push({ pos: lerp3(a, b, t), r: rad[i], s: 0.26 + R_() * 0.22 }); } want -= 1; } }
    }
    if (isAx && children[chain[chain.length - 1]].length === 0 && !isMain[chain[chain.length - 1]]) boutonSites.push({ pos: pts[pts.length - 1], r: 0.2, s: 0.5 });
  }
  out.coarseGeo = cB.geometry(); out.dendGeo = dB.geometry(); out.axonGeo = aB.geometry(); out.main = main; out.spineSites = spineSites; out.boutonSites = boutonSites;
  // ---- myelin sheaths with nodes of Ranvier on the main axon trunk
  const mp = main.map((k) => ({ p: P[k], g: geo[k], r: R[k] }));
  const at = (g) => { let i = 1; while (i < mp.length - 1 && mp[i].g < g) i++; const a = mp[i - 1], b = mp[i], t = Math.max(0, Math.min(1, (g - a.g) / Math.max(1e-6, b.g - a.g))); return { p: lerp3(a.p, b.p, t), r: a.r + (b.r - a.r) * t }; };
  const gEnd = mp[mp.length - 1].g; const sheaths = []; const nodesG = []; let g0 = 38 + R_() * 6; const GAP = 3.0;
  while (true) { const len = (sheaths.length === 0 ? 58 : 82) + R_() * 46; if (g0 + len > gEnd - 20) break; sheaths.push([g0, g0 + len - GAP]); nodesG.push(g0 + len - GAP * 0.5); g0 += len; }
  const mB = new Builder(T); const TH = 0.62;
  for (const [a, b] of sheaths) { const pts = [], rad = [], nn = []; const step = 1.6; const n = Math.max(8, Math.round((b - a) / step)); for (let i = 0; i <= n; i++) { const g = a + (b - a) * i / n; const q = at(g); pts.push(q.p); const d = Math.min(g - a, b - g); const prof = ssm(0, 5.5, d); const bulb = 0.16 * Math.exp(-Math.pow((d - 6.5) / 2.2, 2)); rad.push(q.r + 0.04 + (TH + bulb) * prof); nn.push(g); }
    sweep(mB, pts, rad, { sides: 22, vscale: 1 / 2.6, col: (i) => { const g = nn[i]; const d = Math.min(g - a, b - g); return mixc(cMyEnd, cMy, ssm(0, 10, d)); }, au: (i) => Ld + nn[i], capEnd: false }); }
  out.myelinGeo = mB.geometry(); out.sheaths = sheaths; out.nodesG = nodesG; out.pointAtGeo = at; out.mainEnd = gEnd;
  return out;
}

/* ---- spines: instanced, 3 morphological classes, 3 levels of detail */
export function buildSpines(ctx, M, model, sites, cutPlane) {
  const { T, kit } = ctx; const R_ = rngf(909); const N = sites.length; const kinds = ['thin', 'mush', 'stub']; const vars = 3; const VV = [0, 1, 0.5], BN = [-0.12, 0.12, 0.02];
  const geos = {}; // [kind][variant][lod]
  const lods = [{ seg: 26, nn: 6, nh: 12 }, { seg: 7, nn: 1, nh: 5 }, { seg: 4, nn: 0, nh: 3 }];
  const cSp = new T.Color(0x86e3c4);
  const mat = M.mat(0xf3c3a2, { side: T.DoubleSide, ball: true, inside: 0xf6dfb8, rimK: 0.6 }); mat.vertexColors = false;
  const meshes = [];  // per lod: array of {mesh,key}
  for (let l = 0; l < 3; l++) { meshes.push([]); }
  const inst = []; // per spine: {kind, variant, matrix(16)}
  const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), ps = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  for (let i = 0; i < N; i++) {
    const s = sites[i]; const u = R_(); const kind = s.g < 24 ? (u < 0.6 ? 'stub' : 'thin') : (u < 0.5 ? 'thin' : u < 0.8 ? 'mush' : 'stub'); const variant = Math.floor(R_() * 3);
    // outward direction: random around the shaft, perpendicular to tangent
    const e1 = norm(cross(s.tan, Math.abs(s.tan[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), e2 = cross(s.tan, e1); const a = R_() * TAU; let d = [e1[0] * Math.cos(a) + e2[0] * Math.sin(a), e1[1] * Math.cos(a) + e2[1] * Math.sin(a), e1[2] * Math.cos(a) + e2[2] * Math.sin(a)];
    d = norm([d[0] + s.tan[0] * (R_() - 0.5) * 0.5, d[1] + s.tan[1] * (R_() - 0.5) * 0.5, d[2] + s.tan[2] * (R_() - 0.5) * 0.5]);
    const pos = [s.pos[0] + d[0] * (s.r - 0.06), s.pos[1] + d[1] * (s.r - 0.06), s.pos[2] + d[2] * (s.r - 0.06)];
    { const h = model.apply(s.pos); if (Math.abs(h[0] - model.D[0]) < 1.0 && Math.abs(h[1] - model.D[1]) < 1.8 && Math.abs(h[2] - model.D[2]) < 1.5) continue; } // keep the hero spine's own footprint clear
    q.setFromUnitVectors(up, new T.Vector3(...d)); const roll = new T.Quaternion().setFromAxisAngle(new T.Vector3(...d), R_() * TAU); q.premultiply(roll);
    const k = 0.8 + R_() * R_() * 0.7 + 0.1; m4.compose(ps.set(...pos), q, sc.set(k, k, k)); inst.push({ kind, variant, m: m4.elements.slice(), pos, bend: (R_() - 0.5) * 0.5 });
  }
  const group = new T.Group(); const buckets = {};
  const keyOf = (kind, v) => kind + v; kinds.forEach((kd) => { for (let v = 0; v < vars; v++) buckets[keyOf(kd, v)] = []; });
  inst.forEach((s, i) => buckets[keyOf(s.kind, s.variant)].push(i));
  const lodGroups = [new T.Group(), new T.Group(), new T.Group()]; lodGroups.forEach((g) => group.add(g));
  const imeshes = []; // {lod, key, mesh}
  for (let l = 0; l < 3; l++) for (const kd of kinds) for (let v = 0; v < vars; v++) { const key = keyOf(kd, v); const cap = buckets[key].length; if (!cap) continue; const geo = spineGeometry(T, kd, VV[v], lods[l].seg, lods[l].nn, lods[l].nh, BN[v]); const im = new T.InstancedMesh(geo, mat, cap); im.frustumCulled = false; im.count = 0; lodGroups[l].add(im); imeshes.push({ l, key, im }); }
  const state = { fx: 1e9, fy: 0, fz: 0, rc: 0, lod: -1 };
  function update(fl, W) { // fl: focus in neuron-local um; W: field width um
    const lod = W < 20 ? 0 : W < 80 ? 1 : 2; const rc = Math.max(28, 1.25 * W); const mv = Math.hypot(fl[0] - state.fx, fl[1] - state.fy, fl[2] - state.fz);
    if (lod === state.lod && mv < 0.1 * rc && Math.abs(Math.log(rc / (state.rc || rc))) < 0.1) return; Object.assign(state, { fx: fl[0], fy: fl[1], fz: fl[2], rc, lod });
    lodGroups.forEach((g, l) => { g.visible = l === lod; });
    const keep = W > 130 ? 0.45 : W > 80 ? 0.55 : W > 40 ? 0.8 : 1;
    for (const e of imeshes) { if (e.l !== lod) continue; const arr = e.im.instanceMatrix.array; let c = 0; for (const i of buckets[e.key]) { const s = inst[i]; const dx = s.pos[0] - fl[0], dy = s.pos[1] - fl[1], dz = s.pos[2] - fl[2]; if (dx * dx + dy * dy + dz * dz > rc * rc) continue; if (keep < 1 && (i * 0.6180339) % 1 > keep) continue; arr.set(s.m, c * 16); c++; } e.im.count = c; e.im.instanceMatrix.needsUpdate = true; }
  }
  return { group, update, inst };
}
