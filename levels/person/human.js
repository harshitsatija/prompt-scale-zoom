/* The typist: a real sculpted female base mesh (Blender Human Base Meshes, CC0) seated and posed offline, with real separate-finger hands, real skull and
 * cervical spine, sagittal section caps built from the actual mesh/skull cross-sections. This module loads the GLB, assigns the shared toon materials,
 * clips the head by the sagittal plane and animates fingers / head / breathing from the keystroke timeline. */
export async function buildHuman(ctx, capPlane) {
  const { T, kit } = ctx; const PI = Math.PI;
  const [gl, meta] = await Promise.all([ctx.loadGLB('person/person.glb'), ctx.fetchJSON('person/person_meta.json')]);
  const root = gl.scene; root.name = 'typist';
  const texL = new T.TextureLoader();
  const tex = (p, srgb = true, rep = null) => { const t = texL.load(ctx.assetURL('person/tex/' + p)); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; t.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace; if (rep) t.repeat.set(rep[0], rep[1]); return t; };
  const stripes = tex('shirt_stripes.png'), denim = tex('denim_diff.jpg'), denimN = tex('denim_nor.jpg', false), hairT = tex('hair_strands.png');
  const inflate = (m, d) => { m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = vec3( position ) + normalize( objectNormal ) * ' + d.toFixed(5) + ';'); }; m.customProgramCacheKey = () => 'infl' + d; return m; };
  const clip = [capPlane];
  const vc = (o = {}) => { const m = kit.toon(0xffffff, Object.assign({ vc: true }, o)); return m; };
  const mats = {}; const cutM = (m) => { m.clippingPlanes = clip; return m; };
  const headSkin = cutM(vc()), plainSkin = vc();
  const hairM = cutM(kit.toon(0x3c3658, { map: hairT, side: T.DoubleSide, glow: 0x4a55c8, glowK: 0.26 })); const bunM = cutM(kit.toon(0x3c3658, { map: hairT, side: T.DoubleSide, glow: 0x4a55c8, glowK: 0.26 }));
  const shoeM = inflate(kit.toon(0xc08052, {}), 0.0062);
  const shirtM = kit.toon(0xffffff, { map: stripes }); const jeansM = kit.toon(0x7f93d6, { map: denim, normalMap: denimN });
  const capM = cutM(vc({ side: T.DoubleSide }));
  // distinct, anatomically ordered section colours (skin tan, fat yellow, muscle red, cortical bone cream, diploe pink, dura blue-grey, airway void, tongue, disc, cord)
  const CAPC = { cap_skin: 0xcf9468, cap_fat: 0xeec56f, cap_flesh: 0xa84c4e, cap_bone: 0xefe2c0, cap_bone_outer: 0xf8f0da, cap_bone_inner: 0xf8f0da, cap_diploe: 0xe6d0a2, cap_csf: 0xd5dbf6, cap_dura: 0x8296d6, cap_airway: 0x3b2f7a, cap_mucosa: 0xe58b8c, cap_cart: 0xdbe7f3, cap_hyoid: 0xf2e6c8,
    cap_tongue: 0xdc6e7e, cap_palate: 0xd2606d, cap_vert: 0xeee0b8, cap_vert2: 0xe2d2a6, cap_disc: 0x9db3d8, cap_cord: 0xf6ebbc, cap_hair: 0x3a3358, cap_hair2: 0x2a2442,
    cap_brain_vent: 0xa9b8f7, cap_brain_cc: 0xfdf3e4, cap_brain_fornix: 0xf3e2d2, cap_brain_thal: 0xd89aa6, cap_brain_stem: 0xe9c4bb, cap_brain_cbfol: 0xb86b84, cap_brain_cbwm: 0xe3a9ad, cap_brain_cb: 0xdc9aa4, cap_brain_sulc: 0xa95a78, cap_brain_gm: 0xe6a5ad, cap_brain_wm: 0xf6d2cc };
  const capMats = {}; for (const k in CAPC) capMats[k] = cutM(kit.toon(CAPC[k], { side: T.DoubleSide, glow: k.startsWith('cap_hair') ? 0x23287a : undefined, glowK: 0.07 }));
  capMats.cap_hair.polygonOffset = capMats.cap_hair2.polygonOffset = true; capMats.cap_hair.polygonOffsetFactor = capMats.cap_hair2.polygonOffsetFactor = -2; capMats.cap_hair.polygonOffsetUnits = capMats.cap_hair2.polygonOffsetUnits = -2;
  const lensM = cutM(kit.toon(0xcfe9ff, { opacity: 0.16, side: T.DoubleSide })); lensM.depthWrite = false;
  // thicken thin wire meshes (glasses) and swell the feet into shoes: push vertices along the normal before skinning
  const glassM = inflate(cutM(kit.toon(0x34283f, {})), 0.0019);
  const eyeM = cutM(vc()), hlM = cutM(new T.MeshBasicMaterial({ color: 0xffffff })); const earM = cutM(vc()); const tieM = cutM(vc());
  const boneM = cutM(vc({ side: T.DoubleSide })); const skullM = cutM(kit.toon(0x3d4294, { side: T.DoubleSide }));
  const byName = {
    head: headSkin, handL: plainSkin, handR: plainSkin, feet: shoeM, scleraL: eyeM, scleraR: eyeM, irisL: eyeM, irisR: eyeM, hlL: hlM, hlR: hlM, browL: cutM(vc({ side: T.DoubleSide })), browR: cutM(vc({ side: T.DoubleSide })),
    hair: hairM, bun: bunM, tie: tieM, cuffs: vc(), collar: vc(), shirt: shirtM, jeans: jeansM, glasses: glassM, lenses: lensM, earbuds: earM, skull: skullM };
  const bones = {}; const skinned = []; const sn = (x) => x.replace(/\./g, '');
  root.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (o.isMesh) {
      const n = o.name.replace(/_\d+$/, ''); let m = byName[n];
      if (!m && n.startsWith('cap_')) m = capMats[n] || capM; if (!m && /^(c[1-7]|t[1-4])$/.test(n)) m = boneM;
      if (!m) { ctx.log('person: unmapped mesh', n); m = plainSkin; }
      o.material = m; o.frustumCulled = false; skinned.push(o);
      if (n === 'lenses') o.renderOrder = 4;
      o.userData.name = n; if (n === 'cuffs') o.visible = false;
    }
  });
  root.updateMatrixWorld(true);
  const rest = {}; for (const k in bones) rest[k] = bones[k].quaternion.clone(); const bone = (nm) => bones[sn(nm)];
  const restW = {}; for (const k in bones) restW[k] = bones[k].getWorldQuaternion(new T.Quaternion());
  const rw = (nm) => restW[sn(nm)], rq = (nm) => rest[sn(nm)];
  const V = (a) => new T.Vector3(a[0], a[1], a[2]);
  // flexion axes for the finger bones (in each bone's local frame): axis = finger direction x palm normal (curls the fingertip toward the palm)
  const FING = ['thumb', 'index', 'middle', 'ring', 'pinky'];
  const flexAxis = {};
  for (const s of ['L', 'R']) {
    const n = V(meta.palm[s]).normalize();
    for (const f of FING) for (let k = 1; k <= 3; k++) {
      const nm = `${f}${k}.${s}`; const b = meta.bones[nm]; const d = V(b.tail).sub(V(b.head)).normalize();
      const ax = new T.Vector3().crossVectors(d, n).normalize();
      flexAxis[nm] = ax.applyQuaternion(rw(nm).clone().invert());
    }
  }
  // typed keys -> finger
  const FMAP = { q: ['L', 'pinky'], a: ['L', 'pinky'], z: ['L', 'pinky'], w: ['L', 'ring'], s: ['L', 'ring'], x: ['L', 'ring'], e: ['L', 'middle'], d: ['L', 'middle'], c: ['L', 'middle'], r: ['L', 'index'], f: ['L', 'index'], v: ['L', 'index'], t: ['L', 'index'], g: ['L', 'index'], b: ['L', 'index'],
    y: ['R', 'index'], h: ['R', 'index'], n: ['R', 'index'], u: ['R', 'index'], j: ['R', 'index'], m: ['R', 'index'], i: ['R', 'middle'], k: ['R', 'middle'], o: ['R', 'ring'], l: ['R', 'ring'], p: ['R', 'pinky'], ' ': ['R', 'thumb'], '?': ['R', 'pinky'], '.': ['R', 'ring'] };
  const PROMPT = ctx.timeline.PROMPT.toLowerCase();
  const qz = new T.Quaternion(), tmpV = new T.Vector3();
  const A_MCP = 15 * PI / 180, A_PIP = 22 * PI / 180, A_DIP = 10 * PI / 180;
  const ease = (age) => age < 0 ? 0 : age < 0.05 ? age / 0.05 : age < 0.11 ? 1 : Math.exp(-(age - 0.11) / 0.13);
  const sat = (x) => Math.max(0, Math.min(1, x));
  function update(t, S, z, c) {
    // fingers
    const amt = {}; // 'L.index' -> 0..1
    for (const [i, age] of S.ages || []) { const ch = PROMPT[i]; const f = FMAP[ch]; if (!f) continue; const k = f[0] + '.' + f[1]; amt[k] = Math.max(amt[k] || 0, ease(age)); }
    for (const s of ['L', 'R']) for (const f of FING) {
      const a = amt[s + '.' + f] || 0; const sc = f === 'thumb' ? 0.5 : 1;
      [[1, A_MCP], [2, A_PIP], [3, A_DIP]].forEach(([k, ang]) => { const nm = `${f}${k}.${s}`; const b = bone(nm); qz.setFromAxisAngle(flexAxis[nm], a * ang * sc); b.quaternion.copy(rq(nm)).multiply(qz); });
    }
    // hands lift a little on the other fingers while one taps; forearm micro-movements
    const E = S.E || 0;
    for (const s of ['L', 'R']) { const b = bone('farm.' + s); if (b) { qz.setFromAxisAngle(new T.Vector3(0, 0, 1).applyQuaternion(rw('farm.' + s).clone().invert()), -0.012 * E + 0.004 * Math.sin(t * 1.3 + (s === 'L' ? 0 : 2))); b.quaternion.copy(rq('farm.' + s)).multiply(qz); } }
    // head: nods with the rhythm of typing, looks down at the screen between keys (rotation about the z (left-right) axis keeps the section plane valid)
    const head = bone('head'), sp = bone('spine2');
    const nod = -0.012 * E - 0.010 + 0.006 * Math.sin(t * 0.7); const br = 0.010 * Math.sin(t * 1.5);
    if (head) { qz.setFromAxisAngle(new T.Vector3(0, 0, 1).applyQuaternion(rw('head').clone().invert()), nod); head.quaternion.copy(rq('head')).multiply(qz); }
    if (sp) { qz.setFromAxisAngle(new T.Vector3(0, 0, 1).applyQuaternion(rw('spine2').clone().invert()), br); sp.quaternion.copy(rq('spine2')).multiply(qz); }
  }
  return { root, bones, update, meta, skinned };
}
