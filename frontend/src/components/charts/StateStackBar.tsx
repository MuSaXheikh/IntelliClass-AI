import { CHART_COLOR, formatDuration, stateShares } from "@/lib/report";
import { STATUS_META } from "@/lib/status";
import type { StudentState } from "@/types/contract";

interface Props {
  seconds: Partial<Record<StudentState, number>>;
  /** Accessible description of what the bar represents, e.g. the student's name. */
  label: string;
  className?: string;
}

/**
 * Horizontal stacked bar of time per state. Segments are separated by a 2px surface gap and
 * each carries a hover tooltip; exact numbers live in the table next to the chart.
 */
export function StateStackBar({ seconds, label, className = "" }: Props) {
  const shares = stateShares(seconds);
  if (shares.length === 0) {
    return (
      <div
        className={`h-3 w-full rounded bg-slate-100 dark:bg-slate-800 ${className}`}
        role="img"
        aria-label={`${label}: no data`}
      />
    );
  }
  const description = shares
    .map((s) => `${STATUS_META[s.state].label} ${s.pct.toFixed(0)}%`)
    .join(", ");
  return (
    <div
      className={`flex h-3 w-full gap-[2px] overflow-hidden rounded ${className}`}
      role="img"
      aria-label={`${label}: ${description}`}
    >
      {shares.map((s) => (
        <span
          key={s.state}
          className="block h-full first:rounded-l last:rounded-r"
          style={{ width: `${s.pct}%`, backgroundColor: CHART_COLOR[s.state] }}
          title={`${STATUS_META[s.state].label}: ${formatDuration(s.seconds)} (${s.pct.toFixed(0)}%)`}
        />
      ))}
    </div>
  );
}
