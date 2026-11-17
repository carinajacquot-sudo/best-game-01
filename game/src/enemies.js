// enemies.js: original procedural foes and the three-phase Hollow Crown encounter.
import { CONFIG } from './config.js';

export class EnemyManager {
  constructor(rng = null) {
    this.rng = rng;
    this.enemies = [];
    this.boss = null;
  }

  rand() { return this.rng ? this.rng.next() : Math.random(); }

  spawnDrifter(x, y) {
    this.enemies.push({ type: 'drifter', x, y, vx: -3.2, vy: (this.rand() - 0.5) * 1.8, hp: 1, maxHp: 1, radius: 19, scoreValue: CONFIG.scoring.drifter, time: this.rand() * 8 });
  }

  spawnWeaver(x, y) {
    this.enemies.push({ type: 'weaver', x, y, vx: -3.35, vy: 0, startY: y, time: this.rand() * 10, hp: 2, maxHp: 2, radius: 18, scoreValue: CONFIG.scoring.weaver });
  }

  spawnTank(x, y) {
    this.enemies.push({ type: 'tank', x, y, vx: -1.65, vy: 0, hp: 5, maxHp: 5, radius: 28, scoreValue: CONFIG.scoring.tank });
  }

  spawnPrism(x, y) {
    this.enemies.push({ type: 'prism', x, y, vx: -2.4, vy: 0, startY: y, time: this.rand() * 5, attackTimer: 1.25 + this.rand(), hp: 3, maxHp: 3, radius: 23, scoreValue: 240 });
  }

  spawnLancer(x, y) {
    this.enemies.push({ type: 'lancer', x, y, vx: -2.8, vy: 0, attackTimer: 1.4, hp: 2, maxHp: 2, radius: 17, scoreValue: 220, lock: 0 });
  }

  spawnBoss(sector = 1) {
    const names = ['Glass Manta', 'Thorn Choir', 'Prism Forge', 'Twin Tides', 'Cinder Warden', 'Veil Engine', 'Lantern Carrier', 'Rail Saint', 'Eclipse Maw', 'Crown of Silence'];
    const colors = ['#76f4ff', '#ee77ff', '#b7ff72', '#ff955d', '#ffe27a', '#8f9dff', '#ff6ac1', '#6cf0d2', '#9f7bff', '#fff0c2'];
    const style = (sector - 1) % 10;
    const hp = 38 + sector * 3;
    this.boss = { x: 1120, y: 300, vx: 0, vy: 2.1, hp, maxHp: hp, radius: 56, phase: 1, attackTimer: 0, telegraph: 0, angle: 0, style, title: names[style], color: colors[style], scoreValue: CONFIG.scoring.boss + (sector - 1) * 250 };
  }

  update(dt, bulletManager, player = null) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.x += e.vx * dt * 60;
      if (e.type === 'drifter') {
        e.time += dt * 4;
        e.y += (e.vy + Math.sin(e.time) * 0.55) * dt * 60;
      } else if (e.type === 'weaver') {
        e.time += dt * 4;
        e.y = e.startY + Math.sin(e.time) * 82;
      } else if (e.type === 'prism') {
        e.time += dt * 2.8;
        e.y = e.startY + Math.sin(e.time) * 68;
        e.attackTimer -= dt;
        if (e.attackTimer <= 0 && e.x < 1080) {
          e.attackTimer = 2.15;
          for (const spread of [-1, 0, 1]) bulletManager.spawn(e.x - 16, e.y + spread * 5, -4.4, spread * 2.1, false, '#b7ff72');
        }
      } else if (e.type === 'lancer') {
        if (player && e.x < 980) {
          const dy = player.y - e.y;
          e.vy = Math.max(-2.6, Math.min(2.6, dy * 0.012));
          e.y += e.vy * dt * 60;
        }
        e.attackTimer -= dt;
        if (e.attackTimer <= 0 && e.x < 930) {
          e.attackTimer = 2.35;
          e.lock = 0.28;
          const angle = Math.atan2((player ? player.y : 360) - e.y, (player ? player.x : 280) - e.x);
          for (const spread of [-0.14, 0, 0.14]) bulletManager.spawn(e.x - 10, e.y, Math.cos(angle + spread) * 5.3, Math.sin(angle + spread) * 5.3, false, '#ffe27a');
        }
        e.lock = Math.max(0, e.lock - dt);
      }

