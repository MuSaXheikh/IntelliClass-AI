import type { Alert, RosterStudent, StudentState } from "@/types/contract";

export type IconName =
  | "check-circle"
  | "moon"
  | "eye-off"
  | "user-x"
  | "video-off"
  | "monitor"
  | "help-circle"
  | "wifi-off";

export interface StatusMeta {
  label: string;
  /** Short instructor-facing meaning (design.md Table 2). */
  meaning: string;
  icon: IconName;
  /** Tailwind classes: tinted pill, readable in light and dark. */
  pillClass: string;
  /** Solid dot colour for the class strip. */
  dotClass: string;
}

export const STATUS_META: Record<StudentState, StatusMeta> = {
  attentive: {
    label: "Attentive",
    meaning: "Present and following the lecture",
    icon: "check-circle",
    pillClass: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
    dotClass: "bg-green-600",
  },
  sleepy: {
    label: "Sleepy",
    meaning: "Eyes have stayed closed for too long",
    icon: "moon",
    pillClass: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
    dotClass: "bg-red-600",
  },
  looking_away: {
    label: "Looking away",
    meaning: "Attention has been off the lecture for a while",
    icon: "eye-off",
    pillClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    dotClass: "bg-amber-600",
  },
  no_face: {
    label: "No face",
    meaning: "Not in front of the camera",
    icon: "user-x",
    pillClass: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
    dotClass: "bg-orange-600",
  },
  camera_off: {
    label: "Camera off",
    meaning: "Camera switched off or blocked",
    icon: "video-off",
    pillClass: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    dotClass: "bg-slate-500",
  },
  wrong_screen: {
    label: "Wrong screen",
    meaning: "Visible content no longer matches the slide",
    icon: "monitor",
    pillClass: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
    dotClass: "bg-violet-600",
  },
  uncertain: {
    label: "Uncertain",
    meaning: "Conditions too poor to judge fairly",
    icon: "help-circle",
    pillClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    dotClass: "bg-slate-400",
  },
  connection_problem: {
    label: "Connection problem",
    meaning: "Losing the class, not ignoring it",
    icon: "wifi-off",
    pillClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
    dotClass: "bg-blue-600",
  },
};

/** Severity order, highest first (memory.md §6). */
export const SEVERITY_ORDER: readonly StudentState[] = [
  "sleepy",
  "no_face",
  "wrong_screen",
  "looking_away",
  "camera_off",
  "uncertain",
  "connection_problem",
  "attentive",
];

export function severityRank(state: StudentState): number {
  const index = SEVERITY_ORDER.indexOf(state);
  return index === -1 ? SEVERITY_ORDER.length : index;
}

const STATUS_WEIGHT: Record<Alert["status"], number> = { open: 0, acknowledged: 1, resolved: 2 };

/** Open alerts first, then by severity, then most recently updated. Pure; returns a new array. */
export function sortAlerts(alerts: readonly Alert[]): Alert[] {
  return [...alerts].sort((a, b) => {
    const byStatus = STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status];
    if (byStatus !== 0) return byStatus;
    const bySeverity = severityRank(a.type) - severityRank(b.type);
    if (bySeverity !== 0) return bySeverity;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

export type StateCounts = Record<StudentState, number>;

export function emptyCounts(): StateCounts {
  return {
    attentive: 0,
    sleepy: 0,
    looking_away: 0,
    no_face: 0,
    camera_off: 0,
    wrong_screen: 0,
    uncertain: 0,
    connection_problem: 0,
  };
}

/** Counts per state over connected students only. */
export function countStates(students: readonly RosterStudent[]): StateCounts {
  const counts = emptyCounts();
  for (const student of students) {
    if (student.connected) counts[student.state] += 1;
  }
  return counts;
}

/** Students sorted by severity (needs-attention first) then by roll number. */
export function sortStudents(students: readonly RosterStudent[]): RosterStudent[] {
  return [...students].sort((a, b) => {
    if (a.connected !== b.connected) return a.connected ? -1 : 1;
    const bySeverity = severityRank(a.state) - severityRank(b.state);
    if (bySeverity !== 0) return bySeverity;
    return (a.roll_no ?? "").localeCompare(b.roll_no ?? "");
  });
}
