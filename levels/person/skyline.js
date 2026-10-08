/* Night skyline of Bangalore seen from her window: layered canvas silhouettes with lit windows, a haze of street glow, and an elevated metro train gliding past. */
import { rng } from './util.js';
export function makeSkyline(ctx) {
  const { T, kit } = ctx; const group = new T.Group(); group.name = 'skyline';
  const W = 2048, H = 640; const R = rng(77);
  const layer = (seed, base, minH, maxH, wMin, wMax, body, win, dens, glowCol) => kit.canvasTex(W, H, (g, w, h) => {
    const r = rng(seed); let x = -20; g.clearRect(0, 0, w, h);
    while (x < w) { const bw = wMin + r() * (wMax - wMin), bh = minH + Math.pow(r(), 1.7) * (maxH - minH); g.fillStyle = body; const top = h - base - bh; g.fillRect(x, top, bw, bh + base);
      if (r() < 0.25) { g.fillRect(x + bw * 0.4, top - 14 - r() * 20, 3, 18 + r() * 30); }             // antennae
      for (let yy = top + 8; yy < h - base - 4; yy += 9) for (let xx = x + 5; xx < x + bw - 6; xx += 7) { if (r() < dens) { g.fillStyle = win[(r() * win.length) | 0]; g.fillRect(xx, yy, 3, 4); } }
      x += bw + r() * 6; }
    if (glowCol) { const gr = g.createLinearGradient(0, h - base - 40, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, glowCol); g.fillStyle = gr; g.fillRect(0, h - base - 40, w, base + 40); }
  });
  const sky = kit.canvasTex(8, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0b0c33'); gr.addColorStop(0.55, '#262a86'); gr.addColorStop(0.85, '#6d3f9d'); gr.addColorStop(1, '#c0618f'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  // a shallow light-box behind her window: the city layers are only as wide as the window recess (TW), so nothing floats outside the building
  const TW = 2.1, TX = 0.0;
  // every layer is cropped to the window band (group-local y YA..YB) so nothing of the view box can stick out above/below the building's walls
  const YA = -0.45, YB = 1.25;
  const mk = (tex, w, h, x, y, z, op = 1) => { const ww = Math.min(w, TW); tex.wrapS = T.RepeatWrapping; tex.repeat.set(ww / w, 1); tex.offset.x = (1 - ww / w) * (0.3 + 0.3 * Math.abs(x));
    const lo = Math.max(YA, y - h / 2), hi = Math.min(YB, y + h / 2); if (hi <= lo) return null; const g = new T.PlaneGeometry(ww, hi - lo); g.translate(0, (hi + lo) / 2 - y, 0); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) * (hi - lo) + (lo - (y - h / 2))) / h);
    const m = new T.Mesh(g, new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: op, fog: false, depthWrite: false })); m.position.set(0, y, z); m.frustumCulled = false; group.add(m); return m; };
  const far = layer(5, 40, 90, 330, 16, 38, '#3a3fa4', ['#ffd166', '#fff3d6', '#7fe3c4'], 0.30, 'rgba(255,150,120,0.28)');
  const mid = layer(9, 12, 120, 390, 26, 60, '#222880', ['#ffd166', '#ffb347', '#fff3d6', '#a9b0ff'], 0.40, 'rgba(255,160,90,0.20)');
  const near = layer(21, 0, 80, 300, 40, 110, '#0f1048', ['#ffd166', '#ffb347', '#fff3d6'], 0.42, null);
  const Z0 = -3.4; mk(sky, 4.6, 3.2, 0, 0.6, Z0 - 0.9); mk(far, 4.0, 4.0 * H / W, 0, 0.25, Z0); mk(mid, 3.2, 3.2 * H / W, 0.25, 0.0, Z0 + 0.45); mk(near, 2.6, 2.6 * H / W, -0.4, -0.2, Z0 + 0.8);
  const stars = new T.Points(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(Array.from({ length: 110 }, (_, i) => [(R() - 0.5) * (TW - 0.1), 0.55 + R() * 0.65, Z0 - 0.8]).flat(), 3)), new T.PointsMaterial({ color: 0xffffff, size: 2.0, sizeAttenuation: false, transparent: true, opacity: 0.8, fog: false, depthWrite: false })); group.add(stars);
  const moon = kit.halo(0xfff3d6, 0.9); moon.scale.set(0.4, 0.4, 1); moon.position.set(-0.6, 1.1, Z0 - 0.7); group.add(moon);
  // elevated metro viaduct + train
  const VY = -0.30, VZ = -2.50;
  const viaduct = new T.Mesh(new T.BoxGeometry(TW, 0.06, 0.2), new T.MeshBasicMaterial({ color: 0x13154f, fog: false })); viaduct.position.set(0, VY - 0.075, VZ - 0.02); group.add(viaduct);
  const rail = new T.Mesh(new T.BoxGeometry(TW, 0.012, 0.22), new T.MeshBasicMaterial({ color: 0x5b63e0, fog: false })); rail.position.set(0, VY - 0.04, VZ - 0.02); group.add(rail);
  for (let i = -2; i <= 2; i++) { const p = new T.Mesh(new T.BoxGeometry(0.07, 0.5, 0.12), new T.MeshBasicMaterial({ color: 0x0e1040, fog: false })); p.position.set(i * 0.45, VY - 0.36, VZ - 0.02); group.add(p); }
  const trainTex = kit.canvasTex(1536, 96, (g, w, h) => { g.fillStyle = '#2432a8'; g.fillRect(0, 0, w, h); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#7fe3c4'; g.fillRect(0, 66, w, 8);
    for (let c = 0; c < 3; c++) { const x0 = c * (w / 3); for (let i = 0; i < 9; i++) { g.fillStyle = '#fff3d6'; g.fillRect(x0 + 24 + i * 54, 16, 34, 34); } g.fillStyle = '#0b0c33'; g.fillRect(x0 + w / 3 - 5, 0, 5, h); g.fillStyle = '#ffd166'; g.fillRect(x0 + 4, 20, 8, 26); } });
  const train = new T.Mesh(new T.PlaneGeometry(1.5, 0.095), new T.MeshBasicMaterial({ map: trainTex, fog: false })); train.position.set(0, VY + 0.0, VZ); train.frustumCulled = false; train.userData.name = 'train'; group.add(train);
  const trainGlow = kit.halo(0xfff3d6, 0.45); trainGlow.scale.set(1.9, 0.4, 1); trainGlow.position.set(0, VY, VZ + 0.01); group.add(trainGlow);
  const headlamp = kit.halo(0xffffff, 0.9); headlamp.scale.set(0.16, 0.16, 1); group.add(headlamp);
  function update(t, fade = 1) { const k = ((t * 0.12) % (TW + 1.5)) - (TW + 1.5) / 2; train.position.x = k; trainGlow.position.x = k; headlamp.position.set(k + 0.75, VY, VZ + 0.02); group.visible = fade > 0.01; group.traverse((o) => { if (o.material && o.material.opacity !== undefined && o.material.transparent && !o.isSprite) o.material.opacity = Math.min(o.material.userData.o0 || (o.material.userData.o0 = o.material.opacity), 1) * fade; }); }
  return { group, update };
}
