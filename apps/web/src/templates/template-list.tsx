"use client";

import { FileText, Plus } from "lucide-react";
import { EmptyState } from "@/common/empty-state";
import { useTemplates } from "@/hooks/use-templates";
import { useTemplateStore } from "@/stores/template-store";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";
import { TemplateCard } from "./template-card";
import { TemplateDeleteDialog } from "./template-delete-dialog";
import { TemplateEditor } from "./template-editor";

export function TemplateList() {
  const { templates } = useTemplates();
  const openEditor = useTemplateStore((s) => s.openEditor);

  return (
    <>
      {templates.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : templates.data && templates.data.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Button onClick={() => openEditor(null)}>
              <Plus />
              New template
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.data.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="No templates yet"
          description="Create your first template to structure your affiliate copy."
          action={
            <Button onClick={() => openEditor(null)}>
              <Plus />
              New template
            </Button>
          }
        />
      )}
      <TemplateEditor />
      <TemplateDeleteDialog />
    </>
  );
}
