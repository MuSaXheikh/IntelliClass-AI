import { describe, expect, it } from "vitest";
import {
  blinksPerMinute,
  countBlinks,
  perclos,
  pruneOlderThan,
  type ClosureSample,
} from "@/lib/vision/perclos";

const sample = (t: number, closed: boolean): ClosureSample => ({ t, closed });

describe("perclos", () => {
  it("is the closed fraction inside the window and null without samples", () => {
    const samples = [sample(0, false), sample(100, true), sample(200, true), sample(300, false)];
    expect(perclos(samples, 1000, 300)).toBeCloseTo(0.5);
    expect(perclos(samples, 150, 300)).toBeCloseTo(0.5); // only t=200 (closed) and t=300 (open)
    expect(perclos([], 1000, 0)).toBeNull();
  });

  it("ignores samples older than the window", () => {
    const samples = [sample(0, true), sample(5000, false)];
    expect(perclos(samples, 1000, 5000)).toBe(0);
  });
});

describe("countBlinks", () => {
  it("counts short closed runs only", () => {
    const pattern = [false, true, false, true, true, false, true, true, true, true, false];
    const samples = pattern.map((closed, i) => sample(i * 100, closed));
    // runs: 1 (blink), 2 (blink), 4 (closure, not a blink)
    expect(countBlinks(samples, 3)).toBe(2);
  });

  it("counts a run that ends at the last sample", () => {
    expect(countBlinks([sample(0, false), sample(1, true)], 3)).toBe(1);
  });
});

describe("blinksPerMinute", () => {
  it("scales blinks to a per-minute rate over the observed span", () => {
    const samples: ClosureSample[] = [];
    for (let i = 0; i <= 300; i += 1) samples.push(sample(i * 100, i % 50 === 25)); // 30 s, 6 blinks
    expect(blinksPerMinute(samples, 60_000, 30_000, 3)).toBeCloseTo(12, 5);
  });

  it("returns null with fewer than two samples", () => {
    expect(blinksPerMinute([sample(0, true)], 60_000, 0, 3)).toBeNull();
  });
});

describe("pruneOlderThan", () => {
  it("drops old samples", () => {
    expect(pruneOlderThan([sample(0, true), sample(10, true)], 5)).toEqual([sample(10, true)]);
  });
});
