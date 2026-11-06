"use client";

import { SlideImage } from "@/components/classroom/SlideImage";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

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
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="secondary"
          disabled={!hasSlides || busy || currentIndex <= 0}
          onClick={() => onChange(currentIndex - 1)}
        >
          <Icon name="chevron-left" />
          Previous
        </Button>
        <p className="font-mono text-sm text-ink-muted tabular-nums" aria-live="polite">
          {hasSlides ? (
            <>
              Slide <span className="font-semibold text-ink">{currentIndex + 1}</span> of{" "}
              {slideCount}
            </>
          ) : (
            "No slides"
          )}
        </p>
        <Button
          disabled={!hasSlides || busy || currentIndex >= slideCount - 1}
          onClick={() => onChange(currentIndex + 1)}
        >
          Next
          <Icon name="chevron-right" />
        </Button>
      </div>
    </section>
  );
}
