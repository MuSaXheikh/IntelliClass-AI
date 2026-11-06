"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { BrandMark } from "@/components/layout/BrandMark";
import { Icon, type IconName } from "@/components/ui/Icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  disabled?: boolean;
}

const ITEM_BASE =
  "flex min-h-10 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors duration-150";

/** The longest matching href wins, so "/instructor" is not also lit on "/instructor/schedule". */
function activeHref(nav: NavItem[], pathname: string): string | undefined {
  return nav
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

function NavList({ nav, pathname }: { nav: NavItem[]; pathname: string }) {
  const current = activeHref(nav, pathname);
  return (
    <ul className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {nav.map((item) => {
        const active = item.href === current;
        return (
          <li key={item.href} className="shrink-0">
            {item.disabled ? (
              <span
                className={`${ITEM_BASE} cursor-not-allowed text-on-brand-muted/70`}
                aria-disabled="true"
              >
                <Icon name={item.icon} />
                {item.label}
                <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-medium">
                  Soon
                </span>
              </span>
            ) : (
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`${ITEM_BASE} ${
                  active
                    ? "bg-white/12 text-on-brand shadow-[inset_2px_0_0_var(--color-accent)]"
                    : "text-on-brand-muted hover:bg-white/8 hover:text-on-brand"
                }`}
              >
                <Icon name={item.icon} />
                {item.label}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function AppShell({ nav, children }: { nav: NavItem[]; children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const name = user?.full_name ?? "";

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-surface px-4 py-2 text-sm font-medium text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <aside className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 bg-brand p-3 text-on-brand [--color-ring:var(--color-accent)] md:sticky md:top-0 md:h-dvh md:w-60 md:flex-col md:flex-nowrap md:items-stretch md:gap-6 md:p-4">
        <Link href="/" className="mr-auto rounded-lg md:mr-0 md:px-1 md:pt-1">
          <BrandMark />
        </Link>
        <nav aria-label="Main" className="order-last w-full md:order-none md:w-auto md:flex-1">
          <NavList nav={nav} pathname={pathname} />
        </nav>
        <div className="flex min-w-0 items-center gap-2.5 md:border-t md:border-white/15 md:pt-3">
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="truncate text-sm font-medium" title={name}>
              {name}
            </p>
            <p className="truncate text-xs text-on-brand-muted">
              {user?.roll_no && <span className="font-mono">{user.roll_no} · </span>}
              <span className="capitalize">{user?.role}</span>
            </p>
          </div>
          <button
            type="button"
            aria-label="Log out"
            title="Log out"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-on-brand-muted transition-colors duration-150 hover:bg-white/10 hover:text-on-brand"
          >
            <Icon name="log-out" />
          </button>
        </div>
      </aside>
      <main id="main" className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
