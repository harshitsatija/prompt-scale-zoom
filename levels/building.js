/* LEVEL building (z 1.0 .. 3.4): her apartment block (S+7, cutaway cell on floor 3), the street and the real Indiranagar neighbourhood from OpenStreetMap.
 * HEAD frame, anchor [0,0,0]; street runs along +x with the road to +z (south), north = -z. See levels/building/*.js and assets/building/SOURCES.md. */
import { GB, rng, lin } from './building/gb.js';
import * as TX from './building/tex.js';
import { buildHero, buildStilt, GROUND, FL, X0, X1, ZF, ZB, SLAB } from './building/hero.js';
import * as P from './building/props.js';
import { buildMetro, buildTrain, DECK } from './building/metro.js';
import { makeSkyline } from './person/skyline.js';
import { cityHandle } from './building/../city/handle.js';
import { decode, buildRoads, buildBuildings, buildInfill, buildTrees, streetZ, roadHalfWidth } from './building/hood.js';

export default async function build(ctx) {
  const { T, kit } = ctx; const group = new T.Group(); group.name = 'building';
  const D = decode(await ctx.fetchJSON('building/neighbourhood.json')); const R = rng(2024);
  const SZ = streetZ(D); const KERB = SZ - roadHalfWidth({ c: 'residential' }); const WALLZ = Math.min(13.9, KERB - 1.8);
  // ---------------- materials ----------------
  const plV = TX.plasterTex(true), plF = TX.plasterTex(false), asph = TX.asphaltTex(), blk = TX.blockTex(), acg = TX.acGrilleTex();
  const mVC = kit.toon(0xffffff, { vc: true, map: plV }), mFlat = kit.toon(0xffffff, { vc: true, map: plF }), mPlain = kit.toon(0xffffff, { vc: true });
  const pave = TX.paveTex(), earth = TX.earthTex(); const mRoad = kit.toon(0xffffff, { vc: true, map: asph }), mFoot = kit.toon(0xffffff, { vc: true, map: pave }), mCourt = kit.toon(0xffffff, { vc: true, map: pave }), mMark = kit.toon(0xffffff, { vc: true });
  mRoad.polygonOffset = true; mRoad.polygonOffsetFactor = -2; mRoad.polygonOffsetUnits = -2; mFoot.polygonOffset = true; mFoot.polygonOffsetFactor = -1; mFoot.polygonOffsetUnits = -1; mMark.polygonOffset = true; mMark.polygonOffsetFactor = -4; mMark.polygonOffsetUnits = -4;
  const mBlk = kit.toon(0xffffff, { vc: true, map: blk }); blk.repeat.set(1, 1);
  const mLit = new T.MeshBasicMaterial({ vertexColors: true }), mGlass = new T.MeshBasicMaterial({ vertexColors: true });
  const mProp = kit.toon(0xffffff, { vc: true, map: acg });
  const tiles = [0, 1, 2, 3].map((v) => { const t = TX.facadeTiles(v); return { gb: new GB(), mat: kit.toon(0xffffff, { vc: true, map: t.map, emissiveMap: t.emissive, glow: 0xffffff, glowK: 0.8 }) }; });
  const mStain = kit.toon(0xffffff, { vc: true, map: TX.stainTex() }); mStain.transparent = true; mStain.depthWrite = false; mStain.polygonOffset = true; mStain.polygonOffsetFactor = -3; mStain.polygonOffsetUnits = -3;
  const mk = (gb, mat, name) => { if (!gb.n) return null; const m = new T.Mesh(gb.geometry(), mat); m.frustumCulled = false; m.userData.name = name; return m; };

  // ---------------- GB sets ----------------
  const B = { stain: new GB(), vc: new GB(), lit: new GB(), glass: new GB(), prop: new GB(), tile: tiles[0].gb, cell: new GB(), cellLit: new GB() };
  const Wb = { vc: new GB(), lit: B.lit, glass: B.glass, roof: new GB(), tiles: tiles.map((t) => t.gb) };
  const G = { road: new GB(), foot: new GB(), mark: new GB() }; const court = new GB(); court.uvs = 0.5;
  const stat = { vc: new GB(), lit: new GB(), blk: new GB() };         // street furniture (near)
  // ---- hero block
  const { Ry } = buildHero(R, B); buildStilt(R, B);
  // textured side + back walls (facade tile with lit windows) so the exposed flanks read as real building
  { const t = tiles[0].gb, yA = FL(1) - SLAB - 0.0, yB = FL(8), u = (z) => z / 12, vv = (y) => (y - (FL(1) - SLAB)) / 12.8; const tint = '#b3b1d9';
    t.quad([X0 - 0.02, yA, ZB], [X0 - 0.02, yA, ZF], [X0 - 0.02, yB, ZF], [X0 - 0.02, yB, ZB], tint, { uv: [[u(ZB), vv(yA)], [u(ZF), vv(yA)], [u(ZF), vv(yB)], [u(ZB), vv(yB)]] });
    t.quad([X1 + 0.02, yA, ZF], [X1 + 0.02, yA, ZB], [X1 + 0.02, yB, ZB], [X1 + 0.02, yB, ZF], tint, { uv: [[u(ZF), vv(yA)], [u(ZB), vv(yA)], [u(ZB), vv(yB)], [u(ZF), vv(yB)]] });
    t.quad([X1, yA, ZB - 0.02], [X0, yA, ZB - 0.02], [X0, yB, ZB - 0.02], [X1, yB, ZB - 0.02], tint, { uv: [[1, vv(yA)], [3, vv(yA)], [3, vv(yB)], [1, vv(yB)]] }); }
  { const y = GROUND + 0.03; court.quad([X0 - 1.5, y, 2.5], [X0 - 1.5, y, WALLZ - 0.15], [X1 + 1.5, y, WALLZ - 0.15], [X1 + 1.5, y, 2.5], '#ffffff'); }
  // ---- street, neighbours
  // neighbourhood, roads, ground and trees come from the city level's own objects (mirrored below): one world, one look
  const info = { tanks: [], count: 0, near: 0, shopSigns: [] }; const infill = { tanks: [], houses: [], n: 0 }; R(); R();
  // ---- Namma Metro viaduct + Indiranagar station (real OSM ways), a moving train
  const MV = new GB(), ML = new GB(), TV = new GB(), TL = new GB(); let metro = null; let trainL = 66;
  
  // context grade: far buildings/roads/ground fall off in value and saturation so the hero block carries the highest contrast
  { const grade = (gb, r0, r1, kMin, sat) => { const P = gb.P, C = gb.C, n = P.length / 3; for (let i = 0; i < n; i++) { const d = Math.hypot(P[i * 3], P[i * 3 + 2]); const t = Math.min(1, Math.max(0, (d - r0) / (r1 - r0))); const tt = t * t * (3 - 2 * t); const k = 1 - (1 - kMin) * tt; const l = 0.3 * C[i * 3] + 0.59 * C[i * 3 + 1] + 0.11 * C[i * 3 + 2]; const sa = 1 - sat * tt; C[i * 3] = (l + (C[i * 3] - l) * sa) * k; C[i * 3 + 1] = (l + (C[i * 3 + 1] - l) * sa) * k; C[i * 3 + 2] = (l + (C[i * 3 + 2] - l) * sa) * (k * 1.02); } };
    tiles.forEach((t) => grade(t.gb, 60, 620, 0.92, 0.06)); grade(Wb.vc, 60, 620, 0.92, 0.06); grade(Wb.roof, 60, 620, 0.92, 0.06); grade(G.road, 40, 620, 0.92, 0.06); grade(G.foot, 40, 620, 0.92, 0.06); }
  // ---- compound wall, gate, booth, pole + cable network, lamps
  const gateX = [-2.4, 2.4];
  const signTex = TX.shopSign('ಶ್ರೀ ಸಾಯಿ ರೆಸಿಡೆನ್ಸಿ', 'SRI SAI RESIDENCY · 24 FLATS', '#1f2a6b', '#ffe9a8', true);
  const signMat = kit.toon(0xffffff, { map: signTex, emissiveMap: signTex, glow: 0xffffff, glowK: 0.5 }); const signGeo = new T.PlaneGeometry(1.9, 0.5);
  const signMesh = new T.Mesh(signGeo, signMat); signMesh.position.set(gateX[0] - 1.6, GROUND + 1.3, WALLZ + 0.2); group.add(signMesh);
  { const rt = TX.signTex(1024, 160, (x, w, h) => { x.fillStyle = '#1f2a6b'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffd166'; x.fillRect(0, 0, w, 8); x.fillRect(0, h - 8, w, 8); x.fillStyle = '#fff3d6'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '700 60px "Kannada Sangam MN","Kannada MN",Arial,sans-serif'; x.fillText('ಶ್ರೀ ಸಾಯಿ ರೆಸಿಡೆನ್ಸಿ', w * 0.27, h * 0.52); x.font = '700 48px "Helvetica Neue",Arial,sans-serif'; x.fillText('SRI SAI RESIDENCY', w * 0.74, h * 0.52); });
    const rm = new T.Mesh(new T.PlaneGeometry(7.4, 1.16), kit.toon(0xffffff, { map: rt, emissiveMap: rt, glow: 0xffffff, glowK: 0.5 })); rm.position.set(-4.2, Ry + 0.6, ZF + 0.09); /* no readable rooftop sign */ }
  P.addCompound(stat.vc, stat.blk, stat.lit, null, -14.5, 14.5, WALLZ, gateX);
  P.addBooth(stat.vc, stat.lit, gateX[1] + 1.6, WALLZ - 1.2);
  // poles on the south footpath, cables along the street, a service drop to the block
  const poleZ = SZ + roadHalfWidth({ c: 'residential' }) + 1.0, poleXs = []; for (let x = -16 - 28 * 6; x <= 16 + 28 * 10; x += 28) poleXs.push(x);
  const arms = poleXs.map((x) => P.addPole(stat.vc, x, poleZ, 8.6)); const cableR = [0.022, 0.018, 0.02, 0.018, 0.026, 0.02, 0.03];
  const kinds = ['#1a1a28', '#242438', '#1a1a28', '#303046', '#1a1a28', '#242438', '#303046'];
  for (let i = 0; i < poleXs.length - 1; i++) for (let k = 0; k < 7; k++) { const a = arms[i][k], b = arms[i + 1][k]; stat.vc.tube(P.sag(a, b, 0.35 + 0.15 * (k % 3), 10), cableR[k], kinds[k], { seg: 4 }); }
  // service drop from the pole near x=12 (index) to the lift core bracket, plus a fat telecom/cable-TV bundle to the facade
  const poleNear = poleXs.reduce((p, x) => Math.abs(x - 12) < Math.abs(p - 12) ? x : p, 1e9), pi = poleXs.indexOf(poleNear);
  stat.vc.tube(P.sag(arms[pi][5], [11.9, FL(3) + 0.5, ZF + 0.3], 0.5, 14), 0.03, '#1a1a28', { seg: 4 }); stat.vc.tube(P.sag(arms[pi][4], [11.2, FL(3) + 0.6, ZF + 0.3], 0.6, 14), 0.02, '#303046', { seg: 4 }); stat.vc.tube(P.sag(arms[pi][2], [10.5, FL(2) + 2.5, ZF + 0.3], 0.5, 14), 0.02, '#1a1a28', { seg: 4 });
  stat.vc.box(11.5, FL(3) + 0.5, ZF + 0.18, 0.4, 0.3, 0.1, '#4d4d68');
  const lampGlows = [];
  for (let x = -60; x <= 70; x += 30) { const p = P.addLamp(stat.vc, stat.lit, x + 6, poleZ + 0.6, 1); lampGlows.push(p); }
  // vehicles parked on the kerbs (south side) and inside the stilt
  const rickCols = [['#2e9c63', '#f2c13a'], ['#2e9c63', '#f2c13a'], ['#34a853', '#f4c542']];
  P.addRickshaw(stat.vc, stat.lit, { x: -8.5, y: GROUND, z: SZ - 2.3, ry: 0.05, green: '#262633', yellow: '#f2c13a' }); P.addRickshaw(stat.vc, stat.lit, { x: -5.6, y: GROUND, z: SZ - 2.2, ry: -0.04, green: '#f2c01e', yellow: '#23232f' });  P.addRickshaw(stat.vc, stat.lit, { x: 24, y: GROUND, z: SZ + 2.0, ry: Math.PI - 0.05, green: rickCols[1][0] });
  P.addCar(stat.vc, stat.lit, { x: -30, y: GROUND, z: SZ + 2.4, ry: 0.0, color: '#c9ced9' }); P.addCar(stat.vc, stat.lit, { x: 38, y: GROUND, z: SZ - 2.0, ry: Math.PI, color: '#7d86c9' });
  P.addCar(stat.vc, stat.lit, { x: -8.2, y: GROUND, z: 8.3, ry: Math.PI / 2, color: '#c9ced9' }); P.addCar(stat.vc, stat.lit, { x: -4.6, y: GROUND, z: 8.0, ry: Math.PI / 2 - 0.05, color: '#6d78c4' }); P.addCar(stat.vc, stat.lit, { x: 8.4, y: GROUND, z: 7.6, ry: Math.PI / 2 + 0.04, color: '#e8e6f0' });
  for (let i = 0; i < 6; i++) P.addScooter(stat.vc, { x: 5.2 + i * 1.0, y: GROUND, z: WALLZ - 1.0, ry: Math.PI / 2 + (R() - 0.5) * 0.3, color: ['#c9453d', '#3b5fb5', '#1e1e2a', '#d9a441', '#8d8aa8', '#2d8a58'][i] });
  const SC = ['#c9453d', '#3b5fb5', '#1e1e2a', '#d9a441', '#8d8aa8', '#2d8a58', '#c9453d'];
  for (let i = 0; i < 9; i++) P.addScooter(stat.vc, { x: -10.5 + i * 1.15 + (i > 4 ? 6 : 0), y: GROUND, z: -3.8 - (i % 2) * 1.5, ry: Math.PI / 2 + (R() - 0.5) * 0.4, color: SC[i % SC.length] });
  P.addCar(stat.vc, stat.lit, { x: -6, y: GROUND, z: -9.5, ry: Math.PI / 2, color: '#d6d4e6' }); P.addCar(stat.vc, stat.lit, { x: 0, y: GROUND, z: -9.5, ry: Math.PI / 2, color: '#a9c3d8' });
  // parked scooters and cars along the kerbs of the near streets (north kerb of 4th Main and the real side lanes within 110 m), potholes and tar patches on the carriageway
  { const SC2 = ['#c9453d', '#3b5fb5', '#1e1e2a', '#d9a441', '#8d8aa8', '#2d8a58', '#e8e2d2'], CC = ['#c9ced9', '#7d86c9', '#d6d4e6', '#a9c3d8', '#c9453d', '#e8e2d2'];
    for (let x = -100; x <= 100; x += 3.7) { const h = Math.abs(Math.sin(x * 12.3 + 4.1) * 9371.3) % 1; if (Math.abs(x) < 9 || h < 0.3) continue; const side = h > 0.62 ? 1 : -1; const zz = SZ + side * (roadHalfWidth({ c: 'residential' }) - 0.9);
      if (h > 0.9) P.addCar(stat.vc, stat.lit, { x, y: GROUND, z: zz, ry: Math.PI / 2 * (side > 0 ? 1 : -1) + 0.04, color: CC[Math.floor(h * 97) % CC.length] }); else P.addScooter(stat.vc, { x, y: GROUND, z: zz, ry: Math.PI / 2 + (h - 0.5) * 0.5, color: SC2[Math.floor(h * 131) % SC2.length] }); }
    const patch = (x, z, w, d, col, ry = 0) => G.mark.box(x, GROUND + 0.135, z, w, 0.01, d, col, { ry });
    [[-20, SZ + 0.8, 3.2, 1.6], [-7, SZ - 1.5, 2.2, 3.0], [4, SZ + 1.5, 2.8, 2.0], [14, SZ - 0.6, 3.6, 1.5], [26, SZ + 0.9, 2.4, 2.6]].forEach(([x, z, w, d], i) => patch(x, z, w, d, '#2d2b45', i * 0.1));
    [[-13, SZ + 1.2, 0.8], [-2.2, SZ + 0.4, 0.55], [9, SZ - 1.4, 0.7], [19, SZ + 1.6, 0.9], [-26, SZ - 0.6, 0.6]].forEach(([x, z, r0]) => { for (let k = 0; k < 3; k++) patch(x, z, r0 * 1.5, r0 * 0.9, k === 0 ? '#201e36' : '#201e36', k * 1.05); G.mark.box(x, GROUND + 0.137, z, r0 * 1.1, 0.01, r0 * 0.5, '#4a4a68', { ry: 0.3 }); });
    // kerb stones on both sides of our street
  }
  // fix the car/rickshaw base height: ground
  // ---------------- merge into meshes ----------------
  const near = new T.Group(); const far = new T.Group(); group.add(far, near); const meshes = {};
  const add = (g, m, mat, name, to = far) => { const o = mk(m, mat, name); if (o) { to.add(o); meshes[name] = o; } };
  // shift vehicles/props that were authored at y=0 to GROUND: build them into groups with an offset
  add(null, B.stain, mStain, 'heroStain'); add(null, B.vc, mVC, 'heroVC'); add(null, B.lit, mLit, 'heroLit'); add(null, B.glass, mGlass, 'heroGlass'); add(null, B.prop, mProp, 'heroProp'); add(null, tiles[0].gb, tiles[0].mat, 'heroTile');
  add(null, court, mCourt, 'court'); add(null, G.road, mRoad, 'roads'); add(null, G.foot, mFoot, 'foot'); add(null, G.mark, mMark, 'marks'); add(null, Wb.vc, mVC, 'nearBuildings'); add(null, Wb.roof, mFlat, 'roofs');
  tiles.slice(1).forEach((t, i) => add(null, t.gb, t.mat, 'tile' + (i + 1)));
  // (Wb.lit / Wb.glass are the same GBs as B.lit / B.glass: already added as heroLit / heroGlass)
  add(null, MV, mVC, 'metro'); add(null, ML, mLit, 'metroLit');
  const cellGroup = new T.Group(); cellGroup.userData.name = 'cellStandIn'; group.add(cellGroup); { const a = mk(B.cell, mVC, 'cell'), b = mk(B.cellLit, mLit, 'cellLit'); a && cellGroup.add(a); b && cellGroup.add(b); }
  // the night skyline seen through her window: the very same view the person level draws (levels/person/skyline.js), same place
  const sky = makeSkyline(ctx); sky.group.position.set(0, FL(3) + 1.4, -2.43); sky.group.scale.z = 0.2; cellGroup.add(sky.group);
  const train = new T.Group(); { const a = mk(TV, mVC, 'train'), b = mk(TL, mLit, 'trainLit'); a && train.add(a); b && train.add(b); far.add(train); train.visible = false; }
  const onlyMode = (ctx.params && ctx.params.get && ctx.params.get('only') === 'building');
  add(null, stat.vc, mVC, 'street', near); add(null, stat.lit, mLit, 'streetLit', near); add(null, stat.blk, mBlk, 'wall', near);
  // vehicles authored at y = 0 need the ground offset: stat.vc contains them already in world y (we passed y: 0 for rickshaws/cars) -> lift the whole vehicles via y param below
  const lawnLater = {};
  // ---------------- ground plane (alpha-faded disc) ----------------
  const alpha = kit.canvasTex(256, 256, (x, w, h) => { const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, '#fff'); g.addColorStop(0.7, '#fff'); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const gtex = earth; gtex.repeat.set(1000, 1000);
  const gmat = kit.toon(0xa49cc0, { map: gtex, alphaMap: alpha }); gmat.polygonOffset = true; gmat.polygonOffsetFactor = 2; gmat.polygonOffsetUnits = 2; gmat.depthWrite = true;
  const ground = new T.Mesh(new T.CircleGeometry(1500, 64), gmat); ground.rotation.x = -Math.PI / 2; ground.position.y = GROUND - 0.01; ground.renderOrder = -1;
  { const lm = kit.toon(0xffffff, { vc: true }); lm.polygonOffset = true; lm.polygonOffsetFactor = -1; lm.polygonOffsetUnits = -1; lawnLater.mat = lm; }
  // ---------------- trees (instanced) ----------------
  const trees = []; [[-11.6, 10.2, 0.26, 1], [11.9, 11.0, 0.24, 0], [-13.4, 3.6, 0.3, 1], [13.6, 4.4, 0.28, 0]].forEach(([x, z, s, kind]) => trees.push({ x, z, s, kind, ry: R() * 6, d: 5 })); const tg = { 0: [P.treeGeo(0, 0), P.treeGeo(0, 1)], 1: [P.treeGeo(1, 0), P.treeGeo(1, 1)], 2: [P.treeGeo(2, 0), P.treeGeo(2, 1)] };
  // vacant plots (no OSM footprint, no infill house, clear of roads): grass, weeds and rain-tree / gulmohar stands instead of bare earth
  const lawnGB = new GB(); { const CS = 6, lc = ['#8fb572', '#a3bf78', '#7fae6a', '#b3b872', '#98b06a']; let nT = 0;
    const pip = (x, z, p) => { let c2 = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if (((p[i][1] > z) !== (p[j][1] > z)) && (x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0])) c2 = !c2; return c2; };
    const segs = []; D.r.forEach((r) => { const hw = roadHalfWidth(r) + 2.2; for (let i = 0; i < r.p.length - 1; i++) segs.push([r.p[i][0], r.p[i][1], r.p[i + 1][0], r.p[i + 1][1], hw]); });
    const dseg = (x, z, g) => { const dx = g[2] - g[0], dz = g[3] - g[1]; const L2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - g[0]) * dx + (z - g[1]) * dz) / L2)); return Math.hypot(x - (g[0] + dx * t), z - (g[1] + dz * t)) - g[4]; };
    const bb = D.b.map((b2) => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; b2.p.forEach((q) => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }); return [x0 - 1.5, x1 + 1.5, z0 - 1.5, z1 + 1.5, b2.p]; });
    for (let gx = 0; gx < 0; gx += CS) for (let gz = 0; gz < 0; gz += CS) { const x = gx + CS / 2, z = gz + CS / 2; if (Math.hypot(x, z) > 200) continue; if (Math.abs(x) < 17 && z > -28 && z < 75) continue;
      let bad = false; for (const g of infill.houses) if (Math.abs(g[0] - x) < g[2] + 3 && Math.abs(g[1] - z) < g[2] + 3) { bad = true; break; } if (bad) continue;
      for (const q of bb) if (x > q[0] - 3 && x < q[1] + 3 && z > q[2] - 3 && z < q[3] + 3 && (pip(x, z, q[4]) || pip(x - 3, z, q[4]) || pip(x + 3, z, q[4]) || pip(x, z - 3, q[4]) || pip(x, z + 3, q[4]))) { bad = true; break; } if (bad) continue;
      for (const g of segs) if (Math.abs(g[0] - x) < 90 && dseg(x, z, g) < CS * 0.75) { bad = true; break; } if (bad) continue;
      const hh = (Math.sin(gx * 12.9 + gz * 78.2) * 43758.5) % 1; const u = Math.abs(hh); const y = GROUND + 0.04;
      lawnGB.quad([x - CS / 2, y, z + CS / 2], [x + CS / 2, y, z + CS / 2], [x + CS / 2, y, z - CS / 2], [x - CS / 2, y, z - CS / 2], lc[Math.floor(u * lc.length) % lc.length]);
      if (u > 0.3 && nT < 160 && Math.abs(x) > 21) { nT++; trees.push({ x: x + (u - 0.6) * 3, z: z + (u * 7 % 1 - 0.5) * 3, s: 0.45 + (u * 13 % 1) * 0.4, kind: u > 0.8 ? 1 : 0, ry: u * 40, d: Math.hypot(x, z) }); } } }
  const treeMat = kit.toon(0xffffff, { vc: true });
  ctx.log('lawn quads', lawnGB.n / 4, 'trees', trees.length); { const lo = mk(lawnGB, lawnLater.mat, 'lawn'); if (lo) far.add(lo); }
  const groups = {}; trees.forEach((t) => { const lod = t.d < 90 ? 0 : 1; (groups[t.kind + '_' + lod] = groups[t.kind + '_' + lod] || []).push(t); });
  Object.entries(groups).forEach(([k, arr]) => { const [kind, lod] = k.split('_').map(Number); const im = kit.inst(tg[kind][lod].geometry(), treeMat, arr.length); const c = new T.Color(); arr.forEach((t, i) => { const sc = t.kind === 2 ? t.s : t.s * 0.85; kit.put(im, i, t.x, GROUND, t.z, sc, sc, sc, 0, t.ry, 0); c.set(0xffffff).multiplyScalar(0.8 + R() * 0.3); im.setColorAt(i, c); }); im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; far.add(im); });
  // ---------------- roof tanks on neighbours (instanced Sintex tanks) ----------------
  { const TC = ['#26253a', '#26253a', '#2d5aa8', '#e8e2d2', '#26253a', '#3f7a5a']; TC.forEach((col, ci) => { const list = info.tanks.filter((t) => Math.min(TC.length - 1, Math.floor(t[3] * TC.length)) === ci); if (!list.length) return; const tg1 = new GB(); P.addTankFarm(tg1, 0, 0, 0, col); const im = kit.inst(tg1.geometry(), treeMat, list.length); list.forEach((t, i) => kit.put(im, i, t[0], t[1], t[2], 1 + t[3] * 0.4, 1 + t[3] * 0.4, 1 + t[3] * 0.4, 0, t[3] * 6, 0)); far.add(im); }); }
  // ---------------- shop signs (near) ----------------
  { const names = [['ಶ್ರೀ ಕೃಷ್ಣ ಸ್ಟೋರ್ಸ್', 'SRI KRISHNA PROVISIONS', '#b3261e', '#fff3d6'], ['ಮೆಡಿಕಲ್ಸ್', 'APOLLO MEDICALS · 24 HRS', '#12805c', '#ffffff'], ['ಇಡ್ಲಿ ಹೋಟೆಲ್', 'MTR IDLI HOTEL · TIFFIN', '#c9791a', '#fff8e0'], ['ಬೇಕರಿ', 'IYENGAR BAKERY', '#7a3b6b', '#ffe9a8'], ['ಹಾಲು ಕೇಂದ್ರ', 'NANDINI MILK PARLOUR', '#1f4fa8', '#ffffff'], ['ಸಲೂನ್', 'GENTS SALON', '#233', '#ffd166']];
    info.shopSigns.slice(0, 28).forEach((s, i) => { const n = names[i % names.length]; const tex = TX.shopSign(n[0], n[1], n[2], n[3], true); const m = new T.Mesh(new T.PlaneGeometry(s.w, s.w / 4), kit.toon(0xffffff, { map: tex, emissiveMap: tex, glow: 0xffffff, glowK: 0.55 })); m.position.set(s.px, s.py + 2.65, s.pz); m.rotation.y = s.ry; near.add(m); m.translateZ(0.12); }); }
  // ---------------- the moving auto-rickshaw (with headlamps) ----------------
  const rGB = new GB(), rLit = new GB(); P.addRickshaw(rGB, rLit, { lamps: true, green: '#f2c01e', yellow: '#23232f' });
  const rick = new T.Group(); rick.add(mk(rGB, mVC, 'rick'), mk(rLit, mLit, 'rickLit')); near.add(rick); const rickHalo = kit.halo(0xfff2c8, 0.8); rickHalo.scale.set(3.4, 3.4, 1); near.add(rickHalo);
  // vehicles authored without ground offset: lift the static street vehicles by wrapping? (we gave y=0 but ground is -10.4): handled by building them into a lifted group
  near.position.y = 0;
  // (the sectioned cut faces of her cell now live in person/shell.js and are built by the hero block: one shell for both levels)
  const poolTex = kit.canvasTex(128, 128, (x, w, h) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,205,130,0.85)'); g.addColorStop(0.5, 'rgba(255,170,90,0.28)'); g.addColorStop(1, 'rgba(255,170,90,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  lampGlows.forEach((p) => { const m = new T.Mesh(new T.PlaneGeometry(15, 15), new T.MeshBasicMaterial({ map: poolTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.8 })); m.rotation.x = -Math.PI / 2; m.position.set(p[0], GROUND + 0.09, p[2] + 0.5); m.renderOrder = 3; near.add(m); });
  // ---------------- signal: wi-fi shells + packet ----------------
  const shells = [0, 1, 2].map(() => { const holder = new T.Group(); holder.position.set(0, FL(3) + 0.9, ZF + 0.1); holder.visible = false; holder.userData.mats = [];
    [0.32, 0.55, 0.8].forEach((th, i) => { const mat = new T.MeshBasicMaterial({ color: 0xffa33a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }); const m = new T.Mesh(new T.TorusGeometry(Math.sin(th), 0.012, 6, 96), mat); m.position.z = Math.cos(th); m.frustumCulled = false; holder.add(m); holder.userData.mats.push(mat); });
    holder.userData.name = 'shell'; near.add(holder); return holder; });
  const pathPts = [new T.Vector3(0, FL(3) + 0.9, ZF + 0.05), new T.Vector3(8, FL(3) + 2.2, ZF + 1.0), new T.Vector3(11.2, FL(3) + 0.6, ZF + 0.35), ...(() => { const a = arms[pi][5]; return P.sag(a, a.map((v, i) => i === 0 ? v : v), 0, 1).map((v) => new T.Vector3(...v)); })()];
  for (let i = pi + 1; i < poleXs.length; i++) pathPts.push(new T.Vector3(...arms[i][5]));
  const pathCum = [0]; for (let i = 1; i < pathPts.length; i++) pathCum.push(pathCum[i - 1] + pathPts[i].distanceTo(pathPts[i - 1])); const PL = pathCum[pathCum.length - 1];
  const at = (s) => { s = Math.max(0, Math.min(PL, s)); let i = 1; while (i < pathCum.length - 1 && s > pathCum[i]) i++; const f = (s - pathCum[i - 1]) / (pathCum[i] - pathCum[i - 1] || 1); return pathPts[i - 1].clone().lerp(pathPts[i], f); };
  const pk = kit.halo(0xffb347, 1); pk.scale.set(2.2, 2.2, 1); near.add(pk); const pk2 = kit.halo(0x7fe3c4, 1); pk2.scale.set(2.2, 2.2, 1); near.add(pk2); const trail = []; for (let i = 0; i < 6; i++) { const h = kit.halo(0xffb347, 0.5); h.scale.set(1.2, 1.2, 1); near.add(h); trail.push(h); }
  // lamp halos
  const halos = lampGlows.map((p) => { const h = kit.halo(0xffe2a8, 0.7); h.position.set(...p); h.scale.set(3.2, 3.2, 1); near.add(h); return h; });
  const gateHalos = [[gateX[0] - 0.15, GROUND + 2.62, WALLZ], [gateX[1] + 0.15, GROUND + 2.62, WALLZ]].map((p) => { const h = kit.halo(0xffe2a8, 0.6); h.position.set(...p); h.scale.set(1.2, 1.2, 1); near.add(h); return h; });
  const herHalo = kit.halo(0xffc46b, 0.5); herHalo.position.set(0, FL(3) + 0.9, ZF + 0.3); herHalo.userData.name = 'herhalo'; group.add(herHalo); const herHalo2 = kit.halo(0xfff0cf, 0.5); herHalo2.position.copy(herHalo.position); herHalo2.userData.name = 'herhalo'; group.add(herHalo2);
  const beacon = new T.Mesh(new T.RingGeometry(0.9, 1, 96), new T.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, depthTest: false, side: T.DoubleSide })); beacon.renderOrder = 20; beacon.rotation.x = -Math.PI / 2; beacon.visible = false; group.add(beacon);
  // a vertical light shaft over her block and an expanding second pulse ring: the focal marker that persists from the block out to the 1.3 km view
  const beamTex = kit.canvasTex(64, 256, (x, w, h) => { const g = x.createLinearGradient(0, h, 0, 0); g.addColorStop(0, 'rgba(255,200,120,0.95)'); g.addColorStop(0.3, 'rgba(255,190,110,0.5)'); g.addColorStop(1, 'rgba(255,190,110,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.globalCompositeOperation = 'destination-in'; const gh = x.createLinearGradient(0, 0, w, 0); gh.addColorStop(0, 'rgba(0,0,0,0)'); gh.addColorStop(0.3, 'rgba(0,0,0,0.55)'); gh.addColorStop(0.5, 'rgba(0,0,0,1)'); gh.addColorStop(0.7, 'rgba(0,0,0,0.55)'); gh.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gh; x.fillRect(0, 0, w, h); });
  const beamMat = new T.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false });
  const beam = new T.Group(); { const pg = new T.PlaneGeometry(1, 1); const pa = pg.attributes.position; pa.setX(0, -0.16); pa.setX(1, 0.16); beam.add(new T.Mesh(pg, beamMat)); const m2 = new T.Mesh(pg, beamMat); m2.rotation.y = Math.PI / 2; beam.add(m2); beam.children.forEach((m) => { m.renderOrder = 19; m.frustumCulled = false; }); } beam.visible = false; beam.frustumCulled = false; group.add(beam);
  const ring2 = new T.Mesh(new T.RingGeometry(0.94, 1, 96), new T.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, depthTest: false, side: T.DoubleSide })); ring2.renderOrder = 20; ring2.rotation.x = -Math.PI / 2; ring2.visible = false; group.add(ring2);
  const dl = new T.Vector3(); const rickPos = new T.Vector3(0, GROUND, SZ - 1.7);
  // real OSM street-lamp nodes as warm glow points (visible from the street up to the neighbourhood scale)
  { const lp = new Float32Array(D.l.length * 3), lc = new Float32Array(D.l.length * 3); D.l.forEach((q, i) => { lp.set([q[0], GROUND + 8.6, q[1]], i * 3); lc.set([1.0, 0.8 + 0.1 * R(), 0.5], i * 3); }); const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.BufferAttribute(lp, 3)); lg.setAttribute('color', new T.BufferAttribute(lc, 3)); }
  // ---------------- labels ----------------
  const lab = (text, z0, z1, f, o = {}) => ({ text, z0, z1, pos: f, ...o });
  const hwy = D.r.filter((r) => r.c === 'primary').map((r) => r.p).flat().sort((a, b) => Math.hypot(a[0] + 200, a[1]) - Math.hypot(b[0] + 200, b[1]))[0];
  const labels = [
    lab('Her flat · 4th floor, 11 pm', 1.6, 2.2, () => new T.Vector3(2.95, FL(3) + 2.75, ZF + 0.3), { amber: true, right: true }),
    lab('Apartment block · stilt + 7 floors, 24 m wide', 1.7, 2.75, () => new T.Vector3(-12, FL(6) + 1, ZF)),
    lab('Water tanks, solar heaters, dishes', 1.8, 2.7, () => new T.Vector3(X1 - 1, Ry + 1.2, -5), { right: true, amber: true }),
    lab('Stilt parking: scooters and cars', 1.5, 2.5, () => new T.Vector3(-8, GROUND + 1.0, 1.5)),
    lab('Auto-rickshaw · 2.6 m long', 1.5, 2.35, () => rickPos.clone().setY(GROUND + 1.7), { right: true }),
    lab('Overhead cables: the prompt leaves here', 1.9, 3.0, () => new T.Vector3(12, FL(3) + 0.5, ZF + 0.3), { right: true, amber: true }),
    lab('4th Main Road, Indiranagar', 2.0, 3.2, () => new T.Vector3(-26, GROUND, SZ)),
    lab('Watchman’s booth', 1.4, 2.3, () => new T.Vector3(gateX[1] + 1.6, GROUND + 2.3, WALLZ - 1.2), { right: true }),
  ];
  if (metro) labels.push(lab('Namma Metro viaduct (Purple Line)', 2.6, 3.4, () => new T.Vector3(-300, DECK + 4, metro.zc + 1), { right: true }), lab('Indiranagar metro station', 2.75, 3.4, () => new T.Vector3(-415, DECK + 14, metro.zc + 12), { amber: false }));
  if (hwy) labels.push(lab('100 Feet Road', 2.7, 3.4, () => new T.Vector3(hwy[0], GROUND, hwy[1]), { right: true }));
  // ---------------- per-frame ----------------
  const dummy = new T.Vector3(); let lastZ = 0;
  const cityH = (ctx.params && ctx.params.get('only') && !ctx.params.get('only').split(',').includes('city')) ? null : await Promise.race([cityHandle, new Promise((r) => setTimeout(() => r(null), 90000))]); if (cityH) group.add(cityH.group);
  function update(t, S, z, c) {
    if (cityH) cityH.update(t, S, z, c);
    { const hd = new URLSearchParams(location.search).get('hide'); if (hd) group.traverse((o) => { if (hd.split(',').includes(o.userData && o.userData.name)) o.visible = false; }); }
    cellGroup.visible = onlyMode || z > 1.5; if (cellGroup.visible) sky.update(t, 1);
    { const fade = onlyMode ? 1 : Math.min(1, Math.max(0, (z - 1.55) / 0.5)); const hs = Math.max(3.2, c.W * 0.03); herHalo.scale.set(hs, hs, 1); herHalo.material.opacity = 0.34 * fade; herHalo2.scale.set(hs * 0.3, hs * 0.3, 1); herHalo2.material.opacity = 0.4 * fade;
      const hand = (() => { const u = Math.min(1, Math.max(0, (z - 3.2) / 0.25)); return 1 - u * u * (3 - 2 * u); })(); const bf = Math.min(1, Math.max(0, (z - 2.2) / 0.4)) * hand; const br = Math.max(14, c.W * 0.028); beacon.visible = bf > 0; beacon.position.set(0, GROUND + 0.4, 0); beacon.scale.setScalar(br * (1 + 0.04 * Math.sin(t * 2))); beacon.material.opacity = 0.7 * bf;
      const bm = Math.min(1, Math.max(0, (z - 2.2) / 0.35)) * hand; beam.visible = bm > 0; if (bm > 0) { const rb = Math.max(0.6, c.W * 0.0028), hb = c.W * 0.4; beam.scale.set(rb * 2.4, hb, rb * 2.4); beam.position.set(0, GROUND + hb / 2, 0); beamMat.opacity = 0.55 * bm; }
      ring2.visible = bm > 0; if (bm > 0) { const ph = (t * 0.35) % 1, rr = br * (0.6 + 1.6 * ph); ring2.position.set(0, GROUND + 0.45, 0); ring2.scale.setScalar(rr); ring2.material.opacity = 0.6 * bm * (1 - ph); } }
    { const k = Math.max(1, c.W / 120); pk.scale.set(2.2 * k, 2.2 * k, 1); pk2.scale.set(2.2 * k, 2.2 * k, 1); trail.forEach((h) => h.scale.set(1.2 * k, 1.2 * k, 1)); halos.forEach((h) => h.scale.set(3.2 * k, 3.2 * k, 1)); }
    if (metro && metro.data) { const ch = [...metro.data.filter((w) => w.id === 607901262), ...metro.data.filter((w) => w.id === 607901263)].flatMap((w) => w.p); if (!update.tp) { update.tp = ch; update.tc = [0]; for (let i = 1; i < ch.length; i++) update.tc.push(update.tc[i - 1] + Math.hypot(ch[i][0] - ch[i - 1][0], ch[i][1] - ch[i - 1][1])); }
      const tp = update.tp, tc = update.tc; const s0 = tc.findIndex((_, i) => tp[i][0] < -300) , s1 = tc.findIndex((_, i) => tp[i][0] < -1100); const a = tc[Math.max(0, s0)], b = tc[s1 > 0 ? s1 : tc.length - 1]; const span2 = b - a + 120; const sP = a + ((t * 16) % span2) - 60;
      let i = 1; while (i < tp.length - 1 && sP > tc[i]) i++; const f = Math.min(1, Math.max(0, (sP - tc[i - 1]) / ((tc[i] - tc[i - 1]) || 1))); const px = tp[i - 1][0] + (tp[i][0] - tp[i - 1][0]) * f, pz = tp[i - 1][1] + (tp[i][1] - tp[i - 1][1]) * f; const hx = tp[i][0] - tp[i - 1][0], hz = tp[i][1] - tp[i - 1][1];
      train.position.set(px, DECK + 0.25, pz); train.rotation.y = -Math.atan2(hz, hx); train.visible = z > 2.3 && sP > a - 60 && sP < b + 60; }
    beacon.visible = false; beam.visible = false; ring2.visible = false; herHalo.visible = false; herHalo2.visible = false;
    near.visible = z < 3.05; const lod = z < 3.0;
    // auto-rickshaw loops along the north lane (+x), 3 m/s
    const span = 70, x = ((t * 3.0) % span) - span * 0.5; rick.position.set(x, GROUND, SZ - 1.7); rickPos.set(x, GROUND, SZ - 1.7); rickHalo.position.set(x + 1.6, GROUND + 0.8, SZ - 1.7);
    // keystroke energy makes the lamps shimmer very slightly; send -> wi-fi shells and a packet along the cable
    shells.forEach((h, i) => { if (S.sent && S.send < 1.3) { const p = Math.max(0, Math.min(1, S.send * 1.05 - i * 0.16)); h.visible = p > 0 && p < 1; const e = 1 - Math.pow(1 - p, 2); h.scale.setScalar(1.5 + e * Math.max(18, c.W * 0.3)); const a = Math.sin(p * Math.PI) * 0.8; h.userData.mats.forEach((m, k) => { m.opacity = a * (1 - k * 0.2); }); } else h.visible = false; });
    const ps = S.sent ? Math.max(0, Math.min(1, (S.send - 0.1) / 1.0)) : 0; const on = S.sent && ps > 0 && ps < 1; pk.visible = on; if (on) { const s = ps * ps * (3 - 2 * ps) * Math.min(PL, 520); pk.position.copy(at(s)); trail.forEach((h, i) => { h.visible = true; h.position.copy(at(s - (i + 1) * 4)); h.material.opacity = 0.5 * (1 - i / 6); }); } else trail.forEach((h) => { h.visible = false; });
    const rp = S.reply > 0 ? Math.min(1, S.reply / 22) : 0; const bk = S.reply > 0 && rp < 1; pk2.visible = bk; if (bk) pk2.position.copy(at(Math.min(PL, 520) * (1 - rp * rp * (3 - 2 * rp))));
    halos.forEach((h, i) => { h.material.opacity = 0.62 + 0.08 * Math.sin(t * 2 + i); });
  }
  ctx.log('building tris', Math.round(Object.values(meshes).reduce((s, m) => s + (m.geometry.index ? m.geometry.index.count / 3 : 0), 0)), 'draw meshes', Object.keys(meshes).length, 'neighbours', info.count, 'near', info.near);
  return { group, anchor: [0, 0, 0], labels, update, zMin: 1.0, zMax: 7.5, nestR: 640, ground: GROUND, info: { tris: Object.values(meshes).reduce((s, m) => s + (m.geometry.index ? m.geometry.index.count / 3 : 0), 0), near: info.near, buildings: info.count } };
}
