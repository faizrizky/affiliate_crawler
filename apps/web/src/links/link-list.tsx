"use client";

import type { AffiliateLink } from "@aff/types";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { listItem, listStagger } from "@/animations/list-motion";
import { ConfirmDialog } from "@/common/confirm-dialog";
import { EmptyState } from "@/common/empty-state";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { useLinks } from "@/hooks/use-links";
import { formatTimeAgo } from "@/lib/utils";
import { AppPagination } from "@/pagination/app-pagination";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";
import { LinkEditor } from "./link-editor";

export function LinkList() {
  const { links, deleteLink } = useLinks();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AffiliateLink | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AffiliateLink | null>(null);
  const list = links.data?.links ?? [];
  const { page, setPage, pageSize, setPageSize, totalPages, visible } =
    useClientPagination(list, "links");

  const openEditor = (link: AffiliateLink | null) => {
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
          <div className="flex justify-end">
            <Button onClick={() => openEditor(null)}>
              <Plus />
              Add Link
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
              {visible.map((link) => (
                <motion.li key={link.id} variants={listItem}>
                  <Card className="flex flex-wrap items-center gap-x-4 gap-y-3 border-transparent p-4 shadow-[0_10px_30px_-22px_rgba(140,30,60,0.45)] sm:p-5">
                    <div
                      aria-hidden
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
                    >
                      <Link2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {link.name}
                      </p>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
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
                        onClick={() => openEditor(link)}
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </motion.button>
                      <motion.button
                        type="button"
                        title="Hapus link"
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setDeleteTarget(link)}
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
        description={
          deleteTarget
            ? `"${deleteTarget.name}" akan dihapus permanen.`
            : undefined
        }
        confirmLabel="Hapus"
        destructive
        loading={deleteLink.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
