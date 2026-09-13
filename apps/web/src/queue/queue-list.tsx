"use client";

import { Clock, ExternalLink, Inbox, Link2, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type {
  AffiliateContentListItem,
  AffiliateContentStatus,
} from "@aff/types";
import { ConfirmDialog } from "@/common/confirm-dialog";
import { CopyButton } from "@/common/copy-button";
import { EmptyState } from "@/common/empty-state";
import { SelectCheckbox } from "@/common/select-checkbox";
import { SelectionBar } from "@/common/selection-bar";
import { STATUS_LABELS } from "@/home/edit-draft-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { listItem, listStagger } from "@/animations/list-motion";
import { useAffiliateContents } from "@/hooks/use-affiliate";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { proxiedImage } from "@/lib/image";
import { cn, formatTimeAgo } from "@/lib/utils";
import { AppPagination } from "@/pagination/app-pagination";
import { Button } from "@/ui/button";
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

function DraftAvatar({ item }: { item: AffiliateContentListItem }) {
  const [failed, setFailed] = useState(false);
  const post = item.threadPost;
  const name = post?.authorDisplayName ?? post?.authorUsername ?? item.product;
  const src = proxiedImage(post?.authorAvatarUrl);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground"
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

const EXPIRY_HOURS = 24;

/** Draft yang lewat 24 jam tidak diubah statusnya — hanya ditandai. */
function isExpired(item: AffiliateContentListItem): boolean {
  if (item.status !== "DRAFT") return false;
  return Date.now() - new Date(item.createdAt).getTime() > EXPIRY_HOURS * 3600_000;
}

export function QueueList() {
  const { contents, updateContent, deleteContent } = useAffiliateContents();
  const [tab, setTab] = useState<AffiliateContentStatus>("DRAFT");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] =
    useState<AffiliateContentListItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const items = contents.data ?? [];
  const visible = items.filter((i) => i.status === tab);
  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    visible: pageItems,
  } = useClientPagination(visible, tab);

  const selected = visible.filter((i) => selectedIds.includes(i.id));

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const changeTab = (next: AffiliateContentStatus) => {
    // Pilihan tidak boleh bocor antar tab: item yang dipilih di Draft tidak
    // kelihatan lagi setelah pindah ke Published, tapi tetap akan ikut terhapus.
    setTab(next);
    setSelectedIds([]);
  };

  const removeOne = async (item: AffiliateContentListItem) => {
    try {
      await deleteContent.mutateAsync(item.id);
      toast.success("Draft dihapus");
    } catch {
      toast.error("Gagal menghapus draft");
    }
    setDeleteTarget(null);
  };

  const removeSelected = async () => {
    setBulkDeleting(true);
    const results = await Promise.allSettled(
      selected.map((item) => deleteContent.mutateAsync(item.id)),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    setBulkDeleting(false);
    setBulkDeleteOpen(false);
    setSelectedIds([]);
    if (failed === 0) {
      toast.success(`${results.length} draft dihapus`);
    } else {
      toast.error(`${failed} dari ${results.length} draft gagal dihapus`);
    }
  };

  const toggleExpand = (id: string) =>
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

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
            onClick={() => changeTab(s)}
            className={cn(
              "relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              tab === s
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab === s && (
              <motion.span
                layoutId="queue-tab"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                className="absolute inset-0 rounded-full bg-primary"
              />
            )}
            <span className="relative">
              {STATUS_LABELS[s]} ({items.filter((i) => i.status === s).length})
            </span>
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
        <>
        <AnimatePresence mode="wait">
        <motion.div
          key={`${tab}-${page}-${pageSize}`}
          variants={listStagger}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="grid gap-4 sm:grid-cols-2"
        >
          {pageItems.map((item) => {
            const expanded = expandedIds.includes(item.id);
            return (
              <motion.div key={item.id} variants={listItem}>
              <Card
                onClick={() => toggleSelect(item.id)}
                className={cn(
                  "flex cursor-pointer flex-col gap-4 p-5",
                  selectedIds.includes(item.id) && "ring-2 ring-primary",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <SelectCheckbox
                    checked={selectedIds.includes(item.id)}
                    onToggle={() => toggleSelect(item.id)}
                    label={item.product}
                    className="mt-1"
                  />
                  <DraftAvatar item={item} />
                  <div className="min-w-0 flex-1">
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
                      {item.autoPublishedAt && (
                        <span
                          title={`Terdeteksi otomatis ${formatTimeAgo(item.autoPublishedAt)}`}
                          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600"
                        >
                          <Sparkles className="h-3 w-3" />
                          Auto {formatTimeAgo(item.autoPublishedAt)}
                        </span>
                      )}
                      {isExpired(item) && (
                        <span
                          title="Belum terdeteksi terbit setelah 24 jam"
                          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                        >
                          <Clock className="h-3 w-3" />
                          Lewat 24 jam
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.template.name} · {formatTimeAgo(item.createdAt)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {item.postUrl && (
                      <a
                        href={item.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        Lihat post di Threads
                      </a>
                    )}
                    {(item.link || item.affiliateLink) && (
                      <a
                        href={item.link?.url ?? item.affiliateLink ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title={item.link?.url ?? item.affiliateLink ?? ""}
                        className="inline-flex max-w-full items-center gap-1 truncate text-xs font-medium text-primary hover:underline"
                      >
                        <Link2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {item.link?.name ?? item.affiliateLink}
                        </span>
                      </a>
                    )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <CopyButton value={item.content} />
                    {item.threadPost && (
                      <a
                        href={item.threadPost.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Buka di Threads"
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <motion.button
                      type="button"
                      title="Hapus draft"
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(item);
                      }}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </motion.button>
                    {item.status === "DRAFT" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markPublished(item);
                        }}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(item.id);
                  }}
                  className="self-start text-xs font-medium text-primary hover:underline"
                >
                  {expanded ? "Tutup" : "Selengkapnya"}
                </button>
              </Card>
              </motion.div>
            );
          })}
        </motion.div>
        </AnimatePresence>
        <SelectionBar count={selected.length} onCancel={() => setSelectedIds([])}>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteOpen(true)}
          >
            Hapus
          </Button>
        </SelectionBar>

        <ConfirmDialog
          open={bulkDeleteOpen}
          onOpenChange={setBulkDeleteOpen}
          title={`Hapus ${selected.length} draft?`}
          description="Draft yang dipilih akan dihapus permanen dari Reply Queue."
          confirmLabel="Hapus"
          cancelLabel="Batal"
          destructive
          loading={bulkDeleting}
          onConfirm={removeSelected}
        />

        <AppPagination
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
        </>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Hapus draft?"
        description={
          deleteTarget
            ? `Draft "${deleteTarget.product}" akan dihapus permanen.`
            : undefined
        }
        confirmLabel="Hapus"
        cancelLabel="Batal"
        destructive
        loading={deleteContent.isPending}
        onConfirm={() => deleteTarget && removeOne(deleteTarget)}
      />
    </div>
  );
}
