"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import Link from "next/link";
import { useCategories } from "@/hooks/use-categories";
import { useLinks } from "@/hooks/use-links";
import { useTemplates } from "@/hooks/use-templates";
import { useTemplateStore } from "@/stores/template-store";
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
import { highestLinkNumber } from "@/lib/template";
import { MultiLinkSelector } from "@/links/multi-link-selector";
import { Textarea } from "@/ui/textarea";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Max 100 characters"),
  linkIds: z.array(z.string()).min(1, "Pilih minimal satu link produk"),
  categoryId: z.string(),
  content: z
    .string()
    .trim()
    .min(1, "Content is required")
    .max(5000, "Max 5000 characters"),
});

type FormValues = z.infer<typeof schema>;

export function TemplateEditor() {
  const { editorOpen, editingTemplate, closeEditor } = useTemplateStore();
  const { createTemplate, updateTemplate } = useTemplates();
  const { categories } = useCategories();
  const categoryOptions = categories.data ?? [];
  const isEditing = Boolean(editingTemplate);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", content: "", linkIds: [], categoryId: "" },
  });
  const {
    register,
    reset,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;
  const linkIds = watch("linkIds");
  const categoryId = watch("categoryId");
  const content = watch("content");
  const { links } = useLinks();
  // Placeholder yang nomornya melebihi jumlah link tidak akan terisi saat generate.
  const neededLinks = highestLinkNumber(content ?? "");

  useEffect(() => {
    if (editorOpen) {
      reset({
        name: editingTemplate?.name ?? "",
        content: editingTemplate?.content ?? "",
        linkIds: (editingTemplate?.links ?? []).map((l) => l.link.id),
        categoryId: editingTemplate?.categoryId ?? "",
      });
    }
  }, [editorOpen, editingTemplate, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      // "" dari dropdown = tanpa kategori -> kirim null supaya kategori lama dilepas.
      const payload = { ...values, categoryId: values.categoryId || null };
      if (isEditing && editingTemplate) {
        await updateTemplate.mutateAsync({
          id: editingTemplate.id,
          ...payload,
        });
        toast.success("Template updated");
      } else {
        await createTemplate.mutateAsync(payload);
        toast.success("Template created");
      }
      closeEditor();
    } catch {
      toast.error("Could not save template");
    }
  });

  const saving = isSubmitting || createTemplate.isPending || updateTemplate.isPending;

  return (
    <Dialog open={editorOpen} onOpenChange={(open) => !open && closeEditor()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit template" : "New template"}</DialogTitle>
          {/* Disembunyikan di mobile supaya form muat satu layar tanpa scroll. */}
          <DialogDescription className="hidden sm:block">
            Use {"{{variable}}"} placeholders — they are filled in per post.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              placeholder="e.g. Review with CTA"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive" role="alert">
                {errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="template-content">Content</Label>
            <Textarea
              id="template-content"
              rows={8}
              // Mobile: 4 baris (bisa di-drag lebih tinggi) supaya form + daftar link
              // tetap muat satu layar; desktop tetap 8 baris.
              className="h-24 resize-y sm:h-auto"
              placeholder={
                "Check out {{product}} — perfect for {{context}}. Link 1: {{affiliate_link_1}} Link 2: {{affiliate_link_2}}"
              }
              {...register("content")}
            />
            {errors.content && (
              <p className="text-xs text-destructive" role="alert">
                {errors.content.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="template-category">
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
                id="template-category"
                {...register("categoryId", {
                  // Ganti kategori: link terpilih yang bukan dari kategori baru
                  // dilepas, supaya pilihan link ikut tersaring.
                  onChange: (e) => {
                    const next = e.target.value as string;
                    if (!next) return;
                    const byId = new Map((links.data?.links ?? []).map((l) => [l.id, l]));
                    const kept = linkIds.filter((id) => byId.get(id)?.categoryId === next);
                    if (kept.length !== linkIds.length) {
                      setValue("linkIds", kept, { shouldValidate: false });
                    }
                  },
                })}
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

          <MultiLinkSelector
            id="template-link"
            categoryId={categoryId || null}
            value={linkIds}
            onChange={(next) => setValue("linkIds", next, { shouldValidate: true })}
            error={errors.linkIds?.message}
          />
          {neededLinks > linkIds.length && (
            <p className="-mt-1 text-xs text-amber-700" role="status">
              Isi template memakai {`{{affiliate_link_${neededLinks}}}`}, tapi baru {linkIds.length} link dipilih —
              placeholder yang tidak punya link tidak akan terisi.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeEditor}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving…"
                : isEditing
                  ? "Save changes"
                  : "Create template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
