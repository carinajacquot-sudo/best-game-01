// enemies.js: Enemy entities (Drifter, Weaver, Tank, Hollow Crown Boss) and attack patterns.

import { CONFIG } from './config.js';

export class EnemyManager {
  constructor() {
    this.enemies = [];
    this.boss = null;
  }

  spawnDrifter(x, y) {
    this.enemies.push({
      type: 'drifter',
      x, y,
      vx: -3, vy: (Math.random() - 0.5) * 1.5,
      hp: 1, maxHp: 1,
      radius: 20,
      scoreValue: CONFIG.scoring.drifter
    });
  }

  spawnWeaver(x, y) {
    this.enemies.push({
      type: 'weaver',
      x, y,
      vx: -3.5, vy: 0,
      startY: y,
      time: Math.random() * 10,
      hp: 2, maxHp: 2,
      radius: 18,
      scoreValue: CONFIG.scoring.weaver
    });
  }

  spawnTank(x, y) {
    this.enemies.push({
      type: 'tank',
      x, y,
      vx: -1.5, vy: 0,
      hp: 5, maxHp: 5,
      radius: 28,
      scoreValue: CONFIG.scoring.tank
    });
  }

  spawnBoss() {
    this.boss = {
      x: 1100, y: 280,
      vx: 0, vy: 2,
      hp: 40, maxHp: 40,
      radius: 50,
      phase: 1,
      attackTimer: 0,
      scoreValue: CONFIG.scoring.boss
    };
  }

  update(dt, bulletManager) {
    // Update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.x += e.vx;
      if (e.type === 'drifter') {
        e.y += e.vy;
      } else if (e.type === 'weaver') {
        e.time += dt * 4;
        e.y = e.startY + Math.sin(e.time) * 80;
      }

      // Enemy shooting occasionally
      if (Math.random() < 0.008 && e.x < 1100) {
        bulletManager.spawn(e.x - 20, e.y, -5, 0, false, '#ff007f');
      }

      if (e.x < -60 || e.hp <= 0) {
        this.enemies.splice(i, 1);
      }
    }

    // Update Boss
    if (this.boss) {
      const b = this.boss;
      if (b.x > 1050) {
        b.x -= 2;
      } else {
        b.y += b.vy;
        if (b.y < 120 || b.y > 440) {
          b.vy *= -1;
        }
      }

      b.attackTimer += dt;
      if (b.attackTimer > 1.8) {
        b.attackTimer = 0;
        this.bossAttack(b, bulletManager);
      }

      if (b.hp <= 15 && b.phase === 1) b.phase = 2;
      if (b.hp <= 5 && b.phase === 2) b.phase = 3;
    }
  }

  bossAttack(b, bulletManager) {
    if (b.phase === 1) {
      // Radial burst
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        bulletManager.spawn(b.x, b.y, Math.cos(a) * 4, Math.sin(a) * 4, false, '#9d00ff');
      }
    } else if (b.phase === 2) {
      // Aimed fan spread
      for (let offset = -0.3; offset <= 0.3; offset += 0.15) {
        bulletManager.spawn(b.x - 30, b.y, -6, offset * 5, false, '#ff7700');
      }
    } else {
      // Bullet hell storm
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        bulletManager.spawn(b.x, b.y, Math.cos(a) * 5, Math.sin(a) * 5, false, '#ff007f');
      }
    }
  }

  draw(ctx) {
    // Draw standard enemies
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);

      if (e.type === 'drifter') {
        ctx.fillStyle = '#ff007f';
        ctx.shadowColor = '#ff007f';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-16, -12);
        ctx.lineTo(-10, 0);
        ctx.lineTo(-16, 12);
        ctx.closePath();
        ctx.fill();
      } else if (e.type === 'weaver') {
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (e.type === 'tank') {
        ctx.fillStyle = '#ff7700';
        ctx.shadowColor = '#ff7700';
        ctx.shadowBlur = 15;
        ctx.fillRect(-22, -22, 44, 44);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(-22, -22, 44, 44);
      }
      ctx.restore();
    }

    // Draw Boss ("The Hollow Crown")
    if (this.boss) {
      const b = this.boss;
      ctx.save();
      ctx.translate(b.x, b.y);

      // Skull body
      ctx.fillStyle = '#9d00ff';
      ctx.shadowColor = '#9d00ff';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(0, 0, 42, 0, Math.PI * 2);
      ctx.fill();

      // Crown
      ctx.fillStyle = '#ffee00';
      ctx.shadowColor = '#ffee00';
      ctx.beginPath();
      ctx.moveTo(-30, -35);
      ctx.lineTo(-40, -60);
      ctx.lineTo(-15, -45);
      ctx.lineTo(0, -65);
      ctx.lineTo(15, -45);
      ctx.lineTo(40, -60);
      ctx.lineTo(30, -35);
      ctx.closePath();
      ctx.fill();

      // Glowing eyes
      ctx.fillStyle = '#ff007f';
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(-14, -6, 8, 0, Math.PI * 2);
      ctx.arc(14, -6, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }
}
