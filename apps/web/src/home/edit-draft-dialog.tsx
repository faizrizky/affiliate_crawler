"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type {
  AffiliateContentListItem,
  AffiliateContentStatus,
} from "@aff/types";
import { ConfirmDialog } from "@/common/confirm-dialog";
import { useAffiliateContents } from "@/hooks/use-affiliate";
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

export const STATUS_LABELS: Record<AffiliateContentStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

const schema = z.object({
  product: z.string().trim().min(1, "Product is required").max(200),
  category: z.string().trim().max(100),
  context: z.string().trim().max(500),
  affiliateLink: z.string().trim().max(500),
  replyLink: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) => v === "" || /^https:\/\/(www\.)?threads\.(com|net)\/@[\w.]+\/post\/[\w-]+/i.test(v),
      "Harus link post Threads, mis. https://www.threads.com/@kamu/post/abc",
    ),
  content: z.string().trim().min(1, "Content is required"),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

type FormData = z.infer<typeof schema>;

const EMPTY: FormData = {
  product: "",
  category: "",
  context: "",
  affiliateLink: "",
  replyLink: "",
  content: "",
  status: "DRAFT",
};

interface Props {
  draft: AffiliateContentListItem | null;
  onOpenChange: (open: boolean) => void;
}

export function EditDraftDialog({ draft, onOpenChange }: Props) {
  const { updateContent } = useAffiliateContents();
  const [confirmClose, setConfirmClose] = useState(false);
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });
  const { isDirty } = form.formState;

  useEffect(() => {
    if (!draft) return;
    form.reset({
      product: draft.product,
      category: draft.category ?? "",
      context: draft.context ?? "",
      affiliateLink: draft.affiliateLink ?? "",
      replyLink: draft.replyLink ?? "",
      content: draft.content,
      status: draft.status,
    });
  }, [draft, form]);

  const requestClose = () => {
    if (isDirty) setConfirmClose(true);
    else onOpenChange(false);
  };

  const onSubmit = async (data: FormData) => {
    if (!draft) return;
    try {
      await updateContent.mutateAsync({ id: draft.id, ...data });
      toast.success("Draft updated");
      onOpenChange(false);
    } catch {
      toast.error("Could not update draft");
    }
  };

  return (
    <>
      <Dialog open={draft != null} onOpenChange={(open) => !open && requestClose()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit draft</DialogTitle>
            <DialogDescription>
              Adjust the copy or change the status of this draft.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-product">Product</Label>
              <Input id="edit-product" {...form.register("product")} />
              {form.formState.errors.product && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.product.message}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-category">Category</Label>
                <Input id="edit-category" {...form.register("category")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-context">Context</Label>
                <Input id="edit-context" {...form.register("context")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-link">Affiliate link</Label>
              <Input
                id="edit-link"
                placeholder="https://…"
                {...form.register("affiliateLink")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-reply-link">Link balasan di Threads</Label>
              <Input
                id="edit-reply-link"
                placeholder="https://www.threads.com/@kamu/post/…"
                {...form.register("replyLink")}
              />
              <p className="text-xs text-muted-foreground">
                Opsional. Tempel setelah kamu posting; auto-publish memakai akun di link ini.
              </p>
              {form.formState.errors.replyLink && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.replyLink.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                rows={6}
                {...form.register("content")}
              />
              {form.formState.errors.content && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.content.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-status">Status</Label>
              <select
                id="edit-status"
                {...form.register("status")}
                className="h-10 w-full rounded-full border border-input bg-transparent px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {(Object.keys(STATUS_LABELS) as AffiliateContentStatus[]).map(
                  (status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ),
                )}
              </select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={requestClose}
                disabled={updateContent.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateContent.isPending}>
                {updateContent.isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={(open) => !open && setConfirmClose(false)}
        title="Discard changes?"
        description="The form has unsaved changes."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          setConfirmClose(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}
