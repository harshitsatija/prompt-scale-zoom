/* Keplerian machinery for the solar level. Ecliptic J2000 (x,y,z) in AU -> scene/level coordinates (x, z, y) in metres
 * (the ecliptic plane is the level's x-z plane, as plan.js assumes). */
export const AU = 1.495978707e11, D2R = Math.PI / 180, DPS = 0.05 / (2 * Math.PI) * 365.256; // days of simulated time per second of film
export const toLocal = (e, out = [0, 0, 0]) => { out[0] = e[0] * AU; out[1] = e[2] * AU; out[2] = e[1] * AU; return out; };
export function solveE(M, e) { M = ((M + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; let E = e < 0.8 ? M : Math.PI * Math.sign(M || 1); for (let i = 0; i < 40; i++) { const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); E -= d; if (Math.abs(d) < 1e-12) break; } return E; }
// orbital plane -> ecliptic rotation, elements in radians
export function rot(i, om, w) { const co = Math.cos(om), so = Math.sin(om), cw = Math.cos(w), sw = Math.sin(w), ci = Math.cos(i), si = Math.sin(i);
  return [cw * co - sw * so * ci, -sw * co - cw * so * ci, cw * so + sw * co * ci, -sw * so + cw * co * ci, sw * si, cw * si]; }
export function posFromE(a, e, R, E) { const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E); return [R[0] * xp + R[1] * yp, R[2] * xp + R[3] * yp, R[4] * xp + R[5] * yp]; }
// JPL "approximate positions" table 1 (valid 1800-2050): el = [a, e, I, L, long.peri, long.node], rate per Julian century
export function planetState(p, jd, forceCircle) {
  const T = (jd - 2451545) / 36525, v = p.el.map((x, k) => x + p.rate[k] * T); let [a, e, I, L, vp, Om] = v; if (forceCircle) { e = 0; I = 0; a = 1; }
  const M = (L - vp) * D2R, w = (vp - Om) * D2R, R = rot(I * D2R, Om * D2R, w), E = solveE(M, e); return { a, e, M, E, R, pos: posFromE(a, e, R, E), u: (((M / (2 * Math.PI)) % 1) + 1) % 1, I, Om, w };
}
export function smallState(s, jd) { const n = 0.9856076686 / Math.pow(s.a, 1.5) * D2R, M = s.ma * D2R + n * (jd - s.epoch), R = rot(s.i * D2R, s.om * D2R, s.w * D2R), E = solveE(M, s.e); return { a: s.a, e: s.e, M, E, R, pos: posFromE(s.a, s.e, R, E), u: (((M / (2 * Math.PI)) % 1) + 1) % 1 }; }
// sample the closed orbit; returns {pts: [[x,y,z]...] (ecliptic AU), us: mean-anomaly fraction of each sample}
export function orbitSamples(st, n = 360) { const pts = [], us = []; for (let k = 0; k <= n; k++) { const E = k / n * 2 * Math.PI - Math.PI; pts.push(posFromE(st.a, st.e, st.R, E)); us.push((E - st.e * Math.sin(E)) / (2 * Math.PI) + 0.5 - 0.5 + 0); } return { pts, us: us.map((u) => ((u % 1) + 1) % 1) }; }
// IAU pole (RA, Dec in degrees, ICRS) -> unit vector in ecliptic J2000 -> level coordinates
export function poleDir(ra, dec) { const a = ra * D2R, d = dec * D2R, e = 23.4392911 * D2R; const x = Math.cos(d) * Math.cos(a), y = Math.cos(d) * Math.sin(a), z = Math.sin(d);
  const ye = y * Math.cos(e) + z * Math.sin(e), ze = -y * Math.sin(e) + z * Math.cos(e); return [x, ze, ye]; } // level coords (x, y=ecl z, z=ecl y)
