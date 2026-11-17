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
      p.x += p.vx * dt * 60;
      p.life -= dt;

      // Magnet attraction if active
      if (player.magnetTimer > 0) {
        const dx = player.x - p.x;
        const dy = player.y - p.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > 1 && distSq < 300 * 300) {
          const dist = Math.sqrt(distSq);
          const step = Math.min(6 * dt * 60, dist);
          p.x += (dx / dist) * step;
          p.y += (dy / dist) * step;
        }
      }

      if (p.life <= 0 || p.x < -40) {
        this.powerups.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    for (const p of this.powerups) {
      ctx.save();
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
  }
}
