// background.js: Procedural synthwave background with parallax skyline layers, sun disc, stars, and ambient particles.

export class Background {
  constructor(rng = null) {
    this.rng = rng;
    const rand = () => (this.rng ? this.rng.next() : Math.random());

    this.stars = [];
    for (let i = 0; i < 80; i++) {
      this.stars.push({
        x: rand() * 1280,
        y: rand() * 720,
        size: rand() * 2 + 1,
        speed: rand() * 0.5 + 0.2,
        brightness: rand(),
      });
    }

    this.buildings1 = this.generateSkyline(12, 180, 320, 1.0);
    this.buildings2 = this.generateSkyline(18, 100, 220, 2.0);
    this.buildings3 = this.generateSkyline(26, 50, 140, 3.5);

    this.rain = [];
    for (let i = 0; i < 42; i++) {
      this.rain.push({
        x: rand() * 1280,
        y: rand() * 380,
        len: 14 + rand() * 26,
        speed: 1.1 + rand() * 0.9,
        alpha: 0.06 + rand() * 0.09,
      });
    }

    this.beaconPhase = 0;
    this.sector = 1;

    this.cachedCtx = null;
    this.bgGrad = null;
    this.sunGrad = null;
    this.horizonHazeGrad = null;
  }

  setSector(sector) {
    this.sector = Math.max(1, Math.min(10, sector));
    this.bgGrad = null;
    this.sunGrad = null;
    this.horizonHazeGrad = null;
    this.cachedCtx = null;
  }

  generateSkyline(count, minH, maxH, speedFactor) {
    const rand = () => (this.rng ? this.rng.next() : Math.random());
    const b = [];
    let x = 0;
    const w = 1280 / (count - 2);
    for (let i = 0; i < count; i++) {
      const h = minH + rand() * (maxH - minH);
      b.push({ x, w: w + rand() * 20, h, speed: speedFactor });
      x += w;
    }
    return b;
  }

  update(dt, scrollSpeed = 1) {
    const rand = () => (this.rng ? this.rng.next() : Math.random());
    for (const star of this.stars) {
      star.x -= star.speed * scrollSpeed * dt * 60;
      if (star.x < 0) star.x = 1280;
    }
    for (const streak of this.rain) {
      streak.y += streak.speed * dt * 60;
      if (streak.y > 500) {
        streak.y = -streak.len;
        streak.x = rand() * 1280;
      }
    }
    this.beaconPhase += dt;
  }

