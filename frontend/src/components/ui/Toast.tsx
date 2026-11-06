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
import { Icon, type IconName } from "@/components/ui/Icon";

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

const KIND_ICON: Record<ToastKind, { name: IconName; className: string }> = {
  info: { name: "info", className: "text-ink-muted" },
  success: { name: "check-circle", className: "text-success-ink" },
  error: { name: "alert-triangle", className: "text-danger-ink" },
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
            className="pointer-events-auto flex animate-rise items-start gap-2.5 rounded-lg border border-line bg-surface p-3 text-ink shadow-raised"
          >
            <Icon
              name={KIND_ICON[item.kind].name}
              className={`mt-0.5 h-4 w-4 ${KIND_ICON[item.kind].className}`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{item.title}</p>
              {item.description && (
                <p className="mt-0.5 text-xs text-ink-muted">{item.description}</p>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              className="-m-1 rounded p-1 text-ink-muted transition-colors duration-150 hover:text-ink"
              onClick={() => dismiss(item.id)}
            >
              <Icon name="x" className="h-3.5 w-3.5" />
            </button>
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
