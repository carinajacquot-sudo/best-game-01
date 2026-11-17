// hud.js: Heads-up display (HUD) and screen overlays (Title, How to Play, Level Clear, Game Over, Victory).

export class HUD {
  constructor(keyArt = null) {
    this.keyArt = keyArt;
    this.screenshotMode = false;
  }

  setKeyArt(keyArt) {
    this.keyArt = keyArt;
  }

  draw(ctx, gameState, player, score, combo, levelManager, boss) {
    if (gameState === 'title') {
      this.drawTitleScreen(ctx);
    } else if (gameState === 'howto') {
      this.drawHowToPlay(ctx);
    } else if (gameState === 'play') {
      this.drawPlayHUD(ctx, player, score, combo, levelManager, boss);
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
    if (this.keyArt) {
      ctx.drawImage(this.keyArt, 0, 0, 1280, 720);

      // Bottom-up gradient over lower 45%
      const botGrad = ctx.createLinearGradient(0, 720 * 0.55, 0, 720);
      botGrad.addColorStop(0, 'rgba(5,2,10,0.05)');
      botGrad.addColorStop(1, 'rgba(5,2,10,0.82)');
      ctx.fillStyle = botGrad;
      ctx.fillRect(0, 720 * 0.55, 1280, 720 * 0.45);

      // Top vignette
      const topGrad = ctx.createLinearGradient(0, 0, 0, 200);
      topGrad.addColorStop(0, 'rgba(5,2,10,0.6)');
      topGrad.addColorStop(1, 'rgba(5,2,10,0)');
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, 1280, 200);

      // EMBER
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 44;
      ctx.fillStyle = '#ff2d95';
      ctx.font = '112px Monoton';
      ctx.textAlign = 'center';
      ctx.fillText('EMBER', 640, 206);

      // W I N G
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 32;
      ctx.fillStyle = '#00f0ff';
      ctx.font = '54px Monoton';
      ctx.fillText('W I N G', 640, 296);

      // Subtitle
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#8be9fd';
      ctx.fillStyle = '#8be9fd';
      ctx.font = '15px Orbitron';
      ctx.fillText('T H E  L A S T  E M B E R  O F  A  D Y I N G  S T A R', 640, 346);

      // 2px magenta divider y=566 (x 410-870)
      ctx.strokeStyle = '#ff007f';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(410, 566);
      ctx.lineTo(870, 566);
      ctx.stroke();

      // Prompts
      const drawPromptLine = (bracket, action, y) => {
        ctx.save();
        ctx.font = '600 19px Orbitron';
        const wBracket = ctx.measureText(bracket).width;
        const wAction = ctx.measureText('  ' + action).width;
        const totalW = wBracket + wAction;
        const startX = 640 - totalW / 2;

        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(63, 215, 255, 0.75)';
        ctx.shadowBlur = 0;
        ctx.fillText(bracket, startX, y);

        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 12;
        ctx.fillText('  ' + action, startX + wBracket, y);
        ctx.restore();
      };

      drawPromptLine('[ ENTER ]', 'REIGNITE', 604);
      drawPromptLine('[ H ]', 'HOW TO FLY', 636);
      drawPromptLine('[ M ]', 'SOUND ON / OFF', 668);

    } else {
      ctx.fillStyle = 'rgba(5, 2, 10, 0.75)';
      ctx.fillRect(0, 0, 1280, 720);

      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 30;
      ctx.fillStyle = '#ff007f';
      ctx.font = '700 64px Orbitron';
      ctx.textAlign = 'center';
      ctx.fillText('EMBER WING', 640, 240);

      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#00f0ff';
      ctx.font = '20px Orbitron';
      ctx.fillText('the last ember of a dying star', 640, 300);

      ctx.fillStyle = '#ffffff';
      ctx.font = '16px Orbitron';
      const blink = this.screenshotMode || Math.floor(Date.now() / 400) % 2 === 0;
      if (blink) {
        ctx.fillText('PRESS [ENTER] TO START', 640, 460);
      }
      ctx.fillText('PRESS [H] FOR HOW TO PLAY', 640, 510);
      ctx.fillText('PRESS [M] TO TOGGLE AUDIO MUTE', 640, 560);
    }

    ctx.restore();
  }

