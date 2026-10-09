"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConsentGate } from "@/components/consent/ConsentGate";
import { Spinner } from "@/components/ui/Spinner";
import { api, ApiError } from "@/lib/api";
import { writeJoinInfo } from "@/lib/joinStore";
import { probeMedia } from "@/lib/media";
import type { ClassSummary, JoinResponse, Session } from "@/types/contract";

export default function ConsentPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const router = useRouter();
  const [className, setClassName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Session>(`/sessions/${sessionId}`)
      .then((session) => api.get<ClassSummary>(`/classes/${session.class_id}`))
      .then((cls) => setClassName(`${cls.course_code} · ${cls.name}`))
      .catch(() => setClassName("Live class"));
  }, [sessionId]);

  const completeJoin = async () => {
    try {
      const info = await api.post<JoinResponse>(`/sessions/${sessionId}/join`, { consent: true });
      writeJoinInfo(sessionId, info);
      router.replace(`/student/sessions/${sessionId}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not join the class.");
      setBusy(false);
    }
  };

  /** Permissions are requested only after explicit agreement; tracks stop immediately. */
  const join = async () => {
    setBusy(true);
    setError(null);
    const camera = await probeMedia("camera");
    if (!camera.ok) {
      setError(`${camera.reason} Camera access is required to join the class.`);
      setBusy(false);
      return;
    }
    // The microphone is only needed for live audio; a missing mic must not block attendance.
    await probeMedia("microphone");
    await completeJoin();
  };

  if (className === null) return <Spinner label="Loading class" />;

  return (
    <ConsentGate
      className={className}
      busy={busy}
      error={error}
      onJoin={join}
      onCancel={() => router.replace("/student")}
    />
  );
}
