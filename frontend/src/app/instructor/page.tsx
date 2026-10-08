"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import type { ClassSummary } from "@/types/contract";

export default function ClassManagerPage() {
  const toast = useToast();
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      api
        .get<ClassSummary[]>("/classes")
        .then(setClasses)
        .catch((caught: unknown) => {
          toast.push({
            kind: "error",
            title: "Could not load classes",
            description: errorText(caught),
          });
          setClasses([]);
        }),
    [toast],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post<ClassSummary>("/classes", {
        name: name.trim(),
        course_code: courseCode.trim(),
      });
      toast.push({ kind: "success", title: "Class created" });
      setOpen(false);
      setName("");
      setCourseCode("");
      await load();
    } catch (caught) {
      toast.push({
        kind: "error",
        title: "Could not create class",
        description: errorText(caught),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Classes</h1>
        <Button onClick={() => setOpen(true)}>Create Class</Button>
      </div>
      {classes === null ? (
        <Spinner label="Loading classes" />
      ) : classes.length === 0 ? (
        <EmptyState title="No classes yet">
          Create your first class to enrol students and upload slides.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <li key={cls.id}>
              <Card className="flex h-full flex-col gap-2">
                <div>
                  <p className="font-mono text-xs text-ink-muted dark:text-slate-400">
                    {cls.course_code}
                  </p>
                  <h2 className="text-lg font-semibold">{cls.name}</h2>
                </div>
                <p className="text-sm text-ink-muted dark:text-slate-400">
                  {cls.student_count} enrolled · {cls.slide_count} slides
                </p>
                {cls.live_session_id && (
                  <p className="text-xs font-medium text-green-700 dark:text-green-300">
                    ● Live now
                  </p>
                )}
                <div className="mt-auto flex gap-2 pt-2">
                  <Link href={`/instructor/classes/${cls.id}`} className="flex-1">
                    <Button variant="secondary" className="w-full">
                      Manage
                    </Button>
                  </Link>
                  {cls.live_session_id && (
                    <Link href={`/instructor/sessions/${cls.live_session_id}`} className="flex-1">
                      <Button className="w-full">Open live class</Button>
                    </Link>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} title="Create Class" onClose={() => setOpen(false)}>
        <form onSubmit={create} className="flex flex-col gap-4">
          <Input
            label="Class name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Course code"
            required
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value)}
            className="font-mono"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function errorText(caught: unknown): string {
  return caught instanceof ApiError ? caught.message : "Unexpected error";
}
