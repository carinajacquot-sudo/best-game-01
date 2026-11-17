// main.js: Game boot, state machine, main loop, collision detection, and screenshot harness staging.

import { CONFIG } from './config.js';
import { RNG, circleCollide } from './util.js';
import { InputHandler } from './input.js';
import { AudioManager } from './audio.js';
import { Background } from './background.js';
import { ParticleManager } from './particles.js';
import { BulletManager } from './bullets.js';
import { Player } from './player.js';
import { EnemyManager } from './enemies.js';
import { PowerupManager } from './powerups.js';
import { LevelManager } from './levels.js';
import { HUD } from './hud.js';
import { keyArtCanvas } from './keyart.js';

function readSeed(search) {
  const params = new URLSearchParams(search);
  const seedStr = params.get('seed');
  if (seedStr === null || seedStr === '') return null;
  const val = parseInt(seedStr, 10);
  if (!Number.isFinite(val)) return null;
  return val >>> 0;
}

async function loadScreenshotFonts() {
  if (!document.fonts || !document.fonts.load) {
    throw new Error('font loading API unavailable');
  }
  const pairs = [
    ['112px Monoton', 'EMBER'],
    ['54px Monoton', 'W I N G'],
    ['50px Monoton', 'THE CITY REMEMBERS'],
    ['15px Orbitron', 'ALL 9 LANTERNS RELIGHTED'],
    ['700 34px Orbitron', '12850'],
    ['600 19px Orbitron', '[ ENTER ] REIGNITE']
  ];
  await Promise.all(pairs.map(([font, text]) => document.fonts.load(font, text)));
  await document.fonts.ready;
  for (const [font, text] of pairs) {
    if (!document.fonts.check(font, text)) {
      throw new Error('Font check failed for ' + font + ' ("' + text + '")');
    }
  }
}

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.input = new InputHandler();
    this.audio = new AudioManager();
    this.rng = new RNG((Math.random() * 0xFFFFFFFF) >>> 0);
    this.background = new Background(this.rng);
    this.particles = new ParticleManager(this.rng);
    this.bullets = new BulletManager();
    this.player = new Player(200, 360);
    this.enemies = new EnemyManager(this.rng);
    this.powerups = new PowerupManager();
    this.levels = new LevelManager();
    this.hud = new HUD();

    this.keyArt = null;
    this.popups = [];

    this.state = 'title'; // title, howto, play, levelclear, gameover, victory
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.paused = false;

    this.lastTime = performance.now();
    this.isHarness = false;
  }

  init() {
    const seedValue = readSeed(window.location.search);
    if (seedValue !== null) {
      this.rng = new RNG(seedValue);
      this.background = new Background(this.rng);
      this.enemies = new EnemyManager(this.rng);
      this.particles = new ParticleManager(this.rng);
    }

    // Key art is generated once here (init-time, before the screenshot/harness branch);
    // prepareScreenshot reuses this.keyArt instead of regenerating it.
    // NOTE (P2): keyArtCanvas() uses its own fixed seed (1337) — deliberately identical
    // across query seeds; ?seed= drives only background/enemies/particles.
    this.keyArt = keyArtCanvas();
    this.hud.setKeyArt(this.keyArt);

    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');

    if (shot) {
      this.isHarness = true;
      window.__shotReady = false;
      window.__shotError = null;
      this.hud.screenshotMode = true;
      void this.prepareScreenshot(shot);
      return;
    }

    // Normal game start loop
    requestAnimationFrame((t) => this.loop(t));
  }

  async prepareScreenshot(shot) {
    try {
      await loadScreenshotFonts();
      // Reuse the canvas built in init(); only rebuild if it is somehow missing.
      if (!this.keyArt) {
        this.keyArt = keyArtCanvas();
        this.hud.setKeyArt(this.keyArt);
      }
      this.stageScreenshot(shot);
      this.render();
      await nextFrame();
      this.render();
      await nextFrame();
    } catch (e) {
      // Any failure in staging OR the final paints must surface promptly —
      // otherwise the capture runner can only observe a hang.
      window.__shotReady = false;
      window.__shotError = String((e && e.message) || e);
      console.error('[screenshot harness]', e);
      return;
    }
    window.__shotError = null;
    window.__shotReady = true;
  }

  stageScreenshot(shot) {
    const SUPPORTED = ['start', 'play', 'boss', 'end'];
    if (!SUPPORTED.includes(shot)) {
      throw new Error(`unknown screenshot route "${shot}" — supported: ${SUPPORTED.join(', ')}`);
    }
    if (shot === 'start') {
      this.state = 'title';
    } else if (shot === 'play') {
      this.state = 'play';
      this.levels.currentLevel = 2;
      this.levels.lanternsLit = 4;
      this.score = 1450;
      this.combo = 4;
      this.player.x = 250;
      this.player.y = 360;
      this.player.flareTimer = 6.0;

      // Spawn at least 7 enemies spread across the right two thirds of the screen: mix of drifters, 2+ weavers, tank
      this.enemies.spawnWeaver(700, 220);
      this.enemies.spawnWeaver(900, 500);
      this.enemies.spawnTank(1050, 360);
      this.enemies.spawnDrifter(550, 150);
      this.enemies.spawnDrifter(680, 450);
      this.enemies.spawnDrifter(820, 320);
      this.enemies.spawnDrifter(1150, 200);

      // Fire several player bullets in flight including triple-shot flare shots
      this.bullets.spawn(this.player.x + 20, this.player.y, 14, 0, true, '#00f0ff');
      this.bullets.spawn(this.player.x + 10, this.player.y - 15, 14, -2, true, '#ffee00');
      this.bullets.spawn(this.player.x + 10, this.player.y + 15, 14, 2, true, '#ffee00');
      this.bullets.spawn(this.player.x + 120, this.player.y - 40, 14, -0.5, true, '#00f0ff');
      this.bullets.spawn(this.player.x + 180, this.player.y + 60, 14, 1.0, true, '#ffee00');

      // Spawn explosion particle bursts near enemies as if they just died
      this.particles.explosion(700, 220, '#00f0ff', 30);
      this.particles.explosion(550, 150, '#ff007f', 25);

      for (let i = 0; i < 30; i++) {
        this.background.update(0.016, 1);
        this.bullets.update(0.016);
        this.particles.update(0.016);
      }
    } else if (shot === 'boss') {
      this.state = 'play';
      this.levels.currentLevel = this.levels.maxLevels;
      this.levels.lanternsLit = 6;
      this.score = 9800;
      this.combo = 6;
      this.player.x = 250;
      this.player.y = 430;
      this.player.flareTimer = 6.0;

      this.enemies.spawnBoss();
      this.enemies.boss.hp = 22;

      this.enemies.bossAttack(this.enemies.boss, this.bullets);
      this.enemies.bossAttack(this.enemies.boss, this.bullets);

      this.particles.explosion(this.enemies.boss.x - 40, this.enemies.boss.y - 30, '#9d00ff', 35);
      this.particles.explosion(this.enemies.boss.x + 30, this.enemies.boss.y + 30, '#ff007f', 30);

      this.bullets.spawn(this.player.x + 20, this.player.y, 14, 0, true, '#00f0ff');
      this.bullets.spawn(this.player.x + 10, this.player.y - 15, 14, -2, true, '#ffee00');
      this.bullets.spawn(this.player.x + 10, this.player.y + 15, 14, 2, true, '#ffee00');

      for (let i = 0; i < 30; i++) {
        this.background.update(0.016, 1);
        this.bullets.update(0.016);
        this.particles.update(0.016);
      }
    } else if (shot === 'end') {
      this.state = 'victory';
      this.score = 12850;
      this.levels.lanternsLit = 9;
    }
  }

  resetGame() {
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.player = new Player(200, 360);
    this.enemies = new EnemyManager(this.rng);
    this.powerups = new PowerupManager();
    this.bullets = new BulletManager();
    this.particles = new ParticleManager(this.rng);
    this.popups = [];
    this.levels.reset();
  }

  update(dt) {
    // Handle global inputs
    if (this.input.wasPressed('KeyM')) {
      this.audio.toggleMute();
    }

    // Update popups on any state
    for (let pi = this.popups.length - 1; pi >= 0; pi--) {
      this.popups[pi].t += dt;
      if (this.popups[pi].t > 0.9) {
        this.popups.splice(pi, 1);
      }
    }

    // Title / Victory / Gameover rising embers (35% chance per frame)
    if (this.state === 'title' || this.state === 'victory' || this.state === 'gameover') {
      if (this.rng.next() < 0.35) {
        const rx = this.rng.next() * 1280;
        const rvx = (this.rng.next() - 0.5) * 0.5;
        const rvy = - (0.6 + this.rng.next() * 0.9);
        const colors = ['#ff7700', '#ffb300', '#00f0ff'];
        const rcolor = colors[Math.floor(this.rng.next() * colors.length)];
        const rsize = 1.4 + this.rng.next() * 1.8;
        this.particles.spawn(rx, 742, rvx, rvy, rcolor, rsize, 2.4);
      }
      this.particles.update(dt);
    }

    if (this.state === 'title') {
      if (this.input.wasPressed('Enter')) {
        this.audio.playUI();
        this.audio.startMusic();
        this.resetGame();
        this.state = 'play';
      } else if (this.input.wasPressed('KeyH')) {
        this.audio.playUI();
        this.state = 'howto';
      }
    } else if (this.state === 'howto') {
      if (this.input.wasPressed('Escape') || this.input.wasPressed('Enter')) {
        this.audio.playUI();
        this.state = 'title';
      }
    } else if (this.state === 'play') {
      if (this.input.wasPressed('KeyP')) {
        this.paused = !this.paused;
        this.lastTime = performance.now();
        this.audio.playUI();
      }

      if (this.paused) {
        // Skip all world simulation when paused
      } else {
        this.background.update(dt, 1);
        this.player.update(dt, this.input);

        // Firing
        if (this.input.isFiring() && this.player.canFire()) {
          this.audio.playShoot();
          this.bullets.spawn(this.player.x + 20, this.player.y, 14, 0, true, '#00f0ff');
          if (this.player.flareTimer > 0) {
            this.bullets.spawn(this.player.x + 10, this.player.y - 15, 14, -2, true, '#ffee00');
            this.bullets.spawn(this.player.x + 10, this.player.y + 15, 14, 2, true, '#ffee00');
          }
        }

        this.bullets.update(dt);
        this.enemies.update(dt, this.bullets);
        this.powerups.update(dt, this.player);
        this.particles.update(dt);
        this.levels.update(dt, this.enemies, this.rng);

        // Combo decay timer
        if (this.comboTimer > 0) {
          this.comboTimer -= dt;
          if (this.comboTimer <= 0) {
            this.combo = 1;
          }
        }

        // Collisions: Player bullets vs enemies & boss
        for (let bi = this.bullets.bullets.length - 1; bi >= 0; bi--) {
          const b = this.bullets.bullets[bi];
          if (!b.isPlayer) continue;

          // Check boss collision
          if (this.enemies.boss && circleCollide(b, this.enemies.boss)) {
            this.enemies.boss.hp--;
            this.bullets.bullets.splice(bi, 1);
            this.particles.spawn(b.x, b.y, (this.rng.next() - 0.5) * 4, (this.rng.next() - 0.5) * 4, '#9d00ff', 6, 0.3);
            if (this.enemies.boss.hp <= 0) {
              this.levels.bossDefeated = true;
              this.audio.playBoom();
              this.particles.explosion(this.enemies.boss.x, this.enemies.boss.y, '#9d00ff', 50);
              const points = CONFIG.scoring.boss * this.combo;
              this.score += points;
              this.popups.push({ x: this.enemies.boss.x, y: this.enemies.boss.y, text: '+' + points, t: 0 });
              this.enemies.boss = null;
            }
            continue;
          }

          // Check standard enemy collision
          let hitEnemy = false;
          for (let ei = this.enemies.enemies.length - 1; ei >= 0; ei--) {
            const e = this.enemies.enemies[ei];
            if (circleCollide(b, e)) {
              e.hp--;
              hitEnemy = true;
              this.particles.spawn(b.x, b.y, (this.rng.next() - 0.5) * 4, (this.rng.next() - 0.5) * 4, '#ff007f', 5, 0.3);
              if (e.hp <= 0) {
                this.audio.playBoom();
                this.particles.explosion(e.x, e.y, e.type === 'tank' ? '#ff7700' : '#ff007f', 30);
                const points = e.scoreValue * this.combo;
                this.score += points;
                this.popups.push({ x: e.x, y: e.y, text: '+' + points, t: 0 });
                this.combo = Math.min(8, this.combo + 1);
                this.comboTimer = 4.0;

                // Tank drops powerup
                if (e.type === 'tank') {
                  const pType = this.rng.choice(['flare', 'aegis', 'magnet']);
                  this.powerups.spawn(e.x, e.y, pType);
                }

                this.enemies.enemies.splice(ei, 1);
              }
              break;
            }
          }
          if (hitEnemy) {
            this.bullets.bullets.splice(bi, 1);
          }
        }

        // Collisions: Enemy bullets vs player
        for (let bi = this.bullets.bullets.length - 1; bi >= 0; bi--) {
          const b = this.bullets.bullets[bi];
          if (b.isPlayer) continue;
          if (circleCollide(b, this.player)) {
            this.bullets.bullets.splice(bi, 1);
            this.audio.playHit();
            const lost = this.player.hit();
            if (lost) {
              this.combo = 1;
              this.particles.explosion(this.player.x, this.player.y, '#00f0ff', 25);
              if (this.player.lives <= 0) {
                this.audio.stopMusic();
                this.state = 'gameover';
              }
            }
          }
        }

        // Collisions: Player vs Powerups
        for (let pi = this.powerups.powerups.length - 1; pi >= 0; pi--) {
          const p = this.powerups.powerups[pi];
          if (circleCollide(p, this.player)) {
            this.audio.playPickup();
            if (p.type === 'flare') this.player.flareTimer = 8.0;
            if (p.type === 'aegis') this.player.aegisShield = true;
            if (p.type === 'magnet') this.player.magnetTimer = 8.0;
            this.powerups.powerups.splice(pi, 1);
          }
        }

        if (this.levels.levelCompleted) {
          if (this.levels.currentLevel < this.levels.maxLevels) {
            this.state = 'levelclear';
          } else {
            this.audio.stopMusic();
            this.state = 'victory';
          }
        }
      }
    } else if (this.state === 'levelclear') {
      if (this.input.wasPressed('Enter')) {
        this.audio.playUI();
        this.levels.nextLevel();
        this.state = 'play';
      }
    } else if (this.state === 'gameover' || this.state === 'victory') {
      if (this.input.wasPressed('Enter')) {
        this.audio.playUI();
        this.resetGame();
        this.state = 'play';
        this.audio.startMusic();
      }
    }
  }

  render() {
    this.ctx.clearRect(0, 0, 1280, 720);
    this.background.draw(this.ctx);
    this.particles.draw(this.ctx);
    this.powerups.draw(this.ctx);
    this.bullets.draw(this.ctx);
    this.enemies.draw(this.ctx);
    if (this.state === 'play' || this.state === 'levelclear') {
      this.player.draw(this.ctx);
    }
    // Draw popups after entities
    for (const p of this.popups) {
      this.ctx.save();
      this.ctx.font = '700 20px Orbitron';
      this.ctx.fillStyle = '#ffd24a';
      this.ctx.shadowColor = '#ff7700';
      this.ctx.shadowBlur = 8;
      this.ctx.globalAlpha = Math.max(0, 1 - p.t / 0.9);
      this.ctx.textAlign = 'center';
      this.ctx.fillText(p.text, p.x, p.y - 46 * p.t);
      this.ctx.restore();
    }
    this.hud.draw(this.ctx, this.state, this.player, this.score, this.combo, this.levels, this.enemies.boss);
    if (this.state === 'play' && this.paused) {
      this.hud.drawPause(this.ctx);
    }
  }

  loop(time) {
    if (this.isHarness) return;
    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.init();
});
