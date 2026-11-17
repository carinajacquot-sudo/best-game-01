// particles.js: Particle system manager for ember trails, explosions, and hit sparks.

export class ParticleManager {
  constructor(rng = null) {
    this.rng = rng;
    this.particles = [];
  }

  spawn(x, y, vx, vy, color, size, life, shape = 'circle') {
    this._push({
      x, y, vx, vy, color, size, life, maxLife: life, shape
    });
  }

  // Global cap: every particle source (spawn or direct-push FX) respects the 400-particle ceiling.
  _push(p) {
    if (this.particles.length >= 400) {
      this.particles.shift();
    }
    this.particles.push(p);
  }

  shockwave(x, y, color = '#ffee00', maxRadius = 150, life = 0.8, lineWidth = 6) {
    this._push({
      x, y, vx: 0, vy: 0, color, size: maxRadius, life, maxLife: life,
      shape: 'shockwave', lineWidth, radius0: 8
    });
  }

  motes(x, y, color = '#ffd9a0', count = 10) {
    const rand = () => (this.rng ? this.rng.next() : Math.random());
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const speed = rand() * 1.4 + 0.4;
      this.spawn(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 0.6,
        color, rand() * 1.8 + 0.9, rand() * 0.9 + 0.7, 'mote');
    }
  }

  groundPool(x, y, color = '#ff9a3c', life = 0.5, size = 70) {
    this._push({ x, y, vx: 0, vy: 0, color, size, life, maxLife: life, shape: 'pool' });
  }

  setFxSprites(sprites) {
    this.fxSprites = sprites;
  }

  detonationFx(x, y, scale = 1) {
    const img = this.fxSprites && this.fxSprites.detonation;
    if (!img || !img.complete || !img.naturalWidth) return;
    this._push({
      x, y, vx: 0, vy: 0, color: '#ffffff', size: 150 * scale, life: 0.62, maxLife: 0.62,
      shape: 'fx-detonation'
    });
  }

  novaFx(x, y) {
    const img = this.fxSprites && this.fxSprites.nova;
    if (!img || !img.complete || !img.naturalWidth) return;
    this._push({
      x, y, vx: 0, vy: 0, color: '#ffffff', size: 300, life: 0.55, maxLife: 0.55,
      shape: 'fx-nova'
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
    // 2.5D accents: shockwave ring + ground light pool + rising motes
    this.shockwave(x, y, color, 120 + rand() * 60, 0.65, 5);
    this.groundPool(x, y, color, 0.45, 64);
    this.motes(x, y, '#ffe8b0', 7);
    // Painted detonation flash (v6) on significant bursts only (kills, boss hits)
    if (count >= 20) this.detonationFx(x, y, count >= 30 ? 1.15 : 0.9);
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
      if (p.shape === 'fx-detonation' || p.shape === 'fx-nova') {
        const t = 1 - alpha;
        const grow = p.shape === 'fx-nova' ? 0.45 + t * 1.15 : 0.55 + t * 0.85;
        const w = p.size * grow;
        const img = p.shape === 'fx-nova'
          ? this.fxSprites && this.fxSprites.nova
          : this.fxSprites && this.fxSprites.detonation;
        if (img && img.complete && img.naturalWidth) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = alpha * alpha;
          ctx.drawImage(img, p.x - w / 2, p.y - w / 2, w, w);
          ctx.restore();
        }
        continue;
      }
      if (p.shape === 'shockwave') {
        const t = 1 - alpha;
        const r = p.radius0 + (p.size - p.radius0) * t;
        ctx.globalAlpha = alpha * 1.08;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.lineWidth * (1 - t));
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
        // chromatic halo edge
        ctx.globalAlpha = alpha * 0.45;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(0.6, 1.2 * (1 - t));
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2); ctx.stroke();
        continue;
      }
      if (p.shape === 'pool') {
        ctx.globalAlpha = alpha * 0.5;
        const pool = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.size);
        pool.addColorStop(0, p.color);
        pool.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = pool;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(1.8, 0.5);
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // White additive radial core at center (2.5D depth pass)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha * 0.5;
        const core = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 0.35);
        core.addColorStop(0, 'rgba(255,255,255,0.9)');
        core.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = core;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.35, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        continue;
      }
      if (p.shape === 'mote') {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        continue;
      }
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
