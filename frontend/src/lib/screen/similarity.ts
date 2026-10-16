/**
 * How much of a slide's wording appears in the OCR text of the student's screen. Containment
 * (slide words found ÷ slide words) rather than Jaccard, because a screen shows more than the
 * slide (toolbars, chat). OCR mangles some words, so long tokens match on their first letters.
 */

const STOPWORDS = new Set(
  "the a an and or of to in on for with is are was were be by at as it this that from not but".split(
    " ",
  ),
);

export function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length >= 3 && !STOPWORDS.has(raw)) out.add(raw);
  }
  return out;
}

function matches(word: string, observed: Set<string>, prefixes: Set<string>): boolean {
  if (observed.has(word)) return true;
  return word.length >= 6 && prefixes.has(word.slice(0, 5));
}

/** Fraction of `reference` words present in `observed`; 0 when the reference has no words. */
export function containment(reference: Set<string>, observed: Set<string>): number {
  if (reference.size === 0) return 0;
  const prefixes = new Set<string>();
  for (const word of observed) if (word.length >= 6) prefixes.add(word.slice(0, 5));
  let found = 0;
  for (const word of reference) if (matches(word, observed, prefixes)) found += 1;
  return found / reference.size;
}

export interface SlideMatch {
  similarity: number;
  bestIndex: number;
}

/** Best containment of the current slide and its neighbours (a student may be a slide behind). */
export function slideSimilarity(
  ocrText: string,
  slideTexts: readonly string[],
  index: number,
  radius = 1,
): SlideMatch {
  const observed = tokens(ocrText);
  let best: SlideMatch = { similarity: 0, bestIndex: index };
  for (
    let i = Math.max(0, index - radius);
    i <= Math.min(slideTexts.length - 1, index + radius);
    i += 1
  ) {
    const similarity = containment(tokens(slideTexts[i] ?? ""), observed);
    if (similarity > best.similarity) best = { similarity, bestIndex: i };
  }
  return best;
}
