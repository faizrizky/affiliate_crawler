"use client";

import type { Template } from "@aff/types";
import { Pencil, Trash2 } from "lucide-react";
import { useTemplateStore } from "@/stores/template-store";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";

export function TemplateCard({ template }: { template: Template }) {
  const openEditor = useTemplateStore((s) => s.openEditor);
  const setDeleteTarget = useTemplateStore((s) => s.setDeleteTarget);
  const variables = template.variables ?? [];

  return (
    <Card className="flex h-full flex-col p-5">
      <h3 className="text-sm font-semibold">{template.name}</h3>
      <div className="mb-3 mt-2 flex-1">
        <p className="line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">
          {template.content}
        </p>
        {variables.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {variables.map((v) => (
              <Badge key={v}>{`{{${v}}}`}</Badge>
            ))}
          </div>
        )}
      </div>
      <div className="mt-auto flex justify-end gap-2 border-t border-border pt-3">
        <Button variant="ghost" size="sm" onClick={() => openEditor(template)}>
          <Pencil />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-red-50 hover:text-destructive"
          onClick={() => setDeleteTarget(template)}
        >
          <Trash2 />
          Delete
        </Button>
      </div>
    </Card>
  );
}
