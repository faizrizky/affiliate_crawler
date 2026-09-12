"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AffiliateLink,
  AffiliateLinkInput,
  AffiliateLinkListResult,
  AffiliateLinkUpdateInput,
} from "@aff/types";
import { apiFetch } from "@/lib/api";

const LINKS_KEY = ["links"];

export function useLinks() {
  const queryClient = useQueryClient();

  const links = useQuery({
    queryKey: LINKS_KEY,
    queryFn: async (): Promise<AffiliateLinkListResult> => {
      // pageSize besar: dropdown template dan halaman Link sama-sama memakai
      // cache ini; paginasi tampilan dilakukan di klien (useClientPagination).
      const data = await apiFetch<AffiliateLinkListResult>(
        "/affiliate/links?pageSize=200",
      );
      if (!data) throw new Error("Links not found");
      return data;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: LINKS_KEY });

  const createLink = useMutation({
    mutationFn: async (input: AffiliateLinkInput) => {
      const data = await apiFetch<AffiliateLink>("/affiliate/links", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!data) throw new Error("Create failed");
      return data;
    },
    onSuccess: invalidate,
  });

  const updateLink = useMutation({
    mutationFn: async (input: AffiliateLinkUpdateInput & { id: string }) => {
      const { id, ...body } = input;
      const data = await apiFetch<AffiliateLink>(`/affiliate/links/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!data) throw new Error("Update failed");
      return data;
    },
    onSuccess: invalidate,
  });

  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/affiliate/links/${id}`, { method: "DELETE" });
    },
    onSuccess: invalidate,
  });

  return { links, createLink, updateLink, deleteLink };
}
