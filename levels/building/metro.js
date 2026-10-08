/* Namma Metro Purple Line viaduct (Reach 1) and the Indiranagar station, from the real OpenStreetMap ways (bridge=viaduct, railway=subway, designation "Namma Metro - Reach 1"; platform ways
 * 473574176/7). Deck ~10.5 m above the road, U-girder with parapets, single hammerhead piers every 30 m carrying both tracks (as built), station canopy over the real platform ways,
 * and a moving three-car train. Everything is local-frame metres (x east, z south); polylines come from assets/building/metro.json (derived by the same projection as neighbourhood.json). */
import { GB } from './gb.js';
import { T } from './deps.js';
import { GROUND } from './hero.js';

export const DECK = GROUND + 10.6;
const RMAX = 1150;

// resample a polyline at step metres -> [{x,z,tx,tz,s}]
function resample(p, step) {
  const out = []; let acc = 0, next = 0;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue; const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L;
    while (next <= acc + L) { const t = next - acc; out.push({ x: a[0] + tx * t, z: a[1] + tz * t, tx, tz, s: next }); next += step; }
    acc += L;
  }
  return out;
}
const near = (pt) => Math.hypot(pt.x, pt.z) < RMAX;

export function buildMetro(data, vc, lit) {
  const via = data.filter((w) => w.k === 'viaduct'); const plat = data.filter((w) => w.k === 'platform');
  const GIRD = '#bdb8d4', GIRD2 = '#8f89a8', PURP = '#7a54b8', PIER = '#c9c4da';
  // girders + parapets + rails along every track
  via.forEach((w) => {
    resample(w.p, 3).filter(near).forEach((q) => {
      const ry = -Math.atan2(q.tz, q.tx);
      vc.box(q.x, DECK - 0.55, q.z, 3.2, 1.1, 4.3, GIRD, { ry }); vc.box(q.x, DECK - 1.15, q.z, 3.2, 0.2, 2.6, GIRD2, { ry });   // U-girder + soffit
      const nx = -q.tz, nz = q.tx;   // left normal
      for (const sd of [-1, 1]) { vc.box(q.x + nx * sd * 2.05, DECK + 0.35, q.z + nz * sd * 2.05, 3.2, 0.9, 0.2, GIRD, { ry }); vc.box(q.x + nx * sd * 2.18, DECK - 0.15, q.z + nz * sd * 2.18, 3.2, 0.14, 0.06, PURP, { ry }); }
      for (const sd of [-1, 1]) vc.box(q.x + nx * sd * 0.72, DECK + 0.1, q.z + nz * sd * 0.72, 3.2, 0.14, 0.14, '#4a4968', { ry });   // running rails
    });
  });
  // piers: one per 30 m on the reference track, shifted to the middle between the two tracks
  const pairs = [[via.find((w) => w.id === 133876199), via.find((w) => w.id === 607901262)], [via.find((w) => w.id === 549187829), via.find((w) => w.id === 607901263)]];
  pairs.forEach(([A, B]) => {
    if (!A || !B) return;
    resample(A.p, 30).filter(near).forEach((q) => {
      let best = null, bd = 1e9; B.p.forEach((b) => { const d = Math.hypot(b[0] - q.x, b[1] - q.z); if (d < bd) { bd = d; best = b; } });
      const mx = bd < 14 && best ? (q.x + best[0]) / 2 : q.x, mz = bd < 14 && best ? (q.z + best[1]) / 2 : q.z; const ry = -Math.atan2(q.tz, q.tx), H = DECK - 1.2 - GROUND;
      vc.box(mx, GROUND + H / 2 - 0.2, mz, 1.8, H - 1.6, 2.6, PIER, { ry: ry + Math.PI / 2 });                 // column (long axis across the track)
      vc.box(mx, DECK - 1.65, mz, 2.2, 0.9, 9.4, PIER, { ry: ry + Math.PI / 2 }); vc.box(mx, DECK - 2.35, mz, 2.0, 0.7, 5.0, PIER, { ry: ry + Math.PI / 2 }); // hammerhead cap
      vc.box(mx, GROUND + 0.25, mz, 3.2, 0.5, 3.8, '#9a95ad', { ry: ry + Math.PI / 2 });                       // footing
    });
  });
  // Indiranagar station: canopy over the real platform ways, purple fascia, lit concourse band, columns
  if (plat.length) {
    let x0 = 1e9, x1 = -1e9, zc = 0; plat.forEach((p) => p.p.forEach((q) => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); zc += q[1]; })); zc /= plat.reduce((s, p) => s + p.p.length, 0); const len = x1 - x0 + 20, cx = (x0 + x1) / 2;
    const Y = DECK + 6.2;
    vc.box(cx, Y, zc, len, 0.4, 20, '#d9d4e6'); vc.box(cx, Y + 0.45, zc, len, 0.5, 20.4, PURP);                      // roof deck + purple coping
    vc.box(cx, Y - 0.55, zc - 10.1, len, 1.1, 0.25, PURP); vc.box(cx, Y - 0.55, zc + 10.1, len, 1.1, 0.25, PURP);     // fascias
    for (let x = x0 - 6; x <= x1 + 6; x += 12) for (const dz of [-9.4, 9.4]) vc.box(x, (Y + DECK) / 2, zc + dz, 0.7, Y - DECK, 0.7, '#cfc9e0');
    plat.forEach((p) => { const zz = (p.p[0][1] + p.p[1][1]) / 2; vc.box(cx, DECK - 0.2, zz + (zz < zc ? -3.0 : 3.0), x1 - x0, 0.3, 4.2, '#aaa4c0'); });
    lit.quadC([x0, Y - 0.9, zc - 9.95], [x1, Y - 0.9, zc - 9.95], [x1, Y - 0.2, zc - 9.95], [x0, Y - 0.2, zc - 9.95], [new T.Color(0.7, 0.5, 0.95), new T.Color(0.7, 0.5, 0.95), new T.Color(1.0, 0.8, 1.0), new T.Color(1.0, 0.8, 1.0)]);
    for (let x = x0; x < x1; x += 8) lit.box(x + 2, Y - 0.38, zc, 3.5, 0.08, 0.3, new T.Color(1.5, 1.4, 1.2));
    // access stairs / concourse blocks at street level
    vc.box(cx, GROUND + 3.6, zc, len * 0.4, 7.2, 14, '#c9c2dc'); vc.box(cx, GROUND + 7.3, zc, len * 0.4 + 0.6, 0.3, 14.6, PURP);
  }
  return { zc: plat.length ? plat[0].p[0][1] : -360 };
}

