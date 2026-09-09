/**
 * Small deterministic PRNG. Seeding by route + date keeps the demo catalogue
 * stable: the same search always returns the same offers and prices, so
 * navigating away and back never reshuffles a result list.
 */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(...parts: (string | number)[]) {
  const rand = mulberry32(hashSeed(...parts));
  return {
    next: rand,
    int: (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min,
    float: (min: number, max: number) => rand() * (max - min) + min,
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)],
    chance: (p: number) => rand() < p,
    /** Non-mutating shuffle. */
    shuffle: <T,>(arr: readonly T[]): T[] => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}
