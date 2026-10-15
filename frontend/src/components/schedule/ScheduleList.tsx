"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDay, groupByDate, relativeDay, timeRange } from "@/lib/schedule";
import type { ScheduleEntry } from "@/types/contract";

interface ScheduleListProps {
  entries: ScheduleEntry[];
  today: string;
  busyId?: string | null;
  onCancel?: (entry: ScheduleEntry) => void;
  onRestore?: (entry: ScheduleEntry) => void;
  emptyText: string;
}

/** Day-by-day list shared by the instructor (with actions) and the student (read-only). */
export function ScheduleList({
  entries,
  today,
  busyId = null,
  onCancel,
  onRestore,
  emptyText,
}: ScheduleListProps) {
  if (entries.length === 0) return <EmptyState title="Nothing scheduled">{emptyText}</EmptyState>;
  return (
    <div className="flex flex-col gap-5">
      {groupByDate(entries).map((group) => {
        const relation = relativeDay(group.date, today);
        return (
          <section key={group.date} aria-label={formatDay(group.date)}>
            <h3
              className={`mb-2 text-sm font-semibold ${
                relation === "past" ? "text-ink-muted dark:text-slate-400" : ""
              }`}
            >
              {formatDay(group.date)}
              {relation === "today" && (
                <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary dark:text-green-300">
                  Today
                </span>
              )}
            </h3>
            <ul className="divide-y divide-line rounded-card border border-line bg-surface text-sm dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-900">
              {group.entries.map((entry) => {
                const cancelled = entry.status === "cancelled";
                return (
                  <li
                    key={entry.id}
                    className={`flex flex-wrap items-start justify-between gap-3 px-4 py-3 ${
                      relation === "past" || cancelled ? "text-ink-muted dark:text-slate-400" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium ${cancelled ? "line-through" : ""}`}>
                        <span className="font-mono text-xs">
                          {timeRange(entry.start_time, entry.end_time)}
                        </span>
                        <span className="mx-2">·</span>
                        {entry.class_name}
                        <span className="ml-2 font-mono text-xs">{entry.course_code}</span>
                      </p>
                      {(entry.topic || entry.location) && (
                        <p className="mt-0.5 truncate text-xs">
                          {entry.topic}
                          {entry.topic && entry.location ? " · " : ""}
                          {entry.location}
                        </p>
                      )}
                      {cancelled && (
                        <p className="mt-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                          Cancelled{entry.cancel_reason ? `: ${entry.cancel_reason}` : ""}
                        </p>
                      )}
                    </div>
                    {(onCancel || onRestore) && (
                      <div className="flex shrink-0 items-center gap-2">
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
                          <span className="text-xs text-ink-muted dark:text-slate-400">
                            Cancelling is only possible before the day
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
