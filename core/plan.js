/* PLAN: the single source of truth for scale ranges, shared frames and the camera path.
 * Owned by the integrator (not by level authors). Level authors read it; they do not edit it.
 *
 * FRAMES (metres, double precision in JS, floating origin in the engine)
 *   HEAD frame : origin = centre of the typist's head. +x forward (she faces +x), +y up, +z toward the viewer's right-hand side
 *                (the camera's default view looks along -z at the sagittal section, so +z is toward the camera).
 *                Everything from a molecule up to the neighbourhood lives in this frame.
 *   EARTH frame: origin = Earth's centre. +y points to Bangalore (12.97N, 77.59E); -z is north; +x is east. Earth levels and
 *                every level beyond use this frame (EARTHC is where Earth's centre sits in the HEAD frame: straight down by R_E).
 */
import { T, ss, lerp, V3 } from './kit.js';
import { SUN as SUN_FIXED } from '../levels/earth/handoff.js';
import { Q as Q0, Hn as Hn0, Sy as Sy0, Mol as Mol0, GROUND, R_E, AU, EARTHC } from './geom.js';
export { GROUND, R_E, AU, EARTHC };

// scale ranges, z = log10(field width in metres). Levels are only updated/rendered inside [zMin, zMax].
export const LEVELS = [
  { id: 'molecule', zMin: -9.3, zMax: -7.3,  brief: 'a glutamate molecule docked in a receptor ligand-binding pocket, in water, beside a membrane' },
  { id: 'synapse',  zMin: -8.3, zMax: -4.6,  brief: 'a glutamatergic synapse: bouton, vesicles, cleft, postsynaptic density, spine' },
  { id: 'neuron',   zMin: -6.2, zMax: -3.4,  brief: 'one real pyramidal neuron (soma, dendrites, spines, axon, myelin) in neuropil' },
  { id: 'cortex',   zMin: -4.7, zMax: -2.3,  brief: 'a slab of cerebral cortex: layers, hundreds of neurons, glia, capillaries, white matter' },
  { id: 'brain',    zMin: -3.4, zMax: 0.9,   brief: 'a real human brain (cortex with true gyri, deep structures) inside the skull, cut along the sagittal plane' },
  { id: 'person',   zMin: -0.7, zMax: 1.6,   brief: 'a seated person typing on a laptop at a desk, in her room; the head is cut open to reveal the brain' },
  { id: 'building', zMin: 1.0,  zMax: 3.4,   brief: 'her apartment building (cutaway apartment visible), the street, neighbours, in Bangalore' },
  { id: 'city',     zMin: 1.7,  zMax: 5.8,   brief: 'real Bangalore: her neighbourhood and the whole city, from real map data' },
  { id: 'earth',    zMin: 4.8,  zMax: 10.4,  brief: 'planet Earth with real terrain/coast/night lights, the Moon, satellites, the route of the prompt' },
  { id: 'solar',    zMin: 10.2, zMax: 14.3,  brief: 'the solar system with real orbits, planets with real textures, the Sun' },
  { id: 'stars',    zMin: 13.6, zMax: 21.6,  brief: 'the Sun\'s stellar neighbourhood from a real star catalogue, nebulae, the Oort cloud' },
  { id: 'galaxy',   zMin: 20.2, zMax: 24.4,  brief: 'the Milky Way and the Local Group (Andromeda etc.) with real positions' },
  { id: 'web',      zMin: 23.4, zMax: 28.0,  brief: 'the cosmic web from real survey data, ending at the edge of the observable universe' },
];
export const STAGES = [
  { z: -8.9, title: 'A molecule of glutamate', line: 'One neurotransmitter, a nanometre long, docking in a receptor.' },
  { z: -7.0, title: 'The synapse', line: 'A 20-nanometre gap. Each keystroke sends a puff of glutamate across it.' },
  { z: -5.0, title: 'One neuron', line: 'A cell body 20 µm wide, wired to thousands of others.' },
  { z: -3.4, title: 'The cortex', line: 'Neurons on neurons. Every key she presses sets off a wave through them.' },
  { z: -1.6, title: 'The brain', line: 'Reading the screen, choosing words, moving fingers. Some 86 billion neurons.' },
  { z: 0.15, title: 'The prompt', line: '“Why is the sky blue?” One question, one keystroke at a time.' },
  { z: 0.95, title: 'Her room', line: 'A fourth-floor flat in Bangalore, 11 pm.' },
  { z: 1.9, title: 'The apartment block', line: 'Eight storeys of lit windows. One of them is hers.' },
  { z: 3.2, title: 'The neighbourhood', line: 'A ripple of wi-fi leaves her window with the prompt.' },
  { z: 4.6, title: 'Bangalore', line: 'Ring roads, lakes, millions of lit windows.' },
  { z: 6.0, title: 'The Indian peninsula', line: 'Two coastlines, and the prompt already on its way out.' },
  { z: 7.2, title: 'Earth', line: 'A world of 12,742 km, spangled with cities at night.' },
  { z: 9.2, title: 'The Moon', line: 'Satellites in their high ring, and the Moon 384,400 km out.' },
  { z: 11.9, title: 'The solar system', line: 'Eight planets, one star, all circling slowly while she types.' },
  { z: 15.4, title: 'The Oort cloud', line: 'A shell of dormant comets, a light-year from the Sun.' },
  { z: 17.5, title: 'Our stellar neighbourhood', line: 'The nearest star is 4.2 light-years away.' },
  { z: 21.6, title: 'The Milky Way', line: '100,000 light-years across. She is in one arm of one galaxy.' },
  { z: 23.0, title: 'The Local Group', line: 'Our galaxy and its neighbours, Andromeda 2.5 million light-years off.' },
  { z: 25.0, title: 'The cosmic web', line: 'Galaxies strung on filaments, around voids.' },
  { z: 27.3, title: 'The observable universe', line: 'Everything we can see, 93 billion light-years across. And a question typed in one small room.' }];

