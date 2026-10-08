/* Street props: Bajaj-RE style auto-rickshaw (Bengaluru: yellow hood, green CNG body), Honda-Activa style scooter, hatchback, rain-tree / gulmohar, RCC pole + cables,
 * street lamp, compound wall + gate + watchman booth. Proportions from real vehicle dimensions (RE 2.6 x 1.3 x 1.7 m; Activa 1.8 x 0.7 x 1.1 m; Swift 3.85 x 1.7 x 1.5 m). */
import { GB, rng, lin } from './gb.js';
import { T } from './deps.js';

const wheel = (g, x, y, z, r, w, tyre = '#1d1d2e', hub = '#bdbad0') => { g.push(x, y, z, 0, 1, Math.PI / 2); g.cyl(0, -w / 2, 0, r, r, w, tyre, { seg: 18, bottom: true }); g.cyl(0, -w / 2 - 0.004, 0, r * 0.55, r * 0.55, w + 0.008, hub, { seg: 14, bottom: true }); g.cyl(0, -w / 2 - 0.01, 0, r * 0.18, r * 0.18, w + 0.02, '#6b6a85', { seg: 8, bottom: true }); g.pop(); };

// ---------- auto-rickshaw, facing +x, origin at ground below the centre ----------
export function addRickshaw(g, lit, o = {}) {
  const GREEN = o.green || '#2e9c63', YEL = o.yellow || '#f2c13a';
  g.push(o.x || 0, o.y || 0, o.z || 0, o.ry || 0);
  // lower monocoque body: rear engine bulge, passenger bench, front cowl tapering to a single wheel
  g.loft([{ x: -1.3, hw: 0.2, yb: 0.55, yt: 0.9 }, { x: -1.22, hw: 0.5, yb: 0.42, yt: 1.08 }, { x: -0.95, hw: 0.62, yb: 0.34, yt: 1.0 }, { x: -0.3, hw: 0.64, yb: 0.3, yt: 0.72 }, { x: 0.3, hw: 0.6, yb: 0.3, yt: 0.8 }, { x: 0.66, hw: 0.5, yb: 0.32, yt: 1.02 }, { x: 0.95, hw: 0.33, yb: 0.36, yt: 1.1 }, { x: 1.2, hw: 0.2, yb: 0.45, yt: 1.02 }, { x: 1.32, hw: 0.1, yb: 0.58, yt: 0.9 }], GREEN, { ring: 22, n: 3.8, sub: 3 });
  // darker belly + floor
  g.box(-0.1, 0.27, 0, 1.9, 0.05, 1.05, '#26263a');
  // front cowl hood (yellow upper panel) and windscreen frame
  g.loft([{ x: 0.5, hw: 0.6, yb: 0.92, yt: 1.02 }, { x: 0.9, hw: 0.4, yb: 1.08, yt: 1.18 }, { x: 1.12, hw: 0.25, yb: 1.04, yt: 1.14 }], YEL, { ring: 12 });
  g.rod([0.56, 1.0, 0.56], [0.74, 1.66, 0.5], 0.022, '#1c1c2e'); g.rod([0.56, 1.0, -0.56], [0.74, 1.66, -0.5], 0.022, '#1c1c2e'); g.rod([0.74, 1.66, 0.5], [0.74, 1.66, -0.5], 0.022, '#1c1c2e');
  const wsC = new T.Color(0.05, 0.08, 0.2); g.quadC([0.575, 1.04, 0.54], [0.575, 1.04, -0.54], [0.745, 1.64, -0.48], [0.745, 1.64, 0.48], [wsC, wsC, new T.Color(0.25, 0.28, 0.5), new T.Color(0.25, 0.28, 0.5)]);
  g.quadC([0.575, 1.04, -0.54], [0.575, 1.04, 0.54], [0.745, 1.64, 0.48], [0.745, 1.64, -0.48], [wsC, wsC, new T.Color(0.25, 0.28, 0.5), new T.Color(0.25, 0.28, 0.5)]);
  // hood / canopy (yellow) with a black fascia, supported by rear pillars
  g.loft([{ x: 0.95, hw: 0.3, yb: 1.64, yt: 1.7 }, { x: 0.78, hw: 0.63, yb: 1.64, yt: 1.74 }, { x: 0.2, hw: 0.7, yb: 1.66, yt: 1.78 }, { x: -0.6, hw: 0.7, yb: 1.64, yt: 1.76 }, { x: -1.2, hw: 0.64, yb: 1.58, yt: 1.7 }, { x: -1.34, hw: 0.35, yb: 1.52, yt: 1.62 }], YEL, { ring: 14, n: 3.6 });
  [[-1.18, 0.58], [-1.18, -0.58], [-0.1, 0.66], [-0.1, -0.66]].forEach(([x, z], i) => g.rod([x, i < 2 ? 1.05 : 0.88, z], [x, 1.62, z * 0.97], 0.02, '#1c1c2e'));
  // rear seat (black) + back, driver seat, handlebar, headlamp, mirror
  g.box(-0.62, 0.55, 0, 0.55, 0.14, 1.12, '#232338'); g.box(-0.9, 0.9, 0, 0.14, 0.62, 1.1, '#2c2c46'); g.box(0.2, 0.52, 0, 0.42, 0.12, 0.5, '#232338'); g.box(0.04, 0.82, 0, 0.1, 0.5, 0.5, '#2c2c46');
  g.rod([0.72, 1.02, 0.0], [0.62, 1.05, 0.0], 0.02, '#8d8aa8'); g.rod([0.64, 1.07, 0.35], [0.64, 1.07, -0.35], 0.018, '#8d8aa8'); g.sphere(0.64, 1.07, 0.37, 0.03, 0.03, 0.03, '#222'); g.sphere(0.64, 1.07, -0.37, 0.03, 0.03, 0.03, '#222');
  g.rod([1.1, 1.14, 0.2], [1.1, 1.38, 0.5], 0.014, '#8d8aa8'); g.sphere(1.1, 1.4, 0.52, 0.045, 0.07, 0.02, '#1a1a2a');
  // wheels: single front wheel with fender, two rear
  wheel(g, 1.02, 0.25, 0, 0.25, 0.1); wheel(g, -0.92, 0.25, 0.7, 0.25, 0.12); wheel(g, -0.92, 0.25, -0.7, 0.25, 0.12);
  g.push(1.02, 0.25, 0); g.cyl(0, 0, 0, 0.3, 0.3, 0.13, GREEN, { arc: Math.PI * 0.95, a0: Math.PI * 1.02 + 1.57, seg: 12, cap: false }); g.pop();
  g.rod([1.02, 0.25, 0.08], [1.1, 0.8, 0.0], 0.025, '#999'); g.rod([-0.92, 0.25, 0.64], [-0.92, 0.55, 0.64], 0.03, '#555');
  // exhaust pipe, number plate, LPG badge, side flap rolled
  g.rod([-1.2, 0.35, 0.3], [-1.4, 0.38, 0.3], 0.04, '#3a3a52'); g.box(-1.33, 0.62, 0, 0.02, 0.2, 0.36, '#f2d14a'); g.box(1.3, 0.62, 0, 0.02, 0.18, 0.3, '#f2d14a');
  g.box(0.1, 1.64, 0.66, 1.4, 0.06, 0.04, '#1c1c2e'); g.box(0.1, 1.64, -0.66, 1.4, 0.06, 0.04, '#1c1c2e');
  // lamps
  const hl = o.lamps ? new T.Color(2.6, 2.4, 1.9) : new T.Color(0.7, 0.68, 0.6); lit.sphere(1.3, 0.78, 0, 0.05, 0.08, 0.1, hl, { w: 10, h: 8 }); lit.box(-1.32, 0.78, 0.34, 0.02, 0.07, 0.1, new T.Color(1.8, 0.2, 0.1)); lit.box(-1.32, 0.78, -0.34, 0.02, 0.07, 0.1, new T.Color(1.8, 0.2, 0.1));
  g.pop();
}

