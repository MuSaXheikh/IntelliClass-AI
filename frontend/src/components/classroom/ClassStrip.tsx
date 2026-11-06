import { Icon } from "@/components/ui/Icon";
import { SEVERITY_ORDER, STATUS_META, type StateCounts } from "@/lib/status";

/** Glanceable class summary: how many are connected, then one icon + count + label per state. */
export function ClassStrip({ counts, connected }: { counts: StateCounts; connected: number }) {
  const parts = SEVERITY_ORDER.filter((state) => counts[state] > 0);
  return (
    <section
      aria-label="Class summary"
      className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:gap-5"
    >
      <p className="flex shrink-0 items-baseline gap-1.5">
        <span className="font-mono text-2xl font-semibold tabular-nums">{connected}</span>
        <span className="text-sm text-ink-muted">connected</span>
      </p>
      {parts.length > 0 ? (
        <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 border-line text-sm sm:border-l sm:pl-5">
          {parts.map((state) => (
            <li key={state} className="inline-flex items-center gap-1.5">
              <span className={`rounded-full px-1.5 py-0.5 ${STATUS_META[state].pillClass}`}>
                <Icon name={STATUS_META[state].icon} className="h-3.5 w-3.5" />
              </span>
              <span className="font-mono font-medium tabular-nums">{counts[state]}</span>
              <span className="text-ink-muted">{STATUS_META[state].label.toLowerCase()}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">Waiting for students to join.</p>
      )}
    </section>
  );
}
