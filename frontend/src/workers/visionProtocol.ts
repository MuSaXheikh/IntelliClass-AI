import type { AggregatedFeatures } from "@/lib/vision/aggregate";

/** Messages main thread → worker. */
export type VisionWorkerInbound =
  | {
      type: "init";
      wasmBase: string;
      modelUrl: string;
      fps: number;
      earThreshold: number;
      perclosWindowMs: number;
      blinkWindowMs: number;
      blinkMaxClosedFrames: number;
      packetIntervalMs: number;
    }
  | { type: "stream"; readable: ReadableStream<VideoFrame> }
  | { type: "fallback" }
  | { type: "frame"; bitmap: ImageBitmap }
  | { type: "stop" };

/** Messages worker → main thread. Only numbers and status, never image data. */
export type VisionWorkerOutbound =
  | { type: "ready" }
  | { type: "packet"; packet: AggregatedFeatures }
  | { type: "tick" }
  | { type: "error"; message: string };