  drawHowToPlay(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(5, 2, 10, 0.9)';
    ctx.fillRect(0, 0, 1280, 720);

    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#00f0ff';
    ctx.font = '700 44px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText('HOW TO PLAY', 640, 140);

    ctx.fillStyle = '#ffffff';
    ctx.font = '500 20px Orbitron';
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

  drawPlayHUD(ctx, player, score, combo, levelManager, boss) {
    ctx.save();

    // 'EMBER' Orbitron 11px dim cyan at x=34, y=34
    ctx.font = '11px Orbitron';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.7)';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.textAlign = 'left';
    ctx.fillText('EMBER', 34, 34);

    // Lives as ember teardrops starting at x=96, y=30, spaced 27px
    for (let i = 0; i < player.lives; i++) {
      const lx = 96 + i * 27;
      const ly = 30;
      ctx.save();
      ctx.translate(lx, ly);

      // Outer glow / outer teardrop (radius 10 '#ff4400')
      ctx.shadowColor = '#ff4400';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ff4400';
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.bezierCurveTo(7, -3, 8, 4, 0, 8);
      ctx.bezierCurveTo(-8, 4, -7, -3, 0, -10);
      ctx.fill();

      // Inner teardrop (radius 6.5 '#ff7700')
      ctx.fillStyle = '#ff7700';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(0, -6.5);
      ctx.bezierCurveTo(4.5, -2, 5.5, 3, 0, 5.5);
      ctx.bezierCurveTo(-5.5, 3, -4.5, -2, 0, -6.5);
      ctx.fill();

      // Core (radius 2.6 '#ffe9a8')
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(0, 1, 2.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Score & Multiplier (Orbitron 700 21px)
    ctx.textAlign = 'center';
    ctx.font = '700 21px Orbitron';
    ctx.fillStyle = '#ffee00';
    ctx.shadowColor = '#ffee00';
    ctx.shadowBlur = 10;
    ctx.fillText(`SCORE: ${score}   MULTIPLIER: x${combo}`, 640, 36);

    // Level & Lanterns (Orbitron 15px)
    ctx.textAlign = 'right';
    ctx.font = '15px Orbitron';
    ctx.fillStyle = '#ff007f';
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 10;
    ctx.fillText(`LEVEL ${levelManager.currentLevel} | LANTERNS: ${levelManager.lanternsLit}/9`, 1240, 36);

    // Boss Bar (only when boss truthy)
    if (boss) {
      const bx = 340, by = 58, bw = 600, bh = 8;
      ctx.save();
      ctx.fillStyle = 'rgba(157, 0, 255, 0.28)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);

      const hpRatio = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
      const fillW = bw * hpRatio;
      if (fillW > 0) {
        const grad = ctx.createLinearGradient(bx, by, bx + bw, by);
        grad.addColorStop(0, '#9d00ff');
        grad.addColorStop(1, '#ff007f');
        ctx.fillStyle = grad;
        ctx.fillRect(bx, by, fillW, bh);
      }

      ctx.strokeStyle = '#ffd24a';
      ctx.lineWidth = 2;
      const tick25 = bx + bw * 0.25;
      const tick75 = bx + bw * 0.75;
      ctx.beginPath();
      ctx.moveTo(tick25, by - 2); ctx.lineTo(tick25, by + bh + 2);
      ctx.moveTo(tick75, by - 2); ctx.lineTo(tick75, by + bh + 2);
      ctx.stroke();

      ctx.font = '10px Orbitron';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 5;
      ctx.fillText('THE HOLLOW CROWN', 640, 52);

      ctx.restore();
    }

    ctx.restore();
  }

  drawLevelClear(ctx, levelManager) {
    ctx.save();
    ctx.fillStyle = 'rgba(5, 2, 10, 0.8)';
    ctx.fillRect(0, 0, 1280, 720);

    ctx.shadowColor = '#ffee00';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#ffee00';
    ctx.font = '700 52px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText(`LEVEL ${levelManager.currentLevel} CLEARED!`, 640, 300);

    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Orbitron';
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
    ctx.font = '700 64px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', 640, 260);

    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Orbitron';
    ctx.fillText(`FINAL SCORE: ${score}`, 640, 360);

    ctx.font = '500 20px Orbitron';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText('PRESS [ENTER] TO RESTART', 640, 460);

    ctx.restore();
  }

  drawVictory(ctx, score) {
    ctx.save();
    ctx.fillStyle = '#05020a';
    ctx.fillRect(0, 0, 1280, 720);

    if (this.keyArt) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.drawImage(this.keyArt, 0, 0, 1280, 720);
      ctx.restore();

      ctx.fillStyle = 'rgba(5,2,10,0.30)';
      ctx.fillRect(0, 0, 1280, 720);
    } else {
      ctx.fillStyle = 'rgba(5, 2, 10, 0.55)';
      ctx.fillRect(0, 0, 1280, 720);
    }

    // THE CITY REMEMBERS
    ctx.shadowColor = '#ffd24a';
    ctx.shadowBlur = 48;
    ctx.fillStyle = '#ffd24a';
    ctx.font = '50px Monoton';
    ctx.textAlign = 'center';
    ctx.fillText('THE CITY REMEMBERS', 640, 252);

    // ALL 9 LANTERNS RELIGHTED
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#00f0ff';
    ctx.font = '16px Orbitron';
    ctx.fillText('ALL 9 LANTERNS RELIGHTED', 640, 320);

    // FINAL SCORE dim
    ctx.shadowBlur = 5;
    ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
    ctx.font = '12px Orbitron';
    ctx.fillText('FINAL SCORE', 640, 380);

    // Final score white Orbitron 700 34px
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 34px Orbitron';
    ctx.fillText(score, 640, 424);

    // ENTER prompt line restyled Orbitron 15px '#8be9fd'
    ctx.shadowColor = '#8be9fd';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#8be9fd';
    ctx.font = '15px Orbitron';
    ctx.fillText('[ ENTER ]  PLAY AGAIN', 640, 520);

    ctx.restore();
  }

  drawPause(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(5, 2, 10, 0.75)';
    ctx.fillRect(0, 0, 1280, 720);

    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#00f0ff';
    ctx.font = '700 64px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', 640, 300);

    ctx.shadowBlur = 15;
    ctx.font = '500 22px Orbitron';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('[ P ]  RESUME', 640, 380);
    ctx.restore();
  }
}
