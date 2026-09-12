"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGINATION_SIZES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";
import { Select } from "@/ui/select";

export function AppPagination({
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  className,
}: {
  page: number;
  totalPages: number;
  total?: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-5 gap-y-3 bg-transparent py-2",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Select
          className="w-[86px]"
          aria-label="Rows per page"
          value={pageSize}
          options={PAGINATION_SIZES.map((n) => ({ value: n, label: `${n}` }))}
          onValueChange={onPageSizeChange}
        />
        <span className="text-sm text-muted-foreground">/ page</span>
      </div>

      <p className="text-sm text-muted-foreground">
        Page <span className="font-semibold text-foreground">{page}</span> /{" "}
        <span className="font-semibold text-foreground">{totalPages}</span>
      </p>

      <div className="flex items-center gap-2">
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
