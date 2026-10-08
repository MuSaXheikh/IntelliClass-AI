import type { VisionStatus } from "@/hooks/useVisionPipeline";

const HINTS: Record<VisionStatus, string> = {
  idle: "Camera analysis is off",
  starting: "Starting camera…",
  loading_model: "Loading the on-device model…",
  running: "Camera analysis: on-device ✔",
  camera_denied: "Camera blocked. Allow it in the browser bar to take part.",
  camera_ended: "Camera stopped. Reconnect it to continue.",
  error: "Camera analysis unavailable on this browser.",
};

/** Always-visible reassurance that nothing leaves the device (design.md Screen 6). */
export function OnDeviceChip({
  status,
  lowConfidence,
}: {
  status: VisionStatus;
  lowConfidence: boolean;
}) {
  const ok = status === "running";
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${ok ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}
        role="status"
      >
        {HINTS[status]}
      </span>
      {ok && lowConfidence && (
        <span className="text-ink-muted dark:text-slate-400">
          Tip: improve lighting or face the camera.
        </span>
      )}
    </div>
  );
}
