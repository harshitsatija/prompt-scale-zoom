/* The planet: three nested displaced lat/lon meshes (global 0.7 deg, regional 0.08 deg, Bangalore 0.01 deg) sharing one shader, a cloud deck and
 * an atmosphere shell. Heights are real (Terrarium/GEBCO-SRTM) and baked per vertex by build/convert.py. Colours are NASA Blue Marble NG +
 * MODIS detail; night lights are VIIRS Black Marble; clouds are MODIS true-colour of 27-29 Sep 2026 turned into a density map. */
import { R_E, dir, POLE, E1, E2, LON0 } from './frame.js';
import { EARTH_LINK } from './handoff.js';
import { surfaceVS, surfaceFS, cloudFS, atmoVS, atmoFS } from './shaders.js';

const D2R = Math.PI / 180;
function meshFromHeights(T, h16, nx, ny, lon0, lon1, lat0, lat1, r0) {
  const nv = (nx + 1) * (ny + 1), pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), tmp = [0, 0, 0];
  for (let j = 0; j <= ny; j++) { const v = j / ny, lat = lat1 + (lat0 - lat1) * v; for (let i = 0; i <= nx; i++) { const u = i / nx, lon = lon0 + (lon1 - lon0) * u, k = j * (nx + 1) + i;
    dir(lat, lon, tmp); const r = r0 + h16[k]; pos[k * 3] = tmp[0] * r; pos[k * 3 + 1] = tmp[1] * r; pos[k * 3 + 2] = tmp[2] * r; uv[k * 2] = u; uv[k * 2 + 1] = 1 - v; } }
  const idx = new Uint32Array(nx * ny * 6); let q = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setIndex(new T.BufferAttribute(idx, 1));
  g.boundingSphere = new T.Sphere(new T.Vector3(), R_E * 1.01); return g;
}

