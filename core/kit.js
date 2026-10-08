/* PROMPT 3D — the shared look. One toon ramp, one palette, one ink line, one paper. Every level in the world is
 * built from these, so the style cannot change as the camera passes from a molecule to the universe. */
import * as T from '../vendor/three.module.js';
export { T };
// overflow-safe normals: at 1e-21 or 1e+9 world scales, normal vectors exceed float32 range before they are normalised
T.ShaderChunk.gradientmap_pars_fragment = `
#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).rgb );
	#else
		return ( coord.x < 0.7 ) ? vec3( 0.7 ) : vec3( 1.0 );
	#endif
}
`;
T.ShaderChunk.defaultnormal_vertex = `
vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	vec3 ia = max( vec3( 1e-30 ), vec3( max( max( abs( im[ 0 ].x ), abs( im[ 0 ].y ) ), abs( im[ 0 ].z ) ), max( max( abs( im[ 1 ].x ), abs( im[ 1 ].y ) ), abs( im[ 1 ].z ) ), max( max( abs( im[ 2 ].x ), abs( im[ 2 ].y ) ), abs( im[ 2 ].z ) ) ) );
	transformedNormal = ( im[ 0 ] / ia.x ) * ( transformedNormal.x / length( im[ 0 ] / ia.x ) ) + ( im[ 1 ] / ia.y ) * ( transformedNormal.y / length( im[ 1 ] / ia.y ) ) + ( im[ 2 ] / ia.z ) * ( transformedNormal.z / length( im[ 2 ] / ia.z ) );
	transformedNormal /= max( max( abs( transformedNormal.x ), abs( transformedNormal.y ) ), max( abs( transformedNormal.z ), 1e-30 ) );
#endif
transformedNormal = normalMatrix * transformedNormal;
transformedNormal /= max( max( abs( transformedNormal.x ), abs( transformedNormal.y ) ), max( abs( transformedNormal.z ), 1e-30 ) );
transformedNormal = normalize( transformedNormal );
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#ifdef FLIP_SIDED
	transformedTangent = - transformedTangent;
#endif
#endif
`;
export const C = { INK: 0x0b0d2e, SKYD: 0x06071a, DEEP: 0x1c1f6b, DEEP2: 0x2c3399, FAINT: 0x3a3fb5, PERI: 0x5b63e0, PERIL: 0xa9b0ff, PAPER: 0xfff3d6, PAPERD: 0xcdbd92,
  TEALD: 0x0a4743, TEAL: 0x12a595, TEALL: 0x7fe3c4, AMBERD: 0xb4530b, AMBER: 0xff9f1c, AMBERL: 0xffd166, CLAYD: 0x7a4a2e, CLAY: 0xc98b5e, CLAYL: 0xe8b88e };
