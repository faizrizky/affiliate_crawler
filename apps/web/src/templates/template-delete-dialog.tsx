"use client";

import { toast } from "sonner";
import { ConfirmDialog } from "@/common/confirm-dialog";
import { useTemplates } from "@/hooks/use-templates";
import { useTemplateStore } from "@/stores/template-store";

export function TemplateDeleteDialog() {
  const deleteTarget = useTemplateStore((s) => s.deleteTarget);
  const setDeleteTarget = useTemplateStore((s) => s.setDeleteTarget);
  const { deleteTemplate } = useTemplates();

  return (
    <ConfirmDialog
      open={Boolean(deleteTarget)}
      onOpenChange={(open) => !open && setDeleteTarget(null)}
      title="Delete template?"
      description={
        deleteTarget
          ? `"${deleteTarget.name}" will be permanently deleted.`
          : undefined
      }
      confirmLabel="Delete"
      destructive
      loading={deleteTemplate.isPending}
      onConfirm={async () => {
        if (!deleteTarget) return;
        try {
          await deleteTemplate.mutateAsync(deleteTarget.id);
          toast.success("Template deleted");
          setDeleteTarget(null);
        } catch {
          toast.error("Could not delete template");
        }
      }}
    />
  );
}
