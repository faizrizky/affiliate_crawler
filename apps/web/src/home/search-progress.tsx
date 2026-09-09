"use client";

import type { CrawlJob } from "@aff/types";
import { LoaderCircle } from "lucide-react";
import { StatusBadge } from "@/common/status-badge";
import { Card, CardContent } from "@/ui/card";

export function SearchProgress({ job }: { job: CrawlJob }) {
  const percent = job.status === "RUNNING" ? job.progress : 0;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-3">
          <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm font-medium">
            {job.status === "QUEUED"
              ? "Waiting for the crawler…"
              : "Crawling Threads…"}
          </p>
          <StatusBadge status={job.status} />
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-accent"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
