// Seeded random numbers for Neon Harbor — Meridian Bay.
// One tiny deterministic generator (mulberry32) drives the whole city:
// the same seed always rebuilds the same streets, buildings, traffic
// and pedestrians, so a replay or a screenshot scene is repeatable.
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Float in [min, max).
export function rngRange(rng, min, max) {
  return min + rng() * (max - min);
}

// Integer in [min, max] inclusive.
export function rngInt(rng, min, max) {
  return Math.floor(min + rng() * (max - min + 1));
}

// One element of an array, uniformly.
export function rngPick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

// True with probability p (0..1).
export function rngChance(rng, p) {
  return rng() < p;
}

// Hash a string into a uint32 seed, for named seeds in the URL.
export function stringSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Shuffle a copy of an array in place-order using the seeded rng.
export function rngShuffle(rng, items) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
