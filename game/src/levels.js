// levels.js: original ten-district campaign with escalating waves and a sector boss each.
export class LevelManager {
  constructor() {
    this.currentLevel = 1;
    this.maxLevels = 10;
    this.waveTimer = 0;
    this.enemiesSpawnedInLevel = 0;
    this.lanternsLit = 0;
    this.targetLanterns = 10;
    this.levelCompleted = false;
    this.bossDefeated = false;
  }

  reset() {
    this.currentLevel = 1;
    this.waveTimer = 0;
    this.enemiesSpawnedInLevel = 0;
    this.lanternsLit = 0;
    this.levelCompleted = false;
    this.bossDefeated = false;
  }

  spawnEncounter(enemyManager, rng) {
    const index = this.enemiesSpawnedInLevel - 1;
    const y = rng.range(105, 475);
    if (index === 8) {
      enemyManager.spawnBoss(this.currentLevel);
      return;
    }
    const roll = rng.next();
    if (this.currentLevel === 1) {
      if (index === 5 || index === 6) enemyManager.spawnPrism(1320, y);
      else enemyManager.spawnDrifter(1320, y);
    } else if (this.currentLevel >= 4 && roll < 0.26) {
      enemyManager.spawnLancer(1320, y);
    } else if (index % 4 === 3 || roll < 0.16) {
      enemyManager.spawnPrism(1320, y);
    } else if (roll < 0.42) {
      enemyManager.spawnWeaver(1320, y);
    } else if (roll < 0.68) {
      enemyManager.spawnTank(1320, y);
    } else {
      enemyManager.spawnDrifter(1320, y);
    }
  }

  update(dt, enemyManager, rng) {
    if (this.levelCompleted) return;
    this.waveTimer += dt;
    const pace = Math.max(1.15, 2.1 - (this.currentLevel - 1) * 0.08);
    if (this.waveTimer >= pace && this.enemiesSpawnedInLevel < 9) {
      this.waveTimer = 0;
      this.enemiesSpawnedInLevel++;
      this.spawnEncounter(enemyManager, rng);
    }
    if (this.bossDefeated && enemyManager.enemies.length === 0) {
      this.lanternsLit = Math.min(this.targetLanterns, this.currentLevel);
      this.levelCompleted = true;
    }
  }

  nextLevel() {
    if (this.currentLevel < this.maxLevels) {
      this.currentLevel++;
      this.waveTimer = 0;
      this.enemiesSpawnedInLevel = 0;
      this.levelCompleted = false;
      this.bossDefeated = false;
      return true;
    }
    return false;
  }
}
