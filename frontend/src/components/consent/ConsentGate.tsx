"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { describeMediaError } from "@/lib/media";

interface ConsentGateProps {
  className: string;
  busy: boolean;
  error: string | null;
  onJoin: () => void;
  onCancel: () => void;
}

function ConsentItem({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-ink">
        <Icon name={icon} />
      </span>
      <p className="min-w-0 text-sm leading-relaxed">{children}</p>
    </li>
  );
}

/** Pre-join notice (design.md Screen 4). Nothing is captured before "Allow & Join". */
export function ConsentGate({ className, busy, error, onJoin, onCancel }: ConsentGateProps) {
  const [agreed, setAgreed] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopTest = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setTesting(false);
  };

  useEffect(() => stopTest, []);

  // The <video> only exists while testing, so attach the stream after it has mounted.
  useEffect(() => {
    if (!testing) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
  }, [testing]);

  const testCamera = async () => {
    setTestError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      setTesting(true);
    } catch (caught) {
      setTestError(describeMediaError(caught, "camera"));
    }
  };

  return (
    <Card pad="lg" className="mx-auto w-full max-w-2xl">
      <p className="font-mono text-xs font-medium text-ink-muted">{className}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Before you join: what is analysed
      </h1>
      <ul className="mt-6 flex flex-col gap-4">
        <ConsentItem icon="video">
          <strong>Camera:</strong> eye state &amp; face direction (analysed{" "}
          <strong>on your device</strong>; no video is sent)
        </ConsentItem>
        <ConsentItem icon="monitor">
          <strong>Screen:</strong> whether this class tab stays visible and in front. If you choose
          to share your screen, your browser reads the words on it and compares them with the slides{" "}
          <strong>on your device</strong>; only a match score is sent, never a screenshot or the
          text.
        </ConsentItem>
        <ConsentItem icon="mic">
          <strong>Microphone:</strong> optional, to speak in class
        </ConsentItem>
      </ul>
      <Notice tone="success" className="mt-5 font-medium">
        We never record or store video or screens
      </Notice>
      {testing && (
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Camera preview"
          className="mt-5 w-full rounded-lg bg-slate-950"
        />
      )}
      {testError && (
        <Notice tone="danger" className="mt-4" role="alert">
          {testError}
        </Notice>
      )}
      <label className="mt-6 flex items-center gap-3 border-t border-line pt-5 text-sm font-medium">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          className="h-4 w-4"
        />
        I understand and agree
      </label>
      {error && (
        <Notice tone="danger" className="mt-4" role="alert">
          {error}
        </Notice>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button onClick={onJoin} disabled={!agreed || busy}>
          {busy ? "Joining…" : "Allow & Join"}
        </Button>
        <Button variant="secondary" onClick={testing ? stopTest : testCamera} disabled={busy}>
          {testing ? "Stop test" : "Test camera"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy} className="sm:ml-auto">
          Cancel
        </Button>
      </div>
    </Card>
  );
}
