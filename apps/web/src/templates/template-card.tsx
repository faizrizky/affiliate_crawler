"use client";

import type { Template } from "@aff/types";
import { Pencil, Trash2 } from "lucide-react";
import { CopyButton } from "@/common/copy-button";
import { SelectCheckbox } from "@/common/select-checkbox";
import { useTemplateStore } from "@/stores/template-store";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";

export function TemplateCard({
  template,
  selected = false,
  onToggleSelect,
}: {
  template: Template;
  selected?: boolean;
  onToggleSelect?: (templateId: string) => void;
}) {
  const openEditor = useTemplateStore((s) => s.openEditor);
  const setDeleteTarget = useTemplateStore((s) => s.setDeleteTarget);
  const variables = template.variables ?? [];

  return (
    <Card
      onClick={onToggleSelect ? () => onToggleSelect(template.id) : undefined}
      className={`flex h-full flex-col p-5 ${onToggleSelect ? "cursor-pointer" : ""} ${
        selected ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {onToggleSelect && (
          <SelectCheckbox
            checked={selected}
            onToggle={() => onToggleSelect(template.id)}
            label={template.name}
            className="mt-0.5"
          />
        )}
        <h3 className="min-w-0 flex-1 text-sm font-semibold">{template.name}</h3>
      </div>
      {template.category && (
        <span className="mt-1.5 inline-flex w-fit items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
          {template.category.name}
        </span>
      )}
      {template.links.length > 0 && (
        <ol className="mt-1.5 flex flex-col gap-0.5">
          {template.links.map(({ position, link }) => (
            <li key={link.id} className="flex min-w-0 items-center gap-1.5 text-xs" title={link.url}>
              <span className="shrink-0 rounded-full bg-primary/10 px-1.5 font-semibold text-primary">
                {position}
              </span>
              <span className="truncate font-medium text-primary">{link.name}</span>
            </li>
          ))}
        </ol>
      )}
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
      <div className="mt-auto flex items-center justify-end gap-2 border-t border-border pt-3">
        <CopyButton
          value={template.content}
          label="Copy"
          title="Salin isi template"
          className="px-3"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            openEditor(template);
          }}
        >
          <Pencil />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-red-50 hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            setDeleteTarget(template);
          }}
        >
          <Trash2 />
          Delete
        </Button>
      </div>
    </Card>
  );
}
