/* Load the compact NeuroMorpho/Allen morphology (see assets/neuron/SOURCES.md), place it in the HEAD frame, and
 * locally straighten the synapse dendrite so that it matches the synapse level (shaft along x, r = 0.7 um, centre at S.y - 2.36 um). Units: um. */
import { ssm, norm, cross, dot, sub } from './geo.js';

export function loadModel(buf, meta, A) {
  const dv = new DataView(buf), N = dv.getUint32(0, true); let o = 4;
  const f32 = () => { const a = new Float32Array(buf.slice(o, o + 4 * N)); o += 4 * N; return a; };
  const X = f32(), Y = f32(), Z = f32(), Rr = f32(), geo = f32(); const par = new Int32Array(buf.slice(o, o + 4 * N)); o += 4 * N; const type = new Uint8Array(buf.slice(o, o + N));
  const P = new Array(N); for (let i = 0; i < N; i++) P[i] = [X[i], Y[i], Z[i]];
  const R = Array.from(Rr);
  // ---- frame: anchors (metres) -> um
  const nq = norm(A.nq), D = [(A.Sy[0] - A.Hn[0]) * 1e6, (A.Sy[1] - A.Hn[1]) * 1e6 - 2.36, (A.Sy[2] - A.Hn[2]) * 1e6];
  const dl = Math.hypot(...D), Dn = D.map((v) => v / dl);
  const k0 = meta.synNode, p0 = P[k0], s = dl / Math.hypot(...p0);
  for (let i = 0; i < N; i++) { P[i] = [P[i][0] * s, P[i][1] * s, P[i][2] * s]; }
  for (let i = 0; i < N; i++) if (type[i] !== 1) R[i] *= (type[i] === 2 ? 1 : 1); // calibre already physical (Rall) in the asset
  for (let i = 0; i < N; i++) geo[i] *= s;
  const tri = (u, v) => { const e1 = norm(u); let d = dot(v, e1); const e2 = norm([v[0] - d * e1[0], v[1] - d * e1[1], v[2] - d * e1[2]]); return [e1, e2, cross(e1, e2)]; };
  const B1 = tri(norm(P[k0]), meta.axis), B2 = tri(Dn, nq);
  // Rm = B2^T B1  (local -> head), row-major 3x3
  const Rm = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let v = 0; for (let k = 0; k < 3; k++) v += B2[k][i] * B1[k][j]; Rm[i][j] = v; }
  const apply = (v) => [Rm[0][0] * v[0] + Rm[0][1] * v[1] + Rm[0][2] * v[2], Rm[1][0] * v[0] + Rm[1][1] * v[1] + Rm[1][2] * v[2], Rm[2][0] * v[0] + Rm[2][1] * v[1] + Rm[2][2] * v[2]];
  const applyT = (v) => [Rm[0][0] * v[0] + Rm[1][0] * v[1] + Rm[2][0] * v[2], Rm[0][1] * v[0] + Rm[1][1] * v[1] + Rm[2][1] * v[2], Rm[0][2] * v[0] + Rm[1][2] * v[1] + Rm[2][2] * v[2]];
  const children = Array.from({ length: N }, () => []); for (let i = 0; i < N; i++) if (par[i] >= 0) children[par[i]].push(i);
  // ---- local straightening of the synapse dendrite
  const xloc = applyT([1, 0, 0]);                       // head +x expressed in neuron-local coordinates
  const Pk = P[k0].slice(); const chain = new Map();     // node -> signed arc length from k0 (+ = away from soma)
  chain.set(k0, 0);
  { let k = k0, a = 0; while (par[k] >= 0 && type[par[k]] === 3 && a > -16) { const l = Math.hypot(...sub(P[k], P[par[k]])); a -= l; k = par[k]; chain.set(k, a); } }
  const roots = [...Array(N).keys()].filter((i) => par[i] < 0); const order = []; { const st = roots.slice(); while (st.length) { const k = st.pop(); order.push(k); for (const c of children[k]) st.push(c); } }
  const acc = new Float64Array(N); for (let i = order.length - 1; i >= 0; i--) { const k = order[i]; if (par[k] >= 0) acc[par[k]] += acc[k] + Math.hypot(...sub(P[k], P[par[k]])); }
  { let k = k0, a = 0; while (a < 16) { const ch = children[k].filter((c) => type[c] === 3).sort((p, q) => acc[q] - acc[p])[0]; if (ch === undefined) break; a += Math.hypot(...sub(P[ch], P[k])); k = ch; chain.set(k, a); } }
  const disp = new Array(N).fill(null), rad0 = 0.7;
  const w = (s_) => 1 - ssm(4, 12, Math.abs(s_));
  chain.forEach((a, k) => { const tgt = [Pk[0] + xloc[0] * a, Pk[1] + xloc[1] * a, Pk[2] + xloc[2] * a]; const ww = w(a); disp[k] = [(tgt[0] - P[k][0]) * ww, (tgt[1] - P[k][1]) * ww, (tgt[2] - P[k][2]) * ww]; R[k] = R[k] + (rad0 - R[k]) * ww; });
  for (const k of order) { if (!disp[k]) disp[k] = par[k] >= 0 && disp[par[k]] ? disp[par[k]] : [0, 0, 0]; }
  for (let i = 0; i < N; i++) if (disp[i]) { P[i] = [P[i][0] + disp[i][0], P[i][1] + disp[i][1], P[i][2] + disp[i][2]]; }
  // ---- signal path from the synapse dendrite to the soma
  const toSoma = []; { let k = k0; while (k >= 0 && type[k] === 3) { toSoma.push(k); k = par[k]; } }
  const uDend = new Float32Array(N).fill(-1e4); { let a = 0; for (let i = 0; i < toSoma.length; i++) { const k = toSoma[i]; if (i > 0) a += Math.hypot(...sub(P[k], P[toSoma[i - 1]])); uDend[k] = a; } }
  chain.forEach((a, k) => { if (a > 1e-4 && uDend[k] < -1e3) uDend[k] = -a; });   // distal side of the synapse: the glow spreads both ways from the spine
  const Ld = (() => { const k = toSoma[toSoma.length - 1]; return uDend[k] + Math.hypot(...P[k]); })();
  return { N, P, R, geo, par, type, children, Rm, apply, applyT, k0, s, Ld, uDend, toSoma, meta, D, nq, chain };
}
