/* The Milky Way's own disc (glow + dust planes and the resolved-star populations), built ONCE from shared buffers and instanced into BOTH the galaxy level
 * (outside the stars level's nested ball) and the stars level (inside it), with the same shaders, the same shared uniforms and the same update law
 * (applyMW), so the disc is the same stars at the same positions and the same brightness on both sides of the nesting boundary. */
import * as T from '../../vendor/three.module.js';
import * as shaders from './shaders.js';
import { R0, warpY } from './model.js';

export const KPC = 3.0856775814913673e19;
export const EXT = 44.0, LEXT = 12.0;
// 3 kpc orbit radius etc. live in the data; the loc_* (sub-12-kpc) sets are the Sun's own neighbourhood
let cache = null;
export function loadMWAssets(ctx) {
  if (cache) return cache;
  const texLoader = new T.TextureLoader();
  const tex = async (name) => { const t = await texLoader.loadAsync(ctx.assetURL('galaxy/' + name)); t.colorSpace = T.NoColorSpace; t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter; t.generateMipmaps = true; t.anisotropy = 8; return t; };
  cache = Promise.all([ctx.fetchJSON('galaxy/mw_stars.json'), ctx.fetchBuf('galaxy/mw_stars.bin'), tex('mw_glow.webp'), tex('mw_dust.webp'), tex('mw_glow_local.webp'), tex('mw_dust_local.webp')])
    .then(([meta, buf, glow, dust, glowL, dustL]) => {
      const planeGeo = new T.PlaneGeometry(EXT, EXT, 120, 120); planeGeo.rotateX(-Math.PI / 2); planeGeo.translate(0, 0, -R0);
      { const p = planeGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, warpY(p.getX(i), -(p.getZ(i)) - R0)); }
      const geos = {}; for (const [k, m] of Object.entries(meta)) { const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(new Int16Array(buf, m.pos, m.n * 3), 3)); g.setAttribute('aCol', new T.BufferAttribute(new Uint8Array(buf, m.col, m.n * 4), 4, true)); geos[k] = g; }
      return { meta, planeGeo, geos, glow, dust, glowL, dustL }; });
  return cache;
}
const SPEC = { halo: [{ base: 1.3, amp: 0.7 }, 2], disc: [{ base: 1.5, amp: 0.8 }, 3], loc_disc: [{ base: 1.7, amp: 1.0 }, 3], young: [{ base: 1.7, amp: 1.1 }, 4], loc_young: [{ base: 1.9, amp: 1.3 }, 4], bulge: [{ base: 1.5, amp: 0.9 }, 6],
  bright: [{ base: 2.2, amp: 0.7, big: 5, halo: 0.18 }, 5], loc_bright: [{ base: 2.6, amp: 0.8, big: 6, halo: 0.2 }, 5] };
// renderBias shifts renderOrder so that, inside the stars level, the disc sits UNDER the catalogue sprites
export function makeMW(A, bias = 0) {
  const root = new T.Group(); root.userData.mw = true;
  const glowMat = shaders.discMaterial({ mode: 'glow', map: A.glow, mapLocal: A.glowL, ext: EXT, offY: R0, localExt: LEXT, gain: 0.6, detAmp: 0.35 });
  const dustMat = shaders.discMaterial({ mode: 'dust', map: A.dust, mapLocal: A.dustL, ext: EXT, offY: R0, localExt: LEXT, gain: 1.0, detAmp: 0.5, dustCol: 0x2a1424 });
  const glowPlane = new T.Mesh(A.planeGeo, glowMat); glowPlane.renderOrder = 1 + bias; glowPlane.frustumCulled = false; root.add(glowPlane);
  const dustPlane = new T.Mesh(A.planeGeo, dustMat); dustPlane.renderOrder = 5 + bias; dustPlane.frustumCulled = false; root.add(dustPlane);
  const stars = {}, BASEAMP = {};
  for (const [k, [o, order]] of Object.entries(SPEC)) { const m = shaders.starMaterial({ unit: A.meta[k].unit_kpc, ...o }); const p = new T.Points(A.geos[k], m); p.frustumCulled = false; p.renderOrder = order + bias; root.add(p); stars[k] = p; BASEAMP[k] = o.amp; }
  return { root, glowMat, dustMat, glowPlane, dustPlane, stars, BASEAMP };
}
const sst = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
export const fadeLaw = (z) => { const f = sst(F0, F1, z); return f * f * (1 - sst(24.75, 24.95, z)); };    // resolved stars: present from deep inside the neighbourhood, so the disc is simply "more of the same stars"
export const planeRamp = (z) => sst(P0, P1, z);                                                              // unresolved light of the same stars: only appears once the stars themselves are sub-pixel
export let F0 = 18.9, F1 = 20.0, P0 = 19.7, P1 = 20.9;
// the shared brightness / size law of the disc as a function of the REAL field width W (metres) and z = log10 W
export function sharedLaw(t, z, W, dpr) {
  const ss = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const sh = shaders.shared; sh.uDpr.value = dpr; const Wk = W / KPC; sh.uPxPerKpc.value = window.innerWidth / Wk; const pxk = sh.uPxPerKpc.value;
  sh.uGain.value = 0.14 * Math.min(2.4, Math.max(1e-5, Math.pow(pxk / 45, 1.8))) * (1 - 0.3 * (1 - ss(20.2, 21.2, z)));
  sh.uCap.value = 1.7 - 1.0 * ss(21.4, 22.4, z) - 0.15 * ss(23.4, 24.0, z);
  sh.uDetail.value = 1.0 - ss(21.3, 22.0, z); sh.uTime.value = t; sh.uFade.value = fadeLaw(z);
}
export function applyMW(mw, z, nearK) {
  const ss = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const { stars, BASEAMP } = mw;
  stars.bulge.material.uniforms.uBase.value = 1.5 * (1 + 0.3 * (1 - ss(20.4, 21.4, z)));
  for (const k of ['disc', 'loc_disc', 'young', 'loc_young', 'halo']) stars[k].material.uniforms.uBase.value = (k === 'young' || k === 'loc_young' ? 1.9 : k === 'loc_disc' ? 1.15 : 1.5) * (1 + 0.4 * (1 - ss(20.2, 21.4, z)));
  mw.glowMat.uniforms.uMul.value = nearK * planeRamp(z); mw.dustMat.uniforms.uMul.value = nearK * planeRamp(z);
  for (const k of Object.keys(stars)) stars[k].material.uniforms.uAmp.value = (k === 'bright' || k === 'loc_bright' ? BASEAMP[k] * (0.5 + 0.5 * ss(20.3, 20.9, z)) * (1 - 0.6 * ss(20.9, 21.8, z)) : BASEAMP[k]) * nearK;
}
