/* The neighbourhood from real OpenStreetMap data (Indiranagar, Bengaluru; 10th Main Road block): real footprints, real road centre-lines and classes, real tree and
 * street-lamp nodes. Building heights use the OSM levels tag where present, otherwise a seeded draw from the local distribution (G+1 .. G+5). */
import { GB, rng, lin } from './gb.js';
import { T } from './deps.js';
import { GROUND } from './hero.js';

const PAL = ['#e9dfc8', '#dcc9a4', '#c6cde0', '#d9b8b0', '#b9d2c4', '#e8d3a2', '#c9bfe3', '#f0e8e0', '#cfa890', '#a9c3d8', '#e2c0c9', '#bcc8a8'];
const hash = (a, b = 0) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const cen = (p) => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
const inRect = (x, z, a, b, c, d) => x > a && x < b && z > c && z < d;
export const HERO_RECT = [-13.5, 13.5, -13.8, 14.8];

export function decode(data) {
  const m = (p) => p.map((q) => [q[0] / 10, q[1] / 10]);
  return { b: data.b.map((b) => ({ ...b, p: m(b.p) })), r: data.r.map((r) => ({ ...r, p: m(r.p) })), t: data.t.map((q) => [q[0] / 10, q[1] / 10]), l: data.l.map((q) => [q[0] / 10, q[1] / 10]), w: data.w.map((w) => ({ ...w, p: m(w.p) })) };
}
export const roadHalfWidth = (r) => r.c === 'primary' || r.c === 'secondary' ? 4.6 : r.c === 'tertiary' ? 4.2 : r.c === 'service' ? 1.8 : 4.0;
// z of the road centre-line of our street at x = 0 (closest residential E-W segment south of the block)
export function streetZ(D) { let best = null; D.r.forEach((r) => { if (r.c !== 'residential') return; for (let i = 0; i < r.p.length - 1; i++) { const a = r.p[i], b = r.p[i + 1]; if ((a[0] - 0) * (b[0] - 0) > 0 || Math.abs(b[1] - a[1]) > 4) continue; const t = (0 - a[0]) / (b[0] - a[0] || 1e-6); const z = a[1] + (b[1] - a[1]) * t; if (z > 3 && (!best || z < best)) best = z; } }); return best || 8; }

export function floorsOf(b) {
  if (b.lv) return Math.min(8, b.lv + (b.k === 'house' ? 0 : 0)); if (b.h) return Math.max(1, Math.round(b.h / 3.2));
  const u = hash(b.id % 100000, 7), ar = Math.abs(b.p.reduce((s0, p0, i) => { const p1 = b.p[(i + 1) % b.p.length]; return s0 + p0[0] * p1[1] - p1[0] * p0[1]; }, 0)) / 2;   // footprint area, m2
  const big = ar > 150;
  return u < 0.08 ? 1 : u < 0.28 ? 2 : u < 0.55 ? 3 : u < 0.78 ? 4 : u < 0.9 ? 5 : u < 0.96 ? 6 : (big && u < 0.985) ? 8 : (big ? 10 : 6);
}

