/* city/roads.js: real OSM roads as ribbons draped on the terrain. Width is real, but never below ~1.7 px (uMin updated per frame), so no shimmer when far. */
const lin = (c) => Math.pow(c / 255, 2.2);
export function roadMaterial(kit, T) {
  const m = kit.toon(0xffffff, { vc: true }); const U = { uMin: { value: 0 }, uLift: { value: 0 }, uPx: { value: 1 }, uAlpha: { value: 1 }, uR0: { value: 98000 }, uR1: { value: 119000 } }; m.transparent = true; m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aR; attribute vec3 aN; uniform float uMin; uniform float uLift; varying vec3 vR; varying float vL; varying vec2 vFXZ;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
 { float half_ = aR.x, side = aR.y; float mw = uMin * (aR.z > 6.5 ? 0.95 : aR.z < 1.5 ? 1.0 : aR.z < 2.5 ? 0.8 : aR.z < 3.5 ? 0.6 : 0.42); float wEff = max(half_, mw); transformed.xz += aN.xy * side * wEff; vL = aN.z; vFXZ = position.xz; transformed.y += uLift * (1.0 + aR.z * 0.01);  vR = vec3(side, aR.z, half_ / max(wEff, 1e-4)); }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vR; varying float vL; varying vec2 vFXZ; uniform float uPx, uR0, uR1, uAlpha;').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
 { float across = abs(vR.x); float real = clamp(vR.z, 0.0, 1.0); float cl = vR.y;           // real/effective width ratio: widened (sub-pixel) roads are dimmed so streets stay faint, never a tan carpet
   float vis = mix(0.22, 1.0, smoothstep(0.25, 0.85, real));
   vec3 asph = diffuseColor.rgb * vec3(0.58, 0.55, 0.78);
   float pw = 1.0 / max(real, 0.05);                                                         // footpath is ~1.1 m wide in real metres
   float curb = smoothstep(0.78, 0.82, across) * step(0.55, real);
   vec3 col = mix(asph, asph * 1.5 + vec3(0.02, 0.018, 0.03), curb);
   // lane dashes (primary..tertiary) and kerb-side glow from street lamps
   float dash = (cl < 3.5) ? (1.0 - smoothstep(0.015, 0.03, across)) * step(fract(vL / 7.0), 0.5) : 0.0;
   col = mix(col, vec3(0.9, 0.85, 0.7), dash * 0.8 * step(0.5, real));
   diffuseColor.rgb = col * vis; diffuseColor.a *= (1.0 - smoothstep(uR0 * 0.55, uR1 * 0.8, length(vFXZ))) * uAlpha; if (diffuseColor.a < 0.012) discard;
   if (cl > 6.5 && cl < 7.5) { vec3 rc = vec3(0.26, 0.25, 0.36); float cd = (1.0 - smoothstep(0.03, 0.07, across)) * step(fract(vL / 60.0), 0.5); rc = mix(rc, vec3(0.85, 0.84, 0.92), cd * 0.6); float el = smoothstep(0.84, 0.9, across) * step(fract(vL / 14.0), 0.45); diffuseColor.rgb = rc * (0.55 + 0.45 * vis); totalEmissiveRadiance += vec3(1.0, 0.9, 0.7) * el * 1.4 + vec3(0.8, 0.8, 1.0) * cd * 0.4 + vec3(0.30, 0.26, 0.4) * (0.12 + 0.3 * (1.0 - vis)); }
   if (cl > 7.5) { float core = 1.0 - smoothstep(0.35, 1.0, across); vec3 mc = diffuseColor.rgb / max(max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)), 1e-3); float edge = smoothstep(0.55, 0.9, across) * (1.0 - smoothstep(0.9, 1.0, across)); diffuseColor.rgb = mix(mc * 0.22, mc * 0.85, core) * (0.5 + 0.5 * vis); totalEmissiveRadiance += mc * (0.3 + 0.9 * core) * (0.3 + 0.7 * vis) + vec3(1.0, 0.92, 0.8) * edge * 0.25 * step(0.5, fract(vL / 9.0)) * vis; }
   float lampPool = (1.0 - curb) * (0.55 + 0.45 * smoothstep(0.9, 0.5, across));
   totalEmissiveRadiance += vec3(1.0, 0.7, 0.36) * (cl < 3.5 ? (cl < 1.5 ? 0.8 : 0.66) : (cl > 6.5 ? 0.0 : 0.3)) * lampPool * vis + vec3(1.0, 0.85, 0.6) * dash * 0.4 * vis; }`);
  };
  m.userData.U = U; return m;
}
// builds a ribbon mesh for the ways selected by `sel`, y from yFn(x,z)
export function buildRibbons(T, kit, D, sel, yFn, mat, o = {}) {
  const WID = [22, 17, 13, 10.5, 7, 4.2, 3], COL = [[184, 164, 140], [180, 160, 138], [172, 154, 134], [158, 144, 130], [136, 126, 128], [116, 108, 122], [96, 90, 110]];
  const P = D.roadPts; let nv = 0, ni = 0; const ws = D.ways.filter(sel); for (const w of ws) { nv += w.n * 2; ni += (w.n - 1) * 6; }
  const pos = new Float32Array(nv * 3), aR = new Float32Array(nv * 4), aN = new Float32Array(nv * 3), col = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni); let vo = 0, io = 0;
  for (const w of ws) {
    const n = w.n, half = Math.max(1.2, (o.width ? o.width(w) : w.w) * 0.5); const c = (o.colorOf ? o.colorOf(w) : null) || COL[w.cls] || COL[4], cl = [lin(c[0]), lin(c[1]), lin(c[2])]; const bridge = (w.fl & 1) !== 0, lift = o.lift ?? 0.12; let first = vo, cum = 0, px0 = P[w.off * 2], pz0 = P[w.off * 2 + 1];
    for (let i = 0; i < n; i++) {
      const x = P[(w.off + i) * 2], z = P[(w.off + i) * 2 + 1]; cum += Math.hypot(x - px0, z - pz0); px0 = x; pz0 = z; let dx = 0, dz = 0;
      if (i > 0) { dx += x - P[(w.off + i - 1) * 2]; dz += z - P[(w.off + i - 1) * 2 + 1]; } if (i < n - 1) { dx += P[(w.off + i + 1) * 2] - x; dz += P[(w.off + i + 1) * 2 + 1] - z; }
      let L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L; let nx = -dz, nz = dx; let ms = 1; if (i > 0 && i < n - 1) { const ax = x - P[(w.off + i - 1) * 2], az = z - P[(w.off + i - 1) * 2 + 1], bx = P[(w.off + i + 1) * 2] - x, bz = P[(w.off + i + 1) * 2 + 1] - z; const la = Math.hypot(ax, az) || 1, lb = Math.hypot(bx, bz) || 1; const dot = (ax * bx + az * bz) / (la * lb); ms = Math.min(1.8, 1 / Math.max(0.55, Math.sqrt((1 + dot) / 2))); }
      // bridges (flyovers): raise the deck in the middle with smooth ramps at both ends
      let by = 0; if (bridge && n > 1) { const t = i / (n - 1), q = Math.min(1, Math.min(t, 1 - t) / 0.18), H = (w.fl & 2) ? 7 : 5; by = H * q * q * (3 - 2 * q); }
      const y = yFn(x, z) + lift + by;
      for (let s = 0; s < 2; s++) { const o2 = vo; pos[o2 * 3] = x; pos[o2 * 3 + 1] = y; pos[o2 * 3 + 2] = z; aR[o2 * 4] = half; aR[o2 * 4 + 1] = s === 0 ? -1 : 1; aR[o2 * 4 + 2] = w.cls; aR[o2 * 4 + 3] = w.cls <= 3 ? 1 : 0; aN[o2 * 3] = nx * ms; aN[o2 * 3 + 1] = nz * ms; aN[o2 * 3 + 2] = cum; col[o2 * 3] = cl[0]; col[o2 * 3 + 1] = cl[1]; col[o2 * 3 + 2] = cl[2]; nor[o2 * 3 + 1] = 1; vo++; }
    }
    for (let i = 0; i < n - 1; i++) { const a = first + i * 2, b = a + 1, c2 = a + 2, d = a + 3; idx[io++] = a; idx[io++] = b; idx[io++] = c2; idx[io++] = b; idx[io++] = d; idx[io++] = c2; }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos.subarray(0, vo * 3), 3)); g.setAttribute('normal', new T.BufferAttribute(nor.subarray(0, vo * 3), 3)); g.setAttribute('color', new T.BufferAttribute(col.subarray(0, vo * 3), 3)); g.setAttribute('aR', new T.BufferAttribute(aR.subarray(0, vo * 4), 4)); g.setAttribute('aN', new T.BufferAttribute(aN.subarray(0, vo * 3), 3)); g.setIndex(new T.BufferAttribute(idx.subarray(0, io), 1));
  const m = new T.Mesh(g, mat); m.frustumCulled = false; return m;
}