// ---------- scooter (Activa), faces +x ----------
export function addScooter(g, o = {}) {
  const c = o.color || '#c9453d', dk = '#1f1f33'; g.push(o.x || 0, o.y || 0, o.z || 0, o.ry || 0, o.s || 1);
  wheel(g, 0.62, 0.21, 0, 0.21, 0.1); wheel(g, -0.6, 0.21, 0, 0.21, 0.12);
  g.sphere(-0.4, 0.5, 0, 0.55, 0.22, 0.17, c, { w: 14, h: 10 }); g.sphere(-0.05, 0.28, 0, 0.5, 0.06, 0.2, dk, { w: 12, h: 6 });    // rear body, floorboard
  g.sphere(0.42, 0.62, 0, 0.1, 0.42, 0.2, c, { w: 12, h: 10 });                                                               // leg shield
  g.sphere(-0.3, 0.74, 0, 0.5, 0.07, 0.16, '#222238', { w: 12, h: 6 });                                                      // seat
  g.rod([0.45, 0.95, 0], [0.5, 1.12, 0], 0.03, '#8d8aa8'); g.rod([0.5, 1.12, 0.33], [0.5, 1.12, -0.33], 0.018, dk); g.sphere(0.55, 1.12, 0, 0.1, 0.1, 0.12, c, { w: 10, h: 8 });   // handlebar + headlamp
  g.rod([0.62, 0.21, 0.07], [0.5, 0.95, 0.07], 0.018, '#aaa'); g.rod([0.62, 0.21, -0.07], [0.5, 0.95, -0.07], 0.018, '#aaa');
  g.cyl(0.62, 0.21, 0, 0.26, 0.26, 0.15, c, { arc: Math.PI * 0.8, a0: 1.2, seg: 10, cap: false });
  g.rod([-0.6, 0.2, 0.15], [-0.95, 0.3, 0.15], 0.04, '#444'); g.sphere(-0.9, 0.3, 0.15, 0.08, 0.07, 0.08, '#555', { w: 8, h: 6 }); g.pop();
}

