import { describe, expect, it } from "vitest";
import {
  CHART_STATE_ORDER,
  formatDuration,
  formatPercent,
  orderedCounts,
  reportFilename,
  sortByAttention,
  stateShares,
} from "@/lib/report";
import type { StudentRow } from "@/types/contract";

describe("stateShares", () => {
  it("returns non-zero states in chart order with percentages summing to 100", () => {
    const shares = stateShares({ sleepy: 30, attentive: 60, camera_off: 0, no_face: 10 });
    expect(shares.map((s) => s.state)).toEqual(["attentive", "sleepy", "no_face"]);
    expect(shares.reduce((sum, s) => sum + s.pct, 0)).toBeCloseTo(100);
    expect(shares[0].pct).toBeCloseTo(60);
  });
  it("is empty when there is no time at all", () => {
    expect(stateShares({})).toEqual([]);
  });
  it("never puts looking_away next to no_face", () => {
    const a = CHART_STATE_ORDER.indexOf("looking_away");
    const b = CHART_STATE_ORDER.indexOf("no_face");
    expect(Math.abs(a - b)).toBeGreaterThan(1);
  });
});

describe("orderedCounts", () => {
  it("sorts by count, largest first, dropping zeros", () => {
    const rows = orderedCounts({ sleepy: 2, wrong_screen: 5, uncertain: 0 });
    expect(rows).toEqual([
      { state: "wrong_screen", count: 5 },
      { state: "sleepy", count: 2 },
    ]);
  });
});

describe("sortByAttention", () => {
  const row = (name: string, pct: number, roll: string): StudentRow => ({
    student_id: name,
    roll_no: roll,
    full_name: name,
    attention_pct: pct,
    seconds_by_state: {},
    alerts: 0,
    nudges: 0,
  });
  it("puts the student who needs attention first and breaks ties by roll number", () => {
    const sorted = sortByAttention([row("A", 90, "2"), row("B", 40, "9"), row("C", 40, "1")]);
    expect(sorted.map((r) => r.full_name)).toEqual(["C", "B", "A"]);
  });
});

describe("formatters", () => {
  it("formats durations at the right unit", () => {
    expect(formatDuration(45)).toBe("45 s");
    expect(formatDuration(610)).toBe("10 min");
    expect(formatDuration(3900)).toBe("1 h 05 min");
  });
  it("formats percentages and dashes for missing values", () => {
    expect(formatPercent(41.44)).toBe("41%");
    expect(formatPercent(41.44, 1)).toBe("41.4%");
    expect(formatPercent(null)).toBe("—");
  });
});

describe("reportFilename", () => {
  it("uses the course code and the class date", () => {
    expect(reportFilename("CS-401", "2026-10-16T09:30:00Z")).toBe(
      "intelliclass-report-CS-401-2026-10-16.pdf",
    );
  });

  it("sanitises odd codes and tolerates a bad date", () => {
    expect(reportFilename("CS 401/B", "nope")).toBe("intelliclass-report-CS_401_B-undated.pdf");
    expect(reportFilename("", "2026-10-16T09:30:00Z")).toBe(
      "intelliclass-report-class-2026-10-16.pdf",
    );
  });
});
