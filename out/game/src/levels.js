// levels.js: Level definitions, wave spawning logic, and lantern progress tracking.

export class LevelManager {
  constructor() {
    this.currentLevel = 1;
    this.maxLevels = 3;
    this.waveTimer = 0;
    this.enemiesSpawnedInLevel = 0;
    this.lanternsLit = 0;
    this.targetLanterns = 3; // 3 per level -> 9 total
    this.levelCompleted = false;
  }

  reset() {
    this.currentLevel = 1;
    this.waveTimer = 0;
    this.enemiesSpawnedInLevel = 0;
    this.lanternsLit = 0;
    this.levelCompleted = false;
  }

  update(dt, enemyManager, rng) {
    if (this.levelCompleted) return;

    this.waveTimer += dt;
    if (this.waveTimer > 2.5 && this.enemiesSpawnedInLevel < 12) {
      this.waveTimer = 0;
      this.enemiesSpawnedInLevel++;

      const y = rng.range(100, 480);
      if (this.currentLevel === 1) {
        enemyManager.spawnDrifter(1320, y);
      } else if (this.currentLevel === 2) {
        if (rng.next() < 0.6) {
          enemyManager.spawnWeaver(1320, y);
        } else {
          enemyManager.spawnTank(1320, y);
        }
      } else if (this.currentLevel === 3) {
        if (!enemyManager.boss && this.enemiesSpawnedInLevel === 1) {
          enemyManager.spawnBoss();
        } else {
          enemyManager.spawnDrifter(1320, y);
        }
      }
    }

    // Check if level conditions are met
    if (this.currentLevel < 3 && this.enemiesSpawnedInLevel >= 12 && enemyManager.enemies.length === 0) {
      this.lanternsLit += 3;
      this.levelCompleted = true;
    } else if (this.currentLevel === 3 && enemyManager.boss && enemyManager.boss.hp <= 0) {
      this.lanternsLit = 9;
      this.levelCompleted = true;
    }
  }

  nextLevel() {
    if (this.currentLevel < this.maxLevels) {
      this.currentLevel++;
      this.waveTimer = 0;
      this.enemiesSpawnedInLevel = 0;
      this.levelCompleted = false;
      return true;
    }
    return false; // Victory
  }
}
