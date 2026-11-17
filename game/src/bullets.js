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
      b.x += b.vx;
      b.y += b.vy;
      if (b.x < -50 || b.x > 1330 || b.y < -50 || b.y > 770) {
        this.bullets.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    ctx.save();
    for (const b of this.bullets) {
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      if (b.isPlayer) {
        ctx.roundRect(b.x - 8, b.y - 3, 16, 6, 3);
      } else {
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.restore();
  }
}
