// enemies.js: modelled alien foes (Kaggle Meshy sprites) and the Hollow Crown
// bosses, now driven by a randomised technique library instead of one script.
//
// Design notes
// ------------
// * Every foe is a real 3D-baked alien silhouette drawn as a cached sprite
//   blit (see assets.js). The old "small triangle" placeholders are gone; each
//   type also got its own movement personality so encounters read differently.
// * Bosses own a REPERTOIRE of 5-7 techniques drawn from a pool of twelve. The
//   technique used on each attack tick is chosen at random (never repeating the
//   previous one), and its geometry is re-randomised every time, so a boss run
//   never plays out the same way twice.
// * Boss power is up across the board: more hull, faster cadence in later
//   phases, contact damage, a dash attack, and a phase-3 meteor bombardment.
// * Multi-tick techniques (sweep beam, pulse rings) run off a small script
//   state machine on the boss, so nothing needs to be scheduled from main.js.

import { CONFIG } from './config.js';
import { cachedGradient } from './perf.js';
import { drawSprite, frameFromTime, hasSprite } from './assets.js';

/** Shared neon halo used by the procedural fallbacks. */
function glowFill(ctx, color) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = color;
  ctx.globalAlpha *= 0.30;
  ctx.scale(1.16, 1.16);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = color;
  ctx.globalAlpha *= 0.42;
  ctx.scale(1.07, 1.07);
  ctx.fill();
  ctx.restore();
}

export const ALIEN_KINDS = {
  grunt: { sprite: 'grunt', hp: 1, radius: 20, size: 52, score: 100, color: '#4ff0d8' },
  drone: { sprite: 'drone', hp: 2, radius: 19, size: 50, score: 150, color: '#e061ff' },
  lancer: { sprite: 'lancer', hp: 2, radius: 19, size: 52, score: 220, color: '#ffd257' },
  tank: { sprite: 'tank', hp: 6, radius: 30, size: 78, score: 300, color: '#7dff5c' },
  swarm: { sprite: 'swarm', hp: 3, radius: 23, size: 58, score: 240, color: '#a45cff' },
  stalker: { sprite: 'stalker', hp: 3, radius: 22, size: 60, score: 260, color: '#ff7a4f' },
  mine: { sprite: 'mine', hp: 2, radius: 21, size: 46, score: 130, color: '#ffc45a' }
};

const BOSS_TITLES = ['Glass Manta', 'Thorn Choir', 'Prism Forge', 'Twin Tides', 'Cinder Warden',
  'Veil Engine', 'Lantern Carrier', 'Rail Saint', 'Eclipse Maw', 'Crown of Silence'];
const BOSS_COLORS = ['#76f4ff', '#ee77ff', '#b7ff72', '#ff955d', '#ffe27a',
  '#8f9dff', '#ff6ac1', '#6cf0d2', '#9f7bff', '#fff0c2'];

export class EnemyManager {
  constructor(rng = null) {
    this.rng = rng;
    this.enemies = [];
    this.boss = null;
    this.meteors = null;   // set by main.js so bosses can call meteor rain
    this.time = 0;
  }

  rand() { return this.rng ? this.rng.next() : Math.random(); }

  pick(list) { return list[Math.floor(this.rand() * list.length) % list.length]; }

  // ---------------------------------------------------------------- spawning

  add(kind, x, y, extra = {}) {
    const k = ALIEN_KINDS[kind];
    const e = {
      kind, type: kind, sprite: k.sprite,
      x, y, vx: 0, vy: 0,
      hp: k.hp, maxHp: k.hp, radius: k.radius, size: k.size,
      color: k.color, scoreValue: k.score,
      time: this.rand() * 10, attackTimer: 0.9 + this.rand() * 1.5,
      hitFlash: 0, dead: false, ...extra
    };
    this.enemies.push(e);
    return e;
  }

