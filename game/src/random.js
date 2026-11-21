// Seeded random for the v6 rebuild: a small splitmix-style generator.
// The same seed builds the same city, so staged screenshots repeat exactly.
// This is a fresh implementation written for the rebuild, not the v5 one.
export function createRandom(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return function random() {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
    z = (z ^ (z >>> 15)) >>> 0;
    return z / 4294967296;
  };
}

export function pick(random, arr) {
  return arr[Math.floor(random() * arr.length)];
}

export function shuffled(random, arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function pickN(random, arr, n) {
  return shuffled(random, arr).slice(0, Math.min(n, arr.length));
}

export function range(random, min, max) {
  return min + random() * (max - min);
}

export function chance(random, p) {
  return random() < p;
}

export function intIn(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

export function bell(random) {
  return (random() + random() + random() - 1.5) / 1.5;
}
