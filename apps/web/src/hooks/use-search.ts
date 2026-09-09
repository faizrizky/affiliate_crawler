import { useMutation, useQuery } from "@tanstack/react-query";
import type { CrawlJob, SearchResponse } from "@aff/types";
import { apiFetch } from "@/lib/api";
import { useSearchStore } from "@/stores/search-store";

type Phase = "idle" | "starting" | "crawling" | "completed" | "failed";

export function useSearch() {
  const setLastKeyword = useSearchStore((s) => s.setLastKeyword);
  const setActiveTopic = useSearchStore((s) => s.setActiveTopic);

  const search = useMutation({
    mutationFn: async (keyword: string): Promise<SearchResponse> => {
      const data = await apiFetch<SearchResponse>("/topics/search", {
        method: "POST",
        body: JSON.stringify({ keyword }),
      });
      if (!data) throw new Error("Search failed");
      return data;
    },
    onSuccess: (data, keyword) => {
      setLastKeyword(keyword);
      setActiveTopic(data.topicId);
    },
  });

  const jobId = search.data?.jobId;

  const job = useQuery({
    queryKey: ["crawl-job", jobId],
    queryFn: async (): Promise<CrawlJob> => {
      const data = await apiFetch<CrawlJob>(`/crawl/jobs/${jobId}`);
      if (!data) throw new Error("Crawl job not found");
      return data;
    },
    enabled: Boolean(jobId) && !search.isPending,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "QUEUED" || status === "RUNNING" ? 1500 : false;
    },
  });

  const error =
    search.error ??
    job.error ??
    (job.data?.error ? new Error(job.data.error) : null);

  let phase: Phase = "idle";
  if (error) phase = "failed";
  else if (search.isPending) phase = "starting";
  else if (job.data?.status === "COMPLETED") phase = "completed";
  else if (job.data?.status === "QUEUED" || job.data?.status === "RUNNING")
    phase = "crawling";

  return {
    searchKeyword: search.variables ?? null,
    phase,
    job: job.data,
    error,
    submit: search.mutate,
  };
}
