/* LEVEL "stars": the Sun's neighbourhood, z 13.6 .. 21.6.  Frame: heliocentric (the group follows the Sun), axes = the shared EARTH frame
 * (ecliptic = xz plane, ecliptic north = -y; the Sun's orbital phase about y is free, see PHI in assets/stars/dso.json and requests/stars.md).
 * REAL: HYG v4.1 star catalogue (Hipparcos/Gliese/Yale: 109k stars with 3-D positions, absolute magnitudes, B-V colours), real object positions
 *       (RA/Dec/distance), real nebula imagery (NASA/ESA/ESO via Wikimedia Commons), real Voyager directions/distances/boundary-crossing dates.
 * PROCEDURAL (flagged in stars.bin, kind 1/2): the distant disc continuation (density model), cluster fill, Oort comets, Orion gas volume, the Milky Way disc glow (analytic barred-spiral model).
 * Every star is a round/spiked screen-space sprite sized by absolute magnitude through a zoom-dependent magnitude cut and a distance modulus, so it stays crisp at every zoom.
 * Labels are laid out by a small collision-avoiding manager (leader lines, priorities, viewport clamping); every anchor sits on the object it names. */
import { starVert, starFrag, sparkVert, sparkFrag, shellVert, shellFrag, nebVert, nebFrag, markVert, markFrag, rangeVert, rangeFrag, latheVert, lineVert, lineFrag, diskVert, diskFrag, veilVert, veilFrag, celFrag, hazeVert, hazeFrag, galVert, galFrag, volVert, volFrag, leadVert, leadFrag } from './stars/shaders.js';

const LY = 9.4607304725808e15, AU = 1.495978707e11, PC = 3.0856775814914e16, KPC = 3.0856775814913673e19;
const GAL = [[-0.0548755604, -0.8734370902, -0.4838350155], [0.4941094279, -0.4448296300, 0.7469822445], [-0.8676661490, -0.1980763734, 0.4559837762]];

