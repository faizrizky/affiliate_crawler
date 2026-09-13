"use client";

import type { CategoryListItem } from "@aff/types";
import { AnimatePresence, motion } from "framer-motion";
import { FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { listItem, listStagger } from "@/animations/list-motion";
import { ConfirmDialog } from "@/common/confirm-dialog";
import { EmptyState } from "@/common/empty-state";
import { SelectCheckbox } from "@/common/select-checkbox";
import { SelectionBar } from "@/common/selection-bar";
import { useCategories } from "@/hooks/use-categories";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { formatTimeAgo } from "@/lib/utils";
import { AppPagination } from "@/pagination/app-pagination";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";
import { CategoryEditor } from "./category-editor";

/** Hapus kategori tidak menghapus template: templatenya jadi tanpa kategori. */
function describeDelete(categories: CategoryListItem[]): string {
  const templates = categories.reduce((n, c) => n + (c._count?.templates ?? 0), 0);
  const what = categories.length === 1 ? `"${categories[0].name}"` : `${categories.length} kategori`;
  if (templates === 0) return `${what} akan dihapus permanen.`;
  return `${what} dipakai ${templates} template. Template itu tidak ikut terhapus, hanya jadi tanpa kategori.`;
}

export function CategoryList() {
  const { categories, deleteCategory } = useCategories();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryListItem | null>(null);
  const [editorSession, setEditorSession] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<CategoryListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const list = categories.data ?? [];
  const { page, setPage, pageSize, setPageSize, totalPages, visible } =
    useClientPagination(list, "categories");
  const selected = list.filter((c) => selectedIds.includes(c.id));

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const openEditor = (category: CategoryListItem | null) => {
    setEditing(category);
    setEditorSession((n) => n + 1);
    setEditorOpen(true);
  };

  const removeOne = async (category: CategoryListItem) => {
    try {
      await deleteCategory.mutateAsync(category.id);
      toast.success("Kategori dihapus");
    } catch {
      toast.error("Gagal menghapus kategori");
    }
    setDeleteTarget(null);
  };

  const removeSelected = async () => {
    setBulkDeleting(true);
    const results = await Promise.allSettled(selected.map((c) => deleteCategory.mutateAsync(c.id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    setBulkDeleting(false);
    setBulkDeleteOpen(false);
    setSelectedIds([]);
    if (failed === 0) toast.success(`${results.length} kategori dihapus`);
    else toast.error(`${failed} dari ${results.length} kategori gagal dihapus`);
  };

  return (
    <>
      {categories.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : list.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Button onClick={() => openEditor(null)}>
              <Plus />
              Add Category
            </Button>
          </div>

          <AnimatePresence mode="wait">
            <motion.ul
              key={`${page}-${pageSize}`}
              variants={listStagger}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="flex list-none flex-col gap-3"
            >
              {visible.map((category) => {
                const isSelected = selectedIds.includes(category.id);
                const count = category._count?.templates ?? 0;
                return (
                  <motion.li key={category.id} variants={listItem}>
                    <Card
                      onClick={() => toggleSelect(category.id)}
                      className={`flex cursor-pointer items-center gap-4 border-transparent p-4 shadow-[0_10px_30px_-22px_rgba(140,30,60,0.45)] sm:p-5 ${
                        isSelected ? "ring-2 ring-primary" : ""
                      }`}
                    >
                      <SelectCheckbox checked={isSelected} onToggle={() => toggleSelect(category.id)} label={category.name} />
                      <div aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                        <FolderOpen className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{category.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {count} template · dibuat {formatTimeAgo(category.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <motion.button
                          type="button"
                          title="Edit kategori"
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditor(category);
                          }}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </motion.button>
                        <motion.button
                          type="button"
                          title="Hapus kategori"
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(category);
                          }}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </motion.button>
                      </div>
                    </Card>
                  </motion.li>
                );
              })}
            </motion.ul>
          </AnimatePresence>

          <AppPagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      ) : (
        <EmptyState
          icon={FolderOpen}
          title="Belum ada kategori"
          description="Buat kategori untuk mengelompokkan template."
          action={
            <Button onClick={() => openEditor(null)}>
              <Plus />
              Add Category
            </Button>
          }
        />
      )}

      <SelectionBar count={selected.length} onCancel={() => setSelectedIds([])}>
        <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
          Hapus
        </Button>
      </SelectionBar>

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Hapus ${selected.length} kategori?`}
        description={describeDelete(selected)}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        destructive
        loading={bulkDeleting}
        onConfirm={removeSelected}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Hapus kategori?"
        description={deleteTarget ? describeDelete([deleteTarget]) : undefined}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        destructive
        loading={deleteCategory.isPending}
        onConfirm={() => deleteTarget && removeOne(deleteTarget)}
      />

      <CategoryEditor
        key={editorSession}
        open={editorOpen}
        category={editing}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setEditing(null);
        }}
      />
    </>
  );
}
