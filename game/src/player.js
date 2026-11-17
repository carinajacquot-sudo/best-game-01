// player.js: five original pilot craft with distinct handling, weapons, and procedural silhouettes.
import { CONFIG } from './config.js';
import { clamp } from './util.js';

export const SHIPS = [
  { name: 'EMBER', role: 'Balanced', speed: 7.0, fireRate: 6.0, lives: 3, weapon: 'single', color: '#43f3ff', shield: false },
  { name: 'COMET', role: 'Interceptor', speed: 9.0, fireRate: 5.2, lives: 3, weapon: 'needle', color: '#ffe27a', shield: false },
  { name: 'AURELIA', role: 'Guardian', speed: 6.1, fireRate: 5.3, lives: 4, weapon: 'single', color: '#ff9b71', shield: true },
  { name: 'VESPER', role: 'Dancer', speed: 7.5, fireRate: 5.0, lives: 2, weapon: 'twin', color: '#d69bff', shield: false },
  { name: 'SOLACE', role: 'Artillery', speed: 5.9, fireRate: 3.4, lives: 3, weapon: 'burst', color: '#b7ff72', shield: false },
];

export class Player {
  constructor(x, y, shipIndex = 0) {
    this.x = x;
    this.y = y;
    this.shipIndex = ((shipIndex % SHIPS.length) + SHIPS.length) % SHIPS.length;
    this.profile = SHIPS[this.shipIndex];
    this.radius = this.profile.name === 'AURELIA' ? 21 : 18;
    this.speed = this.profile.speed || CONFIG.player.speed;
    this.fireRate = this.profile.fireRate || CONFIG.player.fireRate;
    this.lives = this.profile.lives || CONFIG.player.maxLives;
    this.maxLives = this.lives;
    this.invulnTimer = 0;
    this.fireTimer = 0;
    this.flareTimer = 0;
    this.aegisShield = this.profile.shield;
    this.magnetTimer = 0;
    this.pulseCharge = 0;
  }

  update(dt, input) {
    const dx = input.getAxisX();
    const dy = input.getAxisY();
    const moveSpeed = this.speed * dt * 60;
    const scale = dx !== 0 && dy !== 0 ? 0.7071 : 1;
    this.x = clamp(this.x + dx * scale * moveSpeed, 42, CONFIG.width - 44);
    this.y = clamp(this.y + dy * scale * moveSpeed, 46, 540);
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.flareTimer > 0) this.flareTimer -= dt;
    if (this.magnetTimer > 0) this.magnetTimer -= dt;
    if (this.fireTimer > 0) this.fireTimer -= dt;
  }

  canFire() {
    if (this.fireTimer <= 0) {
      this.fireTimer = 1 / this.fireRate;
      return true;
    }
    return false;
  }

  hit() {
    if (this.invulnTimer > 0) return false;
    if (this.aegisShield) {
      this.aegisShield = false;
      this.invulnTimer = 1.0;
      return false;
    }
    this.lives--;
    this.invulnTimer = CONFIG.player.invulnTime;
    return true;
  }

  draw(ctx) {
    if (this.invulnTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    const color = this.profile.color;
    const charge = Math.min(1, this.pulseCharge / 100);
    ctx.shadowColor = color;
    ctx.shadowBlur = 16 + charge * 8;
    ctx.fillStyle = color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    // Each craft has a distinct silhouette built from original canvas geometry.
    if (this.shipIndex === 0) {
      ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(-15, -15); ctx.lineTo(-7, 0); ctx.lineTo(-15, 15); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (this.shipIndex === 1) {
      ctx.beginPath(); ctx.moveTo(29, 0); ctx.lineTo(-20, -8); ctx.lineTo(-10, 0); ctx.lineTo(-20, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-17, -5); ctx.lineTo(-28, -12); ctx.moveTo(-17, 5); ctx.lineTo(-28, 12); ctx.stroke();
    } else if (this.shipIndex === 2) {
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(2, -13); ctx.lineTo(-16, -21); ctx.lineTo(-9, -5); ctx.lineTo(-20, 0); ctx.lineTo(-9, 5); ctx.lineTo(-16, 21); ctx.lineTo(2, 13); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (this.shipIndex === 3) {
      ctx.beginPath(); ctx.moveTo(25, 0); ctx.quadraticCurveTo(4, -10, -17, -20); ctx.lineTo(-7, 0); ctx.lineTo(-17, 20); ctx.quadraticCurveTo(4, 10, 25, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(28, 0); ctx.lineTo(3, -18); ctx.lineTo(-18, -15); ctx.lineTo(-8, 0); ctx.lineTo(-18, 15); ctx.lineTo(3, 18); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f4ffd1'; ctx.fillRect(-4, -3, 12, 6);
    }

    // Twin cannons and weapon glow.
    ctx.fillStyle = '#fff7d6';
    if (this.profile.weapon === 'twin') {
      ctx.fillRect(6, -10, 13, 3); ctx.fillRect(6, 7, 13, 3);
    } else if (this.profile.weapon === 'needle') {
      ctx.fillRect(12, -2, 14, 4);
    } else if (this.profile.weapon === 'burst') {
      ctx.fillRect(3, -3, 18, 6);
    } else {
      ctx.beginPath(); ctx.arc(4, 0, 5, 0, Math.PI * 2); ctx.fill();
    }

    if (charge > 0) {
      ctx.strokeStyle = charge >= 1 ? '#ffe27a' : 'rgba(130, 255, 244, .72)';
      ctx.lineWidth = 2 + charge * 2;
      ctx.shadowColor = charge >= 1 ? '#ffe27a' : '#48fff0';
      ctx.shadowBlur = 10 + charge * 16;
      ctx.beginPath(); ctx.arc(0, 0, 31 + Math.sin(Date.now() / 180) * 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge); ctx.stroke();
    }
    if (this.aegisShield) {
      ctx.strokeStyle = '#ffcc73'; ctx.lineWidth = 3; ctx.shadowColor = '#ff9b71'; ctx.shadowBlur = 22;
      ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}
