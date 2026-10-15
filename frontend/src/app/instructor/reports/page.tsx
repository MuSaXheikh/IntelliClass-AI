"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/report";
import type { ClassSummary, Session } from "@/types/contract";

interface ClassSessions {
  cls: ClassSummary;
  sessions: Session[];
}

export default function ReportsPage() {
  const toast = useToast();
  const [items, setItems] = useState<ClassSessions[] | null>(null);

  useEffect(() => {
    api
      .get<ClassSummary[]>("/classes")
      .then((classes) =>
        Promise.all(
          classes.map(async (cls) => ({
            cls,
            sessions: await api.get<Session[]>(`/classes/${cls.id}/sessions`),
          })),
        ),
      )
      .then(setItems)
      .catch((caught: unknown) => {
        toast.push({
          kind: "error",
          title: "Could not load reports",
          description: caught instanceof ApiError ? caught.message : "Unexpected error",
        });
        setItems([]);
      });
  }, [toast]);

  if (items === null) return <Spinner label="Loading reports" />;
  const withSessions = items.filter((i) => i.sessions.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Reports</h1>
      {withSessions.length === 0 ? (
        <EmptyState title="No sessions yet">
          Reports appear here after a class has been held.
        </EmptyState>
      ) : (
        withSessions.map(({ cls, sessions }) => (
          <Card key={cls.id}>
            <p className="font-mono text-xs text-ink-muted dark:text-slate-400">
              {cls.course_code}
            </p>
            <h2 className="mb-2 text-lg font-semibold">{cls.name}</h2>
            <ul className="divide-y divide-line text-sm dark:divide-slate-700">
              {sessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {formatDateTime(s.started_at)}
                    <span className="ml-2 text-xs text-ink-muted dark:text-slate-400">
                      {s.status === "live" ? "● live" : "ended"}
                    </span>
                  </span>
                  <Link
                    href={`/instructor/sessions/${s.id}/report`}
                    className="text-primary underline-offset-2 hover:underline dark:text-green-300"
                  >
                    {s.status === "live" ? "Report so far" : "Open report"}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}
