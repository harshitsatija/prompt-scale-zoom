/* Her apartment block: S+7 (stilt parking + 7 residential floors), 24 m x 15 m, 3.2 m floor pitch, with the cutaway cell open at the front of floor 3.
 * Layout across x: stair core [-12,-9] | flat A [-9,-3] | flat B (hers) [-3,3] | flat C [3,9] | lift core [9,12].  Front facade plane z = +2.5, back z = -12.5.
 * Observed from refs/building/apt1..4.jpg: muted plaster, cream vertical fins, recessed balconies with MS railings, window surrounds, AC condensers, laundry,
 * roof Sintex tanks / solar heaters / dishes / stair headroom, stilt parking with scooters. */
import { GB, rng, lin } from './gb.js';
import { T } from './deps.js';
import { cellShell, CELL } from '../person/shell.js';

export const GROUND = -10.4, FL = (k) => -1.2 + 3.2 * (k - 3), SLAB = 0.2;
export const X0 = -12, X1 = 12, ZF = 2.5, ZB = -12.5;
const C = {
  body: '#9c9bcb', body2: '#a9a6d2', cream: '#f3e7cc', creamD: '#e2d2b0', peach: '#e8b48c', terra: '#d98a6a', indigo: '#3b3f9e', slab: '#ece3d1', rail: '#2a2c55', frame: '#f1ecf8', door: '#6a4a38', dark: '#1c1d45', sage: '#a9c9b3', ochre: '#e3c07a', teal: '#58b8a6',
  concrete: '#bdb6cc', concD: '#8f89a4', tile: '#d9c7a6', pipe: '#2b2b3f', pvc: '#d8d6e4',
};
const WARM = [[1.05, 0.78, 0.42], [1.0, 0.64, 0.34], [1.08, 0.9, 0.55], [0.95, 0.92, 0.84], [0.62, 0.82, 1.08], [1.05, 0.55, 0.42]];   // neighbours stay under the bloom threshold; her cell is the hot one
const cl = (a, k = 1) => new T.Color(a[0] * k, a[1] * k, a[2] * k);

