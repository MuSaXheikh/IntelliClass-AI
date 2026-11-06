import type { ReactNode } from "react";

/** A single headline number with its label; the number is the chart. */
export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-card">
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
