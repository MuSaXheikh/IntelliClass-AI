import { describe, expect, it } from "vitest";
import { FeatureAggregator, type FrameFeatures } from "@/lib/vision/aggregate";

const options = { perclosWindowMs: 30_000, blinkWindowMs: 60_000, blinkMaxClosedFrames: 3 };

function frame(t: number, overrides: Partial<FrameFeatures> = {}): FrameFeatures {
  return {
    t,
    facePresent: true,
    multiFace: false,
    ear: 0.3,
    closed: false,
    yaw: 2,
    pitch: -1,
    gazeX: 0.05,
    gazeY: 0,
    conf: 1,
    ...overrides,
  };
}

describe("FeatureAggregator", () => {
  it("averages one second of frames and reports the frame count", () => {
    const agg = new FeatureAggregator(options);
    for (let i = 0; i < 8; i += 1) agg.push(frame(i * 125, { ear: 0.2 + i * 0.01, yaw: i }));
    const packet = agg.flush(1000);
    expect(packet.frames).toBe(8);
    expect(packet.ear).toBeCloseTo(0.235, 5);
    expect(packet.head_yaw).toBeCloseTo(3.5, 5);
    expect(packet.face_present).toBe(true);
    expect(packet.landmark_conf).toBe(1);
    expect(agg.flush(2000).frames).toBe(0);
  });

  it("counts blinks across seconds and computes perclos over the long window", () => {
    const agg = new FeatureAggregator(options);
    let t = 0;
    // 10 s at 8 fps: a 2-frame blink every 2 s (5 blinks), everything else open
    for (let i = 0; i < 80; i += 1) {
      const closed = i % 16 === 0 || i % 16 === 1;
      agg.push(frame(t, { closed, ear: closed ? 0.1 : 0.3 }));
      t += 125;
    }
    const packet = agg.flush(t);
    expect(packet.perclos).toBeCloseTo(10 / 80, 5);
    // 5 blinks over ~9.9 s ≈ 30 per minute
    expect(packet.blink_rate).toBeGreaterThan(28);
    expect(packet.blink_rate).toBeLessThan(32);
  });

  it("reports no face by majority and null numbers when nothing is present", () => {
    const agg = new FeatureAggregator(options);
    agg.push(frame(0, { facePresent: false, ear: null, closed: null, conf: 0 }));
    agg.push(frame(125, { facePresent: false, ear: null, closed: null, conf: 0 }));
    agg.push(frame(250));
    const packet = agg.flush(1000);
    expect(packet.face_present).toBe(false);
    expect(packet.ear).toBeCloseTo(0.3);
    expect(packet.landmark_conf).toBeCloseTo(1 / 3, 5);
    expect(new FeatureAggregator(options).flush(0)).toMatchObject({
      face_present: false,
      ear: null,
      perclos: null,
      blink_rate: null,
      landmark_conf: null,
      frames: 0,
    });
  });
});
