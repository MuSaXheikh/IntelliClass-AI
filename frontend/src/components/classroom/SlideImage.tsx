"use client";

import { useAuthedImage } from "@/hooks/useAuthedImage";

interface SlideImageProps {
  classId: string;
  index: number | null;
  alt: string;
}

/** 16:9 slide canvas. Images are protected, so they are fetched with the auth header. */
export function SlideImage({ classId, index, alt }: SlideImageProps) {
  const path = index === null ? null : `/classes/${classId}/slides/${index}/image`;
  const { url, failed } = useAuthedImage(path);
  return (
    <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-card border border-line bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob URL from an authenticated fetch; next/image cannot optimise it
        <img src={url} alt={alt} className="h-full w-full object-contain" />
      ) : (
        <p className="text-sm text-ink-muted dark:text-slate-400">
          {index === null ? "No slides uploaded" : failed ? "Slide unavailable" : "Loading slide…"}
        </p>
      )}
    </div>
  );
}