export default async function build(ctx) {
  const { T, kit, plan } = ctx; const { ss, lerp, clamp } = kit;
  // additive colour, but alpha accumulates with MAX so the engine's  mix(backdrop, src.rgb, src.a)  keeps the backdrop wherever nothing was drawn
  const ADD = { blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneFactor, blendEquationAlpha: T.MaxEquation, blendSrcAlpha: T.OneFactor, blendDstAlpha: T.OneFactor };
  const lineMat = () => new T.ShaderMaterial({ vertexShader: lineVert, fragmentShader: lineFrag, transparent: true, depthWrite: false, ...ADD, fog: false, uniforms: { uColor: { value: new T.Color(0) } } });
  const hid = new Set((ctx.params.get('hid') || '').split(',').filter(Boolean));     // debug: ?hid=stars,sparks,shells,neb,rings,disk,haze,gal,vol
  const solo = ctx.params.has('only');                    // stars rendered alone (review frames): add the labels the solar level owns in the full film
  const group = new T.Group(); group.userData.name = 'stars';
  // the engine paints a screen-fixed layer of cross-flare stars into the backdrop at every scale; once the real catalogue takes over we
  // paint the same violet well over it (alpha < 1 keeps a ghost), so only catalogue-driven sprites parallax and fade with zoom (see requests/stars.md #1)
  const veilMat = new T.ShaderMaterial({ vertexShader: veilVert, fragmentShader: veilFrag, transparent: true, depthWrite: false, depthTest: true, ...ADD, fog: false, uniforms: { uOp: { value: 0 }, uRes: { value: new T.Vector2(1600, 1000) } } });
  const veilGeo = new T.BufferGeometry(); veilGeo.setAttribute('corner', new T.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2)); veilGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(12), 3)); veilGeo.setIndex([0, 1, 2, 0, 2, 3]);
  const veil = new T.Mesh(veilGeo, veilMat); veil.frustumCulled = false; veil.renderOrder = -100; veil.visible = !hid.has('veil'); group.add(veil);
  const [buf, named, dso] = await Promise.all([ctx.fetchBuf('stars/stars.bin'), ctx.fetchJSON('stars/named.json'), ctx.fetchJSON('stars/dso.json')]);
  const PHI = dso.phi || 0, eps = 23.4392911 * Math.PI / 180;
  // equatorial J2000 vector -> shared EARTH frame (same maths as build_data.py)
  const eq2f = (x, y, z) => { const Xe = x, Ye = y * Math.cos(eps) + z * Math.sin(eps), Ze = -y * Math.sin(eps) + z * Math.cos(eps); const fx = Xe, fy = -Ze, fz = Ye, c = Math.cos(PHI), s = Math.sin(PHI); return [c * fx + s * fz, fy, -s * fx + c * fz]; };
  const skyDir = (raH, decD) => { const ra = raH * 15 * Math.PI / 180, de = decD * Math.PI / 180; return eq2f(Math.cos(de) * Math.cos(ra), Math.cos(de) * Math.sin(ra), Math.sin(de)); };
  const eclDir = (lonD, latD) => { const l = lonD * Math.PI / 180, b = latD * Math.PI / 180, X = Math.cos(b) * Math.cos(l), Y = Math.cos(b) * Math.sin(l), Z = Math.sin(b); const c = Math.cos(PHI), s = Math.sin(PHI), fx = X, fy = -Z, fz = Y; return [c * fx + s * fz, fy, -s * fx + c * fz]; };
  const V = (a, k = 1) => new T.Vector3(a[0] * k, a[1] * k, a[2] * k);
  const galAxis = (i) => eq2f(GAL[i][0], GAL[i][1], GAL[i][2]);                        // galactic unit axes (X: centre, Y: rotation, Z: north pole) in the frame
  const gX = galAxis(0), gY = galAxis(1), gZ = galAxis(2);
  const galDir = (lD, bD) => { const l = lD * Math.PI / 180, b = bD * Math.PI / 180, cb = Math.cos(b); return [0, 1, 2].map((k) => gX[k] * Math.cos(l) * cb + gY[k] * Math.sin(l) * cb + gZ[k] * Math.sin(b)); };
  const rnd = (() => { let a = 0x9e3779b9; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
  const gauss = () => { let u = 0; while (!u) u = rnd(); const v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * v); };

  // ---------------------------------------------------------------- stars
  const bvRgb = (bv) => { bv = Math.min(2, Math.max(-0.4, bv)); const T_ = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62)), t = T_ / 100; const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592), g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492), b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    let c = [r, g, b].map((x) => Math.min(255, Math.max(0, x)) / 255); const lum = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; c = c.map((x) => Math.min(1, Math.max(0, lum + (x - lum) * 1.35))).map((x) => 0.15 + 0.85 * x); return c.map((x) => Math.round(x * 255)); };
  const hdr = new Uint32Array(buf, 0, 4), N = hdr[0];
  const posPc = new Float32Array(buf, 16, N * 3), absM = new Float32Array(buf, 16 + N * 12, N), rgba = new Uint8Array(buf, 16 + N * 16, N * 4);
  const heroNames = ['Sirius', 'Procyon', 'Altair', 'Vega', 'Fomalhaut', 'Arcturus', 'Capella', 'Pollux', 'Aldebaran', 'Regulus', 'Spica', 'Antares', 'Betelgeuse', 'Rigel', 'Deneb', 'Canopus', 'Achernar', 'Polaris', 'Alnitak', 'Alnilam', 'Mintaka', 'Bellatrix', 'Saiph', 'Mimosa', 'Acrux', 'Hadar'];
  const heroes = named.filter((o) => heroNames.includes(o.name));
  const NS = N + 1 + heroes.length;                                                    // + the Sun + boosted duplicates of the brightest named stars (kind 4)
  const iPos = new Float32Array(NS * 3), iM = new Float32Array(NS), iCol = new Uint8Array(NS * 4);
  // open clusters at their real centres: members come from the catalogue itself (real Hipparcos stars inside the cluster volume) plus the flagged procedural fill (kind 2)
  const cen = (raH, decD, d) => skyDir(raH, decD).map((x) => x * d * PC);
  const CL = [{ n: 'hyades', c: cen(4.4985, 15.87, 47), r: 9 * PC, test: () => true }, { n: 'pleiades', c: cen(3.7903, 24.105, 136), r: 8 * PC, test: () => true },
    { n: 'orion', c: cen(5.5881, -5.39, 412), r: 62 * PC, test: (m, r, b) => m < 1.2 && b >= r }];            // Orion OB1: the hot, luminous Hipparcos stars within ~200 ly of the nebula
  let nClu = [0, 0, 0], nFill = 0;
  for (let i = 0; i < N; i++) {
    const x = posPc[3 * i] * PC, y = posPc[3 * i + 1] * PC, z = posPc[3 * i + 2] * PC; iPos[3 * i] = x; iPos[3 * i + 1] = y; iPos[3 * i + 2] = z; iM[i] = absM[i];
    let r = rgba[4 * i], g = rgba[4 * i + 1], b = rgba[4 * i + 2], k = rgba[4 * i + 3];
    const lum = r * 0.3 + g * 0.59 + b * 0.11; const sat = (v) => Math.max(0, Math.min(255, Math.round(lum + (v - lum) * 1.45))); r = sat(r); g = sat(g); b = sat(b);   // a touch more colour: orange giants, cyan-white B stars
    if (k === 2) { const C = CL[2], dx = x - C.c[0], dy = y - C.c[1], dz = z - C.c[2];
      if (dx * dx + dy * dy + dz * dz < 9 * PC * PC && (i % 10) !== 0) { k = 2; iM[i] = 16; }          // the ONC core is ~1000 stars in ~2 pc: show a tenth (stacked they would blow out the bloom pass)
      else { const P = CL[1], ex_ = x - P.c[0], ey_ = y - P.c[1], ez_ = z - P.c[2]; if (ex_ * ex_ + ey_ * ey_ + ez_ * ez_ < 16 * PC * PC && (i % 3) !== 0) { k = 2; iM[i] = 16; } else { k = 5; nFill++; } } }
    else if (k === 0) for (let j = 0; j < CL.length; j++) { const C = CL[j]; const dx = x - C.c[0], dy = y - C.c[1], dz = z - C.c[2]; if (dx * dx + dy * dy + dz * dz < C.r * C.r && C.test(absM[i], r, b)) { k = 5; nClu[j]++; break; } }
    iCol[4 * i] = r; iCol[4 * i + 1] = g; iCol[4 * i + 2] = b; iCol[4 * i + 3] = k;
  }
  ctx.log('stars: real cluster members tagged (Hyades, Pleiades, Orion OB1):', nClu.join(', '), '+ procedural fill', nFill);
  iM[N] = -5.5; iCol.set([255, 222, 150, 3], 4 * N);                                    // the Sun: always findable ("hero" star, kind 3)
  heroes.forEach((o, i) => { const k = N + 1 + i; iPos[3 * k] = o.pc[0] * PC; iPos[3 * k + 1] = o.pc[1] * PC; iPos[3 * k + 2] = o.pc[2] * PC; iM[k] = o.M; const c = bvRgb(o.ci); iCol.set([c[0], c[1], c[2], 4], 4 * k); });
  const corner = new T.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2), dummy = new T.BufferAttribute(new Float32Array(12), 3);
  const quadGeo = () => { const g = new T.InstancedBufferGeometry(); g.setAttribute('corner', corner); g.setAttribute('position', dummy); g.setIndex([0, 1, 2, 0, 2, 3]); return g; };
  const quad = quadGeo(); quad.setAttribute('iPos', new T.InstancedBufferAttribute(iPos, 3)); quad.setAttribute('iM', new T.InstancedBufferAttribute(iM, 1)); quad.setAttribute('iCol', new T.InstancedBufferAttribute(iCol, 4, true)); quad.instanceCount = NS;
  const starMat = new T.ShaderMaterial({ vertexShader: starVert, fragmentShader: starFrag, transparent: true, depthWrite: false, depthTest: true, ...ADD, fog: false,
    uniforms: { uMcut: { value: 10 }, uSizeK: { value: 1 }, uMaxSize: { value: 24 }, uSizeBoost: { value: 1 }, uS: { value: 1 }, uDf: { value: 1e17 }, uKd: { value: 3 }, uInvW: { value: 1e-17 }, uBoost: { value: 6 }, uAmpK: { value: 1 }, uHero: { value: 0 }, uMBoost: { value: 0 }, uSunD: { value: 0 }, uR0: { value: 1.2 }, uR1: { value: 2.8 }, uRes: { value: new T.Vector2(1600, 1000) }, uClu: { value: new T.Vector2(0, 2.3) }, uKind: { value: new T.Vector4(1, 1, 1, 1) } } });
  const stars = new T.Mesh(quad, starMat); stars.frustumCulled = false; stars.renderOrder = 4; stars.visible = !hid.has('stars'); group.add(stars);

  // ---------------------------------------------------------------- Oort cloud: a column-density haze (outer isotropic cloud + flattened inner Hills disc) with sparse icy comet glints sampled from the same densities
  const rejection = (lo, hi, f) => { let gmax = 0; for (let i = 0; i <= 400; i++) { const r = lo + (hi - lo) * i / 400; gmax = Math.max(gmax, f(r)); } for (;;) { const r = lo + (hi - lo) * rnd(); if (rnd() * gmax < f(r)) return r; } };
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const gOuter = (r) => r * r * Math.pow(r / 30000, -3.4) * sstep(9000, 30000, r) * Math.exp(-Math.pow(r / 86000, 3.2));
  const gInner = (r) => r * r * Math.pow(r / 4500, -1.7) * sstep(800, 2600, r) * (1 - sstep(13000, 30000, r));
  const NO_OUT = 4600, NO_IN = 5200, NO_CORE = 1800, NO = NO_OUT + NO_IN + NO_CORE, oort = new Float32Array(NO * 4);
  for (let i = 0; i < NO; i++) {
    let r, flat; if (i < NO_OUT) { r = rejection(9000, 150000, gOuter); flat = 1.0; } else if (i < NO_OUT + NO_IN) { r = rejection(900, 30000, gInner); flat = 0.26; } else { r = 1100 + 7000 * Math.pow(rnd(), 1.6); flat = 0.26; }
    const x = gauss(), y = gauss() * flat, z = gauss(); const l = Math.hypot(x, y, z) || 1; r *= AU / l; oort[4 * i] = x * r; oort[4 * i + 1] = y * r; oort[4 * i + 2] = z * r; oort[4 * i + 3] = rnd() + (flat < 0.9 ? 2 : 0);
  }
  const sq = quadGeo(); sq.setAttribute('iPos', new T.InstancedBufferAttribute(oort, 4)); sq.instanceCount = NO;
  const sparkMat = new T.ShaderMaterial({ vertexShader: sparkVert, fragmentShader: sparkFrag, transparent: true, depthWrite: false, ...ADD, fog: false, uniforms: { uSizeK: { value: 1 }, uOp: { value: 0.6 }, uInner: { value: 1 }, uRes: starMat.uniforms.uRes } });
  const sparks = new T.Mesh(sq, sparkMat); sparks.frustumCulled = false; sparks.renderOrder = 3; sparks.visible = !hid.has('sparks'); group.add(sparks);
  const hazeGeo = new T.BufferGeometry(); hazeGeo.setAttribute('corner', corner); hazeGeo.setAttribute('position', dummy); hazeGeo.setIndex([0, 1, 2, 0, 2, 3]);
  const hazeMat = new T.ShaderMaterial({ vertexShader: hazeVert, fragmentShader: hazeFrag, transparent: true, depthWrite: false, ...ADD, fog: false,
    uniforms: { uRight: { value: new T.Vector3(1, 0, 0) }, uUp: { value: new T.Vector3(0, 1, 0) }, uFwd: { value: new T.Vector3(0, 0, -1) }, uEcl: { value: new T.Vector3(0, 1, 0) }, uHalf: { value: 1.25e5 * AU }, uS: { value: 1 }, uOuter: { value: 0.9e-5 }, uInner: { value: 0.42e-4 }, uCel: { value: 0.1 }, uOp: { value: 1 } } });
  const haze = new T.Mesh(hazeGeo, hazeMat); haze.frustumCulled = false; haze.renderOrder = 1; haze.visible = !hid.has('haze'); group.add(haze);

  // ---------------------------------------------------------------- membranes: heliopause, termination shock, bow wave (lathes) and the Local Bubble, in a cel ramp with a thin rim light
  const sph = new T.SphereGeometry(1, 160, 112); const nv = sph.attributes.position.count;
  const shellGeo = (radiusFn) => { const g = new T.BufferGeometry(); const dir = sph.attributes.position.array.slice(); const R = new Float32Array(nv); for (let i = 0; i < nv; i++) R[i] = radiusFn(dir[3 * i], dir[3 * i + 1], dir[3 * i + 2]);
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(nv * 3), 3)); g.setAttribute('aDir', new T.BufferAttribute(dir, 3)); g.setAttribute('aR', new T.BufferAttribute(R, 1)); g.setIndex(new T.BufferAttribute(sph.index.array.slice(), 1)); return g; };
  const celMat = (vert, hi, lo, op, pw, noise, seed, base, cel, rim) => new T.ShaderMaterial({ vertexShader: vert, fragmentShader: celFrag, transparent: true, depthWrite: false, side: T.DoubleSide, ...ADD, fog: false,
    uniforms: { uR: { value: 1 }, uScale: { value: new T.Vector3(1, 1, 1) }, uColor: { value: new T.Color(hi) }, uColor2: { value: new T.Color(lo) }, uOp: { value: op }, uPow: { value: pw }, uNoise: { value: noise }, uSeed: { value: seed }, uBase: { value: base }, uCel: { value: cel }, uRim: { value: rim } } });
  const shells = new T.Group(); shells.visible = !hid.has('shells'); group.add(shells);
  const addShell = (geo, mat, order = 1) => { const m = new T.Mesh(geo, mat); m.renderOrder = order; m.frustumCulled = false; shells.add(m); return m; };
  // heliopause continuation: same profile and nose direction as the solar level (nose 121 AU toward the interstellar wind, flank ~142 AU, tail ~420 AU), so the handover at z ~ 14.3 is seamless.
  const helioPivot = new T.Group(); shells.add(helioPivot);        // the heliosphere frame (solar-level convention: x = ecliptic X, y = ecliptic Z, z = ecliptic Y); spun like the solar level's frame
  const eclS = (lonD, latD) => { const l = lonD * Math.PI / 180, b = latD * Math.PI / 180; return [Math.cos(b) * Math.cos(l), Math.sin(b), Math.cos(b) * Math.sin(l)]; };
  const mkLathe = (NOSE, XC, RM, TL, mat) => { const prof = []; const sc = NOSE / 121, RT = 170 * sc, LT = 300 * sc, LC = 320 * sc;       // EXACTLY the solar level's heliopause profile (shellProfile(121,170,300,320)), scaled by NOSE/121 for the nested shells
    for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI / 2; prof.push([NOSE * Math.cos(a), NOSE * Math.sin(a)]); }
    for (let i = 1; i <= 80; i++) { const k = i / 80, e = k * k * (3 - 2 * k); prof.push([-k * LT, NOSE + (RT - NOSE) * e]); }
    for (let i = 1; i <= 64; i++) { const b = i / 64 * Math.PI / 2; prof.push([-LT - LC * Math.sin(b), RT * Math.cos(b)]); }
    const seg = 96, P = prof.length, pos = [], idx = []; for (let i = 0; i < P; i++) for (let j = 0; j <= seg; j++) { const a = j / seg * 6.2831853; pos.push(prof[i][0] * AU, prof[i][1] * Math.cos(a) * AU, prof[i][1] * Math.sin(a) * AU); }
    for (let i = 0; i < P - 1; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + 1, c = a + seg + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new T.Mesh(g, mat);
    m.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), new T.Vector3(...eclS(255.4, 5.1)));
    m.frustumCulled = false; m.renderOrder = 1; const pivot = helioPivot; pivot.add(m); m.userData.pivot = pivot;
    // outward profile normals (x, rho plane) for exact silhouette anchoring of the labels
    m.userData.prof = prof.map((p, i) => { const p0 = prof[Math.max(0, i - 1)], p1 = prof[Math.min(prof.length - 1, i + 1)]; const dx = p1[0] - p0[0], dr = p1[1] - p0[1], n = Math.hypot(dx, dr) || 1; return { x: p[0], r: p[1], nx: dr / n, nr: -dx / n }; });
    return m; };
  const helio = mkLathe(121, 0, 0, 0, celMat(latheVert, 0x7fe3c4, 0x1c5a72, 0.5, 3.0, 2.0, 7.3, 0.085, 0.55, 0.9));          // the heliopause: periwinkle ramp
  const termShock = mkLathe(94.38, 0, 0, 0, celMat(latheVert, 0xffd9a0, 0x6a2a62, 0.4, 3.4, 2.0, 2.1, 0.05, 0.55, 0.8));       // termination shock (V1 94 AU, V2 84 AU): warm inner skin
  const bowWave = mkLathe(215, 0, 0, 0, celMat(latheVert, 0x9aa8ff, 0x22267a, 0.22, 3.4, 2.0, 4.4, 0.0, 0.4, 0.6));          // the hydrogen wall / bow wave of the interstellar wind, much fainter
  const helioPt = (x, rho, ph) => { const p = new T.Vector3(x * AU, rho * Math.cos(ph) * AU, rho * Math.sin(ph) * AU); return p.applyQuaternion(helio.quaternion).applyQuaternion(helio.userData.pivot.quaternion); };
  // Local Bubble: a low-density cavity in the disc, ~300 ly across the short axes and longer toward the Canis Majoris tunnel, opening toward the galactic poles (Lallement 2003; Zucker 2022).
  // Irregular: dense walls (Sco-Cen, Ophiuchus, Taurus/Perseus clouds) pinch it, the CMa tunnel and the northern chimney stretch it.
  const uLB = galDir(235, 0);
  const lumps = [[235, -8, 0.30, 0.55], [180, 70, 0.30, 0.6], [330, 8, -0.20, 0.5], [356, 17, -0.16, 0.45], [165, -18, -0.22, 0.5], [95, 2, 0.12, 0.5], [285, -2, -0.10, 0.45]].map(([l, b, a, w]) => ({ d: galDir(l, b), a, w }));
  const lbRadius = (x, y, z) => { const c = x * uLB[0] + y * uLB[1] + z * uLB[2], sb = x * gZ[0] + y * gZ[1] + z * gZ[2]; const a = 78, b = 50;
    let q = PC / Math.sqrt(c * c / (a * a) + (1 - c * c) / (b * b)); let f = 1 + 0.08 * Math.sin(2.1 * c + 1.0);
    for (const L of lumps) { const dd = Math.acos(Math.max(-1, Math.min(1, x * L.d[0] + y * L.d[1] + z * L.d[2]))); f += L.a * Math.exp(-Math.pow(dd / L.w, 2)); }
    return q * f * (1 + 0.10 * sb * Math.abs(sb) * Math.abs(sb)); };
  const bubbleGeo = shellGeo(lbRadius);
  const bubble = addShell(bubbleGeo, celMat(shellVert, 0xd2b6ff, 0x3b2f96, 0.5, 3.1, 2.6, 3.9, 0.012, 0.5, 0.5));
  const bubbleDirs = bubbleGeo.attributes.aDir.array, bubbleR = bubbleGeo.attributes.aR.array;

  // ---------------------------------------------------------------- nebulae: real imagery on camera-facing quads of true physical size (+ a blurred haze of the same colours)
  const texLoader = new T.TextureLoader(); const loadTex = (p) => new Promise((res, rej) => texLoader.load(ctx.assetURL(p), (t) => { t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter; res(t); }, undefined, rej));
  const nebs = []; const nebGroup = new T.Group(); nebGroup.visible = !hid.has('neb'); group.add(nebGroup);
  const nquad = new T.BufferGeometry(); nquad.setAttribute('corner', corner); nquad.setAttribute('position', dummy); nquad.setIndex([0, 1, 2, 0, 2, 3]);
  await Promise.all(dso.dso.map(async (d) => {
    const [tex, haze] = await Promise.all([loadTex('stars/neb/' + d.id + '.jpg'), loadTex('stars/neb/' + d.id + '_haze.png')]);
    const c = d.pc.map((x) => x * PC), halfW = d.wly * LY / 2, halfH = halfW / d.aspect;
    const mk = (t, hw, hh, order) => { const m = new T.Mesh(nquad, new T.ShaderMaterial({ vertexShader: nebVert, fragmentShader: nebFrag, transparent: true, depthWrite: false, ...ADD, fog: false,
      uniforms: { uTex: { value: t }, uC: { value: new T.Vector3(c[0], c[1], c[2]) }, uHalf: { value: new T.Vector2(hw, hh) }, uS: { value: 1 }, uOp: { value: 1 }, uTint: { value: new T.Vector3(1, 1, 1) } } })); m.frustumCulled = false; m.renderOrder = order; nebGroup.add(m); return m; };
    nebs.push({ d, detail: mk(tex, halfW, halfH, 2), haze: mk(haze, halfW * d.hz, halfH * d.hz, 1) });
  }));
  // the Orion complex as a ray-marched volume (Ha pink, reflection blue, O III teal core, dust lanes) around the Orion Nebula, true size ~360 ly, enlarged only when it would drop below ~6% of the frame
  const orionD = dso.dso.find((d) => d.id === 'orion'); const orionC = V(orionD.pc, PC);
  const orionHalfTrue = 180 * LY;
  const volMat = new T.ShaderMaterial({ vertexShader: volVert, fragmentShader: volFrag, transparent: true, depthWrite: false, ...ADD, fog: false,
    uniforms: { uC: { value: orionC.clone() }, uHalf: { value: orionHalfTrue }, uS: { value: 1 }, uMag: { value: 1 }, uOp: { value: 1 }, uSeed: { value: 3.7 }, uRight: { value: new T.Vector3(1, 0, 0) }, uUp: { value: new T.Vector3(0, 1, 0) }, uFwd: { value: new T.Vector3(0, 0, -1) }, uAx: { value: V(gZ) } } });
  const orionVol = new T.Mesh(nquad, volMat); orionVol.frustumCulled = false; orionVol.renderOrder = 1; orionVol.visible = !hid.has('vol'); group.add(orionVol);

  const N0n = (n) => { const o = named.find((q) => q.name === n); return [o.pc[0] * PC, o.pc[1] * PC, o.pc[2] * PC]; };
  // ring marks around the faint (red-dwarf) neighbours that the labels name, so the eye can find them (tinted like the star: they are red dwarfs)
  const nearNames = ['Proxima Centauri', 'Rigil Kentaurus', "Barnard's Star", 'Wolf 359', 'Lalande 21185'];
  const nearMarks = (() => { const mq = quadGeo(); const arr = new Float32Array(nearNames.length * 3); nearNames.forEach((n, i) => arr.set(N0n(n), 3 * i)); mq.setAttribute('iPos', new T.InstancedBufferAttribute(arr, 3)); mq.instanceCount = nearNames.length;
    const m = new T.Mesh(mq, new T.ShaderMaterial({ vertexShader: markVert, fragmentShader: markFrag, transparent: true, depthWrite: false, ...ADD, fog: false, uniforms: { uSizeK: { value: 1 }, uOp: { value: 0.5 }, uPx: { value: 24 }, uCore: { value: 0 }, uColor: { value: new T.Color(1.0, 0.62, 0.42) }, uRes: starMat.uniforms.uRes } })); m.frustumCulled = false; m.renderOrder = 6; group.add(m); return m; })();

  // ---------------------------------------------------------------- scale rings: ecliptic-plane rings in AU / ly; camera-facing range circles in ly (silhouette of a distance sphere)
  const rings = []; const ringGroup = new T.Group(); ringGroup.visible = !hid.has('rings'); group.add(ringGroup);
  const ex = eclDir(0, 0), ey = eclDir(90, 0);
  const rangeRing = (radius, color, op) => { const n = 256, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = i / n * 6.2831853; p[3 * i] = Math.cos(a); p[3 * i + 1] = Math.sin(a); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3)); const mat = new T.ShaderMaterial({ vertexShader: rangeVert, fragmentShader: rangeFrag, transparent: true, depthWrite: false, ...ADD, fog: false, uniforms: { uR: { value: radius }, uS: { value: 1 }, uColor: { value: new T.Color(0) } } });
    const m = new T.LineLoop(g, mat); m.frustumCulled = false; ringGroup.add(m); rings.push({ m, radius, op, c: new T.Color(color), plane: false }); };
  const gRing = (radius, color, op) => { const n = 256, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = i / n * 6.2831853; for (let k = 0; k < 3; k++) p[3 * i + k] = (ex[k] * Math.cos(a) + ey[k] * Math.sin(a)) * radius; }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3)); const m = new T.LineLoop(g, lineMat()); m.frustumCulled = false; ringGroup.add(m); rings.push({ m, radius, op, c: new T.Color(color), plane: true }); };
  [30, 100].forEach((a) => gRing(a * AU, 0x9aa4ff, 0.2));                         // Neptune's orbit and 100 AU: scale for the heliosphere
  [1e3, 1e4].forEach((a) => gRing(a * AU, 0x9aa4ff, 0.10)); gRing(2000 * AU, 0x9aa4ff, 0.09); gRing(20000 * AU, 0x9aa4ff, 0.09);                        // faint ecliptic scale rings (the 100,000 AU edge is the haze's own limb, not a line)
  [10, 100, 1000, 10000].forEach((l) => { gRing(l * LY, 0x8f9cff, 0.4); });

  // ---------------------------------------------------------------- Milky Way disc continuation: analytic barred-spiral glow + sparse stars (PROCEDURAL; galactic frame so it is aligned with the real catalogue stars)
  const ND = 150000, dPos = new Float32Array(ND * 3), dCol = new Uint8Array(ND * 4);
  { const Rd = 2.6, R0 = 8.2, bar = 27 * Math.PI / 180, cb = Math.cos(bar), sb = Math.sin(bar); const tmp = [0, 0, 0]; const tanP = 0.26, rk = [4.7, 6.6, 9.4, 13.2], wk = [1.0, 0.32, 1.0, 0.26];
    const arm = (R, ph) => { let best = 0; for (let i = 0; i < 4; i++) { const pk = Math.PI + Math.log(Math.max(R, 0.3) / rk[i]) / tanP; let d = ph - pk; d = Math.atan2(Math.sin(d), Math.cos(d)); const sig = 0.38 + 0.075 * R; best += wk[i] * Math.exp(-Math.pow(d * R * 0.251 / sig, 2)); } return Math.min(1, best); };
    for (let i = 0; i < ND; i++) {
      const u = rnd(); let X, Y, Z, col, w;
      if (u < 0.14) { const r = 0.55 * Math.sqrt(Math.pow(rnd() + 1e-4, -2 / 3) - 1) + 0.03, a = gauss(), b = gauss(), c = gauss(), n = Math.hypot(a, b, c) || 1; const x = a / n * r * 1.0, y = b / n * r * 0.55, z = c / n * r * 0.5; X = x * cb - y * sb; Y = x * sb + y * cb; Z = z; col = [255, 190, 118]; w = 0.07 + 0.10 * rnd(); }
      else if (u < 0.26) { const x = (rnd() + rnd() + rnd() - 1.5) * 2.8, y = gauss() * 0.34, z = gauss() * 0.16; if (Math.abs(x) > 4.2) { i--; continue; } X = x * cb - y * sb; Y = x * sb + y * cb; Z = z; col = [255, 200, 130]; w = 0.10 + 0.12 * rnd(); }
      else { let R, ph, a; for (;;) { R = -Rd * (Math.log(rnd() + 1e-9) + Math.log(rnd() + 1e-9)); if (R > 15.5 || R < 3.0) continue; ph = rnd() * 6.2831853; a = arm(R, ph); if (rnd() < 0.08 + 0.92 * a) break; }
        const thick = rnd() < 0.10, h = thick ? 0.9 : 0.3 * (1 + 0.05 * Math.max(0, R - 9)); Z = -h * Math.sign(rnd() - 0.5) * Math.log(rnd() + 1e-9); X = R * Math.cos(ph); Y = R * Math.sin(ph);
        const young = !thick && rnd() < 0.1 + 0.7 * a; const hii = young && a > 0.5 && R > 4.5 && rnd() < 0.05; col = thick ? [255, 214, 160] : hii ? [255, 110, 170] : young ? [176, 204, 255] : [255, 232, 196]; w = (young ? 0.7 : 0.35 + 0.35 * rnd()) * (0.3 + 0.7 * ss(1.5, 7, R)) * (1 - 0.6 * ss(8, 15, R)); }
      const x0 = X + R0, y0 = Y, z0 = Z, k = KPC;           // relative to the Sun (galactic X toward the centre)
      for (let c = 0; c < 3; c++) tmp[c] = (x0 * gX[c] + y0 * gY[c] + z0 * gZ[c]) * k;
      dPos.set(tmp, 3 * i); dCol[4 * i] = col[0]; dCol[4 * i + 1] = col[1]; dCol[4 * i + 2] = col[2]; dCol[4 * i + 3] = Math.round(255 * Math.min(1, w)); } }
  const dq = quadGeo(); dq.setAttribute('iPos', new T.InstancedBufferAttribute(dPos, 3)); dq.setAttribute('iCol', new T.InstancedBufferAttribute(dCol, 4, true)); dq.instanceCount = ND;
  const diskMat = new T.ShaderMaterial({ vertexShader: diskVert, fragmentShader: diskFrag, transparent: true, depthWrite: false, ...ADD, fog: false, uniforms: { uSizeK: { value: 1 }, uOp: { value: 0 }, uPx: { value: 1.5 }, uRes: starMat.uniforms.uRes } });
  const disk = new T.Mesh(dq, diskMat); disk.frustumCulled = false; disk.renderOrder = 3; disk.visible = !hid.has('disk'); group.add(disk);
  const R0K = 8.2;                                      // Sun's galactocentric radius, kpc (26,700 ly)
  const galGeo = new T.BufferGeometry(); galGeo.setAttribute('corner', corner); galGeo.setAttribute('position', dummy); galGeo.setIndex([0, 1, 2, 0, 2, 3]);
  const galMat = new T.ShaderMaterial({ vertexShader: galVert, fragmentShader: galFrag, transparent: true, depthWrite: false, side: T.DoubleSide, ...ADD, fog: false,
    uniforms: { uAx: { value: V(gX) }, uAy: { value: V(gY) }, uC: { value: V(gX, R0K * KPC) }, uHalf: { value: 19 * KPC }, uOp: { value: 0 }, uSeed: { value: 2.3 } } });
  const galGlow = new T.Mesh(galGeo, galMat); galGlow.frustumCulled = false; galGlow.renderOrder = 2; galGlow.visible = !hid.has('gal'); group.add(galGlow);
  disk.visible = false; galGlow.visible = false;      // the Milky Way disc (stars + glow + dust) belongs to the galaxy level, drawn beneath this one at the same positions
  const galRings = []; const galRingGroup = new T.Group(); group.add(galRingGroup);
  const galRing = (Rk, color, op) => { const n = 360, p = new Float32Array(n * 3); const tmpP = new T.Vector3(); for (let i = 0; i < n; i++) { const a = i / n * 6.2831853; tmpP.copy(V(gX, (R0K + Rk * Math.cos(a)) * KPC)).addScaledVector(V(gY), Rk * Math.sin(a) * KPC); p.set([tmpP.x, tmpP.y, tmpP.z], 3 * i); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3)); const m = new T.LineLoop(g, lineMat()); m.frustumCulled = false; galRingGroup.add(m); galRings.push({ m, op, c: new T.Color(color) }); };
  galRing(15.3, 0x9fb4ff, 0.30); galRing(R0K, 0xffd166, 0.26);
  // GC-relative galactic-plane coordinates (X away from the Sun, Y toward l = 90) -> level-local metres
  const galPt = (Xk, Yk) => V(gX, (R0K + Xk) * KPC).addScaledVector(V(gY), Yk * KPC);
  const armPt = (k, phi) => { const rk = [4.7, 6.6, 9.4, 13.2][k], R = rk * Math.exp(0.26 * (phi - Math.PI)); return galPt(R * Math.cos(phi), R * Math.sin(phi)); };

  // Voyager 1 and 2 (V1 ~172 AU toward Ophiuchus, V2 ~144 AU toward Pavo: both beyond the heliopause). Crossings: V1 TS Dec 2004 (94 AU), HP Aug 2012 (121.6 AU); V2 TS Aug 2007 (84 AU), HP Nov 2018 (119 AU)
  // directions are the real ecliptic coordinates of the probes (V1 lon 255.8 lat +35.2, V2 lon 290.0 lat -37.2), expressed in the same frame as the heliopause nose (lon 255.4 lat +5.1),
  // so each probe sits ~30 / ~53 deg off the nose whatever the frame's spin is
  const voy = [['Voyager 1', 172, 255.8, 35.2, '2012', '121'], ['Voyager 2', 144, 290.0, -37.2, '2018', '119']].map(([n, au, lo, la, yr, ca]) => { const d = eclS(lo, la); return { n, au, d, p: d.map((x) => x * au * AU), yr, ca }; });
  const makeMarks = (pts, color, px, core, op, host) => { const mq = quadGeo(); const arr = new Float32Array(pts.length * 3); pts.forEach((p, i) => arr.set(p, 3 * i)); mq.setAttribute('iPos', new T.InstancedBufferAttribute(arr, 3)); mq.instanceCount = pts.length;
    const m = new T.Mesh(mq, new T.ShaderMaterial({ vertexShader: markVert, fragmentShader: markFrag, transparent: true, depthWrite: false, ...ADD, fog: false, uniforms: { uSizeK: { value: 1 }, uOp: { value: op }, uPx: { value: px }, uCore: { value: core }, uColor: { value: new T.Color(color) }, uRes: starMat.uniforms.uRes } })); m.frustumCulled = false; m.renderOrder = 6; (host || group).add(m); return m; };
  const voyMarks = makeMarks(voy.map((o) => o.p), 0xffb347, 20, 1, 0.9, helioPivot);
  // the heliopause crossing along each probe's actual direction (ray / boundary intersection of the drawn lathe)
  const hpRadiusAlong = (dir) => { const dl = new T.Vector3(...dir).applyQuaternion(helio.quaternion.clone().invert()); const c = Math.max(-1, Math.min(1, dl.x));
    const NOSE = 121, XC = -20, RM = 142, a = (NOSE - XC); const cs = c, sn = Math.sqrt(1 - c * c); /* ellipse (x-XC)^2/a^2 + rho^2/RM^2 = 1 along r(cs, sn) */ const A = cs * cs / (a * a) + sn * sn / (RM * RM), B = -2 * XC * cs / (a * a), C = XC * XC / (a * a) - 1; return (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A); };
  voy.forEach((o) => { o.hp = hpRadiusAlong(o.d); o.cross = o.d.map((x) => x * o.hp * AU); });
  const crossMarks = makeMarks(voy.map((o) => o.cross), 0xbff3ff, 17, 0, 0.9, helioPivot);
  const voyIn = lineMat(), voyOut = lineMat(); 
  const voyLines = (() => { const mk = (a, b, mat) => { const arr = new Float32Array(voy.length * 6); voy.forEach((o, i) => arr.set([...a(o), ...b(o)], 6 * i)); const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(arr, 3)); const m = new T.LineSegments(g, mat); m.frustumCulled = false; m.renderOrder = 2; helioPivot.add(m); return m; };
    return [mk(() => [0, 0, 0], (o) => o.cross, voyIn), mk((o) => o.cross, (o) => o.p, voyOut)]; })();       // inside the bubble (amber) / in interstellar space (cyan)

  // ---------------------------------------------------------------- label manager (priorities, collision avoidance, leader lines, viewport clamp)
  const TAN7 = Math.tan(7 * Math.PI / 180), KCAM = 16;
  const qInv = new T.Quaternion(), qTmp = new T.Quaternion(), qId = new T.Quaternion(), _v = new T.Vector3(), _w = new T.Vector3(), HIDDEN = new T.Vector3();
  let qRoot = qId, VW = 1600, VH = 1000, HUDH = 96, curS = 1;
  const items = []; const labels = [];
  const wOf = (t) => t.replace(/<[^>]*>/g, '').length * 6.05 + 6;
  const add = (text, z0, z1, anchor, o = {}) => { const it = Object.assign({ text, z0, z1, anchor: typeof anchor === 'function' ? anchor : () => anchor, prio: 40, w: wOf(text), a: new T.Vector3(), L: new T.Vector3(), sel: null, last: 0, aA: 0 }, o);
    it.posR = new T.Vector3(); it.posL = new T.Vector3(); items.push(it);
    labels.push({ text, z0, z1, pos: () => (it.sel === 'R' ? it.posR : HIDDEN), amber: !!o.amber, right: false }); labels.push({ text, z0, z1, pos: () => (it.sel === 'L' ? it.posL : HIDDEN), amber: !!o.amber, right: true }); return it; };
  const toScreen = (p, out) => { _v.copy(p).add(group.position).applyQuaternion(qRoot).multiplyScalar(curS); const d = KCAM - _v.z; if (d < 0.6) return false; const k = 1 / (d * TAN7); out.x = (_v.x * k * VH / VW * 0.5 + 0.5) * VW; out.y = (-_v.y * k * 0.5 + 0.5) * VH - HUDH * 0.5; out.zs = _v.z; return true; };
  const fromScreen = (x, y, zs, out) => { const ndx = (x / VW - 0.5) * 2, ndy = -((y + HUDH * 0.5) / VH - 0.5) * 2, d = KCAM - zs; out.set(ndx * d * TAN7 * VW / VH, ndy * d * TAN7, zs).divideScalar(curS).applyQuaternion(qInv).sub(group.position); return out; };
  const viewDirLocal = (x, y) => _v.set(x, y, 0).applyQuaternion(qInv).clone();     // a screen-space direction expressed in level-local axes
  const fwdLocal = (out) => out.set(0, 0, -1).applyQuaternion(qInv);
  const lead = (() => { const MAXL = 160; const pos = new Float32Array(MAXL * 6), aA = new Float32Array(MAXL * 2); const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aA', new T.BufferAttribute(aA, 1));
    const m = new T.LineSegments(g, new T.ShaderMaterial({ vertexShader: leadVert, fragmentShader: leadFrag, transparent: true, depthWrite: false, depthTest: false, ...ADD, fog: false, uniforms: { uColor: { value: new T.Color(0.62, 0.66, 0.95) } } })); m.frustumCulled = false; m.renderOrder = 8; group.add(m); return { m, pos, aA, MAXL }; })();
  const sc = { x: 0, y: 0, zs: 0 };
  function layout(z, c) {
    curS = c.s; qRoot = group.parent ? group.parent.quaternion : qId; VW = innerWidth; VH = innerHeight; HUDH = VW < 681 ? 118 : 96; qInv.copy(qRoot).invert();
    fwdLocal(HIDDEN).multiplyScalar(1e12 / c.s);
    const bottom = VH - HUDH - 8, kept = [{ x0: 0, y0: 0, x1: 430, y1: 84 }, { x0: VW - 170, y0: 6, x1: VW, y1: 54 }]; let nl = 0;
    const act = items.filter((it) => z >= it.z0 + 0.02 && z <= it.z1 - 0.02).sort((a, b) => b.prio - a.prio);
    items.forEach((it) => { it.sel = null; });
    const hit = (r) => { for (const k of kept) if (r.x0 < k.x1 && r.x1 > k.x0 && r.y0 < k.y1 && r.y1 > k.y0) return true; return false; };
    for (const it of act) {
      it.a.copy(it.anchor()); if (!toScreen(it.a, sc)) continue;
      let ax = sc.x, ay = sc.y; const zs = sc.zs, off = ax < -6 || ax > VW + 6 || ay < -6 || ay > bottom + 6;
      if (off) { if (!it.edge) continue; const cx = VW / 2, cy = bottom / 2, dx = ax - cx, dy = ay - cy, k = Math.min((VW / 2 - 40) / Math.abs(dx || 1e-6), (bottom / 2 - 40) / Math.abs(dy || 1e-6)); ax = cx + dx * k; ay = cy + dy * k; }
      const cand = []; const fixed = it.fixed || off; if (it.first) it.first.forEach((f) => cand.push(f));
      if (fixed) { [0, -15, 15, -30, 30].forEach((dy) => { cand.push([0, dy, 'R']); cand.push([0, dy, 'L']); }); }
      else { cand.push([0, 0, 'R'], [0, 0, 'L']); [26, 48, 78, 118, 170].forEach((rad) => { [-38, 38, -142, 142, -90, 90, -12, 12, 192, 168].forEach((deg) => { const a = deg * Math.PI / 180, dx = rad * Math.cos(a), dy = rad * Math.sin(a); cand.push([dx, dy, dx >= 0 ? 'R' : 'L']); }); }); }
      const order = cand.map((_, i) => i); if (it.last > 0 && it.last < cand.length) { order.splice(it.last, 1); order.unshift(it.last); }
      let pick = -1, rect = null, dot = null;
      for (const ci of order) { const [dx, dy, sd] = cand[ci]; const px = ax + dx, py = ay + dy; const tr = sd === 'R' ? { x0: px + 9, x1: px + 14 + it.w } : { x0: px - 14 - it.w, x1: px - 9 }; tr.y0 = py - 11; tr.y1 = py + 6; const dr = { x0: px - 6, y0: py - 6, x1: px + 6, y1: py + 6 };
        if (tr.x0 < 3 || tr.x1 > VW - 3 || tr.y0 < 3 || tr.y1 > bottom) continue; if (hit(tr) || hit(dr)) continue; pick = ci; rect = [tr, dr]; dot = [px, py, dx, dy, sd]; break; }
      if (pick < 0) { if (it.prio < 90) continue; const [dx, dy, sd] = cand[0]; dot = [ax + dx, ay + dy, dx, dy, sd]; rect = []; pick = 0; }
      it.last = pick; kept.push(...rect); it.sel = dot[4];
      const tgt = dot[4] === 'R' ? it.posR : it.posL; fromScreen(dot[0], dot[1], zs, tgt);
      if ((dot[2] !== 0 || dot[3] !== 0) && !off && nl < lead.MAXL) { const a = Math.min(ss(it.z0, it.z0 + 0.4, z), 1 - ss(it.z1 - 0.4, it.z1, z)); lead.pos.set([it.a.x, it.a.y, it.a.z, tgt.x, tgt.y, tgt.z], 6 * nl); lead.aA[2 * nl] = 0.0; lead.aA[2 * nl + 1] = 0.7 * a; nl++; }
    }
    for (let i = nl; i < lead.MAXL; i++) { lead.pos.fill(0, 6 * i, 6 * i + 6); lead.aA[2 * i] = lead.aA[2 * i + 1] = 0; }
    lead.m.geometry.attributes.position.needsUpdate = true; lead.m.geometry.attributes.aA.needsUpdate = true;
  }
  // ---- anchors that sit exactly on a surface's silhouette
  const latheSil = (m, idx, score) => { const pr = m.userData.prof[idx]; const q = new T.Quaternion().copy(m.quaternion).premultiply(m.userData.pivot.quaternion); _w.set(0, 0, 1).applyQuaternion(qInv).applyQuaternion(qTmp.copy(q).invert());   // toward the camera, in lathe axes
    const wx = _w.x, wy = _w.y, wz = _w.z, A = Math.hypot(wy, wz); let best = null, bs = -1e30;
    for (const sg of [-1, 1]) { const cc = A < 1e-6 ? 0 : Math.max(-1, Math.min(1, -pr.nx * wx / (pr.nr * A))); const ph = Math.atan2(wz, wy) + sg * Math.acos(cc);
      const p = new T.Vector3(pr.x * AU, pr.r * Math.cos(ph) * AU, pr.r * Math.sin(ph) * AU).applyQuaternion(q); const s = p.clone().applyQuaternion(qRoot); const sv = score(s.x, s.y); if (sv > bs) { bs = sv; best = p; } }
    return best; };
  // a point on the ecliptic ring of a given radius, at the screen extreme in a given direction
  const ringPt = (radius, sx, sy) => { let best = null, bs = -1e30; for (let i = 0; i < 120; i++) { const a = i / 120 * 6.2831853, p = new T.Vector3(); for (let k = 0; k < 3; k++) p.setComponent(k, (ex[k] * Math.cos(a) + ey[k] * Math.sin(a)) * radius); const s = p.clone().applyQuaternion(qRoot), sv = s.x * sx + s.y * sy; if (sv > bs) { bs = sv; best = p; } } return best; };
  const limbPt = (radius, dx, dy) => { const v = viewDirLocal(dx, dy); return v.multiplyScalar(radius / (v.length() || 1)); };            // a point on the silhouette circle of a sphere centred on the Sun
  const bubbleLimb = (sx, sy) => { fwdLocal(_w); let best = null, bs = -1e30; const n = bubbleR.length;
    for (let i = 0; i < n; i += 7) { const dx = bubbleDirs[3 * i], dy = bubbleDirs[3 * i + 1], dz = bubbleDirs[3 * i + 2]; if (Math.abs(dx * _w.x + dy * _w.y + dz * _w.z) > 0.10) continue; const p = _v.set(dx * bubbleR[i], dy * bubbleR[i], dz * bubbleR[i]); const s = p.clone().applyQuaternion(qRoot), sv = s.x * sx + s.y * sy; if (sv > bs) { bs = sv; best = p.clone(); } }
    return best || new T.Vector3(); };

  // ---------------------------------------------------------------- labels (level-local coordinates: metres from the Sun)
  const N0 = named.reduce((o, s) => (o[s.name] = s, o), {});
  const star = (n) => V(N0[n].pc, PC);
  const fmtLy = (ly) => ly < 100 ? ly.toFixed(ly < 10 ? 1 : 0) : Math.round(ly).toLocaleString('en-US');
  const Dso = (id) => dso.dso.find((d) => d.id === id);
  const prioLy = (ly) => 58 + 14 * (1 - clamp(Math.log10(ly) / 3.4, 0, 1));
  add('The Sun', solo ? 13.6 : 14.2, 20.4, new T.Vector3(0, 0, 0), { amber: true, prio: 100, fixed: true });
  if (solo) add('The Sun · in the Orion Spur', 20.3, 21.6, new T.Vector3(0, 0, 0), { amber: true, prio: 100, first: [[-22, 22, 'L']] });
  // heliosphere (the solar level owns these in the full film below z 14.4)
  const h0 = solo ? 13.6 : 14.4;
  add('Termination shock · ~94 AU', h0, 14.9, () => latheSil(termShock, 17, (x, y) => -x + 0.6 * y), { amber: true, prio: 80, fixed: true });
  add('Heliopause · ~120 AU', h0, 14.9, () => latheSil(helio, 22, (x, y) => x + 0.6 * y), { prio: 80, fixed: true });
  add('Heliotail · hundreds of AU', h0, 14.5, () => latheSil(helio, 41 + 62, (x, y) => -x + 0.2 * y), { prio: 60, fixed: true });
  add('Hydrogen wall · ~215 AU', h0, 14.9, () => latheSil(bowWave, 14, (x, y) => x + 0.9 * y), { prio: 55, fixed: true });
  voy.forEach((o) => { add(o.n + ' · ' + o.au + ' AU · interstellar space', h0, 14.9, () => V(o.p).applyQuaternion(helioPivot.quaternion), { amber: true, prio: 85 }); add('crossed the heliopause in ' + o.yr + ' · ' + o.ca + ' AU', h0, 14.6, () => V(o.cross).applyQuaternion(helioPivot.quaternion), { prio: 70 }); });
  const ringLab = (text, radius, z0, z1, sx, sy, prio = 40) => add(text, z0, z1, () => ringPt(radius, sx, sy), { prio, fixed: true });
  if (solo) { ringLab('Neptune · 30 AU', 30 * AU, 13.6, 14.2, 0.9, -0.4, 45); ringLab('100 AU', 100 * AU, 13.6, 14.4, 0.8, 0.8, 45); }
   ringLab('1,000 AU', 1e3 * AU, 14.1, 15.0, 0.7, 0.8); ringLab('2,000 AU · inner edge of the Oort cloud', 2e3 * AU, 14.6, 15.8, 0.8, -0.5, 52); ringLab('10,000 AU', 1e4 * AU, 15.1, 16.2, 0.7, 0.8); ringLab('20,000 AU · Hills cloud edge', 2e4 * AU, 15.4, 16.4, 0.8, -0.5, 52);
  add('Inner Oort (Hills) cloud · 2,000 – 20,000 AU', 14.7, 16.3, () => ringPt(13000 * AU, -0.8, 0.5), { prio: 62, fixed: true });
  add('Outer Oort cloud · out to 100,000 AU · 3.2 ly across', 15.3, 17.4, () => limbPt(100000 * AU, 0.93, 0.38), { prio: 62, fixed: true });
  [1, 3].forEach((l) => rangeRing(l * LY, 0x9fb4ff, 0.3)); rangeRing(1.58 * LY, 0x7f8fd8, 0.16); add('1 light-year', 15.9, 17.0, () => limbPt(LY, 0.9, 0.55), { prio: 45, fixed: true }); add('3 ly', 16.5, 17.6, () => limbPt(3 * LY, 0.9, 0.55), { prio: 45, fixed: true });
  add('α Centauri · 4.4 ly, the nearest star system', 15.9, 17.2, () => star('Rigil Kentaurus'), { prio: 75, edge: true });
  ringLab('10 ly', 10 * LY, 16.9, 18.0, 0.7, 0.7); ringLab('100 ly', 100 * LY, 17.9, 19.4, 0.7, 0.7); ringLab('1,000 ly', 1000 * LY, 19.2, 20.2, 0.7, 0.7); ringLab('10,000 ly', 10000 * LY, 19.9, 21.0, 0.7, 0.7);
  // nearby stars (true distances; the dwarfs are ringed)
  const starLab = (n, title, z0, z1, o = {}) => { const ly = o.ly || N0[n].ly; add(title + ' · ' + fmtLy(ly) + ' ly', z0, z1, star(n), Object.assign({ prio: prioLy(ly) }, o)); };
  starLab('Proxima Centauri', 'Proxima Centauri', 16.9, 19.8, { ly: 4.24, prio: 78 });
  starLab('Rigil Kentaurus', 'α Centauri', 16.9, 19.8, { ly: 4.37, prio: 79 });
  starLab("Barnard's Star", "Barnard's Star", 16.9, 19.8, { ly: 5.96, prio: 74 });
  starLab('Wolf 359', 'Wolf 359', 17.0, 19.1, { ly: 7.86, prio: 64 });
  starLab('Lalande 21185', 'Lalande 21185', 17.0, 19.1, { ly: 8.3, prio: 63 });
  starLab('Sirius', 'Sirius', 16.9, 19.8, { ly: 8.6, prio: 76 });
  starLab('Procyon', 'Procyon', 17.0, 19.7, { ly: 11.5, prio: 73 });
  starLab('Altair', 'Altair', 17.2, 19.5, { ly: 16.7, prio: 62 });
  starLab('Vega', 'Vega', 17.3, 19.8, { ly: 25, prio: 72 });
  starLab('Fomalhaut', 'Fomalhaut', 17.5, 19.5, { ly: 25, prio: 58 });
  starLab('Arcturus', 'Arcturus', 17.5, 19.8, { ly: 37, prio: 66 });
  starLab('Betelgeuse', 'Betelgeuse', 18.3, 20.6, { ly: 550, prio: 70, amber: true });
  starLab('Rigel', 'Rigel', 18.3, 20.6, { ly: 860, prio: 68 });
  starLab('Antares', 'Antares', 18.3, 20.6, { ly: 550, prio: 68, amber: true });
  const near18 = ['Capella', 'Pollux', 'Aldebaran', 'Regulus', 'Spica', 'Canopus', 'Achernar', 'Bellatrix'];
  heroes.forEach((o) => { if (['Betelgeuse', 'Rigel', 'Antares', 'Vega', 'Altair', 'Arcturus', 'Sirius', 'Procyon', 'Fomalhaut'].includes(o.name)) return; const n = near18.includes(o.name); add(o.name + ' · ' + fmtLy(o.ly) + ' ly', n ? 17.9 : 18.8, n ? 20.0 : 19.7, V(o.pc, PC), { prio: n ? 48 : 30 }); });
  add('Local Bubble · 300 – 600 ly cavity', 18.0, 20.1, () => bubbleLimb(-0.7, 0.7), { prio: 66, fixed: true });
  add('Hyades · 153 ly', 17.9, 20.0, V(cen(4.4985, 15.87, 47)), { prio: 56 });
  add('Pleiades · 444 ly', 18.1, 20.2, V(Dso('pleiades').pc, PC), { prio: 57 });
  add('Taurus clouds · 450 ly', 18.6, 20.0, V(Dso('taurus').pc, PC), { prio: 40 });
  add('Helix Nebula · 655 ly', 18.7, 20.1, V(Dso('helix').pc, PC), { prio: 42 });
  add('Orion Nebula · 1,344 ly', 18.4, 21.0, V(Dso('orion').pc, PC), { amber: true, prio: 69 });
  add('Orion OB1 · young blue stars, 1,000 – 1,500 ly', 19.1, 20.4, V(cen(5.6, -1, 380)), { prio: 52 });
  add('Horsehead · 1,375 ly', 19.7, 20.6, V(Dso('horsehead').pc, PC), { prio: 41 });
  add('Lagoon Nebula · 4,100 ly', 19.5, 20.9, V(Dso('lagoon').pc, PC), { prio: 44 });
  add('Rosette Nebula · 5,200 ly', 19.5, 20.9, V(Dso('rosette').pc, PC), { prio: 44 });
  add('Eagle Nebula · 5,700 ly', 19.5, 21.0, V(Dso('eagle').pc, PC), { prio: 44 });
  add('Carina Nebula · 7,500 ly', 20.1, 21.0, V(Dso('carina').pc, PC), { prio: 44 });
  // the Milky Way
  add('Galactic centre · 26,000 ly', 19.8, solo ? 21.6 : 20.4, galPt(0, 0), { amber: true, prio: 90, first: [[70, -50, 'R'], [-70, -50, 'L'], [70, 50, 'R']] });
  if (solo) add('Galactic bar · ~27,000 ly long', 20.3, 21.6, galPt(2.6 * Math.cos(0.4712), 2.6 * Math.sin(0.4712)), { prio: 50, first: [[60, 60, 'R'], [-60, 60, 'L']] });
  if (solo) add('Perseus Arm', 20.3, 21.6, armPt(2, Math.PI + 1.15), { prio: 48 });
  if (solo) add('Sagittarius Arm', 20.3, 21.6, armPt(1, Math.PI - 0.95), { prio: 46 });
  if (solo) add('Scutum–Centaurus Arm', 20.3, 21.6, armPt(0, Math.PI + 0.55), { prio: 48 });
  if (solo) add('Milky Way disc · ~100,000 ly across', 20.4, 21.6, () => { let best = galPt(15.3, 0), bs = -1e30; for (let i = 0; i < 120; i++) { const a = i / 120 * 6.2831853, p = galPt(15.3 * Math.cos(a), 15.3 * Math.sin(a)); const s = p.clone().applyQuaternion(qRoot), sv = -s.y + 0.15 * s.x; if (sv > bs) { bs = sv; best = p; } } return best; }, { prio: 60, fixed: true });
  if (solo) add("The Sun's orbit · one lap in ~230 million years", 20.7, 21.6, () => galPt(-R0K * Math.cos(0.75), -R0K * Math.sin(0.75)), { prio: 42, fixed: true });
  const sunMark = makeMarks([[0, 0, 0]], 0xffd166, 26, 0.8, 0.0);

  // zoom-dependent magnitude cut, calibrated (cal.py) so ~3 / 15 / 220 / 600 / 1500 stars are in frame at z = 16.6 / 17 / 17.5 / 18 / 18.9+
  const MC = [[13.6, 20], [16.64, 20], [17, 17.5], [17.5, 14], [18, 7.5], [18.88, 2.2], [19.5, 0], [20, -0.8], [20.5, -1.5], [21.3, -2.5], [21.6, -3.5]];
  const mcut = (z) => { if (z <= MC[0][0]) return MC[0][1]; for (let i = 1; i < MC.length; i++) if (z <= MC[i][0]) return lerp(MC[i - 1][1], MC[i][1], (z - MC[i - 1][0]) / (MC[i][0] - MC[i - 1][0])); return MC[MC.length - 1][1]; };

  const U = starMat.uniforms; let solarInner = null, soloRot = null;
  // review frames render the stars level alone: spin the heliosphere frame (arbitrary, it is the Sun's orbital phase) so the nose points to the upper right and both probes read as outside it
  const pickSoloRot = () => { const n = new T.Vector3(...eclS(255.4, 5.1)); let best = 0, bs = -1e9; for (let i = 0; i < 360; i++) { const a = i / 360 * 6.2831853; const v = n.clone().applyAxisAngle(new T.Vector3(0, 1, 0), a).applyQuaternion(qRoot); const sc2 = v.x * Math.cos(0.5) + v.y * Math.sin(0.5); if (sc2 > bs) { bs = sc2; best = a; } } return best; };
  function update(t, S, z, c) {
    // real field width (the engine clamps z/c for nested insets; the disc and every ball-edge law must follow the REAL zoom so inside and outside the ball agree)
    if (group.parent) { const Wr = c.Wu / group.parent.scale.x; z = Math.log10(Wr); c = Object.assign({}, c, { W: Wr, s: c.Wu / Wr, z }); }
    qRoot = group.parent ? group.parent.quaternion : qId; qInv.copy(qRoot).invert();
    const dprP = ctx.params.has('dpr') ? Number(ctx.params.get('dpr')) : Math.min(2, window.devicePixelRatio || 1);
    const pk = dprP * clamp(innerHeight / 900, 0.75, 1.5);
    U.uRes.value.set(innerWidth * dprP, innerHeight * dprP); U.uSizeK.value = pk; sparkMat.uniforms.uSizeK.value = pk; nearMarks.material.uniforms.uSizeK.value = pk;
    // this level's nested ball must never swallow the screen (the galaxy disc beneath it has to stay drawn): keep it a modest circle, and let it go once the neighbourhood is sub-pixel
    lv.nestR = Math.min(5e19, 0.2 * c.W) * (1 - 0.999 * ss(21.4, 21.9, z));
    const k = ss; const gal = group.parent && group.parent.children.some((g) => g.userData && g.userData.levelId === 'galaxy');
    U.uSunD.value = 2 * 16 * Math.pow(10, 13.5 - z) / clamp(innerHeight / 900, 0.75, 1.5);   // = the solar level's Sun radius (16 px at its frozen z 13.5) shrinking with the real field width
    U.uMcut.value = mcut(z); U.uBoost.value = 6 * (1 - k(17.0, 17.9, z)); U.uS.value = c.s; U.uDf.value = c.W * 2.54; U.uInvW.value = 1 / c.W;
    U.uKind.value.set(1 - 0.35 * k(20.8, 21.6, z), 1 - k(20.3, 21.2, z), 1 - 0.6 * k(20.6, 21.4, z), k(13.55, 14.3, z));
    U.uClu.value.set(k(17.2, 18.0, z) * (1 - k(20.7, 21.3, z)), lerp(2.5, 1.0, k(19.0, 20.6, z)));
    sparkMat.uniforms.uInner.value = 1 - 0.5 * k(15.0, 16.4, z); sparkMat.uniforms.uOp.value = 0.95 * (1 - k(16.8, 17.5, z));
    diskMat.uniforms.uOp.value = 0; diskMat.uniforms.uSizeK.value = pk;
    galMat.uniforms.uOp.value = 0;
    voyMarks.material.uniforms.uSizeK.value = pk; voyMarks.material.uniforms.uOp.value = solarInner ? 0 : 0.9 * k(13.5, 13.8, z) * (1 - k(14.5, 15.2, z));
    crossMarks.material.uniforms.uSizeK.value = pk; crossMarks.material.uniforms.uOp.value = solarInner ? 0 : 0.9 * k(13.5, 13.8, z) * (1 - k(14.8, 15.2, z));
    { const go = 0; galRings.forEach((r) => r.m.material.uniforms.uColor.value.copy(r.c).multiplyScalar(r.op * go * 0.5)); galRingGroup.visible = go > 0.01; }
    sunMark.material.uniforms.uSizeK.value = pk; sunMark.material.uniforms.uOp.value = 0.6 * k(19.6, 20.2, z) * (1 - k(20.7, 21.1, z));
    if (!solarInner && group.parent) { const sg = group.parent.children.find((g) => g.userData && g.userData.levelId === 'solar'); if (sg) solarInner = sg.children.find((cc) => cc.isGroup) || null; }   // the solar level spins its frame so Earth sits where plan.sunPos says
    if (solarInner) helioPivot.rotation.y = solarInner.rotation.y; else if (solo) { if (soloRot === null) soloRot = pickSoloRot(); helioPivot.rotation.y = soloRot; }
    { const hf = solarInner ? 0 : k(13.55, 13.9, z) * (1 - k(14.5, 15.2, z)); helio.visible = termShock.visible = bowWave.visible = hf > 0.001; helio.material.uniforms.uOp.value = 0.62 * hf; termShock.material.uniforms.uOp.value = 0.45 * hf * (1 - k(14.4, 14.9, z)); bowWave.material.uniforms.uOp.value = 0.22 * hf; }
    { const vo = voyMarks.material.uniforms.uOp.value / 0.9; voyIn.uniforms.uColor.value.setRGB(1.0, 0.72, 0.28).multiplyScalar(0.55 * vo); voyOut.uniforms.uColor.value.setRGB(0.55, 0.9, 1.0).multiplyScalar(0.55 * vo); }
    // the veil hides the engine's screen-fixed backdrop flares as soon as the catalogue world starts (they would be the only "stars" inside a 500 AU frame)
    veilMat.uniforms.uOp.value = solo ? 1.0 * k(13.5, 13.95, z) : 0;   // in the full film the galaxy level owns the one backdrop veil (two would add) veilMat.uniforms.uRes.value.copy(U.uRes.value);
    bubble.material.uniforms.uOp.value = 0.42 * k(17.3, 18.1, z) * (1 - k(18.4, 19.1, z));
    nearMarks.material.uniforms.uOp.value = 0.55 * k(16.9, 17.3, z) * (1 - k(17.9, 18.7, z));
    U.uAmpK.value = 1 - 0.3 * k(19.2, 20.6, z); U.uMBoost.value = 4.0 * k(17.6, 18.6, z); U.uHero.value = k(17.6, 18.3, z) * (1 - k(18.9, 19.8, z));
    // camera-aligned vectors for the haze / volume ray-marchers
    qRoot = group.parent ? group.parent.quaternion : qId; qInv.copy(qRoot).invert();
    { const R_ = new T.Vector3(1, 0, 0).applyQuaternion(qInv), U_ = new T.Vector3(0, 1, 0).applyQuaternion(qInv), F_ = new T.Vector3(0, 0, -1).applyQuaternion(qInv);
      const hu = hazeMat.uniforms; hu.uRight.value.copy(R_); hu.uUp.value.copy(U_); hu.uFwd.value.copy(F_); hu.uS.value = c.s;
      hu.uOp.value = 0.95; haze.visible = !hid.has('haze') && z > 13.8 && z < 17.9; hu.uOuter.value = 0.9e-5 * (1 - k(16.9, 17.8, z)); hu.uInner.value = 0.42e-4 * (1 - k(16.6, 17.6, z));
      const vu = volMat.uniforms; vu.uRight.value.copy(R_); vu.uUp.value.copy(U_); vu.uFwd.value.copy(F_); vu.uS.value = c.s;
      const exg = 1 - k(19.7, 20.7, z), half = Math.max(orionHalfTrue, 0.034 * c.W * exg); vu.uHalf.value = half; vu.uMag.value = half / orionHalfTrue; vu.uOp.value = 1.0 * k(18.2, 19.2, z) * k(1.5, 8, half / c.W * innerWidth); orionVol.visible = !hid.has('vol') && vu.uOp.value > 0.01; }
    nebs.forEach((n) => { const hw = n.d.wly * LY / 2, mnF = n.d.id === 'orion' ? 0.009 : 0.005, g = Math.min(40, Math.max(1, mnF * (1 - k(19.7, 20.7, z)) * c.W / hw)), szPx = hw * g / c.W * innerWidth; n.detail.material.uniforms.uHalf.value.set(hw * g, hw * g / n.d.aspect); n.haze.material.uniforms.uHalf.value.set(hw * g * n.d.hz, hw * g * n.d.hz / n.d.aspect); n.detail.material.uniforms.uS.value = c.s; n.haze.material.uniforms.uS.value = c.s; const fo = k(1.2, 7, szPx); n.detail.material.uniforms.uOp.value = 1.1 * fo; n.haze.material.uniforms.uOp.value = n.d.hg * 0.55 * fo * (1 - 0.8 * k(18.8, 19.8, z)); n.detail.visible = n.haze.visible = fo > 0.01; });
    rings.forEach((r) => { const q = r.radius / c.W; const o = r.op * k(0.05, 0.14, q) * (1 - k(1.1, 2.2, q)) * (r.radius >= 1e4 * LY ? 1 - k(20.5, 21.1, z) : r.radius >= 1e3 * LY ? 1 - k(19.7, 20.3, z) : 1) * (solarInner && r.radius < 300 * AU ? k(14.3, 14.8, z) : 1); r.m.visible = o > 0.004;
      if (r.plane) r.m.material.uniforms.uColor.value.copy(r.c).multiplyScalar(o * 0.5); else { r.m.material.uniforms.uColor.value.copy(r.c).multiplyScalar(o * 0.5); r.m.material.uniforms.uS.value = c.s; } });
    layout(z, c);
  }
  const anchorFn = (t) => { const p = plan.sunPos(t); return [p.x, p.y, p.z]; };
  const lv = { group, anchorFn, anchor: anchorFn(0), labels, update, zMin: 13.6, zMax: 21.6 }; return lv;
}
