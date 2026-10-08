/* cortex/fibres.js: myelinated axons. Radial fibre bundles descending from layers V/VI into the white matter, the horizontal bands of Baillarger (IV, V/VI),
 * the tangential plexus of layer I, and the white-matter tracts (U-fibres along x, some end-on along z). Instanced thin prisms, view-selected. */
import { Mesh3 } from './morph.js';
import { X0, X1, ZW, MM, rngf } from './field.js';
function strawGeoSimple(T) { const M = new Mesh3(), sides = 8; for (let s = 0; s < sides; s++) { const th = s / sides * 6.2831853, cs = Math.cos(th), sn = Math.sin(th); M.p.push(cs, 0, sn); M.n.push(cs, 0, sn); M.c.push(1, 1, 1); } for (let s = 0; s < sides; s++) { const th = s / sides * 6.2831853, cs = Math.cos(th), sn = Math.sin(th); M.p.push(cs, 1, sn); M.n.push(cs, 0, sn); M.c.push(1, 1, 1); } for (let s = 0; s < sides; s++) { const a = s, b = (s + 1) % sides, c = a + sides, d = b + sides; M.i.push(a, c, b, b, c, d); } M.v = sides * 2; return M.toGeometry(T); }
export class Fibres {
  constructor(ctx, shade) {
    const { T } = ctx; this.T = T; this.g = new T.Group(); const rnd = rngf(31337);
    // fibre table: x,y,z centre; len; orientation 0=x,1=y(radial),2=z; kind (colour)
    const N = 90000; this.n = 0; const a = this.a = { x: new Float32Array(N), y: new Float32Array(N), z: new Float32Array(N), L: new Float32Array(N), o: new Uint8Array(N), k: new Uint8Array(N), r: new Uint8Array(N) };
    const add = (x, y, z, L, o, k) => { if (this.n >= N) return; const i = this.n++; a.x[i] = x; a.y[i] = y; a.z[i] = z; a.L[i] = L; a.o[i] = o; a.k[i] = k; a.r[i] = (rnd() * 256) | 0; };
    const W = X1 - X0, zr = () => -rnd() * ZW;
    for (let i = 0; i < 30000; i++) { // white matter tracts
      const o = rnd() < 0.72 ? 0 : rnd() < 0.7 ? 2 : 0; add(X0 + rnd() * W, -(3.58 + rnd() * 1.1) * MM, zr(), (0.25 + rnd() * 0.9) * MM, o, 0); }
    // radial bundles at minicolumn spacing
    for (let i = 0; i < 6000; i++) { const y0 = -(1.7 + rnd() * 1.0) * MM, L = (0.15 + rnd() * 0.35) * MM; const col = Math.floor(rnd() * 100); add(X0 + (col + rnd() * 0.3) / 100 * W, y0 - L / 2, zr(), L, 1, 1); }
    for (const [ya, yb, n] of [[1.42, 1.5, 11000], [2.0, 2.1, 9000]]) for (let i = 0; i < n; i++) add(X0 + rnd() * W, -(ya + rnd() * (yb - ya)) * MM, zr(), (0.1 + rnd() * 0.5) * MM, 0, 1);
    for (let i = 0; i < 11000; i++) add(X0 + rnd() * W, -(0.03 + rnd() * 0.12) * MM, zr(), (0.08 + rnd() * 0.3) * MM, rnd() < 0.8 ? 0 : 2, 2);
    this.mat = shade.tissue(0xffffff, { vc: true }); const cap = 26000;
    this.mesh = new T.InstancedMesh(strawGeoSimple(T), this.mat, cap); this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array(cap * 3), 3); this.cap = cap; this.g.add(this.mesh);
    this.cols = [new T.Color(0xfff3d6), new T.Color(0xf7e3b8), new T.Color(0xc9b6ff)];
  }
  select(fx, fy, z, W, hero, lod) {
    const { T } = this, a = this.a, m = this.mesh, R = 0.7 * W * 1.2, px = W / 1500, M4 = new T.Matrix4(), q = new T.Quaternion(), p = new T.Vector3(), s = new T.Vector3(), eu = new T.Euler(), c = new T.Color(); let n = 0;
    const wideK = Math.min(1, Math.max(0, (W - 1.5e-3) / 2.0e-3)), horizK = Math.min(1, Math.max(0, (W - 0.35e-3) / 0.5e-3)), u = lod.u, keepBase = 0.08 + 0.92 * Math.pow(u, 0.7);
    for (let i = 0; i < this.n && n < this.cap; i++) {
      const dx = a.x[i] - fx, dy = a.y[i] - fy; const ex = a.o[i] === 0 ? a.L[i] / 2 : 0, ey = a.o[i] === 1 ? a.L[i] / 2 : 0; if (Math.abs(dx) > R + ex || Math.abs(dy) > R + ey) continue;
      if (horizK > 0 && a.k[i] !== 0 && a.o[i] !== 1 && a.r[i] / 255 < horizK) continue;   // the horizontal Baillarger / layer-I plexus only resolves as lines at close range (at wide fields it would read as a lattice)
      const depth = -a.z[i]; const keep = (lod.p2 + (1 - lod.p2) * Math.exp(-depth / (lod.T1 / 4))) * (a.k[i] === 0 ? 1.0 - 0.3 * wideK : 0.8 * (1 - 0.95 * wideK)); if (a.r[i] / 256 >= keep * (0.35 + 0.65 * Math.min(1, keepBase * 2))) continue;
      if (hero && hero.on) { const hx = a.x[i] - hero.x, hy = a.y[i] - hero.y; if (hx * hx + hy * hy < (hero.r * 2) ** 2 && depth < hero.depth) continue; }
      const r = Math.max(0.85e-6 * (a.k[i] === 2 ? 0.6 : 1), px * 0.5);
      if (a.o[i] === 0) eu.set(0, 0, -Math.PI / 2 + (a.r[i] / 255 - 0.5) * 0.25); else if (a.o[i] === 1) eu.set(0, 0, (a.r[i] / 255 - 0.5) * 0.1); else eu.set(Math.PI / 2, 0, 0);
      q.setFromEuler(eu); // prism axis +y rotated to the fibre axis; position it by its start point
      const h = a.L[i] / 2; const ax = a.o[i] === 0 ? [Math.cos(eu.z + Math.PI / 2), Math.sin(eu.z + Math.PI / 2), 0] : a.o[i] === 1 ? [-Math.sin(eu.z), Math.cos(eu.z), 0] : [0, 0, -1]; // direction of local +y after rotation
      const dirx = a.o[i] === 0 ? 1 : 0; void dirx; p.set(a.x[i] - ax[0] * h * (a.o[i] === 0 ? -1 : 1) * 0, a.y[i], a.z[i]);
      const d = new T.Vector3(0, 1, 0).applyQuaternion(q); p.set(a.x[i] - d.x * h, a.y[i] - d.y * h, a.z[i] - d.z * h);
      M4.compose(p, q, s.set(r, a.L[i], r)); m.setMatrixAt(n, M4); c.copy(this.cols[a.k[i]]).multiplyScalar((0.62 + 0.3 * (a.r[i] / 255)) * (1 + 0.5 * Math.max(0, Math.min(1, (0.5e-3 - W) / 0.4e-3)))); m.setColorAt(n, c); n++;
    }
    m.count = n; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; m.visible = n > 0; this.stats = { fibres: n };
  }
}
