"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SCREEN_CHANGE_BITS,
  SCREEN_OCR_MAX_INTERVAL_MS,
  SCREEN_OCR_MAX_WIDTH,
  SCREEN_SAMPLE_MS,
} from "@/lib/config";
import { describeMediaError } from "@/lib/media";
import { createOcr, type Ocr } from "@/lib/screen/ocr";
import { HASH_SIZE, hamming, luminance, phash, type Hash } from "@/lib/screen/phash";
import { matchTokens, tokens } from "@/lib/screen/similarity";
import type { ScreenScorePayload } from "@/types/contract";

export type ScreenStatus =
  "idle" | "unsupported" | "requesting" | "loading" | "running" | "denied" | "ended" | "error";

interface Options {
  enabled: boolean;
  slideIndex: number;
  slideTexts: readonly string[] | null;
  onScore: (payload: ScreenScorePayload) => void;
}

/** A slide with no words (or no slide) cannot be judged: report no readable characters. */
function toPayload(
  match: { similarity: number } | null,
  slideIndex: number,
  changed: boolean,
  ocrChars: number,
): ScreenScorePayload {
  if (!match) return { slide_index: slideIndex, similarity: 0, changed, ocr_chars: 0 };
  return {
    slide_index: slideIndex,
    similarity: Number(match.similarity.toFixed(3)),
    changed,
    ocr_chars: ocrChars,
  };
}

export interface ScreenCompliance {
  status: ScreenStatus;
  error: string | null;
  lastSimilarity: number | null;
  start: () => void;
  stop: () => void;
}

/**
 * Optional on-device screen check (decision D9). The student shares a screen or window; every few
 * seconds a 32×32 hash tells whether the picture changed; when it did (or once a minute) the
 * frame is OCR'd on the device and the words are compared with the current slides. Only the
 * similarity score leaves the browser: never a frame, never the recognised text.
 */
export function useScreenCompliance({
  enabled,
  slideIndex,
  slideTexts,
  onScore,
}: Options): ScreenCompliance {
  const [status, setStatus] = useState<ScreenStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastSimilarity, setLastSimilarity] = useState<number | null>(null);
  const [wanted, setWanted] = useState(false);
  const slideRef = useRef({ slideIndex, slideTexts });
  const onScoreRef = useRef(onScore);

  useEffect(() => {
    slideRef.current = { slideIndex, slideTexts };
  }, [slideIndex, slideTexts]);
  useEffect(() => {
    onScoreRef.current = onScore;
  }, [onScore]);

  useEffect(() => {
    if (!enabled || !wanted) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let ocr: Ocr | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let busy = false;
    let lastOcrHash: Hash | null = null;
    let lastOcrAt = 0;
    let lastScore: ScreenScorePayload | null = null;
    let lastTokens: Set<string> | null = null; // words last read on the screen (device only)
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    const hashCanvas = document.createElement("canvas");
    hashCanvas.width = HASH_SIZE;
    hashCanvas.height = HASH_SIZE;
    const ocrCanvas = document.createElement("canvas");

    const stopAll = () => {
      if (timer) clearInterval(timer);
      timer = null;
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      video.srcObject = null;
      void ocr?.terminate();
      ocr = null;
    };

    const sample = async () => {
      if (busy || cancelled || !stream || video.videoWidth === 0) return;
      const hashCtx = hashCanvas.getContext("2d", { willReadFrequently: true });
      if (!hashCtx) return;
      hashCtx.drawImage(video, 0, 0, HASH_SIZE, HASH_SIZE);
      const hash = phash(luminance(hashCtx.getImageData(0, 0, HASH_SIZE, HASH_SIZE).data));
      const now = Date.now();
      const changed = lastOcrHash === null || hamming(hash, lastOcrHash) > SCREEN_CHANGE_BITS;
      const due = now - lastOcrAt > SCREEN_OCR_MAX_INTERVAL_MS;
      const { slideTexts: texts, slideIndex: index } = slideRef.current;
      if (!changed && !due) {
        if (!lastScore || !lastTokens || !texts) return;
        if (lastScore.slide_index !== index) {
          // the instructor moved on while this screen stayed the same: re-score the same words
          const match = matchTokens(lastTokens, texts, index);
          lastScore = toPayload(match, index, false, lastScore.ocr_chars);
          setLastSimilarity(lastScore.ocr_chars ? lastScore.similarity : null);
        }
        onScoreRef.current({ ...lastScore, changed: false }); // keep the server's view fresh
        return;
      }
      if (!ocr || !texts || texts.length === 0) return;
      busy = true;
      try {
        const scale = Math.min(1, SCREEN_OCR_MAX_WIDTH / video.videoWidth);
        ocrCanvas.width = Math.round(video.videoWidth * scale);
        ocrCanvas.height = Math.round(video.videoHeight * scale);
        ocrCanvas.getContext("2d")?.drawImage(video, 0, 0, ocrCanvas.width, ocrCanvas.height);
        const result = await ocr.recognize(ocrCanvas);
        if (cancelled) return;
        const match = slideSimilarity(result.text, texts, index);
        lastOcrHash = hash;
        lastOcrAt = now;
        lastScore = {
          slide_index: index,
          similarity: Number(match.similarity.toFixed(3)),
          changed: true,
          ocr_chars: result.text.replace(/\s+/g, "").length,
        };
        setLastSimilarity(lastScore.similarity);
        onScoreRef.current(lastScore);
      } catch {
        // one failed recognition is not worth stopping the check; the next sample retries
      } finally {
        busy = false;
      }
    };

    const start = async () => {
      if (cancelled) return;
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setStatus("unsupported");
        setWanted(false);
        return;
      }
      setError(null);
      setStatus("requesting");
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 2 },
          audio: false,
        });
      } catch (caught) {
        if (cancelled) return;
        setError(describeMediaError(caught, "screen"));
        setStatus("denied");
        setWanted(false);
        return;
      }
      if (cancelled) {
        stopAll();
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        stopAll();
        setStatus("ended");
        setWanted(false);
      });
      setStatus("loading");
      try {
        ocr = await createOcr();
      } catch {
        if (cancelled) return;
        stopAll();
        setError("The on-device text reader could not load.");
        setStatus("error");
        setWanted(false);
        return;
      }
      if (cancelled) {
        stopAll();
        return;
      }
      setStatus("running");
      timer = setInterval(() => void sample(), SCREEN_SAMPLE_MS);
      void sample();
    };

    // Kick off asynchronously: state updates belong to the share flow, not to the effect itself.
    const kick = setTimeout(() => void start(), 0);
    return () => {
      cancelled = true;
      clearTimeout(kick);
      stopAll();
    };
  }, [enabled, wanted]);

  const start = useCallback(() => setWanted(true), []);
  const stop = useCallback(() => {
    setWanted(false);
    setStatus("idle");
    setLastSimilarity(null);
  }, []);

  return { status: enabled ? status : "idle", error, lastSimilarity, start, stop };
}
