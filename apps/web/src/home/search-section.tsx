"use client";

import { SearchX, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/common/empty-state";
import { StatusBadge } from "@/common/status-badge";
import { usePagination } from "@/hooks/use-pagination";
import { useSearch } from "@/hooks/use-search";
import { useTopicPosts } from "@/hooks/use-topic-posts";
import { useGenerateStore } from "@/stores/generate-store";
import { useSearchStore } from "@/stores/search-store";
import { AppPagination } from "@/pagination/app-pagination";
import { Card, CardContent } from "@/ui/card";
import { SearchBar } from "./search-bar";
import { SearchProgress } from "./search-progress";
import { ThreadCardSkeleton } from "./thread-card-skeleton";
import { ThreadList } from "./thread-list";

const CRAWL_ERROR_MESSAGES: Record<string, string> = {
  THREADS_NO_RESULTS: "Tidak ada Threads ditemukan untuk topik ini.",
  THREADS_LOGIN_REQUIRED: "Threads membutuhkan session yang terautentikasi.",
  THREADS_REQUEST_FAILED: "Crawler sedang tidak tersedia.",
  THREADS_RENDER_FAILED: "Crawler sedang tidak tersedia.",
};
const FALLBACK_ERROR_MESSAGE = "Terjadi kesalahan saat mencari Threads.";

export function SearchSection() {
  const { phase, job, error, searchKeyword, submit } = useSearch();
  const openGenerate = useGenerateStore((s) => s.open);
  const activeTopicId = useSearchStore((s) => s.activeTopicId);
  const { page, setPage, pageSize, setPageSize } = usePagination(
    activeTopicId ?? null,
  );
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
              <ThreadList
                posts={posts.data.posts}
                onApplyTemplate={openGenerate}
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
    </div>
  );
}
