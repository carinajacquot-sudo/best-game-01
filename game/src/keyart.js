// keyart.js: 100% procedural canvas synthwave key-art rendering for Ember Wing.

export function createSeededRand(seed = 1337) {
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
  const sx = w / 1280;
  const sy = h / 720;

  // 1. Deep space background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#02000d');
  bg.addColorStop(0.4, '#0d0422');
  bg.addColorStop(0.75, '#1e0736');
  bg.addColorStop(1, '#2f0b2a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // 2. Cosmic nebula gas clouds (6 large soft radial gradients)
  for (let i = 0; i < 6; i++) {
    const nx = rand() * w;
    const ny = rand() * (h * 0.6);
    const nr = (200 + rand() * 250) * sx;
    const alpha = 0.08 + rand() * 0.08;
    const colType = rand();
    let col = `rgba(157,0,255,${alpha})`;
    if (colType < 0.33) col = `rgba(255,0,127,${alpha})`;
    else if (colType < 0.66) col = `rgba(0,240,255,${alpha * 0.8})`;

    const nGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
    nGrad.addColorStop(0, col);
    nGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = nGrad;
    ctx.fillRect(0, 0, w, h);
  }

  // 3. Rain of neon dust (~140 short falling streaks)
  ctx.save();
  for (let i = 0; i < 140; i++) {
    const rx = rand() * w;
    const ry = rand() * (h * 0.75);
    const rlen = 10 + rand() * 22;
    const ralpha = 0.08 + rand() * 0.25;
    const rval = rand();
    let rcol = `rgba(255,0,127,${ralpha})`;
    if (rval < 0.35) rcol = `rgba(0,240,255,${ralpha})`;
    else if (rval < 0.5) rcol = `rgba(255,226,122,${ralpha * 0.8})`;

    ctx.strokeStyle = rcol;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx - 5 * sx, ry + rlen * sy);
    ctx.stroke();
  }
  ctx.restore();

  // 4. Dying Red Giant Sun (dominating center-top at x: 640, y: 220, r: 175)
  const sunX = 640 * sx;
  const sunY = 220 * sy;
  const sunR = 175 * sx;

  // Outer corona glow halo
  const corona = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 1.8);
  corona.addColorStop(0, 'rgba(255,100,50,0.35)');
  corona.addColorStop(0.5, 'rgba(200,20,100,0.18)');
  corona.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = corona;
  ctx.fillRect(0, 0, w, h);

  // Sun body base gradient
  const sunGrad = ctx.createRadialGradient(sunX - sunR * 0.2, sunY - sunR * 0.2, sunR * 0.05, sunX, sunY, sunR);
  sunGrad.addColorStop(0, '#ffffff');
  sunGrad.addColorStop(0.15, '#ffeeaa');
  sunGrad.addColorStop(0.4, '#ff4422');
  sunGrad.addColorStop(0.75, '#b01040');
  sunGrad.addColorStop(1, '#4a0525');

  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fillStyle = sunGrad;
  ctx.fill();

  // Sun surface granulation noise (translucent blotches)
  for (let i = 0; i < 45; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = rand() * (sunR * 0.85);
    const bx = sunX + Math.cos(angle) * dist;
    const by = sunY + Math.sin(angle) * dist;
    const bsz = (15 + rand() * 35) * sx;
    ctx.beginPath();
    ctx.arc(bx, by, bsz, 0, Math.PI * 2);
    ctx.fillStyle = rand() < 0.5 ? 'rgba(255, 120, 0, 0.15)' : 'rgba(50, 0, 20, 0.25)';
    ctx.fill();
  }

  // Lightning arcs cracking across the sun face (2-3 jagged polyline paths, pale cyan with glow)
  for (let l = 0; l < 3; l++) {
    ctx.save();
    ctx.strokeStyle = '#e0f7ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 1.5 + l * 0.5;
    ctx.beginPath();
    let lx = sunX + (rand() - 0.5) * sunR * 0.8;
    let ly = sunY - sunR * 0.8;
    ctx.moveTo(lx, ly);
    const steps = 6 + Math.floor(rand() * 4);
    for (let s = 1; s <= steps; s++) {
      const targetY = ly + (sunR * 1.6 / steps);
      const targetX = lx + (rand() - 0.5) * 45 * sx;
      ctx.lineTo(targetX, targetY);
      lx = targetX;
      ly = targetY;
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // 5. Twin Dark Planet upper-right with thin neon rim (crescent highlight)
  const pX = 1050 * sx;
  const pY = 160 * sy;
  const pR = 120 * sx;

  ctx.save();
  const pBody = ctx.createRadialGradient(pX - pR * 0.3, pY - pR * 0.3, pR * 0.1, pX, pY, pR);
  pBody.addColorStop(0, '#1c0a2b');
  pBody.addColorStop(0.7, '#0f0418');
  pBody.addColorStop(1, '#05010a');

  ctx.beginPath();
  ctx.arc(pX, pY, pR, 0, Math.PI * 2);
  ctx.fillStyle = pBody;
  ctx.fill();

  // Thin neon crescent rim highlight on lit side facing sun/upper-left
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.75)';
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(pX, pY, pR - 1, -Math.PI * 0.85, Math.PI * 0.15);
  ctx.stroke();
  ctx.restore();

  // 6. Secondary lightning bolt from sun toward city on far right
  ctx.save();
  ctx.strokeStyle = '#00f0ff';
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 15;
  ctx.lineWidth = 2;
  ctx.beginPath();
  let bx = sunX + sunR * 0.7;
  let by = sunY + sunR * 0.3;
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + 120 * sx, by + 100 * sy);
  ctx.lineTo(bx + 260 * sx, by + 220 * sy);
  ctx.lineTo(w - 200 * sx, h * 0.55);
  ctx.stroke();
  ctx.restore();

  // 7. The Ember: Flagship silhouette center-left of sun at (300, 215) with plasma trail & beam
  const shipX = 300 * sx;
  const shipY = 215 * sy;

  // Soft cyan glow halo behind ship
  const shipHale = ctx.createRadialGradient(shipX, shipY, 5, shipX, shipY, 90 * sx);
  shipHale.addColorStop(0, 'rgba(0, 240, 255, 0.45)');
  shipHale.addColorStop(0.5, 'rgba(157, 0, 255, 0.2)');
  shipHale.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shipHale;
  ctx.fillRect(shipX - 100 * sx, shipY - 100 * sy, 200 * sx, 200 * sy);

  // Twin nested plasma trail streaks flaring behind ship
  ctx.save();
  const trail1 = ctx.createLinearGradient(shipX - 160 * sx, shipY, shipX, shipY);
  trail1.addColorStop(0, 'rgba(0, 240, 255, 0)');
  trail1.addColorStop(0.6, 'rgba(0, 240, 255, 0.6)');
  trail1.addColorStop(1, 'rgba(255, 255, 255, 0.95)');
  ctx.strokeStyle = trail1;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(shipX - 160 * sx, shipY);
  ctx.lineTo(shipX, shipY);
  ctx.stroke();

  const trail2 = ctx.createLinearGradient(shipX - 90 * sx, shipY - 6 * sy, shipX, shipY);
  trail2.addColorStop(0, 'rgba(255, 0, 127, 0)');
  trail2.addColorStop(1, 'rgba(255, 0, 127, 0.8)');
  ctx.strokeStyle = trail2;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(shipX - 90 * sx, shipY - 6 * sy);
  ctx.lineTo(shipX, shipY);
  ctx.moveTo(shipX - 90 * sx, shipY + 6 * sy);
  ctx.lineTo(shipX, shipY);
  ctx.stroke();
  ctx.restore();

  // Energy beam leading toward the sun
  ctx.save();
  const beam = ctx.createLinearGradient(shipX, shipY, sunX - sunR * 0.5, sunY);
  beam.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  beam.addColorStop(0.4, 'rgba(0, 240, 255, 0.6)');
  beam.addColorStop(1, 'rgba(255, 0, 127, 0)');
  ctx.strokeStyle = beam;
  ctx.lineWidth = 3;
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(shipX, shipY);
  ctx.lineTo(sunX - sunR * 0.5, sunY);
  ctx.stroke();
  ctx.restore();

  // Flagship silhouette: swept delta wing with twin nacelles
  ctx.save();
  ctx.fillStyle = '#0a0412';
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 8;

  ctx.beginPath();
  ctx.moveTo(shipX + 28 * sx, shipY);
  ctx.lineTo(shipX - 15 * sx, shipY - 18 * sy);
  ctx.lineTo(shipX - 8 * sx, shipY - 6 * sy);
  ctx.lineTo(shipX - 22 * sx, shipY - 12 * sy);
  ctx.lineTo(shipX - 18 * sx, shipY);
  ctx.lineTo(shipX - 22 * sx, shipY + 12 * sy);
  ctx.lineTo(shipX - 8 * sx, shipY + 6 * sy);
  ctx.lineTo(shipX - 15 * sx, shipY + 18 * sy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 8. Three Depth Layers of Dead Neon City Skyline across bottom third (y: 460 to 720)
  const baseHorizon = 460 * sy;

  // LAYER 1: Far skyline (indigo silhouettes, ~40 tiny ember windows)
  ctx.save();
  ctx.fillStyle = '#100522';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, baseHorizon + 60 * sy);
  let fx = 0;
  while (fx < w) {
    const fwidth = (35 + rand() * 65) * sx;
    const fheight = (80 + rand() * 110) * sy;
    ctx.lineTo(fx, baseHorizon + 60 * sy - fheight);
    fx += fwidth;
    ctx.lineTo(fx, baseHorizon + 60 * sy - fheight);
  }
  ctx.lineTo(w, baseHorizon + 60 * sy);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // Far windows (~40 tiny ember windows)
  ctx.fillStyle = 'rgba(255, 120, 50, 0.75)';
  for (let i = 0; i < 40; i++) {
    const wx = rand() * w;
    const wy = baseHorizon + 10 * sy + rand() * 80 * sy;
    ctx.fillRect(wx, wy, 2 * sx, 3 * sy);
  }
  ctx.restore();

  // LAYER 2: Mid skyline (deeper purple, taller broken towers, trunk-skeletal radio tower with 2 beacons)
  ctx.save();
  ctx.fillStyle = '#1c0835';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, baseHorizon + 30 * sy);
  let mx = 0;
  let towerCount = 0;
  while (mx < w) {
    towerCount++;
    const mwidth = (45 + rand() * 75) * sx;
    const mheight = (140 + rand() * 160) * sy;
    const isBroken = towerCount % 3 === 0;

    ctx.lineTo(mx, baseHorizon + 30 * sy - mheight);
    if (isBroken) {
      ctx.lineTo(mx + mwidth * 0.4, baseHorizon + 30 * sy - mheight + 25 * sy);
      ctx.lineTo(mx + mwidth * 0.7, baseHorizon + 30 * sy - mheight - 15 * sy);
    }
    mx += mwidth;
    ctx.lineTo(mx, baseHorizon + 30 * sy - mheight * 0.85);
  }
  ctx.lineTo(w, baseHorizon + 30 * sy);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // Trunk-skeletal radio tower in mid layer with 2 blinking beacons
  const radioX = 850 * sx;
  const radioBaseY = baseHorizon + 30 * sy - 220 * sy;
  ctx.strokeStyle = '#2a0c4a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(radioX, baseHorizon + 30 * sy);
  ctx.lineTo(radioX, radioBaseY);
  ctx.stroke();

  ctx.lineWidth = 1;
  for (let by = radioBaseY; by < baseHorizon + 30 * sy; by += 25 * sy) {
    ctx.beginPath();
    ctx.moveTo(radioX - 8 * sx, by);
    ctx.lineTo(radioX + 8 * sx, by + 12 * sy);
    ctx.moveTo(radioX + 8 * sx, by);
    ctx.lineTo(radioX - 8 * sx, by + 12 * sy);
    ctx.stroke();
  }

  // Two blinking beacons on radio tower
  ctx.fillStyle = '#ff007f';
  ctx.shadowColor = '#ff007f';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(radioX, radioBaseY, 3, 0, Math.PI * 2);
  ctx.arc(radioX, radioBaseY + 60 * sy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // LAYER 3: Near skyline (near-black silhouette with cyan/magenta lit windows, antennas with tiny glow tips)
  ctx.save();
  ctx.fillStyle = '#080212';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, baseHorizon);
  let nx_city = 0;
  while (nx_city < w) {
    const nwidth = (55 + rand() * 85) * sx;
    const nheight = (190 + rand() * 180) * sy;
    ctx.lineTo(nx_city, baseHorizon - nheight);

    if (rand() < 0.4) {
      const antX = nx_city + nwidth * 0.5;
      const antTipY = baseHorizon - nheight - 35 * sy;
      ctx.strokeStyle = '#221035';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(antX, baseHorizon - nheight);
      ctx.lineTo(antX, antTipY);
      ctx.stroke();

      ctx.fillStyle = rand() < 0.5 ? '#00f0ff' : '#ff007f';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(antX, antTipY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    nx_city += nwidth;
    ctx.lineTo(nx_city, baseHorizon - nheight * 0.9);
  }
  ctx.lineTo(w, baseHorizon);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // Near windows
  for (let i = 0; i < 65; i++) {
    const wx = rand() * w;
    const wy = baseHorizon - (150 + rand() * 150) * sy;
    const ww = (2 + rand() * 3) * sx;
    const wh = (6 + rand() * 14) * sy;
    ctx.fillStyle = rand() < 0.55 ? 'rgba(0, 240, 255, 0.85)' : 'rgba(255, 0, 127, 0.85)';
    ctx.fillRect(wx, wy, ww, wh);
  }
  ctx.restore();

  // 9. Atmosphere: Horizontal magenta haze band at skyline horizon
  ctx.save();
  const haze = ctx.createLinearGradient(0, baseHorizon - 40 * sy, 0, baseHorizon + 60 * sy);
  haze.addColorStop(0, 'rgba(255, 0, 127, 0)');
  haze.addColorStop(0.5, 'rgba(255, 0, 127, 0.28)');
  haze.addColorStop(1, 'rgba(157, 0, 255, 0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, baseHorizon - 40 * sy, w, 100 * sy);
  ctx.restore();

  // 10. Vignette + very subtle film grain (~900 single-pixel alpha noise sprinkles)
  ctx.save();
  const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.35, w / 2, h / 2, w * 0.8);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(0.65, 'rgba(0,0,0,0.35)');
  vig.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
  for (let i = 0; i < 900; i++) {
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
