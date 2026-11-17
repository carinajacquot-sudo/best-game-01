// particles.js: Particle system manager for ember trails, explosions, and hit sparks.

const POOL_CACHE = new Map();
let CORE_SPRITE = null;

/** One soft radial puddle per colour and radius bucket. */
function poolSprite(color, R) {
  const key = `${color}:${R}`;
  let c = POOL_CACHE.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = R * 2;
  c.height = R * 2;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(R, R, 2, R, R, R);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, R * 2, R * 2);
  POOL_CACHE.set(key, c);
  if (POOL_CACHE.size > 48) POOL_CACHE.delete(POOL_CACHE.keys().next().value);
  return c;
}

/** Shared white hot core used by every pool. */
function coreSprite() {
  if (CORE_SPRITE) return CORE_SPRITE;
  const R = 16;
  const c = document.createElement('canvas');
  c.width = R * 2;
  c.height = R * 2;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(R, R, 0, R, R, R);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, R * 2, R * 2);
  CORE_SPRITE = c;
  return CORE_SPRITE;
}

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
    // PERFORMANCE (v7.1): shadowBlur per particle was the single biggest cost
    // during explosions. Neon glows are now produced by cheap additive strokes.
    ctx.shadowBlur = 0;
    // CROWD MODE: once a blast throws more than ~150 embers, one path+fill per
    // particle becomes the frame bottleneck. The plain dots are then bucketed by
    // (colour, quantised alpha) and flushed as grouped fillRects, so the number
    // of canvas state changes follows the palette instead of the particle count.
    const crowd = this.particles.length > 150;
    let buckets = null;
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.shape === 'speedline') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha * 0.8;
        ctx.strokeStyle = p.color;
        const t = 1 - alpha;
        const r0 = 30;
        const r1 = r0 + p.len * (t * (2 - t));
        const x1 = p.x + Math.cos(p.angle) * r0;
        const y1 = p.y + Math.sin(p.angle) * r0;
        const x2 = p.x + Math.cos(p.angle) * r1;
        const y2 = p.y + Math.sin(p.angle) * r1;
        // Wide soft pass + narrow bright pass = glow without shadowBlur.
        ctx.lineWidth = Math.max(0.5, 2 * alpha) * 4;
        ctx.globalAlpha = alpha * 0.28;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.globalAlpha = alpha * 0.8;
        ctx.lineWidth = Math.max(0.5, 2 * alpha);
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
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
        // chromatic halo edge
        ctx.globalAlpha = alpha * 0.45;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(0.6, 1.2 * (1 - t));
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2); ctx.stroke();
        continue;
      }
      if (p.shape === 'pool') {
        // PERFORMANCE: a pool used to allocate two radial gradients per frame.
        // The puddle and its hot core are pre-rendered once per colour+size
        // bucket, so a pool is now two blits.
        ctx.save();
        ctx.globalAlpha = alpha * 0.5;
        ctx.translate(p.x, p.y);
        ctx.scale(1.8, 0.5);
        const R = Math.max(4, Math.round(p.size));
        const puddle = poolSprite(p.color, R);
        ctx.drawImage(puddle, -R, -R, R * 2, R * 2);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha * 0.5;
        const cr = Math.max(3, Math.round(R * 0.35));
        ctx.drawImage(coreSprite(), -cr, -cr, cr * 2, cr * 2);
        ctx.restore();
        continue;
      }
      if (p.shape === 'mote') {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      if (p.shape === 'spark') {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else if (crowd) {
        const lvl = alpha < 0.25 ? 0 : alpha < 0.5 ? 1 : alpha < 0.75 ? 2 : 3;
        const key = p.color + '|' + lvl;
        let arr = (buckets || (buckets = new Map())).get(key);
        if (!arr) { arr = []; buckets.set(key, arr); }
        arr.push(p.x, p.y, p.size, (lvl + 1) * 0.25);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (buckets) {
      // One fillStyle + one globalAlpha per bucket, then nothing but fillRects.
      for (const [key, arr] of buckets) {
        const bar = key.lastIndexOf('|');
        const alpha = arr[3];
        ctx.fillStyle = key.slice(0, bar);
        ctx.globalAlpha = alpha;
        for (let i = 0; i < arr.length; i += 4) {
          const r = arr[i + 2];
          ctx.fillRect(arr[i] - r, arr[i + 1] - r, r * 2, r * 2);
        }
      }
    }
    ctx.restore();
  }
}
