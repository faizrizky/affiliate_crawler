"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useSearchStore } from "@/stores/search-store";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";

const schema = z.object({
  keyword: z.string().trim().min(3, "Type at least 3 characters"),
});

type FormValues = z.infer<typeof schema>;

export function SearchBar({
  loading,
  onSubmit,
}: {
  loading: boolean;
  onSubmit: (keyword: string) => void;
}) {
  const lastKeyword = useSearchStore((s) => s.lastKeyword);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { keyword: lastKeyword ?? "" },
  });
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    setValue("keyword", lastKeyword ?? "");
  }, [lastKeyword, setValue]);

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit(values.keyword))}
      className="flex flex-col gap-2 sm:flex-row sm:items-start"
    >
      <div className="flex-1">
        <Label htmlFor="search-keyword" className="sr-only">
          Topic
        </Label>
        <Input
          id="search-keyword"
          placeholder='Search a topic on Threads, e.g. "running shoes under 500k"'
          {...register("keyword")}
        />
        {errors.keyword && (
          <p className="mt-1.5 text-xs text-destructive" role="alert">
            {errors.keyword.message}
          </p>
        )}
      </div>
      <Button
        type="submit"
        size="lg"
        disabled={loading || isSubmitting}
        className="sm:w-40"
      >
        <Search />
        {loading || isSubmitting ? "Searching…" : "Search"}
      </Button>
    </form>
  );
}
