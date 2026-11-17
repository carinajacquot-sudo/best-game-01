// util.js: Seeded PRNG (mulberry32), math utilities, bounding box/circle collisions, and vector helpers.

export class RNG {
  constructor(seed = 12345) {
    this.s = seed >>> 0;
  }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min, max) {
    return min + this.next() * (max - min);
  }
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
  choice(arr) {
    if (arr.length === 0) return undefined;
    return arr[this.int(0, arr.length - 1)];
  }
}

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function distSq(x1, y1, x2, y2) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
}

export function circleCollide(c1, c2) {
  const rSum = c1.radius + c2.radius;
  return distSq(c1.x, c1.y, c2.x, c2.y) <= rSum * rSum;
}

export function aabbCollide(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
