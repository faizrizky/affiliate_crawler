export interface TemplateLink {
  /** 1-based; link di posisi N mengisi {{affiliate_link_N}}. */
  position: number;
  link: {
    id: string;
    name: string;
    url: string;
    categoryId: string | null;
  };
}

export interface Template {
  id: string;
  name: string;
  content: string;
  variables: string[] | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  /** Berurutan menurut position. */
  links: TemplateLink[];
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
  /** Urutan = nomor placeholder: linkIds[0] -> {{affiliate_link_1}}. */
  linkIds: string[];
  categoryId?: string | null;
}

export interface TemplateUpdateInput {
  name?: string;
  content?: string;
  linkIds?: string[];
  categoryId?: string | null;
}
