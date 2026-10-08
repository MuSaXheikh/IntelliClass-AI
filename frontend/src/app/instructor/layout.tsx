"use client";

import type { ReactNode } from "react";
import { RequireRole } from "@/components/auth/RequireRole";
import { AppShell } from "@/components/layout/AppShell";

const NAV = [
  { href: "/instructor", label: "Classes" },
  { href: "/instructor/reports", label: "Reports", disabled: true },
  { href: "/instructor/settings", label: "Settings", disabled: true },
];

export default function InstructorLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role="instructor">
      <AppShell nav={NAV}>{children}</AppShell>
    </RequireRole>
  );
}
