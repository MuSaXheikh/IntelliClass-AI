"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AttentionTimeline } from "@/components/charts/AttentionTimeline";
import { StateLegend } from "@/components/charts/StateLegend";
import { StateStackBar } from "@/components/charts/StateStackBar";
import { StatTile } from "@/components/charts/StatTile";
import { TypeBars } from "@/components/charts/TypeBars";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import {
  CHART_STATE_ORDER,
  formatDateTime,
  formatDuration,
  formatPercent,
  reportFilename,
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
  const [downloading, setDownloading] = useState(false);
  const toast = useToast();

  const downloadPdf = async (courseCode: string, startedAt: string) => {
    setDownloading(true);
    try {
      await api.download(`/sessions/${id}/report.pdf`, reportFilename(courseCode, startedAt));
    } catch (caught: unknown) {
      toast.push({
        kind: "error",
        title: "Could not download the PDF",
        description: caught instanceof ApiError ? caught.message : "Unexpected error",
      });
    } finally {
      setDownloading(false);
    }
  };

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
      <PageHeader
        back={{ href: `/instructor/classes/${cls.id}`, label: "Back to class" }}
        eyebrow={cls.course_code}
        title={`${cls.name}: class report`}
        description={
          <>
            {formatDateTime(report.started_at)} · {formatDuration(report.duration_s)}
            {session.status === "live" && " · still live, numbers are provisional"}
          </>
        }
        actions={
          <Button
            variant="secondary"
            disabled={downloading}
            onClick={() => void downloadPdf(cls.course_code, report.started_at)}
          >
            <Icon name="download" />
            {downloading ? "Preparing PDF…" : "Download PDF"}
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Summary">
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

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader title="Attention over the session" />
          <AttentionTimeline points={report.timeline} />
        </Card>
        <Card>
          <CardHeader title="Alerts by type" />
          <TypeBars counts={report.alerts_by_type} />
        </Card>
      </div>

      <Card pad="none">
        <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-4">
          <h2 className="text-base font-semibold">Students</h2>
          <StateLegend states={usedStates} />
        </div>
        {rows.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-ink-muted">No students were enrolled.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-y border-line bg-surface-muted text-xs text-ink-muted">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">Student</th>
                  <th className="py-2.5 pr-4 font-semibold">Attention</th>
                  <th className="py-2.5 pr-4 font-semibold">Time by state</th>
                  <th className="py-2.5 pr-4 text-right font-semibold">Alerts</th>
                  <th className="py-2.5 pr-5 text-right font-semibold">Nudges</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.student_id}>
                    <td className="px-5 py-2.5">
                      <div className="whitespace-nowrap font-medium">{r.full_name}</div>
                      <div className="font-mono text-xs text-ink-muted">{r.roll_no}</div>
                    </td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums">
                      {attended(r) ? (
                        formatPercent(r.attention_pct)
                      ) : (
                        <span className="font-sans text-xs text-ink-muted">did not join</span>
                      )}
                    </td>
                    <td className="min-w-48 py-2.5 pr-4">
                      <StateStackBar seconds={r.seconds_by_state} label={r.full_name} />
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums">{r.alerts}</td>
                    <td className="py-2.5 pr-5 text-right font-mono tabular-nums">{r.nudges}</td>
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
