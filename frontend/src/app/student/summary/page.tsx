"use client";

import { useEffect, useState } from "react";
import { StateLegend } from "@/components/charts/StateLegend";
import { StateStackBar } from "@/components/charts/StateStackBar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { CHART_STATE_ORDER, formatDateTime, formatPercent } from "@/lib/report";
import type { StudentSummary, StudentState } from "@/types/contract";

export default function MySummaryPage() {
  const toast = useToast();
  const [summary, setSummary] = useState<StudentSummary | null>(null);

  useEffect(() => {
    api
      .get<StudentSummary>("/me/summary")
      .then(setSummary)
      .catch((caught: unknown) => {
        toast.push({
          kind: "error",
          title: "Could not load your summary",
          description: caught instanceof ApiError ? caught.message : "Unexpected error",
        });
        setSummary({ sessions: [] });
      });
  }, [toast]);

  if (summary === null) return <Spinner label="Loading your summary" />;
  const used = CHART_STATE_ORDER.filter((s: StudentState) =>
    summary.sessions.some((row) => (row.seconds_by_state[s] ?? 0) > 0),
  );

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold">My summary</h1>
        <p className="text-sm text-ink-muted dark:text-slate-400">
          Only you can see this page. It shows your own attention and participation per class.
        </p>
      </header>
      {summary.sessions.length === 0 ? (
        <EmptyState title="No classes attended yet">
          Your summary fills in after you join a live class.
        </EmptyState>
      ) : (
        <>
          <StateLegend states={used} />
          <ul className="grid gap-4 sm:grid-cols-2">
            {summary.sessions.map((row) => (
              <li key={row.session_id}>
                <Card className="flex h-full flex-col gap-2">
                  <h2 className="text-lg font-semibold">{row.class_name}</h2>
                  <p className="text-sm text-ink-muted dark:text-slate-400">
                    {formatDateTime(row.started_at)}
                    {row.status === "live" && " · live now"}
                  </p>
                  <p className="text-3xl font-semibold tabular-nums">
                    {formatPercent(row.attention_pct)}
                    <span className="ml-2 text-sm font-normal text-ink-muted dark:text-slate-400">
                      attentive
                    </span>
                  </p>
                  <StateStackBar seconds={row.seconds_by_state} label={row.class_name} />
                  <p className="text-xs text-ink-muted dark:text-slate-400">
                    {row.alerts} alert{row.alerts === 1 ? "" : "s"} · {row.nudges} nudge
                    {row.nudges === 1 ? "" : "s"} received
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