  // legacy names stay valid: the harness and the level table call these
  spawnDrifter(x, y) { return this.add('grunt', x, y, { vx: -3.2, vy: (this.rand() - 0.5) * 1.8, bob: 0.55 }); }
  spawnWeaver(x, y) { return this.add('drone', x, y, { vx: -3.4, startY: y, amp: 82, freq: 1.0 }); }
  spawnTank(x, y) { return this.add('tank', x, y, { vx: -1.5, feedTimer: 1.4 }); }
  spawnPrism(x, y) { return this.add('swarm', x, y, { vx: -2.4, startY: y, amp: 68, freq: 0.7, attackTimer: 1.25 + this.rand() }); }
  spawnLancer(x, y) { return this.add('lancer', x, y, { vx: -2.8, lock: 0, attackTimer: 1.4 }); }
  spawnStalker(x, y) { return this.add('stalker', x, y, { vx: -2.2, state: 'stalk', stateT: 0.9 + this.rand() * 0.7 }); }
  spawnMine(x, y) { return this.add('mine', x, y, { vx: -0.9, fuse: -1 }); }
  spawnSwarm(x, y) { return this.spawnPrism(x, y); }

  spawnAlien(kind, x, y) {
    switch (kind) {
      case 'grunt': return this.spawnDrifter(x, y);
      case 'drone': return this.spawnWeaver(x, y);
      case 'tank': return this.spawnTank(x, y);
      case 'swarm': return this.spawnPrism(x, y);
      case 'lancer': return this.spawnLancer(x, y);
      case 'stalker': return this.spawnStalker(x, y);
      case 'mine': return this.spawnMine(x, y);
      default: return this.spawnDrifter(x, y);
    }
  }

  spawnBoss(sector = 1) {
    const style = (sector - 1) % 10;
    // Power step-up vs v7: much heavier hull, so the extra techniques matter.
    const hp = 64 + sector * 9;
    const b = {
      x: 1120, y: 300, vx: 0, vy: 2.35,
      hp, maxHp: hp, radius: 62, size: 168,
      phase: 1, attackTimer: 0, telegraph: 0, angle: 0,
      style, title: BOSS_TITLES[style], color: BOSS_COLORS[style],
      sprite: `boss${style}`,
      scoreValue: CONFIG.scoring.boss + (sector - 1) * 250,
      drift: 0, hitFlash: 0, script: null, lastTech: -1, dashT: 0,
      // A boss never gets the whole library: it rolls a personal repertoire,
      // so the ten Hollow Crown bosses each fight differently.
      repertoire: this.rollRepertoire(style)
    };
    this.boss = b;
    return b;
  }

  rollRepertoire(style) {
    // Twelve techniques; each boss keeps a deterministic-length random subset.
    const pool = [
      'spiral', 'aimedFan', 'gapWall', 'ringBurst', 'sweepBeam', 'seekers',
      'crossLanes', 'pulseRings', 'zigzag', 'meteorRain', 'summon', 'dash'
    ];
    const count = 5 + (style % 3);           // 5..7 techniques per boss
    const picked = [];
    // the first technique is style-specific so the ten openings stay distinct
    picked.push(pool[style % pool.length]);
    let guard = 0;
    while (picked.length < count && guard++ < 60) {
      const t = pool[Math.floor(this.rand() * pool.length)];
      if (!picked.includes(t)) picked.push(t);
    }
    return picked;
  }

  // ------------------------------------------------------------------ update

