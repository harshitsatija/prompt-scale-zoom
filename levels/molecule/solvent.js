// explicit water (equilibrated SPC216 cell, drawn with TIP3P geometry: O-H 0.0957 nm, HOH 104.52 deg), Na+ / Cl- at ~150 mM, and the ions that conduct through the pore.
// Atoms are sphere impostors; the O radius grows from ball-and-stick (0.05 nm) to near space-filling (0.115 nm) as the field widens, the H atoms melt into it.
import { loadGz, stickGeo, merge, Atoms, impostorMaterial, ss } from './util.js';
export async function buildSolvent(ctx, pocket) {
  const { T, kit } = ctx; const ab = await loadGz(ctx, 'molecule/water.bin.gz');
  const hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, 0, 512))); const n = hdr.n; let o = 512;
  const pos = new Float32Array(ab.slice(o, o + n * 12)); o += n * 12; const qi = new Uint8Array(ab.slice(o, o + n)); o += (n + 3) >> 2 << 2; const Q = new Float32Array(ab.slice(o, o + 216 * 16)); o += 216 * 16;
  const na = new Float32Array(ab.slice(o, o + hdr.nna * 12)); o += hdr.nna * 12; const cl = new Float32Array(ab.slice(o, o + hdr.ncl * 12)); o += hdr.ncl * 12; const dq = new Uint8Array(ab.slice(o, o + n));
  const hx = 0.0957 * Math.sin(104.52 / 2 * Math.PI / 180), hy = 0.0957 * Math.cos(104.52 / 2 * Math.PI / 180);
  const mat = impostorMaterial(T), matI = impostorMaterial(T), matC = impostorMaterial(T); matC.uniforms.uGlow.value = 0.45; mat.uniforms.uTint.value.set(1, 1, 1);
  const wO = new Atoms(T, mat, 70000), wH = new Atoms(T, mat, 36000), iNa = new Atoms(T, matI, 600), iCl = new Atoms(T, matI, 600), cond = new Atoms(T, matC, 24);
  // O-H sticks (only near zoom)
  const stick = kit.inst(new T.CylinderGeometry(1, 1, 1, 10, 1, true), kit.toon(0xc9d2ff), 3400); stick.count = 0;
  const root = new T.Group(); root.add(wO.obj, wH.obj, iNa.obj, iCl.obj, cond.obj, stick);
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => pos[b * 3 + 2] - pos[a * 3 + 2]);
  const ZT = -6.0, ZB = -0.1; const BX = hdr.bounds, MEMY = pocket.meta.mem_y; const colO = [new T.Color(0x8d9cf5), new T.Color(0x2f3a96)], colH = new T.Color(0xe4e9ff);
  const q = new T.Quaternion(), vh = new T.Vector3(), pa = new T.Vector3(), pb = new T.Vector3();
  const lerp = (a, b, t) => a + (b - a) * t;
  const hz = (i) => ((Math.imul(i + 1, 2654435761) >>> 8) & 1023) / 1023;
  let last = '';
  function refresh(fx, fy, W) {
    // 3 regimes: ball-and-stick (W<3.4 nm), dense tri-atom TIP3P (to ~14 nm), then O-only depth-faded haze (the same real waters, thinned) from afar
    const haze = ss(14, 30, W), mode = W < 3.4 ? 2 : (W < 30 ? 1 : 0); const key = [mode, Math.round(fx / (W * 0.08)), Math.round(fy / (W * 0.08)), Math.round(W * 6)].join(); if (key === last) return; last = key;
    wO.clear(); wH.clear(); iNa.clear(); iCl.clear(); let ns = 0;
    const hw = W * 0.56 + 1.2, hh = W * 0.36 + 1.2, rO = W < 3.4 ? 0.05 + 0.012 * ss(1, 3.4, W) : 0.062 + 0.014 * ss(3.4, 10, W) + 0.03 * haze, keepP0 = 1 - 0.5 * ss(10, 30, W) - 0.22 * ss(30, 52, W), rH = 0.034 * (1 - ss(8, 14, W)), zSkip = -1.15 * ss(5, 9, W) - 1.9 * ss(9, 16, W) * (1 - 0.55 * ss(22, 34, W));
    const showH = rH > 0.004, sticks = W < 3.4, dimF = 1 - 0.5 * ss(5, 24, W);
    for (let ii = 0; ii < n; ii++) { const i = idx[ii]; const x = pos[i * 3], y = pos[i * 3 + 1]; if (Math.abs(x - fx) > hw || Math.abs(y - fy) > hh) continue;
      const z = pos[i * 3 + 2]; const eg = ss(0, 12, Math.min(x - BX[0], BX[1] - x, BX[3] - y)), dd = z < -2.75 ? ss(0, 6, Math.min(x + 17, 9 - x, y - (MEMY - 5), 17 - y)) : 1, keepP = keepP0 * dd * (haze > 0 ? lerp(1, eg, haze) : 1); if (keepP < 0.999 && hz(i) > keepP) continue; if (z > zSkip && zSkip < -0.01) continue; const dep = Math.min(1, Math.max(0, (z - ZB) / (ZT - ZB))); // 0 near the section plane, 1 deep: deeper waters sink into the backdrop
      // hydration shell (<~0.6 nm from the protein, the byte dq) stays bright and full-size; bulk water recedes into the backdrop at wide fields (value hierarchy: receptor + membrane carry the frame)
      const shell = 1 - ss(0.45, 1.3, dq[i] / 100), rec = ss(6, 16, W) * (1 - shell); if (rec > 0 && hz(i + 21) < 0.78 * rec) continue;
      const sh = (1 - 0.62 * dep) * (0.88 + 0.24 * hz(i + 7)) * dimF * (1 - 0.38 * rec); const mx = 0.55 * rec, cr = (colO[0].r + (colO[1].r - colO[0].r) * dep) * (1 - mx) + 0.20 * mx, cg = (colO[0].g + (colO[1].g - colO[0].g) * dep) * (1 - mx) + 0.22 * mx, cb = (colO[0].b + (colO[1].b - colO[0].b) * dep) * (1 - mx) + 0.55 * mx;
      if (!wO.add(x, y, z, [cr, cg, cb], rO * (0.95 + 0.1 * hz(i + 3)) * (1 - 0.3 * rec), sh)) break;
      if (showH) { const j = qi[i] * 4; q.set(Q[j], Q[j + 1], Q[j + 2], Q[j + 3]); vh.set(hx, hy, 0).applyQuaternion(q); const h1 = [x + vh.x, y + vh.y, z + vh.z]; vh.set(-hx, hy, 0).applyQuaternion(q); const h2 = [x + vh.x, y + vh.y, z + vh.z];
        wH.add(h1[0], h1[1], h1[2], colH.getHex(), rH, sh); wH.add(h2[0], h2[1], h2[2], colH.getHex(), rH, sh);
        if (sticks && ns < 3400) { pa.set(x, y, z); pb.set(...h1); kit.putDir(stick, ns++, pa, pb, 0.011); pb.set(...h2); kit.putDir(stick, ns++, pa, pb, 0.011); } } }
    stick.count = ns; stick.instanceMatrix.needsUpdate = true;
    const rNa = 0.06 + 0.02 * ss(3, 8, W) + 0.04 * haze, rCl = 0.085 + 0.03 * ss(3, 8, W) + 0.03 * haze;
    const place = (A, arr, hex, r) => { for (let i = 0; i < arr.length / 3; i++) { const x = arr[i * 3], y = arr[i * 3 + 1]; if (Math.abs(x - fx) > hw || Math.abs(y - fy) > hh) continue; if (arr[i * 3 + 2] < -2.75 && ss(0, 6, Math.min(x + 17, 9 - x, y - (MEMY - 5), 17 - y)) < hz(i + 11)) continue; if (haze > 0.01 && hz(i + 5) > 1 - 0.8 * haze) continue; const dep = Math.min(1, Math.max(0, (arr[i * 3 + 2] - ZB) / (ZT - ZB))); A.add(x, y, arr[i * 3 + 2], hex, r, (1 - 0.45 * dep) * (1 - 0.6 * haze)); } A.flush(); };
    place(iNa, na, 0xffc069, rNa); place(iCl, cl, 0xa6e8ff, rCl);
    wO.flush(); wH.flush(); wH.obj.visible = showH;
  }
  // conduction: hydrated sodium ions wander down the pore (irregular lateral path, random phase and speed) while the gate is open
  const ax = pocket.meta.axis; const hash = ctx.timeline.hash; const NC = 14;
  function conduct(t, open, W = 5) { const rc = 0.075 + 0.0035 * Math.min(W, 40);
    cond.clear(); if (open > 0.12) for (let i = 0; i < NC; i++) { const sp = 1.1 + 0.9 * hash(i, 7, 1), ph = ((t * sp * 0.9 + hash(i, 7, 2) * 5) % 1); const y = -0.2 - ph * 7.6;
      const a = hash(i, 7, 3) * 6.28 + y * 1.7 + Math.sin(t * 2.3 + i) * 0.9; const w = 0.03 + 0.2 * Math.abs(Math.sin(y * 1.3 + i * 2.9)) * (0.4 + hash(i, 7, 4)); cond.add(ax[0] + Math.cos(a) * w, y, -0.13 + Math.sin(a) * w * 0.9, 0xffd166, rc, 1.0); }
    cond.flush();
  }
  return { root, refresh, conduct, n, setH: () => [mat, matI, matC].forEach((m) => m.userData.setH()) };
}
// the level no longer draws a solvent box or a lipid slab (the synapse level supplies the membrane and the cleft); only the hydrated Na+ ions that conduct through the open pore remain
export function buildConductor(ctx, pocket) {
  const { T } = ctx; const matC = impostorMaterial(T); matC.uniforms.uGlow.value = 0.45; const cond = new Atoms(T, matC, 24); const root = new T.Group(); root.add(cond.obj);
  const ax = pocket.meta.axis; const hash = ctx.timeline.hash; const NC = 14;
  function conduct(t, open, W = 5) { const rc = 0.075 + 0.0035 * Math.min(W, 40);
    cond.clear(); if (open > 0.12) for (let i = 0; i < NC; i++) { const sp = 1.1 + 0.9 * hash(i, 7, 1), ph = ((t * sp * 0.9 + hash(i, 7, 2) * 5) % 1); const y = -0.2 - ph * 7.6;
      const a = hash(i, 7, 3) * 6.28 + y * 1.7 + Math.sin(t * 2.3 + i) * 0.9; const w = 0.03 + 0.2 * Math.abs(Math.sin(y * 1.3 + i * 2.9)) * (0.4 + hash(i, 7, 4)); cond.add(ax[0] + Math.cos(a) * w, y, -0.13 + Math.sin(a) * w * 0.9, 0xffd166, rc, 1.0); }
    cond.flush(); }
  return { root, conduct, setH: () => matC.userData.setH() };
}