// ---------- hatchback (Swift-like), faces +x ----------
export function addCar(g, lit, o = {}) {
  const c = o.color || '#e8e6f0'; g.push(o.x || 0, o.y || 0, o.z || 0, o.ry || 0);
  g.loft([{ x: -1.92, hw: 0.5, yb: 0.45, yt: 0.95 }, { x: -1.85, hw: 0.8, yb: 0.3, yt: 1.0 }, { x: -1.0, hw: 0.86, yb: 0.28, yt: 1.02 }, { x: 0.5, hw: 0.86, yb: 0.28, yt: 0.98 }, { x: 1.3, hw: 0.82, yb: 0.3, yt: 0.86 }, { x: 1.82, hw: 0.74, yb: 0.34, yt: 0.78 }, { x: 1.94, hw: 0.45, yb: 0.45, yt: 0.7 }], c, { ring: 22, n: 3.8, sub: 3 });
  const gl = new T.Color(0.04, 0.06, 0.16);
  g.loft([{ x: -1.55, hw: 0.5, yb: 0.98, yt: 1.12 }, { x: -1.3, hw: 0.7, yb: 0.98, yt: 1.38 }, { x: -0.5, hw: 0.74, yb: 0.98, yt: 1.5 }, { x: 0.45, hw: 0.72, yb: 0.98, yt: 1.48 }, { x: 0.95, hw: 0.66, yb: 0.98, yt: 1.3 }, { x: 1.1, hw: 0.5, yb: 0.98, yt: 1.05 }], '#14153a', { ring: 20, n: 3.4, sub: 3 });
  g.loft([{ x: -1.3, hw: 0.68, yb: 1.34, yt: 1.4 }, { x: -0.5, hw: 0.72, yb: 1.46, yt: 1.52 }, { x: 0.45, hw: 0.7, yb: 1.44, yt: 1.5 }, { x: 0.85, hw: 0.62, yb: 1.3, yt: 1.34 }], c, { ring: 10, n: 3 });
  [[1.2, 0.8], [1.2, -0.8], [-1.2, 0.8], [-1.2, -0.8]].forEach(([x, z]) => wheel(g, x, 0.3, z, 0.3, 0.2, '#1a1a2a', '#c4c2d8'));
  lit.box(1.92, 0.66, 0.5, 0.04, 0.1, 0.28, o.lamps ? new T.Color(2.2, 2.1, 1.7) : new T.Color(0.55, 0.55, 0.5)); lit.box(1.92, 0.66, -0.5, 0.04, 0.1, 0.28, o.lamps ? new T.Color(2.2, 2.1, 1.7) : new T.Color(0.55, 0.55, 0.5));
  lit.box(-1.93, 0.78, 0.55, 0.04, 0.12, 0.3, new T.Color(1.6, 0.12, 0.1)); lit.box(-1.93, 0.78, -0.55, 0.04, 0.12, 0.3, new T.Color(1.6, 0.12, 0.1));
  g.box(1.95, 0.4, 0, 0.03, 0.12, 0.45, '#2a2a40'); g.pop();
}

