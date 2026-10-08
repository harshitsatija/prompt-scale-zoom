/* LEVEL brain (z -3.4 .. 0.9): a real adult human brain (left hemisphere kept, cut 8 mm left of the midline), HEAD frame, anchor [0,0,0].
 * Data (see assets/brain/SOURCES.md): fsaverage pial surface (FreeSurfer, 164k vertices) for the folded cortex; the section plate is baked from the
 * ICBM152 2009 0.5 mm T1 template + aseg/Harvard-Oxford labels + the fsaverage pial/white surface sections (crisp SDF edges).
 * Everything beyond the plate that we can see (left frontal convexity, temporal pole, ...) is the real pial mesh. */
import { capVert, capFrag } from './brain/cap.glsl.js';
export default async function build(ctx) {
  const { T, kit, plan } = ctx; const { V3 } = kit;
  const group = new T.Group(); group.name = 'brain';
  const [meta, locus, anat, buf] = await Promise.all([ctx.fetchJSON('brain/cap.json'), ctx.fetchJSON('brain/locus.json'), ctx.fetchJSON('brain/anat.json'), ctx.fetchBuf('brain/cortexL.bin')]);
  const K = 0.97e-3, CY = -17.0, CZ = 15.5, YC = 0.012, X0 = meta.x0;
  const fsToHead = (y, z) => V3((y - CY) * K, (z - CZ) * K + YC, 0);

  // ---------------------------------------------------------------- shared locus / path (the cortex + neuron + synapse levels hang off this)
  const Qpos = V3(...locus.pos), Qn = V3(...locus.normal).normalize();
  ctx.shared.locus = { pos: Qpos, normal: Qn };
  { const A = plan.anchors(); ctx.shared.path = [V3(...A.Mol), V3(...A.Sy), V3(...A.Hn), V3(...A.Q), V3(0, 0, 0)]; }

  // ---------------------------------------------------------------- textures
  const loader = new T.TextureLoader();
  const tex = async (name, srgb = false) => { const t = await loader.loadAsync(ctx.assetURL('brain/' + name)); t.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace; t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter; t.anisotropy = 8; t.generateMipmaps = true; return t; };
  const sdfTex = async () => { const r = await fetch(ctx.assetURL('brain/cap_sdf.bin.gz')); const ab = await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(); const t = new T.DataTexture(new Uint16Array(ab), meta.sdf_nx, meta.sdf_nz, T.RGBAFormat, T.HalfFloatType); t.minFilter = t.magFilter = T.LinearFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.flipY = false; t.needsUpdate = true; return t; };
  const [tA, tB, tC, tD, tT, tE, tF, tG, tH, tHf, tI] = await Promise.all([sdfTex(), tex('cap_b.png'), tex('cap_c.png'), tex('cap_d.png'), tex('cap_t1.png'), tex('cap_e.png'), tex('cap_f.png'), tex('cap_g.png'), tex('cap_h.png'), tex('cap_hf.png'), tex('cap_i.png')]);
  tF.generateMipmaps = false; tF.minFilter = T.LinearFilter; tF.needsUpdate = true;

  // ---------------------------------------------------------------- the section plate (cap)
  const hex = (h) => new T.Color(h);
  const capU = { tA: { value: tA }, tB: { value: tB }, tC: { value: tC }, tD: { value: tD }, tT: { value: tT }, tE: { value: tE }, tF: { value: tF }, tG: { value: tG }, tH: { value: tH }, tHf: { value: tHf }, tI: { value: tI }, uOrg: { value: new T.Vector2(meta.y0, meta.z0) }, uWin: { value: new T.Vector4(...meta.win) },
    cCbGm: { value: hex(0xd68aa2) }, cCbWm: { value: hex(0xf8e6c2) }, cCbDeep: { value: hex(0x9a5f8c) }, cBandIn: { value: hex(0x454cb5) }, cBandOut: { value: hex(0x262a7a) }, uSizeMM: { value: new T.Vector2(meta.nx * meta.res_mm, meta.nz * meta.res_mm) }, uHot: { value: new T.Vector3(0.4, 0.3, 0.2) }, uTime: { value: 0 }, uDbg: { value: +((ctx.params && ctx.params.get && ctx.params.get('dbg')) || 0) }, uZoomK: { value: 0 }, uTexel: { value: new T.Vector2(1 / meta.sdf_nx, 1 / meta.sdf_nz) },
    uA: { value: 1 }, uHist: { value: 1 }, uCutR: { value: new T.Vector4(0, 0, 1, 0) }, uCutE: { value: new T.Vector4(0, 0, 0, 0) }, uLo: { value: new T.Vector2() }, uSz: { value: new T.Vector2() },
    cCsf: { value: hex(0x23277a) }, cGm: { value: hex(0xdba2ae) }, cGmD: { value: hex(0xa87098) }, cWm: { value: hex(0xf3dfbd) }, cWmD: { value: hex(0xcdb2bd) }, cDura: { value: hex(0xc98b5e) }, cGlow: { value: hex(0xffb347) }, cCsfBand: { value: hex(0x30379a) } };
  const mkCap = (fine) => new T.ShaderMaterial({ uniforms: capU, vertexShader: capVert, fragmentShader: (fine ? '#define FINE 1\n' : '') + capFrag, transparent: true, depthWrite: true, side: T.DoubleSide, extensions: { derivatives: true } });
  const capCoarse = mkCap(false); let capFine = null; const capMat = capCoarse;      // the histology shader (cells, vessels, fibres) is compiled only once the camera is below ~3 cm
  const wmm = meta.nx * meta.res_mm, hmm = meta.nz * meta.res_mm;
  const cap = new T.Mesh(new T.PlaneGeometry(wmm * K, hmm * K), capMat);
  const cx = (meta.y0 + meta.y1) / 2, cz = (meta.z0 + meta.z1) / 2;
  const capC = fsToHead(cx, cz); cap.position.set(capC.x, capC.y, -25e-6);
  capU.uLo.value.set(capC.x - wmm * K / 2, capC.y - hmm * K / 2); capU.uSz.value.set(wmm * K, hmm * K);
  // the plate is shared with the cortex level: its slab face IS this plate (same shader, same uniforms), see cortex.js
  ctx.shared.plate = { capU, frag: capFrag, vert: capVert, Q: [Qpos.x, Qpos.y], z: -25e-6 }; cap.frustumCulled = false; cap.renderOrder = 2; cap.name = 'cap'; group.add(cap);

  // ---------------------------------------------------------------- cortex (real fsaverage pial surface, left hemisphere)
  const dv = new DataView(buf); const nV = dv.getUint32(0, true), nF = dv.getUint32(4, true);
  const pos = new Float32Array(buf, 8, nV * 3); let off = 8 + nV * 12; const sul = new Int8Array(buf, off, nV); off += nV + ((-nV) & 3); const attrs = new Uint8Array(buf, off, nV * 4); off += nV * 4; const idx = new Uint32Array(buf, off, nF * 3);
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setIndex(new T.BufferAttribute(idx, 1));
  { const col = new Float32Array(nV * 3), hot = new Float32Array(nV * 3); const cG = hex(0xf0bea6), cS = hex(0x7a3f66), tmp = new T.Color();
    for (let i = 0; i < nV; i++) { const s = Math.max(0, Math.min(1, (sul[i] / 127) * 0.5 + 0.5)); const k = kit.ss(0.36, 0.66, s) * 0.85 + 0.15 * s; tmp.copy(cG).lerp(cS, k); tmp.multiplyScalar(1 - 0.28 * kit.ss(0.62, 0.95, s)); col[3 * i] = tmp.r; col[3 * i + 1] = tmp.g; col[3 * i + 2] = tmp.b; hot[3 * i] = attrs[4 * i] / 255; hot[3 * i + 1] = attrs[4 * i + 1] / 255; hot[3 * i + 2] = attrs[4 * i + 2] / 255; }
    geo.setAttribute('color', new T.BufferAttribute(col, 3)); geo.setAttribute('aHot', new T.BufferAttribute(hot, 3)); }
  geo.computeVertexNormals(); geo.computeBoundingSphere();
  { // mean-curvature cavity term (umbrella operator): sulcal fundi / concave folds go plum, gyral crowns catch light, so the folds read at every distance (the temporal / orbital surfaces seen beside the plate)
    const nrm = geo.attributes.normal.array, col = geo.attributes.color.array, acc = new Float32Array(nV * 3), deg = new Uint16Array(nV);
    for (let f = 0; f < nF; f++) { const a = idx[3 * f], b = idx[3 * f + 1], c = idx[3 * f + 2]; for (const [p, q, r] of [[a, b, c], [b, c, a], [c, a, b]]) { for (let k = 0; k < 3; k++) acc[3 * p + k] += pos[3 * q + k] + pos[3 * r + k]; deg[p] += 2; } }
    const cS2 = hex(0x6a3560); const tmp = new T.Color();
    for (let i = 0; i < nV; i++) { const d = deg[i] || 1; const lap = ((acc[3 * i] / d - pos[3 * i]) * nrm[3 * i] + (acc[3 * i + 1] / d - pos[3 * i + 1]) * nrm[3 * i + 1] + (acc[3 * i + 2] / d - pos[3 * i + 2]) * nrm[3 * i + 2]) / 1e-3;
      const cav = kit.ss(0.015, 0.16, lap), crown = kit.ss(0.015, 0.12, -lap); tmp.setRGB(col[3 * i], col[3 * i + 1], col[3 * i + 2]).lerp(cS2, cav * 0.55).multiplyScalar(1 + 0.10 * crown - 0.06 * cav); col[3 * i] = tmp.r; col[3 * i + 1] = tmp.g; col[3 * i + 2] = tmp.b; } }
  // gyrus / sulcus label anchors: real fsaverage vertices near the section plane within 8-30 mm of the locus
  let gyrusPt = Qpos.clone(), sulcusPt = Qpos.clone();
  { let bg = 1e9, bs = 1e9; for (let i = 0; i < nV; i++) { const x = pos[3 * i], y = pos[3 * i + 1], zz = pos[3 * i + 2]; if (zz > -0.5e-3 || zz < -3.5e-3) continue; const d = Math.hypot(x - Qpos.x, y - Qpos.y); if (d < 8e-3 || d > 30e-3) continue; const s = sul[i];
      if (s < -60 && d < bg) { bg = d; gyrusPt.set(x, y, 0); } if (s > 60 && d < bs) { bs = d; sulcusPt.set(x, y, 0); } } }
  const hotU = { uHot: capU.uHot };
  const cortexMat = kit.toon(0xffffff, { vc: true, cut: true });
  const cortexClip = new T.Plane(new T.Vector3(0, 0, -1), 0); cortexMat.clippingPlanes = [cortexClip];     // clipped 45 um behind the plate so no sliver of pial mesh stands in front of the section
  cortexMat.onBeforeCompile = (sh) => { sh.uniforms.uHot = hotU.uHot;
    sh.vertexShader = 'attribute vec3 aHot; varying vec3 vHot;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vHot = aHot;');
    sh.fragmentShader = 'uniform vec3 uHot; varying vec3 vHot;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(1.0, 0.55, 0.12) * (dot(vHot, uHot)) * 0.5;'); };
  const cortex = new T.Mesh(geo, cortexMat); cortex.frustumCulled = false; cortex.name = 'cortex'; group.add(cortex);

  // ---------------------------------------------------------------- tracts: glowing ribbons on the plate with travelling pulses (x-ray projection into the section plane)
  const ribbonVert = /* glsl */`attribute float aS; attribute float aV; attribute vec2 aOff; uniform float uK; varying float vS; varying float vV; void main(){ vS = aS; vV = aV; gl_Position = projectionMatrix * modelViewMatrix * vec4(position + vec3(aOff * uK, 0.0), 1.0); }`;
  const ribbonFrag = /* glsl */`precision highp float; uniform vec3 uCol, uCore; uniform float uBase, uFade, uT, uL; uniform float uP[12]; uniform float uA[12]; varying float vS; varying float vV;
    void main(){ float e = 1.0 - vV * vV; float tube = smoothstep(0.0, 0.30, e); float flow = 0.5 + 0.5 * sin(vS * 260.0 - uT * 2.6);
      float pulse = 0.0; for (int i = 0; i < 12; i++) { float d = (vS - uP[i]); float tail = d < 0.0 ? exp(d / 0.0075) : exp(-d / 0.0014); pulse += tail * uA[i]; }
      vec3 base = mix(uCol * 0.78, uCol * 1.12, e * e) * (0.88 + 0.12 * flow); vec3 c = base + uCore * pulse * (0.35 + 0.65 * e) * 1.3;
      float a = tube * uBase * (0.62 + 0.22 * e) + clamp(pulse, 0.0, 1.0) * e * 0.55; float ef = smoothstep(0.0, 0.05 * uL, vS) * smoothstep(0.0, 0.09 * uL, uL - vS); gl_FragColor = vec4(min(c, vec3(1.0)), clamp(a, 0.0, 1.0) * uFade * ef); }`;
  function makeTract(ptsH, width, colHex, coreHex, base) {
    const curve = new T.CatmullRomCurve3(ptsH.map((p) => V3(p[0], p[1], 0)), false, 'centripetal'); const L = curve.getLength(); const n = Math.max(60, Math.round(L / 0.0004));
    const P = [], Sx = [], Vx = [], I = [], Off = []; const pts = curve.getSpacedPoints(n);
    for (let i = 0; i <= n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)]; const d = b.clone().sub(a).normalize(); const nx = -d.y, ny = d.x; const wk = width * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, i / n * 1.0) ** 0.5)); for (const v of [-1, 1]) { P.push(pts[i].x, pts[i].y, -12e-6); Off.push(nx * v * wk / 2, ny * v * wk / 2); Sx.push(i / n * L); Vx.push(v); } if (i < n) { const k = i * 2; I.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('aS', new T.Float32BufferAttribute(Sx, 1)); g.setAttribute('aV', new T.Float32BufferAttribute(Vx, 1)); g.setAttribute('aOff', new T.Float32BufferAttribute(Off, 2)); g.setIndex(I);
    const u = { uCol: { value: hex(colHex) }, uCore: { value: hex(coreHex) }, uBase: { value: base }, uFade: { value: 1 }, uL: { value: L }, uK: { value: 1 }, uT: { value: 0 }, uP: { value: new Float32Array(12).fill(-1) }, uA: { value: new Float32Array(12) } };
    const m = new T.Mesh(g, new T.ShaderMaterial({ uniforms: u, vertexShader: ribbonVert, fragmentShader: ribbonFrag, transparent: true, depthWrite: false, depthTest: false, side: T.DoubleSide, fog: false })); m.frustumCulled = false; m.renderOrder = 5; group.add(m);
    return { mesh: m, len: L, u, curve, set(list) { const P2 = u.uP.value, A2 = u.uA.value; P2.fill(-1); A2.fill(0); list.slice(0, 12).forEach(([p, a], i) => { P2[i] = p; A2[i] = a; }); } };
  }
  const tr = anat.tracts;
  const tMotor = makeTract(tr.frontal_motor, 0.0021, 0xe8527d, 0xffd9e2, 0.66);       // arcuate / superior longitudinal: Broca-adjacent frontal -> motor hand knob
  const tCST = makeTract(tr.corticospinal, 0.0023, 0xff9f1c, 0xfff0b0, 0.70);          // corticospinal: hand knob -> internal capsule -> peduncle -> ventral pons -> pyramids -> cord
  const tOpt = makeTract(tr.optic, 0.0021, 0x12a595, 0xc8fff0, 0.68);                  // optic nerve -> LGN -> optic radiation -> V1

  // soft halos on the three functional areas
  const halos = ['v1', 'frontal', 'motor'].map((k) => { const h = kit.halo(0xffb347, 0); h.material.depthTest = false; h.renderOrder = 8; h.position.set(anat.hot[k][0], anat.hot[k][1], -10e-6); group.add(h); return h; });

  // ---------------------------------------------------------------- labels (level-local coordinates)
  const P3 = (a) => V3(a[0], a[1], 0);
  const lb = anat.label; const Z0 = -2.1, Z1 = -0.1;
  const labels = [
    { text: 'cerebral cortex · grey matter, 2–4 mm', z0: -2.4, z1: -1.0, pos: () => Qpos.clone().addScaledVector(Qn, -1.6e-3), amber: true },
    { text: 'white matter · myelinated fibres', z0: -2.4, z1: -1.2, pos: () => Qpos.clone().addScaledVector(Qn, -4.6e-3).add(V3(0, 0, 0)), right: true },
    { text: 'pia mater · CSF', z0: -2.4, z1: -1.4, pos: () => Qpos.clone().addScaledVector(Qn, 0.4e-3), right: true },
    { text: 'gyrus (crown)', z0: -2.0, z1: -0.9, pos: () => gyrusPt },
    { text: 'sulcus (fold)', z0: -2.0, z1: -0.9, pos: () => sulcusPt, right: true },
    { text: 'Visual cortex (V1) · reading the screen', z0: Z0, z1: Z1, pos: () => P3(lb.v1), right: true, amber: true },
    { text: 'Frontal cortex · choosing the words', z0: Z0, z1: Z1, pos: () => P3(lb.frontal), amber: true },
    { text: 'Motor cortex · the fingers (hand area, lateral)', z0: Z0, z1: Z1, pos: () => P3(lb.motor), amber: true },
    { text: 'Corpus callosum · 200 million fibres', z0: Z0, z1: Z1, pos: () => P3(anat.cc_label), right: true },
    { text: 'Thalamus', z0: Z0, z1: Z1, pos: () => P3(anat.thalamus), right: true },
    { text: 'Caudate nucleus', z0: -1.6, z1: Z1, pos: () => P3(anat.caudate) },
    { text: 'Cerebellum', z0: Z0, z1: Z1, pos: () => P3(anat.cerebellum), right: true },
    { text: 'Brainstem · midbrain, pons, medulla', z0: Z0, z1: Z1, pos: () => P3(anat.brainstem) },
    { text: 'Spinal cord', z0: Z0, z1: Z1, pos: () => fsToHead(meta.cord_y, -70).add(V3(0.0035, 0, 0)), right: true },
    { text: 'Lateral ventricle (CSF)', z0: -1.6, z1: Z1, pos: () => P3(anat.lateral_ventricle), right: true },
    { text: 'Internal capsule', z0: -1.6, z1: Z1, pos: () => P3(anat.capsule), right: true },
    { text: 'Section plane: 8 mm left of the midline', z0: -1.3, z1: -0.3, pos: () => V3(0.082, -0.052, 0) },
  ];

  // ---------------------------------------------------------------- per-frame
  const sat = (x) => Math.max(0, Math.min(1, x));
  // Re-framing for a continuous zoom: the core focus runs straight on towards the head centre (~0.9 W per field-width), which at z=-2.0..-1.3 lands in featureless white matter.
  // We slide the whole level (in-plane only) so the view stays centred a little below the pial surface at the locus - ribbon (pia / grey band / white matter) near the top of the frame,
  // neighbouring gyri and sulci filling the rest as the field widens - and hand over to the true focus (head centre) before the person level appears (z=-0.75).
  const nq2 = V3(Qn.x, Qn.y, 0).normalize(), Dv = V3();
  function reframe(z, c) {
    const W = c.W, ssm = (a, b, x) => kit.ss(a, b, x);
    const dDeep = 0.215 * W + (1.55e-3 - 0.215 * W) * ssm(-2.62, -2.3, z), dWide = 1.55e-3 + 0.12 * Math.max(0, W - 5e-3);       // matches the cortex level's own re-frame at z=-2.3
    const depth = z < -2.3 ? dDeep : dWide;
    Dv.copy(Qpos).addScaledVector(nq2, -depth);
    const k = ssm(-1.4, -0.75, z); Dv.lerp(c.F, k); Dv.z = 0;
    group.position.set(-Dv.x, -Dv.y, -c.F.z);
  }
  function update(t, S, z, c) {
    capU.uCutE.value.w = 0;      // the cortex level (drawn after this one) switches the cut on again for the frames where its block sits in the plate
    if (c && c.F && z < -0.75) reframe(z, c);       // beyond -0.75 the engine's own placement (anchor - true focus) is exact; a clamped virtual camera there would shift the brain out of the head
    cortexClip.copy(kit.cut.A); cortexClip.constant -= 45e-6 * (c && c.s ? c.s : 1);
    const ages = S.ages || []; let motor = 0, front = 0.28 + 0.3 * sat(S.E / 1.2); const cst = [], mot = [];
    for (const [i, age] of ages) { const a = age / 0.45; if (a >= 0 && a <= 1.15) mot.push([a * tMotor.len, 1.0 - 0.3 * a]); const b = (age - 0.4) / 1.5; if (b >= 0 && b <= 1) cst.push([b * tCST.len, 1.0 - 0.5 * b]); motor += Math.exp(-Math.pow((age - 0.45) / 0.16, 2)); front += 0.5 * Math.exp(-Math.pow((age - 0.0) / 0.3, 2)); }
    const op = []; let v1 = 0.35; const ph = (t % 1.25) / 1.25; for (let k = -1; k < 1; k++) { const p = (ph + (k < 0 ? 1 : 0)); }
    for (let k = 0; k < 2; k++) { const tt = ((t - k * 1.25) % 2.5 + 2.5) % 2.5; if (tt < 1.1) { op.push([tt / 1.1 * tOpt.len, 1.0]); } if (tt > 0.95 && tt < 1.5) v1 += 0.8 * Math.exp(-Math.pow((tt - 1.1) / 0.18, 2)); }
    if (S.sent && S.send >= 0) { v1 += 0.4; front += 0.4 * Math.sin(Math.min(1, S.send) * 3.14); }
    tMotor.set(mot); tCST.set(cst); tOpt.set(op);
    const tk = sat((z + 1.95) / 0.5); for (const tt of [tMotor, tCST, tOpt]) tt.mesh.visible = tk > 0.01, tt.u.uFade.value = tk, tt.u.uT.value = t, tt.u.uK.value = Math.min(1, Math.max(0.12, (c && c.W ? c.W : 0.3) / 0.30));
    capU.uHot.value.set(sat(v1 / 1.3) * 1.3, sat(front / 1.3) * 1.3, sat(motor) * 1.3); capU.uTime.value = t; capU.uZoomK.value = 1 - kit.ss(-2.2, -1.5, z);
    { const wantFine = z < -1.3; if (wantFine && !capFine) capFine = mkCap(true); const m = wantFine ? capFine : capCoarse; if (cap.material !== m) cap.material = m; }
    const hs = [capU.uHot.value.x, capU.uHot.value.y, capU.uHot.value.z]; halos.forEach((h, i) => { const s = 0.018 + 0.030 * hs[i]; h.scale.set(s, s, 1); h.material.opacity = (0.06 + 0.30 * hs[i] * hs[i]) * kit.ss(0.04, 0.12, c && c.W ? c.W : 1); h.visible = h.material.opacity > 0.003; });
  }
  return { group, anchor: [0, 0, 0], labels, update, brainSurfaceSample: () => ({ pos: Qpos.clone(), normal: Qn.clone() }) };
}
