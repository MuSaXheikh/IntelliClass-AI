import { describe, expect, it } from "vitest";
import { containment, matchTokens, slideSimilarity, tokens } from "@/lib/screen/similarity";

const SLIDES = [
  "Eye Aspect Ratio: six landmarks per eye; the ratio drops when the eye closes",
  "PERCLOS: fraction of time the eyes are closed over a window",
  "Head pose: yaw and pitch from the facial transformation matrix",
];

describe("tokens and containment", () => {
  it("drops stopwords and short words", () => {
    expect([...tokens("The eye is closed and PERCLOS rises")]).toEqual([
      "eye",
      "closed",
      "perclos",
      "rises",
    ]);
  });

  it("measures how much of the slide appears on screen, tolerating OCR slips", () => {
    const slide = tokens(SLIDES[0]);
    expect(containment(slide, tokens(SLIDES[0]))).toBe(1);
    expect(
      containment(
        slide,
        tokens("Eye Aspect Ratio six landmarks per eye: ratio drops when eye c1oses"),
      ),
    ).toBeGreaterThan(0.8);
    expect(containment(slide, tokens("YouTube trending videos comments subscribe"))).toBe(0);
    expect(containment(new Set(), tokens("anything"))).toBe(0);
  });
});

describe("slideSimilarity", () => {
  it("prefers the current slide but accepts a neighbour", () => {
    const onCurrent = slideSimilarity("PERCLOS fraction of time eyes closed window", SLIDES, 1);
    expect(onCurrent?.bestIndex).toBe(1);
    expect(onCurrent?.similarity).toBeGreaterThan(0.8);
    const behind = slideSimilarity("Eye Aspect Ratio six landmarks per eye ratio drops", SLIDES, 1);
    expect(behind?.bestIndex).toBe(0);
    const away = slideSimilarity("Instagram reels explore messages notifications", SLIDES, 1);
    expect(away?.similarity).toBe(0);
  });

  it("refuses to judge picture-only slides or an index outside the deck", () => {
    expect(slideSimilarity("toolbar chat window text", ["", "", ""], 1)).toBeNull();
    expect(slideSimilarity("anything", SLIDES, 7)).toBeNull();
    const mixed = matchTokens(tokens("PERCLOS fraction of time eyes closed"), ["", SLIDES[1]], 0);
    expect(mixed?.bestIndex).toBe(1);
  });
});
