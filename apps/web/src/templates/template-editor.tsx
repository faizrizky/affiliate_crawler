"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
  const isEditing = Boolean(editingTemplate);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", content: "", linkId: "" },
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
      });
    }
  }, [editorOpen, editingTemplate, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEditing && editingTemplate) {
        await updateTemplate.mutateAsync({
          id: editingTemplate.id,
          ...values,
        });
        toast.success("Template updated");
      } else {
        await createTemplate.mutateAsync(values);
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
