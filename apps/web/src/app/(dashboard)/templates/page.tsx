import type { Metadata } from "next";
import { PageHeader } from "@/common/page-header";
import { TemplateList } from "@/templates/template-list";

export const metadata: Metadata = {
  title: "Templates",
};

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        description="Reusable affiliate copy templates live here. Apply one to reviewed posts and the structure is filled in per post."
      />
      <TemplateList />
    </div>
  );
}
