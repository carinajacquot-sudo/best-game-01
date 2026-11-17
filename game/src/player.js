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
    this.enginePhase = 0;
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
    this.enginePhase += dt * 14;
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
      // EMBER — flagship. Layered hull, twin nacelles, canopy gradient, rim lights, engine flare.
      const eng = Math.sin(this.enginePhase) * 0.5 + 0.5; // 0..1 flicker (dt-accumulated -> deterministic)

      // Engine flare (rear), drawn first so the hull overlaps its origin
      const flare = ctx.createLinearGradient(-16, 0, -58, 0);
      flare.addColorStop(0, 'rgba(255,226,122,0.95)');
      flare.addColorStop(0.35, 'rgba(255,120,40,0.75)');
      flare.addColorStop(1, 'rgba(255,0,127,0)');
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.85 + eng * 0.15;
      ctx.fillStyle = flare;
      ctx.beginPath();
      ctx.moveTo(-16, -7); ctx.lineTo(-22 - eng * 10, 0); ctx.lineTo(-16, 7); ctx.closePath();
      ctx.moveTo(-4, -5); ctx.lineTo(-46 - eng * 18, 0); ctx.lineTo(-4, 5); ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Twin engine nacelles
      ctx.fillStyle = '#0c1626';
      ctx.strokeStyle = '#274060';
      ctx.lineWidth = 1.5;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.roundRect(-17, side * 11 - 5, 22, 10, 4);
        ctx.fill(); ctx.stroke();
        // Nacelle intake glow
        ctx.fillStyle = '#ffd75e';
        ctx.shadowColor = '#ffb02e';
        ctx.shadowBlur = 8 + eng * 6;
        ctx.beginPath(); ctx.arc(15, side * 11, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0c1626';
      }

      // Main hull: swept dart, painted with a vertical teal->ice gradient
      const hull = ctx.createLinearGradient(0, -17, 0, 17);
      hull.addColorStop(0, '#8ff4ff');
      hull.addColorStop(0.28, '#33c9e8');
      hull.addColorStop(0.52, '#0f6f9e');
      hull.addColorStop(0.78, '#0a3b5c');
      hull.addColorStop(1, '#06223a');
      ctx.fillStyle = hull;
      ctx.strokeStyle = '#dffcff';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(38, 0);
      ctx.lineTo(18, -6.5);
      ctx.lineTo(6, -13.5);
      ctx.lineTo(-2, -17);
      ctx.lineTo(-12, -8.5);
      ctx.lineTo(-9, 0);
      ctx.lineTo(-12, 8.5);
      ctx.lineTo(-2, 17);
      ctx.lineTo(6, 13.5);
      ctx.lineTo(18, 6.5);
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      // Cyan rim light, top edge (against the purple sky)
      ctx.strokeStyle = 'rgba(190,255,255,0.9)';
      ctx.lineWidth = 1.6;
      ctx.shadowColor = '#46f8ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(38, 0.5); ctx.lineTo(18, -6); ctx.lineTo(6, -13);
      ctx.stroke();

      // Magenta rim light, lower edge (against the horizon glow)
      ctx.strokeStyle = 'rgba(255,45,160,0.85)';
      ctx.beginPath();
      ctx.moveTo(38, -0.5); ctx.lineTo(18, 6); ctx.lineTo(6, 13);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Canopy: elongated glass teardrop with hot specular
      const canopy = ctx.createLinearGradient(18, 0, -8, 0);
      canopy.addColorStop(0, '#eaffff');
      canopy.addColorStop(0.35, '#67e6ff');
      canopy.addColorStop(0.75, '#0b4a66');
      canopy.addColorStop(1, '#041824');
      ctx.fillStyle = canopy;
      ctx.beginPath();
      ctx.ellipse(9, 0, 12.5, 5.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.ellipse(12.5, -1.6, 4.2, 1.5, -0.18, 0, Math.PI * 2); ctx.fill();

      // Panel seam lines + hull bolts
      ctx.strokeStyle = 'rgba(4,16,28,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, -6); ctx.lineTo(4, -9.5);
      ctx.moveTo(20, 6); ctx.lineTo(4, 9.5);
      ctx.moveTo(-3, -12); ctx.lineTo(-8, -6.5);
      ctx.moveTo(-3, 12); ctx.lineTo(-8, 6.5);
      ctx.stroke();
      ctx.fillStyle = 'rgba(234,255,255,0.85)';
      for (const [bx, by] of [[26, -3], [26, 3], [-4, -10.5], [-4, 10.5]]) {
        ctx.fillRect(bx - 0.6, by - 0.6, 1.2, 1.2);
      }

      // Nose beacon
      ctx.fillStyle = '#ff2da0';
      ctx.shadowColor = '#ff2da0';
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(36, 0, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
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
