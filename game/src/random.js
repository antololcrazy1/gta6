// Seeded random (mulberry32): the same seed gives the same city, so staged
// screenshots are repeatable frame for frame.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Pick one element of an array on the seeded stream.
export function pick(random, arr) { return arr[Math.floor(random() * arr.length)]; }
// Pick n distinct elements (a shuffled draw, no repeats) on the seeded stream.
export function pickN(random, arr, n) {
  const copy = arr.slice();
  shuffle(random, copy);
  return copy.slice(0, Math.min(n, copy.length));
}
export function range(random, min, max) { return min + random() * (max - min); }
// True with probability p on the seeded stream.
export function chance(random, p) { return random() < p; }
// Fisher–Yates shuffle, in place, using the same seeded stream so a shuffle
// is repeatable for a given seed. Returns the array for chaining.
export function shuffle(random, arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}
