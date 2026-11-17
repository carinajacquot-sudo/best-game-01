// hud.js: Heads-up display (HUD) and screen overlays (Title, How to Play, Level Clear, Game Over, Victory).
//
// PERFORMANCE NOTE (v7.1): the HUD used to issue ~20 shadowBlur'd text draws per
// frame, which cost more than the entire rest of the frame. Static labels and
// panels are now pre-rendered into cached layers and blitted; only genuinely
// dynamic values (score, boss HP, pip row) are drawn live, and they use cheap
// multi-pass glows instead of shadowBlur.

import { glowText, cachedGradient } from './perf.js';

export class HUD {
  constructor(keyArt = null) {
    this.keyArt = keyArt;
    this.screenshotMode = false;
    this.panelLayer = null;
  }

  setKeyArt(keyArt) {
    this.keyArt = keyArt;
  }

  draw(ctx, gameState, player, score, combo, levelManager, boss, pilot = null, victoryT = 0) {
    if (gameState === 'title') {
      this.drawTitleScreen(ctx, pilot);
    } else if (gameState === 'howto') {
      this.drawHowToPlay(ctx);
    } else if (gameState === 'play') {
      this.drawPlayHUD(ctx, player, score, combo, levelManager, boss);
    } else if (gameState === 'levelclear') {
      this.drawLevelClear(ctx, levelManager);
    } else if (gameState === 'gameover') {
      this.drawGameOver(ctx, score);
    } else if (gameState === 'victory') {
      this.drawVictory(ctx, score, victoryT);
    }
  }

  drawTitleScreen(ctx, pilot = null) {
    ctx.save();
    if (this.keyArt) {
      ctx.drawImage(this.keyArt, 0, 0, 1280, 720);

      // Bottom-up gradient over lower 45%
      const botGrad = cachedGradient(ctx, 'titlebot', () => {
        const g = ctx.createLinearGradient(0, 720 * 0.55, 0, 720);
        g.addColorStop(0, 'rgba(5,2,10,0.05)');
        g.addColorStop(1, 'rgba(5,2,10,0.82)');
        return g;
      });
      ctx.fillStyle = botGrad;
      ctx.fillRect(0, 720 * 0.55, 1280, 720 * 0.45);

      // Top vignette
      const topGrad = cachedGradient(ctx, 'titletop', () => {
        const g = ctx.createLinearGradient(0, 0, 0, 200);
        g.addColorStop(0, 'rgba(5,2,10,0.6)');
        g.addColorStop(1, 'rgba(5,2,10,0)');
        return g;
      });
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, 1280, 200);

      // EMBER
      glowText(ctx, 'EMBER', {
        font: '112px Monoton', color: '#ff2d95', glow: '#ff007f', blur: 44,
        align: 'center', x: 640, y: 206,
      });

      // W I N G
      glowText(ctx, 'W I N G', {
        font: '54px Monoton', color: '#00f0ff', glow: '#00f0ff', blur: 32,
        align: 'center', x: 640, y: 296,
      });

      // Subtitle
      glowText(ctx, 'T H E  L A S T  E M B E R  O F  A  D Y I N G  S T A R', {
        font: '15px Orbitron', color: '#8be9fd', glow: '#8be9fd', blur: 10,
        align: 'center', x: 640, y: 346,
      });

      if (pilot && pilot.profile) {
        glowText(ctx, `PILOT CRAFT  ·  ${pilot.profile.name}`, {
          font: '700 17px Orbitron', color: pilot.profile.color, glow: pilot.profile.color,
          blur: 12, align: 'center', x: 640, y: 432,
        });
        ctx.fillStyle = 'rgba(255,255,255,.82)';
        ctx.font = '12px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText(`${pilot.profile.role.toUpperCase()}  ·  ◀ / ▶ TO SELECT`, 640, 456);
      }

      // 2px magenta divider y=566 (x 410-870)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#ff007f';
      ctx.lineWidth = 5;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(410, 566);
      ctx.lineTo(870, 566);
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = '#ff007f';
      ctx.lineWidth = 2;
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
        ctx.fillText(bracket, startX, y);

        glowText(ctx, '  ' + action, {
          font: '600 19px Orbitron', color: '#ffffff', glow: '#ffffff', blur: 12,
          align: 'left', x: startX + wBracket, y,
        });
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

      if (pilot && pilot.profile) {
        ctx.fillStyle = pilot.profile.color;
        ctx.font = '15px Orbitron';
        ctx.fillText(`PILOT CRAFT · ${pilot.profile.name}  [← / →]`, 640, 390);
      }

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
      '• NOVA PULSE: Press X when the charge meter is full',
      '• PILOT CRAFT: Select a ship with Left / Right at title',
      '• PAUSE: P key',
      '• MUTE AUDIO: M key',
      '• GOAL: Reclaim 10 districts and defeat each sector boss',
      '• COMBO: Consecutive kills grow multiplier up to x8',
      '• POWERUPS: Tanks drop Flare (triple shot), Aegis (shield), Magnet',
    ];

