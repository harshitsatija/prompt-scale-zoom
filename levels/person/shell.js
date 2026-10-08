/* The ONE structural shell of her flat, used by both the person level (the room) and the building level (the cutaway cell), so the two are the same space:
 * 470 mm brick party walls, 250 mm back wall with the window opening, 200 mm RCC slabs, the cream drip band and floor lip, the sectioned poche on the cut front,
 * the window reveal + white casement frame. Everything is plain vertex-coloured boxes (gb: GB from levels/building/gb.js). */
import { T } from '../building/deps.js';
export const CELL = { x: 2.53, y0: -1.2, y1: 1.8, zf: 2.5, zb: -2.43, wt: 0.47, bt: 0.25, slab: 0.2, wx0: -0.85, wx1: 0.85, wy0: -0.15, wy1: 1.35 };
export const COL = { poche: '#d2c5b4', pocheD: '#b3a392', body: '#9c9bcb', party: '#cfc6e8', partL: '#e8d3a2', slab: '#ece3d1', cream: '#f3e7cc', creamD: '#e2d2b0', reveal: '#d9d0ec', frame: '#f4eefc' };
// inner = true also draws the room-facing faces (building stand-in); false leaves them to the room's textured skins
export function cellShell(gb, { inner = false } = {}) {
  const C = CELL, y0 = C.y0, y1 = C.y1, xo = C.x + C.wt, zb = C.zb - C.bt, dz = C.zf - zb, zc = (C.zf + zb) / 2, hh = y1 - y0, yc = (y0 + y1) / 2; const sk = (...a) => a;
  // party walls (outer faces: right = flat C's balcony partition colour, left = plaster body)
  gb.box((C.x + xo) / 2, yc, zc, C.wt, hh, dz, COL.party, { colors: [COL.party, COL.body, COL.partL, COL.party, COL.party, COL.party], skip: sk('+y', '-y', ...(inner ? [] : ['-x'])) });
  gb.box(-(C.x + xo) / 2, yc, zc, C.wt, hh, dz, COL.party, { colors: [COL.party, COL.body, COL.party, COL.body, COL.party, COL.party], skip: sk('+y', '-y', ...(inner ? [] : ['+x'])) });
  // back wall in four pieces around the window opening
  const bz = C.zb - C.bt / 2, w = C.x * 2, o = { skip: sk(...(inner ? [] : ['+z'])) }; const bw = (x, y, sx, sy) => gb.box(x, y, bz, sx, sy, C.bt, COL.reveal, { ...o, colors: [COL.party, COL.body, COL.reveal, COL.reveal, COL.reveal, COL.reveal] });
  bw((-C.x + C.wx0) / 2, yc, C.wx0 + C.x, hh); bw((C.x + C.wx1) / 2, yc, C.x - C.wx1, hh); bw((C.wx0 + C.wx1) / 2, (y0 + C.wy0) / 2, C.wx1 - C.wx0, C.wy0 - y0); bw((C.wx0 + C.wx1) / 2, (C.wy1 + y1) / 2, C.wx1 - C.wx0, y1 - C.wy1);
  // slabs: floor (top face is the room's textured floor) and ceiling
  gb.box(0, y0 - C.slab / 2, zc, xo * 2, C.slab, dz, COL.slab, { skip: sk(...(inner ? [] : ['+y']), '+z') });
  gb.box(0, y1 + C.slab / 2, zc, xo * 2, C.slab, dz, COL.slab, { skip: sk(...(inner ? [] : ['-y']), '+z') });
  // cream drip band + strip on the front edge of both slabs, floor lip + nosing
  for (const y of [y0, y1 + C.slab]) { gb.box(0, y - C.slab / 2 - 0.02, C.zf + 0.06, xo * 2 + 0.1, C.slab + 0.12, 0.12, COL.cream); gb.box(0, y + 0.04, C.zf + 0.03, xo * 2, 0.08, 0.06, COL.creamD); }
  gb.box(0, y0 + 0.08, C.zf + 0.02, 5.06, 0.14, 0.05, COL.cream); gb.box(0, y0 - 0.02, C.zf + 0.07, 5.2, 0.05, 0.14, COL.creamD);
  // sectioned cut faces (RCC slab 200 mm + 230 mm brick shown as poche), 13.5 cm proud of the facade plane
  { const zz = C.zf + 0.135, ya = y0, yb = y1; const sec = COL.poche, secD = COL.pocheD;
    gb.box(0, ya - C.slab / 2, zz, 6.03, C.slab, 0.02, sec); gb.box(0, yb + C.slab / 2, zz, 6.03, C.slab, 0.02, sec);
    [-1, 1].forEach((sd) => gb.box(sd * 2.78, yc, zz, 0.47, hh, 0.02, sec));
    for (let i = 0; i < 30; i++) { const x = -3.0 + i * 0.2; gb.box(x, ya - C.slab / 2, zz + 0.012, 0.012, C.slab * 0.9, 0.004, secD); gb.box(x, yb + C.slab / 2, zz + 0.012, 0.012, C.slab * 0.9, 0.004, secD); }
    [-1, 1].forEach((sd) => { for (let i = 0; i < 12; i++) gb.box(sd * 2.78, ya + 0.12 + i * (hh - 0.2) / 11, zz + 0.012, 0.44, 0.012, 0.004, secD); gb.box(sd * 2.55, yc, zz + 0.014, 0.025, hh, 0.006, '#fff3d6'); });
    gb.box(0, yb - 0.02, zz + 0.014, 5.06, 0.025, 0.006, '#fff3d6'); gb.box(0, ya + 0.02, zz + 0.014, 5.06, 0.025, 0.006, '#8a7a6a'); }
  // window: white casement frame in the 250 mm reveal, mullion + transom, projecting sill
  { const fw = 0.06, wz = C.zb - 0.125, fr = (w2, h2, x, y, d = 0.1) => gb.box(x, y, wz, w2, h2, d, COL.frame), wy = (C.wy0 + C.wy1) / 2;
    fr(C.wx1 - C.wx0 + 2 * fw, fw, 0, C.wy1 + fw / 2); fr(C.wx1 - C.wx0 + 2 * fw, fw, 0, C.wy0 - fw / 2); fr(fw, C.wy1 - C.wy0, C.wx0 - fw / 2, wy); fr(fw, C.wy1 - C.wy0, C.wx1 + fw / 2, wy);
    fr(0.035, C.wy1 - C.wy0, 0, wy, 0.06); fr(C.wx1 - C.wx0, 0.035, 0, wy + 0.1, 0.06); gb.box(0, C.wy0 - 0.04, C.zb - 0.03, C.wx1 - C.wx0 + 0.3, 0.045, 0.2, COL.frame); }
}
