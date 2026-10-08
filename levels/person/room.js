/* Her room: an open dollhouse cutaway (back wall, floor, ceiling, side walls; the front is open to the camera). Real Poly Haven props (CC0), procedural walls/window/curtains. */
import { rng, roundedBox, loadProp, findNode, prefetchProps } from './util.js';
import { makeSkyline } from './skyline.js';
import { CELL, cellShell } from './shell.js';
import { GB } from '../building/gb.js';
export const ROOM = { x0: -CELL.x, x1: CELL.x, y0: CELL.y0, y1: CELL.y1, z0: CELL.zb, z1: CELL.zf };   // identical to the building's cutaway cell (levels/person/shell.js)
export async function buildRoom(ctx, group, human) {
  const { T, kit } = ctx; const R = ROOM; const rootG = new T.Group(); rootG.name = 'room'; group.add(rootG);
  const texL = new T.TextureLoader(); const tex = (p, rep, srgb = true) => { const t = texL.load(ctx.assetURL('person/tex/' + p)); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 8; t.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace; return t; };
  prefetchProps(ctx, ['small_wooden_table_01','painted_wooden_chair_02','desk_lamp_arm_01','book_encyclopedia_set_01','wooden_bookshelf_worn','painted_wooden_cabinet','potted_plant_02','calathea_orbifolia_01','ceiling_fan','wall_clock','throw_pillows_01','stationery_supplies','alarm_clock_01','tea_set_01']);
  { const lw = new T.Mesh(new T.PlaneGeometry(1.4, 1.0), new T.MeshBasicMaterial({ color: new T.Color(2.2, 1.7, 1.0), fog: false })); lw.rotation.x = Math.PI / 2; lw.position.set(0, R.y1 - 0.004, 0.1); lw.userData.name = 'ceilingLamp'; rootG.add(lw); }   // the warm tube-light patch the building's cutaway shows too
  const lights = []; const spin = []; const clocks = [];
  // ------------------------------------------------------------------ shell
  const wallM = (hex, rep) => kit.toon(hex, { map: tex('wall_diff.jpg', rep), normalMap: tex('wall_nor.jpg', rep, false), glow: 0xffc08a, glowK: 0.4 });   // warm-violet room light: the same glow the lit flat shows on the facade
  const backM = wallM(0xf6e0cc, [3, 1.2]), sideM = wallM(0xedd0b6, [3, 1.2]), ceilM = wallM(0xf8ecdc, [2, 2]);
  const floorM = kit.toon(0xe0aa72, { map: tex('floor_diff.jpg', [4, 4]), normalMap: tex('floor_nor.jpg', [4, 4], false) });
  const box = (w, h, d, m, x, y, z) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.frustumCulled = false; rootG.add(b); return b; };
  const TH = 0.08; const WX0 = -0.85, WX1 = 0.85, WY0 = -0.15, WY1 = 1.35;
  // back wall around the window opening
  box(WX0 - R.x0, R.y1 - R.y0, TH, backM, (R.x0 + WX0) / 2, (R.y0 + R.y1) / 2, R.z0 + TH / 2);
  box(R.x1 - WX1, R.y1 - R.y0, TH, backM, (R.x1 + WX1) / 2, (R.y0 + R.y1) / 2, R.z0 + TH / 2);
  box(WX1 - WX0, WY0 - R.y0, TH, backM, (WX0 + WX1) / 2, (R.y0 + WY0) / 2, R.z0 + TH / 2);
  box(WX1 - WX0, R.y1 - WY1, TH, backM, (WX0 + WX1) / 2, (WY1 + R.y1) / 2, R.z0 + TH / 2);
  // thin textured inner skins of the shared structural shell (party walls / slabs live in shell.js, identical to the building's cell)
  const wallBox = (geo, mat, x, y, z) => { const b = new T.Mesh(geo, mat); b.position.set(x, y, z); b.frustumCulled = false; rootG.add(b); return b; };
  wallBox(new T.BoxGeometry(TH, R.y1 - R.y0, R.z1 - R.z0), sideM, R.x0 + TH / 2, (R.y0 + R.y1) / 2, (R.z0 + R.z1) / 2);
  wallBox(new T.BoxGeometry(TH, R.y1 - R.y0, R.z1 - R.z0), sideM, R.x1 - TH / 2, (R.y0 + R.y1) / 2, (R.z0 + R.z1) / 2);
  { const gb = new GB(); cellShell(gb); const shm = kit.toon(0xffffff, { vc: true }); shm.colorWrite = false; /* depth-only: it occludes the room's contents exactly like the walls would, while the building level (same shell, same place) supplies the colour */ const shell = new T.Mesh(gb.geometry(), shm); shell.frustumCulled = false; shell.renderOrder = -5; shell.userData.name = 'shell'; rootG.add(shell); }
  box(R.x1 - R.x0, 0.1, R.z1 - R.z0, floorM, 0, R.y0 - 0.05 + 0.0, (R.z0 + R.z1) / 2).material = floorM;
  box(R.x1 - R.x0, 0.1, R.z1 - R.z0, ceilM, 0, R.y1 + 0.05, (R.z0 + R.z1) / 2);
  // skirting + cornice
  const skirt = kit.toon(0xfbf0e2, {}); box(R.x1 - R.x0 - 0.2, 0.11, 0.025, skirt, 0, R.y0 + 0.055, R.z0 + TH + 0.0125); box(0.025, 0.11, R.z1 - R.z0 - TH, skirt, R.x0 + TH + 0.0125, R.y0 + 0.055, (R.z0 + R.z1) / 2 + TH / 2); box(0.025, 0.11, R.z1 - R.z0 - TH, skirt, R.x1 - TH - 0.0125, R.y0 + 0.055, (R.z0 + R.z1) / 2 + TH / 2);
  box(R.x1 - R.x0 - 0.2, 0.07, 0.05, skirt, 0, R.y1 - 0.035, R.z0 + TH + 0.025);
  { // wainscot: dado rail + raised panels on the back and side walls, picture rail near the cornice
    const pm = kit.toon(0xe0b496, {}), pm2 = kit.toon(0xb98068, {}); const YR = -0.52;
    box(R.x1 - R.x0 - 0.2, 0.03, 0.025, pm, 0, YR, R.z0 + TH + 0.015); box(0.03, 0.04, R.z1 - R.z0 - TH, pm, R.x0 + TH + 0.015, YR, (R.z0 + R.z1) / 2 + TH / 2); box(0.03, 0.04, R.z1 - R.z0 - TH, pm, R.x1 - TH - 0.015, YR, (R.z0 + R.z1) / 2 + TH / 2);
    for (let px = R.x0 + 0.35; px < R.x1 - 0.3; px += 0.62) { box(0.46, 0.02, 0.012, pm, px, R.y0 + 0.14, R.z0 + TH + 0.006); box(0.46, 0.02, 0.012, pm, px, YR - 0.07, R.z0 + TH + 0.006); box(0.02, YR - 0.07 - (R.y0 + 0.14), 0.012, pm, px - 0.23, (YR - 0.07 + R.y0 + 0.14) / 2, R.z0 + TH + 0.006); box(0.02, YR - 0.07 - (R.y0 + 0.14), 0.012, pm, px + 0.23, (YR - 0.07 + R.y0 + 0.14) / 2, R.z0 + TH + 0.006); box(0.44, YR - 0.07 - (R.y0 + 0.14), 0.004, pm2, px, (YR - 0.07 + R.y0 + 0.14) / 2, R.z0 + TH + 0.002); }
    box(R.x1 - R.x0 - 0.2, 0.025, 0.025, pm, 0, R.y1 - 0.22, R.z0 + TH + 0.0125); }
  // ------------------------------------------------------------------ window
  const fw = 0.06, wz = R.z0 - 0.125;
  const glass = new T.Mesh(new T.PlaneGeometry(WX1 - WX0, WY1 - WY0), new T.MeshBasicMaterial({ color: 0xa9b0ff, transparent: true, opacity: 0.07, depthWrite: false, fog: false })); glass.position.set(0, (WY0 + WY1) / 2, wz); rootG.add(glass);
  const sky = makeSkyline(ctx); sky.group.position.set(0, 0.2, R.z0); sky.group.scale.z = 0.2; sky.group.userData.name = 'skyline'; rootG.add(sky.group);
  // curtains
  const linen = tex('linen_diff.jpg', [2, 3]), linenN = tex('linen_nor.jpg', [2, 3], false);
  const curtain = (x0, x1, col) => { const w = x1 - x0, h = 2.72; const nx = 150; const g = new T.PlaneGeometry(w, h, nx, 6); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const f = x / w + 0.5; const k = f * Math.PI * 2 * 8; p.setZ(i, 0.044 * Math.sin(k) * (0.7 + 0.3 * (0.5 - y / h)) + 0.004 * Math.sin(k * 2.0 + y * 2)); p.setX(i, x * (1 - 0.04 * Math.cos(k))); } g.computeVertexNormals(); const m = new T.Mesh(g, kit.toon(col, { side: T.DoubleSide })); m.position.set((x0 + x1) / 2, 0.16, R.z0 + TH + 0.30); m.userData.name = 'curtain'; m.frustumCulled = false; rootG.add(m); };
  curtain(-1.3, -0.55, 0x7d68ac); curtain(0.55, 1.3, 0x7d68ac);
  const rod = new T.Mesh(new T.CylinderGeometry(0.014, 0.014, 2.7, 10), kit.toon(0xffd166, {})); rod.rotation.z = Math.PI / 2; rod.position.set(0, 1.5, R.z0 + TH + 0.30); rootG.add(rod);
  // ------------------------------------------------------------------ rug
  const rug = kit.canvasTex(1024, 768, (g, w, h) => { const r = rng(5); g.fillStyle = '#2c3399'; g.fillRect(0, 0, w, h); const cols = ['#ff9f1c', '#12a595', '#fff3d6', '#a9b0ff', '#5b63e0', '#c98b5e']; for (let k = 0; k < 6; k++) { const m = 20 + k * 58; g.strokeStyle = cols[k % cols.length]; g.lineWidth = 12; g.strokeRect(m, m, w - 2 * m, h - 2 * m); } for (let i = 0; i < 9; i++) for (let j = 0; j < 7; j++) { const cx = 190 + i * 80, cy = 190 + j * 62; g.fillStyle = cols[(i + j) % cols.length]; g.beginPath(); g.moveTo(cx, cy - 22); g.lineTo(cx + 24, cy); g.lineTo(cx, cy + 22); g.lineTo(cx - 24, cy); g.closePath(); g.fill(); g.fillStyle = '#10124a'; g.beginPath(); g.arc(cx, cy, 6, 0, 7); g.fill(); } for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.05})`; g.fillRect(r() * w, r() * h, 2, 2); } });
  const rugM = new T.Mesh(new T.PlaneGeometry(2.7, 2.0), kit.toon(0xffffff, { map: rug })); rugM.rotation.x = -Math.PI / 2; rugM.position.set(0.15, R.y0 + 0.004, 0.05); rootG.add(rugM);
  // ------------------------------------------------------------------ furniture (real props)
  const add = async (name, o) => { ctx.log('prop ' + name); const g = await loadProp(ctx, name, o); rootG.add(g); return g; };
  const FLOOR = R.y0, DESKTOP = -0.4705 - 0.0004;
  const desk = await add('small_wooden_table_01', { pos: [0.53, FLOOR, 0.0], rotY: Math.PI / 2, scale: 1.369, calm: { blur: 0.8, contrast: 0.8, sat: 0.85 } });
  const chair = await add('painted_wooden_chair_02', { pos: [-0.187, FLOOR, 0.0], rotY: Math.PI / 2, scale: 0.66, cel: 0xc58a58 });
  const lamp = await add('desk_lamp_arm_01', { pos: [0.56, DESKTOP, -0.42], rotY: 0.0, scale: 0.8 });
  for (const [lv, xo, sc] of [[0.11, 1.15, 1], [0.39, 1.75, 1], [0.67, 1.2, 1], [0.96, 1.72, 1.04], [0.39, 1.15, 1]]) await add('book_encyclopedia_set_01', { pos: [xo, FLOOR + lv, -1.84], scale: sc, tint: 0xd8d4f5, calm: { blur: 1, contrast: 0.8 } });
  const shelf = await add('wooden_bookshelf_worn', { pos: [1.78, FLOOR, R.z0 + 0.33 + TH / 2], rotY: 0, cel: 0x8a6bb8 });
  const cabinet = await add('painted_wooden_cabinet', { pos: [-1.78, FLOOR, R.z0 + 0.33 + TH / 2], cel: 0x2a7f88 });
  const plant = await add('potted_plant_02', { pos: [-1.0, FLOOR, R.z0 + 0.6], scale: 1.0 });
  const plant2 = await add('calathea_orbifolia_01', { pos: [-1.78, FLOOR + 1.18, R.z0 + 0.4], scale: 0.28 });
  const fan = await add('ceiling_fan', { pos: [0.3, R.y1, 0.0], scale: 1.0 }); const blades = findNode(fan, /blades/i); if (blades) spin.push(blades);
  const clock = await add('wall_clock', { pos: [R.x0 + TH, 0.95, -1.05], scale: 1.1, rotY: Math.PI / 2 });
  const pil = await add('throw_pillows_01', { pos: [-1.4, FLOOR, 0.9], scale: 0.9, rotY: 0.5 });
  const pens = await add('stationery_supplies', { pos: [0.95, DESKTOP + 0.01, -0.12], scale: 1.0, rotY: 0.7 });
  const acl = await add('alarm_clock_01', { pos: [-1.5, FLOOR + 1.18, R.z0 + 0.35], scale: 1.0 });
  // tea cup + saucer (the set was trimmed to one cup in the asset build)
  const cupG = await loadProp(ctx, 'tea_set_01', { cel: 0xf1eeff }); { const bb = new T.Box3().setFromObject(cupG); const sz = bb.getSize(new T.Vector3()); const k = 0.145 / Math.max(sz.x, sz.z); cupG.scale.setScalar(k); const bb2 = new T.Box3().setFromObject(cupG); const c2 = bb2.getCenter(new T.Vector3()); cupG.position.set(0.82 - c2.x, DESKTOP + 0.001 - bb2.min.y, 0.34 - c2.z); rootG.add(cupG); }
  // wi-fi router
  const rg = new T.Group(); const wh = kit.toon(0xf4efff, {}); const rb = new T.Mesh(roundedBox(T, 0.16, 0.04, 0.2, 0.012, 3), wh); rb.position.y = 0.02; rg.add(rb);
  for (let i = -1; i <= 1; i++) { const a = new T.Mesh(new T.CylinderGeometry(0.004, 0.005, 0.2, 8), wh); a.position.set(-0.05, 0.14, i * 0.07); a.rotation.z = 0.12; rg.add(a); }
  const leds = [0, 1, 2, 3].map((i) => { const l = new T.Mesh(new T.SphereGeometry(0.004, 8, 6), new T.MeshBasicMaterial({ color: 0x7fe3c4 })); l.position.set(0.081, 0.022, -0.05 + i * 0.03); rg.add(l); return l; }); rg.position.set(-1.45, FLOOR + 1.18, R.z0 + 0.62); rg.rotation.y = 0.35; rootG.add(rg);
  // framed pictures on the back wall
  const art = (seed, w, h) => kit.canvasTex(256, Math.round(256 * h / w), (g, W, H) => { const r = rng(seed); const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2c3399'); gr.addColorStop(1, '#ff9f1c'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = '#12a595'; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 16) g.lineTo(x, H * (0.55 + 0.2 * Math.sin(x * 0.03 + seed) + 0.1 * r())); g.lineTo(W, H); g.fill(); g.fillStyle = '#fff3d6'; g.beginPath(); g.arc(W * 0.7, H * 0.28, W * 0.08, 0, 7); g.fill(); });
  const frame = (x, y, w, h, seed) => { const fm = new T.Mesh(new T.BoxGeometry(w + 0.05, h + 0.05, 0.03), kit.toon(0xffd9a0, {})); fm.position.set(x, y, R.z0 + TH + 0.015); rootG.add(fm); const pm = new T.Mesh(new T.PlaneGeometry(w, h), kit.toon(0xffffff, { map: art(seed, w, h) })); pm.position.set(x, y, R.z0 + TH + 0.032); rootG.add(pm); };
  frame(1.0, 1.05, 0.34, 0.46, 3); frame(-0.2, 1.62, 0.3, 0.22, 7); frame(0.28, 1.62, 0.22, 0.22, 11);
  // side walls: a wooden door on the left, framed pictures + a calendar on the right (seen at an angle)
  { const X = R.x0 + TH, DZ = 0.5, DW = 0.92, DH = 2.1;
    const wood = kit.canvasTex(512, 1024, (g, w, h) => { const r = rng(31); const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#9a5f3a'); gr.addColorStop(0.5, '#b0714a'); gr.addColorStop(1, '#8f5636'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 160; i++) { const x = r() * w; g.strokeStyle = `rgba(${r() < 0.5 ? '60,30,20' : '230,170,120'},${0.05 + r() * 0.08})`; g.lineWidth = 1 + r() * 3; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= h; y += 64) g.lineTo(x + Math.sin(y * 0.01 + i) * 6, y); g.stroke(); } }); wood.wrapS = wood.wrapT = T.RepeatWrapping; wood.anisotropy = 8;
    const dm = kit.toon(0xffffff, { map: wood }); const dp = kit.toon(0xd9a07a, { map: wood });
    const slab = new T.Mesh(new T.BoxGeometry(0.035, DH, DW), dm); slab.position.set(X + 0.0175, R.y0 + DH / 2, DZ); rootG.add(slab);
    for (const [yy, hh] of [[0.55, 0.62], [1.5, 0.75]]) { const p = new T.Mesh(new T.BoxGeometry(0.012, hh, 0.58), dp); p.position.set(X + 0.035 + 0.006, R.y0 + yy, DZ); rootG.add(p); }
    const cas = kit.toon(0xf4eefc, {}); const cb = (h, w, y, z) => { const m = new T.Mesh(new T.BoxGeometry(0.052, h, w), cas); m.position.set(X + 0.026, R.y0 + y, z); rootG.add(m); };
    cb(DH + 0.07, 0.07, (DH + 0.07) / 2, DZ - DW / 2 - 0.035); cb(DH + 0.07, 0.07, (DH + 0.07) / 2, DZ + DW / 2 + 0.035); cb(0.07, DW + 0.14, DH + 0.035, DZ);
    const kn = new T.Mesh(new T.SphereGeometry(0.028, 16, 12), kit.toon(0xffd166, {})); kn.position.set(X + 0.085, R.y0 + 1.0, DZ - DW / 2 + 0.09); rootG.add(kn);
    const plate = new T.Mesh(new T.BoxGeometry(0.01, 0.2, 0.05), kit.toon(0xe0b04a, {})); plate.position.set(X + 0.04, R.y0 + 1.0, DZ - DW / 2 + 0.09); rootG.add(plate);
    const sf = (z, y, w, h, seed) => { const fm = new T.Mesh(new T.BoxGeometry(0.03, h + 0.05, w + 0.05), kit.toon(0xffd9a0, {})); fm.position.set(R.x1 - TH - 0.015, y, z); rootG.add(fm); const pm2 = new T.Mesh(new T.PlaneGeometry(w, h), kit.toon(0xffffff, { map: art(seed, w, h) })); pm2.rotation.y = -Math.PI / 2; pm2.position.set(R.x1 - TH - 0.032, y, z); rootG.add(pm2); };
    sf(-1.4, 0.9, 0.5, 0.36, 5); sf(-0.6, 1.1, 0.3, 0.42, 9); sf(0.5, 0.8, 0.46, 0.34, 13); }
  // ------------------------------------------------------------------ practical lights (tiny): lamp + laptop glow + window city glow; intensities follow the world scale
  lamp.updateMatrixWorld(true); let hp = null; { const v = new T.Vector3(); lamp.traverse((o) => { if (o.isMesh) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 2) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); if (!hp || v.y > hp.y) hp = v.clone(); } } }); }
  const bulb = hp ? hp.clone().add(new T.Vector3(0, -0.075, 0)) : new T.Vector3(0.7, -0.12, -0.3);
  const lampLight = new T.PointLight(0xffa24a, 0, 0, 2); lampLight.position.copy(bulb); rootG.add(lampLight);
  const lampHalo = kit.halo(0xffb347, 0.9); lampHalo.scale.set(0.34, 0.34, 1); lampHalo.position.copy(bulb); rootG.add(lampHalo); const lampHalo2 = kit.halo(0xfff3d6, 0.9); lampHalo2.scale.set(0.09, 0.09, 1); lampHalo2.position.copy(bulb); rootG.add(lampHalo2);
  const pool = new T.Mesh(new T.PlaneGeometry(0.9, 0.9), new T.MeshBasicMaterial({ map: kit.glowTex(), color: 0xffa24a, transparent: true, opacity: 0.30, blending: T.AdditiveBlending, depthWrite: false, fog: false })); pool.rotation.x = -Math.PI / 2; pool.position.set(bulb.x - 0.12, DESKTOP + 0.004, bulb.z + 0.25); rootG.add(pool);
  // steam from the tea cup
  const wispTex = kit.canvasTex(16, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.2, 'rgba(255,255,255,1)'); gr.addColorStop(0.8, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); const gx = g.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(0,0,0,0.0)'); g.globalCompositeOperation = 'destination-in'; const gh = g.createLinearGradient(0, 0, w, 0); gh.addColorStop(0, 'rgba(0,0,0,0.35)'); gh.addColorStop(0.5, 'rgba(0,0,0,1)'); gh.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = gh; g.fillRect(0, 0, w, h); });
  const WN = 30; const steam = [0, 1, 2, 3].map((i) => { const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(new Float32Array((WN + 1) * 2 * 3), 3)); const uv = new Float32Array((WN + 1) * 2 * 2); const idx = [];
    for (let k = 0; k <= WN; k++) { uv.set([0, k / WN, 1, k / WN], k * 4); if (k < WN) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setIndex(idx); const m = new T.Mesh(geo, new T.MeshBasicMaterial({ map: wispTex, color: 0xe4e6ff, transparent: true, opacity: 0.5, depthWrite: false, side: T.DoubleSide, fog: false })); m.frustumCulled = false; m.renderOrder = 3; rootG.add(m); return m; });
  const screenLight = new T.PointLight(0xcfe0ff, 0, 0, 2); screenLight.position.set(0.55, -0.30, 0.0); rootG.add(screenLight);
  const hand = { hours: findNode(clock, /hours_hand/i), min: findNode(clock, /minute_hand/i), sec: findNode(clock, /second_hand/i) };
  const handBase = {}; clock.updateMatrixWorld(true); for (const k in hand) if (hand[k]) { const b = new T.Box3().setFromObject(hand[k]); const c = b.getCenter(new T.Vector3()); clock.worldToLocal(c); const cc = clock.worldToLocal(new T.Vector3().setFromMatrixPosition(clock.matrixWorld)); handBase[k] = Math.atan2(c.x, c.y); }
  const Wsun = (c) => 1;
  function update(t, S, z, c) {
    steam.forEach((m, i) => { const pa = m.geometry.attributes.position; const bx = 0.82 + (i - 1.5) * 0.014, bz = 0.34 + (i % 2 ? 0.006 : -0.006); for (let k = 0; k <= WN; k++) { const u = k / WN; const x = bx + 0.016 * u * Math.sin(7 * u - t * 1.5 + i * 2.1) + 0.006 * u * u * Math.sin(3 * u + t * 0.7 + i); const y = DESKTOP + 0.045 + u * (0.20 + 0.03 * i); const w = 0.0045 * Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.05)) * (0.6 + u); pa.setXYZ(k * 2, x - w, y, bz); pa.setXYZ(k * 2 + 1, x + w, y, bz); } pa.needsUpdate = true; m.material.opacity = 0.28 + 0.12 * Math.sin(t * 0.8 + i * 1.7); });
    const s = c.s; lampLight.intensity = 0.0035 * s * s; screenLight.intensity = 0.0016 * s * s * (0.8 + 0.2 * (S.E || 0));
    blades_spin(t); sky.update(t, 1); leds.forEach((l, i) => { l.visible = ((Math.floor(t * 4 + i * 1.7) % 3) !== 0); });
    const secs = 23 * 3600 + 2 * 60 + t; const ang = { sec: (secs % 60) / 60 * Math.PI * 2, min: (secs % 3600) / 3600 * Math.PI * 2, hours: (secs % 43200) / 43200 * Math.PI * 2 };
    for (const k in hand) if (hand[k]) hand[k].rotation.z = -(ang[k] - (handBase[k] || 0)) + (hand[k].userData.r0 || (hand[k].userData.r0 = 0));
  }
  function blades_spin(t) { spin.forEach((b) => { b.rotation.y = t * 2.4; }); }
  return { update, desk, chair, lamp, rootG };
}
