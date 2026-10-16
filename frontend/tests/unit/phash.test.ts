import { describe, expect, it } from "vitest";
import { HASH_SIZE, hamming, luminance, phash } from "@/lib/screen/phash";

function frame(fill: (x: number, y: number) => number): Float64Array {
  const gray = new Float64Array(HASH_SIZE * HASH_SIZE);
  for (let y = 0; y < HASH_SIZE; y += 1)
    for (let x = 0; x < HASH_SIZE; x += 1) gray[y * HASH_SIZE + x] = fill(x, y);
  return gray;
}

describe("phash", () => {
  it("is identical for identical frames and tolerant of small noise", () => {
    const base = frame((x, y) => (x < 16 ? 40 : 200) + (y % 4) * 5);
    const noisy = frame((x, y) => (x < 16 ? 40 : 200) + (y % 4) * 5 + ((x * 7 + y * 3) % 5));
    expect(hamming(phash(base), phash(base))).toBe(0);
    expect(hamming(phash(base), phash(noisy))).toBeLessThanOrEqual(6);
  });

  it("differs a lot for a different picture", () => {
    const left = frame((x) => (x < 16 ? 30 : 220));
    const stripes = frame((x, y) => ((x + y) % 8 < 4 ? 30 : 220));
    expect(hamming(phash(left), phash(stripes))).toBeGreaterThan(16);
  });

  it("reads luminance from RGBA", () => {
    const rgba = new Uint8ClampedArray(HASH_SIZE * HASH_SIZE * 4);
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = 255;
      rgba[i + 3] = 255;
    }
    const gray = luminance(rgba);
    expect(gray.length).toBe(HASH_SIZE * HASH_SIZE);
    expect(gray[0]).toBeCloseTo(76.2, 0);
  });
});
