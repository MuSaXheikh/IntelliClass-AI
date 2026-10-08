import { FACE_LANDMARK_COUNT, LEFT_EYE, RIGHT_EYE, type Point } from "@/lib/vision/landmarks";

/** Builds a full landmark array with both eyes drawn at a given openness (vertical half-gap). */
export function faceWithEyes(halfGap: number, count = FACE_LANDMARK_COUNT): Point[] {
  const landmarks: Point[] = Array.from({ length: count }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const draw = (indices: readonly number[], originX: number) => {
    const cy = 0.5;
    const pts: Point[] = [
      { x: originX, y: cy }, // p1 outer corner
      { x: originX + 0.03, y: cy - halfGap }, // p2 upper
      { x: originX + 0.07, y: cy - halfGap }, // p3 upper
      { x: originX + 0.1, y: cy }, // p4 inner corner
      { x: originX + 0.07, y: cy + halfGap }, // p5 lower
      { x: originX + 0.03, y: cy + halfGap }, // p6 lower
    ];
    indices.forEach((index, i) => {
      landmarks[index] = pts[i];
    });
  };
  draw(LEFT_EYE, 0.2);
  draw(RIGHT_EYE, 0.6);
  return landmarks;
}

export const OPEN_EYES = faceWithEyes(0.02); // EAR = (0.04 + 0.04) / (2 * 0.1) = 0.4
export const CLOSED_EYES = faceWithEyes(0.001); // EAR = 0.004 / 0.2 = 0.02
