"use client";

import { useEffect, useRef, useState } from "react";
import {
  BLINK_MAX_CLOSED_FRAMES,
  BLINK_WINDOW_MS,
  CAMERA_CONSTRAINTS,
  EAR_CLOSED_THRESHOLD,
  FACE_LANDMARKER_MODEL_URL,
  MEDIAPIPE_WASM_BASE,
  PERCLOS_WINDOW_MS,
  VISION_FPS,
  VISION_PACKET_INTERVAL_MS,
} from "@/lib/config";
import type { AggregatedFeatures } from "@/lib/vision/aggregate";
import type { VisionFeaturesPayload } from "@/types/contract";
import type { VisionWorkerInbound, VisionWorkerOutbound } from "@/workers/visionProtocol";

export type VisionStatus =
  "idle" | "starting" | "loading_model" | "running" | "camera_denied" | "camera_ended" | "error";

export interface VisionPipeline {
  status: VisionStatus;
  error: string | null;
  /** Latest aggregate, for the student's own "on-device" indicator. */
  latest: AggregatedFeatures | null;
}

interface Options {
  enabled: boolean;
  onPacket: (packet: VisionFeaturesPayload) => void;
}

const NULL_PACKET: Omit<VisionFeaturesPayload, "camera_on" | "page_visible" | "window_focused"> = {
  ear: null,
  blink_rate: null,
  perclos: null,
  head_yaw: null,
  head_pitch: null,
  gaze_x: null,
  gaze_y: null,
  face_present: null, // unknown while the model loads: the server shows "uncertain", not "no face"
  landmark_conf: null,
};

function pageFlags(): Pick<VisionFeaturesPayload, "page_visible" | "window_focused"> {
  return {
    page_visible: document.visibilityState === "visible",
    window_focused: document.hasFocus(),
  };
}

function toPacket(agg: AggregatedFeatures | null, cameraOn: boolean): VisionFeaturesPayload {
  const base = agg
    ? {
        ear: agg.ear,
        blink_rate: agg.blink_rate,
        perclos: agg.perclos,
        head_yaw: agg.head_yaw,
        head_pitch: agg.head_pitch,
        gaze_x: agg.gaze_x,
        gaze_y: agg.gaze_y,
        face_present: agg.face_present,
        landmark_conf: agg.landmark_conf,
      }
    : NULL_PACKET;
  return { ...base, camera_on: cameraOn, ...pageFlags() };
}

function supportsTrackProcessor(): boolean {
  return typeof MediaStreamTrackProcessor !== "undefined";
}

/**
 * Main-thread side of the on-device vision pipeline (FE-11, FE-19, D17).
 * Captures the camera, hands frames to the worker, and emits one `vision.features` packet
 * per second with page visibility and focus attached. Image data never leaves the worker.
 */
export function useVisionPipeline({ enabled, onPacket }: Options): VisionPipeline {
  const [status, setStatus] = useState<VisionStatus>("starting");
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<AggregatedFeatures | null>(null);
  const onPacketRef = useRef(onPacket);

  useEffect(() => {
    onPacketRef.current = onPacket;
  }, [onPacket]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let worker: Worker | null = null;
    let stream: MediaStream | null = null;
    let video: HTMLVideoElement | null = null;
    let cameraOn = false;
    let lastWorkerPacketAt = 0;
    let watchdog: ReturnType<typeof setInterval> | null = null;

    const emit = (agg: AggregatedFeatures | null) => {
      onPacketRef.current(toPacket(agg, cameraOn));
    };

    const stopCamera = () => {
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      cameraOn = false;
    };

    const postToWorker = (message: VisionWorkerInbound, transfer?: Transferable[]) => {
      if (!worker) return;
      if (transfer) worker.postMessage(message, transfer);
      else worker.postMessage(message);
    };

    const sendBitmap = async () => {
      if (!video || !worker || video.readyState < 2) return;
      try {
        const bitmap = await createImageBitmap(video);
        postToWorker({ type: "frame", bitmap }, [bitmap]);
      } catch {
        // frame not ready; the next tick will try again
      }
    };

    const handleWorkerMessage = (event: MessageEvent<VisionWorkerOutbound>) => {
      const message = event.data;
      switch (message.type) {
        case "ready":
          setStatus("running");
          break;
        case "packet":
          lastWorkerPacketAt = Date.now();
          setLatest(message.packet);
          emit(message.packet);
          break;
        case "tick":
          void sendBitmap();
          break;
        case "error":
          setError(message.message);
          setStatus("error");
          break;
        default:
          break;
      }
    };

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      } catch {
        setStatus("camera_denied");
        return;
      }
      setError(null);
      if (cancelled) {
        stopCamera();
        return;
      }
      cameraOn = true;
      const [track] = stream.getVideoTracks();
      track.addEventListener("ended", () => {
        cameraOn = false;
        setStatus("camera_ended");
      });

      worker = new Worker(new URL("../workers/vision.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = handleWorkerMessage;
      worker.onerror = (event) => {
        setError(event.message || "Vision worker crashed");
        setStatus("error");
      };
      setStatus("loading_model");
      postToWorker({
        type: "init",
        wasmBase: MEDIAPIPE_WASM_BASE,
        modelUrl: FACE_LANDMARKER_MODEL_URL,
        fps: VISION_FPS,
        earThreshold: EAR_CLOSED_THRESHOLD,
        perclosWindowMs: PERCLOS_WINDOW_MS,
        blinkWindowMs: BLINK_WINDOW_MS,
        blinkMaxClosedFrames: BLINK_MAX_CLOSED_FRAMES,
        packetIntervalMs: VISION_PACKET_INTERVAL_MS,
      });

      if (supportsTrackProcessor() && MediaStreamTrackProcessor) {
        const processor = new MediaStreamTrackProcessor({ track });
        const readable = processor.readable;
        postToWorker({ type: "stream", readable }, [readable]);
      } else {
        video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        postToWorker({ type: "fallback" });
      }
    };

    void start();

    // If the worker is silent (model loading, camera off), still report once per second.
    watchdog = setInterval(() => {
      if (Date.now() - lastWorkerPacketAt > VISION_PACKET_INTERVAL_MS * 1.5) emit(null);
    }, VISION_PACKET_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (watchdog) clearInterval(watchdog);
      postToWorker({ type: "stop" });
      worker?.terminate();
      worker = null;
      if (video) {
        video.pause();
        video.srcObject = null;
      }
      stopCamera();
    };
  }, [enabled]);

  return { status: enabled ? status : "idle", error, latest };
}
