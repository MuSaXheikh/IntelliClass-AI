"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { homePathFor, useAuth } from "@/components/auth/AuthProvider";
import { Spinner } from "@/components/ui/Spinner";
import type { Role } from "@/types/contract";

/** Client-side route guard. Unauthenticated → /login; wrong role → that role's home. */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = Boolean(user && (user.role === role || user.role === "admin"));

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!allowed) router.replace(homePathFor(user));
  }, [loading, user, allowed, router]);

  if (loading || !allowed) {
    return (
      <div
        className="flex flex-1 items-center justify-center p-10"
        role="status"
        aria-live="polite"
      >
        <Spinner label="Checking your session" />
      </div>
    );
  }
  return <>{children}</>;
}
