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
  type Point,
} from "@/lib/vision/landmarks";

export interface Gaze {
  /** −0.5 (one corner) … 0 (centred) … +0.5 (other corner). */
  x: number;
  /** −0.5 (upper lid) … 0 … +0.5 (lower lid). */
  y: number;
}

function ratio(value: number, a: number, b: number): number {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (hi - lo === 0) return 0;
  return Math.max(-0.5, Math.min(0.5, (value - lo) / (hi - lo) - 0.5));
}

function eyeGaze(
  landmarks: readonly Point[],
  iris: number,
  corners: readonly number[],
  top: number,
  bottom: number,
): Gaze {
  const centre = landmarks[iris];
  const outer = landmarks[corners[0]];
  const inner = landmarks[corners[3]];
  return {
    x: ratio(centre.x, outer.x, inner.x),
    y: ratio(centre.y, landmarks[top].y, landmarks[bottom].y),
  };
}

/**
 * Coarse gaze from iris position relative to the eye opening. This is a rough proxy;
 * head pose is the primary "looking away" signal (see docs/memory.md D14 discussion).
 */
export function gazeFromLandmarks(landmarks: readonly Point[]): Gaze | null {
  if (landmarks.length < IRIS_LANDMARK_COUNT) return null;
  const left = eyeGaze(landmarks, LEFT_IRIS[0], LEFT_EYE, LEFT_EYE_TOP, LEFT_EYE_BOTTOM);
  const right = eyeGaze(landmarks, RIGHT_IRIS[0], RIGHT_EYE, RIGHT_EYE_TOP, RIGHT_EYE_BOTTOM);
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
}
