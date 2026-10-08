import type { HTMLAttributes, ReactNode } from "react";

export function Card({
  children,
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={`rounded-card border border-line bg-surface p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
