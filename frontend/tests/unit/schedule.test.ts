import { describe, expect, it } from "vitest";
import {
  formatDay,
  formatTime,
  groupByDate,
  localToday,
  relativeDay,
  timeRange,
} from "@/lib/schedule";
import type { ScheduleEntry } from "@/types/contract";

function entry(id: string, date: string, start: string): ScheduleEntry {
  return {
    id,
    class_id: "c",
    class_name: "AI 101",
    course_code: "CS-401",
    scheduled_date: date,
    start_time: start,
    end_time: null,
    topic: "",
    location: "",
    status: "scheduled",
    cancel_reason: null,
    cancelled_at: null,
    can_cancel: true,
    can_restore: false,
  };
}

describe("schedule helpers", () => {
  it("groups consecutive entries by date", () => {
    const groups = groupByDate([
      entry("a", "2026-10-22", "09:00:00"),
      entry("b", "2026-10-22", "14:00:00"),
      entry("c", "2026-10-24", "09:00:00"),
    ]);
    expect(groups.map((g) => [g.date, g.entries.length])).toEqual([
      ["2026-10-22", 2],
      ["2026-10-24", 1],
    ]);
    expect(groupByDate([])).toEqual([]);
  });

  it("formats times and ranges", () => {
    expect(formatTime("09:00:00")).toBe("09:00");
    expect(formatTime("9:05")).toBe("09:05");
    expect(timeRange("09:00:00", "10:30:00")).toBe("09:00 to 10:30");
    expect(timeRange("16:00:00", null)).toBe("16:00");
  });

  it("formats days without timezone drift and tolerates bad input", () => {
    expect(formatDay("2026-10-22")).toMatch(/Thu, 22 Oct 2026/);
    expect(formatDay("nonsense")).toBe("nonsense");
  });

  it("classifies days relative to today", () => {
    expect(relativeDay("2026-10-21", "2026-10-22")).toBe("past");
    expect(relativeDay("2026-10-22", "2026-10-22")).toBe("today");
    expect(relativeDay("2026-10-23", "2026-10-22")).toBe("upcoming");
    expect(localToday(new Date(2026, 9, 22, 23, 30))).toBe("2026-10-22");
  });
});
