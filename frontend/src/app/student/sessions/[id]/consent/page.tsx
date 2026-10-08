"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConsentGate } from "@/components/consent/ConsentGate";
import { Spinner } from "@/components/ui/Spinner";
import { api, ApiError } from "@/lib/api";
import { writeJoinInfo } from "@/lib/joinStore";
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

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      // Permissions are requested only after explicit agreement; tracks stop immediately.
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      setError(
        "Camera and microphone permission is needed to join. Please allow them and try again.",
      );
      setBusy(false);
      return;
    }
    try {
      const info = await api.post<JoinResponse>(`/sessions/${sessionId}/join`, { consent: true });
      writeJoinInfo(sessionId, info);
      router.replace(`/student/sessions/${sessionId}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not join the class.");
      setBusy(false);
    }
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
