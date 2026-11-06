import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { formatDateTime } from "@/lib/report";
import type { Session } from "@/types/contract";

/** Held sessions of one class, each linking to its report. */
export function SessionRows({ sessions }: { sessions: readonly Session[] }) {
  return (
    <ul className="divide-y divide-line text-sm">
      {sessions.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
          <span className="flex flex-wrap items-center gap-2.5">
            <span className="tabular-nums">{formatDateTime(s.started_at)}</span>
            {s.status === "live" ? (
              <LiveBadge label="Live" />
            ) : (
              <span className="text-xs text-ink-muted">Ended</span>
            )}
          </span>
          <Link
            href={`/instructor/sessions/${s.id}/report`}
            className="inline-flex items-center gap-1 rounded font-medium text-primary-ink underline-offset-2 hover:underline"
          >
            {s.status === "live" ? "Report so far" : "Open report"}
            <Icon name="arrow-right" className="h-3.5 w-3.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
