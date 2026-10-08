/* Things in orbit: the Moon (NASA LRO WAC mosaic), the ISS and geostationary comsats (NASA 3D Resources models), the LEO
 * shell (Starlink-like constellation hint), orbit rings, and the prompt's route to a data centre. Positions are physical
 * (metres, EARTH frame); *drawn* sizes of small things are clamped to a minimum on screen (see MIN_FRAC) so they stay legible. */
import { R_E, dir, POLE, E1, E2, norm, cross, dot, PLACES } from './frame.js';
import { moonVS, moonFS } from './shaders.js';

export const MOON_R = 1737400, MOON_D = 384400e3, GEO_R = 42164e3, ISS_ALT = 408e3, ISS_R = R_E + ISS_ALT, ISS_W = 2 * Math.PI / 5560, LEO_R = R_E + 550e3;
const TAU = Math.PI * 2;

// orbit helper: circular orbit of inclination `inc` (rad) whose ascending node is at equatorial angle `raan` from E1 (toward E2)
export function orbitBasis(inc, raan) {
  const Nn = [E1[0] * Math.cos(raan) + E2[0] * Math.sin(raan), E1[1] * Math.cos(raan) + E2[1] * Math.sin(raan), E1[2] * Math.cos(raan) + E2[2] * Math.sin(raan)];
  const Q = cross(POLE, Nn), B = [Q[0] * Math.cos(inc) + POLE[0] * Math.sin(inc), Q[1] * Math.cos(inc) + POLE[1] * Math.sin(inc), Q[2] * Math.cos(inc) + POLE[2] * Math.sin(inc)];
  return { A: Nn, B };
}
export const orbitPos = (o, r, u, out) => { const c = Math.cos(u), s = Math.sin(u); out.set((o.A[0] * c + o.B[0] * s) * r, (o.A[1] * c + o.B[1] * s) * r, (o.A[2] * c + o.B[2] * s) * r); return out; };

export function buildMoon(ctx, group, uni, sunDir, moonDir) {
  const { T } = ctx; const tex = new T.TextureLoader().load(ctx.assetURL('earth/moon.jpg')); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 8;
  const X = norm([-moonDir[0], -moonDir[1], -moonDir[2]]); let Y = [POLE[0] - dot(POLE, X) * X[0], POLE[1] - dot(POLE, X) * X[1], POLE[2] - dot(POLE, X) * X[2]]; Y = norm(Y); const Z = cross(X, Y);
  const M = new T.Matrix4().makeBasis(new T.Vector3(...X), new T.Vector3(...Y), new T.Vector3(...Z));
  const sunL = new T.Vector3(...sunDir).applyMatrix4(new T.Matrix4().copy(M).transpose());
  const mat = new T.ShaderMaterial({ vertexShader: moonVS, fragmentShader: moonFS, uniforms: Object.assign({}, { uSun: uni.sun, uMoonDir: uni.moonDir, uPole: { value: new T.Vector3() }, uE1: { value: new T.Vector3() }, uE2: { value: new T.Vector3() }, uCam: uni.cam, uLon0: { value: 0 }, uCloudRot: { value: 0 }, uTime: uni.time },
    { tMoon: { value: tex }, uSunL: { value: sunL }, uEarthL: { value: new T.Vector3(1, 0, 0) }, uExp2: { value: 3.1 } }) });
  const mesh = new T.Mesh(new T.SphereGeometry(MOON_R, 96, 64), mat); mesh.frustumCulled = false; mesh.quaternion.setFromRotationMatrix(M); mesh.position.set(moonDir[0] * MOON_D, moonDir[1] * MOON_D, moonDir[2] * MOON_D);
  // the shader's own light is expressed in the Moon's frame; with the mesh rotated the geometry's local +x is the near side
  group.add(mesh);
  const halo = ctx.kit.halo(0xcfd6ff, 0.0); group.add(halo);
  return { mesh, halo, pos: mesh.position };
}

