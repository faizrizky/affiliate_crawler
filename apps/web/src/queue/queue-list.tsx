"use client";

import { Check, Clock, ExternalLink, FileText, FolderOpen, Inbox, Link2, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type {
  AffiliateContentListItem,
  AffiliateContentStatus,
} from "@aff/types";
import { ConfirmDialog } from "@/common/confirm-dialog";
import { CopyButton } from "@/common/copy-button";
import { EmptyState } from "@/common/empty-state";
import { SearchableMultiSelect } from "@/common/searchable-multi-select";
import { SelectCheckbox } from "@/common/select-checkbox";
import { SelectionBar } from "@/common/selection-bar";
import { STATUS_LABELS } from "@/home/edit-draft-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { listItem, listStagger } from "@/animations/list-motion";
import { useAffiliateContents } from "@/hooks/use-affiliate";
import { useCategories } from "@/hooks/use-categories";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { keepKnown, matchesAny, UNCATEGORIZED } from "@/lib/filter";
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

// Target sentuh 40px di layar sentuh, sedikit lebih rapat mulai sm.
const ICON_ACTION =
  "inline-flex h-10 w-10 items-center justify-center rounded-lg p-0 text-muted-foreground transition-colors hover:bg-accent sm:h-9 sm:w-9";

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
  const { categories } = useCategories();
  const [tab, setTab] = useState<AffiliateContentStatus>("DRAFT");
  const [templateFilter, setTemplateFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] =
    useState<AffiliateContentListItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const items = contents.data ?? [];
  const categoryOptions = categories.data ?? [];

  // Opsi template diambil dari draft yang ada (menghapus template ikut
  // menghapus draft-nya, jadi daftar ini selalu valid).
  const templateOptions = Array.from(
    new Map(items.map((i) => [i.template.id, i.template.name])),
    ([value, label]) => ({ value, label }),
  ).sort((a, b) => a.label.localeCompare(b.label));

  // Pilihan yang opsinya sudah hilang (mis. kategori dihapus) diabaikan.
  const activeTemplates = keepKnown(templateFilter, templateOptions.map((o) => o.value));
  const activeCategories = keepKnown(categoryFilter, [
    UNCATEGORIZED,
    ...categoryOptions.map((c) => c.id),
  ]);
  const filterActive = activeTemplates.length > 0 || activeCategories.length > 0;

  // OR di dalam satu filter, AND antar filter.
  const matchesFilters = (i: AffiliateContentListItem) =>
    matchesAny(i.template.id, activeTemplates) &&
    matchesAny(i.template.categoryId, activeCategories);

  const tabItems = items.filter((i) => i.status === tab);
  const visible = tabItems.filter(matchesFilters);
  const filterKey = `${activeTemplates.join(",")}|${activeCategories.join(",")}`;
  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    visible: pageItems,
  } = useClientPagination(visible, `${tab}-${filterKey}`);

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

  // Ganti filter juga mengosongkan pilihan: draft yang tersembunyi tidak
  // boleh ikut terhapus lewat bulk delete.
  const changeTemplateFilter = (next: string[]) => {
    setTemplateFilter(next);
    setSelectedIds([]);
  };

  const changeCategoryFilter = (next: string[]) => {
    setCategoryFilter(next);
    setSelectedIds([]);
  };

  const resetFilters = () => {
    setTemplateFilter([]);
    setCategoryFilter([]);
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
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="h-40 animate-pulse p-5" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mobile: tab membentang selebar layar; kalau jumlahnya membesar dan
          tidak muat, bar bisa digeser sendiri tanpa ikut menggeser halaman. */}
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <div
          role="tablist"
          aria-label="Status draft"
          className="flex w-full min-w-max gap-1 rounded-full border border-border bg-card p-1 sm:w-fit"
        >
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={tab === s}
              onClick={() => changeTab(s)}
              className={cn(
                "relative flex-1 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-colors sm:flex-none sm:px-4 sm:py-1.5",
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
                {STATUS_LABELS[s]} ({items.filter((i) => i.status === s && matchesFilters(i)).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {items.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchableMultiSelect
            id="queue-template-filter"
            label="Filter template"
            allLabel="Semua template"
            icon={FileText}
            searchPlaceholder="Cari template…"
            values={activeTemplates}
            onChange={changeTemplateFilter}
            options={templateOptions.map((o) => ({
              ...o,
              count: tabItems.filter((i) => i.template.id === o.value).length,
            }))}
            className="w-full sm:w-auto"
          />
          <SearchableMultiSelect
            id="queue-category-filter"
            label="Filter kategori"
            allLabel="Semua kategori"
            icon={FolderOpen}
            searchPlaceholder="Cari kategori…"
            values={activeCategories}
            onChange={changeCategoryFilter}
            options={[
              ...categoryOptions.map((c) => ({
                value: c.id,
                label: c.name,
                count: tabItems.filter((i) => i.template.categoryId === c.id).length,
              })),
              {
                value: UNCATEGORIZED,
                label: "Tanpa kategori",
                count: tabItems.filter((i) => !i.template.categoryId).length,
              },
            ]}
            className="w-full sm:w-auto"
          />
          {filterActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="self-start sm:self-auto"
            >
              Reset filter
            </Button>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        tabItems.length > 0 && filterActive ? (
          <EmptyState
            icon={FolderOpen}
            title="Tidak ada draft yang cocok dengan filter"
            description="Ubah pilihan template atau kategori, atau tampilkan semua draft."
            action={
              <Button variant="outline" onClick={resetFilters}>
                Reset filter
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Inbox}
            title={EMPTY_COPY[tab].title}
            description={EMPTY_COPY[tab].description}
          />
        )
      ) : (
        <>
        <AnimatePresence mode="wait">
        <motion.div
          key={`${tab}-${filterKey}-${page}-${pageSize}`}
          variants={listStagger}
          initial="hidden"
          animate="visible"
          exit="hidden"
          // Satu kolom sampai lg: di tablet dua kolom membuat judul & link
          // tergencet habis oleh tombol aksi.
          className="grid gap-4 lg:grid-cols-2"
        >
          {pageItems.map((item) => {
            const expanded = expandedIds.includes(item.id);
            const isSelected = selectedIds.includes(item.id);
            const linkUrl = item.link?.url ?? item.affiliateLink;
            return (
              // min-w-0: item grid default-nya min-width:auto, sehingga URL
              // panjang bisa melebarkan kartu melewati layar.
              <motion.div key={item.id} variants={listItem} className="min-w-0">
              <Card
                onClick={() => toggleSelect(item.id)}
                className={cn(
                  "flex h-full cursor-pointer flex-col gap-3 p-4 sm:gap-4 sm:p-5",
                  isSelected && "ring-2 ring-primary",
                )}
              >
                <div className="flex items-start gap-3">
                  <SelectCheckbox
                    checked={isSelected}
                    onToggle={() => toggleSelect(item.id)}
                    label={item.product}
                    className="mt-2"
                  />
                  <DraftAvatar item={item} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold" title={item.product}>
                      {item.product}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {item.template.name} · {formatTimeAgo(item.createdAt)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          STATUS_STYLES[item.status],
                        )}
                      >
                        {STATUS_LABELS[item.status]}
                      </span>
                      {item.autoPublishedAt && (
                        <span
                          title={`Terdeteksi otomatis ${formatTimeAgo(item.autoPublishedAt)}`}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600"
                        >
                          <Sparkles className="h-3 w-3" />
                          Auto {formatTimeAgo(item.autoPublishedAt)}
                        </span>
                      )}
                      {isExpired(item) && (
                        <span
                          title="Belum terdeteksi terbit setelah 24 jam"
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                        >
                          <Clock className="h-3 w-3" />
                          Lewat 24 jam
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {(item.postUrl || linkUrl) && (
                  <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
                    {item.postUrl && (
                      <a
                        href={item.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex max-w-full items-center gap-1 self-start text-xs font-medium text-emerald-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        Lihat post di Threads
                      </a>
                    )}
                    {linkUrl && (
                      <a
                        href={linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title={linkUrl}
                        className="inline-flex min-w-0 max-w-full items-center gap-1 self-start text-xs font-medium text-primary hover:underline"
                      >
                        <Link2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {item.link?.name ?? item.affiliateLink}
                        </span>
                      </a>
                    )}
                  </div>
                )}

                {item.threadPost && (
                  <div className="min-w-0 rounded-xl bg-muted/50 p-3">
                    <p className="truncate text-xs font-medium">
                      @{item.threadPost.authorUsername}
                    </p>
                    <p className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">
                      {item.threadPost.content}
                    </p>
                  </div>
                )}

                <div>
                  {/* overflow-wrap:anywhere supaya URL affiliate panjang tetap
                      patah di dalam kartu, bukan melebarkannya. */}
                  <p
                    className={cn(
                      "whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]",
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
                    className="mt-1 py-1 text-xs font-medium text-primary hover:underline"
                  >
                    {expanded ? "Tutup" : "Selengkapnya"}
                  </button>
                </div>

                {/* Aksi di baris sendiri: tidak lagi berebut lebar dengan judul. */}
                <div className="mt-auto flex items-center gap-1 border-t border-border pt-3">
                  <CopyButton
                    value={item.content}
                    title="Salin draft"
                    className={cn(ICON_ACTION, "hover:text-foreground")}
                  />
                  {item.threadPost && (
                    <a
                      href={item.threadPost.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="Buka di Threads"
                      aria-label="Buka di Threads"
                      className={cn(ICON_ACTION, "hover:text-foreground")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <motion.button
                    type="button"
                    title="Hapus draft"
                    aria-label="Hapus draft"
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(item);
                    }}
                    className={cn(ICON_ACTION, "hover:text-destructive")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </motion.button>
                  {item.status === "DRAFT" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        markPublished(item);
                      }}
                      disabled={publishingId === item.id}
                      className="ml-auto h-10 gap-1.5 whitespace-nowrap sm:h-9"
                    >
                      <Check className="h-4 w-4" />
                      {publishingId === item.id ? "Menyimpan…" : "Tandai Terkirim"}
                    </Button>
                  )}
                </div>
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
        {/* SelectionBar melayang (di atas bottom nav di mobile, bottom-6 di
            md+) dan menutupi pagination di ujung halaman — beri ruang selama
            mode pilih aktif. */}
        {selected.length > 0 && <div aria-hidden className="h-20" />}
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
