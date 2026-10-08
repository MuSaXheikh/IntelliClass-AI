/** All client-side constants in one place (rules.md §1.1: thresholds live in config). */

const env = (key: string, fallback: string): string => {
  const value = process.env[key];
  return value && value.length > 0 ? value : fallback;
};

export const API_URL = env("NEXT_PUBLIC_API_URL", "http://localhost:8000/api/v1");
export const WS_URL = env("NEXT_PUBLIC_WS_URL", "ws://localhost:8000/ws");
export const LIVEKIT_URL = env("NEXT_PUBLIC_LIVEKIT_URL", "");

/** Vision sampling rate inside the worker (frames analysed per second). */
export const VISION_FPS = 8;
/** How often an aggregated feature packet is sent to the server (ms). */
export const VISION_PACKET_INTERVAL_MS = 1000;
/** Eye Aspect Ratio below which the eye is treated as closed (calibrate per student later). */
export const EAR_CLOSED_THRESHOLD = 0.2;
/** PERCLOS window (ms). */
export const PERCLOS_WINDOW_MS = 30_000;
/** Blink-rate window (ms). */
export const BLINK_WINDOW_MS = 60_000;
/** A blink is a closed run of this many frames or fewer; longer runs are closures. */
export const BLINK_MAX_CLOSED_FRAMES = 3;
/** Camera capture request. Small frames are enough for landmarks and keep CPU low. */
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 15 } },
  audio: false,
};

/**
 * MediaPipe assets are served from public/ so the app works with no internet:
 * the WASM runtime is copied from node_modules by scripts/copy-mediapipe-wasm.mjs (postinstall)
 * and the face model is committed at public/models/face_landmarker.task.
 */
export const MEDIAPIPE_WASM_BASE = "/mediapipe/wasm";
export const FACE_LANDMARKER_MODEL_URL = "/models/face_landmarker.task";

/** WebSocket reconnect: 1 s, 2 s, 4 s ... capped. */
export const WS_RECONNECT_BASE_MS = 1000;
export const WS_RECONNECT_MAX_MS = 30_000;
export const WS_HEARTBEAT_MS = 15_000;

export const NUDGE_PRESETS = ["Please focus", "Are you there?"] as const;

export const AUTH_TOKEN_KEY = "intelliclass.token";
export const AUTH_USER_KEY = "intelliclass.user";
export const JOIN_INFO_KEY_PREFIX = "intelliclass.join.";
