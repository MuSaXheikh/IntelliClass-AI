"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { NudgeBanner } from "@/components/classroom/NudgeBanner";
import { OnDeviceChip } from "@/components/classroom/OnDeviceChip";
import { ScreenCheckChip } from "@/components/classroom/ScreenCheckChip";
import { SlideImage } from "@/components/classroom/SlideImage";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useScreenCompliance } from "@/hooks/useScreenCompliance";
import { useSessionSocket, type SocketStatus } from "@/hooks/useSessionSocket";
import { useVisionPipeline } from "@/hooks/useVisionPipeline";
import { readJoinInfo, useJoinInfo, writeJoinInfo } from "@/lib/joinStore";
import { playNudgeSound } from "@/lib/sound";
import { api } from "@/lib/api";
import type {
  NudgeDeliverPayload,
  NudgeResponse,
  ScreenScorePayload,
  SlideInfo,
  VisionFeaturesPayload,
} from "@/types/contract";

const VideoStage = dynamic(
  () => import("@/components/classroom/VideoStage").then((m) => m.VideoStage),
  { ssr: false },
);

const LOW_CONFIDENCE = 0.5;
const STATUS_LABEL: Record<SocketStatus, string> = {
  idle: "idle",
  connecting: "connecting",
  open: "live",
  reconnecting: "reconnecting…",
  rejected: "refused",
  closed: "closed",
};

export default function StudentLiveRoomPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { token } = useAuth();
  const join = useJoinInfo(sessionId);
  const [liveSlideIndex, setLiveSlideIndex] = useState<number | null>(null);
  const [nudge, setNudge] = useState<NudgeDeliverPayload | null>(null);
  const [ended, setEnded] = useState(false);
  const [slideTexts, setSlideTexts] = useState<string[] | null>(null);
  const active = Boolean(join) && !ended;
  const classId = join?.session.class_id ?? null;

  // Slide wording for the optional on-device screen check (never leaves the browser).
  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    api
      .get<SlideInfo[]>(`/classes/${classId}/slides`)
      .then((slides) => {
        if (!cancelled) setSlideTexts(slides.map((s) => s.text ?? s.text_preview));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [classId]);
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
  const sendScore = useCallback(
    (payload: ScreenScorePayload) => {
      socket.send("screen.score", payload);
    },
    [socket],
  );
  const screen = useScreenCompliance({
    enabled: active,
    slideIndex: liveSlideIndex ?? join?.session.current_slide_index ?? 0,
    slideTexts,
    onScore: sendScore,
  });

  const reply = (response: NudgeResponse) => {
    if (!nudge) return;
    if (!socket.send("nudge.reply", { nudge_id: nudge.nudge_id, response })) {
      toast.push({
        kind: "error",
        title: "Not connected right now",
        description: "Your reply was not sent. Try again in a moment.",
      });
      return;
    }
    setNudge(null);
  };

  if (ended) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">Live class</h1>
        <div className="rounded-card border border-line bg-surface p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
          The class has ended. Your private attention and participation summary is under{" "}
          <Link href="/student/summary" className="text-primary underline dark:text-green-300">
            My summary
          </Link>
          .
        </div>
      </div>
    );
  }
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
          connection: {STATUS_LABEL[socket.status]}
        </span>
      </header>

      {nudge && <NudgeBanner nudge={nudge} onReply={reply} />}
      {socket.status === "rejected" && (
        <div
          className="rounded-card border border-red-200 bg-surface p-4 text-sm dark:border-red-900/60 dark:bg-slate-900"
          role="alert"
        >
          This class is no longer accepting your connection: your sign-in may have expired or the
          class has ended. Open it again from{" "}
          <Link href="/student" className="text-primary underline dark:text-green-300">
            your classes
          </Link>
          .
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
          <ScreenCheckChip screen={screen} />
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
