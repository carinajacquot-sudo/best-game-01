// player.js: Player (Ember Wing) ship entity, movement, firing, and invulnerability states.

import { CONFIG } from './config.js';
import { clamp } from './util.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 18;
    this.speed = CONFIG.player.speed;
    this.lives = CONFIG.player.maxLives;
    this.invulnTimer = 0;
    this.fireTimer = 0;
    this.flareTimer = 0;
    this.aegisShield = false;
    this.magnetTimer = 0;
  }

  update(dt, input) {
    const dx = input.getAxisX();
    const dy = input.getAxisY();
    const moveSpeed = this.speed * dt * 60;
    if (dx !== 0 && dy !== 0) {
      // Normalize diagonal movement
      this.x += dx * 0.7071 * moveSpeed;
      this.y += dy * 0.7071 * moveSpeed;
    } else {
      this.x += dx * moveSpeed;
      this.y += dy * moveSpeed;
    }

    // Keep within bounds
    this.x = clamp(this.x, 40, CONFIG.width - 40);
    this.y = clamp(this.y, 40, 520);

    if (this.invulnTimer > 0) {
      this.invulnTimer -= dt;
    }
    if (this.flareTimer > 0) {
      this.flareTimer -= dt;
    }
    if (this.magnetTimer > 0) {
      this.magnetTimer -= dt;
    }
    if (this.fireTimer > 0) {
      this.fireTimer -= dt;
    }
  }

  canFire() {
    if (this.fireTimer <= 0) {
      this.fireTimer = 1 / CONFIG.player.fireRate;
      return true;
    }
    return false;
  }

  hit() {
    if (this.invulnTimer > 0) return false;
    if (this.aegisShield) {
      this.aegisShield = false;
      this.invulnTimer = 1.0;
      return false; // shield absorbed hit
    }
    this.lives--;
    this.invulnTimer = CONFIG.player.invulnTime;
    return true; // life lost
  }

  draw(ctx) {
    if (this.invulnTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0) {
      return; // blink effect during invulnerability
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    // Glow / Shadow
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 15;

    // Winged spark / Ember shape
    ctx.fillStyle = '#00f0ff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-14, -14);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-14, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Core bright spark
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(4, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    // Aegis shield visual
    if (this.aegisShield) {
      ctx.strokeStyle = '#ff7700';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff7700';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}
