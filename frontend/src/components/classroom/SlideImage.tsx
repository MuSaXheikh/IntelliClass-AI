"use client";

import { Icon } from "@/components/ui/Icon";
import { useAuthedImage } from "@/hooks/useAuthedImage";

interface SlideImageProps {
  classId: string;
  index: number | null;
  alt: string;
  /** Changes when the deck is replaced (slide row id), so the image is fetched again. */
  version?: string;
}

/** 16:9 slide canvas. Images are protected, so they are fetched with the auth header. */
export function SlideImage({ classId, index, alt, version }: SlideImageProps) {
  const suffix = version ? `?v=${encodeURIComponent(version)}` : "";
  const path = index === null ? null : `/classes/${classId}/slides/${index}/image${suffix}`;
  const { url, failed } = useAuthedImage(path);
  return (
    <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-card border border-line bg-surface-muted">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob URL from an authenticated fetch; next/image cannot optimise it
        <img src={url} alt={alt} className="h-full w-full object-contain" />
      ) : (
        <p className="flex items-center gap-2 p-2 text-sm text-ink-muted">
          {(index === null || failed) && <Icon name="layers" className="h-4 w-4" />}
          {index === null ? "No slides uploaded" : failed ? "Slide unavailable" : "Loading slide…"}
        </p>
      )}
    </div>
  );
}
