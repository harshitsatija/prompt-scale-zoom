/* PROMPT 3D — one continuous world. A single toon-shaded 3D scene holds a molecule inside a synapse inside a neuron inside
 * a brain inside a person inside a room inside a building inside Bangalore on a planet in a galaxy. The camera never cuts:
 * it flies one path. z = log10(field width in metres). Nothing is cross-faded; scale does all the work. */
import * as kit from './kit.js';
import * as timeline from './timeline.js';
import * as geom from './geom.js';
import * as plan from './plan.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const { T, C, cut, inkU, ss, lerp, clamp } = kit, { state } = timeline, { FOCUS, STAGES, pitchAt, yawAt, LEVELS, shared } = plan;

const q = new URLSearchParams(location.search);
const ZMIN = -8.9, ZMAX = 27.6, ZSPAN = ZMAX - ZMIN, K = 16, FOV = q.has('fov') ? Number(q.get('fov')) : 14;
const $ = (id) => document.getElementById(id);
const canvas = $('c');
const renderer = new T.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: q.has('keep'), powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 0); renderer.localClippingEnabled = true;
const scene = new T.Scene(); scene.background = null; scene.fog = new T.Fog(0x241f66, 14, 64);
const camera = new T.PerspectiveCamera(FOV, 1.6, 0.4, 4e5); camera.position.set(0, 0, K);
const root = new T.Group(); scene.add(root);
// one light rig, fixed to the camera, so the lighting is identical at every scale
const key = new T.DirectionalLight(0xfff0d0, 2.6); key.position.set(-0.6, 0.9, 0.7); scene.add(key);
scene.add(new T.HemisphereLight(0x8d96f0, 0x1a2a50, 1.5));
const rim = new T.DirectionalLight(0x7fe3c4, 0.6); rim.position.set(0.8, 0.2, -0.6); scene.add(rim);

let Wpx = 0, Hpx = 0, HUDH = 96, rt = null, post = null, dpr = 1, rb1 = null, rb2 = null;
const bloomMat = (vert) => new T.ShaderMaterial({ uniforms: { tIn: { value: null }, uRes: { value: new T.Vector2() }, uThr: { value: vert ? 0 : 1 } }, depthTest: false, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: `uniform sampler2D tIn; uniform vec2 uRes; uniform float uThr; varying vec2 vUv;
vec3 tap(vec2 uv){ vec3 s = texture2D(tIn, uv).rgb; if (uThr > 0.5) { float l = dot(s, vec3(0.299, 0.587, 0.114)); s *= smoothstep(1.0, 1.6, l); } return s; }
void main(){ vec2 d = ${vert ? 'vec2(0.0, 1.0)' : 'vec2(1.0, 0.0)'} / uRes; vec3 a = vec3(0.0); float w[7]; w[0]=0.2270; w[1]=0.1946; w[2]=0.1216; w[3]=0.0540; w[4]=0.0162; w[5]=0.0050; w[6]=0.0012; a += tap(vUv) * w[0]; for (int i = 1; i < 7; i++) { float k = float(i) * 2.2; a += tap(vUv + d * k) * w[i]; a += tap(vUv - d * k) * w[i]; } gl_FragColor = vec4(a, 1.0); }` });
const bloomH = bloomMat(false), bloomV = bloomMat(true); bloomH.uniforms.uThr.value = 1; bloomV.uniforms.uThr.value = 0;
const bq = new T.Mesh(new T.PlaneGeometry(2, 2), bloomH); bq.frustumCulled = false; const bScene = new T.Scene(); bScene.add(bq);
const postMat = new T.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, tBloom: { value: null }, uRes: { value: new T.Vector2() }, uTime: { value: 0 }, uSpace: { value: 1 } }, depthTest: false, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: `
uniform sampler2D tDiffuse; uniform sampler2D tBloom; uniform vec2 uRes; uniform float uTime; uniform float uSpace; varying vec2 vUv;
float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
void main(){
  vec4 src = texture2D(tDiffuse, vUv); vec2 px = 1.0 / uRes; vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  // the backdrop: a deep violet well, soft nebula wash, and drifting star flares; the same at every scale
  vec2 qq = (vUv - vec2(0.5, 0.55)) * asp; float rr = length(qq);
  vec3 bg = mix(vec3(0.115, 0.095, 0.30), vec3(0.035, 0.03, 0.115), smoothstep(0.0, 0.95, rr));
  bg += vec3(0.30, 0.10, 0.34) * 0.22 * exp(-pow(length(qq - vec2(0.42, 0.18)) * 2.1, 2.0)) + vec3(0.06, 0.30, 0.36) * 0.20 * exp(-pow(length(qq + vec2(0.45, 0.2)) * 2.4, 2.0));
  for (int L = 0; L < 3; L++) { float sc = 14.0 + float(L) * 17.0; vec2 g2 = (vUv * asp + vec2(uTime * 0.004 * float(L + 1), 0.0)) * sc; vec2 id = floor(g2), f = fract(g2) - 0.5; float h = fract(sin(dot(id, vec2(127.1, 311.7)) + float(L) * 7.0) * 43758.5453);
    if (h > 0.93) { vec2 o = (vec2(fract(h * 91.7), fract(h * 53.3)) - 0.5) * 0.5; float d = length(f - o); float tw = 0.7 + 0.3 * sin(uTime * (1.0 + h * 3.0) + h * 40.0); float core = smoothstep(0.07 + 0.03 * float(L), 0.0, d), flare = smoothstep(0.012, 0.0, min(abs(f.x - o.x), abs(f.y - o.y))) * smoothstep(0.42, 0.0, d);
      vec3 sc3 = h > 0.96 ? vec3(1.0, 0.72, 0.45) : (h > 0.91 ? vec3(0.55, 0.85, 1.0) : vec3(0.9, 0.88, 1.0)); bg += sc3 * (core + flare * 0.15) * tw * (0.22 + 0.12 * float(L)) * uSpace * 0.7; } }
  bg = pow(bg, vec3(2.2)); vec3 c = mix(bg, src.rgb, src.a);
  vec3 bl = texture2D(tBloom, vUv).rgb; c += bl * vec3(1.0, 0.86, 0.72) * 0.38;
  // a gentle depth-of-colour: the far dark lifts toward violet at the edges, never to black
  vec2 q = vUv - 0.5; float vg = dot(q, q); c = mix(c, c * vec3(0.78, 0.74, 0.95), vg * 1.2);
  c = pow(c, vec3(0.96));
  gl_FragColor = linearToOutputTexel(vec4(c, 1.0)); }` });
