"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AlertPanel } from "@/components/classroom/AlertPanel";
import { ClassStrip } from "@/components/classroom/ClassStrip";
import { SlideStage } from "@/components/classroom/SlideStage";
import { StudentList } from "@/components/classroom/StudentList";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useSessionSocket } from "@/hooks/useSessionSocket";
import { api, ApiError } from "@/lib/api";
import { applySnapshot, applyStatusUpdate, upsertAlert, type RosterMap } from "@/lib/roster";
import { countStates } from "@/lib/status";
import type { Alert, Nudge, Session } from "@/types/contract";

const VideoStage = dynamic(
  () => import("@/components/classroom/VideoStage").then((m) => m.VideoStage),
  { ssr: false },
);

/**
 * The instructor may receive optional LiveKit credentials on GET /sessions/{id}
 * (interpretation of the contract; the student path uses POST /sessions/{id}/join).
 */
type InstructorSession = Session & { livekit_url?: string | null; livekit_token?: string | null };

export default function InstructorLiveRoomPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { token } = useAuth();
  const [session, setSession] = useState<InstructorSession | null>(null);
  const [roster, setRoster] = useState<RosterMap>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [slideBusy, setSlideBusy] = useState(false);
  const [nudgingId, setNudgingId] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const socket = useSessionSocket(sessionId, token);

  useEffect(() => {
    Promise.all([
      api.get<InstructorSession>(`/sessions/${sessionId}`),
      api.get<Alert[]>(`/sessions/${sessionId}/alerts`),
    ])
      .then(([loaded, history]) => {
        setSession(loaded);
        setAlerts(history);
      })
      .catch((caught) => {
        toast.push({
          kind: "error",
          title: "Could not open session",
          description: describe(caught),
        });
        router.replace("/instructor");
      });
  }, [sessionId, router, toast]);

  useEffect(() => {
    const unsubscribe = [
      socket.subscribe("roster.snapshot", (payload) => setRoster(applySnapshot(payload))),
      socket.subscribe("status.update", (payload) =>
        setRoster((r) => applyStatusUpdate(r, payload)),
      ),
      socket.subscribe("alert.new", (alert) => setAlerts((a) => upsertAlert(a, alert))),
      socket.subscribe("alert.update", (alert) => setAlerts((a) => upsertAlert(a, alert))),
      socket.subscribe("slide.changed", ({ slide_index }) =>
        setSession((s) => (s ? { ...s, current_slide_index: slide_index } : s)),
      ),
      socket.subscribe("session.ended", () => {
        toast.push({ title: "Class ended" });
        setSession((s) => {
          router.replace(s ? `/instructor/classes/${s.class_id}` : "/instructor");
          return s;
        });
      }),
      socket.subscribe("error", (payload) => toast.push({ kind: "error", title: payload.message })),
    ];
    return () => unsubscribe.forEach((fn) => fn());
  }, [socket, router, toast]);

  const students = useMemo(() => Object.values(roster), [roster]);
  const counts = useMemo(() => countStates(students), [students]);
  const connected = students.filter((s) => s.connected).length;

  const changeSlide = useCallback(
    async (index: number) => {
      setSlideBusy(true);
      try {
        setSession(
          await api.post<InstructorSession>(`/sessions/${sessionId}/slide`, { slide_index: index }),
        );
      } catch (caught) {
        toast.push({
          kind: "error",
          title: "Could not change slide",
          description: describe(caught),
        });
      } finally {
        setSlideBusy(false);
      }
    },
    [sessionId, toast],
  );

  const nudge = useCallback(
    async (alert: Alert, message: string) => {
      setNudgingId(alert.id);
      try {
        await api.post<Nudge>(`/sessions/${sessionId}/nudge`, {
          student_id: alert.student_id,
          message,
          alert_id: alert.id,
        });
        toast.push({ kind: "success", title: `Nudge sent to ${alert.full_name}` });
      } catch (caught) {
        const rateLimited = caught instanceof ApiError && caught.status === 429;
        toast.push({
          kind: "error",
          title: rateLimited ? "Too many nudges" : "Nudge failed",
          description: rateLimited
            ? "Give the student a moment before nudging again."
            : describe(caught),
        });
      } finally {
        setNudgingId(null);
      }
    },
    [sessionId, toast],
  );

  const endClass = async () => {
    setEnding(true);
    try {
      const ended = await api.post<Session>(`/sessions/${sessionId}/end`);
      router.replace(`/instructor/classes/${ended.class_id}`);
    } catch (caught) {
      toast.push({ kind: "error", title: "Could not end class", description: describe(caught) });
      setEnding(false);
    }
  };

  if (!session) return <Spinner label="Opening live class" />;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Live class</h1>
          <span className="text-xs text-ink-muted dark:text-slate-400">
            connection: {socket.status} · started{" "}
            {new Date(session.started_at).toLocaleTimeString()}
          </span>
        </div>
        <Button variant="destructive" onClick={endClass} disabled={ending}>
          {ending ? "Ending…" : "End class"}
        </Button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <SlideStage
            classId={session.class_id}
            slideCount={session.slide_count}
            currentIndex={session.current_slide_index}
            busy={slideBusy}
            onChange={changeSlide}
          />
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
            <div className="rounded-card border border-line bg-surface p-3 dark:border-slate-700 dark:bg-slate-900">
              <ClassStrip counts={counts} connected={connected} />
            </div>
            <VideoStage
              url={session.livekit_url ?? null}
              token={session.livekit_token ?? null}
              publish
            />
          </div>
        </div>
        <aside className="flex flex-col gap-6">
          <AlertPanel alerts={alerts} nudgingId={nudgingId} onNudge={nudge} />
          <StudentList students={students} />
        </aside>
      </div>
    </div>
  );
}

function describe(caught: unknown): string {
  return caught instanceof ApiError ? caught.message : "Unexpected error";
}
