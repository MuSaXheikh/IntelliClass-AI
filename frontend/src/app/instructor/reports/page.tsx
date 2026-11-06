"use client";

import { useEffect, useState } from "react";
import { SessionRows } from "@/components/classroom/SessionRows";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        description="Attention, alerts and nudges for every class you have held."
      />
      {withSessions.length === 0 ? (
        <EmptyState title="No sessions yet" icon="bar-chart">
          Reports appear here after a class has been held.
        </EmptyState>
      ) : (
        withSessions.map(({ cls, sessions }) => (
          <Card key={cls.id}>
            <p className="font-mono text-xs font-medium text-ink-muted">{cls.course_code}</p>
            <h2 className="mb-2 mt-0.5 text-lg font-semibold">{cls.name}</h2>
            <SessionRows sessions={sessions} />
          </Card>
        ))
      )}
    </div>
  );
}
