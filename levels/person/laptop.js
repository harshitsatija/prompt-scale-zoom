/* A 14-inch aluminium laptop modelled to scale (keys at 19.2 mm pitch), screen showing the chat UI. Local frame: +x away from the typist (toward the screen), +z = typist's right, y up, origin = centre of the base bottom. */
import { roundedBox } from './util.js';
import { makeScreen } from './screen.js';
export function buildLaptop(ctx) {
  const { T, kit } = ctx; const g = new T.Group(); g.name = 'laptop';
  const ZC = 0.0144, P = 0.0192, D = 0.236, Wd = 0.312, BH = 0.0155, KH = 0.0026;
  const alu = kit.toon(0xb8bde6, {}), aluD = kit.toon(0x8f96d6, {}), black = kit.toon(0x1b1d4a, {});
  // base
  const base = new T.Mesh(roundedBox(T, D, BH, Wd, 0.006, 3), alu); base.position.set(D / 2, BH / 2, ZC); g.add(base);
  const deck = new T.Mesh(new T.BoxGeometry(0.1305 + 0.004, 0.0004, 0.2900 + 0.004), black); deck.position.set(0.1215, BH + 0.0001, ZC); g.add(deck);   // keyboard well
  // layout --------------------------------------------------------------------------------
  const rows = [
    { u: 0.079, keys: [['ctrl', 1.25], ['alt', 1.25], ['cmd', 1.5], [' ', 5.5], ['cmd', 1.5], ['alt', 1.25], ['←', 0.83], ['↓', 0.83], ['→', 0.83]] },
    { u: 0.0985, keys: [['shift', 2.25], ...'zxcvbnm,./'.split('').map((c) => [c, 1]), ['shift', 2.75]] },
    { u: 0.118, keys: [['caps', 1.75], ...'asdfghjkl;\''.split('').map((c) => [c, 1]), ['enter', 2.25]] },
    { u: 0.1375, keys: [['tab', 1.5], ...'qwertyuiop[]'.split('').map((c) => [c, 1]), ['\\', 1.5]] },
    { u: 0.157, keys: [['`', 1], ...'1234567890-='.split('').map((c) => [c, 1]), ['⌫', 2]] },
    { u: 0.1745, small: true, keys: [['esc', 1.5], ...Array.from({ length: 12 }, (_, i) => ['F' + (i + 1), 1.0]), ['⏻', 1.0]] } ];
  const keys = []; const byLabel = {};
  rows.forEach((r) => { let c = 0; const tot = r.keys.reduce((a, k) => a + k[1], 0); const sc = 15 / tot; r.keys.forEach(([lab, w]) => { const ww = w * sc; const cc = c + ww / 2; c += ww; const z = (cc - 6.75) * P, x = r.u; const k = { lab, x, z, w: ww * P - 0.0022, d: (r.small ? 0.0108 : 0.0165), h: r.small ? KH * 0.8 : KH, small: !!r.small }; keys.push(k); (byLabel[lab] = byLabel[lab] || []).push(k); }); });
  const kg = roundedBox(T, 1, 1, 1, 0.1, 2); const keyMat = kit.toon(0xffffff, {}); keyMat.vertexColors = false;
  const km = kit.inst(kg, keyMat, keys.length); km.instanceColor = new T.InstancedBufferAttribute(new Float32Array(keys.length * 3), 3);
  const cKey = new T.Color(0x2d3170), cKeyHi = new T.Color(0xff9f1c), tmp = new T.Color();
  const glow = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.0, blending: T.AdditiveBlending, depthWrite: false, fog: false })); glow.visible = false;
  const gm = kit.inst(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xffa83a, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.9 }), keys.length);
  const press = new Float32Array(keys.length);
  function setKeys() { keys.forEach((k, i) => { const p = press[i]; kit.put(km, i, k.x, BH + k.h / 2 + KH * 0.25 - p * 0.0014, k.z, k.w, k.h, k.d); tmp.copy(cKey).lerp(cKeyHi, Math.min(1, p * 1.2)); km.setColorAt(i, tmp); kit.put(gm, i, k.x, BH + KH * 1.18 - p * 0.0014, k.z, k.w * (0.35 + 1.5 * p), 1, k.d * (0.35 + 1.5 * p)); gm.setColorAt && 0; if (p < 0.01) kit.put(gm, i, k.x, BH, k.z, 1e-6, 1e-6, 1e-6); }); km.instanceMatrix.needsUpdate = true; gm.instanceMatrix.needsUpdate = true; km.instanceColor.needsUpdate = true; }
  g.add(km); g.add(gm);
  // legends
  const LW = 2048, LH = Math.round(2048 * 0.1305 / 0.29); const leg = kit.canvasTex(LW, LH, (c, w, h) => { c.clearRect(0, 0, w, h); const sx = w / 0.29, sy = h / 0.1305; c.fillStyle = 'rgba(226,230,255,0.82)'; c.textAlign = 'center'; c.textBaseline = 'middle'; keys.forEach((k) => { const px = (k.z - ZC + 0.145) * sx, py = ((0.1215 + 0.06525) - k.x) * sy; c.font = (k.lab.length > 1 ? 26 : 38) * (w / 2048) + 'px Helvetica,Arial,sans-serif'; if (k.lab === ' ') return; c.fillText(k.lab.length > 1 ? k.lab : k.lab.toUpperCase(), px, py); }); }); leg.anisotropy = 8;
  const legMesh = new T.Mesh(new T.PlaneGeometry(0.29, 0.1305), new T.MeshBasicMaterial({ map: leg, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, fog: false })); legMesh.rotation.x = -Math.PI / 2; legMesh.rotation.z = Math.PI / 2; legMesh.rotation.z = 0; legMesh.position.set(0.1215, BH + KH * 1.32, ZC); legMesh.rotation.set(-Math.PI / 2, 0, -Math.PI / 2); g.add(legMesh);
  // trackpad
  const tp = new T.Mesh(roundedBox(T, 0.074, 0.0006, 0.118, 0.006, 2), kit.toon(0xc9cdf5, {})); tp.position.set(0.040, BH + 0.0003, ZC); g.add(tp);
  // hinge + lid
  const hinge = new T.Group(); hinge.position.set(D - 0.002, BH * 0.9, ZC); g.add(hinge); hinge.rotation.z = -16 * Math.PI / 180;   // lid open 106 deg: leans 16 deg back (toward +x)
  const lid = new T.Group(); hinge.add(lid);
  const LHt = 0.2, LT = 0.0048; const shell = new T.Mesh(roundedBox(T, LT, LHt, Wd, 0.005, 3), alu); shell.position.set(-LT / 2, LHt / 2, 0); lid.add(shell);
  const bez = new T.Mesh(new T.BoxGeometry(0.0006, LHt - 0.01, Wd - 0.012), black); bez.position.set(-LT - 0.0001, LHt / 2, 0); lid.add(bez);
  const scr = makeScreen(ctx); const sw = Wd - 0.022, sh = sw * 0.625; const sm = new T.MeshBasicMaterial({ map: scr.tex, toneMapped: false, fog: false }); sm.color.setScalar(1.18);
  const screen = new T.Mesh(new T.PlaneGeometry(sw, Math.min(sh, LHt - 0.018)), sm); screen.rotation.y = -Math.PI / 2; screen.position.set(-LT - 0.0005, LHt / 2 - 0.001, 0); lid.add(screen);
  const cam = new T.Mesh(new T.CircleGeometry(0.0013, 10), kit.toon(0x0a0b22, {})); cam.rotation.y = -Math.PI / 2; cam.position.set(-LT - 0.0007, LHt - 0.0055, 0); lid.add(cam);
  // keyboard-key lookup for the typing timeline
  const find = (ch) => { const lab = ch === ' ' ? ' ' : (ch === '?' ? '/' : ch.toLowerCase()); const arr = byLabel[lab] || byLabel[ch]; return arr ? keys.indexOf(arr[0]) : -1; };
  const shiftIdx = keys.indexOf((byLabel['shift'] || [])[1] || (byLabel['shift'] || [])[0]);
  function update(t, S) {
    press.fill(0);
    const PR = ctx.timeline.PROMPT;
    for (const [i, age] of S.ages || []) { const ch = PR[i]; const a = age < 0.04 ? age / 0.04 : age < 0.12 ? 1 : Math.exp(-(age - 0.12) / 0.16); const idx = find(ch); if (idx >= 0) press[idx] = Math.max(press[idx], a); if (ch === '?' || ch === 'W') { const sh = (byLabel['shift'] || [])[0]; if (sh) press[keys.indexOf(sh)] = Math.max(press[keys.indexOf(sh)], a); } }
    if (S.sent && S.c - ctx.timeline.SEND < 0.25 && S.c >= ctx.timeline.SEND) { const idx = keys.indexOf((byLabel['enter'] || [])[0]); if (idx >= 0) press[idx] = 1 - (S.c - ctx.timeline.SEND) / 0.25; }
    setKeys(); scr.draw(S, t);
  }
  return { group: g, update, keys, hingeX: D, screenCentre: () => new T.Vector3(D, 0.1, 0), scr };
}
