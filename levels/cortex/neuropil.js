/* cortex/neuropil.js: the unresolved felt of dendrites and axons between the somata. At fields of view below ~0.2 mm it is generated on demand from a spatial
 * hash (so it never has to be stored): thin tapered prisms, 40 % radial (apical dendrites / ascending axons), 30 % tangential, 30 % oblique. */
import { Mesh3 } from './morph.js';
import { MM, ZW, X0, X1, YB } from './field.js';
function h32(a, b, c, s) { let h = (a * 374761393 + b * 668265263 + c * 2147483647 + s * 362437 + 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
export class Neuropil {
  constructor(ctx, shade) {
    const { T } = ctx; this.T = T; this.g = new T.Group(); const M = new Mesh3(), sides = 8;
    // a process with rounded ends: capped start, swelling, tapering, rounded tip (no planar cut faces)
    const rings = [[0.0, 0.35], [0.02, 0.8], [0.06, 1.0], [0.5, 0.82], [0.94, 0.78], [0.99, 0.5]];
    M.p.push(0, -0.012, 0); M.n.push(0, -1, 0); M.c.push(1, 1, 1);
    for (const [y, r] of rings) for (let s = 0; s < sides; s++) { const th = s / sides * 6.2831853, cs = Math.cos(th), sn = Math.sin(th); M.p.push(cs * r, y, sn * r); M.n.push(cs, (y < 0.1 ? -0.5 : y > 0.9 ? 0.5 : 0.08), sn); M.c.push(1, 1, 1); }
    const nr = rings.length; M.p.push(0, 1.012, 0); M.n.push(0, 1, 0); M.c.push(1, 1, 1);
    for (let s = 0; s < sides; s++) M.i.push(0, 1 + (s + 1) % sides, 1 + s);
    for (let r = 0; r < nr - 1; r++) for (let s = 0; s < sides; s++) { const a = 1 + r * sides + s, b = 1 + r * sides + (s + 1) % sides, c = a + sides, d = b + sides; M.i.push(a, c, b, b, c, d); }
    for (let s = 0; s < sides; s++) M.i.push(1 + (nr - 1) * sides + s, 1 + nr * sides, 1 + (nr - 1) * sides + (s + 1) % sides);
    M.v = 2 + nr * sides;
    this.cap = 9000; this.mesh = new T.InstancedMesh(M.toGeometry(T), shade.tissue(0xffffff, { vc: true, haze: 0.3 }), this.cap); this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.mesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array(this.cap * 3), 3); this.g.add(this.mesh);
    this.pal = [new T.Color(0x6f66d0), new T.Color(0x8d84e6), new T.Color(0x3f9fb0), new T.Color(0x6a60c4)];
  }
  select(fx, fy, z, W, hero) {
    const { T } = this, m = this.mesh; if (z > -3.55 || z < -4.2) { m.count = 0; m.visible = false; return; }
    const B = Math.max(10e-6, W * 0.16), R = 0.62 * W * 1.2, depthMax = Math.min(ZW, Math.max(0.05e-3, W * 2.2)), px = W / 1500, per = 1;
    const M4 = new T.Matrix4(), q = new T.Quaternion(), p = new T.Vector3(), s = new T.Vector3(), eu = new T.Euler(), c = new T.Color(); let n = 0;
    const i0 = Math.floor((fx - R) / B), i1 = Math.floor((fx + R) / B), j0 = Math.floor((fy - R) / B), j1 = Math.floor((fy + R) / B), k1 = Math.floor(depthMax / B);
    for (let k = 0; k <= k1 && n < this.cap; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (let u = 0; u < per; u++) {
      if (n >= this.cap) break; const x = (i + h32(i, j, k, u * 7 + 1)) * B, y = (j + h32(i, j, k, u * 7 + 2)) * B, zz = -(k + h32(i, j, k, u * 7 + 3)) * B; if (y > 0 || -y > YB) continue;
      const dx = x - fx, dy = y - fy; if (dx * dx + dy * dy > R * R) continue;
      if (hero && !hero.on && z < -3.7) { const hx = x - (hero.fsx || 0), hy = y - (-1.2e-3 + (hero.fsy || 0)); if (hx * hx + hy * hy < (24e-6) ** 2 && -zz < 60e-6) continue; }
      if (hero && hero.on) { const hx = x - hero.x, hy = y - hero.y; if (hx * hx + hy * hy < hero.r * hero.r * 1.6 && -zz < hero.depth) continue; }
      const kind = h32(i, j, k, u * 7 + 4), r = Math.max((0.10 + 0.26 * h32(i, j, k, u * 7 + 5) ** 2) * 1e-6, px * 0.4), L = (0.5 + 1.4 * h32(i, j, k, u * 7 + 6)) * B * 1.2;
      const a = h32(i, j, k, u * 7 + 8) * 6.28;
      if (kind < 0.42) eu.set(0, a, (h32(i, j, k, 99) - 0.5) * 0.25); else if (kind < 0.72) eu.set(0, a, -Math.PI / 2 + (h32(i, j, k, 98) - 0.5) * 0.4); else eu.set((h32(i, j, k, u + 50) - 0.5) * 3, a, (h32(i, j, k, u + 60) - 0.5) * 3);
      q.setFromEuler(eu); const d = new T.Vector3(0, 1, 0).applyQuaternion(q);
      M4.compose(p.set(x - d.x * L / 2, y - d.y * L / 2, zz - d.z * L / 2), q, s.set(r, L, r)); m.setMatrixAt(n, M4);
      const pc = kind < 0.42 ? this.pal[0] : kind < 0.72 ? this.pal[1] : h32(i, j, k, 77) < 0.5 ? this.pal[2] : this.pal[3]; m.setColorAt(n, c.copy(pc).multiplyScalar(0.80 + 0.35 * h32(i, j, k, u + 33))); n++;
    }
    m.count = n; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; m.visible = n > 0; this.stats = { neuropil: n };
  }
}
