/* LEVEL molecule (z -9.3 .. -7.3): one glutamate in the ligand-binding pocket of a GluA2 AMPA receptor, in water, in a POPC bilayer.
 * Real data: RCSB 3KG2 (full-length GluA2, OPM-oriented), RCSB 1FTJ (GluA2 LBD + glutamate, 1.9 A); POPC from RDKit torsion sampling; SPC216 water cell. See assets/molecule/SOURCES.md
 * Everything is authored in nm inside a child group scaled 1e-9; the origin is the glutamate in the hero (chain D) pocket = plan.anchors().Mol. */
import { buildReceptor } from './molecule/receptor.js';
import { buildPockets, ligandBondGeometry, addLigandAtoms } from './molecule/pocket.js';
import { buildConductor } from './molecule/solvent.js';
import { ss, Atoms, impostorMaterial } from './molecule/util.js';
const NM = 1e-9, EC = { C: 0xffe6a8, O: 0xff7a68, N: 0x8fb4ff, H: 0xf4f6ff };
export default async function build(ctx) {
  const { T, kit, plan } = ctx; const A = plan.anchors();
  const group = new T.Group(), nm = new T.Group(); nm.scale.setScalar(NM); group.add(nm);
  const pocket = await ctx.fetchJSON('molecule/pocket.json');
  const rec = await buildReceptor(ctx, pocket), sol = buildConductor(ctx, pocket);
  const pk = buildPockets(ctx, pocket);
  nm.add(rec.lo, rec.hi, rec.cartoon, pk.root, sol.root); rec.cartoon.visible = false;
  const DBG = new URLSearchParams(location.search).get('mdbg') || ''; 
  // arriving glutamate molecules (a few per keystroke): ball-and-stick up close, glowing comets with motion streaks from afar
  const hero = pocket.chains.D, cen = [0, 0, 0]; hero.lig.forEach((a) => { cen[0] += a[1] / hero.lig.length; cen[1] += a[2] / hero.lig.length; cen[2] += a[3] / hero.lig.length; });
  const tpl = hero.lig.map((a) => [a[0], a[1] - cen[0], a[2] - cen[1], a[3] - cen[2]]);
  const NF = 90, fAt = new Atoms(T, impostorMaterial(T), NF * tpl.length), fMat = fAt.obj.material; fMat.uniforms.uGlow.value = 0.12; nm.add(fAt.obj);
  const fBond = kit.inst(new T.CylinderGeometry(1, 1, 1, 10, 1, true), kit.toon(0xe9e4ff, { glow: 0xff9f1c, glowK: 0.25 }), NF * hero.bonds.length); fBond.count = 0; nm.add(fBond);
  const mkPts = (n, size) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('color', new T.BufferAttribute(new Float32Array(n * 3), 3)); g.boundingSphere = new T.Sphere(new T.Vector3(), 1e6); const p = kit.glowPoints(g, size, 1); p.frustumCulled = false; nm.add(p); return p; };
  const gHead = mkPts(NF, 2.6), gTrail = mkPts(NF * 4, 1.3); [gHead, gTrail].forEach((p) => { p.material.sizeAttenuation = true; });   // glow sprites with a physical size (nm): sub-pixel when the field is wide
  const gC = new T.Color(0xffc15a);
  const halo = kit.halo(0xffb02e, 0); halo.scale.set(1.5, 1.5, 1); halo.position.set(cen[0], cen[1], cen[2] + 0.1); nm.add(halo);
  const memY = pocket.meta.mem_y, axX = pocket.meta.axis[0], meta = await ctx.fetchJSON('molecule/cartoon_meta.json'), MD = meta.D;
  const cur = { fx: 0, fy: 0, W: 1 };
  // physical placement: the molecule frame (nm, origin = glutamate in the hero pocket) is the synapse level's frame translated, no rotation, no view composition; the group anchor is the pocket
  const lerp = (a, b, t) => a + (b - a) * t;
  const place = (x, y, zz) => new T.Vector3(x, y, zz).applyMatrix4(nm.matrix);
  nm.matrixAutoUpdate = false; nm.updateMatrix();
  const env = (age, a0, a1, h0, h1) => ss(a0, a1, age) * (1 - ss(h0, h1, age));
  const hash = ctx.timeline.hash, m4 = new T.Matrix4(), qq = new T.Quaternion(), ee = new T.Euler(), vv = new T.Vector3(), one = new T.Vector3(1, 1, 1), pA = new T.Vector3(), pB = new T.Vector3();
  const L = (x, y, zz) => () => place(x, y, zz), Lo = (p, d, dz = 0) => { const v = [p[0] - cen[0], p[1] - cen[1], p[2] - cen[2]], l = Math.hypot(...v); return L(p[0] + v[0] / l * d, p[1] + v[1] / l * d, p[2] + v[2] / l * d + dz); };
  const res = (cid, rn, an) => { const r = pocket.chains[cid].res.find((q) => q.rn === rn); const a = r.atoms.find((q) => q[4] === an); return [a[1], a[2], a[3]]; };
  const rp = { R485: res('D', 485, 'NH2'), T480: res('D', 480, 'OG1'), S654: res('D', 654, 'N'), E705: res('D', 705, 'OE1'), Y450: res('D', 450, 'OH'), W1: pocket.chains.D.waters[1] };
  const ring = (cid, rn, names) => { const r = pocket.chains[cid].res.find((q) => q.rn === rn), c = [0, 0, 0]; let k = 0; r.atoms.forEach((a) => { if (names.includes(a[4])) { c[0] += a[1]; c[1] += a[2]; c[2] += a[3]; k++; } }); return c.map((v) => v / k); };
  const Y450c = ring('D', 450, ['CG', 'CD1', 'CD2', 'CE1', 'CE2', 'CZ']), E705c = ring('D', 705, ['OE1', 'OE2']), R485c = ring('D', 485, ['NH1', 'NH2', 'NE']);
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const hbMid = () => { const b = pk.hbAll.find((q) => q.cid === 'D' && q.res.startsWith('ARG485')) || pk.hbAll[0]; return place((b.lig[1] + b.tgt[0]) / 2, (b.lig[2] + b.tgt[1]) / 2, (b.lig[3] + b.tgt[2]) / 2 + 0.03); };
  const labels = [
    { text: 'glutamate · C₅H₉NO₄ · 0.7 nm', z0: -9.6, z1: -8.1, pos: L(cen[0], cen[1] - 0.05, cen[2] + 0.28), amber: true, right: true },
    { text: 'Arg485 (guanidinium)', z0: -9.6, z1: -8.25, pos: L(R485c[0], R485c[1], R485c[2] + 0.06) },
    { text: 'Thr480', z0: -9.6, z1: -8.25, pos: L(rp.T480[0], rp.T480[1], rp.T480[2] + 0.05) },
    { text: 'Ser654 (backbone NH)', z0: -9.6, z1: -8.25, pos: L(rp.S654[0], rp.S654[1], rp.S654[2] + 0.05) },
    { text: 'Glu705', z0: -9.6, z1: -8.25, pos: L(E705c[0], E705c[1], E705c[2] + 0.06), right: true },
    { text: 'Tyr450', z0: -8.8, z1: -8.25, pos: L(Y450c[0], Y450c[1], Y450c[2] + 0.05), right: true },
    { text: 'hydrogen bond · 0.31 nm', z0: -9.6, z1: -8.3, pos: hbMid, amber: true },
    { text: 'crystal water', z0: -9.6, z1: -8.25, pos: L(rp.W1[0], rp.W1[1], rp.W1[2] + 0.04), right: true },
    { text: 'lobe D1', z0: -9.1, z1: -8.0, pos: L(MD.d1[0], MD.d1[1] + 0.3, MD.d1[2]) },
    { text: 'lobe D2', z0: -9.1, z1: -8.0, pos: L(MD.d2[0] + 0.2, MD.d2[1] - 0.4, MD.d2[2]), right: true },
    { text: 'ligand-binding domain · a clamshell that closes on glutamate', z0: -8.3, z1: -7.65, pos: L(4.2, 2.8, 0), right: true },
    { text: 'AMPA receptor · GluA2 · 3KG2', z0: -8.2, z1: -7.0, pos: L(MD.atd[0], MD.atd[1] + 4.6, -0.2) },
    { text: 'N-terminal domains', z0: -7.95, z1: -7.0, pos: L(MD.atd[0] + 3.5, MD.atd[1], -0.2), right: true },
    { text: 'Na⁺ through the channel pore', z0: -7.9, z1: -7.0, pos: L(axX + 0.5, -3.4, -0.2), right: true, amber: true },
  ];
  const lv = {
    group, anchor: A.Mol, labels, nestR: 12e-9,
    update(t, S, zc, c) {
      // the engine hands this level a virtual camera when the field is wider than its own range: take the real field width from the root scale (Wu / s) so every LOD follows the real camera
      const par = group.parent, sc = par ? par.scale.x : 0, qv = new URLSearchParams(location.search), fov = qv.has('fov') ? Number(qv.get('fov')) : 14;
      const Wu = 2 * 16 * Math.tan(fov * Math.PI / 360) * (innerWidth / innerHeight), W = sc > 0 ? Wu / sc * 1e9 : c.W * 1e9, z = Math.log10(W * 1e-9);
      lv.nestR = Math.min(12e-9, 0.5 * W * 1e-9);   // the engine hides an outer level when an inner level's region covers the screen: this level has no backdrop, so its region must never cover it (the synapse stays drawn around the receptor)
      gHead.material.size = 2.6 * NM * sc; gTrail.material.size = 1.3 * NM * sc;   // world-unit size of the glow sprites = their physical size
      rec.hi.visible = W < 4.4; rec.lo.visible = !rec.hi.visible; rec.cartoon.visible = false;
      pk.setH(); sol.setH(); fMat.userData.setH();
      let clos = 0, spl = 0; const fl = [];
      for (const [k, age] of S.ages) { clos = Math.max(clos, env(age, 0.0, 0.1, 0.55, 1.5)); spl = Math.max(spl, env(age, 0.12, 0.26, 0.6, 1.3)); if (age < 1.6) fl.push([k, age]); }
      const open = 0.5 * (1 - clos); rec.U.uOpen.value = open; rec.U.uSplay.value = spl;
      pk.lod(W); pk.update(open, 0.16 * clos + 0.03 * S.E);
      halo.scale.set(1.8, 1.8, 1); halo.material.opacity = 0.36 * clos + 0.045;   // fixed physical size: a glow around the ligand, sub-pixel when the field is wide
      sol.conduct(t, spl, W);
      // glutamate batches: 5 molecules per keystroke fall through the cleft beside the receptor towards neighbouring receptors
      fAt.clear(); let nb = 0, nh = 0, nt = 0; const hp = gHead.geometry.attributes, tp = gTrail.geometry.attributes; const near = 1 - ss(120, 320, W), far = ss(80, 240, W), gx = 1;   // true size: ball-and-stick until it is a couple of pixels, then a glow of the same physical size
      for (const [k, age] of fl) for (let j = 0; j < 5 && nh < NF; j++) {
        const h1 = hash(k, j, 1), h2 = hash(k, j, 2), h3 = hash(k, j, 3); const p = ss(0, 1.5, age); const tg = j < 2, x0 = tg ? 1.0 + h1 * 1.6 : 3.6 + h1 * 6, y0 = tg ? 8 + h2 * 3 : 12 + h2 * 5, zz = tg ? -0.9 - h3 * 0.5 : -0.6 - h3 * 1.5;
        const px = tg ? x0 + Math.sin(age * 3 + h1 * 9) * 0.5 * (1 - p) + p * (0.3 - x0) : x0 + Math.sin(age * 3 + h1 * 9) * 0.5 + p * 1.8, py = tg ? y0 - p * (y0 - 0.5) : y0 - p * (12.5 + h2 * 3), s = 1 - ss(1.1, 1.6, age);
        ee.set(age * 2 + h1 * 6, age * 1.7 + h2 * 6, age * 1.3); qq.setFromEuler(ee);
        if (near > 0.01) { const sc = s * near * gx; tpl.forEach((a) => { vv.set(a[1], a[2], a[3]).applyQuaternion(qq); fAt.add(px + vv.x * sc, py + vv.y * sc, zz + vv.z * sc, EC[a[0]], 0.046 * sc * (a[0] === 'H' ? 0.57 : 1)); });
          hero.bonds.forEach(([i, k2]) => { if (nb >= fBond.instanceMatrix.count) return; const a = tpl[i], b = tpl[k2]; pA.set(a[1], a[2], a[3]).applyQuaternion(qq).multiplyScalar(sc).add(vv.set(px, py, zz)); pB.set(b[1], b[2], b[3]).applyQuaternion(qq).multiplyScalar(sc).add(vv); kit.putDir(fBond, nb++, pA, pB, 0.012 * sc); }); }
        if (far > 0.01) { gC.setRGB(1.0, 0.72, 0.30).multiplyScalar(far * s); hp.position.setXYZ(nh, px, py, zz); hp.color.setXYZ(nh, gC.r, gC.g, gC.b); nh++;
          for (let q2 = 1; q2 <= 4; q2++) { const f2 = (1 - q2 / 5) * far * s * 0.7; tp.position.setXYZ(nt, px - 0.25 * q2, py + q2 * 0.9 * (1 + p), zz); tp.color.setXYZ(nt, 1.0 * f2, 0.6 * f2, 0.2 * f2); nt++; } } }
      fAt.flush(); fBond.count = nb; fBond.instanceMatrix.needsUpdate = true;
      for (let i = nh; i < NF; i++) hp.color.setXYZ(i, 0, 0, 0); for (let i = nt; i < NF * 4; i++) tp.color.setXYZ(i, 0, 0, 0);
      hp.position.needsUpdate = hp.color.needsUpdate = tp.position.needsUpdate = tp.color.needsUpdate = true; gHead.visible = gTrail.visible = far > 0.01;
    },
  };
  return lv;
}