export function buildHero(R, B) {   // B: { vc, lit, glass, prop, tile(side walls), signs[] } GB instances
  const { vc, lit, glass, prop, tile } = B; const r = R;

  const holes = (x0, x1, y0, y1, zOut, th, color, hs) => {
    const xs = [x0, x1]; hs.forEach((h) => { xs.push(h.a, h.b); }); const u = [...new Set(xs.map((v) => +v.toFixed(4)))].sort((a, b) => a - b); const box = (xa, xb, ya, yb) => { if (xb - xa > 1e-4 && yb - ya > 1e-4) vc.box((xa + xb) / 2, (ya + yb) / 2, zOut - th / 2, xb - xa, yb - ya, th, color); };
    for (let i = 0; i < u.length - 1; i++) { const xa = u[i], xb = u[i + 1]; if (xa < x0 - 1e-6 || xb > x1 + 1e-6) continue; const h = hs.find((q) => q.a <= xa + 1e-6 && q.b >= xb - 1e-6); if (!h) box(xa, xb, y0, y1); else { box(xa, xb, y0, h.c); box(xa, xb, h.d, y1); } }
  };
  const winGlass = (h, zp, isLit, kind) => {   // glass + frame inside a hole {a,b,c,d}
    const w = h.b - h.a, hh = h.d - h.c, cx = (h.a + h.b) / 2;
    if (isLit) {
      const col = WARM[Math.floor(r() * r() * WARM.length)]; const top = cl(col, 1.0), bot = cl(col, 0.55);
      lit.quadC([h.a, h.c, zp], [h.b, h.c, zp], [h.b, h.d, zp], [h.a, h.d, zp], [bot, bot, top, top]);
      // curtains / blinds
      if (kind === 'door') { const it = r(); if (it < 0.34) { /* sofa + wall frame */ vc.box(cx - w * 0.15, h.c + 0.3, zp - 0.05, w * 0.6, 0.5, 0.35, '#3a2f5a'); vc.box(cx - w * 0.15, h.c + 0.65, zp - 0.1, w * 0.6, 0.45, 0.1, '#3a2f5a'); vc.box(cx + w * 0.25, h.c + 1.3, zp - 0.04, 0.35, 0.45, 0.02, '#c9a96b'); } else if (it < 0.7) { /* ceiling fan + tube light + shelf */ for (let a = 0; a < 3; a++) vc.box(cx, h.d - 0.12, zp - 0.06, 0.9, 0.012, 0.09, '#2a2540', { ry: a * Math.PI / 3 + 0.4 }); vc.box(cx, h.d - 0.1, zp - 0.04, 0.08, 0.1, 0.08, '#2a2540'); vc.box(h.b - 0.4, h.c + 1.0, zp - 0.1, 0.55, 0.9, 0.25, '#4a3a6a'); } else { vc.box(cx, h.c + 0.9, zp - 0.04, 0.9, 0.55, 0.02, '#8fd0ff'); vc.box(cx, h.c + 0.5, zp - 0.1, 1.0, 0.5, 0.4, '#2b2548'); } }
      const cu = r(); if (cu < 0.55) { const cc = ['#7a3b6b', '#2f6a73', '#b5651d', '#5a4fa0', '#a63d40'][Math.floor(r() * 5)]; const wc = w * (0.18 + r() * 0.12); vc.box(h.a + wc / 2, (h.c + h.d) / 2, zp + 0.02, wc, hh, 0.03, cc); vc.box(h.b - wc / 2, (h.c + h.d) / 2, zp + 0.02, wc, hh, 0.03, cc); }
      else if (cu < 0.8) { vc.box(cx, h.d - hh * 0.2, zp + 0.02, w, hh * 0.4, 0.03, '#d9cfa8'); }
    } else {
      const top = new T.Color(0.2, 0.23, 0.5), bot = new T.Color(0.035, 0.035, 0.13); glass.quadC([h.a, h.c, zp], [h.b, h.c, zp], [h.b, h.d, zp], [h.a, h.d, zp], [bot, bot, top, top]);
      // soft sky reflection streak
      const refl = new T.Color(0.34, 0.38, 0.68); glass.quadC([h.a + w * 0.12, h.c, zp + 0.003], [h.a + w * 0.35, h.c, zp + 0.003], [h.a + w * 0.55, h.d, zp + 0.003], [h.a + w * 0.32, h.d, zp + 0.003], [bot, bot, refl, refl]);
    }
    // frame: perimeter + mullions
    const fz = zp + 0.05, t = 0.045; vc.box(cx, h.c + t / 2, fz, w, t, 0.07, C.frame); vc.box(cx, h.d - t / 2, fz, w, t, 0.07, C.frame); vc.box(h.a + t / 2, (h.c + h.d) / 2, fz, t, hh, 0.07, C.frame); vc.box(h.b - t / 2, (h.c + h.d) / 2, fz, t, hh, 0.07, C.frame);
    if (kind === 'door') { vc.box(cx, (h.c + h.d) / 2, fz, 0.05, hh, 0.07, C.frame); vc.box(cx, h.c + hh * 0.5, fz, w, 0.035, 0.06, C.frame); } else { vc.box(cx, (h.c + h.d) / 2, fz, 0.04, hh, 0.07, C.frame); vc.box(cx, h.c + hh * 0.62, fz, w, 0.035, 0.06, C.frame); }
  };
  const grille = (h, z) => { const n = Math.round((h.b - h.a) / 0.1); for (let i = 0; i <= n; i++) vc.box(h.a + i * (h.b - h.a) / n, (h.c + h.d) / 2, z, 0.014, h.d - h.c + 0.1, 0.014, C.rail); [0, 0.5, 1].forEach((f) => vc.box((h.a + h.b) / 2, h.c + f * (h.d - h.c), z, h.b - h.a, 0.02, 0.02, C.rail)); };
  const sill = (h, zOut, col = C.frame) => { if (B.stain) { const u0 = r() * 3, ww = h.b - h.a + 0.2, hh2 = 0.8 + r() * 0.9; B.stain.quad([h.a - 0.1, h.c - 0.06 - hh2, zOut + 0.006], [h.b + 0.1, h.c - 0.06 - hh2, zOut + 0.006], [h.b + 0.1, h.c - 0.06, zOut + 0.006], [h.a - 0.1, h.c - 0.06, zOut + 0.006], '#ffffff', { uv: [[u0, 1 - hh2 / 1.8], [u0 + ww / 1.6, 1 - hh2 / 1.8], [u0 + ww / 1.6, 1], [u0, 1]] }); } vc.box((h.a + h.b) / 2, h.c - 0.03, zOut + 0.04, h.b - h.a + 0.22, 0.06, 0.16, col); vc.box((h.a + h.b) / 2, h.d + 0.07, zOut + 0.02, h.b - h.a + 0.2, 0.1, 0.1, col); };
  const plant = (x, y, z, s = 1) => { vc.cyl(x, y, z, 0.1 * s, 0.14 * s, 0.26 * s, r() < 0.5 ? '#c4663f' : '#a85a3c', { seg: 10 }); const g = ['#3fa06a', '#5fbf6a', '#2f8a5c'][Math.floor(r() * 3)]; for (let i = 0; i < 4; i++) vc.sphere(x + (r() - 0.5) * 0.14 * s, y + 0.34 * s + r() * 0.2 * s, z + (r() - 0.5) * 0.1 * s, 0.17 * s, 0.14 * s, 0.17 * s, g, { w: 9, h: 6, topColor: '#7fd68a', botColor: '#256a4c' }); };
  const ac = (x, y, z) => { prop.box(x, y, z, 0.84, 0.62, 0.3, '#e6e3f0'); prop.quad([x - 0.38, y - 0.26, z + 0.151], [x + 0.38, y - 0.26, z + 0.151], [x + 0.38, y + 0.27, z + 0.151], [x - 0.38, y + 0.27, z + 0.151], '#ffffff', { uv: [[0.06, 0.06], [0.94, 0.06], [0.94, 0.94], [0.06, 0.94]] }); prop.box(x, y - 0.38, z - 0.02, 0.6, 0.05, 0.22, C.concD); vc.rod([x - 0.3, y - 0.31, z - 0.1], [x - 0.3, y - 0.31, z - 0.4], 0.012, '#d8d4e8'); vc.rod([x - 0.3, y - 0.31, z - 0.1], [x - 0.3, y - 1.5 - r() * 0.5, z - 0.1], 0.012, '#d8d4e8'); if (B.stain) B.stain.quad([x - 0.45, y - 1.3, z - 0.1], [x + 0.2, y - 1.3, z - 0.1], [x + 0.2, y - 0.36, z - 0.1], [x - 0.45, y - 0.36, z - 0.1], '#ffffff', { uv: [[r() * 3, 0.5], [r() * 3 + 0.35, 0.5], [0.35, 1], [0, 1]] }); };
  const laundry = (x0, x1, y, z) => {
    const span = x1 - x0, sagAt = (x) => { const t = (x - x0) / span; return 0.07 * 4 * t * (1 - t); };
    const rp = []; for (let i = 0; i <= 10; i++) { const xx = x0 + span * i / 10; rp.push([xx, y - sagAt(xx), z]); } vc.tube(rp, 0.007, '#bdb8d0', { seg: 4 });
    const cols = ['#e5495f', '#f6d365', '#f4f1ea', '#3e8ed0', '#9fe0c0', '#c274d0', '#ffb347', '#2f6a73', '#d9d0f0'];
    const pc = () => cols[Math.floor(r() * cols.length)]; const sh = (c, k) => { const q = new T.Color(c); return q.multiplyScalar(k); };
    const g4 = (xl, xr, ys, h, c, jl = 0.08, jr = 0.08, dz = 0) => { const top = sh(c, 1.08), bot = sh(c, 0.72); vc.quadC([xl, ys - h * (1 - jl * r()), z + dz], [xr, ys - h * (1 - jr * r()), z + dz], [xr, ys, z + dz], [xl, ys, z + dz], [bot, bot, top, top]); vc.quadC([xr, ys - h * (1 - jr * r()), z + dz - 0.004], [xl, ys - h * (1 - jl * r()), z + dz - 0.004], [xl, ys, z + dz - 0.004], [xr, ys, z + dz - 0.004], [bot, bot, top, top]); };
    let x = x0 + 0.15 + r() * 0.2;
    while (x < x1 - 0.3) {
      const kd = r(), ys = y - sagAt(x) - 0.01, c = pc();
      if (kd < 0.3) { const w = 0.3 + r() * 0.08, h = 0.5 + r() * 0.15; g4(x, x + w, ys - 0.02, h, c); g4(x - 0.13, x, ys - 0.02, 0.26, c, 0.2, 0.1, 0.003); g4(x + w, x + w + 0.13, ys - 0.02, 0.26, c, 0.1, 0.2, 0.003); x += w + 0.2 + r() * 0.25; }
      else if (kd < 0.5) { const w = 0.5 + r() * 0.1, h = 0.95 + r() * 0.25, m = w * (0.3 + r() * 0.4); const xm = x + m; const wv = (r() - 0.5) * 0.06; g4(x, xm, ys, h, c, 0.06, 0.12); g4(xm, x + w, ys, h * 0.96, c, 0.14, 0.04, 0.012); vc.quad([xm - 0.01, ys - h * 0.9, z + 0.001], [xm + 0.01 + wv, ys - h * 0.9, z + 0.001], [xm + 0.01 + wv, ys, z + 0.001], [xm - 0.01, ys, z + 0.001], sh(c, 0.6)); x += w + 0.12 + r() * 0.2; }
      else if (kd < 0.7) { const lw = 0.15, h = 0.7 + r() * 0.1; g4(x, x + lw, ys, h, c, 0.04, 0.1); g4(x + lw + 0.03, x + 2 * lw + 0.03, ys, h * 0.95, c, 0.1, 0.04); g4(x, x + 2 * lw + 0.03, ys, 0.1, c, 0, 0); x += 2 * lw + 0.2 + r() * 0.3; }
      else { const w = 0.4, h = 0.52 + r() * 0.1; g4(x, x + w, ys, h, c, 0.05, 0.05); g4(x + 0.01, x + w - 0.01, ys - h + 0.12, 0.12, '#f4f1ea', 0, 0, 0.004); x += w + 0.1 + r() * 0.3; if (r() < 0.5) { const c2 = pc(); g4(x - 0.25, x + 0.12, ys, h * 0.8, c2, 0.1, 0.1, 0.012); x += 0.2; } }
    } };

  const fL = [], vhash = (a, b) => { let h = (a * 73856093) ^ (b * 19349663); h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  for (let k = 1; k <= 7; k++) {
    const y0 = FL(k), y1 = FL(k + 1) - SLAB;
    // floor slab (full plan) with a projecting cream edge band
    vc.box(0, y0 - SLAB / 2, (ZF + ZB) / 2, 24, SLAB, ZF - ZB, C.slab, { skip: ['+z', '+y'] }); vc.quad([X0, y0, ZB], [X0, y0, ZF], [X1, y0, ZF], [X1, y0, ZB], C.slab);
    vc.box(0, y0 - SLAB / 2 - 0.02, ZF + 0.06, 24.12, SLAB + 0.12, 0.12, C.cream);   // drip band
    vc.box(0, y0 + 0.04, ZF + 0.03, 24, 0.08, 0.06, C.creamD);
    const flats = [{ id: 'A', xc: -6, a: -9, b: -3 }, { id: 'B', xc: 0, a: -3, b: 3 }, { id: 'C', xc: 6, a: 3, b: 9 }];
    flats.forEach((f, fi) => {
      const hers = f.id === 'B' && k === 3; const mir = vhash(k, fi * 7 + 1) < 0.5 ? -1 : 1;
      if (hers) {
        // open cutaway cell: the SAME structural shell the person level draws around her room (levels/person/shell.js), here with its room-facing faces
        cellShell(vc, { inner: true });
        { const Cc = (h) => new T.Color(h), warmB = Cc('#8a6694'), warmT = Cc('#a784b0'), sideB = Cc('#9a76a8'), sideT = Cc('#b090bc'); const C0 = CELL, xi = C0.x, zb = C0.zb + 0.004, W0 = C0.wx0, W1 = C0.wx1, V0 = C0.wy0, V1 = C0.wy1;
          vc.quad([-xi, y0 + 0.002, zb], [-xi, y0 + 0.002, C0.zf], [xi, y0 + 0.002, C0.zf], [xi, y0 + 0.002, zb], '#b07a52');
          vc.quad([-xi, y1 - 0.002, C0.zf], [-xi, y1 - 0.002, zb], [xi, y1 - 0.002, zb], [xi, y1 - 0.002, C0.zf], '#e6d8c2');
          vc.quadC([-xi + 0.004, y0, C0.zf], [-xi + 0.004, y0, zb], [-xi + 0.004, y1, zb], [-xi + 0.004, y1, C0.zf], [sideB, sideB, sideT, sideT]);
          vc.quadC([xi - 0.004, y0, zb], [xi - 0.004, y0, C0.zf], [xi - 0.004, y1, C0.zf], [xi - 0.004, y1, zb], [sideB, sideB, sideT, sideT]);
          const bq = (xa, xb, ya, yb) => vc.quadC([xa, ya, zb + 0.004], [xb, ya, zb + 0.004], [xb, yb, zb + 0.004], [xa, yb, zb + 0.004], [warmB, warmB, warmT, warmT]);
          bq(-xi, W0, y0, y1); bq(W1, xi, y0, y1); bq(W0, W1, y0, V0); bq(W0, W1, V1, y1);
          const lw = new T.Color(2.2, 1.7, 1.0); lit.quad([-0.7, y1 - 0.01, 0.6], [-0.7, y1 - 0.01, -0.4], [0.7, y1 - 0.01, -0.4], [0.7, y1 - 0.01, 0.6], lw); }
        if (B.cell) buildCellStandIn(B.cell, B.cellLit, y0, y1);
        return;
      }
      if (vhash(k * 19 + fi * 3, 33) < 0.38) {   // closed bay: plastered wall flush with the fins, recessed windows with reveals, chajja and a steel grille (no balcony)
        const xc2 = f.xc, zf = ZF - 0.04, wth = 0.32; const pal = ['#e9c9a6', '#e8d3a2', '#c9d6b8', '#eab898', '#d3c9e8'], wc = pal[Math.floor(vhash(k * 3 + fi, 61) * pal.length)];
        const w1 = { a: xc2 - 2.45, b: xc2 - 0.85, c: y0 + 0.95, d: y0 + 2.15 }, w2 = { a: xc2 + 0.85, b: xc2 + 2.45, c: y0 + 0.95, d: y0 + 2.15 }, vt = { a: xc2 - 0.3, b: xc2 + 0.3, c: y0 + 1.7, d: y0 + 2.1 };
        vc.box(xc2, (y0 + y1) / 2, (zf - wth + ZB) / 2, f.b - f.a, y1 - y0, zf - wth - ZB, C.body);
        holes(f.a, f.b, y0, y1, zf, wth, wc, [w1, w2, vt]);
        [w1, w2].forEach((w, wi) => { winGlass(w, zf - 0.2, vhash(k, fi * 5 + wi + 101) < 0.3, 'win'); const gp = (fi + k + wi) % 3; if (gp === 0) grille(w, zf + 0.02); else if (gp === 1) { for (let i = 0; i <= 3; i++) vc.box(w.a + (w.b - w.a) * i / 3, (w.c + w.d) / 2, zf + 0.025, 0.02, w.d - w.c, 0.02, C.rail); for (let i = 0; i < 4; i++) vc.box((w.a + w.b) / 2, w.c + (w.d - w.c) * (i + 0.5) / 4, zf + 0.025, w.b - w.a, 0.02, 0.02, C.rail); } else { const n = 6; for (let i = 0; i < n; i++) { const xx = w.a + (w.b - w.a) * (i + 0.5) / n; vc.rod([xx, w.c, zf + 0.03], [xx - 0.08, w.d, zf + 0.03], 0.012, C.rail); vc.rod([xx - 0.08, w.c, zf + 0.03], [xx, w.d, zf + 0.03], 0.012, C.rail); } }
          sill(w, zf); vc.box((w.a + w.b) / 2, w.d + 0.2, zf + 0.2, w.b - w.a + 0.36, 0.05, 0.44, C.cream); });   // chajja (RCC sun-shade) above each window
        vc.box((vt.a + vt.b) / 2, (vt.c + vt.d) / 2, zf - 0.2, vt.b - vt.a, vt.d - vt.c, 0.05, C.pipe); for (let i = 0; i < 4; i++) vc.box((vt.a + vt.b) / 2, vt.c + 0.07 + i * 0.09, zf - 0.17, vt.b - vt.a - 0.04, 0.02, 0.03, '#4a4a68');
        vc.box(xc2, y0 + 0.06, zf + 0.02, f.b - f.a - 0.4, 0.12, 0.03, C.creamD); vc.box(xc2, y1 - 0.16, zf + 0.02, f.b - f.a - 0.4, 0.2, 0.03, C.cream);   // plinth + top band
        if (vhash(k * 7 + fi, 71) < 0.7) { const ax = vhash(k, fi + 72) < 0.5 ? w1.b + 0.45 : w2.a - 0.45; ac(ax, y0 + 0.5, zf + 0.2); vc.rod([ax - 0.3, y0 + 0.2, zf + 0.15], [ax - 0.3, y0 + 0.2, zf + 0.02], 0.01, '#d8d4e8'); }
        if (vhash(k * 9 + fi, 73) < 0.3) { const dx_ = xc2 + 1.2; vc.rod([dx_, y0 + 0.5, zf + 0.02], [dx_, y0 + 0.75, zf + 0.02], 0.018, '#6b6a85'); vc.push(dx_, y0 + 0.82, zf + 0.05, 0.3, 1, -0.5); vc.sphere(0, 0, 0, 0.26, 0.24, 0.05, '#e8e6f2', { w: 12, h: 5, th1: Math.PI / 2 }); vc.pop(); }
        return;
      }
      const zw = 1.1, th = 0.25, xc = f.xc;
      const dx0 = mir > 0 ? xc - 2.3 : xc + 0.3, ddx = [dx0, dx0 + 2.0];
      const winX = mir > 0 ? xc + 0.7 : xc - 1.9; const bed = { a: winX, b: winX + 1.2, c: y0 + 0.95, d: y0 + 2.15 };
      const util = { a: mir > 0 ? xc + 2.2 : xc - 2.8, b: mir > 0 ? xc + 2.8 : xc - 2.2, c: y0 + 1.5, d: y0 + 2.1 };
      const dr = { a: ddx[0], b: ddx[1], c: y0 + 0.04, d: y0 + 2.18 };
      const hs = [dr, bed, util];
      const bc = [['#eab898', '#e9c9a6'], ['#e8d3a2', '#e9c9a6'], ['#c9d6b8', '#e8d3a2']][fi][(k + fi) % 2 === 0 || vhash(k, fi) < 0.25 ? 0 : 1];
      vc.box(xc, (y0 + y1) / 2, (zw - th + ZB) / 2, f.b - f.a, y1 - y0, zw - th - ZB, C.body);   // solid filler behind
      // painted wall faces inside the balcony: peach / terracotta / ochre / sage by flat
      holes(f.a, f.b, y0, y1, zw, th, bc, hs);
      winGlass(dr, zw - 0.12, vhash(k, fi + 11) < 0.34, 'door'); winGlass(bed, zw - 0.12, vhash(k, fi + 17) < 0.3, 'win'); grille(bed, zw + 0.02); sill(bed, zw);
      vc.box((util.a + util.b) / 2, (util.c + util.d) / 2, zw - 0.2, util.b - util.a, util.d - util.c, 0.06, C.pipe); for (let i = 0; i < 6; i++) vc.box(util.a + 0.05 + i * 0.1, (util.c + util.d) / 2, zw - 0.14, 0.04, util.d - util.c - 0.04, 0.02, '#4a4a68');   // exhaust louvre
      // balcony side partitions, parapet and railing
      vc.box(f.a + 0.1, (y0 + y1) / 2, (zw + ZF) / 2, 0.2, y1 - y0, ZF - zw, bc); vc.box(f.b - 0.1, (y0 + y1) / 2, (zw + ZF) / 2, 0.2, y1 - y0, ZF - zw, bc);
      vc.quad([f.a + 0.2, y0 + 0.01, zw], [f.a + 0.2, y0 + 0.01, ZF - 0.1], [f.b - 0.2, y0 + 0.01, ZF - 0.1], [f.b - 0.2, y0 + 0.01, zw], C.tile);   // balcony floor tiles
      vc.box(xc, y0 + 0.28, ZF - 0.06, f.b - f.a - 0.4, 0.5, 0.12, C.cream);   // solid sill wall
      const rz = ZF - 0.06, nb = Math.round((f.b - f.a - 0.4) / 0.105), rpat = Math.floor(vhash(k * 23 + fi, 55) * 3), wx2 = f.b - f.a - 0.4;
      if (rpat === 0) { for (let i = 0; i <= nb; i++) vc.box(f.a + 0.2 + i * wx2 / nb, y0 + 0.8, rz, 0.014, 0.55, 0.014, C.rail); vc.box(xc, y0 + 1.07, rz, wx2, 0.04, 0.05, C.rail); vc.box(xc, y0 + 0.78, rz, wx2, 0.016, 0.016, C.rail); }
      else if (rpat === 1) { vc.box(xc, y0 + 0.5, rz, wx2, 0.5, 0.12, bc); vc.box(xc, y0 + 0.78, rz, wx2, 0.05, 0.16, C.cream); for (let i = 0; i <= 5; i++) vc.box(f.a + 0.2 + i * wx2 / 5, y0 + 0.95, rz, 0.03, 0.3, 0.03, C.rail); vc.box(xc, y0 + 1.1, rz, wx2, 0.035, 0.04, C.rail); }
      else { for (let i = 0; i <= 6; i++) vc.box(f.a + 0.2 + i * wx2 / 6, y0 + 0.78, rz, 0.03, 0.6, 0.03, C.rail); [0.62, 0.84, 1.07].forEach((hh) => vc.box(xc, y0 + hh, rz, wx2, hh > 1 ? 0.04 : 0.02, hh > 1 ? 0.05 : 0.02, C.rail)); }
      // life on the balcony
      const q = vhash(k * 5 + fi, 9); if (q < 0.45) { for (let i = 0; i < 3 + Math.floor(r() * 3); i++) plant(f.a + 0.45 + i * 0.42 + r() * 0.1, y0 + 0.56, ZF - 0.28, 0.9 + r() * 0.5); }
      if (q > 0.35 && q < 0.7) laundry(f.a + 0.4, f.b - 0.4, y1 - 0.5, zw + 0.55);
      if (vhash(k * 11 + fi, 3) < 0.55) ac(mir > 0 ? f.b - 0.7 : f.a + 0.7, y0 + 0.28, ZF + 0.17);   // condenser on a bracket outside
      if (vhash(k * 13 + fi, 4) < 0.28) { vc.box(f.a + 0.6, y0 + 0.28, zw + 0.45, 0.5, 0.56, 0.5, '#cfd0e0'); }   // washing machine
      { const vr = vhash(k * 17 + fi, 21), wx = f.b - f.a - 0.4;
        if (vr < 0.2) { // enclosed balcony: aluminium sliding-window cage glazed to the slab above
          const gz = ZF - 0.01, ya = y0 + 1.1, yb = y1 - 0.06, litg = vhash(k, fi + 31) < 0.4; const gt = litg ? new T.Color(0.95, 0.75, 0.45) : new T.Color(0.12, 0.14, 0.34), gbm = litg ? new T.Color(0.6, 0.45, 0.28) : new T.Color(0.02, 0.02, 0.08);
          (litg ? lit : glass).quadC([f.a + 0.2, ya, gz], [f.b - 0.2, ya, gz], [f.b - 0.2, yb, gz], [f.a + 0.2, yb, gz], [gbm, gbm, gt, gt]);
          for (let i = 0; i <= 4; i++) vc.box(f.a + 0.2 + i * wx / 4, (ya + yb) / 2, gz + 0.02, 0.04, yb - ya, 0.05, '#c9c6d8'); vc.box(xc, ya, gz + 0.02, wx, 0.04, 0.05, '#c9c6d8'); vc.box(xc, yb, gz + 0.02, wx, 0.05, 0.05, '#c9c6d8'); vc.box(xc, (ya + yb) / 2, gz + 0.02, wx, 0.03, 0.04, '#c9c6d8'); }
        else if (vr < 0.38) { // sheet-metal sun awning on brackets
          const ac_ = ['#3b6aa5', '#2f8a6a', '#b0563c', '#8a8aa0'][Math.floor(vhash(k, fi + 5) * 4)]; vc.box(xc, y1 - 0.5, ZF + 0.38, wx, 0.04, 1.05, ac_, { rx: 0.42 }); vc.box(xc, y1 - 0.62, ZF + 0.85, wx, 0.05, 0.05, '#3a3a58'); [f.a + 0.25, f.b - 0.25].forEach((xx) => vc.rod([xx, y1 - 0.55, ZF + 0.8], [xx, y1 - 0.12, ZF + 0.0], 0.02, '#3a3a58')); }
        else if (vr < 0.5) { // steel safety grille across the balcony mouth
          for (let i = 0; i <= Math.round(wx / 0.11); i++) vc.box(f.a + 0.2 + i * 0.11, (y0 + 1.1 + y1 - 0.2) / 2, ZF + 0.03, 0.012, y1 - 0.2 - y0 - 1.1, 0.012, '#3a3d5e'); [y0 + 1.5, y0 + 2.0, y1 - 0.2].forEach((yy) => vc.box(xc, yy, ZF + 0.03, wx, 0.02, 0.02, '#3a3d5e')); }
        if (vhash(k * 3 + fi, 8) < 0.3) { const dx_ = f.a + 0.5 + vhash(k, fi + 2) * (wx - 0.6); vc.rod([dx_, y0 + 1.07, ZF - 0.06], [dx_, y0 + 1.5, ZF - 0.08], 0.018, '#6b6a85'); vc.push(dx_, y0 + 1.55, ZF - 0.06, 0.3, 1, -0.5); vc.sphere(0, 0, 0, 0.26, 0.24, 0.05, '#e8e6f2', { w: 12, h: 5, th1: Math.PI / 2 }); vc.pop(); }   // DTH dish clamped to the rail
        if (vhash(k * 7 + fi, 6) < 0.35) { const gx = f.b - 0.45; vc.cyl(gx, y1 - 0.9, ZF - 0.9, 0.17, 0.17, 0.42, '#e7e4ee', { seg: 10 }); vc.box(gx, y1 - 0.5, ZF - 0.9, 0.06, 0.04, 0.06, '#555'); }   // geyser on the balcony wall
        if (vhash(k * 5 + fi, 12) < 0.4) { vc.box(f.a + 0.35, y0 + 0.28, ZF - 0.4, 0.3, 0.45, 0.3, '#2d6aa8'); vc.box(f.a + 0.35, y0 + 0.55, ZF - 0.4, 0.2, 0.06, 0.2, '#1d4a7a'); }   // water can
      }
    });
    // vertical fins (cream) at flat boundaries, full storey
    [-9, -3, 3, 9].forEach((x) => vc.box(x, (y0 + y1) / 2, ZF - 0.12, 0.42, y1 - y0, 0.28, C.cream));
    [-9, -3, 3, 9].forEach((x, i) => { const sa = new T.Color('#b7a58d'), sb = new T.Color(C.cream); if (vhash(k, i + 40) < 0.7) { const w = 0.06 + vhash(k, i + 50) * 0.1, ox = (vhash(k, i + 60) - 0.5) * 0.2; vc.quadC([x + ox - w, y1 - 1.6 * (0.5 + vhash(k, i + 70)), ZF + 0.0215], [x + ox + w, y1 - 1.6 * (0.5 + vhash(k, i + 80)), ZF + 0.0215], [x + ox + w * 0.8, y1, ZF + 0.0215], [x + ox - w * 0.8, y1, ZF + 0.0215], [sb, sb, sa, sa]); }
      if (i === 1 || i === 2) { vc.rod([x + 0.12, y0 - 0.25, ZF + 0.05], [x + 0.12, y1 + 0.05, ZF + 0.05], 0.028, i === 1 ? C.pvc : '#2b2b3f'); vc.box(x + 0.12, y0 + 1.1, ZF + 0.05, 0.08, 0.06, 0.07, '#8d8aa8'); vc.rod([x + 0.12, y0 + 0.7, ZF + 0.05], [x - 0.5, y0 + 0.62, ZF - 0.02], 0.016, C.pvc); } });
    // (drip tabs removed: they read as torn tape)
    // cores
    { // stair core: slit window with jali, lit cool/warm at some floors
      const zs = 2.3; const sw = { a: -11.0, b: -10.0, c: y0 + 0.5, d: y0 + 2.35 }; holes(X0, -9, y0, y1, zs, 0.25, C.body2, [sw]); vc.box(-10.5, (y0 + y1) / 2, (zs - 0.25 + ZB) / 2, 3, y1 - y0, zs - 0.25 - ZB, C.body2);
      winGlass(sw, zs - 0.12, vhash(k, 77) < 0.5, 'win'); for (let i = 0; i <= 9; i++) vc.box(-11 + i * 0.111, (sw.c + sw.d) / 2, zs + 0.03, 0.02, sw.d - sw.c, 0.03, C.cream);
      vc.box(-10.5, y0 + 1.4, zs + 0.02, 2.9, 0.12, 0.06, C.cream, {}); }
    { // lift shaft expressed as a deeper indigo tower with slit windows; plain wall behind it with PVC downpipes
      vc.box(10.5, (y0 + y1) / 2, ZF - 0.12, 3, y1 - y0, 0.25, C.body2); vc.box(10.5, (y0 + y1) / 2, (ZF - 0.25 + ZB) / 2, 3, y1 - y0, ZF - 0.25 - ZB, C.body2);
      const lw = { a: 10.35, b: 10.65, c: y0 + 0.4, d: y0 + 1.9 }; winGlass(lw, ZF - 0.1, vhash(k, 91) < 0.7, 'win');
      vc.rod([11.7, y0 - 0.2, ZF + 0.08], [11.7, y1, ZF + 0.08], 0.04, C.pvc); vc.box(11.7, y0 + 1.0, ZF + 0.08, 0.1, 0.08, 0.1, C.pvc);
    }
    vc.box(10.5, y0 - 0.1, ZF + 0.012, 3, 0.16, 0.014, C.indigo);   // core base band
  }
  // lift tower rising above the roof as machine room; stair headroom
  const Ry = FL(8);
  vc.box(10.5, (FL(7) + Ry) / 2 + 0.1, ZF - 0.12, 3, Ry - FL(7), 0.25, C.body2, { skip: ['-y'] });
  // roof slab
  vc.box(0, Ry - SLAB / 2, (ZF + ZB) / 2, 24, SLAB, ZF - ZB, C.slab, { skip: ['+z', '+y'] }); vc.box(0, Ry - SLAB / 2 - 0.02, ZF + 0.06, 24.12, SLAB + 0.12, 0.12, C.cream);
  vc.quad([X0, Ry, ZB], [X0, Ry, ZF], [X1, Ry, ZF], [X1, Ry, ZB], '#b8b2c8');   // terrace (china mosaic / waterproofing)
  // parapet 1.0 m high with coping and a coloured band (front, sides, back)
  const ph = 1.05, pt = 0.18; const par = (cx, cz, sx, sz) => { vc.box(cx, Ry + ph / 2, cz, sx, ph, sz, C.cream, { }); vc.box(cx, Ry + ph + 0.04, cz, sx + 0.06, 0.08, sz + 0.06, C.indigo); };
  par(0, ZF - pt / 2, 24, pt); par(0, ZB + pt / 2, 24, pt); par(X0 + pt / 2, (ZF + ZB) / 2, pt, ZF - ZB); par(X1 - pt / 2, (ZF + ZB) / 2, pt, ZF - ZB);
  vc.box(0, Ry + 0.85, ZF + 0.02, 24, 0.22, 0.04, C.indigo); vc.box(0, Ry + 0.5, ZF + 0.02, 24, 0.05, 0.04, C.creamD);
  // headroom (mumty) for stairs + lift machine room
  vc.box(-9, Ry + 1.3, -2, 5, 2.6, 7, '#b6b3d8'); vc.box(-9, Ry + 2.62, -2, 5.3, 0.16, 7.3, C.cream); vc.box(-6.45, Ry + 1.05, -1, 0.06, 2.1, 1.0, C.door, { }); vc.box(10.5, Ry + 1.2, ZF - 1.4, 3, 2.4, 3.5, C.body2); vc.box(10.5, Ry + 2.46, ZF - 1.4, 3.3, 0.14, 3.8, C.cream);
  glass.quad([8.99, Ry + 0.8, ZF - 0.9], [8.99, Ry + 0.8, ZF - 2.1], [8.99, Ry + 1.9, ZF - 2.1], [8.99, Ry + 1.9, ZF - 0.9], new T.Color(0.03, 0.03, 0.12));
  // Sintex tanks (black, 1000 L): ribbed cylinders with domed lids, on a plinth, with pipework
  const tank = (x, z, big) => { const R1 = big ? 0.78 : 0.62, H = big ? 1.5 : 1.15; vc.box(x, Ry + 0.15, z, R1 * 2.3, 0.3, R1 * 2.3, '#9a96b0'); vc.cyl(x, Ry + 0.3, z, R1, R1 * 0.96, H, '#26253a', { seg: 24 }); for (let i = 1; i < 5; i++) vc.cyl(x, Ry + 0.3 + i * H / 5, z, R1 * 1.02, R1 * 1.02, 0.07, '#3a3956', { seg: 24, cap: false }); vc.sphere(x, Ry + 0.3 + H, z, R1 * 0.96, 0.22, R1 * 0.96, '#34334e', { w: 20, h: 6, th1: Math.PI / 2 }); vc.cyl(x, Ry + 0.3 + H + 0.18, z, 0.2, 0.18, 0.1, '#4a4968', { seg: 12 }); vc.rod([x + R1 * 0.7, Ry + 0.5, z], [x + R1 * 0.7 + 0.6, Ry + 0.5, z], 0.03, C.pvc); };
  tank(-1.5, -9.5, true); tank(1.2, -9.7, true); tank(4.6, -9.8, false);
  // solar water heater: tank + sloped evacuated-tube array on a frame
  const solar = (x, z) => {     for (let i = 0; i < 14; i++) { const tx = -0.8 + i * 0.123; vc.rod([x + tx, Ry + 0.15, z + 0.6], [x + tx, Ry + 0.77, z - 0.5], 0.028, '#6aa9d8', { seg: 6 }); }
    const g = (xx, yy, zz) => [x + xx, Ry + 0.15 + yy, z + zz]; const ro = (a, b, rr, c) => vc.rod(a, b, rr, c, { seg: 6 });
    ro(g(-0.82, 0.62, -0.5), g(0.82, 0.62, -0.5), 0.17, '#e3e1ee'); vc.sphere(x - 0.82, Ry + 0.77, z - 0.5, 0.17, 0.17, 0.17, '#e3e1ee', { w: 10, h: 6 }); vc.sphere(x + 0.82, Ry + 0.77, z - 0.5, 0.17, 0.17, 0.17, '#e3e1ee', { w: 10, h: 6 });
    [-0.8, 0.8].forEach((xx) => { ro(g(xx, 0, 0.6), g(xx, 0.62, -0.5), 0.02, C.rail); ro(g(xx, -0.1, 0.6), g(xx, 0, 0.6), 0.02, C.rail); }); ro(g(-0.8, 0.0, 0.6), g(0.8, 0.0, 0.6), 0.02, C.rail); };
  solar(-2.5, -4); solar(2.5, -4.2);
  // satellite dishes on the parapet (DTH): offset parabola on a short pole
  const dish = (x, z, ang) => { vc.rod([x, Ry + ph, z], [x, Ry + ph + 0.75, z], 0.025, '#6b6a85'); vc.push(x, Ry + ph + 0.8, z, ang, 1, -0.45); vc.sphere(0, 0, 0, 0.32, 0.3, 0.07, '#e8e6f2', { w: 18, h: 6, th1: Math.PI / 2 }); vc.pop(); vc.rod([x, Ry + ph + 0.8, z], [x + Math.sin(ang) * 0.34, Ry + ph + 0.98, z + Math.cos(ang) * 0.34], 0.012, '#444' ); };
  dish(-6, ZF - 0.25, 0.4); dish(-3.2, ZF - 0.25, -0.2); dish(6.8, ZF - 0.25, 0.2); dish(2.1, ZB + 0.3, 3.4);
  // TV antenna, lightning rod, clothes line with saris
  vc.rod([8.4, Ry, -6], [8.4, Ry + 3.2, -6], 0.02, '#777090'); for (let i = 0; i < 5; i++) vc.rod([8.4, Ry + 2.1 + i * 0.25, -6], [8.4 + 0.5, Ry + 2.1 + i * 0.25, -6], 0.008, '#777090');
  vc.rod([-11, Ry, -11], [-11, Ry + 3.5, -11], 0.02, '#bbb'); laundry(3, 8, Ry + 1.9, -7);
  vc.rod([3, Ry, -7], [3, Ry + 1.9, -7], 0.02, '#777090'); vc.rod([8, Ry, -7], [8, Ry + 1.9, -7], 0.02, '#777090');
  // pots on the terrace
  for (let i = 0; i < 6; i++) plant(-1 + i * 0.5, Ry + 0.0, -2.6 + (i % 2) * 0.5, 1.3);
  // side + rear flanks: stair-core slit windows (every half-landing), bedroom windows with grilles, bathroom ventilators, PVC downpipes, stains
  [[-1, X0 - 0.03], [1, X1 + 0.03]].forEach(([sd, x]) => {
    const quad = (zl, zh, yb, yt, c) => { const lo = [x, yb, zl], hi = [x, yb, zh], hi2 = [x, yt, zh], lo2 = [x, yt, zl]; (c.lit ? lit : glass).quadC(...(sd < 0 ? [lo, hi, hi2, lo2] : [hi, lo, lo2, hi2]), c.cols); };
    for (let k = 1; k <= 7; k++) {
      const y0 = FL(k);
      for (let h = 0; h < 2; h++) { const yb = y0 + 0.55 + h * 1.55, isLit = vhash(k * 2 + h, 140 + sd) < 0.55; const c = isLit ? { lit: 1, cols: [new T.Color(0.55, 0.62, 0.8), new T.Color(0.55, 0.62, 0.8), new T.Color(0.85, 0.85, 0.7), new T.Color(0.85, 0.85, 0.7)] } : { cols: [new T.Color(0.04, 0.04, 0.14), new T.Color(0.04, 0.04, 0.14), new T.Color(0.2, 0.23, 0.5), new T.Color(0.2, 0.23, 0.5)] };
        quad(-1.5 - 0.22, -1.5 + 0.22, yb, yb + 1.05, c); vc.box(x + sd * 0.01, yb + 0.525, -1.5, 0.05, 1.12, 0.52, C.cream); vc.box(x + sd * 0.02, yb + 0.525, -1.5, 0.06, 1.02, 0.44, C.dark); for (let i = 0; i < 5; i++) vc.box(x + sd * 0.04, yb + 0.525, -1.5 - 0.2 + i * 0.1, 0.02, 1.0, 0.02, C.cream); }
      for (const zc of [-6.5, -10.0]) { const isLit = vhash(k * 3 + (zc < -8 ? 1 : 0), 150 + sd) < 0.35; const c = isLit ? { lit: 1, cols: [new T.Color(0.95, 0.62, 0.34), new T.Color(0.95, 0.62, 0.34), new T.Color(1.05, 0.85, 0.5), new T.Color(1.05, 0.85, 0.5)] } : { cols: [new T.Color(0.04, 0.04, 0.14), new T.Color(0.04, 0.04, 0.14), new T.Color(0.2, 0.23, 0.5), new T.Color(0.2, 0.23, 0.5)] };
        quad(zc - 0.55, zc + 0.55, y0 + 1.0, y0 + 2.15, c); for (const [dz, dy, sz, sy] of [[0, 0.53, 1.2, 0.06], [0, 0.0, 1.28, 0.06], [-0.58, 0.55, 0.05, 1.18], [0.58, 0.55, 0.05, 1.18], [0, 0.55, 0.04, 1.14]]) vc.box(x + sd * 0.02, y0 + 1.0 + dy, zc + dz, 0.08, sy, sz, C.frame);
        for (let i = 0; i <= 6; i++) vc.box(x + sd * 0.05, y0 + 1.58, zc - 0.5 + i * 0.1667, 0.014, 1.1, 0.014, C.rail); vc.box(x + sd * 0.05, y0 + 1.58, zc, 0.02, 0.02, 1.1, C.rail); }
      quad(-4.6, -4.2, y0 + 2.2, y0 + 2.7, { cols: [new T.Color(0.04, 0.04, 0.14), new T.Color(0.04, 0.04, 0.14), new T.Color(0.2, 0.23, 0.5), new T.Color(0.2, 0.23, 0.5)] });   // bathroom ventilator
      vc.box(x + sd * 0.03, y0 - SLAB / 2, (ZF + ZB) / 2, 0.08, SLAB + 0.1, ZF - ZB, C.cream);   // slab edge band
    }
    for (const zp of [-4.0, -8.3]) { vc.rod([x + sd * 0.07, GROUND, zp], [x + sd * 0.07, FL(8), zp], 0.045, zp < -5 ? C.pipe : C.pvc); for (let k = 1; k <= 7; k++) vc.box(x + sd * 0.07, FL(k) + 1.2, zp, 0.1, 0.07, 0.1, '#8d8aa8'); }
    for (let i = 0; i < 14; i++) { const zc = -12 + vhash(i, 160 + sd) * 14, y = FL(1) + vhash(i, 170 + sd) * 20, L = 1 + vhash(i, 180) * 3, w = 0.12 + vhash(i, 190) * 0.25; const sa = new T.Color('#8f8aa8'), sb = new T.Color('#b3b1d9'); (sd < 0 ? [[zc - w, zc + w]] : [[zc + w, zc - w]]).forEach(([zl, zh]) => vc.quadC([x + sd * 0.012, y - L, zl], [x + sd * 0.012, y - L, zh], [x + sd * 0.012, y, zh], [x + sd * 0.012, y, zl], [sa, sa, sb, sb])); }   // rain stains
  });
  return { Ry };
}


// A furnished stand-in for her room, matching the person level's layout (desk + chair + laptop at x~0.3, cabinet left, shelf right, window with curtains, rug, fan, lamp).
// Shown only when the person level is not drawing the real room (z > ~1.55, or the level is viewed alone).
function buildCellStandIn(g, gl, y0, y1) {
  const Z0 = -2.38, X0c = -2.5, X1c = 2.5, F = y0 + 0.005; const Cc = (a, b, c) => new T.Color(a, b, c);
  g.rod([-1.5, y0 + 2.7, Z0 + 0.28], [1.5, y0 + 2.7, Z0 + 0.28], 0.014, '#ffd166');
  [[-1.3, -0.55], [0.55, 1.3]].forEach(([a, b]) => { const n = 7; for (let i = 0; i < n; i++) { const xa = a + (b - a) * i / n, xb = a + (b - a) * (i + 1) / n; const hi = new T.Color(i % 2 ? '#4a478f' : '#5b58a8'), lo = new T.Color(i % 2 ? '#2a2860' : '#35327a'); g.quadC([xa, y0 + 0.2, Z0 + 0.3 + (i % 2) * 0.03], [xb, y0 + 0.2, Z0 + 0.3 + ((i + 1) % 2) * 0.03], [xb, y0 + 2.72, Z0 + 0.3 + ((i + 1) % 2) * 0.03], [xa, y0 + 2.72, Z0 + 0.3 + (i % 2) * 0.03], [lo, lo, hi, hi]); } });
  // rug, cabinet (left), bookshelf (right)
  g.quad([-1.0, F + 0.004, -1.0], [-1.0, F + 0.004, 1.1], [1.5, F + 0.004, 1.1], [1.5, F + 0.004, -1.0], '#8a4a6a'); g.quad([-0.85, F + 0.006, -0.85], [-0.85, F + 0.006, 0.95], [1.35, F + 0.006, 0.95], [1.35, F + 0.006, -0.85], '#c98f6a');
  g.box(-1.78, y0 + 0.5, Z0 + 0.35, 1.0, 1.0, 0.5, '#8a86c4'); g.box(-1.78, y0 + 1.02, Z0 + 0.35, 1.06, 0.04, 0.54, '#6d69a8'); for (let i = 0; i < 2; i++) g.box(-1.78 - 0.25 + i * 0.5, y0 + 0.5, Z0 + 0.61, 0.46, 0.9, 0.02, '#a29ed8'); g.box(-1.78, y0 + 1.25, Z0 + 0.3, 0.3, 0.35, 0.02, '#e8b56a');
  g.box(1.78, y0 + 0.95, Z0 + 0.33, 0.9, 1.9, 0.34, '#7d5a44'); [0.35, 0.8, 1.25, 1.7].forEach((yy, i) => { g.box(1.78, y0 + yy, Z0 + 0.5, 0.82, 0.32, 0.02, '#2a2150'); for (let b = 0; b < 8; b++) g.box(1.78 - 0.34 + b * 0.098, y0 + yy + 0.02, Z0 + 0.5, 0.075, 0.26 - (b % 3) * 0.03, 0.2, ['#c9453d', '#3b5fb5', '#e3c07a', '#2d8a58', '#8d8aa8', '#d98a6a'][(b + i) % 6]); });
  // desk, chair, laptop (screen glow), lamp, seated silhouette
  const DT = y0 + 0.72; g.box(0.54, DT, 0, 0.7, 0.05, 1.5, '#a86f48'); [[0.25, -0.68], [0.25, 0.68], [0.83, -0.68], [0.83, 0.68]].forEach(([x, z]) => g.box(x, DT / 2 + y0 / 2 - 0.02, z, 0.05, DT - y0 - 0.04, 0.05, '#5a3a2a'));
  g.box(-0.14, y0 + 0.45, 0, 0.42, 0.05, 0.42, '#8a86c4'); g.box(-0.34, y0 + 0.78, 0, 0.04, 0.6, 0.4, '#8a86c4'); [[-0.3, -0.18], [-0.3, 0.18], [0.02, -0.18], [0.02, 0.18]].forEach(([x, z]) => g.box(x, y0 + 0.22, z, 0.035, 0.44, 0.035, '#5a5690'));
  g.box(0.40, DT + 0.03, 0, 0.23, 0.02, 0.33, '#c9c6d8'); gl.quadC([0.285, DT + 0.045, -0.2], [0.285, DT + 0.045, 0.2], [0.34, DT + 0.34, 0.2], [0.34, DT + 0.34, -0.2], [Cc(1.9, 1.85, 1.7), Cc(1.9, 1.85, 1.7), Cc(1.4, 1.5, 1.8), Cc(1.4, 1.5, 1.8)]); g.box(0.345, DT + 0.19, 0.0, 0.012, 0.31, 0.46, '#2a2a46', {});
  g.rod([0.82, DT + 0.02, -0.44], [0.78, DT + 0.34, -0.4], 0.012, '#2a2a46'); g.rod([0.78, DT + 0.34, -0.4], [0.62, DT + 0.44, -0.3], 0.012, '#2a2a46'); g.sphere(0.6, DT + 0.43, -0.28, 0.07, 0.045, 0.07, '#f2c13a', { w: 10, h: 6 }); gl.sphere(0.6, DT + 0.39, -0.28, 0.045, 0.03, 0.045, Cc(2.6, 2.1, 1.1), { w: 8, h: 5 });
  g.sphere(0.9, DT + 0.07, 0.35, 0.05, 0.07, 0.05, '#e8e6f2', { w: 8, h: 6 });
  { const hip = [-0.12, y0 + 0.5, 0.0], sh = [-0.02, y0 + 1.04, 0.0]; g.rod(hip, sh, 0.15, '#c4663f', { seg: 10, r1: 0.12 }); g.sphere(0.02, y0 + 1.27, 0, 0.11, 0.125, 0.1, '#c98b6a', { w: 12, h: 9 }); g.sphere(-0.02, y0 + 1.31, 0, 0.125, 0.13, 0.12, '#1e1a38', { w: 12, h: 9 }); g.rod([-0.03, y0 + 1.0, 0.16], [0.3, DT + 0.1, 0.12], 0.04, '#c98b6a'); g.rod([-0.03, y0 + 1.0, -0.16], [0.3, DT + 0.1, -0.12], 0.04, '#c98b6a'); g.rod([-0.12, y0 + 0.5, 0.1], [0.35, y0 + 0.42, 0.1], 0.07, '#3a3a7a'); g.rod([-0.12, y0 + 0.5, -0.1], [0.35, y0 + 0.42, -0.1], 0.07, '#3a3a7a'); g.rod([0.35, y0 + 0.42, 0.1], [0.38, y0 + 0.02, 0.1], 0.06, '#3a3a7a'); g.rod([0.35, y0 + 0.42, -0.1], [0.38, y0 + 0.02, -0.1], 0.06, '#3a3a7a'); }
  // ceiling fan + tube light, door on the left wall, framed pictures, potted plant, floor lamp
  g.rod([0.3, y1, 0], [0.3, y1 - 0.25, 0], 0.015, '#2a2540'); for (let a = 0; a < 3; a++) g.box(0.3, y1 - 0.27, 0, 1.0, 0.012, 0.11, '#e8e0cc', { ry: a * 2.094 + 0.5 });
  g.box(X0c + 0.04, y0 + 1.1, 0.5, 0.05, 2.2, 0.95, '#b07a50'); g.box(X0c + 0.07, y0 + 1.1, 0.5, 0.02, 2.2, 0.04, '#f1e6d4'); g.sphere(X0c + 0.1, y0 + 1.0, 0.2, 0.03, 0.03, 0.03, '#ffd166', { w: 6, h: 5 });
  [[-1.0, 1.5, 0.5, 0.4], [1.05, 1.6, 0.4, 0.5], [-0.3, 2.35, 0.9, 0.0]].forEach(([x, y, w, h]) => { if (h > 0) { g.box(x, y0 + y, Z0 + 0.03, w + 0.06, h + 0.06, 0.03, '#ffd9a0'); g.quadC([x - w / 2, y0 + y - h / 2, Z0 + 0.05], [x + w / 2, y0 + y - h / 2, Z0 + 0.05], [x + w / 2, y0 + y + h / 2, Z0 + 0.05], [x - w / 2, y0 + y + h / 2, Z0 + 0.05], [new T.Color('#5b63e0'), new T.Color('#5b63e0'), new T.Color('#ff9f1c'), new T.Color('#ff9f1c')]); } });
  g.cyl(-2.15, y0, 1.4, 0.16, 0.2, 0.34, '#c4663f', { seg: 10 }); for (let i = 0; i < 6; i++) g.sphere(-2.15 + Math.cos(i) * 0.18, y0 + 0.62 + (i % 3) * 0.14, 1.4 + Math.sin(i) * 0.18, 0.2, 0.16, 0.2, ['#3fa06a', '#5fbf6a', '#2f8a5c'][i % 3], { w: 8, h: 6, topColor: '#7fd68a', botColor: '#256a4c' });
  g.rod([2.15, y0, 1.7], [2.15, y0 + 1.5, 1.7], 0.02, '#2a2a46'); g.cyl(2.15, y0, 1.7, 0.16, 0.16, 0.03, '#2a2a46', { seg: 10 }); g.cyl(2.15, y0 + 1.4, 1.7, 0.2, 0.12, 0.28, '#f2d9a6', { seg: 10, cap: false }); gl.sphere(2.15, y0 + 1.45, 1.7, 0.1, 0.12, 0.1, Cc(2.0, 1.5, 0.8), { w: 8, h: 6 });
}

// stilt level: columns, slab soffit, floor, parking markings, lift lobby, stair door, letterboxes, light
export function buildStilt(R, B) {
  const { vc, lit, prop } = B; const y0 = GROUND, y1 = FL(1) - SLAB;
  vc.quad([X0 - 1.5, y0 + 0.02, ZB], [X0 - 1.5, y0 + 0.02, 13.6], [X1 + 1.5, y0 + 0.02, 13.6], [X1 + 1.5, y0 + 0.02, ZB], '#a9a3bb');   // concrete floor (inside the compound)
  // columns (0.45 x 0.45 square RCC) on a 6 m grid + soffit slab
  const xs = [-11.77, -6, 0, 6, 11.77], zs = [2.27, -4.5, -12.27];
  xs.forEach((x) => zs.forEach((z) => { vc.box(x, (y0 + y1) / 2, z, 0.46, y1 - y0, 0.46, C.cream); vc.box(x, y0 + 0.08, z, 0.55, 0.16, 0.55, C.concD); vc.box(x, y1 - 0.15, z, 0.6, 0.3, 0.6, C.cream); }));
  vc.box(0, y1 + SLAB / 2 - 0.1, (ZF + ZB) / 2, 24, SLAB, ZF - ZB, '#cfc6b4', { skip: ['+y'] });
  // beams along the front
  vc.box(0, y1 - 0.15, ZF - 0.12, 24, 0.35, 0.28, C.creamD);
  // back wall and side walls (stilt level partly enclosed: meter room + stair/lift lobby on the right)
  vc.box(0, (y0 + y1) / 2, ZB + 0.12, 24, y1 - y0, 0.25, '#b8b0a0'); vc.box(X0 + 0.12, (y0 + y1) / 2, (ZF + ZB) / 2, 0.25, y1 - y0, ZF - ZB, '#b8b0a0'); vc.box(X1 - 0.12, (y0 + y1) / 2, (ZF + ZB) / 2, 0.25, y1 - y0, ZF - ZB, '#b8b0a0');
  // lift lobby (right): wall with lit lobby opening, lift door, stair door
  vc.box(10.5, (y0 + y1) / 2, ZF - 2.6, 3, y1 - y0, 0.25, '#c9bda2'); lit.quad([9.2, y0 + 0.1, ZF - 2.45], [11.8, y0 + 0.1, ZF - 2.45], [11.8, y0 + 2.3, ZF - 2.45], [9.2, y0 + 2.3, ZF - 2.45], new T.Color(1.4, 1.25, 0.9));
  vc.box(10.5, y0 + 1.1, ZF - 2.45, 1.1, 2.2, 0.08, '#8a8aa6'); vc.box(10.5, y0 + 1.1, ZF - 2.4, 0.02, 2.2, 0.06, '#444');
  // letterboxes + notice board on the back wall
  for (let i = 0; i < 12; i++) vc.box(-9 + (i % 6) * 0.3, y0 + 1.2 + Math.floor(i / 6) * 0.3, ZB + 0.28, 0.26, 0.26, 0.05, i % 2 ? '#2d6aa8' : '#d9a441');
  // ceiling tube lights (bright strips)
  for (let i = 0; i < 6; i++) { const x = -10 + i * 4, z = -2 + (i % 2) * -5; lit.box(x, y1 - 0.02, z, 1.2, 0.04, 0.08, new T.Color(2.0, 2.0, 2.2)); }
  // parking bay stripes
  for (let i = 0; i < 12; i++) vc.box(-11 + i * 2, y0 + 0.025, -8.5, 0.08, 0.002, 4, '#e9d36b');
  // EB meter box, water pump, bins
  vc.box(-11.3, y0 + 1.2, ZB + 0.45, 0.9, 1.0, 0.3, '#4d6b4f'); vc.cyl(-10, y0, -11, 0.3, 0.3, 0.7, '#3a5a9c', { seg: 12 }); vc.cyl(-10.6, y0, -10.4, 0.25, 0.25, 0.9, '#2d8a58', { seg: 12 });
}
