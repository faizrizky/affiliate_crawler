"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { listItem, listStagger } from "@/animations/list-motion";
import type { Topic } from "@aff/types";
import { Tags } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/common/confirm-dialog";
import { EmptyState } from "@/common/empty-state";
import { SelectionBar } from "@/common/selection-bar";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { useTopics } from "@/hooks/use-topics";
import { useSearchStore } from "@/stores/search-store";
import { AppPagination } from "@/pagination/app-pagination";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";
import { TopicCard } from "./topic-card";

export function RecentTopics() {
  const { topics, deleteTopic } = useTopics();
  const activeTopicId = useSearchStore((s) => s.activeTopicId);
  const setActiveTopic = useSearchStore((s) => s.setActiveTopic);
  const [deleteTarget, setDeleteTarget] = useState<Topic | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const list = topics.data ?? [];
  const { page, setPage, pageSize, setPageSize, totalPages, visible } =
    useClientPagination(list, "topics");
  const selected = list.filter((t) => selectedIds.includes(t.id));
  const selectedPostCount = selected.reduce((n, t) => n + t.postCount, 0);

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const deleteSelected = async () => {
    setBulkDeleting(true);
    const results = await Promise.allSettled(
      selected.map((t) => deleteTopic.mutateAsync(t.id)),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    // Topik aktif ikut terhapus -> daftar thread di atas harus ikut dikosongkan.
    if (activeTopicId && selectedIds.includes(activeTopicId)) {
      setActiveTopic(null);
    }
    setBulkDeleting(false);
    setBulkDeleteOpen(false);
    setSelectedIds([]);
    if (failed === 0) {
      toast.success(`${results.length} topik dihapus`);
    } else {
      toast.error(`${failed} dari ${results.length} topik gagal dihapus`);
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">Recent topics</h2>
      {topics.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : list.length > 0 ? (
        <>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${page}-${pageSize}`}
              variants={listStagger}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {visible.map((topic) => (
                <motion.div key={topic.id} variants={listItem}>
                  <TopicCard
                    topic={topic}
                    active={topic.id === activeTopicId}
                    onDelete={setDeleteTarget}
                    selected={selectedIds.includes(topic.id)}
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
      ) : (
        <EmptyState
          icon={Tags}
          title="No topics yet"
          description="Search a keyword above — every topic you crawl shows up here."
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
        title={`Hapus ${selected.length} topik?`}
        description={`${selected.length} topik beserta ${selectedPostCount} post hasil crawl-nya akan dihapus permanen. Draft yang sudah dibuat tetap ada, tapi kehilangan kaitan ke topik ini.`}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        destructive
        loading={bulkDeleting}
        onConfirm={deleteSelected}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete topic?"
        description={
          deleteTarget
            ? `"${deleteTarget.keyword}" and its ${deleteTarget.postCount} post${deleteTarget.postCount === 1 ? "" : "s"} will be permanently deleted.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        loading={deleteTopic.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteTopic.mutateAsync(deleteTarget.id);
            if (deleteTarget.id === activeTopicId) setActiveTopic(null);
            toast.success("Topic deleted");
            setDeleteTarget(null);
          } catch {
            toast.error("Could not delete topic");
          }
        }}
      />
    </section>
  );
}
