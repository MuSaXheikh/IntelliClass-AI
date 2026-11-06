"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
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
      className="flex animate-rise flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-accent-line bg-accent-soft p-4 text-ink shadow-card"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-slate-900">
        <Icon name="bell" className="h-5 w-5" />
      </span>
      <div className="min-w-48 flex-1 text-sm">
        <p className="font-semibold">Message from {nudge.from}</p>
        <p className="mt-0.5">{nudge.message}</p>
        <p className="mt-0.5 text-xs text-ink-muted">Only you can see this.</p>
      </div>
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
