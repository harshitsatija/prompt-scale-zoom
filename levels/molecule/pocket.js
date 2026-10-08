// glutamate (ball-and-stick), lining residues (licorice), crystal waters and hydrogen-bond dotted lines in each of the four LBD pockets.
// Atoms are sphere impostors (perfectly smooth); bonds are 16-sided capped cylinders. All sizes are in nm.
import { stickGeo, merge, rodrigues, Atoms, impostorMaterial } from './util.js';
const LIG = { C: 0xffe6a8, O: 0xff7a68, N: 0x8fb4ff, H: 0xe3e7ff };   // the synapse level's glutamate palette
const KEY = new Set([450, 478, 480, 485, 654, 655, 705]);   // residues that hold glutamate (1FTJ): Tyr450 stacks, Pro478 O / Thr480 / Arg485 / Ser654 / Thr655 / Glu705 H-bond
const CKEY = 0xd2d6ff, COTH = 0x6f77b8;
const RES = { C: 0x9a9fd8, O: 0xe0684f, N: 0x5f9fe8, S: 0xe8bf5a };
const R_LIG = { C: 0.046, O: 0.044, N: 0.047, H: 0.0215 };   // ball radii ~ 0.3 x van der Waals so the 0.12-0.15 nm bonds are visible
const R_BOND = 0.0125;
const R_RES_ATOM = 0.0125, R_RES_BOND = 0.0115;
const BSEG = 16;
export function ligandBondGeometry(T, atoms, bonds, r = R_BOND) {
  const parts = []; bonds.forEach(([i, j]) => { const a = atoms[i], b = atoms[j]; const m = [(a[1] + b[1]) / 2, (a[2] + b[2]) / 2, (a[3] + b[3]) / 2]; const rr = (a[0] === 'H' || b[0] === 'H') ? r * 0.8 : r;
    parts.push(stickGeo(T, [a[1], a[2], a[3]], m, rr, LIG[a[0]], BSEG)); parts.push(stickGeo(T, m, [b[1], b[2], b[3]], rr, LIG[b[0]], BSEG)); });
  return merge(T, parts);
}
export function addLigandAtoms(A, atoms, ox = 0, oy = 0, oz = 0, s = 1) { atoms.forEach((a) => A.add(a[1] * s + ox, a[2] * s + oy, a[3] * s + oz, LIG[a[0]], R_LIG[a[0]] * s)); }
function residueBonds(T, residues) {
  const parts = [];
  residues.forEach((r) => { const k = KEY.has(r.rn), rr = k ? 0.0150 : 0.0095, cc = (e) => (e === 'C' ? (k ? CKEY : COTH) : (RES[e] || RES.C)); r.bonds.forEach(([i, j]) => { const a = r.atoms[i], b = r.atoms[j]; const m = [(a[1] + b[1]) / 2, (a[2] + b[2]) / 2, (a[3] + b[3]) / 2]; parts.push(stickGeo(T, [a[1], a[2], a[3]], m, rr, cc(a[0]), 12)); parts.push(stickGeo(T, m, [b[1], b[2], b[3]], rr, cc(b[0]), 12)); }); });
  return parts.length ? merge(T, parts) : null;
}
export function buildPockets(ctx, pocket) {
  const { T, kit } = ctx; const root = new T.Group();
  const impLig = impostorMaterial(T), impRes = impostorMaterial(T), impDot = impostorMaterial(T);
  const matB = kit.toon(0xdadae2, { vc: true }), matBL = kit.toon(0xdadae2, { vc: true, glow: 0xffb02e, glowK: 0.0 }); matBL.emissive.set(0xff9f1c); matBL.emissiveIntensity = 0;
  impDot.uniforms.uGlow.value = 0.18;
  const out = { chains: {}, mats: [impLig, impRes, impDot] };
  const hbAll = [];
  'DBC'.split('').forEach((cid) => {   // chain A's pocket lies in front of the section plane (z = +2.1 nm): it is cut away with the rest of that subunit
    const P = pocket.chains[cid], hero = cid === 'D' || cid === 'B'; const h = pocket.hinge[cid];
    // ligand
    const la = new Atoms(T, impLig, 24); addLigandAtoms(la, P.lig); la.flush(); root.add(la.obj);
    const lb = new T.Mesh(ligandBondGeometry(T, P.lig, P.bonds), matBL); lb.frustumCulled = false; root.add(lb);
    // residues: D1 side is static, D2 side rotates with the lobe
    const g1 = new T.Group(), g2 = new T.Group(); g2.matrixAutoUpdate = false;
    const hbA = new Set(P.hb.filter((b) => b[4] > 0).map((b) => b[4] + b[5]));
    const mk = (list, grp) => { const A = new Atoms(T, impRes, 400); list.forEach((r) => { const k = KEY.has(r.rn); r.atoms.forEach((a) => { const hbat = hbA.has(r.rn + a[4]); A.add(a[1], a[2], a[3], a[0] === 'C' ? (k ? CKEY : COTH) : (RES[a[0]] || RES.C), hbat ? 0.034 : (k ? 0.0165 : 0.0105)); }); }); A.flush(); grp.add(A.obj);
      const bg = residueBonds(T, list); if (bg) { const m = new T.Mesh(bg, matB); m.frustumCulled = false; grp.add(m); } };
    mk(P.res.filter((r) => !r.d2), g1); mk(P.res.filter((r) => r.d2), g2);
    // crystallographic waters (O only, 0.05 nm balls) on the D1 side
    const wa = new Atoms(T, impRes, 24); const pol = P.lig.filter((a) => a[0] !== 'C' && a[0] !== 'H');
    P.waters.forEach((w) => { wa.add(w[0], w[1], w[2], 0x9fb4ff, 0.04); let bd = 9, tg = null; pol.forEach((a) => { const d = Math.hypot(a[1] - w[0], a[2] - w[1], a[3] - w[2]); if (d < bd) { bd = d; tg = a; } }); if (!tg) return;
      const u = [tg[1] - w[0], tg[2] - w[1], tg[3] - w[2]], ul = Math.hypot(...u); u[0] /= ul; u[1] /= ul; u[2] /= ul; let v = [-u[1], u[0], 0]; const vl = Math.hypot(...v) || 1; v = v.map((q) => q / vl); const th = 104.52 * Math.PI / 180, r = 0.0957;
      wa.add(w[0] + u[0] * r, w[1] + u[1] * r, w[2] + u[2] * r, 0xe4e9ff, 0.02); wa.add(w[0] + (u[0] * Math.cos(th) + v[0] * Math.sin(th)) * r, w[1] + (u[1] * Math.cos(th) + v[1] * Math.sin(th)) * r, w[2] + (u[2] * Math.cos(th) + v[2] * Math.sin(th)) * r, 0xe4e9ff, 0.02); });
    wa.flush(); g1.add(wa.obj);
    root.add(g1, g2);
    P.hb.forEach((b) => hbAll.push({ cid, lig: P.lig[b[0]], tgt: b[1], d2: !!b[2], piv: h.pivot, ax: h.axis, th: h.theta, res: b[3] + b[4], an: b[5], d: b[6] }));
    out.chains[cid] = { la, lb, g2, g1, h, hero };
  });
  // hydrogen bonds: dotted lines of round amber beads from the donor/acceptor surface to the acceptor/donor surface
  const MAXD = hbAll.length * 10; const dash = kit.inst(new T.CylinderGeometry(1, 1, 1, 10, 1, false), kit.toon(0xffb02e, { glow: 0xff9f1c, glowK: 0.55 }), MAXD); dash.count = 0; root.add(dash); const vA = new T.Vector3(), vB = new T.Vector3(), vD = new T.Vector3();
  const m4 = new T.Matrix4(), mA = new T.Matrix4(), mB = new T.Matrix4(), mC = new T.Matrix4();
  out.update = (open, glow) => {
    Object.values(out.chains).forEach((c) => { const a = open * c.h.theta; const piv = c.h.pivot, ax = c.h.axis; c.g2.matrix.identity(); mA.makeTranslation(piv[0], piv[1], piv[2]); mB.makeRotationAxis(new T.Vector3(ax[0], ax[1], ax[2]), a); mC.makeTranslation(-piv[0], -piv[1], -piv[2]); c.g2.matrix.multiply(mA).multiply(mB).multiply(mC); c.g2.matrixWorldNeedsUpdate = true; c.lb.material.emissiveIntensity = glow; });
    impLig.uniforms.uGlow.value = Math.min(0.28, glow * 1.0);
    let nd = 0;
    hbAll.forEach((b) => { const A = [b.lig[1], b.lig[2], b.lig[3]]; const B = b.d2 ? rodrigues(b.tgt, b.piv, b.ax, open * b.th) : b.tgt; const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], L = Math.hypot(dx, dy, dz); if (L < 1e-6) return;
      const s0 = 0.052, s1 = L - 0.036, per = 0.042, len = 0.026; for (let s = s0; s + len <= s1 + 0.006 && nd < MAXD; s += per) { const t0 = s / L, t1 = Math.min(s + len, s1) / L; vA.set(A[0] + dx * t0, A[1] + dy * t0, A[2] + dz * t0); vB.set(A[0] + dx * t1, A[1] + dy * t1, A[2] + dz * t1); kit.putDir(dash, nd++, vA, vB, 0.0072); } });
    dash.count = nd; dash.instanceMatrix.needsUpdate = true;
  };
  out.lod = (W) => { const r = W < 6; Object.values(out.chains).forEach((c) => { c.g1.visible = r; c.g2.visible = r; }); dash.visible = W < 3.2; Object.values(out.chains).forEach((c) => { c.la.obj.visible = c.lb.visible = W < (c.hero && c === out.chains.D ? 1500 : 11); }); };   // the ligand stays until it is sub-pixel (0.7 nm in a 1.5 um field = 0.5 px)
  out.root = root; out.hbAll = hbAll; out.setH = () => out.mats.forEach((m) => m.userData.setH()); return out;
}
