"use client";

import { usePagination } from "./use-pagination";

export function useClientPagination<T>(items: T[], resetKey: string | null) {
  const { page, setPage, pageSize, setPageSize } = usePagination(resetKey);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;

  return {
    page: current,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total: items.length,
    visible: items.slice(start, start + pageSize),
  };
}
