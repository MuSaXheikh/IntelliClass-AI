import { blinksPerMinute, perclos, pruneOlderThan, type ClosureSample } from "@/lib/vision/perclos";

/** Per-frame numbers produced inside the worker. Never contains pixels. */
export interface FrameFeatures {
  t: number;
  facePresent: boolean;
  multiFace: boolean;
  ear: number | null;
  closed: boolean | null;
  yaw: number | null;
  pitch: number | null;
  gazeX: number | null;
  gazeY: number | null;
  conf: number | null;
}

/** One-second aggregate; field names match the wire packet (docs/memory.md §7). */
export interface AggregatedFeatures {
  ear: number | null;
  blink_rate: number | null;
  perclos: number | null;
  head_yaw: number | null;
  head_pitch: number | null;
  gaze_x: number | null;
  gaze_y: number | null;
  face_present: boolean;
  multi_face: boolean;
  landmark_conf: number | null;
  frames: number;
}

export interface AggregatorOptions {
  perclosWindowMs: number;
  blinkWindowMs: number;
  blinkMaxClosedFrames: number;
}

function mean(values: readonly (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0) / present.length;
}

export class FeatureAggregator {
  private buffer: FrameFeatures[] = [];
  private closures: ClosureSample[] = [];
  private readonly options: AggregatorOptions;

  constructor(options: AggregatorOptions) {
    this.options = options;
  }

  push(frame: FrameFeatures): void {
    this.buffer.push(frame);
    if (frame.facePresent && frame.closed !== null) {
      this.closures.push({ t: frame.t, closed: frame.closed });
    }
  }

  /** Summarise everything since the last flush, then clear the per-second buffer. */
  flush(now: number): AggregatedFeatures {
    const frames = this.buffer;
    this.buffer = [];
    const keep = Math.max(this.options.perclosWindowMs, this.options.blinkWindowMs);
    this.closures = pruneOlderThan(this.closures, now - keep);

    const withFace = frames.filter((f) => f.facePresent);
    const facePresent = frames.length > 0 && withFace.length * 2 >= frames.length;
    const { perclosWindowMs, blinkWindowMs, blinkMaxClosedFrames } = this.options;

    return {
      ear: mean(withFace.map((f) => f.ear)),
      blink_rate: blinksPerMinute(this.closures, blinkWindowMs, now, blinkMaxClosedFrames),
      perclos: perclos(this.closures, perclosWindowMs, now),
      head_yaw: mean(withFace.map((f) => f.yaw)),
      head_pitch: mean(withFace.map((f) => f.pitch)),
      gaze_x: mean(withFace.map((f) => f.gazeX)),
      gaze_y: mean(withFace.map((f) => f.gazeY)),
      face_present: facePresent,
      multi_face: frames.some((f) => f.multiFace),
      landmark_conf: frames.length === 0 ? null : mean(frames.map((f) => f.conf ?? 0)),
      frames: frames.length,
    };
  }
}
