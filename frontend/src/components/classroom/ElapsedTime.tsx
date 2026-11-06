"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

function format(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const tail = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${tail}` : tail;
}

/** Running class timer (design.md Screen 5). Tabular figures keep it from jittering. */
export function ElapsedTime({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const started = new Date(since);
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono text-sm font-medium tabular-nums"
      title={`Started at ${started.toLocaleTimeString()}`}
    >
      <Icon name="clock" className="h-3.5 w-3.5 text-ink-muted" />
      {format(now - started.getTime())}
    </span>
  );
}
