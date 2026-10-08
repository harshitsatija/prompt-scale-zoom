/* Level "web" (z 23.4 .. 28.0): the cosmic web from real redshift surveys, ending at the edge of the observable universe.
 * Real data: Karachentsev+2013 Local Volume catalogue (865 galaxies <= 26 Mpc), 2MASS Redshift Survey (VizieR J/ApJS/199/26), SDSS DR17 spectroscopic galaxies
 * (SkyServer SQL), Planck 2015 SMICA CMB map. Footprint gaps, the flux-limited thinning and the deep universe are filled with a Zel'dovich-approximation LCDM mock
 * (see assets/web/SOURCES.md). Scene frame: Mpc, Milky Way at the origin, axes as the galaxy level (x = -Y_gal, y = NGP, z = -X_gal).
 * Rendering: a thick slab of the universe around the focus plane (not a line-of-sight pile-up), density-weighted so filaments and voids read; named structures get
 * markers, leader lines and (for Laniakea and the Bootes void) dotted outlines; the CMB shell only appears once the camera has pulled back past the web. */
import * as shaders from './web/shaders.js';
import * as gsh from './galaxy/shaders.js';
import { HANDOFF_Z, popLaw, capLaw, dwarfItems, ungcItems, nbrItems, glyphAttrs } from './galaxy/pop.js';
import { R0 as MW_R0 } from './galaxy/model.js';

const MPC = 3.0856775814913673e22;
// display orientation of the whole web (rotation about the Milky Way): the camera looks straight down the SUPERGALACTIC pole (Lahav/de Vaucouleurs plane: Virgo, Coma, the Great Attractor and Shapley all lie in it), so the
// named structures sit in the picture plane and on-screen distances are true lateral distances (no foreshortening). In-plane angle chosen for composition. Blended in over z 24.7-25.3.
const ROT = [[-0.037844161055639064, 0.9788226729196756, 0.20118149629719098], [0.12938642965586172, 0.20443068346217264, -0.9702923515518906], [-0.9908718238475164, -0.010689744504467025, -0.13438287862494097]];

