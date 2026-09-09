import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Topic } from "@aff/types";
import { apiFetch } from "@/lib/api";

const TOPICS_KEY = ["topics"];

export function useTopics() {
  const queryClient = useQueryClient();

  const topics = useQuery({
    queryKey: TOPICS_KEY,
    queryFn: async (): Promise<Topic[]> => {
      const data = await apiFetch<Topic[]>("/topics");
      if (!data) throw new Error("Topics not found");
      return data;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: TOPICS_KEY });

  const deleteTopic = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/topics/${id}`, { method: "DELETE" });
    },
    onSuccess: invalidate,
  });

  return { topics, deleteTopic };
}
