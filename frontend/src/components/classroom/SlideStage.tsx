"use client";

import { SlideImage } from "@/components/classroom/SlideImage";
import { Button } from "@/components/ui/Button";

interface SlideStageProps {
  classId: string;
  slideCount: number;
  currentIndex: number;
  busy: boolean;
  onChange: (index: number) => void;
}

/** Instructor slide stage with prev/next (design.md Screen 5). */
export function SlideStage({ classId, slideCount, currentIndex, busy, onChange }: SlideStageProps) {
  const hasSlides = slideCount > 0;
  return (
    <section aria-label="Slide stage" className="flex flex-col gap-3">
      <SlideImage
        classId={classId}
        index={hasSlides ? currentIndex : null}
        alt={`Slide ${currentIndex + 1} of ${slideCount}`}
      />
      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasSlides || busy || currentIndex <= 0}
          onClick={() => onChange(currentIndex - 1)}
        >
          ◀ Prev
        </Button>
        <p className="font-mono text-sm" aria-live="polite">
          {hasSlides ? `slide ${currentIndex + 1}/${slideCount}` : "no slides"}
        </p>
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasSlides || busy || currentIndex >= slideCount - 1}
          onClick={() => onChange(currentIndex + 1)}
        >
          Next ▶
        </Button>
      </div>
    </section>
  );
}
