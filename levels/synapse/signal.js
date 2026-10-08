/* Keystroke-driven synaptic events: a static schedule (which docked vesicles fuse for which keystroke), the vesicle
 * fusion profile (docked sphere -> pore -> omega -> collapse into the plasma membrane) and its section ribbon. Units: um. */
import { KT, REPLY_T, hash } from '../../core/timeline.js';
export const NSLOT = 10, BUSY = 1.15;
const rngf = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
// static plan: every keystroke releases 2-4 docked vesicles; every character of the reply "reads" with a single weak event
export const PLAN = []; // {t, strength, slot, delay}
{
  const busy = new Array(NSLOT).fill(-9); const order = [2, 1, 3, 0, 4, 6, 5, 7, 8, 9]; // central slots (z=0, cut by the section) first
  const add = (t, n, strength, seed) => { const r = rngf(seed); const cand = order.slice().sort(() => r() - 0.5); let got = 0;
    const cut = [0, 1, 2, 3, 4]; for (const s of cand) { if (got >= n) break; if (t - busy[s] > BUSY) { busy[s] = t; PLAN.push({ t: t + got * 0.012 + r() * 0.03, strength, slot: s }); got++; } } };
  KT.forEach((t, i) => add(t, 2 + Math.floor(hash(i, 3, 5) * 3), 1, 100 + i));
  for (let k = 0; k < 63; k++) add(REPLY_T + k / 11, 1, 0.4, 900 + k);
}
export function activeEvents(S) { const out = []; for (let e = 0; e < PLAN.length; e++) { const p = PLAN[e]; let a = S.c - p.t; if (a >= 0 && a < 3.2) out.push({ id: e, slot: p.slot, a, strength: p.strength }); } return out; }
/* fusion state for an event age: s (0 docked sphere -> 1 flat), hole open amount, lathe visible, refill 0..1 */
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function fusionState(a) {
  let s = 0; if (a > 0.04) s = 0.55 * sstep(0.04, 0.30, a) + 0.45 * sstep(0.30, 0.62, a);
  const prime = sstep(0.0, 0.04, a); const lathe = a >= 0.04 && a < 0.66; const refill = sstep(0.66, 1.1, a);
  return { s, lathe, hidden: a >= 0.04 && a < 0.7, refill, prime };
}
const R = 0.018, YM = 0.0024;
/* right half of the profile, from the axis out to rho=0.05: array of [rho,h] relative to the plasma-membrane midplane */
export function profile(s, nArc = 22) {
  const H = 2 * R * Math.pow(1 - s, 1.25) + 0.07 * R, B = 2.8 * R * Math.pow(s, 0.85) + 1e-5;
  const Rc = (B * B + H * H) / (2 * H), hc = H - Rc; let cr = (Rc - H) / Rc; cr = Math.max(-1, Math.min(1, cr)); const psiR = Math.acos(cr);
  const pts = []; for (let i = 0; i <= nArc; i++) { const psi = psiR * i / nArc; pts.push([Rc * Math.sin(psi), hc + Rc * Math.cos(psi)]); }
  // pts from apex (rho=0) to rim; rim tangent heading away from the apex
  const rim = pts[pts.length - 1]; let tx = Rc * Math.cos(psiR), ty = -Rc * Math.sin(psiR); const tl = Math.hypot(tx, ty); tx /= tl; ty /= tl;
  if (tx < 0.05) { tx = 0.05; const l2 = Math.hypot(tx, ty); tx /= l2; ty /= l2; }
  const L1 = 0.0055, ex = B + 0.012; const P0 = rim, P1 = [rim[0] + tx * L1, rim[1] + ty * L1], P2 = [ex - 0.0055, 0], P3 = [ex, 0];
  for (let i = 1; i <= 8; i++) { const t = i / 8, u = 1 - t; pts.push([u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0], u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1]]); }
  for (let i = 1; i <= 4; i++) pts.push([ex + i * 0.0085, 0]);
  return { pts, B, H };
}
export const holeRadius = (s) => (s < 0.02 ? 0 : (profile(s, 4).B + 0.0105) * (1 - sstep(0.9, 1.0, s)));
export const OM = { R, YM };