    let y = 212;
    for (const line of lines) {
      ctx.fillText(line, 240, y);
      y += 44;
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff007f';
    ctx.fillText('PRESS [ESC] OR [ENTER] TO RETURN', 640, 620);

    ctx.restore();
  }

  /**
   * The three glass HUD panels are static — they never change during play.
   * They are rendered once into a cached layer (including their neon border
   * glow, which used to cost three shadowBlur'd strokes per frame).
   */
  getPanelLayer(ctx) {
    if (this.panelLayer) return this.panelLayer;
    const layer = document.createElement('canvas');
    layer.width = 1280;
    layer.height = 120;
    const c = layer.getContext('2d');

    const panel = (x, y, w, h, accent) => {
      c.save();
      c.fillStyle = 'rgba(5, 8, 24, 0.72)';
      c.strokeStyle = accent;
      c.lineWidth = 1.2;
      c.shadowColor = accent;
      c.shadowBlur = 9;
      c.beginPath();
      c.roundRect(x, y, w, h, 8);
      c.fill();
      c.globalAlpha = 0.7;
      c.stroke();

      // Corner brackets (6px L-shaped strokes, 2px, alpha .8)
      c.globalAlpha = 0.8;
      c.strokeStyle = accent;
      c.lineWidth = 2;
      const bl = 6;
      c.beginPath(); c.moveTo(x, y + bl); c.lineTo(x, y); c.lineTo(x + bl, y); c.stroke();
      c.beginPath(); c.moveTo(x + w - bl, y); c.lineTo(x + w, y); c.lineTo(x + w, y + bl); c.stroke();
      c.beginPath(); c.moveTo(x, y + h - bl); c.lineTo(x, y + h); c.lineTo(x + bl, y + h); c.stroke();
      c.beginPath(); c.moveTo(x + w - bl, y + h); c.lineTo(x + w, y + h); c.lineTo(x + w, y + h - bl); c.stroke();
      c.restore();
    };
    panel(20, 12, 190, 42, 'rgba(0,240,255,.8)');
    panel(470, 12, 340, 42, 'rgba(255,210,74,.8)');
    panel(1010, 12, 250, 42, 'rgba(255,0,127,.8)');

    this.panelLayer = layer;
    return layer;
  }

