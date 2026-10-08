/* Level "synapse": a glutamatergic cortical synapse as a microtome section (z_local = 0).
 * Geometry: real PDB structures (AMPAR 3KG2, NMDAR 4PE5, neuroligin-neurexin 3B3Q, Cav2.2 7MIX, V-ATPase 6VQ6, SNARE 1SFC, CaMKII 5U6Y,
 * PDZ 1BE9) as Gaussian molecular surfaces; cells as signed-distance meshes built from serial-section-EM morphometry.
 * Authored in micrometres, every mesh scaled by 1e-6. Everything behind z_local = 0 is kept, everything in front is clipped.
 * See assets/synapse/SOURCES.md. */
import { secMat, ribbonMat, updateSection, SEC, HOLES, RECS, RIB as RIBALL } from './synapse/section.js';
import { loadPack } from './synapse/packs.js';
import { makeHaze } from './synapse/haze.js';
import { PLAN, NSLOT, activeEvents, fusionState, profile, holeRadius, OM } from './synapse/signal.js';
export default async function build(ctx) {
  const { T, kit, timeline } = ctx; const group = new T.Group(); const A = ctx.plan.anchors();
  const U = 1e-6, V3 = kit.V3, ss = kit.ss;
  const P = {}; for (const n of ['cells_pre', 'cells_post', 'cells_org', 'cells_far', 'cells_farpre', 'cells_bg', 'cells_mass']) Object.assign(P, await loadPack(ctx, 'synapse/' + n));
  const PR = await loadPack(ctx, 'synapse/proteins', 1e-3); const LY = await ctx.fetchJSON('synapse/layout.json'); const PL = await ctx.fetchJSON('synapse/psd_layout.json'); const OL = await ctx.fetchJSON('synapse/org_layout.json');
  const YP = -0.0065, YQ = YP + 0.023, MEM = 0.0048, YR = YP - 0.00115; // YR: receptor frame origin (its membrane-top reference) sits 1.15 nm below the outer headgroup surface
  // perisynaptic / extrasynaptic cleft: the 23 nm gap is crowded with adhesion molecules and receptors well beyond the PSD (neurexin-neuroligin, N-cadherin, extrasynaptic AMPAR / NMDAR, ~1 per 15-20 nm); extra instances of the same real PDB meshes fill the cleft out to 0.55 um behind the section
  { const rx = timeline.rng(404); const occ = [...LY.ampar, ...LY.nmdar, ...LY.nlnx, ...(LY.cad || []), ...PL.nlnx2, ...PL.cad2].map((r) => [r[0], r[1]]);
    const place = (n, minsep, r0, push) => { let k = 0; for (let t = 0; t < 60000 && k < n; t++) { const x = (rx() * 2 - 1) * 0.58, z = -rx() * 0.52 + 0.004; if (Math.hypot(x, z) < r0) continue; if (occ.some((o) => (o[0] - x) ** 2 + (o[1] - z) ** 2 < minsep * minsep)) continue; occ.push([x, z]); push(x, z, rx() * 6.283, rx() * 0.45); k++; } };
    place(34, 0.021, 0.15, (x, z, a) => LY.ampar.push([x, z, a])); place(9, 0.024, 0.15, (x, z, a) => LY.nmdar.push([x, z, a])); place(150, 0.0165, 0.12, (x, z, a, t) => PL.nlnx2.push([x, z, a, t])); place(40, 0.021, 0.12, (x, z, a, t) => PL.cad2.push([x, z, a, t])); }
  const add = (g, mat, parent = group, name) => { const m = new T.Mesh(g, mat); m.userData.name = name; m.scale.setScalar(U); m.frustumCulled = false; parent.add(m); return m; };
  const iadd = (g, mat, n, parent = group, name) => { const m = new T.InstancedMesh(g, mat, n); m.userData.name = name; m.scale.setScalar(U); m.frustumCulled = false; parent.add(m); return m; };
  const _m = new T.Matrix4(), _q = new T.Quaternion(), _p = new T.Vector3(), _s = new T.Vector3(), _e = new T.Euler(), Y = new T.Vector3(0, 1, 0), _c = new T.Color();
  const setM = (im, i, x, y, z, q, sx, sy, sz) => { _p.set(x, y, z); _s.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz); _m.compose(_p, q, _s); im.setMatrixAt(i, _m); };
  const qy = (a) => new T.Quaternion().setFromAxisAngle(Y, a);
  const qdir = (d) => new T.Quaternion().setFromUnitVectors(Y, d.clone().normalize());
  // instance sets with distance windows: only the instances whose centre lies in [r0, r1) of the focus are submitted (compacted into the first `count` slots)
  class IS {
    constructor(meshes, n) { this.ms = meshes; this.n = n; this.mat = new Float32Array(n * 16); this.col = new Float32Array(n * 3).fill(1); this.pos = new Float32Array(n * 3); this.slot = meshes.map(() => new Int32Array(n).fill(-1)); this.key = meshes.map(() => ''); meshes.forEach((m) => { m.setColorAt(0, _c.setRGB(1, 1, 1)); m.count = 0; }); }
    set(i, x, y, z, q, sx, sy, sz, cy) { _p.set(x, y, z); _s.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz); _m.compose(_p, q, _s); _m.toArray(this.mat, i * 16); this.pos[i * 3] = x; this.pos[i * 3 + 1] = cy === undefined ? y : cy; this.pos[i * 3 + 2] = z; this.key = this.key.map(() => ''); }
    color(i, r, g, b) { this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b; this.ms.forEach((m, j) => { const sl = this.slot[j][i]; if (sl >= 0) { m.instanceColor.setXYZ(sl, r, g, b); m.instanceColor.needsUpdate = true; } }); }
    ring(j, f, r0, r1) {
      const m = this.ms[j], kk = r0.toFixed(4) + '|' + r1.toFixed(4) + '|' + Math.round(f[0] * 300) + '|' + Math.round(f[1] * 300) + '|' + Math.round(f[2] * 300); if (kk === this.key[j]) return; this.key[j] = kk;
      const sl = this.slot[j]; sl.fill(-1); let k = 0; const ia = m.instanceMatrix.array, ca = m.instanceColor.array;
      if (r1 > r0) for (let i = 0; i < this.n; i++) { const dx = this.pos[i * 3] - f[0], dy = this.pos[i * 3 + 1] - f[1], dz = this.pos[i * 3 + 2] - f[2]; const d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d < r0 || d >= r1) continue; ia.set(this.mat.subarray(i * 16, i * 16 + 16), k * 16); ca[k * 3] = this.col[i * 3]; ca[k * 3 + 1] = this.col[i * 3 + 1]; ca[k * 3 + 2] = this.col[i * 3 + 2]; sl[i] = k++; }
      m.count = k; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  }
  const R = timeline.rng(5);
  const flat = (o) => secMat(Object.assign({ noBand: true, unlit: true }, o));
  // ---------- materials ----------
  const mat = {
    pre: secMat({ color: 0x4cc9b6, inner: 0x2bb5a5, noBand: true, lip: true, unlit: true, depthK: 0.5, depth: 3.5e-7, surf: 0.3 }), post: secMat({ color: 0xe6ae92, inner: 0xdc9a74, noBand: true, lip: true, glow: true, unlit: true, depthK: 0.5, depth: 3.5e-7, surf: 0.3 }),
    psd: secMat({ color: 0x4d43b8, inner: 0x4a3fb0, noBand: true, unlit: true, depthK: 0.45, depth: 4e-8 }), astro: secMat({ color: 0x6f7be8, inner: 0x5d69dc, noBand: true, unlit: true, depthK: 0.5, depth: 1.5e-7, rings: 0.6, edge: [0.38, 0.64] }),
    mitoO: secMat({ color: 0xffc27a, inner: 0xeb9a34, noBand: true, unlit: true, depthK: 0.5, depth: 1e-7 }), mitoC: secMat({ color: 0xffe0a8, inner: 0xffdba0, noBand: true, unlit: true, depthK: 0.35, depth: 5e-8 }),
    er: secMat({ color: 0xc9c0ff, inner: 0xb3a8fa, noBand: true, unlit: true, depthK: 0.4, depth: 6e-8 }),
    massPost: flat({ vc: true, xtoon: 1, color: 0xffffff, innerK: 0.8, noise: 1.0, unlitK: 0.95, depthK: 0.4, depth: 1.6e-8, bshade: 0.85 }),
    ves: flat({ xtoon: 1, color: 0xf3ecff, inner: 0xf6dcb4, noBand: true, unlitK: 1.0, depthK: 0.12, depth: 2e-8, bshade: 0.75 }),
    prot: flat({ vc: true, xtoon: 1, color: 0xffffff, innerK: 0.8, noise: 0.45, unlitK: 0.95, depthK: 0.35, depth: 4.5e-9, bshade: 0.85 }),
    mass: flat({ vc: true, xtoon: 1, color: 0xffffff, innerK: 0.8, noise: 1.0, unlitK: 0.95, depthK: 0.4, depth: 1.6e-8, bshade: 0.8 }),
    slabTop: secMat({ color: 0x4cc9b6, inner: 0x23a89a, noBand: true, holes: true }), slabBot: secMat({ color: 0x4cc9b6, inner: 0x23a89a, noBand: true, holes: true, lip: true }),
  };
  const NEU_CUT = new T.Color().setRGB(232 / 255, 176 / 255, 148 / 255, T.SRGBColorSpace), NEU_EDGE = new T.Color().setRGB(185 / 255, 148 / 255, 146 / 255, T.SRGBColorSpace);   // what neuron.js renders for the cut face of the dendrite (face-on / grazing), measured with no signal on it
  const ctxMats = []; const ctxMat = (m) => { ctxMats.push(m); return m; };
  const matFar = ctxMat(secMat({ xtoon: 1, color: 0xe6ae92, inner: 0xdc9a74, noBand: true, lip: true, unlit: true, depthK: 0.5, depth: 3.5e-7, rings: 1, surf: 0.7 })), matFarPre = ctxMat(secMat({ xtoon: 1, color: 0x4cc9b6, inner: 0x2bb5a5, noBand: true, lip: true, unlit: true, depthK: 0.5, depth: 3.5e-7, rings: 1, surf: 0.7 }));
  // ---------- cell bodies ----------
  const psdMass = add(P.psd_mass.geo, mat.massPost, group, 'psdmass'), azMass = add(P.az_mass.geo, mat.mass, group, 'azmass'), psdEnv = add(P.psd_env.geo, mat.massPost, group, 'psdenv'), azEnv = add(P.az_env.geo, mat.mass, group, 'azenv');
  const farOrg = []; add(P.pre.geo, mat.pre); farOrg.push(add(P.axon.geo, mat.pre)); add(P.post.geo, mat.post); 
  add(P.astro.geo, mat.astro); add(P.mito_pre.geo, mat.mitoO); add(P.mito_pre_cr.geo, mat.mitoC); farOrg.push(add(P.mito_post.geo, mat.mitoO), add(P.mito_post_cr.geo, mat.mitoC));
  farOrg.push(add(P.er_post.geo, mat.er)); add(P.er_pre.geo, mat.er);
  const ctxMeshes = [add(P.farL.geo, matFar), add(P.farR.geo, matFar), add(P.farpre.geo, matFarPre)];
  const bgMat = ctxMat(secMat({ xtoon: 1, color: 0xffffff, vc: true, noBand: true, innerK: 1, noise: 0, surf: 0.65 })); const bgMesh = add(P.bg.geo, bgMat, group, 'bg');
  // active-zone membrane patch with holes (fusion pores): a 4 nm slab disc at the flat part of the presynaptic membrane
  { const cg = new T.CircleGeometry(0.212, 72); cg.rotateX(-Math.PI / 2); const top = cg.clone().translate(0, YQ + MEM, 0), bot = cg.clone().translate(0, YQ, 0);
    add(top, mat.slabTop); add(bot, mat.slabBot); }
  // exact straight section ribbon across the active zone (with fusion-pore gaps)
  const azR = new T.BufferGeometry(); { const x = 0.216, y = YQ + MEM / 2, zz = -0.00013; azR.setAttribute('position', new T.BufferAttribute(new Float32Array([-x, y, zz, -x, y, zz, x, y, zz, x, y, zz]), 3)); azR.setAttribute('normal', new T.BufferAttribute(new Float32Array([0, 1, 1, 0, 1, -1, 0, 1, 1, 0, 1, -1]), 3)); azR.setIndex([0, 1, 2, 1, 3, 2]); }
  // section ribbons: the cut bilayer (4 nm: 0.9 head / 2.2 tail / 0.9 head) as geometry in the cut plane; widths are floored at ~1 px
  const ribA = ribbonMat(0xf1dcb8, 0.0024, 0.8, false), ribB = ribbonMat(0x3b2f8f, 0.0015, 0, true); ribB.polygonOffset = true; ribB.polygonOffsetFactor = -2;
  const ribAh = ribbonMat(0xf1dcb8, 0.0024, 0.8, false, true, false, YQ), ribBh = ribbonMat(0x3b2f8f, 0.0015, 0, true, true, false, YQ); ribBh.polygonOffset = true; ribBh.polygonOffsetFactor = -2;
  const ribAg = ribbonMat(0xf1dcb8, 0.0024, 0.8, false, false, true), ribBg = ribbonMat(0x3b2f8f, 0.0015, 0, true, false, true); ribBg.polygonOffset = true; ribBg.polygonOffsetFactor = -2;
  const withArc = (g) => { if (g.attributes.aS) return g; const pos = g.attributes.position.array, n = g.attributes.position.count, a = new Float32Array(n); let acc = 0; for (let v = 0; v < n; v += 2) { if (v >= 2) acc += Math.hypot(pos[v * 3] - pos[(v - 2) * 3], pos[v * 3 + 1] - pos[(v - 2) * 3 + 1]); a[v] = acc; if (v + 1 < n) a[v + 1] = acc; } g.setAttribute('aS', new T.BufferAttribute(a, 1)); return g; };
  for (const k of Object.keys(P)) if (k.startsWith('rib_')) withArc(P[k].geo); withArc(azR);
  const ctxRib = []; const ribFA = ribbonMat(0xf1dcb8, 0.0024, 0.8, false), ribFB = ribbonMat(0x3b2f8f, 0.0015, 0, true); ribFB.polygonOffset = true; ribFB.polygonOffsetFactor = -2; ctxRib.push(ribFA, ribFB);
  for (const k of Object.keys(P)) if (k.startsWith('rib_')) { const far = /^rib_far/.test(k); if (far) continue; const a = far ? ribFA : (k === 'rib_pre' ? ribAh : (k === 'rib_post' ? ribAg : ribA)), b = far ? ribFB : (k === 'rib_pre' ? ribBh : (k === 'rib_post' ? ribBg : ribB)); const m1 = add(P[k].geo, a); const m = add(P[k].geo, b); m.renderOrder = 2; if (far) ctxMeshes.push(m1, m); if (/^rib_(axon|mito_post|er_post)/.test(k)) farOrg.push(m1, m); }
  { add(azR, ribAh); const m = add(azR, ribBh); m.renderOrder = 2; }
  // dendrite shaft continued beyond the meshed neighbourhood (same radius law as the meshed shaft) so it never ends inside the field of view
  const polyRibbon = (P2) => { const n = P2.length, pos = new Float32Array(n * 6), nr = new Float32Array(n * 6), ix = []; for (let i = 0; i < n; i++) { const a = P2[Math.max(0, i - 1)], b = P2[Math.min(n - 1, i + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l; for (let sd = 0; sd < 2; sd++) { const q = (2 * i + sd) * 3; pos[q] = P2[i][0]; pos[q + 1] = P2[i][1]; pos[q + 2] = -0.00013; nr[q] = ty; nr[q + 1] = -tx; nr[q + 2] = sd ? -1 : 1; } if (i < n - 1) ix.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2); } const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nr, 3)); g.setIndex(ix); return withArc(g); };
  const shaftExt = (xa, xb) => { const NX = Math.ceil((xb - xa) / 0.12), NF = 28; const pos = new Float32Array((NX + 1) * (NF + 1) * 3), nrm = new Float32Array((NX + 1) * (NF + 1) * 3), ix = [];
    for (let i = 0; i <= NX; i++) { const x = xa + (xb - xa) * i / NX, r = 0.70 + 0.04 * Math.sin(2 * x); for (let j = 0; j <= NF; j++) { const ph = Math.PI / 2 - 0.05 + (Math.PI + 0.1) * j / NF, c = Math.cos(ph), sn = Math.sin(ph), q = (i * (NF + 1) + j) * 3; pos[q] = x; pos[q + 1] = -2.36 + r * sn; pos[q + 2] = r * c; nrm[q + 1] = sn; nrm[q + 2] = c; if (i < NX && j < NF) { const a = i * (NF + 1) + j, b = (i + 1) * (NF + 1) + j; ix.push(a, a + 1, b, a + 1, b + 1, b); } } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nrm, 3)); g.setIndex(ix); add(g, matFar);
    const up = [], dn = []; for (let i = 0; i <= NX; i++) { const x = xa + (xb - xa) * i / NX, r = 0.70 + 0.04 * Math.sin(2 * x) - 0.0024; up.push([x, -2.36 + r]); dn.push([x, -2.36 - r]); }
    for (const pl of [up, dn]) { const rg = polyRibbon(pl); add(rg, ribA); const m = add(rg, ribB); m.renderOrder = 2; } };
  // (no shaft continuation, no far context cells, no background neuropil: the neuron level draws the dendrite and neighbours itself)
  // windows in the section ribbons where the plane cuts through a membrane protein (their transmembrane cut faces show instead of the lipid pattern)
  { const wp = [], wq = []; const win = (arr, x, z, R) => { if (Math.abs(z) < R && arr.length < 12) arr.push(V3(x, Math.sqrt(R * R - z * z), 0)); };
    LY.ampar.forEach((r) => win(wp, r[0], r[1], 0.0036)); LY.nmdar.forEach((r) => win(wp, r[0], r[1], 0.0045)); LY.cav.forEach((r) => win(wq, r[0], r[1], 0.0050));
    wp.forEach((v, i) => RECS.post.value[i].copy(v)); wq.forEach((v, i) => RECS.pre.value[i].copy(v)); }
  // ---------- receptors & cleft proteins ----------
  const lod = {}; const _qa2 = new T.Quaternion(), _ax2 = new T.Vector3(1, 0, 0);
  const mkRec = (name, list) => { const is = new IS(['xhi', 'hi', 'mid', 'lo'].map((k) => iadd(PR[name + '_' + k].geo, mat.prot, list.length, group, name + '_' + k)), list.length); list.forEach((r, i) => is.set(i, r[0], YR, r[1], qy(r[2] || 0), 1, undefined, undefined, YR + 0.007)); return is; };
  lod.ampar = mkRec('ampar', LY.ampar); lod.nmdar = mkRec('nmdar', LY.nmdar);
  const nlI = (() => { const nl = LY.nlnx.concat(PL.nlnx2); const is = new IS([iadd(PR.nlnx.geo, mat.prot, nl.length, group, 'nlnx')], nl.length); nl.forEach((r, i) => { const tq = r[3] ? qy(r[2]).multiply(_qa2.setFromAxisAngle(_ax2, r[3] * 0.5)) : qy(r[2]); is.set(i, r[0], YP + 0.0018, r[1], tq, 1, undefined, undefined, YP + 0.009); }); return is; })();
  const cavM = iadd(PR.cav22.geo, mat.prot, LY.cav.length, group, 'cav'); LY.cav.forEach((r, i) => setM(cavM, i, r[0], YQ + 0.002, r[1], qy(r[2]), 1));
  // ---------- vesicles ----------
  const sphHi = new T.SphereGeometry(1, 32, 22), sphMid = new T.SphereGeometry(1, 22, 15), sphLo = new T.SphereGeometry(1, 14, 10), sph = sphHi, stg = new T.SphereGeometry(1, 8, 6); const ico = new T.IcosahedronGeometry(1, 0), ico1 = new T.IcosahedronGeometry(1, 1);
  const nV = LY.ves.length; const vesM = iadd(sph, mat.ves, NSLOT, group, 'vesD'); const vesS = new IS([iadd(sph, mat.ves, nV - NSLOT, group, 'vesS')], nV - NSLOT); const VES0 = LY.ves.map((v) => [v[0], v[1], v[2]]);
  VES0.forEach((v, i) => { if (i < NSLOT) setM(vesM, i, v[0], v[1], v[2], _q.identity(), 0.020); else vesS.set(i - NSLOT, v[0], v[1], v[2], _q.identity(), 0.020); });
  const vesC = VES0.map((v) => V3(v[0], v[1], v[2]));
  { const rt = timeline.rng(808); const tint = () => { const k = rt(); return k < 0.4 ? [0.96, 0.93, 1.0] : (k < 0.7 ? [1.0, 0.93, 0.97] : [0.91, 0.95, 1.0]); }; for (let i = 0; i < NSLOT; i++) { const t = tint(); vesM.setColorAt(i, _c.setRGB(t[0], t[1], t[2])); } vesM.instanceColor.needsUpdate = true; for (let i = 0; i < nV - NSLOT; i++) { const t = tint(), b = 0.92 + 0.1 * rt(); vesS.color(i, t[0] * b, t[1] * b, t[2] * b); } }
  // section ribbons of the vesicles the plane cuts: a lipid-patterned bilayer ring (docked slots get their own, hidden while the vesicle fuses)
  const ringGeo = (items) => { const NP = 72, pos = [], nr = [], ix = [], as = []; let base = 0; items.forEach(([cx, cy, rc]) => { let acc = 0; for (let i = 0; i < NP; i++) { const a = i / NP * 6.2832, ca = Math.cos(a), sa = Math.sin(a); if (i) acc += rc * 6.2832 / NP; for (let sd = 0; sd < 2; sd++) { pos.push(cx + rc * ca, cy + rc * sa, -0.00013); nr.push(ca, sa, sd ? -1 : 1); as.push(acc); } const j = (i + 1) % NP; ix.push(base + 2 * i, base + 2 * i + 1, base + 2 * j, base + 2 * i + 1, base + 2 * j + 1, base + 2 * j); } base += 2 * NP; });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3)); g.setAttribute('normal', new T.BufferAttribute(new Float32Array(nr), 3)); g.setAttribute('aS', new T.BufferAttribute(new Float32Array(as), 1)); g.setIndex(ix); return g; };
  const ribAv = ribbonMat(0xe9defa, 0.0024, 0.8, false), ribBv = ribbonMat(0xa99be8, 0.0015, 0, true); ribBv.polygonOffset = true; ribBv.polygonOffsetFactor = -2; const VESRIB = new Set([ribAv, ribBv]);
  const ringMeshes = (items) => { if (!items.length) return null; const g = ringGeo(items); const a = add(g, ribAv); const b = add(g, ribBv); b.renderOrder = 2; return [a, b]; };
  const RV = 0.0203, vesRing = []; { const st = []; VES0.forEach((v, i) => { const zc = Math.abs(v[2]); if (zc < RV - 0.006) { const rc = Math.sqrt(RV * RV - zc * zc) - 0.0024; if (i < NSLOT) vesRing[i] = ringMeshes([[v[0], v[1], rc]]); else st.push([v[0], v[1], rc]); } }); ringMeshes(st); }
  const vaPos = []; vesC.forEach((c, i) => { const k = R() < 0.55 ? 1 : 2; for (let j = 0; j < k; j++) { const th = Math.acos(1 - 2 * R()), ph = R() * 6.283; vaPos.push({ i, n: V3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)), r: R() * 6.283 }); } });
  const vaI = new IS([iadd(PR.vatpase_lo.geo, mat.prot, vaPos.length, group, 'valo')], vaPos.length);
  const vaQ = vaPos.map((p) => qdir(p.n).multiply(qy(p.r)));
  vaPos.forEach((p, k) => vaI.set(k, vesC[p.i].x + p.n.x * 0.019, vesC[p.i].y + p.n.y * 0.019, vesC[p.i].z + p.n.z * 0.019, vaQ[k], 1));
  const studMat = flat({ color: 0xd9c8ff, inner: 0xb9a6f0, depth: 2e-8 }); const NST = 11; const studM = iadd(stg, studMat, NSLOT * NST, group, 'studD'); const studS = new IS([iadd(stg, studMat, (nV - NSLOT) * NST, group, 'studS')], (nV - NSLOT) * NST); const studData = [];
  vesC.forEach((c, i) => { for (let j = 0; j < NST; j++) { const th = Math.acos(1 - 2 * R()), ph = R() * 6.283, n = V3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)); const r = 0.0017 + R() * 0.0008; studData.push([c.x + n.x * 0.0203, c.y + n.y * 0.0203, c.z + n.z * 0.0203, r]); const d = studData[studData.length - 1]; if (i < NSLOT) setM(studM, i * NST + j, d[0], d[1], d[2], _q.identity(), r); else studS.set((i - NSLOT) * NST + j, d[0], d[1], d[2], _q.identity(), r); } });
  const tethM = iadd(kit.unitCyl, flat({ color: 0xffd9a0, inner: 0xe3b36e, depth: 1e-8, noise: 0 }), LY.tether.length);
  LY.tether.forEach((pr, i) => { const a = vesC[pr[0]], b = vesC[pr[1]]; const d = b.clone().sub(a).normalize(); kit.putDir(tethM, i, a.clone().addScaledVector(d, 0.019), b.clone().addScaledVector(d, -0.019), 0.0013); });
  // dense projection of the active zone and SNARE bundles at each docked vesicle
    const snM = iadd(PR.snare.geo, mat.prot, 40); const snData = [];
  for (let d = 0; d < 10; d++) { const dk = LY.dock[d]; for (let j = 0; j < 4; j++) { const a = j / 4 * 6.283 + d, rr = 0.011 + R() * 0.004; const tilt = new T.Quaternion().setFromEuler(_e.set(0.9 * Math.cos(a), 0, -0.9 * Math.sin(a))); const q = qy(R() * 6.283).multiply(tilt); snData.push([dk[0] + Math.cos(a) * rr, YQ + MEM, dk[1] + Math.sin(a) * rr, q]); const s = snData[snData.length - 1]; setM(snM, d * 4 + j, s[0], s[1], s[2], s[3], 1); } }
  // ---------- cytoskeleton ----------
  // tubulin lattice (13 protofilaments x 8 nm dimers) and F-actin (5.5 nm beads) as tube textures; u runs along the tube
  const lattice = (w, h, draw) => { const t = kit.canvasTex(w, h, draw); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; return t; };
  const mtTex = lattice(16, 26, (x, W, H) => { x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); for (let j = 0; j < 13; j++) { x.fillStyle = 'rgba(150,100,70,0.55)'; x.fillRect(0, j * 2, W, 1); for (let i = 0; i < 2; i++) { x.fillStyle = 'rgba(255,255,255,0.9)'; x.fillRect(((i * 8 + j * 3) % 16), j * 2 + 1, 6, 1); } } });
  mtTex.repeat.set(1, 1);
  const actTex = lattice(64, 16, (x, W, H) => { x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); for (let k = 0; k < 2; k++) { x.strokeStyle = 'rgba(176,100,140,0.32)'; x.lineWidth = 3.0; x.beginPath(); for (let i = 0; i <= W; i += 2) { const yy = H / 2 + (H * 0.34) * Math.sin(i / W * 6.283 + k * 3.1416); i ? x.lineTo(i, yy) : x.moveTo(i, yy); } x.stroke(); } });
  const mtMat = flat({ color: 0xffe3c2, inner: 0xe9b98a, depth: 5e-8, map: mtTex }), actMat = flat({ color: 0xf2c6d6, inner: 0xd9a0b8, depth: 2e-8, noise: 0.3, map: actTex });
  const tubeQ = []; const mergeG = (gs) => { let nv = 0, ni = 0; gs.forEach((g) => { nv += g.attributes.position.count; ni += g.index.count; }); const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), ix = new Uint32Array(ni); let vo = 0, io = 0; gs.forEach((g) => { pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3); uv.set(g.attributes.uv.array, vo * 2); const gi = g.index.array; for (let k = 0; k < gi.length; k++) ix[io + k] = gi[k] + vo; vo += g.attributes.position.count; io += gi.length; }); const m = new T.BufferGeometry(); m.setAttribute('position', new T.BufferAttribute(pos, 3)); m.setAttribute('normal', new T.BufferAttribute(nor, 3)); m.setAttribute('uv', new T.BufferAttribute(uv, 2)); m.setIndex(new T.BufferAttribute(ix, 1)); return m; };
  const tubeAlong = (pts, r, material, seg) => { if (pts.length < 4) return null; const c = new T.CatmullRomCurve3(pts.map((p) => V3(p[0], p[1], p[2])), false, 'centripetal'); const g = new T.TubeGeometry(c, seg || Math.max(8, pts.length * 5), r, 13, false); const per = material === mtMat ? 0.008 : 0.037; const rep = c.getLength() / per; const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * rep); tubeQ.push([g, material]); return g; };
  const axC = [[-0.26, 0.50, 0], [-0.72, 0.92, 0], [-1.4, 1.42, -0.03], [-2.4, 1.9, -0.05], [-4.5, 2.55, -0.1], [-7, 3.1, -0.1], [-10, 3.5, -0.12], [-14, 3.8, -0.1], [-18, 4.0, -0.1], [-20.5, 4.1, -0.1]];
  // axonal microtubules stop in the axon neck (MTs do not enter the terminal beyond the first ~0.3 um: Hirokawa 1982), capped at the plus-end; they never cross the bouton mitochondrion
  [[0.0, -0.025], [0.035, -0.045], [-0.03, -0.015]].forEach(([dy, dz], k) => { const st = [-0.54 - 0.06 * k, 0.756 + 0.055 * k + dy, dz]; tubeAlong([st, ...axC.slice(1).map((p) => [p[0], p[1] + dy, p[2] + dz])], 0.0125, mtMat, 160); const cg = new T.SphereGeometry(0.0125, 12, 8); cg.translate(st[0], st[1], st[2]); tubeQ.push([cg, mtMat]); });
  LY.actin_pre.forEach((a) => tubeAlong(a, 0.0030, actMat)); LY.actin.forEach((a) => tubeAlong(a, 0.0030, actMat));
  [[0.33, -0.02], [0.47, -0.2], [0.22, -0.38], [-0.52, -0.1], [-0.36, -0.36], [0.02, -0.52], [-0.05, 0.0]].forEach(([dy, dz], k) => { const pts = []; for (let x = -32; x <= 28; x += 2.0) pts.push([x, -2.36 + dy + 0.03 * Math.sin(x * 0.7 + k), dz + 0.04 * Math.cos(x * 0.5 + k * 2)]); tubeAlong(pts, 0.0125, mtMat, 160); });
  const mitoFar = secMat({ color: 0xffc27a, inner: 0xeb9a34, unlit: true, depthK: 0.5, depth: 1e-7, bandHi: 1 }); const FM = [[-11.5, -2.55, -0.1, 1.4], [-6.3, -2.2, -0.08, 0.9], [-2.9, -2.6, -0.1, 1.1], [3.4, -2.3, -0.1, 1.6], [7.8, -2.5, -0.1, 1.0], [-20, -2.4, -0.1, 1.8], [16, -2.4, -0.1, 1.5]];
  FM.forEach((m, i) => { const cg = new T.CapsuleGeometry(0.2 + 0.03 * (i % 3), m[3], 6, 18); cg.rotateZ(Math.PI / 2); cg.translate(m[0], m[1], m[2]); add(cg, mitoFar); });
  { // cristae of the dendritic mitochondria: alternating lamellae springing from the inner boundary membrane (instanced flattened ellipsoids)
    let nC = 0; FM.forEach((m) => { nC += Math.floor((m[3] - 0.05) / 0.058) + 1; }); const crM = iadd(sphLo, mat.mitoC, nC, group, 'farcristae'); let ci = 0; const rc = timeline.rng(61);
    FM.forEach((m, i) => { const rad = 0.2 + 0.03 * (i % 3), L2 = m[3]; for (let s = -L2 / 2 + 0.06, k = 0; s < L2 / 2 - 0.02 && ci < nC; s += 0.058, k++) { const side = k % 2 ? 1 : -1; const e = new T.Euler((rc() - 0.5) * 0.25, 0, (rc() - 0.5) * 0.2); _q.setFromEuler(e); setM(crM, ci++, m[0] + s, m[1] + side * rad * 0.42, m[2], _q, 0.0045, rad * 0.62, rad * 0.78); } }); crM.count = ci; }
  const glyM = iadd(ico1, flat({ color: 0x3c46b8, inner: 0x3c46b8, depth: 1e-8, noise: 0.2 }), OL.glycogen.length * 2, group, 'glyc'); OL.glycogen.forEach((p, i) => { setM(glyM, 2 * i, p[0], p[1], p[2], _q.identity(), 0.0125); setM(glyM, 2 * i + 1, p[0] + 0.011, p[1] + 0.006, p[2] - 0.004, _q.identity(), 0.009); });
  const ribFreeMat = flat({ color: 0xf6d6c3, inner: 0xd8a98c, depth: 3e-8 }); const riboF = iadd(ico1, ribFreeMat, LY.ribo_free.length * 2, group, 'ribofree');
  LY.ribo_free.forEach((p, i) => { setM(riboF, 2 * i, p[0], p[1], p[2], _q.identity(), 0.0125, 0.0105, 0.0120); setM(riboF, 2 * i + 1, p[0] + 0.0075, p[1] + 0.011, p[2] + 0.002, _q.identity(), 0.0082); });
  const endoM = iadd(sph, flat({ xtoon: 1, color: 0xf3ecff, inner: 0xf6dcb4, noBand: false, unlitK: 1.0, depthK: 0.12, depth: 2e-8, bshade: 0.75 }), LY.endo.length, group, 'endo'); LY.endo.forEach((p, i) => setM(endoM, i, p[0], p[1], p[2], _q.identity(), 0.026 + 0.008 * (i % 3)));
  { const NR = 520, shR = iadd(ico, ribFreeMat, NR * 2, group, 'shaftribo'); let k = 0; for (let t = 0; t < 4000 && k < NR; t++) { const x = -5 + 10 * R(), a = R() * 6.283, r = 0.66 * Math.sqrt(R()); const y = -2.36 + r * Math.cos(a), z = -Math.abs(r * Math.sin(a)) - 0.05; if (FM.some((m) => Math.abs(x - m[0]) < m[3] * 0.5 + 0.35 && Math.abs(y - m[1]) < 0.4)) continue; setM(shR, 2 * k, x, y, z, _q.identity(), 0.0125, 0.0105, 0.012); setM(shR, 2 * k + 1, x + 0.0075, y + 0.011, z + 0.002, _q.identity(), 0.0082); k++; } shR.count = 2 * k; var shaftRibo = shR; }
  const ribMat = flat({ color: 0xf6d6c3, inner: 0xd8a98c, depth: 3e-8 }); const ribM = iadd(ico1, ribMat, LY.polyrib.length * 2, group, 'rib');
  LY.polyrib.forEach((p, i) => { setM(ribM, 2 * i, p[0], p[1], p[2], _q.identity(), 0.0125, 0.0115, 0.0125); setM(ribM, 2 * i + 1, p[0] + 0.006, p[1] + 0.012, p[2] + 0.003, _q.identity(), 0.0085); });
  tubeAlong(LY.polyrib.map((p) => [p[0], p[1] + 0.003, p[2]]), 0.0012, actMat, 40);
  for (const mt of [mtMat, actMat]) { const gs = tubeQ.filter((q) => q[1] === mt).map((q) => q[0]); if (gs.length) add(mergeG(gs), mt); }
  // ---------- postsynaptic density: scaffold proteins, receptor tails, CaMKII ----------
  let mu13 = null;
  const cam = iadd(PR.camkii.geo, mat.prot, PL.camkii.length); PL.camkii.forEach((p, i) => setM(cam, i, p[0], YP - 0.062, p[1], qy(i), 1));
  { const BASEY = YQ + MEM; const nm13 = LY.dock.length * 6; const mu = new IS([iadd(PR.munc13.geo, mat.prot, nm13, group, 'munc13')], nm13); mu13 = mu; let k = 0;
    LY.dock.forEach((d, di) => { for (let q = 0; q < 6; q++) { const a = q / 6 * 6.283 + di * 0.7 + R() * 0.4, rr = 0.027 + R() * 0.004; const fx = d[0] + Math.cos(a) * rr, fz = d[1] + Math.sin(a) * rr; const tg = V3(d[0] + Math.cos(a) * 0.0195, BASEY + 0.0135, d[1] + Math.sin(a) * 0.0195); const dir = tg.clone().sub(V3(fx, BASEY, fz)); mu.set(k, fx, BASEY - 0.0005, fz, qdir(dir).multiply(qy(R() * 6.283)), 1, undefined, undefined, BASEY + 0.008); k++; } }); }
  const TOPY = YP - MEM - 0.0008; const p95 = new IS([iadd(PR.psd95.geo, mat.prot, PL.psd95.length, group, 'psd95'), iadd(PR.psd95_lo.geo, mat.prot, PL.psd95.length, group, 'psd95lo')], PL.psd95.length); PL.psd95.forEach((r, i) => p95.set(i, r[0], TOPY, r[1], qy(r[2]), 1, undefined, undefined, TOPY - 0.005));
  const cadAll = LY.cad.map((c) => [c[0], c[1], 0]).concat(PL.cad2); const cadI = iadd(PR.cad.geo, mat.prot, cadAll.length, group, 'cad'); const _qa = new T.Quaternion(); const _ax = new T.Vector3(1, 0, 0);
  cadAll.forEach((c, i) => { const tilt = c[3] === undefined ? 0.3 : c[3] + 0.1; const az = (c[2] || i * 1.9); const qq = qy(az).multiply(_qa.setFromAxisAngle(_ax, tilt)); setM(cadI, i, c[0], YP + 0.0012, c[1], qq, 1); cadI.setColorAt(i, _c.setRGB(1, 1, 1)); });
  // ---------- fusion machinery: omega lathes (+ their section ribbons) for the docked slots ----------
  const NT = 13, NP = 27; const omega = [];
  const omMat = flat({ xtoon: 1, color: 0xf3ecff, inner: 0xf6dcb4, noBand: true, unlitK: 1.0, depthK: 0.1, depth: 2e-8, bshade: 0.75 });
  const omRibA = ribbonMat(0xf1dcb8, 0.0024, 0.8, false), omRibB = ribbonMat(0x3b2f8f, 0.0015, 0, true); omRibB.polygonOffset = true; omRibB.polygonOffsetFactor = -2;
  for (let k = 0; k < NSLOT; k++) {
    const g = new T.BufferGeometry(); const pos = new Float32Array(NP * (NT + 1) * 3), nrm = new Float32Array(NP * (NT + 1) * 3); const idx = [];
    for (let j = 0; j < NT; j++) for (let i = 0; i < NP - 1; i++) { const a = j * NP + i, b = (j + 1) * NP + i; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nrm, 3)); g.setIndex(idx);
    const mesh = add(g, omMat); mesh.visible = false;
    const NR = 2 * NP - 1; const rp = new Float32Array(NR * 2 * 3), rn = new Float32Array(NR * 2 * 3), ri = []; for (let i = 0; i < NR - 1; i++) ri.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.BufferAttribute(rp, 3)); rg.setAttribute('normal', new T.BufferAttribute(rn, 3)); rg.setAttribute('aS', new T.BufferAttribute(new Float32Array(NR * 2), 1)); rg.setIndex(ri);
    const ra = add(rg, omRibA), rb = add(rg, omRibB); rb.renderOrder = 2; ra.visible = rb.visible = false;
    omega.push({ g, mesh, rg, ra, rb, x: LY.dock[k][0], z: LY.dock[k][1] });
  }
  function shapeOmega(o, s, dy) {
    const pr = profile(s, NP - 1 - 12).pts; // arc + fillet + plane = NP points
    const yb = YQ + OM.YM + dy; const pos = o.g.attributes.position.array; const half = pr.slice(0, NP);
    while (half.length < NP) half.push([half[half.length - 1][0] + 0.0085, 0]);
    for (let j = 0; j <= NT; j++) { const th = Math.PI + (j / NT) * Math.PI; const c = Math.cos(th), sn = Math.sin(th); for (let i = 0; i < NP; i++) { const q = (j * NP + i) * 3; pos[q] = o.x + half[i][0] * c; pos[q + 1] = yb + half[i][1]; pos[q + 2] = o.z + half[i][0] * sn; } }
    o.g.attributes.position.needsUpdate = true; o.g.computeVertexNormals();
    // ribbon: left plane -> apex -> right plane in the section plane z = 0 (centreline = midplane)
    const rp = o.rg.attributes.position.array, rn = o.rg.attributes.normal.array; const full = []; for (let i = NP - 1; i >= 1; i--) full.push([o.x - half[i][0], yb + half[i][1]]); for (let i = 0; i < NP; i++) full.push([o.x + half[i][0], yb + half[i][1]]);
    for (let i = 0; i < full.length; i++) { const a = full[Math.max(0, i - 1)], b = full[Math.min(full.length - 1, i + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      for (let sd = 0; sd < 2; sd++) { const q = (2 * i + sd) * 3; rp[q] = full[i][0]; rp[q + 1] = full[i][1]; rp[q + 2] = -0.00013; rn[q] = ty; rn[q + 1] = -tx; rn[q + 2] = sd ? -1 : 1; } }
    { const as = o.rg.attributes.aS.array; let acc = 0; for (let i = 0; i < full.length; i++) { if (i) acc += Math.hypot(full[i][0] - full[i - 1][0], full[i][1] - full[i - 1][1]); as[2 * i] = as[2 * i + 1] = acc + o.x; } o.rg.attributes.aS.needsUpdate = true; }
    o.rg.attributes.position.needsUpdate = true; o.rg.attributes.normal.needsUpdate = true;
  }
  // ---------- glutamate: ~500 molecules per released vesicle ----------
  const NPT = 16000; const ptG = new T.BufferGeometry(); const ptPos = new Float32Array(NPT * 3), ptCol = new Float32Array(NPT * 3);
  ptG.setAttribute('position', new T.BufferAttribute(ptPos, 3)); ptG.setAttribute('color', new T.BufferAttribute(ptCol, 3));
  const pts = kit.glowPoints(ptG, 3.2, 1, true); pts.scale.setScalar(U); pts.frustumCulled = false; pts.renderOrder = 5; group.add(pts); const ptMat = pts.material;
  const recs = [...LY.ampar.map((r) => ({ x: r[0], z: r[1], kind: 0 })), ...LY.nmdar.map((r) => ({ x: r[0], z: r[1], kind: 1 }))];
  const hsh = timeline.hash;
  function updateSignal(S, c) {
    const ev = activeEvents(S); const slotEv = new Array(NSLOT).fill(null); let np = 0; const act = new Float32Array(recs.length);
    let maxA = 9, lastKey = null;
    for (const e of ev) {
      const site = LY.dock[e.slot]; const st = fusionState(e.a);
      if (e.a < 1.2 && (!slotEv[e.slot] || slotEv[e.slot].a > e.a)) slotEv[e.slot] = Object.assign({}, e, st);
      // glutamate molecules: leave the pore at a = 0.12, cross 23 nm in ~0.3 s display time, bind receptors or hover and clear
      const nPart = e.strength > 0.9 ? 900 : 220; const t0 = 0.12;
      if (e.a > t0 && e.a < t0 + 1.05) for (let p = 0; p < nPart && np < NPT; p++) {
        const h1 = hsh(e.id, p, 1), h2 = hsh(e.id, p, 2), h3 = hsh(e.id, p, 3), h4 = hsh(e.id, p, 4);
        const delay = h1 * 0.18, T0 = 0.2 + 0.2 * h2, u = Math.min(1, Math.max(0, (e.a - t0 - delay) / T0)); if (e.a - t0 - delay < 0) continue;
        const sx = site[0] + (h3 - 0.5) * 0.012, sz = site[1] - Math.abs(h4 - 0.5) * 0.012;
        let tx, ty, tz;
        if (h1 < 0.55) { // binds a receptor ligand-binding domain near the release site
          let best = -1, bd = 1e9; const k0 = Math.floor(h2 * recs.length); for (let q = 0; q < 6; q++) { const r = recs[(k0 + q * 7) % recs.length]; const d = (r.x - site[0]) ** 2 + (r.z - site[1]) ** 2; if (d < bd) { bd = d; best = (k0 + q * 7) % recs.length; } }
          const r = recs[best]; tx = r.x + (h3 - 0.5) * 0.008; tz = r.z + (h4 - 0.5) * 0.008 - 0.002; ty = YP + 0.0042 + h2 * 0.0025 + (r.kind ? 0.002 : 0);
        } else { tx = site[0] + (h3 - 0.5) * 0.16; tz = site[1] - h4 * 0.1; ty = YP + 0.0015 + h2 * 0.006; }
        const e2 = 1 - (1 - u) * (1 - u); const wob = 0.0045 * (1 - u) * Math.sin(6.283 * (3 * u + h1 * 7));
        ptPos[np * 3] = sx + (tx - sx) * e2 + wob; ptPos[np * 3 + 1] = YQ - 0.0012 + (ty - (YQ - 0.0012)) * e2 + wob * 0.6; ptPos[np * 3 + 2] = Math.min(-0.0004, sz + (tz - sz) * e2 + wob * 0.5);
        const fade = e.a - t0 - delay - T0 > 0 ? Math.max(0, 1 - (e.a - t0 - delay - T0) / (h1 < 0.55 ? 0.7 : 0.3)) : 1;
        ptCol[np * 3] = 1.0 * fade; ptCol[np * 3 + 1] = 0.66 * fade; ptCol[np * 3 + 2] = 0.16 * fade; np++;
      }
      // receptor activation by this event
      const arr = e.a - 0.34; if (arr > 0) { const k = (arr < 0.12 ? ss(0, 0.12, arr) : Math.exp(-(arr - 0.12) / 0.55)) * e.strength; for (let i = 0; i < recs.length; i++) { const d2 = (recs[i].x - site[0]) ** 2 + (recs[i].z - site[1]) ** 2; act[i] += k * Math.exp(-d2 / (2 * 0.05 * 0.05)) * (recs[i].kind ? 0.65 : 1); } }
      if (e.strength > 0.9 && e.a < maxA) { maxA = e.a; }
    }
    for (let i = np; i < NPT; i++) { ptCol[i * 3] = ptCol[i * 3 + 1] = ptCol[i * 3 + 2] = 0; ptPos[i * 3 + 1] = 5; }
    ptG.attributes.position.needsUpdate = true; ptG.attributes.color.needsUpdate = true; ptMat.size = Math.min(16, Math.max(2.6, 0.6e-9 / SEC.px * 1.6)); ptMat.opacity = 1 - 0.78 * ss(-7.0, -5.8, Math.log10(c.W));
    for (let i = 0; i < recs.length; i++) { const a = Math.min(1, act[i]); const L = recs[i].kind ? lod.nmdar : lod.ampar; const k = recs[i].kind ? i - LY.ampar.length : i; L.color(k, 1 + 0.55 * a, 1 + 0.22 * a, 1 - 0.45 * a); }
    // slots: vesicle -> pore -> omega -> collapse -> refill
    let changed = false;
    for (let k = 0; k < NSLOT; k++) { const ev1 = slotEv[k]; const o = omega[k]; const hole = HOLES.value[k];
      if (!ev1) { if (o.state !== 0) { o.state = 0; if (vesRing[k]) vesRing[k].forEach((m) => { m.visible = true; }); o.mesh.visible = o.ra.visible = o.rb.visible = false; hole.set(0, 0, 0); setM(vesM, k, VES0[k][0], VES0[k][1], VES0[k][2], _q.identity(), 0.020); changed = true; for (let j = 0; j < NST; j++) { const d = studData[k * NST + j]; setM(studM, k * NST + j, d[0], d[1], d[2], _q.identity(), d[3]); } studM.instanceMatrix.needsUpdate = true; for (let j = 0; j < 4; j++) { const s = snData[k * 4 + j]; setM(snM, k * 4 + j, s[0], s[1], s[2], s[3], 1); } snM.instanceMatrix.needsUpdate = true; vesM.instanceMatrix.needsUpdate = true; } continue; }
      if (ev1.hidden) { if (o.state !== 1) { o.state = 1; if (vesRing[k]) vesRing[k].forEach((m) => { m.visible = false; }); setM(vesM, k, 0, 0, 0, _q.identity(), 0); vesM.instanceMatrix.needsUpdate = true; for (let j = 0; j < NST; j++) setM(studM, k * NST + j, 0, 0, 0, _q.identity(), 0); studM.instanceMatrix.needsUpdate = true; for (let j = 0; j < 4; j++) setM(snM, k * 4 + j, 0, 0, 0, _q.identity(), 0); snM.instanceMatrix.needsUpdate = true; }
        const s = ev1.s; const dy = 0.0065 * (1 - ss(0, 0.12, s)); shapeOmega(o, s, dy); o.mesh.visible = o.ra.visible = o.rb.visible = ev1.lathe && s < 0.985; hole.set(o.x, o.z, ev1.lathe ? holeRadius(s) : 0); }
      else { // refill: a reserve vesicle slides into the empty slot
        if (o.state !== 2 || true) { o.state = 2; o.mesh.visible = o.ra.visible = o.rb.visible = false; hole.set(0, 0, 0); const r = ss(0, 1, ev1.refill); const y = VES0[k][1] + 0.04 * (1 - r); setM(vesM, k, VES0[k][0], y, VES0[k][2], _q.identity(), 0.020 * ss(0, 0.5, r)); vesM.instanceMatrix.needsUpdate = true;
          for (let j = 0; j < NST; j++) { const d = studData[k * NST + j]; setM(studM, k * NST + j, d[0], d[1] + 0.04 * (1 - r), d[2], _q.identity(), d[3] * ss(0, 0.5, r)); } studM.instanceMatrix.needsUpdate = true; if (r > 0.95) { for (let j = 0; j < 4; j++) { const s = snData[k * 4 + j]; setM(snM, k * 4 + j, s[0], s[1], s[2], s[3], 1); } snM.instanceMatrix.needsUpdate = true; } } }
    }
    // depolarisation: amber glow on the spine membrane spreading from the PSD down the neck into the dendrite
    let front = -1, amp = 0, base = 0; for (const e of ev) if (e.strength > 0.9) { const w = e.a - 0.4; if (w > 0 && w < 2.2) { const a2 = (1 - ss(0.4, 2.2, w)); if (a2 > amp) { amp = a2; front = w * 1.6e-6; } } if (e.a < 0.9) base = Math.max(base, 0.5 * Math.exp(-e.a / 0.35)); }
    SEC.glow.value.set(front, amp * 0.55, 0.22e-6, base); SEC.glowC.value.set(0, YP * 1e-6, 0, 0.5e-6);
  }
  // ---------- cleft depth haze: stacked billboards of adhesion molecules / receptors / glycocalyx fill the far cleft (see synapse/haze.js) ----------
  const HZ = makeHaze(T, kit, timeline.rng, YP, YQ, SEC.plane); const hazeMeshes = HZ.layers.map((L, i) => { const m = add(HZ.geo(L.z), L.mat, group, 'cleafhaze' + i); m.renderOrder = -10 + i; return m; });
  // ---------- outer lipid headgroups of the postsynaptic bilayer as real instanced spheres (hex lattice 0.72 nm), skipped under every transmembrane protein ----------
  const HG = []; { const a = 0.00072, rz = a * 0.866; const foot = [...LY.ampar.map((r) => [r[0], r[1], 0.0037]), ...LY.nmdar.map((r) => [r[0], r[1], 0.0045]), ...LY.nlnx.map((r) => [r[0], r[1], 0.0024]), ...(LY.cad || []).map((r) => [r[0], r[1], 0.0022])];
    for (let j = 0; ; j++) { const z = -0.0006 - j * rz; if (z < -0.15) break; for (let i = -150; i <= 150; i++) { const x = (i + (j & 1) * 0.5) * a; let ok = true; for (const f of foot) { const dx = x - f[0], dz = z - f[1]; if (dx * dx + dz * dz < f[2] * f[2]) { ok = false; break; } } if (ok) HG.push([x + (Math.sin(i * 12.9 + j * 78.2) * 0.5) * 0.00006, z + Math.sin(i * 39.3 + j * 11.1) * 0.00006]); } } }
  const hgGeo = new T.SphereGeometry(1, 9, 6), hgGeoLo = new T.SphereGeometry(1, 5, 3), hgMat = flat({ xtoon: 1, color: 0xffffff, inner: 0xfff1dc, noise: 0, speck: 0, unlitK: 1, depthK: 0.05, depth: 1e-8, lip: false });
  const hgM = iadd(hgGeo, hgMat, HG.length, group, 'lipidheads'), hgM2 = iadd(hgGeoLo, hgMat, HG.length, group, 'lipidheadsLo'); const hgS = new IS([hgM, hgM2], HG.length);
  // headgroups are never on a perfect lattice: lipids diffuse, so every head gets its own offset (~25 % of the pitch), height (+-0.1 nm), tilt, size and a randomly oriented flattening; the three tints mix as patches of PC / PE / PS-like lipid
  { const rg = timeline.rng(31), _qt = new T.Quaternion(), _eu = new T.Euler(); const ph = (i) => Math.sin(i * 12.9898) * 0.5;
    HG.forEach((h, i) => { const jx = (rg() - 0.5) * 0.00026, jz = (rg() - 0.5) * 0.00026, jy = (rg() - 0.5) * 0.00018; _eu.set((rg() - 0.5) * 0.5, rg() * 6.283, (rg() - 0.5) * 0.5); _qt.setFromEuler(_eu); const sz = 0.00031 + rg() * 0.00008; hgS.set(i, h[0] + jx, YP - 0.00012 + jy, h[1] + jz, _qt, sz, sz * (0.78 + 0.25 * rg()), sz * (0.9 + 0.2 * rg())); const k = rg() * 0.8 + 0.2 * Math.sin(h[0] * 90 + h[1] * 70); if (k < 0.45) hgS.color(i, 0.86, 0.76, 0.68); else if (k < 0.78) hgS.color(i, 0.78, 0.72, 0.88); else hgS.color(i, 0.88, 0.70, 0.64); }); }
  // ---------- L-glutamate ball-and-stick in every clamshell of the hero receptor (1FTJ glutamate superposed on the 3KG2 ligand-binding domains, build_glu.py) ----------
  const GP = await ctx.fetchJSON('synapse/glu_pose.json'); const gHero = LY.ampar[0], gQ = qy(gHero[2]); const gAt = [], gBd = [];
  ['A', 'B', 'C', 'D'].forEach((cn) => { const base = gAt.length, at = GP[cn]; at.forEach((a) => { const v = V3(a[1] * 1e-3, a[2] * 1e-3, a[3] * 1e-3).applyQuaternion(gQ); gAt.push({ el: a[0], x: gHero[0] + v.x, y: YR + v.y, z: gHero[1] + v.z }); });
    for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) if (Math.hypot(at[i][1] - at[j][1], at[i][2] - at[j][2], at[i][3] - at[j][3]) < 0.17) gBd.push([base + i, base + j]); });
  const gluMat = kit.toon(0xffffff, { glow: 0xffffff, glowK: 0.28 }); const gluS = iadd(new T.SphereGeometry(1, 18, 12), gluMat, gAt.length, group, 'glu'), gluB = iadd(kit.unitCyl, gluMat, gBd.length, group, 'glub');
  { const col = { C: 0xffe6a8, N: 0x8fb4ff, O: 0xff7a68 }, rad = { C: 0.000115, N: 0.00011, O: 0.000105 }; gAt.forEach((a, i) => { setM(gluS, i, a.x, a.y, a.z, _q.identity(), rad[a.el]); gluS.setColorAt(i, _c.setHex(col[a.el])); });
    gBd.forEach((b, i) => { const A_ = gAt[b[0]], B_ = gAt[b[1]]; kit.putDir(gluB, i, V3(A_.x, A_.y, A_.z), V3(B_.x, B_.y, B_.z), 0.000038); gluB.setColorAt(i, _c.setHex(0xfff0d0)); }); gluS.instanceColor.needsUpdate = gluB.instanceColor.needsUpdate = true; }
  const gD = gAt.slice(30, 40), gDc = gD.reduce((p, a) => p.add(V3(a.x, a.y, a.z)), V3(0, 0, 0)).multiplyScalar(0.1);
  const gluHalo = kit.halo(0xffc36b, 0); gluHalo.position.copy(gDc).multiplyScalar(U); group.add(gluHalo);
  // soft amber focus glow on the junction (guides the eye at neuron scale)
  const focusHalo = kit.halo(0xffb84a, 0); focusHalo.position.set(0, (YP + YQ) / 2 * U, 0); group.add(focusHalo);
  let zNow = -9;
  const DBG = ctx.params && ctx.params.get('dbghide'); const DBGL = ctx.params && ctx.params.has('dbglist');
  const updateExtra = (z, c) => { zNow = z; const W = c.W, Wum = W * 1e6; const F = [-group.position.x * 1e6, -group.position.y * 1e6, -group.position.z * 1e6];
    { const hv = z < -6.0, o = 1 - ss(-6.6, -6.0, z); hazeMeshes.forEach((m) => { m.visible = hv; m.material.opacity = o; }); }
    const rr1 = W < 9e-8 ? Math.min(0.035, 0.014 + 0.4 * Wum) : 0, rr2 = W < 9e-8 ? Math.min(0.075, 0.035 + 1.1 * Wum) : 0; hgS.ring(0, F, 0, rr1); hgS.ring(1, F, rr1, rr2); hgM.visible = hgM2.visible = rr2 > 0;
    const ha = 0;   // no glow disc around the inset: nothing may read as a halo / disc focusHalo.material.opacity = ha; focusHalo.visible = ha > 0.01; focusHalo.scale.setScalar(Math.max(0.5e-6, 0.075 * W));
    if (DBGL && !window.__dbgl) { window.__dbgl = 1; group.children.forEach((o, i) => console.log('SYN', i, o.type, o.userData.name || '', o.geometry && o.geometry.attributes.position.count, o.material && o.material.type)); }
    if (DBG) { const hs = DBG.split(',').map(Number); group.children.forEach((o, i) => { if (hs.includes(i)) o.visible = false; }); }
    const par = group.parent; if (par && !par.userData.__synHook) { par.userData.__synHook = 1; const nr = par.children.find((g) => g.userData && g.userData.levelId === 'neuron'); if (nr) { let v = true; Object.defineProperty(nr, 'visible', { get() { return v; }, set(x) { v = x; }, configurable: true }); } } };
  // ---------- labels ----------
  const L = (text, z0, z1, x, y, zz = 0, right = false, amber = false) => ({ text, z0, z1, pos: () => new T.Vector3(x * U, y * U, zz * U), right, amber });
  const nl0 = LY.nlnx[0], cd0 = PL.cad2[1], p0 = PL.psd95[7], ck0 = PL.camkii[0];
  const hx = LY.ampar[0][0], hz = LY.ampar[0][1];
  const near = (list, f = (r) => [r[0], r[1]], zmin = -0.07) => { let best = null, bd = 1e9; list.forEach((r) => { const [x, z] = f(r); if (z > 0 || z < zmin) return; const d = (x - hx) ** 2 + 0.3 * (z - hz) ** 2; if (d < bd && d > 1e-6) { bd = d; best = r; } }); return best || list[0]; };
  const sn0 = near(snData, (s_) => [s_[0], s_[2]], -0.05), nm0 = near(LY.nmdar), nl1 = near(LY.nlnx), cv0 = near(LY.cav), cd1 = near(PL.cad2.concat(LY.cad.map((c) => [c[0], c[1]])));
  const labels = [
    L('synaptic cleft · 23 nm', -8.0, -5.5, 0.19, (YP + YQ) / 2 + 0.002, 0, true), L('synaptic vesicle · 40 nm', -7.1, -5.3, -0.158, YQ + 0.0265, 0), L('active zone · dense projections', -7.0, -5.55, 0.105, YQ + 0.022, -0.04),
    L('postsynaptic density · 35 nm', -7.2, -5.55, -0.10, YP - 0.026, -0.03), L('AMPA receptor · GluA2', -8.4, -6.2, hx + 0.002, YP + 0.0128, hz, true), L('NMDA receptor · GluN1/GluN2B', -7.8, -6.3, nm0[0], YP + 0.0105, nm0[1], true),
    L('Ca²⁺ channel · Cav2.2', -7.6, -6.4, cv0[0], YQ - 0.004, cv0[1]), L('SNARE complex · 4-helix bundle', -7.9, -6.3, sn0[0], YQ + 0.0105, sn0[2], true),
    L('neurexin–neuroligin', -7.4, -6.5, nl1[0], YP + 0.0185, nl1[1], false), L('N-cadherin · 21 nm', -7.2, -6.5, cd1[0], YP + 0.014, cd1[1], true), L('PSD-95', -7.2, -6.3, p0[0], YP - 0.0105, p0[1], true), L('CaMKII', -6.9, -5.6, ck0[0] + 0.012, YP - 0.062, ck0[1]),
    L('mitochondrion', -6.2, -5.1, -0.14, 0.38, -0.04), L('microtubule', -5.9, -5.0, -1.0, 1.12, 0, true), L('smooth ER', -6.2, -5.2, 0.28, 0.2, 0, true),
    L('astrocyte process', -6.2, -5.2, -0.50, 0.05, -0.1, true), L('spine apparatus', -6.4, -4.9, 0.0, -0.54, 0), L('actin', -6.2, -5.2, 0.12, -0.45, -0.1, true), L('polyribosome', -6.1, -5.3, 0.18, -0.34, -0.1),
    L('dendritic spine · 0.75 µm', -5.9, -4.5, 0.3, -0.4, 0, true), L('axon terminal · bouton', -5.9, -4.5, -0.30, 0.52, 0), L('dendrite', -5.3, -4.5, 1.6, -2.36, 0, true), L('axon', -5.3, -4.6, -3.2, 2.2, -0.05),
    L('synapsin tethers', -7.0, -6.0, 0.0, 0.2, -0.1),
    L('recycling endosome · ~80 nm', -6.2, -5.4, LY.endo[0][0], LY.endo[0][1], LY.endo[0][2], true),
    L('glutamate · ~2,000 molecules per release', -7.4, -6.2, -0.075, (YP + YQ) / 2 + 0.004, -0.01, false, true),
    // molecular-zoom labels (visible to the molecule level's hand-over)
    L('L-glutamate · 10 heavy atoms (1FTJ pose)', -8.5, -7.45, gDc.x, gDc.y + 0.0009, gDc.z, true, true), L('ligand-binding domain · clamshell', -8.5, -7.5, gDc.x + 0.0022, gDc.y - 0.0025, gDc.z),
    L('phospholipid bilayer · 4.8 nm', -8.5, -7.0, hx - 0.012, YP - 0.0024, 0, true), L('transmembrane helices (M1–M4)', -8.5, -7.3, hx + 0.0004, YP - 0.0012, 0), L('lipid head groups', -8.5, -7.6, hx + 0.014, YP + 0.0003, -0.006, true),
  ];
  // when the molecule level is present it draws the hero receptor, glutamate and its own molecular labels: hide the duplicates here
  { const FAR = new T.Vector3(0, 0, 1e12), molHides = () => !!(window.__levels && window.__levels.includes('molecule')) && zNow < -7.32 && !(ctx.params && ctx.params.has('showhero'));
    labels.forEach((l) => { if (/^(L-glutamate|ligand-binding|transmembrane helices|AMPA receptor)/.test(l.text)) { const p0 = l.pos; l.pos = () => (molHides() ? FAR : p0()); } }); }
  const TRI = typeof location !== 'undefined' && /[?&]tri=1/.test(location.search);
  let hideMol = false;
  // the molecule level draws the hero receptor: its frame (origin = glutamate in the hero pocket D) is this frame translated by DOCK (um), so shift the whole synapse until that point is exactly plan.anchors().Mol
  const DOCK = (() => { const D = GP.D, c = [0, 0, 0]; D.forEach((a) => { c[0] += a[1] / D.length; c[1] += a[2] / D.length; c[2] += a[3] / D.length; }); const v = V3(c[0] * 1e-3, c[1] * 1e-3, c[2] * 1e-3).applyQuaternion(gQ); return [gHero[0] + v.x, YR + v.y, 0]; })();
  const synAnchor = [A.Mol[0] - DOCK[0] * 1e-6, A.Mol[1] - DOCK[1] * 1e-6, A.Mol[2] - DOCK[2] * 1e-6];
  // follow the neuron's cortex re-framing (neuron.js publishes window.__neuFrame): this synapse sits ON that cell's dendrite, so it takes the same rigid transform about the cell's anchor
  const _fp = new T.Vector3(), _fq = new T.Quaternion(), anchorFn = (t) => { const f = window.__neuFrame && window.__neuFrame(t); if (!f) return synAnchor; _fp.set(synAnchor[0] - f.A0[0], synAnchor[1] - f.A0[1], synAnchor[2] - f.A0[2]).applyQuaternion(f.quat); return [f.anchor[0] + _fp.x, f.anchor[1] + _fp.y, f.anchor[2] + _fp.z]; };
  // region radius for the engine: just the bouton + spine head; the neuron level (dendrite, neighbours, neuropil) then stays drawn underneath instead of being hidden by this level's 'cover'.
  // Beyond z = -4.15 the synapse is only ~20 px and the neuron level's own hero spine / bouton (same colours, same place) carry it alone.
  const Wu = () => 2 * 16 * Math.tan(((ctx.params && ctx.params.has('fov')) ? Number(ctx.params.get('fov')) : 14) * Math.PI / 360) * (innerWidth / innerHeight);
  const nestR = () => { const sc = group.parent ? group.parent.scale.x : 0; if (!(sc > 0)) return 5e-7; const zr = Math.log10(Wu() / sc); return zr < -4.15 ? 5e-7 : 0; };
  return { group, anchorFn, get nestR() { return nestR(); }, labels, update(t, S, z, c) { { const f = window.__neuFrame && window.__neuFrame(t); if (f) group.quaternion.copy(f.quat); } updateSection(group, c);
    { // far scale: the cell's own look. Cut-face colour and rim light of the spine / dendrite / bouton move to exactly what the neuron level renders for the same objects (same hero spine, same dendrite)
      const k = ss(-5.9, -5.2, z); const set = (m, mk, rim, col) => { const u = m.userData.u; u.uMatch.value = mk; if (col) { u.uMatchCol.value.copy(col); u.uMatchEdge.value.copy(NEU_EDGE); } u.uRimK.value = rim * k; };
      set(mat.post, k, 0.45, NEU_CUT); set(mat.massPost, k, 0, NEU_CUT); set(matFar, k, 0.5, NEU_CUT); set(mat.pre, 0, 0.34, null); set(matFarPre, 0, 0.34, null); set(bgMat, 0, 0, null); }
    { const o = ss(-6.1, -5.25, z); for (const m of ctxMats) m.userData.u.uFade.value = o; for (const m of ctxRib) m.userData.u.uFade.value = o; { const roV = 1 - 0.3 * ss(-6.6, -5.2, z), roO = 1 - 0.3 * ss(-6.9, -5.7, z); for (const m of RIBALL) { const ro = VESRIB.has(m) ? roV : roO; m.transparent = ro < 0.995; m.opacity = ro; } } const vis = false; bgMesh.visible = vis; ctxMeshes.forEach((m) => { m.visible = vis; }); }
    const molOn = !!(window.__levels && window.__levels.includes('molecule')) && !(ctx.params && ctx.params.has('showhero')); const W = c.W, Wum = W * 1e6;   // hero receptor hidden only when the molecule level is present and draws it itself const W = c.W, Wum = W * 1e6;
    const F = [-group.position.x * 1e6, -group.position.y * 1e6, -group.position.z * 1e6];
    if (molOn !== hideMol) { hideMol = molOn; if (molOn) RECS.post.value[0].set(0, 0, 0); else RECS.post.value[0].set(LY.ampar[0][0], Math.sqrt(0.0036 * 0.0036 - LY.ampar[0][1] ** 2), 0); lod.ampar.set(0, LY.ampar[0][0], YR, LY.ampar[0][1], qy(LY.ampar[0][2]), molOn ? 0 : 1, undefined, undefined, YR + 0.007); }
    // distance windows: nearest receptors get the extra-fine surface, then fine / medium / coarse rings (each instance is drawn at exactly one level of detail)
    { const rX = W < 6e-8 ? 0.045 : 0, rH = W < 1.8e-7 ? Math.max(rX, 0.7 * Wum + 0.012) : rX, rM = W < 3.5e-7 ? Math.max(rH, 1.0 * Wum + 0.02) : rH;
      for (const L of [lod.ampar, lod.nmdar]) { L.ring(0, F, 0, rX); L.ring(1, F, rX, rH); L.ring(2, F, rH, rM); L.ring(3, F, rM, 1e9); }
      const rr = 1.25 * Wum + 0.04; nlI.ring(0, F, 0, W < 4.5e-7 ? Math.max(rr, 3.6 * Wum + 0.12) : 0); cavM.visible = W < 1.5e-6; mu13.ring(0, F, 0, W < 6e-7 ? 1.15 * Wum + 0.03 : 0); const h1 = 0.7 * Wum + 0.02;
      p95.ring(0, F, 0, W < 2e-7 ? h1 : 0); p95.ring(1, F, W < 2e-7 ? h1 : 0, W < 6e-7 ? 1.25 * Wum + 0.04 : 0); vaI.ring(0, F, 0, W < 1.8e-6 ? 1.3 * Wum + 0.05 : 0); }
    { const g = W < 2.5e-7 ? sphHi : (W < 2e-6 ? sphMid : sphLo); vesM.geometry = vesS.ms[0].geometry = g; const sg = W < 1.5e-7 ? stg : ico; studM.geometry = studS.ms[0].geometry = sg; const rv = 1.3 * Wum + 0.05; vesS.ring(0, F, 0, rv); studS.ring(0, F, 0, W < 6e-7 ? rv : 0); }
    studM.visible = W < 6e-7; snM.visible = W < 1.5e-6; psdMass.visible = azMass.visible = W < 6e-7; psdEnv.visible = azEnv.visible = W >= 6e-7 && W < 6e-6; tethM.visible = W < 3e-6; ribM.visible = W < 4.5e-6; riboF.visible = endoM.visible = W < 3e-6; glyM.visible = W < 2e-6; shaftRibo.visible = W < 2.2e-5; cam.visible = W < 4e-7; cadI.visible = W < 4.5e-7;
    { const gv = W < 7e-8 && !molOn; gluS.visible = gluB.visible = gv; const ga = gv ? 0.55 * (1 - ss(3e-8, 7e-8, W)) : 0; gluHalo.material.opacity = ga; gluHalo.visible = ga > 0.01; gluHalo.scale.setScalar(2.6e-9); }
    const near = W < 2.5e-6; farOrg.forEach((m) => { m.visible = !near; });
    updateSignal(S, c); updateExtra(z, c);
    if (TRI && !window.__triDone) { window.__triDone = 1; let tri = 0, dc = 0; const rows = []; group.traverse((o) => { if (!(o.isMesh || o.isPoints)) return; let v = true; for (let p = o; p; p = p.parent) if (!p.visible) { v = false; break; } if (!v) return; const g = o.geometry; const n = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); tri += n; dc++; rows.push([Math.round(n), o.userData.name || '', o.isInstancedMesh ? o.count : 1]); }); rows.sort((a, b) => b[0] - a[0]); console.log('TRI ' + z.toFixed(2) + ' total ' + Math.round(tri) + ' draws ' + dc + ' top: ' + rows.slice(0, 14).map((r) => r.join('/')).join(' ; ')); } } };
}
