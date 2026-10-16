/** Camera, microphone and screen-share failures as sentences the student can act on. */

export interface MediaProbe {
  ok: boolean;
  reason: string | null;
}

const REASONS: Record<string, string> = {
  NotAllowedError:
    "Permission was blocked. Click the camera icon in the address bar, allow it, then try again.",
  PermissionDeniedError:
    "Permission was blocked. Click the camera icon in the address bar, allow it, then try again.",
  NotFoundError: "No camera was found on this device.",
  DevicesNotFoundError: "No camera was found on this device.",
  NotReadableError: "The camera is in use by another app or could not start.",
  TrackStartError: "The camera is in use by another app or could not start.",
  OverconstrainedError: "The camera does not support the requested settings.",
  SecurityError: "Camera access needs HTTPS or http://localhost.",
  AbortError: "The camera stopped responding. Try again.",
};

const SCREEN_REASONS: Record<string, string> = {
  NotAllowedError:
    "Screen sharing was cancelled or blocked. Click the button again and pick a window.",
  PermissionDeniedError: "Screen sharing was blocked. Allow it in the browser's site settings.",
  InvalidStateError: "Screen sharing must start from a click. Try the button again.",
  NotFoundError: "There is no screen or window available to share.",
  NotReadableError: "The screen could not be captured. Close other screen-recording apps.",
  AbortError: "Screen sharing stopped. Try again.",
  SecurityError: "Screen sharing needs HTTPS or http://localhost.",
};

export type MediaDevice = "camera" | "microphone" | "screen";

/** Map a getUserMedia / getDisplayMedia failure to a sentence the student can act on. */
export function describeMediaError(error: unknown, device: MediaDevice): string {
  const label =
    device === "camera" ? "Camera" : device === "screen" ? "Screen sharing" : "Microphone";
  const name = error instanceof DOMException ? error.name : "";
  const text = device === "screen" ? SCREEN_REASONS[name] : REASONS[name];
  if (text) return device === "microphone" ? text.replaceAll("camera", "microphone") : text;
  const informative = error instanceof Error && !(error instanceof TypeError) && error.message;
  if (informative) return error.message;
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return `${label} needs HTTPS or http://localhost.`;
  }
  return device === "screen"
    ? "The screen could not be shared."
    : `The ${device} could not be opened.`;
}

/** Ask for a device and release it immediately; returns why it failed, if it did. */
export async function probeMedia(device: "camera" | "microphone"): Promise<MediaProbe> {
  const constraints: MediaStreamConstraints =
    device === "camera" ? { video: true, audio: false } : { video: false, audio: true };
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    stream.getTracks().forEach((track) => track.stop());
    return { ok: true, reason: null };
  } catch (error) {
    return { ok: false, reason: describeMediaError(error, device) };
  }
}
