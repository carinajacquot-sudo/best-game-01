// keyart.js: 100% procedural canvas synthwave key-art rendering.

function createSeededRand(seed = 1337) {
  let s = seed >>> 0;
  return function() {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function drawKeyArt(ctx, w = 1280, h = 720, rand = createSeededRand(1337)) {
  ctx.save();

  // 1. Deep sky: vertical linear gradient
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#030014');
  sky.addColorStop(0.35, '#12082b');
  sky.addColorStop(0.7, '#2a0b3d');
  sky.addColorStop(1, '#3d1030');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // 2. Faint nebula (5 large radial gradients in upper half) + ~140 tiny stars
  for (let i = 0; i < 5; i++) {
    const nx = rand() * w;
    const ny = rand() * (h * 0.55);
    const nr = (150 + rand() * 200) * (w / 1280);
    const alpha = 0.10 + rand() * 0.06;
    const isMagenta = rand() < 0.5;
    const rad = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
    rad.addColorStop(0, isMagenta ? `rgba(255,0,127,${alpha})` : `rgba(157,0,255,${alpha})`);
    rad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, w, h);
  }

  for (let i = 0; i < 140; i++) {
    const sx = rand() * w;
    const sy = rand() * (h * 0.7);
    const sa = 0.2 + rand() * 0.7;
    const sr = 0.8 + rand() * 1.2;
    const rval = rand();
    ctx.fillStyle = rval < 0.1 ? `rgba(0,240,255,${sa})` : (rval < 0.2 ? `rgba(255,226,122,${sa})` : `rgba(255,255,255,${sa})`);
    ctx.fillRect(sx, sy, sr, sr);
  }

  // 5. A second, darker planet arc upper-right (drawn partially behind sun glow)
  ctx.save();
  const px = 1085 * (w / 1280);
  const py = 180 * (h / 720);
  const pr = 130 * (w / 1280);
  const pGrad = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, 10, px, py, pr);
  pGrad.addColorStop(0, '#2b0c3a');
  pGrad.addColorStop(1, '#0a0518');
  ctx.fillStyle = pGrad;
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,240,255,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // 3 & 4. A huge dying sun (radius ~185, center (640, 315))
  const sunX = 640 * (w / 1280);
  const sunY = 315 * (h / 720);
  const sunR = 185 * (w / 1280);

  ctx.save();
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR);
  sunGrad.addColorStop(0, '#ffe27a');
  sunGrad.addColorStop(0.3, '#ff9d00');
  sunGrad.addColorStop(0.6, '#ff4400');
  sunGrad.addColorStop(0.85, '#c2235f');
  sunGrad.addColorStop(1, '#7a0d4d');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  // Sun surface mottling (14 seeded dark translucent arcs/patches clipped inside sun disc)
  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.clip();

  for (let i = 0; i < 14; i++) {
    const mx = sunX + (rand() - 0.5) * sunR * 1.6;
    const my = sunY + (rand() - 0.5) * sunR * 1.6;
    const mr = (20 + rand() * 50) * (w / 1280);
    const ma = 0.25 + rand() * 0.15;
    ctx.fillStyle = `rgba(60,10,40,${ma})`;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Violent lightning crack from core to lower-right rim (9 segments)
  const pts = [{ x: sunX + 15, y: sunY + 15 }];
  let cx = pts[0].x;
  let cy = pts[0].y;
  for (let s = 0; s < 9; s++) {
    cx += (rand() - 0.3) * 55;
    cy += 35 + (rand() - 0.5) * 15;
    pts.push({ x: cx, y: cy });
  }
  pts[pts.length - 1] = { x: sunX + sunR * 0.75, y: sunY + sunR * 0.65 };

  for (let pass = 0; pass < 2; pass++) {
    ctx.save();
    if (pass === 0) {
      ctx.strokeStyle = 'rgba(255,120,255,0.55)';
      ctx.lineWidth = 6;
      ctx.shadowColor = '#ff00ff';
      ctx.shadowBlur = 24;
    } else {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let p = 1; p < pts.length; p++) {
      ctx.lineTo(pts[p].x, pts[p].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Smaller secondary crack to the left, thinner
  const pts2 = [{ x: sunX - 5, y: sunY + 5 }];
  let cx2 = pts2[0].x;
  let cy2 = pts2[0].y;
  for (let s = 0; s < 6; s++) {
    cx2 -= 15 + rand() * 25;
    cy2 += 25 + rand() * 15;
    pts2.push({ x: cx2, y: cy2 });
  }
  ctx.save();
  ctx.strokeStyle = 'rgba(255,180,255,0.5)';
  ctx.lineWidth = 1.2;
  ctx.shadowColor = '#ff00ff';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(pts2[0].x, pts2[0].y);
  for (let p = 1; p < pts2.length; p++) {
    ctx.lineTo(pts2[p].x, pts2[p].y);
  }
  ctx.stroke();
  ctx.restore();

  ctx.restore(); // end sun clip

  // Rim ring: second arc stroke #ff2d95 glow + thinner #00f0ff hairline rim offset
  ctx.save();
  ctx.strokeStyle = '#ff2d95';
  ctx.lineWidth = 6;
  ctx.shadowColor = '#ff007f';
  ctx.shadowBlur = 60;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(0,240,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR + 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.restore(); // end sun save

  // 6. Dead neon city along the bottom (three parallax silhouette layers)
  const cityLayers = [
    { color: '#160a2e', minH: 60, maxH: 170, wMin: 30, wMax: 70, hasWindows: false },
    { color: '#1f0d3f', minH: 90, maxH: 260, wMin: 40, wMax: 90, hasWindows: true },
    { color: '#2a0d4a', minH: 40, maxH: 140, wMin: 35, wMax: 80, hasWindows: true }
  ];

  let buildingIndex = 0;
  for (let li = 0; li < cityLayers.length; li++) {
    const layer = cityLayers[li];
    ctx.fillStyle = layer.color;
    let bx = 0;
    while (bx < w) {
      const bw = (layer.wMin + rand() * (layer.wMax - layer.wMin)) * (w / 1280);
      const bh = (layer.minH + rand() * (layer.maxH - layer.minH)) * (h / 720);
      const by = h - bh;

      // Reset the fill per building — window/beacon painting above leaves
      // ctx.fillStyle set to the last window tint otherwise.
      ctx.fillStyle = layer.color;
      ctx.fillRect(bx, by, bw + 1, bh);

      if (layer.hasWindows) {
        if (buildingIndex === 7 && li === 2) {
          // Destroyed tower with exposed glowing grid interior
          ctx.save();
          const gx = bx + 4;
          const gy = by + 10;
          const gw = bw - 8;
          const gh = bh - 10;
          const gridGrad = ctx.createLinearGradient(gx, gy, gx, gy + gh);
          gridGrad.addColorStop(0, 'rgba(255,119,0,0.8)');
          gridGrad.addColorStop(1, 'rgba(255,0,127,0.8)');
          ctx.fillStyle = gridGrad;
          ctx.fillRect(gx, gy, gw, gh);

          ctx.strokeStyle = '#3d1030';
          ctx.lineWidth = 2;
          ctx.strokeRect(gx, gy, gw, gh);

          for (let row = gy + 6; row < gy + gh - 6; row += 10) {
            for (let col = gx + 6; col < gx + gw - 6; col += 10) {
              if (rand() < 0.6) {
                ctx.fillStyle = rand() < 0.5 ? '#ffe27a' : '#ff007f';
                ctx.shadowColor = '#ff007f';
                ctx.shadowBlur = 6;
                ctx.fillRect(col, row, 4, 4);
              }
            }
          }
          ctx.restore();
        } else {
          // Normal windows: 3x5 rects, 30% lit
          for (let wy = by + 10; wy < h - 15; wy += 12) {
            for (let wx = bx + 6; wx < bx + bw - 6; wx += 10) {
              if (rand() < 0.3) {
                const rval = rand();
                if (rval < 0.6) ctx.fillStyle = 'rgba(0,240,255,0.5)';
                else if (rval < 0.85) ctx.fillStyle = 'rgba(255,0,127,0.5)';
                else ctx.fillStyle = 'rgba(255,179,0,0.55)';
                ctx.fillRect(wx, wy, 3, 5);
              }
            }
          }

          // Horizontal strips (lit floors) on 2-3 towers
          if (buildingIndex % 5 === 2) {
            ctx.fillStyle = 'rgba(0,240,255,0.4)';
            ctx.fillRect(bx + 4, by + bh * 0.4, bw - 8, 3);
            ctx.fillRect(bx + 4, by + bh * 0.7, bw - 8, 3);
          }
        }

        // Antenna spires with red/cyan beacon dots
        if (rand() < 0.25) {
          ctx.strokeStyle = '#12082b';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bx + bw * 0.5, by);
          ctx.lineTo(bx + bw * 0.5, by - 25 - rand() * 25);
          ctx.stroke();

          const beaconColor = rand() < 0.5 ? '#ff0055' : '#00f0ff';
          ctx.fillStyle = beaconColor;
          ctx.shadowColor = beaconColor;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(bx + bw * 0.5, by - 25 - rand() * 25, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      bx += bw - 2;
      buildingIndex++;
    }
  }

  // 7. A lone starship silhouette upper-left at (~180, 150), angled -20°
  ctx.save();
  const shipX = 180 * (w / 1280);
  const shipY = 150 * (h / 720);
  ctx.translate(shipX, shipY);
  ctx.rotate(-20 * Math.PI / 180);

  ctx.fillStyle = '#070313';
  ctx.strokeStyle = 'rgba(0,240,255,0.75)';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 12;

  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.lineTo(-20, -14);
  ctx.lineTo(-10, -3);
  ctx.lineTo(-25, 0);
  ctx.lineTo(-25, 6);
  ctx.lineTo(-10, 3);
  ctx.lineTo(-20, 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Engine trail (long lightning bolt curve from engines to left edge)
  ctx.save();
  const trailEx = shipX - Math.cos(-20 * Math.PI / 180) * 25;
  const trailEy = shipY - Math.sin(-20 * Math.PI / 180) * 25;
  for (let pass = 0; pass < 2; pass++) {
    const trailGrad = ctx.createLinearGradient(0, trailEy, trailEx, trailEy);
    trailGrad.addColorStop(0, 'rgba(255,255,255,0)');
    trailGrad.addColorStop(0.5, 'rgba(0,240,255,0.4)');
    trailGrad.addColorStop(1, '#ffffff');

    ctx.strokeStyle = trailGrad;
    ctx.lineWidth = pass === 0 ? 5 : 1.5;
    if (pass === 0) {
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 15;
    }
    ctx.beginPath();
    ctx.moveTo(0, trailEy + (rand() - 0.5) * 10);
    ctx.bezierCurveTo(trailEx * 0.3, trailEy - 30, trailEx * 0.7, trailEy + 20, trailEx, trailEy);
    ctx.stroke();
  }
  ctx.restore();

  // 8. Horizon haze band: radial gradient centered (640, 560) fading to transparent
  ctx.save();
  const hx = 640 * (w / 1280);
  const hy = 560 * (h / 720);
  const hr = 500 * (w / 1280);
  const hGrad = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
  hGrad.addColorStop(0, 'rgba(255,0,127,0.30)');
  hGrad.addColorStop(0.5, 'rgba(157,0,255,0.15)');
  hGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hGrad;
  ctx.fillRect(0, h * 0.5, w, h * 0.5);
  ctx.restore();

  // 9. Light rain: 40 short diagonal streaks in upper third
  ctx.save();
  for (let i = 0; i < 40; i++) {
    const rx = rand() * w;
    const ry = rand() * (h * 0.43);
    const rlen = 15 + rand() * 25;
    const ralpha = 0.05 + rand() * 0.09;
    const rcol = rand() < 0.5 ? `rgba(0,240,255,${ralpha})` : `rgba(255,255,255,${ralpha})`;
    ctx.strokeStyle = rcol;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx - 6, ry + rlen);
    ctx.stroke();
  }
  ctx.restore();

  // 10. Vignette + very subtle film grain
  ctx.save();
  const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(0.7, 'rgba(0,0,0,0.42)');
  vig.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let i = 0; i < 250; i++) {
    const gx = rand() * w;
    const gy = rand() * h;
    ctx.fillRect(gx, gy, 1, 1);
  }
  ctx.restore();

  ctx.restore();
}

export function keyArtCanvas(w = 1280, h = 720) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const rand = createSeededRand(1337);
  drawKeyArt(ctx, w, h, rand);
  return canvas;
}
