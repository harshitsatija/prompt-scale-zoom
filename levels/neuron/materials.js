/* materials for the neuron level: kit.toon + (a) signal glow along the signal coordinate aU, (b) a cut-away "ball" around the soma */
import { rngf } from './geo.js';

export function makeMaterials(ctx) {
  const { T, kit } = ctx;
  const G = { uP: { value: Array.from({ length: 6 }, () => new T.Vector3(-1e5, 0, 1)) }, uGK: { value: 1.05 }, uGC: { value: new T.Color(0xff9f1c) },
    uPl: { value: new T.Vector4(0, 0, -1, 0) }, uC: { value: new T.Vector3() }, uR: { value: 0 }, uC2: { value: new T.Vector3() }, uR2: { value: 0 }, uAx: { value: new T.Vector3(1, 0, 0) }, uLen: { value: 8 }, uFlash: { value: 0 }, uWS: { value: 1 }, uSE: { value: new T.Matrix3() } };
  let serial = 0;
  function patch(m, o) {
    const key = 'nrn' + (o.inside ? 'in' : '') + (o.glow ? 'g' : '') + (o.ball ? 'b' : '') + (o.flash ? 'f' : '') + (o.root ? 'R' : '') + (o.mott ? 'm' : '') + (o.inst ? 'i' : '') + (o.rim === false ? '' : 'r') + (o.rimK ? 'k' + o.rimK : '');
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, G); if (o.inside) sh.uniforms.uIn = { value: new T.Color(o.inside) };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aU;\nvarying float vU;\nvarying vec3 vL;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvU = aU;\n#ifdef USE_INSTANCING\nvL = (instanceMatrix * vec4(position, 1.0)).xyz;\n#else\nvL = position;\n#endif\n');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying float vU; varying vec3 vL; uniform vec3 uP[6]; uniform float uGK; uniform vec3 uGC; uniform vec4 uPl; uniform vec3 uC; uniform float uR; uniform vec3 uC2; uniform float uR2; uniform vec3 uAx; uniform float uLen; uniform float uFlash; uniform float uWS; uniform mat3 uSE;
` + (o.mott ? `float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y), mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
` : '') + (o.inside ? 'uniform vec3 uIn;\n' : '') + `float capD(vec3 p){ vec3 d = p - uC2; float t = clamp(dot(d, uAx), -uLen, uLen); return length(d - uAx * t); }
float glowS(float u);
float glowAt(float u){ float a = 0.0; for (int i = 0; i < 6; i++) { vec3 p = uP[i]; if (p.y <= 0.0) continue; float d = u - p.x; float w = max(p.z, 0.05) * uWS; a += p.y * (d > 0.0 ? exp(-d * d / (2.4 * w * w)) : exp(d / (2.6 * w))); } return a; }
float glowS(float u){ return 1.0 - exp(-1.5 * glowAt(u)); }`)
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + (o.root ? 'if (dot(uSE * vL, uSE * vL) < 1.0) discard;\n' : '') + (o.ball ? 'if (uR > 0.0) { float rr_ = length(vL - uC); float sh_ = 9.0 * smoothstep(uR, uR + 6.0, rr_); if (dot(uPl.xyz, vL) + uPl.w < -sh_) discard; } if (uR2 > 0.0 && dot(uPl.xyz, vL) + uPl.w < 0.0 && capD(vL) < uR2) discard;\n' : ''))
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + (o.root ? 'diffuseColor.a *= smoothstep(1.0, 1.4, length(uSE * vL));\n' : '') + (o.mott ? 'diffuseColor.rgb *= 0.9 + 0.2 * vn3(vL * vec3(0.9, 0.9, 0.9)) + 0.07 * (vn3(vL * 3.1 + 7.0) - 0.5);\n' : '') + (o.inside ? 'if (!gl_FrontFacing) diffuseColor.rgb = uIn;\n' : '') + (o.glow ? 'diffuseColor.rgb = mix(diffuseColor.rgb, uGC, glowS(vU) * 0.62);\n' : ''))
        .replace('#include <opaque_fragment>', (o.inside ? 'if (!gl_FrontFacing) { { vec3 nvv = normalize(normal); float ff = clamp(abs(nvv.z), 0.0, 1.0); outgoingLight = mix(uIn * vec3(0.5, 0.4, 0.74), uIn * 1.02, smoothstep(0.05, 0.8, ff)); } ' + (o.glow ? 'outgoingLight = mix(outgoingLight, uGC * 1.15, glowS(vU) * 0.75); ' : '') + '}\n' : '') + '#include <opaque_fragment>')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + (o.glow ? 'totalEmissiveRadiance += uGC * uGK * 0.55 * min(glowAt(vU), 1.25);\n' : '') + (o.flash ? 'totalEmissiveRadiance += uGC * uGK * 0.55 * uFlash;\n' : '') + (o.rim === false ? '' : 'if (gl_FrontFacing) { float rmv = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.4); totalEmissiveRadiance += vec3(0.50, 0.60, 1.0) * smoothstep(0.12, 0.85, rmv) * ' + (o.rimK || 0.34).toFixed(2) + '; }\n'));
    };
    m.customProgramCacheKey = () => key;
    return m;
  }
  // main material factory. o: kit.toon options + {glow, ball, flash, side}
  function mat(color, o = {}) { const m = kit.toon(color, o); return patch(m, { glow: o.sig, ball: o.ball, flash: o.flash, inside: o.inside, rim: o.rim, root: o.root, mott: o.mott, rimK: o.rimK }); }
  // plain kit.toon + the shared rim light (used for the neuropil, boutons, organelles that need no signal glow)
  function toon(color, o = {}) { const m = kit.toon(color, o); return patch(m, { inside: o.inside, rim: o.rim, rimK: o.rimK }); }

  // ---------- procedural textures (canvas) ----------
  const hex = (c) => '#' + c.toString(16).padStart(6, '0');
  function speckle(w, h, base, spots, seed, opt = {}) {
    return kit.canvasTex(w, h, (x) => { const r = rngf(seed); x.fillStyle = base; x.fillRect(0, 0, w, h);
      // soft mottling
      for (let i = 0; i < (opt.blobs || 40); i++) { const g = x.createRadialGradient(0, 0, 0, 0, 0, 1); const px = r() * w, py = r() * h, rad = (opt.blobR || 40) * (0.4 + r()); x.save(); x.translate(px, py); x.scale(rad, rad); const gr = x.createRadialGradient(0, 0, 0, 0, 0, 1); const c = opt.blob ? opt.blob[Math.floor(r() * opt.blob.length)] : 'rgba(255,255,255,0.08)'; gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.beginPath(); x.arc(0, 0, 1, 0, 6.3); x.fill(); x.restore(); }
      for (const sp of spots) for (let i = 0; i < sp.n; i++) { x.fillStyle = sp.c; const px = r() * w, py = r() * h, rad = sp.r * (0.6 + r() * 0.8); for (const ox of [0, -w, w]) for (const oy of [0, -h, h]) { if (px + ox < -rad || px + ox > w + rad || py + oy < -rad || py + oy > h + rad) continue; x.beginPath(); x.arc(px + ox, py + oy, rad, 0, 6.3); x.fill(); } } });
  }
  const tex = {};
  tex.membrane = () => tex._m || (tex._m = (() => { const t = speckle(512, 512, '#ffffff', [{ n: 500, r: 2.2, c: 'rgba(190,200,230,0.28)' }, { n: 120, r: 5, c: 'rgba(255,255,255,0.0)' }], 5, { blobs: 90, blobR: 55, blob: ['rgba(120,130,200,0.16)', 'rgba(255,255,255,0.18)'] }); t.wrapS = t.wrapT = T.RepeatWrapping; return t; })());
  tex.cyto = () => tex._c || (tex._c = (() => { const t = speckle(512, 512, '#ffe6c8', [{ n: 1700, r: 1.6, c: 'rgba(90,80,150,0.55)' }, { n: 800, r: 1.1, c: 'rgba(255,250,235,0.5)' }, { n: 55, r: 5, c: 'rgba(70,64,140,0.35)' }], 7, { blobs: 120, blobR: 70, blob: ['rgba(120,100,180,0.18)', 'rgba(255,230,200,0.2)', 'rgba(120,200,190,0.14)'] }); t.wrapS = t.wrapT = T.RepeatWrapping; return t; })());
  tex.chromatin = () => tex._ch || (tex._ch = (() => { const t = speckle(512, 512, '#a79fec', [{ n: 200, r: 7, c: 'rgba(70,62,170,0.5)' }, { n: 700, r: 1.8, c: 'rgba(50,44,140,0.45)' }, { n: 500, r: 2.4, c: 'rgba(200,196,255,0.4)' }], 11, { blobs: 70, blobR: 60, blob: ['rgba(60,50,150,0.35)', 'rgba(200,190,255,0.25)'] }); t.wrapS = t.wrapT = T.RepeatWrapping; return t; })());
  tex.envelope = () => tex._e || (tex._e = (() => { const t = speckle(512, 256, '#a8a0f0', [{ n: 420, r: 3.3, c: 'rgba(30,26,100,0.8)' }, { n: 420, r: 1.4, c: 'rgba(220,216,255,0.9)' }], 13, { blobs: 30, blobR: 50 }); t.wrapS = t.wrapT = T.RepeatWrapping; return t; })());
  tex.cristae = () => tex._cr || (tex._cr = (() => { const t = kit.canvasTex(64, 256, (x, w, h) => { x.fillStyle = '#ffd6a8'; x.fillRect(0, 0, w, h); const r = rngf(4); for (let i = 0; i < 4; i++) { const py = (i + 0.5) / 4 * h; const g = x.createLinearGradient(0, py - 16, 0, py + 16); g.addColorStop(0, 'rgba(176,96,60,0)'); g.addColorStop(0.5, 'rgba(176,96,70,0.62)'); g.addColorStop(1, 'rgba(176,96,60,0)'); x.fillStyle = g; x.fillRect(w * (0.05 + 0.25 * r()), py - 16, w * 0.9, 32); } x.fillStyle = 'rgba(255,240,205,0.5)'; for (let i = 0; i < 50; i++) x.fillRect(r() * w, r() * h, 2, 2); }); t.wrapS = t.wrapT = T.RepeatWrapping; return t; })());
  tex.er = () => tex._er || (tex._er = (() => { const t = speckle(256, 256, '#52c4b4', [{ n: 260, r: 3.4, c: 'rgba(230,255,248,0.85)' }, { n: 120, r: 2.0, c: 'rgba(20,90,90,0.45)' }], 17, { blobs: 20, blobR: 60, blob: ['rgba(255,255,255,0.12)', 'rgba(20,120,120,0.15)'] }); t.wrapS = t.wrapT = T.RepeatWrapping; return t; })());
  tex.fibres = () => tex._fb || (tex._fb = (() => { const t = kit.canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); const r = rngf(31); for (let i = 0; i < 26; i++) { const px = r() * w; x.fillStyle = 'rgba(150,100,110,' + (0.01 + 0.02 * r()).toFixed(3) + ')'; x.fillRect(px, 0, 1 + r() * 2.2, h); } for (let i = 0; i < 160; i++) { x.fillStyle = 'rgba(255,255,255,0.16)'; x.fillRect(r() * w, r() * h, 1.4, 3 + r() * 6); } }); t.wrapS = t.wrapT = T.RepeatWrapping; return t; })());
  tex.myelin = () => tex._my || (tex._my = (() => { const t = kit.canvasTex(32, 256, (x, w, h) => { x.fillStyle = '#fff3d6'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(190,150,110,0.55)'; for (let i = 0; i < 20; i++) x.fillRect(0, (i + 0.5) / 20 * h - 1.5, w, 3); }); t.wrapS = t.wrapT = T.RepeatWrapping; return t; })());
  tex.myelinWrap = () => tex._mw || (tex._mw = (() => { const t = kit.canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.lineCap = 'round'; for (let k = -1; k <= 1; k++) for (let j = 0; j < 4; j++) { const oy = j * h / 4; x.strokeStyle = 'rgba(176,138,110,0.30)'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(0, oy + k * h); x.lineTo(w, oy + h * 0.25 * 0.0 + k * h + h * 0.5); x.stroke(); x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(0, oy + 6 + k * h); x.lineTo(w, oy + 6 + k * h + h * 0.5); x.stroke(); } }); t.wrapS = t.wrapT = T.RepeatWrapping; return t; })());
  tex.lipo = () => tex._li || (tex._li = speckle(128, 128, '#8a5a2e', [{ n: 220, r: 2.2, c: 'rgba(255,196,110,0.8)' }, { n: 120, r: 3, c: 'rgba(60,30,10,0.7)' }], 23, {}));
  return { G, mat, toon, tex, hex };
}
