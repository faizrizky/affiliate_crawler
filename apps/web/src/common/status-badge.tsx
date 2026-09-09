import type { CrawlJobStatus } from "@aff/types";
import { Badge } from "@/ui/badge";

const STATUS: Record<
  CrawlJobStatus,
  { label: string; variant: "default" | "primary" | "success" | "destructive" }
> = {
  QUEUED: { label: "Queued", variant: "default" },
  RUNNING: { label: "Crawling", variant: "primary" },
  COMPLETED: { label: "Completed", variant: "success" },
  FAILED: { label: "Failed", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "default" },
};

export function StatusBadge({ status }: { status: CrawlJobStatus }) {
  const s = STATUS[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
