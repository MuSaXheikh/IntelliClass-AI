"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { sortStudents } from "@/lib/status";
import type { RosterStudent } from "@/types/contract";

/** Roster with status badges; signals only, never pictures (objective O8). */
export function StudentList({ students }: { students: readonly RosterStudent[] }) {
  const [filter, setFilter] = useState("");
  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const sorted = sortStudents(students);
    if (!query) return sorted;
    return sorted.filter(
      (s) =>
        s.full_name.toLowerCase().includes(query) ||
        (s.roll_no ?? "").toLowerCase().includes(query),
    );
  }, [students, filter]);

  return (
    <section
      aria-label="Students"
      className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon name="users" className="h-4 w-4 text-ink-muted" />
          Students
          <span className="font-mono text-xs font-medium text-ink-muted tabular-nums">
            {students.length}
          </span>
        </h2>
        <label className="sr-only" htmlFor="student-filter">
          Filter students
        </label>
        <div className="relative w-32">
          <Icon
            name="search"
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
          />
          <input
            id="student-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter"
            className="min-h-8 w-full rounded-lg border border-field bg-surface py-1 pl-8 pr-2 text-xs placeholder:text-ink-muted"
          />
        </div>
      </div>
      <ul className="max-h-80 divide-y divide-line overflow-y-auto">
        {visible.map((student) => (
          <li
            key={student.student_id}
            className={`flex items-center justify-between gap-2 px-4 py-2 text-sm ${student.connected ? "" : "text-ink-muted"}`}
          >
            <span className="min-w-0 truncate" title={student.full_name}>
              {student.full_name}
              {student.roll_no && (
                <span className="ml-2 font-mono text-xs text-ink-muted">{student.roll_no}</span>
              )}
            </span>
            <StatusBadge state={student.connected ? student.state : "connection_problem"} />
          </li>
        ))}
        {visible.length === 0 && (
          <li className="px-4 py-6 text-center text-xs text-ink-muted">
            {students.length === 0 ? "No students yet" : "No student matches that filter"}
          </li>
        )}
      </ul>
    </section>
  );
}