const postQuad = new T.Mesh(new T.PlaneGeometry(2, 2), postMat); postQuad.frustumCulled = false; const postScene = new T.Scene(); postScene.add(postQuad); const postCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);

function resize() {
  HUDH = innerWidth < 681 ? 118 : 96; dpr = q.has('dpr') ? Number(q.get('dpr')) : Math.min(2, window.devicePixelRatio || 1); Wpx = innerWidth; Hpx = innerHeight;
  renderer.setPixelRatio(dpr); renderer.setSize(Wpx, Hpx, false); camera.aspect = Wpx / Hpx; camera.setViewOffset(Wpx, Hpx, 0, HUDH * 0.5, Wpx, Hpx); camera.updateProjectionMatrix();
  if (rt) rt.dispose(); rt = new T.WebGLRenderTarget(Math.round(Wpx * dpr), Math.round(Hpx * dpr), { samples: 4, type: T.HalfFloatType, stencilBuffer: true });
  if (rb1) { rb1.dispose(); rb2.dispose(); } { const bw = Math.max(2, Math.round(Wpx * dpr / 4)), bh = Math.max(2, Math.round(Hpx * dpr / 4)); rb1 = new T.WebGLRenderTarget(bw, bh, { type: T.HalfFloatType }); rb2 = new T.WebGLRenderTarget(bw, bh, { type: T.HalfFloatType }); bloomH.uniforms.uRes.value.set(bw, bh); bloomV.uniforms.uRes.value.set(bw, bh); }
  postMat.uniforms.uRes.value.set(Wpx * dpr, Hpx * dpr); inkU.uRes.value.set(Wpx * dpr, Hpx * dpr); inkU.uThick.value = 2.2 * dpr;
}

