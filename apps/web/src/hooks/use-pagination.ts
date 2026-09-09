import { useState } from "react";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";

export function usePagination(resetKey: string | null) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [resetToken, setResetToken] = useState(`${resetKey}:${DEFAULT_PAGE_SIZE}`);

  const token = `${resetKey}:${pageSize}`;
  if (token !== resetToken) {
    setResetToken(token);
    setPage(1);
  }

  return { page, setPage, pageSize, setPageSize };
}