  update(dt, bulletManager, player = null) {
    this.time += dt;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e) continue;
      e.hitFlash = Math.max(0, e.hitFlash - dt * 4);
      this.updateAlien(e, dt, bulletManager, player);
      if (e.x < -80 || e.hp <= 0) {
        if (e.hp <= 0 && e.kind === 'swarm') this.splitSwarm(e);
        this.enemies.splice(i, 1);
      }
    }

    if (!this.boss) return;
    this.updateBoss(dt, bulletManager, player);
    this.steerSeekers(dt, player);
  }

  updateAlien(e, dt, bullets, player) {
    e.time += dt;
    e.x += e.vx * dt * 60;

    switch (e.kind) {
      case 'grunt': {
        e.y += (e.vy + Math.sin(e.time * 4) * e.bob) * dt * 60;
        e.attackTimer -= dt;
        if (e.attackTimer <= 0 && e.x < 1180) {
          e.attackTimer = 2.4 + this.rand() * 1.4;
          bullets.spawn(e.x - 18, e.y, -4.8, (this.rand() - 0.5) * 1.2, false, e.color);
        }
        break;
      }
      case 'drone': {
        e.y = e.startY + Math.sin(e.time * 4 * e.freq) * e.amp;
        break;
      }
      case 'tank': {
        // slow artillery platform: lobbed spreads that arc outward
        e.feedTimer -= dt;
        if (e.feedTimer <= 0 && e.x < 1120) {
          e.feedTimer = 2.1 + this.rand();
          for (const s of [-1, 0, 1]) bullets.spawn(e.x - 24, e.y + s * 8, -4.0, s * 1.7, false, '#ff9a62');
        }
        break;
      }
      case 'swarm': {
        e.y = e.startY + Math.sin(e.time * 2.8 * e.freq) * e.amp;
        e.attackTimer -= dt;
        if (e.attackTimer <= 0 && e.x < 1080) {
          e.attackTimer = 2.15;
          for (const s of [-1, 0, 1]) bullets.spawn(e.x - 16, e.y + s * 5, -4.4, s * 2.1, false, e.color);
        }
        break;
      }
      case 'lancer': {
        if (player && e.x < 980) {
          const dy = player.y - e.y;
          e.vy = Math.max(-2.6, Math.min(2.6, dy * 0.012));
          e.y += e.vy * dt * 60;
        }
        e.attackTimer -= dt;
        if (e.attackTimer <= 0 && e.x < 930) {
          e.attackTimer = 2.35;
          e.lock = 0.28;
          const ang = Math.atan2((player ? player.y : 360) - e.y, (player ? player.x : 280) - e.x);
          for (const s of [-0.14, 0, 0.14]) bullets.spawn(e.x - 10, e.y, Math.cos(ang + s) * 5.3, Math.sin(ang + s) * 5.3, false, '#ffe27a');
        }
        e.lock = Math.max(0, (e.lock || 0) - dt);
        break;
      }
      case 'stalker': {
        // lurks, then lunges: a fast horizontal dash with a vertical lock
        e.stateT -= dt;
        if (e.state === 'stalk') {
          e.vx = -1.5;
          if (player) e.y += Math.sign(player.y - e.y) * 1.1 * dt * 60;
          if (e.stateT <= 0 && e.x < 1120) { e.state = 'lunge'; e.stateT = 0.55; e.vx = -9.2; }
        } else {
          if (e.stateT <= 0) { e.state = 'stalk'; e.stateT = 1.0 + this.rand(); e.vx = -2.0; }
          e.attackTimer -= dt;
          if (e.attackTimer <= 0) { e.attackTimer = 0.5; bullets.spawn(e.x - 14, e.y, -5.6, 0, false, '#ff7a4f'); }
        }
        break;
      }
      case 'mine': {
        e.vx = -0.85;
        e.y += Math.sin(e.time * 2.2) * 0.5 * dt * 60;
        if (player) {
          const d = Math.hypot(player.x - e.x, player.y - e.y);
          if (e.fuse < 0 && d < 150) e.fuse = 0.62;
          if (e.fuse >= 0) {
            e.fuse -= dt;
            e.vx = -0.2;
            if (e.fuse <= 0) { this.detonate(e, bullets); e.hp = 0; }
          }
        }
        break;
      }
    }
  }

  /** A dying swarm alien splits into two grunts — models the "hive" idea. */
  splitSwarm(e) {
    if (e.splitDone || e.x < 60 || e.x > 1240) return;
    e.splitDone = true;
    for (const s of [-1, 1]) {
      const g = this.add('grunt', e.x + s * 12, e.y + s * 16, {
        vx: -3.6, vy: s * 1.4, bob: 0.9, scoreValue: 60, hp: 1, maxHp: 1
      });
      g.attackTimer = 1.6 + this.rand();
    }
  }

  detonate(e, bullets) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * 6.283;
      bullets.spawn(e.x, e.y, Math.cos(a) * 4.4, Math.sin(a) * 4.4, false, '#ffc45a');
    }
    if (this.onExplosion) this.onExplosion(e, 44);
  }

  // -------------------------------------------------------------------- boss

  updateBoss(dt, bullets, player) {
    const b = this.boss;
    b.hitFlash = Math.max(0, b.hitFlash - dt * 4);
    if (b.x > 1035) b.x -= 2.1 * dt * 60;
    else {
      b.y += b.vy * dt * (b.phase === 3 ? 1.45 : b.phase === 2 ? 1.18 : 1);
      if (b.y < 122 || b.y > 495) b.vy *= -1;
      b.drift = (b.drift || 0) + dt;
      b.x = 1035 + Math.sin(b.drift) * 24;
    }

    b.phase = b.hp <= b.maxHp * 0.28 ? 3 : b.hp <= b.maxHp * 0.62 ? 2 : 1;
    b.angle += dt * (0.9 + b.phase * 0.42);

    if (b.script) {
      this.runScript(b, dt, bullets, player);
      return;
    }

    b.attackTimer += dt;
    const windup = b.phase === 3 ? 0.85 : b.phase === 2 ? 1.08 : 1.3;
    b.telegraph = b.attackTimer > windup ? Math.min(1, (b.attackTimer - windup) / 0.5) : 0;

    const base = b.phase === 1 ? 1.85 : b.phase === 2 ? 1.42 : 1.05;
    const interval = Math.max(0.72, base - b.style * 0.04);
    if (b.attackTimer >= interval) {
      b.attackTimer = 0;
      b.telegraph = 0;
      this.bossAttack(b, bullets, player);
      // enraged bosses chain a second technique at low hull
      if (b.phase === 3 && this.rand() < 0.4) this.bossAttack(b, bullets, player);
    }
  }

  /**
   * Choose the next technique at random from the boss' repertoire, never
   * repeating the previous one. Public because main.js drives one attack on
   * demand from the screenshot harness.
   */
  bossAttack(b, bullets, player = null) {
    const list = b.repertoire && b.repertoire.length ? b.repertoire : ['spiral', 'aimedFan', 'gapWall'];
    let idx = Math.floor(this.rand() * list.length);
    if (list.length > 1 && idx === b.lastTech) idx = (idx + 1 + Math.floor(this.rand() * (list.length - 1))) % list.length;
    b.lastTech = idx;
    this.fireTech(list[idx], b, bullets, player);
  }

  fireTech(name, b, bullets, player) {
    b.tech = name;
    const spd = 1 + (b.phase - 1) * 0.16;
    const col = b.color;
    switch (name) {
      case 'spiral': {
        const arms = 5 + b.phase;
        const off = this.rand() * 6.283;
        for (let i = 0; i < arms; i++) {
          const a = off + b.angle + i * (6.283 / arms);
          bullets.spawn(b.x, b.y, Math.cos(a) * 4.25 * spd, Math.sin(a) * 4.25 * spd, false, col);
        }
        break;
      }
      case 'aimedFan': {
        const base = Math.atan2((player ? player.y : 360) - b.y, (player ? player.x : 300) - b.x);
        const n = 3 + b.phase;
        for (let i = 0; i < n; i++) {
          const o = (i - (n - 1) / 2) * 0.15;
          bullets.spawn(b.x - 25, b.y, Math.cos(base + o) * 5.0 * spd, Math.sin(base + o) * 5.0 * spd, false, '#ff955d');
        }
        break;
      }
      case 'gapWall': {
        const gap = Math.floor(this.rand() * 5) - 2;
        for (let lane = -2; lane <= 2; lane++) {
          if (lane === gap) continue;
          bullets.spawn(b.x - 18, b.y + lane * 46, -5.1 * spd, lane * 0.35, false, col);
        }
        break;
      }
      case 'ringBurst': {
        const n = 12 + b.phase * 2;
        const holes = 2 + (b.phase === 3 ? 0 : 1);
        const skip = new Set();
        for (let h = 0; h < holes; h++) skip.add(Math.floor(this.rand() * n));
        for (let i = 0; i < n; i++) {
          if (skip.has(i)) continue;
          const a = (i / n) * 6.283 + b.angle * 0.4;
          bullets.spawn(b.x, b.y, Math.cos(a) * 3.7 * spd, Math.sin(a) * 3.7 * spd, false, col);
        }
        break;
      }
      case 'crossLanes': {
        for (const sign of [-1, 1]) {
          for (const lane of [-1, 0, 1]) {
            bullets.spawn(b.x, b.y + lane * 20, -4.2 * spd, sign * (2.2 + Math.abs(lane) * 0.35), false, col);
          }
        }
        break;
      }
      case 'zigzag': {
        const dir = this.rand() < 0.5 ? 1 : -1;
        for (let i = 0; i < 4; i++) {
          bullets.spawn(b.x - 14 - i * 16, b.y, -4.8 * spd, dir * (1.0 + i * 0.9), false, col);
        }
        break;
      }
      case 'seekers': {
        const n = 2 + (b.phase >= 2 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const a = Math.PI + (i - (n - 1) / 2) * 0.5;
          const bl = { x: b.x, y: b.y, vx: Math.cos(a) * 3.0, vy: Math.sin(a) * 3.0, isPlayer: false, color: '#ff6ac1', radius: 7, seek: 1.5 };
          bullets.bullets.push(bl);
          (b.seekers = b.seekers || []).push({ b: bl, t: 1.7 });
        }
        break;
      }
      case 'sweepBeam': {
        b.script = { kind: 'sweep', t: 0, dur: 0.72, dir: this.rand() < 0.5 ? 1 : -1, a0: Math.PI * 0.72 + (this.rand() - 0.5) * 0.5, tick: 0 };
        break;
      }
      case 'pulseRings': {
        b.script = { kind: 'pulse', t: 0, rings: 3, gap: 0.18, tick: 0, spd: spd };
        break;
      }
      case 'dash': {
        b.script = { kind: 'dash', t: 0, dur: 0.95, dir: -1, y0: b.y, y1: player ? player.y : 360, x0: b.x };
        break;
      }
      case 'meteorRain': {
        if (this.meteors) this.meteors.volley(2 + b.phase, b, 320);
        else {
          for (let i = 0; i < 4; i++) {
            bullets.spawn(b.x - 20, b.y + (i - 1.5) * 26, -3.4, 2.4 + i * 0.5, false, '#ff9a4a');
          }
        }
        break;
      }
      case 'summon': {
        if (this.enemies.length < 7) {
          for (let i = 0; i < 2; i++) {
            this.spawnAlien(this.pick(['grunt', 'drone', 'lancer']), b.x - 40 - this.rand() * 40, b.y + (i ? 70 : -70));
          }
        } else {
          this.fireTech('spiral', b, bullets, player);
        }
        break;
      }
      default:
        this.fireTech('spiral', b, bullets, player);
    }
  }

  runScript(b, dt, bullets, player) {
    const s = b.script;
    s.t += dt;
    if (s.kind === 'sweep') {
      s.tick -= dt;
      if (s.tick <= 0) {
        s.tick = 0.055;
        const k = Math.min(1, s.t / s.dur);
        const a = s.a0 + s.dir * k * 1.75;
        for (const r of [26, 46]) {
          bullets.spawn(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, Math.cos(a) * 6.4, Math.sin(a) * 6.4, false, '#ff6ac1');
        }
      }
      if (s.t >= s.dur) b.script = null;
      return;
    }
    if (s.kind === 'pulse') {
      s.tick -= dt;
      if (s.tick <= 0 && s.rings > 0) {
        s.tick = s.gap;
        s.rings--;
        const n = 14 + b.phase;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * 6.283 + s.rings * 0.24;
          bullets.spawn(b.x, b.y, Math.cos(a) * 3.1 * s.spd, Math.sin(a) * 3.1 * s.spd, false, b.color);
        }
      }
      if (s.rings <= 0 && s.t > s.gap * 3 + 0.2) b.script = null;
      return;
    }
    if (s.kind === 'dash') {
      const k = Math.min(1, s.t / s.dur);
      // lunge toward the player's lane, then recover
      const ease = k < 0.45 ? (k / 0.45) : 1 - ((k - 0.45) / 0.55);
      b.x = s.x0 - ease * 300;
      b.y = s.y0 + (s.y1 - s.y0) * ease;
      if ((b.seekers = b.seekers || []).length === 0) {
        for (const sign of [-1, 1]) {
          bullets.spawn(b.x - 20, b.y + sign * 26, -4.6, sign * 1.2, false, '#ffe27a');
        }
      }
      if (s.t >= s.dur) { b.x = 1035; b.script = null; }
      return;
    }
    b.script = null;
  }

  /** Steering for seeker bullets; called every frame from update(). */
  steerSeekers(dt, player) {
    const b = this.boss;
    if (!b || !b.seekers || !b.seekers.length) return;
    for (let i = b.seekers.length - 1; i >= 0; i--) {
      const s = b.seekers[i];
      s.t -= dt;
      if (s.t <= 0 || !s.b || s.b.dead) { b.seekers.splice(i, 1); continue; }
      if (player) {
        const desired = Math.atan2(player.y - s.b.y, player.x - s.b.x);
        const cur = Math.atan2(s.b.vy, s.b.vx);
        let d = desired - cur;
        while (d > Math.PI) d -= 6.283;
        while (d < -Math.PI) d += 6.283;
        const turn = Math.max(-1.6 * dt, Math.min(1.6 * dt, d));
        const sp = Math.hypot(s.b.vx, s.b.vy);
        s.b.vx = Math.cos(cur + turn) * sp;
        s.b.vy = Math.sin(cur + turn) * sp;
      }
      // BulletManager.update() integrates the position; we only steer here so
      // a seeker cannot be advanced twice per frame.
      if (s.b.x < -60 || s.b.x > 1340 || s.b.y < -60 || s.b.y > 780) b.seekers.splice(i, 1);
    }
  }

  // -------------------------------------------------------------------- draw

  draw(ctx) {
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      this.drawGroundShadow(ctx, e.radius);

      const d = e.size;
      const frame = frameFromTime(e.time, 4, e.kind === 'mine' ? 3.4 : 2.2);
      const armed = e.kind === 'mine' && e.fuse >= 0;
      const ok = drawSprite(ctx, e.sprite, frame, 0, 0, d, {
        glow: true,
        glowScale: armed ? 0.55 : 0.26,
        glowAlpha: armed ? 0.6 + Math.sin(this.time * 30) * 0.25 : 0.36
      });
      if (!ok) this.drawFallbackAlien(ctx, e);
      if (e.hitFlash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = e.hitFlash * 0.6;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, d * 0.34, 0, 6.283);
        ctx.fill();
        ctx.restore();
      }
      if (armed) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = '#ffe27a';
        ctx.globalAlpha = 0.5 + Math.sin(this.time * 26) * 0.4;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, d * 0.62, 0, 6.283);
        ctx.stroke();
        ctx.restore();
      }
      if (e.maxHp > 1 && e.kind !== 'mine') {
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(-20, 30 + d * 0.18, 40, 4);
        ctx.fillStyle = e.color;
        ctx.fillRect(-20, 30 + d * 0.18, 40 * Math.max(0, e.hp / e.maxHp), 4);
      }
      ctx.restore();
    }

    const b = this.boss;
    if (!b) return;
    ctx.save();
    ctx.translate(b.x, b.y);
    this.drawGroundShadow(ctx, b.radius);

    const col = b.phase === 1 ? b.color : b.phase === 2 ? '#ff955d' : '#ff4f9f';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let ring = 0; ring < 3; ring++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 62 + ring * 13 + b.telegraph * 10, 48 + ring * 9, b.angle * (ring % 2 ? -1 : 1), -0.2, Math.PI * 1.55);
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.15 + b.telegraph * 0.22;
      ctx.lineWidth = 8;
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    for (let ring = 0; ring < 3; ring++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 62 + ring * 13 + b.telegraph * 10, 48 + ring * 9, b.angle * (ring % 2 ? -1 : 1), -0.2, Math.PI * 1.55);
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    const size = b.size;
    const frame = frameFromTime(this.time, 6, 1.9);
    // The baked sprite already carries its own halo, so no extra additive
    // blit here — that produced a rectangular haze around the boss. The
    // telegraph instead drives the crown rings, which read much better.
    const drawn = drawSprite(ctx, b.sprite, frame, 0, 0, size, { glow: false });
    if (!drawn) this.drawBossFallback(ctx, b, col);

    if (b.hitFlash > 0 || b.telegraph > 0.55) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(b.hitFlash * 0.5, (b.telegraph - 0.55) * 0.7);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.3, 0, 6.283);
      ctx.fill();
      ctx.restore();
    }

    // eyes + maw stay vector so the face keeps its v7 character
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(-14, -6, 7 + b.telegraph * 3, 0, 6.283);
    ctx.arc(14, -6, 7 + b.telegraph * 3, 0, 6.283);
    glowFill(ctx, col);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = '#ffe4a3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-13, 22);
    ctx.quadraticCurveTo(0, 32, 13, 22);
    ctx.stroke();
    ctx.restore();
  }

  drawGroundShadow(ctx, r) {
    const surfY = r * 0.9 + 8;
    const ry = r * 0.38;
    ctx.fillStyle = 'rgba(6,10,24,0.18)';
    ctx.beginPath();
    ctx.ellipse(0, surfY, r * 1.2, ry * 1.2, 0, 0, 6.283);
    ctx.fill();
    // The shadow ramp depends only on the ellipse height, so it is memoised
    // per radius bucket instead of rebuilt for every entity on every frame.
    const g = cachedGradient(ctx, `groundShadow:${Math.round(ry)}`, () => {
      const gr = ctx.createLinearGradient(0, surfY - ry, 0, surfY + ry);
      gr.addColorStop(0, 'rgba(6,10,24,0.5)');
      gr.addColorStop(1, 'rgba(6,10,24,0)');
      return gr;
    });
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, surfY, r, ry, 0, 0, 6.283);
    ctx.fill();
  }

  /** Silhouette used when the sprite sheet is unavailable. */
  drawFallbackAlien(ctx, e) {
    const c = e.color;
    ctx.fillStyle = c;
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, e.size * 0.34, e.size * 0.26, 0, 0, 6.283);
    ctx.moveTo(-e.size * 0.18, -e.size * 0.18);
    ctx.arc(-e.size * 0.18, -e.size * 0.18, e.size * 0.1, 0, 6.283);
    ctx.moveTo(e.size * 0.18, -e.size * 0.18);
    ctx.arc(e.size * 0.18, -e.size * 0.18, e.size * 0.1, 0, 6.283);
    glowFill(ctx, c);
    ctx.fillStyle = c;
    ctx.fill();
    ctx.stroke();
  }

  drawBossFallback(ctx, b, col) {
    ctx.fillStyle = '#21123d';
    ctx.strokeStyle = col;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-50, -26); ctx.lineTo(-18, -34); ctx.lineTo(0, -18); ctx.lineTo(18, -34);
    ctx.lineTo(50, -26); ctx.lineTo(37, 0); ctx.lineTo(50, 26); ctx.lineTo(18, 34);
    ctx.lineTo(0, 18); ctx.lineTo(-18, 34); ctx.lineTo(-50, 26); ctx.lineTo(-37, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}
