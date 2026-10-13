import { describe, expect, it } from "vitest";
import { resolveUrls } from "@/lib/urls";

describe("resolveUrls", () => {
  it("derives the backend from the page host on plain http", () => {
    expect(resolveUrls({}, { protocol: "http:", hostname: "192.168.100.100" })).toEqual({
      api: "http://192.168.100.100:8000/api/v1",
      ws: "ws://192.168.100.100:8000/ws",
    });
  });
  it("switches to https and wss when the page is served over https", () => {
    expect(resolveUrls({}, { protocol: "https:", hostname: "demo.example" }).ws).toBe(
      "wss://demo.example:8000/ws",
    );
  });
  it("prefers explicit environment values", () => {
    const out = resolveUrls(
      { api: "https://api.example/api/v1", ws: "wss://api.example/ws" },
      { protocol: "http:", hostname: "localhost" },
    );
    expect(out).toEqual({ api: "https://api.example/api/v1", ws: "wss://api.example/ws" });
  });
  it("falls back to localhost during server rendering", () => {
    expect(resolveUrls({}, null).api).toBe("http://localhost:8000/api/v1");
  });
});
