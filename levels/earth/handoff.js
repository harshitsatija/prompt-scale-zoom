/* Shared geometry for the earth <-> solar hand-off (both levels import this, so they cannot drift apart).
 * The Earth is drawn by the EARTH level at every zoom (it is one body); the solar level only supplies the Sun, the other planets and the orbits,
 * placed so that the Sun lies in the direction the Earth is lit from, the ecliptic has the real 23.4 deg obliquity against the Earth's axis,
 * and the Moon's orbit lies in the ecliptic. */
import { POLE, dir, norm, cross, dot } from './frame.js';

export const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const D2R = Math.PI / 180, EPS = 23.44 * D2R;

// Sun for 6 Oct, 23:02 IST = 17:32 UTC: sub-solar point lat -5.6, lon -83 (India in night, West Africa and the Atlantic lit)
export const SUN = norm(dir(-5.6, -83));

// ecliptic north in the Earth frame, from the pole, the sun direction and the obliquity (solves s.n = 0, n.p = cos eps)
export const NECL = (() => {
  const sd = dot(SUN, POLE), cd = Math.sqrt(1 - sd * sd);
  const e = norm([SUN[0] - sd * POLE[0], SUN[1] - sd * POLE[1], SUN[2] - sd * POLE[2]]), f = cross(POLE, e);
  const sinL = sd / Math.sin(EPS), lam = Math.PI - Math.asin(Math.max(-1, Math.min(1, sinL))); // ecliptic longitude of the Sun (autumn: 180..270 deg)
  const ra = Math.atan2(Math.sin(lam) * Math.cos(EPS), Math.cos(lam));
  const Y = [Math.sin(ra) * e[0] + Math.cos(ra) * f[0], Math.sin(ra) * e[1] + Math.cos(ra) * f[1], Math.sin(ra) * e[2] + Math.cos(ra) * f[2]];
  return norm([-Math.sin(EPS) * Y[0] + Math.cos(EPS) * POLE[0], -Math.sin(EPS) * Y[1] + Math.cos(EPS) * POLE[1], -Math.sin(EPS) * Y[2] + Math.cos(EPS) * POLE[2]]);
})();

// Moon: 6 Oct 2026 is 4 days before new moon: a waning crescent 50 deg west of the Sun, in the ecliptic plane
export const MOONDIR = (() => {
  const n = NECL, s = SUN, th = -50 * D2R, ns = cross(n, s);
  return norm([s[0] * Math.cos(th) + ns[0] * Math.sin(th), s[1] * Math.cos(th) + ns[1] * Math.sin(th), s[2] * Math.cos(th) + ns[2] * Math.sin(th)]);
})();

// ---- drawn sizes (radii in px), single source of truth
const TAB = (t, z) => { if (z <= t[0][0]) return t[0][1]; for (let i = 1; i < t.length; i++) if (z <= t[i][0]) { const f = (z - t[i - 1][0]) / (t[i][0] - t[i - 1][0]); return t[i - 1][1] + (t[i][1] - t[i - 1][1]) * f; } return t[t.length - 1][1]; };
export const SUNPX = [[10.9, 34], [11.76, 32], [12.3, 27], [12.9, 22], [13.5, 16], [14.1, 10]];   // gentle: the Sun enters the frame already small and then only shrinks by the field widening
export const sunPx = (z) => TAB(SUNPX, z) * (1 - 0.4 * ss(14.0, 14.4, z));
const EARTHPX = [[10.2, 8], [10.8, 8], [11.4, 8], [11.76, 8], [12.3, 7], [12.9, 5.6], [13.5, 4], [14.1, 2.8]];
const JUPITER_OVER_EARTH = Math.pow(6.9911e7 / 6.371e6, 0.5);
// Earth radius in px: the earth level's own enlargement down to z 10.2, then the solar planet scale (so Earth and the planets share one factor)
export const earthPx = (z) => z <= 10.2 ? 21 - 13 * ss(9.2, 10.2, z) : (() => { const t = TAB(EARTHPX, z); return Math.min(t, 0.72 * sunPx(z) / JUPITER_OVER_EARTH); })();

// the Earth's own ground textures, published by earth/planet.js so the city level can draw the city as this very surface (same textures, same shading function)
export const EARTH_LINK = { tex: null };
