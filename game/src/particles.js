// particles.js: Particle system manager for ember trails, explosions, and hit sparks.

export class ParticleManager {
  constructor(rng = null) {
    this.rng = rng;
    this.particles = [];
  }

  spawn(x, y, vx, vy, color, size, life, shape = 'circle') {
    if (this.particles.length >= 400) {
      this.particles.shift();
    }
    this.particles.push({
      x, y, vx, vy, color, size, life, maxLife: life, shape
    });
  }

  explosion(x, y, color = '#00f0ff', count = 25) {
    const rand = () => (this.rng ? this.rng.next() : Math.random());
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const speed = rand() * 6 + 2;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const size = rand() * 4 + 2;
      const life = rand() * 0.5 + 0.3;
      this.spawn(x, y, vx, vy, color, size, life, 'spark');
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.life -= dt;
      p.size = Math.max(0, p.size - dt * 2);
      if (p.life <= 0 || p.size <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    ctx.save();
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      if (p.shape === 'spark') {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