export async function buildPlanet(ctx, group, uni) {
  const { T } = ctx; const meta = await ctx.fetchJSON('earth/meta.json'); const r0 = R_E - 2 - meta.hBLR;
  const loader = new T.TextureLoader(); const maxAniso = 8;
  const tex = async (name, srgb, o = {}) => { const t = await loader.loadAsync(ctx.assetURL('earth/' + name)); t.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace; t.anisotropy = maxAniso; if (o.nomip) { t.generateMipmaps = false; t.minFilter = T.LinearFilter; } else { t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter; } if (o.repeat) t.wrapS = T.RepeatWrapping; return t; };
  const h16 = async (name) => new Int16Array(await ctx.fetchBuf('earth/' + name));
  const [dG, nG, lG, dR, nR, lR, dL, nL, lL, cl, hA, hB, hL, cityT] = await Promise.all([
    tex('day_global.jpg', true), tex('nrm_global.jpg', false), tex('night_global.png', true), tex('day_reg.jpg', true), tex('nrm_reg.jpg', false), tex('night_reg.png', true),
    tex('day_loc.jpg', true), tex('nrm_loc.jpg', false), tex('night_loc.png', true), tex('clouds.jpg', false, { repeat: true }), h16('mesh_global.h16'), h16('mesh_reg.h16'), h16('mesh_loc.h16'), tex('night_blr.png', false)]);
  cityT.generateMipmaps = true; EARTH_LINK.tex = { day: dL, nrm: nL, night: lL, cloud: cl, city: cityT }; EARTH_LINK.meta = meta;
  const shared = {
    uSun: uni.sun, uMoonDir: uni.moonDir, uPole: { value: new T.Vector3(...POLE) }, uE1: { value: new T.Vector3(...E1) }, uE2: { value: new T.Vector3(...E2) }, uCam: uni.cam,
    uLon0: { value: LON0 }, uPx: uni.px, uCloudRot: uni.cloudRot, uTime: uni.time, tCloud: { value: cl }, uCloudShadow: { value: 1 }, uCel: { value: 0.62 }, uHillK: { value: 2.3 }, uCityMatch: { value: 1 },
  };
  const layers = []; const pg = new T.Group(); group.add(pg);          // everything that is the planet itself (so it can be drawn enlarged when it is only a few pixels wide)
  const mk = (name, geo, d, n, l, o) => {
    const mat = new T.ShaderMaterial({ vertexShader: surfaceVS, fragmentShader: surfaceFS, transparent: o.fade > 0, depthWrite: true, uniforms: Object.assign({}, shared, {
      tDay: { value: d }, tNrm: { value: n }, tNight: { value: l }, uSlope: { value: o.slope }, uEx: { value: o.ex }, uLights: { value: 1.7 }, uNightRes: { value: o.nres }, uDetailK: uni.detailK, tCity: { value: cityT }, uCityK: { value: o.city ? 1 : 0 }, uAtlas: { value: new T.Vector4(o.atlas[0], o.atlas[1], o.atlas[2], o.atlas[3]) }, uCityBox: { value: new T.Vector4(meta.city.lon0, meta.city.lat0, meta.city.lon1 - meta.city.lon0, meta.city.lat1 - meta.city.lat0) }, uDbg: { value: +(ctx.params && ctx.params.get('edbg') || 0) }, uAlpha: { value: 1 }, uExp: { value: 1.5 }, uFeather: { value: o.fade }, uLift: { value: 0 } }) });
    const m = new T.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = o.order; pg.add(m); layers.push({ name, mesh: m, mat, o }); return m;
  };
  mk('A', meshFromHeights(T, hA, meta.global.nx, meta.global.ny, -180, 180, -90, 90, r0), dG, nG, lG, { slope: 0.12, ex: 3.6, fade: 0, order: 0, nres: 4096, atlas: [-180, -90, 360, 180] });
  mk('B', meshFromHeights(T, hB, meta.reg.nx, meta.reg.ny, meta.reg.lon0, meta.reg.lon1, meta.reg.lat0, meta.reg.lat1, r0), dR, nR, lR, { slope: 0.25, ex: 3.3, fade: 0.05, order: 1, nres: 3072, city: true, atlas: [60, 2, 40, 38] });
  mk('L', meshFromHeights(T, hL, meta.loc.nx, meta.loc.ny, meta.loc.lon0, meta.loc.lon1, meta.loc.lat0, meta.loc.lat1, r0), dL, nL, lL, { slope: 0.5, ex: 2.2, fade: 0.114, order: 2, nres: 2048, city: true, atlas: [75.4, 10.8, 4.4, 4.4] });

  // cloud deck (14 km up) and atmosphere shell (80 km)
  const cloudMat = new T.ShaderMaterial({ vertexShader: atmoVS, fragmentShader: cloudFS, transparent: true, depthWrite: false, uniforms: Object.assign({}, shared, { uAlpha: { value: 1 }, uTexel: { value: 1 / 8192 }, uTexSize: { value: new T.Vector2(8192, 4096) } }) });
  const clouds = new T.Mesh(new T.SphereGeometry(R_E + 14000, 256, 128), cloudMat); clouds.frustumCulled = false; clouds.renderOrder = 5; pg.add(clouds);
  const RA = 1 + 80000 / R_E;
  const atmoMat = new T.ShaderMaterial({ vertexShader: atmoVS, fragmentShader: atmoFS, transparent: true, depthWrite: false, depthTest: true, blending: T.CustomBlending, blendEquation: T.AddEquation,
    blendSrc: T.OneFactor, blendDst: T.OneFactor, blendSrcAlpha: T.OneFactor, blendDstAlpha: T.OneMinusSrcAlphaFactor, uniforms: Object.assign({}, shared, { uExpo: { value: 4.6 }, uRA: { value: RA }, uHS: { value: 12000 / R_E }, uRim: { value: 0.42 } }) });
  const atmo = new T.Mesh(new T.SphereGeometry(R_E * RA, 192, 96), atmoMat); atmo.frustumCulled = false; atmo.renderOrder = 9; pg.add(atmo);
  return {
    layers, clouds, atmo, r0, pg,
    update(c, z) {
      // atmosphere: physical (80 km) while it is wider than ~4 px, then exaggerated to a 4 px rim so the limb glow never vanishes (drawn-enlarged, like the satellites)
      { const thick = Math.min(Math.max(80000, c.W / Math.max(window.innerWidth || 1600, 320) * 4.5 / pg.scale.x), 0.6 * R_E); atmo.scale.setScalar((R_E + thick) / (R_E + 80000)); atmoMat.uniforms.uRA.value = 1 + thick / R_E; atmoMat.uniforms.uHS.value = Math.max(12000, thick * 0.15) / R_E; }
      shared.uHillK.value = 2.3 * (0.08 + 0.92 * smooth(4.6, 5.4, z));   // relief shading ramps in under the city instead of popping
      const eoff = (ctx.params && ctx.params.get('eoff') || '');
      clouds.visible = z > 5.5; cloudMat.uniforms.uAlpha.value = smooth(5.5, 6.3, z);   // the city's terrain covers this region until 5.5, so the cloud deck only grows in after it has handed over
      const res = 3.8e-5 / c.s;                                  // depth-buffer resolution in metres at the focus distance
      for (const L of layers) {
        const u = L.mat.uniforms;
        if (L.name === 'A') { u.uLift.value = 0; L.mesh.visible = z > 5.95; }
        if (L.name === 'B') { u.uLift.value = Math.max(30, 3 * res); const a = 1 - smooth(7.0, 7.7, z); u.uAlpha.value = a; L.mesh.visible = a > 0.01 && z > 5.3; }
        if (L.name === 'L') { u.uLift.value = Math.max(60, 7 * res); const a = 1 - smooth(6.2, 6.8, z); u.uAlpha.value = a; L.mesh.visible = a > 0.01; }
      }
      if (eoff) for (const L of layers) if (eoff.includes(L.name)) L.mesh.visible = false; if (eoff.includes('C')) clouds.visible = false;
    },
  };
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
