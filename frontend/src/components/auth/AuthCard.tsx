import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <p className="mb-1 text-center text-sm font-semibold text-primary dark:text-green-300">
          IntelliClass AI
        </p>
        <h1 className="mb-5 text-center text-xl font-semibold">{title}</h1>
        {children}
      </Card>
    </div>
  );
}
