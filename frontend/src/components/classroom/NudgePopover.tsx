"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { NUDGE_PRESETS } from "@/lib/config";

interface NudgePopoverProps {
  studentName: string;
  busy: boolean;
  onSend: (message: string) => void;
  onClose: () => void;
}

export function NudgePopover({ studentName, busy, onSend, onClose }: NudgePopoverProps) {
  const [custom, setCustom] = useState("");
  const inputId = useId();
  return (
    <div
      role="dialog"
      aria-label={`Nudge ${studentName}`}
      className="mt-3 flex animate-rise flex-col gap-3 rounded-lg bg-surface-muted p-3"
    >
      <p className="flex items-center gap-1.5 text-xs text-ink-muted">
        <Icon name="lock" className="h-3.5 w-3.5" />
        Only {studentName} will see this. Nobody else is notified.
      </p>
      <div className="flex flex-wrap gap-2">
        {NUDGE_PRESETS.map((preset) => (
          <Button
            key={preset}
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => onSend(preset)}
          >
            {preset}
          </Button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (custom.trim()) onSend(custom.trim());
        }}
      >
        <label className="sr-only" htmlFor={inputId}>
          Custom message
        </label>
        <input
          id={inputId}
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          maxLength={140}
          placeholder="Custom message"
          className="min-h-9 min-w-0 flex-1 rounded-lg border border-field bg-surface px-3 py-1 text-sm placeholder:text-ink-muted"
        />
        <Button type="submit" size="sm" disabled={busy || !custom.trim()}>
          Send
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </form>
    </div>
  );
}
