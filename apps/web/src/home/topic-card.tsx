"use client";

import type { Topic } from "@aff/types";
import { Eye, Trash2 } from "lucide-react";
import { StatusBadge } from "@/common/status-badge";
import { useSearchStore } from "@/stores/search-store";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";

export function TopicCard({
  topic,
  active,
  onDelete,
}: {
  topic: Topic;
  active: boolean;
  onDelete: (topic: Topic) => void;
}) {
  const setActiveTopic = useSearchStore((s) => s.setActiveTopic);

  return (
    <Card
      className={cn(
        "flex h-full flex-col p-5",
        active && "ring-2 ring-primary",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold">{topic.keyword}</h3>
        {topic.lastJobStatus && <StatusBadge status={topic.lastJobStatus} />}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {topic.postCount} post{topic.postCount === 1 ? "" : "s"} · created{" "}
        {new Date(topic.createdAt).toLocaleDateString()}
      </p>
      <div className="mt-auto flex justify-end gap-2 border-t border-border pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setActiveTopic(topic.id);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <Eye />
          View posts
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-red-50 hover:text-destructive"
          onClick={() => onDelete(topic)}
        >
          <Trash2 />
          Delete
        </Button>
      </div>
    </Card>
  );
}
