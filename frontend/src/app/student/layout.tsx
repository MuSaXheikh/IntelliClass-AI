"use client";

import type { ReactNode } from "react";
import { RequireRole } from "@/components/auth/RequireRole";
import { AppShell, type NavItem } from "@/components/layout/AppShell";

const NAV: NavItem[] = [
  { href: "/student", label: "My classes", icon: "book-open" },
  { href: "/student/schedule", label: "Schedule", icon: "calendar" },
  { href: "/student/summary", label: "My summary", icon: "activity" },
  { href: "/student/notes", label: "Lecture notes", icon: "file-text", disabled: true },
];

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role="student">
      <AppShell nav={NAV}>{children}</AppShell>
    </RequireRole>
  );
}