export default async function build(ctx) {
  const { T, kit } = ctx, { ss } = kit;
  const group = new T.Group(); const world = new T.Group(); world.scale.setScalar(MPC); group.add(world);
  const ann = new T.Group(); ann.scale.setScalar(MPC); group.add(ann);          // annotations: Mpc units, not rotated
  const dpr = ctx.params.has('dpr') ? Number(ctx.params.get('dpr')) : Math.min(2, window.devicePixelRatio || 1);
  shaders.shared.uDpr.value = dpr;
  const [meta, buf, struct, lv, ungc, lg] = await Promise.all([ctx.fetchJSON('web/web_pts.json'), Promise.all([ctx.fetchBuf('web/web_pts.bin.a'), ctx.fetchBuf('web/web_pts.bin.b')]).then(([a, b]) => { const o = new Uint8Array(a.byteLength + b.byteLength); o.set(new Uint8Array(a), 0); o.set(new Uint8Array(b), a.byteLength); return o.buffer; }), ctx.fetchJSON('web/web_struct.json'), ctx.fetchJSON('web/local_volume.json'), ctx.fetchJSON('galaxy/ungc.json'), ctx.fetchJSON('galaxy/localgroup.json')]);
  const RMAX = meta.rmax_mpc; shaders.shared.uRmax.value = RMAX;
  const dens = new Uint8Array(await ctx.fetchBuf('web/density.bin')); const mk3 = (off) => { const t = new T.Data3DTexture(dens.subarray(off, off + 128 ** 3), 128, 128, 128); t.format = T.RedFormat; t.type = T.UnsignedByteType; t.unpackAlignment = 1; t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter; t.wrapS = t.wrapT = t.wrapR = T.RepeatWrapping; t.generateMipmaps = true; t.needsUpdate = true; return t; };
  const dA = mk3(0), dB = mk3(128 ** 3);
  const cmb = await new T.CubeTextureLoader().loadAsync(['px', 'nx', 'py', 'ny', 'pz', 'nz'].map((f) => ctx.assetURL('web/cmb_' + f + '.png')));   // Planck SMICA cube map (greyscale temperature)
  cmb.colorSpace = T.NoColorSpace; cmb.minFilter = T.LinearMipmapLinearFilter; cmb.magFilter = T.LinearFilter; cmb.generateMipmaps = true; cmb.flipY = false; cmb.anisotropy = 8;

  const Rm = new T.Matrix4().set(...ROT[0], 0, ...ROT[1], 0, ...ROT[2], 0, 0, 0, 0, 1); const Qfull = new T.Quaternion().setFromRotationMatrix(Rm), Qid = new T.Quaternion(-0.24415823, -0.19411138, 0.83003636, 0.46233);   // Qid = the Earth-frame orientation the galaxy level draws in (galaxy.js QG): the web starts exactly where the galaxy level is

  const Qw = new T.Quaternion();

  const geoOf = (m) => {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Int16Array(buf, m.pos, m.n * 3), 3));
    g.setAttribute('aA', new T.BufferAttribute(new Uint8Array(buf, m.col, m.n * 2), 2));
    return g;
  };
  const gNear = geoOf(meta.sets.near), gFar = geoOf(meta.sets.far);
  // The deep fill is a mock whose radial density was thinned (r^-3) only to keep the point count displayable. The real universe is homogeneous on these scales, so each far point
  // also gets a second radius drawn uniformly in comoving volume (same direction), and the shader morphs to it as the camera pulls out beyond z~26.6 (structures there are
  // far below one pixel, so the morph is invisible; what remains is a statistically homogeneous haze out to the edge).
  { const m = meta.sets.far, a = new Int16Array(buf, m.pos, m.n * 3), R0 = 2300, aR = new Float32Array(m.n); let s = 99991;
    for (let i = 0; i < m.n; i++) { s = (s * 1664525 + 1013904223) >>> 0; const u = s / 4294967296; aR[i] = Math.cbrt(R0 ** 3 + u * (RMAX ** 3 - R0 ** 3)); }
    gFar.setAttribute('aR', new T.BufferAttribute(aR, 1)); }
  const mk = (geo, mat, order, par = world) => { const p = new T.Points(geo, mat); p.frustumCulled = false; p.renderOrder = order; par.add(p); return p; };

  // backdrop: the observable universe has no flare stars outside it
  const voidQ = new T.Mesh(new T.PlaneGeometry(2, 2), shaders.voidMaterial()); voidQ.frustumCulled = false; voidQ.renderOrder = -100; group.add(voidQ);

  // volumetric haze (smooth density field, homogeneous, fills the whole field out to the CMB shell)
  const hazeMat = shaders.hazeMaterial(dA, dB); const hazeV = new T.Mesh(new T.PlaneGeometry(2, 2), hazeMat); hazeV.frustumCulled = false; hazeV.renderOrder = 1; world.add(hazeV);

  // CMB shell (back: seen through the web; front: luminous limb)
  const shellGeo = new T.SphereGeometry(RMAX, 160, 96);
  const shellBack = new T.Mesh(shellGeo, shaders.shellMaterial(cmb, true)); shellBack.renderOrder = 0; shellBack.frustumCulled = false; world.add(shellBack);
  

  // galaxies: crisp points (real ones brighter), two soft haze layers (clusters + filaments only), the deep fill
  const mNear = shaders.pointMaterial({ unit: meta.sets.near.unit, sizeMpc: 0.16, minPx: 1.8, maxPx: 16, gain: 1.0, comp: 0.55, realBoost: 2.4, fillK: 1.25, dlo: 0.10, dhi: 1.6, dsize: 0.9, sub: 0.0 });
  const mHaze = shaders.pointMaterial({ unit: meta.sets.near.unit, sizeMpc: 1.6, minPx: 3.0, maxPx: 48, gain: 0.14, comp: 1.9, dmin: 0.36, realBoost: 1.0, fillK: 1.0, dlo: 0.2, dhi: 1.0, dsize: 0.5, sub: 0.0 });
  const mHaze2 = shaders.pointMaterial({ unit: meta.sets.near.unit, sizeMpc: 7.0, minPx: 5.0, maxPx: 60, gain: 0.05, comp: 2.0, dmin: 0.5, realBoost: 1.0, fillK: 1.0, dlo: 0.2, dhi: 1.0, dsize: 0.5, sub: 0.0 });
  const mFar = shaders.pointMaterial({ morph: true, unit: meta.sets.far.unit, sizeMpc: 0.0, sizeR: 0.012, minPx: 3.0, maxPx: 40, gain: 0.8, gainR: 0.0006, comp: 1.2, realBoost: 1.0, fillK: 1.0, dlo: 0.6, dhi: 0.0, dsize: 0.0, sub: 0.0 });
  const near = mk(gNear, mNear, 3), haze = mk(gNear, mHaze, 2), haze2 = mk(gNear, mHaze2, 1), far = mk(gFar, mFar, 4);
  near.userData.name = 'web_near'; far.userData.name = 'web_far'; haze.userData.name = 'web_haze'; haze2.userData.name = 'web_haze2';

  // the Local Volume: THE SAME population the galaxy level draws (levels/galaxy/pop.js): Karachentsev UNGC galaxies, Local Group dwarfs, Virgo/Fornax members, same glyphs, colours, luminosity law.
  // The galaxy level hands these points to this level at HANDOFF_Z; the web then densifies around them (the radial gate on the survey points below) instead of switching to another set.
  const popSets = [];
  const mkPop = (items, minPx, amp, ampOf, order = 5) => { const m = gsh.glyphMaterial({ amp, minPx, order }); m.uniforms.uPxPerKpc = { value: 1 }; m.uniforms.uFade = { value: 1 }; m.uniforms.uDpr = { value: dpr }; m.uniforms.uCap = { value: 0.7 };
    const pts = new T.Points(glyphAttrs(T, items, 0.001), m); pts.frustumCulled = false; pts.renderOrder = order; world.add(pts); popSets.push({ pts, m, ampOf }); return { pts, m }; };
  const gx = (n) => { const g = lg.galaxies.find((q) => q.name === n); return [g.x, g.y, g.z]; };
  mkPop(ungcItems(ungc), 6.5, 1, (lw) => lw.ungc);
  mkPop(dwarfItems(lg, new Set(['Andromeda', 'Triangulum'])), 9, 2.4, (lw) => lw.dwarf);
  mkPop(nbrItems().items, 3.6, 1, (lw) => lw.nbr);
  // the three big spirals of the Local Group (Milky Way, Andromeda, Triangulum): spiral glyphs, drawn a little larger than a dwarf while the field is still narrow
  const heroes = [[{ p: [0, 0, -MW_R0], r: 15, c: [0.8, 0.86, 1.0], lum: 0.9, type: 1, rot: 1.2, ar: 0.5, seed: 0.5 }, 1.0], [{ p: gx('Andromeda'), r: 33, c: [0.85, 0.88, 1.0], lum: 1.0, type: 1, rot: 0.66, ar: 0.35, seed: 0.2 }, 1.2], [{ p: gx('Triangulum'), r: 9, c: [0.75, 0.86, 1.0], lum: 0.8, type: 1, rot: 0.35, ar: 0.55, seed: 0.7 }, 0.45]].map(([it, rel]) => ({ ...mkPop([it], 10, 1, () => 1, 6), rel }));   // the three big spirals of the Local Group: the same spiral glyph the galaxy level's discs hand over to, shrinking by geometry (their minimum size falls with the field) until they are three more points of the web
  const lvPts = { visible: true };
  // the Milky Way: an amber glint at the very centre, marked 'her'
  const mkGeo = new T.BufferGeometry(); mkGeo.setAttribute('position', new T.BufferAttribute(new Float32Array([0, 0, 0]), 3));
  const mMark = shaders.markerMaterial(0xffb347, 30, 0.3); const mark = new T.Points(mkGeo, mMark); mark.frustumCulled = false; mark.renderOrder = 9;

  // ---------------- named structures: markers, outlines, leader lines, label layout
  const V = (a) => new T.Vector3(...a);
  const lvPos = (name) => { const i = lv.name[name]; return new T.Vector3(lv.x[i], lv.y[i], lv.z[i]); };
  const SP = (k) => V(struct[k].p);
  // name, text, z0, z1, position, opts: right (text left of the dot), amber, ring: outline size (Mpc) / col / shape. Each structure is labelled in its own zoom window (3.4 x its
  // distance across the frame .. +0.7 dex) so that its marker really sits where the catalogue puts it relative to the frame, never piled on the centre.
  const SGW = V(struct.sgw.dir);
  const A = [
    { k: 'her', text: 'her · the Milky Way', z0: 23.5, z1: 26.0, P: new T.Vector3(), amber: true, right: true, own: true, dx: -16, dy: 44 },
    { k: 'm31', text: 'Andromeda · 2.5 million ly', z0: 23.5, z1: 24.0, P: lvPos('MESSIER031'), lvOnly: true, dx: 46, dy: -26 },
    { k: 'm33', text: 'Triangulum · 2.7 million ly', z0: 23.5, z1: 23.9, P: lvPos('MESSIER033'), lvOnly: true, right: true, dx: -34, dy: -34 },
    { k: 'n253', text: 'Sculptor Galaxy (NGC 253) · ~12 million ly', z0: 23.4, z1: 24.2, P: lvPos('NGC0253'), right: true },
    { k: 'cena', text: 'Centaurus A group · 12 million ly', z0: 23.4, z1: 24.1, P: lvPos('NGC5128'), right: true },
    { k: 'm81', text: 'M81 group · 12 million ly', z0: 23.4, z1: 24.1, P: lvPos('MESSIER081') },
    { k: 'm83', text: 'Messier 83 · 16 million ly', z0: 23.4, z1: 24.2, P: lvPos('NGC5236') },
    { k: 'virgo', text: 'Virgo Cluster · 54 million ly', z0: 24.1, z1: 25.35, P: SP('virgo'), dy: 12 },
    { k: 'ga', text: 'Great Attractor · 215 million ly', z0: 24.75, z1: 25.55, P: SP('ga'), right: true },
    { k: 'lan', text: 'Laniakea Supercluster · 520 million ly across', z0: 24.85, z1: 25.7, P: SP('lan'), amber: true  },
    { k: 'coma', text: 'Coma Cluster · 320 million ly', z0: 25.0, z1: 25.8, P: SP('coma') },
    { k: 'shapley', text: 'Shapley Concentration · 650 million ly', z0: 25.3, z1: 25.95, P: SP('shapley'), right: true },
    { k: 'bootes', text: 'Boötes Void · 330 million ly across', z0: 25.35, z1: 25.95, P: SP('bootes')  },
    { k: 'sgw', text: 'Sloan Great Wall · 1.4 billion ly long', z0: 25.55, z1: 26.1, P: SP('sgw')  },
    { k: 'cmb', text: 'The CMB · the last-scattering surface, light from 380,000 years after the Big Bang', z0: 26.7, z1: 28.0, limb: 2.55, right: true },
    { k: 'edge', text: 'Edge of the observable universe · 93 billion ly across', z0: 26.7, z1: 28.0, brk: true, amber: true },
  ];
  const nA = A.length, NR = 220;
  A.forEach((a) => { a.lab = new T.Vector3(); a.al = 0; a.mkc = a.amber ? [1.0, 0.82, 0.45] : [0.85, 0.9, 1.0]; a.w = 10 + 6.2 * a.text.length; });
  // markers (rings) for non-'own', non-limb items; leader lines; dotted outlines
  const ringGeo = new T.BufferGeometry(), ringP = new Float32Array(nA * 3), ringC = new Float32Array(nA * 4); ringGeo.setAttribute('position', new T.BufferAttribute(ringP, 3)); ringGeo.setAttribute('aC', new T.BufferAttribute(ringC, 4));
  const rings = new T.Points(ringGeo, shaders.ringsMaterial()); rings.frustumCulled = false; rings.renderOrder = 10;
  const NL = nA + 6; const ldGeo = new T.BufferGeometry(), ldP = new Float32Array(NL * 6), ldC = new Float32Array(NL * 8); ldGeo.setAttribute('position', new T.BufferAttribute(ldP, 3)); ldGeo.setAttribute('aC', new T.BufferAttribute(ldC, 4));
  const leaders = new T.LineSegments(ldGeo, shaders.leaderMaterial()); leaders.frustumCulled = false; leaders.renderOrder = 10;
  const outl = A.filter((a) => a.ring); const dotN = outl.length * NR;
  const dtGeo = new T.BufferGeometry(), dtP = new Float32Array(dotN * 3), dtC = new Float32Array(dotN * 4); dtGeo.setAttribute('position', new T.BufferAttribute(dtP, 3)); dtGeo.setAttribute('aC', new T.BufferAttribute(dtC, 4));
  const dots = new T.Points(dtGeo, shaders.dotsMaterial(5.0)); dots.frustumCulled = false; dots.renderOrder = 10;

  // camera-plane basis in group-local coordinates
  let zNow = 27; const qc = new T.Quaternion(), eu = new T.Euler(), AX = new T.Vector3(), UP = new T.Vector3(), RT = new T.Vector3(), tq = new T.Vector3();
  let cd = 1, ppm = 1, Wpx = 1600, Hpx = 900;
  function basis(z) { eu.set(-ctx.plan.pitchAt(z), ctx.plan.yawAt(z, 0), 0, 'YXZ'); qc.setFromEuler(eu); AX.set(0, 0, -1).applyQuaternion(qc); UP.set(0, 1, 0).applyQuaternion(qc); RT.set(1, 0, 0).applyQuaternion(qc); }
  const fade = (a, z) => Math.min(ss(a.z0 - 0.2, a.z0 + 0.1, z), 1 - ss(a.z1 - 0.1, a.z1 + 0.2, z));
  const zero4 = (arr, i) => { arr[i * 4] = arr[i * 4 + 1] = arr[i * 4 + 2] = arr[i * 4 + 3] = 0; };
  const E1 = new T.Vector3(), E2 = new T.Vector3(), TMP = new T.Vector3();
  // outline contour (Mpc) of a structure in the camera plane through its centre: circle, an irregular 'basin' (schematic Laniakea), or a slab (super-ellipse along `dir`)
  const HARM = [[2, 0.13, 0.7], [3, 0.09, 2.1], [5, 0.05, 4.0], [7, 0.03, 1.1]];
  function contour(a, th, out) {
    const c = Math.cos(th), s_ = Math.sin(th);
    if (a.shape === 'slab') { const n = 6, A_ = a.ring, B_ = a.wid; out.set(A_ * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), B_ * Math.sign(s_) * Math.pow(Math.abs(s_), 2 / n), 0); return out; }
    let r = a.ring; if (a.shape === 'blob') { let m = 1; for (const [k, amp, ph] of HARM) m += amp * Math.sin(k * th + ph); r *= m; }
    return out.set(r * c, r * s_, 0);
  }
  const CP = new T.Vector3();
  function layout(z) {
    const Wm = Math.pow(10, z) / MPC; cd = 2.54 * Wm; ppm = Wpx / Wm;
    const act = []; const hx = Wpx * 0.5, hy = Hpx * 0.5 - 70;
    for (let i = 0; i < nA; i++) {
      const a = A[i]; a.al = fade(a, z);
      zero4(ringC, i); ldC.fill(0, i * 8, i * 8 + 8);
      if (a.al < 0.01 || (a.lvOnly && z > 24.1)) { a.on = false; continue; }
      a.on = true;
      if (a.limb !== undefined) { const Rp = RMAX * ppm, lim = Math.min(1, (Hpx * 0.5 - 160) / Rp), th = a.limb > 0 ? Math.PI - Math.asin(Math.min(lim, Math.sin(Math.PI - a.limb))) : -Math.asin(Math.min(lim, Math.sin(-a.limb)));
        a.q = tq.set(0, 0, 0).addScaledVector(RT, Math.cos(th)).addScaledVector(UP, Math.sin(th)).multiplyScalar(RMAX).clone(); }
      else if (a.brk) { a.q = new T.Vector3().addScaledVector(UP, -1.16 * RMAX); }
      else a.q = a.P.clone().applyQuaternion(Qw);
      const D = cd + a.q.dot(AX), sc = ppm * cd / D;
      a.D = D; a.sc = sc; a.su = a.q.dot(RT) * sc; a.sv = a.q.dot(UP) * sc;
      // outline plane basis: camera plane (slab: long axis = projection of `dir`)
      if (a.ring) { E1.copy(RT); E2.copy(UP);
        if (a.shape === 'slab') { TMP.copy(a.dir).applyQuaternion(Qw); const u = TMP.dot(RT), v = TMP.dot(UP), l = Math.hypot(u, v) || 1; E1.set(0, 0, 0).addScaledVector(RT, u / l).addScaledVector(UP, v / l); E2.set(0, 0, 0).addScaledVector(RT, -v / l).addScaledVector(UP, u / l); }
        a.e1 = E1.clone(); a.e2 = E2.clone(); }
      let lu = a.own ? a.su : a.su + (a.right ? -22 : 22), lv = a.own ? a.sv : a.sv + 20;
      if (a.ring) { const Rp = (a.shape === 'slab' ? a.ring : a.ring * 1.1) * sc; if (Rp < 0.42 * Wpx) { let best = null; for (const th of [a.edge, a.edge + Math.PI]) { contour(a, th, CP); const ex = (a.e1.dot(RT) * CP.x + a.e2.dot(RT) * CP.y) * sc, ey = (a.e1.dot(UP) * CP.x + a.e2.dot(UP) * CP.y) * sc, far = Math.hypot(a.su + ex, a.sv + ey); if (!best || far > best.far) best = { ex, ey, far }; }   // label at whichever end of the outline is farther from the frame centre (clear of the crowded core)
        lu = a.su + best.ex; lv = a.sv + best.ey; a.right = best.ex < 0; } else a.edgeOff = true; }
      if (a.limb !== undefined) { lu = a.su; lv = a.sv; }
      if (a.limb !== undefined) a.right = a.limb > 0 ? (lu + hx - 24 >= a.w) : (hx - lu - 24 < a.w);
      if (a.dx) lu += a.dx; if (a.dy) lv += a.dy;
      if (a.brk) { lu = a.su + 8; lv = a.sv; a.right = false; lu = -a.w * 0.5; }
      a.lu = lu; a.lv = lv; a.fixed = !!a.own || !!a.brk; act.push(a);
    }
    // keep labels on screen, then push overlapping ones apart vertically (they are ~22 px tall)
    const rect = (a) => (a.right ? [a.lu - a.w, a.lu] : [a.lu, a.lu + a.w]);
    for (let it = 0; it < 40; it++) {
      for (const a of act) { if (a.brk) continue; const lo = a.right ? -hx + a.w + 24 : -hx + 24, hi = a.right ? hx - 24 : hx - a.w - 24; a.lu = Math.min(hi, Math.max(lo, a.lu)); a.lv = Math.min(hy, Math.max(-hy, a.lv)); }
      for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
        const a = act[i], b = act[j], ra = rect(a), rb = rect(b);
        if (ra[1] < rb[0] - 8 || rb[1] < ra[0] - 8) continue;
        const dv = b.lv - a.lv; if (Math.abs(dv) >= 26) continue;
        const push = (26 - Math.abs(dv)) * 0.5 + 0.5, s = dv >= 0 ? 1 : -1;
        if (a.fixed && b.fixed) continue; if (a.fixed) b.lv += 2 * push * s; else if (b.fixed) a.lv -= 2 * push * s; else { a.lv -= push * s; b.lv += push * s; }
      }
    }
    // write geometry
    let ln = 0, dn = 0;
    const seg = (p0, p1, col, al) => { if (ln >= NL) return; ldP.set([p0.x, p0.y, p0.z, p1.x, p1.y, p1.z], ln * 6); ldC.set([col[0], col[1], col[2], al, col[0], col[1], col[2], al], ln * 8); ln++; };
    for (let i = 0; i < nA; i++) {
      const a = A[i]; if (!a.on) continue;
      const k = a.D / (cd * ppm);                                  // px -> Mpc at this structure's depth
      a.lab.copy(a.q).addScaledVector(RT, (a.lu - a.su) * k).addScaledVector(UP, (a.lv - a.sv) * k);
      const al = a.al;
      if (a.brk) { a.lab.copy(a.q).addScaledVector(UP, -26 * k); continue; }   // plain caption under the sphere
      if (false) { ringP.set([a.q.x, a.q.y, a.q.z], i * 3); ringC.set([a.mkc[0], a.mkc[1], a.mkc[2], al * (a.ring ? 0.7 : 0.9)], i * 4); }
      const sep = Math.hypot(a.lu - a.su, a.lv - a.sv);
      if (false) {
        const f = 9 / sep, sx = a.su + (a.lu - a.su) * f, sy = a.sv + (a.lv - a.sv) * f;
        TMP.copy(a.q).addScaledVector(RT, (sx - a.su) * k).addScaledVector(UP, (sy - a.sv) * k); seg(TMP, a.lab, a.mkc, al * 0.9);
      }
      if (a.ring) { const c = a.ringCol, hide = a.ring * a.sc > 6 * Wpx ? 0 : 1, e1 = a.e1, e2 = a.e2;
        for (let j = 0; j < NR; j++) { const th = (j / NR) * 6.2831853, idx = dn * 3, ic = dn * 4; contour(a, th, CP);
          dtP[idx] = a.q.x + e1.x * CP.x + e2.x * CP.y; dtP[idx + 1] = a.q.y + e1.y * CP.x + e2.y * CP.y; dtP[idx + 2] = a.q.z + e1.z * CP.x + e2.z * CP.y;
          dtC[ic] = c[0]; dtC[ic + 1] = c[1]; dtC[ic + 2] = c[2]; dtC[ic + 3] = al * 1.4 * hide; dn++; } }
    }
    for (let i = ln; i < NL; i++) { ldP.fill(0, i * 6, i * 6 + 6); ldC.fill(0, i * 8, i * 8 + 8); }
    for (let i = dn; i < dotN; i++) dtC[i * 4 + 3] = 0;
    ringGeo.attributes.position.needsUpdate = ringGeo.attributes.aC.needsUpdate = true;
    ldGeo.attributes.position.needsUpdate = ldGeo.attributes.aC.needsUpdate = true;
    dtGeo.attributes.position.needsUpdate = dtGeo.attributes.aC.needsUpdate = true;
  }
  // the engine copies label objects when it loads the level, so a label cannot change its own side later: limb labels exist in two variants (text left / text right)
  // and the one that does not fit simply reports a position far behind the far plane (the engine hides it).
  const FAR_AWAY = new T.Vector3(0, 0, -1e33);
  const labels = [];
  A.forEach((a) => {
    const mk1 = (side) => ({ text: a.text, z0: a.z0 - 0.45, z1: a.z1 + 0.45, right: side, amber: !!a.amber, pos: () => (a.on && a.al > 0.5 && ((a.limb === undefined && !a.ring) || !!a.right === side) ? a.lab.clone().multiplyScalar(MPC) : FAR_AWAY) });
    if (a.limb === undefined && !a.ring) labels.push(mk1(!!a.right)); else { labels.push(mk1(true)); labels.push(mk1(false)); }
  });
  const syncRight = () => {};

  const keys = (arr, z) => { if (z <= arr[0][0]) return arr[0][1]; for (let i = 1; i < arr.length; i++) if (z <= arr[i][0]) { const t = (z - arr[i - 1][0]) / (arr[i][0] - arr[i - 1][0]); return arr[i - 1][1] + (arr[i][1] - arr[i - 1][1]) * t; } return arr[arr.length - 1][1]; };
  // per-layer envelopes (z -> multiplier)
  const GH = [[23.4, 0.10], [24.0, 0.25], [24.9, 1.0], [25.5, 1.0], [26.2, 0.25], [27.0, 0.1], [27.3, 0.0], [28, 0.0]];
  const GH2 = [[24.4, 0.0], [24.9, 0.7], [25.5, 1.0], [26.0, 0.2], [26.5, 0.0]];
  const GF = [[23.4, 0.0], [25.5, 0.0], [26.3, 0.35], [27.0, 0.7], [28, 0.8]];
  const GNl = [[23.4, 0.6], [24.0, 0.55], [24.6, 0.8], [25.0, 1.0]];   // survey points arrive at the brightness of the catalogue glyphs they grow out of, then rise to the web's own level
  const GHz = [[25.5, 0.0], [26.2, 0.5], [26.45, 0.35], [26.75, 0.0], [28, 0.0]];
  const GCm = [[26.6, 0.50], [27.0, 0.62], [27.4, 0.82], [28, 0.88]];
  const GLv = [[23.4, 1.0], [24.4, 0.9], [25.0, 0.0]];

  // ---- auto-exposure: how much sprite area covers a screen pixel at each z (counted on a fair sample of the data through the real camera path and slab)
  const slabMul = (z) => 1.1 - 0.78 * ss(24.5, 25.0, z) * (1 - ss(26.3, 26.8, z)) + 6000 * ss(26.7, 27.3, z);   // thinner slab while voids / walls are labelled, so a void is not filled by line-of-sight galaxies
  const exposure = (() => {
    const sample = (m, n) => { const a = new Int16Array(buf, m.pos, Math.min(n, m.n) * 3); return { a, scale: m.n / Math.min(n, m.n), unit: m.unit }; };
    const sN = sample(meta.sets.near, 450000), sF = sample(meta.sets.far, 300000);
    const tab = [];
    const e = new T.Euler(), q = new T.Quaternion(), ax = new T.Vector3(), up = new T.Vector3(), rt = new T.Vector3(), qi = new T.Quaternion();
    const scr = 1600 * 900 * dpr * dpr, qw = new T.Quaternion();
    for (let z = 23.0; z <= 28.01; z += 0.1) {
      const W = Math.pow(10, z) / MPC, ppmz = 1600 * dpr / W;
      e.set(-ctx.plan.pitchAt(z), ctx.plan.yawAt(z, 0), 0, 'YXZ'); q.setFromEuler(e);
      qw.copy(Qid).slerp(Qfull, ss(24.7, 25.3, z)); qi.copy(qw).invert();
      ax.set(0, 0, -1).applyQuaternion(q).applyQuaternion(qi); up.set(0, 1, 0).applyQuaternion(q).applyQuaternion(qi); rt.set(1, 0, 0).applyQuaternion(q).applyQuaternion(qi);
      const cdz = 2.54 * W, S = slabMul(z) * W;
      const run = (smp, far) => {
        let tot = 0, core = 0; const A_ = smp.a, u = smp.unit, n = A_.length / 3;
        for (let i = 0; i < n; i++) {
          const x = A_[3 * i] * u, y = A_[3 * i + 1] * u, zz = A_[3 * i + 2] * u;
          const dd = x * ax.x + y * ax.y + zz * ax.z, D = dd + cdz; if (D < 0.4 * cdz) continue;
          const sl = 1 - Math.min(1, Math.max(0, (Math.abs(dd) / S - 0.55) / 0.45)); if (sl <= 0.003) continue;
          const px_ = x * rt.x + y * rt.y + zz * rt.z, py_ = x * up.x + y * up.y + zz * up.z;
          const fx = Math.abs(px_) / (D / 5.08), fy = Math.abs(py_) / (D / 8.13);
          if (fx > 1 || fy > 1) continue;
          const r = Math.hypot(x, y, zz), ph = far ? 0.012 * r * ppmz * cdz / D : 0.16 * 1.1 * ppmz * cdz / D, px = Math.min(far ? 40 : 16, Math.max(far ? 3.0 : 1.8, ph));
          const w = px * px * 0.5 * sl; tot += w; if (fx < 0.28 && fy < 0.28) core += w;
        }
        return [tot * smp.scale / scr, core * smp.scale / (scr * 0.0784)];
      };
      const rn = run(sN, false), rf = run(sF, true);
      tab.push([z, rn[0], rf[0], rn[1], rf[1]]);
    }
    return tab;
  })();
  const expo = (z) => { const i = Math.max(0, Math.min(exposure.length - 2, Math.floor((z - 23.0) / 0.1 + 1e-6))); const t = Math.min(1, Math.max(0, (z - exposure[i][0]) / 0.1)); return [1, 2, 3, 4].map((k) => exposure[i][k] * (1 - t) + exposure[i + 1][k] * t); };
  const BTARGET = ctx.params.has('btarget') ? Number(ctx.params.get('btarget')) : 0.22;
  const GEmax = [[23.4, 1.5], [25.5, 1.3], [26.4, 1.0], [28, 1.0]];
  const GNr = [[26.0, 1.0], [26.44, 1.0], [26.9, 0.12], [27.0, 0.05], [27.3, 0.012], [28, 0.006]];
  const GXf = [[26.0, 1.3], [26.5, 0.7], [26.85, 0.10], [27.1, 0.0], [28, 0.0]];
  const GXk = [[26.0, 1.0], [26.6, 0.5], [27.0, 0.2], [27.7, 0.1], [28, 0.1]]; const GXo = ctx.params.has('gx') ? Number(ctx.params.get('gx')) : 1; const GN = ctx.params.has('gn') ? Number(ctx.params.get('gn')) : 1, GFo = ctx.params.has('gf') ? Number(ctx.params.get('gf')) : 1; const GX = (z) => GXo * keys(GXk, z);
  const camV = new T.Vector3();
  function update(t, S, z, c) {
    zNow = z; Wpx = window.innerWidth; Hpx = window.innerHeight;
    Qw.copy(Qid).slerp(Qfull, ss(24.7, 25.3, z)); world.quaternion.copy(Qw); world.updateWorldMatrix(true, false);
        shaders.shared.uPxPerMpc.value = Wpx / (c.W / MPC);
    shaders.shared.uVis.value = 1;
    shaders.shared.uSlab.value = slabMul(z) * c.Wu; shaders.shared.uMorph.value = ss(26.0, 26.5, z);
    shaders.shared.uShell.value = ss(26.6, 27.45, z); shaders.shared.uShellFront.value = ss(26.5, 27.2, z);
    shaders.shared.uRes.value.set(Wpx * dpr, Hpx * dpr);
    voidQ.material.uniforms.uA.value = ss(23.4, 23.65, z);
    const [oN, oF, cN, cF] = expo(z), ff = keys(GF, z); const tot = Math.sqrt((oN + oF * ff * 0.5) * (cN + cF * ff * 0.5));
    const E = Math.min(keys(GEmax, z), BTARGET / (0.35 * tot + 0.02));
    mNear.uniforms.uGain.value = E * keys(GNl, z) * keys(GNr, z) * GX(z) * GN; mHaze.uniforms.uGain.value = 0.14 * keys(GH, z) * Math.min(1, E * 1.2); mHaze2.uniforms.uGain.value = 0.05 * keys(GH2, z) * Math.min(1, E * 1.2);
    mFar.uniforms.uGain.value = 0.5 * E * ff * keys(GXf, z) * GFo * 0.8;
    { const lw = popLaw(z), lvF = 1 - ss(24.3, 25.0, z), pk = shaders.shared.uPxPerMpc.value / 1000, on = z >= HANDOFF_Z && lvF > 0.002;
      for (const q of popSets) { q.pts.visible = on; q.m.uniforms.uAmp.value = (q.ampOf(lw) || 1) * lvF; q.m.uniforms.uPxPerKpc.value = pk; q.m.uniforms.uCap.value = capLaw(z); }
      { const wk = Wpx / 1600, sh = Math.exp(Math.log(4.5 / 62) * ss(23.7, 25.4, z)) * 62 * wk, ha = ss(23.45, 23.9, z) * (1 - ss(25.6, 26.4, z)); for (const h of heroes) { h.m.uniforms.uMinPx.value = sh * h.rel; h.m.uniforms.uAmp.value = ha; h.pts.visible = ha > 0.002; h.m.uniforms.uPxPerKpc.value = pk; h.m.uniforms.uCap.value = capLaw(z); } }
      const gk = 1 - ss(24.4, 25.2, z); shaders.shared.uGate.value.set(20 * gk, 48 * gk); mNear.uniforms.uMaxPx.value = 7.5 + 8.5 * ss(24.1, 24.7, z); }
    shaders.shared.uCmbGain.value = keys(GCm, z);
    basis(z); camV.copy(AX).multiplyScalar(-2.54 * Math.pow(10, z) / MPC).applyQuaternion(Qw.clone().invert()); shaders.shared.uCamObj.value.copy(camV);   // the real camera position in the web's own frame (Mpc), for the shell's limb
    shaders.shared.uPole.value.copy(AX).applyQuaternion(Qw.clone().invert()).normalize();   // map pole on the view axis: the (refilled) Galactic-plane band becomes the limb ring, the pinched pole hides behind the web's glow
    hazeMat.uniforms.uSlabMpc.value = 50 + (ctx.params.has('slab') ? Number(ctx.params.get('slab')) : 450) * ss(26.3, 26.9, z);   // a central slab of the web (a cut through the sphere), ~1 Gly thick: filaments stay legible (the whole 93 Gly line-of-sight integral would average to a flat glow) hazeMat.uniforms.uInner.value = 0.85 * ss(25.2, 26.0, z) + 0.15 * ss(26.7, 27.3, z);
    hazeMat.uniforms.uGain.value = keys(GHz, z) * (ctx.params.has('hz') ? Number(ctx.params.get('hz')) : 1); hazeV.visible = hazeMat.uniforms.uGain.value > 0.001; hazeMat.uniforms.uWarm.value = ss(26.6, 27.2, z); hazeMat.uniforms.uBias.value = 0.35 + (ctx.params.has('hb') ? Number(ctx.params.get('hb')) : 0.5) * ss(25.6, 26.5, z);
    shellBack.visible = shaders.shared.uShell.value > 0.001;
        basis(z); layout(z); syncRight();
    if (ctx.params.has('webdbg')) console.log('WEBDBG L ' + A.filter((a) => a.on && a.limb !== undefined).map((a) => a.k + ' right=' + a.right + ' lu=' + a.lu.toFixed(0) + ' su=' + a.su.toFixed(0) + ' w=' + a.w.toFixed(0) + ' Wpx=' + Wpx));
    if (ctx.params.has('webdbg')) console.log('WEBDBG E=' + E.toFixed(3) + ' oN=' + oN.toFixed(2) + ' oF=' + oF.toFixed(2) + ' cN=' + cN.toFixed(2) + ' cF=' + cF.toFixed(2) + ' z=' + z);
  }
  return { group, anchor: ctx.geom.EARTHC, labels, update, zMin: 23.4, zMax: 28.0 };
}
