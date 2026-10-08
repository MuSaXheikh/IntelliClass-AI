"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastKind = "info" | "success" | "error";

export interface ToastInput {
  title: string;
  description?: string;
  kind?: ToastKind;
}

interface ToastItem extends ToastInput {
  id: number;
  kind: ToastKind;
}

interface ToastContextValue {
  push: (toast: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const KIND_CLASS: Record<ToastKind, string> = {
  info: "border-line bg-surface text-ink dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100",
  success:
    "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100",
  error:
    "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
};

const TOAST_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (toast: ToastInput) => {
      counter.current += 1;
      const id = counter.current;
      setItems((current) => [...current, { ...toast, id, kind: toast.kind ?? "info" }]);
      setTimeout(() => dismiss(id), TOAST_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto rounded-lg border p-3 shadow-md ${KIND_CLASS[item.kind]}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                {item.description && (
                  <p className="mt-0.5 text-xs opacity-80">{item.description}</p>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                className="text-xs opacity-60 hover:opacity-100"
                onClick={() => dismiss(item.id)}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
