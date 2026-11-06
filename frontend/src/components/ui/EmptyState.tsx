import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

export function EmptyState({
  title,
  icon = "inbox",
  action,
  children,
}: {
  title: string;
  icon?: IconName;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line-strong px-6 py-10 text-center text-sm text-ink-muted">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 max-w-sm">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
