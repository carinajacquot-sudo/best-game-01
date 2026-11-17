// meteors.js: falling meteor shower hazard.
//
// Meteors are modelled rock sprites (Kaggle Meshy `stone1`) rendered with the
// same sheet pipeline as the aliens. They streak in from the upper right on a
// shallow diagonal, burn a particle tail, can be shot down mid-air, and
// detonate on the ground into a shockwave that is dangerous to everything.
//
// The manager owns only meteor state; collision resolution and scoring stay in
// main.js so the hazard reads as one more entity in the existing loop.

import { drawSprite, frameFromTime } from './assets.js';
import { cachedGradient } from './perf.js';

export class MeteorShower {
  constructor(rng, particles = null) {
    this.rng = rng;
    this.particles = particles;
    this.rocks = [];
    this.shockwaves = [];
    this.spawnTimer = 2.2;
    this.enabled = false;
    this.rate = 1.0;      // seconds between spawn attempts, scaled by intensity
    this.intensity = 1;    // 1 = light drizzle, 3 = bombardment
    this.speedScale = 1;
  }

  reset() {
    this.rocks.length = 0;
    this.shockwaves.length = 0;
    this.spawnTimer = 2.2;
    this.enabled = false;
    this.intensity = 1;
  }

  begin(intensity = 1, interval = 1.4) {
    this.enabled = true;
    this.intensity = intensity;
    this.rate = interval;
    this.spawnTimer = 0.6;
  }

  end() {
    this.enabled = false;
  }

  get active() {
    return this.rocks.length > 0 || this.shockwaves.length > 0;
  }

  rand() { return this.rng ? this.rng.next() : Math.random(); }

  spawnRock(x = null, y = null, opts = {}) {
    const px = x === null ? 1340 + this.rand() * 120 : x;
    const py = y === null ? -40 - this.rand() * 220 : y;
    const vx = opts.vx === undefined ? -(3.4 + this.rand() * 2.6) : opts.vx;
    const vy = opts.vy === undefined ? (2.3 + this.rand() * 1.9) : opts.vy;
    const size = opts.size === undefined ? (34 + this.rand() * 46) : opts.size;
    const hp = opts.hp === undefined ? (size > 62 ? 3 : size > 46 ? 2 : 1) : opts.hp;
    this.rocks.push({
      x: px, y: py,
      vx: vx * this.speedScale, vy: vy * this.speedScale,
      size, hp, maxHp: hp,
      radius: size * 0.42,
      spin: (this.rand() - 0.5) * 0.06,
      angle: this.rand() * 6.283,
      time: this.rand() * 10,
      scorched: 0,
      hostile: opts.hostile !== false,
      scoreValue: opts.scoreValue === undefined ? 90 : opts.scoreValue
    });
  }

  /** Burst of several rocks at once — used by boss phase-3 attacks. */
  volley(count = 4, from = null, spread = 260) {
    for (let i = 0; i < count; i++) {
      const jitter = (this.rand() - 0.5) * spread;
      if (from) {
        this.spawnRock(from.x + jitter * 0.2, from.y + 10, {
          vx: -(2.6 + this.rand() * 1.8),
          vy: 2.0 + this.rand() * 1.6,
          size: 30 + this.rand() * 34,
          scoreValue: 70
        });
      } else {
        this.spawnRock(1300 + this.rand() * 140, jitter + 40);
      }
    }
  }

