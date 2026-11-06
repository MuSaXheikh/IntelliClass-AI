"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { formatDay, formatTime, localToday, relativeDay } from "@/lib/schedule";
import type { ScheduleEntry } from "@/types/contract";

interface ScheduleTableProps {
  entries: ScheduleEntry[];
  today?: string;
  busyId?: string | null;
  onCancel?: (entry: ScheduleEntry) => void;
  onRestore?: (entry: ScheduleEntry) => void;
  emptyText: string;
}

const HEAD = "px-4 py-2.5 text-left text-xs font-semibold";
const CELL = "px-4 py-3 align-top";

/** Spreadsheet-style grid: one row per meeting, the first row of each day carries the date. */
export function ScheduleTable({
  entries,
  today = localToday(),
  busyId = null,
  onCancel,
  onRestore,
  emptyText,
}: ScheduleTableProps) {
  if (entries.length === 0) {
    return (
      <EmptyState title="Nothing scheduled" icon="calendar">
        {emptyText}
      </EmptyState>
    );
  }
  const actions = Boolean(onCancel || onRestore);
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead className="border-b border-line bg-surface-muted text-ink-muted">
          <tr>
            <th className={`${HEAD} w-44`}>Date</th>
            <th className={`${HEAD} w-28`}>Time</th>
            <th className={HEAD}>Class</th>
            <th className={HEAD}>Topic</th>
            <th className={HEAD}>Location</th>
            <th className={`${HEAD} w-28`}>Status</th>
            {actions && <th className={`${HEAD} w-36`}>Action</th>}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const relation = relativeDay(entry.scheduled_date, today);
            const cancelled = entry.status === "cancelled";
            const firstOfDay =
              index === 0 || entries[index - 1].scheduled_date !== entry.scheduled_date;
            const muted = relation === "past" || cancelled;
            return (
              <tr
                key={entry.id}
                className={`transition-colors duration-150 hover:bg-surface-muted/60 ${
                  firstOfDay && index > 0 ? "border-t border-line" : ""
                } ${muted ? "text-ink-muted" : ""}`}
              >
                <td className={`${CELL} whitespace-nowrap font-medium`}>
                  {firstOfDay ? formatDay(entry.scheduled_date) : ""}
                  {firstOfDay && relation === "today" && (
                    <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-ink">
                      Today
                    </span>
                  )}
                </td>
                <td className={`${CELL} whitespace-nowrap font-mono text-xs tabular-nums`}>
                  {formatTime(entry.start_time)}
                  {entry.end_time ? ` to ${formatTime(entry.end_time)}` : ""}
                </td>
                <td className={CELL}>
                  <span className={cancelled ? "line-through" : "font-medium"}>
                    {entry.class_name}
                  </span>
                  <span className="block whitespace-nowrap font-mono text-xs text-ink-muted">
                    {entry.course_code}
                  </span>
                </td>
                <td className={CELL}>{entry.topic || "–"}</td>
                <td className={CELL}>{entry.location || "–"}</td>
                <td className={`${CELL} whitespace-nowrap`}>
                  {cancelled ? (
                    <span
                      className="inline-flex items-center gap-1 font-medium text-danger-ink"
                      title={entry.cancel_reason ?? undefined}
                    >
                      <Icon name="x" className="h-3.5 w-3.5" />
                      Cancelled{entry.cancel_reason ? `: ${entry.cancel_reason}` : ""}
                    </span>
                  ) : relation === "past" ? (
                    "Held"
                  ) : (
                    "Scheduled"
                  )}
                </td>
                {actions && (
                  <td className={`${CELL} whitespace-nowrap`}>
                    {onCancel && entry.can_cancel && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busyId !== null}
                        onClick={() => onCancel(entry)}
                      >
                        Cancel class
                      </Button>
                    )}
                    {onRestore && entry.can_restore && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busyId !== null}
                        onClick={() => onRestore(entry)}
                      >
                        {busyId === entry.id ? "Restoring…" : "Restore"}
                      </Button>
                    )}
                    {onCancel && !entry.can_cancel && !cancelled && relation !== "past" && (
                      <span className="text-xs text-ink-muted">Only before the day</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
