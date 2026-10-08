"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { homePathFor, useAuth } from "@/components/auth/AuthProvider";
import { Spinner } from "@/components/ui/Spinner";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) router.replace(homePathFor(user));
  }, [loading, user, router]);

  return (
    <div className="flex flex-1 items-center justify-center p-10">
      <Spinner label="Opening IntelliClass AI" />
    </div>
  );
}
