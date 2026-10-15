"use client";

import { useEffect, useState } from "react";
import { ScheduleList } from "@/components/schedule/ScheduleList";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { localToday } from "@/lib/schedule";
import type { ScheduleEntry } from "@/types/contract";

export default function StudentSchedulePage() {
  const toast = useToast();
  const [entries, setEntries] = useState<ScheduleEntry[] | null>(null);

  useEffect(() => {
    api
      .get<ScheduleEntry[]>("/schedule")
      .then(setEntries)
      .catch((caught: unknown) => {
        toast.push({
          kind: "error",
          title: "Could not load the schedule",
          description: caught instanceof ApiError ? caught.message : "Unexpected error",
        });
        setEntries([]);
      });
  }, [toast]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Schedule</h1>
        <p className="text-sm text-ink-muted dark:text-slate-400">
          Upcoming classes for the courses you are enrolled in. Cancelled classes stay listed so you
          are not caught out.
        </p>
      </div>
      {entries === null ? (
        <Spinner label="Loading schedule" />
      ) : (
        <ScheduleList
          entries={entries}
          today={localToday()}
          emptyText="Your instructors have not published any dates yet."
        />
      )}
    </div>
  );
}
