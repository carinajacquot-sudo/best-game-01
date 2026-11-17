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

    this.cachedCtx = null;
    this.bgGrad = null;
    this.sunGrad = null;
    this.horizonHazeGrad = null;
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
    if (!this.bgGrad || this.cachedCtx !== ctx) {
      this.cachedCtx = ctx;
      this.bgGrad = ctx.createLinearGradient(0, 0, 0, 720);
      this.bgGrad.addColorStop(0, '#05020a');
      this.bgGrad.addColorStop(0.6, '#150a2b');
      this.bgGrad.addColorStop(1, '#2b0c3a');

      const sunX = 640;
      const sunY = 320;
      const sunRadius = 160;
      this.sunGrad = ctx.createRadialGradient(sunX, sunY - 40, 10, sunX, sunY, sunRadius);
      this.sunGrad.addColorStop(0, '#ffea00');
      this.sunGrad.addColorStop(0.5, '#ff4400');
      this.sunGrad.addColorStop(1, '#ff007f');

      this.horizonHazeGrad = ctx.createRadialGradient(640, 560, 0, 640, 560, 520);
      this.horizonHazeGrad.addColorStop(0, 'rgba(255, 0, 127, 0.34)');
      this.horizonHazeGrad.addColorStop(1, 'rgba(255, 0, 127, 0)');
    }

    // Deep gradient background
    ctx.fillStyle = this.bgGrad;
    ctx.fillRect(0, 0, 1280, 720);

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
    this.drawSkylineLayer(ctx, this.buildings1, '#100620');
    this.drawSkylineLayer(ctx, this.buildings2, '#1e0b36');
    this.drawSkylineLayer(ctx, this.buildings3, '#2a0d4a');

    // Perspective floor grid (cyberpunk horizon grid)
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
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
