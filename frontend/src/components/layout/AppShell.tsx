"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";

export interface NavItem {
  href: string;
  label: string;
  disabled?: boolean;
}

export function AppShell({ nav, children }: { nav: NavItem[]; children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="w-full border-b border-line bg-surface p-4 md:w-60 md:border-b-0 md:border-r dark:border-slate-700 dark:bg-slate-900">
        <Link href="/" className="mb-6 block text-lg font-bold text-primary dark:text-green-300">
          IntelliClass AI
        </Link>
        <nav aria-label="Main">
          <ul className="flex gap-1 md:flex-col">
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  {item.disabled ? (
                    <span
                      className="block rounded-lg px-3 py-2 text-sm text-slate-400"
                      aria-disabled="true"
                      title="Coming in a later sprint"
                    >
                      {item.label}
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded-lg px-3 py-2 text-sm ${active ? "bg-primary/10 font-medium text-primary dark:bg-green-900/40 dark:text-green-200" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm">
            <span className="font-medium">{user?.full_name}</span>
            {user?.roll_no && (
              <span className="ml-2 font-mono text-xs text-ink-muted">{user.roll_no}</span>
            )}
            <span className="ml-2 text-xs uppercase tracking-wide text-ink-muted dark:text-slate-400">
              {user?.role}
            </span>
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
          >
            Log out
          </Button>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
