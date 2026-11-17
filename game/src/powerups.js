// powerups.js: Powerup drops (Flare, Aegis, Magnet) and collection logic.

export class PowerupManager {
  constructor() {
    this.powerups = [];
  }

  spawn(x, y, type) {
    this.powerups.push({
      x, y,
      vx: -1.5,
      type, // 'flare', 'aegis', 'magnet'
      radius: 16,
      life: 15.0
    });
  }

  update(dt, player) {
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.x += p.vx;
      p.life -= dt;

      // Magnet attraction if active
      if (player.magnetTimer > 0) {
        const dx = player.x - p.x;
        const dy = player.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 300) {
          p.x += (dx / dist) * 6;
          p.y += (dy / dist) * 6;
        }
      }

      if (p.life <= 0 || p.x < -40) {
        this.powerups.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    ctx.save();
    for (const p of this.powerups) {
      ctx.translate(p.x, p.y);
      let color = '#ffee00';
      let label = 'F';
      if (p.type === 'aegis') {
        color = '#ff7700';
        label = 'A';
      } else if (p.type === 'magnet') {
        color = '#00f0ff';
        label = 'M';
      }

      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#05020a';
      ctx.font = 'bold 16px Courier New';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 0);

      ctx.restore();
    }
    ctx.restore();
  }
}
