import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

interface PageHeaderProps {
  title: ReactNode;
  /** Short mono label above the title, usually the course code. */
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}

/** The one heading block every page uses, so titles and actions sit in the same place. */
export function PageHeader({ title, eyebrow, description, actions, back }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      {back && (
        <Link
          href={back.href}
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink"
        >
          <Icon name="arrow-left" className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 font-mono text-xs font-medium text-ink-muted">{eyebrow}</p>
          )}
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
