// bullets.js: Projectile pool and drawing.
//
// PERFORMANCE NOTE (v7.1): every bullet used to build two CanvasGradients and
// two shadowBlur'd shapes per frame. The bullet visuals are identical apart
// from their colour, so they are now pre-rendered ONCE into small sprite
// canvases (one per colour) and blitted. A bullet therefore costs a single
// drawImage instead of a gradient allocation + blur.

export class BulletManager {
  constructor() {
    this.bullets = [];
    this.sprites = new Map(); // color -> { player, enemy }
  }

  spawn(x, y, vx, vy, isPlayer = true, color = '#00f0ff') {
    this.bullets.push({
      x, y, vx, vy, isPlayer, color, radius: isPlayer ? 6 : 5
    });
  }

  update(dt) {
    const bullets = this.bullets;
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt * 60;
      b.y += b.vy * dt * 60;
      if (b.x < -50 || b.x > 1330 || b.y < -50 || b.y > 770) {
        bullets.splice(i, 1);
      }
    }
  }

  clear() {
    this.bullets.length = 0;
  }

  /** Pre-render a bullet sprite (glow included) for a given colour. */
  getSprite(color, isPlayer) {
    let entry = this.sprites.get(color);
    if (!entry) {
      entry = { player: null, enemy: null };
      this.sprites.set(color, entry);
    }
    const key = isPlayer ? 'player' : 'enemy';
    if (entry[key]) return entry[key];

    const R = isPlayer ? 30 : 16;
    const size = R * 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const c = canvas.getContext('2d');
    c.translate(R, R);

    if (isPlayer) {
      // Horizontal plasma bolt pointing +x, with a bloom.
      // Outer bloom (was shadowBlur 22 + a 26x9 body).
      c.globalCompositeOperation = 'lighter';
      const grad = c.createLinearGradient(-R, 0, R, 0);
      grad.addColorStop(0, color + '00');
      grad.addColorStop(0.35, color + '77');
      grad.addColorStop(0.65, color + '77');
      grad.addColorStop(1, color + '00');
      c.fillStyle = grad;
      c.beginPath(); c.roundRect(-R, -9, size, 18, 9); c.fill();
      c.fillStyle = color;
      c.globalAlpha = 0.9;
      c.beginPath(); c.roundRect(-13, -4.5, 26, 9, 4.5); c.fill();
      c.globalAlpha = 1;
      c.fillStyle = '#ffffff';
      c.beginPath(); c.roundRect(-10, -2.4, 20, 4.8, 2.4); c.fill();
      c.globalAlpha = 0.85;
      c.fillStyle = '#aef6ff';
      c.beginPath(); c.roundRect(6, -1.6, 6, 3.2, 1.6); c.fill();
    } else {
      // Enemy orb: hot core, coloured corona, dark rim, faint halo ring.
      c.globalCompositeOperation = 'lighter';
      const core = c.createRadialGradient(0, 0, 0.5, 0, 0, 7);
      core.addColorStop(0, '#ffffff');
      core.addColorStop(0.35, color);
      core.addColorStop(0.85, color + '66');
      core.addColorStop(1, color + '00');
      c.fillStyle = core;
      c.beginPath(); c.arc(0, 0, 7, 0, Math.PI * 2); c.fill();
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 0.55;
      c.strokeStyle = '#0a0214';
      c.lineWidth = 1.6;
      c.beginPath(); c.arc(0, 0, 3.1, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 0.5;
      c.strokeStyle = color;
      c.lineWidth = 1;
      c.beginPath(); c.arc(0, 0, 9.5, 0, Math.PI * 2); c.stroke();
    }

    entry[key] = canvas;
    return canvas;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // The 2.5D ground-bounce pool belongs on the FLOOR, not under the bolt:
    // drawing it for every mid-air round smeared a haze blob behind each bullet.
    // It is now drawn only for rounds in the lower band, pinned to the floor
    // line and faded in with proximity.
    const GROUND = 640;
    const showPools = this.poolsEnabled !== false;

    for (const b of this.bullets) {
      if (showPools && b.y > 468) {
        const near = Math.min(1, (b.y - 468) / 150);
        const poolSprite = this.getPoolSprite(b.color);
        ctx.save();
        ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.35 + near * 0.5;
        ctx.drawImage(poolSprite, b.x - poolSprite.width / 2, GROUND - poolSprite.height / 2);
        ctx.restore();
      }

      const sprite = this.getSprite(b.color, b.isPlayer);
      if (b.isPlayer) {
        const dir = Math.atan2(b.vy, b.vx);
        const stretch = 1 + Math.min(0.8, Math.hypot(b.vx, b.vy) * 0.015);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(dir);
        ctx.scale(stretch, 1);
        ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
        ctx.restore();
      } else {
        ctx.drawImage(sprite, b.x - sprite.width / 2, b.y - sprite.height / 2);
      }
    }

    ctx.restore();
  }

  /** Pre-rendered elliptical light pool used for the 2.5D ground bounce. */
  getPoolSprite(color) {
    let entry = this.sprites.get(color + '::pool');
    if (entry) return entry;
    const R = 34;
    const canvas = document.createElement('canvas');
    canvas.width = R * 4;
    canvas.height = R * 2;
    const c = canvas.getContext('2d');
    c.translate(R * 2, R);
    c.scale(1.9, 0.55);
    const pool = c.createRadialGradient(0, 0, 2, 0, 0, R);
    pool.addColorStop(0, color + '55');
    pool.addColorStop(1, color + '00');
    c.fillStyle = pool;
    c.beginPath();
    c.arc(0, 0, R, 0, Math.PI * 2);
    c.fill();
    this.sprites.set(color + '::pool', canvas);
    return canvas;
  }
}
