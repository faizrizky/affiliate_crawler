"use client";

import { useState } from "react";
import type { Topic } from "@aff/types";
import { Tags } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/common/confirm-dialog";
import { EmptyState } from "@/common/empty-state";
import { useTopics } from "@/hooks/use-topics";
import { useSearchStore } from "@/stores/search-store";
import { Skeleton } from "@/ui/skeleton";
import { TopicCard } from "./topic-card";

export function RecentTopics() {
  const { topics, deleteTopic } = useTopics();
  const activeTopicId = useSearchStore((s) => s.activeTopicId);
  const setActiveTopic = useSearchStore((s) => s.setActiveTopic);
  const [deleteTarget, setDeleteTarget] = useState<Topic | null>(null);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">Recent topics</h2>
      {topics.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : topics.data && topics.data.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topics.data.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              active={topic.id === activeTopicId}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Tags}
          title="No topics yet"
          description="Search a keyword above — every topic you crawl shows up here."
        />
      )}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete topic?"
        description={
          deleteTarget
            ? `"${deleteTarget.keyword}" and its ${deleteTarget.postCount} post${deleteTarget.postCount === 1 ? "" : "s"} will be permanently deleted.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        loading={deleteTopic.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteTopic.mutateAsync(deleteTarget.id);
            if (deleteTarget.id === activeTopicId) setActiveTopic(null);
            toast.success("Topic deleted");
            setDeleteTarget(null);
          } catch {
            toast.error("Could not delete topic");
          }
        }}
      />
    </section>
  );
}
