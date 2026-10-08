/* city/data.js: loads the baked real-data assets (see assets/city/SOURCES.md) into typed arrays. Coordinates are local metres:
 * x east, z south (north = -z), origin = her block (4th Main Road, Indiranagar), rotated ~2.3 deg so her street runs along +x. */
export async function loadData(ctx) {
  const buf = (p) => ctx.fetchBuf('city/' + p), json = (p) => ctx.fetchJSON('city/' + p);
  const [meta, dem, nearPts, nearBld, boxes, grid, rw, rp, misc, tall] = await Promise.all([json('city_meta.json'), json('dem.json'), buf('near_pts.i16'), buf('near_bld.bin'), buf('mid_boxes.bin'), buf('grid.bin'), buf('roads_ways.bin'), buf('roads_pts.f32'), json('misc.json'), buf('tall.bin')]);
  const [demC, demF] = await Promise.all([buf('dem_coarse.i16'), buf('dem_fine.i16')]);
  const D = { meta, dem, misc };
  D.demC = new Int16Array(demC); D.demF = new Int16Array(demF);
  D.nearPts = new Int16Array(nearPts);
  { const dv = new DataView(nearBld), n = nearBld.byteLength / 13; D.nearBld = []; for (let i = 0; i < n; i++) { const o = i * 13; D.nearBld.push({ off: dv.getUint32(o, true), n: dv.getUint16(o + 4, true), h: dv.getUint16(o + 6, true) / 10, lv: dv.getUint8(o + 8), kind: dv.getUint8(o + 9), seed: dv.getUint8(o + 10) / 255, area: dv.getUint16(o + 11, true) }); } }
  { const dv = new DataView(boxes), n = boxes.byteLength / 11; D.boxes = []; for (let i = 0; i < n; i++) { const o = i * 11; D.boxes.push({ x: dv.getInt16(o, true), z: dv.getInt16(o + 2, true), w: dv.getUint16(o + 4, true) / 10, d: dv.getUint16(o + 6, true) / 10, h: dv.getUint16(o + 8, true) / 10, k: dv.getUint8(o + 10) }); } }
  { const dv = new DataView(tall), n = tall.byteLength / 11; D.tall = []; for (let i = 0; i < n; i++) { const o = i * 11; D.tall.push({ x: dv.getInt16(o, true), z: dv.getInt16(o + 2, true), w: dv.getUint16(o + 4, true) / 10, d: dv.getUint16(o + 6, true) / 10, h: dv.getUint16(o + 8, true) / 10, k: dv.getUint8(o + 10) }); } }
  // art direction shared by BOTH levels (it lives in the data, so they cannot disagree): the south side of her street is kept low so the view to her window stays open,
  // and the real abutting neighbours stay below her block (G+3). Same caps the building level used to apply to its private copy.
  { const P = D.nearPts, cap = (x, z, h) => { let m = h; if (z > 17 && z < 70 && Math.abs(x) < 40) m = Math.min(m, Math.abs(x) < 26 ? 6.6 : 9.8); if (Math.abs(x) < 40 && Math.abs(z) < 22) m = Math.min(m, 13); return Math.max(m, Math.min(h, 3.4)); };
    for (const b of D.nearBld) { let x = 0, z = 0; for (let i = 0; i < b.n; i++) { x += P[(b.off + i) * 2]; z += P[(b.off + i) * 2 + 1]; } b.h = cap(x / b.n / 10, z / b.n / 10, b.h); }
    for (const b of D.boxes) b.h = cap(b.x, b.z, b.h); }
  D.grid = new Uint8Array(grid);
  { const dv = new DataView(rw), n = rw.byteLength / 10; D.ways = []; for (let i = 0; i < n; i++) { const o = i * 10; D.ways.push({ off: dv.getUint32(o, true), n: dv.getUint16(o + 4, true), cls: dv.getUint8(o + 6), w: dv.getUint8(o + 7) / 4, fl: dv.getUint8(o + 8), tier: dv.getUint8(o + 9) }); } }
  D.roadPts = new Float32Array(rp);
  return D;
}
// lat/lon -> local metres (same projection as the baker)
export function makeProj(meta) {
  const [lat0, lon0] = meta.ll0, rot = meta.rot, kx = 111320 * Math.cos(12.9784 * Math.PI / 180), ky = 110574;
  const KX = kx, c = Math.cos(rot), s = Math.sin(rot);
  return (lat, lon) => { const x = (lon - lon0) * KX, z = -(lat - lat0) * ky; return [x * c + z * s, -x * s + z * c]; };
}
export const hash2 = (a, b) => { let h = (Math.imul(Math.floor(a * 7.13) | 0, 374761393) + Math.imul(Math.floor(b * 5.31) | 0, 668265263) + 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
export const rng = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
