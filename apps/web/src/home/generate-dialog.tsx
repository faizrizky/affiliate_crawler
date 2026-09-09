"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/common/confirm-dialog";
import { useAffiliateContents } from "@/hooks/use-affiliate";
import { useTemplates } from "@/hooks/use-templates";
import { renderTemplate } from "@/lib/template";
import { useGenerateStore } from "@/stores/generate-store";
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
import { Textarea } from "@/ui/textarea";

const schema = z.object({
  product: z.string().trim().min(1, "Product is required").max(200),
  category: z.string().trim().max(100),
  context: z.string().trim().max(500),
  affiliateLink: z.string().trim().max(500),
});

type FormData = z.infer<typeof schema>;

const DEFAULTS: FormData = {
  product: "",
  category: "",
  context: "",
  affiliateLink: "",
};

export function GenerateDialog() {
  const { post, close } = useGenerateStore();
  const { templates } = useTemplates();
  const { generateContent } = useAffiliateContents();
  const [templateId, setTemplateId] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (!post) return;
    form.reset(DEFAULTS);
    setTemplateId("");
  }, [post, form]);

  useEffect(() => {
    const list = templates.data ?? [];
    if (list.length === 0) return;
    if (!templateId || !list.some((t) => t.id === templateId)) {
      const def = list.find((t) => t.isDefault) ?? list[0];
      setTemplateId(def.id);
    }
  }, [post, templates.data, templateId]);

  const selectedTemplate = (templates.data ?? []).find(
    (t) => t.id === templateId,
  );
  const values = form.watch();
  const preview = selectedTemplate
    ? renderTemplate(selectedTemplate.content, {
        product: values.product,
        category: values.category,
        context: values.context,
        affiliate_link: values.affiliateLink,
      })
    : "";
  const dirty =
    values.product !== "" ||
    values.category !== "" ||
    values.context !== "" ||
    values.affiliateLink !== "";

  const requestClose = () => {
    if (dirty) setConfirmClose(true);
    else close();
  };

  const onSubmit = async (data: FormData) => {
    if (!post || !templateId) return;
    try {
      await generateContent.mutateAsync({
        templateId,
        topicId: post.topicId,
        product: data.product,
        category: data.category || undefined,
        context: data.context || undefined,
        affiliateLink: data.affiliateLink || undefined,
      });
      toast.success("Draft saved");
      close();
    } catch {
      toast.error("Could not save draft");
    }
  };

  return (
    <>
      <Dialog open={post != null} onOpenChange={(open) => !open && requestClose()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Generate affiliate content</DialogTitle>
            <DialogDescription>
              Fill in the details and the selected template will fill in the
              copy.
            </DialogDescription>
          </DialogHeader>

          {post && (
            <div className="rounded-xl border border-border bg-accent/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Source post · @{post.authorUsername}
              </p>
              <p className="mt-1 line-clamp-3 text-xs text-foreground/80">
                {post.content}
              </p>
            </div>
          )}

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="gen-template">Template</Label>
              <select
                id="gen-template"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="h-10 w-full rounded-full border border-input bg-transparent px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {(templates.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gen-product">Product</Label>
              <Input
                id="gen-product"
                placeholder="e.g. Vitamin C serum"
                {...form.register("product")}
              />
              {form.formState.errors.product && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.product.message}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="gen-category">Category</Label>
                <Input
                  id="gen-category"
                  placeholder="e.g. Skincare"
                  {...form.register("category")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gen-context">Context</Label>
                <Input
                  id="gen-context"
                  placeholder="e.g. daily routine"
                  {...form.register("context")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gen-link">Affiliate link</Label>
              <Input
                id="gen-link"
                placeholder="https://…"
                {...form.register("affiliateLink")}
              />
            </div>

            {selectedTemplate && (
              <div className="space-y-1.5">
                <Label>Preview</Label>
                <div className="min-h-20 whitespace-pre-wrap rounded-xl border border-border bg-accent/40 p-3 text-sm leading-relaxed">
                  {preview || (
                    <span className="text-muted-foreground">
                      Fill in the fields to preview the copy…
                    </span>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={requestClose}
                disabled={generateContent.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={generateContent.isPending}>
                {generateContent.isPending ? "Saving…" : "Save draft"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={(open) => !open && setConfirmClose(false)}
        title="Discard draft?"
        description="The form has unsaved changes."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          setConfirmClose(false);
          close();
        }}
      />
    </>
  );
}