// ---------- trees ----------
const lumpy = (seed) => { const r = rng(seed); const ph = [r() * 6, r() * 6, r() * 6, r() * 6]; return (x, y, z) => 1 + 0.07 * Math.sin(x * 3.1 + ph[0]) * Math.sin(y * 2.7 + ph[1]) + 0.12 * Math.sin(z * 3.7 + ph[2] + x * 1.7) + 0.06 * Math.sin((x + y + z) * 6.1 + ph[3]); };
// rain-tree / gulmohar: umbrella canopy of overlapping lumpy clusters on a forked trunk. unit height ~ 12 m, canopy ~ 17 m
export function treeGeo(kind = 0, lod = 0) {
  const g = new GB(); const r = rng(1000 + kind * 17 + lod); const trunk = kind === 2 ? '#8a6d5a' : '#5d4a52';
  if (kind === 2) { // coconut palm: ringed leaning trunk, 14 arching pinnate fronds (tapering midrib + paired drooping leaflets), nut cluster
    const pts = []; for (let i = 0; i <= 10; i++) pts.push([Math.sin(i * 0.3) * 0.5, i * 1.0, Math.sin(i * 0.2) * 0.12]);
    g.tube(pts, 0.17, '#8a6d5a', { seg: 7 }); g.cyl(pts[0][0], -0.05, 0, 0.3, 0.17, 0.6, '#7a5f4e', { seg: 7, cap: false });
    if (!lod) for (let i = 1; i < 10; i++) g.cyl(pts[i][0], pts[i][1], pts[i][2], 0.205, 0.205, 0.06, '#6f5646', { seg: 7, cap: false });
    const top = pts[10]; const nf = lod ? 9 : 15; const N = lod ? 8 : 14;
    for (let i = 0; i < nf; i++) {
      const a = i / nf * 6.283 + (i % 2) * 0.2, droop = 0.9 + r() * 0.7, up = 2.0 + r() * 1.2, len = 3.9 + r() * 1.1; g.push(top[0], top[1], top[2], a);
      const rp = []; for (let j = 0; j <= N; j++) { const t = j / N; rp.push([0.1 + len * t, 0.25 + up * t - droop * 3.2 * t * t, 0]); }
      g.tube(rp, 0.05, '#4a7a4a', { seg: 4 });
      for (let j = 2; j <= N; j++) { const t = j / N, [x, y] = rp[j]; const L = (1.15 * Math.sin(Math.PI * Math.pow(t, 0.8) * 0.97) + 0.12) * (len / 4.4); const col1 = j % 2 ? '#2f8a58' : '#3f9e63', col2 = '#9be3a8';
        for (const sd of [1, -1]) { const a0 = [x, y, 0], b0 = [x + 0.26, y + 0.01, 0], c0 = [x + 0.55, y - 0.5 * L - 0.1 * t, sd * L * 0.92], d0 = [x + 0.3, y - 0.5 * L - 0.1 * t, sd * L * 0.97];
          if (lod) { g.quad(a0, b0, c0, d0, col1); g.quad(d0, c0, b0, a0, col1); } else {
            const m1 = [x + 0.13, y - 0.1 * L, sd * L * 0.45], m2 = [x + 0.3, y - 0.18 * L, sd * L * 0.5];
            g.quad(a0, b0, m2, m1, col2); g.quad(m1, m2, b0, a0, col2); g.quad(m1, m2, c0, d0, col1); g.quad(d0, c0, m2, m1, col1); } } }
      g.pop(); }
    for (let i = 0; i < 6; i++) g.sphere(top[0] + (r() - 0.5) * 0.4, top[1] - 0.2, top[2] + (r() - 0.5) * 0.4, 0.15, 0.17, 0.15, '#9a8a3a', { w: 8, h: 6 });
    return g;
  }
  // rain tree (kind 0): thick forked trunk, broad flat-topped umbrella of layered, cel-banded foliage in three greens.
  // gulmohar (kind 1): rounder feathery yellow-green crown with big scarlet flower masses on top.
  const H = kind === 1 ? 4.2 + r() * 0.5 : 4.8 + r() * 0.6; const pts = [[0, 0, 0], [0.1, H * 0.5, 0.05], [0, H, 0]]; g.tube(pts, kind === 1 ? 0.34 : 0.46, trunk, { seg: 8 }); g.cyl(0, -0.05, 0, 0.8, 0.45, 1.1, trunk, { seg: 8, cap: false });
  const nb = lod ? 4 : 7, top = [0, H, 0]; const dark = kind === 1 ? '#5a9a5a' : '#46896a', mid = kind === 1 ? '#7fb862' : '#58a07a', hi = kind === 1 ? '#bcdc84' : '#92d2a2', under = '#3c6a6a';
  for (let i = 0; i < nb; i++) {
    const a = i / nb * 6.283 + r() * 0.5, rad = kind === 1 ? 3.2 + r() * 1.6 : 4.6 + r() * 2.8; const h2 = H + (kind === 1 ? 2.2 : 1.6) + r() * 1.6; const e = [Math.cos(a) * rad, h2, Math.sin(a) * rad];
    g.tube([top, [Math.cos(a) * rad * 0.35, H + 1.2, Math.sin(a) * rad * 0.35], e], 0.22, trunk, { seg: 5 });
    const lumps = lod ? 1 : 3; for (let k = 0; k < lumps; k++) { const rr = (kind === 1 ? 2.3 : 2.5) + r() * 1.2; const jit = lumpy(i * 13 + k + kind * 101);
      const f = 0.55 + k * 0.28; const px = e[0] * f + (r() - 0.5) * 1.6, pz = e[2] * f + (r() - 0.5) * 1.6, py = h2 + 0.5 + k * 0.5;
      const fl = kind === 1 ? [1.15, 0.78] : [1.55, 0.42];
      g.sphere(px, py, pz, rr * fl[0], rr * fl[1], rr * fl[0], k === 0 ? dark : k === 1 ? mid : hi, { w: lod ? 8 : 20, h: lod ? 5 : 11, jit, topColor: k === 2 ? hi : mid, botColor: under });
      if (!lod) { const nc = 9; for (let q = 0; q < nc; q++) { const an = r() * 6.283, dd = Math.sqrt(r()) * 0.92, cr = 0.75 + r() * 0.75; const cx0 = px + Math.cos(an) * dd * rr * fl[0], cz0 = pz + Math.sin(an) * dd * rr * fl[0]; const cy0 = py + rr * fl[1] * Math.sqrt(Math.max(0, 1 - dd * dd)) * 0.95; g.sphere(cx0, cy0, cz0, cr * (kind === 1 ? 0.95 : 1.1), cr * 0.5, cr * (kind === 1 ? 0.95 : 1.1), q % 3 === 0 ? hi : q % 3 === 1 ? mid : dark, { w: 10, h: 6, topColor: hi, botColor: mid }); } }
      if (!lod) g.sphere(px * 0.95, py + rr * fl[1] * 0.55, pz * 0.95, rr * fl[0] * 0.7, rr * fl[1] * 0.45, rr * fl[0] * 0.7, hi, { w: 12, h: 7, jit, topColor: hi, botColor: mid });
      if (kind === 1 && k >= 1) { const nfl = lod ? 1 : 3; for (let q = 0; q < nfl; q++) { const an = r() * 6.283, d = Math.sqrt(r()) * rr * 0.8; g.sphere(px + Math.cos(an) * d, py + rr * fl[1] * 0.75 + 0.15, pz + Math.sin(an) * d, 0.9 + r() * 0.7, 0.4, 0.9 + r() * 0.7, '#e0402a', { w: lod ? 7 : 12, h: lod ? 4 : 7, jit: lumpy(q * 7 + i), topColor: '#ff8a4a', botColor: '#9a2a34' }); } } }
  }
  const jit = lumpy(55 + kind); g.sphere(0, H + (kind === 1 ? 3.6 : 3.0), 0, kind === 1 ? 4.2 : 6.4, kind === 1 ? 2.4 : 1.4, kind === 1 ? 4.2 : 6.4, dark, { w: lod ? 8 : 22, h: lod ? 5 : 12, jit, topColor: mid, botColor: under });
  return g;
}

