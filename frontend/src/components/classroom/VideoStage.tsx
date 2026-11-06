"use client";

import { LiveKitRoom, RoomAudioRenderer, VideoTrack, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Icon } from "@/components/ui/Icon";

interface VideoStageProps {
  url: string | null;
  token: string | null;
  /** Instructors publish camera + mic; students only subscribe (decision D15). */
  publish: boolean;
}

function InstructorTile() {
  const tracks = useTracks([Track.Source.ScreenShare, Track.Source.Camera]);
  const first = tracks[0];
  if (!first) {
    return <p className="p-3 text-xs text-slate-300">Waiting for the instructor&apos;s video…</p>;
  }
  return <VideoTrack trackRef={first} className="h-full w-full object-cover" />;
}

/** Thin LiveKit wrapper (FE-06 minimal). Shows a placeholder when LiveKit is not configured. */
export function VideoStage({ url, token, publish }: VideoStageProps) {
  if (!url || !token) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-card border border-dashed border-line-strong p-3 text-center text-xs text-ink-muted">
        <Icon name="video-off" className="h-5 w-5" />
        Live video not configured
      </div>
    );
  }
  return (
    <LiveKitRoom
      serverUrl={url}
      token={token}
      connect
      video={publish}
      audio={publish}
      className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-card bg-slate-950"
    >
      <RoomAudioRenderer />
      <InstructorTile />
    </LiveKitRoom>
  );
}
