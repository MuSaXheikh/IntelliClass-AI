"use client";

import { useMemo, useState } from "react";
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
    <section aria-label="Students" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted dark:text-slate-400">
          Students ({students.length})
        </h2>
        <label className="sr-only" htmlFor="student-filter">
          Filter students
        </label>
        <input
          id="student-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter"
          className="w-28 rounded-lg border border-line bg-surface px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
        />
      </div>
      <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-lg border border-line dark:divide-slate-700 dark:border-slate-700">
        {visible.map((student) => (
          <li
            key={student.student_id}
            className={`flex items-center justify-between gap-2 px-3 py-2 text-sm ${student.connected ? "" : "opacity-50"}`}
          >
            <span className="min-w-0 truncate">
              {student.full_name}
              {student.roll_no && (
                <span className="ml-2 font-mono text-xs text-ink-muted dark:text-slate-400">
                  {student.roll_no}
                </span>
              )}
            </span>
            <StatusBadge state={student.connected ? student.state : "connection_problem"} />
          </li>
        ))}
        {visible.length === 0 && (
          <li className="px-3 py-4 text-center text-xs text-ink-muted dark:text-slate-400">
            No students yet
          </li>
        )}
      </ul>
    </section>
  );
}
