/** Camera/microphone probing with human-readable reasons (consent gate + live room). */

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

/** Map a getUserMedia failure to a sentence the student can act on. */
export function describeMediaError(error: unknown, device: "camera" | "microphone"): string {
  const label = device === "camera" ? "Camera" : "Microphone";
  const name = error instanceof DOMException ? error.name : "";
  const text = REASONS[name];
  if (text) return device === "camera" ? text : text.replaceAll("camera", "microphone");
  const informative = error instanceof Error && !(error instanceof TypeError) && error.message;
  if (informative) return error.message;
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return `${label} access needs HTTPS or http://localhost.`;
  }
  return `The ${device} could not be opened.`;
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
