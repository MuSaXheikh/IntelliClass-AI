import { describe, expect, it } from "vitest";
import { applySnapshot, applyStatusUpdate, upsertAlert } from "@/lib/roster";
import { countStates, severityRank, sortAlerts, sortStudents } from "@/lib/status";
import type { Alert, RosterStudent } from "@/types/contract";

function alert(overrides: Partial<Alert>): Alert {
  return {
    id: "a",
    session_id: "s",
    student_id: "u",
    roll_no: "1",
    full_name: "Student",
    type: "looking_away",
    severity: 3,
    confidence: 0.9,
    duration_s: 10,
    grouped_count: 1,
    status: "open",
    created_at: "2027-02-10T09:00:00Z",
    updated_at: "2027-02-10T09:00:00Z",
    ...overrides,
  };
}

describe("sortAlerts", () => {
  it("orders open before resolved, then by severity, then most recent", () => {
    const input = [
      alert({ id: "resolved-sleepy", type: "sleepy", status: "resolved" }),
      alert({ id: "away-old", type: "looking_away", updated_at: "2027-02-10T09:00:00Z" }),
      alert({ id: "wrong-screen", type: "wrong_screen" }),
      alert({ id: "sleepy", type: "sleepy" }),
      alert({ id: "away-new", type: "looking_away", updated_at: "2027-02-10T09:05:00Z" }),
      alert({ id: "no-face", type: "no_face" }),
    ];
    expect(sortAlerts(input).map((a) => a.id)).toEqual([
      "sleepy",
      "no-face",
      "wrong-screen",
      "away-new",
      "away-old",
      "resolved-sleepy",
    ]);
  });

  it("does not mutate its input", () => {
    const input = [alert({ id: "1", type: "camera_off" }), alert({ id: "2", type: "sleepy" })];
    sortAlerts(input);
    expect(input.map((a) => a.id)).toEqual(["1", "2"]);
  });

  it("ranks attentive last", () => {
    expect(severityRank("sleepy")).toBeLessThan(severityRank("attentive"));
  });
});

const student = (id: string, state: RosterStudent["state"], connected = true): RosterStudent => ({
  student_id: id,
  roll_no: id,
  full_name: `S ${id}`,
  state,
  confidence: 1,
  since: null,
  connected,
});

describe("roster helpers", () => {
  it("counts only connected students and sorts needs-attention first", () => {
    const students = [
      student("1", "attentive"),
      student("2", "sleepy"),
      student("3", "sleepy", false),
    ];
    expect(countStates(students)).toMatchObject({ attentive: 1, sleepy: 1 });
    expect(sortStudents(students).map((s) => s.student_id)).toEqual(["2", "1", "3"]);
  });

  it("applies snapshots and updates, preserving connection flags", () => {
    const roster = applySnapshot({ students: [student("1", "attentive", false)] });
    const next = applyStatusUpdate(roster, {
      student_id: "1",
      roll_no: "1",
      full_name: "S 1",
      state: "sleepy",
      confidence: 0.8,
      since: "2027-02-10T09:00:00Z",
    });
    expect(next["1"].state).toBe("sleepy");
    expect(next["1"].connected).toBe(false);
  });

  it("upserts alerts by id", () => {
    const list = upsertAlert([], alert({ id: "x" }));
    const updated = upsertAlert(list, alert({ id: "x", grouped_count: 3 }));
    expect(updated).toHaveLength(1);
    expect(updated[0].grouped_count).toBe(3);
  });
});