// ---------------- the world ----------------
// every level is an ES module in ./levels/<id>.js exporting `default async function build(ctx)` -> { group, anchor|anchorFn, zMin?, zMax?, labels, update }
const draco = new DRACOLoader().setDecoderPath('./vendor/draco/'); const gltfLoader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
const ctx = { T, kit, timeline, geom, plan, shared, params: q, assetURL: (p) => './assets/' + p, loadGLB: (p) => gltfLoader.loadAsync('./assets/' + p), fetchJSON: (p) => fetch('./assets/' + p).then((r) => r.json()), fetchBuf: (p) => fetch('./assets/' + p).then((r) => r.arrayBuffer()), log: (...a) => console.log('[level]', ...a) };
const only = q.get('only') ? q.get('only').split(',') : null;
const levels = [], labels = [];
async function loadLevels() {
  const order = ['brain'], rest = LEVELS.filter((l) => !order.includes(l.id)).map((l) => l.id); const load = async (id) => { const meta = LEVELS.find((l) => l.id === id); if (only && !only.includes(id)) return null;
    try { const mod = await import('../levels/' + id + '.js'); const lv = await mod.default(ctx); lv.id = id; lv.zMin = lv.zMin ?? meta.zMin; lv.zMax = lv.zMax ?? meta.zMax; lv.group.userData.levelId = id; lv.fade = { value: 0, inv: { value: 0 } }; if (window.__prog) window.__prog.level(id); return lv; } catch (err) { if (window.__prog) window.__prog.level(id); console.error('LEVEL_FAIL ' + id + ': ' + (err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err)); return null; } };
  const loaded = {}; for (const id of order) loaded[id] = await load(id); const others = await Promise.all(rest.map(async (id) => [id, await load(id)])); others.forEach(([id, lv]) => { loaded[id] = lv; });
  LEVELS.forEach((m) => { const lv = loaded[m.id]; if (lv) { levels.push(lv); root.add(lv.group); (lv.labels || []).forEach((l) => labels.push(Object.assign({ level: lv }, l))); } });
}
$('c').dataset.loading = '1'; await loadLevels(); $('c').dataset.loading = '0'; if (window.__prog) window.__prog.done(); window.__levels = levels.map((l) => l.id); window.__LV = levels;
const labelEls = labels.map((l) => { const d = document.createElement('div'); d.className = 'tag3'; d.innerHTML = '<i></i><span>' + l.text + '</span>'; $('tags').appendChild(d); return d; });
// ---------------- nested scales ----------------
// Every level owns a ball of real space centred on its anchor, as wide as the field it was built for. The balls are projected to the screen and
// written into the stencil buffer, outermost first, so each pixel carries the depth of the innermost ball covering it. A level only draws where the
// stencil equals its own depth. Detail therefore lives inside its physical region and the coarser scale is cut away there; zooming grows the region
// until it fills the screen. Nothing is ever faded.
// true physical radius (m) of the space each level fills
const NEST_R = { molecule: 2.5e-8, synapse: 1.5e-6, neuron: 2.5e-4, cortex: 3e-3, brain: 0.12, person: 4.5, building: 500, city: 1e5, earth: 4.2e8, solar: 2.5e13, stars: 5e19, galaxy: 2e23 };
const NEST_HOLD = {}; // levels fade their own content near zMax; hold them this far below it so a small nested region stays fully formed
const NEST_K = 0.62, nestDepth = (l) => levels.length - 1 - levels.indexOf(l);
const portalGeo = new T.BufferGeometry(); portalGeo.setAttribute('position', new T.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
const portalVS = 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }';
function makePortal(l, d) {
  const u = { uC: { value: new T.Vector2() }, uR: { value: 0 } };
  const m = new T.ShaderMaterial({ uniforms: u, vertexShader: portalVS, fragmentShader: 'uniform vec2 uC; uniform float uR; void main(){ if (distance(gl_FragCoord.xy, uC) > uR) discard; gl_FragColor = vec4(0.0); }', colorWrite: false, depthTest: false, depthWrite: false });
  m.stencilWrite = true; m.stencilFunc = T.AlwaysStencilFunc; m.stencilRef = d; m.stencilFail = m.stencilZFail = m.stencilZPass = T.ReplaceStencilOp;
  const mesh = new T.Mesh(portalGeo, m); mesh.frustumCulled = false; mesh.renderOrder = -1e6 + d; mesh.visible = false; scene.add(mesh); l.portal = mesh;
  const rm = new T.ShaderMaterial({ uniforms: { uC: u.uC, uR: u.uR, uPx: { value: 1 }, uA: { value: 0 } }, vertexShader: portalVS, fragmentShader: 'uniform vec2 uC; uniform float uR, uPx, uA; void main(){ float e = abs(distance(gl_FragCoord.xy, uC) - uR); float a = (1.0 - smoothstep(0.5 * uPx, 1.6 * uPx, e)) * uA; if (a < 0.003) discard; gl_FragColor = vec4(1.0, 0.953, 0.84, a); }', transparent: true, depthTest: false, depthWrite: false });
  const ring = new T.Mesh(portalGeo, rm); ring.frustumCulled = false; ring.renderOrder = 1e6 + d; ring.visible = false; scene.add(ring); l.ring = ring;
}
function applyNest(l, d) {
  l.group.traverse((o) => { const ms = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    ms.forEach((m) => { if (!m || m.userData._nest === d) return; if (m.userData._nest !== undefined && !m.userData._nestWarned) { m.userData._nestWarned = 1; console.warn('NEST shared material across levels', l.id); }
      m.userData._nest = d; m.stencilWrite = true; m.stencilFunc = T.EqualStencilFunc; m.stencilRef = d; m.stencilFuncMask = 0xff; m.stencilWriteMask = 0; m.stencilFail = m.stencilZFail = m.stencilZPass = T.KeepStencilOp; }); }); }
