import type { HTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

type Tone = "info" | "success" | "danger";

const TONE: Record<Tone, { box: string; icon: IconName }> = {
  info: { box: "border-line bg-surface-muted text-ink", icon: "info" },
  success: { box: "border-success-line bg-success-soft text-ink", icon: "check-circle" },
  danger: { box: "border-danger-line bg-danger-soft text-ink", icon: "alert-triangle" },
};

const ICON_TONE: Record<Tone, string> = {
  info: "text-ink-muted",
  success: "text-success-ink",
  danger: "text-danger-ink",
};

/** Inline message with an icon, so its meaning never rests on the tint alone. */
export function Notice({
  tone = "info",
  children,
  className = "",
  ...rest
}: { tone?: Tone; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border p-3 text-sm ${TONE[tone].box} ${className}`}
      {...rest}
    >
      <Icon name={TONE[tone].icon} className={`mt-0.5 h-4 w-4 ${ICON_TONE[tone]}`} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
