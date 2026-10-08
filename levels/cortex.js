/* LEVEL cortex: a slab of human neocortex cut open at the section plane. See v4/assets/cortex/SOURCES.md for the real data used. */
import { makeShade } from './cortex/shade.js';
import { loadMorph } from './cortex/morph.js';
import { buildTemplates } from './cortex/templates.js';
import { buildField, LAYERS, X0, X1, ZW, MM, YB } from './cortex/field.js';
import { Tissue, lodOf } from './cortex/tissue.js';
import { makeWall } from './cortex/wall.js';
import { Vessels } from './cortex/vessels.js';
import { Fibres } from './cortex/fibres.js';
import { Neuropil } from './cortex/neuropil.js';
import { makeLamina } from './cortex/lamina.js';

export default async function build(ctx) {
  const { T, kit, plan, log } = ctx, A = plan.anchors(), Q = A.Q, nq = A.nq;
  const ang = Math.atan2(nq[1], nq[0]) - Math.PI / 2;
  let rot = ang; const root = new T.Group();                 // root: positioned by the engine at (anchor - focus)
  const piv = new T.Group(); root.add(piv);                    // pivot at the focus: the slab is turned face-on to the camera about the focus at wide fields
  const group = new T.Group(); group.rotation.z = ang; piv.add(group);      // local +Y = outward normal (toward the pia)
  const fv = new T.Vector3(), Qs = new T.Quaternion(), qc = new T.Quaternion(), Rq = new T.Quaternion(), nW = new T.Vector3(), eu = new T.Euler(), eu2 = new T.Euler(), Qt = new T.Quaternion(), ID = new T.Quaternion();
  kit.cut.cortex = new T.Plane(new T.Vector3(0, 0, -1), 0);   // the slab's own section plane (== kit.cut.A while the slab is head-aligned, view-aligned once it is turned face-on)
  const inner = new T.Group(); group.add(inner);              // shifted along z each frame so local z=0 is exactly the section plane
  const shade = makeShade(ctx);
  const t0 = performance.now();
  const morphs = await loadMorph(ctx);
  const templates = buildTemplates(ctx, morphs);
  const field = buildField(1);
  log('cortex: cells', field.n, 'templates', templates.length, 'ms', Math.round(performance.now() - t0));
  const wall = makeWall(ctx, shade); inner.add(wall.group);
  const tissue = new Tissue(ctx, shade, field, templates, { noStraw: ctx.params.has('nostraw') }); inner.add(tissue.g);
  const vessels = new Vessels(ctx, shade, { noVein: ctx.params.has('noven') }); inner.add(vessels.g);
  const fibres = new Fibres(ctx, shade); inner.add(fibres.g);
  const neuropil = new Neuropil(ctx, shade); inner.add(neuropil.g);
  const lamina = makeLamina(ctx); lamina.g.visible = false;   // the depth ruler / scale key is a UI object: it is not part of the film (never added to the scene)
  // ---- the block's section face IS the brain plate: same shader, same textures, same uniforms, sampled at the block's own location (rigid map block -> plate), so the pia, the grey / white
  // boundary, the gyral curvature and the white-matter tracts are exactly the brain level's. The plate itself is cut away where the block sits (uCut*), so the face takes its place by geometry.
  const PL = ctx.shared.plate; let plateWall = null; const pwU = {};
  if (PL) {
    Object.assign(pwU, PL.capU, { uA: { value: 0 }, uHist: { value: 0 }, uMapQ: { value: new T.Vector4(PL.Q[0], PL.Q[1], Math.cos(ang), Math.sin(ang)) } });
    const pm = new T.ShaderMaterial({ uniforms: pwU, transparent: true, depthWrite: true, side: T.DoubleSide, extensions: { derivatives: true },
      vertexShader: 'uniform vec4 uMapQ; uniform vec2 uLo, uSz; varying vec2 vUv; void main(){ float c = uMapQ.z, s = uMapQ.w; vec2 H = uMapQ.xy + vec2(c * position.x - s * position.y, s * position.x + c * position.y); vUv = (H - uLo) / uSz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: '#define FINE 1\n#define WALLMODE 1\n' + PL.frag });
    plateWall = new T.Mesh(wall.mesh.geometry, pm); plateWall.frustumCulled = false; plateWall.renderOrder = 500.5; plateWall.userData.keepOrder = true; plateWall.visible = false; inner.add(plateWall); wall.mesh.userData.keepOrder = true; wall.mesh.renderOrder = 500.2;
  }
  const neuronPresent = !ctx.params.has('only') || ctx.params.get('only').split(',').includes('neuron'); // the neuron level supplies the hero cell when it is rendered; otherwise this level shows its own focal cell
  const hero = { x: 0, y: -1.2 * MM, r: 55e-6, depth: 90e-6, on: false };
  const clr = new T.Mesh(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 1e-12, 0, 0, 0, 1e-12, 0], 3)), new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false }));
  clr.frustumCulled = false; clr.onBeforeRender = (r) => { r.state.buffers.depth.setMask(true); r.clearDepth(); }; inner.add(clr);
  const halo = kit.halo(0xffb347, 0); halo.position.set(0, -1.2 * MM, -30e-6); inner.add(halo);
  const labels = [];
  const V = (x, y, z = 0) => new T.Vector3(x, y, z);
  const HZ = new T.Color(0xdba2ae);
  const st = { key: '', fx: 0, fy: 0, dl: 0, dz: 0, W: 1e-3, near: {} };
  const clamp01 = (x) => Math.min(1, Math.max(0, x)); const ssm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const SHIFT = ctx.params.has('noshift') ? 0 : 1; // at wide fields the view is re-framed: the slab rolls pia-up and the pia sits at the top of the frame so the laminae read downward
  // label positions are in the group's frame (rotated so +y = outward normal); inner offsets (section-plane alignment, focus shift) are added here
  const P = (x, y, z = 0) => V(x, y + st.dl, z + st.dz).applyAxisAngle(V(0, 0, 1), rot).sub(fv).applyQuaternion(Qs).add(fv);
  const OFF = () => P(1e3, 0);
  const lab = (text, z0, z1, f, o = {}) => labels.push({ text, z0, z1, pos: f, ...o });
  const mid = (L) => -(L.a + L.b) / 2 * MM;
  const byN = Object.fromEntries(LAYERS.map((L) => [L.n, L]));
  const RX = () => st.fx + 0.36 * st.W, LXX = () => st.fx - 0.40 * st.W;
  // layer labels sit on the tissue where the lamina is in frame; where it is not (narrow fields), they hang on the compressed depth key at the right edge
  const layerLab = (text, name, yf) => lab(text, -3.3, -2.1, () => { const y = yf(); return lamina.ins.on ? P(lamina.ins.dot, lamina.ins.top - Math.max(0, -y) * lamina.ins.k) : P(RX(), y); }, { right: true });
  layerLab('pia mater', 'pia', () => 0.012 * MM);
  for (const [t, n] of [['I  molecular layer', 'I'], ['II  small pyramidal cells', 'II'], ['III  medium pyramidal cells', 'III'], ['IV  granule cells', 'IV'], ['V  large pyramidal cells', 'V'], ['VI  polymorphic cells', 'VI']]) layerLab(t, n, () => mid(byN[n]));
  layerLab('white matter · myelinated axons', 'WM', () => -4.1 * MM);
  lab('grey matter ~3.5 mm', -3.1, -2.1, () => (lamina.ins.on ? P(lamina.ins.x + 0.01 * st.W, lamina.ins.top - 3.6 * MM * lamina.ins.k - 0.035 * st.W) : P(st.fx - 0.46 * st.W, Math.min(st.fy + 0.22 * st.W, Math.max(st.fy - 0.22 * st.W, -1.35 * MM)))), { amber: true, right: true });
  [1, 2, 3].forEach((d) => lab(d + ' mm', -3.1, -2.1, () => P(st.fx - 0.495 * st.W, -d * MM)));
  lab('penetrating arteriole · 30 µm', -3.7, -2.15, () => st.near.art || OFF());
  lab('capillary · 5–6 µm', -4.1, -3.05, () => st.near.cap || OFF());
  lab('pyramidal neuron · cell body ~15 µm', -4.2, -2.6, () => st.near.pyr || OFF(), { amber: true });
  lab('GABA interneuron', -4.2, -3.1, () => st.near.int || OFF());
  lab('astrocyte', -4.2, -3.0, () => st.near.astro || OFF());
  lab('microglia', -4.2, -3.0, () => st.near.micro || OFF());
  lab('oligodendrocyte', -3.8, -2.8, () => st.near.oligo || OFF());
  lab('apical dendrite  >1 mm to layer I', -3.6, -2.55, () => st.near.apical || OFF());

  function update(t, S, z, c) {
    // The engine clamps this level's camera to zMax - 0.9 (= -2.98) and substitutes a virtual camera focused on the anchor; the slab's re-framing (face-on roll, tilt, slide
    // so the pia is at the top) is designed for the REAL camera and would jump by ~0.9 mm at the clamp. Recover the real z and focus from the root's placement.
    { const sc = root.parent ? root.parent.scale.x : 0; if (sc > 0) { const zr = Math.log10(c.Wu / sc); if (zr > z + 1e-6) { const Wr = Math.pow(10, zr); z = zr; c = Object.assign({}, c, { z: zr, W: Wr, s: sc, F: { x: Q[0] - root.position.x, y: Q[1] - root.position.y, z: Q[2] - root.position.z } }); } } }
    const F = c.F, dx = F.x - Q[0], dy = F.y - Q[1], dz = F.z - Q[2];
    // face-on: at tissue scale the slab keeps the head-frame orientation (matches the neuron / brain levels); from z ~ -3.5 it turns about the focus so its section plane
    // faces the camera and the laminae read as horizontal bands, pia at the top; it eases back to the head frame as it dissolves into the brain's own section plate.
    const kFace = ssm(-3.5, -2.9, z) * (1 - ssm(-2.8, -2.22, z));
    { const pit = plan.pitchAt(z) + Math.sin(t * 0.17 + 1) * 0.03 * (1 - ssm(5.5, 7.5, z)); qc.setFromEuler(eu.set(-pit, plan.yawAt(z, t), 0, 'YXZ')); Rq.copy(qc).invert(); Qs.copy(ID).slerp(qc, kFace); const kT = (ctx.params.has('notilt') ? 0 : 1) * ssm(-3.3, -2.85, z) * (1 - ssm(-3.15, -2.9, z)); Qs.multiply(Qt.setFromEuler(eu2.set(0.2 * kT, -0.1 * kT, 0, 'YXZ'))); }
    rot = ang * (1 - kFace); group.rotation.z = rot; fv.set(dx, dy, dz); piv.position.copy(fv); piv.quaternion.copy(Qs); group.position.copy(fv).negate();
    nW.set(0, 0, 1).applyQuaternion(Rq.clone().multiply(Qs)).negate(); kit.cut.cortex.set(nW, 0);
    { const sx = (ctx.params.has('fsx') ? Number(ctx.params.get('fsx')) : 1) * 17e-6 * Math.tan(plan.yawAt(z, t)) * (1 - kFace); hero.fsx = sx * Math.cos(rot); hero.fsy = -sx * Math.sin(rot); }
    const ca = Math.cos(-rot), sa = Math.sin(-rot), fx = dx * ca - dy * sa, fy0 = dx * sa + dy * ca;
    // re-frame: pull the focus along the normal so the pia sits ~3 % below the top of the frame (frame height ~ 0.56 W), a few lamina in view
    const kf = SHIFT * ssm(-3.55, -2.75, z), yc = -(z < -2.3 ? (0.215 * c.W) + (1.55 * MM - 0.215 * c.W) * ssm(-2.62, -2.3, z) : 1.55 * MM + 0.12 * Math.max(0, c.W - 5e-3));   // beyond -2.3 this is exactly the brain level's own re-framing depth (brain.js reframe), so the slab stays on its place on the plate   // zooming out the frame also descends: by z = -2.6 it is centred on layer IV/V so every lamina shows
    st.dl = kf * (fy0 - yc); inner.position.z = dz; inner.position.y = st.dl; const fy = fy0 - st.dl;
    const lod = lodOf(z); shade.U.uDepthK.value = 1 / (c.s * Math.max(0.075 * c.W, 0.02e-3));
    if (ctx.params.has('hz')) shade.U.uDepthK.value = 1 / (c.s * Number(ctx.params.get('hz')) * 1e-6);
    wall.update(z, c.W); shade.U.uHaze.value.setHex(0x232067).lerp(HZ, wall.U.uBr.value);
    { const pw = plateWall ? ssm(-3.32, -3.02, z) : 0;
      if (plateWall) {
        plateWall.visible = pw > 0.002; pwU.uA.value = pw; pwU.uHist.value = ssm(-3.1, -2.85, z);
        plateWall.position.z = -(wall.depth + (25e-6 - wall.depth) * ssm(-2.8, -2.45, z)); wall.group.visible = pw < 0.999;
        const hw = 1.2 * (X1 - X0) / 2 - 0.1 * MM;
        PL.capU.uCutR.value.set(Q[0], Q[1], Math.cos(ang), Math.sin(ang)); PL.capU.uCutE.value.set(hw, 0.07 * MM, -2 * YB + 0.1 * MM, z > -2.9 && z < -2.08 ? 1 : 0);
        if (z < -2.2) PL.capU.uZoomK.value = 1; PL.capU.uTime.value = t;
      }
      shade.U.uTop.value = z > -3.3 ? -35e-6 : 1; shade.U.uShr.value = 1 - 0.97 * ssm(-2.65, -2.25, z); shade.U.uFogW.value = 0.9 * ssm(-2.6, -2.2, z); shade.U.uDim.value = 0.6 * ssm(-4.5, -3.9, z) * (1 - ssm(-3.5, -3.1, z)); shade.U.uHaze.value.setHex(0x232067).lerp(HZ, Math.max(wall.U.uBr.value, pw)); fibres.g.visible = z < -2.85; neuropil.g.visible = z < -2.9; tissue.g.visible = z < -2.3; vessels.g.visible = z < -2.3 && !ctx.params.has('hide'); }
    const key = [z < -2.05 ? 1 : 0, Math.round(z * 12), Math.round(fx / (c.W * 0.1)), Math.round(fy / (c.W * 0.1))].join(',');
    if (key !== st.key) { st.key = key; hero.on = z < -2.05 && neuronPresent && !ctx.params.has('nohero'); neuropil.select(fx, fy, z, c.W, hero); tissue.select(fx, fy, z, c.W, hero); fibres.select(fx, fy, z, c.W, hero, lod); vessels.select(fx, fy, 0.62 * c.W * 1.15, Math.max(lod.T1 * 0.6, 0.03e-3), z, hero); }
    if (ctx.params.has('cdbg')) { const hp = P(0, -1.2 * MM, 0).add(root.position); console.log('NG cortex hero rel focus um', z.toFixed(2), [hp.x, hp.y, hp.z].map((v) => +(v * 1e6).toFixed(1)).join(','), 'dl', (st.dl * 1e6).toFixed(0)); }
    st.fx = fx; st.fy = fy; st.W = c.W; st.dz = dz; lamina.ins.on = false;
    if (c.W < 2.2e-3) { // anchors for the callout labels: the nearest real instance of each cell type in view
      const near = (pred, extra) => { let best = null, bd = 0.62 * c.W * 0.9; const cand = extra ? tissue.all.concat(extra) : tissue.all; for (const r of cand) { if (!pred(r)) continue; const d = Math.hypot(r.x - fx - 0.08 * c.W, r.y - fy); if (d < bd && -r.z < 0.2e-3 + c.W) { bd = d; best = r; } } return best; };
      const kindOf = (k) => (r) => r.tp && r.tp.t.kind === k;
      const sw = tissue.swapRecs || [];
      const pr = near(kindOf('pyr'), sw), far0 = (r) => !pr || Math.hypot(r.x - pr.x, r.y - pr.y) > 0.1 * c.W, ir = near((r) => kindOf('int')(r) && far0(r), sw), ar = near((r) => kindOf('astro')(r) && far0(r), sw), mr = near((r) => kindOf('micro')(r) && far0(r), sw), orr = near((r) => kindOf('oligo')(r) && far0(r), sw);
      st.near.pyr = pr ? P(pr.x, pr.y + 10e-6, pr.z) : null; st.near.int = ir ? P(ir.x, ir.y + 8e-6, ir.z) : null; st.near.astro = ar ? P(ar.x, ar.y, ar.z) : null; st.near.micro = mr ? P(mr.x, mr.y, mr.z) : null; st.near.oligo = orr ? P(orr.x, orr.y, orr.z) : null;
      st.near.apical = pr && pr.tp.t.D ? P(pr.x, pr.y + Math.min(0.45 * pr.tp.t.D * MM, 0.35 * c.W), pr.z) : null;
      let bestA = null, bad = 1e9; for (const v of vessels.art) { if (!v.pts) continue; const d = Math.abs(v.x - fx); if (d < bad && d < 0.5 * c.W) { bad = d; bestA = v; } }
      if (bestA) { let j = 0, bj = 1e9; bestA.pts.forEach((q, i) => { const d = Math.abs(q[1] - fy); if (d < bj) { bj = d; j = i; } }); st.near.art = P(bestA.pts[j][0] + bestA.rad[j], bestA.pts[j][1], bestA.pts[j][2]); } else st.near.art = null;
      let bc = null, bcd = 0.4 * c.W; for (const e of vessels.edges) { const m = e.m; const d = Math.hypot(m[0] - fx - 0.15 * c.W, m[1] - fy); if (d < bcd && -m[2] < 0.03 * c.W + 20e-6) { bcd = d; bc = m; } } st.near.cap = bc ? P(bc[0], bc[1], bc[2]) : null;
    }
    { const hk = ssm(-4.05, -3.6, z) * (1 - ssm(-2.95, -2.6, z)); halo.visible = hk > 0.01; halo.scale.setScalar(Math.max(c.W * 0.17, 42e-6)); halo.material.opacity = Math.min(0.85, (0.22 + 0.5 * Math.min(1, S.E)) * hk * (0.92 + 0.08 * Math.sin(t * 2.1))); }
    tissue.animate(t, S, z, c.W, fx, fy); vessels.update(t, z, c.W);
    { const wu = tissue.waveU, U = wall.UO; if (wu) { U.uWc.value.set(wu.ox, wu.oy); for (let i = 0; i < 6; i++) { const q = wu.list[i]; U.uW.value[i].set(q ? q[0] : -1, q ? q[1] : 1, q ? q[2] : 0); } } }
    { const hd = ctx.params.get('hide'); if (hd) { const hs = hd.split(','); if (hs.includes('fib')) fibres.g.visible = false; if (hs.includes('tpl')) tissue.tpl.forEach((q) => { q.far.visible = q.mid.visible = false; q.near.visible = false; }); if (hs.includes('straw')) tissue.straw.m.visible = false; if (hs.includes('ves')) vessels.g.visible = false; if (hs.includes('som')) tissue.somas.forEach((r) => r.forEach((q) => { q.m.visible = false; })); } }
    window.__cortexStats = tissue.stats; if (!st.logged && tissue.stats) { st.logged = 1; log('cortex stats', JSON.stringify(tissue.stats), JSON.stringify(vessels.stats), JSON.stringify(fibres.stats)); }
  }
  // Draw order: everything of this level goes through the TRANSPARENT pass (opaque-looking, depth-writing) after a depth clear, so it always sits on top of the
  // brain level's (transparent) section plate that covers the same locus. Originally-transparent materials (glows) draw after the solids.
  clr.material.transparent = true; clr.renderOrder = 500;
  const seen = new Set();
  const fix = () => group.traverse((o) => { if (!(o.isMesh || o.isPoints || o.isSprite) || o === clr || seen.has(o)) return; seen.add(o); if (o.userData.keepOrder) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.transparent = true; }); return; } const mt = o.material, ms = Array.isArray(mt) ? mt : [mt]; const wasT = ms.some((m) => m.transparent); ms.forEach((m) => { m.transparent = true; }); o.renderOrder = wasT ? 502 : 501; });
  // dissolve into the brain level's own section plate over z = -2.4 .. -2.12 so there is no pop where the two levels meet
  const fadeM = new Map(); const collect = () => group.traverse((o) => { if (!(o.isMesh || o.isPoints) || o === clr) return; const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { if (!fadeM.has(m)) fadeM.set(m, { op: m.opacity === undefined ? 1 : m.opacity, dw: m.depthWrite }); }); });
  const applyFade = (z) => { const a = ssm(-4.82, -4.45, z); if (a === st.fa) return; st.fa = a; wall.U.uA.value = a; for (const [m, b] of fadeM) { if (m.uniforms) continue; m.opacity = b.op * a; m.depthWrite = b.dw && a > 0.985; } };
  let fixed = 0; const upd = update; const update2 = (t, S, z, c) => { if (ctx.params.has('fw')) S = Object.assign({}, S, { ages: [[1, 0.35], [2, 1.0]] }); clr.visible = z > -3.4 && !ctx.params.has('noclear'); upd(t, S, z, c); fix(); if (fadeM.size === 0 || seen.size !== st.nfix) { st.nfix = seen.size; collect(); st.fa = -1; } applyFade(z); if (!fixed++) log('cortex draw-order fix applied', seen.size, 'wall', wall.mesh.renderOrder, wall.mesh.material.transparent, wall.mesh.visible, wall.group.visible, 'clr', clr.renderOrder, clr.visible, clr.material.transparent); };
  return { group: root, anchor: Q, labels, update: update2, zMin: -4.85, zMax: -2.08 };
}
