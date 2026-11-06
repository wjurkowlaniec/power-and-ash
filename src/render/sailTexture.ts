import * as THREE from 'three';

/**
 * Painted sail canvas: an old advert for an invented soda, "Zefir", sun-bleached,
 * stained, patched and torn. Generated on a canvas, no image files.
 * UV space: u along the boom (0 = mast), v up the mast. The sail fills the triangle u + v ≤ 1.
 */
export function sailTexture(): THREE.CanvasTexture {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  let seed = 99;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const X = (u: number) => u * S, Y = (v: number) => (1 - v) * S;
  // The game camera always sees the sail's back face, so lettering is painted mirrored
  // and reads correctly from the deck-side view.
  const text = (t: string, x: number, y: number, rot = 0) => {
    g.save(); g.translate(x, y); g.scale(-1, 1); g.rotate(-rot); g.fillText(t, 0, 0); g.restore();
  };

  // canvas cloth
  g.fillStyle = '#d9d0bf';
  g.fillRect(0, 0, S, S);
  // horizontal panel seams
  g.strokeStyle = '#00000018'; g.lineWidth = 3;
  for (let v = 0.12; v < 1; v += 0.13) { g.beginPath(); g.moveTo(0, Y(v)); g.lineTo(S, Y(v) - 20); g.stroke(); }

  // --- the advert
  const cx = X(0.31), cy = Y(0.3);
  // sunburst rays
  g.save(); g.translate(cx, cy);
  for (let i = 0; i < 24; i++) {
    g.rotate(Math.PI / 12);
    g.fillStyle = i % 2 ? '#c9a35e33' : '#c9a35e18';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(S * 0.42, -S * 0.05); g.lineTo(S * 0.42, S * 0.05); g.closePath(); g.fill();
  }
  g.restore();
  // big disc
  g.fillStyle = '#a3473a';
  g.beginPath(); g.arc(cx, cy, S * 0.2, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#e9dfca'; g.lineWidth = 10;
  g.beginPath(); g.arc(cx, cy, S * 0.185, 0, Math.PI * 2); g.stroke();
  // wave ribbon across the disc
  g.fillStyle = '#e9dfca';
  g.beginPath();
  g.moveTo(cx - S * 0.27, cy + S * 0.02);
  g.bezierCurveTo(cx - S * 0.1, cy - S * 0.06, cx + S * 0.08, cy + S * 0.1, cx + S * 0.27, cy + S * 0.0);
  g.lineTo(cx + S * 0.27, cy + S * 0.06);
  g.bezierCurveTo(cx + S * 0.08, cy + S * 0.16, cx - S * 0.1, cy + S * 0.0, cx - S * 0.27, cy + S * 0.08);
  g.closePath(); g.fill();
  // lettering
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#f1e8d4';
  g.font = `italic 900 ${S * 0.12}px Georgia, "Times New Roman", serif`;
  text('Zefir', cx, cy - S * 0.065, -0.08);
  g.fillStyle = '#7c3128';
  g.font = `700 ${S * 0.03}px "Courier New", monospace`;
  text('ORANŻADA · GAZOWANA', cx, cy + S * 0.05);
  g.fillStyle = '#f1e8d4';
  g.font = `700 ${S * 0.026}px "Courier New", monospace`;
  text('ORZEŹWIA OD 1961', cx, cy + S * 0.135);
  // slogan above
  g.fillStyle = '#5b5a55';
  g.font = `italic 700 ${S * 0.038}px Georgia, serif`;
  text('pij zimną!', X(0.25), Y(0.6));
  // number on the upper sail like a racing yacht
  g.fillStyle = '#3d3c3a';
  g.font = `900 ${S * 0.09}px Georgia, serif`;
  text('Ż 7', X(0.16), Y(0.78));

  // --- degradation
  const img = g.getImageData(0, 0, S, S);
  const d = img.data;
  for (let y = 0; y < S; y++) {
    const v = 1 - y / S;
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const u = x / S;
      // sun bleaching: stronger towards the top and the leech, plus streaks
      const streak = 0.5 + 0.5 * Math.sin(x * 0.045 + Math.sin(y * 0.01) * 3);
      const bleach = 0.38 + v * 0.3 + u * 0.15 + streak * 0.08;
      const grain = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 * 18;
      for (let k = 0; k < 3; k++) {
        const base = d[i + k];
        const faded = base + (222 - base) * Math.min(0.85, bleach);
        d[i + k] = faded * 0.96 + grain;
      }
    }
  }
  g.putImageData(img, 0, 0);
  // tea-coloured water stains
  for (let n = 0; n < 14; n++) {
    const x = r() * S, y = r() * S, rad = 30 + r() * 140;
    const gr = g.createRadialGradient(x, y, rad * 0.2, x, y, rad);
    gr.addColorStop(0, '#8a6a4000'); gr.addColorStop(0.8, '#7a5a3622'); gr.addColorStop(1, '#6a4a2e00');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  // grime at the foot
  const foot = g.createLinearGradient(0, S, 0, S * 0.82);
  foot.addColorStop(0, '#3a332a66'); foot.addColorStop(1, '#3a332a00');
  g.fillStyle = foot; g.fillRect(0, S * 0.82, S, S * 0.18);
  // scratches
  g.strokeStyle = '#ffffff30'; g.lineWidth = 1.5;
  for (let n = 0; n < 60; n++) {
    const x = r() * S, y = r() * S, a = r() * Math.PI, l = 20 + r() * 90;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  // sewn patch over a tear
  const px = X(0.48), py = Y(0.47);
  g.save(); g.translate(px, py); g.rotate(0.12);
  g.fillStyle = '#b9b4a3'; g.fillRect(-60, -45, 120, 90);
  g.strokeStyle = '#4a4238'; g.lineWidth = 3; g.setLineDash([8, 7]); g.strokeRect(-54, -39, 108, 78);
  g.restore(); g.setLineDash([]);
  // holes along the leech (cut out with alpha)
  g.globalCompositeOperation = 'destination-out';
  for (let n = 0; n < 9; n++) {
    const t = r();
    const u = (1 - t) * 0.95 - 0.04 - r() * 0.05, v = t;
    const rad = 6 + r() * 16;
    g.beginPath();
    g.ellipse(X(u), Y(v), rad, rad * (0.5 + r()), r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
