/* small shared helpers for the person level */
export function rng(seed) { let a = seed | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function roundedBox(T, w, h, d, r = 0.004, seg = 3) {
  // box w x h x d (x,y,z) centred at the origin, with rounded vertical edges and bevelled top/bottom
  const s = new T.Shape(); const x = w / 2 - r, z = d / 2 - r;
  s.moveTo(-x, -d / 2); s.lineTo(x, -d / 2); s.absarc(x, -z, r, -Math.PI / 2, 0, false); s.lineTo(w / 2, z); s.absarc(x, z, r, 0, Math.PI / 2, false); s.lineTo(-x, d / 2); s.absarc(-x, z, r, Math.PI / 2, Math.PI, false); s.lineTo(-w / 2, -z); s.absarc(-x, -z, r, Math.PI, Math.PI * 1.5, false);
  const bev = Math.min(r * 0.8, h * 0.3);
  const g = new T.ExtrudeGeometry(s, { depth: Math.max(h - 2 * bev, 1e-4), bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.9, bevelSegments: seg, curveSegments: 5 });
  g.rotateX(-Math.PI / 2); g.translate(0, bev - h / 2 + 0 , 0); g.computeBoundingBox(); const bb = g.boundingBox; g.translate(0, -(bb.max.y + bb.min.y) / 2, 0);
  return g;
}
const _cache = new Map();
export function prefetchProps(ctx, names) { for (const n of names) if (!_cache.has(n)) _cache.set(n, ctx.loadGLB('person/props/' + n + '.glb')); }
export async function loadProp(ctx, name, o = {}) {
  const { T, kit } = ctx; prefetchProps(ctx, [name]); const gl = await _cache.get(name); const g = gl.scene.clone(true); g.name = name;
  const tint = o.tint !== undefined ? new T.Color(o.tint) : null;
  g.traverse((m) => {
    if (!m.isMesh) return; const om = m.material; const op = { map: om.map || null, normalMap: o.noNormal ? null : (om.normalMap || null), side: om.side };
    if (om.alphaTest > 0 || om.transparent || (om.alphaMode === 'MASK')) { op.alphaTest = 0.45; op.side = T.DoubleSide; }
    if (om.map) om.map.colorSpace = T.SRGBColorSpace;
    let mp = op.map; if (o.calm && mp && mp.image) { try { const im = mp.image, w = Math.min(1024, im.width), h = Math.min(1024, im.height); const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.filter = `blur(${o.calm.blur || 2}px) contrast(${o.calm.contrast || 0.6}) saturate(${o.calm.sat || 0.7}) brightness(${o.calm.bright || 1})`; g.drawImage(im, 0, 0, w, h); const t2 = new T.CanvasTexture(cv); t2.flipY = mp.flipY; t2.colorSpace = T.SRGBColorSpace; t2.wrapS = mp.wrapS; t2.wrapT = mp.wrapT; t2.anisotropy = 8; op.map = t2; } catch (e) { /* keep original */ } }
    if (o.cel !== undefined && !op.alphaTest && op.map && op.map.image) { try { const im = op.map.image, S = 512; const cv = document.createElement('canvas'); cv.width = cv.height = S; const g2 = cv.getContext('2d'); g2.filter = 'blur(4px)'; g2.drawImage(im, 0, 0, S, S); const id = g2.getImageData(0, 0, S, S), d = id.data; let mean = 0; for (let i = 0; i < d.length; i += 4) mean += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; mean /= d.length / 4;
        for (let i = 0; i < d.length; i += 4) { const L = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; let v = 1 + Math.max(-0.16, Math.min(0.16, (L - mean) / mean * 0.5)); v = Math.round(v / 0.07) * 0.07; const c = Math.max(0, Math.min(255, v * 235)); d[i] = d[i + 1] = d[i + 2] = c; } g2.putImageData(id, 0, 0);
        const t2 = new T.CanvasTexture(cv); t2.flipY = op.map.flipY; t2.colorSpace = T.SRGBColorSpace; t2.wrapS = op.map.wrapS; t2.wrapT = op.map.wrapT; t2.anisotropy = 8; op.map = t2; op.normalMap = null; } catch (e) { op.map = null; op.normalMap = null; } }
    else if (o.cel !== undefined && !op.alphaTest) { op.map = null; op.normalMap = null; }
    if (o.flat !== undefined && !op.alphaTest) { op.map = null; op.normalMap = null; }
    const nm = kit.toon(o.flat !== undefined && !op.alphaTest ? o.flat : (o.cel !== undefined && !op.alphaTest ? o.cel : (om.map ? 0xffffff : om.color)), op); if (tint && om.map && o.flat === undefined) nm.color.copy(tint); if (o.emissive) { nm.emissive = new T.Color(o.emissive); nm.emissiveIntensity = 0.6; }
    m.material = nm; m.frustumCulled = false; if (o.cut) nm.clippingPlanes = o.cut;
  });
  if (o.pos) g.position.set(...o.pos); if (o.rotY) g.rotation.y = o.rotY; if (o.scale) g.scale.setScalar(o.scale);
  return g;
}
export function findNode(root, re) { let r = null; root.traverse((n) => { if (!r && re.test(n.name)) r = n; }); return r; }
