"use client";

import { useSyncExternalStore } from "react";
import { JOIN_INFO_KEY_PREFIX } from "@/lib/config";
import { readJson, readSession, writeSession } from "@/lib/storage";
import type { JoinResponse } from "@/types/contract";

/** Join info written by the consent page and read by the live classroom (survives reloads). */
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: JoinResponse | null }>();

const keyFor = (sessionId: string): string => `${JOIN_INFO_KEY_PREFIX}${sessionId}`;

export function readJoinInfo(sessionId: string): JoinResponse | null {
  const raw = readSession(keyFor(sessionId));
  const hit = cache.get(sessionId);
  if (hit && hit.raw === raw) return hit.value;
  const value = readJson<JoinResponse>(raw);
  cache.set(sessionId, { raw, value });
  return value;
}

export function writeJoinInfo(sessionId: string, info: JoinResponse | null): void {
  writeSession(keyFor(sessionId), info ? JSON.stringify(info) : null);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useJoinInfo(sessionId: string): JoinResponse | null {
  return useSyncExternalStore(
    subscribe,
    () => readJoinInfo(sessionId),
    () => null,
  );
}
