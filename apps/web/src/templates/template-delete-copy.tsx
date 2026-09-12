import type { Template } from "@aff/types";

/**
 * AffiliateContent.templateId memakai onDelete: Cascade — menghapus template
 * ikut menghapus draft yang dibuat darinya. Peringatan itu harus terbaca
 * sebelum user menekan Hapus, bukan setelah draftnya hilang.
 */
export function describeTemplateDelete(templates: Template[]): string {
  const drafts = templates.reduce(
    (n, t) => n + (t._count?.affiliateContents ?? 0),
    0,
  );
  const what =
    templates.length === 1
      ? `"${templates[0].name}"`
      : `${templates.length} template`;
  if (drafts === 0) {
    return `${what} akan dihapus permanen.`;
  }
  return (
    `${what} akan dihapus permanen, beserta ${drafts} draft ` +
    "yang dibuat dari template ini — draft itu ikut hilang dari Reply Queue."
  );
}