levels.forEach((l) => { l.nestDepth = nestDepth(l); l.fade = { value: 1 }; });
const nv = new T.Vector3(), ndc = new T.Vector3();
function nestInfo(c) {
  const Wd = Wpx * dpr, Hd = Hpx * dpr, P11 = camera.projectionMatrix.elements[5], info = [];
  levels.forEach((l) => { const d = l.nestDepth; let cx = Wd / 2, cy = Hd / 2, r = 1e7, behind = false;
    if (d > 0) { const R = (l.nestR ?? NEST_R[l.id] ?? NEST_K * Math.pow(10, l.zMax)) * c.s; nv.copy(l.group.position).applyQuaternion(Rq).multiplyScalar(c.s).applyMatrix4(camera.matrixWorldInverse); const dist = nv.length();
      if (dist > R) { if (nv.z > 0) behind = true; else { ndc.copy(nv).applyMatrix4(camera.projectionMatrix); cx = (ndc.x * 0.5 + 0.5) * Wd; cy = (ndc.y * 0.5 + 0.5) * Hd; r = Math.min(1e7, P11 * (Hd / 2) * R / Math.sqrt(dist * dist - R * R)); } } }
    const dx = Math.max(0, Math.abs(cx - Wd / 2) - Wd / 2), dy = Math.max(0, Math.abs(cy - Hd / 2) - Hd / 2), far = Math.hypot(Math.abs(cx - Wd / 2) + Wd / 2, Math.abs(cy - Hd / 2) + Hd / 2);
    info.push({ l, d, cx, cy, r, hit: d === 0 || (!behind && r >= 0.75 && Math.hypot(dx, dy) <= r), cover: d > 0 && !behind && far <= r }); });
  info.forEach((a) => { a.hidden = !a.hit || info.some((o) => o.d > a.d && o.cover); }); return info; }
const worldUpdate = (t, S, zz, c) => {
  const done = new Set();
  const run = (l) => { done.add(l); l._nf = (l._nf || 0) + 1; 
    if (l.update) { const zc = clamp(zz, l.zMin, l.zMax - (NEST_HOLD[l.id] ?? 0.9)); let cv = c; if (zc !== zz) { const a = l.anchorFn ? l.anchorFn(t) : (l.anchor || [0, 0, 0]), Wv = Math.pow(10, zc); cv = Object.assign({}, c, { z: zc, W: Wv, s: c.Wu / Wv, F: { x: a[0], y: a[1], z: a[2] } }); } l.update(t, S, zc, cv); } };
  nestInfo(c).forEach((a) => { if (!a.hidden) { a.l.group.visible = true; run(a.l); } });
  nestInfo(c).forEach((a) => { const l = a.l; l.group.visible = !a.hidden; l._disc = a; if (!a.hidden && !done.has(l)) run(l);
  }); };

