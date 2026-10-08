"use client";

import { Button } from "@/components/ui/Button";
import type { NudgeDeliverPayload, NudgeResponse } from "@/types/contract";

interface NudgeBannerProps {
  nudge: NudgeDeliverPayload;
  onReply: (response: NudgeResponse) => void;
}

/** Private banner shown only on the nudged student's device (design.md Screen 6). */
export function NudgeBanner({ nudge, onReply }: NudgeBannerProps) {
  return (
    <div
      role="alertdialog"
      aria-label="Message from your instructor"
      className="flex flex-col gap-3 rounded-card border border-accent bg-yellow-50 p-4 text-ink shadow-md dark:bg-yellow-900/30 dark:text-yellow-50"
    >
      <p className="text-sm">
        <span className="font-medium">Message from {nudge.from}:</span> {nudge.message}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onReply("i_am_back")}>
          I am back
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onReply("connection_problem")}>
          I have a connection problem
        </Button>
      </div>
    </div>
  );
}
