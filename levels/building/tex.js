/* Procedural-but-observed textures baked to canvas: plaster grain, asphalt, facade tiles (day + lit windows), cement-block wall, AC grille, shop signs.
 * References: Wikimedia Commons photos of Bangalore apartment blocks (refs/building/apt*.jpg), street photos (street*.jpg). */
import { kit, T } from './deps.js';
import { rng } from './gb.js';

const wrapTex = (t, rx = 1, ry = 1) => { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; return t; };
const pickOf = (r, a) => a[Math.floor(r() * a.length) % a.length];
function tiled(x, w, h, fn) { for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { x.save(); x.translate(ox, oy); fn(); x.restore(); } }

export function plasterTex(vertical = true) {
  const r = rng(vertical ? 7 : 8);
  return wrapTex(kit.canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#efecf8'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { const px = r() * w, py = r() * h, rr = 30 + r() * 90; tiled(x, w, h, () => { const g = x.createRadialGradient(px, py, 0, px, py, rr); const d = r() < 0.5; g.addColorStop(0, d ? 'rgba(120,110,150,0.06)' : 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }); }
    if (vertical) for (let i = 0; i < 16; i++) { const px = r() * w, py = r() * h, L = 40 + r() * 110, ww = 2 + r() * 8; tiled(x, w, h, () => { const g = x.createLinearGradient(0, py, 0, py + L); g.addColorStop(0, 'rgba(70,60,100,0.0)'); g.addColorStop(0.12, 'rgba(70,60,100,0.035)'); g.addColorStop(1, 'rgba(70,60,100,0)'); x.fillStyle = g; x.fillRect(px, py, ww, L); }); }
    const id = x.getImageData(0, 0, w, h), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 10; d[i] += n; d[i + 1] += n; d[i + 2] += n; } x.putImageData(id, 0, 0);
  }));
}

export function asphaltTex() {
  const r = rng(21);
  return wrapTex(kit.canvasTex(1024, 1024, (x, w, h) => {
    x.fillStyle = '#4a4a68'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { const px = r() * w, py = r() * h, rr = 24 + r() * 120; tiled(x, w, h, () => { const g = x.createRadialGradient(px, py, 0, px, py, rr); const k = r(); g.addColorStop(0, k < 0.5 ? 'rgba(30,28,48,0.28)' : 'rgba(150,145,175,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }); }
    // tyre tracks (darker, smoother) along u
    for (const ty of [0.3, 0.7]) { tiled(x, w, h, () => { const g = x.createLinearGradient(0, ty * h - 60, 0, ty * h + 60); g.addColorStop(0, 'rgba(20,18,40,0)'); g.addColorStop(0.5, 'rgba(20,18,40,0.22)'); g.addColorStop(1, 'rgba(20,18,40,0)'); x.fillStyle = g; x.fillRect(0, ty * h - 60, w, 120); }); }
    // tar patches (repairs): slightly blacker rectangles with ragged edges
    for (let i = 0; i < 5; i++) { const px = r() * w, py = r() * h, pw = 60 + r() * 160, ph = 40 + r() * 100; tiled(x, w, h, () => { x.fillStyle = 'rgba(24,22,40,0.55)'; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 14; k++) { const a = k / 14; const edge = a < 0.25 ? [px + a * 4 * pw, py] : a < 0.5 ? [px + pw, py + (a - 0.25) * 4 * ph] : a < 0.75 ? [px + pw - (a - 0.5) * 4 * pw, py + ph] : [px, py + ph - (a - 0.75) * 4 * ph]; x.lineTo(edge[0] + (r() - 0.5) * 7, edge[1] + (r() - 0.5) * 7); } x.closePath(); x.fill(); x.strokeStyle = 'rgba(150,145,175,0.25)'; x.lineWidth = 1.5; x.stroke(); }); }
    // potholes
    for (let i = 0; i < 3; i++) { const px = r() * w, py = r() * h, rr = 14 + r() * 26; tiled(x, w, h, () => { x.save(); x.translate(px, py); x.rotate(r() * 3); x.scale(1, 0.6 + r() * 0.3); x.beginPath(); for (let k = 0; k <= 18; k++) { const a = k / 18 * 6.283, q = rr * (0.8 + 0.3 * r()); x.lineTo(Math.cos(a) * q, Math.sin(a) * q); } x.closePath(); x.fillStyle = 'rgba(176,170,200,0.30)'; x.fill(); x.translate(-2, -1.5); x.scale(0.82, 0.82); x.fillStyle = 'rgba(14,12,28,0.78)'; x.fill(); x.restore(); }); }
    // cracks
    x.lineCap = 'round'; for (let i = 0; i < 12; i++) { let px = r() * w, py = r() * h, a = r() * 6.28; tiled(x, w, h, () => { x.beginPath(); x.moveTo(px, py); let qx = px, qy = py, aa = a; for (let k = 0; k < 14; k++) { aa += (r() - 0.5) * 1.2; qx += Math.cos(aa) * 14; qy += Math.sin(aa) * 14; x.lineTo(qx, qy); } x.strokeStyle = 'rgba(14,12,26,0.6)'; x.lineWidth = 1.4; x.stroke(); }); }
    const id = x.getImageData(0, 0, w, h), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 16 + (r() < 0.03 ? 22 : 0); d[i] += n; d[i + 1] += n; d[i + 2] += n; } x.putImageData(id, 0, 0);
  }));
}

// Compound-wall / cement block courses (0.4 x 0.2 m blocks). tile = 2 m x 2 m
export function blockTex() {
  const r = rng(33);
  return wrapTex(kit.canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#b9b3c9'; x.fillRect(0, 0, w, h);
    const bw = w / 5, bh = h / 10;
    for (let j = 0; j < 10; j++) for (let i = -1; i < 6; i++) { const ox = (j % 2) * bw / 2; const px = i * bw + ox, py = j * bh; const v = 0.84 + r() * 0.16; x.fillStyle = `rgb(${Math.floor(190 * v)},${Math.floor(184 * v)},${Math.floor(204 * v)})`; x.fillRect(px + 2, py + 2, bw - 4, bh - 4); }
    x.strokeStyle = 'rgba(70,62,90,0.55)'; x.lineWidth = 3; for (let j = 0; j <= 10; j++) { x.beginPath(); x.moveTo(0, j * bh); x.lineTo(w, j * bh); x.stroke(); }
    for (let j = 0; j < 10; j++) for (let i = 0; i <= 5; i++) { const ox = (j % 2) * bw / 2; x.beginPath(); x.moveTo(i * bw + ox, j * bh); x.lineTo(i * bw + ox, (j + 1) * bh); x.stroke(); }
    for (let i = 0; i < 30; i++) { const px = r() * w, py = r() * h, ww = 20 + r() * 80, hh = 10 + r() * 40; x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(70,60,100,0.12)'; x.fillRect(px, py, ww, hh); }
    const id = x.getImageData(0, 0, w, h), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 18; d[i] += n; d[i + 1] += n; d[i + 2] += n; } x.putImageData(id, 0, 0);
  }));
}

