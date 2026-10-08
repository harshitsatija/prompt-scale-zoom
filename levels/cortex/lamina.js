/* cortex/lamina.js: the cortical-depth ruler along the left edge of the section at wide fields: thin tinted layer swatches (I..VI, white matter), layer-boundary
 * ticks and an amber 'grey matter ~2.7 mm' dimension bracket spanning pia to the white-matter boundary, with end caps. Flat, unlit, kept inside the frame margin. */
import { LAYERS, MM } from './field.js';
export function makeLamina(ctx) {
  const { T } = ctx, g = new T.Group(), box = new T.BoxGeometry(1, 1, 1);
  const col = { I: 0x9a9cf5, II: 0x4a4fd0, III: 0x7a82ee, IV: 0x2fc7b0, V: 0xc58cf0, VI: 0x6f93f0, WM: 0xf0e4c8 };
  const mk = (c, o = 1) => { const m = new T.Mesh(box, new T.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthTest: false, depthWrite: false })); m.frustumCulled = false; m.renderOrder = 600; m.userData.keepOrder = true; g.add(m); return m; };
  const sw = LAYERS.map((L) => ({ L, m: mk(col[L.n], 0.9) }));
  const spine = mk(0xffb347, 1), capA = mk(0xffb347, 1), capB = mk(0xffb347, 1), ticks = LAYERS.map(() => mk(0xfff3d6, 0.9));
  const mm = [1, 2, 3].map(() => mk(0xfff3d6, 0.85));
  // compressed whole-depth key (an inset diagram, not to scale) shown while the frame is too small to hold pia and white matter together: a dark panel, the six laminae and
  // the white matter as swatches at their real fractions, and an amber bracket marking which depth range the main frame is looking at
  const panel = mk(0x0b0d2e, 0.66), win = mk(0xffffff, 0.2), winA = mk(0xffb347, 1), winB = mk(0xffb347, 1), gm = mk(0xffb347, 1);
  const bounds = LAYERS.map(() => mk(0x0b0d2e, 0.9));
  panel.renderOrder = 598; bounds.forEach((m) => { m.renderOrder = 599; }); win.renderOrder = 600; [winA, winB, gm].forEach((m) => { m.renderOrder = 601; });
  const ins = { on: false, x: 0, top: 0, k: 1, dot: 0 };
  g.visible = false;
  return { g, ins, update(fx, fy, W, dl) {
    const top = fy + 0.31 * W, bot = fy - 0.25 * W, full = (top - bot) > 3.75 * MM && top > 0.1 * MM && bot < -3.55 * MM;
    const on = W > 0.9e-3; g.visible = on;
    { const px0 = W / 1600, ok = on && !full, H = 0.43 * W, k = H / (3.6 * MM), xi = fx + 0.455 * W, wI = 11 * px0, y0 = top - 0.075 * W;
      ins.on = ok; ins.x = xi; ins.top = y0; ins.k = k; ins.dot = xi - wI * 0.9;
      [panel, win, winA, winB, gm].forEach((m) => { m.visible = ok; }); bounds.forEach((m) => { m.visible = ok; });
      if (ok) {
        panel.position.set(xi, y0 - H / 2 - 0.01 * W, -1e-8); panel.scale.set(wI * 3.2, H + 0.06 * W, 1e-7);
        sw.forEach(({ L, m }) => { }); // swatches of the real ruler stay; inset swatches are the boundary strips below
        LAYERS.forEach((L, i) => { const a = L.a * MM * k, b = Math.min(L.b, 3.6) * MM * k, m = bounds[i]; m.material.color.set(col[L.n]); m.material.opacity = 0.95; m.position.set(xi, y0 - (a + b) / 2, 1e-8); m.scale.set(wI, b - a - 1.2 * px0, 1e-7); });
        const wt = Math.max(top, 0), wb = Math.max(bot, -3.6 * MM), ya = y0 - (-Math.min(0, top)) * k, yb = y0 - (-wb) * k; // window in depth: from -top.. clipped to the slab
        const d0 = Math.max(0, -top), d1 = Math.min(3.6 * MM, -bot); const yA = y0 - d0 * k, yB = y0 - d1 * k;
        win.position.set(xi, (yA + yB) / 2, 2e-8); win.scale.set(wI * 1.5, yA - yB, 1e-7);
        winA.position.set(xi - wI * 1.2, yA, 3e-8); winA.scale.set(wI * 0.9, 2 * px0, 1e-7); winB.position.set(xi - wI * 1.2, yB, 3e-8); winB.scale.set(wI * 0.9, 2 * px0, 1e-7);
        gm.position.set(xi + wI * 1.05, y0 - 2.7 * MM * k / 2, 3e-8); gm.scale.set(2 * px0, 2.7 * MM * k, 1e-7);
        void wt; void ya; void yb;
      } }
    if (!on) return;
    const px = W / 1600, xs = fx - 0.455 * W, wS = 7 * px, t = 2.2 * px, G = 2.7 * MM;
    sw.forEach(({ L, m }) => { const b = Math.min(L.b, 3.6) * MM, a = L.a * MM; m.position.set(xs, -(a + b) / 2, 0); m.scale.set(wS, b - a - 1.6 * px, 1e-7); });
    ticks.forEach((m, i) => { const L = LAYERS[i]; m.position.set(xs + wS * 1.3, -L.a * MM, 0); m.scale.set(wS * 1.6, t * 0.7, 1e-7); });
    mm.forEach((m, i) => { m.position.set(xs - wS * 1.1, -(i + 1) * MM, 0); m.scale.set(wS * 1.8, t * 0.6, 1e-7); });
    spine.position.set(xs - wS * 1.6, -G / 2, 0); spine.scale.set(t, G, 1e-7);
    capA.position.set(xs - wS * 1.6 + 5 * px, 0, 0); capA.scale.set(12 * px, t, 1e-7); capB.position.set(xs - wS * 1.6 + 5 * px, -G, 0); capB.scale.set(12 * px, t, 1e-7);
  } };
}
