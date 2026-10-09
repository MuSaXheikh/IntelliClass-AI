"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { describeMediaError } from "@/lib/media";

interface ConsentGateProps {
  className: string;
  busy: boolean;
  error: string | null;
  onJoin: () => void;
  onCancel: () => void;
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

  const testCamera = async () => {
    setTestError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setTesting(true);
    } catch (caught) {
      setTestError(describeMediaError(caught, "camera"));
    }
  };

  return (
    <Card className="mx-auto w-full max-w-xl">
      <h1 className="text-lg font-semibold">Before you join: what is analysed</h1>
      <p className="mt-1 text-sm text-ink-muted dark:text-slate-400">{className}</p>
      <ul className="mt-4 space-y-2 text-sm">
        <li>
          ✔ <strong>Camera:</strong> eye state &amp; face direction (analysed{" "}
          <strong>on your device</strong>; no video is sent)
        </li>
        <li>
          ✔ <strong>Screen:</strong> whether this class tab stays visible and in front. Slide
          comparison comes in a later version; no screenshots are taken.
        </li>
        <li>
          ✔ <strong>Microphone:</strong> optional, to speak in class
        </li>
        <li>✘ We never record or store video or screens</li>
      </ul>
      {testing && (
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Camera preview"
          className="mt-4 w-full rounded-lg bg-black"
        />
      )}
      {testError && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {testError}
        </p>
      )}
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          className="h-4 w-4"
        />
        I understand and agree
      </label>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={testing ? stopTest : testCamera} disabled={busy}>
          {testing ? "Stop test" : "Test camera"}
        </Button>
        <Button onClick={onJoin} disabled={!agreed || busy}>
          {busy ? "Joining…" : "Allow & Join"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
