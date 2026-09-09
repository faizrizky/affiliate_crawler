"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGINATION_SIZES } from "@/lib/constants";
import { Button } from "@/ui/button";
import { Select } from "@/ui/select";

export function AppPagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {total} posts · Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Select
          className="w-32"
          value={pageSize}
          options={PAGINATION_SIZES.map((n) => ({
            value: n,
            label: `${n} / page`,
          }))}
          onValueChange={onPageSizeChange}
        />
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
