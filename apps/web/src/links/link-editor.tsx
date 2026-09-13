"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { AffiliateLink } from "@aff/types";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import Link from "next/link";
import { useCategories } from "@/hooks/use-categories";
import { useLinks } from "@/hooks/use-links";
import { ApiError } from "@/lib/api";
import { Button } from "@/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";

const schema = z.object({
  name: z.string().trim().min(1, "Nama produk wajib diisi").max(100),
  url: z
    .string()
    .trim()
    .min(1, "URL wajib diisi")
    .refine((value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    }, "URL harus diawali http:// atau https://"),
  categoryId: z.string(),
});

type FormValues = z.infer<typeof schema>;

/** Dipakai untuk Add (link = null) dan Edit (link terisi) — satu form, satu validasi. */
export function LinkEditor({
  open,
  link,
  onOpenChange,
}: {
  open: boolean;
  link: AffiliateLink | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { createLink, updateLink } = useLinks();
  const { categories } = useCategories();
  const categoryOptions = categories.data ?? [];
  const isEditing = link != null;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", url: "", categoryId: "" },
  });

  useEffect(() => {
    if (open) {
      reset({ name: link?.name ?? "", url: link?.url ?? "", categoryId: link?.categoryId ?? "" });
    }
  }, [open, link, reset]);

  const onSubmit = handleSubmit(async (values) => {
    // "" dari dropdown = tanpa kategori -> null supaya kategori lama dilepas.
    const payload = { ...values, categoryId: values.categoryId || null };
    try {
      if (isEditing) {
        await updateLink.mutateAsync({ id: link.id, ...payload });
        toast.success("Link diperbarui");
      } else {
        await createLink.mutateAsync(payload);
        toast.success("Link ditambahkan");
      }
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(`Nama "${values.name}" sudah dipakai link lain`);
        return;
      }
      toast.error("Gagal menyimpan link");
    }
  });

  const saving = isSubmitting || createLink.isPending || updateLink.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit link" : "Link baru"}</DialogTitle>
          <DialogDescription className="hidden sm:block">
            Katalog link produk yang dipakai ulang saat menulis draft.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="link-name">Nama Produk</Label>
            <Input
              id="link-name"
              placeholder="mis. HMNS Farhampton"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive" role="alert">
                {errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="link-url">URL</Label>
            <Input
              id="link-url"
              placeholder="https://s.shopee.co.id/..."
              {...register("url")}
            />
            {errors.url && (
              <p className="text-xs text-destructive" role="alert">
                {errors.url.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="link-category">
              Kategori <span className="font-normal text-muted-foreground">(opsional)</span>
            </Label>
            {categoryOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Belum ada kategori.{" "}
                <Link href="/categories" className="font-medium text-primary hover:underline">
                  Buat di halaman Kategori
                </Link>
                .
              </p>
            ) : (
              <select
                id="link-category"
                {...register("categoryId")}
                className="h-10 w-full rounded-full border border-input bg-card px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              >
                <option value="">Tanpa kategori</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
