"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import type { ClassSummary } from "@/types/contract";

export default function StudentHomePage() {
  const toast = useToast();
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);

  useEffect(() => {
    api
      .get<ClassSummary[]>("/classes")
      .then(setClasses)
      .catch((caught) => {
        toast.push({
          kind: "error",
          title: "Could not load classes",
          description: caught instanceof ApiError ? caught.message : "Unexpected error",
        });
        setClasses([]);
      });
  }, [toast]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My classes"
        description="Join a class when it goes live. Your camera is analysed on your device, and no video is sent."
      />
      {classes === null ? (
        <Spinner label="Loading classes" />
      ) : classes.length === 0 ? (
        <EmptyState title="You are not enrolled in any class yet" icon="book-open">
          Ask your instructor to enrol your roll number.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <li key={cls.id}>
              <Card className="flex h-full flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-medium text-ink-muted">
                      {cls.course_code}
                    </p>
                    <h2 className="mt-0.5 text-lg font-semibold">{cls.name}</h2>
                  </div>
                  {cls.live_session_id ? (
                    <LiveBadge />
                  ) : (
                    <span className="whitespace-nowrap text-xs text-ink-muted">Not live</span>
                  )}
                </div>
                <div className="mt-auto border-t border-line pt-4">
                  {cls.live_session_id ? (
                    <ButtonLink
                      href={`/student/sessions/${cls.live_session_id}/consent`}
                      className="w-full"
                    >
                      Join
                    </ButtonLink>
                  ) : (
                    <Button variant="secondary" className="w-full" disabled>
                      Join
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
