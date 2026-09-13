"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import Link from "next/link";
import { useCategories } from "@/hooks/use-categories";
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
import { LinkSelector } from "@/links/link-selector";
import { Textarea } from "@/ui/textarea";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Max 100 characters"),
  linkId: z.string().min(1, "Pilih link produk"),
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
    defaultValues: { name: "", content: "", linkId: "", categoryId: "" },
  });
  const {
    register,
    reset,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;
  const linkId = watch("linkId");

  useEffect(() => {
    if (editorOpen) {
      reset({
        name: editingTemplate?.name ?? "",
        content: editingTemplate?.content ?? "",
        linkId: editingTemplate?.linkId ?? "",
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
          <DialogDescription>
            Use {"{{variable}}"} placeholders — they are filled in per post.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
              placeholder={
                "Check out {{product}} — perfect for {{context}}. Get yours: {{affiliate_link}}"
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

          <LinkSelector
            id="template-link"
            value={linkId}
            onChange={(next) =>
              setValue("linkId", next, { shouldValidate: true })
            }
            error={errors.linkId?.message}
          />

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
