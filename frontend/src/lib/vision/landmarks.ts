/** MediaPipe Face Landmarker index sets used by the on-device pipeline. */

export interface Point {
  x: number;
  y: number;
  z?: number;
}

/** 6-point eye contours in EAR order p1..p6 (outer corner, upper, upper, inner corner, lower, lower). */
export const LEFT_EYE: readonly number[] = [33, 160, 158, 133, 153, 144];
export const RIGHT_EYE: readonly number[] = [362, 385, 387, 263, 373, 380];

/** Iris landmarks (present only when the model outputs 478 points). Index 0 is the centre. */
export const LEFT_IRIS: readonly number[] = [468, 469, 470, 471, 472];
export const RIGHT_IRIS: readonly number[] = [473, 474, 475, 476, 477];

export const LEFT_EYE_TOP = 159;
export const LEFT_EYE_BOTTOM = 145;
export const RIGHT_EYE_TOP = 386;
export const RIGHT_EYE_BOTTOM = 374;

export const FACE_LANDMARK_COUNT = 468;
export const IRIS_LANDMARK_COUNT = 478;

/**
 * Normalised landmarks are x/width and y/height, so a non-square frame distorts distances.
 * Multiplying x by the aspect ratio (width / height) restores proportional geometry.
 */
export function toProportional(point: Point, aspect: number): Point {
  return { x: point.x * aspect, y: point.y, z: point.z };
}

export function pick(landmarks: readonly Point[], indices: readonly number[], aspect = 1): Point[] {
  return indices.map((i) => toProportional(landmarks[i], aspect));
}
