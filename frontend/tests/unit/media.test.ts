import { describe, expect, it } from "vitest";
import { describeMediaError } from "@/lib/media";

const dom = (name: string) => new DOMException("boom", name);

describe("describeMediaError", () => {
  it("explains a blocked permission", () => {
    expect(describeMediaError(dom("NotAllowedError"), "camera")).toMatch(/address bar/);
  });
  it("explains a missing device", () => {
    expect(describeMediaError(dom("NotFoundError"), "camera")).toBe(
      "No camera was found on this device.",
    );
  });
  it("adapts the wording for the microphone", () => {
    expect(describeMediaError(dom("NotReadableError"), "microphone")).toMatch(
      /microphone is in use/,
    );
  });
  it("falls back to the error message", () => {
    expect(describeMediaError(new Error("weird"), "camera")).toBe("weird");
  });
});

describe("describeMediaError for screen sharing", () => {
  it("uses screen-specific wording", () => {
    const cancelled = new DOMException("denied", "NotAllowedError");
    expect(describeMediaError(cancelled, "screen")).toMatch(/Screen sharing was cancelled/);
    expect(describeMediaError(new DOMException("x", "InvalidStateError"), "screen")).toMatch(
      /click/,
    );
    // no mediaDevices in the test environment: the generic HTTPS hint, worded for screens
    expect(describeMediaError(new TypeError("boom"), "screen")).toMatch(
      /Screen sharing needs HTTPS/,
    );
  });
});
