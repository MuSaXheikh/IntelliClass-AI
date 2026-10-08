"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { NudgeBanner } from "@/components/classroom/NudgeBanner";
import { OnDeviceChip } from "@/components/classroom/OnDeviceChip";
import { SlideImage } from "@/components/classroom/SlideImage";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useSessionSocket } from "@/hooks/useSessionSocket";
import { useVisionPipeline } from "@/hooks/useVisionPipeline";
import { readJoinInfo, useJoinInfo, writeJoinInfo } from "@/lib/joinStore";
import { playNudgeSound } from "@/lib/sound";
import type { NudgeDeliverPayload, NudgeResponse, VisionFeaturesPayload } from "@/types/contract";

const VideoStage = dynamic(
  () => import("@/components/classroom/VideoStage").then((m) => m.VideoStage),
  { ssr: false },
);

const LOW_CONFIDENCE = 0.5;

export default function StudentLiveRoomPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { token } = useAuth();
  const join = useJoinInfo(sessionId);
  const [liveSlideIndex, setLiveSlideIndex] = useState<number | null>(null);
  const [nudge, setNudge] = useState<NudgeDeliverPayload | null>(null);
  const [ended, setEnded] = useState(false);
  const active = Boolean(join) && !ended;
  const socket = useSessionSocket(sessionId, token, { enabled: active });

  // Without consent-step join info (fresh tab, expired storage) go back through the consent gate.
  useEffect(() => {
    if (readJoinInfo(sessionId) === null) router.replace(`/student/sessions/${sessionId}/consent`);
  }, [sessionId, router]);

  useEffect(() => {
    const unsubscribe = [
      socket.subscribe("slide.changed", ({ slide_index }) => setLiveSlideIndex(slide_index)),
      socket.subscribe("nudge.deliver", (payload) => {
        setNudge(payload);
        if (payload.sound) playNudgeSound();
      }),
      socket.subscribe("session.ended", () => {
        setEnded(true);
        writeJoinInfo(sessionId, null);
        toast.push({ title: "Class ended", description: "Thanks for attending." });
      }),
      socket.subscribe("error", (payload) => toast.push({ kind: "error", title: payload.message })),
    ];
    return () => unsubscribe.forEach((fn) => fn());
  }, [socket, sessionId, toast]);

  const sendPacket = useCallback(
    (packet: VisionFeaturesPayload) => {
      socket.send("vision.features", packet);
    },
    [socket],
  );

  const vision = useVisionPipeline({ enabled: active, onPacket: sendPacket });

  const reply = (response: NudgeResponse) => {
    if (!nudge) return;
    socket.send("nudge.reply", { nudge_id: nudge.nudge_id, response });
    setNudge(null);
  };

  if (!join) return <Spinner label="Joining class" />;

  const slideCount = join.session.slide_count;
  const slideIndex = liveSlideIndex ?? join.session.current_slide_index;
  const lowConfidence =
    vision.latest?.face_present === true &&
    vision.latest.landmark_conf !== null &&
    vision.latest.landmark_conf < LOW_CONFIDENCE;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Live class</h1>
        <span className="text-xs text-ink-muted dark:text-slate-400">
          connection: {socket.status}
        </span>
      </header>

      {nudge && <NudgeBanner nudge={nudge} onReply={reply} />}
      {ended && (
        <div className="rounded-card border border-line bg-surface p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
          The class has ended. Your private summary will appear under <strong>My summary</strong> in
          a later release.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <SlideImage
          classId={join.session.class_id}
          index={slideCount > 0 ? slideIndex : null}
          alt={`Slide ${slideIndex + 1} of ${slideCount}`}
        />
        <div className="flex flex-col gap-3">
          <VideoStage url={join.livekit_url} token={join.livekit_token} publish={false} />
          <OnDeviceChip status={vision.status} lowConfidence={lowConfidence} />
          {vision.error && (
            <p className="text-xs text-red-600" role="alert">
              {vision.error}
            </p>
          )}
          <p className="text-xs text-ink-muted dark:text-slate-400">
            slide {slideCount > 0 ? slideIndex + 1 : 0}/{slideCount}
          </p>
        </div>
      </div>
    </div>
  );
}