      if (e.type !== 'prism' && e.type !== 'lancer' && this.rand() < 1 - Math.pow(1 - 0.006, dt * 60) && e.x < 1100) {
        bulletManager.spawn(e.x - 18, e.y, -4.8, 0, false, e.type === 'tank' ? '#ff9a62' : '#ff6aa8');
      }
      if (e.x < -65 || e.hp <= 0) this.enemies.splice(i, 1);
    }

    if (!this.boss) return;
    const b = this.boss;
    if (b.x > 1035) b.x -= 2.1 * dt * 60;
    else {
      b.y += b.vy * dt * (b.phase === 3 ? 1.35 : 1);
      if (b.y < 122 || b.y > 495) b.vy *= -1;
      b.x = 1035 + Math.sin(performance.now() / 1100) * 22;
    }
    b.phase = b.hp <= b.maxHp * 0.28 ? 3 : b.hp <= b.maxHp * 0.62 ? 2 : 1;
    b.angle += dt * (0.8 + b.phase * 0.36);
    b.attackTimer += dt;
    b.telegraph = b.attackTimer > (b.phase === 3 ? 1.08 : 1.35) ? Math.min(1, (b.attackTimer - (b.phase === 3 ? 1.08 : 1.35)) / 0.55) : 0;
    const baseInterval = b.phase === 1 ? 2.15 : b.phase === 2 ? 1.75 : 1.32;
    const interval = Math.max(0.92, baseInterval - b.style * 0.045);
    if (b.attackTimer >= interval) {
      b.attackTimer = 0;
      b.telegraph = 0;
      this.bossAttack(b, bulletManager, player);
    }
  }

  bossAttack(b, bullets, player) {
    if (b.phase === 3) {
      // Low-health finale: a rotating, readable spiral with an increasing turn rate.
      for (let i = 0; i < 7; i++) {
        const angle = b.angle + i * (Math.PI * 2 / 7);
        bullets.spawn(b.x, b.y, Math.cos(angle) * 4.25, Math.sin(angle) * 4.25, false, b.color);
      }
    } else if (b.phase === 2) {
      const dx = (player ? player.x : 300) - b.x;
      const dy = (player ? player.y : 360) - b.y;
      const base = Math.atan2(dy, dx);
      for (const offset of [-0.28, -0.14, 0, 0.14, 0.28]) bullets.spawn(b.x - 25, b.y, Math.cos(base + offset) * 5.0, Math.sin(base + offset) * 5.0, false, '#ff955d');
    } else if (b.style % 5 === 0) {
      // Slow, readable orbiting ring with deliberate gaps.
      for (let i = 0; i < 8; i++) {
        const angle = b.angle + i * Math.PI / 4;
        if (i === 2 || i === 6) continue;
        bullets.spawn(b.x, b.y, Math.cos(angle) * 3.6, Math.sin(angle) * 3.6, false, b.color);
      }
    } else if (b.style % 5 === 1) {
      // Paired crossing lanes leave a moving opening in the middle.
      for (const sign of [-1, 1]) for (const lane of [-1, 0, 1]) bullets.spawn(b.x, b.y + lane * 20, -4.2, sign * (2.2 + Math.abs(lane) * 0.35), false, b.color);
    } else if (b.style % 5 === 2) {
      // Three alternating arcs, offset each salvo so the pattern travels.
      for (let i = -2; i <= 2; i++) bullets.spawn(b.x - 14, b.y, -5, i * 1.35 + Math.sin(b.angle) * 0.8, false, b.color);
    } else if (b.style % 5 === 3) {
      // Twin orbiting seeds peel away from opposite sides.
      for (const sign of [-1, 1]) {
        const angle = b.angle * sign;
        bullets.spawn(b.x, b.y + sign * 28, -3.2 + Math.cos(angle) * 2.3, Math.sin(angle) * 3.2, false, b.color);
      }
    } else {
      // A slow three-lane wall that demands a deliberate vertical dodge.
      for (const vy of [-2.6, 0, 2.6]) bullets.spawn(b.x - 18, b.y, -5.1, vy, false, b.color);
    }
  }

  draw(ctx) {
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      const color = e.type === 'drifter' ? '#ff4f9f' : e.type === 'weaver' ? '#33e8ff' : e.type === 'tank' ? '#ff9a62' : e.type === 'lancer' ? '#ffe27a' : '#b7ff72';
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = 1.7;
      ctx.shadowColor = color;
      ctx.shadowBlur = e.type === 'tank' ? 18 : 13;
      if (e.type === 'drifter') {
        ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(-14, -13); ctx.lineTo(-7, 0); ctx.lineTo(-14, 13); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff4cc'; ctx.fillRect(2, -2, 5, 4);
      } else if (e.type === 'weaver') {
        ctx.rotate(e.time * 0.5);
        ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(18, 0); ctx.lineTo(0, 20); ctx.lineTo(-18, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#07121c'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      } else if (e.type === 'tank') {
        ctx.beginPath(); ctx.roundRect(-23, -22, 46, 44, 9); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(40,12,20,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-12, -12); ctx.lineTo(12, 12); ctx.moveTo(12, -12); ctx.lineTo(-12, 12); ctx.stroke();
      } else if (e.type === 'lancer') {
        ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(-12, -10); ctx.lineTo(-4, 0); ctx.lineTo(-12, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = e.lock > 0 ? '#ffffff' : 'rgba(255,226,122,.5)'; ctx.lineWidth = e.lock > 0 ? 3 : 1;
        ctx.beginPath(); ctx.moveTo(-14, -7); ctx.lineTo(-27, 0); ctx.lineTo(-14, 7); ctx.stroke();
      } else {
        ctx.rotate(e.time * 0.35);
        for (let i = 0; i < 6; i++) {
          ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.ellipse(0, -16, 6, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        ctx.fillStyle = '#f4ffd1'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      }
      if (e.maxHp > 1) {
        ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(-20, 30, 40, 4);
        ctx.fillStyle = color; ctx.fillRect(-20, 30, 40 * Math.max(0, e.hp / e.maxHp), 4);
      }
      ctx.restore();
    }

    const b = this.boss;
    if (!b) return;
    ctx.save();
    ctx.translate(b.x, b.y);
    const color = b.phase === 1 ? b.color : b.phase === 2 ? '#ff955d' : '#ff4f9f';
    ctx.rotate(Math.sin(performance.now() / 430) * 0.035);
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.shadowColor = color; ctx.shadowBlur = 22;
    // Concentric, original crown-orbit rings; telegraph glow intensifies before each attack.
    for (let ring = 0; ring < 3; ring++) {
      ctx.beginPath(); ctx.ellipse(0, 0, 54 + ring * 12 + b.telegraph * 8, 42 + ring * 8, b.angle * (ring % 2 ? -1 : 1), -0.2, Math.PI * 1.55); ctx.stroke();
    }
    ctx.fillStyle = '#21123d'; ctx.strokeStyle = color; ctx.lineWidth = 4;
    ctx.shadowColor = color; ctx.shadowBlur = 20;
    const hull = b.style;
    if (hull === 0) {
      ctx.beginPath(); ctx.moveTo(-42, -18); ctx.lineTo(-28, -42); ctx.lineTo(-12, -28); ctx.lineTo(0, -54); ctx.lineTo(13, -28); ctx.lineTo(31, -41); ctx.lineTo(43, -15); ctx.lineTo(34, 28); ctx.lineTo(0, 44); ctx.lineTo(-34, 28); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (hull === 1) {
      ctx.beginPath(); ctx.moveTo(55, 0); ctx.lineTo(12, -18); ctx.lineTo(-46, -50); ctx.lineTo(-30, -8); ctx.lineTo(-48, 0); ctx.lineTo(-30, 8); ctx.lineTo(-46, 50); ctx.lineTo(12, 18); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (hull === 2) {
      ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; const r = i % 2 ? 38 : 58; const x = Math.cos(a) * r; const y = Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (hull === 3) {
      ctx.beginPath(); ctx.ellipse(-25, 0, 31, 39, -0.25, 0, Math.PI * 2); ctx.ellipse(25, 0, 31, 39, 0.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color; ctx.fillRect(-8, -12, 16, 24);
    } else if (hull === 4) {
      ctx.beginPath(); ctx.roundRect(-48, -36, 96, 72, 14); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-38 + i * 19, -36); ctx.lineTo(-48 + i * 19, -55); ctx.lineTo(-20 + i * 19, -39); ctx.stroke(); }
    } else if (hull === 5) {
      ctx.beginPath(); ctx.arc(0, 0, 37, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 60, 24, b.angle, 0, Math.PI * 2); ctx.stroke();
    } else if (hull === 6) {
      ctx.beginPath(); ctx.roundRect(-25, -24, 50, 48, 12); ctx.fill(); ctx.stroke();
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * 20, -14); ctx.lineTo(side * 58, -28); ctx.lineTo(side * 48, 0); ctx.lineTo(side * 58, 28); ctx.lineTo(side * 20, 14); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    } else if (hull === 7) {
      ctx.beginPath(); ctx.moveTo(58, 0); ctx.lineTo(14, -11); ctx.lineTo(-52, -26); ctx.lineTo(-42, -8); ctx.lineTo(-48, 0); ctx.lineTo(-42, 8); ctx.lineTo(-52, 26); ctx.lineTo(14, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color; ctx.fillRect(-38, -3, 78, 6);
    } else if (hull === 8) {
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 62, 39, -0.4, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 62, 39, 0.7, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(-50, -26); ctx.lineTo(-18, -34); ctx.lineTo(0, -18); ctx.lineTo(18, -34); ctx.lineTo(50, -26); ctx.lineTo(37, 0); ctx.lineTo(50, 26); ctx.lineTo(18, 34); ctx.lineTo(0, 18); ctx.lineTo(-18, 34); ctx.lineTo(-50, 26); ctx.lineTo(-37, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * 34, -12); ctx.lineTo(side * 62, -22); ctx.lineTo(side * 56, 0); ctx.lineTo(side * 62, 22); ctx.lineTo(side * 34, 12); ctx.stroke(); }
    }
    ctx.fillStyle = color; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(-14, -4, 7 + b.telegraph * 3, 0, Math.PI * 2); ctx.arc(14, -4, 7 + b.telegraph * 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffe4a3'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-13, 21); ctx.quadraticCurveTo(0, 31, 13, 21); ctx.stroke();
    ctx.restore();
  }
}
