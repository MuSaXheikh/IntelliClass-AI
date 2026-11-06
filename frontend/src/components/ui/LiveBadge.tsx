/** "Live" marker: a small pulsing dot next to the word, so colour and motion are never the cue. */
export function LiveBadge({ label = "Live now" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success-ink ring-1 ring-inset ring-success-line">
      <span aria-hidden="true" className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-ink opacity-50" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success-ink" />
      </span>
      {label}
    </span>
  );
}
