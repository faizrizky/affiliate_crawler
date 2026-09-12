"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import type {
  AffiliateContentListItem,
  AffiliateContentStatus,
} from "@aff/types";
import { listItem, listStagger } from "@/animations/list-motion";
import { sheetMotion } from "@/animations/modal-motion";
import { ConfirmDialog } from "@/common/confirm-dialog";
import { CopyButton } from "@/common/copy-button";
import { EditDraftDialog, STATUS_LABELS } from "@/home/edit-draft-dialog";
import { useAffiliateContents } from "@/hooks/use-affiliate";
import { copyText } from "@/lib/clipboard";
import { cn, formatTimeAgo } from "@/lib/utils";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";

const STATUS_STYLES: Record<AffiliateContentStatus, string> = {
  DRAFT: "bg-secondary text-secondary-foreground",
  PUBLISHED: "bg-emerald-500/15 text-emerald-600",
  ARCHIVED: "bg-muted text-muted-foreground opacity-70",
};

function Avatar({ draft }: { draft: AffiliateContentListItem }) {
  const [failed, setFailed] = useState(false);
  const name =
    draft.threadPost?.authorDisplayName ??
    draft.threadPost?.authorUsername ??
    draft.product;
  const url = draft.threadPost?.authorAvatarUrl;

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-11 w-11 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function Drafts() {
  const { contents, deleteContent } = useAffiliateContents();
  const [deleteTarget, setDeleteTarget] =
    useState<AffiliateContentListItem | null>(null);
  const [editTarget, setEditTarget] =
    useState<AffiliateContentListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const drafts = contents.data?.slice(0, 5) ?? [];
  const selected = drafts.filter((d) => selectedIds.includes(d.id));

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const copySelected = async () => {
    const ok = await copyText(selected.map((d) => d.content).join("\n\n"));
    if (ok) {
      toast.success(`${selected.length} draft disalin`);
      setSelectedIds([]);
    } else {
      toast.error("Gagal menyalin ke clipboard");
    }
  };

  const deleteSelected = async () => {
    try {
      await Promise.all(selected.map((d) => deleteContent.mutateAsync(d.id)));
      toast.success(`${selected.length} draft dihapus`);
      setSelectedIds([]);
    } catch {
      toast.error("Gagal menghapus draft");
    }
    setBulkDeleteOpen(false);
  };

  if (drafts.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Drafts</h2>
        <Link
          href="/queue"
          className="text-sm font-medium text-primary hover:underline"
        >
          Reply Queue →
        </Link>
      </div>

      <motion.ul
        variants={listStagger}
        initial="hidden"
        animate="visible"
        className="flex list-none flex-col gap-3"
      >
        {drafts.map((draft) => {
          const isSelected = selectedIds.includes(draft.id);
          return (
            <motion.li key={draft.id} variants={listItem}>
              <Card className="border-transparent p-4 shadow-[0_10px_30px_-22px_rgba(140,30,60,0.45)] sm:p-5">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-3 xl:flex-nowrap xl:items-center xl:gap-6">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label={
                      isSelected ? "Batalkan pilih draft" : "Pilih draft"
                    }
                    onClick={() => toggleSelect(draft.id)}
                    className={cn(
                      "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-[7px] border transition-colors xl:mt-0",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-card hover:border-primary",
                    )}
                  >
                    <AnimatePresence initial={false}>
                      {isSelected && (
                        <motion.span
                          initial={{ scale: 0.4, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.4, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>

                  <Avatar draft={draft} />

                  <div className="min-w-0 flex-1 xl:w-56 xl:flex-none">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">
                          {draft.product}
                        </p>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                            STATUS_STYLES[draft.status],
                          )}
                        >
                          {STATUS_LABELS[draft.status]}
                        </span>
                      </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {draft.template.name} · {formatTimeAgo(draft.createdAt)}
                    </p>
                  </div>

                  <div className="order-last w-full min-w-0 xl:order-4 xl:w-auto xl:flex-1">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {draft.content}
                      </p>
                    {draft.affiliateLink && (
                      <a
                        href={draft.affiliateLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block truncate text-xs font-medium text-primary hover:underline"
                      >
                        {draft.affiliateLink}
                      </a>
                    )}
                  </div>

                  <div className="ml-auto flex shrink-0 items-center gap-1 self-start xl:order-5 xl:self-center">
                    <motion.button
                      type="button"
                      title="Edit draft"
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setEditTarget(draft)}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </motion.button>
                    <CopyButton value={draft.content} />
                    <motion.button
                      type="button"
                      title="Delete draft"
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setDeleteTarget(draft)}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </motion.button>
                  </div>
                </div>
              </Card>
            </motion.li>
          );
        })}
      </motion.ul>

      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div
            key="drafts-bulk-bar"
            variants={sheetMotion}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed inset-x-0 bottom-28 z-40 px-4 md:bottom-6"
          >
            <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-full bg-card px-4 py-3 shadow-lg">
              <span className="text-sm font-medium">
                {selected.length} dipilih
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds([])}
                >
                  Batal
                </Button>
                <Button variant="outline" size="sm" onClick={copySelected}>
                  Salin
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  Hapus
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <EditDraftDialog
        draft={editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Hapus ${selected.length} draft?`}
        description="Draft yang dipilih akan dihapus permanen."
        confirmLabel="Hapus"
        destructive
        loading={deleteContent.isPending}
        onConfirm={deleteSelected}
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
