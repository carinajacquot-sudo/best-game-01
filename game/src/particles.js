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

  speedLines(x, y, color = '#fffbe0', count = 18, length = 190, life = 0.5) {
    const rand = () => (this.rng ? this.rng.next() : Math.random());
    for (let i = 0; i < count; i++) {
      this._push({
        x, y,
        angle: rand() * Math.PI * 2,
        len: length * (0.6 + rand() * 0.8),
        life, maxLife: life,
        color,
        shape: 'speedline'
      });
    }
  }

  debris(x, y, colors = ['#ff9a3c', '#ffffff', '#ff007f'], count = 26) {
    const rand = () => (this.rng ? this.rng.next() : Math.random());
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const speed = rand() * 8 + 3;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 2;
      const n = 5 + Math.floor(rand() * 3);
      const polygon = [];
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2;
        const r = 4 + rand() * 7;
        polygon.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
      }
      const color = Array.isArray(colors) ? colors[Math.floor(rand() * colors.length)] : colors;
      this._push({
        x, y, vx, vy,
        gravity: 260,
        drag: 0.985,
        spin: rand() * Math.PI * 2,
        angularVel: (rand() - 0.5) * 8,
        polygon,
        color,
        life: 1.4 + rand() * 0.8,
        maxLife: 2.2,
        shape: 'shard'
      });
    }
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
    // Larger bursts get a second, wider shockwave for the 2.5D punch
    if (count >= 30) {
      this.shockwave(x, y, '#ffffff', 190, 0.8, 7);
      this.speedLines(x, y, '#fff2c0', 10, 150, 0.45);
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (p.shape === 'shard') {
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.vx *= Math.pow(p.drag, dt * 60);
        p.vy += p.gravity * dt;
        p.spin += p.angularVel * dt;
        p.life -= dt;
      } else if (p.shape === 'speedline') {
        p.life -= dt;
      } else {
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.life -= dt;
        p.size = Math.max(0, p.size - dt * 2);
      }
      if (p.life <= 0 || (p.shape !== 'speedline' && p.shape !== 'shard' && p.size <= 0)) {
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
      if (p.shape === 'speedline') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha * 0.8;
        ctx.strokeStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        const t = 1 - alpha;
        const r0 = 30;
        const r1 = r0 + p.len * (t * (2 - t));
        const x1 = p.x + Math.cos(p.angle) * r0;
        const y1 = p.y + Math.sin(p.angle) * r0;
        const x2 = p.x + Math.cos(p.angle) * r1;
        const y2 = p.y + Math.sin(p.angle) * r1;
        ctx.lineWidth = Math.max(0.5, 2 * alpha);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
        continue;
      }
      if (p.shape === 'shard') {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.fillStyle = p.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(p.polygon[0].x, p.polygon[0].y);
        for (let j = 1; j < p.polygon.length; j++) {
          ctx.lineTo(p.polygon[j].x, p.polygon[j].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
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
