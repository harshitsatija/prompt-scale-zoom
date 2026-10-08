/* Milky Way spiral model: Reid et al. 2019, Table 2 (same numbers as gen_common.py). Scene frame: x right, z toward the camera, GC at z = -R0. */
export const R0 = 8.15;
export const ARMS = {
  'Norma-Outer': { bk: 18, Rk: 4.46, pout: 9.3, pin: 19.5 },
  'Scutum-Centaurus': { bk: 23, Rk: 4.91, pout: 14.1, pin: 12.1 },
  'Sagittarius-Carina': { bk: 24, Rk: 6.04, pout: 17.1, pin: 4.0 },
  'Perseus': { bk: 40, Rk: 8.87, pout: 10.3, pin: 8.7 },
  'Local (Orion Spur)': { bk: 9, Rk: 8.26, pout: 11.4, pin: 11.4 },
};
const rad = (d) => d * Math.PI / 180;
/** point on the arm at galactocentric azimuth beta (deg, clockwise from the Sun-GC line); returns [x, z] in the scene frame */
export function armPoint(a, beta) {
  const tp = Math.tan(rad(beta < a.bk ? a.pout : a.pin));
  const R = a.Rk * Math.exp(-rad(beta - a.bk) * tp), th = rad(-90 - beta);
  const X = R * Math.cos(th), Y = R * Math.sin(th);
  return [X, -(Y + R0)];
}
/** outer-disc warp (kpc): north up at l ~ 90 (-x side); 1.5 kpc at R = 15 kpc. Identical to gen_mw.warp_y */
export function warpY(X, Y) {
  const R = Math.hypot(X, Y), s = Math.pow(Math.min(Math.max((R - 8.0) / 7.0, 0), 1.4), 2);
  return -1.5 * s * (X / Math.max(R, 1e-3));
}
