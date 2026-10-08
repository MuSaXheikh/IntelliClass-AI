"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
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
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">My classes</h1>
      {classes === null ? (
        <Spinner label="Loading classes" />
      ) : classes.length === 0 ? (
        <EmptyState title="You are not enrolled in any class yet">
          Ask your instructor to enrol your roll number.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <li key={cls.id}>
              <Card className="flex h-full flex-col gap-2">
                <p className="font-mono text-xs text-ink-muted dark:text-slate-400">
                  {cls.course_code}
                </p>
                <h2 className="text-lg font-semibold">{cls.name}</h2>
                <p className="text-sm text-ink-muted dark:text-slate-400">
                  {cls.live_session_id ? "● Live now" : "Not live"}
                </p>
                <div className="mt-auto pt-2">
                  {cls.live_session_id ? (
                    <Link href={`/student/sessions/${cls.live_session_id}/consent`}>
                      <Button className="w-full">Join</Button>
                    </Link>
                  ) : (
                    <Button className="w-full" disabled>
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
