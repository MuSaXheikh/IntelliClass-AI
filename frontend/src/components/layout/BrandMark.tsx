import { Icon } from "@/components/ui/Icon";

/** Product mark for the green brand surfaces: a gold tile and the name. */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-slate-900">
        <Icon name="graduation-cap" className="h-5 w-5" />
      </span>
      <span className="text-base font-semibold tracking-tight">IntelliClass AI</span>
    </span>
  );
}
