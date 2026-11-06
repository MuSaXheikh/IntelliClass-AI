import { PrivacyChip } from "@/components/classroom/PrivacyChip";
import type { VisionStatus } from "@/hooks/useVisionPipeline";

const HINTS: Record<VisionStatus, string> = {
  idle: "Camera analysis is off",
  starting: "Starting camera…",
  loading_model: "Loading the on-device model…",
  running: "Camera analysis: on-device",
  camera_denied: "Camera blocked. Allow it in the browser bar to take part.",
  camera_unavailable: "Camera unavailable. Close other apps that use it; retrying.",
  camera_ended: "Camera stopped. Plug it back in and reload this page.",
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
    <div className="flex flex-col gap-1.5">
      <PrivacyChip active={ok}>{HINTS[status]}</PrivacyChip>
      {ok && lowConfidence && (
        <p className="px-3 text-xs text-ink-muted">Tip: improve lighting or face the camera.</p>
      )}
    </div>
  );
}
