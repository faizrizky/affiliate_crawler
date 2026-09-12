"use client";

import type { ThreadPost } from "@aff/types";
import { AnimatePresence, motion } from "framer-motion";
import { SearchX, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { sheetMotion } from "@/animations/modal-motion";
import { EmptyState } from "@/common/empty-state";
import { StatusBadge } from "@/common/status-badge";
import { usePagination } from "@/hooks/use-pagination";
import { useSearch } from "@/hooks/use-search";
import { useTopicPosts } from "@/hooks/use-topic-posts";
import { useSearchStore } from "@/stores/search-store";
import { AppPagination } from "@/pagination/app-pagination";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { ApplyTemplateDialog } from "./apply-template-dialog";
import { SearchBar } from "./search-bar";
import { SearchProgress } from "./search-progress";
import { ThreadCardSkeleton } from "./thread-card-skeleton";
import { ThreadPreviewDialog } from "./thread-preview-dialog";
import { ThreadList } from "./thread-list";

const CRAWL_ERROR_MESSAGES: Record<string, string> = {
  THREADS_NO_RESULTS: "Tidak ada Threads ditemukan untuk topik ini.",
  THREADS_LOGIN_REQUIRED: "Threads membutuhkan session yang terautentikasi.",
  THREADS_SESSION_DEGRADED: "Sesi Threads bermasalah, perlu login ulang.",
  THREADS_REQUEST_FAILED: "Crawler sedang tidak tersedia.",
  THREADS_RENDER_FAILED: "Crawler sedang tidak tersedia.",
};
const FALLBACK_ERROR_MESSAGE = "Terjadi kesalahan saat mencari Threads.";

export function SearchSection() {
  const { phase, job, error, searchKeyword, submit } = useSearch();
  const activeTopicId = useSearchStore((s) => s.activeTopicId);
  const { page, setPage, pageSize, setPageSize } = usePagination(
    activeTopicId ?? null,
  );
  const [selectMode, setSelectMode] = useState(false);
  const [selectedPosts, setSelectedPosts] = useState<ThreadPost[]>([]);
  const [dialog, setDialog] = useState<
    { mode: "single" | "batch"; posts: ThreadPost[] } | null
  >(null);
  const [previewPost, setPreviewPost] = useState<ThreadPost | null>(null);
  const loading = phase === "starting" || phase === "crawling";
  const showPosts = Boolean(activeTopicId) && phase !== "starting";
  const posts = useTopicPosts(
    activeTopicId ?? undefined,
    showPosts,
    page,
    pageSize,
    loading ? 3000 : undefined,
    phase,
  );
  const selectedIds = selectedPosts.map((p) => p.id);

  const exitSelect = () => {
    setSelectMode(false);
    setSelectedPosts([]);
  };

  const toggleSelect = (postId: string) => {
    const post = posts.data?.posts.find((p) => p.id === postId);
    if (!post) return;
    setSelectedPosts((prev) =>
      prev.some((p) => p.id === postId)
        ? prev.filter((p) => p.id !== postId)
        : [...prev, post],
    );
  };

  const closeDialog = () => {
    setDialog(null);
    exitSelect();
  };

  return (
    <div className="flex flex-col gap-6">
      <SearchBar loading={loading} onSubmit={submit} />

      {phase === "crawling" && job && <SearchProgress job={job} />}

      {phase === "failed" && (
        <Card className="border-destructive/40">
          <CardContent className="flex items-start gap-3 p-5">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div role="alert">
              <p className="text-sm font-semibold">Pencarian gagal</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {CRAWL_ERROR_MESSAGES[error?.message ?? ""] ??
                  FALLBACK_ERROR_MESSAGE}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {showPosts && (
        <>
          {posts.isLoading || (loading && !posts.data?.posts.length) ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <ThreadCardSkeleton key={i} />
              ))}
            </div>
          ) : posts.data && posts.data.posts.length > 0 ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {posts.data.total} threads
                </p>
                <Button
                  size="sm"
                  variant={selectMode ? "default" : "outline"}
                  onClick={() =>
                    selectMode ? exitSelect() : setSelectMode(true)
                  }
                >
                  {selectMode ? "Done" : "Select"}
                </Button>
              </div>
              <ThreadList
                key={`${activeTopicId}-${page}`}
                posts={posts.data.posts}
                onApplyTemplate={(post) =>
                  setDialog({ mode: "single", posts: [post] })
                }
                onOpenPreview={setPreviewPost}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
              />
              {posts.data.totalPages > 1 && (
                <AppPagination
                  page={page}
                  totalPages={posts.data.totalPages}
                  total={posts.data.total}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              )}
            </>
          ) : (
            <EmptyState
              icon={SearchX}
              title="Tidak ada Threads ditemukan"
              description={
                searchKeyword
                  ? `Tidak ada post untuk "${searchKeyword}".`
                  : undefined
              }
            />
          )}
        </>
      )}

      {phase === "starting" && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5">
          <StatusBadge status="QUEUED" />
          <p className="text-sm text-muted-foreground">Waiting for the crawler…</p>
        </div>
      )}

      <AnimatePresence>
        {selectMode && (
          <motion.div
            key="batch-bar"
            variants={sheetMotion}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed inset-x-0 bottom-28 z-40 px-4 md:bottom-6"
          >
            <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg">
              <span className="text-sm font-medium">
                {selectedPosts.length} dipilih
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={exitSelect}>
                  Batal
                </Button>
                <Button
                  size="sm"
                  disabled={selectedPosts.length === 0}
                  onClick={() =>
                    setDialog({ mode: "batch", posts: selectedPosts })
                  }
                >
                  Apply Template
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ThreadPreviewDialog
        post={previewPost}
        onOpenChange={(open) => !open && setPreviewPost(null)}
        onSelectTemplate={(post) => {
          setPreviewPost(null);
          setDialog({ mode: "single", posts: [post] });
        }}
      />

      {dialog && (
        <ApplyTemplateDialog
          open
          onOpenChange={(o) => {
            if (!o) closeDialog();
          }}
          mode={dialog.mode}
          posts={dialog.posts}
        />
      )}
    </div>
  );
}
