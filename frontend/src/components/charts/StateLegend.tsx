import { Icon } from "@/components/ui/Icon";
import { CHART_COLOR } from "@/lib/report";
import { STATUS_META } from "@/lib/status";
import type { StudentState } from "@/types/contract";

/** Swatch + icon + label per state, so a chart's identity never depends on colour alone. */
export function StateLegend({ states }: { states: readonly StudentState[] }) {
  if (states.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted dark:text-slate-400">
      {states.map((state) => (
        <li key={state} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: CHART_COLOR[state] }}
          />
          <Icon name={STATUS_META[state].icon} className="h-3.5 w-3.5" />
          <span>{STATUS_META[state].label}</span>
        </li>
      ))}
    </ul>
  );
}
