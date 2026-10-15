import { describe, expect, it } from "vitest";
import {
  ALERT_FIELDS,
  differsFromDefault,
  formatSetting,
  parsePreferences,
  toRaw,
  validatePreferences,
} from "@/lib/settings";
import type { AlertPreferences } from "@/types/contract";

const base: AlertPreferences = {
  drowsy_min_seconds: 5,
  lookaway_min_seconds: 12,
  noface_min_seconds: 8,
  camera_off_min_seconds: 8,
  screen_grace_seconds: 12,
  alert_cooldown_seconds: 60,
  alert_confidence_threshold: 0.6,
  nudge_rate_limit: 3,
};

describe("validatePreferences", () => {
  it("accepts the defaults", () => {
    expect(validatePreferences(base)).toEqual({});
  });

  it("names empty, out-of-range and fractional-count fields", () => {
    const values = parsePreferences({
      ...toRaw(base),
      drowsy_min_seconds: "",
      alert_cooldown_seconds: "5",
      nudge_rate_limit: "2.5",
    });
    const problems = validatePreferences(values);
    expect(problems.drowsy_min_seconds).toBe("Enter a number");
    expect(problems.alert_cooldown_seconds).toBe("Enter 10 to 900 seconds");
    expect(problems.nudge_rate_limit).toBe("Enter a whole number");
    expect(Object.keys(problems)).toHaveLength(3);
  });
});

describe("helpers", () => {
  it("round-trips through the text form", () => {
    expect(parsePreferences(toRaw(base))).toEqual(base);
  });

  it("lists only the keys that differ from the defaults", () => {
    const edited = { ...base, lookaway_min_seconds: 20, nudge_rate_limit: 1 };
    expect(differsFromDefault(edited, base)).toEqual(["lookaway_min_seconds", "nudge_rate_limit"]);
    expect(differsFromDefault(base, base)).toEqual([]);
  });

  it("formats seconds with a unit and ratios without", () => {
    expect(formatSetting(12, "s")).toBe("12 s");
    expect(formatSetting(0.6, "")).toBe("0.6");
  });

  it("describes every preference exactly once", () => {
    expect(ALERT_FIELDS.map((f) => f.key).sort()).toEqual(Object.keys(base).sort());
  });
});
