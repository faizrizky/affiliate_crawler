import { useEffect, useState } from "react";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";

export function usePagination(resetKey: string | null) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  return { page, setPage, pageSize, setPageSize };
}
