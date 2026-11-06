import { Icon } from "@/components/ui/Icon";
import { STATUS_META } from "@/lib/status";
import type { StudentState } from "@/types/contract";

/** Pill with icon + label + colour tint. Colour is never the only cue (design.md §2.2). */
export function StatusBadge({
  state,
  className = "",
}: {
  state: StudentState;
  className?: string;
}) {
  const meta = STATUS_META[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ring-current/15 ${meta.pillClass} ${className}`}
      title={meta.meaning}
      data-state={state}
    >
      <Icon name={meta.icon} className="h-3.5 w-3.5" />
      <span>{meta.label}</span>
    </span>
  );
}