const stages = STAGES;
const stageAt = (z) => { let ix = 0; stages.forEach((s, i) => { if (z >= s.z - 0.45) ix = i; }); return stages[ix]; };
function fmt(m) { const a = Math.abs(m); if (a < 1e-9) return (m * 1e12).toFixed(0) + ' pm'; if (a < 1e-6) return (m * 1e9).toFixed(a < 1e-8 ? 1 : 0) + ' nm'; if (a < 1e-3) return (m * 1e6).toFixed(a < 1e-5 ? 1 : 0) + ' µm'; if (a < 1e-2) return (m * 1e3).toFixed(a < 5e-3 ? 1 : 0) + ' mm'; if (a < 1) return (m * 100).toFixed(a < 0.1 ? 1 : 0) + ' cm'; if (a < 1000) return (a < 10 ? m.toFixed(1) : Math.round(m)) + ' m';
  const km = m / 1000, cm = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); if (km >= 1e6 && a < 1e11) return (km / 1e6 < 10 ? (km / 1e6).toFixed(1) : Math.round(km / 1e6)) + ' million km'; if (a < 1e11) return (km < 10 ? km.toFixed(1) : cm(km)) + ' km'; const au = m / 1.496e11; if (a < 9.46e15) return (au < 10 ? au.toFixed(1) : cm(au)) + ' AU'; const ly = m / 9.461e15;
  if (ly < 1000) return (ly < 10 ? ly.toFixed(1) : Math.round(ly)) + ' light-year'; if (ly < 1e6) return Math.round(ly / 1e3) + ' thousand ly'; if (ly < 1e9) return Math.round(ly / 1e6) + ' million ly'; return (ly / 1e9).toFixed(1) + ' billion ly'; }

// ---------------- the camera path ----------------
const Rq = new T.Quaternion(), tmpV = new T.Vector3(), tmpE = new T.Euler();
function rig(z, t) {
  const W = Math.pow(10, z), F = FOCUS(z, t), pitch = pitchAt(z), yaw = yawAt(z, t), pit2 = Math.sin(t * 0.17 + 1) * 0.03 * (1 - ss(5.5, 7.5, z));
  const qc = new T.Quaternion().setFromEuler(tmpE.set(-(pitch + pit2), yaw, 0, 'YXZ')); Rq.copy(qc).invert();
  const Wu = 2 * K * Math.tan(FOV * Math.PI / 360) * camera.aspect, s = Wu / W;
  // floating origin: the focus is always (0,0,0); every level is shifted by (anchor - focus) in double precision
  root.scale.setScalar(s); root.quaternion.copy(Rq); root.position.set(0, 0, 0); root.updateMatrixWorld(true);
  levels.forEach((l) => { const a = l.anchorFn ? l.anchorFn(t) : (l.anchor || [0, 0, 0]); l.group.position.set(a[0] - F.x, a[1] - F.y, a[2] - F.z); });
  const nW = new T.Vector3(0, 0, -1).applyQuaternion(Rq); cut.A.setFromNormalAndCoplanarPoint(nW, new T.Vector3(0, 0, 0));
  const peel = ss(0.35, 1.1, z) * 0.35, pH = new T.Vector3(0, 0, peel).applyQuaternion(Rq).multiplyScalar(s); cut.head.setFromNormalAndCoplanarPoint(nW, pH);
  return { W, s, Wu, F, pitch, z };
}

// ---------------- controls ----------------
let z = q.has('z') ? clamp(Number(q.get('z')), ZMIN, ZMAX) : 0.15, zt = z, auto = 0, frozen = q.has('freeze'), tLive = q.has('t') ? Number(q.get('t')) || 0 : 0, last = performance.now(), frames = 0, dirty = true;
const stop = () => { auto = 0; $('in').setAttribute('aria-pressed', 'false'); $('out').setAttribute('aria-pressed', 'false'); };
const go = (dir) => { if (auto === dir) { stop(); return; } stop(); auto = dir; zt = z; $(dir < 0 ? 'in' : 'out').setAttribute('aria-pressed', 'true'); };
const moveTo = (v) => { stop(); zt = clamp(v, ZMIN, ZMAX); };
$('in').addEventListener('click', (e) => { e.currentTarget.blur(); go(-1); }); $('out').addEventListener('click', (e) => { e.currentTarget.blur(); go(1); });
addEventListener('wheel', (e) => { if (e.ctrlKey || e.metaKey || (e.target.closest && e.target.closest('dialog,input'))) return; e.preventDefault(); stop(); zt = clamp(zt + e.deltaY * (e.deltaMode === 1 ? 16 : 1) * 0.0045, ZMIN, ZMAX); }, { passive: false });
addEventListener('keydown', (e) => { if (e.target.closest && e.target.closest('input,button,dialog')) return; const k = e.key;
  if (e.code === 'Space') { e.preventDefault(); if (auto) stop(); else go(1); } else if (['ArrowRight', 'ArrowUp', '+', '='].includes(k)) { e.preventDefault(); moveTo(zt + 0.25); } else if (['ArrowLeft', 'ArrowDown', '-', '_'].includes(k)) { e.preventDefault(); moveTo(zt - 0.25); }
  else if (k === 'Home') { e.preventDefault(); moveTo(ZMIN); } else if (k === 'End') { e.preventDefault(); moveTo(ZMAX); } else if (k === 'PageUp' || k === 'PageDown') { e.preventDefault(); const nx = k === 'PageUp' ? stages.filter((s) => s.z > zt + 0.05)[0] : stages.slice().reverse().filter((s) => s.z < zt - 0.05)[0]; if (nx) moveTo(nx.z); } });