export function acGrilleTex() {
  return kit.canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#d6d4e2'; x.fillRect(0, 0, w, h); x.fillStyle = '#b7b4cc'; x.fillRect(0, 0, w, 10); x.fillRect(0, h - 10, w, 10);
    x.fillStyle = '#2a2a45'; x.beginPath(); x.arc(128, 128, 100, 0, 7); x.fill();
    x.strokeStyle = '#c8c6dc'; x.lineWidth = 3; for (let r = 18; r <= 98; r += 16) { x.beginPath(); x.arc(128, 128, r, 0, 7); x.stroke(); }
    x.lineWidth = 2; for (let a = 0; a < 6.28; a += 0.2618) { x.beginPath(); x.moveTo(128 + Math.cos(a) * 14, 128 + Math.sin(a) * 14); x.lineTo(128 + Math.cos(a) * 99, 128 + Math.sin(a) * 99); x.stroke(); }
    x.fillStyle = '#9996b4'; x.beginPath(); x.arc(128, 128, 16, 0, 7); x.fill();
  });
}

export function shutterTex() {
  const r = rng(5);
  return wrapTex(kit.canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#8f93a8'; x.fillRect(0, 0, w, h); for (let j = 0; j < 16; j++) { x.fillStyle = j % 2 ? '#7a7e96' : '#a2a6bb'; x.fillRect(0, j * 16, w, 8); x.fillStyle = 'rgba(30,30,60,0.35)'; x.fillRect(0, j * 16 + 14, w, 2); } for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(120,70,40,0.09)'; x.fillRect(r() * w, r() * h, 8 + r() * 30, 20 + r() * 60); } }));
}

// ---------- facade tiles for mid / far buildings: 4 bays (3 m) x 4 floors (3.2 m) = 12 m x 12.8 m ----------
export function facadeTiles(variant = 0) {
  const W = 1024, H = 1024, cw = W / 4, ch = H / 4;
  const mk = (kind) => {
    const r = rng(100 + variant * 7 + (kind === 'e' ? 1000 : 0)); const rl = rng(500 + variant * 13);   // identical layout rng for both layers: use rl for layout
    return kit.canvasTex(W, H, (x) => {
      const lay = rng(900 + variant * 31);
      if (kind === 'd') { x.fillStyle = '#f1eef9'; x.fillRect(0, 0, W, H); } else { x.fillStyle = '#000'; x.fillRect(0, 0, W, H); }
      for (let fy = 0; fy < 4; fy++) for (let bx = 0; bx < 4; bx++) {
        const X = bx * cw, Y = fy * ch; const kindW = lay(), lit = lay() < 0.36, hue = lay(), curt = lay(), kind2 = lay(), kind3 = lay();
        const px = cw / 3, py = ch / 3.2; // pixels per metre
        const ww = (kindW < 0.15 ? 2.0 : 1.35) * px, wh = 1.25 * px, wx = X + (cw - ww) / 2, wy = Y + ch - (0.95 + 1.25) * py;
        if (kind === 'd') {
          // slab band + sill/lintel
          x.fillStyle = 'rgba(80,70,120,0.18)'; x.fillRect(X, Y + ch - 0.28 * py, cw, 0.28 * py);
          x.fillStyle = 'rgba(255,255,255,0.55)'; x.fillRect(X, Y + ch - 0.32 * py, cw, 0.05 * py);
          // balcony cell (every ~6th cell) : recess + railing lines
          if (kind3 < 0.2) { x.fillStyle = '#cdbfae'; x.fillRect(X + 0.25 * px, Y + 0.35 * py, cw - 0.5 * px, ch - 0.7 * py); x.fillStyle = '#2b2748'; x.fillRect(X + 0.5 * px, Y + 0.7 * py, cw - 1.0 * px, ch - 1.2 * py); x.strokeStyle = '#e8e4f4'; x.lineWidth = 2; for (let k = 0; k < 14; k++) { const lx = X + 0.5 * px + k * (cw - 1 * px) / 13; x.beginPath(); x.moveTo(lx, Y + ch - 1.9 * py); x.lineTo(lx, Y + ch - 0.9 * py); x.stroke(); } x.fillStyle = '#e8e4f4'; x.fillRect(X + 0.5 * px, Y + ch - 1.95 * py, cw - 1.0 * px, 4); x.fillRect(X + 0.25 * px, Y + ch - 0.95 * py, cw - 0.5 * px, 0.7 * py); if (kind2 < 0.45) { x.fillStyle = '#e97b6a'; for (let k = 0; k < 5; k++) x.fillRect(X + 0.7 * px + k * 0.5 * px, Y + ch - 2.4 * py, 0.35 * px, 0.45 * py); } }
          else {
            x.fillStyle = 'rgba(255,255,255,0.7)'; x.fillRect(wx - 0.08 * px, wy - 0.08 * px, ww + 0.16 * px, wh + 0.16 * px);   // surround
            const g = x.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, '#1d1f4d'); g.addColorStop(1, '#0a0b26'); x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
            x.fillStyle = 'rgba(180,190,255,0.14)'; x.beginPath(); x.moveTo(wx, wy + wh); x.lineTo(wx + ww * 0.45, wy); x.lineTo(wx + ww * 0.7, wy); x.lineTo(wx + ww * 0.25, wy + wh); x.fill();
            x.strokeStyle = '#eceaf7'; x.lineWidth = 3; x.beginPath(); x.moveTo(wx + ww / 2, wy); x.lineTo(wx + ww / 2, wy + wh); x.moveTo(wx, wy + wh * 0.35); x.lineTo(wx + ww, wy + wh * 0.35); x.stroke();
            x.fillStyle = 'rgba(255,255,255,0.8)'; x.fillRect(wx - 0.18 * px, wy + wh + 0.08 * px, ww + 0.36 * px, 0.09 * px); x.fillStyle = 'rgba(60,50,100,0.28)'; x.fillRect(wx - 0.1 * px, wy + wh + 0.17 * px, ww + 0.2 * px, 0.22 * py);   // sill and its shadow
            if (kind2 > 0.82) { x.fillStyle = '#e7e5ee'; x.fillRect(wx + ww * 0.1, wy + wh + 0.35 * py, ww * 0.8, 0.55 * py); x.fillStyle = '#35335a'; x.beginPath(); x.arc(wx + ww * 0.5, wy + wh + 0.62 * py, 0.2 * px, 0, 7); x.fill(); }   // AC unit
          }
        } else {
          if (lit && kind3 >= 0.2) { const pal = [[255, 205, 120], [255, 176, 92], [255, 226, 160], [250, 240, 214], [160, 214, 255], [255, 150, 120]]; const c = pal[Math.floor(hue * hue * pal.length)]; const g = x.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, `rgb(${c[0]},${c[1]},${c[2]})`); g.addColorStop(1, `rgb(${c[0] * 0.55 | 0},${c[1] * 0.5 | 0},${c[2] * 0.45 | 0})`); x.fillStyle = g; x.fillRect(wx, wy, ww, wh); if (curt < 0.5) { x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(wx, wy, ww * 0.25, wh); x.fillRect(wx + ww * 0.75, wy, ww * 0.25, wh); } x.fillStyle = '#000'; x.fillRect(wx + ww / 2 - 1.5, wy, 3, wh); }
          if (kind3 < 0.2 && lit) { x.fillStyle = 'rgb(255,190,110)'; x.fillRect(X + 0.5 * px, Y + 0.7 * py, cw - 1.0 * px, 0.6 * py); }
        }
      }
    });
  };
  const d = mk('d'), e = mk('e'); wrapTex(d); wrapTex(e); return { map: d, emissive: e };
}

