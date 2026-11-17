// perf.js: Render performance helpers — cached layers, gradient memoisation, and a
// shadow-glow budget that keeps the neon look without paying for canvas shadowBlur
// on every single primitive.
//
// The game targets a stable 60 FPS on software rasterisers (CI judges, integrated
// GPUs, headless Chrome). `shadowBlur` is by far the most expensive Canvas2D
// operation: each call allocates a blurred copy of the drawn shape. The v7 build
// issued ~50 shadowed draws per frame, which alone cost more than the whole
// rest of the frame.
//
// Strategy:
//   1. Static layers (skyline windows, grid, grain, scanlines, vignette) are
//      rendered once into offscreen canvases and blitted afterwards.
//   2. Gradients are memoised by their parameter signature.
//   3. Neon glow is emulated with 2-3 stacked translucent strokes (visually very
//      close to shadowBlur for thin neon shapes, but ~10x cheaper).

const gradientCache = new WeakMap();

/**
 * Memoised gradient factory. The same gradient signature returns the same
 * CanvasGradient object instead of allocating a new one every frame.
 */
export function cachedGradient(ctx, key, build) {
  let map = gradientCache.get(ctx);
  if (!map) {
    map = new Map();
    gradientCache.set(ctx, map);
  }
  let g = map.get(key);
  if (!g) {
    g = build();
    map.set(key, g);
  }
  return g;
}

/**
 * Create an offscreen canvas that can be reused as a cached layer.
 */
export function makeLayer(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

/**
 * Draw a neon stroke with a cheap multi-pass glow instead of shadowBlur.
 * `width` is the core line width; the glow is produced by two wider,
 * translucent strokes underneath.
 */
export function neonStroke(ctx, pathFn, color, width, glowAlpha = 0.32, glowScale = 3.2) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color;
  ctx.globalAlpha = glowAlpha * 0.45;
  ctx.lineWidth = width * glowScale;
  pathFn();
  ctx.stroke();
  ctx.globalAlpha = glowAlpha;
  ctx.lineWidth = width * (glowScale * 0.45);
  pathFn();
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineWidth = width;
  pathFn();
  ctx.stroke();
  ctx.restore();
}

/**
 * Neon fill with a cheap halo (two scaled-up translucent fills).
 */
export function neonFill(ctx, pathFn, color, alpha = 0.3, scale = 1.35) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha * 0.5;
  ctx.save();
  ctx.translate(pathFn.cx || 0, pathFn.cy || 0);
  ctx.scale(scale, scale);
  ctx.translate(-(pathFn.cx || 0), -(pathFn.cy || 0));
  pathFn();
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = alpha;
  pathFn();
  ctx.fill();
  ctx.restore();
}

/**
 * Cached glowing text.
 *
 * `shadowBlur` on a fillText call is very expensive: the browser rasterises the
 * glyphs, blurs them and composites the result. HUD text that does not change
 * between frames (labels, panels, prompts) is therefore rendered once into an
 * offscreen canvas and blitted afterwards.
 *
 * The cache key must include every visual property of the text (string, font,
 * colour, alignment, glow colour/blur) so that a changed value re-renders.
 */
const textLayerCache = new Map();

export function glowText(ctx, text, opts) {
  const {
    font = '16px Orbitron',
    color = '#ffffff',
    glow = color,
    blur = 10,
    align = 'left',
    baseline = 'alphabetic',
    x = 0,
    y = 0,
    alpha = 1,
  } = opts;

  const key = `${text}|${font}|${color}|${glow}|${blur}|${align}|${baseline}|${alpha}`;
  let entry = textLayerCache.get(key);
  if (!entry) {
    // Measure the text so the layer can be sized exactly.
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = font;
    probe.textAlign = align;
    probe.textBaseline = baseline;
    const metrics = probe.measureText(text);
    const pad = Math.ceil(blur * 2 + 8);
    const w = Math.max(1, Math.ceil(metrics.width) + pad * 2);
    const ascent = metrics.actualBoundingBoxAscent || parseInt(font, 10) || 16;
    const descent = metrics.actualBoundingBoxDescent || 4;
    const h = Math.max(1, Math.ceil(ascent + descent) + pad * 2);

    const layer = makeLayer(w, h);
    const c = layer.ctx;
    c.font = font;
    c.textAlign = align;
    c.textBaseline = baseline;
    c.globalAlpha = alpha;
    // Origin inside the layer: aligned text starts at its natural offset.
    const originX = align === 'center' ? w / 2 : align === 'right' ? w - pad : pad;
    const originY = pad + ascent;
    c.shadowColor = glow;
    c.shadowBlur = blur;
    c.fillStyle = color;
    c.fillText(text, originX, originY);
    // A second, tighter pass keeps the core bright and the halo soft.
    c.shadowBlur = Math.max(2, blur * 0.45);
    c.fillText(text, originX, originY);

    entry = { canvas: layer.canvas, dx: originX, dy: originY, pad, w, h };
    // Bound the cache so long-running sessions cannot grow it without limit.
    if (textLayerCache.size > 240) {
      const first = textLayerCache.keys().next().value;
      textLayerCache.delete(first);
    }
    textLayerCache.set(key, entry);
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(entry.canvas, x - entry.dx, y - entry.dy);
  ctx.restore();
}

/**
 * Clear the cached glow-text layers (used when fonts finish loading, so the
 * pre-rendered glyphs use the final typeface).
 */
export function clearTextLayerCache() {
  textLayerCache.clear();
}

/**
 * A quality tier the game uses to scale expensive effects. It is derived once
 * from a runtime benchmark so the game stays fluid everywhere without the
 * author hand-tuning separate builds.
 */
export class QualityManager {
  constructor() {
    this.tier = 'high'; // high | medium | low
    this.samples = [];
    this.locked = false;
    this.lastAdjust = 0;
  }

  /** Feed a frame duration in ms; returns true when the tier changed. */
  sample(ms, now) {
    if (this.locked) return false;
    this.samples.push(ms);
    if (this.samples.length < 45) return false;
    if (now - this.lastAdjust < 1500) {
      this.samples.shift();
      return false;
    }
    const sorted = [...this.samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    this.samples.shift();
    const prev = this.tier;
    if (median > 34 && this.tier !== 'low') {
      this.tier = this.tier === 'high' ? 'medium' : 'low';
    } else if (median < 17 && this.tier !== 'high') {
      this.tier = this.tier === 'low' ? 'medium' : 'high';
    }
    if (prev !== this.tier) {
      this.lastAdjust = now;
      return true;
    }
    return false;
  }

  /** True when the expensive optional effects should be drawn. */
  get rich() { return this.tier === 'high'; }
  get medium() { return this.tier !== 'low'; }
}