$('progress').addEventListener('input', (e) => moveTo(ZMIN + Number(e.target.value) / 1000 * ZSPAN));
stages.forEach((s) => { const b = document.createElement('button'); b.className = 'stop'; b.type = 'button'; b.style.left = (s.z - ZMIN) / ZSPAN * 100 + '%'; b.title = s.title; b.setAttribute('aria-label', s.title); b.addEventListener('click', () => moveTo(s.z)); $('stops').appendChild(b); });
let drag = null; canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); drag = { y: e.clientY, z: z }; stop(); }); canvas.addEventListener('pointermove', (e) => { if (drag) zt = clamp(drag.z + (e.clientY - drag.y) * 0.02, ZMIN, ZMAX); }); ['pointerup', 'pointercancel'].forEach((t) => canvas.addEventListener(t, () => { drag = null; }));
const dlg = $('notes'); $('notes-open').addEventListener('click', () => { stop(); dlg.showModal(); }); dlg.querySelector('.close').addEventListener('click', () => dlg.close()); dlg.addEventListener('click', (e) => { if (e.target === dlg) { const r = dlg.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close(); } });
addEventListener('resize', () => { resize(); dirty = true; });

const lastHud = {}; const setText = (id, v) => { if (lastHud[id] !== v) { $(id).textContent = v; lastHud[id] = v; } };
function hud(c, t) {
  const st = stageAt(c.z); setText('subj', st.title.toUpperCase() + ' · ' + fmt(c.W) + ' across'); setText('story', st.line); $('progress').value = Math.round((c.z - ZMIN) / ZSPAN * 1000);
  const zz = c.z; const rate = zz < -3.2 ? 'signal time · illustrative' : zz < 2.8 ? 'live · keystrokes drive the signals' : zz < 5.5 ? 'local night' : zz < 8.5 ? 'it is night where she sits' : zz < 14 ? 'orbits · accelerated' : 'frozen · stars barely move';
  const secs = 23 * 3600 + 2 * 60 + Math.floor(t), h = Math.floor(secs / 3600) % 24, m = Math.floor(secs / 60) % 60, s = secs % 60; setText('rate', rate); setText('time', (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + ' IST');
}
const tv = new T.Vector3();
const MAXL = 2;
function updateLabels(c) {
  const cand = [], cx = Wpx / 2, cy = (Hpx - HUDH) / 2;
  labels.forEach((l, i) => { const el = labelEls[i]; el.style.display = 'none';
    if (q.has('nolabels') || c.z < l.z0 || c.z > l.z1 || !l.level.group.visible) return;
    tv.copy(l.pos()).add(l.level.group.position).applyQuaternion(Rq).multiplyScalar(c.s); tv.applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix); if (tv.z > 1 || tv.z < -1) return;
    const x = (tv.x * 0.5 + 0.5) * Wpx, y = (-tv.y * 0.5 + 0.5) * Hpx; if (x < 60 || x > Wpx - 60 || y < 70 || y > Hpx - HUDH - 24) return; const dd = l.level._disc; if (dd && dd.d > 0 && Math.hypot(x * dpr - dd.cx, (Hpx - y) * dpr - dd.cy) > dd.r * 0.97) return;
    const a = Math.min(ss(l.z0, l.z0 + 0.5, c.z), 1 - ss(l.z1 - 0.5, l.z1, c.z)) * 1; cand.push({ el, l, x, y, a, d: Math.hypot(x - cx, y - cy) }); });
  cand.sort((p, r) => p.d - r.d); const shown = [];
  for (const k of cand) { if (shown.length >= (q.has('labels') ? 12 : MAXL)) break; if (shown.some((s) => Math.abs(s.x - k.x) < 190 && Math.abs(s.y - k.y) < 26)) continue; shown.push(k);
    k.el.style.display = 'block'; k.el.style.opacity = (k.a * 0.95).toFixed(2); k.el.style.transform = 'translate(' + k.x.toFixed(0) + 'px,' + k.y.toFixed(0) + 'px)'; k.el.className = 'tag3' + (k.l.right ? ' r' : ''); }
}
function render() {
  const t0 = performance.now(), S = state(tLive), c = rig(z, tLive); camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  worldUpdate(tLive, S, z, c); if (q.has('hide')) { const hs = q.get('hide').split(','); root.traverse((o) => { if (o.userData.name && hs.includes(o.userData.name)) o.visible = false; }); } scene.fog.near = 14; scene.fog.far = lerp(64, 230, ss(1.0, 3, z)) ; inkU.uFog.value.set(scene.fog.near, scene.fog.far);
  renderer.setRenderTarget(rt); renderer.autoClear = false; renderer.clear(true, true, true);
  { const ord = levels.filter((l) => l.group.visible).sort((p, r) => p.nestDepth - r.nestDepth), all = levels.map((l) => l.group.visible);
    ord.forEach((l) => { levels.forEach((o) => { o.group.visible = o === l; }); renderer.clearDepth(); renderer.render(scene, camera); });
    levels.forEach((o, k) => { o.group.visible = all[k]; }); renderer.autoClear = true; }
  bq.material = bloomH; bloomH.uniforms.tIn.value = rt.texture; renderer.setRenderTarget(rb1); renderer.render(bScene, postCam); bq.material = bloomV; bloomV.uniforms.tIn.value = rb1.texture; renderer.setRenderTarget(rb2); renderer.render(bScene, postCam); bloomH.uniforms.tIn.value = rb2.texture; bq.material = bloomH; bloomH.uniforms.uThr.value = 0; renderer.setRenderTarget(rb1); renderer.render(bScene, postCam); bloomH.uniforms.uThr.value = 1;
  renderer.setRenderTarget(null); postMat.uniforms.tDiffuse.value = rt.texture; postMat.uniforms.tBloom.value = rb1.texture; postMat.uniforms.uSpace.value = ss(5.2, 7.4, z); postMat.uniforms.uTime.value = tLive; renderer.render(postScene, postCam);
  hud(c, tLive); updateLabels(c); frames++; window.__ready = true; canvas.dataset.frames = String(frames); canvas.dataset.ms = (performance.now() - t0).toFixed(1);
}
function advance(dt) {
  if (!frozen) tLive += dt;
  if (auto) { let near = 1; stages.forEach((s) => { near = Math.min(near, 0.62 + 0.38 * ss(0.0, 0.9, Math.abs(zt - s.z))); }); zt = clamp(zt + auto * dt * 0.75 * near, ZMIN, ZMAX); if (zt <= ZMIN || zt >= ZMAX) stop(); z = zt; }
  else if (Math.abs(zt - z) > 1e-5) { z += (zt - z) * (1 - Math.exp(-dt * 8)); if (Math.abs(zt - z) < 1e-4) z = zt; }
}
function tick(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (!document.hidden) advance(dt); if (!frozen || auto || dirty || Math.abs(zt - z) > 1e-5) { render(); dirty = false; } requestAnimationFrame(tick); }
window.__PROMPT = { vis() { return levels.filter((l) => l.group.visible).map((l) => l.id).join(','); }, advance(s) { for (let k = 0; k < s / 0.05; k++) advance(0.05); render(); dirty = false; return z; }, at(zz, tt) { stop(); frozen = true; z = zt = clamp(zz, ZMIN, ZMAX); if (tt !== undefined) tLive = tt; render(); return z; }, stages };
resize(); render(); requestAnimationFrame(tick);
if (q.has('go')) go(Number(q.get('go')) < 0 ? -1 : 1); if (q.has('adv')) window.__PROMPT.advance(Number(q.get('adv')));
