/* city/terrain.js: real relief (AWS Terrarium / SRTM) as a warped-grid displaced mesh, ground colour + night glow rasters baked from OSM. */
import { hash2 } from './data.js';
import { earthShadeChunk, EARTH_IDS } from '../earth/shaders.js';
import { EARTH_LINK, SUN, MOONDIR } from '../earth/handoff.js';
import { POLE, E1, E2, LON0 } from '../earth/frame.js';
export function makeTerrain(ctx, D) {
  const { T, kit, geom } = ctx, GROUND = geom.GROUND, RE = geom.R_E;
  const dem = D.dem, C = dem.coarse, F = dem.fine;
  const bil = (a, n, half, x, z) => { let u = (x + half) / (2 * half) * n - 0.5, v = (z + half) / (2 * half) * n - 0.5; u = Math.min(n - 1.001, Math.max(0, u)); v = Math.min(n - 1.001, Math.max(0, v)); const i = u | 0, j = v | 0, tx = u - i, ty = v - j; const o = j * n + i; return (a[o] * (1 - tx) * (1 - ty) + a[o + 1] * tx * (1 - ty) + a[o + n] * (1 - tx) * ty + a[o + n + 1] * tx * ty) * dem.unit; };
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // relief above the origin's elevation, metres. Flattened to the origin plane within 2.2 km so the building level's ground matches exactly.
  function relief(x, z) { const r = Math.max(Math.abs(x), Math.abs(z)); let e = bil(D.demC, C.n, C.half, x, z); if (r < F.half) { const f = bil(D.demF, F.n, F.half, x, z), w = 1 - ss(F.half - 6000, F.half - 500, r); e = f * w + e * (1 - w); } return e * ss(2200, 6500, Math.hypot(x, z)); }
  const drop = (d) => RE - Math.sqrt(RE * RE - Math.min(d, RE * 0.5) * Math.min(d, RE * 0.5));
  // local-frame y of the ground at (x,z): the plane y=GROUND, plus real relief, minus Earth's curvature (so it meets the Earth sphere), no extra lift: the city is its own level, so the Earth sphere cannot poke through; this is the Earth mesh's own surface
  function groundY(x, z) { const d = Math.hypot(x, z); return GROUND + relief(x, z) - drop(d); }
  // grid
  const N = 300, R = 120000, a = 0.12, pos = new Float32Array((N + 1) * (N + 1) * 3), nor = new Float32Array(pos.length), aEn = new Float32Array(pos.length), aEuv = new Float32Array((N + 1) * (N + 1) * 2), idx = new Uint32Array(N * N * 6);
  const warp = (u) => R * (a * u + (1 - a) * Math.sign(u) * Math.pow(Math.abs(u), 3));
  const xs = []; for (let i = 0; i <= N; i++) xs.push(warp(i / N * 2 - 1));
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const o = (j * (N + 1) + i) * 3, x = xs[i], z = xs[j]; pos[o] = x; pos[o + 1] = groundY(x, z); pos[o + 2] = z;
    { const py = pos[o + 1] - GROUND + RE, il = 1 / Math.hypot(x, py, z), nx = x * il, ny = py * il, nz = z * il;   // this vertex's direction in the Earth frame, hence its lat/lon, hence its texel in the Earth's own ground textures
      aEn[o] = nx; aEn[o + 1] = ny; aEn[o + 2] = nz; const sl = nx * POLE[0] + ny * POLE[1] + nz * POLE[2], lat = Math.asin(Math.max(-1, Math.min(1, sl))) * 180 / Math.PI, lon = (Math.atan2(nx * E2[0] + ny * E2[1] + nz * E2[2], nx * E1[0] + ny * E1[1] + nz * E1[2]) + LON0) * 180 / Math.PI;
      const k2 = (j * (N + 1) + i) * 2; aEuv[k2] = (lon - 75.4) / 4.4; aEuv[k2 + 1] = (lat - 10.8) / 4.4; } const e = 30; const hx = groundY(x + e, z) - groundY(x - e, z), hz = groundY(x, z + e) - groundY(x, z - e); const l = Math.hypot(hx, 2 * e, hz); nor[o] = -hx / l; nor[o + 1] = 2 * e / l; nor[o + 2] = -hz / l; }
  let k = 0; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a0 = j * (N + 1) + i, b = a0 + 1, c = a0 + N + 1, d = c + 1; idx[k++] = a0; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d; }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('aEn', new T.BufferAttribute(aEn, 3)); g.setAttribute('aEuv', new T.BufferAttribute(aEuv, 2)); g.setIndex(new T.BufferAttribute(idx, 1));
  // textures
  const loader = new T.TextureLoader(), tex = (p, srgb) => new Promise((res) => loader.load(ctx.assetURL('city/' + p), (t) => { t.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace; t.flipY = false; t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter; res(t); }, undefined, () => res(null)));
  const U = { mapN: { value: null }, mapF: { value: null }, glowN: { value: null }, glowF: { value: null }, uPx: { value: 1 }, uNight: { value: 1 }, uR0: { value: 98000 }, uR1: { value: 119000 }, uAlpha: { value: 1 }, uOv: { value: 1 }, uGK: { value: ctx.params && ctx.params.has('cityglow') ? Number(ctx.params.get('cityglow')) : 1 } };
  // the Earth level's ground shading (same GLSL function, same textures), blended in as the pixels grow past city scale: the city's ground then IS the Earth's surface
  const EU = {}; const V3 = (v) => new T.Vector3(v[0], v[1], v[2]); const mkE = (n, v) => { EU['E_' + n] = { value: v }; };
  EARTH_IDS.forEach((n) => mkE(n, null)); mkE('uSun', V3(SUN)); mkE('uMoonDir', V3(MOONDIR)); mkE('uPole', V3(POLE)); mkE('uE1', V3(E1)); mkE('uE2', V3(E2)); mkE('uLon0', LON0); mkE('uCam', new T.Vector3(0, 1.3, 0)); mkE('uCloudRot', 0); mkE('uTime', 0); mkE('uPx', 1);
  mkE('uAtlas', new T.Vector4(75.4, 10.8, 4.4, 4.4)); mkE('uCityBox', new T.Vector4(76.51244, 11.871449, 2.256714, 2.213902)); mkE('uCityK', 1); mkE('uHillK', 0.2); mkE('uCityMatch', 1); mkE('uCel', 0.62); mkE('uDbg', 0); mkE('uSlope', 0.5); mkE('uEx', 2.2); mkE('uLights', 1.7); mkE('uExp', 1.5); mkE('uCloudShadow', 1); mkE('uNightRes', 2048); mkE('uDetailK', 0);
  U.uEK = { value: 0 }; let linked = false; const smoothS = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function link(zr, pm) {
    const L = EARTH_LINK; if (L.tex && !linked) { linked = true; EU.E_tDay.value = L.tex.day; EU.E_tNrm.value = L.tex.nrm; EU.E_tNight.value = L.tex.night; EU.E_tCloud.value = L.tex.cloud; EU.E_tCity.value = L.tex.city; const c = L.meta.city; EU.E_uCityBox.value.set(c.lon0, c.lat0, c.lon1 - c.lon0, c.lat1 - c.lat0); }
    EU.E_uPx.value = pm; EU.E_uHillK.value = 2.3 * (0.08 + 0.92 * smoothS(4.6, 5.4, zr));   // same relief ramp as the Earth level (its own update does not run while the city covers the screen)
    U.uEK.value = linked ? smoothS(45, 110, pm) : 0;
  }
  Object.assign(U, EU);
  const mat = kit.toon(0xffffff, { opacity: 1 }); mat.transparent = false;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vXZ; attribute vec3 aEn; attribute vec2 aEuv; varying vec3 vEn; varying vec2 vEuv;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvXZ = position.xz; vEn = aEn; vEuv = aEuv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vEn; varying vec2 vEuv; uniform float uEK;