// ---------- RCC electricity pole with cross-arm, insulators, transformer-free ----------
export function addPole(g, x, z, h = 8.5, y0 = -10.4) {
  g.rod([x, y0, z], [x, y0 + h, z], 0.12, '#a9a4b8', { r1: 0.075, seg: 8 }); g.box(x, y0 + h - 0.4, z, 0.1, 0.1, 1.9, '#555570'); g.box(x, y0 + h - 1.1, z, 0.1, 0.08, 1.4, '#555570');
  for (const dz of [-0.85, -0.3, 0.3, 0.85]) g.cyl(x, y0 + h - 0.35, z + dz, 0.035, 0.03, 0.1, '#7a4a3a', { seg: 6 });
  for (const dz of [-0.6, 0, 0.6]) g.cyl(x, y0 + h - 1.05, z + dz, 0.03, 0.025, 0.09, '#7a4a3a', { seg: 6 });
  return [[x, y0 + h - 0.25, z - 0.85], [x, y0 + h - 0.25, z - 0.3], [x, y0 + h - 0.25, z + 0.3], [x, y0 + h - 0.25, z + 0.85], [x, y0 + h - 0.95, z - 0.6], [x, y0 + h - 0.95, z], [x, y0 + h - 0.95, z + 0.6]];
}
export function sag(a, b, drop, n = 12) { const o = []; for (let i = 0; i <= n; i++) { const t = i / n; o.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - drop * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]); } return o; }