  update(dt, world = { w: 1280, h: 720, groundY: 640 }) {
    if (this.enabled) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.rate / Math.max(1, this.intensity) * (0.65 + this.rand() * 0.8);
        this.spawnRock();
        if (this.intensity >= 2 && this.rand() < 0.45) this.spawnRock();
      }
    }

    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const m = this.rocks[i];
      m.vy += 0.035 * dt * 60;         // light gravity: streaks curve downward
      m.x += m.vx * dt * 60;
      m.y += m.vy * dt * 60;
      m.time += dt;
      m.angle += m.spin * dt * 60;
      m.scorched = Math.max(0, m.scorched - dt * 2.2);

      // ember tail
      if (this.particles && (i & 1) === 0) {
        this.particles.spawn(m.x + m.size * 0.35, m.y - m.size * 0.2,
          0.6 + this.rand() * 1.4, -0.4 + this.rand() * 0.8,
          this.rand() < 0.5 ? '#ff9a4a' : '#ffd257', 2 + this.rand() * 3, 0.42 + this.rand() * 0.3);
      }

      if (m.y >= world.groundY - m.size * 0.25) {
        this.impact(m, world);
        this.rocks.splice(i, 1);
        continue;
      }
      if (m.x < -140 || m.y > world.h + 160) this.rocks.splice(i, 1);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.t += dt;
      s.r += 560 * dt;
      if (s.t > s.dur) this.shockwaves.splice(i, 1);
    }
  }

  impact(m, world) {
    const gy = world.groundY || 640;
    this.shockwaves.push({ x: m.x, y: gy, r: m.size * 0.5, maxR: 130 + m.size * 1.6, t: 0, dur: 0.52, hit: false });
    if (this.particles) {
      const n = 10 + Math.floor(m.size / 6);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI * (0.15 + this.rand() * 0.7);
        const sp = 1.4 + this.rand() * 4.4;
        this.particles.spawn(m.x, gy - 4, Math.cos(a) * sp * (this.rand() < 0.5 ? -1 : 1),
          Math.sin(a) * sp, this.rand() < 0.4 ? '#ffe27a' : '#8a6f5c',
          2 + this.rand() * 4, 0.4 + this.rand() * 0.5);
      }
    }
  }

  /** Destroy a rock mid-flight (bullet hit): fragments + brief scorch. */
  blast(m) {
    m.hp -= 1;
    m.scorched = 1;
    if (m.hp > 0) return false;
    const idx = this.rocks.indexOf(m);
    if (idx >= 0) this.rocks.splice(idx, 1);
    if (this.particles) {
      for (let i = 0; i < 12; i++) {
        const a = this.rand() * 6.283;
        const sp = 1 + this.rand() * 3.6;
        this.particles.spawn(m.x, m.y, Math.cos(a) * sp, Math.sin(a) * sp,
          this.rand() < 0.5 ? '#ffb457' : '#c99a72', 2 + this.rand() * 4, 0.35 + this.rand() * 0.45);
      }
    }
    return true;
  }

  draw(ctx) {
    for (const m of this.rocks) {
      const d = m.size * 1.55;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.angle);
      // burn trail drawn as two tapered strokes behind the rock
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // Tapered comet tail: a gradient that fades to nothing, drawn as a thin
      // quad along the rock's own velocity vector (so it always trails behind).
      const tl = d * 1.55;
      const bk = Math.round(m.size / 6);
      const grad = cachedGradient(ctx, `tail:${bk}`, () => {
        const gr = ctx.createLinearGradient(d * 0.15, -d * 0.15, tl, -tl * 0.55);
        gr.addColorStop(0, 'rgba(255,196,120,0.50)');
        gr.addColorStop(0.45, 'rgba(255,140,60,0.20)');
        gr.addColorStop(1, 'rgba(255,90,40,0)');
        return gr;
      });
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(d * 0.10, -d * 0.14);
      ctx.lineTo(tl, -tl * 0.52);
      ctx.lineTo(tl * 0.94, -tl * 0.30);
      ctx.lineTo(d * 0.14, d * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      const ok = drawSprite(ctx, 'meteor', frameFromTime(m.time, 4, 1.6), 0, 0, d, {
        glow: true, glowScale: 0.3, glowAlpha: 0.4
      });
      if (!ok) {
        // fallback: a scorched polygon rock
        ctx.fillStyle = m.scorched > 0 ? '#ffd9a0' : '#8a6f5c';
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * 6.283;
          const r = m.size * 0.46 * (0.78 + ((i * 37) % 11) / 34);
          ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      if (m.maxHp > 1) {
        ctx.fillStyle = 'rgba(0,0,0,.5)';
        ctx.fillRect(m.x - 16, m.y - m.size * 0.72 - 6, 32, 3);
        ctx.fillStyle = '#ffb457';
        ctx.fillRect(m.x - 16, m.y - m.size * 0.72 - 6, 32 * Math.max(0, m.hp / m.maxHp), 3);
      }
    }

    for (const s of this.shockwaves) {
      const k = s.t / s.dur;
      const r = s.r * (0.4 + k * 1.0);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - k) * 0.75;
      ctx.strokeStyle = '#ffca7a';
      ctx.lineWidth = 5 * (1 - k) + 1;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, r, r * 0.34, 0, Math.PI, 0);
      ctx.stroke();
      ctx.globalAlpha = (1 - k) * 0.35;
      ctx.strokeStyle = '#ff7a3c';
      ctx.lineWidth = 10 * (1 - k) + 1;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, r * 0.72, r * 0.24, 0, Math.PI, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
}
