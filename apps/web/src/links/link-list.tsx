"use client";

import type { AffiliateLinkListItem } from "@aff/types";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, FolderOpen, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { listItem, listStagger } from "@/animations/list-motion";
import { ConfirmDialog } from "@/common/confirm-dialog";
import { EmptyState } from "@/common/empty-state";
import { SelectCheckbox } from "@/common/select-checkbox";
import { SearchableMultiSelect } from "@/common/searchable-multi-select";
import { SelectionBar } from "@/common/selection-bar";
import { useCategories } from "@/hooks/use-categories";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { keepKnown, matchesAny, UNCATEGORIZED } from "@/lib/filter";
import { useLinks } from "@/hooks/use-links";
import { formatTimeAgo } from "@/lib/utils";
import { AppPagination } from "@/pagination/app-pagination";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";
import { LinkEditor } from "./link-editor";

/** Modal hapus harus jujur soal dampaknya: referensi jadi kosong, bukan ikut terhapus. */
function deleteDescription(link: AffiliateLinkListItem): string {
  const templates = link._count?.templates ?? 0;
  const drafts = link._count?.affiliateContents ?? 0;
  const used: string[] = [];
  if (templates > 0) used.push(`${templates} template`);
  if (drafts > 0) used.push(`${drafts} draft`);
  if (used.length === 0) {
    return `"${link.name}" akan dihapus permanen.`;
  }
  return (
    `"${link.name}" dipakai ${used.join(" dan ")}. ` +
    "Kalau dihapus, link pada template/draft itu jadi kosong (isinya tidak ikut terhapus), " +
    "dan teks draft yang sudah digenerate tetap utuh."
  );
}

function bulkDeleteDescription(links: AffiliateLinkListItem[]): string {
  const templates = links.reduce((n, l) => n + (l._count?.templates ?? 0), 0);
  const drafts = links.reduce(
    (n, l) => n + (l._count?.affiliateContents ?? 0),
    0,
  );
  const used: string[] = [];
  if (templates > 0) used.push(`${templates} template`);
  if (drafts > 0) used.push(`${drafts} draft`);
  if (used.length === 0) {
    return "Link yang dipilih akan dihapus permanen.";
  }
  return (
    `Link yang dipilih dipakai ${used.join(" dan ")}. ` +
    "Kalau dihapus, link pada template/draft itu jadi kosong (isinya tidak ikut terhapus), " +
    "dan teks draft yang sudah digenerate tetap utuh."
  );
}

