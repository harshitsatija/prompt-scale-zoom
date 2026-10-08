/* The laptop screen: a chat UI drawn to a canvas, driven by the typing timeline (typed chars, caret, send, thinking dots, streaming reply). */
export function makeScreen(ctx) {
  const { T, kit, timeline } = ctx; const W = 1024, H = 640;
  const tex = kit.canvasTex(W, H, () => {}); tex.anisotropy = 8; tex.minFilter = T.LinearMipmapLinearFilter;
  const cv = tex.userData.cv, g = tex.userData.ctx; let lastKey = '';
  const PR = timeline.PROMPT, RP = timeline.REPLY;
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const wrap = (txt, maxW, font) => { g.font = font; const words = txt.split(' '); const lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; };
  const FONT = '"Inter","Helvetica Neue",Helvetica,Arial,sans-serif';
  const chats = ['Bangalore weather this week', 'Idli batter fermentation', 'Explain transformers simply', 'Trip to Hampi, 3 days', 'Fix my cover letter', 'Why is the sky blue?'];
  function draw(S, t) {
    const typed = S.sent ? PR.length : S.typed, caret = S.caret;
    const key = [typed, S.sent ? 1 : 0, Math.floor((S.send || 0) * 20), S.reply, caret ? 1 : 0, Math.floor(S.c * 3)].join('|'); if (key === lastKey) return; lastKey = key;
    g.clearRect(0, 0, W, H);
    // window chrome
    g.fillStyle = '#14163f'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1c1f6b'; g.fillRect(0, 0, W, 44); for (let i = 0; i < 3; i++) { g.fillStyle = ['#ff6b6b', '#ffd166', '#7fe3c4'][i]; g.beginPath(); g.arc(28 + i * 26, 22, 7, 0, 7); g.fill(); }
    g.fillStyle = '#a9b0ff'; g.font = '600 20px ' + FONT; g.textAlign = 'center'; g.fillText('Assistant', W / 2 + 120, 29); g.textAlign = 'left';
    // sidebar
    g.fillStyle = '#0f1136'; g.fillRect(0, 44, 250, H - 44);
    g.fillStyle = '#ff9f1c'; rr(18, 60, 214, 46, 12); g.fill(); g.fillStyle = '#14163f'; g.font = '700 22px ' + FONT; g.fillText('+  New chat', 38, 91);
    g.font = '500 19px ' + FONT; chats.forEach((c, i) => { const y = 150 + i * 52; if (i === chats.length - 1) { g.fillStyle = 'rgba(169,176,255,0.14)'; rr(12, y - 28, 226, 42, 10); g.fill(); } g.fillStyle = i === chats.length - 1 ? '#fff3d6' : '#8d96f0'; g.fillText(c.length > 24 ? c.slice(0, 23) + '…' : c, 26, y); });
    // main area
    const mx = 280, mw = W - mx - 30;
    // conversation
    let y = 110;
    if (S.sent) {
      g.font = '500 40px ' + FONT; const lines = wrap(PR, mw * 0.62, g.font); const bw = Math.max(...lines.map((l) => g.measureText(l).width)) + 56, bh = lines.length * 52 + 30;
      const bx = W - 30 - bw; g.fillStyle = '#2c3399'; rr(bx, y, bw, bh, 26); g.fill(); g.fillStyle = '#fff3d6'; lines.forEach((l, i) => g.fillText(l, bx + 28, y + 52 + i * 52)); y += bh + 34;
      const thinking = S.c >= timeline.SEND && S.c < timeline.REPLY_T;
      // avatar spark
      g.fillStyle = '#ff9f1c'; g.beginPath(); g.arc(mx + 22, y + 24, 20, 0, 7); g.fill(); g.fillStyle = '#14163f'; g.font = '700 26px ' + FONT; g.fillText('✦', mx + 9, y + 34);
      if (thinking) { const n = Math.floor(S.c * 3.2) % 4; for (let i = 0; i < 3; i++) { g.fillStyle = i < n ? '#ffd166' : '#4a50b0'; g.beginPath(); g.arc(mx + 82 + i * 30, y + 25, 9, 0, 7); g.fill(); } }
      else if (S.reply > 0) { g.fillStyle = '#e8e9ff'; g.font = '500 36px ' + FONT; const txt = RP.slice(0, S.reply); const lines = wrap(txt, mw - 80, g.font); lines.forEach((l, i) => g.fillText(l, mx + 62, y + 36 + i * 48)); if (caret && S.reply < RP.length) { const li = lines.length - 1; const w = g.measureText(lines[li]).width; g.fillStyle = '#ffd166'; g.fillRect(mx + 66 + w, y + 36 + li * 48 - 30, 6, 38); } }
    } else {
      g.fillStyle = '#6a71d8'; g.font = '500 30px ' + FONT; g.fillText('Good evening. What are you curious about?', mx + 6, 160);
    }
    // input box
    const iy = H - 126, ih = 92; g.fillStyle = '#0f1136'; rr(mx, iy, mw, ih, 28); g.fill(); g.strokeStyle = typed > 0 && !S.sent ? '#ff9f1c' : '#3a3fb5'; g.lineWidth = 3; rr(mx, iy, mw, ih, 28); g.stroke();
    if (!S.sent) {
      g.font = '500 42px ' + FONT; const txt = PR.slice(0, typed); g.fillStyle = typed ? '#fff3d6' : '#5b63e0'; g.fillText(typed ? txt : 'Message the assistant', mx + 30, iy + 60);
      if (caret || (S.sinceKey >= 0 && S.sinceKey < 0.4)) { const w = typed ? g.measureText(txt).width : 0; g.fillStyle = '#ff9f1c'; g.fillRect(mx + 32 + w, iy + 20, 5, 54); }
    } else { g.font = '500 36px ' + FONT; g.fillStyle = '#5b63e0'; g.fillText('Message the assistant', mx + 30, iy + 58); }
    g.fillStyle = '#ff9f1c'; g.beginPath(); g.arc(mx + mw - 48, iy + ih / 2, 28, 0, 7); g.fill(); g.fillStyle = '#14163f'; g.font = '700 34px ' + FONT; g.textAlign = 'center'; g.fillText('↑', mx + mw - 48, iy + ih / 2 + 12); g.textAlign = 'left';
    tex.needsUpdate = true;
  }
  return { tex, draw };
}
