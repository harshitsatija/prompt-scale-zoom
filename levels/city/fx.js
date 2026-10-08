/* city/fx.js: street lights, traffic streaks along real roads, the wi-fi ripple. */
import { hash2, rng } from './data.js';
export function buildLamps(ctx, D, terrain, inner) {
  const { T, kit } = ctx, GROUND = ctx.geom.GROUND, RP = D.roadPts, pts = [], cols = [], r = rng(99);
  for (const w of D.ways) { if (w.tier > 1 || w.cls > 4 || (w.tier === 1 && w.cls > 3)) continue; if (inner !== undefined) { const cx = RP[w.off * 2], cz = RP[w.off * 2 + 1]; if ((Math.hypot(cx, cz) < 560) !== inner) continue; }
    const half = Math.max(1.5, w.w * 0.5) + 1.0, gap = w.cls <= 2 ? 24 : w.cls === 3 ? 30 : 38; let carry = r() * gap, side = 1;
    for (let i = 0; i < w.n - 1; i++) { const x0 = RP[(w.off + i) * 2], z0 = RP[(w.off + i) * 2 + 1], x1 = RP[(w.off + i + 1) * 2], z1 = RP[(w.off + i + 1) * 2 + 1]; const L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.01) continue; const dx = (x1 - x0) / L, dz = (z1 - z0) / L; let s = carry; while (s < L) { const x = x0 + dx * s - dz * side * half, z = z0 + dz * s + dx * side * half; const y = terrain.groundY(x, z) - GROUND + (w.cls <= 2 ? 9 : 6.5); pts.push(x, y, z); const k = 0.8 + 0.2 * r(); cols.push(1.0 * k, 0.78 * k, 0.45 * k); side = -side; s += gap; } carry = s - L; } }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(pts), 3)); g.setAttribute('color', new T.BufferAttribute(new Float32Array(cols), 3));
  const lp = kit.glowPoints(g, 6, 0.95); lp.frustumCulled = false; lp.position.y = GROUND; // OSM-mapped lamps are covered by the generated rhythm
  return { points: lp, count: pts.length / 3 };
}
export function buildTraffic(ctx, D, terrain) {
  const { T, kit } = ctx, GROUND = ctx.geom.GROUND, RP = D.roadPts, r = rng(5);
  const routes = []; for (const w of D.ways) { if (w.cls > 3 || w.tier > 2 || (w.fl & 1)) continue; const x0 = RP[w.off * 2], z0 = RP[w.off * 2 + 1]; if (Math.max(Math.abs(x0), Math.abs(z0)) > 14000) continue; const cum = [0]; for (let i = 1; i < w.n; i++) cum.push(cum[i - 1] + Math.hypot(RP[(w.off + i) * 2] - RP[(w.off + i - 1) * 2], RP[(w.off + i) * 2 + 1] - RP[(w.off + i - 1) * 2 + 1])); const L = cum[cum.length - 1]; if (L < 90) continue; routes.push({ w, cum, L }); }
  routes.sort((a, b) => b.L - a.L); const sel = routes.slice(0, 160); const veh = []; for (const R of sel) { const n = Math.min(5, Math.max(1, Math.floor(R.L / 300))); for (let k = 0; k < n; k++) veh.push({ R, s: r() * R.L, v: 6 + r() * 7, dir: r() < 0.5 ? 1 : -1, lane: (r() < 0.5 ? -1 : 1) * (0.2 + 0.25 * r()), col: r() }); }
  const mat = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }); const im = kit.inst(new T.BoxGeometry(1, 1, 1), mat, veh.length, { ink: false }); const c = new T.Color(); veh.forEach((v, i) => { c.setRGB(...(v.dir > 0 ? [1.0, 0.93, 0.78] : [1.0, 0.36, 0.28])); im.setColorAt(i, c); }); im.instanceColor.needsUpdate = true; im.position.y = GROUND;
  const q = new T.Quaternion(), m4 = new T.Matrix4(), s3 = new T.Vector3(), p3 = new T.Vector3(), e = new T.Euler();
  function update(t, pm) {
    const len = Math.max(4.4, pm * 3.2), wid = Math.max(1.9, pm * 1.1), ht = Math.max(1.4, pm * 0.9); let i = 0;
    for (const v of veh) { const R = v.R, w = R.w; let s = ((v.s + v.dir * v.v * t) % R.L + R.L) % R.L; let k = 1; while (k < R.cum.length - 1 && R.cum[k] < s) k++; const f = (s - R.cum[k - 1]) / Math.max(1e-6, R.cum[k] - R.cum[k - 1]); const ax = RP[(w.off + k - 1) * 2], az = RP[(w.off + k - 1) * 2 + 1], bx = RP[(w.off + k) * 2], bz = RP[(w.off + k) * 2 + 1]; const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1;
      const off = v.lane * w.w * 0.5; const x = ax + dx * f + (-dz / L) * off, z = az + dz * f + (dx / L) * off; const y = terrain.groundY(x, z) - GROUND + 0.9 + ht * 0.4;
      e.set(0, -Math.atan2(dz, dx), 0); q.setFromEuler(e); s3.set(len, ht, wid); p3.set(x, y, z); m4.compose(p3, q, s3); im.setMatrixAt(i++, m4); }
    im.instanceMatrix.needsUpdate = true; }
  return { mesh: im, update, count: veh.length };
}
export function buildWifi(ctx) {
  const { T } = ctx, GROUND = ctx.geom.GROUND, group = new T.Group(); const shells = [];
  const mkMat = (col) => new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.FrontSide, fog: false, uniforms: { uA: { value: 0 }, uC: { value: new T.Color(col) }, uBand: { value: 0 } }, vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }', fragmentShader: 'varying vec3 vN; varying vec3 vV; uniform float uA; uniform vec3 uC; void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); float e = pow(f, 4.5) * 1.2 + 0.01; gl_FragColor = vec4(uC * e * uA, 1.0); }' });
  const geo = new T.SphereGeometry(1, 64, 40, 0, Math.PI * 2, 0, Math.PI * 0.5);
  for (let k = 0; k < 3; k++) { const m = new T.Mesh(geo, mkMat(k % 2 ? 0xffd166 : 0xffa51f)); m.frustumCulled = false; group.add(m); shells.push(m); }
  // ground-plane ripple rings (readable from above at 2-4 km): thin amber annuli expanding with the same schedule
  const rgeo = new T.RingGeometry(0.8, 1, 160, 1); rgeo.rotateX(-Math.PI / 2); const rings = [];
  for (let k = 0; k < 3; k++) { const rm = new T.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: T.NormalBlending, fog: false, uniforms: { uRipA: { value: 0 }, uRipW: { value: 0.05 }, uRipC: { value: new T.Color(k % 2 ? 0xffd166 : 0xffa51f) } }, vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: 'varying vec2 vP; uniform float uRipA, uRipW; uniform vec3 uRipC; void main(){ float d = length(vP); float a = smoothstep(1.0 - uRipW, 1.0 - uRipW * 0.3, d) * (1.0 - smoothstep(0.99, 1.0, d)); gl_FragColor = vec4(uRipC, a * uRipA); }' }); const m = new T.Mesh(rgeo, rm); m.frustumCulled = false; m.renderOrder = 12; group.add(m); rings.push(m); }
  group.position.set(0, -0.2, 2.8);
  function update(S, pm) { const p = S.sent ? S.send / 1.2 : -1; shells.forEach((m, k) => { const q = p - k * 0.09; if (q <= 0 || q >= 1 || pm > 0.5) { m.visible = false; return; } m.visible = true; const r = 5 * Math.pow(10, 2.55 * Math.pow(q, 0.85)); m.scale.setScalar(r); m.material.uniforms.uA.value = Math.min(1, q * 9) * (1 - q) * 0.16 * (0.5 + 0.5 * Math.exp(-r / 2500)) / (1 + pm * 0.8); });
    rings.forEach((m, k) => { const q = p - k * 0.09; if (q <= 0 || q >= 1 || (ctx.params && ctx.params.has('norings'))) { m.visible = false; return; } m.visible = true; const r = 5 * Math.pow(10, 2.55 * Math.pow(q, 0.85)); m.scale.setScalar(r); m.position.y = -7.2; m.material.uniforms.uRipW.value = Math.max(0.012, Math.min(0.1, 9 * pm / r)); m.material.uniforms.uRipA.value = Math.min(1, q * 12) * Math.pow(1 - q, 0.7) * 1.0; }); }
  return { group, update };
}
// parked / standing street vehicles (cars, autos, two-wheelers) on the kerbs of real residential streets; smooth ellipsoid bodies, tail/head light points
export function buildParked(ctx, D, terrain, inner) {
  const { T, kit } = ctx, GROUND = ctx.geom.GROUND, RP = D.roadPts, r = rng(4242), cars = [], autos = [], bikes = [];
  for (const w of D.ways) { if (w.tier > 1 || w.cls < 2 || w.cls > 6 || (w.fl & 1)) continue; const cx = RP[w.off * 2], cz = RP[w.off * 2 + 1]; const d0 = Math.hypot(cx, cz); if (d0 > 1500 || (d0 < 560) !== inner) continue;
    const half = Math.max(1.5, w.w * 0.5); let carry = r() * 9;
    for (let i = 0; i < w.n - 1; i++) { const x0 = RP[(w.off + i) * 2], z0 = RP[(w.off + i) * 2 + 1], x1 = RP[(w.off + i + 1) * 2], z1 = RP[(w.off + i + 1) * 2 + 1]; const L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.5) continue; const dx = (x1 - x0) / L, dz = (z1 - z0) / L; let s = carry;
      while (s < L) { const side = r() < 0.5 ? -1 : 1, k = r(); if (r() < (w.cls <= 3 ? 0.3 : 0.42)) { const off = side * (half - (k < 0.62 ? 1.15 : k < 0.8 ? 1.0 : 0.7)); const x = x0 + dx * s - dz * off, z = z0 + dz * s + dx * off, yaw = -Math.atan2(dz, dx) + (r() < 0.12 ? Math.PI : 0); const rec = [x, z, yaw, r()]; (k < 0.62 ? cars : k < 0.8 ? autos : bikes).push(rec); } s += 6.5 + r() * 5; } carry = s - L; } }
  const ell = (rx, ry, rz, y, x = 0) => { const g = new T.SphereGeometry(1, 14, 9); g.scale(rx, ry, rz); g.translate(x, y, 0); g.deleteAttribute('uv'); return g; };
  const merge = (gs) => { let nv = 0; for (const g of gs) nv += g.index ? g.index.count : g.attributes.position.count; const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3); let o = 0; for (const g0 of gs) { const g = g0.index ? g0.toNonIndexed() : g0; P.set(g.attributes.position.array, o); N.set(g.attributes.normal.array, o); o += g.attributes.position.array.length; } const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(P, 3)); out.setAttribute('normal', new T.BufferAttribute(N, 3)); return out; };
  const carG = merge([ell(2.05, 0.5, 0.86, 0.62), ell(1.05, 0.42, 0.74, 1.05, -0.2)]), autoG = merge([ell(1.3, 0.62, 0.7, 0.85), ell(0.9, 0.3, 0.75, 1.5, -0.1)]), bikeG = merge([ell(0.95, 0.38, 0.22, 0.62), ell(0.3, 0.38, 0.28, 1.0, 0.1)]);
  const CC = [[236, 236, 240], [200, 202, 210], [60, 62, 78], [150, 40, 44], [40, 70, 130], [120, 124, 134], [226, 214, 190], [30, 30, 38]].map((c) => c.map((v) => Math.pow(v / 255, 2.2)));
  const mk = (arr, geo, pal) => { const im = kit.inst(geo, kit.toon(0xffffff), arr.length, { ink: false }); const c = new T.Color(); arr.forEach((v, i) => { const y = terrain.groundY(v[0], v[1]) - GROUND + 0.1; kit.put(im, i, v[0], y, v[1], 1, 1, 1, 0, v[2], 0); const q = pal ? pal[Math.floor(v[3] * pal.length) % pal.length] : [0.9, 0.62, 0.05]; c.setRGB(q[0], q[1], q[2]); im.setColorAt(i, c); }); if (arr.length) im.instanceColor.needsUpdate = true; im.position.y = GROUND; return im; };
  const ims = [mk(cars, carG, CC), mk(autos, autoG, null), mk(bikes, bikeG, CC)];
  const pts = [], pc = []; for (const [arr, hl] of [[cars, 2.0], [autos, 1.4], [bikes, 0.9]]) for (const v of arr) { const y = terrain.groundY(v[0], v[1]) - GROUND + 0.75, cy = Math.cos(v[2]), sy = Math.sin(v[2]); const rear = v[3] > 0.45; const sgn = rear ? -1 : 1; pts.push(v[0] + cy * hl * sgn, y, v[1] - sy * hl * sgn); if (rear) pc.push(1.0, 0.08, 0.05); else pc.push(1.0, 0.9, 0.7); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(pts), 3)); g.setAttribute('color', new T.BufferAttribute(new Float32Array(pc), 3)); const lp = kit.glowPoints(g, 3, 0.8); lp.frustumCulled = false; lp.position.y = GROUND;
  const group = new T.Group(); ims.forEach((m) => group.add(m)); group.add(lp); return { group, count: cars.length + autos.length + bikes.length };
}
