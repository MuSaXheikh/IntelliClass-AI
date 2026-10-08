/// <reference lib="webworker" />
/**
 * On-device vision worker (FE-11, decision D17).
 * - Runs MediaPipe Face Landmarker on camera frames inside a dedicated worker.
 * - Sampling is driven by setInterval here, never requestAnimationFrame, so it keeps running
 *   when the classroom tab is hidden.
 * - Posts ONLY numeric features out. No frame, bitmap or pixel buffer ever leaves this worker.
 */
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { FeatureAggregator, type FrameFeatures } from "@/lib/vision/aggregate";
import { isEyeClosed, landmarkConfidence, meanEar } from "@/lib/vision/ear";
import { gazeFromLandmarks } from "@/lib/vision/gaze";
import { headPoseFromMatrix } from "@/lib/vision/headPose";
import type { VisionWorkerInbound, VisionWorkerOutbound } from "@/workers/visionProtocol";

type Frame = VideoFrame | ImageBitmap;

interface WorkerState {
  landmarker: FaceLandmarker | null;
  aggregator: FeatureAggregator | null;
  latest: Frame | null;
  detectTimer: ReturnType<typeof setInterval> | null;
  packetTimer: ReturnType<typeof setInterval> | null;
  tickTimer: ReturnType<typeof setInterval> | null;
  earThreshold: number;
  lastTimestamp: number;
  stopped: boolean;
}

const state: WorkerState = {
  landmarker: null,
  aggregator: null,
  latest: null,
  detectTimer: null,
  packetTimer: null,
  tickTimer: null,
  earThreshold: 0.2,
  lastTimestamp: 0,
  stopped: false,
};

const post = (message: VisionWorkerOutbound, transfer?: Transferable[]): void => {
  if (transfer) self.postMessage(message, transfer);
  else self.postMessage(message);
};

function frameSize(frame: Frame): { width: number; height: number } {
  if ("displayWidth" in frame) return { width: frame.displayWidth, height: frame.displayHeight };
  return { width: frame.width, height: frame.height };
}

function releaseFrame(frame: Frame | null): void {
  if (!frame) return;
  frame.close();
}

function monotonicTimestamp(): number {
  const now = Math.max(performance.now(), state.lastTimestamp + 1);
  state.lastTimestamp = now;
  return now;
}

function featuresFromDetection(
  faces: ReturnType<FaceLandmarker["detectForVideo"]>,
  aspect: number,
  t: number,
): FrameFeatures {
  const landmarks = faces.faceLandmarks[0];
  if (!landmarks) {
    return emptyFeatures(t, false);
  }
  const matrix = faces.facialTransformationMatrixes[0];
  const pose = matrix ? headPoseFromMatrix(matrix.data) : null;
  const ear = meanEar(landmarks, aspect);
  const gaze = gazeFromLandmarks(landmarks);
  return {
    t,
    facePresent: true,
    multiFace: faces.faceLandmarks.length > 1,
    ear,
    closed: ear === null ? null : isEyeClosed(ear, state.earThreshold),
    yaw: pose?.yaw ?? null,
    pitch: pose?.pitch ?? null,
    gazeX: gaze?.x ?? null,
    gazeY: gaze?.y ?? null,
    conf: landmarkConfidence(landmarks, Boolean(matrix), aspect),
  };
}

function emptyFeatures(t: number, facePresent: boolean): FrameFeatures {
  return {
    t,
    facePresent,
    multiFace: false,
    ear: null,
    closed: null,
    yaw: null,
    pitch: null,
    gazeX: null,
    gazeY: null,
    conf: facePresent ? null : 0,
  };
}

function detectLatest(): void {
  const frame = state.latest;
  if (!frame || !state.landmarker || !state.aggregator) return;
  state.latest = null;
  try {
    const { width, height } = frameSize(frame);
    const aspect = height > 0 ? width / height : 1;
    const t = monotonicTimestamp();
    const result = state.landmarker.detectForVideo(frame, t);
    state.aggregator.push(featuresFromDetection(result, aspect, t));
  } catch (error) {
    post({ type: "error", message: error instanceof Error ? error.message : String(error) });
  } finally {
    releaseFrame(frame);
  }
}

function flushPacket(): void {
  if (!state.aggregator) return;
  post({ type: "packet", packet: state.aggregator.flush(performance.now()) });
}

async function init(message: Extract<VisionWorkerInbound, { type: "init" }>): Promise<void> {
  state.earThreshold = message.earThreshold;
  state.aggregator = new FeatureAggregator({
    perclosWindowMs: message.perclosWindowMs,
    blinkWindowMs: message.blinkWindowMs,
    blinkMaxClosedFrames: message.blinkMaxClosedFrames,
  });
  try {
    const fileset = await FilesetResolver.forVisionTasks(message.wasmBase);
    const landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: message.modelUrl, delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 2,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: true,
    });
    if (state.stopped) {
      landmarker.close();
      return;
    }
    state.landmarker = landmarker;
    state.detectTimer = setInterval(detectLatest, Math.round(1000 / message.fps));
    state.packetTimer = setInterval(flushPacket, message.packetIntervalMs);
    post({ type: "ready" });
  } catch (error) {
    post({
      type: "error",
      message: error instanceof Error ? error.message : "Model failed to load",
    });
  }
}

function acceptFrame(frame: Frame): void {
  releaseFrame(state.latest);
  state.latest = state.stopped ? null : frame;
  if (state.stopped) releaseFrame(frame);
}

async function pump(readable: ReadableStream<VideoFrame>): Promise<void> {
  const reader = readable.getReader();
  try {
    while (!state.stopped) {
      const { value, done } = await reader.read();
      if (done || !value) break;
      acceptFrame(value);
    }
  } catch (error) {
    post({
      type: "error",
      message: error instanceof Error ? error.message : "Camera stream ended",
    });
  } finally {
    reader.releaseLock();
  }
}

/** Fallback path for browsers without MediaStreamTrackProcessor: ask the page for bitmaps. */
function startTicking(fps: number): void {
  if (state.tickTimer) return;
  state.tickTimer = setInterval(() => post({ type: "tick" }), Math.round(1000 / fps));
}

function stop(): void {
  state.stopped = true;
  for (const timer of [state.detectTimer, state.packetTimer, state.tickTimer]) {
    if (timer) clearInterval(timer);
  }
  state.detectTimer = state.packetTimer = state.tickTimer = null;
  releaseFrame(state.latest);
  state.latest = null;
  state.landmarker?.close();
  state.landmarker = null;
}

let configuredFps = 8;

self.onmessage = (event: MessageEvent<VisionWorkerInbound>) => {
  const message = event.data;
  switch (message.type) {
    case "init":
      configuredFps = message.fps;
      void init(message);
      break;
    case "stream":
      void pump(message.readable);
      break;
    case "fallback":
      startTicking(configuredFps);
      break;
    case "frame":
      acceptFrame(message.bitmap);
      break;
    case "stop":
      stop();
      break;
    default:
      break;
  }
};
