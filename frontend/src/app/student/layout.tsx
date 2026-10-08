"use client";

import type { ReactNode } from "react";
import { RequireRole } from "@/components/auth/RequireRole";
import { AppShell } from "@/components/layout/AppShell";

const NAV = [
  { href: "/student", label: "My classes" },
  { href: "/student/summary", label: "My summary", disabled: true },
  { href: "/student/notes", label: "Lecture notes", disabled: true },
];

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role="student">
      <AppShell nav={NAV}>{children}</AppShell>
    </RequireRole>
  );
}
