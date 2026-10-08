"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { WS_URL } from "@/lib/config";
import { SessionSocketClient, type SocketStatus } from "@/lib/sessionSocketClient";
import type {
  ClientMessageType,
  ClientPayload,
  ServerMessage,
  ServerMessageType,
  ServerPayload,
} from "@/types/contract";

export type { SocketStatus } from "@/lib/sessionSocketClient";

type Handler<T extends ServerMessageType> = (payload: ServerPayload<T>, ts: string) => void;
type AnyHandler = (payload: unknown, ts: string) => void;

export interface SessionSocket {
  status: SocketStatus;
  send: <T extends ClientMessageType>(type: T, payload: ClientPayload<T>) => boolean;
  subscribe: <T extends ServerMessageType>(type: T, handler: Handler<T>) => () => void;
}

interface Options {
  enabled?: boolean;
}

interface Holder {
  client: SessionSocketClient | null;
  handlers: Map<string, Set<AnyHandler>>;
  statusListeners: Set<() => void>;
}

/**
 * React binding for SessionSocketClient. Handlers live in the hook so subscriptions made
 * before the socket exists (or across reconnects) are kept. Status is read through
 * useSyncExternalStore, so no state is set synchronously inside effects.
 */
export function useSessionSocket(
  sessionId: string | null,
  token: string | null,
  options: Options = {},
): SessionSocket {
  const enabled = options.enabled ?? true;
  const holderRef = useRef<Holder>({
    client: null,
    handlers: new Map(),
    statusListeners: new Set(),
  });

  useEffect(() => {
    if (!enabled || !sessionId || !token) return;
    const holder = holderRef.current;
    const notify = () => holder.statusListeners.forEach((listener) => listener());
    const dispatch = (message: ServerMessage) => {
      const set = holder.handlers.get(message.type);
      if (!set) return;
      for (const handler of set) handler(message.payload, message.ts);
    };
    const client = new SessionSocketClient({
      url: `${WS_URL}/sessions/${sessionId}?token=${encodeURIComponent(token)}`,
      dispatch,
      onStatus: notify,
    });
    holder.client = client;
    client.connect();
    notify();
    return () => {
      client.close();
      if (holder.client === client) holder.client = null;
      notify();
    };
  }, [enabled, sessionId, token]);

  const subscribeStatus = useCallback((listener: () => void) => {
    const listeners = holderRef.current.statusListeners;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  const readStatus = useCallback(
    (): SocketStatus => holderRef.current.client?.status ?? "idle",
    [],
  );
  const status = useSyncExternalStore(subscribeStatus, readStatus, () => "idle" as const);

  const send = useCallback(
    <T extends ClientMessageType>(type: T, payload: ClientPayload<T>): boolean =>
      holderRef.current.client?.send(type, payload) ?? false,
    [],
  );

  const subscribe = useCallback(
    <T extends ServerMessageType>(type: T, handler: Handler<T>): (() => void) => {
      const handlers = holderRef.current.handlers;
      const set = handlers.get(type) ?? new Set<AnyHandler>();
      const wrapped = handler as AnyHandler;
      set.add(wrapped);
      handlers.set(type, set);
      return () => {
        set.delete(wrapped);
      };
    },
    [],
  );

  return { status, send, subscribe };
}