  drawPlayHUD(ctx, player, score, combo, levelManager, boss) {
    ctx.save();

    // Slim glass panels give the arcade readouts a stable, high-contrast home.
    ctx.drawImage(this.getPanelLayer(ctx), 0, 0);

    // 'EMBER' Orbitron 11px dim cyan at x=34, y=34
    glowText(ctx, 'EMBER', {
      font: '11px Orbitron', color: 'rgba(0, 240, 255, 0.7)',
      glow: '#00f0ff', blur: 8, align: 'left', x: 34, y: 34,
    });

    // Lives as ember teardrops starting at x=96, y=30, spaced 27px
    for (let i = 0; i < player.lives; i++) {
      const lx = 96 + i * 27;
      const ly = 30;
      ctx.save();
      ctx.translate(lx, ly);

      // Outer glow / outer teardrop (radius 10 '#ff4400')
      ctx.fillStyle = '#ff4400';
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.bezierCurveTo(7, -3, 8, 4, 0, 8);
      ctx.bezierCurveTo(-8, 4, -7, -3, 0, -10);
      ctx.fill();

      // Inner teardrop (radius 6.5 '#ff7700')
      ctx.fillStyle = '#ff7700';
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
    glowText(ctx, `SCORE: ${score}   MULTIPLIER: x${combo}`, {
      font: '700 21px Orbitron', color: '#ffee00', glow: '#ffee00', blur: 10,
      align: 'center', x: 640, y: 36,
    });

    // Nova Pulse meter sits below the life row and blooms when ready.
    const pulse = Math.max(0, Math.min(1, (player.pulseCharge || 0) / 100));
    glowText(ctx, pulse >= 1 ? 'NOVA READY  [X]' : 'NOVA PULSE', {
      font: '9px Orbitron',
      color: pulse >= 1 ? '#ffe27a' : 'rgba(130,255,244,.75)',
      glow: pulse >= 1 ? '#ffe27a' : '#48fff0',
      blur: pulse >= 1 ? 12 : 5, align: 'left', x: 34, y: 70,
    });
    ctx.fillStyle = 'rgba(0, 0, 0, .55)';
    ctx.beginPath(); ctx.roundRect(34, 76, 156, 6, 3); ctx.fill();
    if (pulse > 0) {
      const meter = cachedGradient(ctx, 'novameter', () => {
        const g = ctx.createLinearGradient(34, 0, 190, 0);
        g.addColorStop(0, '#48fff0'); g.addColorStop(1, pulse >= 1 ? '#ffe27a' : '#6e9dff');
        return g;
      });
      ctx.fillStyle = meter;
      ctx.beginPath(); ctx.roundRect(34, 76, 156 * pulse, 6, 3); ctx.fill();
    }

    // Level & Lanterns (Orbitron 15px)
    glowText(ctx, `SECTOR ${levelManager.currentLevel}/10 · ${levelManager.lanternsLit}/10 LIT`, {
      font: '13px Orbitron', color: '#ff007f', glow: '#ff007f', blur: 10,
      align: 'right', x: 1240, y: 36,
    });

    // Sector pip row with soft glow on next lantern pip (pulse via enginePhase)
    if (!this.enginePhase) this.enginePhase = 0;
    this.enginePhase += 0.016;
    const pipsX = 1240 - 150;
    const pipsY = 46;
    for (let i = 0; i < 10; i++) {
      const lit = i < levelManager.lanternsLit;
      const isNext = i === levelManager.lanternsLit;
      ctx.save();
      ctx.fillStyle = lit ? '#ff007f' : isNext ? `rgba(255,0,127,${0.3 + 0.4 * Math.sin(this.enginePhase * 4)})` : 'rgba(255,255,255,0.2)';
      ctx.fillRect(pipsX + i * 14, pipsY, 10, 4);
      ctx.restore();
    }

    // Last-life warning: a subtle breathing warning, not a distracting full-screen flash.
    if (player.lives === 1) {
      const pulse = 0.12 + (Math.sin(Date.now() / 210) + 1) * 0.07;
      ctx.fillStyle = `rgba(255, 20, 70, ${pulse})`;
      ctx.fillRect(0, 0, 1280, 7);
      ctx.fillRect(0, 713, 1280, 7);
      ctx.fillRect(0, 0, 7, 720);
      ctx.fillRect(1273, 0, 7, 720);
    }

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
        const grad = cachedGradient(ctx, 'bossbar', () => {
          const g = ctx.createLinearGradient(bx, by, bx + bw, by);
          g.addColorStop(0, '#9d00ff');
          g.addColorStop(1, '#ff007f');
          return g;
        });
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

      glowText(ctx, `${boss.title || 'THE HOLLOW CROWN'}  ·  PHASE ${boss.phase}`, {
        font: '10px Orbitron', color: 'rgba(255, 255, 255, 0.7)', glow: '#ffffff',
        blur: 5, align: 'center', x: 640, y: 52,
      });

      // Boss name tag under the boss HP bar ("— <NAME> —", Orbitron 600 11px, alpha 0.85, letterspacing 3px)
      glowText(ctx, `— ${boss.title || 'THE HOLLOW CROWN'} —`, {
        font: '600 11px Orbitron', color: 'rgba(255, 255, 255, 0.85)',
        glow: boss.color || '#ff007f', blur: 8, align: 'center', x: 640, y: 82,
      });

      ctx.restore();
    }

    ctx.restore();
  }