export function anchors() { // {Q,Hn,Sy,Mol,nq} as [x,y,z] arrays in HEAD-frame metres; follows the brain level's real locus once it has built (call at BUILD time, after brain)
  const loc = shared.locus; if (!loc) return { Q: [Q0[0], Q0[1], 0], Hn: [Hn0[0], Hn0[1], 0], Sy: [Sy0[0], Sy0[1], 0], Mol: [Mol0[0], Mol0[1], 0], nq: [Math.cos(1.05), Math.sin(1.05), 0] };
  const n = loc.normal.clone().normalize(), Q = loc.pos.clone(), Hn = Q.clone().addScaledVector(n, -1.2e-3), Sy = Hn.clone().add(V3(35e-6, -5e-6 + 2.36e-6, 0)), Mol = Sy.clone().add(V3(0, -3.5e-9, 0)); const a = (v) => [v.x, v.y, v.z]; return { Q: a(Q), Hn: a(Hn), Sy: a(Sy), Mol: a(Mol), nq: a(n) }; }
// shared state written by level builders (the brain writes `locus`) and read by dependants
export const shared = { locus: null, path: null };
export function inwardPath() { // molecule -> synapse -> neuron -> cortex locus -> head
  const A = anchors(); return [V3(...A.Mol), V3(...A.Sy), V3(...A.Hn), V3(...A.Q), V3(0, 0, 0)];
}
export const sunPos = () => V3(EARTHC[0] + AU * SUN_FIXED[0], EARTHC[1] + AU * SUN_FIXED[1], EARTHC[2] + AU * SUN_FIXED[2]);
let P3 = null, CUM = null;
function prep() { P3 = inwardPath(); CUM = [0]; for (let i = 1; i < P3.length; i++) CUM.push(CUM[i - 1] + P3[i].distanceTo(P3[i - 1])); }
export function FOCUS(z, t = 0) {
  if (!P3) prep();
  const W = Math.pow(10, z), s = Math.min((0.25 + 1.5 * ss(-2.4, -1.3, z)) * W * ss(-8.7, -7.5, z), CUM[CUM.length - 1]); let i = 1; while (i < CUM.length - 1 && s > CUM[i]) i++;
  const f = (s - CUM[i - 1]) / (CUM[i] - CUM[i - 1]); const F = P3[i - 1].clone().lerp(P3[i], f);
  F.lerp(V3(0.3, -0.3, 0), ss(-0.1, 0.5, z)); F.lerp(V3(0, 0.2, 0), ss(0.7, 1.6, z)); F.lerp(V3(0, -3.5, 0), ss(1.5, 2.4, z)); F.lerp(V3(0, GROUND + 1, 0), ss(2.4, 3.8, z));
  F.lerp(V3(EARTHC[0], EARTHC[1], EARTHC[2]), ss(6.4, 8.8, z)); F.lerp(sunPos(t), ss(10.6, 12.8, z)); return F;
}
export const pitchAt = (z) => 0.45 * ss(0.3, 2.8, z) + 0.75 * ss(2.4, 4.4, z) + 0.15 * ss(4.0, 5.4, z) - 0.30 * ss(5.4, 8.5, z) - 0.20 * ss(8.5, 12, z) + 0.10 * ss(13, 20, z) - 0.40 * ss(22, 27, z);
export const yawAt = (z, t) => 0.34 * (1 - ss(1.6, 2.6, z)) + Math.sin(t * 0.21) * 0.05 * (1 - ss(1.6, 2.6, z));
