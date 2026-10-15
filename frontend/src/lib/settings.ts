import type { AlertPreferences } from "@/types/contract";

export type AlertPreferenceKey = keyof AlertPreferences;
export type RawPreferences = Record<AlertPreferenceKey, string>;

export interface AlertFieldMeta {
  key: AlertPreferenceKey;
  label: string;
  help: string;
  min: number;
  max: number;
  step: number;
  unit: "s" | "";
}

/** Same bounds as the backend's AlertPreferencesIn; the server is still the authority. */
export const ALERT_FIELDS: readonly AlertFieldMeta[] = [
  {
    key: "drowsy_min_seconds",
    label: "Eyes closed before an alert",
    help: "How long a student's eyes must stay closed. Shorter catches dozing sooner but can flag a long blink or a glance down.",
    min: 2,
    max: 120,
    step: 0.5,
    unit: "s",
  },
  {
    key: "lookaway_min_seconds",
    label: "Looking away before an alert",
    help: "Head turned away from the screen. Keep this generous: checking notes is normal.",
    min: 2,
    max: 120,
    step: 1,
    unit: "s",
  },
  {
    key: "noface_min_seconds",
    label: "No face before an alert",
    help: "Camera on but nobody in frame.",
    min: 2,
    max: 120,
    step: 1,
    unit: "s",
  },
  {
    key: "camera_off_min_seconds",
    label: "Camera off before an alert",
    help: "The student turned the camera off or the browser lost it.",
    min: 2,
    max: 120,
    step: 1,
    unit: "s",
  },
  {
    key: "screen_grace_seconds",
    label: "Other tab or window grace",
    help: "Time allowed on another tab or window before a wrong-screen alert.",
    min: 2,
    max: 120,
    step: 1,
    unit: "s",
  },
  {
    key: "alert_cooldown_seconds",
    label: "Cooldown between repeat alerts",
    help: "After an alert for a student, the same condition is grouped instead of repeated for this long.",
    min: 10,
    max: 900,
    step: 5,
    unit: "s",
  },
  {
    key: "alert_confidence_threshold",
    label: "Minimum confidence",
    help: "Alerts below this confidence are held back. Higher means fewer, surer alerts.",
    min: 0.3,
    max: 0.95,
    step: 0.05,
    unit: "",
  },
  {
    key: "nudge_rate_limit",
    label: "Nudges per student per 10 minutes",
    help: "Caps how often one student can be nudged, so a nudge stays a quiet word.",
    min: 1,
    max: 10,
    step: 1,
    unit: "",
  },
];

export function toRaw(values: AlertPreferences): RawPreferences {
  const raw = {} as RawPreferences;
  for (const field of ALERT_FIELDS) raw[field.key] = String(values[field.key]);
  return raw;
}

/** Empty or non-numeric text becomes NaN so validation can name the field. */
export function parsePreferences(raw: RawPreferences): AlertPreferences {
  const values = {} as AlertPreferences;
  for (const field of ALERT_FIELDS) {
    const text = raw[field.key].trim();
    values[field.key] = text === "" ? Number.NaN : Number(text);
  }
  return values;
}

export function validatePreferences(
  values: AlertPreferences,
): Partial<Record<AlertPreferenceKey, string>> {
  const problems: Partial<Record<AlertPreferenceKey, string>> = {};
  for (const field of ALERT_FIELDS) {
    const value = values[field.key];
    if (!Number.isFinite(value)) {
      problems[field.key] = "Enter a number";
    } else if (value < field.min || value > field.max) {
      problems[field.key] = `Enter ${field.min} to ${field.max}${field.unit ? " seconds" : ""}`;
    } else if (field.key === "nudge_rate_limit" && !Number.isInteger(value)) {
      problems[field.key] = "Enter a whole number";
    }
  }
  return problems;
}

export function differsFromDefault(
  values: AlertPreferences,
  defaults: AlertPreferences,
): AlertPreferenceKey[] {
  return ALERT_FIELDS.filter((f) => values[f.key] !== defaults[f.key]).map((f) => f.key);
}

export function formatSetting(value: number, unit: "s" | ""): string {
  return unit ? `${value} s` : String(value);
}