// the toon ramp: four hard steps
const ramp = new T.DataTexture(new Uint8Array([88, 82, 150, 255, 150, 140, 205, 255, 235, 226, 245, 255, 255, 250, 236, 255]), 4, 1, T.RGBAFormat);
ramp.minFilter = ramp.magFilter = T.NearestFilter; ramp.needsUpdate = true;
export const cut = { A: new T.Plane(new T.Vector3(0, 0, -1), 0), head: new T.Plane(new T.Vector3(0, 0, -1), 0) }; // clip everything with z > plane
export const inkU = { uThick: { value: 2.4 }, uRes: { value: new T.Vector2(1280, 800) }, uColor: { value: new T.Color(C.INK) }, uFog: { value: new T.Vector2(14, 64) }, uFogColor: { value: new T.Color(C.DEEP) } };
export function toon(color, o = {}) {
  const m = new T.MeshToonMaterial({ color, gradientMap: ramp, side: o.side || T.FrontSide, transparent: !!o.opacity || !!o.alphaMap, opacity: o.opacity === undefined ? 1 : o.opacity, vertexColors: !!o.vc, map: o.map || null, normalMap: o.normalMap || null, alphaMap: o.alphaMap || null, emissiveMap: o.emissiveMap || null, alphaTest: o.alphaTest || 0 });
  if (o.glow) { m.emissive = new T.Color(o.glow === true ? color : o.glow); m.emissiveIntensity = o.glowK || 0.9; }
  if (o.cut) m.clippingPlanes = [cut[o.cut === true ? 'A' : o.cut]];
  return m;
}
const hullMat = (planes) => { const m = new T.ShaderMaterial({ side: T.BackSide, clipping: true, uniforms: inkU, vertexShader: `
#include <common>
#include <clipping_planes_pars_vertex>
uniform float uThick; uniform vec2 uRes; varying float vDist;
void main(){ vec4 p = vec4(position,1.0); vec3 nn = normal;
#ifdef USE_INSTANCING
  p = instanceMatrix * p; { mat3 im = mat3(instanceMatrix); vec3 ia = max(vec3(1e-30), vec3(max(max(abs(im[0].x), abs(im[0].y)), abs(im[0].z)), max(max(abs(im[1].x), abs(im[1].y)), abs(im[1].z)), max(max(abs(im[2].x), abs(im[2].y)), abs(im[2].z)))); nn = (im[0] / ia.x) * (nn.x / length(im[0] / ia.x)) + (im[1] / ia.y) * (nn.y / length(im[1] / ia.y)) + (im[2] / ia.z) * (nn.z / length(im[2] / ia.z)); }
#endif
  vec4 mvPosition = modelViewMatrix * p; vec3 n0 = normalMatrix * nn; n0 /= max(max(abs(n0.x), abs(n0.y)), max(abs(n0.z), 1e-30)); vec3 n = normalize(n0); vec4 clip = projectionMatrix * mvPosition; vec3 nc = (projectionMatrix * vec4(n,0.0)).xyz;
  vec2 dir = normalize(nc.xy + vec2(1e-6)); clip.xy += dir * uThick * clip.w * (2.0 / uRes); clip.z += 0.0006 * clip.w; vDist = -mvPosition.z; gl_Position = clip;
#include <clipping_planes_vertex>
}`, fragmentShader: `
#include <clipping_planes_pars_fragment>
uniform vec3 uColor; uniform vec2 uFog; uniform vec3 uFogColor; varying float vDist;
void main(){
#include <clipping_planes_fragment>
  gl_FragColor = vec4(mix(uColor, uFogColor, smoothstep(uFog.x, uFog.y, vDist)), 1.0); }` }); m.clippingPlanes = planes || []; return m; };
const hullPlain = hullMat(null), hullCutA = hullMat([cut.A]), hullCutH = hullMat([cut.head]);
// a mesh with its ink outline. opts: cut ('A' | 'head' | true), ink (false to skip)
export function mesh(geo, mat, o = {}) {
  const m = new T.Mesh(geo, mat); if (false && o.ink !== false) { const hm = o.cut === 'head' ? hullCutH : (o.cut ? hullCutA : hullPlain); const h = new T.Mesh(geo, hm); h.frustumCulled = false; m.add(h); } return m; }
export function inst(geo, mat, n, o = {}) {
  const m = new T.InstancedMesh(geo, mat, n); m.frustumCulled = false; if (false && o.ink !== false) { const hm = o.cut === 'head' ? hullCutH : (o.cut ? hullCutA : hullPlain); const h = new T.InstancedMesh(geo, hm, n); h.instanceMatrix = m.instanceMatrix; h.frustumCulled = false; m.add(h); m.userData.hull = h; } return m; }
export const setCount = (m, n) => { m.count = n; if (m.userData.hull) m.userData.hull.count = n; };
// ---- helpers
export const V3 = (x, y, z) => new T.Vector3(x, y, z);
const _m = new T.Matrix4(), _q = new T.Quaternion(), _s = new T.Vector3(), _p = new T.Vector3(), _e = new T.Euler();
export function put(im, i, x, y, z, sx, sy, sz, rx, ry, rz) { _p.set(x, y, z); _s.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz); _e.set(rx || 0, ry || 0, rz || 0); _q.setFromEuler(_e); _m.compose(_p, _q, _s); im.setMatrixAt(i, _m); }
export function putDir(im, i, a, b, r) { // a cylinder (unit height along +y) from a to b with radius r
  const d = _p.copy(b).sub(a), L = d.length(); _q.setFromUnitVectors(V3(0, 1, 0), d.clone().normalize()); _s.set(r, L, r); const c = a.clone().addScaledVector(d, 0.5); _m.compose(c, _q, _s); im.setMatrixAt(i, _m); }
