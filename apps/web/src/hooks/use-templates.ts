import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Template } from "@aff/types";
import { apiFetch } from "@/lib/api";

const TEMPLATES_KEY = ["templates"];

export function useTemplates() {
  const queryClient = useQueryClient();

  const templates = useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: async (): Promise<Template[]> => {
      const data = await apiFetch<Template[]>("/templates");
      if (!data) throw new Error("Templates not found");
      return data;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY });

  const createTemplate = useMutation({
    mutationFn: async (input: { name: string; content: string }) => {
      const data = await apiFetch<Template>("/templates", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!data) throw new Error("Create failed");
      return data;
    },
    onSuccess: invalidate,
  });

  const updateTemplate = useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      content?: string;
    }) => {
      const { id, ...body } = input;
      const data = await apiFetch<Template>(`/templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!data) throw new Error("Update failed");
      return data;
    },
    onSuccess: invalidate,
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/templates/${id}`, { method: "DELETE" });
    },
    onSuccess: invalidate,
  });

  return { templates, createTemplate, updateTemplate, deleteTemplate };
}
