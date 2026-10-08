/* Shared geometry of the world: the brain's outline, the cortex locus we fly into, the hero neuron, the synapse, the molecule.
 * Metres. Origin = centre of the typist's head. +x = facing forward, +y = up, +z = toward the viewer. */
import { hash } from './timeline.js';
export const TAU = Math.PI * 2;
export const BC = [0.0, 0.012];
const ellR = (th) => { const a = 0.088, b = 0.062, c = Math.cos(th), s = Math.sin(th); return a * b / Math.sqrt(b * b * c * c + a * a * s * s); };
export const brainR = (th) => {
  const dip = (k, p, amp) => amp * Math.pow(1 - Math.abs(Math.sin(th * k + p)), 7);
  const bump = 0.0016 * (Math.sin(th * 5 + 0.7) + 0.5 * Math.sin(th * 8 + 2.1)) - dip(9, 1.3, 0.006) - dip(15, 0.4, 0.0042) - dip(24, 2.0, 0.0026) - dip(37, 0.9, 0.0016);
  const flat = 1 - 0.1 * Math.exp(-Math.pow((th + 1.57) / 0.7, 2)), lobes = 1 + 0.09 * Math.exp(-Math.pow((th + 0.75) / 0.32, 2)) - 0.05 * Math.exp(-Math.pow((th + 1.75) / 0.22, 2)) + 0.04 * Math.exp(-Math.pow((th - 0.1) / 0.4, 2));
  return (ellR(th) + bump) * flat * lobes; };
export { ellR };
export const thq = 1.05, nq = [Math.cos(thq), Math.sin(thq)], GREY = 0.0028;
export const Q = [BC[0] + brainR(thq) * nq[0], BC[1] + brainR(thq) * nq[1]];
export const Hn = [Q[0] - nq[0] * 0.0012, Q[1] - nq[1] * 0.0012];
export const Y0 = Hn[1] - 5e-6;
export const Sy = [Hn[0] + 35e-6, Y0 + 2.36e-6];
export const Mol = [Sy[0] + (hash(0, 1, 1) - 0.5) * 14e-9, Sy[1] - 3.5e-9];
export const depthAt = (x, y) => { const dx = x - BC[0], dy = y - BC[1]; return brainR(Math.atan2(dy, dx)) - Math.hypot(dx, dy); };
// world layout, relative to the head
export const FLOOR = -1.2, GROUND = -10.4, R_E = 6.371e6, AU = 1.496e11, LY = 9.461e15;
export const EARTHC = [0, GROUND - R_E, 0];