export function buildRoads(D, mats, GBs) {
  const { road, foot, mark } = GBs; const G = GROUND;
  const order = { service: 0, residential: 1, tertiary: 2, secondary: 3, primary: 4 };
  D.r.slice().sort((a, b) => order[a.c] - order[b.c]).forEach((r) => {
    const hw = roadHalfWidth(r), lv = order[r.c] * 0.004;
    foot.ribbon(r.p, hw + 1.5, G + 0.05 + lv, '#ffffff', { world: true, us: 1 / 2, miter: true });
    foot.ribbon(r.p, hw + 0.2, G + 0.09 + lv, '#f4eefa', { world: true, us: 1 / 2, miter: true });
    road.ribbon(r.p, hw, G + 0.12 + lv, '#ffffff', { world: true, us: 1 / 8, miter: true });
    if (r.c === 'tertiary' || r.c === 'secondary') { // dashed centre line
      for (let i = 0; i < r.p.length - 1; i++) { const a = r.p[i], b = r.p[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.floor(L / 6); const dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L; for (let k = 0; k < n; k++) { const s0 = k * 6 + 1, s1 = s0 + 2.5; const hwl = 0.08; mark.quad([a[0] + dx * s0 - dz * hwl, G + 0.14, a[1] + dz * s0 + dx * hwl], [a[0] + dx * s1 - dz * hwl, G + 0.14, a[1] + dz * s1 + dx * hwl], [a[0] + dx * s1 + dz * hwl, G + 0.14, a[1] + dz * s1 - dx * hwl], [a[0] + dx * s0 + dz * hwl, G + 0.14, a[1] + dz * s0 - dx * hwl], '#efe6c8'); } } }
  });
}

// neighbours. near: windows as geometry; far: facade-tile texture. returns lists for roof clutter instancing
export function buildBuildings(D, R, B, opt) {
  const { vc, lit, glass, roof, tiles } = B; const out = { tanks: [], count: 0, near: 0, shopSigns: [] };
  const sz = opt.streetZ;
  D.b.forEach((b) => {
    const c = cen(b.p); if (inRect(c[0], c[1], ...HERO_RECT)) return;
    // skip if any vertex lies inside the hero footprint plus margin
    if (b.p.some((q) => inRect(q[0], q[1], -12.6, 12.6, -13.5, 14.5))) return;
    let n = floorsOf(b); const d = Math.hypot(c[0], c[1]);
    // art-direction: keep the view over the street towards her window open (cap storeys of the south-side buildings in front of the block)
    if (c[1] > 17 && c[1] < 70 && Math.abs(c[0]) < 40) n = Math.min(n, Math.abs(c[0]) < 26 ? 2 : 3);
    if (Math.abs(c[0]) < 40 && Math.abs(c[1]) < 22) n = Math.min(n, 4);   // the real neighbour that abuts our block: G+3 so the block stays the tallest
    const H = n * 3.2 + 0.2, y1 = GROUND + H; const col = PAL[Math.floor(hash(b.id % 99991, 3) * PAL.length)]; const v = Math.floor(hash(b.id % 7919, 5) * 4);
    const ROOFS = ['#a7a1bb', '#b8a58f', '#8f98a8', '#b59a8a', '#9fae9f', '#8d8aa8', '#c0a7a0', '#a39a8c']; const roofc = ROOFS[Math.floor(hash(b.id % 331, 9) * ROOFS.length)];
    const areaB = Math.abs(b.p.reduce((s0, p0, i) => { const p1 = b.p[(i + 1) % b.p.length]; return s0 + p0[0] * p1[1] - p1[0] * p0[1]; }, 0)) / 2; const pitched = areaB < 170 && n <= 3 && hash(b.id % 4099, 21) < 0.26; const parH = 0.35 + hash(b.id % 1237, 22) * 0.75;
    const NEAR = d < 62;
    if (NEAR) { out.near++; vc.prism(b.p, GROUND, y1, col, roofc, {}); }
    else tiles[v].prism(b.p, GROUND, y1, col, roofc, { wallUV: 12, wallV: 12.8, vBase: GROUND - 0.2, cap: false });
    if (!NEAR) roof.prism(b.p, y1 - 0.01, y1, roofc, roofc, {}); else null;
    if (pitched) { const sheet = ['#b0563c', '#4c6fa5', '#8a8aa0', '#7d9a86', '#a0472f'][Math.floor(hash(b.id % 911, 23) * 5)]; const ar = b.p.reduce((s0, p0, i) => { const p1 = b.p[(i + 1) % b.p.length]; return s0 + p0[0] * p1[1] - p1[0] * p0[1]; }, 0) > 0; const rise = 0.9 + hash(b.id % 53, 24) * 1.0; const ap = [c[0], y1 + rise, c[1]];
      for (let i = 0; i < b.p.length; i++) { let a0 = b.p[i], e0 = b.p[(i + 1) % b.p.length]; if (Math.hypot(e0[0] - a0[0], e0[1] - a0[1]) < 0.05) continue; if (!ar) { const t0 = a0; a0 = e0; e0 = t0; } const sh = i % 2 ? 0.86 : 1; const col2 = new T.Color(sheet).multiplyScalar(sh); roof.quad([a0[0], y1, a0[1]], [e0[0], y1, e0[1]], ap, ap, col2); roof.quad([e0[0], y1, e0[1]], [a0[0], y1, a0[1]], ap, ap, col2); } }
    out.count++;
    // parapet ring (coping) via thin prism-like strips
    const r = rng(b.id % 100003);
    const poly = b.p;
    for (let i = 0; i < poly.length; i++) { const a = poly[i], e = poly[(i + 1) % poly.length]; const L = Math.hypot(e[0] - a[0], e[1] - a[1]); if (L < 0.8) continue; const dx = (e[0] - a[0]) / L, dz = (e[1] - a[1]) / L; const mx = (a[0] + e[0]) / 2, mz = (a[1] + e[1]) / 2;
      if (!pitched) roof.box(mx, y1 + parH / 2, mz, L + 0.12, parH, 0.16, '#d9d2c4', { ry: Math.atan2(-dz, dx) });
      if (!NEAR) continue;
      // outward normal (polygon may be either winding): test with centroid
      let nx = dz, nz = -dx; if ((mx + nx * 0.5 - c[0]) * nx + (mz + nz * 0.5 - c[1]) * nz < (mx - c[0]) * nx + (mz - c[1]) * nz) { nx = -nx; nz = -nz; }
      if (L < 3) continue; const ry = Math.atan2(nx, nz); const bays = Math.max(1, Math.floor(L / 3.1)); const bw = L / bays;
      for (let f = 0; f < n; f++) for (let k = 0; k < bays; k++) {
        const t = (k + 0.5) * bw, px = a[0] + dx * t + nx * 0.02, pz = a[1] + dz * t + nz * 0.02, py = GROUND + f * 3.2; const q = r();
        vc.push(px, py, pz, ry); lit.push(px, py, pz, ry); glass.push(px, py, pz, ry);
        const shop = f === 0 && nz < -0.7 && Math.abs(c[0]) < 70 && c[1] > 8 && q < 0.5;
        if (shop) { shopFront(vc, lit, bw, r, out, px, py, pz, ry); vc.pop(); lit.pop(); glass.pop(); continue; }
        const isBal = q > 0.8 && f > 0; const wL = bw * 0.5, w0 = -wL / 2;
        // slab band
        vc.box(0, 0.12, 0.03, bw, 0.24, 0.08, '#efe7d8');
        const glassCol = r() < 0.36;
        const gb = glassCol ? lit : glass; const top = glassCol ? ((hash(k * 7 + f, b.id % 97) < 0.5) ? new T.Color(1.0, 0.72, 0.38) : new T.Color(0.98, 0.92, 0.76)) : new T.Color(0.06, 0.07, 0.2); const bot = glassCol ? top.clone().multiplyScalar(0.55) : new T.Color(0.015, 0.015, 0.06);
        if (isBal) { vc.box(0, 0.3, 0.55, bw - 0.4, 0.16, 1.1, '#efe7d8'); for (let j = 0; j <= 8; j++) vc.box(-(bw - 0.4) / 2 + j * (bw - 0.4) / 8, 0.82, 1.05, 0.015, 0.9, 0.015, '#2a2c55'); vc.box(0, 1.27, 1.05, bw - 0.4, 0.04, 0.05, '#2a2c55'); gb.quadC([-0.9, 0.2, 0.04], [0.9, 0.2, 0.04], [0.9, 2.3, 0.04], [-0.9, 2.3, 0.04], [bot, bot, top, top]); vc.box(0, 2.3, 0.05, 1.9, 0.06, 0.06, '#f1ecf8'); vc.box(-0.95, 1.25, 0.05, 0.06, 2.1, 0.06, '#f1ecf8'); vc.box(0.95, 1.25, 0.05, 0.06, 2.1, 0.06, '#f1ecf8'); }
        else { const ww = Math.min(1.5, bw * 0.55), hh = 1.25, y0 = 0.95; gb.quadC([-ww / 2, y0, 0.04], [ww / 2, y0, 0.04], [ww / 2, y0 + hh, 0.04], [-ww / 2, y0 + hh, 0.04], [bot, bot, top, top]);
          vc.box(0, y0 + hh + 0.04, 0.07, ww + 0.2, 0.08, 0.1, '#f4eefa'); vc.box(0, y0 - 0.03, 0.1, ww + 0.26, 0.07, 0.18, '#f4eefa'); vc.box(-ww / 2 - 0.03, y0 + hh / 2, 0.07, 0.06, hh, 0.08, '#f4eefa'); vc.box(ww / 2 + 0.03, y0 + hh / 2, 0.07, 0.06, hh, 0.08, '#f4eefa'); vc.box(0, y0 + hh / 2, 0.07, 0.04, hh, 0.07, '#f4eefa');
          if (r() < 0.55) for (let j = 0; j <= 8; j++) vc.box(-ww / 2 + j * ww / 8, y0 + hh / 2, 0.14, 0.014, hh, 0.014, '#2a2c55');
          if (r() < 0.22) { vc.box(ww / 2 + 0.05, y0 - 0.1, 0.3, 0.8, 0.55, 0.28, '#e6e3f0'); vc.sphere(ww / 2 + 0.05, y0 - 0.1, 0.45, 0.2, 0.2, 0.02, '#2c2c48', { w: 10, h: 6 }); } }
        vc.pop(); lit.pop(); glass.pop();
      }
    }
    { // roof clutter: stair headroom, terrace tint, solar heater
      const q2 = hash(b.id % 7907, 11); const area = Math.abs(poly.reduce((s, p0, i) => { const p1 = poly[(i + 1) % poly.length]; return s + p0[0] * p1[1] - p1[0] * p0[1]; }, 0)) / 2;
      if (!pitched && area > 40 && q2 < 0.62) { const hx = c[0] + (hash(b.id % 977, 2) - 0.5) * 4, hz = c[1] + (hash(b.id % 977, 3) - 0.5) * 4; const hc = ['#d9d2c4', '#c9bfe3', '#e2c8a8', '#b8c9bd'][Math.floor(hash(b.id % 613, 6) * 4)]; roof.box(hx, y1 + 1.4, hz, 2.6, 2.8, 3.0, hc, {}); roof.box(hx, y1 + 2.85, hz, 2.9, 0.12, 3.3, '#c9c0b0', {}); roof.box(hx, y1 + 0.95, hz + 1.52, 0.9, 1.9, 0.04, '#6a4a38', {}); }
      if (area > 60 && q2 > 0.45 && q2 < 0.62) { const sx = c[0] + (hash(b.id % 701, 4) - 0.5) * 6, sz2 = c[1] + (hash(b.id % 701, 5) - 0.5) * 6; roof.box(sx, y1 + 0.6, sz2, 1.9, 0.08, 1.0, '#6aa9d8', { rx: -0.5 }); roof.box(sx, y1 + 0.2, sz2 - 0.5, 1.9, 0.35, 0.3, '#e9e7f4', {}); } }
    { // varied roof clutter: satellite dishes, lean-to tin sheds, laundry lines, antennas, water-tank colour code (stored in the 4th tank slot)
      const q3 = hash(b.id % 8209, 31), q4 = hash(b.id % 8209, 32), q5 = hash(b.id % 8209, 33); const bx = c[0] + (q4 - 0.5) * 3.5, bz = c[1] + (q5 - 0.5) * 3.5;
      if (!pitched && areaB > 30) {
        if (q3 < 0.3) { roof.rod([bx, y1, bz], [bx, y1 + 1.8, bz], 0.03, '#8d8aa8'); roof.sphere(bx + 0.18, y1 + 1.9, bz, 0.48, 0.1, 0.48, '#e9e7f4', { w: 12, h: 4, rz: -0.5 }); }
        else if (q3 < 0.5) { const sc2 = ['#b0563c', '#4c6fa5', '#8a8aa0', '#7d9a86', '#c9a24a'][Math.floor(q4 * 5)]; roof.quad([bx - 1.6, y1 + 1.5, bz - 1.2], [bx - 1.6, y1 + 1.5, bz + 1.2], [bx + 1.6, y1 + 1.0, bz + 1.2], [bx + 1.6, y1 + 1.0, bz - 1.2], sc2); roof.quad([bx - 1.6, y1 + 1.5, bz - 1.2], [bx + 1.6, y1 + 1.0, bz - 1.2], [bx + 1.6, y1 + 1.0, bz + 1.2], [bx - 1.6, y1 + 1.5, bz + 1.2], new T.Color(sc2).multiplyScalar(0.7)); [[-1.6, -1.2], [-1.6, 1.2], [1.6, -1.2], [1.6, 1.2]].forEach(([dx, dz]) => roof.rod([bx + dx, y1, bz + dz], [bx + dx, y1 + (dx < 0 ? 1.5 : 1.0), bz + dz], 0.04, '#6b6a85')); }
        else if (q3 < 0.66) { const cc2 = ['#e5495f', '#f6d365', '#3e8ed0', '#9fe0c0', '#f4f1ea', '#c274d0']; roof.rod([bx - 2, y1, bz], [bx - 2, y1 + 1.9, bz], 0.03, '#6b6a85'); roof.rod([bx + 2, y1, bz], [bx + 2, y1 + 1.9, bz], 0.03, '#6b6a85'); roof.rod([bx - 2, y1 + 1.8, bz], [bx + 2, y1 + 1.7, bz], 0.008, '#3a3a52'); for (let k2 = 0; k2 < 5; k2++) roof.box(bx - 1.5 + k2 * 0.75, y1 + 1.3, bz, 0.5, 0.8, 0.02, cc2[(k2 + Math.floor(q4 * 6)) % 6]); }
        else if (q3 < 0.78) { roof.rod([bx, y1, bz], [bx, y1 + 4.5, bz], 0.04, '#6b6a85'); [0.8, 1.6, 2.4].forEach((hh2, i2) => roof.rod([bx - 0.8 + i2 * 0.1, y1 + 2.5 + hh2 * 0.8, bz], [bx + 0.8 - i2 * 0.1, y1 + 2.5 + hh2 * 0.8, bz], 0.02, '#6b6a85')); }
      }
    }
    if (!pitched) { const nt = (r() < 0.8 ? 1 : 0) + (areaB > 80 && r() < 0.6 ? 1 : 0) + (areaB > 160 && r() < 0.5 ? 1 : 0); for (let q = 0; q < nt; q++) out.tanks.push([c[0] + (r() - 0.5) * Math.min(7, Math.sqrt(areaB) * 0.6), y1, c[1] + (r() - 0.5) * Math.min(7, Math.sqrt(areaB) * 0.6), r()]); if (!NEAR && r() < 0.35) { roof.box(c[0] + 2.5 * (r() - 0.5) * 3, y1 + 0.2, c[1] + 2.5 * (r() - 0.5) * 3, 0.8 + r(), 0.4, 0.6 + r() * 0.8, ['#6aa9d8', '#c9453d', '#e2c8a8', '#7d9a86'][Math.floor(r() * 4)], { ry: r() * 3 }); } }
  });
  return out;
}

function shopFront(vc, lit, bw, r, out, px, py, pz, ry) {
  const kind = Math.floor(r() * 3); const open = r() < 0.35;
  if (!open) vc.box(0, 1.15, 0.05, bw - 0.4, 2.3, 0.06, '#8f93a8', {}); else lit.quadC([-bw / 2 + 0.3, 0.1, 0.05], [bw / 2 - 0.3, 0.1, 0.05], [bw / 2 - 0.3, 2.3, 0.05], [-bw / 2 + 0.3, 2.3, 0.05], [new T.Color(1.2, 1.0, 0.6), new T.Color(1.2, 1.0, 0.6), new T.Color(1.6, 1.4, 0.9), new T.Color(1.6, 1.4, 0.9)]);
  vc.box(0, 2.42, 0.1, bw, 0.2, 0.2, '#e2d4b8'); out.shopSigns.push({ px, py, pz, ry, w: Math.min(bw - 0.3, 2.9), kind });
}

export function buildTrees(D, rngf, near) { // returns arrays of instance transforms {x,z,s,kind,ry,col}
  const out = []; const r = rngf; const sz = near.streetZ;
  D.t.forEach((q, i) => { const d = Math.hypot(q[0], q[1]); if (inRect(q[0], q[1], -13.5, 13.5, -13.0, 14.8)) return; if (q[1] > 14 && q[1] < 60 && Math.abs(q[0]) < 32) return;
    /* art direction: keep the view of her facade open */ let s = 0.7 + r() * 0.55; const kind = r() < 0.12 ? 2 : r() < 0.3 ? 1 : 0;
    
    out.push({ x: q[0], z: q[1], s: kind === 2 ? 0.8 + r() * 0.3 : s, kind, ry: r() * 6.28, d }); });
  return out;
}

// Infill: where OSM has no footprint (unmapped plots between mapped blocks) we scatter plausible G+1..G+3 houses along the real road directions so the neighbourhood is
// as dense as Indiranagar really is. Deterministic, procedural, NOT real data (noted in SOURCES.md). Roads, mapped buildings, tree stands and the hero block keep their clearance.
export function buildInfill(D, R, B, opt) {
  const { roof, tiles } = B; const out = { n: 0, tanks: [], houses: [] }; const CS = 8, key = (x, z) => Math.floor(x / CS) * 100003 + Math.floor(z / CS);
  const occ = new Set(), occH = new Set(), ang = new Map(); let inTree = false; const mark = (x0, x1, z0, z1, m) => { for (let x = Math.floor((x0 - m) / CS); x <= Math.floor((x1 + m) / CS); x++) for (let z = Math.floor((z0 - m) / CS); z <= Math.floor((z1 + m) / CS); z++) { occ.add(x * 100003 + z); if (!inTree) occH.add(x * 100003 + z); } };
  D.b.forEach((b) => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; b.p.forEach((q) => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }); mark(x0, x1, z0, z1, 1.5); });
  D.w && D.w.forEach((w) => w.p.forEach((q) => mark(q[0], q[0], q[1], q[1], 6)));
  D.r.forEach((r) => { const hw = roadHalfWidth(r) + 3.5; for (let i = 0; i < r.p.length - 1; i++) { const a = r.p[i], e = r.p[i + 1]; const L = Math.hypot(e[0] - a[0], e[1] - a[1]); const th = Math.atan2(e[1] - a[1], e[0] - a[0]); for (let s = 0; s <= L; s += 3) { const x = a[0] + (e[0] - a[0]) * s / L, z = a[1] + (e[1] - a[1]) * s / L; mark(x, x, z, z, hw); const kk = key(x, z); if (!ang.has(kk) || r.c !== 'service') ang.set(kk, th); } } });
  inTree = true; D.t.forEach((q) => mark(q[0], q[0], q[1], q[1], 14)); inTree = false;
  const nearAng = (x, z) => { for (let d = 0; d <= 6; d++) for (let dx = -d; dx <= d; dx++) for (let dz = -d; dz <= d; dz++) { if (Math.max(Math.abs(dx), Math.abs(dz)) !== d) continue; const a = ang.get(key(x + dx * CS, z + dz * CS)); if (a !== undefined) return a; } return 0; };
  const PALX = ['#e9dfc8', '#dcc9a4', '#c6cde0', '#d9b8b0', '#b9d2c4', '#e8d3a2', '#c9bfe3', '#f0e8e0', '#cfa890', '#a9c3d8', '#e2c0c9', '#bcc8a8'], ROOFX = ['#a7a1bb', '#b8a58f', '#8f98a8', '#b59a8a', '#9fae9f', '#8d8aa8'];
  const RAD = opt.radius || 520, SP = 11.5;
  for (let gx = -RAD; gx <= RAD; gx += SP) for (let gz = -RAD; gz <= RAD; gz += SP) {
    const h1 = hash(gx * 7 + 3, gz * 13 + 5), h2 = hash(gx * 3 + 11, gz * 5 + 17), h3 = hash(gx + 31, gz + 41); const x = gx + (h1 - 0.5) * 3.5, z = gz + (h2 - 0.5) * 3.5;
    if (Math.hypot(x, z) > RAD || inRect(x, z, -20, 20, -24, 24) || (z > 8 && z < 75 && Math.abs(x) < 42)) continue; if (occ.has(key(x, z)) || h3 < 0.12) continue;
    const th = nearAng(x, z); const w = 6.5 + h1 * 4.5, d = 6.5 + h2 * 5; const co = Math.cos(th), si = Math.sin(th);
    const pt = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [x + u * co - v * si, z + u * si + v * co]); const n = 1 + Math.floor(h3 * h3 * 3.6) + (h1 > 0.8 ? 1 : 0); const H = n * 3.2 + 0.2, y1 = GROUND + H;
    const id = Math.floor(gx * 31 + gz * 17) & 0xffff; const col = PALX[Math.floor(hash(id, 3) * PALX.length)], roofc = ROOFX[Math.floor(hash(id, 9) * ROOFX.length)], v = Math.floor(hash(id, 5) * 4);
    tiles[v].prism(pt, GROUND, y1, col, roofc, { wallUV: 12, wallV: 12.8, vBase: GROUND - 0.2, cap: false }); roof.prism(pt, y1 - 0.01, y1, roofc, roofc, {});
    const ph = 0.4 + hash(id, 22) * 0.7; for (let i = 0; i < 4; i++) { const a = pt[i], e = pt[(i + 1) % 4]; const L = Math.hypot(e[0] - a[0], e[1] - a[1]); roof.box((a[0] + e[0]) / 2, y1 + ph / 2, (a[1] + e[1]) / 2, L + 0.12, ph, 0.16, '#d9d2c4', { ry: Math.atan2(-(e[1] - a[1]), e[0] - a[0]) }); }
    if (hash(id, 11) < 0.5) { roof.box(x + 0.5, y1 + 1.2, z + 0.5, 2.2, 2.4, 2.4, '#d9d2c4', { ry: -th }); roof.box(x + 0.5, y1 + 2.45, z + 0.5, 2.5, 0.12, 2.7, '#c9c0b0', { ry: -th }); }
    out.tanks.push([x - 1.5 * co, y1, z - 1.5 * si, h2]); if (hash(id, 12) < 0.4) out.tanks.push([x + 1.0, y1, z - 1.8, h1]);
    mark(x - w / 2, x + w / 2, z - d / 2, z + d / 2, 3); out.n++; out.houses.push([x, z, Math.max(w, d) / 2 + 1.5]);
  }
  out.occ = (x, z) => occH.has(key(x, z)); out.CS = CS;
  return out;
}
