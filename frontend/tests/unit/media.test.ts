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
