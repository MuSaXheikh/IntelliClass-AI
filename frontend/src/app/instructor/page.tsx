"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { LiveBadge } from "@/components/ui/LiveBadge";
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Classes"
        description="Manage your rosters and slides, and start a live class."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Icon name="plus" />
            Create Class
          </Button>
        }
      />
      {classes === null ? (
        <Spinner label="Loading classes" />
      ) : classes.length === 0 ? (
        <EmptyState
          title="No classes yet"
          icon="layers"
          action={<Button onClick={() => setOpen(true)}>Create your first class</Button>}
        >
          Create a class to enrol students and upload slides.
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
                  {cls.live_session_id && <LiveBadge />}
                </div>
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="users" />
                    {cls.student_count} enrolled
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="layers" />
                    {cls.slide_count} slides
                  </span>
                </p>
                <div className="mt-auto flex gap-2 border-t border-line pt-4">
                  <ButtonLink
                    href={`/instructor/classes/${cls.id}`}
                    variant="secondary"
                    className="flex-1"
                  >
                    Manage
                  </ButtonLink>
                  {cls.live_session_id && (
                    <ButtonLink
                      href={`/instructor/sessions/${cls.live_session_id}`}
                      className="flex-1"
                    >
                      Open live class
                    </ButtonLink>
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
