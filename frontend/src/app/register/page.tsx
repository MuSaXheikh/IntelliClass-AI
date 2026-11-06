"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { homePathFor, useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { ApiError } from "@/lib/api";

type RegisterRole = "student" | "instructor";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<RegisterRole>("student");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (role === "student" && !rollNo.trim()) {
      setError("Roll number is required for students.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const me = await register({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        role,
        ...(role === "student" ? { roll_no: rollNo.trim() } : {}),
      });
      router.replace(homePathFor(me));
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Could not register. Is the server running?",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Create your account" subtitle="It takes less than a minute.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">I am a</legend>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-muted p-1">
            {(["student", "instructor"] as const).map((option) => (
              <label
                key={option}
                className={`flex min-h-9 items-center justify-center rounded-md text-sm font-medium capitalize transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring ${role === option ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink"}`}
              >
                <input
                  type="radio"
                  name="role"
                  value={option}
                  checked={role === option}
                  onChange={() => setRole(option)}
                  className="sr-only"
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>
        <Input
          label="Full name"
          required
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {role === "student" && (
          <Input
            label="Roll number"
            required
            value={rollNo}
            onChange={(e) => setRollNo(e.target.value)}
            hint="Your instructor enrols you by this number"
            className="font-mono"
          />
        )}
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-muted">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-primary-ink underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
