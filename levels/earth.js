/* LEVEL earth (z 4.8 .. 10.4, EARTH frame): the real planet from orbit, the Moon, satellites, and the route of the prompt.
 * Real data: NASA Blue Marble NG + MODIS (colour), VIIRS Black Marble (night lights), MODIS true-colour (cloud deck), Terrarium/GEBCO-SRTM (relief,
 * bathymetry), NASA LRO WAC (Moon), NASA 3D Resources (ISS, comsats). See assets/earth/SOURCES.md. Build scripts: levels/earth/build/. */
import { R_E, dir, POLE, E1, E2, norm, cross, dot, PLACES } from './earth/frame.js';
import { SUN as SUN_H, MOONDIR as MOON_H, NECL, earthPx, ss as ssH } from './earth/handoff.js';
import { buildPlanet } from './earth/planet.js';
import { buildMoon, buildSats, makeRing, placeRing, buildStarShell, buildRoute, orbitBasis, orbitPos, MOON_D, MOON_R, GEO_R, ISS_R, ISS_W, LEO_R } from './earth/space.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// Sun for 6 Oct, 23:02 IST = 17:32 UTC: the real sub-solar point is lat -5.6 (early-October declination), lon -83 (the terminator, 90 deg away, runs along 7 E: Arabia,
// East Africa, Madagascar and the whole Indian Ocean are in night showing their lights; only West Africa and the Atlantic are lit).
export const SUN = SUN_H;

// Moon: 6 Oct 2026 is 4 days before new moon (new 10 Oct), a waning crescent ~50 deg from the sun; slightly north of the ecliptic
export const MOONDIR = MOON_H;

