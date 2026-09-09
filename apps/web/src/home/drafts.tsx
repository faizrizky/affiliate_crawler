"use client";

import { Copy, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type {
  AffiliateContentListItem,
  AffiliateContentStatus,
} from "@aff/types";
import { ConfirmDialog } from "@/common/confirm-dialog";
import { EditDraftDialog, STATUS_LABELS } from "@/home/edit-draft-dialog";
import { useAffiliateContents } from "@/hooks/use-affiliate";
import { formatTimeAgo } from "@/lib/utils";
import { Card } from "@/ui/card";

const STATUS_STYLES: Record<AffiliateContentStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PUBLISHED: "bg-emerald-500/15 text-emerald-600",
  ARCHIVED: "bg-muted text-muted-foreground opacity-70",
};

export function Drafts() {
  const { contents, deleteContent } = useAffiliateContents();
  const [deleteTarget, setDeleteTarget] =
    useState<AffiliateContentListItem | null>(null);
  const [editTarget, setEditTarget] =
    useState<AffiliateContentListItem | null>(null);
  const drafts = contents.data?.slice(0, 5) ?? [];

  const copy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  if (drafts.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">Drafts</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {drafts.map((draft) => (
          <Card key={draft.id} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">
                    {draft.product}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[draft.status]}`}
                  >
                    {STATUS_LABELS[draft.status]}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {draft.template.name} · {formatTimeAgo(draft.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  title="Edit draft"
                  onClick={() => setEditTarget(draft)}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Copy content"
                  onClick={() => copy(draft.content)}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Delete draft"
                  onClick={() => setDeleteTarget(draft)}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
              {draft.content}
            </p>

            {draft.affiliateLink && (
              <a
                href={draft.affiliateLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 truncate text-xs font-medium text-primary hover:underline"
              >
                {draft.affiliateLink}
              </a>
            )}
          </Card>
        ))}
      </div>

      <EditDraftDialog
        draft={editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete draft?"
        description={
          deleteTarget
            ? `"${deleteTarget.product}" will be permanently removed.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        loading={deleteContent.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteContent.mutateAsync(deleteTarget.id);
            toast.success("Draft deleted");
          } catch {
            toast.error("Could not delete draft");
          }
          setDeleteTarget(null);
        }}
      />
    </section>
  );
}
