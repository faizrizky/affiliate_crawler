import { useQuery } from "@tanstack/react-query";
import type { ThreadPostList } from "@aff/types";
import { apiFetch } from "@/lib/api";

export function useTopicPosts(
  topicId: string | undefined,
  enabled: boolean,
  page: number,
  pageSize: number,
) {
  return useQuery({
    queryKey: ["topic-posts", topicId, page, pageSize],
    queryFn: async (): Promise<ThreadPostList> => {
      const data = await apiFetch<ThreadPostList>(
        `/topics/${topicId}/posts?page=${page}&pageSize=${pageSize}`,
      );
      if (!data) throw new Error("Posts not found");
      return data;
    },
    enabled: Boolean(topicId) && enabled,
  });
}
