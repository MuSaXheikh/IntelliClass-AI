"use client";

import type { ReactNode } from "react";
import { RequireRole } from "@/components/auth/RequireRole";
import { AppShell, type NavItem } from "@/components/layout/AppShell";

const NAV: NavItem[] = [
  { href: "/instructor", label: "Classes", icon: "layers" },
  { href: "/instructor/schedule", label: "Schedule", icon: "calendar" },
  { href: "/instructor/reports", label: "Reports", icon: "bar-chart" },
  { href: "/instructor/settings", label: "Settings", icon: "sliders" },
];

export default function InstructorLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role="instructor">
      <AppShell nav={NAV}>{children}</AppShell>
    </RequireRole>
  );
}
