import type { SocketStatus } from "@/hooks/useSessionSocket";

const DISPLAY: Record<SocketStatus, { label: string; dot: string }> = {
  idle: { label: "Idle", dot: "bg-line-strong" },
  connecting: { label: "Connecting…", dot: "bg-amber-500" },
  open: { label: "Connected", dot: "bg-success-ink" },
  reconnecting: { label: "Reconnecting…", dot: "bg-amber-500" },
  rejected: { label: "Connection refused", dot: "bg-danger" },
  closed: { label: "Disconnected", dot: "bg-danger" },
};

/** Quiet connection indicator: a dot beside the word, so the colour is never the only cue. */
export function ConnectionPill({ status }: { status: SocketStatus }) {
  const { label, dot } = DISPLAY[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted" role="status">
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
