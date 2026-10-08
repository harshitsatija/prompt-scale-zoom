/* city/handle.js: a singleton rendezvous between the city level and the building level. The city publishes its inner (r < 560 m) objects; the building level
 * mirrors them into its own group (sharing geometry, uniforms and shader code, owning only its material instances) so that the neighbourhood is ONE set of objects with
 * ONE look, drawn identically by whichever level is the innermost one on screen. */
let resolve; export const cityHandle = new Promise((r) => { resolve = r; });
export const publishCity = (h) => resolve(h);
export const HERO_RECT = [-13.5, 13.5, -13.8, 14.8];   // her compound: drawn by the building level only (city omits any footprint whose centroid lies in it)
// clone an object tree for another level: geometry shared, material instances owned (the engine stamps a stencil ref into each material), shader uniforms shared by reference
export function mirrorTree(src) {
  const pairs = []; const dst = src.clone(true);
  const a = [], b = []; src.traverse((o) => a.push(o)); dst.traverse((o) => b.push(o));
  for (let i = 0; i < a.length; i++) { const s = a[i], d = b[i]; pairs.push([s, d]); const ms = s.material; if (!ms) continue;
    const dup = (m) => { const m2 = m.clone(); m2.onBeforeCompile = m.onBeforeCompile; m2.customProgramCacheKey = m.customProgramCacheKey; m2.userData = Object.assign({}, m.userData); delete m2.userData._nest; delete m2.userData._nestWarned; m2.stencilWrite = false; if (m.isShaderMaterial) m2.uniforms = m.uniforms; return m2; };
    d.material = Array.isArray(ms) ? ms.map(dup) : dup(ms); d.userData = Object.assign({}, s.userData); if (s.isInstancedMesh) { d.instanceMatrix = s.instanceMatrix; d.instanceColor = s.instanceColor; } }
  return { root: dst, sync() { for (let i = 0; i < pairs.length; i++) { const [s, d] = pairs[i]; if (i > 0) d.visible = s.visible; d.position.copy(s.position); d.quaternion.copy(s.quaternion); d.scale.copy(s.scale); if (s.isInstancedMesh) d.count = s.count; if (s.material && !Array.isArray(s.material)) { const m = s.material, m2 = d.material; if (m.size !== undefined) m2.size = m.size; if (m.opacity !== undefined) m2.opacity = m.opacity; } } } };
}
