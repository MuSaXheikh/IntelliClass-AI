"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { SlideImage } from "@/components/classroom/SlideImage";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { TextArea } from "@/components/ui/Input";
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
  const [rollText, setRollText] = useState("");
  const [busy, setBusy] = useState<"enrol" | "upload" | "start" | null>(null);

  const load = useCallback(
    () =>
      Promise.all([
        api.get<ClassSummary>(`/classes/${id}`),
        api.get<User[]>(`/classes/${id}/students`),
        api.get<SlideInfo[]>(`/classes/${id}/slides`),
      ])
        .then(([detail, roster, deck]) => {
          setCls(detail);
          setStudents(roster);
          setSlides(deck);
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
            <span className="font-medium">Upload lecture slides (PDF)</span>
            <input
              type="file"
              accept="application/pdf"
              disabled={busy === "upload"}
              onChange={(e) => void upload(e.target.files?.[0])}
              className="text-sm"
            />
          </label>
          {busy === "upload" && <Spinner label="Processing slides" />}
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {slides.map((slide) => (
              <li key={slide.index} className="text-xs">
                <SlideImage classId={id} index={slide.index} alt={`Slide ${slide.index + 1}`} />
                <p className="mt-1 truncate text-ink-muted dark:text-slate-400">
                  {slide.index + 1}. {slide.text_preview || "(no text)"}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function describe(caught: unknown): string {
  return caught instanceof ApiError ? caught.message : "Unexpected error";
}
