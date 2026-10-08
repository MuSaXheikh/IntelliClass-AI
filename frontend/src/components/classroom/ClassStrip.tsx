import { SEVERITY_ORDER, STATUS_META, type StateCounts } from "@/lib/status";

/** One-line class summary: "42 attentive · 3 looking away · 1 sleepy". */
export function ClassStrip({ counts, connected }: { counts: StateCounts; connected: number }) {
  const parts = SEVERITY_ORDER.filter((state) => counts[state] > 0);
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" aria-label="Class summary">
      <span className="font-medium">{connected} connected</span>
      {parts.map((state) => (
        <span key={state} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${STATUS_META[state].dotClass}`}
          />
          {counts[state]} {STATUS_META[state].label.toLowerCase()}
        </span>
      ))}
    </p>
  );
}
