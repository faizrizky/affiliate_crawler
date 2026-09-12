import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  AffiliateContent,
  AffiliateContentListItem,
  AffiliateContentUpdateInput,
  AffiliateGenerateBatchInput,
  AffiliateGenerateBatchResult,
  AffiliateGenerateInput,
} from "@aff/types";
import { apiFetch } from "@/lib/api";

const AFFILIATE_KEY = ["affiliate-contents"];

export function useAffiliateContents() {
  const queryClient = useQueryClient();

  const contents = useQuery({
    queryKey: AFFILIATE_KEY,
    queryFn: async (): Promise<AffiliateContentListItem[]> => {
      const data = await apiFetch<AffiliateContentListItem[]>(
        "/affiliate",
      );
      if (!data) throw new Error("Affiliate contents not found");
      return data;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: AFFILIATE_KEY });

  const generateContent = useMutation({
    mutationFn: async (input: AffiliateGenerateInput) => {
      const data = await apiFetch<AffiliateContent>("/affiliate/generate", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!data) throw new Error("Generate failed");
      return data;
    },
    onSuccess: invalidate,
  });

  const generateBatchContent = useMutation({
    mutationFn: async (input: AffiliateGenerateBatchInput) => {
      const data = await apiFetch<AffiliateGenerateBatchResult>(
        "/affiliate/generate-batch",
        { method: "POST", body: JSON.stringify(input) },
      );
      if (!data) throw new Error("Batch generate failed");
      return data;
    },
    onSuccess: invalidate,
  });

  const updateContent = useMutation({
    mutationFn: async ({
      id,
      ...input
    }: { id: string } & AffiliateContentUpdateInput) => {
      const data = await apiFetch<AffiliateContent>(`/affiliate/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
      if (!data) throw new Error("Update failed");
      return data;
    },
    onSuccess: invalidate,
  });

  const deleteContent = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/affiliate/${id}`, { method: "DELETE" });
    },
    onSuccess: invalidate,
  });

  return {
    contents,
    generateContent,
    generateBatchContent,
    updateContent,
    deleteContent,
  };
}