export const col = (c) => new T.Color(c);
export function tube(points, radius, mat, o = {}) { const curve = new T.CatmullRomCurve3(points); return mesh(new T.TubeGeometry(curve, o.seg || points.length * 6, radius, o.rad || 8, false), mat, o); }
export function sphere(r, mat, o = {}) { return mesh(new T.SphereGeometry(r, o.w || 24, o.h || 16, o.ps, o.pl, o.ts, o.tl), mat, o); }
export const unitSphere = new T.SphereGeometry(1, 28, 20), unitSphereHi = new T.SphereGeometry(1, 40, 28), unitCyl = new T.CylinderGeometry(1, 1, 1, 10, 1), unitBox = new T.BoxGeometry(1, 1, 1), unitCone = new T.ConeGeometry(1, 1, 10, 1);
export function ss(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
export const lerp = (a, b, t) => a + (b - a) * t, clamp = (x, a, b) => Math.min(b, Math.max(a, x));
// a canvas texture helper
export function canvasTex(w, h, draw) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d'); draw(ctx, w, h); const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; t.userData = { cv, ctx }; return t; }

// soft round glow sprite (Kurzgesagt-style light), additive
let _g = null; export function glowTex() { if (_g) return _g; _g = canvasTex(128, 128, (x, w, h) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,255,255,0.75)'); g.addColorStop(0.5, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }); return _g; }
export function halo(color, opacity = 1) { const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false, fog: false })); s.frustumCulled = false; return s; }
export function glowPoints(geo, size, opacity, vc = true, color = 0xffffff) { return new T.Points(geo, new T.PointsMaterial({ map: glowTex(), size, sizeAttenuation: false, vertexColors: vc, color, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false, fog: false })); }

// ---------------------------------------------------------------------------------------------------------------
// Level fade: every level carries a { value } uniform (0..1) driven by the engine. applyFade patches every material in the
// group so that opaque surfaces dissolve with a fine 4x4 ordered dither and transparent / additive ones scale their alpha.
// The result is a smooth, grain-free-looking crossfade between levels that coexist in space, with no geometry popping.
const FADE_GLSL = 'uniform float uLvFade;\nuniform float uLvInv;\nfloat lvFadeNoise(vec2 p){ return fract(52.9829189 * fract(dot(floor(p), vec2(0.06711056, 0.00583715)))); }\n';
export function applyFade(root, fade) {
  const seen = root.userData._fadeSeen || (root.userData._fadeSeen = new Set());
  root.traverse((o) => {
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    mats.forEach((m) => {
      if (!m || seen.has(m)) return; seen.add(m);
      const prev = m.onBeforeCompile, translucent = m.transparent || m.blending === T.AdditiveBlending;
      m.onBeforeCompile = (sh, r) => {
        if (prev) prev(sh, r);
        sh.uniforms.uLvFade = fade; sh.uniforms.uLvInv = fade.inv || (fade.inv = { value: 0 }); sh.fragmentShader = FADE_GLSL + sh.fragmentShader;
        const k = sh.fragmentShader.lastIndexOf('}'); if (k < 0) return;
        const tail = translucent ? '\n  gl_FragColor.a *= uLvFade;\n' : '\n  if (uLvFade < 0.999) { float fn = lvFadeNoise(gl_FragCoord.xy); if (uLvInv > 0.5 ? (fn < 1.0 - uLvFade) : (fn > uLvFade)) discard; }\n';
        sh.fragmentShader = sh.fragmentShader.slice(0, k) + tail + sh.fragmentShader.slice(k);
      };
      const pk = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => '';
      m.customProgramCacheKey = () => pk() + '|fade' + (translucent ? 'T' : 'O');
      m.needsUpdate = true;
    });
  });
}
