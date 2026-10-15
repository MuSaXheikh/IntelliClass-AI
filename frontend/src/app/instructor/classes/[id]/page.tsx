"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { SlideImage } from "@/components/classroom/SlideImage";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { TextArea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/report";
import type {
  ClassSummary,
  EnrolResponse,
  Session,
  SlideInfo,
  SlideUploadResponse,
  User,
} from "@/types/contract";

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [cls, setCls] = useState<ClassSummary | null>(null);
  const [students, setStudents] = useState<User[]>([]);
  const [slides, setSlides] = useState<SlideInfo[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [rollText, setRollText] = useState("");
  const [busy, setBusy] = useState<"enrol" | "upload" | "start" | "remove" | "delete" | null>(null);
  const [confirm, setConfirm] = useState<"remove" | "delete" | null>(null);

  const load = useCallback(
    () =>
      Promise.all([
        api.get<ClassSummary>(`/classes/${id}`),
        api.get<User[]>(`/classes/${id}/students`),
        api.get<SlideInfo[]>(`/classes/${id}/slides`),
        api.get<Session[]>(`/classes/${id}/sessions`),
      ])
        .then(([detail, roster, deck, held]) => {
          setCls(detail);
          setStudents(roster);
          setSlides(deck);
          setSessions(held);
        })
        .catch((caught: unknown) => {
          toast.push({
            kind: "error",
            title: "Could not load class",
            description: describe(caught),
          });
        }),
    [id, toast],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const enrol = async (event: FormEvent) => {
    event.preventDefault();
    const rollNumbers = rollText
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (rollNumbers.length === 0) return;
    setBusy("enrol");
    try {
      const result = await api.post<EnrolResponse>(`/classes/${id}/enrol`, {
        roll_numbers: rollNumbers,
      });
      toast.push({
        kind: result.not_found.length ? "info" : "success",
        title: `${result.enrolled.length} enrolled`,
        description: result.not_found.length
          ? `Not found: ${result.not_found.join(", ")}`
          : undefined,
      });
      setRollText("");
      await load();
    } catch (caught) {
      toast.push({ kind: "error", title: "Enrolment failed", description: describe(caught) });
    } finally {
      setBusy(null);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy("upload");
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await api.upload<SlideUploadResponse>(`/classes/${id}/slides`, form);
      toast.push({ kind: "success", title: `${result.slide_count} slides ready` });
      await load();
    } catch (caught) {
      toast.push({ kind: "error", title: "Upload failed", description: describe(caught) });
    } finally {
      setBusy(null);
    }
  };

  const removeDeck = async () => {
    setBusy("remove");
    try {
      await api.delete<void>(`/classes/${id}/slides`);
      setConfirm(null);
      toast.push({ kind: "success", title: "Deck removed" });
      await load();
    } catch (caught) {
      toast.push({ kind: "error", title: "Could not remove deck", description: describe(caught) });
    } finally {
      setBusy(null);
    }
  };

  const deleteClass = async () => {
    setBusy("delete");
    try {
      await api.delete<void>(`/classes/${id}`);
      toast.push({ kind: "success", title: "Class deleted" });
      router.push("/instructor");
    } catch (caught) {
      toast.push({ kind: "error", title: "Could not delete class", description: describe(caught) });
      setBusy(null);
    }
  };

  const start = async () => {
    setBusy("start");
    try {
      const session = await api.post<Session>(`/classes/${id}/sessions`);
      router.push(`/instructor/sessions/${session.id}`);
    } catch (caught) {
      toast.push({ kind: "error", title: "Could not start class", description: describe(caught) });
      setBusy(null);
    }
  };

  if (!cls) return <Spinner label="Loading class" />;
  const isLive = Boolean(cls.live_session_id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-ink-muted dark:text-slate-400">{cls.course_code}</p>
          <h1 className="text-2xl font-bold">{cls.name}</h1>
        </div>
        {cls.live_session_id ? (
          <Button onClick={() => router.push(`/instructor/sessions/${cls.live_session_id}`)}>
            Open live class
          </Button>
        ) : (
          <Button onClick={start} disabled={busy === "start"}>
            {busy === "start" ? "Starting…" : "Start Live Class"}
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Students ({students.length})</h2>
          <form onSubmit={enrol} className="flex flex-col gap-2">
            <TextArea
              label="Enrol by roll number"
              hint="Paste roll numbers separated by spaces, commas or new lines"
              value={rollText}
              onChange={(e) => setRollText(e.target.value)}
              className="font-mono"
            />
            <Button type="submit" disabled={busy === "enrol"} className="self-start">
              {busy === "enrol" ? "Enrolling…" : "Enrol"}
            </Button>
          </form>
          <ul className="mt-4 max-h-64 divide-y divide-line overflow-y-auto text-sm dark:divide-slate-700">
            {students.map((s) => (
              <li key={s.id} className="flex justify-between py-1.5">
                <span>{s.full_name}</span>
                <span className="font-mono text-xs text-ink-muted dark:text-slate-400">
                  {s.roll_no}
                </span>
              </li>
            ))}
            {students.length === 0 && (
              <li className="py-2 text-ink-muted dark:text-slate-400">Nobody enrolled yet</li>
            )}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-2 text-lg font-semibold">Slides ({slides.length})</h2>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
              {slides.length > 0
                ? "Replace deck (PDF or PowerPoint)"
                : "Upload lecture slides (PDF or PowerPoint)"}
            </span>
            <input
              type="file"
              accept=".pdf,.ppt,.pptx,.odp,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.oasis.opendocument.presentation"
              disabled={busy !== null || isLive}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                void upload(file);
              }}
              className="text-sm"
            />
          </label>
          <p className="mt-1 text-xs text-ink-muted dark:text-slate-400">
            {isLive
              ? "End the live class before changing the slides."
              : slides.length > 0
                ? "Uploading a new file replaces every slide."
                : "PDF, PowerPoint or ODP, up to 40 MB."}
          </p>
          {slides.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              disabled={busy !== null || isLive}
              onClick={() => setConfirm("remove")}
            >
              Remove deck
            </Button>
          )}
          {busy === "upload" && <Spinner label="Processing slides" />}
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {slides.map((slide) => (
              <li key={slide.index} className="text-xs">
                <SlideImage
                  classId={id}
                  index={slide.index}
                  alt={`Slide ${slide.index + 1}`}
                  version={slide.id}
                />
                <p className="mt-1 truncate text-ink-muted dark:text-slate-400">
                  {slide.index + 1}. {slide.text_preview || "(no text)"}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <h2 className="mb-2 text-lg font-semibold">Sessions ({sessions.length})</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-ink-muted dark:text-slate-400">No class held yet.</p>
        ) : (
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
        )}
      </Card>

      <Card className="border-red-200 dark:border-red-900/60">
        <h2 className="mb-1 text-lg font-semibold">Delete class</h2>
        <p className="text-sm text-ink-muted dark:text-slate-400">
          Removes the roster, the deck, every session and its alerts and nudges, and the reports
          built from them. This cannot be undone.
        </p>
        <Button
          variant="destructive"
          size="sm"
          className="mt-3"
          disabled={busy !== null || isLive}
          onClick={() => setConfirm("delete")}
        >
          Delete class
        </Button>
        {isLive && (
          <p className="mt-2 text-xs text-ink-muted dark:text-slate-400">
            End the live class first.
          </p>
        )}
      </Card>

      <Modal open={confirm === "remove"} title="Remove the deck?" onClose={() => setConfirm(null)}>
        <p className="text-sm">
          All {slides.length} slides of {cls.name} will be deleted. You can upload a new file any
          time.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirm(null)} disabled={busy !== null}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void removeDeck()} disabled={busy !== null}>
            {busy === "remove" ? "Removing…" : "Remove deck"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={confirm === "delete"}
        title={`Delete ${cls.name}?`}
        onClose={() => setConfirm(null)}
      >
        <p className="text-sm">
          {students.length} enrolled students, {slides.length} slides and {sessions.length} sessions
          with their alerts, nudges and reports will be removed for good.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirm(null)} disabled={busy !== null}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void deleteClass()} disabled={busy !== null}>
            {busy === "delete" ? "Deleting…" : "Delete class"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function describe(caught: unknown): string {
  return caught instanceof ApiError ? caught.message : "Unexpected error";
}
