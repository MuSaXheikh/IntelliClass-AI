"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AttentionTimeline } from "@/components/charts/AttentionTimeline";
import { StateLegend } from "@/components/charts/StateLegend";
import { StateStackBar } from "@/components/charts/StateStackBar";
import { StatTile } from "@/components/charts/StatTile";
import { TypeBars } from "@/components/charts/TypeBars";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { api, ApiError } from "@/lib/api";
import {
  CHART_STATE_ORDER,
  formatDateTime,
  formatDuration,
  formatPercent,
  sortByAttention,
} from "@/lib/report";
import type { ClassSummary, Report, Session, StudentRow, StudentState } from "@/types/contract";

interface Loaded {
  report: Report;
  session: Session;
  cls: ClassSummary;
}

const attended = (row: StudentRow): boolean =>
  Object.values(row.seconds_by_state).some((seconds) => (seconds ?? 0) > 0);

export default function SessionReportPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get<Report>(`/sessions/${id}/report`), api.get<Session>(`/sessions/${id}`)])
      .then(async ([report, session]) => {
        const cls = await api.get<ClassSummary>(`/classes/${report.class_id}`);
        if (!cancelled) setData({ report, session, cls });
      })
      .catch((caught: unknown) => {
        if (!cancelled)
          setError(caught instanceof ApiError ? caught.message : "Could not load the report");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <EmptyState title="Report unavailable">{error}</EmptyState>;
  if (!data) return <Spinner label="Building report" />;

  const { report, session, cls } = data;
  const rows = sortByAttention(report.per_student);
  const usedStates = CHART_STATE_ORDER.filter((s: StudentState) =>
    rows.some((r) => (r.seconds_by_state[s] ?? 0) > 0),
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-ink-muted dark:text-slate-400">{cls.course_code}</p>
          <h1 className="text-2xl font-bold">{cls.name}: class report</h1>
          <p className="text-sm text-ink-muted dark:text-slate-400">
            {formatDateTime(report.started_at)} · {formatDuration(report.duration_s)}
            {session.status === "live" && " · still live, numbers are provisional"}
          </p>
        </div>
        <Link
          href={`/instructor/classes/${cls.id}`}
          className="text-sm text-primary underline-offset-2 hover:underline dark:text-green-300"
        >
          Back to class
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Summary">
        <StatTile
          label="Average attention"
          value={formatPercent(report.avg_attention_pct)}
          hint={`${report.attended} of ${report.students} enrolled students joined`}
        />
        <StatTile label="Alerts raised" value={report.alerts_total} />
        <StatTile label="Nudges sent" value={report.nudges_total} />
        <StatTile
          label="Justified alerts"
          value={formatPercent(
            report.justified_alert_rate === null ? null : 100 * report.justified_alert_rate,
          )}
          hint="students who replied “I am back”"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Attention over the session</h2>
          <AttentionTimeline points={report.timeline} />
        </Card>
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Alerts by type</h2>
          <TypeBars counts={report.alerts_by_type} />
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Students</h2>
          <StateLegend states={usedStates} />
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-muted dark:text-slate-400">No students were enrolled.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-muted dark:text-slate-400">
                <tr>
                  <th className="py-2 pr-3 font-medium">Student</th>
                  <th className="py-2 pr-3 font-medium">Attention</th>
                  <th className="py-2 pr-3 font-medium">Time by state</th>
                  <th className="py-2 pr-3 text-right font-medium">Alerts</th>
                  <th className="py-2 text-right font-medium">Nudges</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line dark:divide-slate-700">
                {rows.map((r) => (
                  <tr key={r.student_id}>
                    <td className="py-2 pr-3">
                      <div>{r.full_name}</div>
                      <div className="font-mono text-xs text-ink-muted dark:text-slate-400">
                        {r.roll_no}
                      </div>
                    </td>
                    <td className="py-2 pr-3 font-mono tabular-nums">
                      {attended(r) ? (
                        formatPercent(r.attention_pct)
                      ) : (
                        <span className="font-sans text-xs text-ink-muted dark:text-slate-400">
                          did not join
                        </span>
                      )}
                    </td>
                    <td className="min-w-48 py-2 pr-3">
                      <StateStackBar seconds={r.seconds_by_state} label={r.full_name} />
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">{r.alerts}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{r.nudges}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
