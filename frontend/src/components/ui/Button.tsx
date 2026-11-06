import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "destructive" | "ghost";
type Size = "sm" | "md";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "bg-primary text-on-primary shadow-card hover:bg-primary-hover",
  secondary: "border border-line-strong bg-surface text-ink shadow-card hover:bg-surface-muted",
  destructive: "bg-danger text-white shadow-card hover:bg-danger-hover",
  ghost: "text-ink hover:bg-surface-muted",
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "min-h-9 px-3 py-1.5 text-sm font-medium",
  md: "min-h-10 px-4 py-2 text-sm font-medium",
};

function buttonClass(variant: Variant, size: Size, className: string): string {
  return `inline-flex touch-manipulation items-center justify-center gap-2 rounded-lg transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`;
}

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
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

/** A link that looks like a button, for navigation (a <button> inside an <a> is invalid HTML). */
export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
