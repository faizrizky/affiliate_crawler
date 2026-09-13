"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FileText, FolderOpen, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { listItem, listStagger } from "@/animations/list-motion";
import { ConfirmDialog } from "@/common/confirm-dialog";
import { EmptyState } from "@/common/empty-state";
import { SelectionBar } from "@/common/selection-bar";
import { useCategories } from "@/hooks/use-categories";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { useTemplates } from "@/hooks/use-templates";
import { useTemplateStore } from "@/stores/template-store";
import { AppPagination } from "@/pagination/app-pagination";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";
import { TemplateCard } from "./template-card";
import { TemplateDeleteDialog } from "./template-delete-dialog";
import { describeTemplateDelete } from "./template-delete-copy";
import { TemplateEditor } from "./template-editor";

const ALL = "all";
const UNCATEGORIZED = "none";

export function TemplateList() {
  const { templates, deleteTemplate } = useTemplates();
  const { categories } = useCategories();
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const openEditor = useTemplateStore((s) => s.openEditor);
  const list = templates.data ?? [];
  const categoryOptions = categories.data ?? [];

  // Kategori yang sedang difilter bisa saja sudah dihapus -> kembali ke "Semua".
  const activeFilter =
    categoryFilter === ALL ||
    categoryFilter === UNCATEGORIZED ||
    categoryOptions.some((c) => c.id === categoryFilter)
      ? categoryFilter
      : ALL;

  const filtered =
    activeFilter === ALL
      ? list
      : activeFilter === UNCATEGORIZED
        ? list.filter((t) => !t.categoryId)
        : list.filter((t) => t.categoryId === activeFilter);

  const { page, setPage, pageSize, setPageSize, totalPages, visible } =
    useClientPagination(filtered, `templates-${activeFilter}`);
  // Hanya item yang terlihat di filter aktif yang boleh ikut bulk delete.
  const selected = filtered.filter((t) => selectedIds.includes(t.id));

  const changeFilter = (next: string) => {
    setCategoryFilter(next);
    // Pilihan tidak boleh bocor antar filter: template tersembunyi tetap akan
    // ikut terhapus kalau masih tercentang.
    setSelectedIds([]);
  };

  const uncategorizedCount = list.filter((t) => !t.categoryId).length;

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const deleteSelected = async () => {
    setBulkDeleting(true);
    const results = await Promise.allSettled(
      selected.map((t) => deleteTemplate.mutateAsync(t.id)),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    setBulkDeleting(false);
    setBulkDeleteOpen(false);
    setSelectedIds([]);
    if (failed === 0) {
      toast.success(`${results.length} template dihapus`);
    } else {
      toast.error(`${failed} dari ${results.length} template gagal dihapus`);
    }
  };

  return (
    <>
      {templates.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : list.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="template-category-filter" className="sr-only">
                Filter kategori
              </label>
              <div className="relative">
                <FolderOpen className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  id="template-category-filter"
                  value={activeFilter}
                  onChange={(e) => changeFilter(e.target.value)}
                  className="h-10 min-w-52 appearance-none rounded-full border border-input bg-card pl-10 pr-9 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value={ALL}>Semua kategori ({list.length})</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({list.filter((t) => t.categoryId === c.id).length})
                    </option>
                  ))}
                  <option value={UNCATEGORIZED}>Tanpa kategori ({uncategorizedCount})</option>
                </select>
                <span aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  ▾
                </span>
              </div>
              {activeFilter !== ALL && (
                <Button variant="ghost" size="sm" onClick={() => changeFilter(ALL)}>
                  Reset
                </Button>
              )}
            </div>
            <Button onClick={() => openEditor(null)}>
              <Plus />
              New template
            </Button>
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="Tidak ada template di filter ini"
              description="Pilih kategori lain, atau pasang kategori saat mengedit template."
              action={
                <Button variant="outline" onClick={() => changeFilter(ALL)}>
                  Tampilkan semua
                </Button>
              }
            />
          ) : (
          <>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeFilter}-${page}-${pageSize}`}
              variants={listStagger}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {visible.map((template) => (
                <motion.div key={template.id} variants={listItem}>
                  <TemplateCard
                    template={template}
                    selected={selectedIds.includes(template.id)}
                    onToggleSelect={toggleSelect}
                  />
                </motion.div>
              ))}
            </motion.div>
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
          icon={FileText}
          title="No templates yet"
          description="Create your first template to structure your affiliate copy."
          action={
            <Button onClick={() => openEditor(null)}>
              <Plus />
              New template
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
        title={`Hapus ${selected.length} template?`}
        description={describeTemplateDelete(selected)}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        destructive
        loading={bulkDeleting}
        onConfirm={deleteSelected}
      />

      <TemplateEditor />
      <TemplateDeleteDialog />
    </>
  );
}
