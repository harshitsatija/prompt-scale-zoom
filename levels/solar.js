/* LEVEL solar  (z 10.2 .. 14.4) — the solar system from real elements.
 * Real: JPL approximate Keplerian elements (planets), JPL SBDB elements (15k main-belt, 3k trojans, 3k TNOs, 500 centaurs, 1.5k NEOs, dwarf planets, comets),
 * JPL Horizons trajectories (Voyagers, Pioneers, New Horizons), Solar System Scope (CC-BY 4.0) planet maps, IAU pole directions, real ring texture.
 * Procedural: the Sun's surface cells/spots/corona/prominences (stylised), heliosphere shells (profile fitted to the Voyager crossings 94/121 AU), glow billboards.
 * Honest exaggeration: ONE factor for all eight planets (true diameter ratios; bodies that would fall under ~1.4 px are floored), the Sun gets its own smaller factor
 * (drawn ~3x Jupiter, truly 9.95x); orbits and distances are exact. */
import { AU, DPS, planetState, smallState, orbitSamples, poleDir, toLocal, D2R } from './solar/orbits.js';
import * as SH from './solar/shaders.js';
import { SUN as SUN_E, NECL, SUNPX, sunPx as sunPxAt, earthPx as earthPxAt } from './earth/handoff.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export default async function build(ctx) {
  const { T, kit, plan } = ctx; const V = (x, y, z) => new T.Vector3(x, y, z); const ss = kit.ss;
  const group = new T.Group(), inner = new T.Group(); group.add(inner);
  const uRes = kit.inkU.uRes.value;
  const loader = new T.TextureLoader();
  const tex = (p, srgb = true) => new Promise((res, rej) => loader.load(ctx.assetURL('solar/' + p), (t) => { if (srgb) t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter; res(t); }, undefined, rej));
  const [EL, CRAFT] = await Promise.all([ctx.fetchJSON('solar/elements.json'), ctx.fetchJSON('solar/craft.json')]);
  const names = ['sun', 'mercury', 'venus_cloud', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'moon'];
  const TX = {}; await Promise.all(names.map(async (n) => { TX[n] = await tex(n + '.jpg'); })); const ringTex = await tex('saturn_ring.png');
  const bin = async (n) => new Float32Array(await ctx.fetchBuf('solar/' + n));
  const [belt, trojans, kuiper, centaurs, neo] = await Promise.all(['belt', 'trojans', 'kuiper', 'centaurs', 'neo'].map((n) => bin(n + '.f32')));
  const JD0 = EL.jd0, hash = ctx.timeline.hash;

  // labels get a soft dark halo so they read over glows and orbit lines (the engine's hard 1 px outline stays)
  if (!document.getElementById('solar-style')) { const sy = document.createElement('style'); sy.id = 'solar-style'; sy.textContent = '.tag3 span{text-shadow:-1px -1px 0 #080a26,1px -1px 0 #080a26,-1px 1px 0 #080a26,1px 1px 0 #080a26,0 0 5px #080a26,0 0 9px #080a26cc !important}'; document.head.appendChild(sy); }
  // the exaggeration note lives in the HUD margin, not in the scene
  const noteEl = document.createElement('div'); noteEl.id = 'solar-note'; noteEl.style.cssText = 'position:fixed;left:24px;top:84px;white-space:nowrap;padding:3px 9px;border-radius:10px;background:rgba(14,16,58,.62);pointer-events:none;font:600 11.5px/1.35 system-ui,Helvetica,Arial,sans-serif;color:#ede6d8;opacity:0;transition:opacity .25s;text-shadow:0 0 5px #080a26,0 0 9px #080a26,1px 1px 0 #080a26;z-index:5'; /* no caption box in the page: the honest-scale note lives in the Sun's label */
  let noteSeen = 0, noteTxt = ''; setInterval(() => { if (performance.now() - noteSeen > 400 && noteEl.style.opacity !== '0') noteEl.style.opacity = '0'; }, 250);

  // ------------------------------------------------------------------ the Sun
  const R_SUN = 6.957e8, R_E = 6.371e6;
  const sunMesh = new T.Mesh(new T.SphereGeometry(1, 128, 96), SH.sunMat(TX.sun)); sunMesh.frustumCulled = false; inner.add(sunMesh);
  const corona = new T.Mesh(new T.PlaneGeometry(2, 2), SH.coronaMat()); corona.frustumCulled = false; corona.renderOrder = 5; inner.add(corona);
  const CK = 6.5; // corona quad half-size in solar radii

  // ------------------------------------------------------------------ planets
  const BODIES = [
    { n: 'Mercury', R: 2.4397e6, map: 'mercury', pole: [281.01, 61.45], col: 0xcbbfb2, spin: 0.35, au: 0.387 },
    { n: 'Venus', R: 6.0518e6, map: 'venus_cloud', pole: [272.76, 67.16], col: 0xffe3a8, spin: -0.2, halo: [0xffd9a0, 0.5], au: 0.723 },
    { n: 'Earth', R: 6.371e6, map: 'earth', pole: [0, 90], col: 0x6ab4ff, spin: 0.5, halo: [0x6ab4ff, 0.8], au: 1.0, circle: true, rim: 0.7 },
    { n: 'Mars', R: 3.3895e6, map: 'mars', pole: [317.68, 52.89], col: 0xff8a5c, spin: 0.5, halo: [0xff9a6a, 0.2], au: 1.524 },
    { n: 'Jupiter', R: 6.9911e7, map: 'jupiter', pole: [268.06, 64.5], col: 0xffcfa0, spin: 0.9, au: 5.2, sat: 1.55 },
    { n: 'Saturn', R: 5.8232e7, map: 'saturn', pole: [40.59, 83.54], col: 0xffe2a0, spin: 0.8, ring: true, au: 9.54, sat: 1.4 },
    { n: 'Uranus', R: 2.5362e7, map: 'uranus', pole: [257.31, -15.18], col: 0x8fe9e0, spin: -0.6, halo: [0x8fe9e0, 0.45], au: 19.19, sat: 1.25 },
    { n: 'Neptune', R: 2.4622e7, map: 'neptune', pole: [299.36, 43.46], col: 0x6f8cff, spin: 0.6, halo: [0x6f8cff, 0.5], au: 30.07, sat: 1.3 },
  ];
  const sphereGeo = new T.SphereGeometry(1, 96, 64);
  const RIN = 74.5e6 / 58.232e6, ROUT = 140.2e6 / 58.232e6;
  function ringGeo(rin, rout, seg = 256) { const pos = [], uv = [], idx = []; for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); pos.push(c * rin, 0, s * rin, c * rout, 0, s * rout); uv.push(0, 0, 1, 1); if (i < seg) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } } const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.boundingSphere = new T.Sphere(V(0, 0, 0), 1e6); return g; }
  const yAxis = V(0, 1, 0);
  for (const b of BODIES) {
    b.el = EL.planets[b.n]; b.pg = new T.Group(); inner.add(b.pg);
    const ring = b.ring ? { map: ringTex, rin: RIN, rout: ROUT } : null;
    b.mat = SH.planetMat(TX[b.map], { ring, rim: b.rim === undefined ? 0.45 : b.rim, sat: b.sat || (b.n === 'Earth' ? 1.05 : 0.95), bright: b.n === 'Earth' ? 1.2 : 1.0 });
    b.mesh = new T.Mesh(sphereGeo, b.mat); b.mesh.frustumCulled = false; b.pg.add(b.mesh);
    const pd = poleDir(b.pole[0], b.pole[1]); b.qPole = new T.Quaternion().setFromUnitVectors(yAxis, V(pd[0], pd[1], pd[2]).normalize()); b.pd = V(pd[0], pd[1], pd[2]);
    if (ring) { b.ringMesh = new T.Mesh(ringGeo(RIN, ROUT), SH.ringMat(ringTex, RIN, ROUT)); b.ringMesh.frustumCulled = false; b.ringMesh.renderOrder = 3; b.mesh.add(b.ringMesh); }
    if (b.halo) { b.haloMesh = new T.Mesh(new T.PlaneGeometry(2, 2), SH.haloMat(b.halo[0], b.halo[1])); b.haloMesh.frustumCulled = false; b.haloMesh.renderOrder = 4; b.pg.add(b.haloMesh); }
    b.pos = V(0, 0, 0); b.pxr = 0; b.vel = V(0, 0, 0);
  }
  const byName = Object.fromEntries(BODIES.map((b) => [b.n, b]));
  // ---- one world with the earth level. The Earth sits at plan.EARTHC (drawn by the earth level) and is held still; the Sun lies where the Earth is lit from,
  // the ecliptic normal is the real one (23.4 deg from the Earth's axis). inner = rotation taking the ecliptic frame (local +y = ecliptic north, Earth's direction at JD0 = c1) into the Earth frame.
  const qInner = new T.Quaternion(), qInnerInv = new T.Quaternion(); let AUe = AU;
  { const eL = toLocal(planetState(byName.Earth.el, JD0, true).pos); AUe = Math.hypot(eL[0], eL[1], eL[2]);
    const c1 = V(eL[0], eL[1], eL[2]).normalize(), c2 = V(0, 1, 0), c3 = new T.Vector3().crossVectors(c1, c2); const u1 = V(-SUN_E[0], -SUN_E[1], -SUN_E[2]), u2 = V(...NECL), u3 = new T.Vector3().crossVectors(u1, u2);
    const Mc = new T.Matrix4().makeBasis(c1, c2, c3), Mu = new T.Matrix4().makeBasis(u1, u2, u3); qInner.setFromRotationMatrix(Mu.multiply(Mc.transpose())); qInnerInv.copy(qInner).invert(); inner.quaternion.copy(qInner); }
  const SUNBASE = [plan.EARTHC[0] + SUN_E[0] * AUe, plan.EARTHC[1] + SUN_E[1] * AUe, plan.EARTHC[2] + SUN_E[2] * AUe];

  // size model. ONE exaggeration factor Ep for all planets (Earth's drawn radius is the reference), the Sun its own smaller factor Es.
  // Tables are radii in px: the Sun's, and the Earth-marble that hands over from the earth level (the planets then follow the Sun: Jupiter = Sun/4).
  const TAB = (t, z) => { if (z <= t[0][0]) return t[0][1]; for (let i = 1; i < t.length; i++) if (z <= t[i][0]) { const f = (z - t[i - 1][0]) / (t[i][0] - t[i - 1][0]); return t[i - 1][1] + (t[i][1] - t[i - 1][1]) * f; } return t[t.length - 1][1]; };
  // Earth radius (px) comes from earth/handoff.js: the earth level draws the one and only Earth at that size, the planets follow the same factor
  const FLOOR = 2.3, GAMMA = 0.5; // planet radius in px = Earth-px * (R/R_E)^GAMMA: order of sizes is true, the spread is compressed so Mercury and Mars stay legible beside Jupiter

  // moons (real semi-major axes, periods, radii)
  const flat = (hex) => kit.canvasTex(4, 4, (x, w, h) => { x.fillStyle = '#' + hex.toString(16).padStart(6, '0'); x.fillRect(0, 0, w, h); });
  const MOONS = [
    { p: 'Earth', n: 'Moon', a: 3.844e8, P: 27.32, R: 1.7374e6, map: TX.moon },
    { p: 'Jupiter', n: 'Io', a: 4.217e8, P: 1.769, R: 1.8216e6, map: flat(0xe8c35a) }, { p: 'Jupiter', n: 'Europa', a: 6.711e8, P: 3.551, R: 1.5608e6, map: flat(0xdccbb0) },
    { p: 'Jupiter', n: 'Ganymede', a: 1.0704e9, P: 7.155, R: 2.6341e6, map: flat(0xa39a90) }, { p: 'Jupiter', n: 'Callisto', a: 1.8827e9, P: 16.689, R: 2.4103e6, map: flat(0x72675c) },
    { p: 'Saturn', n: 'Titan', a: 1.2219e9, P: 15.945, R: 2.5747e6, map: flat(0xdca24c) }, { p: 'Saturn', n: 'Rhea', a: 5.271e8, P: 4.518, R: 7.64e5, map: flat(0xcfc8c0) },
    { p: 'Uranus', n: 'Titania', a: 4.359e8, P: 8.706, R: 7.885e5, map: flat(0xb8b0a8) }, { p: 'Neptune', n: 'Triton', a: 3.5476e8, P: -5.877, R: 1.3534e6, map: flat(0xe8d8c8) },
  ];
  for (const m of MOONS) {
    const pl = byName[m.p]; m.pl = pl; m.og = new T.Group(); pl.pg.add(m.og); if (['Saturn', 'Uranus', 'Neptune'].includes(m.p)) m.og.quaternion.copy(pl.qPole); m.mat = SH.planetMat(m.map, { rim: 0.3, sat: 0.9 }); m.mesh = new T.Mesh(sphereGeo, m.mat); m.mesh.frustumCulled = false; m.og.add(m.mesh);
    const N = 192, pts = [], us = []; for (let k = 0; k <= N; k++) { const A = k / N * Math.PI * 2; pts.push([Math.cos(A) * m.a, 0, Math.sin(A) * m.a]); us.push(k / N); }
    m.rib = new T.Mesh(SH.ribbonGeo(pts, us), SH.ribbonMat(pl.col, uRes)); m.rib.frustumCulled = false; m.rib.material.uniforms.uTail.value = 2.0; m.rib.material.uniforms.uBase.value = 0.18; m.og.add(m.rib); m.ph0 = hash(m.a | 0, 3, 5) * 6.28;
  }

  // ------------------------------------------------------------------ orbits
  const dprEff = () => Math.max(1, uRes.x / Math.max(1, innerWidth));
  const mix = (a, b, t) => new T.Color(a).lerp(new T.Color(b), t);
  const ribbons = [];
  function addOrbit(st0, color, o = {}) {
    const { pts, us } = orbitSamples(st0, o.n || 720); const loc = pts.map((p) => toLocal(p));
    const m = new T.Mesh(SH.ribbonGeo(loc, us), SH.ribbonMat(color, uRes)); m.frustumCulled = false; m.renderOrder = 2; m.material.uniforms.uWidth.value = (o.w || 1.5) * dprEff(); m.material.uniforms.uAlpha.value = o.alpha || 0.8; m.material.uniforms.uBase.value = o.base === undefined ? 0.16 : o.base; m.material.uniforms.uTail.value = o.tail || 2.6; inner.add(m); const r = { mesh: m, o }; ribbons.push(r); return r;
  }
  for (const b of BODIES) { const s0 = planetState(b.el, JD0, b.circle); b.orbit = addOrbit(s0, mix(b.col, 0x8f98ff, b.n === 'Earth' ? 0.0 : 0.35), { alpha: b.n === 'Earth' ? 1.0 : 0.9, w: b.n === 'Earth' ? 2.0 : 1.7 }); }
  // dwarf planets: small spheres (true radii, one shared exaggeration) on their real orbits
  const DW = [['Ceres', 0xd6c8b8, 'dwarf', 4.73e5], ['Pluto', 0xe8c9a0, 'dwarf', 1.1883e6], ['Eris', 0xd8dcff, 'dwarf', 1.163e6], ['Haumea', 0xdfe6ff, 'dwarf', 7.8e5], ['Makemake', 0xe8b89a, 'dwarf', 7.15e5], ['Sedna', 0xff9d7a, 'dwarf', 5.0e5]];
  const COM = [['Halley', 0x9ff0e0], ['Encke', 0x9ff0e0], ['67P', 0x9ff0e0], ['Swift-Tuttle', 0x9ff0e0], ['HaleBopp', 0x9ff0e0]];
  const smalls = [];
  for (const [n, c, kind, R] of DW) { const s = EL.small[n]; if (!s) continue; const o = { n, s, col: c, kind, R, pos: V(0, 0, 0) }; o.orbit = addOrbit(smallState(s, JD0), mix(c, 0x8f98ff, 0.45), { alpha: n === 'Sedna' ? 0.2 : 0.4, w: 1.1, n: n === 'Sedna' ? 1400 : 900 });
    o.mat = SH.planetMat(flat(c), { rim: 0.3, sat: 0.9 }); o.mesh = new T.Mesh(sphereGeo, o.mat); o.mesh.frustumCulled = false; inner.add(o.mesh); smalls.push(o); }
  for (const [n, c] of COM) { const s = EL.small[n]; if (!s) continue; const o = { n, s, col: c, kind: 'comet', pos: V(0, 0, 0) }; o.orbit = addOrbit(smallState(s, JD0), mix(c, 0x5b63e0, 0.5), { alpha: 0.2, w: 1.0, n: 1600, base: 0.08, tail: 4 }); o.tail = new T.Mesh(SH.ribbonGeo(Array.from({ length: 16 }, (_, i) => [i / 15, 0, 0]), null, Array.from({ length: 16 }, (_, i) => 1 - i / 15 * 0.9)), SH.ribbonMat(0xbff6ee, uRes)); o.tail.frustumCulled = false; o.tail.material.uniforms.uBase.value = 1; o.tail.material.uniforms.uTail.value = 0; o.tail.material.uniforms.uPU.value = 0; inner.add(o.tail); smalls.push(o); }

  // ------------------------------------------------------------------ swarms (Kepler solved on the GPU)
  function swarm(data, color, px, o = {}) {
    const n = data.length / 6, e1 = new Float32Array(n * 3), e2 = new Float32Array(n * 3), hh = new Float32Array(n);
    for (let i = 0; i < n; i++) { e1.set([data[i * 6], data[i * 6 + 1], data[i * 6 + 2]], i * 3); e2.set([data[i * 6 + 3], data[i * 6 + 4], data[i * 6 + 5]], i * 3); hh[i] = hash(i, 17, 3); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('e1', new T.BufferAttribute(e1, 3)); g.setAttribute('e2', new T.BufferAttribute(e2, 3)); g.setAttribute('hh', new T.BufferAttribute(hh, 1));
    const m = SH.swarmMat(color, px, uRes, o); const pts = new T.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 1; inner.add(pts); return pts;
  }
  // belt: soft violet-grey, the real main belt (a < ~3.5 AU) and fainter Cybele/Hilda; Kuiper belt keeps its 30-55 AU annulus, the scattered disc fades out
  const swBelt = swarm(belt, 0x9fb4ec, 1.35, { color2: 0xd9d4f2, fade: [3.3, 3.55] }), swTroj = swarm(trojans, 0xff9d7a, 1.8, { color2: 0xffd0b0 }), swKuiper = swarm(kuiper, 0x8f9bff, 2.1, { color2: 0xc7ccff, fade: [52, 78] }), swCent = swarm(centaurs, 0xffb36b, 1.8, { color2: 0xffd9a8 }), swNeo = swarm(neo, 0xffd166, 1.8, { color2: 0xfff3d6 });
  const swarms = [[swBelt, 1.35], [swTroj, 1.8], [swKuiper, 2.1], [swCent, 1.8], [swNeo, 1.8]];

  // ------------------------------------------------------------------ spacecraft (Horizons)
  const craft = [];
  const CC = { 'Voyager 1': 0xffd166, 'Voyager 2': 0xffb35c, 'New Horizons': 0xa9b0ff };
  for (const [n, c] of Object.entries(CRAFT.craft)) { if (!CC[n]) continue;
    const loc = c.traj.map((p) => toLocal(p.slice(1))); loc.push(toLocal(c.now)); const us = loc.map((_, i) => i / (loc.length - 1));
    const sm = loc, su = us; // Horizons samples are dense (1-day steps through the flybys, 10-day after), so the path is a smooth curve without resampling
    const m = new T.Mesh(SH.ribbonGeo(sm, su), SH.ribbonMat(CC[n], uRes)); m.frustumCulled = false; m.material.uniforms.uWidth.value = (n === 'Voyager 1' || n === 'Voyager 2' ? 1.8 : 1.2) * dprEff(); m.material.uniforms.uPU.value = 1; m.material.uniforms.uTail.value = 16; m.material.uniforms.uBase.value = 0.0; m.material.uniforms.uAlpha.value = n.startsWith('Voyager') ? 1 : 0.6; m.renderOrder = 2; inner.add(m);
    craft.push({ n, c, col: CC[n], pos: V(0, 0, 0), rib: m, p0: toLocal(c.now), v: toLocal(c.vel) });
  }
  // Voyager glyph: 3.7 m high-gain dish, bus, boom with the RTGs, magnetometer boom
  const probeTex = kit.canvasTex(64, 64, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.lineCap = 'round';
    x.strokeStyle = '#ffd9a0'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(30, 36); x.lineTo(7, 52); x.stroke(); x.lineWidth = 1.6; x.beginPath(); x.moveTo(34, 38); x.lineTo(54, 58); x.stroke();
    x.fillStyle = '#ffb35c'; x.fillRect(4, 49, 8, 5); x.fillStyle = '#ffe6bd'; x.fillRect(51, 55, 6, 4);
    const g = x.createRadialGradient(32, 26, 3, 32, 26, 20); g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#fff3d6'); g.addColorStop(1, '#e6c58b'); x.fillStyle = g; x.beginPath(); x.arc(32, 25, 19, 0, 7); x.fill();
    x.strokeStyle = '#a77a3c'; x.lineWidth = 1.4; x.beginPath(); x.arc(32, 25, 19, 0, 7); x.stroke(); x.beginPath(); x.arc(32, 25, 10, 0, 7); x.stroke();
    x.fillStyle = '#ffb35c'; x.beginPath(); x.arc(32, 25, 3.2, 0, 7); x.fill();
    x.fillStyle = '#d8a45a'; x.fillRect(26, 37, 12, 7);
  });
  const iconMat = SH.iconMat(probeTex); const iconGeo = new T.BufferGeometry(); iconGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3)); iconGeo.boundingSphere = new T.Sphere(V(0, 0, 0), 1e18);
  const icons = new T.Points(iconGeo, iconMat); icons.frustumCulled = false; icons.renderOrder = 8; inner.add(icons);

  // ------------------------------------------------------------------ heliosphere
  // Comet-shaped bubble: the nose faces the interstellar wind (ecliptic lon 255.4, lat 5.1). Both Voyagers left it on the nose-ward side:
  // V1 crossed at 121.6 AU (2012), V2 at ~119 AU (2018), both about 30-40 deg off the nose, so the front is ~120 AU round and the tail fattens behind.
  const noseEcl = (() => { const l = 255.4 * D2R, b = 5.1 * D2R; return V(Math.cos(b) * Math.cos(l), Math.sin(b), Math.cos(b) * Math.sin(l)); })();
  const qAxis = new T.Quaternion().setFromUnitVectors(V(1, 0, 0), noseEcl);
  function shellProfile(R0, Rt, Lt, Lc, nf = 36, nt = 44, nc = 36) { // [x (AU along the axis, nose = +R0), rho, u (0 nose -> 1 end)]
    const P = [];
    for (let i = 0; i <= nf; i++) { const a = i / nf * Math.PI / 2; P.push([R0 * Math.cos(a), R0 * Math.sin(a)]); }
    for (let i = 1; i <= nt; i++) { const k = i / nt, e = k * k * (3 - 2 * k); P.push([-k * Lt, R0 + (Rt - R0) * e]); }
    for (let i = 1; i <= nc; i++) { const b = i / nc * Math.PI / 2; P.push([-Lt - Lc * Math.sin(b), Rt * Math.cos(b)]); }
    return P.map((p, i) => [p[0], p[1], i / (P.length - 1)]);
  }
  function lathe(profile, seg = 112) { // profile: [[x, rho, u]] in AU
    const pos = [], uv = [], idx = [], P = profile.length;
    for (let i = 0; i < P; i++) for (let j = 0; j <= seg; j++) { const a = j / seg * Math.PI * 2, [x, r, u] = profile[i]; pos.push(x * AU, r * Math.cos(a) * AU, r * Math.sin(a) * AU); uv.push(u, j / seg); }
    for (let i = 0; i < P - 1; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + 1, c = a + seg + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); g.boundingSphere = new T.Sphere(V(0, 0, 0), 1e14); return g; }
  const HP = shellProfile(121, 170, 300, 320, 40, 80, 64), TS = HP.map(([x, r, u]) => [x * 0.78, r * 0.78, u]); // strictly nested: termination shock = heliopause x 0.78 (94 / 121 AU)
  const mkShell = (prof, col, k, rim, o) => { const g = lathe(prof); const m = new T.Mesh(g, SH.shellMat(col, k, rim, o)); m.quaternion.copy(qAxis); m.frustumCulled = false; m.renderOrder = 6; inner.add(m);
    const pa = g.attributes.position, pts = new Float32Array(pa.count * 3), v = V(0, 0, 0); for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyQuaternion(qAxis); pts.set([v.x, v.y, v.z], i * 3); } m.userData.pts = pts; return m; };
  const NAMEHACK = (m, n) => { m.userData.name = n; return m; };
  const hp = mkShell(HP, 0x8f9cff, 0.42, 70.0, { body: 0.0, rimColor: 0xc4ccff }), ts = mkShell(TS, 0xc79cf0, 0.30, 70.0, { body: 0.0, rimColor: 0xe6c8ff });   // thin tinted limb lines in the violet of the space, no filled body NAMEHACK(hp, 'hp'); NAMEHACK(ts, 'ts');
  // verify the Voyagers are outside the heliopause (they are: V1 172 AU, V2 144 AU, shell ~121 AU at ~30-40 deg off the nose)
  const shellR = (prof, x) => { for (let i = 1; i < prof.length; i++) if ((prof[i - 1][0] - x) * (prof[i][0] - x) <= 0) { const f = (x - prof[i - 1][0]) / (prof[i][0] - prof[i - 1][0] || 1); return prof[i - 1][1] + (prof[i][1] - prof[i - 1][1]) * f; } return 0; };
  craft.forEach((c) => { if (!c.n.startsWith('Voyager')) return; const p = V(c.p0[0], c.p0[1], c.p0[2]).divideScalar(AU), x = p.dot(noseEcl), rho = p.clone().addScaledVector(noseEcl, -x).length(); c.outside = rho > shellR(HP, x); ctx.log('solar:', c.n, (p.length()).toFixed(0), 'AU, outside heliopause =', c.outside, 'angle off nose', (Math.acos(x / p.length()) / D2R).toFixed(0)); });

  // interstellar wind: streamlines of potential flow around the heliopause, with pulses running downstream (kept faint)
  const sl = []; { const a = 140; for (let k = 0; k < 10; k++) { const ang = hash(k, 5, 9) * Math.PI * 2, b = a * (1.12 + 0.3 * Math.pow(hash(k, 2, 3), 1.2)), pts = [], us = [], wk = [], off = hash(k, 7, 1); const N = 140;
    for (let i = 0; i <= N; i++) { const xx = 260 - 600 * i / N; wk.push(Math.pow(Math.sin(Math.PI * i / N), 0.6)); let rho = b; for (let it = 0; it < 40; it++) { const r = Math.hypot(xx, rho); rho = b / Math.sqrt(Math.max(1e-3, 1 - Math.pow(a / r, 3))); } pts.push([xx * AU, rho * Math.cos(ang) * AU, rho * Math.sin(ang) * AU]); us.push((i / N * 0.7 + off) % 1); }
    sl.push(SH.ribbonGeo(pts, us, wk)); } }
  const slMesh = new T.Mesh(mergeGeometries(sl), SH.ribbonMat(0xa9b0ff, uRes)); slMesh.quaternion.copy(qAxis); slMesh.frustumCulled = false; slMesh.renderOrder = 6; slMesh.material.uniforms.uTail.value = 4.5; slMesh.material.uniforms.uBase.value = 0.1; slMesh.material.uniforms.uAlpha.value = 0.14; inner.add(slMesh);

  // ------------------------------------------------------------------ markers (legible dots that give way to the real spheres)
  const markers = []; // {pos: Vector3 ref, col, size, alpha: () => 0..1}
  BODIES.forEach((b) => markers.push({ pos: b.pos, col: new T.Color(b.col), size: b.n === 'Earth' ? 18 : 11, get alpha() { return b.mAlpha; } }));
  smalls.forEach((s) => markers.push({ pos: s.pos, col: new T.Color(s.col), size: s.kind === 'comet' ? 6.5 : 8, get alpha() { return s.mAlpha === undefined ? 1 : s.mAlpha; } }));
  craft.forEach((c) => markers.push({ pos: c.pos, col: new T.Color(c.col), size: c.n.startsWith('Voyager') ? 6 : 5.5, get alpha() { return c.mAlpha === undefined ? 1 : c.mAlpha; } }));
  // where each Voyager crossed the heliopause (V1 121.6 AU, 2012; V2 ~119 AU, 2018), read off the Horizons track
  craft.forEach((c) => { if (!c.n.startsWith('Voyager')) return; const R = c.n === 'Voyager 1' ? 121.6 : 119.0, tr = c.c.traj; for (let i = 1; i < tr.length; i++) { const r0 = Math.hypot(tr[i - 1][1], tr[i - 1][2], tr[i - 1][3]), r1 = Math.hypot(tr[i][1], tr[i][2], tr[i][3]); if (r0 < R && r1 >= R) { const f = (R - r0) / (r1 - r0), q = [1, 2, 3].map((k) => tr[i - 1][k] + (tr[i][k] - tr[i - 1][k]) * f), p = toLocal(q); c.cross = V(p[0], p[1], p[2]); break; } }
    if (c.cross) markers.push({ pos: c.cross, col: new T.Color(0x7fe3c4), size: 7, get alpha() { return (c.mAlpha || 0) * 1.6 * ss(13.0, 13.5, st.z); } }); });
  MOONS.forEach((m) => { m.wp = V(0, 0, 0); markers.push({ pos: m.wp, col: new T.Color(0xf4efe4), size: 5, get alpha() { return m.mAlpha || 0; } }); });
  const mG = new T.BufferGeometry(); const mN = markers.length; mG.setAttribute('position', new T.BufferAttribute(new Float32Array(mN * 3), 3)); mG.setAttribute('size', new T.BufferAttribute(new Float32Array(mN).map((_, i) => markers[i].size), 1)); mG.setAttribute('alpha', new T.BufferAttribute(new Float32Array(mN), 1)); mG.setAttribute('col', new T.BufferAttribute(new Float32Array(markers.flatMap((m) => [m.col.r, m.col.g, m.col.b])), 3));
  const mMat = SH.markerMat(); const mPts = new T.Points(mG, mMat); mPts.frustumCulled = false; mPts.renderOrder = 7; inner.add(mPts);

  // faint ray from Earth toward the Sun (z 10.3..11.5): the 1 AU label sits on its end
  const sunRay = new T.Mesh(SH.ribbonGeo(Array.from({ length: 24 }, (_, i) => [i / 23, 0, 0]), Array.from({ length: 24 }, (_, i) => i / 23), Array.from({ length: 24 }, (_, i) => 0.35 + 0.65 * (i / 23))), SH.ribbonMat(0xffd9a0, uRes)); sunRay.frustumCulled = false; sunRay.renderOrder = 2; sunRay.material.uniforms.uPU.value = 1; sunRay.material.uniforms.uTail.value = 1.6; sunRay.material.uniforms.uBase.value = 0.55; inner.add(sunRay);
  const sunRayTip = V(0, 0, 0), sunRayDir = V(0, 0, 0);
  // ------------------------------------------------------------------ state, labels
  const st = { W: 1e11, pxScale: 1e8, rotY: 0, sunR: R_SUN, Ep: 1, Es: 1, z: 11 };
  const camR = V(1, 0, 0), camU = V(0, 1, 0), tmp = V(0, 0, 0), up = V(0, 1, 0), qc = new T.Quaternion(), eul = new T.Euler(0, 0, 0, 'YXZ');
  const inFrame = (v) => tmp.copy(v).applyQuaternion(qInner).clone();
  const labels = [];
  const lp = (get) => () => inFrame(get());
  const limb = (shell, dir) => { const a = shell.userData.pts; let best = -1e30, bi = 0; for (let i = 0; i < a.length; i += 3) { const d = a[i] * dir.x + a[i + 1] * dir.y + a[i + 2] * dir.z; if (d > best) { best = d; bi = i; } } return V(a[bi], a[bi + 1], a[bi + 2]); };
  const dirA = V(0, 0, 0), dirB = V(0, 0, 0), tmpL = V(0, 0, 0);
  // Sun
  labels.push({ text: 'The Sun &middot; drawn ~3x too big, orbits to scale', z0: 11.3, z1: 13.95, rpx: () => st.sunR / st.pxScale, pos: lp(() => V(0, 0, 0)) });
  const zr = (a, lo, hi) => { const r = a * AU; return [Math.log10(r / hi), Math.log10(r / lo)]; };
  BODIES.forEach((b) => { const [z0, z1] = zr(b.au, b.au < 2 ? 0.05 : 0.03, 0.9); const zz0 = b.n === 'Earth' ? 10.3 : Math.max(10.3, z0), zz1 = b.n === 'Earth' ? 13.0 : (b.au < 2 ? (b.n === 'Mercury' ? 12.2 : b.n === 'Venus' ? 12.4 : 12.75) : Math.min(b.au > 15 ? 13.7 : 13.4, z1));
    b.label = { text: b.n === 'Earth' ? 'Earth &middot; 1 AU' : (b.n === 'Jupiter' ? 'Jupiter &middot; 5.2 AU' : b.n), z0: zz0, z1: zz1, rpx: () => b.pxr, tangent: b, below: b.n === 'Earth', pos: lp(() => V(b.pos.x, b.pos.y, b.pos.z)) }; labels.push(b.label); });
  labels.push({ text: 'Moon &middot; 384,400 km', right: true, z0: 10.3, z1: 11.5, rpx: () => 2, pos: () => { const X = ctx.shared.earthX, e = byName.Earth.pos.clone().applyQuaternion(qInner); return X ? e.add(V(X.moon[0], X.moon[1], X.moon[2])) : e; } });
  labels.push({ text: 'Toward the Sun &middot; 150 million km', z0: 10.3, z1: 11.5, rpx: () => 6, pos: lp(() => sunRayTip.clone()) });
  [['Ganymede', 'Ganymede'], ['Titan', 'Titan']].forEach(([k, t]) => { const m = MOONS.find((q) => q.n === k); labels.push({ text: t + ' &middot; moon', z0: 12.0, z1: 12.6, rpx: () => 3, pos: lp(() => V(m.wp.x, m.wp.y, m.wp.z)) }); });
  // belt labels sit on the structure they name: a point on the belt's mid-radius, picked toward the upper left of the screen
  labels.push({ text: 'Asteroid belt &middot; 2.1&ndash;3.3 AU', z0: 11.7, z1: 13.4, rpx: () => 0, pos: lp(() => { tmpL.copy(camU).multiplyScalar(-0.8).addScaledVector(camR, 0.6); tmpL.y = 0; if (tmpL.lengthSq() < 1e-4) tmpL.set(-1, 0, 0); return tmpL.normalize().multiplyScalar(3.3 * AU).clone(); }) });
  labels.push({ text: 'Kuiper belt &middot; 30&ndash;50 AU', z0: 12.9, z1: 14.3, rpx: () => 0, right: true, pos: lp(() => { tmpL.copy(camR).multiplyScalar(-0.85).addScaledVector(camU, -0.4); tmpL.y = 0; if (tmpL.lengthSq() < 1e-4) tmpL.set(-1, 0, 0); return tmpL.normalize().multiplyScalar(41 * AU).clone(); }) });
  const pl = smalls.find((s) => s.n === 'Pluto'); if (pl) labels.push({ text: 'Pluto', z0: 13.0, z1: 13.8, rpx: () => 3, pos: lp(() => V(pl.pos.x, pl.pos.y, pl.pos.z)) });
  for (const [cn, lt, z0c, z1c] of [['Halley', 'Comet Halley', 12.4, 13.5], ['Encke', 'Comet Encke', 12.3, 12.8], ['67P', 'Comet 67P', 12.3, 12.8]]) { const co = smalls.find((s) => s.n === cn); if (co) labels.push({ text: lt, z0: z0c, z1: z1c, rpx: () => 3, right: true, pos: lp(() => V(co.pos.x, co.pos.y, co.pos.z)) }); }
  labels.push({ text: 'Planets, Mercury to Neptune (30 AU)', z0: 13.65, z1: 13.95, rpx: () => 0, right: true, pos: lp(() => { const n = byName.Neptune.pos; return V(n.x, n.y, n.z); }) });
  const capPt = (R0, sgn) => { const nUp = tmpL.copy(camU).addScaledVector(noseEcl, -camU.dot(noseEcl)); if (nUp.lengthSq() < 1e-6) nUp.set(0, 1, 0); nUp.normalize().multiplyScalar(sgn); const a = 58 * D2R; return noseEcl.clone().multiplyScalar(R0 * AU * Math.cos(a)).addScaledVector(nUp, R0 * AU * Math.sin(a)); };
  labels.push({ text: 'Heliopause &middot; ~120 AU', z0: 13.1, z1: 14.4, rpx: () => 0, pos: lp(() => capPt(121, 1)) });
  labels.push({ text: 'Nose &middot; the Sun plows this way at 26 km/s', z0: 13.3, z1: 14.4, amber: true, rpx: () => 0, pos: lp(() => noseEcl.clone().multiplyScalar(121 * AU)) });
  labels.push({ text: 'Heliotail &middot; streams out for hundreds of AU', z0: 13.5, z1: 14.4, right: true, rpx: () => 0, pos: lp(() => noseEcl.clone().multiplyScalar(-330 * AU)) });
  labels.push({ text: 'Termination shock &middot; ~94 AU', z0: 13.1, z1: 14.4, right: true, rpx: () => 0, pos: lp(() => capPt(92, -1)) });
  const v1 = craft.find((c) => c.n === 'Voyager 1'), v2 = craft.find((c) => c.n === 'Voyager 2');
  labels.push({ text: 'Voyager 1 &middot; 172 AU', z0: 12.9, z1: 14.4, amber: true, rpx: () => 12, pos: lp(() => V(v1.pos.x, v1.pos.y, v1.pos.z)) });
  labels.push({ text: 'Voyager 2 &middot; 144 AU', z0: 13.1, z1: 14.4, amber: true, right: true, rpx: () => 12, pos: lp(() => V(v2.pos.x, v2.pos.y, v2.pos.z)) });
  labels.push({ text: 'Jupiter Trojans', z0: 12.4, z1: 13.4, rpx: () => 0, pos: lp(() => { const j = byName.Jupiter.pos; return j.clone().applyAxisAngle(V(0, 1, 0), -Math.PI / 3); }) });

  // ------------------------------------------------------------------ per-frame
  const tmp2 = V(0, 0, 0), qs = new T.Quaternion(), Lw = V(0, 0, 0), Lo = V(0, 0, 0), mq = new T.Quaternion();
  const decode = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent; };
  let domDone = false;
  const wireDom = () => { const els = [...document.querySelectorAll('#tags .tag3')]; if (!els.length) return; let ok = 0; for (const l of labels) { const t = decode(l.text); l.el = els.find((e) => { const sp = e.querySelector('span'); return sp && sp.textContent === t; }); if (l.el) ok++; } domDone = ok === labels.length; };
  const tfOf = (l) => { const m = l.el.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/); return m ? [+m[1], +m[2]] : [0, 0]; };
  const x0of = (l) => tfOf(l)[0], y0of = (l) => tfOf(l)[1];
  const apply = (l, nx, dy) => { const sp = l.sp; if (nx >= 0) { sp.style.left = Math.round(nx * l.d) + 'px'; sp.style.right = 'auto'; } else { sp.style.right = Math.round(-nx * l.d) + 'px'; sp.style.left = 'auto'; } sp.style.top = (l.top0 + dy) + 'px'; };
  const placeLabels = () => { if (!domDone) wireDom(); for (const l of labels) { if (!l.el || l.el.style.display === 'none') continue; const r = l.rpx ? l.rpx() : 0, sp = l.el.querySelector('span'), dot = l.el.querySelector('i'); const off = Math.round(Math.max(r, 0) + 9);
    let nx = l.right ? -1 : 1, ny = 0;
    if (l.tangent) { const b = l.tangent, tx = b.vel.dot(camR), ty = b.vel.dot(camU), n = Math.hypot(tx, ty) || 1; nx = -ty / n; ny = tx / n; if ((ny < 0) !== !!l.below) { nx = -nx; ny = -ny; } if (Math.abs(nx) < 0.25) nx = nx < 0 ? -0.25 : 0.25; }
    if (!l.w) l.w = sp.offsetWidth; const m = l.el.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/); if (m && l.w) { const x = +m[1]; if (nx > 0 && x + off * nx + l.w > innerWidth - 10) nx = -Math.abs(nx) || -1; else if (nx < 0 && x - off * -nx - l.w < 10) nx = Math.abs(nx) || 1; }
    const d = ny ? off + 2 : off; l.nx = nx; l.d = d; l.top0 = Math.round(-ny * d - 10 * (1 - ny * 0.4)); l.bx = x0of(l); l.by = y0of(l); l.dot = dot; l.sp = sp; dot.style.display = r > 6 ? 'none' : ''; apply(l, nx, 0); }
    // collision pass: earlier labels keep their place; a later one that overlaps tries the other side, then steps up/down
    const placed = []; for (const l of labels) { if (!l.el || l.el.style.display === 'none' || l.d === undefined) continue; const w = l.w || 60, H = 17;
      const rect = (nx, dy) => { const x = nx >= 0 ? l.bx + nx * l.d : l.bx - (-nx) * l.d - w, y = l.by + l.top0 + dy; return [x, y, x + w, y + H]; };
      const hit = (r) => placed.some((q) => r[0] < q[2] + 3 && r[2] > q[0] - 3 && r[1] < q[3] + 1 && r[3] > q[1] - 1) || r[0] < 6 || r[2] > innerWidth - 6;
      const nx0 = l.nx, cands = [[nx0, 0], [-nx0 || -1, 0], [nx0, -17], [nx0, 17], [-nx0 || -1, -17], [-nx0 || -1, 17], [nx0, -34], [nx0, 34], [-nx0 || -1, 34], [-nx0 || -1, -34]]; let pick = cands[0];
      for (const cd of cands) { if (!hit(rect(cd[0], cd[1]))) { pick = cd; break; } }
      apply(l, pick[0], pick[1]); placed.push(rect(pick[0], pick[1])); } };
  const fmtX = (x) => x >= 1000 ? Math.round(x / 10) * 10 + '' : x >= 100 ? Math.round(x / 5) * 5 + '' : Math.round(x) + '';
  const upd = (t, S, z, c) => { placeLabels();
    const W = c.W, lpx = W / Math.max(1, innerWidth); st.W = W; st.pxScale = lpx; st.z = z; const d = t * DPS, jd = JD0 + d; const dp = dprEff();
    // align the real ephemeris with the plan: Earth must sit at plan.EARTHC for plan.sunPos(t)
    st.rotY = 0;
    // camera right/up in the inner frame (for label anchoring)
    qc.setFromEuler(eul.set(-plan.pitchAt(z), plan.yawAt(z, t), 0, 'YXZ')); camR.set(1, 0, 0).applyQuaternion(qc).applyQuaternion(qInnerInv); camU.set(0, 1, 0).applyQuaternion(qc).applyQuaternion(qInnerInv);
    // hand-off to the stars level, by geometry: the engine freezes this level's virtual camera at z 13.5, so every metre-sized thing (Sun, planets, orbits) simply shrinks on screen as the REAL zoom grows.
    // The few pixel-sized things (line widths, point sprites, glyphs) follow the same shrink as sub-pixel coverage: kv = projected size of the system relative to z 13.8 (a 1 px line on a 0.2 px orbit is 0.2 coverage).
    const pScale = group.parent ? group.parent.scale.x : 0, zr = pScale > 0 ? Math.log10(c.Wu / pScale) : z, kv = Math.pow(10, Math.min(0, 13.8 - zr)), ef = kv;
    // ---- sizes: one exaggeration for the planets, a smaller one for the Sun
    const sunPx = sunPxAt(z); const earthPx = earthPxAt(z);
    const rs = sunPx * lpx, Ep = earthPx * lpx / R_E; st.earthPx = earthPx; st.Ep = Ep; st.Es = rs / R_SUN; st.sunR = rs;
    sunMesh.scale.setScalar(rs); sunMesh.material.uniforms.uSpin.value = t * 0.06; sunMesh.material.uniforms.uTime.value = t;
    const ck = Math.max(CK * (1 - 0.35 * ss(11.9, 12.9, z)), 40 / sunPx); const cu = corona.material.uniforms; cu.uSize.value = rs * ck; cu.uK.value = ck; cu.uTime.value = t; cu.uGlow.value = (0.40 + 0.40 * ef) * (1 - 0.45 * ss(11.9, 12.9, z)); cu.uProm.value = ss(16, 34, sunPx);
    { const e0 = byName.Earth.pos, Lr = 0.17 * W, d0 = Math.hypot(e0.x, e0.y, e0.z); sunRayDir.copy(e0).multiplyScalar(-1 / d0); sunRayTip.copy(e0).addScaledVector(sunRayDir, Lr);
      const fr = 0; sunRay.visible = false; sunRay.position.copy(e0).addScaledVector(sunRayDir, 0.05 * W); sunRay.quaternion.setFromUnitVectors(V(1, 0, 0), sunRayDir); sunRay.scale.setScalar(Lr - 0.05 * W);
      sunRay.material.uniforms.uWidth.value = 1.6 * dp; sunRay.material.uniforms.uVis.value = fr * 1.0; sunRay.material.uniforms.uAlpha.value = 1.6; }
    // orbit lines: thick and bright near the subject of the frame (Earth, then the Sun), thinning away from it, so a huge ellipse reads as a curve in perspective and never as a ruler line
    { const Wr = Math.pow(10, zr), fz = ss(10.9, 12.3, z); const ex = byName.Earth.pos; const fx = ex.x * (1 - fz), fy = ex.y * (1 - fz), fzz = ex.z * (1 - fz);
      for (const r of ribbons) { const u = r.mesh.material.uniforms; u.uFoc.value.set(fx, fy, fzz); u.uFR.value = Math.max(0.6 * Wr, 1); u.uFK.value = 1.2 * (1 - ss(12.6, 13.4, z)); u.uFlo.value = 0.35; }
      const u = byName.Earth.orbit.mesh.material.uniforms, e = 1 - ss(10.9, 11.5, zr);   // while the orbit is still a short, nearly straight stretch it tapers out on both sides of Earth (a path trail, not a ruler)
      u.uFR.value = Math.max((0.6 - 0.34 * e) * Wr, 1); u.uFlo.value = 0.35 * (1 - e); u.uFK.value = 1.2 + 0.3 * e; u.uVis.value = Math.min(u.uVis.value, 1) * ss(9.2, 9.9, zr); }
    // ---- planets
    for (const b of BODIES) {
      const s = planetState(b.el, b.n === 'Earth' ? JD0 : jd, b.circle), p = toLocal(s.pos); b.pos.set(p[0], p[1], p[2]); b.pg.position.copy(b.pos); const s2 = planetState(b.el, (b.n === 'Earth' ? JD0 : jd) + 0.5, b.circle), p2 = toLocal(s2.pos); b.vel.set(p2[0] - p[0], p2[1] - p[1], p2[2] - p[2]);
      let rpx = earthPx * Math.pow(b.R / R_E, GAMMA); rpx = Math.max(FLOOR + 1.2 * (1 - ss(12.4, 13.6, z)), rpx); const r = rpx * lpx; b.pxr = rpx; const hide = b.n === 'Earth' || ef < 0.02 || (b.au < 2 && z > 13.7);
      b.mesh.visible = !hide; b.mesh.scale.setScalar(r); qs.setFromAxisAngle(yAxis, t * b.spin * 0.6 + 1.0); mq.copy(b.qPole).multiply(qs); b.mesh.quaternion.copy(mq);
      Lw.copy(b.pos).negate().normalize(); Lo.copy(Lw).applyQuaternion(mq.clone().invert()); b.mat.uniforms.uL.value.copy(Lo);
      if (b.ringMesh) b.ringMesh.material.uniforms.uL.value.copy(Lo);
      if (b.haloMesh) { const K = 1.3; b.haloMesh.visible = !hide; b.haloMesh.material.uniforms.uSize.value = r * K; b.haloMesh.material.uniforms.uK.value = K; b.haloMesh.material.uniforms.uSun.value.copy(Lw); b.haloMesh.material.uniforms.uLvl.value = b.halo[1] * ss(2, 6, b.pxr); }
      b.mAlpha = (1 - ss(2.6, 6, b.pxr)) * (hide ? 0 : 1) * ef; 
      b.orbit.mesh.material.uniforms.uPU.value = s.u; b.orbit.mesh.material.uniforms.uWidth.value = (b.n === 'Earth' ? 2.0 : 1.7) * dp; b.orbit.mesh.material.uniforms.uVis.value = ef * (b.au < 2 && b.n !== 'Earth' ? 1 - 0.8 * ss(12.5, 13.5, z) : 1) * ss(9.2, 9.9, zr);
    }
    for (const m of MOONS) {
      // the moon system is drawn at the planets' common exaggeration; once that is huge the moon is a dot at a compressed (but ordered) distance
      const pl2 = m.pl, rP = pl2.pxr * lpx, ex = rP / pl2.R, w = ss(1.5, 8, ex), ang = m.ph0 + (d / m.P) * 2 * Math.PI, kk = m.p === 'Earth' ? 0.3 : 0.55;
      const aD = m.a * (1 - w) + w * Math.max(rP * (1.6 + kk * Math.sqrt(m.a / pl2.R)), m.p === 'Earth' ? m.a : 0), rm = m.R * ex * (1 - w) + w * Math.max(m.R, 0.2 * rP * Math.pow(m.R / 1.74e6, 0.6) * (m.p === 'Earth' ? 1.35 : 1));
      const ox = Math.cos(ang) * aD, oz = Math.sin(ang) * aD; const vis = m.p === 'Earth' ? 0 : ss(5, 12, aD / lpx) * (1 - ss(13.0, 13.7, z)) * ef;
      m.mesh.position.set(ox, 0, oz); m.mesh.scale.setScalar(Math.max(rm, lpx * (m.p === 'Earth' ? 3.2 : 1.6))); m.mesh.visible = vis > 0.01; m.mesh.quaternion.identity();
      Lw.copy(pl2.pos).negate().normalize(); Lo.copy(Lw).applyQuaternion(m.og.quaternion.clone().invert()); m.mat.uniforms.uL.value.copy(Lo);
      const ringOn = m.p === 'Earth' ? 1 : 1 - w; // no concentric moon rings around the gas giants at system scale: just dots
      m.rib.visible = vis * ringOn > 0.01; m.rib.scale.setScalar(aD / m.a); m.rib.material.uniforms.uVis.value = vis * 0.5 * ringOn; m.rib.material.uniforms.uPU.value = ((ang / (2 * Math.PI)) % 1 + 1) % 1; m.rib.material.uniforms.uWidth.value = 1.1 * dp;
      tmp2.set(ox, 0, oz).applyQuaternion(m.og.quaternion); m.wp.set(pl2.pos.x + tmp2.x, pl2.pos.y + tmp2.y, pl2.pos.z + tmp2.z); m.mAlpha = vis * (1 - ss(1.2, 3, Math.max(rm, lpx * 1.6) / lpx)) * 0.9;
    }
    // ---- dwarf planets and comets
    for (const o of smalls) {
      const s = smallState(o.s, jd), p = toLocal(s.pos); o.pos.set(p[0], p[1], p[2]); o.orbit.mesh.material.uniforms.uPU.value = s.u; o.orbit.mesh.material.uniforms.uWidth.value = (o.kind === 'comet' ? 1.0 : 1.1) * dp; const fv = (o.kind === 'comet' ? ss(12.2, 12.8, z) * (o.n === 'Halley' ? 1 - ss(13.0, 13.6, z) : 1 - ss(12.6, 13.0, z)) : o.n === 'Ceres' ? ss(11.2, 11.9, z) : ss(12.4, 13.1, z)) * ef; o.orbit.mesh.material.uniforms.uVis.value = fv; o.orbit.mesh.visible = fv > 0.01; o.mAlpha = fv;
      if (o.kind === 'dwarf') { const rpx = Math.max(FLOOR * 0.9, earthPx * Math.pow(o.R / R_E, GAMMA)); o.mesh.visible = fv > 0.05; o.mesh.position.copy(o.pos); o.mesh.scale.setScalar(rpx * lpx); Lw.copy(o.pos).negate().normalize(); o.mat.uniforms.uL.value.copy(Lw); o.mAlpha = fv * (1 - ss(2.6, 6, rpx)); }
      if (o.kind === 'comet') { const rAU = o.pos.length() / AU; const act = 1 - ss(2.2, 4.5, rAU); const L = (24 + 56 * Math.min(1, 1.2 / rAU)) * lpx * act; o.tail.visible = L > lpx * 3 && fv > 0.01 && z < 12.85; if (o.tail.visible) { o.tail.position.copy(o.pos); Lw.copy(o.pos).normalize(); o.tail.quaternion.setFromUnitVectors(V(1, 0, 0), Lw); o.tail.scale.set(L, L, L); o.tail.material.uniforms.uWidth.value = 5 * dp; o.tail.material.uniforms.uAlpha.value = 0.55 * act * fv; } }
    }
    // craft move on from the Horizons epoch at their real speed
    for (const c of craft) { c.pos.set(c.p0[0] + c.v[0] * d, c.p0[1] + c.v[1] * d, c.p0[2] + c.v[2] * d); }
    // markers
    const mp = mG.attributes.position.array, ma = mG.attributes.alpha.array; markers.forEach((m, i) => { mp[i * 3] = m.pos.x; mp[i * 3 + 1] = m.pos.y; mp[i * 3 + 2] = m.pos.z; ma[i] = m.alpha; }); mG.attributes.position.needsUpdate = true; mG.attributes.alpha.needsUpdate = true; mMat.uniforms.uDpr.value = dp;
    // swarms: fade with density as the field widens
    for (const [sw, px] of swarms) { sw.material.uniforms.uDays.value = d; sw.material.uniforms.uPx.value = px * dp * Math.max(0.55, Math.sqrt(kv)); }
    swBelt.material.uniforms.uAlpha.value = 0.7 * (1 - 0.9 * ss(12.5, 13.6, z)) * ss(10.7, 11.5, z) * ef; swTroj.material.uniforms.uAlpha.value = 0.8 * (1 - ss(12.8, 13.5, z)) * ss(11.5, 12.2, z) * ef; swKuiper.material.uniforms.uAlpha.value = 1.0 * ss(11.9, 12.8, z) * ef; swCent.material.uniforms.uAlpha.value = 0.75 * ss(11.6, 12.4, z) * (1 - 0.6 * ss(13, 14, z)) * ef; swNeo.material.uniforms.uAlpha.value = 0.8 * ss(10.6, 11.2, z) * (1 - ss(11.8, 12.6, z)) * ef;
    swarms.forEach(([sw]) => { sw.material.uniforms.uAlpha.value *= kv; });   // dots thin out with the projected area (a cloud 3x smaller on screen carries ~10x fewer visible dots per pixel)
    // craft ribbons and glyphs
    const ip = iconGeo.attributes.position.array; let ia = 0;
    craft.forEach((c) => { const fc = (c.n.startsWith('Voyager') ? ss(12.2, 12.9, z) : ss(12.6, 13.3, z)) * ef; c.rib.material.uniforms.uWidth.value = (c.n.startsWith('Voyager') ? 1.15 : 0.9) * dp; c.rib.material.uniforms.uVis.value = fc * 0.55 * (0.3 + 0.7 * ss(12.9, 13.7, z)); c.rib.visible = fc > 0.01; c.mAlpha = fc * 0.5; if (c.n === 'Voyager 1') { ip[0] = c.pos.x; ip[1] = c.pos.y; ip[2] = c.pos.z; ia = Math.max(ia, ss(12.9, 13.4, z) * ef); } if (c.n === 'Voyager 2') { ip[3] = c.pos.x; ip[4] = c.pos.y; ip[5] = c.pos.z; } });
    iconGeo.attributes.position.needsUpdate = true; icons.visible = ia > 0.01; iconMat.uniforms.uDpr.value = dp; iconMat.uniforms.uA.value = ia; iconMat.uniforms.uSize.value = 15 * Math.pow(kv, 0.6);
    // heliosphere appears only once the field is wide enough to see its edge
    const hf = (z > 12.3 ? 1 : 0) * (1 - ss(14.6, 15.6, z)); hp.visible = ts.visible = hf > 0.01; hp.material.uniforms.uVis.value = hf; ts.material.uniforms.uVis.value = hf; slMesh.visible = false; slMesh.material.uniforms.uVis.value = 0; slMesh.material.uniforms.uPU.value = (t * 0.045) % 1; slMesh.material.uniforms.uWidth.value = 1.0 * dp;
    // the note (HUD margin): states the exaggeration honestly
    noteSeen = performance.now(); const txt = 'Sun and planets drawn far larger than true scale so they stay visible · orbits and distances are to scale';
    if (txt !== noteTxt) { noteTxt = txt; noteEl.textContent = txt; } 
  };
  return { group, anchorFn: () => { const o = (ctx.shared.earthX && ctx.shared.earthX.off) || [0, 0, 0]; return [SUNBASE[0] + o[0], SUNBASE[1] + o[1], SUNBASE[2] + o[2]]; }, labels, update: upd, zMin: 10.2, zMax: 14.4 };
}
