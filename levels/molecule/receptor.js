// the GluA2 AMPA receptor: molecular surface (3KG2 body + 1FTJ glutamate-bound LBDs, two levels of detail) and a cartoon (helix tubes, strand arrows, coil)
// of the same atoms inside it. D2-lobe closure and pore splay are done in the vertex shader for both.
import { loadGz, parseMesh, meshGeometry } from './util.js';
import { secMat } from '../synapse/section.js';

// drop disconnected surface islands (tiny closed blobs that float away from the protein) together with their own section caps
function cleanIslands(m, maxTris) {
  const { f, v, nv } = m, nt = f.length / 3, par = new Int32Array(nv); for (let i = 0; i < nv; i++) par[i] = i;
  const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let i = 0; i < nt; i++) { const a = find(f[i * 3]), b = find(f[i * 3 + 1]), c = find(f[i * 3 + 2]); par[b] = a; par[find(c)] = find(a); }
  const info = new Map(); for (let i = 0; i < nt; i++) { const r = find(f[i * 3]); let q = info.get(r); if (!q) { q = { n: 0, b: [1e9, 1e9, 1e9, -1e9, -1e9, -1e9] }; info.set(r, q); } q.n++;
    for (let k = 0; k < 3; k++) { const j = f[i * 3 + k] * 3; for (let d = 0; d < 3; d++) { q.b[d] = Math.min(q.b[d], v[j + d]); q.b[3 + d] = Math.max(q.b[3 + d], v[j + d]); } } }
  const drop = new Set(), boxes = []; info.forEach((q, r) => { if (q.n < maxTris && q.b[5] - q.b[2] > 0.05) { drop.add(r); boxes.push(q.b); } });
  info.forEach((q, r) => { if (q.n < maxTris && q.b[5] - q.b[2] <= 0.05 && boxes.some((b) => q.b[0] >= b[0] - 0.12 && q.b[3] <= b[3] + 0.12 && q.b[1] >= b[1] - 0.12 && q.b[4] <= b[4] + 0.12)) drop.add(r); });
  const keep = []; for (let i = 0; i < nt; i++) if (!drop.has(find(f[i * 3]))) keep.push(f[i * 3], f[i * 3 + 1], f[i * 3 + 2]); m.f = new Uint32Array(keep); return m;
}
export async function buildReceptor(ctx, pocket) {
  const { T, kit } = ctx;
  const [loB, hiB, caB] = await Promise.all([loadGz(ctx, 'molecule/receptor_lo.bin.gz'), loadGz(ctx, 'molecule/receptor_hi.bin.gz'), loadGz(ctx, 'molecule/receptor_cartoon.bin.gz')]);
  const U = { uHP: { value: [0, 1, 2, 3].map(() => new T.Vector4()) }, uHA: { value: [0, 1, 2, 3].map(() => new T.Vector4(0, 1, 0, 0)) }, uOpen: { value: 0 }, uSplay: { value: 0 }, uAmp: { value: 0.2 }, uGate: { value: new T.Vector3(pocket.meta.axis[0], -3.5, pocket.meta.axis[1]) } };
  'ABCD'.split('').forEach((k, i) => { const h = pocket.hinge[k]; U.uHP.value[i].set(h.pivot[0], h.pivot[1], h.pivot[2], 0); U.uHA.value[i].set(h.axis[0], h.axis[1], h.axis[2], h.theta); });
  const patch = (mat, sh) => { {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute float dw; attribute float tmw; attribute float chn;
uniform vec4 uHP[4]; uniform vec4 uHA[4]; uniform float uOpen; uniform float uSplay; uniform float uAmp; uniform vec3 uGate;
vec3 rodr(vec3 p, vec3 piv, vec3 ax, float a){ vec3 v = p - piv; float c = cos(a), s = sin(a); return piv + v * c + cross(ax, v) * s + ax * dot(ax, v) * (1.0 - c); }`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
{ int ci = int(chn + 0.5); float a = uOpen * uHA[ci].w * dw; objectNormal = rodr(objectNormal, vec3(0.0), uHA[ci].xyz, a); }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{ int ci = int(chn + 0.5); float a = uOpen * uHA[ci].w * dw; transformed = rodr(transformed, uHP[ci].xyz, uHA[ci].xyz, a);
  vec2 d = transformed.xz - uGate.xz; float rho = length(d); float wy = exp(-pow((transformed.y - uGate.y) / 0.95, 2.0)); float wr = 1.0 - smoothstep(0.9, 1.7, rho);
  if (tmw > 0.0 && rho > 1e-4) transformed.xz += (d / rho) * uSplay * uAmp * wy * wr * tmw; }`);
  } return mat; };
  // the SAME material as the synapse level's receptors (flat unlit cel look, cut interior shown through back faces); nm-authored, so unit = 1e-9
  const protMat = () => { const m = secMat({ vc: true, xtoon: 1, color: 0xffffff, innerK: 0.8, noise: 0.45, unlitK: 0.95, depthK: 0.35, depth: 4.5e-9, bshade: 0.85, noBand: true, unlit: true, unit: 1e-9 });
    const pre = m.onBeforeCompile, key = m.customProgramCacheKey; m.onBeforeCompile = (sh) => { pre(sh); patch({ onBeforeCompile: null }, sh); }; m.customProgramCacheKey = () => key() + 'mol'; return m; };
  const mat = protMat(), matC = protMat(), matG = mat;
  // synapse-level palette for GluA2 (assets/synapse build_proteins.py PAL_A): subunits A/C vs B/D, domains ATD / LBD / TMD
  const hexb = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  const PAL = [0xf4a63f, 0xe8643a, 0xa03a35, 0xffe3b0, 0xf6cbb8, 0xe05a7a, 0x8a2f56, 0xffe9ee].map(hexb);
  const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // drop the section caps (flat faces on z = 0): like every receptor in the synapse level the cut interior is shown by the back faces of the closed surface behind the plane
  const stripCaps = (m) => { const { f, v, n } = m, keep = []; for (let i = 0; i < f.length; i += 3) { let cap = true; for (let k = 0; k < 3; k++) { const j = f[i + k]; if (!(Math.abs(v[j * 3 + 2]) < 2e-3 && n[j * 3 + 2] > 0.97)) { cap = false; break; } } if (!cap) keep.push(f[i], f[i + 1], f[i + 2]); } m.f = new Uint32Array(keep); return m; };
  const regrade = (m, g) => { const nv = m.nv, col = new Float32Array(nv * 3), lum = new Float32Array(nv), key = new Uint8Array(nv), W3 = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) { const y = m.v[i * 3 + 1], tmw = m.tm[i] / 255, par = (m.ch[i] === 1 || m.ch[i] === 3) ? 4 : 0;
      const wT = Math.max(sst(0.12, 0.5, tmw), sst(-2.2, -3.3, y)), wA = (1 - wT) * sst(2.6, 3.9, y), wL = 1 - wT - wA; W3[i * 3] = wA; W3[i * 3 + 1] = wL; W3[i * 3 + 2] = wT;
      const c = PAL; const k = par; let r = 0, gg = 0, b = 0; [[wA, 0], [wL, 1], [wT, 2]].forEach(([w, d]) => { r += w * c[k + d][0]; gg += w * c[k + d][1]; b += w * c[k + d][2]; });
      col[i * 3] = r / 255; col[i * 3 + 1] = gg / 255; col[i * 3 + 2] = b / 255; lum[i] = (m.c[i * 3] + m.c[i * 3 + 1] + m.c[i * 3 + 2]) / 3; key[i] = par + (wT > 0.5 ? 2 : (wA > 0.5 ? 0 : 1)); }
    // baked ambient occlusion proxy: luminance of the old colour relative to its group's 92nd percentile (the synapse meshes carry 30 % AO in the vertex colour)
    const p92 = {}; const groups = {}; for (let i = 0; i < nv; i++) (groups[key[i]] = groups[key[i]] || []).push(lum[i]); for (const k in groups) { const a = groups[k].sort((x, y) => x - y); p92[k] = a[Math.floor(a.length * 0.92)] || 1; }
    for (let i = 0; i < nv; i++) { const f = 0.84 + 0.16 * sst(0.0, 1.0, Math.min(1, lum[i] / p92[key[i]])); const w = m.dw[i] / 255; const lift = 0.20 * Math.min(1, w * 1.4);   // lobe D2 (the half that swings shut) a touch lighter, same hue family
      for (let q = 0; q < 3; q++) col[i * 3 + q] = Math.min(1, col[i * 3 + q] * f * (1 - lift) + lift * 0.98); }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); return g; };
  const loM = stripCaps(cleanIslands(parseMesh(loB), 2200)), loG = regrade(loM, meshGeometry(T, loM));
  const hiM = stripCaps(cleanIslands(parseMesh(hiB), 1500)), hiG = regrade(hiM, meshGeometry(T, hiM)); const loT = new T.Mesh(new T.BufferGeometry(), mat); loT.visible = false;
  const lo = new T.Mesh(loG, mat), hi = new T.Mesh(hiG, mat);
  const cg = meshGeometry(T, parseMesh(caB)); cg.boundingSphere = new T.Sphere(new T.Vector3(0, 0, -1.5), 20); const cartoon = new T.Mesh(cg, matC);
  hi.geometry.boundingSphere = new T.Sphere(new T.Vector3(0, 0, -1.5), 4.5); lo.frustumCulled = false; hi.frustumCulled = false; cartoon.frustumCulled = false;
  hi.renderOrder = lo.renderOrder = 5; cartoon.renderOrder = 1;
  const setOpacity = (op) => { const tr = op < 0.995; mat.transparent = tr; mat.opacity = op; mat.depthWrite = !tr; matG.opacity = 1; };
  return { lo, loT, hi, cartoon, U, setOpacity };
}
