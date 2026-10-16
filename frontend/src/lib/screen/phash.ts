/**
 * Perceptual hash of a 32×32 greyscale frame (DCT-based pHash, 64 bits). Two frames of the same
 * screen hash alike even with small changes (cursor, clock); a different page differs in many bits.
 * Runs on the device only; a hash cannot be turned back into a picture.
 */

export const HASH_SIZE = 32;
const LOW = 8;

const COS: number[][] = Array.from({ length: HASH_SIZE }, (_, u) =>
  Array.from({ length: HASH_SIZE }, (_, x) =>
    Math.cos(((2 * x + 1) * u * Math.PI) / (2 * HASH_SIZE)),
  ),
);

/** Luminance of a 32×32 RGBA buffer (as returned by canvas getImageData). */
export function luminance(rgba: Uint8ClampedArray): Float64Array {
  const out = new Float64Array(HASH_SIZE * HASH_SIZE);
  for (let i = 0; i < out.length; i += 1) {
    const o = i * 4;
    out[i] = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
  }
  return out;
}

/** 64-bit pHash as 64 bits (0/1): low-frequency DCT terms above their mean become 1s. */
export type Hash = Uint8Array;

export function phash(gray: Float64Array): Hash {
  const rows: number[][] = [];
  for (let y = 0; y < HASH_SIZE; y += 1) {
    const row: number[] = [];
    for (let u = 0; u < LOW; u += 1) {
      let sum = 0;
      for (let x = 0; x < HASH_SIZE; x += 1) sum += gray[y * HASH_SIZE + x] * COS[u][x];
      row.push(sum);
    }
    rows.push(row);
  }
  const coeffs: number[] = [];
  for (let v = 0; v < LOW; v += 1) {
    for (let u = 0; u < LOW; u += 1) {
      let sum = 0;
      for (let y = 0; y < HASH_SIZE; y += 1) sum += rows[y][u] * COS[v][y];
      coeffs.push(sum);
    }
  }
  const mean = coeffs.slice(1).reduce((a, b) => a + b, 0) / (coeffs.length - 1);
  const bits = new Uint8Array(coeffs.length);
  coeffs.forEach((value, i) => {
    bits[i] = value > mean ? 1 : 0;
  });
  return bits;
}

/** Number of differing bits between two hashes (0 = same picture, 64 = opposite). */
export function hamming(a: Hash, b: Hash): number {
  let count = 0;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) count += 1;
  return count;
}
