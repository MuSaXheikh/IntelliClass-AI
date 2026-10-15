import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authProtocols, SessionSocketClient, type SocketStatus } from "@/lib/sessionSocketClient";

class FakeSocket {
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(
    public url: string,
    public protocols: string[],
  ) {
    FakeSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
    this.onclose?.({ code: 1000 });
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }

  serverClose(code: number): void {
    this.readyState = 3;
    this.onclose?.({ code });
  }

  message(body: unknown): void {
    this.onmessage?.({ data: JSON.stringify(body) });
  }
}

function makeClient(token = "jwt-1") {
  const statuses: SocketStatus[] = [];
  const client = new SessionSocketClient({
    url: "ws://test/ws/sessions/s1",
    protocols: () => authProtocols(token),
    dispatch: () => undefined,
    onStatus: (status) => statuses.push(status),
    reconnectBaseMs: 1000,
    reconnectMaxMs: 8000,
    heartbeatMs: 60_000,
    createSocket: (url, protocols) => new FakeSocket(url, protocols) as unknown as WebSocket,
  });
  return { client, statuses };
}

describe("SessionSocketClient", () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("authenticates through the subprotocol list, never the URL", () => {
    const { client } = makeClient("abc");
    client.connect();
    const socket = FakeSocket.instances[0];
    expect(socket.url).toBe("ws://test/ws/sessions/s1");
    expect(socket.protocols).toEqual(["intelliclass", "bearer.abc"]);
    expect(authProtocols(null)).toEqual(["intelliclass"]);
  });

  it("backs off exponentially after a network close and resets once open", () => {
    const { client, statuses } = makeClient();
    client.connect();
    FakeSocket.instances[0].open();
    FakeSocket.instances[0].serverClose(1006);
    expect(statuses.at(-1)).toBe("reconnecting");
    vi.advanceTimersByTime(999);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(2);
    FakeSocket.instances[1].serverClose(1006);
    vi.advanceTimersByTime(1999);
    expect(FakeSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(3);
    FakeSocket.instances[2].open();
    expect(client.status).toBe("open");
    client.close();
  });

  it("stops for good when the server rejects the identity (4401)", () => {
    const { client, statuses } = makeClient();
    client.connect();
    FakeSocket.instances[0].serverClose(4401);
    expect(client.status).toBe("rejected");
    expect(client.closeCode).toBe(4401);
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(statuses).toContain("rejected");
  });

  it("does not reconnect after session.ended or close()", () => {
    const { client } = makeClient();
    client.connect();
    FakeSocket.instances[0].open();
    FakeSocket.instances[0].message({ type: "session.ended", payload: {}, ts: "t" });
    FakeSocket.instances[0].serverClose(1000);
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(client.status).toBe("closed");

    const second = makeClient();
    second.client.connect();
    second.client.close();
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it("reports whether a send went out", () => {
    const { client } = makeClient();
    client.connect();
    expect(client.send("heartbeat", {})).toBe(false);
    FakeSocket.instances[0].open();
    expect(client.send("heartbeat", {})).toBe(true);
    expect(FakeSocket.instances[0].sent).toHaveLength(1);
    client.close();
  });
});
