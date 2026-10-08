/* city/mid.js: real building boxes (1.8-4.6 km), skyline towers, water/park polygons, metro viaduct, rail, runways. */
import { hash2, rng } from './data.js';
import { facadeMaterial } from './facade.js';
import { buildRibbons, roadMaterial } from './roads.js';
const lin = (c) => Math.pow(c / 255, 2.2);
const WALLS = [[236, 222, 192], [222, 198, 162], [232, 184, 146], [208, 172, 124], [196, 208, 202], [182, 194, 216], [226, 212, 216], [204, 204, 208], [216, 156, 128], [242, 238, 228]];
export function liftPatch(mat, U) { const prev = mat.onBeforeCompile; mat.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r); sh.uniforms.uLiftP = U.uLift; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uLiftP;').replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += uLiftP;'); }; return mat; }
export function fadePatch(mat, TU) { const prev = mat.onBeforeCompile; mat.transparent = true; mat.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r); sh.uniforms.uR0 = TU.uR0; sh.uniforms.uR1 = TU.uR1; sh.uniforms.uOv = TU.uOv;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vFXZ;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFXZ = position.xz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vFXZ; uniform float uR0, uR1, uOv;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ndiffuseColor.a *= (1.0 - smoothstep(uR0 * 0.6, uR1 * 0.85, length(vFXZ))) * uOv; if (diffuseColor.a < 0.012) discard;'); }; return mat; }
// land mask (water + parks/forest) so sampled boxes never sit on lakes or in parks; 16 m cells over +-17 km
let _mask = null;
function landMask(M) {
  if (_mask) return _mask; const HALF = 17000, RES = 16, N = Math.ceil(2 * HALF / RES); const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(N, N) : Object.assign(document.createElement('canvas'), { width: N, height: N });
  const g = cv.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#000'; g.fillRect(0, 0, N, N); g.fillStyle = '#fff';
  const fillSet = (list) => { const p = new Path2D(); for (const pl of list) for (const r of pl.r) { for (let i = 0; i < r.length; i += 2) { const x = (r[i] + HALF) / RES, y = (r[i + 1] + HALF) / RES; if (i === 0) p.moveTo(x, y); else p.lineTo(x, y); } p.closePath(); } g.fill(p, 'evenodd'); };
  fillSet(M.water.filter((w) => w.k === 0)); fillSet(M.green.filter((q) => q.k === 0 || q.k === 1));
  const d = g.getImageData(0, 0, N, N).data; const bits = new Uint8Array(N * N); for (let i = 0; i < N * N; i++) bits[i] = d[i * 4] > 127 ? 1 : 0;
  _mask = (x, z) => { const i = Math.floor((x + HALF) / RES), j = Math.floor((z + HALF) / RES); return i >= 0 && j >= 0 && i < N && j < N && bits[j * N + i] === 1; }; return _mask; }