// ---- NASA glTF -> house-style materials
async function loadSat(ctx, file, realSize) {
  const { T, kit } = ctx; const root = new T.Group(); let g = null;
  try { g = await Promise.race([ctx.loadGLB('earth/' + file), new Promise((_, rej) => setTimeout(() => rej(new Error('glb timeout')), 20000))]); } catch (e) { console.error('earth: model failed ' + file + ' ' + e); }
  const holder = new T.Group(); root.add(holder); root.userData = { unit: 1, real: realSize, holder }; if (!g) return root;
  const scene = g.scene; scene.updateMatrixWorld(true);
  const kill = []; scene.traverse((o) => { if (o.isMesh && o.material && ((o.material.transparent && o.material.opacity < 0.2) || /transp/i.test(o.material.name || ''))) kill.push(o); });
  kill.forEach((o) => o.parent && o.parent.remove(o));
  scene.traverse((o) => { if (o.isMesh && !o.geometry.attributes.normal) o.geometry.computeVertexNormals(); });
  scene.traverse((o) => { if (o.isMesh) { const om = o.material, col = om.color ? om.color.getHex() : 0xb0b4c8; o.material = kit.toon(col, { map: om.map || null, side: T.DoubleSide }); o.frustumCulled = false; } });
  const box = new T.Box3().setFromObject(scene), size = box.getSize(new T.Vector3()), ctr = box.getCenter(new T.Vector3()), mx = Math.max(size.x, size.y, size.z);
  scene.position.sub(ctr); holder.add(scene); root.userData.unit = realSize / mx; holder.scale.setScalar(root.userData.unit); return root;
}

export async function buildSats(ctx, group, sunDir) {
  const { T, kit } = ctx; const out = {};
  const [iss, ssl, tdrs, goes] = await Promise.all([loadSat(ctx, 'models/iss.glb', 109), loadSat(ctx, 'models/ssl1300.glb', 36), loadSat(ctx, 'models/tdrs.glb', 21), loadSat(ctx, 'models/goes.glb', 25)]);
  // ISS orbit: 51.6 deg inclination, passing over the Deccan/Arabian Sea at t = 6 s
  const inc = 51.6 * Math.PI / 180, u0 = Math.asin(Math.sin(15 * Math.PI / 180) / Math.sin(inc)), target = dir(15.0, 71.0); let best = 0, bd = 9; const tmp = new T.Vector3();
  for (let a = 0; a < TAU; a += 0.002) { const o = orbitBasis(inc, a); orbitPos(o, 1, u0, tmp); const d = Math.hypot(tmp.x - target[0], tmp.y - target[1], tmp.z - target[2]); if (d < bd) { bd = d; best = a; } }
  out.issOrbit = orbitBasis(inc, best); out.issU0 = u0; out.iss = iss; group.add(iss);
  out.geo = []; const lons = [55, 62, 68, 74, 83, 93.5, 105.5, 111, 125, 140, 160, 178, -160, -135, -105, -75, -50, -35, 12, 28, 40], kinds = lons.map((_, i) => [tdrs, ssl, ssl, goes, ssl][i % 5]);   // real GEO slots are crowded over 55-125 E, the rest of the belt is spread around
  lons.forEach((lon, i) => { const k = kinds[i], m = k.clone(true); m.userData = { unit: k.userData.unit, real: k.userData.real, holder: m.children[0] }; const d = dir(0, lon); m.position.set(d[0] * GEO_R, d[1] * GEO_R, d[2] * GEO_R); group.add(m); out.geo.push({ m, d }); });
  return out;
}

// thin tube ring from instanced cylinders (stays ~1 px wide at every scale via update())
export function makeRing(ctx, group, n, color, opacity = 1) {
  const { T, kit } = ctx; const mat = new T.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }); mat.toneMapped = false;
  const im = kit.inst(kit.unitCyl, mat, n); im.frustumCulled = false; group.add(im); return im;
}
export function placeRing(ctx, im, basis, r, rad, dash = 0) {
  const { T, kit } = ctx, n = im.count, a = new T.Vector3(), b = new T.Vector3();
  for (let i = 0; i < n; i++) { const on = !dash || (i % 2 === 0); orbitPos(basis, r, (i / n) * TAU, a); orbitPos(basis, r, ((i + (dash ? 0.62 : 1.02)) / n) * TAU, b); kit.putDir(im, i, a, b, on ? rad : 1e-3); }
  im.instanceMatrix.needsUpdate = true;
}

