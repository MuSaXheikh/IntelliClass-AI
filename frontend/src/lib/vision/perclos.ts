/** Time-windowed eye-closure statistics. Pure functions over (timestamp, closed) samples. */

export interface ClosureSample {
  /** Milliseconds (performance.now() domain). */
  t: number;
  closed: boolean;
}

export function pruneOlderThan(samples: readonly ClosureSample[], cutoff: number): ClosureSample[] {
  return samples.filter((s) => s.t >= cutoff);
}

/** PERCLOS: fraction of frames with closed eyes inside the window; null when no samples. */
export function perclos(
  samples: readonly ClosureSample[],
  windowMs: number,
  now: number,
): number | null {
  const recent = samples.filter((s) => s.t >= now - windowMs);
  if (recent.length === 0) return null;
  const closed = recent.reduce((n, s) => n + (s.closed ? 1 : 0), 0);
  return closed / recent.length;
}

/**
 * A blink is a run of consecutive closed frames of length 1..maxClosedFrames.
 * Longer runs are sustained closures and are deliberately not counted.
 */
export function countBlinks(samples: readonly ClosureSample[], maxClosedFrames: number): number {
  let blinks = 0;
  let run = 0;
  for (const sample of samples) {
    if (sample.closed) {
      run += 1;
      continue;
    }
    if (run > 0 && run <= maxClosedFrames) blinks += 1;
    run = 0;
  }
  if (run > 0 && run <= maxClosedFrames) blinks += 1;
  return blinks;
}

/** Blinks per minute over the window, scaled when less than a full window of data exists. */
export function blinksPerMinute(
  samples: readonly ClosureSample[],
  windowMs: number,
  now: number,
  maxClosedFrames: number,
): number | null {
  const recent = samples.filter((s) => s.t >= now - windowMs);
  if (recent.length < 2) return null;
  const spanMs = Math.max(recent[recent.length - 1].t - recent[0].t, 1000);
  const blinks = countBlinks(recent, maxClosedFrames);
  return (blinks * 60_000) / spanMs;
}