export default async function build(ctx) {
  const { T, kit } = ctx; const group = new T.Group();
  const uni = { sun: { value: new T.Vector3(...SUN) }, moonDir: { value: new T.Vector3(...MOONDIR) }, cam: { value: new T.Vector3(0, 1.3, 0) }, cloudRot: { value: 0 }, time: { value: 0 }, detailK: { value: 0 }, px: { value: 1000 } };
  const planet = await buildPlanet(ctx, group, uni); const moon = buildMoon(ctx, group, uni, SUN, MOONDIR);
  const sats = await buildSats(ctx, group, SUN); const route = buildRoute(ctx, group);
  const shell = buildStarShell(ctx, group);
  // orbit rings
  const issRing = makeRing(ctx, group, 240, 0x7fe3c4, 0.4), geoRing = makeRing(ctx, group, 240, 0xa9b0ff, 0.55), moonRing = makeRing(ctx, group, 240, 0xcfd6ff, 0.7);
  const nO = NECL; let mp = MOONDIR.slice(); { const k = dot(mp, nO); mp = norm([mp[0] - k * nO[0], mp[1] - k * nO[1], mp[2] - k * nO[2]]); }
  const moonBasis = { A: mp, B: cross(nO, mp) }, geoBasis = orbitBasis(0, 0);
  const ringTex = kit.canvasTex(64, 64, (c) => { c.clearRect(0, 0, 64, 64); c.strokeStyle = '#ffffff'; c.lineWidth = 3.5; c.beginPath(); c.arc(32, 32, 27, 0, Math.PI * 2); c.stroke(); });
  const mkMark = (col) => { const sp = new T.Sprite(new T.SpriteMaterial({ map: ringTex, color: col, transparent: true, depthTest: false, depthWrite: false, opacity: 0, fog: false })); sp.frustumCulled = false; sp.renderOrder = 20; group.add(sp); return sp; };
  const issHalo = ctx.kit.halo(0xcfe8ff, 0), geoHalos = sats.geo.map(() => ctx.kit.halo(0xcfe8ff, 0)); group.add(issHalo); geoHalos.forEach((h) => group.add(h));
  const bMark = ctx.kit.halo(0xffe2a8, 0), bRing = null, eHalo = ctx.kit.halo(0x6f8cff, 0); group.add(eHalo); eHalo.renderOrder = 8; group.add(bMark); bMark.renderOrder = 22;
  const bLabel = new T.Vector3(), leader = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false })); leader.frustumCulled = false; leader.renderOrder = 21; group.add(leader);
  const moonMark = mkMark(0xcfd6ff), earthMark = mkMark(0x7fe3c4), upL = new T.Vector3(), rightL = new T.Vector3();
  // data-centre marker (illustrative: Singapore interconnect hub)
  const dc = new T.Group(); const dcMat = kit.toon(0x12a595, { glow: 0x7fe3c4, glowK: 0.8 }); for (let i = 0; i < 3; i++) { const b = new T.Mesh(kit.unitBox, dcMat); b.scale.set(1, 0.3, 1.6); b.position.set((i - 1) * 1.15, 0.15 + i * 0.0, 0); dc.add(b); }
  dc.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(...route.b)); dc.position.copy(route.pts[route.N]); group.add(dc);

  // camera position in level-local metres (the engine puts the camera at (0,0,16) in root space; root = rotation * scale; level group is offset by anchor - focus)
  const qi = new T.Quaternion(), cv = new T.Vector3(), tmp = new T.Vector3(), tmp2 = new T.Vector3(), qm = new T.Quaternion(), mm = new T.Matrix4();
  const issPos = new T.Vector3(), geoLabel = new T.Vector3(...dir(0, 40)).multiplyScalar(GEO_R), moonLabel = new T.Vector3(), earthLabel = new T.Vector3(), distLabel = new T.Vector3();
  const brk = new T.LineSegments(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(new Float32Array(18), 3)), new T.LineBasicMaterial({ color: 0xcfd6ff, transparent: true, opacity: 0, depthTest: false, depthWrite: false })); brk.frustumCulled = false; brk.renderOrder = 21; group.add(brk);
  const trail = new T.Line(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(new Float32Array(30 * 3), 3)).setAttribute('color', new T.BufferAttribute(new Float32Array(30 * 3), 3)), new T.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false })); trail.frustumCulled = false; trail.renderOrder = 15; group.add(trail);
  const off = [0, 0, 0]; const EC = ctx.geom.EARTHC; const lead = new T.LineSegments(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(new Float32Array(12), 3)), new T.LineBasicMaterial({ color: 0xcfd6ff, transparent: true, opacity: 0, depthTest: false, depthWrite: false })); lead.frustumCulled = false; lead.renderOrder = 21; group.add(lead);
  const geoBand = makeRing(ctx, group, 240, 0xa9b0ff, 0.10); geoBand.material.depthWrite = false; geoBand.renderOrder = 3;
  const X = ctx.shared.earthX = { off, moon: [0, 0, 0], rE: R_E }; let nestRnow = 4.2e8;
  return {
    group, anchorFn: () => [EC[0] + off[0], EC[1] + off[1], EC[2] + off[2]], get nestR() { return nestRnow; },
    labels: [
      { text: 'Bangalore · 12.97° N', z0: 5.9, z1: 6.7, pos: () => bLabel, amber: true },
      { text: 'Western Ghats', z0: 5.9, z1: 7.0, pos: () => tmp2.set(...dir(12.0, 75.75)).multiplyScalar(R_E + 1200), right: false },
      { text: 'Deccan Plateau', z0: 5.9, z1: 6.75, pos: () => tmp2.set(...dir(14.5, 77.9)).multiplyScalar(R_E + 500), right: true },
      { text: 'Himalaya', z0: 6.0, z1: 7.7, pos: () => tmp2.set(...dir(28.6, 84.0)).multiplyScalar(R_E + 3000) },
      { text: 'Indian Ocean', z0: 6.3, z1: 7.8, pos: () => tmp2.set(...dir(-8.0, 76.0)).multiplyScalar(R_E) },
      { text: 'Data centre · illustrative', z0: 5.9, z1: 7.4, pos: () => tmp2.copy(route.pts[route.N]), right: true, amber: true },
      { text: 'ISS · 109 m (not to scale)', z0: 5.9, z1: 7.2, pos: () => issPos, right: true },
      { text: 'Geostationary ring · 35,786 km', z0: 7.9, z1: 9.25, pos: () => geoLabel },
      { text: 'Earth · 12,742 km (drawn enlarged)', z0: 9.0, z1: 10.35, pos: () => earthLabel },
      { text: 'The Moon · 3,474 km (drawn enlarged)', z0: 8.8, z1: 10.35, pos: () => moonLabel, right: true },
      { text: '384,400 km · 30 Earth widths', z0: 8.9, z1: 10.35, pos: () => distLabel },
    ],
    update(t, S, zClamped, c0) {
      // the engine clamps z to zMax-0.9 for a nested level; the Earth is one body that keeps being drawn all the way out, so use the real camera
      const root = group.parent, sR = root.scale.x, W = c0.Wu / sR, z = Math.log10(W), s = sR; const c = Object.assign({}, c0, { W, z, s });
      const DBG0 = 0; const DBG = (ctx.params && ctx.params.get('dbg') || '').split(',');
      // camera -> level-local
      const pxm = W / Math.max(window.innerWidth || 1600, 320);
      // Earth and Moon are drawn enlarged (to ~21 / 20 px) once they would be only a few pixels wide; orbits and distances stay true
      const escl = 1 + (Math.max(1, 2 * earthPx(z) * pxm / (2 * R_E)) - 1) * ssH(8.7, 9.2, z); planet.pg.scale.setScalar(escl);   // drawn Earth radius in px = earthPx(z), the same table the solar planets use
      // Moon: same 1.4x as before, true orbit while it clears the (enlarged) Earth, then pushed out to ~4 Earth radii so it never sinks into the globe
      const rPm = R_E * escl, pk = 6, aD = Math.pow(Math.pow(MOON_D, pk) + Math.pow(3.9 * rPm, pk), 1 / pk);
      const mscl0 = escl * (1 + 0.4 * ssH(8.7, 9.2, z)), mrad = Math.max(MOON_R * mscl0, 2.3 * pxm) * (1 - ssH(12.3, 12.9, z)) + 1e-3, mscl = mrad / MOON_R;
      const MA = moonBasis.A; moon.pos.set(MA[0] * aD, MA[1] * aD, MA[2] * aD); X.moon[0] = moon.pos.x; X.moon[1] = moon.pos.y; X.moon[2] = moon.pos.z;
      const pairK = ssH(8.9, 9.7, z) * (1 - ssH(10.0, 10.7, z));   // frame the Earth-Moon pair, then let the Earth settle back on the focus
      // camera framing for the Earth -> Sun hand-over: the engine's own focus slide (ss 10.6..12.8) is too late, so the whole Earth+Sun pair (both levels hang on this offset) is panned along the Earth-Sun line:
      // the camera centre sits 0.24 field widths toward the Sun (Earth stays framed in the opposite corner) until the Sun's own distance is smaller than the field, then the slide finishes the job (P -> 0 at z 12.8)
      const AUm = 1.495978707e11, eng = ssH(10.6, 12.8, z), pTot = Math.max(eng, (1 - Math.exp(-0.24 * W / AUm)) * ssH(9.8, 10.8, z)), Pk = (pTot - eng) * AUm;
      off[0] = -0.5 * MA[0] * MOON_D * pairK - Pk * SUN[0]; off[1] = -0.5 * MA[1] * MOON_D * pairK - Pk * SUN[1]; off[2] = -0.5 * MA[2] * MOON_D * pairK - Pk * SUN[2]; moon.mesh.scale.setScalar(mscl); moon.halo.position.copy(moon.pos);
      nestRnow = Math.max(4.2e8, 1.2 * aD + 4 * mrad, 2.6 * rPm);
      qi.copy(root.quaternion).invert(); cv.set(0, 0, 16).applyQuaternion(qi).divideScalar(root.scale.x).sub(group.position); uni.cam.value.set(cv.x / R_E / escl, cv.y / R_E / escl, cv.z / R_E / escl);
      uni.cloudRot.value = t * 0.0022; uni.time.value = t; uni.px.value = pxm / escl;
      planet.update(c, z);
      upL.set(0, 1, 0).applyQuaternion(qi); rightL.set(1, 0, 0).applyQuaternion(qi);
      const erP = Math.max(R_E * escl / pxm, 4), mrP = Math.max(MOON_R * mscl / pxm, 3);
      moonLabel.copy(moon.pos).addScaledVector(rightL, -(mrP + 24) * pxm).addScaledVector(upL, -(mrP + 30) * pxm); earthLabel.set(0, 0, 0).addScaledVector(rightL, (erP + 24) * pxm).addScaledVector(upL, -(erP + 30) * pxm);
      lead.visible = false; brk.visible = false;   // no leader lines or brackets drawn inside the 3D scene (they read as pasted annotation / a faint box)
      distLabel.copy(moon.pos).multiplyScalar(0.5).addScaledVector(upL, (erP + 36) * pxm).addScaledVector(rightL, -6 * pxm);
      moonMark.position.copy(moon.pos); moonMark.scale.setScalar(48 * pxm); moonMark.material.opacity = 0; earthMark.scale.setScalar(44 * pxm); earthMark.material.opacity = 0;
      { const eh = 2 * R_E * escl * 2.0; eHalo.scale.set(eh, eh, 1); eHalo.material.opacity = 0.30 * ss(8.6, 9.4, z) * (1 + 0.6 * ss(9.4, 10.0, z)); }
      // Bangalore callout: a ring on the city, a leader line to a label offset away from the white-hot core
      { const k = ss(6.9, 6.3, z) * ss(5.7, 6.0, z); const bp = dir(...PLACES.majestic); const bx = bp[0] * (R_E + 40), by = bp[1] * (R_E + 40), bz = bp[2] * (R_E + 40);   // the same lat/lon the city level labels 'Bangalore' (its lit core)
        bMark.position.set(bx, by, bz); { const pu = 1 + 0.12 * Math.sin(t * 3.2); bMark.scale.setScalar(40 * pxm * pu); bMark.material.opacity = 0.9 * k; }
        const bo = 26; bLabel.set(bx, by, bz).addScaledVector(rightL, -bo * pxm).addScaledVector(upL, bo * 0.7 * pxm); const a = leader.geometry.attributes.position; a.setXYZ(0, bx, by, bz); a.setXYZ(1, bLabel.x, bLabel.y, bLabel.z); a.needsUpdate = true; leader.visible = k > 0.02; leader.material.opacity = 0.7 * k; }
      // ISS (real orbital speed) — enlarged icon for legibility
      const u = sats.issU0 + ISS_W * (t - 6); orbitPos(sats.issOrbit, ISS_R, u, issPos);
      const vel = tmp.set(0, 0, 0).copy(orbitPos(sats.issOrbit, 1, u + 0.01, new T.Vector3())).sub(orbitPos(sats.issOrbit, 1, u, new T.Vector3())).normalize(); const up = issPos.clone().normalize(), nrm = new T.Vector3().crossVectors(vel, up);
      mm.makeBasis(nrm, up, vel.clone().negate()); sats.iss.quaternion.setFromRotationMatrix(mm); sats.iss.position.copy(issPos);
      const issVis = ss(7.9, 7.3, z); sats.iss.userData.holder.scale.setScalar(sats.iss.userData.unit * Math.max(W * 0.030 / sats.iss.userData.real, 1) * issVis + 1e-9); sats.iss.visible = z < 7.95; { const ih = Math.max(W * 0.030, 109) * 2.4; issHalo.position.copy(issPos); issHalo.scale.set(ih, ih, 1); issHalo.material.opacity = 0.40 * issVis * ss(5.4, 6.0, z); }
      { const tp = trail.geometry.attributes.position, tc = trail.geometry.attributes.color, span = Math.min(0.5, W * 0.05 / ISS_R); for (let i = 0; i < 30; i++) { orbitPos(sats.issOrbit, ISS_R, u - span * (i / 29), tmp); tp.setXYZ(i, tmp.x, tmp.y, tmp.z); const f = Math.pow(1 - i / 29, 1.6); tc.setXYZ(i, 1.0 * f, 0.78 * f, 0.45 * f); } tp.needsUpdate = tc.needsUpdate = true; trail.material.opacity = 0.9 * issVis * ss(5.4, 6.0, z); trail.visible = issVis > 0.01; }
      // GEO comsats (fixed over their longitudes)
      const gs = ss(8.9, 8.3, z), gk = Math.max(W * 0.036, 36) ; const camD = Math.max(cv.length(), 1); for (const g of sats.geo) { g.dk = Math.min(1.6, tmp.copy(g.m.position).sub(cv).length() / camD); g.m.userData.holder.scale.setScalar(g.m.userData.unit * gk * g.dk / g.m.userData.real * gs + 1e-9); g.m.visible = z > 7.4 && gs > 0.01 && !(DBG.some((q) => q.startsWith('hide') && g.i === +q.slice(4))); g.m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(...g.d)); }
      sats.geo.forEach((g, i) => { g.i = i; const h = geoHalos[i]; h.position.copy(g.m.position); const hs = gk * g.dk * 1.8; h.scale.set(hs, hs, 1); h.material.opacity = (DBG.includes('nohalo') ? 0 : 0.22) * gs * ss(7.4, 7.9, z); });
      // rings: ~1.2 px wide
      const rw = W * 0.0007;
      issRing.visible = z > 7.9 && z < 8.3; if (issRing.visible) placeRing(ctx, issRing, sats.issOrbit, ISS_R, rw * 0.6, 1);
      geoRing.visible = z > 7.3 && z < 10.15;   // from ~10.0 the enlarged Earth is wider than the GEO ring: the globe has swallowed it (depth-occluded, not faded)
       if (geoRing.visible) placeRing(ctx, geoRing, geoBasis, GEO_R, rw);
      geoBand.visible = z > 7.9 && z < 9.0; if (geoBand.visible) placeRing(ctx, geoBand, geoBasis, GEO_R, rw * 5);
      moonRing.visible = z > 8.2 && rw * 1.2 * (1 - ssH(12.2, 12.9, z)) > 1e-3 * W; if (moonRing.visible) placeRing(ctx, moonRing, moonBasis, aD, rw * 1.2 * (1 - ssH(12.2, 12.9, z)) + 1e-3);
      shell.pts.visible = z > 6.3 && z < 8.8; if (shell.pts.visible) { shell.update(t * 30); shell.pts.material.opacity = 0.5 * ss(6.3, 6.7, z) * (z < 7.3 ? 1 : 1 - 0.55 * ss(7.3, 7.9, z)) * ss(8.8, 8.3, z); shell.pts.material.size = 1.5; }   // the Starlink-like shell is only a hint at the whole-disc scale; from further out its dots read as noise on the globe
      // Moon: true size; a soft halo marks it once it is smaller than a few pixels
      const mk = 1 - ssH(12.3, 12.9, z), mh = Math.max(W * 0.012 * mk, MOON_R * 2 * mscl * 2.4) * ss(8.3, 9.4, z); moon.halo.scale.set(mh, mh, 1); moon.halo.material.opacity = 0.32 * ss(8.3, 9.4, z) * mk; moon.mesh.visible = z > 7.9 && mk > 0.01;
      route.gain = ss(4.3, 5.0, z); route.shadow.material.opacity = 0.38 * route.gain * route.gain; route.update(c, S, t); dc.scale.setScalar(Math.max(W * 0.0022, 500)); const rv = ss(8.4, 7.5, z); dc.visible = z > 5.4 && z < 8.4; route.glow.visible = route.shadow.visible = z < 8.4 && z > 4.2; route.im.visible = route.halo1.visible = route.halo2.visible = route.flare.visible = z < 8.4; route.halo1.material.opacity *= rv; route.halo2.material.opacity *= rv; route.flare.material.opacity *= rv; dc.scale.multiplyScalar(0.4 + 0.6 * rv);
      if (DBG.includes('daysun')) uni.sun.value.set(0.25, 0.85, 0.45).normalize();
      if (DBG[0]) { if (DBG.includes('nogeo')) sats.geo.forEach((g) => { g.m.visible = false; }); if (DBG.includes('nodc')) dc.visible = false; if (DBG.includes('noroute')) { route.im.visible = false; route.halo1.visible = route.halo2.visible = route.flare.visible = false; } if (DBG.includes('nomoon')) moon.mesh.visible = false; if (DBG.includes('noshell')) shell.pts.visible = false; if (DBG.includes('norings')) issRing.visible = geoRing.visible = moonRing.visible = false; if (DBG.includes('noplanet')) { planet.layers.forEach((L) => { L.mesh.visible = false; }); planet.clouds.visible = planet.atmo.visible = false; } }
    },
  };
}