export function buildStarShell(ctx, group) {
  const { T, kit } = ctx; const NP = 72, NS = 22, n = NP * NS, geo = new T.BufferGeometry(); const pos = new Float32Array(n * 3); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  geo.boundingSphere = new T.Sphere(new T.Vector3(), 1e8);
  const pts = kit.glowPoints(geo, 2.4, 0.9, false, 0xbfe9ff); pts.frustumCulled = false; group.add(pts);
  const bases = []; for (let p = 0; p < NP; p++) bases.push(orbitBasis(53 * Math.PI / 180, (p / NP) * TAU)); const w = Math.sqrt(3.986e14 / Math.pow(LEO_R, 3)), tmp = new T.Vector3();
  return { pts, update(t) { for (let p = 0; p < NP; p++) for (let s = 0; s < NS; s++) { const k = p * NS + s; orbitPos(bases[p], LEO_R, (s / NS) * TAU + (p * 0.37) + w * t, tmp); pos[k * 3] = tmp.x; pos[k * 3 + 1] = tmp.y; pos[k * 3 + 2] = tmp.z; } geo.attributes.position.needsUpdate = true; } };
}

// ---- the prompt's route: Bangalore -> data centre (illustrative: Singapore interconnect hub) and back
export function buildRoute(ctx, group) {
  const { T, kit } = ctx; const a = dir(...PLACES.bangalore), b = dir(...PLACES.singapore), ang = Math.acos(dot(a, b)), N = 220;
  const mat = new T.MeshBasicMaterial({ color: 0xffffff }); mat.toneMapped = false; const im = kit.inst(kit.unitCyl, mat, N); im.frustumCulled = false; im.setColorAt(0, new T.Color(1, 1, 1)); group.add(im);
  const gmat = new T.ShaderMaterial({ transparent: true, blending: T.AdditiveBlending, depthWrite: false, uniforms: { uOp: { value: 0.42 } },   // soft emissive falloff: brightest on the axis, fading to nothing at the silhouette (no hard-edged stripe)
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vC; void main(){ vec4 mv = modelViewMatrix * instanceMatrix * vec4(position,1.0); vN = normalize(mat3(modelViewMatrix) * mat3(instanceMatrix) * normal); vV = normalize(-mv.xyz); vC = instanceColor; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uOp; varying vec3 vN; varying vec3 vV; varying vec3 vC; void main(){ float f = abs(dot(normalize(vN), normalize(vV))); float a = pow(f, 2.6) * uOp; gl_FragColor = vec4(vC, a); }' }); const glow = kit.inst(kit.unitCyl, gmat, N); glow.frustumCulled = false; glow.setColorAt(0, new T.Color(1, 1, 1)); glow.renderOrder = 12; group.add(glow);   // soft light around the arc
  const smat = new T.MeshBasicMaterial({ color: 0x0b0d2e, transparent: true, opacity: 0.38, depthWrite: false }); const shadow = kit.inst(kit.unitCyl, smat, N); shadow.frustumCulled = false; group.add(shadow);   // its shadow on the surface: reads as lifted
  const pts = []; const H = ang * R_E * 0.11;
  for (let i = 0; i <= N; i++) { const u = i / N, s1 = Math.sin((1 - u) * ang) / Math.sin(ang), s2 = Math.sin(u * ang) / Math.sin(ang); const d = [a[0] * s1 + b[0] * s2, a[1] * s1 + b[1] * s2, a[2] * s1 + b[2] * s2]; const r = R_E - 2 + 40 + H * Math.pow(Math.sin(Math.PI * u), 0.75); pts.push(new T.Vector3(d[0] * r, d[1] * r, d[2] * r)); }
  const halo1 = kit.halo(0xffb34a, 1), halo2 = kit.halo(0x7fe3c4, 1); group.add(halo1); group.add(halo2); halo1.position.copy(pts[0]); halo2.position.copy(pts[N]);
  const flare = kit.halo(0xffd166, 0.0); group.add(flare);
  const col = new T.Color(), gp = [];
  for (let i = 0; i <= N; i++) { const p = pts[i].clone(); p.multiplyScalar((R_E - 2 + 6) / p.length()); gp.push(p); }
  return { pts, halo1, halo2, flare, N, im, glow, shadow, a, b, ang,
    update(c, S, t) {
      const W = c.W, rad0 = Math.max(W * 0.0012, 12), gain = this.gain === undefined ? 1 : this.gain, amb = new T.Color(1.0, 0.56, 0.12), teal = new T.Color(0.2, 1.3, 1.0);
      const sent = S.send, p1 = sent < 0 ? -1 : Math.min(1, sent / 0.55), p2 = sent < 0 ? -1 : Math.min(1, Math.max(0, (sent - 0.55) / 0.55));
      for (let i = 0; i < N; i++) {
        const u = (i + 0.5) / N; const dm = u * ang * R_E, tp0 = 0.22 + 0.78 * Math.exp(-dm / (W * 0.55)), rad = rad0 * tp0 * (0.4 + 0.6 * Math.min(1, gain)) + 1e-3; kit.putDir(im, i, pts[i], pts[i + 1], rad * 0.6);   // tapers with distance from the lit core and swells in with `gain`
        let I = 0.17, c3 = amb;                                                    // dormant guide line
        if (sent >= 0) { const w = 0.07;
          const d1 = p1 < 1 ? Math.exp(-Math.pow((u - p1) / w, 2)) : 0; const trail1 = (u < p1) ? 0.55 * Math.exp(-(p1 - u) * 5) : 0;
          const d2 = (p2 > 0 && p2 < 1) ? Math.exp(-Math.pow((u - (1 - p2)) / w, 2)) : 0; const trail2 = (p2 > 0 && u > 1 - p2) ? 0.45 * Math.exp(-(u - (1 - p2)) * 5) : 0;
          const fin = (p2 >= 1 ? Math.max(0, 1 - (sent - 1.1) / 0.1) : 1);
          if (d2 + trail2 > 0.03) { c3 = teal; I = 0.17 + (d2 * 5 + trail2 * 3) * fin; } else { I = 0.17 + (d1 * 5 + trail1 * 3) * (p1 >= 1 ? Math.max(0, 1 - (sent - 0.55) / 0.2) : 1); }
        }
        const tp = 0.55 + 0.45 * Math.min(1, u / 0.07) * Math.min(1, u / 0.07); col.copy(c3).multiplyScalar((0.5 + I * 1.6) * tp * gain); im.setColorAt(i, col); kit.putDir(glow, i, pts[i], pts[i + 1], rad * 4.2); glow.setColorAt(i, col); kit.putDir(shadow, i, gp[i], gp[i + 1], rad * 1.3 * (gain > 0.02 ? 1 : 0));
      }
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; glow.instanceMatrix.needsUpdate = true; glow.instanceColor.needsUpdate = true; shadow.instanceMatrix.needsUpdate = true;
      const pulse = 1 + 0.14 * Math.sin(t * 3.2);
      const E = S.E || 0; const hs = Math.max(W * 0.030, 1500) * (1 + 0.5 * E) * pulse;
      this.halo1.scale.set(hs, hs, 1); this.halo1.material.opacity = (0.75 + 0.25 * Math.min(1, E)) * gain;
      const arrive = sent < 0 ? 0 : Math.exp(-Math.pow((sent - 0.55) / 0.12, 2)), back = sent < 0 ? 0 : Math.exp(-Math.pow((sent - 1.1) / 0.1, 2));
      const hs2 = Math.max(W * 0.024, 1200) * (1 + 1.2 * arrive) * (1 + 0.14 * Math.sin(t * 3.2 + 1.7)); this.halo2.scale.set(hs2, hs2, 1); this.halo2.material.opacity = 0.7 + 0.3 * arrive;
      this.flare.position.copy(pts[sent < 0 ? 0 : (sent < 0.55 ? Math.round(p1 * N) : Math.round((1 - p2) * N))]); const fs = Math.max(W * 0.02, 900); this.flare.scale.set(fs, fs, 1); this.flare.material.opacity = sent >= 0 && sent < 1.15 ? 0.9 : 0;
      this.flare.material.color.set(sent > 0.55 ? 0x7fe3c4 : 0xffd166);
    } };
}
