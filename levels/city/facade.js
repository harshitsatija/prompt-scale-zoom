/* city/facade.js: procedural night facades in a shader (crisp at any zoom, analytic AA, fades to a mean colour when a window is < 2 px).
 * mode 'mesh'  : extruded OSM footprints, attributes aFac(u along wall m, y above base m, seed, top height) + aRoof
 * mode 'boxes' : instanced AABB boxes (u/y derived from instance scale, unit box geometry). */
const GLSL_FN = `
float fh1(float n){ return fract(sin(n * 127.1) * 43758.5453); }
float fh2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fvn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(fh2(i), fh2(i + vec2(1.0, 0.0)), f.x), mix(fh2(i + vec2(0.0, 1.0)), fh2(i + vec2(1.0, 1.0)), f.x), f.y); }
float rbox(vec2 f, vec2 lo, vec2 hi, float aa){ vec2 d = min(f - lo, hi - f); return smoothstep(-aa, aa, min(d.x, d.y)); }
`;
export function facadeMaterial(kit, T, mode, opts = {}) {
  const m = kit.toon(0xffffff, { vc: mode === 'mesh' });
  const U = { uPx: { value: 1 }, uNight: { value: 1 }, uFar: { value: 0 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    if (mode === 'mesh') {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aFac; attribute vec3 aRoof; varying vec4 vFac; varying vec3 vRoof; varying vec3 vNO; varying vec3 vPO; varying float vEdge;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFac = aFac; vRoof = aRoof; vNO = normal; vPO = position; vEdge = 0.0;');
    } else {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec4 vFac; varying vec3 vRoof; varying vec3 vNO; varying vec3 vPO; varying float vEdge;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
 vEdge = length(instanceMatrix[3].xz);
 { vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz)); vec3 mp = position * sc;
   float u = abs(normal.x) > 0.5 ? mp.z : mp.x; float sd = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
   vFac = vec4(u + sd * 53.0, mp.y + 0.5 * sc.y, sd, sc.y); vRoof = vec3(-1.0); vNO = normal; vPO = vec3(mp.x, mp.y + 0.5 * sc.y, mp.z) + vec3(instanceMatrix[3].x, 0.0, instanceMatrix[3].z) * 0.0; }`);
    }
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vFac; varying vec3 vRoof; varying vec3 vNO; varying vec3 vPO; varying float vEdge; uniform float uPx; uniform float uNight; uniform float uFar;\n' + GLSL_FN)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  vec3 wallC = diffuseColor.rgb * vec3(0.36, 0.32, 0.62); float seed = floor(vFac.z * 4096.0 + 0.5) / 4096.0; bool roof = vNO.y > 0.5; vec3 emi = vec3(0.0);
  vec2 xz = vPO.xz;
  if (roof) {
    vec3 rc = (vRoof.x < 0.0 ? mix(wallC, vec3(0.34, 0.32, 0.42), 0.6) * 0.8 : vRoof * vec3(0.70, 0.66, 0.80));
    float s1 = fvn(xz * 0.9 + seed * 40.0), s2 = fvn(xz * 0.17 + seed * 9.0);
    float dtl = 1.0 - smoothstep(0.05, 0.25, uPx);                       // fine roof pattern only when pixels are small
    rc *= 0.93 + 0.1 * s1 + 0.05 * (s2 - 0.5);
    if (vRoof.x > vRoof.z * 1.4 && vRoof.x > 0.0) {                      // clay tiles
      vec2 tc = vec2(xz.x / 0.33, xz.y / 0.24 + 0.5 * mod(floor(xz.x / 0.33), 2.0)); vec2 tf = fract(tc); float tl = smoothstep(0.0, 0.14, tf.y) * smoothstep(0.0, 0.1, tf.x) * smoothstep(0.0, 0.1, 1.0 - tf.x);
      rc *= mix(1.0, 0.74 + 0.3 * tl + 0.2 * fh2(floor(tc)), dtl);
    } else if (vRoof.z > vRoof.x * 1.25) {                              // corrugated tin
      float st = 0.5 + 0.5 * sin(xz.x * 26.0 + seed * 20.0); rc *= mix(1.0, 0.82 + 0.3 * st, dtl);
    } else {                                                             // concrete terrace: slab joints, stains, parapet shadow
      vec2 g = abs(fract(xz / 2.4 + seed * 3.0) - 0.5); float line = smoothstep(0.47, 0.5, max(g.x, g.y)); rc *= 1.0 - 0.12 * line * dtl;
      float puddle = smoothstep(0.62, 0.8, fvn(xz * 0.35 + seed * 5.0)); rc = mix(rc, rc * vec3(0.7, 0.72, 0.9), puddle * 0.6);
    }
    rc = mix(rc, vec3(dot(rc, vec3(0.3, 0.5, 0.2))), 0.3) * 0.7 * vec3(0.94, 0.94, 1.0); diffuseColor.rgb = rc;
  } else {
    float fh = 3.0 + 0.45 * fh1(seed * 3.7), bw = 2.7 + 1.5 * fh1(seed * 9.1);
    float cu = vFac.x / bw + fh1(seed * 5.5) * 11.0, cv = vFac.y / fh;
    vec2 cell = floor(vec2(cu, cv)), f = fract(vec2(cu, cv));
    vec2 px = fwidth(vec2(cu, cv)); float aa = max(px.x, px.y) * 0.75 + 0.002; float detail = 1.0 - smoothstep(0.6, 1.5, max(px.x, px.y));
    float rnd = fh2(cell + seed * 31.0), rnd2 = fh2(cell * 1.7 + seed * 17.0 + 3.1);
    float litP = (0.34 + 0.36 * fh1(seed * 5.0)) * uNight;
    float lit = step(rnd, litP);
    float topBand = step(vFac.w - 0.85, vFac.y);
    float gfl = 1.0 - step(fh * 0.98, vFac.y);                      // ground floor
    // plaster
    vec3 plaster = wallC * (0.88 + 0.2 * fvn(vec2(vFac.x * 0.6, vFac.y * 0.45) + seed * 20.0));
    float streak = fvn(vec2(vFac.x * 2.2, vFac.y * 0.08) + seed * 7.0);
    plaster *= 1.0 - 0.14 * smoothstep(0.55, 0.9, streak) * (1.0 - topBand);
    // slab line (balcony/floor edge): light top, shadow underneath
    float slabTop = smoothstep(0.0, aa * 2.0 + 0.01, f.y) * (1.0 - smoothstep(0.07, 0.07 + aa * 2.0 + 0.01, f.y));
    float shadowBand = smoothstep(0.07, 0.10 + aa, f.y) * (1.0 - smoothstep(0.17, 0.30 + aa, f.y));
    vec3 col = plaster; col = mix(col, wallC * 1.02, slabTop * 0.6); col *= 1.0 - 0.34 * shadowBand * 0.9;
    // window opening
    float wx0 = 0.22 + 0.05 * rnd2, wx1 = 0.78 - 0.05 * rnd2, wy0 = 0.34, wy1 = 0.84;
    float ow = rbox(f, vec2(wx0 - 0.045, wy0 - 0.045), vec2(wx1 + 0.045, wy1 + 0.045), aa);   // frame
    float gl = rbox(f, vec2(wx0, wy0), vec2(wx1, wy1), aa);                                      // glass
    float mull = 1.0 - smoothstep(0.0, aa * 2.0 + 0.012, abs(f.x - 0.5)) * 0.0;
    float mullion = smoothstep(0.013 + aa, 0.013, abs(f.x - 0.5)) * step(0.5, fh1(seed * 12.3)) ;
    vec3 frameC = vec3(0.86, 0.84, 0.80) * (0.55 + 0.45 * fh1(seed * 2.2));
    vec3 glass = vec3(0.075, 0.085, 0.2) + vec3(0.05, 0.05, 0.12) * f.y;
    // lit rooms: warm, warm-white, rarely TV blue; curtains darken part of the pane
    float tv = step(0.93, rnd2);
    vec3 lc = mix(vec3(1.0, 0.70, 0.30), vec3(1.0, 0.90, 0.68), fh2(cell + 9.1)); lc = mix(lc, vec3(0.55, 0.72, 1.0), tv);
    float curtain = step(0.55, fh2(cell + 4.4)) * smoothstep(wx0 + (wx1 - wx0) * 0.45, wx0 + (wx1 - wx0) * 0.55, f.x) ;
    vec3 litC = lc * (1.0 - 0.45 * curtain) * (0.8 + 0.3 * f.y);
    vec3 paneEm = litC * lit * 1.0;
    // balcony bays: railing bars + plants
    float bal = step(0.55, fh1(seed * 6.6)) * step(0.35, fh2(cell + 2.0));
    float bars = smoothstep(0.012 + aa, 0.012, abs(fract(f.x * 9.0) - 0.5) - 0.38 + 0.0) ;
    float railZone = (1.0 - smoothstep(0.30 + aa, 0.31 + aa, f.y)) * smoothstep(0.08, 0.09 + aa, f.y) * bal;
    // window sill
    float sill = rbox(f, vec2(wx0 - 0.07, wy0 - 0.075), vec2(wx1 + 0.07, wy0 - 0.03), aa);
    // AC condenser
    float ac = step(0.82, fh2(cell + 7.7)) * rbox(f, vec2(0.62, 0.10), vec2(0.90, 0.27), aa) * (1.0 - bal);
    // assemble upper-floor cell
    vec3 cc = col;
    cc = mix(cc, wallC * 0.62, sill * 0.7);
    cc = mix(cc, mix(wallC, vec3(0.8, 0.78, 0.82), 0.3) * 0.9, ow * 0.9);
    vec3 gcol = glass * (1.0 - lit) + litC * lit * 0.55;
    cc = mix(cc, gcol, gl);
    cc = mix(cc, frameC, mullion * gl);
    cc = mix(cc, vec3(0.72, 0.72, 0.78), ac);
    cc = mix(cc, vec3(0.13, 0.13, 0.2), railZone * bars * 0.8);
    vec3 em = paneEm * gl * (1.0 - mullion * 0.8);
    // shopfront / stilt ground floor
    vec3 gc = plaster * 0.55; float shopP = fh1(seed * 8.8);
    float sign = rbox(f, vec2(0.08, 0.66), vec2(0.92, 0.88), aa) * step(0.35, fh2(cell + 11.0));
    vec3 signC = mix(vec3(1.0, 0.82, 0.42), mix(vec3(1.0, 0.95, 0.9), vec3(1.0, 0.45, 0.5), step(0.7, fh2(cell + 13.0))), step(0.45, fh2(cell + 12.0)));
    float opening = rbox(f, vec2(0.07, 0.04), vec2(0.93, 0.62), aa);
    float shutter = 0.5 + 0.5 * step(0.5, fract(f.y * 14.0));
    vec3 gfloor = mix(gc, vec3(0.1, 0.1, 0.16) * (shopP > 0.5 ? 1.0 : 0.6) + vec3(1.0, 0.8, 0.5) * 0.5 * step(0.5, fh2(cell + 5.0)) * 0.0, opening);
    gfloor = mix(gfloor, signC * 0.35, sign);
    vec3 gem = (signC * sign * 1.5 + vec3(1.0, 0.78, 0.45) * opening * step(0.62, fh2(cell + 5.0)) * 0.8) * uNight;
    cc = mix(cc, gfloor, gfl); em = mix(em, gem, gfl);
    // parapet cap
    cc = mix(cc, wallC * 0.96, topBand * 0.75); em *= (1.0 - topBand);
    // mean colour for sub-pixel cells
    vec3 meanC = mix(plaster, vec3(0.12, 0.11, 0.30), 0.32); vec3 meanE = vec3(1.0, 0.72, 0.36) * litP * 0.26 * 5.0;
    meanC = mix(meanC, gfloor * 0.9, gfl * 0.5);
    diffuseColor.rgb = mix(meanC, cc, detail); emi = mix(meanE * (1.0 - gfl), em, detail);
    totalEmissiveRadiance += emi;
  }
  { float rimF = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.0); totalEmissiveRadiance += vec3(0.32, 0.36, 0.95) * rimF * (roof ? 0.35 : 0.22); }   // cool rim light from the house style
  if (vNO.y < 0.5) diffuseColor.rgb *= mix(1.0, 0.82, uFar);
  float eb = smoothstep(2000.0, 3300.0, vEdge); diffuseColor.rgb *= mix(vec3(1.0), vec3(0.78, 0.72, 0.66), eb);
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.8, 0.77, 0.9), uFar); totalEmissiveRadiance *= mix(1.0, 1.25, uFar); totalEmissiveRadiance += vec3(0.07, 0.07, 0.2) * uFar * smoothstep(0.0, 1.0, uPx);   // same violet ambient as the near frames (#5b63e0 shadows), no separate dark far-LOD material
}`);
  };
  m.userData.U = U;
  return m;
}
