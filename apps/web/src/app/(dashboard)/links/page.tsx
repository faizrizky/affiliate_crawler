import type { Metadata } from "next";
import { PageHeader } from "@/common/page-header";
import { LinkList } from "@/links/link-list";

export const metadata: Metadata = {
  title: "Link Produk",
};

export default function LinksPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Link Produk"
        description="Katalog link affiliate yang bisa dipakai ulang saat menulis draft."
      />
      <LinkList />
    </div>
  );
}
