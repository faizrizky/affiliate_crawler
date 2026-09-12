"use client";

import type { ThreadPost } from "@aff/types";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useAffiliateContents } from "@/hooks/use-affiliate";
import { useTemplates } from "@/hooks/use-templates";
import { renderTemplate } from "@/lib/template";
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

const OPTIONAL_FIELDS = [
  { key: "category", variable: "category", label: "Kategori" },
  { key: "context", variable: "context", label: "Konteks" },
  { key: "affiliateLink", variable: "affiliate_link", label: "Link Affiliate" },
] as const;

type Values = {
  product: string;
  category: string;
  context: string;
  affiliateLink: string;
};

const EMPTY_VALUES: Values = {
  product: "",
  category: "",
  context: "",
  affiliateLink: "",
};

export function ApplyTemplateDialog({
  open,
  onOpenChange,
  mode,
  posts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "single" | "batch";
  posts: ThreadPost[];
}) {
  const router = useRouter();
  const { templates } = useTemplates();
  const { generateContent, generateBatchContent } = useAffiliateContents();
  const templateList = templates.data ?? [];
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [values, setValues] = useState<Values>(EMPTY_VALUES);
  const [productError, setProductError] = useState(false);

  const template =
    templateList.find((t) => t.id === selectedTemplateId) ??
    templateList.find((t) => t.isDefault) ??
    templateList[0];

  const visibleFields = template
    ? OPTIONAL_FIELDS.filter(
        (f) =>
          template.variables == null ||
          (template.variables?.includes(f.variable) ?? false),
      )
    : OPTIONAL_FIELDS;

  const preview = template
    ? renderTemplate(template.content, {
        product: values.product,
        category: values.category,
        context: values.context,
        affiliate_link: values.affiliateLink,
      })
    : "";

  const isPending =
    generateContent.isPending || generateBatchContent.isPending;

  const close = () => onOpenChange(false);

  const submit = () => {
    if (!template || posts.length === 0) return;
    if (!values.product.trim()) {
      setProductError(true);
      return;
    }
    const payload = {
      templateId: template.id,
      product: values.product.trim(),
      category: values.category.trim() || undefined,
      context: values.context.trim() || undefined,
      affiliateLink: values.affiliateLink.trim() || undefined,
    };
    const onSuccess = (n: number) => {
      toast.success(`${n} draft dibuat`, {
        action: { label: "Lihat queue", onClick: () => router.push("/queue") },
      });
      close();
    };
    const onError = () => toast.error("Gagal membuat draft");
    if (mode === "batch") {
      generateBatchContent.mutate(
        { ...payload, threadPostIds: posts.map((p) => p.id) },
        {
          onSuccess: (res) => onSuccess(res.created.length),
          onError,
        },
      );
    } else {
      generateContent.mutate(
        { ...payload, threadPostId: posts[0].id },
        {
          onSuccess: () => onSuccess(1),
          onError,
        },
      );
    }
  };

  const description =
    mode === "batch"
      ? `${posts.length} post akan dibuatkan draft`
      : `@${posts[0]?.authorUsername ?? ""}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply Template</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {templateList.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada template. Buat template terlebih dahulu.
          </p>
        ) : (
          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
            <div className="flex flex-col gap-1.5">
              <Label>Template</Label>
              <select
                value={template?.id ?? ""}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="h-10 w-full rounded-full border border-input bg-transparent px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {templateList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Produk</Label>
              <Input
                value={values.product}
                onChange={(e) => {
                  setValues((v) => ({ ...v, product: e.target.value }));
                  if (productError && e.target.value.trim())
                    setProductError(false);
                }}
                placeholder="Nama produk"
                aria-invalid={productError}
                className={
                  productError ? "border-destructive focus-visible:ring-destructive" : ""
                }
              />
              {productError && (
                <p className="text-xs text-destructive">
                  Nama produk wajib diisi.
                </p>
              )}
            </div>

            {visibleFields.map((f) => (
              <div key={f.key} className="flex flex-col gap-1.5">
                <Label>
                  {f.label}{" "}
                  <span className="font-normal text-muted-foreground">
                    (opsional)
                  </span>
                </Label>
                <Input
                  value={values[f.key]}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                />
              </div>
            ))}

            {template && (
              <div className="flex flex-col gap-1.5">
                <Label>Preview</Label>
                <div className="whitespace-pre-wrap rounded-xl border border-border bg-muted/50 p-3 text-sm">
                  {preview}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={!template || posts.length === 0 || isPending}
          >
            {isPending ? "Membuat draft…" : "Generate Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
