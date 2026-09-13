import type { Metadata } from "next";
import { CategoryList } from "@/categories/category-list";
import { PageHeader } from "@/common/page-header";

export const metadata: Metadata = {
  title: "Kategori",
};

export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Kategori" description="Kelompokkan template supaya gampang dicari saat membuat draft." />
      <CategoryList />
    </div>
  );
}
