import type { Metadata } from "next";
import { PageHeader } from "@/common/page-header";
import { QueueList } from "@/queue/queue-list";

export const metadata: Metadata = {
  title: "Reply Queue",
};

export default function QueuePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reply Queue"
        description="Drafts generated from real Threads posts. Review, copy, and publish manually."
      />
      <QueueList />
    </div>
  );
}
