"use client";

import type { CategoryListItem } from "@aff/types";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useCategories } from "@/hooks/use-categories";
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

/**
 * Add (category = null) dan Edit memakai form yang sama. State form diambil
 * dari props saat mount — parent memberi `key` baru setiap kali dialog dibuka,
 * jadi tidak perlu menyalin props ke state lewat effect.
 */
export function CategoryEditor({
  open,
  category,
  onOpenChange,
}: {
  open: boolean;
  category: CategoryListItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { createCategory, updateCategory } = useCategories();
  const [name, setName] = useState(category?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const isEditing = category != null;

  const saving = createCategory.isPending || updateCategory.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError("Nama kategori wajib diisi");
    if (trimmed.length > 60) return setError("Maksimal 60 karakter");
    try {
      if (isEditing) {
        await updateCategory.mutateAsync({ id: category.id, name: trimmed });
        toast.success("Kategori diperbarui");
      } else {
        await createCategory.mutateAsync(trimmed);
        toast.success("Kategori ditambahkan");
      }
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(`Kategori "${trimmed}" sudah ada`);
        return;
      }
      setError("Gagal menyimpan kategori");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit kategori" : "Kategori baru"}</DialogTitle>
          <DialogDescription>
            Kelompokkan template, mis. &ldquo;Fashion Bayi&rdquo; atau &ldquo;Skincare&rdquo;.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="category-name">Nama kategori</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="mis. Fashion Bayi"
              autoFocus
            />
            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