  drawCinematicPlate(ctx, cinematic) {
    if (!cinematic) return;
    const t = cinematic.t;
    const dur = cinematic.dur;
    let alpha = 1;
    if (t < 0.25) alpha = t / 0.25;
    else if (t > dur - 0.3) alpha = (dur - t) / 0.3;
    alpha = Math.max(0, Math.min(1, alpha));

    ctx.save();
    ctx.globalAlpha = alpha;

    if (cinematic.type === 'enter') {
      const sectorNum = cinematic.sector || 1;
      const bossName = cinematic.name || 'THE HOLLOW CROWN';
      const color = cinematic.color || '#ff007f';
      const style = cinematic.style !== undefined ? cinematic.style : 9;

      const epithets = [
        'THE BREATHING DARK',
        'THEY SING UNDER THE RUIN',
        'HEART OF BROKEN LIGHT',
        'TWO SEAS, ONE HUNGER',
        'KEEPER OF THE LAST WHITE',
        'THE MACHINE THAT DREAMS OF ASH',
        'EVERY LIGHT A DEBT',
        'THE EXPRESS TO NOWHERE',
        'THE EYE THAT SWALLOWS SUN',
        'THE HOLLOW CROWN'
      ];
      const epithet = epithets[style % epithets.length];

      ctx.font = '600 14px Orbitron';
      try { ctx.letterSpacing = '6px'; } catch(e){}
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.textAlign = 'center';
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillText(`SECTOR ${sectorNum}`, 640, 275);
      try { ctx.letterSpacing = '0px'; } catch(e){}

      ctx.font = '800 44px Orbitron';
      try { ctx.letterSpacing = '10px'; } catch(e){}
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = color;
      ctx.shadowBlur = 26;
      ctx.fillText(bossName.toUpperCase(), 640, 335);
      try { ctx.letterSpacing = '0px'; } catch(e){}

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(440, 365);
      ctx.lineTo(840, 365);
      ctx.stroke();

      ctx.font = '400 13px Orbitron';
      try { ctx.letterSpacing = '4px'; } catch(e){}
      ctx.fillStyle = color;
      ctx.shadowBlur = 10;
      ctx.fillText(epithet, 640, 395);
      try { ctx.letterSpacing = '0px'; } catch(e){}

    } else if (cinematic.type === 'defeat') {
      const sectorNum = cinematic.sector || 1;
      const isFinal = sectorNum >= 10;
      const mainText = isFinal ? 'THE SUN IS REBORN' : `SECTOR ${sectorNum} CLEAR`;
      const subText = isFinal ? 'THE LAST EMBER RETURNS TO THE SKY' : 'CENDRE BREATHES A LITTLE EASIER';
      const color = isFinal ? '#ffe9a8' : '#ffd98a';

      if (t >= 1.15) {
        ctx.font = '800 40px Orbitron';
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 30;
        ctx.textAlign = 'center';
        ctx.fillText(mainText, 640, 310);

        ctx.font = '500 15px Orbitron';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 15;
        ctx.fillText(subText, 640, 360);
      }
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

  drawVictory(ctx, score, victoryT = 0) {
    const eoc = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
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

    // === REBORN SUN: the star reignites above the dead city ===
    const sunCx = 640, sunCy = 250;
    const grow = eoc(victoryT / 2.0);
    const R = 64 + 118 * grow;
    const sunAlpha = 0.15 + 0.8 * Math.min(1, victoryT / 1.4);

    // 7 god rays, slow rotation, deterministic from victoryT
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const angle = victoryT * 0.35 + (i * Math.PI * 2) / 7;
      const rayGrad = ctx.createLinearGradient(sunCx, sunCy, sunCx + Math.cos(angle) * 460, sunCy + Math.sin(angle) * 460);
      rayGrad.addColorStop(0, `rgba(255, 214, 130, ${0.16 * sunAlpha})`);
      rayGrad.addColorStop(1, 'rgba(255, 214, 130, 0)');
      ctx.fillStyle = rayGrad;
      ctx.save();
      ctx.translate(sunCx, sunCy);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-26, 480);
      ctx.lineTo(26, 480);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // Sun disc: white-hot core to molten rim
    ctx.save();
    ctx.globalAlpha = sunAlpha;
    const sunGrad = ctx.createRadialGradient(sunCx, sunCy, R * 0.08, sunCx, sunCy, R);
    sunGrad.addColorStop(0, '#fffbe8');
    sunGrad.addColorStop(0.35, '#ffd24a');
    sunGrad.addColorStop(0.75, '#ff6a00');
    sunGrad.addColorStop(1, 'rgba(255, 68, 0, 0)');
    ctx.shadowColor = '#ffb300';
    ctx.shadowBlur = 60;
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunCx, sunCy, R, 0, Math.PI * 2);
    ctx.fill();
    // Thin horizon-line flare across the disc
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = sunAlpha * 0.8;
    ctx.translate(sunCx, sunCy);
    ctx.scale(1, 0.045);
    const flareGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 2.1);
    flareGrad.addColorStop(0, 'rgba(255,255,255,0.9)');
    flareGrad.addColorStop(0.5, 'rgba(255,190,110,0.35)');
    flareGrad.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = flareGrad;
    ctx.beginPath();
    ctx.arc(0, 0, R * 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Small supratext above the sun
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '600 12px Orbitron';
    try { ctx.letterSpacing = '8px'; } catch (e) {}
    ctx.fillStyle = 'rgba(255, 226, 122, 0.85)';
    ctx.shadowColor = '#ffd24a';
    ctx.shadowBlur = 12;
    ctx.fillText('T H E   C I T Y   R E M E M B E R S', 640, 46);
    try { ctx.letterSpacing = '0px'; } catch (e) {}
    ctx.restore();

    // "THE SUN IS REBORN" types itself in, Monoton, gold
    const title = 'THE SUN IS REBORN';
    const chars = Math.max(0, Math.min(title.length, Math.floor(victoryT * 12)));
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '40px Monoton';
    ctx.fillStyle = '#fff6d8';
    ctx.shadowColor = '#ff9a00';
    ctx.shadowBlur = 30;
    ctx.fillText(title.slice(0, chars), 640, 262);
    ctx.restore();

    // Ten original districts reclaimed.
    ctx.save();
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#00f0ff';
    ctx.font = '16px Orbitron';
    ctx.fillText('ALL 10 DISTRICTS RECLAIMED', 640, 446);

    // FINAL SCORE dim
    ctx.shadowBlur = 5;
    ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
    ctx.font = '12px Orbitron';
    ctx.fillText('FINAL SCORE', 640, 500);

    // Final score white Orbitron 700 34px
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 34px Orbitron';
    ctx.fillText(score, 640, 544);

    // ENTER prompt line restyled Orbitron 15px '#8be9fd'
    ctx.shadowColor = '#8be9fd';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#8be9fd';
    ctx.font = '15px Orbitron';
    ctx.fillText('[ ENTER ]  PLAY AGAIN', 640, 618);
    ctx.restore();
  }

  drawLetterbox(ctx, cinematic) {
    if (!cinematic) return;
    const t = cinematic.t;
    const dur = cinematic.dur;
    const ease = (x) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
    let target;
    if (t < 0.5) target = ease(t / 0.5);
    else if (t > dur - 0.35) target = ease(Math.max(0, (dur - t) / 0.35));
    else target = 1;
    const h = Math.round(70 * target);
    if (h <= 0) return;
    ctx.save();
    ctx.fillStyle = '#050208';
    ctx.fillRect(0, 0, 1280, h);
    ctx.fillRect(0, 720 - h, 1280, h);
    // Hairline edge where the bar meets the scene
    const edge = cinematic.color || '#ffd98a';
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = edge;
    ctx.fillRect(0, h, 1280, 2);
    ctx.fillRect(0, 720 - h - 2, 1280, 2);
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
