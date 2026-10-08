export async function loadPack(ctx, name, scale = 1) {
  const [meta, buf] = await Promise.all([ctx.fetchJSON(name + '.json'), ctx.fetchBuf(name + '.bin')]); const T = ctx.T; const out = {};
  for (const e of meta) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(buf, e.pos, e.nv * 3), 3));
    g.setAttribute('normal', new T.BufferAttribute(new Int8Array(buf, e.nrm, e.nv * 3), 3, true));
    if (e.col !== undefined) g.setAttribute('color', new T.BufferAttribute(new Uint8Array(buf, e.col, e.nv * 3), 3, true));
    g.setIndex(new T.BufferAttribute(e.i16 ? new Uint16Array(buf, e.idx, e.nf * 3) : new Uint32Array(buf, e.idx, e.nf * 3), 1));
    if (scale !== 1) g.scale(scale, scale, scale); g.computeBoundingSphere(); out[e.name] = { geo: g, unit: e.unit / scale, extra: e.extra, nv: e.nv, nf: e.nf };
  }
  return out;
}