export function LinkList() {
  const { links, deleteLink } = useLinks();
  const { categories } = useCategories();
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AffiliateLinkListItem | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<AffiliateLinkListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const list = links.data?.links ?? [];
  const categoryOptions = categories.data ?? [];

  // Kategori yang sedang difilter bisa saja sudah dihapus -> pilihan itu diabaikan.
  const activeFilter = keepKnown(categoryFilter, [
    UNCATEGORIZED,
    ...categoryOptions.map((c) => c.id),
  ]);
  const filterKey = activeFilter.join(",");

  // Beberapa kategori = OR; tanpa pilihan = semua link.
  const filtered = list.filter((l) => matchesAny(l.categoryId, activeFilter));

  const { page, setPage, pageSize, setPageSize, totalPages, visible } =
    useClientPagination(filtered, `links-${filterKey}`);

  // Hanya link yang terlihat di filter aktif yang boleh ikut bulk delete.
  const selected = filtered.filter((link) => selectedIds.includes(link.id));

  const changeFilter = (next: string[]) => {
    setCategoryFilter(next);
    setSelectedIds([]);
  };

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const deleteSelected = async () => {
    setBulkDeleting(true);
    // allSettled: satu link gagal dihapus tidak boleh membatalkan sisanya —
    // laporkan apa adanya biar user tahu mana yang masih ada.
    const results = await Promise.allSettled(
      selected.map((link) => deleteLink.mutateAsync(link.id)),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    setBulkDeleting(false);
    setBulkDeleteOpen(false);
    setSelectedIds([]);
    if (failed === 0) {
      toast.success(`${results.length} link dihapus`);
    } else {
      toast.error(`${failed} dari ${results.length} link gagal dihapus`);
    }
  };

  const openEditor = (link: AffiliateLinkListItem | null) => {
    setEditing(link);
    setEditorOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteLink.mutateAsync(deleteTarget.id);
      toast.success("Link dihapus");
    } catch {
      toast.error("Gagal menghapus link");
    }
    setDeleteTarget(null);
  };

  return (
    <>
      {links.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : list.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SearchableMultiSelect
                id="link-category-filter"
                label="Filter kategori"
                allLabel="Semua kategori"
                icon={FolderOpen}
                searchPlaceholder="Cari kategori…"
                values={activeFilter}
                onChange={changeFilter}
                options={[
                  ...categoryOptions.map((c) => ({
                    value: c.id,
                    label: c.name,
                    count: list.filter((l) => l.categoryId === c.id).length,
                  })),
                  { value: UNCATEGORIZED, label: "Tanpa kategori", count: list.filter((l) => !l.categoryId).length },
                ]}
              />
              {activeFilter.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => changeFilter([])}>
                  Reset
                </Button>
              )}
            </div>
            <Button onClick={() => openEditor(null)}>
              <Plus />
              Add Link
            </Button>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="Tidak ada link di filter ini"
              description="Pilih kategori lain, atau pasang kategori saat mengedit link."
              action={
                <Button variant="outline" onClick={() => changeFilter([])}>
                  Tampilkan semua
                </Button>
              }
            />
          ) : (
          <>
          <AnimatePresence mode="wait">
            <motion.ul
              key={`${filterKey}-${page}-${pageSize}`}
              variants={listStagger}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="flex list-none flex-col gap-3"
            >
              {visible.map((link) => (
                <motion.li key={link.id} variants={listItem}>
                  <Card
                    onClick={() => toggleSelect(link.id)}
                    className={`flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-3 border-transparent p-4 shadow-[0_10px_30px_-22px_rgba(140,30,60,0.45)] sm:p-5 ${
                      selectedIds.includes(link.id) ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    <SelectCheckbox
                      checked={selectedIds.includes(link.id)}
                      onToggle={() => toggleSelect(link.id)}
                      label={link.name}
                    />
                    <div
                      aria-hidden
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
                    >
                      <Link2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-semibold">{link.name}</span>
                        {link.category && (
                          <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                            {link.category.name}
                          </span>
                        )}
                      </p>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs font-medium text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{link.url}</span>
                      </a>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Ditambahkan {formatTimeAgo(link.createdAt)}
                      </p>
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      <motion.button
                        type="button"
                        title="Edit link"
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditor(link);
                        }}
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </motion.button>
                      <motion.button
                        type="button"
                        title="Hapus link"
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(link);
                        }}
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </motion.button>
                    </div>
                  </Card>
                </motion.li>
              ))}
            </motion.ul>
          </AnimatePresence>

          <AppPagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
          </>
          )}
        </div>
      ) : (
        <EmptyState
          icon={Link2}
          title="Belum ada link"
          description="Simpan link produk affiliate di sini supaya gampang dipakai ulang."
          action={
            <Button onClick={() => openEditor(null)}>
              <Plus />
              Add Link
            </Button>
          }
        />
      )}

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
        title={`Hapus ${selected.length} link?`}
        description={bulkDeleteDescription(selected)}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        destructive
        loading={bulkDeleting}
        onConfirm={deleteSelected}
      />

      <LinkEditor
        open={editorOpen}
        link={editing}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setEditing(null);
        }}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Hapus link?"
        description={deleteTarget ? deleteDescription(deleteTarget) : undefined}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        destructive
        loading={deleteLink.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
