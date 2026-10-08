/* EARTH frame: origin = Earth's centre, +y = up at Bangalore (12.9716 N, 77.5946 E), -z = north, +x = east.
 * lat/lon -> unit vector, with the pole axis, the equatorial basis (E1 toward lon of Bangalore on the equator, E2 = east). */
export const R_E = 6371000;
// origin = her block in the city level's frame (city_meta ll0), so Earth's lat/lon registers with the city map to the metre
export const BLR = { lat: 12.975194, lon: 77.642540 };
const ROT = -0.04014257279586958;   // the city frame is rotated by this much from true east/north (city_meta.rot): rotate the Earth basis the same way
const D = Math.PI / 180, phi = BLR.lat * D;
const ry = (v) => [v[0] * Math.cos(ROT) + v[2] * Math.sin(ROT), v[1], -v[0] * Math.sin(ROT) + v[2] * Math.cos(ROT)];
export const POLE = ry([0, Math.sin(phi), -Math.cos(phi)]), E1 = ry([0, Math.cos(phi), Math.sin(phi)]), E2 = ry([1, 0, 0]);
export const LON0 = BLR.lon * D;
export function dir(latDeg, lonDeg, out = [0, 0, 0]) {
  const la = latDeg * D, dl = (lonDeg - BLR.lon) * D, c = Math.cos(la), x = c * Math.cos(dl), y = c * Math.sin(dl), z = Math.sin(la);
  out[0] = x * E1[0] + y * E2[0] + z * POLE[0]; out[1] = x * E1[1] + y * E2[1] + z * POLE[1]; out[2] = x * E1[2] + y * E2[2] + z * POLE[2]; return out;
}
export const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// places
export const PLACES = {
  bangalore: [12.975194, 77.642540], majestic: [12.9767, 77.5713], singapore: [1.3521, 103.8198], himalaya: [28.2, 84.5], deccan: [17.0, 77.2], ghats: [13.4, 75.0], indianocean: [-6.0, 80.5],
};
