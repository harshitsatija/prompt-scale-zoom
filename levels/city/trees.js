/* city/trees.js: real mapped trees (OSM natural=tree), street trees along real roads, compound trees in free plots, park trees inside real park polygons. */
import { hash2, rng } from './data.js';
const lin = (c) => Math.pow(c / 255, 2.2);
function crownGeo(T, detail, trunk) {
  const dropY = trunk ? 0 : -0.5;
  // 3-5 overlapping displaced lobes -> a cloud-like crown with a real, non-spherical silhouette; normals welded per lobe so it shades smoothly
  const LOBES = detail >= 2 ? [[0, 1.5, 0, 0.82, 0.3], [0.62, 1.15, 0.2, 0.6, 1.7], [-0.55, 1.2, -0.3, 0.64, 2.9], [0.1, 1.1, -0.62, 0.55, 4.1], [-0.2, 1.0, 0.6, 0.52, 5.3]] : detail === 1 ? [[0, 1.45, 0, 0.85, 0.3], [0.6, 1.1, 0.25, 0.6, 1.7], [-0.55, 1.15, -0.3, 0.62, 2.9]] : [[0, 1.4, 0, 1.0, 0.3]];
  const parts = [];
  for (const [ox, oy, oz, rad, ph] of LOBES) {
    const g = new T.IcosahedronGeometry(1, detail >= 3 ? 3 : detail >= 2 ? 2 : detail); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const l = Math.hypot(x, y, z); const nx = x / l, ny = y / l, nz = z / l; const d = 1 + 0.2 * Math.sin(nx * 4.1 + ny * 2.3 + ph) * Math.cos(nz * 3.7 + 0.8 + ph) + 0.12 * Math.sin(ny * 7.3 + nz * 5.1 + nx * 2.0 + ph * 2) + 0.06 * Math.sin(nx * 13.0 + nz * 11.0 + ph); p.setXYZ(i, ox + nx * d * rad, oy + ny * d * rad * 0.8 + dropY, oz + nz * d * rad); }
    g.computeVertexNormals();
    const n = g.attributes.normal, map = new Map(); for (let i = 0; i < p.count; i++) { const k = p.getX(i).toFixed(3) + '|' + p.getY(i).toFixed(3) + '|' + p.getZ(i).toFixed(3); const e = map.get(k) || [0, 0, 0, []]; e[0] += n.getX(i); e[1] += n.getY(i); e[2] += n.getZ(i); e[3].push(i); map.set(k, e); }
    for (const e of map.values()) { const l = Math.hypot(e[0], e[1], e[2]) || 1; for (const i of e[3]) n.setXYZ(i, e[0] / l, e[1] / l, e[2] / l); }
    // blend toward the radial direction from the crown centre so overlapping lobes read as one canopy
    for (let i = 0; i < p.count; i++) { const rx = p.getX(i), ry = p.getY(i) - (1.3 + dropY), rz = p.getZ(i), rl = Math.hypot(rx, ry, rz) || 1; const nx = n.getX(i) * 0.3 + rx / rl * 0.7, ny = n.getY(i) * 0.3 + ry / rl * 0.7, nz = n.getZ(i) * 0.3 + rz / rl * 0.7, ll = Math.hypot(nx, ny, nz) || 1; n.setXYZ(i, nx / ll, ny / ll, nz / ll); }
    g.deleteAttribute('uv'); parts.push(g);
  }
  const g = parts.length === 1 ? parts[0] : mergeGeos(T, parts); const p = g.attributes.position;
  const cols = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const t = Math.min(1, Math.max(0, (p.getY(i) - 0.6) / 1.5)); const c = [lin(40 + 50 * t), lin(94 + 66 * t), lin(84 + 36 * t)]; cols[i * 3] = c[0]; cols[i * 3 + 1] = c[1]; cols[i * 3 + 2] = c[2]; }
  g.setAttribute('color', new T.BufferAttribute(cols, 3));
  if (!trunk) return g;
  const t = new T.CylinderGeometry(0.1, 0.17, 1.3, 5, 1, true).toNonIndexed(); t.translate(0, 0.65, 0); const tc = new Float32Array(t.attributes.position.count * 3); for (let i = 0; i < tc.length; i += 3) { tc[i] = lin(70); tc[i + 1] = lin(52); tc[i + 2] = lin(46); } t.setAttribute('color', new T.BufferAttribute(tc, 3)); t.deleteAttribute('uv');
  g.deleteAttribute('uv'); const BU = ctxMerge; return BU([g, t]);
}
let ctxMerge = null;
export function buildTrees(ctx, D, near, roadsFn, terrain) {
  const { T, kit } = ctx; ctxMerge = (gs) => { const mg = T.BufferGeometry.prototype.constructor; return mergeGeos(T, gs); };
  const GROUND = ctx.geom.GROUND, NR = 1800, CELL = 4, GN = Math.ceil(2 * NR / CELL), occ = new Uint8Array(GN * GN);
  const ci = (x) => Math.floor((x + NR) / CELL);
  const P = D.nearPts;
  // occupancy: buildings
  for (const b of D.nearBld) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; const xs = [], zs = []; for (let i = 0; i < b.n; i++) { const x = P[(b.off + i) * 2] / 10, z = P[(b.off + i) * 2 + 1] / 10; xs.push(x); zs.push(z); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    for (let gx = ci(x0 - 1); gx <= ci(x1 + 1); gx++) for (let gz = ci(z0 - 1); gz <= ci(z1 + 1); gz++) { if (gx < 0 || gz < 0 || gx >= GN || gz >= GN) continue; const cx = -NR + (gx + 0.5) * CELL, cz = -NR + (gz + 0.5) * CELL; let inside = false; for (let i = 0, j = xs.length - 1; i < xs.length; j = i++) if ((zs[i] > cz) !== (zs[j] > cz) && cx < (xs[j] - xs[i]) * (cz - zs[i]) / (zs[j] - zs[i]) + xs[i]) inside = !inside; if (inside) occ[gx * GN + gz] = 1; } }
  // occupancy: roads (tier 0), and street-tree candidates
  const RP = D.roadPts, cand = []; const rnd = rng(1234);
  for (const w of D.ways) { if (w.tier !== 0 || w.cls > 5) continue; const half = Math.max(1.2, w.w * 0.5) + 0.8; let carry = rnd() * 8;
    for (let i = 0; i < w.n - 1; i++) { const x0 = RP[(w.off + i) * 2], z0 = RP[(w.off + i) * 2 + 1], x1 = RP[(w.off + i + 1) * 2], z1 = RP[(w.off + i + 1) * 2 + 1]; const L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.01) continue; const dx = (x1 - x0) / L, dz = (z1 - z0) / L;
      for (let s = 0; s < L; s += 1.5) { const x = x0 + dx * s, z = z0 + dz * s; for (let ox = -half; ox <= half; ox += 2) for (let oz = -half; oz <= half; oz += 2) { const gx = ci(x + ox), gz = ci(z + oz); if (gx >= 0 && gz >= 0 && gx < GN && gz < GN) occ[gx * GN + gz] = Math.max(occ[gx * GN + gz], 2); } }
      carry -= L; while (carry < 0 && w.cls >= 2 && !(w.fl & 1)) { const s = L + carry; const x = x0 + dx * s, z = z1 * 0 + z0 + dz * s; const side = rnd() < 0.5 ? -1 : 1; if (rnd() < 0.6) cand.push([x - dz * side * (half + 2.4), z + dx * side * (half + 2.4), 0.85 + rnd() * 0.5, 1]); carry += 14 + rnd() * 10; } } }
  // avenue canopy: rain trees / gulmohar along the arterials (100 Feet Road, CMH Road, Old Madras Road), both verges, crowns overhanging the kerb
  const ave = []; for (const w of D.ways) { if (w.tier > 1 || w.w < 11 || w.cls < 1 || w.cls > 4 || (w.fl & 1)) continue; const half = w.w * 0.5; let carry = rnd() * 8, side = 1;
    for (let i = 0; i < w.n - 1; i++) { const x0 = RP[(w.off + i) * 2], z0 = RP[(w.off + i) * 2 + 1], x1 = RP[(w.off + i + 1) * 2], z1 = RP[(w.off + i + 1) * 2 + 1]; const L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.01) continue; const dx = (x1 - x0) / L, dz = (z1 - z0) / L; let s = carry;
      while (s < L) { for (const sd of [-1, 1]) { if (rnd() < 0.2) continue; const off = sd * (half + 0.6 + rnd() * 1.2); ave.push([x0 + dx * s - dz * off, z0 + dz * s + dx * off, 5.2 + rnd() * 2.8, 1]); } s += 10 + rnd() * 6; } carry = s - L; } }
  const occAt = (x, z) => { const gx = ci(x), gz = ci(z); return gx < 0 || gz < 0 || gx >= GN || gz >= GN ? 0 : occ[gx * GN + gz]; };
  const trees = [];
  for (const c of ave) trees.push([c[0], c[1], c[2], 0]);
  for (const c of cand) { if (occAt(c[0], c[1]) !== 1) trees.push([c[0], c[1], 3.2 + rnd() * 3.2, 0]); }
  // compound trees in free plots
  for (let gx = 0; gx < GN; gx++) for (let gz = 0; gz < GN; gz++) { if (occ[gx * GN + gz]) continue; const x = -NR + (gx + rnd()) * CELL, z = -NR + (gz + rnd()) * CELL; const d = Math.hypot(x, z); const p = d < 500 ? 0.032 : d < 1200 ? 0.011 : 0.0045; if (rnd() < p) { // keep out of the road
      trees.push([x, z, 2.6 + rnd() * 3.6, 0]); } }
  // OSM-mapped trees
  const ot = D.misc.trees; for (let i = 0; i < ot.length; i += 2) { const x = ot[i], z = ot[i + 1]; if (Math.max(Math.abs(x), Math.abs(z)) < 4600) trees.push([x, z, 3.4 + hash2(x, z) * 2.6, 0]); }
  // park trees inside real park polygons
  for (const g of D.misc.green) { if (g.k !== 0) continue; const r0 = g.r[0]; let cx = 0, cz = 0; const n = r0.length / 2; for (let i = 0; i < r0.length; i += 2) { cx += r0[i]; cz += r0[i + 1]; } cx /= n; cz /= n; if (Math.max(Math.abs(cx), Math.abs(cz)) > 5200) continue;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < r0.length; i += 2) { x0 = Math.min(x0, r0[i]); x1 = Math.max(x1, r0[i]); z0 = Math.min(z0, r0[i + 1]); z1 = Math.max(z1, r0[i + 1]); }
    const area = (x1 - x0) * (z1 - z0); if (area < 2500) continue; const step = 27; let cnt = 0;
    for (let x = x0; x < x1 && cnt < 900; x += step) for (let z = z0; z < z1 && cnt < 900; z += step) { const px = x + (rnd() - 0.5) * step, pz = z + (rnd() - 0.5) * step; let inside = false; for (let i = 0, j = r0.length - 2; i < r0.length; j = i, i += 2) if ((r0[i + 1] > pz) !== (r0[j + 1] > pz) && px < (r0[j] - r0[i]) * (pz - r0[i + 1]) / (r0[j + 1] - r0[i + 1]) + r0[i]) inside = !inside; if (inside && rnd() < 0.8) { trees.push([px, pz, 4 + rnd() * 4.5, 0]); cnt++; } } }
  for (const t of trees) t[2] *= 0.7;   // smaller crowns: trees accent the blocks, they never dominate the frame
  // two meshes: hi detail near the origin, lo detail for the rest
  const hi = [], mid = [], midO = [], lo = []; for (const t of trees) { const d = Math.hypot(t[0], t[1]); (d < 160 ? hi : d < 560 ? mid : d < 1200 ? midO : lo).push(t); }
  const mk = (arr, detail, trunk) => { const geo = crownGeo(T, detail, trunk); const mat = kit.toon(0xffffff, { vc: true }); mat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;'); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;\nfloat th(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }\nfloat tn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(th(i), th(i + vec3(1,0,0)), f.x), mix(th(i + vec3(0,1,0)), th(i + vec3(1,1,0)), f.x), f.y), mix(mix(th(i + vec3(0,0,1)), th(i + vec3(1,0,1)), f.x), mix(th(i + vec3(0,1,1)), th(i + vec3(1,1,1)), f.x), f.y), f.z); }').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 0.62 + 0.75 * tn(vOP * 4.5) * (0.6 + 0.4 * tn(vOP * 11.0));'); }; const im = kit.inst(geo, mat, arr.length, { ink: false }); const col = new T.Color(); arr.forEach((t, i) => { const y = terrain.groundY(t[0], t[1]) - GROUND, s = t[2]; kit.put(im, i, t[0], y, t[1], s, s * (0.8 + hash2(t[0], t[1]) * 0.5), s, 0, hash2(t[1], t[0]) * 6.28, 0); const h = hash2(t[0] * 1.3, t[1] * 0.7); const tint = h < 0.05 ? [1.25, 0.8, 0.95] : h < 0.1 ? [1.05, 1.0, 0.65] : [0.6 + 0.3 * h, 0.72 + 0.2 * h, 0.7 + 0.3 * (1 - h)]; col.setRGB(tint[0], tint[1], tint[2]); im.setColorAt(i, col); }); im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.position.y = GROUND; return im; };
  return { hi: mk(hi, 3, true), mid: mk(mid, 2, true), midO: mk(midO, 0, true), lo: mk(lo, 0, false), count: trees.length, nHi: hi.length, nMid: mid.length + midO.length, nLo: lo.length };
}
function mergeGeos(T, gs) {
  let nv = 0; for (const g of gs) nv += g.attributes.position.count; const out = {}; for (const k of ['position', 'normal', 'color'].filter((k) => gs[0].attributes[k])) { const a = new Float32Array(nv * 3); let o = 0; for (const g of gs) { a.set(g.attributes[k].array, o); o += g.attributes[k].array.length; } out[k] = a; }
  const g = new T.BufferGeometry(); for (const k in out) g.setAttribute(k, new T.BufferAttribute(out[k], 3)); return g; }
