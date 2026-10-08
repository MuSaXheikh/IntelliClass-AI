import { describe, expect, it } from "vitest";
import { headPoseFromMatrix, rotationMatrix } from "@/lib/vision/headPose";
import { gazeFromLandmarks } from "@/lib/vision/gaze";
import {
  IRIS_LANDMARK_COUNT,
  LEFT_EYE,
  LEFT_EYE_BOTTOM,
  LEFT_EYE_TOP,
  LEFT_IRIS,
  RIGHT_EYE,
  RIGHT_EYE_BOTTOM,
  RIGHT_EYE_TOP,
  RIGHT_IRIS,
} from "@/lib/vision/landmarks";
import { faceWithEyes } from "./fixtures";

describe("headPoseFromMatrix", () => {
  it("recovers yaw, pitch and roll from pure rotations", () => {
    expect(headPoseFromMatrix(rotationMatrix("y", 30))?.yaw).toBeCloseTo(30, 5);
    expect(headPoseFromMatrix(rotationMatrix("y", 30))?.pitch).toBeCloseTo(0, 5);
    expect(headPoseFromMatrix(rotationMatrix("x", -20))?.pitch).toBeCloseTo(-20, 5);
    expect(headPoseFromMatrix(rotationMatrix("z", 15))?.roll).toBeCloseTo(15, 5);
  });

  it("returns null for a malformed matrix", () => {
    expect(headPoseFromMatrix([1, 2, 3])).toBeNull();
  });
});

describe("gazeFromLandmarks", () => {
  it("is centred when the iris sits mid-eye and null without iris points", () => {
    const face = faceWithEyes(0.02, IRIS_LANDMARK_COUNT);
    const centre = (indices: readonly number[], top: number, bottom: number) => ({
      x: (face[indices[0]].x + face[indices[3]].x) / 2,
      y: (face[top].y + face[bottom].y) / 2,
      z: 0,
    });
    face[LEFT_EYE_TOP] = { x: 0.25, y: 0.48, z: 0 };
    face[LEFT_EYE_BOTTOM] = { x: 0.25, y: 0.52, z: 0 };
    face[RIGHT_EYE_TOP] = { x: 0.65, y: 0.48, z: 0 };
    face[RIGHT_EYE_BOTTOM] = { x: 0.65, y: 0.52, z: 0 };
    face[LEFT_IRIS[0]] = centre(LEFT_EYE, LEFT_EYE_TOP, LEFT_EYE_BOTTOM);
    face[RIGHT_IRIS[0]] = centre(RIGHT_EYE, RIGHT_EYE_TOP, RIGHT_EYE_BOTTOM);
    const gaze = gazeFromLandmarks(face);
    expect(gaze?.x).toBeCloseTo(0, 5);
    expect(gaze?.y).toBeCloseTo(0, 5);
    expect(gazeFromLandmarks(faceWithEyes(0.02))).toBeNull();
  });
});
