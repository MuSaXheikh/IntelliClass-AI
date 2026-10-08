import { AUTH_TOKEN_KEY } from "@/lib/config";
import { readLocal, writeLocal } from "@/lib/storage";

/** JWT storage as an external store, so React reads it via useSyncExternalStore (no setState in effects). */
const listeners = new Set<() => void>();

export function getToken(): string | null {
  return readLocal(AUTH_TOKEN_KEY);
}

export function setToken(token: string | null): void {
  writeLocal(AUTH_TOKEN_KEY, token);
  listeners.forEach((listener) => listener());
}

export function subscribeToken(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
