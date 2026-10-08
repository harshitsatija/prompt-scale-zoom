/* Level "galaxy" (z 20.2 .. 24.4): the Milky Way and the Local Group.
 * Scene frame (kpc, Sun at the origin = level origin): x = -Y_gal (l = 90 deg is -x), y = north galactic pole, z = -X_gal (the galactic centre is at -z, 8.15 kpc).
 * Everything is authored in kpc inside `world` (scaled by KPC) so float32 positions stay small. */
import * as shaders from './galaxy/shaders.js';
import { ARMS, R0, armPoint, warpY } from './galaxy/model.js';
import { veilVert, veilFrag } from './stars/shaders.js';
import { HANDOFF_Z, popLaw, dwarfItems, ungcItems as mkUngc, nbrItems } from './galaxy/pop.js';
import { loadMWAssets, makeMW, applyMW, sharedLaw, fadeLaw, planeRamp } from './galaxy/mw.js';

const KPC = 3.0856775814913673e19;

export default async function build(ctx) {
  const { T, kit } = ctx, { ss } = kit;
  const group = new T.Group(); const world = new T.Group();
  // align the galaxy scene with the EARTH frame the stars level lives in (assets/stars/frame.json): the catalogue stars and the disc now share one orientation
  const QG = new T.Quaternion(-0.24415823, -0.19411138, 0.83003636, 0.46233); group.quaternion.copy(QG); world.scale.setScalar(KPC); group.add(world);
  const veilMat = new T.ShaderMaterial({ vertexShader: veilVert, fragmentShader: veilFrag, transparent: true, depthWrite: false, depthTest: true, blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneFactor, blendEquationAlpha: T.MaxEquation, blendSrcAlpha: T.OneFactor, blendDstAlpha: T.OneFactor, fog: false, uniforms: { uOp: { value: 0 }, uRes: { value: new T.Vector2(1600, 1000) } } });
  { const g = new T.BufferGeometry(); g.setAttribute('corner', new T.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2)); g.setAttribute('position', new T.BufferAttribute(new Float32Array(12), 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
    const v = new T.Mesh(g, veilMat); v.frustumCulled = false; v.renderOrder = -100; group.add(v); }   // same violet well the stars level paints: the engine's screen-fixed flares never show through the disc
  const mwRoot = new T.Group(); world.add(mwRoot);   // near-field Milky Way (disc, stars, Sun): scaled about the galactic centre between z 21.6 and 22.4 so the galaxy fills more of the frame
  let mwK = 1;
  const dpr = ctx.params.has('dpr') ? Number(ctx.params.get('dpr')) : Math.min(2, window.devicePixelRatio || 1);
  shaders.shared.uDpr.value = dpr;

  // ------------------------------------------------------------------ data
  const [lg, gcs, mwMeta, gxMeta, mwBuf, gxBuf, ungc] = await Promise.all([
    ctx.fetchJSON('galaxy/localgroup.json'), ctx.fetchJSON('galaxy/gc.json'), ctx.fetchJSON('galaxy/mw_stars.json'), ctx.fetchJSON('galaxy/gx_stars.json'),
    ctx.fetchBuf('galaxy/mw_stars.bin'), ctx.fetchBuf('galaxy/gx_stars.bin'), ctx.fetchJSON('galaxy/ungc.json')]);
  const texLoader = new T.TextureLoader();
  const tex = async (name, o = {}) => { const t = await texLoader.loadAsync(ctx.assetURL('galaxy/' + name)); t.colorSpace = T.NoColorSpace; t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter; t.generateMipmaps = true; t.anisotropy = 8; return t; };
  const [mwGlow, mwDust, mwGlowL, mwDustL, m31g, m31d, m33g, m33d, lmcg, lmcd, smcg, smcd] = await Promise.all(
    ['mw_glow.webp', 'mw_dust.webp', 'mw_glow_local.webp', 'mw_dust_local.webp', 'gx_m31_glow.webp', 'gx_m31_dust.webp', 'gx_m33_glow.webp', 'gx_m33_dust.webp', 'gx_lmc_glow.webp', 'gx_lmc_dust.webp', 'gx_smc_glow.webp', 'gx_smc_dust.webp'].map((n) => tex(n)));

  const starSet = (meta, buf, key, mat, order, parent) => {
    const m = meta[key]; const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Int16Array(buf, m.pos, m.n * 3), 3));
    g.setAttribute('aCol', new T.BufferAttribute(new Uint8Array(buf, m.col, m.n * 4), 4, true));
    const p = new T.Points(g, mat); p.frustumCulled = false; p.renderOrder = order; (parent || mwRoot).add(p); return p;
  };

  // ------------------------------------------------------------------ Milky Way disc (glow + dust planes + resolved stars): built by galaxy/mw.js and shared with the stars level
  const MWA = await loadMWAssets(ctx); const mw = makeMW(MWA, 0); mwRoot.add(mw.root);
  const { glowMat, dustMat, glowPlane, dustPlane, stars, BASEAMP } = mw;

  // ------------------------------------------------------------------ globular clusters (Harris catalogue, real positions) and compact things
  const mkBlobs = (items, o = {}, parent = world) => {
    const n = items.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 4), sz = new Float32Array(n * 2);
    items.forEach((it, i) => { pos.set(it.p, i * 3); col.set(it.c, i * 4); sz.set(it.s, i * 2); });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aCol', new T.BufferAttribute(col, 4)); g.setAttribute('aSz', new T.BufferAttribute(sz, 2));
    const m = shaders.blobMaterial(o); const pts = new T.Points(g, m); pts.frustumCulled = false; pts.renderOrder = o.order || 8; parent.add(pts); return pts;
  };
  // galaxy glyph sprites (see shaders.glyphMaterial): items {p, r (kpc), c [r,g,b], lum 0..1, type 0 smooth / 1 spiral / 2 irregular, rot, ar, seed}
  const mkGlyphs = (items, o = {}) => {
    const n = items.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 4), sz = new Float32Array(n * 2), shp = new Float32Array(n * 4);
    items.forEach((it, i) => { pos.set(it.p, i * 3); col.set([it.c[0], it.c[1], it.c[2], it.lum], i * 4); sz.set([it.r, 0], i * 2); shp.set([it.type, it.rot, it.ar, it.seed], i * 4); });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aCol', new T.BufferAttribute(col, 4)); g.setAttribute('aSz', new T.BufferAttribute(sz, 2)); g.setAttribute('aShp', new T.BufferAttribute(shp, 4));
    const m = shaders.glyphMaterial(o); const pts = new T.Points(g, m); pts.frustumCulled = false; pts.renderOrder = o.order || 8; world.add(pts); return pts;
  };
  const gcBlobs = mkBlobs(gcs.map(([x, y, z, vt]) => ({ p: [x, y, z], c: [1.0, 0.86, 0.62, 0.55 + 0.5 * Math.max(0, Math.min(1, (13.5 - vt) / 5))], s: [0.0, 3.2 + Math.max(0, (11.5 - vt)) * 0.7] })), { amp: 0.9, order: 7 });

  // Sun
  const sunTex = kit.canvasTex(128, 128, (x, w, h) => { x.clearRect(0, 0, w, h);
    let g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,248,214,1)'); g.addColorStop(0.1, 'rgba(255,214,120,0.95)'); g.addColorStop(0.28, 'rgba(255,160,50,0.34)'); g.addColorStop(1, 'rgba(255,140,40,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(255,214,140,0.9)'; x.lineWidth = 2.2; x.beginPath(); x.arc(64, 64, 29, 0, 7); x.stroke(); });
  sunTex.colorSpace = T.NoColorSpace;
  const sunBlob = mkBlobs([{ p: [0, 0, 0], c: [1.0, 0.86, 0.5, 1.3], s: [0, 30] }], { tex: sunTex, amp: 1.2, order: 9, beacon: 0, maxPx: 60 }, mwRoot);
  // Sgr A*: glow + a tiny accretion-disc sprite that becomes legible when the field is narrow enough to show the centre
  const accr = kit.canvasTex(128, 128, (x, w, h) => {
    x.clearRect(0, 0, w, h); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.12, 'rgba(255,230,170,0.55)'); g.addColorStop(0.35, 'rgba(255,170,70,0.16)'); g.addColorStop(1, 'rgba(255,140,60,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.save(); x.translate(64, 64); x.rotate(-0.45); x.scale(1, 0.32);
    const r = x.createRadialGradient(0, 0, 8, 0, 0, 30); r.addColorStop(0, 'rgba(255,250,225,0.95)'); r.addColorStop(0.5, 'rgba(255,170,60,0.75)'); r.addColorStop(1, 'rgba(255,120,30,0)'); x.fillStyle = r; x.beginPath(); x.arc(0, 0, 30, 0, 7); x.fill();
    x.fillStyle = 'rgba(0,0,0,1)'; x.beginPath(); x.arc(0, 0, 6.5, 0, 7); x.fill(); x.restore(); });
  accr.colorSpace = T.NoColorSpace;
  const sgrBlob = mkBlobs([{ p: [0, 0, -R0], c: [1.0, 0.82, 0.5, 1.0], s: [0, 30] }], { tex: accr, amp: 1.25, order: 9, beacon: 0, maxPx: 80 });

  // ------------------------------------------------------------------ the Local Group catalogue (McConnachie 2012)
  const byName = {}; lg.galaxies.forEach((g) => { byName[g.name] = g; });
  const TEX = { Andromeda: [m31g, m31d, 84, 0.95, 'gx_m31'], Triangulum: [m33g, m33d, 36, 1.0, 'gx_m33'], LMC: [lmcg, lmcd, 16, 1.0, 'gx_lmc'], SMC: [smcg, smcd, 10, 1.0, 'gx_smc'] };
  const dwarfs = dwarfItems(lg, new Set([...Object.keys(TEX), 'M32', 'NGC 205']));
  const dwarfBlobs = mkGlyphs(dwarfs, { amp: 2.4, order: 8, minPx: 9 });
  // the Updated Nearby Galaxy Catalog (Karachentsev+ 2013): 761 real galaxies out to 26 Mpc, each drawn as an elliptical / spiral / irregular glyph with its catalogue axis ratio
  const ungcItems = mkUngc(ungc);
  const ungcGlyphs = mkGlyphs(ungcItems, { amp: 0.0, order: 7, minPx: 6.5 });

  // ---- other galaxies. Textured discs with real orientation (M31, M33), camera-facing irregulars (LMC, SMC) and ellipticals (M32, M110).
  // At Local-Group scale a galaxy of 100,000 ly would be a few pixels wide, so every galaxy is drawn through a scale factor k = max(1, minPx / physicalPx)
  // about its (real) centre: positions are exact, sizes are exaggerated only as far as is needed to stay recognisable (labels say so honestly).
  const sers = (n, ar, col, ang) => kit.canvasTex(256, 256, (x, w, h) => { x.clearRect(0, 0, w, h); x.save(); x.translate(128, 128); x.rotate(ang); x.scale(1, ar);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 120); for (let i = 0; i <= 12; i++) { const r = i / 12; const v = Math.exp(-7.67 * (Math.pow(Math.max(r, 0.02) / 0.55, 1 / n) - 1)) * (1 - Math.pow(r, 3)); g.addColorStop(r, `rgba(${col[0]},${col[1]},${col[2]},${Math.min(1, v * 0.5).toFixed(3)})`); }
    x.fillStyle = g; x.fillRect(-128, -128 / ar, 256, 256 / ar); x.restore(); });
  const mkTex = (t) => { t.colorSpace = T.NoColorSpace; return t; };
  const m32t = mkTex(sers(2.5, 0.85, [255, 214, 160], 0.3)), m110t = mkTex(sers(1.6, 0.58, [255, 218, 170], 0.5));
  const haloT = mkTex(kit.canvasTex(128, 128, (x, w, h) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,236,205,0.85)'); g.addColorStop(0.18, 'rgba(255,210,160,0.4)'); g.addColorStop(0.5, 'rgba(190,190,255,0.12)'); g.addColorStop(1, 'rgba(160,170,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }));
  const byNameG = {}; const gals = [];     // {g, k fn, group, mats, ...}
  const SPEC = {  // glow, dust, plane ext (kpc), diameter (kpc), gain, star key, minPx near / far, billboard?
    Andromeda: { gl: m31g, du: m31d, ext: 84, dia: 67, gain: 1.35, key: 'm31', min0: 130, min1: 22, halo: [0.34, 1.3] },
    Triangulum: { gl: m33g, du: m33d, ext: 36, dia: 18, gain: 1.0, key: 'm33', min0: 50, min1: 10, halo: [0.2, 0.5] },
    LMC: { gl: lmcg, du: lmcd, ext: 16, dia: 8, gain: 0.5, dgain: 0.4, key: 'lmc', min0: 15, min1: 3, billboard: true },
    SMC: { gl: smcg, du: smcd, ext: 10, dia: 4.5, gain: 0.5, dgain: 0.4, key: 'smc', min0: 10, min1: 3, billboard: true },
  };
  const tmpM = new T.Matrix4(), bx = new T.Vector3(), by = new T.Vector3(), bz = new T.Vector3();
  for (const [name, sp] of Object.entries(SPEC)) {
    const g = byName[name]; const gg = new T.Group(); gg.position.set(g.x, g.y, g.z);
    const geo = new T.PlaneGeometry(sp.ext, sp.ext); const e = { name, sp, gg, mats: [], basis: null };
    if (g.ex && !sp.billboard) { e.basis = [new T.Vector3(...g.ex), new T.Vector3(...g.ey)]; e.basis.push(new T.Vector3().crossVectors(e.basis[0], e.basis[1]));
    if (name === 'Triangulum') { const n0 = e.basis[2].clone(), t0 = new T.Vector3(0, Math.sign(n0.y) || 1, 0), n1 = n0.clone().multiplyScalar(0.45).addScaledVector(t0, 0.55).normalize(); const q = new T.Quaternion().setFromUnitVectors(n0, n1); e.basis.forEach((v) => v.applyQuaternion(q)); }  /* M33: disc turned ~half-way towards our viewing direction so its arms read (documented in SOURCES.md) */
 gg.matrixAutoUpdate = false; }
    const pg = new T.Mesh(geo, shaders.galaxyPlaneMaterial({ mode: 'glow', map: sp.gl, gain: sp.gain, billboard: sp.billboard })); pg.renderOrder = 9; pg.frustumCulled = false; gg.add(pg); e.mats.push(pg.material);
    const pd = new T.Mesh(geo, shaders.galaxyPlaneMaterial({ mode: 'dust', map: sp.du, gain: sp.dgain || 1, dustCol: 0x150a1c, billboard: sp.billboard })); pd.renderOrder = 11; pd.frustumCulled = false; gg.add(pd); e.mats.push(pd.material);
    if (sp.halo) { const hg = new T.Mesh(new T.PlaneGeometry(sp.dia * 0.9, sp.dia * 0.9), shaders.galaxyPlaneMaterial({ mode: 'glow', map: haloT, gain: sp.halo[1], billboard: true })); hg.renderOrder = 9; hg.frustumCulled = false; gg.add(hg); e.mats.push(hg.material); e.halo = hg; }
    for (const k of Object.keys(gxMeta).filter((q) => q.startsWith(sp.key + '_'))) { const sm = shaders.starMaterial({ unit: gxMeta[k].unit_kpc, base: 1.3, amp: name === 'Andromeda' ? 1.1 : 1.3, big: 3 }); starSet(gxMeta, gxBuf, k, sm, 10, gg); (e.starMats = e.starMats || []).push(sm); }
    world.add(gg); gals.push(e); byNameG[name] = e;
  }
  // M32 and NGC 205 (M110): compact / dwarf ellipticals beside Andromeda (catalogue positions, Sersic profiles)
  for (const [name, tex, dia, min0, min1, gain] of [['M32', m32t, 1.6, 8, 3, 1.3], ['NGC 205', m110t, 7.5, 12, 3, 1.0]]) {
    const g = byName[name]; const gg = new T.Group(); gg.position.set(g.x, g.y, g.z);
    const m = new T.Mesh(new T.PlaneGeometry(dia, dia), shaders.galaxyPlaneMaterial({ mode: 'glow', map: tex, gain, billboard: true })); m.renderOrder = 10; m.frustumCulled = false; gg.add(m);
    world.add(gg); gals.push({ name, sp: { dia, min0, min1, ext: dia }, gg, mats: [m.material], basis: null });
  }
  // the Milky Way as seen from far away: the same maps on a flat disc about the galactic centre, drawn through the same exaggeration
  const mwFar = new T.Group(); mwFar.position.set(0, 0, -R0);
  { const geo = new T.PlaneGeometry(44, 44); geo.rotateX(-Math.PI / 2);
    const a = new T.Mesh(geo, shaders.galaxyPlaneMaterial({ mode: 'glow', map: mwGlow, gain: 0.8 })); a.renderOrder = 9; a.frustumCulled = false; mwFar.add(a);
    const d = new T.Mesh(geo, shaders.galaxyPlaneMaterial({ mode: 'dust', map: mwDust, gain: 1, dustCol: 0x2a1424 })); d.renderOrder = 11; d.frustumCulled = false; mwFar.add(d);
    const hg = new T.Mesh(new T.PlaneGeometry(26, 26), shaders.galaxyPlaneMaterial({ mode: 'glow', map: haloT, gain: 0.9, billboard: true })); hg.renderOrder = 9; hg.frustumCulled = false; mwFar.add(hg);
    world.add(mwFar); gals.push({ name: 'MW', sp: { dia: 31, min0: 150, min1: 18, ext: 44 }, gg: mwFar, mats: [a.material, d.material, hg.material], basis: null, mw: true }); }
  const MWc = new T.Vector3(0, 0, -R0), M31c = new T.Vector3(byName.Andromeda.x, byName.Andromeda.y, byName.Andromeda.z);
  const LGc = MWc.clone().lerp(M31c, 0.55);
  // Magellanic Stream (procedural, illustrative): a faint gas-and-star arc trailing from the Clouds towards the south galactic pole; Sgr dwarf below
  let sgrDwarf = null;
  // Sagittarius dwarf: a long, tidally stretched cloud behind the bulge (positions: catalogue; shape: procedural)
  { const sg = byName['Sagittarius dSph']; const n = 5000, pos = new Float32Array(n * 3), col = new Float32Array(n * 4), sz = new Float32Array(n * 2); let s = 1234567; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(6.2831853 * rnd());
    const ax = new T.Vector3(0.22, 0.88, 0.42).normalize();
    for (let i = 0; i < n; i++) { const a = gauss() * 2.6, b = gauss() * 0.9, c2 = gauss() * 0.9; const px = sg.x + ax.x * a + b, py = sg.y + ax.y * a + c2, pz = sg.z + ax.z * a + 0.3 * b; pos.set([px, py, pz], i * 3); col.set([1.0, 0.82 + 0.1 * rnd(), 0.58, 0.22 + 0.5 * rnd() * rnd()], i * 4); sz.set([0, 1.6 + rnd() * 1.6], i * 2); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aCol', new T.BufferAttribute(col, 4)); g.setAttribute('aSz', new T.BufferAttribute(sz, 2));
    const p = new T.Points(g, shaders.blobMaterial({ amp: 0.10, order: 6, beacon: 0 })); p.frustumCulled = false; p.renderOrder = 6; world.add(p); sgrDwarf = p; }

  const SP0 = new T.Vector3(byName.SMC.x, byName.SMC.y, byName.SMC.z), SP1 = new T.Vector3(18, -118, -72), SP2 = new T.Vector3(-34, -135, -20), SP3 = new T.Vector3(-85, -108, 52);
  const streamPt = (t) => { const u = 1 - t, w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]; return P(w[0] * SP0.x + w[1] * SP1.x + w[2] * SP2.x + w[3] * SP3.x, w[0] * SP0.y + w[1] * SP1.y + w[2] * SP2.y + w[3] * SP3.y, w[0] * SP0.z + w[1] * SP1.z + w[2] * SP2.z + w[3] * SP3.z); };
  { const n = 9000, pos = new Float32Array(n * 3), col = new Float32Array(n * 4), sz = new Float32Array(n * 2); let sd = 99991; const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
    const P0 = new T.Vector3(byName.SMC.x, byName.SMC.y, byName.SMC.z), P1 = new T.Vector3(18, -118, -72), P2 = new T.Vector3(-34, -135, -20), P3 = new T.Vector3(-85, -108, 52);
    const L0 = new T.Vector3(byName.LMC.x, byName.LMC.y, byName.LMC.z);
    // slow clumps along the arc: HI in the real Stream is a chain of knots and filaments, not a continuous ribbon
    const knot = (t) => 0.12 + 0.88 * Math.pow(0.5 + 0.5 * Math.sin(t * 23 + 1.3) * Math.sin(t * 9.1 + 0.4), 2);
    for (let i = 0; i < n; i++) {
      let x, y, z, t = 0;
      if (i < 1100) { const s = rnd(), a = new T.Vector3().lerpVectors(P0, L0, s); const sp = 1.4;   // the Magellanic Bridge between the two Clouds
        x = a.x + (rnd() - 0.5) * sp; y = a.y + (rnd() - 0.5) * sp; z = a.z + (rnd() - 0.5) * sp; col.set([0.66, 0.6, 1.0, 0.5 * (0.3 + rnd())], i * 4); sz.set([0, 3 + rnd() * 4], i * 2); }
      else { t = Math.pow(rnd(), 0.9); const u = 1 - t, w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]; const sp = 0.9 + 3.4 * t;
        x = w[0] * P0.x + w[1] * P1.x + w[2] * P2.x + w[3] * P3.x + (rnd() - 0.5) * sp; y = w[0] * P0.y + w[1] * P1.y + w[2] * P2.y + w[3] * P3.y + (rnd() - 0.5) * sp; z = w[0] * P0.z + w[1] * P1.z + w[2] * P2.z + w[3] * P3.z + (rnd() - 0.5) * sp;
        const mx = rnd(); col.set([0.62 + 0.3 * mx, 0.6, 1.0 - 0.2 * mx, 0.55 * (1 - 0.7 * t) * knot(t) * (0.2 + rnd())], i * 4); sz.set([0, 3 + rnd() * 5], i * 2); }
      pos.set([x, y, z], i * 3); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aCol', new T.BufferAttribute(col, 4)); g.setAttribute('aSz', new T.BufferAttribute(sz, 2));
    const p = new T.Points(g, shaders.blobMaterial({ amp: 0.05, order: 6, beacon: 0 })); p.frustumCulled = false; p.renderOrder = 6; world.add(p); var stream = p; }

  // ------------------------------------------------------------------ the neighbouring groups and the Virgo/Fornax clusters (real RA/Dec/distance; member positions scattered statistically)
  // so the Local Group hands over to the cosmic web as one island among others, not a lone speck
  const GROUPS = [['MESSIER081', 'M81 group · 12 million ly', true], ['NGC5128', 'Centaurus A group · 12 million ly', false]];
  const NB = nbrItems(); const nbrLabels = NB.labels; const nbr = mkGlyphs(NB.items, { amp: 0.0, order: 7, minPx: 3.6 });
  { const hide = (ctx.params.get('gh') || '').split(','); // debug: ?gh=stars,glow,dust,blobs
    if (hide.includes('stars')) Object.values(stars).forEach((p) => { p.visible = false; });
    for (const k of Object.keys(stars)) if (hide.includes(k)) stars[k].visible = false;
    if (hide.includes('glow')) glowPlane.visible = false; window.__gh = hide; if (hide.includes('dust')) dustPlane.visible = false;
    if (hide.includes('blobs')) [gcBlobs, sunBlob, sgrBlob, dwarfBlobs].forEach((p) => { p.visible = false; }); }
  // ------------------------------------------------------------------ labels (positions are level-local METRES)
  const P = (x, y, z) => new T.Vector3(x * KPC, y * KPC, z * KPC).applyQuaternion(QG);
  const armPos = (name, beta) => { const [x, y] = armPoint(ARMS[name], beta); return P(x, 0, y); };
  const gal = (n) => P(byName[n].x, byName[n].y, byName[n].z);
  const labels = [
    { text: 'The Sun · 26,700 ly from the centre', z0: 20.2, z1: 21.7, pos: () => P(0, 0, 0), amber: true },
    { text: 'Sagittarius A* · 4 million suns', z0: 21.3, z1: 21.65, pos: () => P(0, 0, -R0), right: true, amber: true },
    { text: 'Orion Spur · 3,500 ly wide', z0: 20.2, z1: 21.2, pos: () => armPos('Local (Orion Spur)', 24), right: true },
    { text: 'Perseus Arm', z0: 20.25, z1: 21.7, pos: () => armPos('Perseus', -22) },
    { text: 'Sagittarius–Carina Arm', z0: 20.9, z1: 21.7, pos: () => armPos('Sagittarius-Carina', -55), right: true },
    { text: 'Scutum–Centaurus Arm', z0: 20.9, z1: 21.7, pos: () => armPos('Scutum-Centaurus', -70), right: true },
    { text: 'Norma–Outer Arm', z0: 20.9, z1: 21.7, pos: () => armPos('Norma-Outer', -150) },
    { text: 'The Galactic bar', z0: 21.0, z1: 21.7, pos: () => P(1.6, 0, -R0 - 3.2), right: true },
    { text: 'Milky Way · 100,000 ly across', z0: 21.3, z1: 23.2, pos: () => P(-15 * mwK, 0, -R0), right: true, amber: true },
    { text: 'Large Magellanic Cloud · 160,000 ly', z0: 21.4, z1: 22.0, pos: () => gal('LMC') },
    { text: 'Small Magellanic Cloud · 200,000 ly', z0: 21.4, z1: 22.0, pos: () => gal('SMC'), right: true },
    { text: 'Andromeda · 2.5 million ly', z0: 22.0, z1: 23.25, pos: () => gal('Andromeda') },
    { text: 'Triangulum · 2.7 million ly', z0: 22.3, z1: 23.2, pos: () => gal('Triangulum') },
    { text: 'Sagittarius dwarf galaxy · 85,000 ly', z0: 21.3, z1: 22.0, pos: () => gal('Sagittarius dSph'), right: true },
    { text: 'Magellanic Stream · gas torn from the Clouds', z0: 21.5, z1: 22.2, pos: () => streamPt(0.3), right: true },
    { text: 'The Local Group · about 10 million ly across', z0: 23.0, z1: 23.6, pos: () => P(LGc.x, LGc.y, LGc.z), amber: true },
    ...nbrLabels.map((q) => ({ text: q.text, z0: 23.4, z1: 24.1, pos: () => P(q.c[0], q.c[1], q.c[2]), right: /Virgo/.test(q.text), amber: q.text.startsWith('Virgo') })),
    ...GROUPS.map(([nm, text, right]) => { const k = ungc.names.indexOf(nm); const q = ungc.g[k]; return { text, z0: 22.9, z1: 23.3, pos: () => P(q[0], q[1], q[2]), right }; }),
    { text: 'M32 + NGC 205', z0: 22.3, z1: 22.9, pos: () => gal('M32') },
  ];

  // ------------------------------------------------------------------ per-frame
  const dbgHide = (ctx.params.get('gh') || '').split(',');
  let lastZ = null;
  function update(t, S, z, c) {
    const zr = group.parent ? Math.log10(c.Wu / group.parent.scale.x) : z; const on = zr > 13.4 && !ctx.params.has('only');
    veilMat.uniforms.uOp.value = on ? ss(13.5, 13.95, zr) * (1 - ss(22.2, 23.0, zr)) : 0; veilMat.uniforms.uRes.value.set(innerWidth * dpr, innerHeight * dpr);
    sharedLaw(t, z, c.W, dpr); const pxk = shaders.shared.uPxPerKpc.value;
    // point stars get slightly bigger when zoomed in (they are resolved stars) and the Sgr A* sprite is only drawn when the centre is large enough
    const near = 1 - ss(21.5, 22.3, z); gcBlobs.material.uniforms.uAmp.value = 0.9 * near; sunBlob.material.uniforms.uAmp.value = near; sgrDwarf.material.uniforms.uAmp.value = 0.07 * near;
    sgrBlob.material.uniforms.uAmp.value = 1.25 * (1 - ss(21.7, 22.6, z));
    if (ctx.params.has('gdbg') && lastZ === null) console.log('GDBG pxk=' + pxk + ' gain=' + shaders.shared.uGain.value + ' fade=' + shaders.shared.uFade.value + ' W=' + c.W + ' iw=' + window.innerWidth + ' dpr=' + dpr);
    // ---- hand-over from the physical disc (point stars + shader disc) to the exaggerated far-field discs
    const nearK = 1 - ss(21.9, 22.7, z), farK = 1 - nearK, pxk2 = shaders.shared.uPxPerKpc.value / dpr * dpr;
    applyMW(mw, z, nearK);
    const fadeMW = ss(22.4, 22.9, z);
    mwK = 1 + 0.55 * ss(21.55, 21.95, z) * (1 - ss(22.05, 22.5, z)); mwRoot.scale.setScalar(mwK); mwRoot.position.set(0, 0, -R0 * (1 - mwK));
    for (const e of gals) {
      const { sp, gg } = e; const min = (sp.min0 + (sp.min1 - sp.min0) * ss(22.7, 24.0, z)) * (window.innerWidth / 1600);
      const phys = sp.dia * pxk; const k = Math.max(1, min / Math.max(phys, 1e-6));
      let mul = 1;
      if (e.mw) { mul = farK; if (z > 22.3) mwK = Math.min(3.5, k); } else if (e.name === 'LMC' || e.name === 'SMC') mul = 1 - ss(23.0, 23.6, z); else mul = 1;
      if (z > 23.0 && !(e.name === 'LMC' || e.name === 'SMC')) mul *= ss(1.2, 5.5, Math.min(sp.dia, sp.ext) * pxk * k);  // far field: hand over by apparent size, never by z
      if (e.mw || e.name === 'Andromeda' || e.name === 'Triangulum') mul *= 1 - ss(23.5, 23.9, z);   // the web's spiral glyphs take over at the same apparent size
      for (const m of e.mats) m.uniforms.uMul.value = mul;
      if (e.starMats) { const sm = (e.name === 'Andromeda' || e.name === 'Triangulum') ? 1 - ss(22.4, 23.3, z) : 1 - ss(22.0, 22.8, z); for (const m of e.starMats) m.uniforms.uAmp.value = (e.name === 'Andromeda' ? 1.1 : 1.3) * sm * (k > 1.5 ? 1 / Math.sqrt(k) : 1); }
      if (e.halo) e.halo.material.uniforms.uMul.value = mul * (0.25 + 0.75 * ss(21.8, 22.8, z));
      if (e.basis) { gg.matrix.makeBasis(bx.copy(e.basis[0]).multiplyScalar(k), by.copy(e.basis[1]).multiplyScalar(k), bz.copy(e.basis[2]).multiplyScalar(k)); gg.matrix.setPosition(gg.position); gg.matrixWorldNeedsUpdate = true; }
      else gg.scale.setScalar(k);
    }
    stream.material.uniforms.uAmp.value = 0.085 * ss(21.2, 21.7, z) * (1 - ss(22.0, 22.6, z));
    ungcGlyphs.material.uniforms.uMinPx.value = (6.5 + 4.5 * (1 - ss(22.9, 23.9, z))) * (window.innerWidth / 1600); const lw = popLaw(z); nbr.material.uniforms.uAmp.value = lw.nbr; ungcGlyphs.material.uniforms.uAmp.value = lw.ungc; dwarfBlobs.material.uniforms.uAmp.value = lw.dwarf;
    const far = z < HANDOFF_Z;   // above HANDOFF_Z the web level draws the very same population with the very same law
    // perf: switch off what cannot be seen (the 500k-point Milky Way is gone by z 22.8)
    const mwOn = nearK > 0.002; for (const p of Object.values(stars)) p.visible = mwOn; glowPlane.visible = mwOn; dustPlane.visible = mwOn; gcBlobs.visible = near > 0.002; sunBlob.visible = near > 0.002; sgrBlob.visible = z < 22.7; sgrDwarf.visible = near > 0.002; stream.visible = z < 22.7; nbr.visible = z > 22.9 && far; ungcGlyphs.visible = z > 22.3 && far && !dbgHide.includes('ungc'); dwarfBlobs.visible = far && !dbgHide.includes('dw'); for (const e of gals) e.gg.visible = far;
    mwRoot.visible = fadeLaw(z) > 0.002 && zr > 18.0;
    lastZ = z;
  }
  return { group, anchor: ctx.geom.EARTHC, labels, update, zMin: 18.8, zMax: 24.95 };
}
