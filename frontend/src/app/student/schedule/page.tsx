"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScheduleTable } from "@/components/schedule/ScheduleTable";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
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
      <PageHeader
        title="Schedule"
        description="Upcoming classes for the courses you are enrolled in. Cancelled classes stay listed so you are not caught out."
        actions={
          <Button
            variant="secondary"
            disabled={!entries || entries.length === 0}
            onClick={() =>
              void api
                .download("/schedule/export.xlsx", "intelliclass-schedule.xlsx")
                .catch(() => toast.push({ kind: "error", title: "Download failed" }))
            }
          >
            <Icon name="download" />
            Download as Excel
          </Button>
        }
      />
      {entries === null ? (
        <Spinner label="Loading schedule" />
      ) : (
        <ScheduleTable
          entries={entries}
          today={localToday()}
          emptyText="Your instructors have not published any dates yet."
        />
      )}
    </div>
  );
}
