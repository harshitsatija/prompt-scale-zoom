/* LEVEL "neuron": one real human cortical pyramidal neuron (NeuroMorpho 102565 / Allen Cell Types H16-06-007-01-07-02, human middle temporal gyrus L2/3),
 * soma with organelles, dendrites with spines, myelinated axon with nodes of Ranvier, in neuropil.  See assets/neuron/SOURCES.md. */
import { loadModel } from './neuron/swc.js';
import { makeMaterials } from './neuron/materials.js';
import { buildSoma } from './neuron/soma.js';
import { buildTree, buildSpines, spineGeometry } from './neuron/tree.js';
import { buildNeuropil } from './neuron/neuropil.js';
import { buildHero } from './neuron/hero.js';
import { ssm, norm } from './neuron/geo.js';
import { lodInst } from './neuron/lodinst.js';

export default async function build(ctx) {
  const { T, kit, plan } = ctx; const U = 1e-6;
  const A = plan.anchors();
  const [buf, meta] = await Promise.all([ctx.fetchBuf('neuron/neuron.bin'), ctx.fetchJSON('neuron/neuron.json')]);
  const model = loadModel(buf, meta, A);
  const M = makeMaterials(ctx);
  const cutN = new T.Plane(new T.Vector3(0, 0, -1), 0);          // our own section plane (through the focus when small, through the soma when the soma is the subject)
  const group = new T.Group();
  const wrap = new T.Group(); group.add(wrap);   // wrap = the cortex slab's own re-framing transform applied to this cell (see place())
  const ng = new T.Group(), wg = new T.Group(); wrap.add(ng, wg); ng.scale.setScalar(U); wg.scale.setScalar(U);
  { const m = new T.Matrix4(); const R = model.Rm; m.set(R[0][0], R[0][1], R[0][2], 0, R[1][0], R[1][1], R[1][2], 0, R[2][0], R[2][1], R[2][2], 0, 0, 0, 0, 1); ng.quaternion.setFromRotationMatrix(m); }
  const toHead = (v) => model.apply(v);
  // ---- soma + organelles
  const soma = buildSoma(ctx, M, model, cutN); ng.add(soma.group);
  if (ctx.params && ctx.params.get('nmark')) { for (const k of ['nucleolus', 'golgi', 'er', 'mito']) { const mk = new T.Mesh(new T.SphereGeometry(0.4, 12, 8), new T.MeshBasicMaterial({ color: 0xff0000, depthTest: false })); mk.position.set(...soma.lab[k]); mk.renderOrder = 99; ng.add(mk); } }
  // ---- tree
  const tree = buildTree(ctx, M, model, soma, cutN);
  const mDend = M.mat(0xffffff, { map: M.tex.fibres(), vc: true, side: T.DoubleSide, ball: true, sig: true, inside: 0xf6dfb8, root: true, mott: true, rimK: 0.62 });
  const mAxon = M.mat(0xffffff, { map: M.tex.fibres(), vc: true, side: T.DoubleSide, ball: true, sig: true, inside: 0xf6dfb8, root: true, mott: true, rimK: 0.62 });
  { const b = soma.basis, A3 = soma.A, k = 0.94; M.G.uSE.value.set(b.ex[0] / (A3[0] * k), b.ex[1] / (A3[0] * k), b.ex[2] / (A3[0] * k), b.ey[0] / (A3[1] * k), b.ey[1] / (A3[1] * k), b.ey[2] / (A3[1] * k), b.ez[0] / (A3[2] * k), b.ez[1] / (A3[2] * k), b.ez[2] / (A3[2] * k)); }
  const mMy = M.mat(0xffffff, { map: M.tex.myelinWrap(), vc: true, side: T.DoubleSide, ball: true, sig: true, root: false, rimK: 0.55 });
  const mk = (geo, m) => { const o = new T.Mesh(geo, m); o.frustumCulled = false; return o; };
  ng.add(mk(tree.dendGeo, mDend), mk(tree.axonGeo, mAxon), mk(tree.myelinGeo, mMy));
  let boutons = null;
  { const bs = tree.boutonSites; const mats = new Float32Array(bs.length * 16); const m4 = new T.Matrix4(), pp = new T.Vector3(), qq = new T.Quaternion(), ss = new T.Vector3(); bs.forEach((b, i) => { m4.compose(pp.set(b.pos[0], b.pos[1], b.pos[2]), qq, ss.set(b.s * 1.3, b.s * 0.9, b.s)); mats.set(m4.elements, i * 16); });
    boutons = lodInst(T, { geoHi: new T.SphereGeometry(1, 20, 14), geoLo: new T.SphereGeometry(1, 8, 6), mat: M.mat(0x86e0cb, { side: T.DoubleSide, ball: true, inside: 0xd4fbee }), mats, hiW: 45, rcMin: 40, rcK: 1.5, allW: 120 }); ng.add(boutons.group); }
  const spines = buildSpines(ctx, M, model, tree.spineSites, cutN); ng.add(spines.group);
  // ---- hero synapse (head frame) + presynaptic boutons on neighbouring spines
  const hero = buildHero(ctx, M, model, A, cutN, tree, spines); wg.add(hero.group); ng.add(hero.nGroup);
  // ---- neuropil
  const neuropil = await buildNeuropil(ctx, M, model, soma, tree, A, cutN, ng, wg);

  // ---- physical anchoring inside the cortex: the cortex level re-frames its slab (face-on roll about the focus, tilt, sliding along the normal so the pia sits at the top).
  // This cell is one of that slab's cells, so it must follow exactly the same transform: replicate cortex.js update() and apply it to `wrap`.
  const ang = Math.atan2(A.nq[1], A.nq[0]) - Math.PI / 2, MMm = 1e-3, smo = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const x0c = { x: Math.cos(-ang) * (A.Hn[0] - A.Q[0]) - Math.sin(-ang) * (A.Hn[1] - A.Q[1]), y: Math.sin(-ang) * (A.Hn[0] - A.Q[0]) + Math.cos(-ang) * (A.Hn[1] - A.Q[1]) };
  const qc = new T.Quaternion(), Rq = new T.Quaternion(), Qs = new T.Quaternion(), Qt = new T.Quaternion(), qz = new T.Quaternion(), ID = new T.Quaternion(), eu = new T.Euler(), eu2 = new T.Euler(), vr = new T.Vector3(), nW = new T.Vector3(), fvk = new T.Vector3(), Fr = new T.Vector3(), zax = new T.Vector3(0, 0, 1);
  // calc(): real camera z from the engine's root scale (the engine sets root.scale before it asks for anchors), focus from the shared camera path, then the cortex transform.
  const FOVd = ctx.params.has('fov') ? Number(ctx.params.get('fov')) : 14, Wu = () => 2 * 16 * Math.tan(FOVd * Math.PI / 360) * (innerWidth / innerHeight), Fp = new T.Vector3(), Fq = new T.Vector3();
  const calc = (t) => {
    const sc = group.parent ? group.parent.scale.x : 0; if (!(sc > 0)) return null;
    const zr = Math.log10(Wu() / sc); Fp.copy(plan.FOCUS(zr, t));
    const nested = false, zk = Math.min(-2.0, Math.max(-4.85, zr)), Wk = Math.pow(10, zk);     // the cortex level runs on a virtual camera (focus = Q) beyond z = -2.98
    Fr.set(Fp.x - A.Q[0], Fp.y - A.Q[1], Fp.z - A.Q[2]); fvk.copy(Fr); if (nested) fvk.set(0, 0, 0);
    const kFace = smo(-3.5, -2.9, zk) * (1 - smo(-2.8, -2.22, zk));
    const pit = plan.pitchAt(zk) + Math.sin(t * 0.17 + 1) * 0.03 * (1 - smo(5.5, 7.5, zk)); qc.setFromEuler(eu.set(-pit, plan.yawAt(zk, t), 0, 'YXZ')); Rq.copy(qc).invert(); Qs.copy(ID).slerp(qc, kFace);
    const kT = smo(-3.3, -2.85, zk) * (1 - smo(-3.15, -2.9, zk)); Qs.multiply(Qt.setFromEuler(eu2.set(0.2 * kT, -0.1 * kT, 0, 'YXZ')));
    const rot = ang * (1 - kFace), ca = Math.cos(-rot), sa = Math.sin(-rot), fy0 = fvk.x * sa + fvk.y * ca;
    const kf = smo(-3.55, -2.75, zk) * (1 - smo(-2.3, -2.0, zk)), yc = -((0.215 * Wk) + (1.55 * MMm - 0.215 * Wk) * smo(-2.62, -2.3, zk)), dl = kf * (fy0 - yc);
    // r (relative to the focus) = (Q - F) + fv + Qs (Rz(rot) (x_c + (0, dl, dz)) - fv)
    vr.set(x0c.x, x0c.y + dl, fvk.z).applyAxisAngle(zax, rot).sub(fvk).applyQuaternion(Qs).add(fvk).sub(Fr);
    const quat = new T.Quaternion().copy(Qs).multiply(qz.setFromAxisAngle(zax, rot - ang)); nW.set(0, 0, -1).applyQuaternion(Rq.multiply(Qs));
    return { zr, nn: zr > -4.3, F: Fp, anchor: [Fp.x + vr.x, Fp.y + vr.y, Fp.z + vr.z], quat, nW, nested };
  };
  const anchorFn = (t) => { const r = calc(t); return r ? r.anchor : A.Hn; };
  // published for the levels nested inside this cell (synapse, molecule): the cortex re-framing as { anchor of this cell, rigid rotation }, so they can follow it without a core change (see requests/syn_neu.md)
  window.__neuFrame = (t) => { const r = calc(t); return r ? { anchor: r.anchor, quat: r.quat, A0: A.Hn } : null; };
  // ---- labels (level-local metres)
  const hv = (v) => { const h = toHead(v); return new T.Vector3(h[0] * U, h[1] * U, h[2] * U); };
  // heavy path (longest descendant chain) from each primary dendrite, so labels sit ON the trunk and not on a side twig
  const acc = new Float64Array(model.N); { const st = []; const seen = new Uint8Array(model.N); for (let i = 0; i < model.N; i++) if (model.par[i] < 0) st.push(i); const order = []; while (st.length) { const k = st.pop(); order.push(k); for (const c of model.children[k]) st.push(c); } for (let i = order.length - 1; i >= 0; i--) { const k = order[i]; if (model.par[k] >= 0) acc[model.par[k]] += acc[k] + Math.hypot(...model.P[k].map((v, j) => v - model.P[model.par[k]][j])); } }
  const heavyFrom = (root) => { const path = [root]; let k = root; while (model.children[k].length) { k = model.children[k].slice().sort((p, q) => acc[q] - acc[p])[0]; path.push(k); } return path; };
  const primary = (ty) => { const r = []; for (let i = 0; i < model.N; i++) if (model.type[i] === ty && model.par[i] >= 0 && model.type[model.par[i]] === 1) r.push(i); return r.sort((p, q) => acc[q] - acc[p]); };
  const ptOnPath = (path, g) => { for (const k of path) if (model.geo[k] >= g) return model.P[k]; return model.P[path[path.length - 1]]; };
  const apicPath = heavyFrom(primary(4)[0]); const apicMid = ptOnPath(apicPath, 60);
  const basalPath = (() => { const r = primary(3); const mine = r.filter((k) => !model.toSoma.includes(k)); return heavyFrom(mine[0] ?? r[0]); })(); const basalPt = ptOnPath(basalPath, 55);
  const axPt = tree.pointAtGeo(24).p;
  const myPt = (() => { const s = tree.sheaths[1] || tree.sheaths[0]; return tree.pointAtGeo(s[0] + (s[1] - s[0]) * 0.72).p; })();
  const nodePt = (() => { const g = tree.nodesG[1] ?? tree.nodesG[0]; return tree.pointAtGeo(g).p; })();
  const axFar = tree.pointAtGeo(Math.min(tree.mainEnd - 5, (tree.nodesG[1] || 200) + 30)).p;
  // draw order: the cortex level (zMin -4.7) renders its section wall in the transparent pass after a depth clear (renderOrder 500-502); to sit over that wall this level
  // (backdrop 600, everything else 601, glows 602) joins the same pass
  const clr = new T.Mesh(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 1e-12, 0, 0, 0, 1e-12, 0], 3)), new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false, transparent: true }));
  clr.frustumCulled = false; clr.userData.ro = 599; clr.onBeforeRender = (r) => { r.state.buffers.depth.setMask(true); r.clearDepth(); }; wrap.add(clr);   // fresh depth buffer for this level (the cortex level's wall was drawn before it)
  group.traverse((o) => { if (!(o.isMesh || o.isPoints || o.isSprite)) return; [].concat(o.material).forEach((m) => { m.transparent = true; }); o.renderOrder = o.userData.ro || (o.isSprite ? 602 : 601); });
  if (ctx.params && ctx.params.has('ndbg')) ctx.log('NDBG nodes', JSON.stringify(tree.nodesG.slice(0, 4).map((g) => toHead(tree.pointAtGeo(g).p).map((v) => +v.toFixed(1)))), 'sheath0', JSON.stringify(tree.sheaths[0]), 'AIS', JSON.stringify(toHead(tree.pointAtGeo(24).p).map((v) => +v.toFixed(1))));
  if (ctx.params && ctx.params.has('ndbg')) { let tri = 0, dc = 0; const lst = []; group.traverse((o) => { if (o.isMesh) { dc++; const g = o.geometry; const t3 = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); tri += t3; lst.push(Math.round(t3 / 1000) + 'k' + (o.isInstancedMesh ? 'i' + o.count + 'x' + Math.round(t3 / Math.max(1, o.count)) : '')); } }); ctx.log('NDBG tris', Math.round(tri), 'draws', dc, lst.sort((a, b) => parseInt(b) - parseInt(a)).slice(0, 14).join(' ')); }
  const labels = [
    { text: 'cell body (soma) · 20 µm', z0: -5.2, z1: -3.5, right: false, pos: () => { const hd = [0.5, -0.85, 0]; const l = model.applyT(hd); const d = norm(l); return hv(l.map((v) => v * soma.ell(d) * 1.0)); }, amber: false },
    { text: 'nucleus', z0: -5.0, z1: -4.0, right: false, pos: () => hv(soma.lab.nucleus) },
    { text: 'nucleolus', z0: -5.0, z1: -4.1, right: false, pos: () => hv(soma.lab.nucleolus) },
    { text: 'Golgi apparatus', z0: -5.0, z1: -4.1, right: false, pos: () => hv(soma.lab.golgi) },
    { text: 'rough ER', z0: -5.0, z1: -4.1, right: true, pos: () => hv(soma.lab.er) },
    { text: 'mitochondrion', z0: -5.0, z1: -4.1, right: true, pos: () => hv(soma.lab.mito) },
    { text: 'apical dendrite', z0: -4.5, z1: -3.4, pos: () => hv(apicMid) },
    { text: 'basal dendrites', z0: -4.6, z1: -3.4, right: true, pos: () => hv(basalPt) },
    { text: 'basal dendrite · synaptic signal arrives here', z0: -5.0, z1: -4.0, right: true, pos: () => hv(model.P[model.toSoma[Math.floor(model.toSoma.length * 0.45)]]) },
    { text: 'axon hillock', z0: -5.0, z1: -4.5, right: false, pos: () => hv(tree.pointAtGeo(4).p) },
    { text: 'axon initial segment', z0: -5.0, z1: -3.5, right: true, pos: () => hv(axPt) },
    { text: 'axon', z0: -4.6, z1: -3.4, pos: () => hv(axFar) },
    { text: 'myelin sheath · ~1 µm', z0: -4.9, z1: -3.4, right: false, pos: () => hv(myPt) },
    { text: 'node of Ranvier', z0: -5.2, z1: -3.4, amber: true, pos: () => hv(nodePt) },
    { text: 'dendritic spine · head 0.8 µm', z0: hero.solo ? -6.1 : -4.75, z1: -4.3, pos: () => hero.labelSpine() },
    { text: 'a synapse', z0: hero.solo ? -6.1 : -4.75, z1: -4.3, right: false, amber: true, pos: () => hero.labelSyn() },
    ...neuropil.labels,
  ];
  // signal path (neuron-local um): spine head -> shaft -> dendrite -> soma -> axon hillock -> AIS -> main axon
  const sig = []; { const D = model.D; const hd = model.applyT([D[0], D[1] + 2.0, D[2]]); sig.push({ p: hd, u: -1.1 }); for (const k of model.toSoma) sig.push({ p: model.P[k], u: model.uDend[k] }); sig.push({ p: [0, 0, 0], u: model.Ld }); for (const k of tree.main) sig.push({ p: model.P[k], u: model.Ld + model.geo[k] }); }
  const posU = (u) => { if (u <= sig[0].u) return sig[0].p; let i = 1; while (i < sig.length - 1 && sig[i].u < u) i++; const a = sig[i - 1], b = sig[i], t = Math.max(0, Math.min(1, (u - a.u) / Math.max(1e-6, b.u - a.u))); return [a.p[0] + (b.p[0] - a.p[0]) * t, a.p[1] + (b.p[1] - a.p[1]) * t, a.p[2] + (b.p[2] - a.p[2]) * t]; };
  const halos = Array.from({ length: 6 }, () => { const h = kit.halo(0xffa63a, 0); h.renderOrder = 602; h.visible = false; ng.add(h); return h; });
  const tmpV = new T.Vector3(), inv = new T.Matrix4(), pl = new T.Plane(), pw = new T.Vector3(), nrm = new T.Vector3();
  const nodeFronts = tree.nodesG;
  // signal: front position of a pulse of a given age (um along the path coordinate u)
  const Ld = model.Ld, gAIS = 46;
  function front(age) {
    const tD = 0.42, tS = 0.14, tA = 0.14;
    if (age < tD) { const x = age / tD; return [-1.1 + (Ld + 1.1) * (x * x * (3 - 2 * x) * 0.4 + x * 0.6), 1.0, 3.2]; }
    if (age < tD + tS) { const x = (age - tD) / tS; return [Ld + x * 12, 1.0, 3.5]; }
    const a = age - tD - tS; if (a < tA) { const x = a / tA; return [Ld + 12 + x * (gAIS - 12), 1.0, 4]; }
    // saltatory conduction along the myelinated trunk: hold at a node, jump to the next
    const b = a - tA, hold = 0.07, jump = 0.035; const per = hold + jump; const i = Math.floor(b / per), ph = b - i * per; const nds = [gAIS, ...nodeFronts]; if (i >= nds.length - 1) { return [Ld + nds[nds.length - 1] + (b - (nds.length - 1) * per) * 600, Math.max(0, 1 - (b - (nds.length - 1) * per) / 0.5), 10]; }
    const f = ph < hold ? 0 : (ph - hold) / jump; const e = f * f * (3 - 2 * f); return [Ld + nds[i] + (nds[i + 1] - nds[i]) * e, 1.0, ph < hold ? 12 : 22];
  }
  const tPrev = { v: -1 }; const plW = new T.Plane();
  function update(t, S, z, c) {
    const W = c.W * 1e6;                       // field width in um
    const synOn = !hero.solo;                    // the synapse level is loaded: it owns this view (shaft, spines, boutons, forest) until its own zMax (-4.6); we must not paint over it
    clr.visible = W < 270 && !(ctx.params && ctx.params.has('noclear'));   // depth clear only once the synapse level is gone (cortex tissue is then what we must cover)
    ng.visible = true; hero.nGroup.visible = ng.visible;
    // section plane: through the focus when zoomed on the synapse, through the soma when the cell body is the subject
    const pl0 = calc(t) || { quat: ID, nW: kit.cut.A.normal, nested: false, F: new T.Vector3(...A.Hn) }; wrap.position.set(0, 0, 0); wrap.quaternion.copy(pl0.quat);
    hero.group.visible = hero.solo || (pl0.zr ?? 0) > -4.15;   // zoomed in, the synapse level draws this very spine + bouton in detail (same place, same colours): ours is only the far-scale stand-in group.updateMatrixWorld(true);
    if (ctx.params.has('cdbg')) console.log('NG neuron anchor rel focus um', pl0.zr && pl0.zr.toFixed(2), [group.position.x, group.position.y, group.position.z].map((v) => +(v * 1e6).toFixed(1)).join(','));
    const Fh = [0, 1, 2].map((i) => (pl0.nn ? 0 : (pl0.F.getComponent(i) - A.Hn[i])) * 1e6);
    const k = ssm(5, 38, W); const pc = [Fh[0] * (1 - k), Fh[1] * (1 - k), Fh[2] * (1 - k)];
    pw.set(pc[0] * U, pc[1] * U, pc[2] * U).applyMatrix4(wrap.matrixWorld);
    nrm.copy(pl0.nW); cutN.setFromNormalAndCoplanarPoint(nrm, pw);
    // plane + soma ball in neuron-local frame
    inv.copy(ng.matrixWorld).invert(); pl.copy(cutN).applyMatrix4(inv); M.G.uPl.value.set(pl.normal.x, pl.normal.y, pl.normal.z, pl.constant);
    M.G.uR.value = 9.6 * (1 - ssm(90, 170, W)); M.G.uC.value.set(0, 0, 0); M.G.uR2.value = 0; M.G.uC2.value.set(...model.P[model.k0]); M.G.uAx.value.set(...model.applyT([1, 0, 0])); M.G.uLen.value = Math.min(12, 1.2 * W + 2);
    // pulses from keystrokes
    const ps = M.G.uP.value; let np = 0; let flash = 0, flashSyn = 0;
    const ages = S.ages.slice().sort((a, b) => a[1] - b[1]);
    for (const [, age] of ages) { if (np >= 6) break; if (age > 2.4) continue; const f = front(age); if (f[1] <= 0.001) continue; ps[np++].set(f[0], f[1], f[2]); const d = age - 0.42; flash = Math.max(flash, Math.exp(-Math.pow((d - 0.1) / 0.18, 2))); flashSyn = Math.max(flashSyn, Math.exp(-age / 0.22)); }
    for (let i = np; i < 6; i++) ps[i].set(-1e5, 0, 1);
    M.G.uWS.value = Math.max(1, W / 55);
    for (let i = 0; i < 6; i++) { const h = halos[i]; if (i >= np) { h.visible = false; continue; } const f = ps[i]; const p = posU(f.x); h.visible = true; h.position.set(p[0], p[1], p[2]); const sz = Math.max(1.2, W * (f.x > Ld ? 0.03 : 0.022)) * (0.8 + 0.4 * f.y); h.scale.setScalar(sz); h.material.opacity = Math.min(0.9, 0.35 + 0.5 * f.y) * (W > 1.5 ? 1 : 0); }
    M.G.uFlash.value = flash;
    // LOD of spines (focus in neuron-local um)
    const fl = model.applyT(Fh); spines.update(fl, W); boutons.update(fl, W);
    M.G.uWS.value = Math.max(1, W / 55);
    { const iw = new T.Matrix4().copy(wg.matrixWorld).invert(); plW.copy(cutN).applyMatrix4(iw); } hero.update(t, S, flashSyn, W, plW);
    neuropil.update(t, S, z, c, W, Fh);
  }
  const dbg = ctx.params && ctx.params.get('nshift'); const sh = dbg ? dbg.split(',').map(Number) : null; const anchor = sh ? [A.Hn[0] - sh[0] * U, A.Hn[1] - sh[1] * U, A.Hn[2] - sh[2] * U] : A.Hn;
  const wl = labels.map((l) => ({ ...l, pos: () => l.pos().applyQuaternion(wrap.quaternion) }));
  const frameXf = { pos: wrap.position, quat: wrap.quaternion };   // exposed for the engine (see requests/neu_cor.md)
  // region radius the engine uses for visibility: small while the cell is the subject (so its region does not "cover" and hide the cortex behind it), the whole arbor (~300 um) once the
  // cortex has re-framed and the cell may sit off-centre. Always smaller than the half-diagonal of the view, so it never hides the cortex.
  const nestR = () => { const sc = group.parent ? group.parent.scale.x : 0; if (!(sc > 0)) return 1.5e-5; const zr = Math.log10(Wu() / sc); return ctx.params.has('nr') ? Number(ctx.params.get('nr')) : 1.5e-5 + 2.1e-5 * (1 - smo(-4.6, -4.3, zr)) + 2.65e-4 * smo(-3.5, -3.2, zr); };   // 36 um while zoomed on the hero synapse (it sits 35 um from the soma anchor): the cell must stay drawn all the way in
  return { group, anchorFn, get nestR() { return nestR(); }, labels: wl, frameXf, update, zMin: -6.2, zMax: -3.4 };
}