  draw(ctx) {
    if (!this.sectorPalettes) this.sectorPalettes = [
      { sky: ['#05020a', '#150a2b', '#2b0c3a'], sun: ['#ffea00', '#ff4400', '#ff007f'], haze: 'rgba(255,0,127,.34)', city: ['#100620', '#1e0b36', '#2a0d4a'], grid: 'rgba(0,240,255,.25)' },
      { sky: ['#03111b', '#092b43', '#174661'], sun: ['#c6fff2', '#36c9c2', '#2680a2'], haze: 'rgba(54,201,194,.28)', city: ['#071925', '#0b2b3d', '#124055'], grid: 'rgba(93,255,229,.24)' },
      { sky: ['#11051a', '#351044', '#5a194d'], sun: ['#fff0b0', '#ff8a5b', '#ec3f7a'], haze: 'rgba(255,68,126,.28)', city: ['#1b0b25', '#34113e', '#4b1742'], grid: 'rgba(255,146,190,.23)' },
      { sky: ['#07101f', '#15254b', '#253666'], sun: ['#f6e9ff', '#a38bff', '#526dff'], haze: 'rgba(97,118,255,.3)', city: ['#101a30', '#1b2c50', '#283b62'], grid: 'rgba(153,187,255,.24)' },
      { sky: ['#160704', '#3a1609', '#642410'], sun: ['#fff0a0', '#ff8a00', '#fa3a28'], haze: 'rgba(255,91,34,.27)', city: ['#241006', '#421a0a', '#60230d'], grid: 'rgba(255,190,87,.24)' },
      { sky: ['#030b13', '#0b2631', '#134743'], sun: ['#e4fff0', '#70e6a6', '#29a985'], haze: 'rgba(61,236,165,.25)', city: ['#071b1b', '#0b302b', '#145044'], grid: 'rgba(103,255,183,.24)' },
      { sky: ['#10041a', '#30103e', '#4c1557'], sun: ['#fff0d0', '#ff72c5', '#a832c5'], haze: 'rgba(228,54,210,.28)', city: ['#1d0928', '#35113f', '#4a1654'], grid: 'rgba(255,128,231,.23)' },
      { sky: ['#060a17', '#121d3c', '#23294b'], sun: ['#d8ffff', '#60d6eb', '#327aa3'], haze: 'rgba(53,194,225,.24)', city: ['#0b1124', '#162143', '#242c50'], grid: 'rgba(84,222,255,.24)' },
      { sky: ['#080512', '#1d1038', '#361547'], sun: ['#f5d6ff', '#bb65ff', '#5e2dcc'], haze: 'rgba(148,76,255,.3)', city: ['#10091e', '#21103a', '#33164b'], grid: 'rgba(187,130,255,.23)' },
      { sky: ['#07090d', '#1a1b28', '#30313d'], sun: ['#fff4cf', '#ffc95e', '#fa695e'], haze: 'rgba(255,174,91,.3)', city: ['#10121a', '#20212b', '#30303b'], grid: 'rgba(255,224,154,.25)' },
    ];
    const theme = this.sectorPalettes[this.sector - 1];
    if (!this.bgGrad || this.cachedCtx !== ctx) {
      this.cachedCtx = ctx;
      this.bgGrad = ctx.createLinearGradient(0, 0, 0, 720);
      this.bgGrad.addColorStop(0, theme.sky[0]);
      this.bgGrad.addColorStop(0.6, theme.sky[1]);
      this.bgGrad.addColorStop(1, theme.sky[2]);

      const sunX = 640;
      const sunY = 320;
      const sunRadius = 160;
      this.sunGrad = ctx.createRadialGradient(sunX, sunY - 40, 10, sunX, sunY, sunRadius);
      this.sunGrad.addColorStop(0, theme.sun[0]);
      this.sunGrad.addColorStop(0.5, theme.sun[1]);
      this.sunGrad.addColorStop(1, theme.sun[2]);

      this.horizonHazeGrad = ctx.createRadialGradient(640, 560, 0, 640, 560, 520);
      this.horizonHazeGrad.addColorStop(0, theme.haze);
      this.horizonHazeGrad.addColorStop(1, 'rgba(0,0,0,0)');
    }

    // Deep gradient background
    ctx.fillStyle = this.bgGrad;
    ctx.fillRect(0, 0, 1280, 720);

    // Horizon haze band (2.5D atmospheric perspective)
    ctx.save();
    const hazeBandGrad = ctx.createLinearGradient(0, 560 - 65, 0, 560 + 65);
    hazeBandGrad.addColorStop(0, 'rgba(255,80,170,0.16)');
    hazeBandGrad.addColorStop(1, 'rgba(255,80,170,0)');
    ctx.fillStyle = hazeBandGrad;
    ctx.fillRect(0, 560 - 65, 1280, 130);
    ctx.restore();

    // Stars
    ctx.fillStyle = '#ffffff';
    for (const star of this.stars) {
      ctx.globalAlpha = star.brightness * 0.8;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1.0;

    // Setting Synthwave Sun Disc
    const sunX = 640;
    const sunY = 320;
    const sunRadius = 160;

    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fillStyle = this.sunGrad;
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 40;
    ctx.fill();
    ctx.restore();

    // Sun horizontal scanline cuts
    ctx.save();
    ctx.beginPath();
    ctx.rect(sunX - sunRadius, sunY, sunRadius * 2, sunRadius);
    ctx.clip();
    ctx.fillStyle = '#150a2b';
    for (let y = sunY + 10; y < sunY + sunRadius; y += 16) {
      const h = Math.max(2, (y - sunY) * 0.1);
      ctx.fillRect(sunX - sunRadius - 20, y, sunRadius * 2 + 40, h);
    }
    ctx.restore();

    // Horizon haze glow band
    ctx.save();
    ctx.fillStyle = this.horizonHazeGrad;
    ctx.translate(640, 560);
    ctx.scale(1, 0.32);
    ctx.beginPath();
    ctx.arc(0, 0, 520, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Neon rain streaks
    ctx.save();
    for (let i = 0; i < this.rain.length; i++) {
      const streak = this.rain[i];
      ctx.strokeStyle = i % 2 === 0 ? `rgba(0, 240, 255, ${streak.alpha})` : `rgba(255, 0, 127, ${streak.alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(streak.x, streak.y);
      ctx.lineTo(streak.x + 3, streak.y + streak.len);
      ctx.stroke();
    }
    ctx.restore();

    // Parallax skyline layers
    this.drawSkylineLayer(ctx, this.buildings1, theme.city[0]);
    this.drawSkylineLayer(ctx, this.buildings2, theme.city[1]);
    this.drawSkylineLayer(ctx, this.buildings3, theme.city[2]);

    // Perspective floor grid (cyberpunk horizon grid)
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const horizonY = 560;
    ctx.moveTo(0, horizonY);
    ctx.lineTo(1280, horizonY);
    for (let x = -640; x <= 1920; x += 120) {
      ctx.moveTo(640, horizonY);
      ctx.lineTo(x, 720);
    }
    for (let y = horizonY; y <= 720; y += 20) {
      ctx.moveTo(0, y);
      ctx.lineTo(1280, y);
    }
    ctx.stroke();
  }

  drawSkylineLayer(ctx, buildings, color) {
    ctx.fillStyle = color;
    for (let bIndex = 0; bIndex < buildings.length; bIndex++) {
      const b = buildings[bIndex];
      const y = 560 - b.h;
      ctx.fillRect(b.x, y, b.w, b.h);
      // Windows glow — cyan by default, magenta/gold accents on a small fraction
      let row = 0;
      for (let wy = y + 15; wy < 540; wy += 30, row++) {
        let col = 0;
        for (let wx = b.x + 10; wx < b.x + b.w - 10; wx += 20, col++) {
          const pick = (col + row * 3 + bIndex * 7) % 4;
          if (pick === 0) {
            ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
            ctx.fillRect(wx, wy, 8, 12);
          } else if (pick === 7 % 4 && (col * 31 + row * 17 + bIndex) % 11 === 0) {
            ctx.fillStyle = 'rgba(255, 0, 127, 0.34)';
            ctx.fillRect(wx, wy, 8, 12);
          } else if ((col * 13 + row * 29 + bIndex * 5) % 23 === 0) {
            ctx.fillStyle = 'rgba(255, 179, 0, 0.32)';
            ctx.fillRect(wx, wy, 8, 12);
          }
        }
      }
      ctx.fillStyle = color;

      // Rooftop beacons on the mid skyline layer
      if (buildings === this.buildings2) {
        const bIdx = bIndex;
        if (bIdx >= 2 && bIdx <= 14 && [2, 3, 5, 8, 11, 14].includes(bIdx)) {
          const roofY = 560 - b.h;
          const on = Math.sin(this.beaconPhase * 2 + bIdx) > 0;
          ctx.save();
          ctx.globalAlpha = on ? 0.9 : 0.1;
          ctx.fillStyle = bIdx % 2 === 0 ? '#ff0055' : '#00f0ff';
          ctx.shadowColor = ctx.fillStyle;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(b.x + b.w / 2, roofY - 4, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }
}
