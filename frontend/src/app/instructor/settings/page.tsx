"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import {
  ALERT_FIELDS,
  differsFromDefault,
  formatSetting,
  parsePreferences,
  toRaw,
  validatePreferences,
  type AlertPreferenceKey,
  type RawPreferences,
} from "@/lib/settings";
import type { AlertPreferencesResponse, User } from "@/types/contract";

type Busy = "profile" | "password" | "prefs" | "reset" | null;

function describe(caught: unknown): string {
  return caught instanceof ApiError ? caught.message : "Unexpected error";
}

export default function SettingsPage() {
  const toast = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [prefs, setPrefs] = useState<AlertPreferencesResponse | null>(null);
  const [raw, setRaw] = useState<RawPreferences | null>(null);
  const [errors, setErrors] = useState<Partial<Record<AlertPreferenceKey, string>>>({});
  const [password, setPassword] = useState({ current: "", next: "", confirm: "" });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get<User>("/me"), api.get<AlertPreferencesResponse>("/me/alert-preferences")])
      .then(([me, loaded]) => {
        if (cancelled) return;
        setUser(me);
        setName(me.full_name);
        setPrefs(loaded);
        setRaw(toRaw(loaded.values));
      })
      .catch((caught: unknown) => {
        toast.push({
          kind: "error",
          title: "Could not load settings",
          description: describe(caught),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("profile");
    try {
      const updated = await api.patch<User>("/me", { full_name: name });
      setUser(updated);
      setName(updated.full_name);
      toast.push({
        kind: "success",
        title: "Name saved",
        description: "The header shows the new name after the next page load.",
      });
    } catch (caught: unknown) {
      toast.push({ kind: "error", title: "Could not save name", description: describe(caught) });
    } finally {
      setBusy(null);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (password.next.length < 8) {
      setPasswordError("The new password needs at least 8 characters");
      return;
    }
    if (password.next !== password.confirm) {
      setPasswordError("The two new passwords differ");
      return;
    }
    setPasswordError(null);
    setBusy("password");
    try {
      await api.post<void>("/me/password", {
        current_password: password.current,
        new_password: password.next,
      });
      setPassword({ current: "", next: "", confirm: "" });
      toast.push({ kind: "success", title: "Password changed" });
    } catch (caught: unknown) {
      toast.push({
        kind: "error",
        title: "Could not change password",
        description: describe(caught),
      });
    } finally {
      setBusy(null);
    }
  };

  const savePreferences = async (event: FormEvent) => {
    event.preventDefault();
    if (!raw) return;
    const values = parsePreferences(raw);
    const problems = validatePreferences(values);
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;
    setBusy("prefs");
    try {
      const saved = await api.put<AlertPreferencesResponse>("/me/alert-preferences", values);
      setPrefs(saved);
      setRaw(toRaw(saved.values));
      toast.push({
        kind: "success",
        title: "Alert preferences saved",
        description: "They apply to classes you start from now on.",
      });
    } catch (caught: unknown) {
      toast.push({ kind: "error", title: "Could not save", description: describe(caught) });
    } finally {
      setBusy(null);
    }
  };

  const resetPreferences = async () => {
    setBusy("reset");
    try {
      const restored = await api.delete<AlertPreferencesResponse>("/me/alert-preferences");
      setPrefs(restored);
      setRaw(toRaw(restored.values));
      setErrors({});
      toast.push({ kind: "success", title: "Back to the defaults" });
    } catch (caught: unknown) {
      toast.push({ kind: "error", title: "Could not reset", description: describe(caught) });
    } finally {
      setBusy(null);
    }
  };

  if (!user || !prefs || !raw) return <Spinner label="Loading settings" />;

  const changed = differsFromDefault(parsePreferences(raw), prefs.defaults);
  const nameUnchanged = name.trim() === user.full_name;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-ink-muted dark:text-slate-400">
          Your account, and how patient the alert engine is in the classes you run.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Profile</h2>
          <form onSubmit={(e) => void saveProfile(e)} className="flex flex-col gap-3">
            <Input
              label="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={120}
              required
              autoComplete="name"
            />
            <Input
              label="Email"
              value={user.email}
              disabled
              hint="Sign-in email cannot be changed here."
            />
            <div>
              <Button type="submit" disabled={busy !== null || nameUnchanged}>
                {busy === "profile" ? "Saving…" : "Save name"}
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-semibold">Password</h2>
          <form onSubmit={(e) => void changePassword(e)} className="flex flex-col gap-3">
            <Input
              label="Current password"
              type="password"
              value={password.current}
              onChange={(e) => setPassword({ ...password, current: e.target.value })}
              required
              autoComplete="current-password"
            />
            <Input
              label="New password"
              type="password"
              value={password.next}
              onChange={(e) => setPassword({ ...password, next: e.target.value })}
              required
              minLength={8}
              autoComplete="new-password"
              hint="At least 8 characters."
            />
            <Input
              label="Repeat new password"
              type="password"
              value={password.confirm}
              onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
              required
              autoComplete="new-password"
              error={passwordError}
            />
            <div>
              <Button type="submit" disabled={busy !== null}>
                {busy === "password" ? "Changing…" : "Change password"}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Alert preferences</h2>
          <span className="text-xs font-medium uppercase tracking-wide text-ink-muted dark:text-slate-400">
            {prefs.customised ? "Customised" : "Using defaults"}
          </span>
        </div>
        <p className="mt-1 max-w-prose text-sm text-ink-muted dark:text-slate-400">
          How long a condition must last before a student is flagged, and how often alerts and
          nudges may repeat. Changes apply to classes you start after saving; a class already
          running keeps the settings it started with.
        </p>
        <form onSubmit={(e) => void savePreferences(e)} className="mt-4 grid gap-4 sm:grid-cols-2">
          {ALERT_FIELDS.map((field) => (
            <Input
              key={field.key}
              label={field.unit ? `${field.label} (seconds)` : field.label}
              type="number"
              inputMode="decimal"
              min={field.min}
              max={field.max}
              step={field.step}
              value={raw[field.key]}
              onChange={(e) => setRaw({ ...raw, [field.key]: e.target.value })}
              error={errors[field.key] ?? null}
              hint={`${field.help} Default ${formatSetting(prefs.defaults[field.key], field.unit)}.${
                changed.includes(field.key) ? " Changed." : ""
              }`}
            />
          ))}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={busy !== null}>
              {busy === "prefs" ? "Saving…" : "Save preferences"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy !== null || !prefs.customised}
              onClick={() => void resetPreferences()}
            >
              {busy === "reset" ? "Resetting…" : "Reset to defaults"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
