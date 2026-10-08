import { FACE_LANDMARK_COUNT, LEFT_EYE, RIGHT_EYE, pick, type Point } from "@/lib/vision/landmarks";

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Eye Aspect Ratio (Soukupová & Čech, 2016):
 * EAR = (|p2 - p6| + |p3 - p5|) / (2 |p1 - p4|). Open eyes ≈ 0.25–0.35, closed ≈ < 0.2.
 */
export function eyeAspectRatio(eye: readonly Point[]): number {
  if (eye.length !== 6) throw new Error("eyeAspectRatio expects exactly 6 points");
  const horizontal = distance(eye[0], eye[3]);
  if (horizontal === 0) return 0;
  const vertical = distance(eye[1], eye[5]) + distance(eye[2], eye[4]);
  return vertical / (2 * horizontal);
}

/** Mean EAR of both eyes, or null when the landmark set is incomplete. */
export function meanEar(landmarks: readonly Point[], aspect = 1): number | null {
  if (landmarks.length < FACE_LANDMARK_COUNT) return null;
  const left = eyeAspectRatio(pick(landmarks, LEFT_EYE, aspect));
  const right = eyeAspectRatio(pick(landmarks, RIGHT_EYE, aspect));
  return (left + right) / 2;
}

export function isEyeClosed(ear: number, threshold: number): boolean {
  return ear < threshold;
}

/**
 * Heuristic landmark confidence in [0, 1]. The web Face Landmarker gives no per-landmark score,
 * so we use apparent eye width (far or tiny faces track badly) and whether a pose matrix exists.
 */
export function landmarkConfidence(
  landmarks: readonly Point[],
  hasPoseMatrix: boolean,
  aspect = 1,
): number {
  if (landmarks.length < FACE_LANDMARK_COUNT) return 0;
  const left = pick(landmarks, LEFT_EYE, aspect);
  const right = pick(landmarks, RIGHT_EYE, aspect);
  const eyeWidth = (distance(left[0], left[3]) + distance(right[0], right[3])) / 2;
  const sizeScore = Math.min(1, eyeWidth / 0.05);
  return Math.max(0, Math.min(1, sizeScore * (hasPoseMatrix ? 1 : 0.8)));
}
