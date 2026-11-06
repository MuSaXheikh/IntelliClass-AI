import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/BrandMark";
import { Icon, type IconName } from "@/components/ui/Icon";

const PROMISES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "shield-check",
    title: "Analysed on the student's device",
    text: "Webcam analysis runs inside the browser. Only numeric signals reach the server.",
  },
  {
    icon: "video-off",
    title: "Signals, never surveillance",
    text: "No video or screenshot is ever stored or shown to the instructor.",
  },
  {
    icon: "bell",
    title: "Few alerts you can trust",
    text: "Instructors see what needs attention and can send one student a private nudge.",
  },
];

/** Sign-in layout: the product's privacy promise beside the form, stacked on small screens. */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden flex-col justify-between bg-brand p-10 text-on-brand lg:flex xl:p-14">
        <BrandMark />
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Keeping students focused online, without watching them.
          </h2>
          <ul className="mt-8 flex flex-col gap-5">
            {PROMISES.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-accent">
                  <Icon name={item.icon} className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-sm text-on-brand-muted">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-on-brand-muted">
          Final Year Project, Department of Information Sciences, University of Education, Lahore
        </p>
      </aside>
      <div className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="inline-flex rounded-xl bg-brand py-2 pl-2 pr-3.5 text-on-brand">
              <BrandMark />
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
