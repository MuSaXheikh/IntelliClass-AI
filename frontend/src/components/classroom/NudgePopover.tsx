"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { NUDGE_PRESETS } from "@/lib/config";

interface NudgePopoverProps {
  studentName: string;
  busy: boolean;
  onSend: (message: string) => void;
  onClose: () => void;
}

export function NudgePopover({ studentName, busy, onSend, onClose }: NudgePopoverProps) {
  const [custom, setCustom] = useState("");
  return (
    <div
      role="dialog"
      aria-label={`Nudge ${studentName}`}
      className="mt-2 flex flex-col gap-2 rounded-lg border border-line bg-surface p-3 shadow-md dark:border-slate-600 dark:bg-slate-800"
    >
      <p className="text-xs text-ink-muted dark:text-slate-400">
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
        <label className="sr-only" htmlFor={`nudge-custom-${studentName}`}>
          Custom message
        </label>
        <input
          id={`nudge-custom-${studentName}`}
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          maxLength={140}
          placeholder="Custom message"
          className="flex-1 rounded-lg border border-line bg-surface px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900"
        />
        <Button type="submit" size="sm" disabled={busy || !custom.trim()}>
          Send
        </Button>
      </form>
      <Button variant="ghost" size="sm" onClick={onClose}>
        Cancel
      </Button>
    </div>
  );
}
