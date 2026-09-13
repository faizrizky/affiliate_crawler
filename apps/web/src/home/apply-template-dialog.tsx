"use client";

import type { ThreadPost } from "@aff/types";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useAffiliateContents } from "@/hooks/use-affiliate";
import { useTemplates } from "@/hooks/use-templates";
import { useLinks } from "@/hooks/use-links";
import { MultiLinkSelector } from "@/links/multi-link-selector";
import { linkValues, renderTemplate } from "@/lib/template";
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

// Link tidak lagi teks bebas: diambil dari katalog lewat LinkSelector.
const OPTIONAL_FIELDS = [
  { key: "category", variable: "category", label: "Kategori" },
  { key: "context", variable: "context", label: "Konteks" },
] as const;

type Values = {
  product: string;
  category: string;
  context: string;
};

const EMPTY_VALUES: Values = {
  product: "",
  category: "",
  context: "",
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
  const { links } = useLinks();
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  // null = ikuti link template; array = sudah diubah user di dialog ini.
  const [selectedLinkIds, setSelectedLinkIds] = useState<string[] | null>(null);
  const [values, setValues] = useState<Values>(EMPTY_VALUES);
  const [productError, setProductError] = useState(false);
  const [linkError, setLinkError] = useState(false);

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

  // Link default ikut template yang dipilih, tapi user tetap boleh menggantinya.
  const linkIds = selectedLinkIds ?? (template?.links ?? []).map((l) => l.link.id);
  const urlById = new Map((links.data?.links ?? []).map((l) => [l.id, l.url]));
  const linkUrls = linkIds.map((id) => urlById.get(id) ?? "");

  const preview = template
    ? renderTemplate(template.content, {
        product: values.product,
        category: values.category,
        context: values.context,
        ...linkValues(linkUrls),
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
    if (linkIds.length === 0) {
      setLinkError(true);
      return;
    }
    const payload = {
      templateId: template.id,
      linkIds,
      product: values.product.trim(),
      category: values.category.trim() || undefined,
      context: values.context.trim() || undefined,
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
                onChange={(e) => {
                  setSelectedTemplateId(e.target.value);
                  setSelectedLinkIds(null);
                }}
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

            <MultiLinkSelector
              id="generate-link"
              value={linkIds}
              onChange={(next) => {
                setSelectedLinkIds(next);
                if (next.length) setLinkError(false);
              }}
              error={linkError ? "Pilih minimal satu link produk" : undefined}
            />

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
