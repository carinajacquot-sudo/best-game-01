// assets.js: loads the modelled-alien sprite sheets produced from the Kaggle
// Meshy 3D datasets and exposes them to the draw paths as cheap blits.
//
// Every sheet is a horizontal strip of N equal square frames (one bake angle
// per frame). Frames are pre-scaled into cached canvases so a draw call is a
// single drawImage — this is what keeps the neon aliens at 60 FPS where the
// old per-frame vector path could not.
//
// If a sheet fails to load (offline harness, missing asset) the entity falls
// back to a procedural silhouette, so the game never renders a blank frame.

const FRAMES = {};

/** Frame cache keyed by `${name}:${bucket}` where bucket is a size step. */
const SCALED = new Map();

/** Size buckets: a sprite is re-rasterised only when it crosses one of these. */
const BUCKETS = [28, 40, 56, 76, 100, 132, 172, 220, 280, 360, 460];

export const SPRITES = {
  // name -> { file, frames, flip, accent }
  grunt: { file: 'alien_grunt', frames: 4, accent: '#4ff0d8' },
  drone: { file: 'alien_drone', frames: 4, accent: '#e061ff' },
  lancer: { file: 'alien_lancer', frames: 4, accent: '#ffd257' },
  tank: { file: 'alien_tank', frames: 4, accent: '#7dff5c' },
  stalker: { file: 'alien_stalker', frames: 4, accent: '#ff7a4f' },
  swarm: { file: 'alien_swarm', frames: 4, accent: '#a45cff' },
  mine: { file: 'alien_mine', frames: 4, accent: '#ffc45a' },
  meteor: { file: 'meteor_a', frames: 4, accent: '#ff9a4a' },
  boss0: { file: 'boss_0', frames: 6, accent: '#76f4ff' },
  boss1: { file: 'boss_1', frames: 6, accent: '#ee77ff' },
  boss2: { file: 'boss_2', frames: 6, accent: '#b7ff72' },
  boss3: { file: 'boss_3', frames: 6, accent: '#ff955d' },
  boss4: { file: 'boss_4', frames: 6, accent: '#ffe27a' },
  boss5: { file: 'boss_5', frames: 6, accent: '#8f9dff' },
  boss6: { file: 'boss_6', frames: 6, accent: '#ff6ac1' },
  boss7: { file: 'boss_7', frames: 6, accent: '#6cf0d2' },
  boss8: { file: 'boss_8', frames: 6, accent: '#9f7bff' },
  boss9: { file: 'boss_9', frames: 6, accent: '#fff0c2' }
};

let loadPromise = null;
let ready = false;

/** Kick off (idempotently) loading every sprite sheet. */
export function loadSprites(base = 'assets/sprites/') {
  if (loadPromise) return loadPromise;
  const jobs = Object.entries(SPRITES).map(([key, spec]) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      FRAMES[key] = { img, frames: spec.frames, w: img.width, h: img.height };
      resolve(true);
    };
    img.onerror = () => resolve(false);
    img.src = `${base}${spec.file}.png`;
  }));
  loadPromise = Promise.all(jobs).then((oks) => {
    ready = oks.some(Boolean);
    return oks.filter(Boolean).length;
  });
  return loadPromise;
}

export function spritesReady() {
  return ready;
}

export function hasSprite(name) {
  return !!FRAMES[name];
}

function bucketFor(px) {
  for (const b of BUCKETS) if (px <= b) return b;
  return BUCKETS[BUCKETS.length - 1];
}

/**
 * Pre-scale one frame of a sheet into a cache canvas.
 * Returns null when the sprite is unavailable so callers can fall back.
 */
function scaledFrame(name, frame, px) {
  const src = FRAMES[name];
  if (!src) return null;
  const bucket = bucketFor(px);
  const key = `${name}:${frame}:${bucket}`;
  let cache = SCALED.get(key);
  if (!cache) {
    cache = document.createElement('canvas');
    cache.width = bucket;
    cache.height = bucket;
    const c = cache.getContext('2d');
    const fw = src.w / src.frames;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(src.img, frame * fw, 0, fw, src.h, 0, 0, bucket, bucket);
    SCALED.set(key, cache);
    if (SCALED.size > 420) {
      // keep the cache bounded: drop the oldest entries
      const first = SCALED.keys().next().value;
      SCALED.delete(first);
    }
  }
  return cache;
}

/**
 * Blit a sprite frame centred on (x, y) with the given diameter.
 * @returns {boolean} false when no sprite exists (caller draws a fallback)
 */
export function drawSprite(ctx, name, frame, x, y, diameter, opts = {}) {
  const src = FRAMES[name];
  if (!src) return false;
  const bucket = bucketFor(diameter);
  const canvas = scaledFrame(name, ((frame % src.frames) + src.frames) % src.frames, bucket);
  if (!canvas) return false;
  const s = diameter / bucket;
  const alpha = opts.alpha === undefined ? 1 : opts.alpha;
  const prevAlpha = ctx.globalAlpha;
  const prevOp = ctx.globalCompositeOperation;

  if (opts.glow) {
    // Cheap additive halo: the same frame drawn scaled up and dimmed.
    const gs = 1 + (opts.glowScale === undefined ? 0.22 : opts.glowScale);
    const gd = diameter * gs;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * (opts.glowAlpha === undefined ? 0.34 : opts.glowAlpha);
    ctx.drawImage(canvas, x - gd / 2, y - gd / 2, gd, gd);
    ctx.restore();
  }

  ctx.globalAlpha = alpha;
  if (opts.tint) {
    // Tinted pass: draw the frame, then wash colour over its own alpha.
    ctx.drawImage(canvas, x - diameter / 2, y - diameter / 2, diameter, diameter);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = alpha * 0.55;
    ctx.fillStyle = opts.tint;
    ctx.beginPath();
    ctx.rect(x - diameter / 2, y - diameter / 2, diameter, diameter);
    ctx.fill();
    ctx.restore();
  } else {
    ctx.drawImage(canvas, x - diameter / 2, y - diameter / 2, diameter, diameter);
  }
  ctx.globalAlpha = prevAlpha;
  ctx.globalCompositeOperation = prevOp;
  return true;
}

/** Animated frame index from a time value, honouring an optional speed. */
export function frameFromTime(time, frames = 4, speed = 2.4) {
  return Math.floor(time * speed) % frames;
}
