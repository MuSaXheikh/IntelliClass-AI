"use client";

import { LiveKitRoom, RoomAudioRenderer, VideoTrack, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";

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
    return (
      <p className="text-xs text-ink-muted dark:text-slate-400">
        Waiting for the instructor&apos;s video…
      </p>
    );
  }
  return <VideoTrack trackRef={first} className="h-full w-full object-cover" />;
}

/** Thin LiveKit wrapper (FE-06 minimal). Shows a placeholder when LiveKit is not configured. */
export function VideoStage({ url, token, publish }: VideoStageProps) {
  if (!url || !token) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-card border border-dashed border-line text-xs text-ink-muted dark:border-slate-700 dark:text-slate-400">
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
      className="aspect-video overflow-hidden rounded-card bg-black"
    >
      <RoomAudioRenderer />
      <InstructorTile />
    </LiveKitRoom>
  );
}
