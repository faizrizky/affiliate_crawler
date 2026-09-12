"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FileText, Plus } from "lucide-react";
import { listItem, listStagger } from "@/animations/list-motion";
import { EmptyState } from "@/common/empty-state";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { useTemplates } from "@/hooks/use-templates";
import { useTemplateStore } from "@/stores/template-store";
import { AppPagination } from "@/pagination/app-pagination";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";
import { TemplateCard } from "./template-card";
import { TemplateDeleteDialog } from "./template-delete-dialog";
import { TemplateEditor } from "./template-editor";

export function TemplateList() {
  const { templates } = useTemplates();
  const openEditor = useTemplateStore((s) => s.openEditor);
  const list = templates.data ?? [];
  const { page, setPage, pageSize, setPageSize, totalPages, visible } =
    useClientPagination(list, "templates");

  return (
    <>
      {templates.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : list.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Button onClick={() => openEditor(null)}>
              <Plus />
              New template
            </Button>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${page}-${pageSize}`}
              variants={listStagger}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {visible.map((template) => (
                <motion.div key={template.id} variants={listItem}>
                  <TemplateCard template={template} />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
          <AppPagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
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
