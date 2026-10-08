/* city/near.js: the neighbourhood (r < 1.8 km) from real OSM footprints: extruded buildings with procedural night facades, roof clutter (water tanks, stair-heads), trees. */
import { hash2, rng } from './data.js';
import { facadeMaterial } from './facade.js';
const lin = (c) => Math.pow(c / 255, 2.2);
const WALLS = [[236, 222, 192], [222, 198, 162], [232, 184, 146], [208, 172, 124], [196, 208, 202], [182, 194, 216], [226, 212, 216], [204, 204, 208], [216, 156, 128], [242, 238, 228], [198, 176, 150], [170, 178, 196]];
const ROOFS = [[146, 142, 150], [112, 110, 122], [172, 168, 160], [178, 112, 90], [200, 176, 128], [150, 172, 164], [128, 150, 190], [196, 160, 150], [210, 206, 198], [120, 116, 124], [186, 170, 140], [160, 150, 170]];
const ROOF_W = [0.26, 0.2, 0.14, 0.03, 0.09, 0.03, 0.02, 0.05, 0.06, 0.04, 0.05, 0.03];
function pickRoof(seed, kind) { if (kind === 6 || kind === 5) { const q = [3, 7, 1, 0, 4][Math.floor(seed * 97) % 5]; return ROOFS[q]; } let t = (seed * 7.31) % 1; for (let i = 0; i < ROOF_W.length; i++) { t -= ROOF_W[i]; if (t < 0) return ROOFS[i]; } return ROOFS[0]; }
const KIND_WALL = { 2: [232, 150, 78], 3: [238, 240, 244], 4: [240, 212, 120], 5: [176, 180, 190] };
export function buildNear(ctx, D, terrain, pred) {
  const { T, kit } = ctx, P = D.nearPts, GROUND = ctx.geom.GROUND;
  for (const b of D.nearBld) if (b.cx === undefined) { let x = 0, z = 0; for (let i = 0; i < b.n; i++) { x += P[(b.off + i) * 2]; z += P[(b.off + i) * 2 + 1]; } b.cx = x / b.n / 10; b.cz = z / b.n / 10; }
  const B = D.nearBld.filter((b) => !pred || pred(b.cx, b.cz));
  let nv = 0, ni = 0; for (const b of B) { nv += b.n * 8 + b.n; ni += b.n * 12 + (b.n - 2) * 3; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), rof = new Float32Array(nv * 3), fac = new Float32Array(nv * 4), idx = new Uint32Array(ni);
  let vo = 0, io = 0; const tanks = [], heads = [], panels = [], dishes = [], acs = [], plants = [], htanks = [], v2 = [];
  for (let bi = 0; bi < B.length; bi++) {
    const b = B[bi], n = b.n; let sa = 0, cx = 0, cz = 0; const px = new Float32Array(n), pz = new Float32Array(n);
    for (let i = 0; i < n; i++) { px[i] = P[(b.off + i) * 2] / 10; pz[i] = P[(b.off + i) * 2 + 1] / 10; cx += px[i]; cz += pz[i]; }
    cx /= n; cz /= n; for (let i = 0; i < n; i++) { const j = (i + 1) % n; sa += px[i] * pz[j] - px[j] * pz[i]; }
    const by = terrain.groundY(cx, cz) - GROUND, h = Math.max(2.6, b.h), ph = h > 4 && b.kind !== 6 ? 0.8 : 0;
    const wc = KIND_WALL[b.kind] ? KIND_WALL[b.kind] : WALLS[Math.floor(hash2(cx * 0.37, cz * 0.53) * WALLS.length) % WALLS.length];
    const rr = pickRoof(b.seed, b.kind); const wl = [lin(wc[0]), lin(wc[1]), lin(wc[2])], rl = [lin(rr[0]), lin(rr[1]), lin(rr[2])];
    let u = 0; const base = vo; const sgn = sa > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, ax = px[i], az = pz[i], bx = px[j], bz = pz[j], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1e-6; const nx = sgn * dz / L, nz = -sgn * dx / L;
      for (let k = 0; k < 4; k++) { const o = (vo + k) * 3, top = k >= 2, pxk = (k === 0 || k === 3) ? ax : bx, pzk = (k === 0 || k === 3) ? az : bz; pos[o] = pxk; pos[o + 1] = by + (top ? h + ph : 0); pos[o + 2] = pzk; nor[o] = nx; nor[o + 1] = 0; nor[o + 2] = nz; col[o] = wl[0]; col[o + 1] = wl[1]; col[o + 2] = wl[2]; rof[o] = rl[0]; rof[o + 1] = rl[1]; rof[o + 2] = rl[2]; const f = (vo + k) * 4; fac[f] = (k === 0 || k === 3) ? u : u + L; fac[f + 1] = top ? h + ph : 0; fac[f + 2] = b.seed; fac[f + 3] = h + ph; }
      // winding: front face must point along (nx,nz)
      const a0 = vo, b0 = vo + 1, b1 = vo + 2, a1 = vo + 3; const cy = (b0x(pos, a0, b0, b1, nx, nz)); if (cy) { idx[io++] = a0; idx[io++] = b0; idx[io++] = b1; idx[io++] = a0; idx[io++] = b1; idx[io++] = a1; } else { idx[io++] = a0; idx[io++] = b1; idx[io++] = b0; idx[io++] = a0; idx[io++] = a1; idx[io++] = b1; }
      u += L; vo += 4;
      if (ph > 0) { // parapet cap: a 0.3 m wide up-facing strip along the top of the wall
        const ix = -nx * 0.3, iz = -nz * 0.3; const q = [[ax, az], [bx, bz], [bx + ix, bz + iz], [ax + ix, az + iz]];
        for (let k = 0; k < 4; k++) { const o = vo * 3; pos[o] = q[k][0]; pos[o + 1] = by + h + ph; pos[o + 2] = q[k][1]; nor[o] = 0; nor[o + 1] = 1; nor[o + 2] = 0; col[o] = wl[0]; col[o + 1] = wl[1]; col[o + 2] = wl[2]; rof[o] = rl[0] * 1.25; rof[o + 1] = rl[1] * 1.25; rof[o + 2] = rl[2] * 1.25; const f = vo * 4; fac[f] = 0; fac[f + 1] = h; fac[f + 2] = b.seed; fac[f + 3] = h; vo++; }
        const c0 = vo - 4; if ((q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]) < 0) { idx[io++] = c0; idx[io++] = c0 + 1; idx[io++] = c0 + 2; idx[io++] = c0; idx[io++] = c0 + 2; idx[io++] = c0 + 3; } else { idx[io++] = c0; idx[io++] = c0 + 2; idx[io++] = c0 + 1; idx[io++] = c0; idx[io++] = c0 + 3; idx[io++] = c0 + 2; } } }
    // roof
    const rb = vo; for (let i = 0; i < n; i++) { const o = vo * 3; pos[o] = px[i]; pos[o + 1] = by + h; pos[o + 2] = pz[i]; nor[o] = 0; nor[o + 1] = 1; nor[o + 2] = 0; col[o] = wl[0]; col[o + 1] = wl[1]; col[o + 2] = wl[2]; rof[o] = rl[0]; rof[o + 1] = rl[1]; rof[o + 2] = rl[2]; const f = vo * 4; fac[f] = 0; fac[f + 1] = h; fac[f + 2] = b.seed; fac[f + 3] = h; vo++; }
    const contour = []; for (let i = 0; i < n; i++) contour.push(new T.Vector2(px[i], pz[i])); let tris = []; try { tris = T.ShapeUtils.triangulateShape(contour, []); } catch (e) { tris = []; }
    for (const t of tris) { const a = rb + t[0], b2 = rb + t[1], c = rb + t[2]; const ux = px[t[1]] - px[t[0]], uz = pz[t[1]] - pz[t[0]], vx = px[t[2]] - px[t[0]], vz = pz[t[2]] - pz[t[0]]; const ny = uz * vx - ux * vz; if (ny > 0) { idx[io++] = a; idx[io++] = b2; idx[io++] = c; } else { idx[io++] = a; idx[io++] = c; idx[io++] = b2; } }
    // roof clutter: Sintex water tanks, solar heaters, stair-head (mumty), all placed inside the real footprint
    if (b.area > 38 && b.kind !== 2 && h > 3.2 && Math.hypot(cx, cz) < 650) {
      const inside = (x, z) => { let ins = false; for (let i = 0, j = n - 1; i < n; j = i++) if ((pz[i] > z) !== (pz[j] > z) && x < (px[j] - px[i]) * (z - pz[i]) / (pz[j] - pz[i]) + px[i]) ins = !ins; return ins; };
      const spread = Math.sqrt(b.area) * 0.32, top = by + h + 0.0; const nT = b.area < 90 ? 1 : b.area < 260 ? 2 : 3; let placed = 0;
      for (let k = 0; k < 14 && placed < nT; k++) { const x = cx + (hash2(cx + k, cz) - 0.5) * 2 * spread, z = cz + (hash2(cx, cz + k * 1.7) - 0.5) * 2 * spread; if (!inside(x, z) || !inside(x + 0.9, z) || !inside(x - 0.9, z) || !inside(x, z + 0.9) || !inside(x, z - 0.9)) continue; tanks.push([x, top, z, 0.5 + 0.28 * hash2(x, z), hash2(x * 3, z * 3)]); placed++; }
      if (b.area > 60 && hash2(cz, cx) < 0.55) { const x = cx - spread * 0.6, z = cz + spread * 0.5; if (inside(x, z) && inside(x + 1.2, z) && inside(x, z + 1.0)) { const ry = hash2(x, 5) * 0.4; panels.push([x, top, z, ry]); htanks.push([x + 0.3, top, z - 0.9, ry]); } }
      for (let k = 0; k < 10; k++) { if (hash2(cx * 3 + k, cz * 5) > 0.5 && k > 0) continue; const x = cx + (hash2(cx + k * 2.3, cz + 1) - 0.5) * 1.7 * spread, z = cz + (hash2(cx + 5, cz + k * 1.9) - 0.5) * 1.7 * spread; if (!inside(x, z) || !inside(x + 0.8, z) || !inside(x - 0.8, z) || !inside(x, z + 0.8) || !inside(x, z - 0.8)) continue; const q = hash2(x * 2.1, z * 1.3); if (q < 0.22) dishes.push([x, top, z, hash2(z, x) * 6.28]); else if (q < 0.4) { acs.push([x, top, z, hash2(z, x) * 3.14]); if (q < 0.3) acs.push([x + 0.9, top, z + 0.1, hash2(x, x) * 3.14]); } if (k > 5) break; }
      if (b.area > 150 && hash2(cx, 3) > 0.2) { const x = cx + spread * 0.5, z = cz - spread * 0.4; if (inside(x, z) && inside(x + 1.6, z) && inside(x - 1.6, z) && inside(x, z + 1.6) && inside(x, z - 1.6)) heads.push([x, top, z, 0.9 + hash2(x, 3) * 0.3]); }
    }
    v2.push([cx, cz, by]);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos.subarray(0, vo * 3), 3)); g.setAttribute('normal', new T.BufferAttribute(nor.subarray(0, vo * 3), 3)); g.setAttribute('color', new T.BufferAttribute(col.subarray(0, vo * 3), 3)); g.setAttribute('aRoof', new T.BufferAttribute(rof.subarray(0, vo * 3), 3)); g.setAttribute('aFac', new T.BufferAttribute(fac.subarray(0, vo * 4), 4)); g.setIndex(new T.BufferAttribute(idx.subarray(0, io), 1));
  const mat = facadeMaterial(kit, T, 'mesh'); const mesh = new T.Mesh(g, mat); mesh.frustumCulled = false; mesh.position.y = GROUND;
  const grp = new T.Group(); grp.add(mesh);
  // water tanks (Sintex black / off-white), solar heaters, stair-heads
  // Sintex-style water tank: lathe profile with two ribs, rounded shoulder, domed lid and a screw-cap knob (smooth normals); ~1.2 m wide, 1.3 m tall
  const prof = [[0, 0], [0.55, 0], [0.6, 0.05], [0.6, 0.28], [0.635, 0.31], [0.635, 0.36], [0.6, 0.39], [0.6, 0.62], [0.635, 0.65], [0.635, 0.70], [0.6, 0.73], [0.6, 0.93], [0.55, 1.03], [0.42, 1.14], [0.22, 1.2], [0.15, 1.21], [0.15, 1.27], [0.1, 1.29], [0, 1.29]].map((p) => new T.Vector2(p[0], p[1]));
  const tkGeo = new T.LatheGeometry(prof, 22); tkGeo.deleteAttribute('uv'); const tk = kit.inst(tkGeo, kit.toon(0xffffff), tanks.length, { ink: false }); const cc = new T.Color();
  tanks.forEach((t, i) => { const sc = 0.8 + t[3] * 0.6; kit.put(tk, i, t[0], t[1] + 0.12, t[2], sc, sc * (0.9 + 0.2 * t[4]), sc); const k = t[4]; cc.setRGB(...(k < 0.7 ? [0.05, 0.05, 0.075] : k < 0.88 ? [0.8, 0.78, 0.72] : [0.1, 0.16, 0.34])); tk.setColorAt(i, cc); }); tk.instanceColor.needsUpdate = true; tk.position.y = GROUND;
  const box = (w, h, d, x, y, z, c) => { const g = new T.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y, z); g.deleteAttribute('uv'); const n = g.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; } g.setAttribute('color', new T.BufferAttribute(col, 3)); return g; };
  const mergeVC = (gs) => { let nv = 0; for (const g of gs) nv += g.attributes.position.count; const o = { position: new Float32Array(nv * 3), normal: new Float32Array(nv * 3), color: new Float32Array(nv * 3) }; let off = 0; for (const g of gs) { for (const k in o) o[k].set(g.attributes[k].array, off * 3); off += g.attributes.position.count; } const m = new T.BufferGeometry(); for (const k in o) m.setAttribute(k, new T.BufferAttribute(o[k], 3)); return m; };
  // stair-head (mumty): walls, overhanging RCC slab, a door and a small window
  const shGeo = mergeVC([box(2.8, 2.5, 3.0, 0, 1.25, 0, [1, 1, 1]), box(3.2, 0.14, 3.4, 0, 2.57, 0, [0.78, 0.78, 0.8]), box(0.95, 1.95, 0.08, 0.35, 0.98, 1.52, [0.16, 0.12, 0.14]), box(0.6, 0.5, 0.06, -0.8, 1.6, 1.51, [0.18, 0.2, 0.3])]);
  const shMat = kit.toon(0xffffff, { vc: true });
  const spG = (() => { const mk = (x) => { const g = new T.BoxGeometry(1.0, 0.05, 1.7).toNonIndexed(); g.rotateX(-0.5); g.translate(x, 0.65, 0); g.deleteAttribute('uv'); return g; }; const a = mk(-0.52), b = mk(0.52); const P = new Float32Array(a.attributes.position.count * 6), N = new Float32Array(P.length); P.set(a.attributes.position.array); P.set(b.attributes.position.array, a.attributes.position.array.length); N.set(a.attributes.normal.array); N.set(b.attributes.normal.array, a.attributes.normal.array.length); const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3)); return g; })();
  const sp = kit.inst(spG, kit.toon(0x23356e, { glow: 0x0b1030, glowK: 0.3 }), panels.length, { ink: false }); panels.forEach((t, i) => kit.put(sp, i, t[0], t[1] + 0.05, t[2], 1, 1, 1, 0, t[3] * 0.4, 0)); sp.position.y = GROUND;
  const sh = kit.inst(shGeo, shMat, heads.length, { ink: false }); heads.forEach((t, i) => { kit.put(sh, i, t[0], t[1], t[2], t[3], t[3], t[3], 0, Math.floor(hash2(t[0], t[2]) * 4) * Math.PI / 2, 0); const q = hash2(t[2], t[0]); cc.setRGB(0.8 + 0.1 * q, 0.76 + 0.1 * q, 0.68 + 0.1 * q); sh.setColorAt(i, cc); }); sh.instanceColor.needsUpdate = true; sh.position.y = GROUND;
  const cl = new T.Group(); cl.add(tk, sp, sh); const ptl = [new T.Color(0.94, 0.93, 0.9), new T.Color(0.7, 0.72, 0.8), new T.Color(0.55, 0.6, 0.7)];
  const dsG = new T.SphereGeometry(0.5, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.42); dsG.deleteAttribute('uv'); const dm = kit.toon(0xe9e4da, { side: T.DoubleSide }); const ds = kit.inst(dsG, dm, dishes.length, { ink: false });
  dishes.forEach((t, i) => { kit.put(ds, i, t[0], t[1] + 1.25, t[2], 1, 1, 1, -0.9, t[3], 0); ds.setColorAt(i, ptl[i % 3]); }); ds.instanceColor.needsUpdate = true; ds.position.y = GROUND; cl.add(ds);
  const acG = new T.BoxGeometry(1, 1, 1); acG.deleteAttribute('uv'); const ac = kit.inst(acG, kit.toon(0xffffff), acs.length, { ink: false }); acs.forEach((t, i) => { kit.put(ac, i, t[0], t[1] + 0.35, t[2], 0.9, 0.7, 0.45, 0, t[3], 0); ac.setColorAt(i, ptl[i % 3]); }); ac.instanceColor.needsUpdate = true; ac.position.y = GROUND; cl.add(ac);
  const htG = new T.CylinderGeometry(0.3, 0.3, 1.5, 10); htG.rotateZ(Math.PI / 2); htG.deleteAttribute('uv'); const ht = kit.inst(htG, kit.toon(0xf2f0ea), htanks.length, { ink: false }); htanks.forEach((t, i) => kit.put(ht, i, t[0], t[1] + 0.95, t[2], 1, 1, 1, 0, t[3], 0)); ht.position.y = GROUND; cl.add(ht);
  grp.add(cl);
  return { group: grp, mesh, tanks: cl, heads: cl, panels: cl, mat, centers: v2, buildings: B };
}
function b0x(pos, a, b, c, nx, nz) { // true if triangle (a,b,c) faces (nx,0,nz)
  const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2]; const ux = pos[b * 3] - ax, uy = pos[b * 3 + 1] - ay, uz = pos[b * 3 + 2] - az, vx = pos[c * 3] - ax, vy = pos[c * 3 + 1] - ay, vz = pos[c * 3 + 2] - az;
  const cx = uy * vz - uz * vy, cz = ux * vy - uy * vx; return cx * nx + cz * nz > 0; }