// shrinks instanced boxes toward their base with distance (uKH = 1 full height), so far slabs dissolve into the glow raster instead of reading as ticks
export function heightPatch(mat, U) { const prev = mat.onBeforeCompile; mat.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r); sh.uniforms.uKH = U.uKH; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uKH;').replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y = (transformed.y + 0.5) * uKH - 0.5;'); }; return mat; }
export function buildBoxes(ctx, D, terrain) {
  const { T, kit } = ctx, GROUND = ctx.geom.GROUND; const onLand = landMask(D.misc); const list = D.boxes.filter((b) => b.w * b.d > 60 && b.w < 160 && b.d < 160 && Math.hypot(b.x, b.z) < 6500 && !onLand(b.x, b.z));
  const geo = new T.BoxGeometry(1, 1, 1); const mat = facadeMaterial(kit, T, 'boxes'); const KU = { uKH: { value: 1 } }; heightPatch(mat, KU); mat.userData.KU = KU; const im = kit.inst(geo, mat, list.length, { ink: false }); const col = new T.Color();
  list.forEach((b, i) => { const rr = Math.hypot(b.x, b.z), tp = Math.min(1, Math.max(0, (rr - 5500) / 1000)); const h = Math.max(3, b.h) * (1 - 0.8 * tp * tp * (3 - 2 * tp)), by = terrain.groundY(b.x, b.z) - GROUND; kit.put(im, i, b.x, by + h / 2, b.z, b.w, h, b.d); const w = WALLS[Math.floor(hash2(b.x * 0.37, b.z * 0.53) * WALLS.length) % WALLS.length]; col.setRGB(w[0] / 255, w[1] / 255, w[2] / 255); im.setColorAt(i, col); });
  im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.position.y = GROUND; return { mesh: im, count: list.length, mat };
}
export function buildTowers(ctx, D, terrain) {
  const { T, kit } = ctx, GROUND = ctx.geom.GROUND, onLand = landMask(D.misc), out = D.tall.filter((b) => b.h >= 48 && Math.max(Math.abs(b.x), Math.abs(b.z)) >= 3200 && b.w < 300 && b.d < 300 && !onLand(b.x, b.z));
  const mat = facadeMaterial(kit, T, 'boxes'); const KU = { uKH: { value: 1 } }; heightPatch(mat, KU); mat.userData.KU = KU; const im = kit.inst(new T.BoxGeometry(1, 1, 1), mat, out.length, { ink: false }); const col = new T.Color();
  out.forEach((t, i) => { const by = terrain.groundY(t.x, t.z) - GROUND; kit.put(im, i, t.x, by + t.h / 2, t.z, Math.max(12, Math.min(t.w, 90)), t.h, Math.max(12, Math.min(t.d, 90))); const w = WALLS[Math.floor(hash2(t.x * 0.37, t.z * 0.53) * WALLS.length) % WALLS.length]; col.setRGB(w[0] / 255 * 0.85, w[1] / 255 * 0.88, w[2] / 255 * 0.95); im.setColorAt(i, col); });
  im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.position.y = GROUND; return { mesh: im, count: out.length, mat };
}
// polygons with holes -> merged flat mesh (y per polygon from fn)
function polyMesh(T, polys, yOf, mat) {
  const P = [], I = []; let vo = 0;
  for (const pl of polys) { const rings = pl.r.map((r) => { const a = []; for (let i = 0; i < r.length; i += 2) a.push(new T.Vector2(r[i], r[i + 1])); if (a.length > 1 && a[0].distanceTo(a[a.length - 1]) < 1e-6) a.pop(); return a; }); if (rings[0].length < 3) continue;
    let faces; try { faces = T.ShapeUtils.triangulateShape(rings[0], rings.slice(1)); } catch (e) { continue; } const all = rings.flat(); const y = yOf(pl, all);
    for (const v of all) P.push(v.x, y, v.y); for (const f of faces) { // up-facing winding
      const a = all[f[0]], b = all[f[1]], c = all[f[2]]; const ny = (b.y - a.y) * (c.x - a.x) - (b.x - a.x) * (c.y - a.y); if (ny > 0) I.push(vo + f[0], vo + f[1], vo + f[2]); else I.push(vo + f[0], vo + f[2], vo + f[1]); } vo += all.length; }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3)); const nn = new Float32Array(P.length); for (let i = 1; i < nn.length; i += 3) nn[i] = 1; g.setAttribute('normal', new T.BufferAttribute(nn, 3)); g.setIndex(new T.BufferAttribute(new Uint32Array(I), 1)); const m = new T.Mesh(g, mat); m.frustumCulled = false; return m; }