` + earthShadeChunk() + `
varying vec2 vXZ; uniform sampler2D mapN, mapF, glowN, glowF; uniform float uPx, uR0, uR1, uGK, uAlpha;
float gh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gh(i), gh(i + vec2(1, 0)), f.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), f.x), f.y); }`).replace('#include <map_fragment>', `
  { vec2 un = vXZ / 32800.0 + 0.5, uf = vXZ / 240000.0 + 0.5; float rr = max(abs(vXZ.x), abs(vXZ.y)); float w = 1.0 - smoothstep(5000.0, 16200.0, rr);
    vec3 cN = texture2D(mapN, un).rgb, cF = texture2D(mapF, uf).rgb; vec3 c = mix(cF, cN, w);
    float lum = dot(c, vec3(0.3, 0.5, 0.2)); float gr = smoothstep(0.02, 0.12, clamp((c.g - max(c.r, c.b)) * 6.0, 0.0, 1.0));
    float wt = smoothstep(0.05, 0.14, c.g - c.r) * (1.0 - gr); float rd = smoothstep(0.34, 0.5, lum) * step(c.b * 0.9, c.r + 0.06) * (1.0 - wt);
    // one warm-lavender palette at every distance (same family as the lit boxes / roofs of the near frames): buildings = lit-window speckle on lavender, plots = dusk violet, parks/lakes = soft desaturated tints of the ground
    float bm = smoothstep(0.07, 0.2, lum) * (1.0 - gr) * (1.0 - wt) * (1.0 - rd);
    vec3 plot = vec3(0.19, 0.16, 0.30);
    vec3 bld = mix(vec3(0.26, 0.23, 0.38), vec3(0.50, 0.46, 0.62), smoothstep(0.1, 0.34, lum));
    float cs = max(5.0, uPx * 2.4); vec2 cc = floor(vXZ / cs); float hs = gh(cc), hs2 = gh(cc + 17.0);
    float spk = step(0.82, hs) * (0.5 + 0.5 * hs2) * (1.0 - smoothstep(14.0, 50.0, uPx));
    bld = mix(bld, bld * vec3(1.18, 1.1, 0.95) + vec3(0.30, 0.20, 0.06), 0.0) + vec3(0.95, 0.62, 0.22) * spk * 1.3;
    vec3 base = mix(plot, bld, bm);
    base = mix(base, vec3(0.24, 0.32, 0.31), gr * 0.7);                                  // parks: sage, a soft tint of the ground
    base = mix(base, vec3(0.22, 0.28, 0.46), wt * 0.8);                                  // lakes / river: desaturated slate blue
    base = mix(base, vec3(0.62, 0.52, 0.48), rd * 0.75);                                 // roads: warm light
    c = base;
    diffuseColor.rgb *= c;
        float gl = mix(texture2D(glowF, uf).r, texture2D(glowN, un).r, w); terrainGlow = gl; }`).replace('#include <opaque_fragment>', '#include <opaque_fragment>\n if (uEK > 0.0) { vec3 ec = E_earthShade(vEn, vEuv); gl_FragColor.rgb = mix(gl_FragColor.rgb, ec, uEK); }').replace('void main() {', 'float terrainGlow = 0.0;\nvoid main() {').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += vec3(1.0, 0.62, 0.24) * (1.85 * pow(terrainGlow, 2.4)) * uGK * smoothstep(0.8, 12.0, uPx) * (1.0 + 1.6 * smoothstep(8.0, 70.0, uPx));`);
  };
  const mesh = new T.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 3;   // after the Earth surface layers (orders 0..2) so the faded rim blends over the Earth texture instead of occluding it mesh.userData.name = 'terrain';
  const ready = Promise.all([tex('ground_near_color.jpg', true), tex('ground_far_color.jpg', true), tex('ground_near_glow.png', false), tex('ground_far_glow.png', false)]).then(([a, b, c, d]) => { U.mapN.value = a; U.mapF.value = b; U.glowN.value = c; U.glowF.value = d; mat.needsUpdate = true; });
  return { mesh, groundY, relief, drop, ready, U, link };
}
