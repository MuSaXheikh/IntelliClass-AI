"use client";

import { useState, type PointerEvent } from "react";
import type { TimelinePoint } from "@/types/contract";

const W = 640;
const H = 200;
const PAD = { top: 12, right: 16, bottom: 28, left: 36 };
const LINE = "#14532D"; // primary green; single series, so the title names it and no legend is needed

interface Props {
  points: TimelinePoint[];
}

function scales(points: TimelinePoint[]) {
  const maxMinute = Math.max(1, points[points.length - 1]?.minute ?? 1);
  const x = (minute: number) => PAD.left + ((W - PAD.left - PAD.right) * minute) / maxMinute;
  const y = (pct: number) => PAD.top + ((H - PAD.top - PAD.bottom) * (100 - pct)) / 100;
  return { x, y, maxMinute };
}

/** Class attention over the session, one line, with a crosshair tooltip and a table view. */
export function AttentionTimeline({ points }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) {
    return (
      <p className="text-sm text-ink-muted dark:text-slate-400">
        The session was too short for a minute-by-minute timeline.
      </p>
    );
  }
  const { x, y, maxMinute } = scales(points);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.minute)},${y(p.attentive_pct)}`)
    .join(" ");
  const active = hover === null ? null : points[hover];

  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const minute = ((event.clientX - rect.left) / rect.width) * W;
    const ratio = (minute - PAD.left) / (W - PAD.left - PAD.right);
    const target = Math.round(Math.min(1, Math.max(0, ratio)) * maxMinute);
    let best = 0;
    for (let i = 1; i < points.length; i += 1) {
      if (Math.abs(points[i].minute - target) < Math.abs(points[best].minute - target)) best = i;
    }
    setHover(best);
  };

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Share of students attentive, per minute"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-slate-200 dark:stroke-slate-700"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-slate-500 text-[11px] dark:fill-slate-400"
            >
              {tick}%
            </text>
          </g>
        ))}
        {[0, maxMinute].map((minute) => (
          <text
            key={minute}
            x={x(minute)}
            y={H - 8}
            textAnchor={minute === 0 ? "start" : "end"}
            className="fill-slate-500 text-[11px] dark:fill-slate-400"
          >
            {minute} min
          </text>
        ))}
        <path d={path} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" />
        {active && (
          <g>
            <line
              x1={x(active.minute)}
              x2={x(active.minute)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              className="stroke-slate-400"
              strokeDasharray="3 3"
            />
            <circle cx={x(active.minute)} cy={y(active.attentive_pct)} r={5} fill={LINE} />
            <circle
              cx={x(active.minute)}
              cy={y(active.attentive_pct)}
              r={7}
              fill="none"
              stroke="#fff"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>
      {active && (
        <div
          className="pointer-events-none absolute top-2 rounded-md border border-line bg-surface px-2 py-1 text-xs shadow-sm dark:border-slate-600 dark:bg-slate-800"
          style={{ left: `${(100 * x(active.minute)) / W}%`, transform: "translateX(-50%)" }}
          role="status"
        >
          <span className="font-medium">minute {active.minute}</span> ·{" "}
          {active.attentive_pct.toFixed(0)}% attentive · {active.students} counted
        </div>
      )}
      <details className="mt-2 text-xs text-ink-muted dark:text-slate-400">
        <summary className="cursor-pointer">Show as table</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr>
              <th className="py-1 pr-4 font-medium">Minute</th>
              <th className="py-1 pr-4 font-medium">Attentive</th>
              <th className="py-1 font-medium">Students counted</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.minute}>
                <td className="py-0.5 pr-4 font-mono">{p.minute}</td>
                <td className="py-0.5 pr-4 font-mono">{p.attentive_pct.toFixed(0)}%</td>
                <td className="py-0.5 font-mono">{p.students}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
