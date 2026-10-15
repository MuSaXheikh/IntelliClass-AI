import { WS_HEARTBEAT_MS, WS_RECONNECT_BASE_MS, WS_RECONNECT_MAX_MS } from "@/lib/config";
import type { ClientMessageType, ClientPayload, ServerMessage } from "@/types/contract";

export type SocketStatus = "idle" | "connecting" | "open" | "reconnecting" | "rejected" | "closed";

/** The protocol name the server selects; the token rides next to it as `bearer.<jwt>`. */
export const WS_PROTOCOL = "intelliclass";
/** Close codes after which reconnecting cannot help: the server refused this identity. */
export const FINAL_CLOSE_CODES: ReadonlySet<number> = new Set([4401, 4403, 1008]);

export function authProtocols(token: string | null): string[] {
  return token ? [WS_PROTOCOL, `bearer.${token}`] : [WS_PROTOCOL];
}

export interface SocketClientOptions {
  url: string;
  dispatch: (message: ServerMessage) => void;
  onStatus: (status: SocketStatus) => void;
  /** Evaluated on every (re)connect, so a refreshed token is used without a new client. */
  protocols?: () => string[];
  heartbeatMs?: number;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  /** Injectable for tests. */
  createSocket?: (url: string, protocols: string[]) => WebSocket;
}

function isServerMessage(value: unknown): value is ServerMessage {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { type?: unknown; payload?: unknown };
  return typeof candidate.type === "string" && "payload" in candidate;
}

/**
 * Framework-free WebSocket client for one live session: envelope {type, payload, ts},
 * heartbeat, capped exponential reconnect. Stops for good after `session.ended`, close(), or a
 * final close code (sign-in rejected, consent missing, policy violation): then status is
 * "rejected" and the page must tell the user instead of retrying every 30 s forever.
 */
export class SessionSocketClient {
  status: SocketStatus = "idle";
  /** Code of the last close event: 4401 sign-in rejected, 4403 consent missing. */
  closeCode: number | null = null;
  private socket: WebSocket | null = null;
  private attempt = 0;
  private stopped = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private readonly options: Required<Omit<SocketClientOptions, "createSocket" | "protocols">> & {
    createSocket: (url: string, protocols: string[]) => WebSocket;
    protocols: () => string[];
  };

  constructor(options: SocketClientOptions) {
    this.options = {
      heartbeatMs: WS_HEARTBEAT_MS,
      reconnectBaseMs: WS_RECONNECT_BASE_MS,
      reconnectMaxMs: WS_RECONNECT_MAX_MS,
      protocols: () => [WS_PROTOCOL],
      createSocket: (url, protocols) => new WebSocket(url, protocols),
      ...options,
    };
  }

  connect(): void {
    if (this.stopped) return;
    this.setStatus(this.attempt === 0 ? "connecting" : "reconnecting");
    const socket = this.options.createSocket(this.options.url, this.options.protocols());
    this.socket = socket;
    socket.onopen = () => this.handleOpen();
    socket.onmessage = (event: MessageEvent<string>) => this.handleMessage(event.data);
    socket.onclose = (event: CloseEvent) => this.handleClose(event.code);
    socket.onerror = () => undefined; // onclose follows and decides what to do
  }

  close(): void {
    this.stopped = true;
    this.clearTimers();
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState <= WebSocket.OPEN) socket.close();
    this.setStatus("closed");
  }

  send<T extends ClientMessageType>(type: T, payload: ClientPayload<T>): boolean {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ type, payload, ts: new Date().toISOString() }));
    return true;
  }

  private setStatus(status: SocketStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.options.onStatus(status);
  }

  private handleOpen(): void {
    this.attempt = 0;
    this.setStatus("open");
    this.heartbeatTimer = setInterval(() => this.send("heartbeat", {}), this.options.heartbeatMs);
  }

  private handleMessage(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (!isServerMessage(parsed)) return;
    if (parsed.type === "session.ended") this.stopped = true;
    this.options.dispatch(parsed);
  }

  private handleClose(code: number): void {
    this.closeCode = code;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    if (this.stopped) {
      this.setStatus("closed");
      return;
    }
    if (FINAL_CLOSE_CODES.has(code)) {
      this.stopped = true;
      this.setStatus("rejected");
      return;
    }
    const delay = Math.min(
      this.options.reconnectBaseMs * 2 ** this.attempt,
      this.options.reconnectMaxMs,
    );
    this.attempt += 1;
    this.setStatus("reconnecting");
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
  }
}
