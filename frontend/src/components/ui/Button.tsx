import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "destructive" | "ghost";
type Size = "sm" | "md";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover disabled:bg-slate-400",
  secondary:
    "border border-line bg-surface text-ink hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
  destructive: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-ink hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800",
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "min-h-10 px-4 text-sm font-medium",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
