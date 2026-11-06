"use client";

import { PrivacyChip } from "@/components/classroom/PrivacyChip";
import { Button } from "@/components/ui/Button";
import type { ScreenCompliance } from "@/hooks/useScreenCompliance";

const HINTS: Record<ScreenCompliance["status"], string> = {
  idle: "Screen check is off (optional).",
  unsupported: "Screen sharing is not available on this browser.",
  requesting: "Choose the screen or window to check…",
  loading: "Loading the on-device text reader…",
  running: "Screen check: on-device",
  denied: "Screen sharing was declined.",
  ended: "Screen sharing stopped.",
  error: "Screen check unavailable.",
};

/**
 * The optional slide check: the student shares a screen, the browser reads the words on it and
 * compares them with the slides. Only a similarity number is sent; no screenshot, no text.
 */
export function ScreenCheckChip({ screen }: { screen: ScreenCompliance }) {
  const running = screen.status === "running";
  const busy = screen.status === "requesting" || screen.status === "loading";
  return (
    <div className="flex flex-col gap-2">
      <PrivacyChip active={running}>
        {HINTS[screen.status]}
        {running && screen.lastSimilarity !== null && (
          <span className="font-normal">
            {" "}
            · matches slides {Math.round(screen.lastSimilarity * 100)}%
          </span>
        )}
        {running && screen.lastSimilarity === null && (
          <span className="font-normal"> · nothing to compare on this slide</span>
        )}
      </PrivacyChip>
      {running ? (
        <Button variant="ghost" size="sm" onClick={screen.stop}>
          Stop sharing
        </Button>
      ) : (
        <Button variant="secondary" size="sm" onClick={screen.start} disabled={busy}>
          Share screen for the slide check
        </Button>
      )}
      {screen.error && (
        <p className="text-xs font-medium text-danger-ink" role="alert">
          {screen.error}
        </p>
      )}
    </div>
  );
}
