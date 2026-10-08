/** Head pose (degrees) from the MediaPipe facial transformation matrix. */

export interface HeadPose {
  yaw: number;
  pitch: number;
  roll: number;
}

export type MatrixLayout = "column-major" | "row-major";

const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

function element(data: readonly number[], row: number, col: number, layout: MatrixLayout): number {
  return layout === "column-major" ? data[col * 4 + row] : data[row * 4 + col];
}

/**
 * Decomposes the 3×3 rotation part of a 4×4 transform. Angles are independent for pure
 * rotations and approximate for combined ones, which is enough for "looking away" thresholds.
 * MediaPipe packs the matrix column-major (translation at indices 12–14).
 */
export function headPoseFromMatrix(
  data: readonly number[],
  layout: MatrixLayout = "column-major",
): HeadPose | null {
  if (data.length !== 16) return null;
  const r = (row: number, col: number) => element(data, row, col, layout);
  const yaw = Math.atan2(r(0, 2), r(2, 2));
  const pitch = Math.atan2(-r(1, 2), r(1, 1));
  const roll = Math.atan2(r(1, 0), r(0, 0));
  if ([yaw, pitch, roll].some((v) => Number.isNaN(v))) return null;
  return { yaw: toDegrees(yaw), pitch: toDegrees(pitch), roll: toDegrees(roll) };
}

/** Test helper: build a column-major 4×4 for a rotation about Y (yaw) or X (pitch), in degrees. */
export function rotationMatrix(axis: "x" | "y" | "z", degrees: number): number[] {
  const a = (degrees * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  // row-major 3×3
  const rows: number[][] =
    axis === "x"
      ? [
          [1, 0, 0],
          [0, c, -s],
          [0, s, c],
        ]
      : axis === "y"
        ? [
            [c, 0, s],
            [0, 1, 0],
            [-s, 0, c],
          ]
        : [
            [c, -s, 0],
            [s, c, 0],
            [0, 0, 1],
          ];
  const out = new Array<number>(16).fill(0);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) out[col * 4 + row] = rows[row][col];
  }
  out[15] = 1;
  return out;
}
