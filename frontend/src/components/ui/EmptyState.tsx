import type { ReactNode } from "react";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line p-8 text-center text-sm text-ink-muted dark:border-slate-700 dark:text-slate-400">
      <p className="font-medium text-ink dark:text-slate-200">{title}</p>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}
