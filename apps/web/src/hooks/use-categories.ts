"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Category, CategoryListItem } from "@aff/types";
import { apiFetch } from "@/lib/api";

const CATEGORIES_KEY = ["categories"];

export function useCategories() {
  const queryClient = useQueryClient();

  const categories = useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: async (): Promise<CategoryListItem[]> => {
      const data = await apiFetch<CategoryListItem[]>("/categories");
      if (!data) throw new Error("Categories not found");
      return data;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
    // Nama kategori tampil di kartu template; hapus kategori mengubah template.
    queryClient.invalidateQueries({ queryKey: ["templates"] });
  };

  const createCategory = useMutation({
    mutationFn: async (name: string) => {
      const data = await apiFetch<Category>("/categories", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      if (!data) throw new Error("Create failed");
      return data;
    },
    onSuccess: invalidate,
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const data = await apiFetch<Category>(`/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      if (!data) throw new Error("Update failed");
      return data;
    },
    onSuccess: invalidate,
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/categories/${id}`, { method: "DELETE" });
    },
    onSuccess: invalidate,
  });

  return { categories, createCategory, updateCategory, deleteCategory };
}
