"use client";

import { useMemo, useState } from "react";
import { NudgePopover } from "@/components/classroom/NudgePopover";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { sortAlerts } from "@/lib/status";
import type { Alert } from "@/types/contract";

interface AlertPanelProps {
  alerts: readonly Alert[];
  nudgingId: string | null;
  onNudge: (alert: Alert, message: string) => void;
}

/** Ranked, grouped live alerts with a one-tap private nudge (design.md Screen 5). */
export function AlertPanel({ alerts, nudgingId, onNudge }: AlertPanelProps) {
  const [openFor, setOpenFor] = useState<string | null>(null);
  const sorted = useMemo(() => sortAlerts(alerts).filter((a) => a.status !== "resolved"), [alerts]);

  return (
    <section
      aria-label="Live alerts"
      className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon name="bell" className="h-4 w-4 text-ink-muted" />
          Live alerts
        </h2>
        {sorted.length > 0 && (
          <span className="rounded-full bg-surface-muted px-2 py-0.5 font-mono text-xs font-medium tabular-nums">
            {sorted.length}
          </span>
        )}
      </div>
      {sorted.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-5 text-sm">
          <Icon name="check-circle" className="h-5 w-5 text-success-ink" />
          <div>
            <p className="font-medium">All quiet</p>
            <p className="text-ink-muted">Nobody needs attention right now.</p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {sorted.map((alert) => (
            <li key={alert.id} className="animate-rise p-3">
              <div className="flex items-center gap-3">
                <Avatar name={alert.full_name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {alert.full_name}
                    {alert.roll_no && (
                      <span className="ml-2 font-mono text-xs font-normal text-ink-muted">
                        {alert.roll_no}
                      </span>
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                    <StatusBadge state={alert.type} />
                    <span className="font-mono tabular-nums">{Math.round(alert.duration_s)} s</span>
                    {alert.grouped_count > 1 && (
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 font-mono">
                        ×{alert.grouped_count}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
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