export function buildPolys(ctx, D, terrain, LU, TU) {
  const { T, kit } = ctx, M = D.misc, GROUND = ctx.geom.GROUND;
  const wmat = kit.toon(0x0c7d96, { glow: 0x07566a, glowK: 0.5 }); wmat.polygonOffset = true; wmat.polygonOffsetFactor = -3; wmat.polygonOffsetUnits = -3;
  const U = { uT: { value: 0 }, uPx: { value: 1 } };
  const NOISE = 'varying vec2 vW; uniform float uT, uPx;\nfloat wh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nfloat wn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(wh(i), wh(i + vec2(1.0, 0.0)), f.x), mix(wh(i + vec2(0.0, 1.0)), wh(i + vec2(1.0, 1.0)), f.x), f.y); }';
  wmat.onBeforeCompile = (sh) => { sh.uniforms.uT = U.uT; sh.uniforms.uPx = U.uPx; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = position.xz;'); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + NOISE).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
 { float hf = 1.0 - smoothstep(0.8, 6.0, uPx);                                   // fine ripples only when resolvable
   float lo = wn(vW * vec2(0.0031, 0.0075) + 3.0) * 0.6 + wn(vW * vec2(0.011, 0.02)) * 0.4;     // broad tonal drift (deep/shallow)
   float rp = (wn(vW * vec2(0.05, 0.19) + vec2(uT * 0.05, 0.0)) * 0.6 + wn(vW * vec2(0.13, 0.41) - vec2(uT * 0.08, 0.0)) * 0.4) * hf;
   vec3 deep = vec3(0.17, 0.22, 0.40), shal = vec3(0.22, 0.28, 0.46);
   vec3 wc = mix(deep, shal, lo) * (0.9 + 0.25 * rp);
   float sheen = pow(smoothstep(0.45, 0.95, rp), 2.0) * hf;                             // soft sky/lamp reflection on ripple crests, never a white dot
   float spark = pow(wn(vW * 0.9 + vec2(uT * 0.7, uT * 0.4)), 18.0) * smoothstep(0.6, 3.0, 1.0 / max(uPx, 0.2)) * 0.5;
   diffuseColor.rgb = wc + vec3(0.30, 0.52, 0.62) * sheen * 0.35 + vec3(0.7, 0.8, 0.9) * spark * 0.5;
   totalEmissiveRadiance += vec3(0.03, 0.04, 0.09) * (0.3 + 0.55 * lo) + vec3(0.5, 0.55, 0.8) * sheen * 0.12 + vec3(0.9, 0.95, 1.0) * spark * 0.35; } `); };
  const gmat = kit.toon(0x1f6e52); gmat.polygonOffset = true; gmat.polygonOffsetFactor = -1.5; gmat.polygonOffsetUnits = -1.5;
  gmat.onBeforeCompile = (sh) => { sh.uniforms.uPx = U.uPx; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = position.xz;'); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vW; uniform float uPx;\nfloat wh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nfloat wn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(wh(i), wh(i + vec2(1.0, 0.0)), f.x), mix(wh(i + vec2(0.0, 1.0)), wh(i + vec2(1.0, 1.0)), f.x), f.y); }').replace('#include <color_fragment>', `#include <color_fragment>
 { float hf = 1.0 - smoothstep(0.6, 3.0, uPx); float c3 = wn(vW * 0.7 + 3.0) * hf; vec3 gc = vec3(0.24, 0.32, 0.31) * (0.96 + 0.08 * c3);   // flat teal-green, same as the tree/park tops in the near frames
   diffuseColor.rgb = gc; } `); };
  liftPatch(wmat, LU); liftPatch(gmat, LU); if (TU) { fadePatch(wmat, TU); fadePatch(gmat, TU); }
  wmat.customProgramCacheKey = () => 'cityWater'; gmat.customProgramCacheKey = () => 'cityPark';  // the wrappers above stringify identically: without distinct keys three.js shares ONE program between both materials
  const water = polyMesh(T, M.water.filter((w) => w.k === 0), (pl, all) => { let s = 0, n = 0; for (const v of all) { s += terrain.groundY(v.x, v.y); n++; if (n > 40) break; } return s / n - GROUND + 0.25; }, wmat);
  const parks = polyMesh(T, M.green.filter((g) => g.k === 0 || g.k === 1).filter((g) => { const r = g.r[0]; let cx = 0, cz = 0; for (let i = 0; i < r.length; i += 2) { cx += r[i]; cz += r[i + 1]; } cx /= r.length / 2; cz /= r.length / 2; return Math.max(Math.abs(cx), Math.abs(cz)) < 9000; }), (pl, all) => terrain.groundY(all[0].x, all[0].y) - GROUND + 0.1, gmat);
  water.position.y = GROUND; parks.position.y = GROUND; return { water, parks, U };
}
// metro viaduct, heavy rail, runways
export function buildRail(ctx, D, terrain, LU, TU) {
  const { T, kit } = ctx, GROUND = ctx.geom.GROUND, M = D.misc, group = new T.Group();
  const mk = (items, fn) => { const pts = [], ways = []; for (const it of items) { const p = it.p; const off = pts.length / 2; for (const v of p) pts.push(v); ways.push(fn(it, off, p.length / 2)); } return { roadPts: new Float32Array(pts), ways }; };
  // Chaikin-smooth the viaduct centrelines (OSM way nodes are noisy/kinked) so the deck reads as one smooth ribbon
  const chaikin = (p, it) => { let a = Array.from(p); for (let k = 0; k < it; k++) { const o = [a[0], a[1]]; for (let i = 0; i < a.length / 2 - 1; i++) { const x0 = a[i * 2], z0 = a[i * 2 + 1], x1 = a[i * 2 + 2], z1 = a[i * 2 + 3]; o.push(x0 * 0.75 + x1 * 0.25, z0 * 0.75 + z1 * 0.25, x0 * 0.25 + x1 * 0.75, z0 * 0.25 + z1 * 0.75); } o.push(a[a.length - 2], a[a.length - 1]); a = o; } return a; };
  const metro = M.rail.filter((r) => r.m === 1 && r.v === 1).map((r) => Object.assign({}, r, { p: chaikin(r.p, 3) })), grade = M.rail.filter((r) => !(r.m === 1 && r.v === 1));
  const lin2 = lin;
  const MCOL = { blue: [90, 130, 255], pink: [255, 120, 200], green: [60, 200, 140], purple: [150, 90, 235] };
  // solid box-girder viaduct: a real extruded deck (lit rim, sloped soffit) draped 9 m above the ground; no dashed/dithered shader, one smooth mesh
  const DU = { uWid: { value: 1 } };
  const deckMat = kit.toon(0xffffff, { vc: true }); deckMat.onBeforeCompile = (sh) => { sh.uniforms.uWid = DU.uWid;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aLat; attribute float aE; uniform float uWid; varying float vE; varying vec3 vC2;').replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.xz += aLat.xz * (uWid - 1.0); transformed.y += aLat.y * (uWid - 1.0) * 0.4; vE = aE; vC2 = color;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vE; varying vec3 vC2;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += (vC2 * 0.35 + vec3(0.12, 0.1, 0.2)) * vE;'); };
  deckMat.customProgramCacheKey = () => 'cityDeck';
  { const HW = 4.6, IW = 3.6, BW = 2.3, TH = 2.4, V = []; const pushV = (o) => V.push(o); const idx = []; let vo = 0;
    const RING = (hw) => hw; void RING;
    for (const r of metro) { const c = MCOL[r.c] || MCOL.purple, cl = [lin(c[0]), lin(c[1]), lin(c[2])]; const dark = cl.map((v) => v * 0.55); const p = r.p, n = p.length / 2, ss_ = []; // resample ~8 m
      let acc = [], prev = null; for (let i = 0; i < n - 1; i++) { const x0 = p[i * 2], z0 = p[i * 2 + 1], x1 = p[i * 2 + 2], z1 = p[i * 2 + 3], L = Math.hypot(x1 - x0, z1 - z0); const k = Math.max(1, Math.round(L / 8)); for (let q = 0; q < k; q++) acc.push([x0 + (x1 - x0) * q / k, z0 + (z1 - z0) * q / k]); } acc.push([p[n * 2 - 2], p[n * 2 - 1]]);
      const m = acc.length; if (m < 2) continue; const sec = [];
      for (let i = 0; i < m; i++) { const a = acc[Math.max(0, i - 1)], b = acc[Math.min(m - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L; sec.push({ x: acc[i][0], z: acc[i][1], nx: -dz, nz: dx, y: terrain.groundY(acc[i][0], acc[i][1]) - GROUND + 9.0 }); }
      // faces: [lateral offset, height offset] pairs a->b, normal (lateral dir, up), emissive, colour
      const faces = [[[-HW, 0], [-IW, 0], 0, 1, 1.0, 1], [[-IW, 0], [IW, 0], 0, 1, 0.1, 0], [[IW, 0], [HW, 0], 0, 1, 1.0, 1], [[HW, 0], [BW, -TH], 0.85, 0.5, 0.0, 0], [[BW, -TH], [-BW, -TH], 0, -1, 0.0, 0], [[-BW, -TH], [-HW, 0], -0.85, 0.5, 0.0, 0]];
      for (const f of faces) { const base = vo; for (let i = 0; i < m; i++) { const s = sec[i]; for (let e = 0; e < 2; e++) { const o = f[e]; const lx = s.nx * o[0], lz = s.nz * o[0]; const nl = f[2], nu = f[3], nlen = Math.hypot(nl, nu); pushV({ x: s.x + lx, y: s.y + o[1], z: s.z + lz, nx: s.nx * nl / nlen, ny: nu / nlen, nz: s.nz * nl / nlen, lx, ly: o[1], lz, e: f[4], c: f[5] ? [Math.min(1, cl[0] * 1.6 + 0.35), Math.min(1, cl[1] * 1.6 + 0.3), Math.min(1, cl[2] * 1.3 + 0.4)] : (f[4] > 0 || f[3] > 0 ? cl : dark) }); vo++; } }
        for (let i = 0; i < m - 1; i++) { const a = base + i * 2, b = a + 1, c2 = a + 2, d = a + 3; idx.push(a, b, c2, b, d, c2); } } }
    const N = V.length, P = new Float32Array(N * 3), NR = new Float32Array(N * 3), LA = new Float32Array(N * 3), E = new Float32Array(N), CO = new Float32Array(N * 3);
    V.forEach((v, i) => { P.set([v.x, v.y, v.z], i * 3); NR.set([v.nx, v.ny, v.nz], i * 3); LA.set([v.lx, v.ly, v.lz], i * 3); E[i] = v.e; CO.set(v.c, i * 3); });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(NR, 3)); g.setAttribute('aLat', new T.BufferAttribute(LA, 3)); g.setAttribute('aE', new T.BufferAttribute(E, 1)); g.setAttribute('color', new T.BufferAttribute(CO, 3)); g.setIndex(new T.BufferAttribute(new Uint32Array(idx), 1));
    // winding: make sure faces point outward (flip when the geometric normal opposes the stored one)
    { const ix = g.index.array; for (let k = 0; k < ix.length; k += 3) { const a = ix[k], b = ix[k + 1], c = ix[k + 2]; const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2]; const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx; if (cx * NR[a * 3] + cy * NR[a * 3 + 1] + cz * NR[a * 3 + 2] < 0) { ix[k + 1] = c; ix[k + 2] = b; } } }
    var deck = new T.Mesh(g, deckMat); deck.frustumCulled = false; deck.position.y = GROUND; group.add(deck); }
  // pillars every ~32 m along the viaduct
  const pil = []; for (const r of metro) { const p = r.p; let carry = 0; for (let i = 0; i < p.length / 2 - 1; i++) { const x0 = p[i * 2], z0 = p[i * 2 + 1], x1 = p[i * 2 + 2], z1 = p[i * 2 + 3]; const L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.01) continue; let s = carry; while (s < L) { const x = x0 + (x1 - x0) * s / L, z = z0 + (z1 - z0) * s / L; if (Math.max(Math.abs(x), Math.abs(z)) < 9000) pil.push([x, z, -Math.atan2(z1 - z0, x1 - x0)]); s += 32; } carry = s - L; } }
  // piers: tapered column + T-shaped pier cap under the deck; widened with the pixel scale (uWid) so they stay readable from 2-3 km
  const PU = DU; const pmat = kit.toon(0xcfc9e6); pmat.onBeforeCompile = (sh) => { sh.uniforms.uWid = PU.uWid; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWid;').replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.xz *= uWid;'); }; pmat.customProgramCacheKey = () => 'cityPier';
  const colG = new T.CylinderGeometry(0.85, 1.15, 8.2, 12, 1); colG.translate(0, 4.1 - 4.3, 0); const capG = new T.BoxGeometry(2.1, 1.1, 5.6); capG.translate(0, 8.2 - 0.55 - 4.3 + 0.1, 0);
  const pierG = (() => { const a = colG.toNonIndexed(), b = capG.toNonIndexed(); const P = new Float32Array(a.attributes.position.array.length + b.attributes.position.array.length), N = new Float32Array(P.length); P.set(a.attributes.position.array); P.set(b.attributes.position.array, a.attributes.position.array.length); N.set(a.attributes.normal.array); N.set(b.attributes.normal.array, a.attributes.normal.array.length); const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3)); return g; })();
  const pm = kit.inst(pierG, pmat, pil.length, { ink: false }); pil.forEach((q, i) => { const gy = terrain.groundY(q[0], q[1]) - GROUND; kit.put(pm, i, q[0], gy + 4.3, q[1], 1, 1, 1, 0, q[2], 0); }); pm.position.y = GROUND; group.add(pm);
  // Namma Metro stations: glowing platform boxes on the deck, aligned with the nearest viaduct segment
  const sts = M.stations.filter((q) => Math.max(Math.abs(q.x), Math.abs(q.z)) < 20000); const seg = []; for (const r of metro) { const p = r.p; for (let i = 0; i < p.length / 2 - 1; i++) seg.push([p[i * 2], p[i * 2 + 1], p[i * 2 + 2], p[i * 2 + 3]]); }
  const stMat = kit.toon(0xe8e0ff, { glow: 0xffc98a, glowK: 1.4 }); stMat.onBeforeCompile = (sh) => { sh.uniforms.uWid = PU.uWid; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWid;').replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.z *= uWid; transformed.y *= 1.0 + 0.3 * (uWid - 1.0);'); }; stMat.customProgramCacheKey = () => 'cityStation';
  const stGeo = (() => { const b = new T.BoxGeometry(130, 3.2, 15).toNonIndexed(); const c = new T.CylinderGeometry(1, 1, 130, 20, 1, false, 0, Math.PI).toNonIndexed(); c.rotateZ(Math.PI / 2); c.applyMatrix4(new T.Matrix4().makeScale(1, 4.2, 7.4)); c.translate(0, 1.6, 0); b.deleteAttribute('uv'); c.deleteAttribute('uv'); const n = b.attributes.position.count + c.attributes.position.count, P = new Float32Array(n * 3), N = new Float32Array(n * 3); P.set(b.attributes.position.array); P.set(c.attributes.position.array, b.attributes.position.count * 3); N.set(b.attributes.normal.array); N.set(c.attributes.normal.array, b.attributes.normal.count * 3); const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3)); return g; })(); const sm = kit.inst(stGeo, stMat, sts.length, { ink: false }); sts.forEach((q, i) => { let best = 1e18, bx = q.x, bz = q.z, by = 0, dx = 1, dz = 0; for (const g of seg) { const ex = g[2] - g[0], ez = g[3] - g[1], L2 = ex * ex + ez * ez || 1; let t = ((q.x - g[0]) * ex + (q.z - g[1]) * ez) / L2; t = Math.max(0, Math.min(1, t)); const px = g[0] + ex * t, pz = g[1] + ez * t, d = (px - q.x) ** 2 + (pz - q.z) ** 2; if (d < best) { best = d; bx = px; bz = pz; dx = ex; dz = ez; } } const gy = terrain.groundY(bx, bz) - GROUND; kit.put(sm, i, bx, gy + 9 + 1.6, bz, 1, 1, 1, 0, -Math.atan2(dz, dx), 0); }); sm.position.y = GROUND; sm.visible = false; group.add(sm);
  const rm = roadMaterial(kit, T); const Dr = mk(grade, (r, off, n) => ({ off, n, cls: 4, w: r.m ? 6 : 5, fl: 0, tier: 0, m: r.m }));
  const rmesh = buildRibbons(T, kit, Dr, () => true, (x, z) => terrain.groundY(x, z) - GROUND, rm, { width: (w) => w.w, lift: 0.3, colorOf: (w) => [104, 98, 122] }); rmesh.position.y = GROUND; group.add(rmesh);
  const ae = M.aero.filter((a) => a.t === 'runway' || a.t === 'taxiway'); const Da = mk(ae, (a, off, n) => ({ off, n, cls: a.t === 'runway' ? 7 : 5, w: a.w, fl: 0, tier: 0, t: a.t }));
  const am = roadMaterial(kit, T); const amesh = buildRibbons(T, kit, Da, () => true, (x, z) => terrain.groundY(x, z) - GROUND, am, { width: (w) => w.w, lift: 0.25, colorOf: (w) => w.t === 'runway' ? [176, 172, 214] : [140, 136, 176] }); amesh.position.y = GROUND; group.add(amesh);
  if (TU) [rm, am].forEach((x) => { x.userData.U.uR0 = TU.uR0; x.userData.U.uR1 = TU.uR1; });
  return { group, deck, mats: [rm, am], pierU: PU, piers: pm, stations: sm };
}
