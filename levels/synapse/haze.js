/* Cleft depth haze: the synaptic cleft is not open space but a 23 nm layer crowded with adhesion molecules (neurexin-neuroligin ~ 2 nm rods,
 * N-cadherin 21 nm beaded rods, SynCAM, ephrin/Eph), extrasynaptic receptors and glycocalyx. Beyond the meshed receptors (z < -0.1 um) the cleft is
 * filled by five stacked, softly out-of-focus billboards of those same molecules (shapes follow the 3KG2 / 3B3Q / 3Q2W silhouettes at the correct size),
 * tinted toward the fog violet with depth, so the cut-away never opens onto an empty void.  Width 0.9 um, height = cleft. */
export function makeHaze(T, kit, rngf, YP, YQ, clip) {
  const WID = 1.5, H = YQ - YP - 0.0008, PXW = 4096, PXH = 96;       // 0.37 nm / px horizontally, 0.23 nm / px vertically
  const nmx = (nm) => nm * 1e-3 / WID * PXW, nmy = (nm) => nm * 1e-3 / H * PXH;
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
  const FOG = [36, 31, 102];
  const layers = [];
  const Z = [-0.215, -0.27, -0.34, -0.43, -0.55];   // beyond the meshed cleft proteins (which extend to ~ -0.45 um)
  Z.forEach((zz, li) => {
    const rg = rngf(900 + li * 17); const dk = 0.42 + 0.11 * li;    // depth tint
    const tex = kit.canvasTex(PXW, PXH, (x, W, Hh) => {
      x.clearRect(0, 0, W, Hh); x.filter = `blur(${(0.9 + 0.55 * li).toFixed(2)}px)`;
      if (li === Z.length - 1) { const g = x.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, 'rgba(36,31,102,0)'); g.addColorStop(0.3, 'rgba(36,31,102,0.9)'); g.addColorStop(0.7, 'rgba(36,31,102,0.9)'); g.addColorStop(1, 'rgba(36,31,102,0)'); x.fillStyle = g; x.fillRect(0, 0, W, Hh); }
      const col = (c) => rgb(mix(c, FOG, dk));
      const blob = (cx, cy, rx, ry, c, rot = 0) => { x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(rx, ry); const g = x.createRadialGradient(-0.3, -0.35, 0.05, 0, 0, 1); g.addColorStop(0, col(mix(c, [255, 245, 225], 0.45))); g.addColorStop(0.55, col(c)); g.addColorStop(1, col(mix(c, [30, 20, 90], 0.45))); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, 6.2832); x.fill(); x.restore(); };
      const rod = (pts, w, c) => { x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = col(mix(c, [20, 10, 80], 0.35)); x.lineWidth = w + 2; x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.stroke(); x.strokeStyle = col(c); x.lineWidth = w; x.stroke(); x.strokeStyle = col(mix(c, [255, 245, 230], 0.45)); x.lineWidth = Math.max(1, w * 0.3); x.translate(-w * 0.18, -w * 0.18); x.stroke(); x.setTransform(1, 0, 0, 1, 0, 0); };
      const N = 260 - li * 8;
      for (let i = 0; i < N; i++) {
        const cx = rg() * W, k = rg();
        if (k < 0.22) {            // AMPA / NMDA-like receptor standing on the postsynaptic membrane (bottom): ATD, LBD, TMD lobes
          const s = 0.8 + 0.3 * rg(); const by = Hh - nmy(1.4);
          blob(cx, by - nmy(1.6 * s), nmx(3.2 * s), nmy(1.6 * s), [235, 130, 110]);
          blob(cx - nmx(1.2 * s), by - nmy(5.2 * s), nmx(3.6 * s), nmy(2.6 * s), [255, 160, 70]); blob(cx + nmx(1.9 * s), by - nmy(5.4 * s), nmx(3.2 * s), nmy(2.4 * s), [255, 175, 85]);
          blob(cx - nmx(0.4 * s), by - nmy(9.4 * s), nmx(4.6 * s), nmy(2.9 * s), [255, 205, 100]); blob(cx + nmx(2.6 * s), by - nmy(9.2 * s), nmx(3.6 * s), nmy(2.5 * s), [255, 220, 150]);
        } else if (k < 0.5) {      // neurexin-neuroligin dimer bridge: a 2-3 nm rod across the cleft with a wider neuroligin head
          const lean = (rg() - 0.5) * nmx(6); const mid = Hh * (0.45 + 0.2 * rg());
          rod([[cx, Hh - nmy(1)], [cx + lean * 0.4, mid], [cx + lean, nmy(1.2)]], nmx(1.9), [170, 140, 255]);
          blob(cx + lean * 0.3, Hh - nmy(5.5), nmx(2.8), nmy(3.4), [190, 160, 255]); blob(cx + lean, nmy(3), nmx(2.0), nmy(2.2), [235, 130, 205]);
        } else if (k < 0.62) {     // N-cadherin ectodomain: 5 beaded Ig-like domains, 21 nm, tilted
          const lean = (rg() - 0.5) * nmx(10);
          for (let b = 0; b < 5; b++) { const t = b / 4; blob(cx + lean * t, Hh - nmy(1.5) - (Hh - nmy(3)) * t, nmx(1.7), nmy(2.0), [245, 170, 205]); }
        } else if (k < 0.78) {     // presynaptic proteins hanging from the active-zone membrane (Cav2 channel / SynCAM / neurexin)
          const s = 0.8 + 0.4 * rg();
          blob(cx, nmy(2.2 * s), nmx(2.6 * s), nmy(2.2 * s), [225, 110, 195]); blob(cx + nmx(1.2), nmy(5.3 * s), nmx(2.0 * s), nmy(1.7 * s), [245, 150, 215]);
        } else {                    // glycocalyx: small floppy glycoproteins and soluble matrix
          blob(cx, Hh * (0.15 + 0.7 * rg()), nmx(1.2 + 1.4 * rg()), nmy(1.1 + 1.2 * rg()), [200, 180, 255]);
        }
      }
    });
    const m = new T.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: li === Z.length - 1 ? 0.0 : 0.12, depthWrite: li !== Z.length - 1, side: T.DoubleSide, fog: false });
    m.clippingPlanes = [clip]; layers.push({ mat: m, z: zz });
  });
  const geo = (zz) => { const g = new T.PlaneGeometry(WID, H); g.translate(0, (YP + YQ) / 2, zz); return g; };
  return { layers, geo, WID };
}
