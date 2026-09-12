"use client";

import { Check, Copy, ExternalLink, Inbox } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type {
  AffiliateContentListItem,
  AffiliateContentStatus,
} from "@aff/types";
import { EmptyState } from "@/common/empty-state";
import { STATUS_LABELS } from "@/home/edit-draft-dialog";
import { useAffiliateContents } from "@/hooks/use-affiliate";
import { cn, formatTimeAgo } from "@/lib/utils";
import { Card } from "@/ui/card";

const STATUSES: AffiliateContentStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
];

const STATUS_STYLES: Record<AffiliateContentStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PUBLISHED: "bg-emerald-500/15 text-emerald-600",
  ARCHIVED: "bg-muted text-muted-foreground opacity-70",
};

const EMPTY_COPY: Record<AffiliateContentStatus, { title: string; description?: string }> = {
  DRAFT: {
    title: "Belum ada draft",
    description: "Pilih thread di halaman Home lalu Apply Template.",
  },
  PUBLISHED: {
    title: "Belum ada draft terkirim",
    description: "Tandai draft yang sudah kamu posting di Threads.",
  },
  ARCHIVED: {
    title: "Belum ada draft yang diarsipkan",
  },
};

export function QueueList() {
  const { contents, updateContent } = useAffiliateContents();
  const [tab, setTab] = useState<AffiliateContentStatus>("DRAFT");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const items = contents.data ?? [];
  const visible = items.filter((i) => i.status === tab);

  const toggleExpand = (id: string) =>
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const copy = async (item: AffiliateContentListItem) => {
    try {
      await navigator.clipboard.writeText(item.content);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const markPublished = async (item: AffiliateContentListItem) => {
    setPublishingId(item.id);
    try {
      await updateContent.mutateAsync({ id: item.id, status: "PUBLISHED" });
      toast.success("Ditandai terkirim");
    } catch {
      toast.error("Gagal memperbarui draft");
    } finally {
      setPublishingId(null);
    }
  };

  if (contents.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="h-40 animate-pulse p-5" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex w-fit gap-1 rounded-full border border-border bg-card p-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setTab(s)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              tab === s
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {STATUS_LABELS[s]} ({items.filter((i) => i.status === s).length})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={EMPTY_COPY[tab].title}
          description={EMPTY_COPY[tab].description}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((item) => {
            const expanded = expandedIds.includes(item.id);
            return (
              <Card key={item.id} className="flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {item.product}
                      </p>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                          STATUS_STYLES[item.status],
                        )}
                      >
                        {STATUS_LABELS[item.status]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.template.name} · {formatTimeAgo(item.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      title="Copy content"
                      onClick={() => copy(item)}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {copiedId === item.id ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    {item.threadPost && (
                      <a
                        href={item.threadPost.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Buka di Threads"
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    {item.status === "DRAFT" && (
                      <button
                        type="button"
                        onClick={() => markPublished(item)}
                        disabled={publishingId === item.id}
                        className="rounded-lg px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-accent disabled:opacity-50"
                      >
                        {publishingId === item.id
                          ? "Menyimpan…"
                          : "Tandai Terkirim"}
                      </button>
                    )}
                  </div>
                </div>

                {item.threadPost && (
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-xs font-medium">
                      @{item.threadPost.authorUsername}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {item.threadPost.content}
                    </p>
                  </div>
                )}

                <p
                  className={cn(
                    "whitespace-pre-wrap text-sm leading-relaxed",
                    !expanded && "line-clamp-3",
                  )}
                >
                  {item.content}
                </p>
                <button
                  type="button"
                  onClick={() => toggleExpand(item.id)}
                  className="self-start text-xs font-medium text-primary hover:underline"
                >
                  {expanded ? "Tutup" : "Selengkapnya"}
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
