"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScheduleTable } from "@/components/schedule/ScheduleTable";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { FileField, TextArea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { localToday } from "@/lib/schedule";
import type { ScheduleEntry, ScheduleUploadResult } from "@/types/contract";

function describe(caught: unknown): string {
  return caught instanceof ApiError ? caught.message : "Unexpected error";
}

export default function InstructorSchedulePage() {
  const toast = useToast();
  const [entries, setEntries] = useState<ScheduleEntry[] | null>(null);
  const [replace, setReplace] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ScheduleUploadResult | null>(null);
  const [cancelling, setCancelling] = useState<ScheduleEntry | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const today = localToday();

  const load = useCallback(
    () =>
      api
        .get<ScheduleEntry[]>("/schedule")
        .then(setEntries)
        .catch((caught: unknown) => {
          toast.push({
            kind: "error",
            title: "Could not load the schedule",
            description: describe(caught),
          });
          setEntries([]);
        }),
    [toast],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("mode", replace ? "replace" : "merge");
      const outcome = await api.upload<ScheduleUploadResult>("/schedule/upload", form);
      setResult(outcome);
      if (outcome.applied) {
        toast.push({
          kind: "success",
          title: "Schedule updated",
          description: `${outcome.added} added, ${outcome.updated} updated, ${outcome.removed} removed.`,
        });
        await load();
      }
    } catch (caught: unknown) {
      toast.push({ kind: "error", title: "Upload failed", description: describe(caught) });
    } finally {
      setUploading(false);
    }
  };

  const download = async (path: string, filename: string) => {
    try {
      await api.download(path, filename);
    } catch (caught: unknown) {
      toast.push({ kind: "error", title: "Download failed", description: describe(caught) });
    }
  };

  const replaceEntry = (updated: ScheduleEntry) =>
    setEntries((current) => current?.map((e) => (e.id === updated.id ? updated : e)) ?? null);

  const confirmCancel = async () => {
    if (!cancelling) return;
    setBusyId(cancelling.id);
    try {
      const updated = await api.post<ScheduleEntry>(`/schedule/${cancelling.id}/cancel`, {
        reason: reason.trim() || null,
      });
      replaceEntry(updated);
      toast.push({
        kind: "success",
        title: "Class cancelled",
        description: "Students see it as cancelled.",
      });
      setCancelling(null);
      setReason("");
    } catch (caught: unknown) {
      toast.push({ kind: "error", title: "Could not cancel", description: describe(caught) });
    } finally {
      setBusyId(null);
    }
  };

  const restore = async (entry: ScheduleEntry) => {
    setBusyId(entry.id);
    try {
      replaceEntry(await api.post<ScheduleEntry>(`/schedule/${entry.id}/restore`));
      toast.push({ kind: "success", title: "Class restored" });
    } catch (caught: unknown) {
      toast.push({ kind: "error", title: "Could not restore", description: describe(caught) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Schedule"
        description="Upload a sheet whenever the plan changes. Students of each class see it at once. A class can be cancelled only before the day it is held."
      />

      <Card>
        <CardHeader
          title="Update from a sheet"
          description={
            <>
              Columns:{" "}
              <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-xs">
                course_code, date, start, end, topic, location
              </code>
              . Dates as 2026-10-22 or 22/10/2026, times as 09:00 or 9:00 AM. Rows with the same
              class, date and start time update the existing entry. Nothing is applied if any row
              has an error.
            </>
          }
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  void download("/schedule/template.xlsx", "intelliclass-schedule-template.xlsx")
                }
              >
                <Icon name="download" />
                Download template
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!entries || entries.length === 0}
                onClick={() => void download("/schedule/export.xlsx", "intelliclass-schedule.xlsx")}
              >
                <Icon name="download" />
                Download current schedule as Excel
              </Button>
            </div>
          }
        />
        <div className="flex max-w-xl flex-col gap-3">
          <FileField
            label="Excel or CSV file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void upload(file);
            }}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
              disabled={uploading}
              className="h-4 w-4"
            />
            Replace all upcoming dates of the classes in this sheet
          </label>
        </div>
        {uploading && (
          <div className="mt-3">
            <Spinner label="Reading the sheet" />
          </div>
        )}
        {result && !result.applied && (
          <Notice tone="danger" className="mt-4" role="alert">
            <p className="font-medium">Nothing was changed. Fix these rows and upload again:</p>
            <ul className="mt-1 list-disc pl-5">
              {result.errors.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Notice>
        )}
      </Card>

      {entries === null ? (
        <Spinner label="Loading schedule" />
      ) : (
        <ScheduleTable
          entries={entries}
          today={today}
          busyId={busyId}
          onCancel={(entry) => {
            setReason("");
            setCancelling(entry);
          }}
          onRestore={(entry) => void restore(entry)}
          emptyText="Upload a sheet to publish the first dates."
        />
      )}

      <Modal
        open={cancelling !== null}
        title={
          cancelling
            ? `Cancel ${cancelling.class_name} on ${cancelling.scheduled_date}?`
            : "Cancel class"
        }
        onClose={() => setCancelling(null)}
      >
        <p className="text-sm">
          Students will see this class marked as cancelled. You can restore it any time before the
          day.
        </p>
        <div className="mt-3">
          <TextArea
            label="Reason (optional, shown to students)"
            value={reason}
            maxLength={300}
            rows={2}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => setCancelling(null)}
            disabled={busyId !== null}
          >
            Keep it
          </Button>
          <Button
            variant="destructive"
            onClick={() => void confirmCancel()}
            disabled={busyId !== null}
          >
            {busyId ? "Cancelling…" : "Cancel class"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
