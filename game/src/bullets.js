// bullets.js: Management and rendering of player and enemy projectiles.

export class BulletManager {
  constructor() {
    this.bullets = [];
  }

  spawn(x, y, vx, vy, isPlayer = true, color = '#00f0ff') {
    this.bullets.push({
      x, y, vx, vy, isPlayer, color, radius: isPlayer ? 6 : 5
    });
  }

  update(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt * 60;
      b.y += b.vy * dt * 60;
      if (b.x < -50 || b.x > 1330 || b.y < -50 || b.y > 770) {
        this.bullets.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const b of this.bullets) {
      // 2.5D ground-bounce: a wide, faint light pool a step below the bolt
      const pool = ctx.createRadialGradient(b.x, b.y + 12, 2, b.x, b.y + 12, 34);
      pool.addColorStop(0, b.color + '55');
      pool.addColorStop(1, b.color + '00');
      ctx.fillStyle = pool;
      ctx.save();
      ctx.translate(b.x, b.y + 12);
      ctx.scale(1.9, 0.55);
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (b.isPlayer) {
        const dir = Math.atan2(b.vy, b.vx);
        const stretch = 1 + Math.min(0.8, Math.hypot(b.vx, b.vy) * 0.015);
        // Outer bloom pass
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(dir);
        ctx.scale(stretch, 1);
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 22;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.roundRect(-13, -4.5, 26, 9, 4.5);
        ctx.fill();
        // Mid pass
        ctx.shadowBlur = 6;
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(-10, -2.4, 20, 4.8, 2.4);
        ctx.fill();
        // Chromatic leading tip
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#aef6ff';
        ctx.beginPath();
        ctx.roundRect(6, -1.6, 6, 3.2, 1.6);
        ctx.fill();
        ctx.restore();
      } else {
        // Enemy orb: dark rim, hot core, faint halo ring
        ctx.save();
        ctx.translate(b.x, b.y);
        const core = ctx.createRadialGradient(0, 0, 0.5, 0, 0, b.radius + 2);
        core.addColorStop(0, '#ffffff');
        core.addColorStop(0.35, b.color);
        core.addColorStop(0.85, b.color + '66');
        core.addColorStop(1, b.color + '00');
        ctx.fillStyle = core;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(0, 0, b.radius + 2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = '#0a0214';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(0, 0, b.radius * 0.62, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, b.radius + 4.5, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  }
}
