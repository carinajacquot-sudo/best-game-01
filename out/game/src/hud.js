// hud.js: Heads-up display (HUD) and screen overlays (Title, How to Play, Level Clear, Game Over, Victory).

export class HUD {
  constructor() {}

  draw(ctx, gameState, player, score, combo, levelManager, highScores) {
    if (gameState === 'title') {
      this.drawTitleScreen(ctx);
    } else if (gameState === 'howto') {
      this.drawHowToPlay(ctx);
    } else if (gameState === 'play') {
      this.drawPlayHUD(ctx, player, score, combo, levelManager);
    } else if (gameState === 'levelclear') {
      this.drawLevelClear(ctx, levelManager);
    } else if (gameState === 'gameover') {
      this.drawGameOver(ctx, score);
    } else if (gameState === 'victory') {
      this.drawVictory(ctx, score);
    }
  }

  drawTitleScreen(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(5, 2, 10, 0.75)';
    ctx.fillRect(0, 0, 1280, 720);

    // Glowing Title
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#ff007f';
    ctx.font = 'bold 84px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('EMBER WING', 640, 240);

    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#00f0ff';
    ctx.font = '24px Courier New';
    ctx.fillText('the last ember of a dying star', 640, 300);

    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Courier New';
    const blink = Math.floor(Date.now() / 400) % 2 === 0;
    if (blink) {
      ctx.fillText('PRESS [ENTER] TO START', 640, 460);
    }
    ctx.fillText('PRESS [H] FOR HOW TO PLAY', 640, 510);
    ctx.fillText('PRESS [M] TO TOGGLE AUDIO MUTE', 640, 560);

    ctx.restore();
  }

  drawHowToPlay(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(5, 2, 10, 0.9)';
    ctx.fillRect(0, 0, 1280, 720);

    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 48px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('HOW TO PLAY', 640, 140);

    ctx.fillStyle = '#ffffff';
    ctx.font = '22px Courier New';
    ctx.textAlign = 'left';
    const lines = [
      '• MOVE: Arrow keys or W/A/S/D',
      '• SHOOT: Space, J, or Left Mouse Click',
      '• PAUSE: P key',
      '• MUTE AUDIO: M key',
      '• GOAL: Relight all 9 district lanterns across 3 levels',
      '• COMBO: Consecutive kills grow multiplier up to x8',
      '• POWERUPS: Tanks drop Flare (triple shot), Aegis (shield), Magnet',
    ];

    let y = 240;
    for (const line of lines) {
      ctx.fillText(line, 240, y);
      y += 50;
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff007f';
    ctx.fillText('PRESS [ESC] OR [ENTER] TO RETURN', 640, 620);

    ctx.restore();
  }

  drawPlayHUD(ctx, player, score, combo, levelManager) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Courier New';

    // Left: Embers (Lives)
    ctx.textAlign = 'left';
    let livesStr = 'EMBER: ';
    for (let i = 0; i < player.lives; i++) livesStr += '♦ ';
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;
    ctx.fillText(livesStr, 40, 50);

    // Center: Score & Combo
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffee00';
    ctx.shadowColor = '#ffee00';
    ctx.fillText(`SCORE: ${score}   MULTIPLIER: x${combo}`, 640, 50);

    // Right: Level & Lanterns
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff007f';
    ctx.shadowColor = '#ff007f';
    ctx.fillText(`LEVEL ${levelManager.currentLevel} | LANTERNS: ${levelManager.lanternsLit}/9`, 1240, 50);

    ctx.restore();
  }

  drawLevelClear(ctx, levelManager) {
    ctx.save();
    ctx.fillStyle = 'rgba(5, 2, 10, 0.8)';
    ctx.fillRect(0, 0, 1280, 720);

    ctx.shadowColor = '#ffee00';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#ffee00';
    ctx.font = 'bold 56px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(`LEVEL ${levelManager.currentLevel} CLEARED!`, 640, 300);

    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Courier New';
    ctx.fillText('PRESS [ENTER] FOR NEXT LEVEL', 640, 400);

    ctx.restore();
  }

  drawGameOver(ctx, score) {
    ctx.save();
    ctx.fillStyle = 'rgba(5, 2, 10, 0.85)';
    ctx.fillRect(0, 0, 1280, 720);

    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 40;
    ctx.fillStyle = '#ff007f';
    ctx.font = 'bold 72px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', 640, 260);

    ctx.fillStyle = '#ffffff';
    ctx.font = '28px Courier New';
    ctx.fillText(`FINAL SCORE: ${score}`, 640, 360);

    ctx.font = '22px Courier New';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText('PRESS [ENTER] TO RESTART', 640, 460);

    ctx.restore();
  }

  drawVictory(ctx, score) {
    ctx.save();
    ctx.fillStyle = 'rgba(5, 2, 10, 0.85)';
    ctx.fillRect(0, 0, 1280, 720);

    ctx.shadowColor = '#ffee00';
    ctx.shadowBlur = 40;
    ctx.fillStyle = '#ffee00';
    ctx.font = 'bold 72px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('VICTORY!', 640, 240);

    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 20;
    ctx.font = '28px Courier New';
    ctx.fillText('ALL 9 LANTERNS RELIGHTED!', 640, 320);

    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Courier New';
    ctx.fillText(`FINAL SCORE: ${score}`, 640, 400);

    ctx.fillStyle = '#ff7700';
    ctx.fillText('PRESS [ENTER] TO PLAY AGAIN', 640, 480);

    ctx.restore();
  }
}
