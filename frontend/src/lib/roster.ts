import type {
  Alert,
  RosterSnapshotPayload,
  RosterStudent,
  StatusUpdatePayload,
} from "@/types/contract";

export type RosterMap = Record<string, RosterStudent>;

export function applySnapshot(payload: RosterSnapshotPayload): RosterMap {
  const map: RosterMap = {};
  for (const student of payload.students) map[student.student_id] = student;
  return map;
}

export function applyStatusUpdate(roster: RosterMap, update: StatusUpdatePayload): RosterMap {
  const existing = roster[update.student_id];
  return {
    ...roster,
    [update.student_id]: {
      student_id: update.student_id,
      roll_no: update.roll_no,
      full_name: update.full_name,
      state: update.state,
      confidence: update.confidence,
      since: update.since,
      connected: existing?.connected ?? true,
    },
  };
}

/** Insert or replace an alert by id (used for both alert.new and alert.update). */
export function upsertAlert(alerts: readonly Alert[], alert: Alert): Alert[] {
  const index = alerts.findIndex((a) => a.id === alert.id);
  if (index === -1) return [...alerts, alert];
  const next = [...alerts];
  next[index] = alert;
  return next;
}
