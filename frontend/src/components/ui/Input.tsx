import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

interface FieldProps {
  label: string;
  error?: string | null;
  hint?: string;
}

const BASE =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

export function Input({
  label,
  error,
  hint,
  id,
  className = "",
  ...rest
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={`${BASE} ${error ? "border-red-500" : ""} ${className}`}
        {...rest}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-ink-muted dark:text-slate-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextArea({
  label,
  error,
  hint,
  id,
  className = "",
  ...rest
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <textarea
        id={inputId}
        aria-invalid={Boolean(error)}
        className={`${BASE} min-h-24 ${error ? "border-red-500" : ""} ${className}`}
        {...rest}
      />
      {hint && !error && <p className="text-xs text-ink-muted dark:text-slate-400">{hint}</p>}
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