// a three-car metro train along the real track: shared geometry built facing +x, length 66 m
export function buildTrain(T_, vc, lit) {
  const L = 66, W = 3.2, H = 3.4, Y = 0;
  vc.box(0, Y + H / 2, 0, L, H, W, '#e6e3f2'); vc.box(0, Y + 0.65, 0, L + 0.02, 0.5, W + 0.04, '#7a54b8'); vc.box(0, Y + H - 0.05, 0, L, 0.1, W - 0.2, '#b9b4cf');
  for (let i = 0; i < 3; i++) vc.box(-L / 2 + (i + 1) * L / 3, Y + H / 2, 0, 0.25, H - 0.2, W + 0.05, '#4a4968');   // car gaps
  for (const sd of [-1, 1]) for (let i = 0; i < 18; i++) { const x = -L / 2 + 2 + i * 3.5, z = sd * (W / 2 + 0.03), A = [x, Y + 1.3, z], B = [x + 2.3, Y + 1.3, z], C = [x + 2.3, Y + 2.6, z], D = [x, Y + 2.6, z]; const lo = new T.Color(0.8, 0.85, 1.0), hi = new T.Color(1.0, 0.98, 0.9); if (sd > 0) lit.quadC(A, B, C, D, [lo, lo, hi, hi]); else lit.quadC(B, A, D, C, [lo, lo, hi, hi]); }
  lit.box(L / 2 + 0.03, Y + 1.0, 0, 0.05, 0.3, 1.4, new T.Color(2.4, 2.3, 1.9));
  return L;
}
