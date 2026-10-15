import { Icon } from "@/components/ui/Icon";
import { CHART_COLOR, orderedCounts } from "@/lib/report";
import { STATUS_META } from "@/lib/status";
import type { StudentState } from "@/types/contract";

/** Horizontal bars for a count per state (alerts by type). Labels carry identity; colour echoes it. */
export function TypeBars({ counts }: { counts: Partial<Record<StudentState, number>> }) {
  const rows = orderedCounts(counts);
  if (rows.length === 0) {
    return <p className="text-sm text-ink-muted dark:text-slate-400">No alerts were raised.</p>;
  }
  const max = rows[0].count;
  return (
    <ul className="flex flex-col gap-2" aria-label="Alerts by type">
      {rows.map(({ state, count }) => (
        <li key={state} className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 truncate">
            <Icon name={STATUS_META[state].icon} className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{STATUS_META[state].label}</span>
          </span>
          <span className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800">
            <span
              className="block h-full rounded"
              style={{ width: `${(100 * count) / max}%`, backgroundColor: CHART_COLOR[state] }}
              title={`${STATUS_META[state].label}: ${count}`}
            />
          </span>
          <span className="text-right font-mono text-xs tabular-nums">{count}</span>
        </li>
      ))}
    </ul>
  );
}
