import type { HTMLAttributes, ReactNode } from "react";

type Pad = "none" | "sm" | "md" | "lg";

const PAD_CLASS: Record<Pad, string> = {
  none: "overflow-hidden",
  sm: "p-4",
  md: "p-5",
  lg: "p-6 sm:p-8",
};

export function Card({
  children,
  className = "",
  pad = "md",
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode; pad?: Pad }) {
  return (
    <div
      className={`rounded-card border border-line bg-surface shadow-card ${PAD_CLASS[pad]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Card heading row: title, an optional muted count, and an optional action on the right. */
export function CardHeader({
  title,
  count,
  description,
  action,
}: {
  title: string;
  count?: number;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-base font-semibold">
          {title}
          {count !== undefined && (
            <span className="ml-2 font-mono text-sm font-medium text-ink-muted tabular-nums">
              {count}
            </span>
          )}
        </h2>
        {description && <p className="mt-1 max-w-prose text-sm text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
