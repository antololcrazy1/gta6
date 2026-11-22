// Seeded random helpers for Vice Coast. Every run of the game uses a fixed
// seed so the city, the traffic and the staged screenshots are identical
// from one load to the next. A tiny mulberry32 core plus the small helpers
// the rest of the game needs: integers, ranges, picks and coin flips.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A small string hash, so a name can seed its own deterministic stream.
export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// A full helper object around one mulberry32 stream.
export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // Float in [0, 1).
    f() {
      return next();
    },
    // Float in [a, b).
    range(a, b) {
      return a + next() * (b - a);
    },
    // Integer in [a, b] inclusive.
    int(a, b) {
      return a + Math.floor(next() * (b - a + 1));
    },
    // One element of an array, uniformly.
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    // True with probability p.
    chance(p) {
      return next() < p;
    },
    // A shuffled copy of an array (Fisher-Yates).
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
  };
}
