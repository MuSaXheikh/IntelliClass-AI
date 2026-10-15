import { describe, expect, it } from "vitest";
import { decodeJwtExp } from "@/lib/jwt";

function token(payload: object): string {
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `eyJhbGciOiJIUzI1NiJ9.${body}.sig`;
}

describe("decodeJwtExp", () => {
  it("reads exp from an unpadded base64url payload", () => {
    expect(decodeJwtExp(token({ sub: "u", exp: 1_800_000_000 }))).toBe(1_800_000_000);
  });

  it("returns null for garbage or a missing claim", () => {
    expect(decodeJwtExp("not-a-jwt")).toBeNull();
    expect(decodeJwtExp(token({ sub: "u" }))).toBeNull();
    expect(decodeJwtExp("a.%%%.c")).toBeNull();
  });
});
