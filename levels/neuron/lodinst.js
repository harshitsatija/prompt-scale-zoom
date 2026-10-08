/* Distance- and zoom-LOD'd instancing: two InstancedMeshes (hi / lo tessellation) holding only the instances near the focus; repacked when the focus moves. Units: um. */
export function lodInst(T, { geoHi, geoLo, mat, mats, cols, hiW = 40, rcMin = 35, rcK = 1.6, allW = 160 }) {
  const n = mats.length / 16, g = new T.Group();
  const mk = (geo) => { const m = new T.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.count = 0; if (cols) m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(n * 3), 3); g.add(m); return m; };
  const hi = mk(geoHi), lo = mk(geoLo); const st = { fx: 1e9, fy: 0, fz: 0, rc: 0, hiOn: null };
  function update(f, W) {
    const rc = W < allW ? Math.max(rcMin, rcK * W) : 1e7, hiOn = W < hiW; const mv = Math.hypot(f[0] - st.fx, f[1] - st.fy, f[2] - st.fz);
    if (hiOn === st.hiOn && mv < 0.1 * Math.min(rc, 300) && Math.abs(Math.log(Math.min(rc, 1e6) / Math.max(1, Math.min(st.rc, 1e6)))) < 0.1) return;
    st.fx = f[0]; st.fy = f[1]; st.fz = f[2]; st.rc = rc; st.hiOn = hiOn;
    const tgt = hiOn ? hi : lo, oth = hiOn ? lo : hi; oth.count = 0; const arr = tgt.instanceMatrix.array, ca = cols ? tgt.instanceColor.array : null; let c = 0; const r2 = rc * rc;
    for (let i = 0; i < n; i++) { const o = i * 16, dx = mats[o + 12] - f[0], dy = mats[o + 13] - f[1], dz = mats[o + 14] - f[2]; if (dx * dx + dy * dy + dz * dz > r2) continue; arr.set(mats.subarray(o, o + 16), c * 16); if (ca) { ca[c * 3] = cols[i * 3]; ca[c * 3 + 1] = cols[i * 3 + 1]; ca[c * 3 + 2] = cols[i * 3 + 2]; } c++; }
    tgt.count = c; tgt.instanceMatrix.needsUpdate = true; if (ca) tgt.instanceColor.needsUpdate = true;
  }
  return { group: g, update, meshes: [hi, lo] };
}