export function addLamp(g, lit, x, z, face = 1, y0 = -10.4) { // sodium/LED street lamp: tall pole, curved arm, lamp head
  g.rod([x, y0, z], [x, y0 + 8.2, z], 0.09, '#6b6a85', { r1: 0.055, seg: 8 }); const ax = x + face * 0, az = z - face * 1.8; g.tube([[x, y0 + 8.2, z], [x, y0 + 8.7, z - face * 0.6], [x, y0 + 8.75, az]], 0.04, '#6b6a85', { seg: 6 });
  g.box(x, y0 + 8.7, az, 0.35, 0.09, 0.7, '#8a88a4'); lit.box(x, y0 + 8.64, az, 0.28, 0.025, 0.58, new T.Color(2.6, 2.3, 1.6)); return [x, y0 + 8.6, az];
}

// ---------- compound wall, gate pillars, watchman booth ----------
export function addCompound(g, blockGB, lit, sign, x0, x1, zw, gate, y0 = -10.4) {
  // wall (block texture mesh) from x0..x1 except the gate gap; 1.7 m high with a coping and spikes
  const seg = (a, b) => { if (b - a < 0.05) return; blockGB.box((a + b) / 2, y0 + 0.42, zw, b - a, 0.84, 0.23, '#d8d0c4'); g.box((a + b) / 2, y0 + 0.88, zw, b - a + 0.04, 0.08, 0.3, '#cfc8bd'); for (let px = a; px <= b + 0.01; px += 2.4) g.box(px, y0 + 1.0, zw, 0.28, 2.0, 0.28, '#d8d0c4'); const n = Math.floor((b - a) / 0.16); for (let i = 0; i <= n; i++) g.rod([a + i * (b - a) / n, y0 + 0.92, zw], [a + i * (b - a) / n, y0 + 1.75, zw], 0.011, '#3a3a52', { r1: 0.004, seg: 4 }); g.rod([a, y0 + 1.7, zw], [b, y0 + 1.7, zw], 0.012, '#3a3a52', { seg: 4 }); g.rod([a, y0 + 1.15, zw], [b, y0 + 1.15, zw], 0.01, '#3a3a52', { seg: 4 }); };
  seg(x0, gate[0] - 0.3); seg(gate[1] + 0.3, x1);
  [gate[0] - 0.15, gate[1] + 0.15].forEach((x, i) => { g.box(x, y0 + 1.1, zw, 0.5, 2.2, 0.5, '#e8dcc2'); g.box(x, y0 + 2.25, zw, 0.62, 0.12, 0.62, '#cfc2a4'); g.sphere(x, y0 + 2.42, zw, 0.16, 0.16, 0.16, '#e0d4ba', { w: 10, h: 8 }); lit.sphere(x, y0 + 2.62, zw, 0.07, 0.07, 0.07, new T.Color(2.4, 2.1, 1.4), { w: 8, h: 6 }); });
  // sliding gate: half open, vertical MS bars on a rail
  const gw = (gate[1] - gate[0]) * 0.45; for (let i = 0; i < 14; i++) g.box(gate[1] - 0.05 - (i / 13) * gw, y0 + 0.95, zw + 0.2, 0.025, 1.7, 0.025, '#2d6a58'); g.box(gate[1] - gw / 2, y0 + 0.35, zw + 0.2, gw, 0.05, 0.05, '#2d6a58'); g.box(gate[1] - gw / 2, y0 + 1.7, zw + 0.2, gw, 0.05, 0.05, '#2d6a58'); g.box((gate[0] + gate[1]) / 2, y0 + 0.02, zw + 0.2, gate[1] - gate[0], 0.04, 0.05, '#555');
  // name board on the left pillar side
  sign && sign(gate[0] - 0.6 - 0.9, y0 + 1.15, zw + 0.14);
}
export function addBooth(g, lit, x, z, y0 = -10.4) {   // watchman's cabin: 1.4 x 1.4 x 2.3, sloping roof, lit window
  g.box(x, y0 + 1.05, z, 1.4, 2.1, 1.4, '#9bb2cf'); g.box(x, y0 + 0.05, z, 1.55, 0.1, 1.55, '#8f89a4'); g.push(x, y0 + 2.1, z, 0); g.quad([-0.85, 0, 0.8], [0.85, 0, 0.8], [0.85, 0.25, -0.8], [-0.85, 0.25, -0.8], '#d98a6a'); g.quad([-0.85, 0, -0.8], [-0.85, 0.25, -0.8], [0.85, 0.25, -0.8], [0.85, 0, -0.8], '#b86e50'); g.pop();
  g.box(x, y0 + 2.18, z, 1.7, 0.1, 1.7, '#c97a5a'); lit.quad([x - 0.4, y0 + 1.1, z + 0.71], [x + 0.4, y0 + 1.1, z + 0.71], [x + 0.4, y0 + 1.8, z + 0.71], [x - 0.4, y0 + 1.8, z + 0.71], new T.Color(1.6, 1.3, 0.8));
  g.box(x, y0 + 1.1, z + 0.72, 0.9, 0.06, 0.06, '#f1ecf8'); g.box(x, y0 + 1.8, z + 0.72, 0.9, 0.06, 0.06, '#f1ecf8'); g.box(x - 0.45, y0 + 1.45, z + 0.72, 0.06, 0.74, 0.06, '#f1ecf8'); g.box(x + 0.45, y0 + 1.45, z + 0.72, 0.06, 0.74, 0.06, '#f1ecf8');
  g.box(x + 0.1, y0 + 0.55, z + 0.9, 0.5, 0.05, 0.5, '#6a4a38'); g.box(x + 0.1, y0 + 0.3, z + 0.9, 0.5, 0.45, 0.05, '#6a4a38');   // stool
}
export function addTankFarm(g, x, y, z, col = '#26253a') { /* neighbour roof clutter: black tank on plinth */ g.box(x, y + 0.12, z, 1.4, 0.24, 1.4, '#9a96b0'); g.cyl(x, y + 0.24, z, 0.6, 0.58, 1.2, col, { seg: 14 }); g.cyl(x, y + 1.44, z, 0.58, 0.2, 0.18, col, { seg: 14 }); for (let i = 1; i < 3; i++) g.cyl(x, y + 0.24 + i * 0.4, z, 0.615, 0.615, 0.03, '#1c1b2e', { seg: 14 }); }
