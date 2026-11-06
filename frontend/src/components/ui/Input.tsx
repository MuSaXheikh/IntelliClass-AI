import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

interface FieldProps {
  label: string;
  error?: string | null;
  hint?: string;
}

const LABEL = "text-sm font-medium";
const HINT = "text-xs text-ink-muted";
const ERROR = "text-xs font-medium text-danger-ink";
const BASE =
  "w-full rounded-lg border border-field bg-surface px-3 py-2 text-sm text-ink transition-colors duration-150 placeholder:text-ink-muted hover:border-ink-muted focus:border-primary disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-surface-muted disabled:text-ink-muted aria-invalid:border-danger";

function describedBy(id: string, error?: string | null, hint?: string): string | undefined {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

function FieldNotes({ id, error, hint }: { id: string; error?: string | null; hint?: string }) {
  return (
    <>
      {hint && !error && (
        <p id={`${id}-hint`} className={HINT}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={ERROR} role="alert">
          {error}
        </p>
      )}
    </>
  );
}

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
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className={LABEL}>
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(inputId, error, hint)}
        className={`${BASE} min-h-10 ${className}`}
        {...rest}
      />
      <FieldNotes id={inputId} error={error} hint={hint} />
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
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className={LABEL}>
        {label}
      </label>
      <textarea
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(inputId, error, hint)}
        className={`${BASE} min-h-24 ${className}`}
        {...rest}
      />
      <FieldNotes id={inputId} error={error} hint={hint} />
    </div>
  );
}

/** Native file input with a styled picker button, so keyboard and screen readers keep working. */
export function FileField({
  label,
  hint,
  id,
  className = "",
  ...rest
}: Omit<FieldProps, "error"> & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className={LABEL}>
        {label}
      </label>
      <input
        id={inputId}
        type="file"
        aria-describedby={hint ? `${inputId}-hint` : undefined}
        className="w-full rounded-lg border border-dashed border-line-strong bg-surface-muted p-2 text-sm text-ink-muted transition-colors duration-150 file:mr-3 file:min-h-8 file:cursor-pointer file:rounded-md file:border file:border-solid file:border-line-strong file:bg-surface file:px-3 file:text-sm file:font-medium file:text-ink hover:border-ink-muted disabled:cursor-not-allowed disabled:opacity-60"
        {...rest}
      />
      <FieldNotes id={inputId} hint={hint} />
    </div>
  );
}
