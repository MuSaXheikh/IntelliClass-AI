"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { SessionRows } from "@/components/classroom/SessionRows";
import { SlideImage } from "@/components/classroom/SlideImage";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { FileField, TextArea } from "@/components/ui/Input";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
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
      <PageHeader
        back={{ href: "/instructor", label: "All classes" }}
        eyebrow={cls.course_code}
        title={cls.name}
        actions={
          cls.live_session_id ? (
            <>
              <LiveBadge />
              <ButtonLink href={`/instructor/sessions/${cls.live_session_id}`}>
                Open live class
              </ButtonLink>
            </>
          ) : (
            <Button onClick={start} disabled={busy === "start"}>
              <Icon name="play" />
              {busy === "start" ? "Starting…" : "Start Live Class"}
            </Button>
          )
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Students" count={students.length} />
          <form onSubmit={enrol} className="flex flex-col gap-3">
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
          <ul className="mt-5 max-h-64 divide-y divide-line overflow-y-auto border-t border-line text-sm">
            {students.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2">
                <Avatar name={s.full_name} className="h-7 w-7" />
                <span className="min-w-0 flex-1 truncate">{s.full_name}</span>
                <span className="font-mono text-xs text-ink-muted">{s.roll_no}</span>
              </li>
            ))}
            {students.length === 0 && (
              <li className="py-4 text-center text-ink-muted">Nobody enrolled yet</li>
            )}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Slides"
            count={slides.length}
            action={
              slides.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy !== null || isLive}
                  onClick={() => setConfirm("remove")}
                >
                  <Icon name="trash" />
                  Remove deck
                </Button>
              ) : undefined
            }
          />
          <FileField
            label={
              slides.length > 0
                ? "Replace deck (PDF or PowerPoint)"
                : "Upload lecture slides (PDF or PowerPoint)"
            }
            hint={
              isLive
                ? "End the live class before changing the slides."
                : slides.length > 0
                  ? "Uploading a new file replaces every slide."
                  : "PDF, PowerPoint or ODP, up to 40 MB."
            }
            accept=".pdf,.ppt,.pptx,.odp,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.oasis.opendocument.presentation"
            disabled={busy !== null || isLive}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void upload(file);
            }}
          />
          {busy === "upload" && (
            <div className="mt-3">
              <Spinner label="Processing slides" />
            </div>
          )}
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {slides.map((slide) => (
              <li key={slide.index} className="text-xs">
                <SlideImage
                  classId={id}
                  index={slide.index}
                  alt={`Slide ${slide.index + 1}`}
                  version={slide.id}
                />
                <p className="mt-1 truncate text-ink-muted">
                  {slide.index + 1}. {slide.text_preview || "(no text)"}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Sessions" count={sessions.length} />
        {sessions.length === 0 ? (
          <p className="text-sm text-ink-muted">No class held yet.</p>
        ) : (
          <SessionRows sessions={sessions} />
        )}
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-4 border-danger-line">
        <div className="min-w-0 max-w-prose flex-1 basis-72">
          <h2 className="text-base font-semibold">Delete class</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Removes the roster, the deck, every session and its alerts and nudges, and the reports
            built from them. This cannot be undone.
          </p>
          {isLive && <p className="mt-1 text-xs text-ink-muted">End the live class first.</p>}
        </div>
        <Button
          variant="destructive"
          disabled={busy !== null || isLive}
          onClick={() => setConfirm("delete")}
        >
          <Icon name="trash" />
          Delete class
        </Button>
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
