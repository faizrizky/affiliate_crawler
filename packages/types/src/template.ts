export interface TemplateLink {
  id: string;
  name: string;
  url: string;
}

export interface Template {
  id: string;
  name: string;
  content: string;
  variables: string[] | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  /** null hanya untuk template lama (dibuat sebelum katalog link ada). */
  linkId: string | null;
  link: TemplateLink | null;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  /** Draft yang ikut terhapus kalau template ini dihapus (relasi cascade). */
  _count?: {
    affiliateContents: number;
  };
}

export interface TemplateCreateInput {
  name: string;
  content: string;
  linkId: string;
  categoryId?: string | null;
}

export interface TemplateUpdateInput {
  name?: string;
  content?: string;
  linkId?: string;
  categoryId?: string | null;
}
