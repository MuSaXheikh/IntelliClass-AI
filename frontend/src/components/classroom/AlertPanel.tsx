"use client";

import { useMemo, useState } from "react";
import { NudgePopover } from "@/components/classroom/NudgePopover";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { sortAlerts } from "@/lib/status";
import type { Alert } from "@/types/contract";

interface AlertPanelProps {
  alerts: readonly Alert[];
  nudgingId: string | null;
  onNudge: (alert: Alert, message: string) => void;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Ranked, grouped live alerts with a one-tap private nudge (design.md Screen 5). */
export function AlertPanel({ alerts, nudgingId, onNudge }: AlertPanelProps) {
  const [openFor, setOpenFor] = useState<string | null>(null);
  const sorted = useMemo(() => sortAlerts(alerts).filter((a) => a.status !== "resolved"), [alerts]);

  return (
    <section aria-label="Live alerts" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted dark:text-slate-400">
        Live alerts
      </h2>
      {sorted.length === 0 ? (
        <EmptyState title="All quiet">Nobody needs attention right now.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((alert) => (
            <li
              key={alert.id}
              className="rounded-lg border border-line bg-surface p-3 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold dark:bg-slate-700"
                >
                  {initials(alert.full_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {alert.full_name}
                    {alert.roll_no && (
                      <span className="ml-2 font-mono text-xs text-ink-muted dark:text-slate-400">
                        {alert.roll_no}
                      </span>
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted dark:text-slate-400">
                    <StatusBadge state={alert.type} />
                    <span>{Math.round(alert.duration_s)} s</span>
                    {alert.grouped_count > 1 && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 font-mono dark:bg-slate-700">
                        ×{alert.grouped_count}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  aria-expanded={openFor === alert.id}
                  onClick={() => setOpenFor(openFor === alert.id ? null : alert.id)}
                >
                  Nudge
                </Button>
              </div>
              {openFor === alert.id && (
                <NudgePopover
                  studentName={alert.full_name}
                  busy={nudgingId === alert.id}
                  onSend={(message) => {
                    onNudge(alert, message);
                    setOpenFor(null);
                  }}
                  onClose={() => setOpenFor(null)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
