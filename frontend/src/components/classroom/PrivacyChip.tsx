import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/** One line of the student's "what is running" panel: a tick when active, plus plain words. */
export function PrivacyChip({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <p
      className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
        active ? "bg-success-soft text-success-ink" : "bg-surface-muted text-ink-muted"
      }`}
      role="status"
    >
      <Icon name={active ? "shield-check" : "info"} className="mt-px h-3.5 w-3.5" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
