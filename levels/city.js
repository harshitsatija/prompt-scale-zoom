/* LEVEL city (z 1.7 .. 5.8): real Bangalore. See assets/city/SOURCES.md. Frame: HEAD frame (anchor [0,0,0]); local x east, z south, origin = her block (4th Main Road, Indiranagar),
 * map rotated 2.3 deg so her street runs along +x; ground plane y = ctx.geom.GROUND. */
import { loadData, makeProj } from './city/data.js';
import { makeTerrain } from './city/terrain.js';
import { buildNear } from './city/near.js';
import { buildRibbons, roadMaterial } from './city/roads.js';
import { buildTrees } from './city/trees.js';
import { buildBoxes, buildTowers, buildPolys, buildRail, liftPatch } from './city/mid.js';
import { publishCity, HERO_RECT, mirrorTree } from './city/handle.js';
import { buildRoute } from './earth/space.js';
import { buildLamps, buildTraffic, buildWifi, buildParked } from './city/fx.js';
export default async function build(ctx) {
  const { T, kit } = ctx, GROUND = ctx.geom.GROUND; const group = new T.Group(); const t0 = performance.now(); const lap = (n) => ctx.log('city', n, Math.round(performance.now() - t0) + 'ms');
  const D = await loadData(ctx); lap('data');
  const terrain = makeTerrain(ctx, D); group.add(terrain.mesh); lap('terrain');
  const withBuilding = !(ctx.params && ctx.params.get('only') && !ctx.params.get('only').split(',').includes('building')); const R_IN = 560, inHero = (x, z) => x > HERO_RECT[0] && x < HERO_RECT[1] && z > HERO_RECT[2] && z < HERO_RECT[3], nearIn = buildNear(ctx, D, terrain, (x, z) => Math.hypot(x, z) < R_IN && !(withBuilding && inHero(x, z))), near = buildNear(ctx, D, terrain, (x, z) => Math.hypot(x, z) >= R_IN); group.add(nearIn.group, near.group); lap('near');
  const rmat = roadMaterial(kit, T), RU = rmat.userData.U; const LU = RU; RU.uR0 = terrain.U.uR0; RU.uR1 = terrain.U.uR1;
  const wr = (w) => Math.hypot(D.roadPts[w.off * 2], D.roadPts[w.off * 2 + 1]);
  const roadSets = [(w) => w.tier === 0 && wr(w) >= R_IN, (w) => w.tier === 1, (w) => w.tier === 2, (w) => w.tier === 3, (w) => w.tier === 0 && wr(w) < R_IN];
  const roads = roadSets.map((sel, k) => { const m = buildRibbons(T, kit, D, sel, (x, z) => terrain.groundY(x, z) - GROUND, rmat, { lift: k === 0 || k === 4 ? 0.1 : 0.5 }); m.position.y = GROUND; group.add(m); return m; }); const roadIn = roads[4]; lap('roads');
  const trees = buildTrees(ctx, D, near, null, terrain); group.add(trees.hi, trees.mid, trees.midO, trees.lo); lap('trees ' + trees.count + ' hi/mid/lo ' + trees.nHi + '/' + trees.nMid + '/' + trees.nLo);
  const boxes = buildBoxes(ctx, D, terrain); group.add(boxes.mesh); lap('boxes ' + boxes.count);
  const towers = buildTowers(ctx, D, terrain); group.add(towers.mesh);
  const polys = buildPolys(ctx, D, terrain, LU, terrain.U); group.add(polys.water, polys.parks);
  const rail = buildRail(ctx, D, terrain, LU, terrain.U); group.add(rail.group);
  const lamps = buildLamps(ctx, D, terrain, false), lampsIn = buildLamps(ctx, D, terrain, true); group.add(lamps.points, lampsIn.points); lap('lamps ' + lamps.count);
  const parkIn = buildParked(ctx, D, terrain, true), parkOut = buildParked(ctx, D, terrain, false); group.add(parkIn.group, parkOut.group); lap('parked ' + (parkIn.count + parkOut.count));
  const traffic = buildTraffic(ctx, D, terrain); group.add(traffic.mesh); lap('traffic ' + traffic.count);
  const dome = kit.halo(0xffb070, 0); dome.scale.set(46000, 46000, 1); dome.position.set(-2500, terrain.groundY(-2500, 500) + 300, 500); dome.renderOrder = 6; dome.material.depthTest = false; group.add(dome);   // sodium-orange light dome of the lit core, only visible from orbit
  // hero marker that carries on from the building level (same ring + beam + dot, scaled with the field width) until the neighbourhood caption takes over
  const hero = new T.Group(); hero.position.set(0, GROUND + 0.4, 0); group.add(hero);
  const ringM = new T.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: T.DoubleSide }); const ringG = new T.RingGeometry(0.88, 1, 96); ringG.rotateX(-Math.PI / 2); const ring = new T.Mesh(ringG, ringM); ring.renderOrder = 20; hero.add(ring);
  const beamM = new T.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, side: T.DoubleSide, uniforms: { uA: { value: 0 } }, vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: 'varying vec2 vU; uniform float uA; void main(){ float x = abs(vU.x - 0.5) * 2.0; float a = (1.0 - x * x) * pow(max(1.0 - vU.y, 0.0), 1.6) * uA; if (!(a > 0.0005)) discard; gl_FragColor = vec4(1.0, 0.72, 0.28, a); }' });
  const bg = new T.PlaneGeometry(1, 1); bg.translate(0, 0.5, 0); const beam = new T.Group(); beam.add(new T.Mesh(bg, beamM)); const b2 = new T.Mesh(bg, beamM); b2.rotation.y = Math.PI / 2; beam.add(b2); beam.renderOrder = 19; hero.add(beam);
  const heroDot = kit.halo(0xffd9a0, 0.9); heroDot.renderOrder = 21; hero.add(heroDot);
  const wifi = buildWifi(ctx); group.add(wifi.group);
  // the prompt's route (the same arc the Earth level draws, built by the same code) is drawn here too while the city's ground covers the Earth's: it leaves the hero marker over the city and carries on out to the Earth level without a seam
  const routeG = new T.Group(); routeG.position.set(ctx.geom.EARTHC[0], ctx.geom.EARTHC[1] + 20, ctx.geom.EARTHC[2]); group.add(routeG); const route = buildRoute(ctx, routeG); const routeC = { W: 1 };
  await terrain.ready; lap('textures');
  const P = makeProj(D.meta), gy = (lat, lon, h = 0) => { const [x, z] = P(lat, lon); return new T.Vector3(x, terrain.groundY(x, z) + h, z); };
  const L = (text, lat, lon, z0, z1, o = {}) => { const v = gy(lat, lon, o.h || 30); return Object.assign({ text, z0, z1, pos: () => v }, o.right ? { right: true } : {}, o.amber ? { amber: true } : {}); };
  // anchor a label to the centroid of the largest named polygon (so it sits on the feature, not on an edge)
  const centroidOf = (list, re) => { let best = null, bn = 0; for (const f of list) { if (!f.n || !re.test(f.n)) continue; const r = f.r[0]; if (r.length > bn) { bn = r.length; best = r; } } if (!best) return null; let x = 0, z = 0; for (let i = 0; i < best.length; i += 2) { x += best[i]; z += best[i + 1]; } return [x / (best.length / 2), z / (best.length / 2)]; };
  const LP = (text, xz, z0, z1, o = {}) => { const v = new T.Vector3(xz[0], terrain.groundY(xz[0], xz[1]) + (o.h || 30), xz[1]); return Object.assign({ text, z0, z1, pos: () => v }, o.right ? { right: true } : {}, o.amber ? { amber: true } : {}); };
  const ul = centroidOf(D.misc.water, /Ulsoor|Halasuru/i) || (() => { const p = P(12.9833, 77.6195); return [p[0], p[1]]; })(), cp = centroidOf(D.misc.green, /Cubbon/i) || (() => { const p = P(12.9763, 77.5929); return [p[0], p[1]]; })();
  const rw = D.misc.aero.filter((a) => a.t === 'runway' && Math.hypot(a.p[0] - 2782, a.p[1] - 2882) < 3500).sort((p, q) => Math.hypot(q.p[0] - q.p[2], q.p[1] - q.p[3]) - Math.hypot(p.p[0] - p.p[2], p.p[1] - p.p[3]))[0]; const halMid = rw ? [(rw.p[0] + rw.p[2]) / 2, (rw.p[1] + rw.p[3]) / 2] : [2782, 2882];
  const majestic = P(12.9767, 77.5713); // city centre: Majestic / Vidhana Soudha, west of Cubbon Park
  const labels = [
    LP('Indiranagar', [0, 0], 2.9, 4.1, { h: 26 }),   // her block is the origin
    LP('Ulsoor Lake', ul, 3.3, 4.7, { h: 20 }), LP('Cubbon Park', cp, 3.5, 4.9, { h: 20 }),
    LP('Bangalore', [majestic[0], majestic[1]], 4.3, 5.8, { h: 200 }),
    LP('Outer Ring Road', [6037, 3141], 3.9, 5.3, { h: 8, right: true }),
    L('Whitefield (ITPL)', 12.9852, 77.7375, 4.0, 5.5, { h: 80, right: true }), L('Manyata Tech Park', 13.0476, 77.6200, 4.1, 5.3, { h: 80 }),
    L('Electronic City', 12.8452, 77.6602, 4.0, 5.5, { h: 80 }),
    LP('HAL airport', halMid, 3.5, 4.8, { h: 30, right: true }), L('Yelahanka Air Force Station', 13.1359, 77.6048, 4.2, 5.4, { h: 60 }), L('Hosur aerodrome (TAAL)', 12.6622, 77.7703, 4.6, 5.1, { h: 100, right: true }),
    L('Kempegowda Intl. Airport', 13.1986, 77.7066, 4.3, 5.9, { h: 120, right: true }),
    L('Hosur', 12.7409, 77.8253, 5.0, 5.8, { h: 300, right: true }), L('Tumakuru', 13.3392, 77.1140, 5.2, 5.8, { h: 300 })];
  const tmp = new T.Vector3(); const sst2 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function update(t, S, z, c) {
    // the engine clamps z to zMax-0.9 for a nested level; the city is the Earth's surface at higher resolution, so past that point it keeps following the REAL camera (real pixel size, real zoom)
    let W = c.W, zz = z; { const rs = group.parent ? group.parent.scale.x : 0, Wr = rs > 0 && c.Wu ? c.Wu / rs : W; if (Wr > W * 1.001) { W = Wr; zz = Math.log10(Wr); } } const pm = W / 1600;
    terrain.link(zz, pm);
    { const g = sst2(4.3, 5.0, zz); routeG.visible = zz > 4.2 && zz < 5.6; if (routeG.visible) { route.gain = g; route.shadow.material.opacity = 0.38 * g * g; routeC.W = W; route.update(routeC, S, t); const rv = 1; route.glow.visible = route.shadow.visible = true; } }
    RU.uMin.value = Math.max(0, pm * 0.85); RU.uLift.value = Math.min(60, pm * 0.28 + 0.0);
    terrain.U.uPx.value = pm; { const ov = 1 - sst2(4.9, 5.5, zz); terrain.U.uR1.value = 4e5; terrain.U.uR0.value = 3e5; terrain.U.uAlpha.value = 1; terrain.U.uOv.value = ov; RU.uAlpha.value = ov; rail.mats.forEach((m) => { m.userData.U.uAlpha.value = ov; }); terrain.mesh.visible = zz < 5.5; } polys.U.uT.value = t; polys.U.uPx.value = pm; parkOut.group.visible = zz < 3.1; parkIn.group.visible = zz < 3.1 && !((window.__levels && window.__levels.includes('building')) && zz < 3.4); for (const n of [near, nearIn]) n.mat.userData.U.uPx.value = pm; const far = Math.min(1, Math.max(0, (zz - 3.0) / 1.0)); const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    boxes.mat.userData.KU.uKH.value = 1 - 0.6 * sst(3.9, 4.5, zz); towers.mat.userData.KU.uKH.value = 1 - 0.97 * sst(3.8, 4.5, zz); rail.pierU.uWid.value = Math.min(7, Math.max(1, pm * 0.7)); rail.piers.visible = zz < 4.3; rail.stations.visible = zz > 2.6 && zz < 4.6; rail.group.visible = zz < 5.0 && !(ctx.params && ctx.params.has('noaero')); near.mat.userData.U.uFar.value = far; nearIn.mat.userData.U.uFar.value = far; boxes.mat.userData.U.uFar.value = far; towers.mesh.material.userData.U.uFar.value = far; boxes.mat.userData.U.uPx.value = pm; towers.mesh.material.userData.U.uPx.value = pm; 
    rail.mats.forEach((m) => { m.userData.U.uMin.value = RU.uMin.value; m.userData.U.uLift.value = RU.uLift.value * 1.2; });
    // the building level draws the same neighbourhood inside r < 560 m for z < 3.4 (see requests/city.md); when it is loaded, my inner copy yields to it
    const yield_ = false;  // never yield: both levels draw one shared set of objects (see the mirror at the end of build)
    nearIn.group.visible = zz < 4.35; roadIn.visible = zz < 4.8; lampsIn.points.visible = zz < 3.6;
    near.group.visible = zz < 4.35; for (const n of [near, nearIn]) n.tanks.visible = n.heads.visible = n.panels.visible = zz < 3.0; trees.hi.visible = zz < 3.0 && !yield_; trees.mid.visible = zz < 3.5 && !yield_; trees.midO.visible = zz < 3.5; trees.lo.visible = zz > 2.5 && zz < 4.0; boxes.mesh.visible = zz > 2.6 && zz < 4.5; towers.mesh.visible = zz > 3.4 && zz < 4.5;
    roads[0].visible = zz < 4.8; roads[1].visible = zz < 3.9; roads[2].visible = zz < 5.1; lamps.points.visible = zz < 3.6; lamps.points.material.size = lampsIn.points.material.size = Math.max(2.5, Math.min(9, 8 - (zz - 2) * 1.7)); lamps.points.material.opacity = lampsIn.points.material.opacity = 0.95 * (1 - Math.min(1, Math.max(0, (zz - 3.0) / 0.55)));
    dome.visible = false;   // no sodium-light dome: the Earth's own night texture carries the glow
    { const a = sst2(3.2, 3.45, zz) * (1 - sst2(4.3, 4.9, zz)); hero.visible = false; if (false) { const br = Math.max(14, W * 0.03); ring.scale.setScalar(br * (1 + 0.04 * Math.sin(t * 2))); ringM.opacity = 0.75 * a; const rb = Math.max(0.6, W * 0.0028); beam.scale.set(rb * 2.4, W * 0.4, rb * 2.4); beamM.uniforms.uA.value = 0.5 * a; heroDot.scale.set(br * 1.6, br * 1.6, 1); heroDot.material.opacity = 0.8 * a; } }
    traffic.mesh.visible = zz > 1.8 && zz < 4.9; if (traffic.mesh.visible) traffic.update(t, pm);
    wifi.group.visible = zz < 4.0 && !(ctx.params && ctx.params.has('nowifi')); if (wifi.group.visible) wifi.update(S, pm);
  }
  { let tris = 0; group.traverse((o) => { if (o.geometry) { const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position.count) / 3; tris += n * (o.isInstancedMesh ? o.count : 1); } }); ctx.log('city triangles (all LODs, not all visible at once)', Math.round(tris)); const br = {}; const named = { terrain: terrain.mesh, nearIn: nearIn.group, near: near.group, trees_hi: trees.hi, trees_mid: trees.mid, trees_midO: trees.midO, trees_lo: trees.lo, boxes: boxes.mesh, towers: towers.mesh, polys_w: polys.water, polys_p: polys.parks, rail: rail.group, traffic: traffic.mesh }; roads.forEach((r, i) => { named['roads' + i] = r; }); for (const k in named) { let t = 0; named[k].traverse((o) => { if (o.geometry) { const g = o.geometry; t += (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); } }); br[k] = Math.round(t / 1000) + 'k'; } ctx.log('tri breakdown ' + JSON.stringify(br)); }
  // The building level (which sits on top of this one while her block is on screen) draws a mirror of this ENTIRE group: same geometry, same shader uniforms, same colours, nothing re-authored.
  // While that mirror is being drawn (building ran this frame) the originals are hidden, so the neighbourhood exists once on screen and cannot differ between the two levels.
  const H = { n: 0, seen: 0 }; const mir = mirrorTree(group);
  let hid = null; const restore = () => { if (hid) { group.children.forEach((ch, i) => { ch.visible = hid[i]; }); hid = null; } };
  const updateOuter = (t, S, z, c) => { restore(); update(t, S, z, c); if (H.n !== H.seen) { H.seen = H.n; hid = group.children.map((ch) => ch.visible); group.children.forEach((ch) => { ch.visible = false; }); } };
  publishCity({ group: mir.root, update: (t, S, z, c) => { restore(); update(t, S, z, c); mir.sync(); H.n++; } });
  return { group, anchor: [0, 0, 0], labels, update: updateOuter };
}
