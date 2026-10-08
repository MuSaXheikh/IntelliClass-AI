import { describe, expect, it } from "vitest";
import { eyeAspectRatio, isEyeClosed, landmarkConfidence, meanEar } from "@/lib/vision/ear";
import { EAR_CLOSED_THRESHOLD } from "@/lib/config";
import { CLOSED_EYES, OPEN_EYES } from "./fixtures";

describe("eyeAspectRatio", () => {
  it("is ~0.4 for the open-eye fixture and ~0.02 when closed", () => {
    expect(meanEar(OPEN_EYES)).toBeCloseTo(0.4, 5);
    expect(meanEar(CLOSED_EYES)).toBeCloseTo(0.02, 5);
  });

  it("classifies against the configured threshold", () => {
    expect(isEyeClosed(meanEar(OPEN_EYES) as number, EAR_CLOSED_THRESHOLD)).toBe(false);
    expect(isEyeClosed(meanEar(CLOSED_EYES) as number, EAR_CLOSED_THRESHOLD)).toBe(true);
  });

  it("returns null for an incomplete landmark set", () => {
    expect(meanEar(OPEN_EYES.slice(0, 100))).toBeNull();
  });

  it("corrects for frame aspect ratio", () => {
    // Widening x by 4:3 lowers the vertical/horizontal ratio proportionally.
    const square = meanEar(OPEN_EYES, 1) as number;
    const wide = meanEar(OPEN_EYES, 4 / 3) as number;
    expect(wide).toBeCloseTo(square * 0.75, 5);
  });

  it("rejects eyes with the wrong number of points and handles a degenerate eye", () => {
    expect(() => eyeAspectRatio([{ x: 0, y: 0 }])).toThrow();
    const point = { x: 0.1, y: 0.1 };
    expect(eyeAspectRatio([point, point, point, point, point, point])).toBe(0);
  });
});

describe("landmarkConfidence", () => {
  it("is 0 without a face, full for a normal-size face, lower without a pose matrix", () => {
    expect(landmarkConfidence([], true)).toBe(0);
    expect(landmarkConfidence(OPEN_EYES, true)).toBe(1);
    expect(landmarkConfidence(OPEN_EYES, false)).toBeCloseTo(0.8, 5);
  });
});