export function signTex(w, h, fn) { return kit.canvasTex(w, h, (x, ww, hh) => fn(x, ww, hh)); }
export function shopSign(top, bottom, bg, fg, kn) {
  return signTex(768, 192, (x, w, h) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(0, 0, w, 10); x.fillRect(0, h - 10, w, 10);
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `700 ${kn ? 66 : 72}px "Kannada Sangam MN","Kannada MN","Noto Sans Kannada",Arial,sans-serif`; x.fillText(top, w / 2, h * 0.34);
    x.font = `700 ${kn ? 52 : 40}px "Helvetica Neue",Arial,sans-serif`; x.fillText(bottom, w / 2, h * 0.74);
  });
}

// interlocking concrete pavers (20 x 10 cm) for footpaths and the forecourt; tile = 2 m
export function paveTex() {
  const r = rng(61);
  return wrapTex(kit.canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#8f8aa4'; x.fillRect(0, 0, w, h);
    const bw = w / 10, bh = h / 20;
    for (let j = 0; j < 20; j++) for (let i = -1; i < 11; i++) { const px = i * bw + (j % 2) * bw / 2, py = j * bh; const v = 0.86 + r() * 0.2; const tint = r() < 0.05 ? [196, 160, 150] : [200, 196, 214]; x.fillStyle = `rgb(${Math.floor(tint[0] * v)},${Math.floor(tint[1] * v)},${Math.floor(tint[2] * v)})`; x.fillRect(px + 1.2, py + 1.2, bw - 2.4, bh - 2.4); }
    for (let i = 0; i < 26; i++) { const px = r() * w, py = r() * h, rr = 20 + r() * 60; tiled(x, w, h, () => { const g = x.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, r() < 0.5 ? 'rgba(40,30,70,0.18)' : 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }); }
  }));
}
// dusty compacted earth / gravel for the plots between buildings; tile = 3 m
export function earthTex() {
  const r = rng(73);
  return wrapTex(kit.canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#cfc6c0'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) { const px = r() * w, py = r() * h, rr = 10 + r() * 70; tiled(x, w, h, () => { const g = x.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, r() < 0.55 ? 'rgba(90,70,80,0.16)' : 'rgba(255,245,230,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }); }
    for (let i = 0; i < 700; i++) { x.fillStyle = r() < 0.5 ? 'rgba(80,66,80,0.35)' : 'rgba(255,250,240,0.35)'; const s = 1 + r() * 2.5; x.fillRect(r() * w, r() * h, s, s); }
    const id = x.getImageData(0, 0, w, h), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 20; d[i] += n; d[i + 1] += n; d[i + 2] += n; } x.putImageData(id, 0, 0);
  }));
}

// rain-streak / algae stain decal: transparent, dark at the top (under a sill or drip edge) and fading downwards; wraps in u
export function stainTex() {
  const r = rng(91);
  return wrapTex(kit.canvasTex(256, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { const px = r() * w, ww = 3 + r() * 14, L = 90 + r() * 166, a = 0.1 + r() * 0.22; const g = x.createLinearGradient(0, 0, 0, L); const cg = r() < 0.3 ? '60,90,70' : '70,60,92'; g.addColorStop(0, `rgba(${cg},${a})`); g.addColorStop(0.6, `rgba(${cg},${a * 0.45})`); g.addColorStop(1, `rgba(${cg},0)`); x.fillStyle = g; x.beginPath(); x.moveTo(px, 0); x.lineTo(px + ww, 0); x.lineTo(px + ww * (0.3 + r() * 0.5), L); x.lineTo(px + ww * 0.4, L); x.closePath(); x.fill(); }
    const g2 = x.createLinearGradient(0, 0, 0, h * 0.35); g2.addColorStop(0, 'rgba(70,60,92,0.22)'); g2.addColorStop(1, 'rgba(70,60,92,0)'); x.fillStyle = g2; x.fillRect(0, 0, w, h * 0.35);
  }));
}
