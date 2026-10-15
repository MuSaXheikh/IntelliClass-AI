import type { ScheduleEntry } from "@/types/contract";

export interface DayGroup {
  date: string;
  entries: ScheduleEntry[];
}

/** Consecutive entries with the same date form one group; the API already sorts by date/time. */
export function groupByDate(entries: readonly ScheduleEntry[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.date === entry.scheduled_date) last.entries.push(entry);
    else groups.push({ date: entry.scheduled_date, entries: [entry] });
  }
  return groups;
}

/** "09:00:00" → "09:00"; already short values pass through. */
export function formatTime(value: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : value;
}

export function timeRange(start: string, end: string | null): string {
  return end ? `${formatTime(start)} to ${formatTime(end)}` : formatTime(start);
}

/** "2026-10-22" → "Thu, 22 Oct 2026". Parsed at noon so no timezone shifts the day. */
export function formatDay(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Today's calendar date on this device as YYYY-MM-DD (display only; the server decides rules). */
export function localToday(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA");
}

export type DayRelation = "past" | "today" | "upcoming";

export function relativeDay(iso: string, today: string): DayRelation {
  if (iso < today) return "past";
  if (iso === today) return "today";
  return "upcoming";
}
