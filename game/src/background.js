// background.js: Procedural synthwave background with parallax skyline layers, sun disc, stars, and ambient particles.

export class Background {
  constructor() {
    this.stars = [];
    for (let i = 0; i < 80; i++) {
      this.stars.push({
        x: Math.random() * 1280,
        y: Math.random() * 720,
        size: Math.random() * 2 + 1,
        speed: Math.random() * 0.5 + 0.2,
        brightness: Math.random(),
      });
    }

    this.buildings1 = this.generateSkyline(12, 180, 320, 1.0);
    this.buildings2 = this.generateSkyline(18, 100, 220, 2.0);
    this.buildings3 = this.generateSkyline(26, 50, 140, 3.5);

    this.cachedCtx = null;
    this.bgGrad = null;
    this.sunGrad = null;
  }

  generateSkyline(count, minH, maxH, speedFactor) {
    const b = [];
    let x = 0;
    const w = 1280 / (count - 2);
    for (let i = 0; i < count; i++) {
      const h = minH + Math.random() * (maxH - minH);
      b.push({ x, w: w + Math.random() * 20, h, speed: speedFactor });
      x += w;
    }
    return b;
  }

  update(dt, scrollSpeed = 1) {
    for (const star of this.stars) {
      star.x -= star.speed * scrollSpeed * dt * 60;
      if (star.x < 0) star.x = 1280;
    }
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
      // Windows glow
      ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
      let row = 0;
      for (let wy = y + 15; wy < 540; wy += 30, row++) {
        let col = 0;
        for (let wx = b.x + 10; wx < b.x + b.w - 10; wx += 20, col++) {
          if ((col + row * 3 + bIndex) % 4 === 0) {
            ctx.fillRect(wx, wy, 8, 12);
          }
        }
      }
      ctx.fillStyle = color;
    }
  }
}
