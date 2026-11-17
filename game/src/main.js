// main.js: Game boot, state machine, main loop, collision detection, and screenshot harness staging.

import { CONFIG } from './config.js';
import { RNG, circleCollide } from './util.js';
import { InputHandler } from './input.js';
import { AudioManager } from './audio.js';
import { Background } from './background.js';
import { ParticleManager } from './particles.js';
import { BulletManager } from './bullets.js';
import { Player, SHIPS } from './player.js';
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
    ['40px Monoton', 'THE SUN IS REBORN'],
    ['15px Orbitron', 'ALL 10 DISTRICTS RECLAIMED'],
    ['700 34px Orbitron', '12850'],
    ['15px Orbitron', '[ ENTER ] PLAY AGAIN']
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
    const unlockAudio = () => {
      this.audio.init();
      // Title music starts on the first interaction (autoplay policy needs a gesture).
      if (this.state === 'title' && !this.audio.musicRequested) {
        this.audio.setTheme('title');
        this.audio.startMusic();
      }
    };
    document.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
    window.addEventListener('keydown', unlockAudio, { once: true, passive: true });
    this.rng = new RNG((Math.random() * 0xFFFFFFFF) >>> 0);
    this.background = new Background(this.rng);
    this.particles = new ParticleManager(this.rng);
    this.bullets = new BulletManager();
    this.shipIndex = 0;
    this.player = new Player(200, 360, this.shipIndex);
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
    this.screenShake = 0;
    this.screenFlash = 0;

    this.cinematic = null;
    this.timeScale = 1.0;
    this.victoryT = 0;
    this.bossSpawnedFlag = false;
    this.lastRingIndex = 0;
    this._lastBossPhase = null;

    this.sceneCanvas = document.createElement('canvas');
    this.sceneCanvas.width = 1280;
    this.sceneCanvas.height = 720;
    this.sceneCtx = this.sceneCanvas.getContext('2d');

    const grainCanvas = document.createElement('canvas');
    grainCanvas.width = 256;
    grainCanvas.height = 256;
    const grainCtx = grainCanvas.getContext('2d');
    const imgData = grainCtx.createImageData(256, 256);
    // Fixed-seed rng: the grain must be identical on every load (screenshot determinism).
    const grainRng = new RNG(1337);
    for (let i = 0; i < imgData.data.length; i += 4) {
      if (grainRng.next() < 0.04) {
        imgData.data[i] = 255;
        imgData.data[i+1] = 255;
        imgData.data[i+2] = 255;
        imgData.data[i+3] = 26;
      }
    }
    grainCtx.putImageData(imgData, 0, 0);
    this.grainPattern = this.ctx.createPattern(grainCanvas, 'repeat');

    const scanCanvas = document.createElement('canvas');
    scanCanvas.width = 1;
    scanCanvas.height = 6;
    const scanCtx = scanCanvas.getContext('2d');
    scanCtx.fillStyle = 'rgba(0,0,0,0.05)';
    scanCtx.fillRect(0, 0, 1, 2);
    this.scanPattern = this.ctx.createPattern(scanCanvas, 'repeat');

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
      this.levels.currentLevel = 5;
      this.levels.lanternsLit = 4;
      this.score = 1450;
      this.combo = 4;
      this.player.x = 250;
      this.player.y = 360;
      this.player.flareTimer = 6.0;
      this.player.pulseCharge = 100;

      // Spawn at least 7 enemies spread across the right two thirds of the screen: mix of drifters, 2+ weavers, tank
      this.enemies.spawnWeaver(700, 220);
      this.enemies.spawnWeaver(900, 500);
      this.enemies.spawnTank(1050, 360);
      this.enemies.spawnDrifter(550, 150);
      this.enemies.spawnDrifter(680, 450);
      this.enemies.spawnPrism(820, 320);
      this.enemies.spawnLancer(1150, 200);

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
      this.levels.lanternsLit = 9;
      this.score = 9800;
      this.combo = 6;
      this.player.x = 250;
      this.player.y = 430;
      this.player.flareTimer = 6.0;
      this.player.pulseCharge = 100;
      this.cinematic = null;
      this.bossSpawnedFlag = true;

      this.enemies.spawnBoss(this.levels.currentLevel);
      this.enemies.boss.hp = Math.floor(this.enemies.boss.maxHp * 0.25);
      this.enemies.boss.phase = 3;

      this.enemies.bossAttack(this.enemies.boss, this.bullets);
      this.enemies.bossAttack(this.enemies.boss, this.bullets);

      this.particles.explosion(this.enemies.boss.x - 40, this.enemies.boss.y - 30, this.enemies.boss.color, 35);
      this.particles.explosion(this.enemies.boss.x + 30, this.enemies.boss.y + 30, '#ffe27a', 30);

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
      this.levels.lanternsLit = 10;
      this.victoryT = 2.2;
    }
  }

  resetGame() {
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.audio.setSector(1);
    this.audio.setBossMode(false);
    this.background.setSector(1);
    this.player = new Player(200, 360, this.shipIndex);
    this.enemies = new EnemyManager(this.rng);
    this.powerups = new PowerupManager();
    this.bullets = new BulletManager();
    this.particles = new ParticleManager(this.rng);
    this.popups = [];
    this.levels.reset();
    this.cinematic = null;
    this.timeScale = 1.0;
    this.victoryT = 0;
    this.bossSpawnedFlag = false;
    this.lastRingIndex = 0;
    this._lastBossPhase = null;
  }

  update(dt) {
    this.screenShake = Math.max(0, this.screenShake - dt * 34);
    this.screenFlash = Math.max(0, this.screenFlash - dt * 1.8);
    if (this.state === 'victory') this.victoryT = (this.victoryT || 0) + dt;
    // World time scale: cinematics freeze the world (boss entrance) or run it in
    // dreamy slow motion (boss defeat). Real dt still drives the cinematic clock.
    const simDt = this.cinematic ? (this.cinematic.type === 'defeat' ? dt * 0.18 : 0) : dt;
    // Handle global inputs
    if (this.input.wasPressed('KeyM')) {
      this.audio.toggleMute();
    }
    const pulsePressed = this.input.wasPressed('KeyX');

    // Update popups on any state
    for (let pi = this.popups.length - 1; pi >= 0; pi--) {
      this.popups[pi].t += dt;
      if (this.popups[pi].t > 0.9) {
        this.popups.splice(pi, 1);
      }
    }

    // Title / Victory / Gameover rising embers (35% chance per frame)
    if (this.state === 'title' || this.state === 'victory' || this.state === 'gameover') {
      const emberBurst = this.state === 'victory' && (this.victoryT || 0) < 2.0 ? 3 : 1;
      for (let ember = 0; ember < emberBurst; ember++) {
      if (ember > 0 || this.rng.next() < 0.35) {
        const rx = this.rng.next() * 1280;
        const rvx = (this.rng.next() - 0.5) * 0.5;
        const rvy = - (0.6 + this.rng.next() * 0.9);
        const colors = ['#ff7700', '#ffb300', '#00f0ff'];
        const rcolor = colors[Math.floor(this.rng.next() * colors.length)];
        const rsize = 1.4 + this.rng.next() * 1.8;
        this.particles.spawn(rx, 742, rvx, rvy, rcolor, rsize, 2.4);
      }
      }
      this.particles.update(dt);
    }

    if (this.state === 'title') {
      let shipChanged = false;
      if (this.input.wasPressed('ArrowLeft') || this.input.wasPressed('KeyQ')) {
        this.shipIndex = (this.shipIndex + SHIPS.length - 1) % SHIPS.length;
        shipChanged = true;
      }
      if (this.input.wasPressed('ArrowRight') || this.input.wasPressed('KeyE')) {
        this.shipIndex = (this.shipIndex + 1) % SHIPS.length;
        shipChanged = true;
      }
      if (shipChanged) {
        this.player = new Player(200, 360, this.shipIndex);
        this.audio.playUI();
      }
      if (this.input.wasPressed('Enter')) {
        this.audio.playUI();
        this.audio.setSector(1);
        this.audio.setTheme('play');
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
      } else if (this.cinematic && this.cinematic.type === 'enter') {
        // Boss entrance: the world holds its breath. Only the cinematic clock,
        // the boss's idle hover and real-time particles advance.
        this.updateCinematic(dt);
        this.background.update(0, 1);
        this.particles.update(dt);
      } else {
        if (this.cinematic) this.updateCinematic(dt); // defeat slow-mo clock rides on top of the world sim
        this.background.update(simDt, 1);
        this.player.update(simDt, this.input);

        // Nova Pulse: a fully charged, original crowd-control move. It clears hostile fire
        // and cracks every foe, including a small chunk of the Crown's armor.
        if (pulsePressed && this.player.pulseCharge >= 100 && !this.cinematic) {
          this.player.pulseCharge = 0;
          this.audio.playPulse();
          this.screenShake = Math.max(this.screenShake, 15);
          this.screenFlash = Math.max(this.screenFlash, 0.5);
          this.bullets.bullets = this.bullets.bullets.filter(b => b.isPlayer);
          this.particles.explosion(this.player.x, this.player.y, '#ffe27a', 52);
          // 2.5D nova: twin chromatic shockwave rings + radial speed lines + scorch pool + ember motes
          this.particles.shockwave(this.player.x, this.player.y, '#ffee88', 260, 0.9, 9);
          this.particles.shockwave(this.player.x, this.player.y, '#ff2da0', 190, 0.75, 6);
          this.particles.shockwave(this.player.x, this.player.y, '#46f8ff', 120, 0.6, 4);
          this.particles.speedLines(this.player.x, this.player.y, '#fff6c8', 22, 230, 0.55);
          this.particles.groundPool(this.player.x, this.player.y + 8, '#ffe9a8', 0.6, 150);
          this.particles.motes(this.player.x, this.player.y, '#fff3c2', 16);
          for (let ei = this.enemies.enemies.length - 1; ei >= 0; ei--) {
            const e = this.enemies.enemies[ei];
            e.hp -= 2;
            this.particles.explosion(e.x, e.y, '#ffe27a', 14);
            if (e.hp <= 0) {
              this.audio.playBoom();
              this.particles.explosion(e.x, e.y, '#ff9a62', 26);
              const points = e.scoreValue * this.combo;
              this.score += points;
              this.popups.push({ x: e.x, y: e.y, text: '+' + points, t: 0 });
              this.combo = Math.min(8, this.combo + 1);
              this.comboTimer = 4.0;
              this.player.pulseCharge = Math.min(25, this.player.pulseCharge + 15);
              if (e.type === 'tank') this.powerups.spawn(e.x, e.y, this.rng.choice(['flare', 'aegis', 'magnet']));
              this.enemies.enemies.splice(ei, 1);
            }
          }
          if (this.enemies.boss) {
            this.enemies.boss.hp = Math.max(0, this.enemies.boss.hp - 4);
            this.particles.explosion(this.enemies.boss.x, this.enemies.boss.y, '#ffe27a', 28);
            if (this.enemies.boss.hp <= 0) {
              const boss = this.enemies.boss;
              this.levels.bossDefeated = true;
              this.audio.playBoom();
              this.particles.explosion(boss.x, boss.y, '#ffe27a', 76);
              const points = boss.scoreValue * this.combo;
              this.score += points;
              this.popups.push({ x: boss.x, y: boss.y, text: '+' + points, t: 0 });
              this.bullets.bullets = this.bullets.bullets.filter(b => b.isPlayer);
              this.beginBossDefeatCinematic(boss);
            }
          }
        }

        // Firing
        if (this.input.isFiring() && this.player.canFire() && !this.cinematic) {
          this.audio.playShoot();
          const weapon = this.player.profile.weapon;
          const shotColor = this.player.profile.color;
          if (weapon === 'twin') {
            this.bullets.spawn(this.player.x + 14, this.player.y - 10, 14, -0.12, true, shotColor);
            this.bullets.spawn(this.player.x + 14, this.player.y + 10, 14, 0.12, true, shotColor);
          } else if (weapon === 'burst') {
            for (const spread of [-0.9, 0, 0.9]) this.bullets.spawn(this.player.x + 16, this.player.y, 13, spread, true, shotColor);
          } else {
            this.bullets.spawn(this.player.x + 20, this.player.y, weapon === 'needle' ? 16 : 14, 0, true, shotColor);
          }
          if (this.player.flareTimer > 0) {
            this.bullets.spawn(this.player.x + 10, this.player.y - 15, 14, -2, true, '#ffe27a');
            this.bullets.spawn(this.player.x + 10, this.player.y + 15, 14, 2, true, '#ffe27a');
          }
        }

        this.bullets.update(simDt);
        this.enemies.update(simDt, this.bullets, this.player);
        this.audio.setBossMode(!!this.enemies.boss);
        // Boss phase transitions (62% / 28% HP) get a terrifying tritone sting.
        if (this.enemies.boss) {
          if (this._lastBossPhase !== null && this._lastBossPhase !== this.enemies.boss.phase) {
            this.audio.playPhaseShift();
          }
          this._lastBossPhase = this.enemies.boss.phase;
        } else {
          this._lastBossPhase = null;
        }
        this.powerups.update(simDt, this.player);
        this.particles.update(this.cinematic ? dt : simDt); // debris flies brisk in the slow-mo world
        this.levels.update(simDt, this.enemies, this.rng);

        // Boss entrance: detecting the live spawn (harness stages prime the flag directly)
        if (!this.bossSpawnedFlag && this.enemies.boss && !this.cinematic) {
          this.bossSpawnedFlag = true;
          const b = this.enemies.boss;
          this.cinematic = { type: 'enter', t: 0, dur: 2.8, name: b.title, color: b.color, style: b.style, sector: this.levels.currentLevel };
          b.attackTimer = -1.2; // grace period once control resumes; frozen world freezes this too
          this.lastRingIndex = 0;
          this.audio.setTheme('boss');
          if (this.audio.playBossEntrance) this.audio.playBossEntrance(b.title);
        }

        // Combo decay timer
        if (this.comboTimer > 0) {
          this.comboTimer -= simDt;
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
              this.screenShake = Math.max(this.screenShake, 18);
              this.levels.bossDefeated = true;
              this.audio.playBoom();
              this.particles.explosion(this.enemies.boss.x, this.enemies.boss.y, '#9d00ff', 50);
              const boss = this.enemies.boss;
              const points = boss.scoreValue * this.combo;
              this.score += points;
              this.popups.push({ x: boss.x, y: boss.y, text: '+' + points, t: 0 });
              this.bullets.bullets = this.bullets.bullets.filter(b => b.isPlayer);
              this.beginBossDefeatCinematic(boss);
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
                this.player.pulseCharge = Math.min(100, this.player.pulseCharge + 18);

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
              this.screenShake = Math.max(this.screenShake, 11);
              this.screenFlash = Math.max(this.screenFlash, 0.22);
              this.combo = 1;
              this.particles.explosion(this.player.x, this.player.y, '#00f0ff', 25);
              if (this.player.lives <= 0) {
                this.audio.setTheme('gameover');
                this.audio.playGameOverSting();
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

        if (this.levels.levelCompleted && !this.cinematic) {
          this.audio.playLantern(); // the district lantern relights
          if (this.levels.currentLevel < this.levels.maxLevels) {
            this.state = 'levelclear';
          } else {
            this.audio.setTheme('victory');
            this.audio.playVictorySting();
            this.state = 'victory';
            this.victoryT = 0; // reborn-sun animation starts from darkness
          }
        }
      }
    } else if (this.state === 'levelclear') {
      if (this.input.wasPressed('Enter')) {
        this.audio.playUI();
        this.levels.nextLevel();
        this.audio.setSector(this.levels.currentLevel);
        this.audio.setTheme('play');
        this.background.setSector(this.levels.currentLevel);
        this.state = 'play';
      }
    } else if (this.state === 'gameover' || this.state === 'victory') {
      if (this.input.wasPressed('Enter')) {
        this.audio.playUI();
        this.resetGame();
        this.state = 'play';
        this.audio.setTheme('play');
        this.audio.startMusic();
      }
    }
  }

  beginBossDefeatCinematic(boss) {
    if (this.cinematic) return;
    this.cinematic = { type: 'defeat', t: 0, dur: 2.5, name: boss.title, color: boss.color, style: boss.style, sector: this.levels.currentLevel, x: boss.x, y: boss.y };
    this.screenShake = Math.max(this.screenShake, 14);
    this.screenFlash = Math.max(this.screenFlash, 0.65);
    this.particles.debris(boss.x, boss.y, [boss.color || '#fff0c2', '#ffffff', '#ff9a3c'], 34);
    this.particles.speedLines(boss.x, boss.y, '#fff6c8', 24, 260, 0.6);
    this.particles.shockwave(boss.x, boss.y, '#ffffff', 250, 1.0, 8);
    this.particles.shockwave(boss.x, boss.y, boss.color || '#ff9a3c', 180, 0.85, 6);
    this.particles.motes(boss.x, boss.y, '#ffe8b0', 20);
    this.enemies.boss = null;
    if (this.audio.playBossDown) this.audio.playBossDown(boss.title);
  }

  updateCinematic(dt) {
    const c = this.cinematic;
    if (!c) return;
    c.t += dt;
    if (c.type === 'enter') {
      const boss = this.enemies.boss;
      if (boss) {
        // Idle hover while the world is frozen
        boss.angle += dt * 0.8;
        boss.drift = (boss.drift || 0) + dt * 0.8;
        boss.x = 1035 + Math.sin(boss.drift) * 22;
        if (c.t < 0.4) this.screenShake = Math.max(this.screenShake, 2.5);
        // Sonar rings sweep outward every 0.75s (index math keeps it deterministic)
        const ring = Math.floor(c.t / 0.75);
        if (ring > this.lastRingIndex && c.t < c.dur - 0.2) {
          this.lastRingIndex = ring;
          this.particles.shockwave(boss.x, boss.y, boss.color || '#ffffff', 130, 0.95, 5);
        }
      }
      if (c.t >= c.dur) {
        this.cinematic = null;
        this.lastRingIndex = 0;
        this.timeScale = 1;
        if (boss) boss.attackTimer = -1.2; // a breath of mercy before the first volley
      }
    } else if (c.type === 'defeat') {
      this.timeScale = 0.18;
      if (c.t >= c.dur) {
        this.cinematic = null;
        this.timeScale = 1; // levelCompleted then advances the sector on the next frames
      }
    }
  }

  render() {
    const sctx = this.sceneCtx;
    sctx.clearRect(0, 0, 1280, 720);
    sctx.save();
    if (this.screenShake > 0) {
      const strength = this.screenShake;
      sctx.translate((this.rng.next() - 0.5) * strength, (this.rng.next() - 0.5) * strength * 0.65);
    }
    this.background.draw(sctx, this.enemies.boss);
    this.particles.draw(sctx);
    this.powerups.draw(sctx);
    this.bullets.draw(sctx);
    this.enemies.draw(sctx);
    if (this.state === 'play' || this.state === 'levelclear') {
      this.player.draw(sctx);
    }
    // Draw popups after entities
    for (const p of this.popups) {
      sctx.save();
      sctx.font = '700 20px Orbitron';
      sctx.fillStyle = '#ffd24a';
      sctx.shadowColor = '#ff7700';
      sctx.shadowBlur = 8;
      sctx.globalAlpha = Math.max(0, 1 - p.t / 0.9);
      sctx.textAlign = 'center';
      sctx.fillText(p.text, p.x, p.y - 46 * p.t);
      sctx.restore();
    }
    sctx.restore();

    // === Composite the scene onto the main canvas ===
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 1280, 720);
    ctx.drawImage(this.sceneCanvas, 0, 0);

    // Fake floor reflection: mirror the band above the horizon (HORIZON = 560)
    const HORIZON = 560;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, HORIZON, 1280, 160);
    ctx.clip();
    ctx.translate(0, 2 * HORIZON);
    ctx.scale(1, -1);
    ctx.globalAlpha = 0.16;
    ctx.drawImage(this.sceneCanvas, 0, 360, 1280, 200, 0, 360, 1280, 200);
    ctx.restore();
    // Reflection fades into the dark floor
    const rg = ctx.createLinearGradient(0, HORIZON, 0, 720);
    rg.addColorStop(0, 'rgba(10,6,24,0)');
    rg.addColorStop(1, 'rgba(10,6,24,0.92)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, HORIZON, 1280, 160);

    // Film finish: grain + scanlines + vignette (pre-rendered at init from the seeded rng)
    ctx.save();
    if (this.grainPattern) {
      ctx.globalAlpha = 0.055;
      ctx.globalCompositeOperation = 'overlay'; // silently ignored where unsupported
      ctx.fillStyle = this.grainPattern;
      ctx.fillRect(0, 0, 1280, 720);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    if (this.scanPattern) {
      ctx.fillStyle = this.scanPattern;
      ctx.fillRect(0, 0, 1280, 720);
    }
    const vg = ctx.createRadialGradient(640, 360, 300, 640, 360, 720);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, 1280, 720);
    ctx.restore();

    // Chromatic aberration only on heavy hits (screenFlash > 0.22)
    if (this.screenFlash > 0.22 && typeof ctx.filter === 'string') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(0.5, this.screenFlash);
      ctx.filter = 'saturate(2.4) hue-rotate(-25deg)';
      ctx.drawImage(this.sceneCanvas, -5, 0);
      ctx.filter = 'saturate(2.4) hue-rotate(160deg)';
      ctx.drawImage(this.sceneCanvas, 5, 0);
      ctx.restore();
      if ('filter' in ctx) ctx.filter = 'none';
    }

    // HUD + cinematic plates + letterbox on top of the graded scene
    this.hud.draw(ctx, this.state, this.player, this.score, this.combo, this.levels, this.enemies.boss, this.player, this.victoryT);
    if (this.cinematic) {
      this.hud.drawCinematicPlate(ctx, this.cinematic);
      this.hud.drawLetterbox(ctx, this.cinematic);
    }
    if (this.screenFlash > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 55, 110, ${this.screenFlash * 0.3})`;
      ctx.fillRect(0, 0, 1280, 720);
      ctx.restore();
    }
    if (this.state === 'play' && this.paused) {
      this.hud.drawPause(ctx);
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
  window.__game = game; // debug/testing handle (harmless in production)
  game.init();
});
