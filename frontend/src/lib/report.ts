import type { StudentRow, StudentState } from "@/types/contract";

/**
 * Segment order for stacked state bars. Checked with the dataviz palette validator: in this
 * order no two neighbouring colours are hard to tell apart for normal or colour-deficient
 * vision. The two greys are the neutral "no signal" states by design; every chart that uses
 * them also carries a legend with icons and a numeric table, so colour is never the only cue.
 */
export const CHART_STATE_ORDER: readonly StudentState[] = [
  "attentive",
  "uncertain",
  "sleepy",
  "wrong_screen",
  "looking_away",
  "connection_problem",
  "no_face",
  "camera_off",
];

/** Status colours from design.md §2.2 (same in light and dark; contrast checked on both). */
export const CHART_COLOR: Record<StudentState, string> = {
  attentive: "#16A34A",
  sleepy: "#DC2626",
  looking_away: "#D97706",
  no_face: "#EA580C",
  camera_off: "#64748B",
  wrong_screen: "#7C3AED",
  uncertain: "#94A3B8",
  connection_problem: "#2563EB",
};

export interface StateShare {
  state: StudentState;
  seconds: number;
  pct: number;
}

/** Non-zero states in chart order with their share of the total time. */
export function stateShares(seconds: Partial<Record<StudentState, number>>): StateShare[] {
  const total = CHART_STATE_ORDER.reduce((sum, s) => sum + (seconds[s] ?? 0), 0);
  if (total <= 0) return [];
  return CHART_STATE_ORDER.filter((s) => (seconds[s] ?? 0) > 0).map((s) => {
    const value = seconds[s] ?? 0;
    return { state: s, seconds: value, pct: (100 * value) / total };
  });
}

export interface StateCount {
  state: StudentState;
  count: number;
}

/** Non-zero counts, largest first; ties keep chart order so the result is stable. */
export function orderedCounts(counts: Partial<Record<StudentState, number>>): StateCount[] {
  return CHART_STATE_ORDER.filter((s) => (counts[s] ?? 0) > 0)
    .map((s) => ({ state: s, count: counts[s] ?? 0 }))
    .sort((a, b) => b.count - a.count);
}

/** Students who need the most attention first (lowest attention), then by roll number. */
export function sortByAttention(rows: readonly StudentRow[]): StudentRow[] {
  return [...rows].sort(
    (a, b) => a.attention_pct - b.attention_pct || (a.roll_no ?? "").localeCompare(b.roll_no ?? ""),
  );
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s} s`;
  const minutes = Math.floor(s / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${String(minutes % 60).padStart(2, "0")} min`;
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
